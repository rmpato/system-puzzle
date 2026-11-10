import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSim, withCore, isGiven } from './engine/sim.js';
import { makeModel, INK, soften } from './engine/models.js';
import { SCENARIOS, byId } from './scenarios/index.js';
import { gcpOf, iconHtml, CATS, PRODUCTS } from './gcp.js';
import { CONCEPTS, GROUPS, TRAP_WHY, CHECKS, conceptById, conceptForItem, conceptForCard } from './learn.js';
import { renderHome, ICON } from './home.js';

const $ = (id) => document.getElementById(id);
const FAIL_COLOR = '#e2391f';
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
// Neutral tone mapping keeps the board's whites white and the request colors true, while the
// studio environment below gives the ceramic pieces soft highlights.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
document.body.appendChild(labelRenderer.domElement);

const PAPER = '#f3f3f0'; // the whiteboard (matches --paper)
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, 62, 118);
{ const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7; }
// a longer lens than before: the board reads like a diorama, less distortion at the edges
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 240);
const HOME = new THREE.Vector3(0, 30.5, 34.6);
const HOME_TARGET = new THREE.Vector3(0, 0, 3.5);
camera.position.copy(HOME);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = 1.25;
controls.minDistance = 12;
controls.maxDistance = 60;
controls.target.copy(HOME_TARGET);

scene.add(new THREE.HemisphereLight('#ffffff', '#d5d6d0', 1.25));
const fill = new THREE.DirectionalLight('#eef2ff', 0.45);
fill.position.set(14, 12, -10);
scene.add(fill);
const sun = new THREE.DirectionalLight('#fffaf2', 2.1);
sun.position.set(-10, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 9;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
scene.add(sun);

{ // dot-grid board
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#f1f1ee';
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#c9cac3';
  x.beginPath();
  x.arc(32, 32, 2.2, 0, Math.PI * 2);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(70, 46);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 92), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, envMapIntensity: 0.25 }));
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
const pop = (o, delay = 0) => { o.scale.setScalar(0.01); pops.push({ o, t: -delay }); };
const v3 = ([x, z], y = 0) => new THREE.Vector3(x, y, z);

// ═════════════════════════════════════════════ per-scenario world
let sc = null, sim = null, S = null;
const world = new THREE.Group();
scene.add(world);
const W = { nodes: {}, items: {}, crowd: [], servers: null, serverNode: null, wires: new THREE.Group(), ghosts: new THREE.Group(), floor: new THREE.Group(), rings: {}, flows: [], spinners: [] };
const ico = (key, obj = {}, cls = 'gx') => iconHtml(sc, key, obj, cls);
const plain = (t) => String(t).replace(/<[^>]+>/g, '').trim();
const tag = (key, obj, text, extra = '') => `<span class="t">${ico(key, obj)}<span>${text}</span></span>${extra}`;
let shopOrder = [];
world.add(W.wires, W.ghosts, W.floor);
let colorOf = {};

function buildWorld(scenario) {
  sc = withCore(scenario); // the scenario plus "core:<node>" shop items for the parts the player must build
  sim = createSim(sc);
  S = sim.S;
  colorOf = { ...Object.fromEntries(Object.entries(sc.types).map(([k, t]) => [k, t.color])), ...Object.fromEntries(Object.entries(sc.events || {}).map(([k, t]) => [k, t.color])) };
  orbMats = Object.fromEntries(Object.entries(colorOf).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c })]));
  shopOrder = CATS.flatMap(([c]) => sc.shop.filter((s) => gcpOf(sc, s.id, s).cat === c));
  for (const s of sc.shop) if (!shopOrder.includes(s)) shopOrder.push(s);
  for (const n of sc.nodes) {
    const g = new THREE.Group();
    g.position.copy(v3(n.pos));
    g.userData.inspect = n.id;
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
      g.userData.inspect = null;
    } else if (n.model === 'servers') {
      W.servers = { node: n, group: g, boxes: [], anchor: new THREE.Object3D() };
      g.add(W.servers.anchor);
      rec.label = label(W.servers.anchor, tag(n.id, n, n.label), 0);
      W.serverNode = n.id;
    } else {
      const m = makeModel(n.model, n.color, { own: true });
      g.add(m.group);
      rec.mesh = m.mesh;
      rec.h = m.h + 0.9;
      rec.label = label(g, tag(n.id, n, n.label), rec.h, 'lbl' + (n.model === 'external' ? ' ext' : ''));
      if (n.model === 'external' && !/external/i.test(n.label)) { rec.extTag = true; rec.label.insertAdjacentHTML('afterbegin', '<span class="xt">external</span>'); }
    }
    rec.base = soften(n.color || '#dbe2ec');
    rec.core = !isGiven(n);
    world.add(g);
    pop(g, 0.15 + Object.keys(W.nodes).length * 0.09); // the board assembles itself, piece by piece
    W.nodes[n.id] = rec;
  }
  syncServers();
  buildFloor();
  syncPlaced(false);
  syncWires();
  renderLegend();
}

const serverCount = () => (W.servers && sim.placed(W.servers.node.id) ? 1 + sim.count(W.servers.node.item) : 0);
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
  if (it.core) return W.nodes[it.core].pos.clone();
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

// ── wires: flat ink ribbons on the board, with dashes flowing in the direction of travel
const ribbonMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.85, depthWrite: false });
const arrowGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0.34); sh.lineTo(-0.26, -0.2); sh.lineTo(0.26, -0.2); sh.closePath(); return new THREE.ShapeGeometry(sh); })();
const arrowMat = new THREE.MeshBasicMaterial({ color: INK, depthWrite: false });
const dashTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 4;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 34, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function radiusOf(key) {
  if (key === W.serverNode) { const n = serverCount(); return 1.6 + Math.ceil(n / (n > 4 ? 3 : 2)) * 0.6 + 1; }
  if (W.nodes[key]?.node.model === 'users') return 4.4;
  return W.nodes[key]?.node.r ?? sim.item(key)?.r ?? 1.6;
}
const flat = (mesh, from, to, y) => {
  const d = to.clone().sub(from);
  mesh.position.copy(from).add(to).multiplyScalar(0.5).setY(y);
  mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-d.z, d.x));
};
function wire(a, b, { dashed = false, padA, padB }) {
  const from = a.clone().setY(0), to = b.clone().setY(0);
  if (from.distanceTo(to) < padA + padB + 0.5) return;
  const dir = to.clone().sub(from).normalize();
  const s = from.clone().addScaledVector(dir, padA), e = to.clone().addScaledVector(dir, -padB - 0.2);
  const len = s.distanceTo(e);
  if (dashed) {
    const tex = dashTex.clone(); tex.repeat.set(len / 0.7, 1); tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.09), new THREE.MeshBasicMaterial({ color: INK, map: tex, transparent: true, opacity: 0.6, depthWrite: false }));
    flat(m, s, e, 0.035); W.wires.add(m);
  } else {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.07), ribbonMat);
    flat(line, s, e, 0.035);
    // the flow: wider, fainter dashes that march from source to target
    const tex = dashTex.clone(); tex.repeat.set(len / 0.9, 1); tex.needsUpdate = true;
    const flow = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.26), new THREE.MeshBasicMaterial({ color: INK, map: tex, transparent: true, opacity: 0.13, depthWrite: false }));
    flat(flow, s, e, 0.03);
    W.flows.push(tex);
    W.wires.add(line, flow);
  }
  const head = new THREE.Mesh(arrowGeo, arrowMat);
  head.position.copy(e).setY(0.04);
  head.rotation.set(-Math.PI / 2, 0, Math.atan2(-dir.z, dir.x) - Math.PI / 2);
  W.wires.add(head);
}
function syncWires() {
  W.wires.children.forEach((m) => { if (m.geometry !== arrowGeo) m.geometry.dispose(); if (m.material.map) m.material.dispose(); });
  W.wires.clear();
  W.flows = [];
  const onBoard = (k) => !W.nodes[k] || sim.placed(k);
  for (const [a, b, o = {}] of sc.wires || []) {
    if (!onBoard(a) || !onBoard(b)) continue;
    if (o.if && !sim.has(o.if)) continue;
    if (o.unless && sim.has(o.unless)) continue;
    const listA = W.items[a]?.length ? W.items[a].map((x) => x.pos) : [posOf(a)];
    const listB = W.items[b]?.length ? W.items[b].map((x) => x.pos) : [posOf(b)];
    for (const pa of listA) for (const pb of listB) wire(pa, pb, { dashed: o.dashed, padA: o.padA ?? radiusOf(a), padB: o.padB ?? radiusOf(b) + 0.3 });
  }
}

// ── floor: a soft contact shadow under every part, and a load ring for the parts that do work.
// The ring is a gauge drawn on the board: it fills clockwise with load, green → amber → red,
// and pulses once the part is past capacity.
const RING_W = 0.17;
const trackMat = new THREE.MeshBasicMaterial({ color: '#dcdcd5', transparent: true, opacity: 0.9, depthWrite: false });
function buildFloor() {
  W.floor.clear(); W.rings = {};
  const working = new Set(Object.values(sc.pools || {}).map((p) => p.node));
  for (const [id, rec] of Object.entries(W.nodes)) {
    const r = radiusOf(id);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), contactMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.copy(rec.pos).setY(0.02);
    blob.scale.setScalar(rec.node.model === 'users' ? 9.6 : r * 2.1);
    W.floor.add(blob);
    rec.blob = blob;
    if (working.has(id)) {
      const ring = { id, r: 0, q: -1, track: null, arc: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#1f9d55', transparent: true, depthWrite: false, side: THREE.DoubleSide })) };
      ring.arc.rotation.x = -Math.PI / 2;
      ring.arc.position.copy(rec.pos).setY(0.04);
      W.floor.add(ring.arc);
      W.rings[id] = ring;
    }
  }
}
// Show only the parts that exist: given nodes always, core nodes once built (with a pop when they arrive).
function syncPlaced(animate = true) {
  for (const [id, rec] of Object.entries(W.nodes)) {
    const on = sim.placed(id);
    if (rec.group.visible !== on && on && animate) pop(rec.group);
    rec.group.visible = on;
    rec.group.traverse((o) => { if (o.isCSS2DObject) o.element.style.visibility = on ? '' : 'hidden'; });
    if (rec.blob) rec.blob.visible = on;
    if (W.rings[id]) { W.rings[id].arc.visible = on; if (W.rings[id].track) W.rings[id].track.visible = on; }
  }
}
function syncRing(ring, load, t) {
  const r = radiusOf(ring.id) + (ring.id === W.serverNode ? -0.3 : 0.3);
  if (r !== ring.r) {
    ring.r = r; ring.q = -1;
    if (ring.track) { W.floor.remove(ring.track); ring.track.geometry.dispose(); }
    ring.track = new THREE.Mesh(new THREE.RingGeometry(r - RING_W, r, 96), trackMat);
    ring.track.rotation.x = -Math.PI / 2;
    ring.track.position.copy(ring.arc.position).setY(0.035);
    ring.track.visible = sim.placed(ring.id);
    W.floor.add(ring.track);
  }
  const q = Math.round(Math.min(1, load) * 60) / 60;
  if (q !== ring.q) {
    ring.q = q;
    ring.arc.geometry.dispose();
    ring.arc.geometry = q > 0 ? new THREE.RingGeometry(r - RING_W, r, 96, 1, Math.PI / 2, q * Math.PI * 2) : new THREE.BufferGeometry();
  }
  ring.arc.material.color.set(gaugeColor(load));
  const over = load > 1;
  ring.arc.material.opacity = over ? 0.65 + Math.sin(t * 9) * 0.35 : 1;
  ring.arc.scale.setScalar(over ? 1 + (Math.sin(t * 9) + 1) * 0.025 : 1);
}

// ── ghost slots
const ghostLine = new THREE.LineDashedMaterial({ color: '#8f949c', dashSize: 0.3, gapSize: 0.22 });
const ghostHot = new THREE.LineDashedMaterial({ color: '#2450e8', dashSize: 0.3, gapSize: 0.22 });
const ghostQuiet = new THREE.LineDashedMaterial({ color: '#cfd0ca', dashSize: 0.3, gapSize: 0.22 });
let hotGhost = null;
const ghosts = {};
const playing = () => sim && S.mode !== 'setup' && S.mode !== 'over';
function syncGhosts() {
  for (const k in ghosts) { W.ghosts.remove(ghosts[k].g); ghosts[k].div.remove(); delete ghosts[k]; }
  if (!playing()) return;
  for (const s of sc.shop) {
    if (sim.count(s.id) >= (s.max || 1)) continue;
    if (s.trap && hotGhost !== s.id) continue;
    if (s.core && S.mode === 'design') continue; // the design is yours: no labelled slots telling you what to build
    const g = new THREE.Group();
    const size = s.ghost || 2.6;
    const hintedG = (S.hint[s.id] || uiHint.has(s.id)) && !interview();
    const sq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size)), hotGhost === s.id ? ghostHot : hintedG ? ghostLine : ghostQuiet);
    sq.computeLineDistances();
    sq.rotation.x = -Math.PI / 2;
    sq.position.y = 0.04;
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ visible: false }));
    hit.rotation.x = -Math.PI / 2;
    hit.position.y = 0.05;
    hit.userData.buy = s.id;
    g.add(sq, hit);
    g.position.copy(slotFor(s.id, sim.count(s.id)).setY(0));
    const hinted = hintedG;
    const div = label(g, `<div class="gi">${ico(s.id, s, 'gx big')}<span class="gn">+ ${s.name}</span><span class="gp">$${sim.price(s.id)}</span></div>`, 0.4, 'ghost' + (hotGhost === s.id ? ' hot' : '') + (hinted ? ' hint' : '') + (hotGhost === s.id || hinted ? '' : ' quiet'));
    W.ghosts.add(g);
    ghosts[s.id] = { g, div, hit };
  }
}
function setHotGhost(id) { if (hotGhost !== id) { hotGhost = id; syncGhosts(); } }

// ═════════════════════════════════════════════ orbs
const orbGeo = new THREE.SphereGeometry(0.22, 18, 18);
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
const contactMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.55, depthWrite: false });
// a soft halo in the request's own color, so moving requests read as light, not as beads
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
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
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.6 }));
    halo.scale.setScalar(1.05);
    m.add(halo);
    m.userData.halo = halo;
  }
  m.material = material;
  m.userData.halo.material.color.copy(material.color);
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
const CASH_OFFSET = new THREE.Vector3(2.6, 0, 1.2);
const fails = {}, failRate = {}; let failT = performance.now(); // requests failing per node, per second
const topOf = (key) => posOf(key, 0, (W.nodes[key]?.h ?? 2.4) + 1);

// ═════════════════════════════════════════════ sim → visuals
const snapshots = [];
let lastRace = null;
function hookSim() {
  sim.on((type, p) => {
    switch (type) {
      case 'spawn': {
        const from = orbPoint(p.from), to = orbPoint(p.to);
        const m = getOrb(orbMats[p.type] || Object.values(orbMats)[0], !!p.ring);
        if (p.ring && p.race !== lastRace) { lastRace = p.race; floatText(from.clone().setY(from.y + 1.2), '⚔ 2 requests race for one item', true); }
        place(m, from);
        live.set(p.id, { m, c: curve(from, to, p.kind === 'event' ? 1.6 : 2.6), r: p });
        break;
      }
      case 'resolve': {
        const o = live.get(p.r.id);
        if (!o) break;
        live.delete(p.r.id);
        if (!p.ok) { failOrb(o.m.position.clone()); if (p.where) fails[p.where] = (fails[p.where] || 0) + 1; }
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
      case 'meter': renderLabels(); renderHud(); renderShop(); renderInspector(); refreshIncident(); break;
      case 'incident': { // after closing one, give the player a moment to watch their fix work before the next
        const wait = incidentCalm - performance.now();
        if (wait > 0) setTimeout(() => { if (!incident && S.queue.length && S.mode === 'play') showCurrent(); }, wait);
        else showCurrent();
        break;
      }
      case 'break': showCurrent(); break;
      case 'design': renderHud(); break;
      case 'phase': phaseBanner(); if (S.queue.length && !incident) showCurrent(); break;
      case 'surge': if (p.on) surgeBanner(p); renderHud(); break;
      case 'phaseEnd': snapshot(sc.phases[p.phase].name); break;
      case 'end': showResults(); break;
    }
  });
}
function snapshot(name) {
  const saved = { pos: camera.position.clone(), target: controls.target.clone() };
  camera.position.copy(HOME);
  controls.target.copy(HOME_TARGET);
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
  const pos = it.core ? W.nodes[it.core].pos.clone() : slotFor(id, n - 1);
  if (it.core) { syncPlaced(); if (W.servers && it.core === W.servers.node.id) syncServers(); }
  else if (W.servers && id === W.servers.node.item) syncServers();
  else {
    const m = makeModel(it.model || 'box', it.color);
    const g = new THREE.Group();
    g.add(m.group);
    g.position.copy(pos.clone().setY(0));
    if (it.label) label(g, tag(id, it, it.label), m.h + 0.5);
    g.userData.inspect = id;
    pop(g);
    world.add(g);
    if (m.spin) W.spinners.push(m.spin);
    (W.items[id] ||= []).push({ group: g, pos: pos.clone().setY(0), mesh: m.mesh });
  }
  ripple(pos, '#2f6fed');
  sfx('build');
  const fx = impactOf(id);
  toast(`<div class="imp-h">${ico(id, it, 'gx')}<span><b>${it.name}</b> ${it.trap ? 'adopted' : 'deployed'}${gcpOf(sc, id, it).name ? `<small>${gcpOf(sc, id, it).name}</small>` : ''}</span></div>`
    + (fx.lines.length ? `<ul class="imp">${fx.lines.map(([tone, t]) => `<li class="${tone}">${t}</li>`).join('')}</ul>` : '')
    + (it.trap && TRAP_WHY[id] ? `<p class="imp-why">${TRAP_WHY[id]}</p>` : ''), it.trap ? 'trap' : '', it.trap ? 7000 : 4200);
  fx.floats.forEach(([node, text], k) => setTimeout(() => floatText(topOf(node), text, false), 250 + k * 350));
  syncWires();
  syncGhosts();
  shopSig = '';
  renderShop();
  renderHud();
  if (S.mode === 'design') renderFlows();
}

const toasts = document.createElement('div');
toasts.id = 'toasts';
document.body.appendChild(toasts);
function toast(html, cls = '', ms = 2200) {
  const t = document.createElement('div');
  t.className = `toast note ${cls}`;
  t.innerHTML = html;
  toasts.appendChild(t);
  while (toasts.children.length > 3) toasts.firstChild.remove();
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 500);
}
// What a purchase actually changed, derived from the scenario data, so every part visibly does something.
const nodeName = (nid) => plain(sc.nodes.find((n) => n.id === nid)?.label || nid);
function impactOf(id) {
  const it = sim.item(id), lines = [], floats = [];
  for (const [pid, pool] of Object.entries(sc.pools)) {
    const d = pool.per?.[id];
    if (!d) continue;
    const before = sim.cap(pid) - d, pct = Math.round((d / Math.max(1, before)) * 100);
    lines.push(['up', `+${pct}% capacity on ${nodeName(pool.node)}`]);
    floats.push([pool.node, `+${pct}% capacity`]);
  }
  if (it.relieves && sc.pools[it.relieves]) lines.push(['up', `Takes load off ${nodeName(sc.pools[it.relieves].node)}`]);
  const mods = {};
  for (const t of Object.values(sc.types)) for (const st of t.steps || []) {
    const m = st.mods?.[id];
    if (m !== undefined && sc.pools[st.pool]) (mods[`${sc.pools[st.pool].node}|${m}`] ||= { node: sc.pools[st.pool].node, m, types: [] }).types.push(t.name);
  }
  for (const { node, m, types } of Object.values(mods)) {
    const pct = Math.round((1 - m) * 100);
    lines.push(['up', `${nodeName(node)} work ${pct > 0 ? '−' : '+'}${Math.abs(pct)}% for ${types.slice(0, 2).join(', ').toLowerCase()}`]);
    if (pct > 0) floats.push([node, `−${pct}% work`]);
  }
  for (const h of Object.values(sc.hazards || {})) if (h.fix === id && h.text) lines.push(['up', `Prevents: ${plain(h.text).replace(/^[^\w]+\s*/u, '')}`]);
  const C = sc.connections;
  if (C?.fix === id) lines.push(['up', `${nodeName(sc.pools[C.pool].node)} connections pooled to ${C.fixed}`]);
  else if (C?.per?.[id]) lines.push(['down', `+${C.per[id]} connections to ${nodeName(sc.pools[C.pool].node)} (limit ${C.limit})`]);
  if (it.upkeep) lines.push(['down', `Costs $${it.upkeep}/s for the rest of the game`]);
  if (it.trap && !lines.some(([t]) => t === 'up')) lines.unshift(['down', 'No effect on traffic at this scale']);
  else if (!lines.some(([t]) => t === 'up') && it.desc) lines.unshift(['up', it.desc]);
  return { lines, floats };
}

// ═════════════════════════════════════════════ frame loop
const gaugeColor = (l) => (l > 1 ? '#e5484d' : l > 0.8 ? '#e8930c' : '#1f9d55');
const gauge = (l) => `<span class="g"><i style="width:${Math.min(100, l * 100)}%;background:${gaugeColor(l)}"></i></span>`;
// on-board version: the bar plus its number, so nobody has to guess what the bar means
const gaugeL = (l, text = `${Math.round(l * 100)}% load`) => `<span class="gl">${gauge(l)}<em style="color:${l > 0.8 ? gaugeColor(l) : ''}">${text}</em></span>`;
function renderLabels() {
  const C = sc.connections;
  const now = performance.now(), el = Math.max(0.25, (now - failT) / 1000);
  for (const k of new Set([...Object.keys(fails), ...Object.keys(failRate)])) { failRate[k] = (failRate[k] || 0) * 0.4 + ((fails[k] || 0) / el) * 0.6; fails[k] = 0; }
  failT = now;
  for (const [id, rec] of Object.entries(W.nodes)) {
    const load = S.nodeLoad[id];
    const isConn = C && sc.pools[C.pool].node === id && sim.connBad();
    const down = S.outage && sc.hazards.outage?.node === id;
    if (load === undefined && !down && !rec.wasDown) continue;
    rec.wasDown = down;
    const name = rec.node.label + (id === W.serverNode ? ` ×${serverCount()}` : '');
    rec.label.className = 'lbl' + (load > 1 || isConn || down ? ' warn' : '') + (rec.node.model === 'external' ? ' ext' : '');
    const n = rec.node;
    const extTag = rec.extTag ? '<span class="xt">external</span>' : '';
    rec.label.innerHTML = extTag + (down ? tag(id, n, `${n.label}: down${S.queued ? ` · 📬 ${S.queued}` : ''}`)
      : isConn ? tag(id, n, `${sim.connections()}/${C.limit} ${C.label || 'connections'}`, gaugeL(sim.connections() / C.limit, 'connection limit'))
      : load === undefined ? tag(id, n, n.label)
      : tag(id, n, name, gaugeL(load)));
    const fr = failRate[id] || 0;
    if (fr >= 0.5) rec.label.innerHTML += `<span class="failing">✕ ${Math.round(fr)}/s failing</span>`;
  }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const running = sim ? sim.live() : false;
  if (running) sim.step(dt * speed * (incident ? INCIDENT_SLOW : 1));

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
    p.o.scale.setScalar(p.t <= 0 ? 0.01 : Math.max(0.01, p.t * (1 + Math.sin(p.t * Math.PI) * 0.35)));
    if (p.t >= 1) { p.o.scale.setScalar(1); pops.splice(i, 1); }
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    r.r.scale.setScalar(1 + r.t * 5);
    r.r.material.opacity = Math.max(0, 0.55 - r.t * 0.95);
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
      if (down && Math.sin(t * 9) > 0) rec.mesh.material.color.set('#e5484d');
      else if (hot) rec.mesh.material.color.set('#ff9e90');
      else rec.mesh.material.color.copy(rec.base);
      rec.group.rotation.z = down ? Math.sin(t * 20) * 0.08 : 0;
    }
    W.spinners.forEach((s) => (s.rotation.z += dt * 0.4));
    if (running) for (const tex of W.flows) tex.offset.x -= dt * 1.1;
    for (const ring of Object.values(W.rings)) syncRing(ring, S.nodeLoad[ring.id] || 0, t);
    if (running) {
      cashT += dt;
      if (cashT > 0.45 && cash) { floatText(posOf(cashAt, 0, 1.2).add(CASH_OFFSET), `+$${cash}`); /* beside the part, never over its label */ sfx('coin'); cash = 0; cashT = 0; }
    }
  }
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake * 0.6;
    camera.position.y += (Math.random() - 0.5) * shake * 0.6;
  }
  if (camTween) {
    camTween.t = Math.min(1, camTween.t + dt * 2);
    const k = 1 - Math.pow(1 - camTween.t, 3);
    controls.target.lerpVectors(camTween.from, camTween.to, k);
    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, k);
    if (camTween.t >= 1) camTween = camTween.to === HOME_TARGET ? null : { ...camTween, done: true, t: 1 };
  }
  if (focusMark) { const r = focusMark.userData.ring; r.scale.setScalar(1 + Math.sin(t * 5) * 0.08); r.material.opacity = 0.6 + Math.sin(t * 5) * 0.3; }
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
  const ev = Object.values(sc.events || {});
  legendHtml = `<b class="lg-h">Requests</b>` + Object.values(sc.types).map((t) => `<span><i style="background:${t.color}"></i>${t.name}</span>`).join('')
    + `<span><i style="background:${FAIL_COLOR}"></i>Failed</span>`
    + (ev.length ? `<b class="lg-h">Async events</b>` + ev.map((t) => `<span><i class="ev" style="background:${t.color}"></i>${t.name}</span>`).join('') : '');
}
function renderHud() {
  const hud = $('hud');
  hud.hidden = !playing();
  if (!playing()) return;
  const P = sc.phases[S.phase];
  const r = Math.round(S.moneyRate);
  hud.innerHTML = `
    <div class="note stat" id="phase"><small>${sc.icon} ${sc.title} · phase ${S.phase + 1} of ${sc.phases.length}</small><b>${P.name}${S.surging ? ' <span class="surge">📈 surge</span>' : ''}</b>
      <div class="phases">${sc.phases.map((p, i) => `<i class="${i < S.phase ? 'done' : i === S.phase ? 'now' : ''}" style="flex:${p.dur}" title="${p.name}"><b style="width:${i < S.phase ? 100 : i === S.phase ? Math.min(100, (S.phaseTime / p.dur) * 100) : 0}%"></b>${p.surge ? `<em style="left:${(p.surge.at / p.dur) * 100}%" title="${p.surge.label || 'Surge'}">⚡</em>` : ''}</i>`).join('')}</div></div>
    <div class="note stat"><small>Budget</small><b style="color:${S.money < 0 ? 'var(--bad)' : 'var(--ink)'}">$${Math.floor(S.money)}</b>${r ? `<span class="rate ${r > 0 ? 'up' : 'down'}">${r > 0 ? '+' : ''}${r}/s</span>` : ''}</div>
    <div class="note stat ${S.rep < 35 ? 'low' : ''}" id="rep"><small>Reputation</small><b>${Math.round(S.rep)}</b><div class="bar"><i style="width:${Math.max(0, S.rep)}%"></i></div></div>
    <div class="spacer"></div>
    <div class="note legend top">${legendHtml}</div>
    <div class="note hud-tools">
      <button class="iconbtn" data-learn-open aria-label="Field guide (pauses)" title="Field guide (pauses)">${ICON.book}</button>
      <button class="iconbtn" id="speedBtn" aria-label="Speed" title="Speed">${speed === 1 ? '1×' : '2×'}</button>
      <button class="iconbtn" id="pauseBtn" aria-label="${S.userPaused ? 'Resume' : 'Pause'}" title="Pause (Space)">${S.userPaused ? ICON.play : ICON.pause}</button>
      <button class="iconbtn" id="muteBtn" aria-label="${muted ? 'Unmute' : 'Mute'}" title="Sound (M)">${muted ? ICON.mute : ICON.sound}</button>
    </div>
  `;
}
$('hud').addEventListener('click', (e) => {
  if (e.target.closest('[data-learn-open]')) openLearn();
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
  if (!learnEl.hidden) { if (e.key === 'Escape') closeLearn(); return; }
  if (!homeEl.hidden) return;
  const boardFree = $('modal').hidden || modal.classList.contains('docked'); // the incident panel never blocks the board
  if (e.code === 'Space' && boardFree) { e.preventDefault(); togglePause(); }
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if (playing() && boardFree && /^[1-9]$/.test(e.key)) { const s = shopOrder[+e.key - 1]; if (s) buy(s.id); }
});

let shopSig = '';
// Practice mode: when a part is overloaded, nudge the cheapest real fix: something that removes load first, scaling last.
let uiHint = new Set();
function overloadHints() {
  const out = new Set();
  if (interview() || !playing()) return out;
  const worst = Object.entries(sc.pools).filter(([, pool]) => (S.nodeLoad[pool.node] || 0) >= 1.05)
    .sort(([, a], [, b]) => (S.nodeLoad[b.node] || 0) - (S.nodeLoad[a.node] || 0));
  for (const [pid] of worst) {
    const relief = sc.shop.filter((it) => !it.trap && !sim.has(it.id) && (it.relieves === pid
      || Object.values(sc.types).some((t) => (t.steps || []).some((st) => st.pool === pid && st.mods?.[it.id] !== undefined && st.mods[it.id] < 1))));
    const pick = relief[0] || sc.shop.find((it) => it.scales === pid && sim.count(it.id) < (it.max || 99));
    if (pick && !S.hint[pick.id]) { out.add(pick.id); break; } // one suggestion at a time, for the worst part
    if (pick) break;
  }
  return out;
}
function renderShop() {
  const shop = $('shop');
  shop.hidden = !playing();
  if (!playing()) return;
  const pct = (s) => Math.max(0, Math.min(100, Math.round((S.money / Math.max(1, sim.price(s.id))) * 20) * 5));
  uiHint = overloadHints();
  const sig = sc.shop.map((s) => [sim.count(s.id), sim.price(s.id), sim.affordable(s.id), sim.onCredit(s.id), waitFor(s.id), pct(s), !!S.hint[s.id], uiHint.has(s.id)].join()).join('|');
  if (sig === shopSig) return;
  shopSig = sig;
  const tile = (s) => {
    const i = shopOrder.indexOf(s);
    const n = sim.count(s.id), max = s.max || 1, price = sim.price(s.id);
    const done = n >= max, poor = !done && !sim.affordable(s.id), credit = !done && sim.onCredit(s.id), wait = poor ? waitFor(s.id) : 0;
    return `<button class="item ${s.trap ? 'trap' : ''} ${done ? 'done' : ''} ${poor ? 'poor' : ''} ${credit ? 'credit' : ''} ${(S.hint[s.id] || uiHint.has(s.id)) && !done && !interview() ? 'hint' : ''}" data-id="${s.id}" aria-disabled="${done || poor}" aria-label="${s.name}, $${price}">
      ${i < 9 ? `<span class="k">${i + 1}</span>` : ''}<span class="ic">${ico(s.id, s, 'gx')}</span>${max > 1 && n ? `<span class="n">×${n}</span>` : ''}
      <b>${s.name}</b>
      <span class="p">${done ? '✓ built' : credit ? `💳 $${price}` : price === 0 ? 'free' : `$${price}`}</span>${wait ? `<i class="wait">⏱ ${wait}s</i>` : ''}
      ${poor ? `<span class="fill"><i style="width:${pct(s)}%"></i></span>` : ''}
    </button>`;
  };
  shop.innerHTML = CATS.map(([c, name]) => {
    const list = shopOrder.filter((s) => gcpOf(sc, s.id, s).cat === c);
    return list.length ? `<div class="grp ${c === 'core' ? 'core' : ''}"><div class="grp-l">${name}</div><div class="grp-i">${list.map(tile).join('')}</div></div>` : '';
  }).join('');
  syncGhosts();
}
// Seconds until an unaffordable item is affordable at the current income rate (0 = unknown / too far).
function waitFor(id) {
  if (sim.affordable(id) || sim.count(id) >= (sim.item(id).max || 1)) return 0;
  const gap = sim.price(id) - S.money, r = S.moneyRate;
  if (r <= 0.3) return 0;
  const t = Math.ceil(gap / r);
  return t <= 60 ? t : 0;
}
const shopEl = $('shop');
shopEl.addEventListener('click', (e) => { const b = e.target.closest('.item'); if (b && b.getAttribute('aria-disabled') !== 'true') buy(b.dataset.id); });
shopEl.addEventListener('pointerover', (e) => {
  const b = e.target.closest('.item');
  if (!b) return;
  const s = sim.item(b.dataset.id);
  const tip = $('tip');
  const g = gcpOf(sc, s.id, s);
  tip.innerHTML = `<div class="tip-h">${ico(s.id, s, 'gx')}<span><b>${s.name}</b><small>${g.name || 'Design pattern'}</small></span></div>${s.desc}${s.upkeep ? `<div class="tip-up">Upkeep $${s.upkeep}/s</div>` : ''}${sim.onCredit(s.id) ? '<div class="tip-cr">💳 You named this fix: buy now on credit</div>' : ''}`;
  tip.hidden = false;
  const r = b.getBoundingClientRect();
  tip.style.left = Math.max(12, Math.min(innerWidth - 272, r.left - 20)) + 'px';
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
  if (hit) { closeInspector(); return buy(hit); }
  const part = pickPart(e);
  if (part) openInspector(part, e.clientX, e.clientY);
  else closeInspector();
});
// ── inspector: click any part on the board to see what it is (GCP product), what it does, and how it is coping
function pickPart(e) {
  if (!playing()) return null;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const groups = [...Object.values(W.nodes).map((r) => r.group), ...Object.values(W.items).flat().map((x) => x.group)];
  for (const h of ray.intersectObjects(groups, true)) {
    let o = h.object;
    while (o && o.userData.inspect === undefined) o = o.parent;
    if (o?.userData.inspect) return o.userData.inspect;
  }
  return null;
}
let inspecting = null;
const insp = document.createElement('div');
insp.id = 'insp'; insp.className = 'note'; insp.hidden = true;
document.body.appendChild(insp);
function openInspector(key, x, y) {
  inspecting = key;
  renderInspector();
  insp.hidden = false;
  const r = insp.getBoundingClientRect();
  insp.style.left = Math.max(12, Math.min(innerWidth - r.width - 12, x + 16)) + 'px';
  insp.style.top = Math.max(70, Math.min(innerHeight - r.height - 130, y - r.height / 2)) + 'px';
  sfx('tick');
}
function closeInspector() { inspecting = null; insp.hidden = true; }
function renderInspector() {
  if (!inspecting) return;
  const key = inspecting, node = W.nodes[key]?.node, it = !node && sim.item(key);
  const obj = node || it, g = gcpOf(sc, key, obj);
  const title = plain(node ? node.label : it.label || it.name);
  const rows = [];
  if (node) {
    const load = S.nodeLoad[key];
    const down = S.outage && sc.hazards.outage?.node === key;
    if (down) rows.push(['Status', '<b class="bad">Down</b>']);
    if (load !== undefined) {
      rows.push(['Load', `<b class="${load > 1 ? 'bad' : load > 0.8 ? 'warn' : 'ok'}">${Math.round(load * 100)}%</b>${gauge(load)}`]);
      rows.push(['Capacity', `${Math.round(sim.nodeCap(key))} units/s`]);
    }
    if (key === W.serverNode) rows.push(['Instances', `×${serverCount()}`]);
    const C = sc.connections;
    if (C && sc.pools[C.pool].node === key) rows.push(['Connections', `<b class="${sim.connBad() ? 'bad' : 'ok'}">${sim.connections()} / ${C.limit}</b>`]);
    const fr = Math.round(failRate[key] || 0);
    if (fr) rows.push(['Failing', `<b class="bad">${fr} req/s</b>`]);
    if (node.model === 'external') rows.push(['Owner', 'Third party (not yours)']);
  } else {
    if ((it.max || 1) > 1) rows.push(['Built', `×${sim.count(key)}`]);
    if (it.upkeep) rows.push(['Upkeep', `<b class="warn">$${it.upkeep * sim.count(key)}/s</b>`]);
  }
  insp.innerHTML = `
    <button class="insp-x" aria-label="Close">×</button>
    <div class="insp-h">${ico(key, obj, 'gx lg')}<div><b>${title}</b><small>${g.name ? `Google Cloud · ${g.name}` : node?.model === 'external' ? 'External service' : node?.model === 'users' ? 'Clients' : 'Design pattern'}</small></div></div>
    ${it?.desc ? `<p>${it.desc}</p>` : ''}
    ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
    ${it && conceptForItem(key) ? `<div class="insp-learn">${learnLink(conceptForItem(key).id, '📚 Learn:')}</div>` : ''}`;
  insp.querySelector('.insp-x').addEventListener('click', closeInspector);
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInspector(); });
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const hit = pickGhost(e);
  canvas.style.cursor = hit || pickPart(e) ? 'pointer' : 'grab';
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
function openModal(html, cls = 'center', docked = false) {
  closeInspector();
  modal.innerHTML = `<div class="card ${cls}">${html}</div>`;
  modal.classList.toggle('docked', docked);
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; modal.innerHTML = ''; modal.classList.remove('docked', 'left'); unfocus(); }

// ── incident context: which part of the board is involved, and what is happening there right now
function focusNode(cardId) {
  const c = sc.cards[cardId] || {};
  if (c.focus) return c.focus;
  const C = sc.connections;
  if (C && C.card === cardId) return sc.pools[C.pool].node;
  for (const h of Object.values(sc.hazards || {})) if (h.card === cardId) return h.at || h.node || null;
  for (const D of Object.values(sc.types)) {
    if (D.cardOnSeen === cardId || D.cardOnFail === cardId) {
      const st = D.steps.reduce((a, b) => (b.cost > a.cost ? b : a));
      return sc.pools[st.pool].node;
    }
  }
  const it = c.fix && sim.item(c.fix);
  const sym = it && [].concat(it.symptom || []).find((k) => k.startsWith('hot:'));
  if (sym) return sym.slice(4);
  return null;
}
function liveFact(node) {
  if (!node || !W.nodes[node]) return '';
  const rec = W.nodes[node], C = sc.connections;
  const bits = [];
  if (S.outage && sc.hazards.outage?.node === node) bits.push(`${rec.node.label} is down`);
  else if (C && sc.pools[C.pool].node === node && sim.connBad()) bits.push(`${sim.connections()} of ${C.limit} connections used`);
  else if (S.nodeLoad[node] !== undefined) bits.push(`${rec.node.label} at ${Math.round(S.nodeLoad[node] * 100)}%`);
  const fr = Math.round(failRate[node] || 0);
  if (fr) bits.push(`${fr} request${fr === 1 ? '' : 's'}/s failing`);
  return bits.join(' · ').replace(/<[^>]+>/g, '');
}
let focusMark = null, camTween = null;
function focusOn(node) {
  unfocus();
  if (!node || !W.nodes[node]) return;
  const p = W.nodes[node].pos;
  focusMark = new THREE.Group();
  const ringM = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.75, 48), new THREE.MeshBasicMaterial({ color: '#e5484d', transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ringM.rotation.x = -Math.PI / 2;
  ringM.position.y = 0.08;
  focusMark.add(ringM);
  focusMark.userData.ring = ringM;
  label(focusMark, '<div class="here">⚠ incident</div>', (W.nodes[node].h ?? 2.4) + (node === W.serverNode ? 4.4 : 2.1), 'here-wrap');
  focusMark.position.copy(p);
  scene.add(focusMark);
  // no camera move: the board stays where the player was looking, the ring and tag point at the part
}
function unfocus() {
  if (focusMark) { focusMark.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); }); scene.remove(focusMark); focusMark = null; }
  if (camTween && camTween.to !== HOME_TARGET) camTween = { from: controls.target.clone(), to: HOME_TARGET, fromPos: camera.position.clone(), toPos: HOME.clone(), t: 0 };
}

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
// Breaks say where you are in the session: which phase just ended, what comes next, and how many questions are left.
function eyebrow(cur) {
  const dots = `<span class="q-dots">${Array.from({ length: cur.total }, (_, k) => `<i class="${k < cur.step - 1 ? 'done' : k === cur.step - 1 ? 'now' : ''}"></i>`).join('')}</span>`;
  if (cur.closing) return `<div class="break-strip"><span>Wrap-up · traffic stopped</span>${dots}<span>Question ${cur.step} of ${cur.total}</span></div>`;
  const done = sc.phases[S.phase - 1]?.name, nextP = sc.phases[S.phase]?.name;
  return `<div class="break-strip"><span>${done ? `${done} done · next: <b>${nextP}</b>` : 'Whiteboard'}</span>${dots}<span>Question ${cur.step} of ${cur.total}</span></div>`;
}
function showCurrent() {
  const cur = sim.current();
  if (!cur) return;
  renderHud();
  if (cur.incident) return showIncident(cur);
  if (incident) { incident = null; unfocus(); } // a break takes over; the open incident waits in the queue
  sfx('tick');
  ({ card: showCard, order: showOrder, pick: showPick, sort: showSort })[cur.kind](cur);
}

// ── answering a card: mark the options and say why (practice), or just record it (interview)
function revealOpts(c, i, res) {
  modal.querySelectorAll('.opt').forEach((x) => {
    x.disabled = true;
    const j = +x.dataset.i;
    if (interview()) { if (j === i) x.classList.add('on'); return; }
    if (j === res.best) x.classList.add('right');
    else if (j === i) x.classList.add('wrong');
    if (j === i || j === res.best) x.insertAdjacentHTML('beforeend', `<small>${md(c.opts[j].why)}</small>`);
  });
}
function recordAnswer(id, c, i) {
  const res = sim.answerCard(id, i);
  const concept = conceptForCard(sc.id, id, c);
  review.push({ title: clean(c.title), chosen: clean(c.opts[i].t), best: clean(c.opts[res.best].t), why: clean(c.opts[res.best].why), good: res.good, learn: concept });
  sfx(interview() ? 'tick' : res.good ? 'good' : 'bad');
  return { res, concept };
}
const optsHtml = (c, order) => `<div class="opts">${order.map((i) => `<button class="opt" data-i="${i}">${md(c.opts[i].t)}</button>`).join('')}</div>`;
const pct = () => Math.round((1 - sim.T.discount) * 100);

// ── live incidents: docked beside the board, which keeps running in slow motion.
// The panel names the part, shows what is happening to it right now (updated every meter tick),
// and after you answer, offers to deploy the fix in one click: the answer becomes a change on the board.
const INCIDENT_SLOW = 0.3;
let incident = null; // { id, node }
let incidentCalm = 0;  // no new incident panel before this time (ms)
function showIncident(cur) {
  if (incident?.id === cur.id) return;
  const c = cur.data, order = shuffled(c.opts.length), node = focusNode(cur.id);
  incident = { id: cur.id, node };
  sfx('alert');
  openModal(`
    <div class="inc-h"><span class="mode-strip live">Live incident</span><span class="inc-slow">Traffic slowed while you decide</span></div>
    <div class="inc-t"><span class="inc-ic">${c.icon}</span><div><h2>${md(c.title)}</h2><p class="sub">${md(c.text)}</p></div></div>
    <div class="fact" ${node ? '' : 'hidden'}><span class="fact-pin"></span><span class="fact-t">${liveFact(node)}</span></div>
    <div class="pick-hint">What do you do?</div>
    ${optsHtml(c, order)}
    ${cur.more ? `<p class="inc-more">${cur.more} more incident${cur.more > 1 ? 's' : ''} waiting</p>` : ''}
  `, 'incident', true);
  focusOn(node);
  // dock on the side that keeps the part in view
  const at = node && W.nodes[node] ? W.nodes[node].pos.clone().project(camera) : null;
  modal.classList.toggle('left', !!at && at.x > 0.1);
  modal.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    const { res, concept } = recordAnswer(cur.id, c, i);
    revealOpts(c, i, res);
    const fix = res.fix && sim.item(res.fix);
    const reward = interview() ? '<span class="noted">✓ Noted</span>'
      : `<span class="delta ${res.good ? 'up' : 'down'}">${res.good ? `+$${sim.T.cardReward}` : `−${sim.T.cardPenalty} rep`}</span>`;
    const deploy = fix && !interview()
      ? `<button class="btn deploy" id="deploy" ${sim.canBuy(fix.id) ? '' : 'disabled'}>${ico(fix.id, fix, 'gx sm')} Deploy ${fix.name} · $${sim.price(fix.id)}${res.good ? ` <em>−${pct()}%</em>` : ''}</button>`
      : '';
    modal.querySelector('.card').insertAdjacentHTML('beforeend', `
      ${concept && !interview() ? `<div class="learn-inline">${learnLink(concept, '📚 Learn:')}</div>` : ''}
      <div class="inc-foot"><span class="grow">${reward}</span>${deploy}<button class="${deploy ? 'link' : 'btn'}" id="cont">${deploy ? 'Not now' : 'Back to the board'}</button></div>
      ${fix && !interview() && !res.good ? `<p class="inc-note">The fix is ${fix.name}. It is highlighted in the parts bar too.</p>` : ''}`);
    (modal.querySelector('#deploy') || modal.querySelector('#cont')).focus({ preventScroll: true });
    modal.querySelector('#cont').addEventListener('click', closeIncident);
    modal.querySelector('#deploy')?.addEventListener('click', () => { closeIncident(); buy(fix.id); });
  }));
}
function refreshIncident() {
  if (!incident) return;
  const t = modal.querySelector('.fact-t');
  if (t) t.textContent = liveFact(incident.node);
  const d = modal.querySelector('#deploy');
  if (d) { const id = sc.cards[incident.id]?.fix; if (id) d.disabled = !sim.canBuy(id); }
}
function closeIncident() {
  incident = null;
  incidentCalm = performance.now() + 2500;
  closeModal();
  sim.next(); // shows the next queued incident, if any
  shopSig = ''; renderShop(); maybeCoach();
}

// ── the opening design question: asked before launch, so play never starts with an interruption.
// A right answer makes that part half price (and on credit) from the first second.
function showOpening(cur) {
  const c = cur.data, order = shuffled(c.opts.length);
  openModal(`
    <div class="mode-strip ask">Before you build · one design question</div>
    <div class="big-ic">${c.icon}</div>
    <h2>${md(c.title)}</h2>
    <p class="sub">${md(c.text)}</p>
    ${optsHtml(c, order)}
  `);
  modal.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    const { res, concept } = recordAnswer(cur.id, c, i);
    revealOpts(c, i, res);
    const fix = res.fix && sim.item(res.fix);
    const note = interview() ? '<span class="noted">✓ Noted</span>'
      : fix ? `<span class="fix">${ico(fix.id, fix, 'gx sm')} ${fix.name} is ready in the parts bar${res.good ? `, ${pct()}% off` : ''}</span>` : '';
    modal.querySelector('.card').insertAdjacentHTML('beforeend', `${concept && !interview() ? `<div class="learn-inline">${learnLink(concept, '📚 Learn:')}</div>` : ''}<div class="row"><span class="grow">${note}</span><button class="btn" id="begin">Design your system</button></div>`);
    $('begin').focus({ preventScroll: true });
    $('begin').addEventListener('click', enterDesign);
  }));
}
// ── the design step: only users and outside services are on the board; the player builds the rest.
// The panel shows every request type and whether the current design can carry it (practice mode),
// so the player sees, before any traffic, what their system does and doesn't handle.
function enterDesign() {
  closeModal();
  camera.position.copy(HOME);
  controls.target.copy(HOME_TARGET);
  sim.design();
  shopSig = '';
  renderHud(); renderShop(); syncGhosts();
  const ext = sc.nodes.filter((n) => isGiven(n) && n.id !== 'users').map((n) => plain(n.label).replace(/\s*\(external\)/i, ''));
  openModal(`
    <div class="mode-strip design">Design · no traffic yet</div>
    <h2>Build the first version</h2>
    <p class="sub">The board has only your users${ext.length ? ` and what's outside your system (${ext.join(', ')})` : ''}. Add the parts your system needs from the bar below, then launch. Core parts are free now; adding one later costs $${sim.item(sim.coreItems()[0]?.id)?.cost ?? 60}.</p>
    <blockquote class="prompt sm">${plain(sc.brief).replace(/^"|"$/g, '')}</blockquote>
    <h3 class="flows-h">${interview() ? 'Requests to handle' : 'Can your design carry each request?'}</h3>
    <div class="flows-check"></div>
    <div class="row"><span class="grow design-note"></span><button class="btn" id="launch">Launch</button></div>
  `, 'design', true);
  modal.classList.add('left');
  $('launch').addEventListener('click', launchDesign);
  renderFlows();
}
// the path of a request type through the board: users → each part that does work → where its event goes
function flowOf(t) {
  const D = sc.types[t], path = ['users'];
  for (const st of D.steps || []) { const n = sc.pools[st.pool]?.node; if (n && path.at(-1) !== n) path.push(n); }
  if (D.event?.to && W.nodes[D.event.to]) path.push(D.event.to);
  return path;
}
function renderFlows() {
  const box = modal.querySelector('.flows-check');
  if (!box) return;
  let broken = 0;
  box.innerHTML = Object.keys(sc.types).map((t) => {
    const D = sc.types[t], path = flowOf(t);
    const ok = path.every((n) => sim.placed(n));
    if (!ok) broken++;
    const chips = interview() ? '' : `<span class="fc-path">${path.map((n) => sim.placed(n)
      ? `<span class="fc-n">${n === 'users' ? '👥' : ico(n, W.nodes[n].node, 'gx sm')}${plain(W.nodes[n].node.label).replace(/\s*\(external\)/i, '')}</span>`
      : '<span class="fc-n miss">?</span>').join('<i class="fc-a"></i>')}</span>`;
    return `<div class="fc ${interview() ? '' : ok ? 'ok' : 'bad'}"><span class="fc-t"><i style="background:${D.color}"></i>${D.name}</span>${chips}</div>`;
  }).join('');
  const n = Object.keys(sc.types).length;
  const note = modal.querySelector('.design-note'), btn = $('launch');
  if (interview()) { note.textContent = 'Talk through how each request flows.'; btn.textContent = 'Launch'; return; }
  note.innerHTML = broken ? `<b>${broken} of ${n}</b> request types have nowhere to go` : `<span class="ok">✓ Every request type has a path</span>`;
  btn.textContent = broken ? 'Launch anyway' : 'Launch';
}
function launchDesign() {
  closeModal();
  snapshot('Your first design');
  sim.start();
  shopSig = ''; renderShop(); syncGhosts();
}
function showCard(cur) {
  const c = cur.data;
  const order = shuffled(c.opts.length);
  openModal(`
    ${eyebrow(cur)}
    <div class="big-ic">${c.icon}</div>
    <h2>${md(c.title)}</h2>
    <p class="sub">${md(c.text)}</p>
    ${optsHtml(c, order)}
  `);
  modal.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    const res = sim.answerCard(cur.id, i);
    const concept = conceptForCard(sc.id, cur.id, c);
    review.push({ title: clean(c.title), chosen: clean(c.opts[i].t), best: clean(c.opts[res.best].t), why: clean(c.opts[res.best].why), good: res.good, learn: concept });
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
    const reward = `<span class="delta ${res.good ? 'up' : 'down'}">${res.good ? `+$${sim.T.cardReward}` : `−${sim.T.cardPenalty} rep`}</span>${fix ? ` <span class="fix">→ ${ico(fix.id, fix, 'gx sm')} ${fix.name}${res.good ? ` −${Math.round((1 - sim.T.discount) * 100)}% · 💳 even if short` : ''}</span>` : ''}`;
    modal.querySelector('.card').insertAdjacentHTML('beforeend', `${concept ? `<div class="learn-inline">${learnLink(concept, '📚 Learn:')}</div>` : ''}${cont(cur.closing && cur.step === cur.total ? 'Results' : 'Continue', reward)}`);
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

// ═════════════════════════════════════════════ routes
// Every screen has its own URL, and server.ts serves the app at each of them:
//   /                 the exercise picker
//   /play/<id>        an exercise (reloading restarts it)
//   /guide            field guide contents
//   /guide/<concept>  one primer (over a paused game when opened from the board)
// Back/forward move between them; a game in memory survives trips into the guide and back.
const PATHS = { home: '/', play: (id) => `/play/${id}`, guide: (id) => (id ? `/guide/${id}` : '/guide') };
function parseRoute(path = location.pathname) {
  let m;
  if ((m = path.match(/^\/play\/([\w-]+)\/?$/))) return { name: 'play', id: m[1] };
  if ((m = path.match(/^\/guide(?:\/([\w-]+))?\/?$/))) return { name: 'guide', id: m[1] || null };
  return { name: 'home' };
}
function go(path, replace = false) {
  if (location.pathname === path) return;
  try { history[replace ? 'replaceState' : 'pushState']({}, '', path + location.search); } catch {}
}
const setTitle = (t) => { document.title = t ? `${t} · Under Load` : 'Under Load: system design under live traffic'; };
let gamePath = null; // URL of the exercise loaded in memory, if any
// plain left clicks navigate in-app; cmd/ctrl/shift/middle clicks keep the browser's "open in new tab"
const newTabClick = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

// ═════════════════════════════════════════════ flow: picker → brief → questions → play
// Leaving a game for the picker reloads the page: it is the cleanest way to tear down the 3D scene.
const toPicker = () => location.assign(PATHS.home);
const homeEl = $('home');
function homeScreen() {
  homeEl.hidden = false;
  setTitle(null);
  renderHome(homeEl, {
    mode,
    best: store.get('sp-best', {}),
    progress: { read: progress.read.size, passed: progress.passed.size },
    onMode: (m) => { mode = m; store.set('sp-mode', mode); sfx('tick'); },
    onStart: (id) => {
      unlockAudio();
      sfx('good');
      startExercise(id);
    },
  });
}
function startExercise(id) {
  go(PATHS.play(id));
  choose(byId(id));
}
function choose(scenario) {
  gamePath = PATHS.play(scenario.id);
  setTitle(scenario.title);
  homeEl.hidden = true;
  homeEl.innerHTML = '';
  buildWorld(scenario);
  hookSim();
  if (new URLSearchParams(location.search).has('debug')) window.__sim = sim; // QA only: ?debug
  briefScreen();
}
function briefScreen() {
  openModal(`
    <div class="eyebrow">${sc.icon} ${sc.difficulty} · ${interview() ? 'Interview mode' : 'Practice mode'} · ~${Math.round((sc.phases.reduce((a, p) => a + p.dur, 0) + 240) / 60)} min</div>
    <h1>${sc.title}</h1>
    <div class="brief hand">${sc.brief}</div>
    <h3 class="howto-title">How to read the board</h3>
    <div class="howto">
      <div><span class="dotrow"><i style="background:#2f6fed"></i><i style="background:#1f9d55"></i><i style="background:#e8930c"></i></span><b>Dots are requests</b>flowing from users through your parts</div>
      <div><span class="dotrow"><i style="background:#e5484d"></i></span><b>Red dot</b>a request that failed</div>
      <div><span class="tagdemo">⚠ Postgres</span><b>Red label</b>that part is overloaded</div>
      <div><span class="slotdemo"></span><b>Dashed square</b>where a part you can buy goes</div>
    </div>
    <div class="legend wide">${legendHtml}</div>
    <p class="inspect-hint">🔎 Click any part on the board to see its Google Cloud product, load and capacity.</p>
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
    <div class="row"><span class="grow">${bonus ? `<span class="delta up">+$${bonus}</span>` : ''}</span><button class="btn" id="begin">${sc.startCard ? 'Next: one design question' : 'Design your system'}</button></div>
  `);
  $('begin').focus({ preventScroll: true });
  $('begin').addEventListener('click', () => { const op = sim.opening(); op ? showOpening(op) : enterDesign(); });
}

// ── final architecture as a clean 2D diagram (GCP-style), built from the board layout
// model = true draws a strong reference design (every non-trap part) and highlights what the player didn't build
function archSvg(model = false) {
  const has = model ? (id) => !sim.item(id)?.trap : (id) => sim.has(id);
  const U = 34, TW = 128, TH = 74, GAP = 10; // px per world unit, tile size
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const short = (t, n = 18) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  const tiles = [], frames = [];
  for (const n of sc.nodes) {
    const label = plain(n.label) + (n.id === W.serverNode && !model ? ` ×${serverCount()}` : '');
    tiles.push({ key: n.id, x: n.pos[0], z: n.pos[1], label, obj: n, ext: n.model === 'external', users: n.model === 'users' });
  }
  const placed = model
    ? sc.shop.filter((it) => !it.trap && it.id !== W.servers?.node.item).map((it) => [it.id, [{ pos: itemSlots(it)[0] }]])
    : Object.entries(W.items);
  for (const [id, list] of placed) {
    const it = sim.item(id);
    for (const x of list) {
      const t = { key: id, x: x.pos.x, z: x.pos.z, label: plain(it.label || it.name), obj: it, trap: !!it.trap, miss: model && !sim.has(id) };
      const host = tiles.find((o) => Math.hypot(o.x - t.x, o.z - t.z) < 1.5);
      (host ? frames : tiles).push(host ? { ...t, host } : t); // a part built on top of another (Kubernetes around the API) wraps it
    }
  }
  const minX = Math.min(...tiles.map((p) => p.x)), minZ = Math.min(...tiles.map((p) => p.z));
  for (const t of tiles) { t.cx = (t.x - minX) * U; t.cy = (t.z - minZ) * U; }
  for (let k = 0; k < 40; k++) { // push overlapping tiles apart
    let moved = false;
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
      const A = tiles[i], B = tiles[j], dx = B.cx - A.cx, dy = B.cy - A.cy;
      const ox = TW + GAP - Math.abs(dx), oy = TH + GAP - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      if (ox < oy) { const m = (ox / 2 + 0.5) * Math.sign(dx || 1); A.cx -= m; B.cx += m; }
      else { const m = (oy / 2 + 0.5) * Math.sign(dy || 1); A.cy -= m; B.cy += m; }
    }
    if (!moved) break;
  }
  const FP = 16; // frame padding
  const pad = 18 + FP;
  const x0 = Math.min(...tiles.map((t) => t.cx)) - TW / 2 - pad, y0 = Math.min(...tiles.map((t) => t.cy)) - TH / 2 - pad - 8;
  const x1 = Math.max(...tiles.map((t) => t.cx)) + TW / 2 + pad, y1 = Math.max(...tiles.map((t) => t.cy)) + TH / 2 + pad;
  const byKey = {};
  for (const t of tiles) (byKey[t.key] ||= []).push(t);
  for (const f of frames) (byKey[f.key] ||= []).push(f.host); // wires to a wrapper attach to what it wraps
  const trim = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const k = Math.min((TW / 2 + 5) / Math.abs(dx || 1e-6), (TH / 2 + 5) / Math.abs(dy || 1e-6), 0.45);
    return [ax + dx * k, ay + dy * k, bx - dx * k, by - dy * k, Math.hypot(dx, dy)];
  };
  let lines = '';
  const seen = new Set();
  for (const [a, b, o = {}] of sc.wires || []) {
    if (o.if && !has(o.if)) continue;
    if (o.unless && has(o.unless)) continue;
    for (const A of byKey[a] || []) for (const B of byKey[b] || []) {
      if (A === B || seen.has(A.key + '>' + B.key + A.cx + B.cx)) continue;
      seen.add(A.key + '>' + B.key + A.cx + B.cx);
      const [ax, ay, bx, by, len] = trim(A.cx, A.cy, B.cx, B.cy);
      if (len < TW * 0.6) continue;
      lines += `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" ${o.dashed ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#ah)"/>`;
    }
  }
  const tileSvg = (t) => {
    const g = gcpOf(sc, t.key, t.obj);
    const glyph = t.users ? '👥' : t.obj.icon || (t.ext ? '🌐' : '▫️');
    return `<g class="tile${t.ext ? ' ext' : ''}${t.trap ? ' trap' : ''}${t.users ? ' users' : ''}${t.miss ? ' miss' : ''}" transform="translate(${(t.cx - TW / 2).toFixed(1)},${(t.cy - TH / 2).toFixed(1)})">
      <rect width="${TW}" height="${TH}" rx="10"/>
      ${g.src ? `<image href="${g.src}" x="${TW / 2 - 15}" y="8" width="30" height="30"/>` : `<text class="emo" x="${TW / 2}" y="33">${glyph}</text>`}
      <text class="nm" x="${TW / 2}" y="${g.name || t.miss ? 52 : 57}">${esc(short(t.label))}</text>
      ${t.miss ? `<text class="pd mb" x="${TW / 2}" y="66">NOT IN YOURS</text>` : g.name ? `<text class="pd" x="${TW / 2}" y="66">${esc(short(g.name, 22))}</text>` : ''}
      <title>${esc(t.label)}${g.name ? ` · ${esc(g.name)}` : ''}</title></g>`;
  };
  const frameSvg = (f, i) => {
    const g = gcpOf(sc, f.key, f.obj), h = f.host, e = FP + i * 8;
    const x = h.cx - TW / 2 - e, y = h.cy - TH / 2 - e - 14, w = TW + e * 2, hh = TH + e * 2 + 14;
    return `<g class="frame${f.trap ? ' trap' : ''}${f.miss ? ' miss' : ''}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${hh}" rx="14"/>
      ${g.src ? `<image href="${g.src}" x="${(x + 8).toFixed(1)}" y="${(y + 5).toFixed(1)}" width="16" height="16"/>` : ''}
      <text class="fl" x="${(x + (g.src ? 29 : 10)).toFixed(1)}" y="${(y + 17).toFixed(1)}">${esc(f.label)}</text></g>`;
  };
  const mk = model ? 'ahm' : 'ah';
  return `<svg class="arch"${model ? ' data-model hidden' : ''} viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}"  role="img" aria-label="${model ? 'A strong reference design' : 'Final architecture diagram'}">
    <defs><marker id="${mk}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z"/></marker></defs>
    ${frames.map(frameSvg).join('')}<g class="wires">${lines.replaceAll('url(#ah)', `url(#${mk})`)}</g>${tiles.map(tileSvg).join('')}</svg>`;
}

// ── results
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const clean = (t) => String(t).replace(/`/g, '').replace(/<[^>]+>/g, '');
function summaryText(r) {
  return [
    `Under Load · ${sc.title} · interview debrief`,
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
    <div class="fig-head"><h3 class="fig-t">Your final architecture</h3>
      <div class="segment sm" role="radiogroup" aria-label="Diagram" data-v="practice"><button role="radio" aria-checked="true" data-fig="mine">Yours</button><button role="radio" aria-checked="false" data-fig="model">Strong design</button></div></div>
    <div class="arch-wrap">${archSvg()}${archSvg(true)}</div>
    <p class="fig-note" hidden>A strong answer uses every non-trap part. Blue tiles are the ones your design was missing.</p>
    ${snapshots.length ? `<details class="evo-d"><summary>How it evolved, phase by phase (${snapshots.length})</summary><div class="evo">${snapshots.map((s) => `<figure><img src="${s.url}" alt="Architecture after ${s.name}" /><figcaption>${s.name}</figcaption></figure>`).join('')}</div></details>` : ''}
    <div class="cols">
      <div class="g"><h3>✓ Signals</h3><ul>${r.signals.map((s) => `<li>${s}</li>`).join('') || '<li>None</li>'}</ul></div>
      <div class="r"><h3>⚑ Red flags</h3><ul>${r.flags.map((s) => `<li>${s}</li>`).join('') || '<li>None</li>'}</ul></div>
    </div>
    ${(() => {
      const missing = (sc.report?.required || []).filter((q) => !sim.has(q.item)).map((q) => conceptForItem(q.item)?.id);
      const ids = [...new Set([...review.filter((x) => !x.good && x.learn).map((x) => x.learn), ...missing, ...(Object.keys(S.built).some((id) => sim.item(id).trap) ? ['simple'] : [])].filter(Boolean))];
      return ids.length ? `<div class="review-learn"><h3>📚 Concepts to review</h3><div>${ids.map((id) => learnLink(id, conceptById(id).icon)).join('')}</div></div>` : '';
    })()}
    <div class="ask"><h3>💬 Ask next</h3><ol>${r.followups.map((s) => `<li>${s}</li>`).join('')}</ol></div>
    <details class="review" ${interview() ? 'open' : ''}><summary>Answer review (${review.filter((x) => x.good).length}/${review.length} strong)</summary><ul>${review.map((x) => `<li class="${x.good ? 'good' : 'bad'}"><b>${x.good ? '✓' : '✕'} ${x.title}</b><span>${x.chosen}</span>${!x.good && x.best ? `<span class="best">Better: ${x.best} · <em>${x.why}</em></span>` : ''}</li>`).join('')}</ul></details>
    <details class="timeline"><summary>Timeline (${tl.length})</summary><ul>${tl.map((e) => `<li class="${e.tone}"><span>${mmss(e.t)}</span><em>${sc.phases[e.phase].name}</em>${e.kind === 'buy' ? '🛒 ' : ['answer', 'puzzle', 'ask'].includes(e.kind) ? '💬 ' : '⚡ '}${e.text}</li>`).join('')}</ul></details>
    <div class="titleblock"><div><small>Project</small><b>${sc.title}</b></div><div><small>Exercise</small><b>${String(SCENARIOS.findIndex((x) => x.id === sc.id) + 1).padStart(2, '0')} / ${String(SCENARIOS.length).padStart(2, '0')}</b></div><div><small>Mode</small><b>${interview() ? 'Interview' : 'Practice'}</b></div><div><small>Date</small><b>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b></div><div><small>Grade</small><b>${r.grade}${isBest ? ' · best' : ''}</b></div></div>
    <div class="row"><span class="grow"><button class="link" id="others">← Other exercises</button></span><button class="btn alt" id="dl">⬇ Diagram</button><button class="btn alt" id="copy">Copy summary</button><button class="btn" id="again">Play again</button></div>
  `, 'wide results');
  modal.querySelectorAll('[data-fig]').forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.fig === 'model';
    b.parentElement.dataset.v = m ? 'interview' : 'practice';
    b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    modal.querySelectorAll('svg.arch').forEach((svg) => svg.toggleAttribute('hidden', svg.hasAttribute('data-model') !== m)); // SVG elements have no .hidden property
    modal.querySelector('.fig-t').textContent = m ? 'A strong design, for comparison' : 'Your final architecture';
    modal.querySelector('.fig-note').hidden = !m;
    sfx('tick');
  }));
  $('again').addEventListener('click', () => location.reload());
  $('others').addEventListener('click', toPicker);
  $('dl').addEventListener('click', async (e) => {
    // standalone SVG: inline the stylesheet and the icons so it opens anywhere (docs, slides, feedback forms)
    const svg = modal.querySelector('svg.arch:not([hidden])').cloneNode(true);
    svg.removeAttribute('data-model');
    for (const im of svg.querySelectorAll('image')) {
      try { const txt = await (await fetch(im.getAttribute('href'))).text(); im.setAttribute('href', 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(txt)))); } catch {}
    }
    const css = `text{text-anchor:middle;font-family:'IBM Plex Sans',Arial,sans-serif}.wires line{stroke:#121417;stroke-width:1.6}marker path{fill:#121417}.tile rect{fill:#fbfaf6;stroke:#121417;stroke-width:1.6}.tile.ext rect{fill:#e8e3d7;stroke:#6d675c;stroke-dasharray:5 4}.tile.trap rect{stroke:#cf7a06;stroke-width:2}.tile.users rect{fill:#fff3bf}.nm{font-size:13.5px;font-weight:600;fill:#121417}.pd{font-size:10.5px;fill:#6d675c}.emo{font-size:22px}.frame rect{fill:rgba(36,72,245,.05);stroke:#2448f5;stroke-width:1.5;stroke-dasharray:7 5}.frame.trap rect{stroke:#cf7a06}.fl{text-anchor:start;font-size:12px;font-weight:700;fill:#121417}.tile.miss rect{fill:#e7eaff;stroke:#2448f5;stroke-width:2}.mb{fill:#2448f5;font-weight:600;letter-spacing:.1em}`;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.insertAdjacentHTML('afterbegin', `<style>${css}</style><rect x="${svg.viewBox.baseVal.x}" y="${svg.viewBox.baseVal.y}" width="100%" height="100%" fill="#f1eee6"/>`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
    a.download = `${sc.id}-architecture.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    e.target.textContent = 'Saved ✓';
  });
  $('copy').addEventListener('click', async (e) => {
    const text = summaryText(r);
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    e.target.textContent = 'Copied ✓';
  });
}

// ═════════════════════════════════════════════ learn: concept primers (library + contextual links)
const learnEl = document.createElement('div');
learnEl.id = 'learn'; learnEl.hidden = true;
document.body.appendChild(learnEl);
let learnPaused = false, learnQuery = '';
const learnIcon = (ic, cls = 'gx') => (PRODUCTS[ic] ? `<img class="${cls}" src="/assets/gcp/${ic}.svg" alt="">` : `<span class="${cls} emo">${ic}</span>`);
const learnLink = (id, prefix = '📚') => { const c = conceptById(id); return c ? `<button class="learn-link" data-learn="${c.id}">${prefix} ${c.title}</button>` : ''; };
const scenariosFor = (c) => SCENARIOS.filter((x) => x.shop.some((it) => (c.items || []).includes(it.id)));
const chapterOf = (c) => { const i = GROUPS.findIndex(([g]) => g === c.group); return { n: String(i + 1).padStart(2, '0'), name: GROUPS[i]?.[1] || '' }; };
let learnCur = null;
// per-viewer progress: primers opened, and checks answered right
const progress = { read: new Set(store.get('sp-read', [])), passed: new Set(store.get('sp-passed', [])) };
const saveProgress = () => { store.set('sp-read', [...progress.read]); store.set('sp-passed', [...progress.passed]); };
function openLearn(id = null, push = true) {
  if (sim && S.mode === 'play' && !S.userPaused) { togglePause(); learnPaused = true; }
  closeInspector();
  learnEl.hidden = false;
  renderLearnShell();
  showGuidePage(id, push);
  sfx('tick');
}
// one page of the guide, with its URL and tab title
function showGuidePage(id, push = true) {
  const c = id && conceptById(id);
  if (push) go(PATHS.guide(c ? c.id : null));
  else if (id && !c) go(PATHS.guide(null), true); // unknown primer: land on the contents
  setTitle(c ? c.title : 'Field guide');
  c ? renderConcept(c.id) : renderLibrary();
}
function closeLearn(push = true) {
  learnEl.hidden = true;
  learnEl.innerHTML = '';
  learnCur = null;
  if (learnPaused && sim && S.userPaused) togglePause();
  learnPaused = false;
  if (sim) { if (push) go(gamePath); setTitle(sc.title); return; }
  if (push) go(PATHS.home);
  if (!homeEl.innerHTML) homeScreen(); else setTitle(null);
}
// The field guide: a quiet contents column (back, search, chapters) and one reading column.
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const firstSentence = (t) => t.split(/(?<=[.!?])\s/)[0];
const statusOf = (id) => (progress.passed.has(id) ? 'passed' : progress.read.has(id) ? 'read' : '');
const nextUnread = () => CONCEPTS.find((c) => !progress.read.has(c.id)) || CONCEPTS[0];
function renderLearnShell() {
  learnEl.innerHTML = `
    <aside class="fg-nav" aria-label="Field guide contents">
      <a class="learn-x fg-back" href="${sim ? gamePath : PATHS.home}">${ICON.back}${sim ? 'Back to the game' : 'Exercises'}</a>
      <a class="fg-title" href="${PATHS.guide()}" data-learn-home>Field guide</a>
      <div class="fg-prog"><span><i></i></span><small></small></div>
      <input class="learn-q" type="search" placeholder="Search the guide" value="${esc(learnQuery)}" aria-label="Search the field guide">
      <nav class="fm-toc">${GROUPS.map(([g, name]) => `<h4>${name}</h4>${CONCEPTS.filter((c) => c.group === g).map((c) => `<a href="${PATHS.guide(c.id)}" data-learn="${c.id}" data-toc="${c.id}">${c.title}</a>`).join('')}`).join('')}</nav>
    </aside>
    <main class="fm-main" tabindex="-1"><div class="fm-progress"><i></i></div><div class="fm-page"></div></main>`;
  const inp = learnEl.querySelector('.learn-q');
  inp.addEventListener('input', () => { learnQuery = inp.value; renderLibrary(true); });
  const main = learnEl.querySelector('.fm-main'), bar = learnEl.querySelector('.fm-progress i');
  main.addEventListener('scroll', () => { const m = main.scrollHeight - main.clientHeight; bar.style.width = `${m > 0 ? (main.scrollTop / m) * 100 : 0}%`; }, { passive: true });
}
const learnMatch = () => { const q = learnQuery.trim().toLowerCase(); return (c) => !q || [c.title, c.idea, ...(c.when || []), ...(c.watch || [])].join(' ').toLowerCase().includes(q); };
function syncToc() {
  const match = learnMatch();
  learnEl.querySelectorAll('[data-toc]').forEach((b) => {
    const id = b.dataset.toc;
    b.classList.toggle('on', id === learnCur);
    b.classList.toggle('dim', !match(conceptById(id)));
    b.classList.toggle('read', progress.read.has(id));
    b.classList.toggle('passed', progress.passed.has(id));
  });
  const p = learnEl.querySelector('.fg-prog');
  if (p) {
    p.querySelector('i').style.width = `${(progress.read.size / CONCEPTS.length) * 100}%`;
    p.querySelector('small').textContent = `${progress.read.size} of ${CONCEPTS.length} read${progress.passed.size ? ` · ${progress.passed.size} checked` : ''}`;
  }
  learnEl.querySelector('[data-toc].on')?.scrollIntoView({ block: 'nearest' });
}
function setPage(html) {
  const page = learnEl.querySelector('.fm-page');
  page.innerHTML = html;
  learnEl.querySelector('.fm-main').scrollTop = 0;
  syncToc();
}
// a tiny board for a card: the primer's "after" flow as icons and arrows
const miniFlow = (c) => {
  const f = (c.flows || []).find((x) => x.tone === 'good') || (c.flows || []).at(-1);
  if (!f) return `<span class="mf-emo">${c.icon}</span>`;
  const nodes = f.nodes.length > 4 ? [...f.nodes.slice(0, 3), null] : f.nodes;
  return nodes.map((n, k) => `${k ? '<i class="mf-a"></i>' : ''}${n ? `<span class="mf-n" title="${esc(n[1])}">${learnIcon(n[0])}</span>` : '<span class="mf-n more">…</span>'}`).join('');
};
const STATUS_TEXT = { passed: 'Checked', read: 'Read', '': '~3 min' };
function renderLibrary(fromSearch = false) {
  learnCur = null;
  const match = learnMatch();
  const chapters = GROUPS.map(([g, name], gi) => {
    const all = CONCEPTS.filter((c) => c.group === g), list = all.filter(match);
    const done = all.filter((c) => progress.read.has(c.id)).length;
    return list.length ? `<section class="fg-chap" style="--d:${gi}">
      <header><span class="fg-chap-n">${String(gi + 1).padStart(2, '0')}</span><h2>${name}</h2><small>${done ? `${done} of ${all.length} read` : `${all.length} primers`}</small></header>
      <div class="fg-cards">${list.map((c) => `<a class="fg-card ${statusOf(c.id)}" href="${PATHS.guide(c.id)}" data-learn="${c.id}">
        <span class="mf">${miniFlow(c)}</span>
        <b>${c.title}</b><small>${firstSentence(c.idea)}</small>
        <span class="fg-st">${STATUS_TEXT[statusOf(c.id)]}</span></a>`).join('')}</div></section>` : '';
  }).join('');
  const list = chapters || `<p class="fm-empty">Nothing matches “${esc(learnQuery)}”. Try cache, queue or lock.</p>`;
  const holder = learnEl.querySelector('.fm-chapters-list');
  if (fromSearch && holder) { holder.innerHTML = list; return syncToc(); }
  const next = nextUnread();
  // the progress map: every primer is a square, one row per chapter
  const map = GROUPS.map(([g, name]) => `<div class="pm-row"><span>${name}</span><div>${CONCEPTS.filter((c) => c.group === g).map((c) => `<a class="pm-sq ${statusOf(c.id)}" href="${PATHS.guide(c.id)}" data-learn="${c.id}" title="${esc(c.title)}"></a>`).join('')}</div></div>`).join('');
  setPage(`
    <header class="fg-hero">
      <div>
        <h1>Field guide</h1>
        <p class="fg-sub">The ideas behind the exercises, one board at a time.</p>
        <p>${CONCEPTS.length} short primers. Each takes about three minutes: the idea, a picture of it, when to reach for it, what goes wrong, and the sentence to say out loud in the interview.</p>
        <a class="btn" href="${PATHS.guide(next.id)}" data-learn="${next.id}">${progress.read.size ? 'Continue with' : 'Start with'} <b>${next.title}</b><span class="arr">${ICON.arrow}</span></a>
      </div>
      <figure class="pmap" aria-label="Your progress">
        <figcaption><b>${progress.read.size}</b>/${CONCEPTS.length} read<span>${progress.passed.size} checked</span></figcaption>
        ${map}
        <p class="pm-key"><i></i>unread <i class="read"></i>read <i class="passed"></i>checked</p>
      </figure>
    </header>
    <div class="fm-chapters-list">${list}</div>`);
}
function renderConcept(id) {
  const c = conceptById(id);
  if (!c) return renderLibrary();
  learnCur = c.id;
  if (!progress.read.has(c.id)) { progress.read.add(c.id); saveProgress(); }
  const i = CONCEPTS.indexOf(c), prev = CONCEPTS[i - 1], next = CONCEPTS[i + 1];
  const inGroup = CONCEPTS.filter((x) => x.group === c.group);
  const flow = (f) => `<div class="flow ${f.tone || ''}">${f.label ? `<span class="flow-l">${f.label}</span>` : ''}<div class="flow-row">${f.nodes.map((n, k) => `${k ? `<span class="fa"><i>${f.arrows?.[k - 1] || ''}</i><b style="animation-delay:${k * 0.35}s"></b></span>` : ''}<span class="fn">${learnIcon(n[0])}<span>${n[1]}</span></span>`).join('')}</div></div>`;
  const where = scenariosFor(c);
  const canStart = !sim;
  const secs = [];
  const block = (key, title, body) => { secs.push([key, title]); return `<section class="fg-sec" id="sec-${key}"><h3>${title}</h3>${body}</section>`; };
  const body = [
    c.flows ? block('picture', 'Picture it', `<div class="board">${c.flows.map(flow).join('')}</div>`) : '',
    block('tradeoffs', 'Trade-offs', `<div class="learn-cols"><div class="g"><h4>Use it when</h4><ul>${c.when.map((x) => `<li>${x}</li>`).join('')}</ul></div><div class="r"><h4>Watch out for</h4><ul>${c.watch.map((x) => `<li>${x}</li>`).join('')}</ul></div></div>`),
    c.numbers ? block('rules', 'Rules of thumb', `<ol class="numbers">${c.numbers.map((n) => `<li>${n}</li>`).join('')}</ol>`) : '',
    block('say', 'Say it in the interview', `<blockquote class="say"><span>You, at the whiteboard</span><p>${c.say}</p></blockquote>`),
    c.game ? block('game', 'In the game', `<p class="game-note">${c.game}</p>`) : '',
    CHECKS[c.id] ? block('check', 'Check yourself', `<div class="check" data-check="${c.id}"><p class="check-q">${CHECKS[c.id].q}</p><div class="check-o">${CHECKS[c.id].options.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('')}</div><p class="check-why" hidden></p></div>`) : '',
    where.length ? block('practice', 'Practice it in', `<div class="where">${where.map((x) => canStart ? `<a class="where-chip" href="${PATHS.play(x.id)}" data-start="${x.id}">${x.title}${ICON.arrow}</a>` : `<span class="where-chip">${x.title}</span>`).join('')}</div>`) : '',
  ].join('');
  setPage(`
    <div class="fg-spread">
      <article class="fg-article">
        <div class="fg-crumb"><a href="${PATHS.guide()}" data-learn-home>Field guide</a><span>${chapterOf(c).name}</span></div>
        <header class="fg-head"><span class="fg-ic" aria-hidden="true">${c.icon}</span><h1>${c.title}</h1></header>
        <p class="idea">${c.idea}</p>
        ${body}
        <nav class="fm-pn">${prev ? `<a href="${PATHS.guide(prev.id)}" data-learn="${prev.id}"><small>← Previous</small><b>${prev.title}</b></a>` : '<span></span>'}${next ? `<a href="${PATHS.guide(next.id)}" data-learn="${next.id}"><small>Next →</small><b>${next.title}</b></a>` : '<span></span>'}</nav>
      </article>
      <aside class="fg-rail">
        <h4>On this page</h4>
        <nav class="rail-secs">${secs.map(([k, t]) => `<button data-jump="sec-${k}">${t}</button>`).join('')}</nav>
        ${next ? `<h4>Up next</h4><a class="rail-next" href="${PATHS.guide(next.id)}" data-learn="${next.id}"><b>${next.title}</b><small>${firstSentence(next.idea)}</small></a>` : ''}
      </aside>
    </div>`);
  const main = learnEl.querySelector('.fm-main');
  main.focus({ preventScroll: true });
  // highlight the section being read
  const btns = [...learnEl.querySelectorAll('[data-jump]')];
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) btns.forEach((b) => b.classList.toggle('on', b.dataset.jump === e.target.id));
  }), { root: main, rootMargin: '-20% 0px -65% 0px' });
  learnEl.querySelectorAll('.fg-sec').forEach((s) => io.observe(s));
  btns.forEach((b) => b.addEventListener('click', () => learnEl.querySelector('#' + b.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
}
document.addEventListener('click', (e) => {
  const ck = e.target.closest('.check .opt');
  if (ck && !ck.disabled) {
    const box = ck.closest('.check'), id = box.dataset.check, C = CHECKS[id], k = +ck.dataset.k, ok = k === C.answer;
    box.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; b.classList.toggle('right', j === C.answer); b.classList.toggle('wrong', j === k && !ok); });
    const w = box.querySelector('.check-why');
    w.hidden = false;
    w.innerHTML = `<b>${ok ? 'Right.' : 'Not quite.'}</b> ${C.why}`;
    w.className = `check-why ${ok ? 'ok' : 'no'}`;
    if (ok && !progress.passed.has(id)) { progress.passed.add(id); saveProgress(); syncToc(); }
    if (!ok) box.insertAdjacentHTML('beforeend', '<button class="link check-retry">Try again</button>');
    sfx(ok ? 'good' : 'bad');
    return;
  }
  if (e.target.closest('.check-retry')) { const id = e.target.closest('.check').dataset.check; renderConcept(id); learnEl.querySelector('.check')?.scrollIntoView({ block: 'center' }); return; }
  const l = e.target.closest('[data-learn]');
  const link = e.target.closest('a[href^="/"]');
  if (link && newTabClick(e)) return; // let the browser open it in a new tab
  if (l) { e.preventDefault(); return learnEl.hidden ? openLearn(l.dataset.learn) : (showGuidePage(l.dataset.learn), sfx('tick')); }
  if (e.target.closest('[data-learn-open]') && !e.target.closest('#hud')) { e.preventDefault(); return openLearn(); }
  if (e.target.closest('[data-learn-home]')) { e.preventDefault(); return showGuidePage(null); }
  if (e.target.closest('.learn-x')) { e.preventDefault(); return closeLearn(); }
  const st = e.target.closest('#learn [data-start]');
  if (st) { e.preventDefault(); closeLearn(false); unlockAudio(); startExercise(st.dataset.start); }
});

// back / forward
addEventListener('popstate', () => {
  const r = parseRoute();
  if (r.name === 'guide') return learnEl.hidden ? openLearn(r.id, false) : showGuidePage(r.id, false);
  if (r.name === 'play' && sim && PATHS.play(r.id) === gamePath) { if (!learnEl.hidden) closeLearn(false); return; }
  if (r.name === 'home' && !sim) { if (!learnEl.hidden) closeLearn(false); else homeScreen(); return; }
  location.reload(); // a different exercise, or leaving a game: start clean
});

// ═════════════════════════════════════════════ boot
{
  const legacy = byId(location.hash.slice(1)); // old links: /#<id>
  if (legacy) go(PATHS.play(legacy.id), true);
  const r = parseRoute();
  if (r.name === 'play' && byId(r.id)) choose(byId(r.id));
  else if (r.name === 'guide') { homeScreen(); openLearn(r.id, false); }
  else { if (location.pathname !== '/') go(PATHS.home, true); homeScreen(); }
}
