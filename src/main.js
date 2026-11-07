import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createSim } from './engine/sim.js';
import { makeModel, INK } from './engine/models.js';
import { SCENARIOS, byId } from './scenarios/index.js';

const $ = (id) => document.getElementById(id);
const FAIL_COLOR = '#e5484d';
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

// ═════════════════════════════════════════════ persistence (per-viewer convenience only)
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ═════════════════════════════════════════════ sound
let ac = null, muted = store.get('sp-muted', false);
let mode = store.get('sp-mode', 'practice'); // practice: answers explained · interview: answers hidden until the debrief
const interview = () => mode === 'interview';
let speed = 1;
const review = []; // every answer, for the debrief
const lastSfx = {};
function tone(freq, dur = 0.08, type = 'sine', vol = 0.05, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const SFX = {
  coin: () => { tone(988, 0.05, 'square', 0.02); tone(1319, 0.09, 'square', 0.02, 0.05); },
  fail: () => tone(150, 0.08, 'square', 0.015),
  build: () => [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'triangle', 0.05, i * 0.06)),
  alert: () => { tone(740, 0.12, 'sawtooth', 0.025); tone(494, 0.18, 'sawtooth', 0.025, 0.14); },
  good: () => { tone(784, 0.1, 'triangle', 0.05); tone(1047, 0.16, 'triangle', 0.05, 0.09); },
  bad: () => { tone(330, 0.12, 'triangle', 0.05); tone(220, 0.2, 'triangle', 0.05, 0.1); },
  tick: () => tone(660, 0.05, 'triangle', 0.04),
  phase: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.045, i * 0.09)),
  boom: () => { tone(110, 0.25, 'sawtooth', 0.04); tone(82, 0.35, 'square', 0.03, 0.05); },
};
function sfx(name) {
  const now = performance.now();
  const gap = { fail: 180, coin: 120 }[name] || 0;
  if (gap && now - (lastSfx[name] || 0) < gap) return;
  lastSfx[name] = now;
  SFX[name]?.();
}
function unlockAudio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch {} }

// ═════════════════════════════════════════════ scene (shared across scenarios)
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
document.body.appendChild(labelRenderer.domElement);

const PAPER = '#eef2f6';
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, 50, 95);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const HOME = new THREE.Vector3(0, 25, 26);
camera.position.copy(HOME);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = 1.25;
controls.minDistance = 12;
controls.maxDistance = 60;
controls.target.set(0, 0, 1);

scene.add(new THREE.HemisphereLight('#ffffff', '#c7cfdb', 2.2));
const sun = new THREE.DirectionalLight('#ffffff', 1.6);
sun.position.set(-10, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 6;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
scene.add(sun);

{ // dot-grid board
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#e6ebf2';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#b7c2d2';
  x.beginPath();
  x.arc(32, 32, 2.2, 0, Math.PI * 2);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(70, 46);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 92), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function label(obj, html, y, cls = 'lbl') {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  const l = new CSS2DObject(d);
  l.position.set(0, y, 0);
  obj.add(l);
  return d;
}
const pops = [];
const pop = (o) => { o.scale.setScalar(0.01); pops.push({ o, t: 0 }); };
const v3 = ([x, z], y = 0) => new THREE.Vector3(x, y, z);

// ═════════════════════════════════════════════ per-scenario world
let sc = null, sim = null, S = null;
const world = new THREE.Group();
scene.add(world);
const W = { nodes: {}, items: {}, crowd: [], servers: null, serverNode: null, wires: new THREE.Group(), ghosts: new THREE.Group(), spinners: [] };
world.add(W.wires, W.ghosts);
let colorOf = {};

function buildWorld(scenario) {
  sc = scenario;
  sim = createSim(sc);
  S = sim.S;
  colorOf = { ...Object.fromEntries(Object.entries(sc.types).map(([k, t]) => [k, t.color])), ...Object.fromEntries(Object.entries(sc.events || {}).map(([k, t]) => [k, t.color])) };
  orbMats = Object.fromEntries(Object.entries(colorOf).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c })]));
  for (const n of sc.nodes) {
    const g = new THREE.Group();
    g.position.copy(v3(n.pos));
    const rec = { group: g, node: n, pos: v3(n.pos), h: 2.5 };
    if (n.model === 'users') {
      g.add(makeModel('platform', '#ffffff').group);
      const shirt = ['#2f6fed', '#e8930c', '#8b5cf6', '#1f9d55', '#e8559a', '#0ea5e9'];
      for (let i = 0; i < 40; i++) {
        const p = makeModel('person', shirt[i % shirt.length]).group;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3.3;
        p.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
        p.userData.ph = Math.random() * 10;
        g.add(p);
        W.crowd.push(p);
      }
      rec.h = 2.2;
      rec.label = label(g, n.label, rec.h);
    } else if (n.model === 'servers') {
      W.servers = { node: n, group: g, boxes: [], anchor: new THREE.Object3D() };
      g.add(W.servers.anchor);
      rec.label = label(W.servers.anchor, n.label, 0);
      W.serverNode = n.id;
    } else {
      const m = makeModel(n.model, n.color, { own: true });
      g.add(m.group);
      rec.mesh = m.mesh;
      rec.h = m.h + 0.9;
      rec.label = label(g, n.label, rec.h);
    }
    world.add(g);
    W.nodes[n.id] = rec;
  }
  syncServers();
  syncWires();
  renderLegend();
}

const serverCount = () => (W.servers ? 1 + sim.count(W.servers.node.item) : 0);
function serverSlot(i, n = serverCount()) {
  const cols = n > 4 ? 3 : 2;
  const rows = Math.ceil(n / cols);
  return new THREE.Vector3(((i % cols) - (cols - 1) / 2) * 2.3, 0, (Math.floor(i / cols) - (rows - 1) / 2) * 2.3);
}
function syncServers() {
  if (!W.servers) return;
  const Sv = W.servers;
  while (Sv.boxes.length < serverCount()) {
    const m = makeModel('server', Sv.node.color || '#a9c8ff');
    pop(m.group);
    Sv.group.add(m.group);
    Sv.boxes.push(m);
  }
  Sv.boxes.forEach((b, i) => b.group.position.copy(serverSlot(i)));
  const n = serverCount(), rows = Math.ceil(n / (n > 4 ? 3 : 2));
  Sv.anchor.position.set(0, 3.2, -((rows - 1) * 2.3) / 2);
}
const itemSlots = (it) => (it.slots || [it.pos || [0, 0]]).map((p) => v3(p));
function slotFor(id, idx) {
  const it = sim.item(id);
  if (W.servers && id === W.servers.node.item) return W.nodes[W.serverNode].pos.clone().add(serverSlot(idx + 1, idx + 2));
  const slots = itemSlots(it);
  return slots[Math.min(idx, slots.length - 1)].clone();
}
function posOf(key, idx = 0, y = 1.3) {
  if (W.nodes[key]) return W.nodes[key].pos.clone().setY(y);
  if (W.items[key]?.length) return W.items[key][Math.min(idx, W.items[key].length - 1)].pos.clone().setY(y);
  return sim.item(key) ? slotFor(key, 0).setY(y) : new THREE.Vector3(0, y, 0);
}
function orbPoint(key, idx) {
  if (W.nodes[key]?.node.model === 'users') {
    const c = W.nodes[key].pos, a = Math.random() * Math.PI * 2, r = Math.random() * 3;
    return new THREE.Vector3(c.x + Math.cos(a) * r, 1.1, c.z + Math.sin(a) * r);
  }
  if (key === W.serverNode && W.servers.boxes.length) {
    const b = W.servers.boxes[Math.floor(Math.random() * W.servers.boxes.length)];
    return W.nodes[key].pos.clone().add(b.group.position).setY(1.6);
  }
  const h = W.nodes[key] ? Math.min(2, W.nodes[key].h * 0.5) : 1.2;
  return posOf(key, idx, h);
}

// ── wires
const arrowGeo = new THREE.ConeGeometry(0.22, 0.55, 12);
const arrowMat = new THREE.MeshBasicMaterial({ color: INK });
const inkLine = new THREE.LineBasicMaterial({ color: INK });
function radiusOf(key) {
  if (key === W.serverNode) { const n = serverCount(); return 1.6 + Math.ceil(n / (n > 4 ? 3 : 2)) * 0.6 + 1; }
  if (W.nodes[key]?.node.model === 'users') return 4.4;
  return W.nodes[key]?.node.r ?? sim.item(key)?.r ?? 1.6;
}
function wire(a, b, { dashed = false, padA, padB }) {
  const from = a.clone().setY(0.06), to = b.clone().setY(0.06);
  if (from.distanceTo(to) < padA + padB + 0.5) return;
  const dir = to.clone().sub(from).normalize();
  const s = from.clone().addScaledVector(dir, padA), e = to.clone().addScaledVector(dir, -padB);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([s, e]), dashed ? new THREE.LineDashedMaterial({ color: INK, dashSize: 0.35, gapSize: 0.25 }) : inkLine);
  if (dashed) line.computeLineDistances();
  const head = new THREE.Mesh(arrowGeo, arrowMat);
  head.position.copy(e);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  W.wires.add(line, head);
}
function syncWires() {
  W.wires.clear();
  for (const [a, b, o = {}] of sc.wires || []) {
    if (o.if && !sim.has(o.if)) continue;
    if (o.unless && sim.has(o.unless)) continue;
    const listA = W.items[a]?.length ? W.items[a].map((x) => x.pos) : [posOf(a)];
    const listB = W.items[b]?.length ? W.items[b].map((x) => x.pos) : [posOf(b)];
    for (const pa of listA) for (const pb of listB) wire(pa, pb, { dashed: o.dashed, padA: o.padA ?? radiusOf(a), padB: o.padB ?? radiusOf(b) + 0.3 });
  }
}

// ── ghost slots
const ghostLine = new THREE.LineDashedMaterial({ color: '#8a97ab', dashSize: 0.3, gapSize: 0.22 });
const ghostHot = new THREE.LineDashedMaterial({ color: '#2f6fed', dashSize: 0.3, gapSize: 0.22 });
let hotGhost = null;
const ghosts = {};
const playing = () => sim && S.mode !== 'setup' && S.mode !== 'over';
function syncGhosts() {
  for (const k in ghosts) { W.ghosts.remove(ghosts[k].g); ghosts[k].div.remove(); delete ghosts[k]; }
  if (!playing()) return;
  for (const s of sc.shop) {
    if (sim.count(s.id) >= (s.max || 1)) continue;
    if (s.trap && hotGhost !== s.id) continue;
    const g = new THREE.Group();
    const size = s.ghost || 2.6;
    const sq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size)), hotGhost === s.id ? ghostHot : ghostLine);
    sq.computeLineDistances();
    sq.rotation.x = -Math.PI / 2;
    sq.position.y = 0.04;
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ visible: false }));
    hit.rotation.x = -Math.PI / 2;
    hit.position.y = 0.05;
    hit.userData.buy = s.id;
    g.add(sq, hit);
    g.position.copy(slotFor(s.id, sim.count(s.id)).setY(0));
    const div = label(g, `<div class="gi"><span>${s.icon}</span>$${sim.price(s.id)}</div>`, 0.4, 'ghost' + (hotGhost === s.id ? ' hot' : '') + (S.hint[s.id] && !interview() ? ' hint' : ''));
    W.ghosts.add(g);
    ghosts[s.id] = { g, div, hit };
  }
}
function setHotGhost(id) { if (hotGhost !== id) { hotGhost = id; syncGhosts(); } }

// ═════════════════════════════════════════════ orbs
const orbGeo = new THREE.SphereGeometry(0.21, 14, 14);
let orbMats = {};
const failMat = new THREE.MeshBasicMaterial({ color: FAIL_COLOR });
const goldRing = new THREE.TorusGeometry(0.34, 0.06, 6, 18);
const goldMat = new THREE.MeshBasicMaterial({ color: '#e8930c' });
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(28,36,51,.32)'); g.addColorStop(1, 'rgba(28,36,51,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const blobGeo = new THREE.PlaneGeometry(0.6, 0.6);
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
const pool = [];
const live = new Map();
const fx = [];
function getOrb(material, withRing) {
  let m = pool.pop();
  if (!m) {
    m = new THREE.Mesh(orbGeo);
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.rotation.x = -Math.PI / 2;
    m.userData.blob = blob;
  }
  m.material = material;
  m.scale.setScalar(1);
  if (m.userData.ring) { m.remove(m.userData.ring); m.userData.ring = null; }
  if (withRing) { const r = new THREE.Mesh(goldRing, goldMat); m.add(r); m.userData.ring = r; }
  scene.add(m, m.userData.blob);
  return m;
}
const freeOrb = (m) => { scene.remove(m, m.userData.blob); pool.push(m); };
const place = (m, p) => { m.position.copy(p); m.userData.blob.position.set(p.x, 0.03, p.z); };
function curve(from, to, h) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  mid.y += h;
  return new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
}
function failOrb(at) {
  const m = getOrb(failMat);
  place(m, at);
  fx.push({ m, fall: true, t: 0, vy: 3, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3 });
  sfx('fail');
}
function hop(from, to, material, dur = 0.7, h = 1.4) { fx.push({ m: getOrb(material), c: curve(from, to, h), t: 0, dur }); }

const ripples = [];
function ripple(pos, color) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 28), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  r.position.copy(pos).setY(0.1);
  r.rotation.x = -Math.PI / 2;
  scene.add(r);
  ripples.push({ r, t: 0 });
}
function floatText(pos, text, bad = false) {
  if (!text) return;
  const d = document.createElement('div');
  d.className = 'float' + (bad ? ' bad' : '');
  const sp = document.createElement('span');
  sp.textContent = text;
  d.appendChild(sp);
  const o = new CSS2DObject(d);
  o.position.copy(pos);
  scene.add(o);
  setTimeout(() => { scene.remove(o); d.remove(); }, 1000);
}
let shake = 0, cash = 0, cashAt = null, cashT = 0;
const topOf = (key) => posOf(key, 0, (W.nodes[key]?.h ?? 2.4) + 1);

// ═════════════════════════════════════════════ sim → visuals
const snapshots = [];
function hookSim() {
  sim.on((type, p) => {
    switch (type) {
      case 'spawn': {
        const from = orbPoint(p.from), to = orbPoint(p.to);
        const m = getOrb(orbMats[p.type] || Object.values(orbMats)[0], !!p.ring);
        place(m, from);
        live.set(p.id, { m, c: curve(from, to, p.kind === 'event' ? 1.6 : 2.6), r: p });
        break;
      }
      case 'resolve': {
        const o = live.get(p.r.id);
        if (!o) break;
        live.delete(p.r.id);
        if (!p.ok) failOrb(o.m.position.clone());
        else if (p.where) ripple(posOf(p.where), colorOf[p.r.type] || '#999');
        freeOrb(o.m);
        break;
      }
      case 'hop': hop(orbPoint(p.from), orbPoint(p.to, p.idx), orbMats[p.type] || Object.values(orbMats)[0], 0.7, 1.4); break;
      case 'cash': cash += p.value; cashAt = p.at; break;
      case 'hit': floatText(topOf(p.at), p.text, true); if (p.soft) sfx('fail'); else { shake = 0.5; sfx('boom'); } break;
      case 'blocked': ripple(posOf(p.at), '#e8930c'); floatText(topOf(p.at), p.text); break;
      case 'outage': if (!p.on && p.delivered) floatText(topOf(sc.hazards.outage.event?.via || p.node), `📬 ${p.delivered} delivered`); break;
      case 'buy': onBuy(p.id, p.n); break;
      case 'meter': renderLabels(); renderHud(); renderShop(); break;
      case 'incident': case 'break': showCurrent(); break;
      case 'phase': phaseBanner(); break;
      case 'surge': if (p.on) surgeBanner(p); renderHud(); break;
      case 'phaseEnd': snapshot(sc.phases[p.phase].name); break;
      case 'end': showResults(); break;
    }
  });
}
function snapshot(name) {
  const saved = { pos: camera.position.clone(), target: controls.target.clone() };
  camera.position.copy(HOME);
  controls.target.set(0, 0, 1);
  camera.lookAt(controls.target);
  W.ghosts.visible = false;
  renderer.render(scene, camera);
  let url = '';
  try {
    const c = document.createElement('canvas');
    // crop to the middle of the board, where the architecture lives
    const sx = canvas.width * 0.13, sy = canvas.height * 0.2, sw = canvas.width * 0.74, sh = canvas.height * 0.68;
    c.width = 520; c.height = Math.round(520 * sh / sw);
    c.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', 0.8);
  } catch {}
  W.ghosts.visible = true;
  camera.position.copy(saved.pos);
  controls.target.copy(saved.target);
  if (url) snapshots.push({ name, url });
}

function onBuy(id, n) {
  const it = sim.item(id);
  const pos = slotFor(id, n - 1);
  if (W.servers && id === W.servers.node.item) syncServers();
  else {
    const m = makeModel(it.model || 'box', it.color);
    const g = new THREE.Group();
    g.add(m.group);
    g.position.copy(pos.clone().setY(0));
    if (it.label) label(g, it.label, m.h + 0.5);
    pop(g);
    world.add(g);
    if (m.spin) W.spinners.push(m.spin);
    (W.items[id] ||= []).push({ group: g, pos: pos.clone().setY(0), mesh: m.mesh });
  }
  ripple(pos, '#2f6fed');
  sfx('build');
  syncWires();
  syncGhosts();
  shopSig = '';
  renderShop();
  renderHud();
}

// ═════════════════════════════════════════════ frame loop
const gaugeColor = (l) => (l > 1 ? '#e5484d' : l > 0.8 ? '#e8930c' : '#1f9d55');
const gauge = (l) => `<span class="g"><i style="width:${Math.min(100, l * 100)}%;background:${gaugeColor(l)}"></i></span>`;
function renderLabels() {
  const C = sc.connections;
  for (const [id, rec] of Object.entries(W.nodes)) {
    const load = S.nodeLoad[id];
    const isConn = C && sc.pools[C.pool].node === id && sim.connBad();
    const down = S.outage && sc.hazards.outage?.node === id;
    if (load === undefined && !down && !rec.wasDown) continue;
    rec.wasDown = down;
    const name = rec.node.label + (id === W.serverNode ? ` ×${serverCount()}` : '');
    rec.label.className = 'lbl' + (load > 1 || isConn || down ? ' warn' : '');
    rec.label.innerHTML = down ? `⚠ ${rec.node.label}: down${S.queued ? ` · 📬 ${S.queued}` : ''}`
      : isConn ? `⚠ ${sim.connections()}/${C.limit} ${C.label || 'connections'}${gauge(sim.connections() / C.limit)}`
      : load === undefined ? rec.node.label
      : `${load > 1 ? '⚠ ' : ''}${name}${gauge(load)}`;
  }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const running = sim ? sim.live() : false;
  if (running) sim.step(dt * speed);

  if (sim) for (const o of live.values()) place(o.m, o.c.getPoint(Math.max(0, Math.min(1, (S.time - o.r.t) / o.r.dur))));
  for (let i = fx.length - 1; i >= 0; i--) {
    const o = fx[i];
    if (!running && !o.fall) continue;
    if (o.fall) {
      o.t += dt;
      o.vy -= 14 * dt;
      const p = o.m.position;
      place(o.m, new THREE.Vector3(p.x + o.vx * dt, Math.max(0.2, p.y + o.vy * dt), p.z + o.vz * dt));
      o.m.scale.setScalar(Math.max(0.01, 1 - o.t * 1.2));
      if (o.t > 0.8) { freeOrb(o.m); fx.splice(i, 1); }
      continue;
    }
    o.t += dt / o.dur;
    place(o.m, o.c.getPoint(Math.min(1, o.t)));
    if (o.t >= 1) { freeOrb(o.m); fx.splice(i, 1); }
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t = Math.min(1, p.t + dt * 2.6);
    p.o.scale.setScalar(Math.max(0.01, p.t * (1 + Math.sin(p.t * Math.PI) * 0.35)));
    if (p.t >= 1) { p.o.scale.setScalar(1); pops.splice(i, 1); }
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    r.r.scale.setScalar(1 + r.t * 5);
    r.r.material.opacity = 1 - r.t * 1.7;
    if (r.t > 0.6) { scene.remove(r.r); ripples.splice(i, 1); }
  }

  if (sim) {
    const rate = Object.values(sc.phases[S.phase].rates).reduce((a, b) => a + b, 0);
    const visible = playing() ? Math.min(W.crowd.length, Math.round(3 + rate * 0.95)) : 10;
    W.crowd.forEach((p, i) => { p.visible = i < visible; p.position.y = 0.3 + Math.abs(Math.sin(t * 5 + p.userData.ph)) * 0.12; });
    if (W.servers) {
      const l = S.nodeLoad[W.serverNode] || 0, hot = l > 1, c = gaugeColor(l);
      W.servers.boxes.forEach((b, i) => {
        b.leds.forEach((led, k) => { led.material.color.set(c); led.visible = hot ? Math.sin(t * 18 + i + k) > -0.2 : true; });
        b.group.rotation.z = hot && running ? Math.sin(t * 50 + i) * 0.015 : 0;
      });
    }
    const C = sc.connections;
    for (const [id, rec] of Object.entries(W.nodes)) {
      if (!rec.mesh) continue;
      const down = S.outage && sc.hazards.outage?.node === id;
      const hot = (S.nodeLoad[id] || 0) > 1 || (C && sc.pools[C.pool].node === id && sim.connBad());
      rec.mesh.material.color.set(down && Math.sin(t * 9) > 0 ? '#e5484d' : hot ? '#ffb3a8' : rec.node.color || '#dbe2ec');
      rec.group.rotation.z = down ? Math.sin(t * 20) * 0.08 : 0;
    }
    W.spinners.forEach((s) => (s.rotation.z += dt * 0.4));
    if (running) {
      cashT += dt;
      if (cashT > 0.45 && cash) { floatText(topOf(cashAt).setY(3.6), `+$${cash}`); sfx('coin'); cash = 0; cashT = 0; }
    }
  }
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake * 0.6;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
  }
  controls.autoRotate = !sim || S.mode === 'setup';
  controls.autoRotateSpeed = 0.5;
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ═════════════════════════════════════════════ HUD & shop
let legendHtml = '';
function renderLegend() {
  legendHtml = Object.values(sc.types).map((t) => `<span><i style="background:${t.color}"></i>${t.name}</span>`).join('')
    + Object.values(sc.events || {}).map((t) => `<span><i style="background:${t.color}"></i>${t.name}</span>`).join('')
    + `<span><i style="background:${FAIL_COLOR}"></i>Failed</span>`;
}
function renderHud() {
  const hud = $('hud');
  hud.hidden = !playing();
  if (!playing()) return;
  const P = sc.phases[S.phase];
  const r = Math.round(S.moneyRate);
  hud.innerHTML = `
    <div class="note stat" id="phase"><small>${sc.icon} ${sc.title} · ${S.phase + 1}/${sc.phases.length}</small><b>${P.name}${S.surging ? ' <span class="surge">📈 surge</span>' : ''}</b><div class="bar"><i style="width:${Math.min(100, (S.phaseTime / P.dur) * 100)}%"></i></div></div>
    <div class="note stat"><small>Budget</small><b style="color:${S.money < 0 ? 'var(--bad)' : 'var(--ink)'}">$${Math.floor(S.money)}</b>${r ? `<span class="rate ${r > 0 ? 'up' : 'down'}">${r > 0 ? '+' : ''}${r}/s</span>` : ''}</div>
    <div class="note stat ${S.rep < 35 ? 'low' : ''}" id="rep"><small>Reputation</small><b>${Math.round(S.rep)}</b><div class="bar"><i style="width:${Math.max(0, S.rep)}%"></i></div></div>
    <div class="spacer"></div>
    <div class="note legend top">${legendHtml}</div>
    <button class="note iconbtn" id="speedBtn" aria-label="Speed" title="Speed">${speed === 1 ? '1×' : '2×'}</button>
    <button class="note iconbtn" id="pauseBtn" aria-label="${S.userPaused ? 'Resume' : 'Pause'}">${S.userPaused ? '▶' : '⏸'}</button>
    <button class="note iconbtn" id="muteBtn" aria-label="${muted ? 'Unmute' : 'Mute'}">${muted ? '🔇' : '🔊'}</button>
  `;
}
$('hud').addEventListener('click', (e) => {
  if (e.target.closest('#pauseBtn')) togglePause();
  if (e.target.closest('#muteBtn')) toggleMute();
  if (e.target.closest('#speedBtn')) { speed = speed === 1 ? 2 : 1; renderHud(); }
});
function toggleMute() { muted = !muted; store.set('sp-muted', muted); renderHud(); }
function togglePause() {
  if (!sim) return;
  const p = sim.togglePause();
  $('pause').hidden = !p;
  renderHud();
}
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && $('modal').hidden) { e.preventDefault(); togglePause(); }
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if (playing() && $('modal').hidden && /^[1-9]$/.test(e.key)) { const s = sc.shop[+e.key - 1]; if (s) buy(s.id); }
});

let shopSig = '';
function renderShop() {
  const shop = $('shop');
  shop.hidden = !playing();
  if (!playing()) return;
  const sig = sc.shop.map((s) => [sim.count(s.id), sim.price(s.id), S.money >= sim.price(s.id), !!S.hint[s.id]].join()).join('|');
  if (sig === shopSig) return;
  shopSig = sig;
  shop.innerHTML = sc.shop.map((s, i) => {
    const n = sim.count(s.id), max = s.max || 1, price = sim.price(s.id);
    const done = n >= max, poor = !done && S.money < price;
    return `<button class="item ${s.trap ? 'trap' : ''} ${done ? 'done' : ''} ${poor ? 'poor' : ''} ${S.hint[s.id] && !done && !interview() ? 'hint' : ''}" data-id="${s.id}" ${done || poor ? 'disabled' : ''} aria-label="${s.name}, $${price}">
      ${i < 9 ? `<span class="k">${i + 1}</span>` : ''}<span class="ic">${s.icon}</span>${max > 1 && n ? `<span class="n">${n}</span>` : ''}
      <b>${s.name}</b>
      <span class="p">${done ? '✓' : `$${price}`}</span>
    </button>`;
  }).join('');
  syncGhosts();
}
const shopEl = $('shop');
shopEl.addEventListener('click', (e) => { const b = e.target.closest('.item'); if (b && !b.disabled) buy(b.dataset.id); });
shopEl.addEventListener('pointerover', (e) => {
  const b = e.target.closest('.item');
  if (!b) return;
  const s = sim.item(b.dataset.id);
  const tip = $('tip');
  tip.textContent = s.desc;
  tip.hidden = false;
  const r = b.getBoundingClientRect();
  tip.style.left = Math.max(12, Math.min(innerWidth - 252, r.left)) + 'px';
  tip.style.bottom = innerHeight - r.top + 10 + 'px';
  setHotGhost(s.id);
});
shopEl.addEventListener('pointerleave', () => { $('tip').hidden = true; setHotGhost(null); });
function buy(id) {
  const cost = sim.price(id);
  const pos = slotFor(id, sim.count(id));
  if (sim.buy(id)) floatText(pos.setY(2), `−$${cost}`, true);
}
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const hit = pickGhost(e);
  if (hit) buy(hit);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const hit = pickGhost(e);
  canvas.style.cursor = hit ? 'pointer' : 'grab';
  if (hit !== hotGhost && !(hotGhost && sim.item(hotGhost)?.trap)) setHotGhost(hit);
});
function pickGhost(e) {
  if (!playing()) return null;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(Object.values(ghosts).map((g) => g.hit));
  return hits[0]?.object.userData.buy || null;
}

let bannerT;
function phaseBanner() {
  const P = sc.phases[S.phase];
  const b = $('banner');
  b.querySelector('b').textContent = P.name;
  b.querySelector('.news').innerHTML = (P.news || []).map((n) => (sc.types[n] ? `<span><i style="background:${sc.types[n].color}"></i>${sc.types[n].name}</span>` : `<span>${n}</span>`)).join('');
  b.classList.add('show');
  sfx('phase');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove('show'), 2400);
  renderHud();
  renderShop();
  syncGhosts();
}

function surgeBanner(p) {
  const b = $('banner');
  b.querySelector('b').textContent = `📈 Surge ×${p.mult}`;
  b.querySelector('.news').innerHTML = p.label ? `<span>${p.label}</span>` : '';
  b.classList.add('show');
  sfx('alert');
  shake = 0.3;
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove('show'), 2000);
}

// ═════════════════════════════════════════════ modals
const modal = $('modal');
function openModal(html, cls = 'center') { modal.innerHTML = `<div class="card ${cls}">${html}</div>`; modal.hidden = false; }
function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
const shuffled = (n) => Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
const md = (t) => String(t).replace(/`([^`]+)`/g, '<code>$1</code>');
const cont = (labelText = 'Continue', reward = '') => `<div class="row"><span class="grow">${reward}</span><button class="btn" id="cont">${labelText}</button></div>`;
function bindCont() {
  const b = $('cont');
  b.focus({ preventScroll: true });
  b.addEventListener('click', () => { closeModal(); sim.next(); shopSig = ''; renderShop(); maybeCoach(); });
}
// First game ever: once the opening question is answered, point at the shop for a few seconds.
function maybeCoach() {
  if (S.mode !== 'play' || S.phase !== 0 || store.get('sp-coached', false)) return;
  store.set('sp-coached', true);
  const n = document.createElement('div');
  n.className = 'coach';
  n.innerHTML = '👇 Buy parts here <span>or click a dashed slot on the board</span>';
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('out'), 6500);
  setTimeout(() => n.remove(), 7200);
}
function eyebrow(cur) {
  if (cur.incident && cur.id === sc.startCard) return '<div class="eyebrow">Interviewer asks</div>';
  if (cur.incident) return '<div class="eyebrow danger">Incident</div>';
  return `<div class="eyebrow">${cur.closing ? 'Closing questions' : 'Whiteboard'} · ${cur.step}/${cur.total}</div>`;
}
function showCurrent() {
  const cur = sim.current();
  if (!cur) return;
  renderHud();
  sfx(cur.incident && cur.id !== sc.startCard ? 'alert' : 'tick');
  ({ card: showCard, order: showOrder, pick: showPick, sort: showSort })[cur.kind](cur);
}
function showCard(cur) {
  const c = cur.data;
  const order = shuffled(c.opts.length);
  openModal(`
    ${eyebrow(cur)}
    <div class="big-ic">${c.icon}</div>
    <h2>${md(c.title)}</h2>
    <p class="sub">${md(c.text)}</p>
    <div class="opts">${order.map((i) => `<button class="opt" data-i="${i}">${md(c.opts[i].t)}</button>`).join('')}</div>
  `);
  modal.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    const res = sim.answerCard(cur.id, i);
    review.push({ title: clean(c.title), chosen: clean(c.opts[i].t), best: clean(c.opts[res.best].t), why: clean(c.opts[res.best].why), good: res.good });
    if (interview()) {
      sfx('tick');
      modal.querySelectorAll('.opt').forEach((x) => { x.disabled = true; if (+x.dataset.i === i) x.classList.add('on'); });
      modal.querySelector('.card').insertAdjacentHTML('beforeend', cont(cur.closing && cur.step === cur.total ? 'Results' : 'Continue', '<span class="noted">✓ Noted</span>'));
      return bindCont();
    }
    sfx(res.good ? 'good' : 'bad');
    modal.querySelectorAll('.opt').forEach((x) => {
      x.disabled = true;
      const j = +x.dataset.i;
      if (j === res.best) x.classList.add('right');
      else if (j === i) x.classList.add('wrong');
      if (j === i || j === res.best) x.insertAdjacentHTML('beforeend', `<small>${md(c.opts[j].why)}</small>`);
    });
    const fix = res.fix && sim.item(res.fix);
    const reward = `<span class="delta ${res.good ? 'up' : 'down'}">${res.good ? `+$${sim.T.cardReward}` : `−${sim.T.cardPenalty} rep`}</span>${fix ? ` <span class="fix">→ ${fix.icon} ${fix.name}${res.good ? ' −40%' : ''}</span>` : ''}`;
    modal.querySelector('.card').insertAdjacentHTML('beforeend', cont(cur.closing && cur.step === cur.total ? 'Results' : 'Continue', reward));
    bindCont();
  }));
}
// In interview mode the result is recorded but not revealed: render every item as neutral.
const mask = (res) => (interview() ? { ...res, masked: true } : res);
const puzzleHead = (cur) => `${eyebrow(cur)}<div class="big-ic">${cur.data.icon}</div><h2>${md(cur.data.title)}</h2><p class="sub">${md(cur.data.text)}</p>`;
function puzzleDone(res, cur) {
  review.push({ title: clean(cur.data.title), chosen: `${res.correct}/${res.total} correct`, best: '', why: clean(cur.data.signal || ''), good: res.ratio === 1, puzzle: true });
  if (interview()) {
    sfx('tick');
    modal.querySelector('.card').insertAdjacentHTML('beforeend', cont('Continue', '<span class="noted">✓ Noted</span>'));
    return bindCont();
  }
  sfx(res.ratio === 1 ? 'good' : res.ratio >= 0.6 ? 'tick' : 'bad');
  modal.querySelector('.card').insertAdjacentHTML('beforeend', cont('Continue', `<span class="delta ${res.ratio >= 0.6 ? 'up' : 'down'}">${res.correct}/${res.total}${res.reward ? ` · +$${res.reward}` : ''}</span>`));
  bindCont();
}
function showOrder(cur) {
  const p = cur.data;
  const order = shuffled(p.items.length);
  const seq = [];
  const draw = (res) => {
    openModal(`
      ${puzzleHead(cur)}
      <div class="opts">${(res && !res.masked ? p.items.map((_, i) => i) : order).map((i) => {
        const pos = seq.indexOf(i);
        const cls = res?.masked ? 'on' : res ? (res.per[pos] ? 'right' : 'wrong') : pos >= 0 ? 'on' : '';
        return `<button class="opt seq ${cls}" data-i="${i}" ${res || pos >= 0 ? 'disabled' : ''}><span class="num">${pos >= 0 ? pos + 1 : ''}</span>${md(p.items[i])}${res && !res.masked && !res.per[pos] ? `<small>You put it at step ${pos + 1}</small>` : ''}</button>`;
      }).join('')}</div>
      ${res ? '' : `<div class="row"><span class="grow"><button class="link" id="undo" ${seq.length ? '' : 'disabled'}>↶ Undo</button></span></div>`}
    `);
    if (res) return puzzleDone(res, cur);
    modal.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      seq.push(+b.dataset.i);
      sfx('tick');
      draw(seq.length === p.items.length ? mask(sim.solvePuzzle(cur.id, seq)) : undefined);
    }));
    $('undo').addEventListener('click', () => { seq.pop(); draw(); });
  };
  draw();
}
function showPick(cur) {
  const p = cur.data;
  const order = shuffled(p.items.length);
  const picked = new Set();
  const draw = (res) => {
    openModal(`
      ${puzzleHead(cur)}
      <div class="chips">${order.map((i) => {
        const it = p.items[i];
        const on = picked.has(i);
        const cls = res?.masked ? (on ? 'on' : 'off') : res ? (it.good ? (on ? 'right' : 'miss') : on ? 'wrong' : 'off') : on ? 'on' : '';
        return `<button class="chip ${cls}" data-i="${i}" ${res || (!on && picked.size >= p.pick) ? 'disabled' : ''}><code>${it.t}</code>${res && !res.masked && it.why && on ? `<small>${md(it.why)}</small>` : ''}</button>`;
      }).join('')}</div>
      ${res ? '' : `<div class="row"><span class="grow eyebrow">${picked.size}/${p.pick}</span><button class="btn" id="check" ${picked.size === p.pick ? '' : 'disabled'}>Check</button></div>`}
    `);
    if (res) return puzzleDone(res, cur);
    modal.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      picked.has(i) ? picked.delete(i) : picked.add(i);
      sfx('tick');
      draw();
    }));
    $('check').addEventListener('click', () => draw(mask(sim.solvePuzzle(cur.id, [...picked]))));
  };
  draw();
}
function showSort(cur) {
  const p = cur.data;
  const order = shuffled(p.items.length);
  const ans = p.items.map(() => null);
  const draw = (res) => {
    openModal(`
      ${puzzleHead(cur)}
      <div class="sort">${order.map((i) => {
        const it = p.items[i];
        const cls = res && !res.masked ? (res.per[i] ? 'right' : 'wrong') : '';
        return `<div class="sort-row ${cls}"><span class="sort-t">${md(it.t)}${res && !res.masked && !res.per[i] && it.why ? `<small>${md(it.why)}</small>` : ''}</span><span class="sort-b">${p.buckets.map((b, bi) => `<button class="bucket ${ans[i] === bi ? 'on' : ''} ${res && !res.masked && bi === it.a ? 'ans' : ''}" data-i="${i}" data-b="${bi}" ${res ? 'disabled' : ''}>${b}</button>`).join('')}</span></div>`;
      }).join('')}</div>
      ${res ? '' : `<div class="row"><span class="grow"></span><button class="btn" id="check" ${ans.every((a) => a !== null) ? '' : 'disabled'}>Check</button></div>`}
    `, 'center wide');
    if (res) return puzzleDone(res, cur);
    modal.querySelectorAll('.bucket').forEach((b) => b.addEventListener('click', () => { ans[+b.dataset.i] = +b.dataset.b; sfx('tick'); draw(); }));
    $('check').addEventListener('click', () => draw(mask(sim.solvePuzzle(cur.id, ans))));
  };
  draw();
}

// ═════════════════════════════════════════════ flow: picker → brief → questions → play
const toPicker = () => { try { history.replaceState(null, '', location.pathname); } catch {} location.reload(); };
function pickerScreen() {
  const best = store.get('sp-best', {});
  openModal(`
    <div class="eyebrow">System design interview practice</div>
    <h1>System Puzzle</h1>
    <p class="sub hand" style="color:var(--ink)">Pick an exercise. Ask, build, fix, defend.</p>
    <div class="modes" role="radiogroup" aria-label="Mode">
      <button class="mode ${mode === 'practice' ? 'on' : ''}" data-mode="practice" role="radio" aria-checked="${mode === 'practice'}"><b>🎓 Practice</b><span>Answers explained as you go</span></button>
      <button class="mode ${mode === 'interview' ? 'on' : ''}" data-mode="interview" role="radio" aria-checked="${mode === 'interview'}"><b>🧑‍⚖️ Interview</b><span>No hints. Answers revealed in the debrief</span></button>
    </div>
    <div class="picker">${SCENARIOS.map((s) => `
      <button class="scn" data-id="${s.id}">
        <span class="scn-ic">${s.icon}</span>
        <span class="scn-body"><b>${s.title}</b><span>${s.pitch}</span>
          <span class="tags">${(s.topics || []).slice(0, 4).map((t) => `<i>${t}</i>`).join('')}</span></span>
        <span class="scn-meta"><em class="diff ${String(s.difficulty).toLowerCase()}">${s.difficulty}</em>${best[s.id] ? `<strong class="grade-sm ${best[s.id]}" title="Best grade">${best[s.id]}</strong>` : ''}</span>
      </button>`).join('')}</div>
    <div class="keys"><kbd>Space</kbd> pause · <kbd>M</kbd> mute · <kbd>1</kbd>–<kbd>9</kbd> buy · drag to look around</div>
  `, 'wide picker-card');
  modal.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; store.set('sp-mode', mode); sfx('tick'); pickerScreen(); }));
  modal.querySelectorAll('.scn').forEach((b) => b.addEventListener('click', () => {
    unlockAudio();
    sfx('good');
    try { history.replaceState(null, '', '#' + b.dataset.id); } catch {}
    choose(byId(b.dataset.id));
  }));
}
function choose(scenario) {
  buildWorld(scenario);
  hookSim();
  briefScreen();
}
function briefScreen() {
  openModal(`
    <div class="eyebrow">${sc.icon} ${sc.difficulty} · ${interview() ? 'Interview mode' : 'Practice mode'} · ~${Math.round((sc.phases.reduce((a, p) => a + p.dur, 0) + 240) / 60)} min</div>
    <h1>${sc.title}</h1>
    <div class="brief hand">${sc.brief}</div>
    <div class="steps">
      <div><span>🤔</span>Ask</div>
      <div><span>🛒</span>Build</div>
      <div><span>🔥</span>Fix</div>
      <div><span>✏️</span>Whiteboard</div>
    </div>
    <div class="legend wide">${legendHtml}</div>
    <div class="row"><span class="grow"><button class="link" id="back">← All exercises</button></span><button class="btn" id="go">Start interview</button></div>
  `);
  $('go').focus({ preventScroll: true });
  $('back').addEventListener('click', toPicker);
  $('go').addEventListener('click', () => { unlockAudio(); sfx('good'); clarifyScreen(); });
}
function clarifyScreen() {
  const picked = new Set();
  const order = shuffled(sc.questions.length);
  const draw = () => {
    openModal(`
      <div class="eyebrow">Before you draw anything</div>
      <div class="big-ic">🤔</div>
      <h2>Ask 3 questions</h2>
      <div class="opts">${order.map((i) => `<button class="opt ${picked.has(i) ? 'on' : ''}" data-i="${i}" ${!picked.has(i) && picked.size >= 3 ? 'disabled' : ''}>${md(sc.questions[i].q)}</button>`).join('')}</div>
      <div class="row"><span class="grow eyebrow">${picked.size}/3</span><button class="btn" id="ask">${picked.size ? 'Ask' : 'Skip'}</button></div>
    `);
    modal.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      picked.has(i) ? picked.delete(i) : picked.size < 3 && picked.add(i);
      sfx('tick');
      draw();
    }));
    $('ask').addEventListener('click', () => answers([...picked]));
  };
  draw();
}
function answers(picked) {
  const bonus = sim.ask(picked);
  sfx(bonus ? 'good' : 'bad');
  const items = picked.map((i) => { const q = sc.questions[i]; return `<div class="opt ${q.good ? 'right' : 'wrong'}">${md(q.q)}<small>${md(q.a)}</small></div>`; }).join('');
  openModal(`
    <div class="big-ic">💡</div>
    <h2>Answers</h2>
    <div class="opts">${items || '<div class="opt wrong">No questions asked<small>Assuming everything is a red flag.</small></div>'}</div>
    <div class="row"><span class="grow">${bonus ? `<span class="delta up">+$${bonus}</span>` : ''}</span><button class="btn" id="begin">Launch</button></div>
  `);
  $('begin').focus({ preventScroll: true });
  $('begin').addEventListener('click', () => {
    closeModal();
    camera.position.copy(HOME);
    controls.target.set(0, 0, 1);
    sim.start();
  });
}

// ── results
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const clean = (t) => String(t).replace(/`/g, '').replace(/<[^>]+>/g, '');
function summaryText(r) {
  return [
    `System Puzzle · ${sc.title} · interview debrief`,
    `Grade ${r.grade} (${r.verdict}) · score ${r.score}`,
    `Uptime ${r.uptime.toFixed(0)}% · Judgement ${Math.round(r.judgement)}% · Revenue $${r.revenue} · Reputation ${Math.round(r.rep)}`,
    '', 'Signals:', ...r.signals.map((s) => `  + ${s}`),
    '', 'Red flags:', ...r.flags.map((s) => `  - ${s}`),
    '', 'Ask next:', ...r.followups.map((s) => `  ? ${s}`),
    '', 'Answer review:', ...review.map((x) => `  ${x.good ? '✓' : '✕'} ${x.title}: ${x.chosen}${!x.good && x.best ? ` (better: ${x.best})` : ''}`),
    '', 'Timeline:', ...r.timeline.map((e) => `  ${mmss(e.t)} [${sc.phases[e.phase].name}] ${e.kind === 'buy' ? 'Bought ' : ''}${e.text}`),
  ].join('\n');
}
function showResults() {
  ['hud', 'shop', 'pause', 'tip'].forEach((id) => ($(id).hidden = true));
  syncGhosts();
  const r = sim.results();
  r.signals = r.signals.map(clean); r.flags = r.flags.map(clean); r.timeline = r.timeline.map((e) => ({ ...e, text: clean(e.text) }));
  if (r.outage) snapshot(`${sc.phases[r.phase].name} (down)`);
  const best = store.get('sp-best', {});
  const isBest = !best[sc.id] || GRADE_ORDER.indexOf(r.grade) < GRADE_ORDER.indexOf(best[sc.id]);
  if (isBest) { best[sc.id] = r.grade; store.set('sp-best', best); }
  sfx(['S', 'A', 'B'].includes(r.grade) ? 'phase' : 'boom');
  const tl = r.timeline.filter((e) => e.kind !== 'phase');
  openModal(`
    <div class="result-top">
      <div class="grade ${r.grade}">${r.grade}</div>
      <div><div class="eyebrow">${sc.icon} ${sc.title} · ${r.outage ? `site down in ${sc.phases[r.phase].name}` : 'interview debrief'}${isBest ? ' · new best' : ''}</div><h2 style="margin:2px 0 0">${r.verdict}</h2></div>
    </div>
    <div class="nums">
      <div><small>Uptime</small><b>${r.uptime.toFixed(0)}%</b></div>
      <div><small>Judgement</small><b>${Math.round(r.judgement)}%</b></div>
      <div><small>Revenue</small><b>$${r.revenue}</b></div>
      <div><small>Reputation</small><b>${Math.round(r.rep)}</b></div>
    </div>
    ${snapshots.length ? `<h3>How your architecture evolved</h3><div class="evo">${snapshots.map((s) => `<figure><img src="${s.url}" alt="Architecture after ${s.name}" /><figcaption>${s.name}</figcaption></figure>`).join('')}</div>` : ''}
    <div class="cols">
      <div class="g"><h3>✓ Signals</h3><ul>${r.signals.map((s) => `<li>${s}</li>`).join('') || '<li>None</li>'}</ul></div>
      <div class="r"><h3>⚑ Red flags</h3><ul>${r.flags.map((s) => `<li>${s}</li>`).join('') || '<li>None</li>'}</ul></div>
    </div>
    <div class="ask"><h3>💬 Ask next</h3><ol>${r.followups.map((s) => `<li>${s}</li>`).join('')}</ol></div>
    <details class="review" ${interview() ? 'open' : ''}><summary>Answer review (${review.filter((x) => x.good).length}/${review.length} strong)</summary><ul>${review.map((x) => `<li class="${x.good ? 'good' : 'bad'}"><b>${x.good ? '✓' : '✕'} ${x.title}</b><span>${x.chosen}</span>${!x.good && x.best ? `<span class="best">Better: ${x.best} · <em>${x.why}</em></span>` : ''}</li>`).join('')}</ul></details>
    <details class="timeline"><summary>Timeline (${tl.length})</summary><ul>${tl.map((e) => `<li class="${e.tone}"><span>${mmss(e.t)}</span><em>${sc.phases[e.phase].name}</em>${e.kind === 'buy' ? '🛒 ' : ['answer', 'puzzle', 'ask'].includes(e.kind) ? '💬 ' : '⚡ '}${e.text}</li>`).join('')}</ul></details>
    <div class="row"><span class="grow"><button class="link" id="others">← Other exercises</button></span><button class="btn alt" id="copy">Copy summary</button><button class="btn" id="again">Play again</button></div>
  `, 'wide');
  $('again').addEventListener('click', () => location.reload());
  $('others').addEventListener('click', toPicker);
  $('copy').addEventListener('click', async (e) => {
    const text = summaryText(r);
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    e.target.textContent = 'Copied ✓';
  });
}

// ═════════════════════════════════════════════ boot
const fromHash = byId(location.hash.slice(1));
if (fromHash) choose(fromHash);
else pickerScreen();
