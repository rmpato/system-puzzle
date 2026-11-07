// Pure game simulation: no DOM, no Three.js. The renderer and the balance bot both drive it.
import { TYPES, SHOP, PHASES, QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS, FOLLOWUPS } from './content.js';

export const CONN_LIMIT = 40;
export const TUNING = {
  startMoney: 100,
  checkoutValue: 10,
  apiPerServer: 8,
  dbCap: 12,
  replicaCap: 12,
  serverUpkeep: 0.5,
  failRep: 0.12,
  repRegen: 0.4,
  questionBonus: 25,
  cardReward: 25,
  cardPenalty: 6,
  puzzleItem: 4,
  puzzlePerfect: 10,
  discount: 0.6,
};

export function createSim({ random = Math.random, tuning = {} } = {}) {
  const T = { ...TUNING, ...tuning };
  const S = {
    mode: 'setup', // setup | play | incident | break | over
    userPaused: false,
    time: 0, phase: 0, phaseTime: 0,
    money: T.startMoney, rep: 100, moneyRate: 0, lastMoney: T.startMoney,
    built: {}, discount: {}, hint: {},
    served: 0, failed: 0, revenue: 0,
    api: 0, db: 0, read: 0,
    apiDemand: 0, dbDemand: 0, apiLoad: 0, dbLoad: 0, dbHot: 0, meterT: 0,
    accum: {}, seen: {}, signals: [], flags: [],
    pendingDupes: 0, outage: false, queued: 0, raceTimer: 4, stockTaken: {},
    counts: { double: 0, oversell: 0, lostNotif: 0, timeouts: 0, scaleFirst: 0 },
    firsts: {}, timeline: [], answers: {}, judge: { pts: 0, max: 0 },
    queue: [], scheduled: [], breakQueue: [], ending: false, outageEnd: false,
  };
  const reqs = [];
  let seq = 0;
  const listeners = [];
  const emit = (type, p) => listeners.forEach((f) => f(type, p));

  // ── derived values
  const count = (id) => S.built[id] || 0;
  const has = (id) => count(id) > 0;
  const servers = () => 1 + count('instance');
  const apiCap = () => servers() * T.apiPerServer + (has('k8s') ? 8 : 0) + (has('micro') ? 4 : 0);
  const dbCap = () => T.dbCap + (has('shard') ? 16 : 0);
  const readCap = () => count('replica') * T.replicaCap;
  const connections = () => (has('pgbouncer') ? 20 : servers() * 10 + (has('k8s') ? 10 : 0));
  const connBad = () => connections() > CONN_LIMIT;
  const upkeep = () => count('instance') * T.serverUpkeep + SHOP.reduce((a, s) => a + (s.upkeep && has(s.id) ? s.upkeep : 0), 0);
  const item = (id) => SHOP.find((s) => s.id === id);
  const price = (id) => {
    const s = item(id);
    return Math.round(s.cost * (S.discount[id] ? T.discount : 1) * (id === 'instance' ? 1 + count('instance') * 0.15 : 1));
  };
  const canBuy = (id) => S.mode !== 'setup' && S.mode !== 'over' && count(id) < (item(id).max || 1) && S.money >= price(id);
  const live = () => S.mode === 'play' && !S.userPaused;

  const signal = (t) => { if (!S.signals.includes(t)) S.signals.push(t); };
  const flag = (t) => { if (!S.flags.includes(t)) S.flags.push(t); };
  const log = (kind, text, tone = 'info') => S.timeline.push({ t: S.time, phase: S.phase, kind, text, tone });
  const first = (key, text, tone = 'bad') => {
    if (S.firsts[key] !== undefined) return;
    S.firsts[key] = S.time;
    log('event', text, tone);
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
  function start() {
    S.mode = 'play';
    emit('phase', S.phase);
  }

  // ── interrupts (incidents, whiteboard breaks)
  function trigger(key, delay = 0) {
    if (S.seen[key]) return;
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
      return PUZZLES[id] ? { kind: PUZZLES[id].kind, id, data: PUZZLES[id] } : { kind: 'card', id, data: CARDS[id] };
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
    if (p.kind === 'order') per = p.items.map((_, i) => answer[i] === i); // answer[i] = item index placed at position i
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

  // ── buying
  function buy(id) {
    if (!canBuy(id)) return false;
    const s = item(id);
    const cost = price(id);
    const ctx = [];
    if (S.apiLoad > 1) ctx.push('API overloaded');
    if (S.dbLoad > 1) ctx.push('DB overloaded');
    if (connBad()) ctx.push('connection limit');
    if (S.outage) ctx.push('notifications down');
    if (id === 'instance' && ((S.firsts.images !== undefined && !has('cdn')) || (S.firsts.search !== undefined && !has('search')))) S.counts.scaleFirst++;
    S.money -= cost;
    S.built[id] = count(id) + 1;
    delete S.hint[id];
    if (s.trap && S.phase < 3) flag(`Over-engineering: ${s.name} too early`);
    log('buy', `${s.name}${ctx.length ? ` (${ctx.join(', ')})` : ''}`, s.trap ? 'bad' : 'info');
    emit('buy', { id, n: count(id) });
    return true;
  }

  // ── requests
  function spawn(type, extra = {}) {
    const toCdn = type === 'image' && has('cdn');
    const r = { id: ++seq, kind: 'req', type, from: 'users', to: toCdn ? 'cdn' : 'api', t: S.time, dur: 1.3 + random() * 0.4, ...extra };
    reqs.push(r);
    emit('spawn', r);
  }
  function spawnNotif(from, to, dur) {
    const r = { id: ++seq, kind: 'notif', type: 'notif', from, to, t: S.time, dur };
    reqs.push(r);
    emit('spawn', r);
  }
  function fail(r, where) {
    S.failed++;
    S.rep -= T.failRep;
    emit('resolve', { r, ok: false, where });
  }
  function hit(kind, rep, money, at) {
    S.rep -= rep;
    S.money -= money;
    emit('hit', { kind, at });
  }

  function resolve(r) {
    if (r.kind === 'notif') return resolveNotif(r);
    const { type, dupe, timeout, race } = r;
    const D = TYPES[type];
    if (type === 'image' && has('cdn')) { S.served++; emit('resolve', { r, ok: true }); return; }
    let apiCost = D.api, dbCost = D.db;
    if (type === 'search' && has('search')) { apiCost = 1; dbCost = 0; }
    if (type === 'browse' && has('cache')) dbCost = 0.5;
    S.apiDemand += apiCost;
    S.dbDemand += dbCost;
    if (type === 'image') { first('images', 'Product images started hitting the API'); trigger('images', 2.5); }
    if (type === 'search') first('search', 'Full-text search started hitting the DB');

    if (S.api < apiCost) { fail(r, 'api'); if (type === 'search') trigger('search', 1); return; }
    S.api -= apiCost;
    if (dbCost > 0) {
      if (connBad()) { fail(r, 'db'); first('conn', 'DB refused connections (limit reached)'); trigger('connections'); return; }
      if (D.read && S.read >= dbCost) S.read -= dbCost;
      else if (S.db >= dbCost) S.db -= dbCost;
      else { fail(r, 'db'); if (type === 'search' && !has('search')) trigger('search', 1); return; }
      const to = type === 'browse' && has('cache') && random() < 0.5 ? 'cache' : D.read && has('replica') && random() < 0.5 ? 'replica' : 'db';
      emit('hop', { type, from: 'api', to, idx: Math.floor(random() * count('replica')) });
    } else if (type === 'search') emit('hop', { type, from: 'api', to: 'search' });

    if (type !== 'checkout') { S.served++; emit('resolve', { r, ok: true }); return; }

    emit('hop', { type, from: 'api', to: 'psp' });
    emit('resolve', { r, ok: true });
    if (dupe) {
      S.served++;
      if (has('idem')) { emit('blocked', {}); return; }
      S.counts.double++;
      first('double', 'First double charge');
      hit('double', 4, T.checkoutValue, 'psp');
      trigger('double', 1);
      return;
    }
    if (timeout && !has('queue')) {
      S.failed++;
      S.rep -= 1;
      S.counts.timeouts++;
      first('timeout', 'Payment timeout lost a sale');
      emit('hit', { kind: 'timeout', at: 'psp', soft: true });
      trigger('timeout', 1);
      return;
    }
    if (race) {
      if (S.stockTaken[race]) {
        S.served++;
        if (has('lock')) { emit('soldout', {}); return; }
        S.counts.oversell++;
        first('oversell', 'Oversold the last item');
        hit('oversell', 5, 25, 'db');
        trigger('race', 1);
        return;
      }
      S.stockTaken[race] = true;
    }
    S.money += T.checkoutValue;
    S.revenue += T.checkoutValue;
    S.served++;
    emit('cash', T.checkoutValue);
    spawnNotif('psp', has('queue') ? 'queue' : 'notify', 0.9);
  }
  function resolveNotif(r) {
    if (r.to === 'queue') {
      emit('resolve', { r, ok: true });
      if (S.outage) S.queued++;
      else spawnNotif('queue', 'notify', 0.6);
      return;
    }
    if (S.outage) {
      S.counts.lostNotif++;
      S.rep -= 1.5;
      first('lost', 'Notifications were lost during the outage');
      emit('resolve', { r, ok: false, where: 'notify' });
    } else emit('resolve', { r, ok: true, where: 'notify' });
  }

  // ── main loop
  function step(dt) {
    if (!live()) return;
    const P = PHASES[S.phase];
    S.time += dt;
    S.phaseTime += dt;

    S.api = Math.min(apiCap(), S.api + apiCap() * dt);
    S.db = Math.min(dbCap(), S.db + dbCap() * dt);
    S.read = Math.min(readCap(), S.read + readCap() * dt);
    S.money -= upkeep() * dt;
    S.rep = Math.min(100, S.rep + T.repRegen * dt);

    for (const [type, rate] of Object.entries(P.rates)) {
      S.accum[type] = (S.accum[type] || 0) + rate * dt * (0.6 + random() * 0.8);
      while (S.accum[type] >= 1) {
        S.accum[type] -= 1;
        if (type === 'checkout') {
          spawn('checkout', { timeout: !!P.timeouts && random() < P.timeouts });
          if (P.dupes && random() < P.dupes) S.pendingDupes++;
        } else spawn(type);
      }
    }
    if (S.pendingDupes) { S.pendingDupes--; spawn('checkout', { dupe: true }); }
    if (P.drops) {
      S.raceTimer -= dt;
      if (S.raceTimer <= 0) {
        S.raceTimer = 7;
        const id = 'drop' + Math.floor(S.time);
        first('drop', 'Limited drops started (last item races)', 'info');
        spawn('checkout', { race: id });
        spawn('checkout', { race: id });
      }
    }
    if (P.spike && S.phaseTime > P.spike) trigger('spike');
    if (P.outage) {
      const on = S.phaseTime >= P.outage[0] && S.phaseTime < P.outage[1];
      if (on && !S.outage) { S.outage = true; first('outage', 'Notification service went down'); trigger('notify', 0.4); }
      if (!on && S.outage) {
        S.outage = false;
        log('event', `Notification service recovered${S.queued ? `; queue delivered ${S.queued}` : ''}`, S.queued ? 'good' : 'info');
        emit('delivered', S.queued);
        for (let i = 0; i < Math.min(S.queued, 30); i++) spawnNotif('queue', 'notify', 0.6 + i * 0.05);
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
      S.apiLoad = S.apiLoad * 0.5 + (S.apiDemand / m / apiCap()) * 0.5;
      S.dbLoad = S.dbLoad * 0.5 + (S.dbDemand / m / (dbCap() + readCap())) * 0.5;
      S.dbHot = S.dbLoad > 1.05 && !connBad() ? S.dbHot + m : 0;
      S.moneyRate = S.moneyRate * 0.6 + ((S.money - S.lastMoney) / m) * 0.4;
      S.lastMoney = S.money;
      S.apiDemand = S.dbDemand = 0;
      S.meterT = 0;
      if (S.apiLoad > 1.05) first('apiHot', 'API overloaded');
      if (S.dbLoad > 1.05 && !connBad()) first('dbHot', 'Database overloaded');
      emit('meter', {});
    }

    if (S.time > 2.5) trigger('start');
    if (S.dbHot > 3) trigger('dbload');

    if (S.rep <= 0) { S.rep = 0; log('event', 'Reputation hit zero. Site down.', 'bad'); finish(true); return; }
    if (S.phaseTime >= P.dur) {
      if (S.phase < PHASES.length - 1) {
        S.phase++;
        S.phaseTime = 0;
        log('phase', `Phase: ${PHASES[S.phase].name}`, 'info');
        S.breakQueue = [...(BREAKS[S.phase] || [])];
      } else {
        S.ending = true;
        S.breakQueue = [...FINALS];
      }
      S.mode = 'break';
      resume();
    }
  }

  function togglePause() {
    if (S.mode !== 'play') return S.userPaused;
    S.userPaused = !S.userPaused;
    return S.userPaused;
  }

  // ── results & interviewer report
  function results() {
    const total = S.served + S.failed;
    const uptime = total ? (S.served / total) * 100 : 0;
    const judgement = S.judge.max ? (S.judge.pts / S.judge.max) * 100 : 0;
    const f = S.firsts;
    const before = (id, key) => has(id) && (f[key] === undefined || S.timeline.find((e) => e.kind === 'buy' && e.text.startsWith(item(id).name)).t < f[key]);

    // architecture observations
    const sig = [...S.signals], fl = [...S.flags];
    const add = (arr, t) => { if (!arr.includes(t)) arr.push(t); };
    if (!has('idem')) add(fl, 'No strategy for duplicate payments');
    if (!has('cache') && S.answers.cart !== true) add(fl, 'Cart lives only in the session');
    if (S.counts.lostNotif > 3) add(fl, `Lost ${S.counts.lostNotif} notifications in an outage`);
    if (S.counts.oversell > 0) add(fl, `Oversold the last item ${S.counts.oversell}×`);
    if (S.counts.scaleFirst >= 2) add(fl, 'Added servers instead of fixing expensive paths');
    if (has('idem') && has('queue')) add(sig, 'Idempotency + at-least-once delivery');
    if (before('idem', 'double')) add(sig, 'Added idempotency before the first double charge');
    if (before('queue', 'outage')) add(sig, 'Planned for a service failure before it happened');
    if (before('pgbouncer', 'conn')) add(sig, 'Pooled connections before hitting the limit');
    if (before('lock', 'oversell') && has('lock')) add(sig, 'Protected stock before the first race');
    if (has('cdn') && has('search') && S.counts.scaleFirst < 2) add(sig, 'Fixed expensive paths before scaling out');
    if (!SHOP.some((s) => s.trap && has(s.id))) add(sig, 'No premature Kafka / Kubernetes / sharding');

    const traps = SHOP.filter((s) => s.trap && has(s.id)).length;
    const c = S.counts;
    const uptimeScore = Math.max(0, Math.min(100, (uptime - 80) * 5));
    const incidentScore = Math.max(0, 100 - 10 * c.double - 15 * c.oversell - 2 * c.lostNotif - 5 * c.timeouts);
    const ops = S.outageEnd ? 0 : uptimeScore * 0.5 + S.rep * 0.3 + incidentScore * 0.2;
    const score = S.outageEnd ? 0 : Math.round(judgement * 0.5 + ops * 0.5 - traps * 4 - Math.max(0, fl.length - sig.length) * 1.5);
    const grade = S.outageEnd ? 'F' : score >= 88 ? 'S' : score >= 78 ? 'A' : score >= 66 ? 'B' : score >= 54 ? 'C' : 'D';
    const verdict = { S: 'Strong hire', A: 'Hire', B: 'Lean hire', C: 'Lean no hire', D: 'No hire', F: 'Site down' }[grade];

    // follow-ups for the interviewer, worst gaps first
    const gaps = [];
    const g = (key, cond) => { if (cond && !gaps.includes(key)) gaps.push(key); };
    g('idem', !has('idem') || S.answers.double === false || S.counts.double > 2);
    g('queue', !has('queue') || S.answers.notify === false || S.counts.lostNotif > 0);
    g('pgbouncer', S.answers.connections === false || (f.conn !== undefined && !has('pgbouncer')));
    g('lock', S.counts.oversell > 0 || S.answers.race === false);
    g('timeout', S.answers.timeout === false);
    g('routing', S.answers.routing === false);
    g('contract', S.answers.contract === false || S.answers.response === false);
    g('flutter', S.answers.flutter === false);
    g('domains', S.answers.domains === false || S.answers.split === false);
    g('cart', S.answers.cart === false);
    g('flow', S.answers.flow === false);
    g('cdn', !has('cdn') || S.answers.images === false);
    g('search', !has('search') || S.answers.search === false);
    g('scale', S.counts.scaleFirst >= 2 || traps > 0);
    g('reverse', true);
    const followups = gaps.slice(0, 4).map((k) => FOLLOWUPS[k]);

    return { grade, verdict, score, uptime, judgement, ops, revenue: S.revenue, rep: S.rep, phase: S.phase, signals: sig, flags: fl, followups, timeline: S.timeline, outage: S.outageEnd };
  }

  return {
    S, reqs, T,
    on: (f) => listeners.push(f),
    count, has, servers, apiCap, dbCap, readCap, connections, connBad, upkeep, price, canBuy, live,
    ask, start, buy, step, togglePause, current, answerCard, solvePuzzle, next, results,
  };
}
