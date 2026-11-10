// The stage: a typical first draft of an exercise's system (the scenario's core nodes, which players build themselves in the game), drawn on the landing page and run against the traffic
// the exercise will throw at it. Everything comes from the scenario data:
//   layout   node positions on the 3D board, flattened to 2D
//   wires    the wires that exist before you buy anything
//   traffic  each phase's request rates (and its surge), compressed into a ~16 s loop
//   load     rate × step cost ÷ pool capacity, the same arithmetic the sim uses (src/engine/sim.js)
// Requests are dots in their type's color. When a part runs past 100% some of them fail and turn red,
// so the page shows, without words, why the game is called Under Load.
import { gcpOf } from './gcp.js';

const strip = (h) => String(h).replace(/<[^>]*>/g, '').trim();
const pad = (n) => String(n).padStart(2, '0');
const FAIL = '#d93a26';
const LOOP = 16;   // seconds for the whole run
const HOLD = 2.2;  // seconds to hold on the final frame before restarting
const W = 700, H = 226, BW = 120, BH = 44;

/** Pure model of the starting system under each phase's traffic. */
export function model(s) {
  const nodes = s.nodes;
  const ids = new Set(nodes.map((n) => n.id));
  const poolNode = (p) => s.pools?.[p]?.node;
  const cap = {};
  for (const P of Object.values(s.pools || {})) cap[P.node] = (cap[P.node] || 0) + P.base;
  const types = Object.keys(s.types);
  const cost = {}, route = {};
  for (const t of types) {
    cost[t] = {};
    const r = ['users'];
    for (const st of s.types[t].steps || []) {
      const n = poolNode(st.pool);
      if (!n || !ids.has(n)) continue;
      cost[t][n] = (cost[t][n] || 0) + st.cost;
      if (r[r.length - 1] !== n) r.push(n);
    }
    route[t] = r.length > 1 ? r : null;
  }
  const total = s.phases.reduce((a, p) => a + p.dur, 0);
  // traffic at sim-time τ: the phase, its rates (surge applied) and each part's utilization
  const at = (tau) => {
    let acc = 0, i = 0;
    while (i < s.phases.length - 1 && tau >= acc + s.phases[i].dur) acc += s.phases[i++].dur;
    const p = s.phases[i], local = tau - acc;
    const surging = !!p.surge && local >= p.surge.at && local <= p.surge.at + p.surge.dur;
    const rates = {};
    for (const t of types) {
      const boost = surging && (!p.surge.types || p.surge.types.includes(t)) ? p.surge.mult : 1;
      rates[t] = (p.rates[t] || 0) * boost;
    }
    const util = {};
    for (const n of Object.keys(cap)) util[n] = types.reduce((a, t) => a + rates[t] * (cost[t][n] || 0), 0) / cap[n];
    return { i, phase: p, rates, util, surging };
  };
  // the first moment the starting system overloads, for the one-line verdict
  let verdict = null;
  for (let tau = 0, step = 0.5; tau <= total && !verdict; tau += step) {
    const a = at(tau);
    const [n, u] = Object.entries(a.util).sort((x, y) => y[1] - x[1])[0] || [];
    if (u > 1) verdict = { phase: a.i, name: a.phase.name, node: n, util: u };
  }
  const peak = (() => { let best = { u: 0 }; for (let tau = 0; tau <= total; tau += 0.5) { const a = at(tau); for (const [n, u] of Object.entries(a.util)) if (u > best.u) best = { u, n, tau }; } return best; })();
  return { nodes, cap, types, route, total, at, verdict, peak };
}

function layout(s) {
  const xs = s.nodes.map((n) => n.pos[0]), zs = s.nodes.map((n) => n.pos[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const px = (x) => BW / 2 + 14 + ((x - x0) / (x1 - x0 || 1)) * (W - BW - 28);
  const pz = (z) => (z1 - z0 < 0.5 ? H / 2 : BH / 2 + 22 + ((z - z0) / (z1 - z0)) * (H - BH - 44));
  return Object.fromEntries(s.nodes.map((n) => [n.id, { x: px(n.pos[0]), y: pz(n.pos[1]) }]));
}

export function stageHtml(s) {
  const P = layout(s);
  const wires = (s.wires || []).filter(([a, b, o = {}]) => P[a] && P[b] && !o.if)
    .map(([a, b, o = {}]) => `<line x1="${P[a].x}" y1="${P[a].y}" x2="${P[b].x}" y2="${P[b].y}" class="${o.dashed ? 'd' : ''}"/>`).join('');
  const node = (n) => {
    const { x, y } = P[n.id], g = gcpOf(s, n.id, n);
    const ext = n.model === 'external', users = n.id === 'users';
    const icon = users ? `<text class="emo" x="${x - BW / 2 + 22}" y="${y + 7}" text-anchor="middle">👥</text>`
      : g.src ? `<image href="${g.src}" x="${x - BW / 2 + 10}" y="${y - 12}" width="24" height="24"/>` : '';
    const lx = x - BW / 2 + (icon ? 42 : 14);
    return `<g class="nd ${ext ? 'ext' : ''} ${users ? 'users' : ''}" data-n="${n.id}">
      <rect x="${x - BW / 2}" y="${y - BH / 2}" width="${BW}" height="${BH}" rx="9"/>${icon}
      <text class="nm" x="${lx}" y="${y - 3}">${strip(n.label).replace(/\s*\(external\)/i, '')}</text>
      ${users ? `<text class="pc" x="${lx}" y="${y + 12}">clients</text>` : ext ? `<text class="pc" x="${lx}" y="${y + 12}">external</text>` : `<rect class="gb" x="${lx}" y="${y + 7}" width="${BW - (lx - (x - BW / 2)) - 40}" height="4" rx="2"/><rect class="gf" x="${lx}" y="${y + 7}" width="0" height="4" rx="2"/><text class="pc" x="${x + BW / 2 - 10}" y="${y + 12}" text-anchor="end">0%</text>`}
    </g>`;
  };
  return `<svg class="dia" viewBox="0 0 ${W} ${H}" role="img" aria-label="The starting architecture of ${s.title}, running the exercise's traffic">
    <g class="wires">${wires}</g><g class="dots"></g><g class="nodes">${s.nodes.map(node).join('')}</g></svg>`;
}

/** Start the loop inside a rendered stage. Returns stop(). */
export function runStage(root, s, hooks = {}) {
  const M = model(s), P = layout(s);
  const svg = root.querySelector('svg.dia'), dotsG = svg.querySelector('.dots');
  const els = {};
  for (const n of M.nodes) {
    const g = svg.querySelector(`[data-n="${n.id}"]`);
    els[n.id] = { g, gf: g.querySelector('.gf'), gb: g.querySelector('.gb'), pc: g.querySelector('.pc'), shown: 0 };
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const dots = [];
  let served = [], failed = [], start = performance.now(), last = start, raf = 0, stopped = false;

  const paint = (a, dt) => {
    for (const [n, e] of Object.entries(els)) {
      if (!e.gf) continue;
      const u = a.util[n] || 0;
      e.shown += (u - e.shown) * Math.min(1, dt * 6);
      const w = +e.gb.getAttribute('width');
      e.gf.setAttribute("width", (Math.max(0, Math.min(1, e.shown)) * w).toFixed(1));
      e.pc.textContent = `${Math.round(e.shown * 100)}%`;
      e.g.classList.toggle('hot', e.shown > 1);
      e.g.classList.toggle('warm', e.shown > 0.8 && e.shown <= 1);
    }
  };
  const spawn = (t) => {
    const r = M.route[t];
    if (!r || dots.length > 140) return;
    const el = document.createElementNS(NS, 'circle');
    el.setAttribute('r', '3.6');
    el.setAttribute('fill', s.types[t].color);
    dotsG.appendChild(el);
    dots.push({ el, r, seg: 0, t: 0, dur: 0.55 + Math.random() * 0.25, jit: (Math.random() - 0.5) * 8, dead: 0 });
  };

  const frame = (now) => {
    if (stopped || !root.isConnected) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    let el = (now - start) / 1000;
    if (el > LOOP + HOLD) { start = now; el = 0; dots.splice(0).forEach((d) => d.el.remove()); served = []; failed = []; }
    const tau = Math.min(1, el / LOOP) * M.total;
    const a = M.at(Math.min(tau, M.total - 0.01));
    paint(a, dt);
    hooks.onTick?.(a, tau / M.total, rate());

    // new requests: the busier the phase, the denser the stream (scaled so the busiest phase stays legible)
    if (el < LOOP) {
      const sum = M.types.reduce((x, t) => x + a.rates[t], 0);
      let n = sum * dt * (16 / Math.max(1, M.peakRate || (M.peakRate = maxRate(M))));
      while (n > 0) { if (Math.random() < n) spawn(pick(M.types, a.rates, sum)); n -= 1; }
    }
    for (let k = dots.length - 1; k >= 0; k--) {
      const d = dots[k];
      if (d.dead) {
        d.dead += dt;
        d.el.setAttribute('cy', (+d.el.getAttribute('cy') + dt * 30).toFixed(1));
        d.el.setAttribute('opacity', Math.max(0, 1 - d.dead * 2).toFixed(2));
        if (d.dead > 0.5) { d.el.remove(); dots.splice(k, 1); }
        continue;
      }
      d.t += dt / d.dur;
      if (d.t >= 1) {
        d.seg++; d.t = 0;
        const at = d.r[d.seg], u = a.util[at] || 0;
        if (u > 1 && Math.random() < 1 - 1 / u) { d.dead = 0.001; d.el.setAttribute('fill', FAIL); failed.push(now); continue; }
        if (d.seg >= d.r.length - 1) { served.push(now); d.el.remove(); dots.splice(k, 1); continue; }
      }
      const A = P[d.r[d.seg]], B = P[d.r[d.seg + 1]];
      if (!B) { d.el.remove(); dots.splice(k, 1); continue; }
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      d.el.setAttribute('cx', (A.x + dx * d.t - (dy / len) * d.jit).toFixed(1));
      d.el.setAttribute('cy', (A.y + dy * d.t + (dx / len) * d.jit).toFixed(1));
    }
    raf = requestAnimationFrame(frame);
  };
  const rate = () => {
    const now = performance.now(), cut = now - 2500;
    served = served.filter((x) => x > cut); failed = failed.filter((x) => x > cut);
    const n = served.length + failed.length;
    return n < 4 ? 0 : failed.length / n;
  };

  if (reduced) { // a still frame at the worst moment
    const a = M.at(M.peak.tau ?? M.total * 0.9);
    for (const e of Object.values(els)) e.shown = 0;
    paint(a, 1);
    const worst = Math.max(0, ...Object.values(a.util));
    hooks.onTick?.(a, (M.peak.tau ?? M.total * 0.9) / M.total, worst > 1 ? 1 - 1 / worst : 0);
  } else raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

function pick(types, rates, sum) {
  let r = Math.random() * sum;
  for (const t of types) { r -= rates[t]; if (r <= 0) return t; }
  return types[types.length - 1];
}
function maxRate(M) {
  let m = 0;
  for (let tau = 0; tau <= M.total; tau += 1) { const a = M.at(tau); m = Math.max(m, M.types.reduce((x, t) => x + a.rates[t], 0)); }
  return m;
}
export { pad };
