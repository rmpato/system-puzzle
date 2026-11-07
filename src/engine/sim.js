// Generic, data-driven system-design simulation. No DOM, no Three.js.
// A scenario file (src/scenarios/*.js) describes pools, nodes, shop, traffic, hazards and questions.
// See SCENARIOS.md for the schema.

export const TUNING = {
  startMoney: 100,
  failRep: 0.12,
  repRegen: 0.4,
  questionBonus: 25,
  cardReward: 25,
  cardPenalty: 6,
  puzzleItem: 4,
  puzzlePerfect: 10,
  discount: 0.6,
};

const sum = (obj, f) => Object.entries(obj || {}).reduce((a, [k, v]) => a + f(k, v), 0);

export function createSim(sc, { random = Math.random, tuning = {} } = {}) {
  const T = { ...TUNING, startMoney: sc.money ?? TUNING.startMoney, ...(sc.tuning || {}), ...tuning };
  const SHOP = sc.shop, TYPES = sc.types, PHASES = sc.phases, HZ = sc.hazards || {}, POOLS = sc.pools, C = sc.connections;
  const CARDS = sc.cards || {}, PUZZLES = sc.puzzles || {}, QUESTIONS = sc.questions || [];

  const S = {
    mode: 'setup', // setup | play | incident | break | over
    userPaused: false,
    time: 0, phase: 0, phaseTime: 0,
    money: T.startMoney, rep: 100, moneyRate: 0, lastMoney: T.startMoney,
    built: {}, discount: {}, hint: {},
    served: 0, failed: 0, revenue: 0,
    tok: {}, demand: {}, load: {}, nodeLoad: {}, hotT: 0, meterT: 0,
    accum: {}, seen: {}, signals: [], flags: [],
    pendingDup: 0, outage: false, queued: 0, raceTimer: 4, raceTaken: {},
    counts: { duplicate: 0, race: 0, timeout: 0, lost: 0, scaleFirst: 0 },
    firsts: {}, timeline: [], answers: {}, judge: { pts: 0, max: 0 },
    queue: [], scheduled: [], breakQueue: [], breakTotal: 0, ending: false, outageEnd: false,
  };
  for (const p in POOLS) { S.tok[p] = 0; S.demand[p] = 0; S.load[p] = 0; }
  const reqs = [];
  let seq = 0;
  const listeners = [];
  const emit = (type, p) => listeners.forEach((f) => f(type, p));

  // ── derived values
  const item = (id) => SHOP.find((s) => s.id === id);
  const count = (id) => S.built[id] || 0;
  const has = (id) => count(id) > 0;
  const cap = (p) => POOLS[p].base + sum(POOLS[p].per, (id, v) => count(id) * v);
  const connections = () => (!C ? 0 : has(C.fix) ? C.fixed : C.base + sum(C.per, (id, v) => count(id) * v));
  const connBad = () => !!C && connections() > C.limit;
  const upkeep = () => SHOP.reduce((a, s) => a + (s.upkeep || 0) * count(s.id), 0);
  const price = (id) => {
    const s = item(id);
    return Math.round(s.cost * (S.discount[id] ? T.discount : 1) * (1 + count(id) * (s.costStep || 0)));
  };
  const canBuy = (id) => S.mode !== 'setup' && S.mode !== 'over' && count(id) < (item(id).max || 1) && S.money >= price(id);
  const live = () => S.mode === 'play' && !S.userPaused;
  const nodePools = (node) => Object.keys(POOLS).filter((p) => POOLS[p].node === node);
  const nodeCap = (node) => nodePools(node).reduce((a, p) => a + cap(p), 0);

  const signal = (t) => { if (t && !S.signals.includes(t)) S.signals.push(t); };
  const flag = (t) => { if (t && !S.flags.includes(t)) S.flags.push(t); };
  const log = (kind, text, tone = 'info') => S.timeline.push({ t: S.time, phase: S.phase, kind, text, tone });
  const first = (key, text, tone = 'bad') => {
    if (S.firsts[key] !== undefined) return;
    S.firsts[key] = S.time;
    if (text) log('event', text, tone);
  };

  // ── setup
  function ask(indices) {
    if (!indices.length) flag('Designed without asking a single question');
    let bonus = 0;
    for (const i of indices) {
      const q = QUESTIONS[i];
      if (q.good) bonus += T.questionBonus;
      if (q.flag) { flag(q.flag); S.rep -= 5; }
      log('ask', `Asked "${q.q}"`, q.good ? 'good' : 'bad');
    }
    const strong = indices.filter((i) => QUESTIONS[i].good).length;
    if (strong === 3) signal('Asked 3 strong clarifying questions before designing');
    else if (strong) signal(`Asked ${strong} strong clarifying question${strong > 1 ? 's' : ''}`);
    S.judge.pts += strong;
    S.judge.max += 3;
    S.money += bonus;
    S.lastMoney = S.money;
    return bonus;
  }
  function start() { S.mode = 'play'; emit('phase', S.phase); }

  // ── interrupts
  function trigger(key, delay = 0) {
    if (!key || S.seen[key] || !CARDS[key]) return;
    S.seen[key] = true;
    if (delay) S.scheduled.push({ at: S.time + delay, key });
    else enqueue(key);
  }
  function enqueue(key) {
    if (S.mode === 'over') return;
    S.queue.push(key);
    if (S.mode === 'play') { S.mode = 'incident'; emit('incident', key); }
  }
  function current() {
    if (S.mode === 'incident') return { kind: 'card', id: S.queue[0], data: CARDS[S.queue[0]], incident: true };
    if (S.mode === 'break') {
      const id = S.breakQueue[0];
      const step = S.breakTotal - S.breakQueue.length + 1;
      return PUZZLES[id] ? { kind: PUZZLES[id].kind, id, data: PUZZLES[id], step, total: S.breakTotal, closing: S.ending } : { kind: 'card', id, data: CARDS[id], step, total: S.breakTotal, closing: S.ending };
    }
    return null;
  }
  function answerCard(id, i) {
    const c = CARDS[id];
    const o = c.opts[i];
    S.judge.max += 1;
    S.answers[id] = o.good;
    if (o.good) { S.judge.pts += 1; S.money += T.cardReward; signal(`${c.title} → ${o.t}`); }
    else { S.rep = Math.max(1, S.rep - T.cardPenalty); flag(`${c.title} → ${o.t}`); }
    if (c.fix && !has(c.fix)) { S.hint[c.fix] = true; if (o.good) S.discount[c.fix] = true; }
    log('answer', `${c.title}: ${o.t}`, o.good ? 'good' : 'bad');
    return { good: o.good, best: c.opts.findIndex((x) => x.good), fix: c.fix && !has(c.fix) ? c.fix : null };
  }
  function solvePuzzle(id, answer) {
    const p = PUZZLES[id];
    let per;
    if (p.kind === 'order') per = p.items.map((_, i) => answer[i] === i);
    else if (p.kind === 'pick') per = p.items.map((it, i) => it.good === answer.includes(i));
    else per = p.items.map((it, i) => answer[i] === it.a);
    const correct = per.filter(Boolean).length;
    const ratio = correct / per.length;
    S.judge.pts += ratio;
    S.judge.max += 1;
    S.answers[id] = ratio === 1;
    const reward = correct * T.puzzleItem + (ratio === 1 ? T.puzzlePerfect : 0);
    S.money += reward;
    if (ratio === 1) signal(p.signal);
    if (ratio < 0.6) flag(p.flag);
    log('puzzle', `${p.title}: ${correct}/${per.length}`, ratio === 1 ? 'good' : ratio < 0.6 ? 'bad' : 'info');
    return { per, correct, total: per.length, ratio, reward };
  }
  function next() {
    if (S.mode === 'incident') S.queue.shift();
    else if (S.mode === 'break') S.breakQueue.shift();
    resume();
  }
  function resume() {
    if (S.queue.length) { S.mode = 'incident'; emit('incident', S.queue[0]); return; }
    if (S.breakQueue.length) { S.mode = 'break'; emit('break', S.breakQueue[0]); return; }
    if (S.ending) { finish(false); return; }
    if (S.mode === 'break') { S.mode = 'play'; emit('phase', S.phase); return; }
    S.mode = 'play';
  }
  function finish(outage) {
    S.mode = 'over';
    S.outageEnd = outage;
    emit('end', { outage });
  }
  function startBreak(list) {
    S.breakQueue = [...list];
    S.breakTotal = list.length;
    S.mode = 'break';
    resume();
  }

  // ── buying
  function buy(id) {
    if (!canBuy(id)) return false;
    const s = item(id);
    const cost = price(id);
    const ctx = [];
    for (const n of Object.keys(S.nodeLoad)) if (S.nodeLoad[n] > 1) ctx.push(`${(sc.nodes.find((x) => x.id === n) || {}).label || n} overloaded`);
    if (connBad()) ctx.push('connection limit');
    if (S.outage) ctx.push(`${HZ.outage?.label || 'service'} down`);
    const sf = sc.report?.scaleFirst;
    if (sf && id === sf.item && sf.fixes.some(([sym, fix]) => S.firsts[sym] !== undefined && !has(fix))) S.counts.scaleFirst++;
    S.money -= cost;
    S.built[id] = count(id) + 1;
    delete S.hint[id];
    if (s.trap && S.phase < (s.trapUntil ?? PHASES.length - 1)) flag(`Over-engineering: ${s.name} too early`);
    log('buy', `${s.name}${ctx.length ? ` (${ctx.join(', ')})` : ''}`, s.trap ? 'bad' : 'info');
    emit('buy', { id, n: count(id) });
    return true;
  }

  // ── requests
  function spawn(type, extra = {}) {
    const D = TYPES[type];
    const by = D.bypass && has(D.bypass.item);
    const r = { id: ++seq, kind: 'req', type, from: D.from || sc.entry || 'users', to: by ? D.bypass.node : D.to || POOLS[D.steps[0].pool].node, t: S.time, dur: (D.dur || 1.3) + random() * 0.4, ...extra };
    reqs.push(r);
    emit('spawn', r);
  }
  function spawnEvent(ev, from, to, dur) {
    const r = { id: ++seq, kind: 'event', type: ev.type || 'event', ev, from, to, t: S.time, dur };
    reqs.push(r);
    emit('spawn', r);
  }
  function fail(r, where) {
    S.failed++;
    S.rep -= T.failRep;
    emit('resolve', { r, ok: false, where });
  }
  function take(p, cost) {
    if (S.tok[p] >= cost) { S.tok[p] -= cost; return true; }
    const fb = POOLS[p].fallback;
    return fb ? take(fb, cost) : false;
  }
  function hazardHit(h, key) {
    S.rep -= h.rep || 0;
    S.money -= h.money || 0;
    first(`hazard:${key}`, h.firstText);
    emit('hit', { text: h.text, at: h.at, soft: !!h.soft });
    trigger(h.card, 1);
  }

  function resolve(r) {
    if (r.kind === 'event') return resolveEvent(r);
    const D = TYPES[r.type];
    first(`type:${r.type}`, D.firstText);
    if (D.cardOnSeen) trigger(D.cardOnSeen, 2.5);
    if (D.bypass && r.to === D.bypass.node) { S.served++; emit('resolve', { r, ok: true }); return; }

    const costs = D.steps.map((st) => {
      let c = st.cost;
      for (const [id, m] of Object.entries(st.mods || {})) if (has(id)) c *= m;
      return c;
    });
    D.steps.forEach((st, i) => { S.demand[st.pool] += costs[i]; });
    for (let i = 0; i < D.steps.length; i++) {
      const st = D.steps[i], c = costs[i];
      if (!c) continue;
      const P = POOLS[st.pool];
      if (P.conn && connBad()) { fail(r, P.node); first('conn', C.firstText || 'Database refused connections'); trigger(C.card); return; }
      if (!take(st.pool, c)) {
        fail(r, P.node);
        if (D.cardOnFail && !(D.cardOnFailUnless && has(D.cardOnFailUnless))) trigger(D.cardOnFail, 1);
        return;
      }
    }
    // decorative hops to the parts that did the work
    D.steps.forEach((st, i) => {
      if (i === 0 || !costs[i]) return;
      let to = POOLS[st.pool].node, idx = 0;
      for (const v of st.via || []) {
        if (has(v.item) && random() < (v.p ?? 1)) { to = v.node || v.item; idx = Math.floor(random() * count(v.item)); break; }
      }
      emit('hop', { type: r.type, from: r.to, to, idx });
    });
    for (const h of D.hops || []) if (!h.if || has(h.if)) emit('hop', { type: r.type, from: r.to, to: h.node, idx: 0 });

    if (!D.value) { S.served++; emit('resolve', { r, ok: true }); return; }
    emit('resolve', { r, ok: true });
    if (r.dup) {
      S.served++;
      const h = HZ.duplicate;
      if (has(h.fix)) { emit('blocked', { text: h.blocked, at: h.at }); return; }
      S.counts.duplicate++;
      hazardHit(h, 'duplicate');
      return;
    }
    if (r.timeout && !has(HZ.timeout.fix)) {
      S.failed++;
      S.counts.timeout++;
      hazardHit({ ...HZ.timeout, soft: true }, 'timeout');
      return;
    }
    if (r.race) {
      if (S.raceTaken[r.race]) {
        S.served++;
        const h = HZ.race;
        if (has(h.fix)) { emit('blocked', { text: h.blocked, at: h.at }); return; }
        S.counts.race++;
        hazardHit(h, 'race');
        return;
      }
      S.raceTaken[r.race] = true;
    }
    S.money += D.value;
    S.revenue += D.value;
    S.served++;
    emit('cash', { value: D.value, at: D.cashAt || r.to });
    if (D.event) spawnEvent(D.event, D.event.from || r.to, D.event.via && has(D.event.via) ? D.event.via : D.event.to, 0.9);
  }
  function resolveEvent(r) {
    const ev = r.ev;
    if (ev.via && r.to === ev.via) {
      emit('resolve', { r, ok: true });
      if (S.outage && HZ.outage?.node === ev.to) S.queued++;
      else spawnEvent(ev, ev.via, ev.to, 0.6);
      return;
    }
    if (S.outage && HZ.outage?.node === r.to) {
      S.counts.lost++;
      S.rep -= HZ.outage.rep ?? 1.5;
      first('lost', HZ.outage.lostText || 'Events were lost during the outage');
      emit('resolve', { r, ok: false, where: r.to });
    } else emit('resolve', { r, ok: true, where: r.to });
  }

  // ── main loop
  function step(dt) {
    if (!live()) return;
    const P = PHASES[S.phase];
    const H = P.hazards || {};
    S.time += dt;
    S.phaseTime += dt;

    for (const p in POOLS) S.tok[p] = Math.min(cap(p), S.tok[p] + cap(p) * dt);
    S.money -= upkeep() * dt;
    S.rep = Math.min(100, S.rep + T.repRegen * dt);

    for (const [type, rate] of Object.entries(P.rates)) {
      S.accum[type] = (S.accum[type] || 0) + rate * dt * (0.6 + random() * 0.8);
      while (S.accum[type] >= 1) {
        S.accum[type] -= 1;
        const extra = {};
        if (H.timeout && HZ.timeout?.type === type && random() < H.timeout) extra.timeout = true;
        spawn(type, extra);
        if (H.duplicate && HZ.duplicate?.type === type && random() < H.duplicate) S.pendingDup++;
      }
    }
    if (S.pendingDup) { S.pendingDup--; spawn(HZ.duplicate.type, { dup: true }); }
    if (H.race) {
      S.raceTimer -= dt;
      if (S.raceTimer <= 0) {
        S.raceTimer = H.race;
        const id = 'race' + Math.floor(S.time * 10);
        first('raceStart', HZ.race.startText, 'info');
        spawn(HZ.race.type, { race: id, ring: true });
        spawn(HZ.race.type, { race: id, ring: true });
      }
    }
    if (H.spike !== undefined && S.phaseTime > H.spike) trigger(HZ.spike?.card);
    if (H.outage) {
      const on = S.phaseTime >= H.outage[0] && S.phaseTime < H.outage[1];
      if (on && !S.outage) { S.outage = true; first('outage', HZ.outage.startText || 'A downstream service went down'); emit('outage', { on: true, node: HZ.outage.node }); trigger(HZ.outage.card, 0.4); }
      if (!on && S.outage) {
        S.outage = false;
        log('event', `${HZ.outage.label || 'Service'} recovered${S.queued ? `; queue delivered ${S.queued}` : ''}`, S.queued ? 'good' : 'info');
        emit('outage', { on: false, node: HZ.outage.node, delivered: S.queued });
        const ev = HZ.outage.event;
        if (ev) for (let i = 0; i < Math.min(S.queued, 30); i++) spawnEvent(ev, ev.via, ev.to, 0.6 + i * 0.05);
        S.queued = 0;
      }
    }

    for (let i = reqs.length - 1; i >= 0; i--) {
      const r = reqs[i];
      if (S.time >= r.t + r.dur) { reqs.splice(i, 1); resolve(r); }
    }
    for (let i = S.scheduled.length - 1; i >= 0; i--) {
      if (S.time >= S.scheduled[i].at) { const k = S.scheduled[i].key; S.scheduled.splice(i, 1); enqueue(k); }
    }

    S.meterT += dt;
    if (S.meterT >= 0.5) {
      const m = S.meterT;
      for (const p in POOLS) S.load[p] = S.load[p] * 0.5 + (S.demand[p] / m / Math.max(0.001, cap(p))) * 0.5;
      for (const n of new Set(Object.values(POOLS).map((p) => p.node))) {
        const d = nodePools(n).reduce((a, p) => a + S.demand[p], 0);
        S.nodeLoad[n] = (S.nodeLoad[n] || 0) * 0.5 + (d / m / Math.max(0.001, nodeCap(n))) * 0.5;
        if (S.nodeLoad[n] > 1.05 && !(C && POOLS[C.pool]?.node === n && connBad())) first(`hot:${n}`, `${(sc.nodes.find((x) => x.id === n) || {}).label || n} overloaded`);
      }
      const ov = HZ.overload;
      if (ov) S.hotT = S.nodeLoad[ov.node] > 1.05 && !connBad() ? S.hotT + m : 0;
      S.moneyRate = S.moneyRate * 0.6 + ((S.money - S.lastMoney) / m) * 0.4;
      S.lastMoney = S.money;
      for (const p in POOLS) S.demand[p] = 0;
      S.meterT = 0;
      emit('meter', {});
    }

    if (S.time > 2.5) trigger(sc.startCard);
    if (HZ.overload && S.hotT > (HZ.overload.after ?? 3)) trigger(HZ.overload.card);

    if (S.rep <= 0) { S.rep = 0; log('event', 'Reputation hit zero. Site down.', 'bad'); finish(true); return; }
    if (S.phaseTime >= P.dur) {
      if (S.phase < PHASES.length - 1) {
        S.phase++;
        S.phaseTime = 0;
        log('phase', `Phase: ${PHASES[S.phase].name}`, 'info');
        emit('phaseEnd', { phase: S.phase - 1 });
        startBreak((sc.breaks || {})[S.phase] || []);
      } else {
        S.ending = true;
        emit('phaseEnd', { phase: S.phase });
        startBreak(sc.finals || []);
      }
    }
  }

  function togglePause() {
    if (S.mode !== 'play') return S.userPaused;
    S.userPaused = !S.userPaused;
    return S.userPaused;
  }

  // ── results & interviewer report
  function results() {
    const R = sc.report || {};
    const total = S.served + S.failed;
    const uptime = total ? (S.served / total) * 100 : 0;
    const judgement = S.judge.max ? (S.judge.pts / S.judge.max) * 100 : 0;
    const f = S.firsts;
    const boughtAt = (id) => S.timeline.find((e) => e.kind === 'buy' && e.text.startsWith(item(id).name))?.t;
    const sig = [...S.signals], fl = [...S.flags];
    const add = (arr, t) => { if (t && !arr.includes(t)) arr.push(t); };
    for (const q of R.required || []) if (!has(q.item) && !(q.unlessAnswer && S.answers[q.unlessAnswer])) add(fl, q.flag);
    for (const q of R.proactive || []) if (has(q.item) && (f[q.before] === undefined || boughtAt(q.item) < f[q.before])) add(sig, q.signal);
    for (const q of R.combos || []) if (q.items.every(has)) add(sig, q.signal);
    for (const q of R.counters || []) if (S.counts[q.counter] >= q.min) add(fl, q.flag.replace('{n}', S.counts[q.counter]));
    if (R.scaleFirst) {
      if (S.counts.scaleFirst >= 2) add(fl, R.scaleFirst.flag);
      else if (R.scaleFirst.fixes.every(([, fix]) => has(fix))) add(sig, R.scaleFirst.signal);
    }
    const traps = SHOP.filter((s) => s.trap && has(s.id)).length;
    if (!traps && R.noTraps) add(sig, R.noTraps);

    const c = S.counts;
    const uptimeScore = Math.max(0, Math.min(100, (uptime - 80) * 5));
    const pen = (k, d) => (HZ[k]?.score ?? d);
    const incidentScore = Math.max(0, 100 - pen('duplicate', 10) * c.duplicate - pen('race', 15) * c.race - pen('outage', 2) * c.lost - pen('timeout', 5) * c.timeout);
    const ops = S.outageEnd ? 0 : uptimeScore * 0.5 + S.rep * 0.3 + incidentScore * 0.2;
    const score = S.outageEnd ? 0 : Math.round(judgement * 0.5 + ops * 0.5 - traps * 4 - Math.max(0, fl.length - sig.length) * 1.5);
    const grade = S.outageEnd ? 'F' : score >= 88 ? 'S' : score >= 78 ? 'A' : score >= 66 ? 'B' : score >= 54 ? 'C' : 'D';
    const verdict = { S: 'Strong hire', A: 'Hire', B: 'Lean hire', C: 'Lean no hire', D: 'No hire', F: 'Site down' }[grade];

    const followups = [];
    for (const q of sc.followups || []) {
      const w = q.when || {};
      const hit = w.always
        || (w.missing && !has(w.missing))
        || (w.wrong && w.wrong.some((id) => S.answers[id] === false))
        || (w.counter && S.counts[w.counter[0]] >= w.counter[1])
        || (w.first && f[w.first] !== undefined && !(w.unless && has(w.unless)))
        || (w.traps && traps > 0);
      if (hit && !followups.includes(q.q)) followups.push(q.q);
    }
    const always = (sc.followups || []).filter((q) => q.when?.always).map((q) => q.q);
    const picked = followups.filter((q) => !always.includes(q)).slice(0, 3).concat(always.slice(0, 1));

    return { grade, verdict, score, uptime, judgement, ops, revenue: S.revenue, rep: S.rep, phase: S.phase, signals: sig, flags: fl, followups: picked, timeline: S.timeline, outage: S.outageEnd };
  }

  return {
    S, reqs, T, sc,
    on: (fn) => listeners.push(fn),
    item, count, has, cap, connections, connBad, upkeep, price, canBuy, live, nodeCap,
    ask, start, buy, step, togglePause, current, answerCard, solvePuzzle, next, results,
  };
}
