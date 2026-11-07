// Headless balance bot: plays the real simulation with different strategies and reports outcomes.
// Usage: node tools/balance.mjs [runs] [strategy]
import { createSim } from '../src/sim.js';
import { QUESTIONS, CARDS, PUZZLES } from '../src/content.js';

const RUNS = +process.argv[2] || 200;
const ONLY = process.argv[3];

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const shuffle = (a, r) => a.map((x) => [r(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

function answerAll(sim, accuracy, r) {
  let guard = 0;
  while ((sim.S.mode === 'incident' || sim.S.mode === 'break') && guard++ < 50) {
    const c = sim.current();
    const right = r() < accuracy;
    if (c.kind === 'card') {
      const best = c.data.opts.findIndex((o) => o.good);
      const pick = right ? best : (best + 1 + Math.floor(r() * 2)) % 3;
      sim.answerCard(c.id, pick);
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

const STRATS = {
  expert: { accuracy: 1, questions: 'good', think(sim, S) {
    const want = [];
    if (S.phase >= 1 && S.firsts.images !== undefined) want.push('cdn');
    if (S.phase >= 1 && S.firsts.search !== undefined) want.push('search');
    if (S.phase >= 1) want.push('idem');
    if (S.phase >= 2 && S.phaseTime < 16) want.push('queue');
    if (S.dbLoad > 0.85 || S.phase >= 2) want.push('cache');
    if (S.phase >= 3) want.push('lock');
    const unfixed = (S.firsts.images !== undefined && !sim.has('cdn')) || (S.firsts.search !== undefined && !sim.has('search'));
    if (S.apiLoad > 0.85 && !unfixed) { if (!sim.has('pgbouncer') && (sim.servers() + 1) * 10 > 40) want.push('pgbouncer'); else want.push('instance'); }
    if (S.dbLoad > 0.9 && sim.has('cache')) want.push('replica');
    for (const id of want) { if (sim.has(id) && id !== 'instance' && id !== 'replica') continue; if (sim.canBuy(id)) sim.buy(id); break; }
  } },
  average: { accuracy: 0.7, questions: 'mixed', delay: 4, think(sim, S, r) {
    // reacts to hints and visible overload, a bit late
    const hinted = Object.keys(S.hint);
    for (const id of hinted) if (sim.canBuy(id) && r() < 0.15) { sim.buy(id); return; }
    if (S.apiLoad > 1 && r() < 0.1) { if (sim.connBad() && sim.canBuy('pgbouncer')) sim.buy('pgbouncer'); else if (sim.canBuy('instance')) sim.buy('instance'); }
    if (S.dbLoad > 1 && r() < 0.08) { if (sim.canBuy('cache')) sim.buy('cache'); else if (sim.canBuy('replica')) sim.buy('replica'); }
    if (sim.connBad() && sim.canBuy('pgbouncer') && r() < 0.2) sim.buy('pgbouncer');
  } },
  human: { accuracy: 0.85, questions: 'good', think(sim, S, r) {
    // strong candidate, human speed: reacts to symptoms ~3s late, never proactive
    if (r() > 0.08) return;
    const f = S.firsts, want = [];
    if (f.images !== undefined) want.push('cdn');
    if (f.search !== undefined) want.push('search');
    if (f.double !== undefined) want.push('idem');
    if (f.outage !== undefined || f.timeout !== undefined) want.push('queue');
    if (f.oversell !== undefined) want.push('lock');
    if (sim.connBad()) want.push('pgbouncer');
    if (S.dbLoad > 1) want.push(sim.has('cache') ? 'replica' : 'cache');
    if (S.apiLoad > 1 && !sim.connBad()) want.push((sim.servers() + 1) * 10 > 40 && !sim.has('pgbouncer') ? 'pgbouncer' : 'instance');
    for (const id of want) { if (sim.has(id) && id !== 'instance' && id !== 'replica') continue; if (sim.canBuy(id)) { sim.buy(id); return; } }
  } },
  scaler: { accuracy: 0.4, questions: 'none', think(sim, S) {
    if (S.apiLoad > 0.9 && sim.canBuy('instance')) sim.buy('instance');
    if (S.dbLoad > 0.9 && sim.canBuy('replica')) sim.buy('replica');
    if (sim.connBad() && sim.canBuy('pgbouncer')) sim.buy('pgbouncer');
  } },
  overeng: { accuracy: 0.6, questions: 'bad', think(sim, S) {
    for (const id of ['micro', 'k8s', 'shard']) if (sim.canBuy(id)) { sim.buy(id); return; }
    STRATS.expert.think(sim, S);
  } },
  idle: { accuracy: 0.33, questions: 'none', think() {} },
};

function play(name, seed) {
  const r = rng(seed);
  const strat = STRATS[name];
  const sim = createSim({ random: rng(seed * 7 + 1) });
  const good = QUESTIONS.map((q, i) => [q, i]);
  const picks = strat.questions === 'good' ? good.filter(([q]) => q.good).slice(0, 3).map(([, i]) => i)
    : strat.questions === 'bad' ? good.filter(([q]) => !q.good).map(([, i]) => i).concat([0])
    : strat.questions === 'mixed' ? shuffle(good.map(([, i]) => i), r).slice(0, 3) : [];
  sim.ask(picks);
  sim.start();
  const dt = 1 / 30;
  let thinkT = 0;
  let guard = 0;
  while (sim.S.mode !== 'over' && guard++ < 30 * 60 * 10) {
    if (sim.S.mode !== 'play') { answerAll(sim, strat.accuracy, r); continue; }
    sim.step(dt);
    thinkT += dt;
    if (thinkT > 0.25) { thinkT = 0; strat.think(sim, sim.S, r); }
  }
  answerAll(sim, strat.accuracy, r);
  return { res: sim.results(), S: sim.S };
}

const names = ONLY ? [ONLY] : Object.keys(STRATS);
for (const name of names) {
  const grades = {};
  let score = 0, uptime = 0, reached = 0, outages = 0, money = 0, judge = 0, flags = 0;
  const flagCounts = {};
  for (let i = 0; i < RUNS; i++) {
    const { res, S } = play(name, i + 1);
    grades[res.grade] = (grades[res.grade] || 0) + 1;
    score += res.score; uptime += res.uptime; reached += res.phase; judge += res.judgement; money += S.money; flags += res.flags.length;
    if (res.outage) outages++;
    for (const f of res.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;
  }
  const n = RUNS;
  const g = ['S', 'A', 'B', 'C', 'D', 'F'].map((k) => `${k}:${String(Math.round(((grades[k] || 0) / n) * 100)).padStart(3)}%`).join(' ');
  console.log(`${name.padEnd(8)} ${g} | score ${(score / n).toFixed(0).padStart(3)} judge ${(judge / n).toFixed(0)} uptime ${(uptime / n).toFixed(1)}% phase ${(reached / n).toFixed(2)} outage ${Math.round((outages / n) * 100)}% $end ${(money / n).toFixed(0)} flags ${(flags / n).toFixed(1)}`);
  if (process.env.FLAGS) console.log('   ', Object.entries(flagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, c]) => `${f} (${Math.round((c / n) * 100)}%)`).join(' · '));
}
