// Whiteboard-style model library: pastel solids with ink outlines.
// makeModel(kind, color) → { group, mesh, h, leds?, spin? }
//   mesh: main mesh (its material color is animated for hot/outage states when built with { own: true })
//   h:    model height, used to place labels
import * as THREE from 'three';

export const INK = '#1c2433';
const inkLine = new THREE.LineBasicMaterial({ color: INK });
const inkMat = new THREE.MeshBasicMaterial({ color: INK });
const cache = {};
const mat = (c) => (cache[c] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));

function solid(geo, color, { x = 0, y = 0, z = 0, edges = true, own = false, rx = 0, ry = 0, rz = 0 } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, own ? new THREE.MeshStandardMaterial({ color, roughness: 0.7 }) : mat(color));
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  if (edges) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), inkLine));
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  g.userData.mesh = m;
  return g;
}
const ring = (r, y, axis = 'x') => {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 48), inkMat);
  if (axis === 'x') t.rotation.x = Math.PI / 2;
  t.position.y = y;
  return t;
};

export { MODEL_KINDS } from './model-kinds.js';

export function makeModel(kind, color, { own = false } = {}) {
  const g = new THREE.Group();
  const out = { group: g, mesh: null, h: 2 };
  const main = (s) => { g.add(s); out.mesh ||= s.userData.mesh; return s; };
  const c = color;
  switch (kind) {
    case 'platform': main(solid(new THREE.CylinderGeometry(4, 4, 0.3, 48), c || '#ffffff', { y: 0.15 })); out.h = 0.3; break;
    case 'person': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 4, 10), mat(c));
      body.position.y = 0.62; body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), mat('#f6d2b1'));
      head.position.y = 1.15; head.castShadow = true;
      g.add(body, head); out.h = 1.3; break;
    }
    case 'server': {
      main(solid(new THREE.BoxGeometry(1.6, 2.3, 1.6), c || '#a9c8ff', { y: 1.15 }));
      out.leds = [];
      for (let k = 0; k < 3; k++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: '#1f9d55' }));
        led.position.set(0, 1.75 - k * 0.38, 0.83);
        g.add(led); out.leds.push(led);
      }
      out.h = 2.3; break;
    }
    case 'db': main(solid(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 40), c || '#ffd59a', { y: 1.3, own })); g.add(ring(1.5, 0.95), ring(1.5, 1.7)); out.h = 2.6; break;
    case 'cyl': main(solid(new THREE.CylinderGeometry(1.05, 1.05, 1.9, 32), c || '#ffe6c2', { y: 0.95, own })); g.add(ring(1.05, 0.7)); out.h = 1.9; break;
    case 'external': {
      main(solid(new THREE.BoxGeometry(2.2, 1.3, 1.6), c || '#b7ebc6', { y: 0.65, own }));
      const d = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 2, 2.4)), new THREE.LineDashedMaterial({ color: INK, dashSize: 0.25, gapSize: 0.18 }));
      d.computeLineDistances(); d.position.y = 1; g.add(d); out.h = 1.6; break;
    }
    case 'bell': main(solid(new THREE.ConeGeometry(0.95, 1.5, 28), c || '#fbc3dc', { y: 1.15, own })); g.add(solid(new THREE.SphereGeometry(0.25, 14, 14), c || '#fbc3dc', { y: 0.35, edges: false })); out.h = 1.9; break;
    case 'box': main(solid(new THREE.BoxGeometry(1.6, 1.6, 1.6), c || '#ffb3b3', { y: 0.8, own })); out.h = 1.6; break;
    case 'cloud': [[0, 0, 0, 1], [1, -0.25, 0.2, 0.75], [-1, -0.25, -0.1, 0.8], [0.35, 0.35, -0.5, 0.7]].forEach(([x, y, z, r], i) => { const s = solid(new THREE.SphereGeometry(r, 18, 14), c || '#ffffff', { x, y: 3 + y, z, edges: false, own: own && i === 0 }); i === 0 ? main(s) : g.add(s); }); out.h = 3.6; break;
    case 'octa': main(solid(new THREE.OctahedronGeometry(1.1), c || '#d5c5ff', { y: 1.3, own })); out.h = 2.4; break;
    case 'ring': main(solid(new THREE.TorusGeometry(0.95, 0.24, 14, 36), c || '#9fdcff', { y: 1.3, ry: Math.PI / 2, own })); out.h = 2.3; break;
    case 'key': main(solid(new THREE.TorusGeometry(0.38, 0.13, 10, 22), c || '#ffd76a', { y: 1.45, own })); g.add(solid(new THREE.BoxGeometry(0.16, 0.9, 0.16), c || '#ffd76a', { y: 0.7 })); out.h = 1.5; break;
    case 'tube': {
      main(solid(new THREE.CylinderGeometry(0.55, 0.55, 4.4, 24), c || '#dbe2ec', { y: 0.65, rz: Math.PI / 2, own }));
      for (let i = -1; i <= 1; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 6, 24), inkMat); r.rotation.y = Math.PI / 2; r.position.set(i * 1.1, 0.65, 0); g.add(r); }
      out.h = 1.3; break;
    }
    case 'lock': main(solid(new THREE.BoxGeometry(1.1, 0.9, 0.5), c || '#cfd6e2', { y: 0.45, own })); g.add(solid(new THREE.TorusGeometry(0.36, 0.1, 8, 20, Math.PI), c || '#cfd6e2', { y: 0.9 })); out.h = 1.3; break;
    case 'wheel': {
      const w = new THREE.Group();
      w.add(solid(new THREE.TorusGeometry(4.8, 0.13, 8, 64), c || '#8fb4ff', { edges: false }));
      for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.08, 0.08), mat(c || '#8fb4ff')); s.rotation.z = (i / 7) * Math.PI; w.add(s); }
      w.rotation.x = Math.PI / 2; w.position.y = 4.8; g.add(w); out.spin = w; out.h = 4.9; break;
    }
    case 'cluster': for (let i = 0; i < 8; i++) { const s = solid(new THREE.BoxGeometry(0.7, 0.8, 0.7), c || '#c6dbff', { x: (i % 4) * 1.1 - 1.65, y: 0.4, z: Math.floor(i / 4) * 1.1 - 0.55 }); i === 0 ? main(s) : g.add(s); } out.h = 0.9; break;
    case 'shards': [-1.2, 1.2].forEach((x, i) => { const s = solid(new THREE.CylinderGeometry(0.85, 0.85, 1.6, 28), c || '#ffc98a', { x, y: 0.8 }); i === 0 ? main(s) : g.add(s); }); out.h = 1.6; break;
    case 'gear': {
      const gr = new THREE.Group();
      gr.add(solid(new THREE.TorusGeometry(0.6, 0.2, 10, 24), c || '#c7d2fe'));
      for (let k = 0; k < 8; k++) { const t = solid(new THREE.BoxGeometry(0.3, 0.3, 0.32), c || '#c7d2fe'); const a = (k / 8) * Math.PI * 2; t.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0); t.rotation.z = a; gr.add(t); }
      gr.position.y = 1.2; g.add(gr); out.mesh = gr.children[0].userData.mesh; out.spin = gr; out.h = 2.2; break;
    }
    case 'shield': {
      const shape = new THREE.Shape();
      shape.moveTo(0, 1); shape.quadraticCurveTo(0.9, 1, 0.9, 0.6); shape.quadraticCurveTo(0.9, -0.4, 0, -1); shape.quadraticCurveTo(-0.9, -0.4, -0.9, 0.6); shape.quadraticCurveTo(-0.9, 1, 0, 1);
      main(solid(new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }), c || '#bbf7d0', { y: 1.3, own })); out.h = 2.3; break;
    }
    case 'hourglass': main(solid(new THREE.ConeGeometry(0.8, 1, 24), c || '#fde68a', { y: 1.5, rx: Math.PI, own })); g.add(solid(new THREE.ConeGeometry(0.8, 1, 24), c || '#fde68a', { y: 0.5 })); out.h = 2; break;
    case 'phone': main(solid(new THREE.BoxGeometry(0.9, 1.7, 0.18), c || '#e0e7ff', { y: 0.95, own })); g.add(solid(new THREE.BoxGeometry(0.7, 1.25, 0.05), '#1c2433', { y: 1.0, z: 0.1, edges: false })); out.h = 1.9; break;
    case 'pin': main(solid(new THREE.ConeGeometry(0.45, 1.2, 20), c || '#fca5a5', { y: 0.6, rx: Math.PI, own })); g.add(solid(new THREE.SphereGeometry(0.55, 20, 16), c || '#fca5a5', { y: 1.35 })); out.h = 1.9; break;
    case 'screen': main(solid(new THREE.BoxGeometry(2.2, 1.4, 0.15), c || '#e0e7ff', { y: 1.35, own })); g.add(solid(new THREE.CylinderGeometry(0.08, 0.08, 0.6), '#94a3b8', { y: 0.35 }), solid(new THREE.BoxGeometry(0.9, 0.08, 0.5), '#94a3b8', { y: 0.05 })); out.h = 2.1; break;
    case 'globe': { const s = solid(new THREE.SphereGeometry(1, 20, 14), c || '#a7f3d0', { y: 1.2, own }); main(s); g.add(ring(1.02, 1.2), ring(1.02, 1.2, 'y')); out.spin = s; out.h = 2.2; break; }
    case 'stack': for (let k = 0; k < 3; k++) { const s = solid(new THREE.BoxGeometry(1.5, 0.3, 1.1), c || '#fde68a', { y: 0.15 + k * 0.32, ry: (k % 2 ? 1 : -1) * 0.15 }); k === 0 ? main(s) : g.add(s); } out.h = 1; break;
    case 'sphere': main(solid(new THREE.SphereGeometry(0.9, 20, 16), c || '#fbcfe8', { y: 0.9, own })); out.h = 1.8; break;
    case 'cone': main(solid(new THREE.ConeGeometry(0.9, 1.8, 24), c || '#fed7aa', { y: 0.9, own })); out.h = 1.8; break;
    case 'tower': main(solid(new THREE.CylinderGeometry(0.25, 0.6, 2.6, 12), c || '#cbd5e1', { y: 1.3, own })); g.add(ring(0.5, 2.2), ring(0.7, 1.7)); out.h = 2.6; break;
    case 'funnel': main(solid(new THREE.CylinderGeometry(1.1, 0.25, 1.3, 24, 1, true), c || '#fecaca', { y: 1.3, own })); g.add(solid(new THREE.CylinderGeometry(0.25, 0.25, 0.6, 12), c || '#fecaca', { y: 0.35 })); out.h = 2; break;
    case 'film': main(solid(new THREE.CylinderGeometry(0.9, 0.9, 0.35, 28), c || '#e9d5ff', { y: 1.1, rx: Math.PI / 2, own })); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.add(solid(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 10), '#ffffff', { x: Math.cos(a) * 0.5, y: 1.1 + Math.sin(a) * 0.5, rx: Math.PI / 2, edges: false })); } out.h = 2; break;
    case 'counter': main(solid(new THREE.BoxGeometry(1.8, 1, 0.9), c || '#e2e8f0', { y: 0.5, own })); for (let k = 0; k < 3; k++) g.add(solid(new THREE.BoxGeometry(0.4, 0.5, 0.05), '#1c2433', { x: -0.55 + k * 0.55, y: 0.55, z: 0.47, edges: false })); out.h = 1; break;
    default: main(solid(new THREE.BoxGeometry(1.4, 1.4, 1.4), c || '#e2e8f0', { y: 0.7, own })); out.h = 1.4;
  }
  return out;
}
