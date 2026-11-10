// Home: the exercise picker. One screen, two panes.
// Left: what this is, and the nine prompts as a list (easiest first).
// Right: the selected prompt as the interviewer would put it on the whiteboard: the question,
// the system you start with, the traffic you will face (drawn from the scenario's phases), and Start.
// Pure DOM, everything derived from the scenario registry.
import { SCENARIOS } from './scenarios/index.js';
import { model, stageHtml, runStage } from './stage.js';
import { CONCEPTS } from './learn.js';

const pad = (n) => String(n).padStart(2, '0');
const strip = (h) => String(h).replace(/<[^>]*>/g, '').trim();

export const ICON = {
  arrow: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  book: '<svg class="i" viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>',
  pause: '<svg class="i" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  play: '<svg class="i" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  sound: '<svg class="i" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg class="i" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg class="i" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  // three boxes and two wires: the smallest possible architecture diagram
  mark: '<svg class="logo-mark" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="3" width="9" height="7" rx="1.5"/><rect x="17" y="3" width="9" height="7" rx="1.5"/><rect x="9.5" y="18" width="9" height="7" rx="1.5" fill="var(--blue)" stroke="var(--blue)"/><path d="M6.5 10v3.5h15V10M14 13.5V18"/></svg>',
};

// What each prompt is, in plain words (the titles are playful; this line says what you are designing).
const SYSTEM = {
  'url-shortener': 'URL shortener',
  typeahead: 'Search autocomplete',
  marketplace: 'E-commerce checkout',
  video: 'Video platform',
  chat: 'Messaging',
  feed: 'Social feed',
  tickets: 'Ticket sales',
  rides: 'Ride hailing',
  ledger: 'Payments ledger',
};
const minutes = (s) => Math.round((s.phases.reduce((a, p) => a + p.dur, 0) + 240) / 60);
const diffKey = (s) => String(s.difficulty).toLowerCase();

// ── the traffic you will face: every phase as a stacked bar of its request types, the surge as a spike.
// Widths follow phase durations, heights follow request rates, colors are the dots you see on the board.
// A playhead (moved by the stage loop) shows where the live diagram above is in the run.
function timeline(s) {
  const W = 560, H = 64, top = 4;
  const types = Object.keys(s.types);
  const total = s.phases.reduce((a, p) => a + p.dur, 0);
  const load = (p) => types.reduce((a, t) => a + (p.rates[t] || 0), 0);
  const peak = Math.max(...s.phases.map((p) => load(p) * (p.surge?.mult || 1)));
  const y = (v) => (v / peak) * (H - top);
  let x = 0, bars = '', labels = '';
  s.phases.forEach((p, i) => {
    const w = (p.dur / total) * W;
    const stack = (x0, w0, mult = 1) => {
      let base = H, out = '';
      types.forEach((t) => {
        const h = y((p.rates[t] || 0) * mult);
        if (h < 0.5) return;
        out += `<rect x="${x0.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${Math.max(0, w0 - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${s.types[t].color}"/>`;
        base -= h;
      });
      return out;
    };
    bars += stack(x, w);
    if (p.surge) {
      const sx = x + (p.surge.at / p.dur) * w, sw = Math.max(8, (p.surge.dur / p.dur) * w);
      bars += stack(sx, sw + 2, p.surge.mult);
    }
    labels += `<span style="flex:${p.dur}" data-ph="${i}"><b>${pad(i + 1)}</b>${p.name}</span>`;
    x += w;
  });
  return `<div class="tl"><svg class="tr" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${bars}<rect class="tl-fog" x="0" y="0" width="${W}" height="${H}"/></svg><i class="tl-ph"></i></div>
    <div class="tr-ph">${labels}</div>`;
}

function panel(s, i, best) {
  const d = diffKey(s);
  const M = model(s);
  const v = M.verdict;
  const label = (id) => strip(s.nodes.find((n) => n.id === id)?.label || id);
  const kinds = Object.values(s.types).map((t) => `<span><i style="background:${t.color}"></i>${t.name}</span>`).join('');
  const surge = s.phases.find((p) => p.surge)?.surge;
  return `
    <div class="pn-top"><span class="pn-no">Exercise ${pad(i + 1)}</span><span class="diff" data-d="${d}">${s.difficulty}</span><span>~${minutes(s)} min</span>${best ? `<span class="pn-best">Best <b class="g-${best}">${best}</b></span>` : ''}</div>
    <div class="pn-head">
      <h2 class="pn-t">${s.title}<span>${SYSTEM[s.id] || ''}</span></h2>
      <div class="err" aria-live="off"><small>Failed requests</small><b>0%</b></div>
    </div>
    <blockquote class="prompt">${strip(s.brief).replace(/^"|"$/g, '')}</blockquote>
    <figure class="stage">
      <figcaption><span class="st-tag">A typical first draft</span><span class="st-ph">Phase 1 · ${s.phases[0].name}</span><span class="st-surge" hidden>${surge ? strip(surge.label) : 'Surge'}</span></figcaption>
      ${stageHtml(s)}
      <div class="kinds">${kinds}</div>
    </figure>
    ${timeline(s)}
    <p class="verdict">${v
      ? `The usual first draft falls over in <b>phase ${v.phase + 1}, ${v.name}</b>: ${label(v.node)} at ${Math.round(v.util * 100)}%, and ${Math.round(M.peak.u * 100)}% by the end. <span>You start from an empty board: design yours, then make it hold.</span>`
      : 'The starting system holds the traffic. The incidents are what will test it.'}</p>
    <p class="topics"><b>Tests</b>${(s.topics || []).join(' · ')}</p>`;
}

export function renderHome(root, { mode, best, progress = { read: 0, passed: 0 }, onStart, onMode }) {
  let stopStage = () => {};
  const lastId = (() => { try { return localStorage.getItem('sp-last'); } catch { return null; } })();
  let sel = Math.max(0, SCENARIOS.findIndex((s) => s.id === lastId));
  const played = Object.keys(best).length;

  const rows = SCENARIOS.map((s, i) => `
    <li><button class="ex" data-i="${i}" role="option" aria-selected="${i === sel}">
      <span class="ex-n">${pad(i + 1)}</span>
      <span class="ex-t"><b>${s.title}</b><small>${SYSTEM[s.id] || s.pitch}</small></span>
      <span class="diff" data-d="${diffKey(s)}">${s.difficulty}</span>
      <span class="ex-g ${best[s.id] ? 'g-' + best[s.id] : ''}" title="${best[s.id] ? 'Your best grade' : 'Not played yet'}">${best[s.id] || '–'}</span>
    </button></li>`).join('');

  const modeNote = (m) => (m === 'interview'
    ? 'No hints. Answers stay sealed until the debrief, so you can run it with a candidate.'
    : 'Every answer is explained as you go, and the board points at the fix when something breaks.');

  root.innerHTML = `
  <header class="topbar">
    <a class="logo" href="/">${ICON.mark}<span>Under Load</span></a>
    <nav class="topnav">
      <a href="/guide" data-learn-open>${ICON.book}Field guide<span class="tn-meta">${progress.read ? `${progress.read}/${CONCEPTS.length} read` : `${CONCEPTS.length} primers`}</span></a>
    </nav>
  </header>

  <main class="picker">
    <section class="pk-l">
      <h1>Draw the system.<br><em>Then the traffic arrives.</em></h1>
      <p class="lead">Nine system design interview prompts, played on a board where requests really flow. Ask the interviewer questions, build the architecture, fix what breaks under load, then read your debrief.</p>
      <div class="pk-list-h"><h3>Exercises</h3><span>${played ? `${played} of ${SCENARIOS.length} played · ` : ''}<kbd>↑</kbd><kbd>↓</kbd> <kbd>Enter</kbd></span></div>
      <ol class="pk-list" role="listbox" aria-label="Exercises">${rows}</ol>
      <div class="pk-list-h"><h3>How a round goes</h3><span>~10 min</span></div>
      <ol class="loop">
        ${[
          ['Ask', 'three clarifying questions'],
          ['Design', 'your first version, on an empty board'],
          ['Grow it', 'live traffic, incidents, a surge'],
          ['Debrief', 'grade, red flags, strong design'],
        ].map(([t, p], i) => `<li><b>${i + 1}</b><span><strong>${t}</strong> ${p}</span></li>`).join('')}
      </ol>
    </section>

    <section class="pk-r" aria-live="polite">
      <article class="board-panel"><div class="pn-body"></div>
        <footer class="pn-foot">
          <div class="pn-mode">
            <div class="segment" role="radiogroup" aria-label="Mode" data-v="${mode}">
              <button role="radio" data-mode="practice" aria-checked="${mode === 'practice'}">Practice</button>
              <button role="radio" data-mode="interview" aria-checked="${mode === 'interview'}">Interview</button>
            </div>
            <p class="mode-note">${modeNote(mode)}</p>
          </div>
          <a class="btn lg" data-start href="/play/${SCENARIOS[sel].id}">Start<span class="pn-start-t"></span><span class="arr">${ICON.arrow}</span></a>
        </footer>
      </article>
    </section>
  </main>

`;

  // ── behaviour
  const $ = (q) => root.querySelector(q);
  const body = $('.pn-body');
  const select = (i, focus = false) => {
    sel = (i + SCENARIOS.length) % SCENARIOS.length;
    const s = SCENARIOS[sel];
    root.querySelectorAll('.ex').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.i === sel)));
    stopStage();
    body.innerHTML = panel(s, sel, best[s.id]);
    body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
    const err = body.querySelector('.err'), ph = body.querySelector('.st-ph'), surgeTag = body.querySelector('.st-surge');
    const fog = body.querySelector('.tl-fog'), head = body.querySelector('.tl-ph'), labels = body.querySelectorAll('[data-ph]');
    let lastPhase = -1;
    stopStage = runStage(body.querySelector('.stage'), s, {
      onTick: (a, f, failRate) => {
        const pct = Math.round(failRate * 100);
        err.querySelector('b').textContent = `${pct}%`;
        err.classList.toggle('bad', pct >= 5);
        surgeTag.hidden = !a.surging;
        head.style.left = `${(f * 100).toFixed(2)}%`;
        fog.setAttribute('x', (f * 560).toFixed(1));
        if (a.i !== lastPhase) {
          lastPhase = a.i;
          ph.textContent = `Phase ${a.i + 1} of ${s.phases.length} · ${a.phase.name}`;
          labels.forEach((l) => l.classList.toggle('on', +l.dataset.ph === a.i));
        }
      },
    });
    $('.pn-start-t').textContent = s.title;
    $('[data-start]').href = `/play/${s.id}`;
    if (focus) root.querySelector(`.ex[data-i="${sel}"]`).focus({ preventScroll: false });
    try { localStorage.setItem('sp-last', s.id); } catch {}
  };
  select(sel);

  root.querySelectorAll('.ex').forEach((b) => {
    b.addEventListener('click', () => select(+b.dataset.i));
    b.addEventListener('dblclick', () => onStart(SCENARIOS[+b.dataset.i].id));
  });
  $('[data-start]').addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // open in a new tab
    e.preventDefault();
    onStart(SCENARIOS[sel].id);
  });

  const seg = $('.segment');
  seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.mode;
    seg.dataset.v = m;
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    $('.mode-note').textContent = modeNote(m);
    onMode(m);
  }));

  const onKey = (e) => {
    if (root.hidden || !root.isConnected || !root.contains($('.picker'))) return document.removeEventListener('keydown', onKey);
    if (e.target.closest?.('input, textarea') || !document.getElementById('learn')?.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); select(sel + (e.key === 'ArrowDown' ? 1 : -1), true); }
    else if (e.key === 'Enter' && !e.target.closest?.('.segment, [data-learn-open]')) { e.preventDefault(); onStart(SCENARIOS[sel].id); }
  };
  document.addEventListener('keydown', onKey);
  // learn buttons are handled by the document-level delegate in main.js ([data-learn-open])
}
