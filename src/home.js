// Home: the landing page. A live blueprint hero, the nine exercises as numbered drawing sheets,
// how a round works, and a door into the field manual. Pure DOM, no scenario specifics beyond the registry.
import { SCENARIOS } from './scenarios/index.js';
import { gcpOf } from './gcp.js';
import { CONCEPTS, GROUPS } from './learn.js';

const pad = (n) => String(n).padStart(2, '0');
const DIFF = { easy: 1, medium: 2, hard: 3, expert: 4 };

export const ICON = {
  arrow: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  book: '<svg class="i" viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>',
  pause: '<svg class="i" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  play: '<svg class="i" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  sound: '<svg class="i" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg class="i" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg class="i" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  mark: '<svg class="logo-mark" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="1" width="26" height="26" rx="2"/><rect x="5" y="5" width="7" height="5" rx="1"/><rect x="16" y="5" width="7" height="5" rx="1"/><rect x="10.5" y="18" width="7" height="5" rx="1" fill="#2448f5" stroke="#2448f5"/><path d="M8.5 10v4h11v-4M14 14v4"/></svg>',
};

// ── the live blueprint (hero). Coordinates are in a 520×520 drawing.
const NODES = [
  { x: 36, y: 40, t: 'Users', p: 'clients', ic: null, cls: 'users', emo: '👥' },
  { x: 350, y: 40, t: 'Cloud CDN', p: 'edge · static', ic: 'cloud-cdn' },
  { x: 193, y: 140, t: 'Load balancer', p: 'L7 · global', ic: 'load-balancing' },
  { x: 36, y: 250, t: 'API', p: 'stateless · 1', ic: 'cloud-run' },
  { x: 193, y: 250, t: 'API', p: 'stateless · 2', ic: 'cloud-run' },
  { x: 350, y: 250, t: 'API', p: 'stateless · 3', ic: 'cloud-run' },
  { x: 36, y: 360, t: 'Memorystore', p: 'cache · 90% hit', ic: 'memorystore', cls: 'cache' },
  { x: 193, y: 360, t: 'Cloud SQL', p: 'primary', ic: 'cloud-sql' },
  { x: 350, y: 360, t: 'Pub/Sub', p: 'async · clicks', ic: 'pubsub' },
];
const WIRES = [
  ['w1', 'M103 86 V113 H260 V140'],
  ['w2', 'M260 186 V218 H103 V250'],
  ['w3', 'M260 186 V250'],
  ['w4', 'M260 186 V218 H417 V250'],
  ['w5', 'M103 296 V360'],
  ['w6', 'M260 296 V360'],
  ['w7', 'M417 296 V360'],
  ['w8', 'M260 296 V328 H133 V360'],
];
// packets: [wire, color, duration, delay]
const PACKETS = [
  ['w1', '#2448f5', 1.4, 0], ['w1', '#12804a', 1.4, .5], ['w1', '#2448f5', 1.4, 1],
  ['w2', '#2448f5', 1.2, .3], ['w3', '#12804a', 1.0, .8], ['w4', '#2448f5', 1.2, 1.2], ['w4', '#7c4dff', 1.2, .1],
  ['w5', '#2448f5', .8, .6], ['w5', '#2448f5', .8, 1.5], ['w8', '#2448f5', 1, 1.1],
  ['w6', '#12804a', .9, 1.6], ['w7', '#7c4dff', .9, .9],
];
function plate() {
  const node = (n, i) => `<g class="nd ${n.cls || ''}" style="animation-delay:${0.25 + i * 0.07}s">
      <rect x="${n.x}" y="${n.y}" width="134" height="46" rx="8"/>
      ${n.ic ? `<image href="./assets/gcp/${n.ic}.svg" x="${n.x + 10}" y="${n.y + 11}" width="24" height="24"/>` : `<text x="${n.x + 22}" y="${n.y + 30}" text-anchor="middle" style="font-size:18px">${n.emo}</text>`}
      <text x="${n.x + 42}" y="${n.y + 21}">${n.t}</text><text class="pd" x="${n.x + 42}" y="${n.y + 34}">${n.p.toUpperCase()}</text></g>`;
  return `<div class="plate" aria-hidden="true">
    <div class="plate-grid"></div>
    <span class="tag">Fig. 1 · A URL shortener at 12k req/s</span>
    <svg viewBox="0 0 520 520">
      ${WIRES.map(([id, d], i) => `<path id="${id}" class="wire" d="${d}" style="animation-delay:${0.5 + i * 0.08}s"/>`).join('')}
      <path class="wire d" d="M170 63 H350"/>
      ${NODES.map(node).join('')}
      <g class="ann">
        <path class="dim" d="M506 40 V406 M500 40 H512 M500 406 H512"/>
        <text class="dimt" transform="translate(498 300) rotate(-90)">4 TIERS · P99 42 MS</text>
        <path class="dim" d="M36 244 H170 M36 238 V250 M170 238 V250"/>
        <text class="dimt" x="40" y="239">N × STATELESS</text>
        <text class="hnote" x="44" y="452">90% of reads never</text>
        <text class="hnote" x="44" y="472">touch the database</text>
        <path class="hstroke" d="M100 436 q-8 -14 0 -26 m-5 6 l5 -6 l5 5"/>
        <text class="dimt" x="200" y="58" style="fill:var(--muted)">STATIC ASSETS</text>
      </g>
      ${PACKETS.map(([w, c, dur, d]) => `<circle class="pk" r="4" opacity="0" fill="${c}"><animateMotion dur="${dur}s" begin="${2 + d}s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#${w}"/></animateMotion><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="${dur}s" begin="${2 + d}s" repeatCount="indefinite"/></circle>`).join('')}
    </svg>
    <div class="tb"><div><small>Throughput</small><b data-tb="rps">12,480/s</b></div><div><small>Served</small><b data-tb="served">0</b></div><div><small>p99 latency</small><b data-tb="p99">42 ms</b></div><div><small>Errors</small><b>0.00%</b></div></div>
  </div>`;
}

// ── step illustrations
const STEP_ART = [
  // ask
  `<svg viewBox="0 0 220 106"><rect class="f" x="4" y="8" width="128" height="38" rx="10"/><path class="s" d="M24 46 l-6 12 l16 -12"/><text x="14" y="32">How many users?</text>
   <rect class="y" x="78" y="60" width="138" height="38" rx="10" style="stroke:var(--ink);stroke-width:1.3"/><text x="88" y="84">Reads or writes?</text></svg>`,
  // build
  `<svg viewBox="0 0 220 106"><rect class="f" x="6" y="36" width="54" height="34" rx="6"/><text class="mono" x="14" y="57">API</text>
   <path class="s" d="M60 53 H92"/><rect class="f" x="92" y="36" width="54" height="34" rx="6" style="stroke:var(--blue);stroke-width:1.6"/><text class="mono" x="99" y="57">CACHE</text>
   <path class="s" d="M146 53 H170" style="stroke-dasharray:3 4"/><rect x="170" y="36" width="44" height="34" rx="6" fill="none" style="stroke:var(--muted);stroke-dasharray:4 4;stroke-width:1.3"/><text x="185" y="60">+</text>
   <circle class="b" r="3.5"><animateMotion dur="1.4s" repeatCount="indefinite" path="M60 53 H92"/></circle></svg>`,
  // survive
  `<svg viewBox="0 0 220 106"><path class="s" d="M4 96 H216 M4 96 V8"/><path class="s" d="M8 86 C40 84 60 80 84 76 S120 70 132 30 S150 20 160 60 S190 70 214 64" style="stroke:var(--blue);stroke-width:1.6"/>
   <circle class="r" cx="134" cy="27" r="5"/><text x="146" y="22" style="fill:var(--bad)">surge!</text><path class="s" d="M134 32 V96" style="stroke:var(--bad);stroke-dasharray:3 3"/></svg>`,
  // debrief
  `<svg viewBox="0 0 220 106"><g transform="rotate(-10 52 52)"><circle cx="52" cy="52" r="38" fill="none" style="stroke:var(--good);stroke-width:3"/><circle cx="52" cy="52" r="32" fill="none" style="stroke:var(--good);stroke-width:1"/><text x="52" y="66" text-anchor="middle" style="font:400 42px var(--font-display);fill:var(--good)">A</text></g>
   <path class="s" d="M110 24 H210 M110 42 H196 M110 60 H206 M110 78 H170" style="stroke:var(--line);stroke-width:5;stroke-linecap:round"/></svg>`,
];

export function renderHome(root, { mode, best, progress = { read: 0, passed: 0 }, onStart, onMode }) {
  const played = Object.keys(best).length;
  const sheets = SCENARIOS.map((s, i) => {
    const d = String(s.difficulty).toLowerCase();
    const stack = [...new Set(s.nodes.concat(s.shop.filter((x) => !x.trap)).map((o) => gcpOf(s, o.id, o).product).filter(Boolean))].slice(0, 6);
    return `<button class="sheet rv" data-id="${s.id}" data-d="${d}" style="--d:${i % 3}" aria-label="${s.title}, ${s.difficulty}">
      <span class="sheet-top"><span class="sheet-no">Sheet ${pad(i + 1)} / ${pad(SCENARIOS.length)}</span><span class="diffm" data-d="${d}">${s.difficulty}<span>${[1, 2, 3, 4].map((k) => `<i class="${k <= (DIFF[d] || 1) ? 'on' : ''}"></i>`).join('')}</span></span></span>
      <span class="sheet-art"><span class="sheet-em">${s.icon}</span><span class="sheet-stack">${stack.map((p) => `<img src="./assets/gcp/${p}.svg" alt="">`).join('')}</span></span>
      <span class="sheet-t">${s.title}</span>
      <span class="sheet-p">${s.pitch}</span>
      <span class="sheet-foot"><span class="sheet-topics">${(s.topics || []).slice(0, 3).join(' · ')}</span><span class="sheet-go">${ICON.arrow}</span></span>
      ${best[s.id] ? `<span class="stamp ${best[s.id]}" title="Your best grade">${best[s.id]}</span>` : ''}
    </button>`;
  }).join('');

  const modeNote = (m) => (m === 'interview'
    ? '<b>Interview:</b> no hints, answers sealed until the debrief. Run it with a candidate.'
    : '<b>Practice:</b> every answer explained on the spot, and the parts drawer nudges you toward the fix.');
  const marquee = CONCEPTS.map((c) => `<span>${c.title}</span>`).join('');

  root.innerHTML = `
  <header class="topbar"><div class="wrap">
    <button class="logo" data-scroll="top" aria-label="System Puzzle, back to top">${ICON.mark}<span>System <em>Puzzle</em></span></button>
    <nav class="topnav">
      <button data-scroll="ex">Exercises</button>
      <button data-scroll="how">How it works</button>
      <button data-learn-open>${ICON.book}Field manual</button>
      <button class="pill" data-start-first>Play now</button>
    </nav>
  </div></header>

  <section class="wrap hero" id="top">
    <div>
      <div class="hero-kicker"><span class="live"><i></i>Live traffic</span><span>System design interviews, played</span></div>
      <h1><span class="ln"><span>Design systems</span></span><span class="ln"><span>that survive</span></span><span class="ln"><span><em>real traffic.</em></span></span></h1>
      <p class="hero-lead">Ask the right questions, sketch the architecture while requests flow through it, fix incidents as they fire, and defend every choice in a debrief. Nine exercises, ten minutes each.</p>
      <div class="hero-cta">
        <button class="btn lg" data-start-first>Start with ${SCENARIOS[0].title} <span class="arr">${ICON.arrow}</span></button>
        <div class="segment" role="radiogroup" aria-label="Mode" data-v="${mode}">
          <button role="radio" data-mode="practice" aria-checked="${mode === 'practice'}">Practice</button>
          <button role="radio" data-mode="interview" aria-checked="${mode === 'interview'}">Interview</button>
        </div>
      </div>
      <p class="mode-note">${modeNote(mode)}</p>
      <div class="hero-stats">
        <div><b>${pad(SCENARIOS.length)}</b><small>Exercises</small></div>
        <div><b>${CONCEPTS.length}</b><small>Concept primers</small></div>
        <div><b>${SCENARIOS.reduce((a, s) => a + Object.keys(s.cards || {}).length + Object.keys(s.puzzles || {}).length, 0)}</b><small>Whiteboard calls</small></div>
        ${played || progress.read ? `<div class="you"><b>${played}<span style="font-size:.5em">/${SCENARIOS.length}</span></b><small>You've played</small></div><div class="you"><b>${progress.passed}<span style="font-size:.5em">/${CONCEPTS.length}</span></b><small>Concepts checked</small></div>` : `<div><b>~10<span style="font-size:.5em"> min</span></b><small>Per round</small></div>`}
      </div>
    </div>
    ${plate()}
  </section>

  <div class="marquee" aria-hidden="true"><div class="marquee-t">${marquee}${marquee}</div></div>

  <section class="wrap sec" id="ex">
    <div class="sec-head rv"><div class="sec-no">§ 01 — Exercises</div><h2>Nine sheets, <em>easy to expert.</em></h2><p>Each one is a real interview prompt with a traffic surge at the end: a viral link, a doorbuster, midnight on New Year's Eve.</p></div>
    <div class="filters rv" role="toolbar" aria-label="Filter by difficulty">${['all', 'easy', 'medium', 'hard', 'expert'].map((f) => `<button data-filter="${f}" aria-pressed="${f === 'all'}">${f}</button>`).join('')}</div>
    <div class="sheets">${sheets}</div>
  </section>

  <section class="wrap sec" id="how">
    <div class="sec-head rv"><div class="sec-no">§ 02 — A round</div><h2>Ask. Build. <em>Survive.</em> Defend.</h2><p>The same loop a strong candidate runs on the whiteboard, with consequences you can see.</p></div>
    <div class="loop">
      ${[
        ['Ask', 'Three clarifying questions. Good ones earn budget; skipping them is a red flag.'],
        ['Build', 'Buy parts from the drawer and watch them wire in. Every one is a real Google Cloud product.'],
        ['Survive', 'Phases of rising traffic, incidents that fire when the problem really happens, then the surge.'],
        ['Defend', 'A stamped debrief: grade, signals and red flags, your final diagram, and what to read next.'],
      ].map(([t, p], i) => `<article class="step rv" style="--d:${i}"><span class="step-n"><span>${pad(i + 1)}</span><span>${['~1 min', '~6 min', 'live', 'after'][i]}</span></span><h3>${t}</h3><p>${p}</p><div class="step-art">${STEP_ART[i]}</div></article>`).join('')}
    </div>
  </section>

  <section class="wrap sec" id="manual">
    <div class="fm-teaser rv">
      <div class="fm-teaser-l">
        <div><div class="eyebrow">§ 03 — Field manual</div><h2>The ideas, <em>not the answers.</em></h2></div>
        <p>${CONCEPTS.length} short primers on the concepts underneath every exercise: what it is, when to reach for it, what goes wrong, and one line to say in the interview.</p>
        <div class="fm-prog"><span><i style="width:${(progress.read / CONCEPTS.length) * 100}%"></i></span><small>${progress.read ? `${progress.read} of ${CONCEPTS.length} read · ${progress.passed} checked` : 'Start anywhere; each primer takes ~3 minutes'}</small></div>
        <button class="btn lg" data-learn-open>${progress.read ? 'Continue reading' : 'Open the field manual'} <span class="arr">${ICON.arrow}</span></button>
      </div>
      <div class="fm-chapters">${GROUPS.map(([g, name], i) => {
        const list = CONCEPTS.filter((c) => c.group === g);
        return `<button class="fm-ch" data-learn="${list[0]?.id}"><small><span>Chapter ${pad(i + 1)}</span><span>${list.length} primers</span></small><b>${name}</b><span>${list.slice(0, 4).map((c) => c.title).join(' · ')}</span></button>`;
      }).join('')}</div>
    </div>
  </section>

  <footer class="wrap foot">
    <div><div class="big">Draw it.<br>Ship it. Defend it.</div></div>
    <div class="keysl"><b>Controls</b><span><kbd>Space</kbd> pause</span><span><kbd>1</kbd>–<kbd>9</kbd> buy a part</span><span><kbd>M</kbd> mute</span><span>Drag to orbit · click a part to inspect</span></div>
    <div><b>Colophon</b>Built with Three.js. Product icons are the official set from <a href="https://cloud.google.com/icons" target="_blank" rel="noopener">cloud.google.com/icons</a>. Set in Instrument Serif, Geist and Kalam. Desktop recommended.</div>
  </footer>`;

  // ── behaviour
  const $$ = (s) => root.querySelectorAll(s);
  $$('.sheet').forEach((b) => b.addEventListener('click', () => onStart(b.dataset.id)));
  $$('[data-start-first]').forEach((b) => b.addEventListener('click', () => onStart(SCENARIOS[0].id)));
  $$('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.scroll === 'top' ? null : root.querySelector('#' + b.dataset.scroll);
    root.scrollTo({ top: t ? t.offsetTop - 40 : 0, behavior: 'smooth' });
  }));
  const seg = root.querySelector('.segment');
  seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    seg.dataset.v = m;
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    root.querySelector('.mode-note').innerHTML = modeNote(m);
    onMode(m);
  }));
  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $$('.sheet').forEach((s) => { s.hidden = b.dataset.filter !== 'all' && s.dataset.d !== b.dataset.filter; });
  }));
  // learn buttons inside home are handled by the document-level delegate in main.js ([data-learn], [data-learn-open])

  const bar = root.querySelector('.topbar');
  root.addEventListener('scroll', () => bar.classList.toggle('stuck', root.scrollTop > 8), { passive: true });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { root, threshold: 0.12 });
  $$('.rv').forEach((el) => io.observe(el));

  // title block: a believable live readout
  let served = 0, rps = 12480;
  const rpsEl = root.querySelector('[data-tb="rps"]'), sEl = root.querySelector('[data-tb="served"]'), pEl = root.querySelector('[data-tb="p99"]');
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const tick = setInterval(() => {
    if (root.hidden) return clearInterval(tick);
    rps = Math.max(9000, Math.min(16000, rps + (Math.random() - 0.5) * 900));
    served += rps / 5;
    rpsEl.textContent = `${fmt(rps)}/s`;
    sEl.textContent = served > 1e6 ? `${(served / 1e6).toFixed(2)}M` : fmt(served);
    pEl.textContent = `${Math.round(38 + Math.random() * 9)} ms`;
  }, 200);
}
