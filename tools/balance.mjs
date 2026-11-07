// Headless balance bot: plays the real simulation of a scenario with several strategies.
// Usage: node tools/balance.mjs [scenario|all] [runs] [strategy]
//   FLAGS=1 also prints the most common red flags per strategy.
import { createSim } from '../src/engine/sim.js';
import { SCENARIOS, byId } from '../src/scenarios/index.js';

const [, , scArg = 'all', runsArg, ONLY] = process.argv;
const RUNS = +runsArg || 150;

function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const shuffle = (a, r) => a.map((x) => [r(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const syms = (it) => [].concat(it.symptom || []);

function answerAll(sim, accuracy, r) {
  let guard = 0;
  while ((sim.S.mode === 'incident' || sim.S.mode === 'break') && guard++ < 60) {
    const c = sim.current();
    const right = r() < accuracy;
    if (c.kind === 'card') {
      const best = c.data.opts.findIndex((o) => o.good);
      const n = c.data.opts.length;
      sim.answerCard(c.id, right ? best : (best + 1 + Math.floor(r() * (n - 1))) % n);
    } else {
      const p = c.data;
      let ans;
      if (p.kind === 'order') ans = right ? p.items.map((_, i) => i) : shuffle(p.items.map((_, i) => i), r);
      else if (p.kind === 'pick') ans = right ? p.items.map((it, i) => (it.good ? i : -1)).filter((i) => i >= 0) : shuffle(p.items.map((_, i) => i), r).slice(0, p.pick);
      else ans = p.items.map((it) => (right ? it.a : Math.floor(r() * p.buckets.length)));
      sim.solvePuzzle(c.id, ans);
    }
    sim.next();
  }
}

// Generic helpers driven by shop metadata (scales / symptom / proactive / relieves / fixesConn / trap)
const seen = (S, it) => syms(it).some((k) => S.firsts[k] !== undefined);
const unfixedFor = (sim, pool) => sim.sc.shop.some((it) => it.relieves === pool && seen(sim.S, it) && !sim.has(it.id));
function scaleWant(sim, it) {
  const C = sim.sc.connections;
  if (C && C.per?.[it.id] && !sim.has(C.fix) && sim.connections() + C.per[it.id] > C.limit) return C.fix;
  return it.id;
}
const maxed = (sim, id) => sim.count(id) >= (sim.item(id).max || 1);
const loadOf = (sim, it) => sim.S.nodeLoad[sim.sc.pools[it.scales].node] || 0;
function tryBuy(sim, ids, save = true) {
  for (const id of ids) {
    if (maxed(sim, id)) continue;
    if (sim.canBuy(id)) { sim.buy(id); return true; }
    if (save) return false; // save up for the top priority
  }
  return false;
}

const STRATS = {
  expert: { accuracy: 1, questions: 'good', think(sim, S) {
    const want = [];
    const C = sim.sc.connections;
    if (C && sim.connBad()) want.push(C.fix);
    for (const it of sim.sc.shop) if (!it.trap && !it.scales && !it.fixesConn && (seen(S, it) || (it.proactive !== undefined && S.phase >= it.proactive))) want.push(it.id);
    for (const it of sim.sc.shop) if (it.scales && loadOf(sim, it) > 0.85 && !unfixedFor(sim, it.scales)) want.push(scaleWant(sim, it));
    tryBuy(sim, [...new Set(want)]);
  } },
  human: { accuracy: 0.85, questions: 'good', think(sim, S, r) {
    if (r() > 0.08) return; // ~3s reaction time, never proactive
    const want = [];
    const C = sim.sc.connections;
    if (C && sim.connBad()) want.push(C.fix);
    for (const it of sim.sc.shop) if (!it.trap && !it.scales && !it.fixesConn && seen(S, it)) want.push(it.id);
    for (const it of sim.sc.shop) if (it.scales && loadOf(sim, it) > 1) want.push(scaleWant(sim, it));
    tryBuy(sim, [...new Set(want)], false);
  } },
  average: { accuracy: 0.7, questions: 'mixed', think(sim, S, r) {
    for (const id of Object.keys(S.hint)) if (sim.canBuy(id) && r() < 0.15) { sim.buy(id); return; }
    const C = sim.sc.connections;
    if (C && sim.connBad() && sim.canBuy(C.fix) && r() < 0.2) { sim.buy(C.fix); return; }
    for (const it of sim.sc.shop) if (it.scales && loadOf(sim, it) > 1 && r() < 0.1 && sim.canBuy(it.id)) { sim.buy(it.id); return; }
  } },
  scaler: { accuracy: 0.4, questions: 'none', think(sim) {
    const C = sim.sc.connections;
    if (C && sim.connBad() && sim.canBuy(C.fix)) { sim.buy(C.fix); return; }
    for (const it of sim.sc.shop) if (it.scales && loadOf(sim, it) > 0.9 && sim.canBuy(it.id)) { sim.buy(it.id); return; }
  } },
  overeng: { accuracy: 0.6, questions: 'bad', think(sim, S, r) {
    for (const it of sim.sc.shop) if (it.trap && !sim.has(it.id) && sim.canBuy(it.id)) { sim.buy(it.id); return; }
    STRATS.expert.think(sim, S, r);
  } },
  idle: { accuracy: 0.33, questions: 'none', think() {} },
};

export function play(sc, name, seed) {
  const r = rng(seed);
  const strat = STRATS[name];
  const sim = createSim(sc, { random: rng(seed * 7 + 1) });
  const qs = sc.questions.map((q, i) => [q, i]);
  const picks = strat.questions === 'good' ? qs.filter(([q]) => q.good).slice(0, 3).map(([, i]) => i)
    : strat.questions === 'bad' ? qs.filter(([q]) => !q.good).map(([, i]) => i).slice(0, 2).concat([qs.find(([q]) => q.good)[1]])
    : strat.questions === 'mixed' ? shuffle(qs.map(([, i]) => i), r).slice(0, 3) : [];
  sim.ask(picks);
  sim.start();
  const dt = 1 / 30;
  let thinkT = 0, guard = 0;
  while (sim.S.mode !== 'over' && guard++ < 30 * 60 * 15) {
    if (sim.S.mode !== 'play') { answerAll(sim, strat.accuracy, r); continue; }
    sim.step(dt);
    thinkT += dt;
    if (thinkT > 0.25) { thinkT = 0; strat.think(sim, sim.S, r); }
  }
  answerAll(sim, strat.accuracy, r);
  return { res: sim.results(), S: sim.S };
}

export function report(sc, runs = RUNS, only) {
  const out = [];
  console.log(`\n▶ ${sc.title} (${sc.id})`);
  for (const name of only ? [only] : Object.keys(STRATS)) {
    const grades = {};
    let score = 0, uptime = 0, reached = 0, outages = 0, money = 0, judge = 0, flags = 0, time = 0;
    const flagCounts = {};
    for (let i = 0; i < runs; i++) {
      const { res, S } = play(sc, name, i + 1);
      grades[res.grade] = (grades[res.grade] || 0) + 1;
      score += res.score; uptime += res.uptime; reached += res.phase; judge += res.judgement; money += S.money; flags += res.flags.length; time += S.time;
      if (res.outage) outages++;
      for (const f of res.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;
    }
    const n = runs;
    const g = ['S', 'A', 'B', 'C', 'D', 'F'].map((k) => `${k}:${String(Math.round(((grades[k] || 0) / n) * 100)).padStart(3)}%`).join(' ');
    console.log(`${name.padEnd(8)} ${g} | score ${(score / n).toFixed(0).padStart(3)} judge ${(judge / n).toFixed(0)} uptime ${(uptime / n).toFixed(1)}% phase ${(reached / n).toFixed(2)} outage ${Math.round((outages / n) * 100)}% $end ${(money / n).toFixed(0)} flags ${(flags / n).toFixed(1)} play ${(time / n).toFixed(0)}s`);
    if (process.env.FLAGS) console.log('   ', Object.entries(flagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, c]) => `${f} (${Math.round((c / n) * 100)}%)`).join(' · '));
    out.push({ name, grades, score: score / n });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = scArg === 'all' ? SCENARIOS : scArg.endsWith('.js') ? [(await import(new URL(scArg, `file://${process.cwd()}/`).href)).default] : [byId(scArg)];
  if (!list[0]) { console.error(`Unknown scenario "${scArg}". Known: ${SCENARIOS.map((s) => s.id).join(', ')}`); process.exit(1); }
  for (const sc of list) report(sc, RUNS, ONLY);
}
