// Road traffic: ordinary folk travelling the kingdom's roads — horse-drawn wagons and ox carts with a
// driver on the bench, peasants, pilgrims, pedlars and woodcutters on foot. They are not quests or events:
// a few are spawned out of sight around the player, follow the road network at walking pace, keep to their
// side of the road, give way / stop for the player, greet in passing and vanish again far away.
// They can be struck: that is a crime (witnessed by guards or mounted knight patrols), they flee
// (the driver whips the team, walkers run), and they can be knocked down — never killed — sometimes
// dropping a little food or coin. Traffic is transient and never saved.
import * as THREE from 'three';
import { Mount } from './mount.js';
import { Humanoid } from './humanoid.js';
import { Equine } from './equine.js';
import { Quadruped } from './quadruped.js';
import { Builder } from '../world/builder.js';
import { ROADS, CASTLE, CAMP, CRAG } from '../world/layout.js';
import { angleLerp, angleDiff, damp } from '../engine/noise.js';
import { pickBark } from '../game/barks.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rr = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

// =====================================================================================
// road graph (built once from the layout polylines)
// =====================================================================================
// Roads end outside the castle gate, short of the bandit camp and below the twilight crag:
// ordinary travellers do not go there.
function roadPointAllowed(p) {
  if (Math.hypot(p.x - CASTLE.x, p.z - CASTLE.z) < 180) return false;
  if (Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < 60) return false;
  if (Math.hypot(p.x - CRAG.x, p.z - CRAG.z) < 150) return false;
  return true;
}

let GRAPH = null;
function roadGraph() {
  if (GRAPH) return GRAPH;
  const key = (p) => Math.round(p.x) + ',' + Math.round(p.z);
  // split each road into runs of allowed points
  const runs = [];
  for (const road of ROADS) {
    let cur = [];
    for (const p of road) {
      if (roadPointAllowed(p)) cur.push({ x: p.x, z: p.z });
      else { if (cur.length > 1) runs.push(cur); cur = []; }
    }
    if (cur.length > 1) runs.push(cur);
  }
  const count = new Map();
  for (const r of runs) for (const p of r) count.set(key(p), (count.get(key(p)) || 0) + 1);
  const nodes = new Map();
  const node = (p) => { const k = key(p); let n = nodes.get(k); if (!n) { n = { x: p.x, z: p.z, edges: [] }; nodes.set(k, n); } return n; };
  const edges = [];
  for (const r of runs) {
    let start = 0;
    for (let i = 1; i < r.length; i++) {
      if (i === r.length - 1 || count.get(key(r[i])) > 1) {
        const pts = r.slice(start, i + 1);
        const cum = [0];
        for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].z - pts[j - 1].z));
        const e = { pts, cum, len: cum[cum.length - 1], a: node(pts[0]), b: node(pts[pts.length - 1]) };
        if (e.len > 1) { e.a.edges.push(e); e.b.edges.push(e); edges.push(e); }
        start = i;
      }
    }
  }
  const total = edges.reduce((s, e) => s + e.len, 0);
  GRAPH = { edges, total };
  return GRAPH;
}

// point on an edge at arc length s: {x, z, tx, tz} (tangent in the edge's own direction)
function edgePoint(e, s, out = {}) {
  s = Math.max(0, Math.min(e.len, s));
  let i = 1;
  while (i < e.cum.length - 1 && e.cum[i] < s) i++;
  const a = e.pts[i - 1], b = e.pts[i];
  const L = e.cum[i] - e.cum[i - 1] || 1;
  const t = (s - e.cum[i - 1]) / L;
  out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t;
  out.tx = (b.x - a.x) / L; out.tz = (b.z - a.z) / L;
  return out;
}

function edgeProject(e, x, z) {
  let best = 1e9, bs = 0;
  for (let i = 1; i < e.pts.length; i++) {
    const a = e.pts[i - 1], b = e.pts[i];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const px = a.x + dx * t, pz = a.z + dz * t, d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < best) { best = d; bs = e.cum[i - 1] + t * (e.cum[i] - e.cum[i - 1]); }
  }
  return bs;
}

// the "carrot": a point running ahead along the road network that a traveller steers towards
class Carrot {
  constructor(e, s, dir) { this.e = e; this.s = s; this.dir = dir; this.end = false; this.p = {}; this.update(); }
  update() {
    edgePoint(this.e, this.s, this.p);
    this.p.tx *= this.dir; this.p.tz *= this.dir;
    return this.p;
  }
  step(ds) {
    this.s += ds * this.dir;
    for (let guard = 0; guard < 4 && (this.s > this.e.len || this.s < 0); guard++) {
      const atEnd = this.s > this.e.len;
      const over = atEnd ? this.s - this.e.len : -this.s;
      const n = atEnd ? this.e.b : this.e.a;
      const opts = n.edges.filter((e) => e !== this.e);
      if (!opts.length) { this.s = atEnd ? this.e.len : 0; this.end = true; break; }
      const e = pick(opts);
      this.e = e;
      if (e.a === n) { this.dir = 1; this.s = over; } else { this.dir = -1; this.s = e.len - over; }
    }
    this.update();
  }
  // turn back towards where the traveller came from
  reverse(x, z) {
    this.dir *= -1;
    this.s = edgeProject(this.e, x, z);
    this.end = false;
    this.update();
  }
}

// =====================================================================================
// procedural wagon models (merged per material, cached per variant, shared by instances)
// =====================================================================================
const GEO = {};
function geo() {
  if (GEO.box) return GEO;
  GEO.box = new THREE.BoxGeometry(1, 1, 1);
  GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  GEO.cyl6 = new THREE.CylinderGeometry(1, 1, 1, 6);
  GEO.sph = new THREE.SphereGeometry(1, 14, 10);
  GEO.sphLo = new THREE.SphereGeometry(1, 9, 7);
  GEO.cone = new THREE.ConeGeometry(1, 1, 10);
  GEO.barrel = new THREE.LatheGeometry([[0.34, 0], [0.39, 0.1], [0.425, 0.3], [0.44, 0.5], [0.425, 0.7], [0.39, 0.9], [0.34, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  GEO.hoop = new THREE.TorusGeometry(1, 0.035, 5, 20);
  GEO.halfHoop = new THREE.TorusGeometry(1, 0.03, 5, 16, Math.PI);
  GEO.canvas = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true, -Math.PI / 2, Math.PI);
  GEO.felloe = new THREE.TorusGeometry(0.87, 0.075, 6, 28);
  GEO.tyre = new THREE.TorusGeometry(0.955, 0.035, 5, 32);
  GEO.ring = new THREE.TorusGeometry(1, 0.1, 5, 18);
  return GEO;
}

const WOODS = ['#a47650', '#9a7c5c', '#b08458', '#8e7662'];
const DARK = '#6e4e36';
const IRON = '#4e525c';
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k);

function box(B, mat, x, y, z, w, h, d, color, o = {}) {
  B.add(mat, geo().box, x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, w, h, d, { color, ao: false, ...o });
}
// a round beam between two points
function beam(B, mat, x1, y1, z1, x2, y2, z2, r, color) {
  _v.set(x2 - x1, y2 - y1, z2 - z1);
  const len = _v.length();
  _q.setFromUnitVectors(_up, _v.normalize());
  const e = new THREE.Euler().setFromQuaternion(_q, 'YXZ');
  B.add(mat, geo().cyl6, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, e.x, e.y, e.z, r, len, r, { color, ao: false, order: 'YXZ' });
}
function barrelAt(B, x, y, z, s = 1, lying = false) {
  const G = geo();
  const col = shade('#a47650', 0.9 + Math.random() * 0.2);
  if (lying) {
    B.add('wood', G.barrel, x - 0.5 * s * 0.75, y + 0.44 * 0.75 * s, z, 0, 0, -Math.PI / 2, 0.75 * s, 0.75 * s, 0.75 * s, { color: col, ao: false });
    for (const f of [0.12, 0.88]) B.add('iron', G.hoop, x - 0.375 * s + f * 0.75 * s, y + 0.33 * s, z, 0, Math.PI / 2, 0, 0.3 * s, 0.3 * s, 0.3 * s, { color: IRON, ao: false });
    return;
  }
  const h = 0.75 * s, r = 0.75 * s;
  B.add('wood', G.barrel, x, y, z, 0, 0, 0, r, h, r, { color: col, ao: false });
  B.add('wood', G.cyl, x, y + h - 0.01, z, 0, 0, 0, 0.26 * s, 0.02, 0.26 * s, { color: shade(col, 0.8), ao: false });
  for (const f of [0.13, 0.87]) B.add('iron', G.hoop, x, y + f * h, z, Math.PI / 2, 0, 0, 0.3 * s + (f === 0.5 ? 0.02 : 0), 0.3 * s, 0.3 * s, { color: IRON, ao: false });
}
function sackAt(B, x, y, z, ry = 0, col = '#d8c498', s = 1) {
  const G = geo();
  B.add('fabric', G.sph, x, y + 0.17 * s, z, 0, ry, 0, 0.27 * s, 0.19 * s, 0.36 * s, { color: col, ao: false });
  const ox = Math.sin(ry) * 0.36 * s, oz = Math.cos(ry) * 0.36 * s;
  B.add('fabric', G.cone, x + ox, y + 0.2 * s, z + oz, Math.PI / 2, ry, 0, 0.09 * s, 0.14 * s, 0.09 * s, { color: shade(col, 0.9), ao: false, order: 'YXZ' });
  B.add('fabric', G.ring, x + ox * 0.82, y + 0.2 * s, z + oz * 0.82, 0, ry, 0, 0.08 * s, 0.08 * s, 0.08 * s, { color: '#8a6a44', ao: false });
}
function crateAt(B, x, y, z, s, ry = 0, fill = null) {
  const c = shade('#c49a6c', 0.9 + Math.random() * 0.15);
  box(B, 'wood', x, y + s * 0.5, z, s, s * 0.95, s, c, { ry });
  for (const f of [0.06, 0.94]) box(B, 'wood', x, y + f * s * 0.95, z, s * 1.03, 0.05, s * 1.03, DARK, { ry });
  if (fill) for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    B.add('plain', geo().sphLo, x + Math.cos(a) * s * 0.25, y + s * 0.97, z + Math.sin(a) * s * 0.25, 0, 0, 0, s * 0.14, s * 0.14, s * 0.14, { color: shade(fill, 0.85 + (i % 3) * 0.1), ao: false });
  }
}
function hayMound(B, x0, x1, z0, z1, y, h) {
  const G = geo();
  const cols = ['#e8cf7a', '#d8bc60', '#f0dc90', '#dcc46c'];
  box(B, 'fabric', (x0 + x1) / 2, y + h * 0.4, (z0 + z1) / 2, x1 - x0, h * 0.8, z1 - z0, '#e2c86e');
  const nx = 3, nz = Math.max(3, Math.round((z1 - z0) / 0.55));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + (i + 0.5) * (x1 - x0) / nx, z = z0 + (j + 0.5) * (z1 - z0) / nz;
    const r = 0.3 + Math.random() * 0.14;
    B.add('fabric', G.sph, x, y + h * 0.75 + (i === 1 ? 0.12 : 0), z, 0, Math.random() * 3, 0, r * 1.2, r * 0.8, r * 1.1, { color: pick(cols), ao: false });
  }
  // loose straws
  for (let i = 0; i < 16; i++) {
    const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0);
    B.add('fabric', G.box, x, y + h + 0.05, z, rr(-0.6, 0.6), Math.random() * 3, rr(-0.6, 0.6), 0.015, 0.02, 0.35, { color: '#f4e4a0', ao: false });
  }
}

// wheel of radius 1 in the YZ plane (axle along x); scaled per use
let WHEEL = null;
function wheelTemplate() {
  if (WHEEL) return WHEEL;
  const G = geo();
  const B = new Builder(null);
  B.add('wood', G.felloe, 0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1.35, { color: '#8a6444', ao: false });
  B.add('iron', G.tyre, 0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1.7, { color: IRON, ao: false });
  B.add('wood', G.cyl, 0, 0, 0, 0, 0, Math.PI / 2, 0.15, 0.36, 0.15, { color: DARK, ao: false });
  for (const sx of [-0.19, 0.19]) B.add('iron', G.cyl, sx, 0, 0, 0, 0, Math.PI / 2, 0.12, 0.04, 0.12, { color: IRON, ao: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.add('wood', G.box, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5, a, 0, 0, 0.055, 0.74, 0.07, { color: '#9a7250', ao: false, order: 'XYZ' });
  }
  WHEEL = B.build();
  WHEEL.traverse((m) => { if (m.isMesh) { m.receiveShadow = false; } });
  return WHEEL;
}
function makeWheel(r) {
  const w = wheelTemplate().clone();
  w.scale.setScalar(r);
  return w;
}

// 4-wheel wagon: origin between the axles at ground level, +z forward; front axle pivots at z=+1
function buildWagon(v) {
  const B = new Builder(null);
  const W = v.wood;
  // chassis
  for (const sx of [-0.3, 0.3]) box(B, 'wood', sx, 0.74, -0.1, 0.1, 0.1, 3.0, DARK);
  box(B, 'wood', 0, 0.55, -1.0, 1.72, 0.1, 0.12, DARK);
  box(B, 'wood', 0, 0.66, -1.0, 1.3, 0.12, 0.16, DARK);
  for (const z of [-1.35, -0.45, 0.45, 1.25]) box(B, 'wood', 0, 0.8, z, 1.38, 0.06, 0.1, DARK);
  // floor planks
  for (let i = 0; i < 6; i++) box(B, 'wood', -0.575 + i * 0.23, 0.855, -0.1, 0.22, 0.05, 2.9, shade(W, 0.88 + ((i * 7) % 5) * 0.05));
  // sides: two boards, stakes with iron straps, top rail
  for (const sd of [-1, 1]) {
    for (const [j, y] of [[0, 1.0], [1, 1.22]]) box(B, 'wood', sd * 0.68, y, -0.1, 0.05, 0.2, 2.9, shade(W, 0.92 + j * 0.08));
    for (const z of [-1.5, -0.55, 0.4, 1.3]) {
      box(B, 'wood', sd * 0.72, 1.04, z, 0.07, 0.64, 0.08, DARK);
      box(B, 'iron', sd * 0.758, 1.1, z, 0.012, 0.46, 0.1, IRON);
      B.add('iron', geo().sphLo, sd * 0.766, 1.28, z, 0, 0, 0, 0.018, 0.018, 0.018, { color: '#8a8e98', ao: false });
    }
    box(B, 'wood', sd * 0.7, 1.35, -0.1, 0.08, 0.05, 2.98, DARK);
  }
  // front board & tailgate (with chains)
  for (const z of [1.33, -1.53]) for (const y of [1.0, 1.22]) box(B, 'wood', 0, y, z, 1.36, 0.2, 0.05, shade(W, y > 1.1 ? 1 : 0.9));
  for (const sd of [-1, 1]) beam(B, 'iron', sd * 0.66, 1.34, -1.53, sd * 0.5, 1.12, -1.58, 0.012, IRON);
  // driver's bench, back rail and footboard
  for (const sd of [-1, 1]) box(B, 'wood', sd * 0.52, 1.22, 1.05, 0.08, 0.36, 0.3, DARK);
  box(B, 'wood', 0, 1.42, 1.05, 1.34, 0.06, 0.36, shade(W, 1.05));
  box(B, 'fabric', 0, 1.46, 1.05, 0.9, 0.04, 0.3, v.cushion);
  box(B, 'wood', 0, 1.62, 0.86, 1.2, 0.05, 0.04, DARK);
  for (const sd of [-1, 1]) box(B, 'wood', sd * 0.55, 1.52, 0.86, 0.04, 0.2, 0.04, DARK);
  box(B, 'wood', 0, 1.0, 1.52, 1.2, 0.04, 0.4, W, { rx: -0.35 });
  // lantern on a crooked post
  box(B, 'wood', -0.66, 1.75, 1.3, 0.04, 0.8, 0.04, DARK);
  box(B, 'wood', -0.66, 2.13, 1.4, 0.03, 0.03, 0.22, DARK);
  box(B, 'iron', -0.66, 1.94, 1.5, 0.11, 0.15, 0.11, IRON);
  box(B, 'lamp', -0.66, 1.94, 1.5, 0.08, 0.11, 0.12, '#fff1c4');
  B.add('iron', geo().cone, -0.66, 2.05, 1.5, 0, 0, 0, 0.08, 0.07, 0.08, { color: IRON, ao: false });
  // cargo (floor top y = 0.88, room x ±0.6, z -1.45..0.75)
  const y0 = 0.88;
  if (v.cargo === 'barrels') {
    for (const [x, z] of [[-0.3, -1.12], [0.3, -1.12], [-0.3, -0.5], [0.3, -0.5]]) barrelAt(B, x, y0, z, 0.9);
    barrelAt(B, 0, y0, 0.25, 0.85, true);
    B.add('fabric', geo().ring, 0.3, y0 + 0.05, 0.62, Math.PI / 2, 0, 0, 0.2, 0.2, 0.25, { color: '#c8b080', ao: false });
  } else if (v.cargo === 'sacks') {
    const cols = ['#d8c498', '#c8b080', '#e0cfa8', '#f0ece0'];
    for (let i = 0; i < 6; i++) sackAt(B, i % 2 ? 0.28 : -0.28, y0, -1.15 + Math.floor(i / 2) * 0.62, 0.1 * (i % 3 - 1), pick(cols));
    for (let i = 0; i < 3; i++) sackAt(B, i % 2 ? 0.12 : -0.14, y0 + 0.3, -0.95 + i * 0.6, 0.3 * (i - 1), pick(cols), 0.95);
  } else if (v.cargo === 'hay') {
    hayMound(B, -0.62, 0.62, -1.48, 0.7, y0, 0.85);
    beam(B, 'wood', 0.35, y0 + 0.6, -0.9, 0.5, y0 + 1.7, -0.2, 0.022, '#b08a60');
    for (const o of [-0.06, 0, 0.06]) beam(B, 'iron', 0.5 + o, y0 + 1.7, -0.2, 0.52 + o * 1.4, y0 + 1.95, 0.05, 0.008, '#9aa0aa');
  } else if (v.cargo === 'cover') {
    // canvas tilt on bent hoops, crates peeking out at the back
    crateAt(B, -0.28, y0, -1.1, 0.5); crateAt(B, 0.28, y0, -1.15, 0.45, 0.2); barrelAt(B, 0, y0, -0.35, 0.9);
    sackAt(B, 0.3, y0, 0.3, 0.2); sackAt(B, -0.3, y0, 0.35, -0.2, '#e0cfa8');
    for (const z of [-1.3, -0.45, 0.4]) B.add('wood', geo().halfHoop, 0, 1.36, z, 0, 0, 0, 0.7, 0.72, 0.7, { color: DARK, ao: false });
    B.add('fabric', geo().canvas, 0, 1.36, -0.45, -Math.PI / 2, 0, 0, 0.73, 2.1, 0.75, { color: v.canvas, ao: false, worldUV: true, uvScale: 0.6 });
    for (const z of [-1.5, 0.6]) for (const sd of [-1, 1]) beam(B, 'fabric', sd * 0.72, 1.36, z, sd * 0.1, 1.95, z + (z < 0 ? -0.05 : 0.05), 0.012, '#9a8a6a');
  } else {
    // produce for the market: apples, cabbages, a cheese wheel, a basket
    crateAt(B, -0.3, y0, -1.15, 0.5, 0, '#e8404a'); crateAt(B, 0.3, y0, -1.15, 0.5, 0.1, '#e8404a');
    crateAt(B, -0.3, y0, -0.55, 0.5, -0.1, '#7ac050'); crateAt(B, 0.3, y0, -0.55, 0.5, 0, '#f0b040');
    crateAt(B, 0, y0 + 0.5, -0.85, 0.45, 0.3, '#7ac050');
    B.add('plain', geo().cyl, -0.25, y0 + 0.09, 0.2, 0, 0, 0, 0.24, 0.18, 0.24, { color: '#f2cf5a', ao: false });
    B.add('wood', geo().cyl, 0.28, y0 + 0.16, 0.25, 0, 0, 0, 0.22, 0.32, 0.22, { color: '#c8a064', ao: false });
    for (let i = 0; i < 5; i++) B.add('plain', geo().sphLo, 0.28 + Math.cos(i * 1.3) * 0.1, y0 + 0.34, 0.25 + Math.sin(i * 1.3) * 0.1, 0, 0, 0, 0.08, 0.08, 0.08, { color: '#e8404a', ao: false });
  }
  return B.build();
}

// the pivoting front axle with its wheels mounts and the horse shafts (origin at the kingpin, ground level)
function buildFrontAxle(v) {
  const B = new Builder(null);
  box(B, 'wood', 0, 0.46, 0, 1.62, 0.09, 0.11, DARK);
  box(B, 'wood', 0, 0.6, 0, 1.2, 0.12, 0.16, DARK);
  B.add('iron', geo().ring, 0, 0.68, 0, Math.PI / 2, 0, 0, 0.3, 0.3, 0.2, { color: IRON, ao: false });
  for (const sd of [-1, 1]) {
    beam(B, 'wood', sd * 0.5, 0.5, 0.1, sd * 0.47, 1.02, 2.95, 0.035, v.wood);
    B.add('iron', geo().ring, sd * 0.47, 1.0, 2.75, 0, 0, Math.PI / 2, 0.05, 0.05, 0.05, { color: IRON, ao: false });
  }
  box(B, 'wood', 0, 0.52, 0.35, 1.02, 0.06, 0.06, DARK);
  return B.build();
}

// 2-wheel ox cart: origin under the axle at ground level; the pole reaches the yoke at z = 3.4
function buildOxCart(v) {
  const B = new Builder(null);
  const W = v.wood;
  box(B, 'wood', 0, 0.72, 0, 1.95, 0.11, 0.12, DARK);
  for (const sx of [-0.62, 0.62]) box(B, 'wood', sx, 0.86, -0.1, 0.1, 0.12, 2.5, DARK);
  for (const z of [-1.2, -0.3, 0.6]) box(B, 'wood', 0, 0.86, z, 1.3, 0.08, 0.08, DARK);
  for (let i = 0; i < 5; i++) box(B, 'wood', -0.52 + i * 0.26, 0.945, -0.1, 0.25, 0.05, 2.4, shade(W, 0.88 + ((i * 3) % 4) * 0.06));
  // ladder racks
  for (const sd of [-1, 1]) {
    box(B, 'wood', sd * 0.7, 1.52, -0.1, 0.06, 0.06, 2.5, DARK);
    box(B, 'wood', sd * 0.7, 1.22, -0.1, 0.04, 0.05, 2.45, shade(W, 0.9));
    for (let i = 0; i < 7; i++) box(B, 'wood', sd * 0.7, 1.23, -1.28 + i * 0.39, 0.05, 0.58, 0.05, shade(W, 0.85 + (i % 2) * 0.1));
  }
  for (const x of [-0.45, 0, 0.45]) box(B, 'wood', x, 1.23, 1.12, 0.05, 0.58, 0.05, DARK);
  box(B, 'wood', 0, 1.52, 1.12, 1.46, 0.06, 0.06, DARK);
  // pole, prop and yoke pin
  beam(B, 'wood', 0, 0.86, 0.9, 0, 1.18, 3.4, 0.055, DARK);
  beam(B, 'wood', 0, 0.9, 1.5, 0.05, 0.25, 1.75, 0.03, DARK);
  B.add('iron', geo().ring, 0, 1.18, 3.35, 0, 0, Math.PI / 2, 0.07, 0.07, 0.07, { color: IRON, ao: false });
  // bench across the front rails + footrest on the pole
  box(B, 'wood', 0, 1.585, 0.8, 1.5, 0.06, 0.34, shade(W, 1.05));
  box(B, 'fabric', 0, 1.625, 0.8, 0.8, 0.04, 0.28, v.cushion);
  box(B, 'wood', 0, 1.12, 1.25, 0.9, 0.04, 0.3, W);
  const y0 = 0.97;
  if (v.cargo === 'logs') {
    const cols = ['#7a5a40', '#6a4e38', '#8a6a4a'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
      const x = -0.45 + i * 0.3 + r * 0.15, y = y0 + 0.14 + r * 0.24;
      B.add('wood', geo().cyl, x, y, -0.25, Math.PI / 2, 0, 0, 0.13, 2.1, 0.13, { color: pick(cols), ao: false, order: 'XYZ' });
      B.add('plain', geo().cyl, x, y, 0.81, Math.PI / 2, 0, 0, 0.115, 0.02, 0.115, { color: '#e8c89a', ao: false, order: 'XYZ' });
      B.add('plain', geo().cyl, x, y, -1.31, Math.PI / 2, 0, 0, 0.115, 0.02, 0.115, { color: '#e8c89a', ao: false, order: 'XYZ' });
    }
  } else if (v.cargo === 'hay') {
    hayMound(B, -0.68, 0.68, -1.4, 0.55, y0, 1.0);
  } else if (v.cargo === 'barrels') {
    for (const [x, z] of [[-0.3, -0.95], [0.3, -0.95], [0, -0.3]]) barrelAt(B, x, y0, z, 0.95);
    sackAt(B, -0.3, y0, 0.35, 0.2); sackAt(B, 0.3, y0, 0.3, -0.1, '#e0cfa8');
  } else {
    const cols = ['#d8c498', '#c8b080', '#e0cfa8', '#f0ece0'];
    for (let i = 0; i < 6; i++) sackAt(B, i % 2 ? 0.28 : -0.28, y0, -1.05 + Math.floor(i / 2) * 0.62, 0.1 * (i % 3 - 1), pick(cols));
    for (let i = 0; i < 2; i++) sackAt(B, i ? 0.14 : -0.14, y0 + 0.3, -0.8 + i * 0.62, 0.3, pick(cols), 0.95);
  }
  return B.build();
}

// collar, saddle pad, straps and breeching fitted to the Equine model (horse root space)
let HARNESS = null, YOKE = null;
function harnessTemplate() {
  if (HARNESS) return HARNESS;
  const B = new Builder(null);
  const L = '#4a3224';
  B.add('fabric', new THREE.TorusGeometry(1, 0.3, 8, 22), 0, 1.52, 0.74, -0.95, 0, 0, 0.19, 0.3, 0.22, { color: '#6a4a30', ao: false, order: 'XYZ' });
  for (const sd of [-1, 1]) {
    beam(B, 'gold', sd * 0.16, 1.42, 0.62, sd * 0.13, 1.86, 0.93, 0.02, '#c8a050');
    B.add('gold', geo().sphLo, sd * 0.13, 1.88, 0.95, 0, 0, 0, 0.03, 0.03, 0.03, { color: '#e8c060', ao: false });
    beam(B, 'fabric', sd * 0.2, 1.38, 0.62, sd * 0.47, 1.02, 0.55, 0.018, L); // traces to the shafts
    beam(B, 'fabric', sd * 0.29, 1.55, 0.02, sd * 0.47, 1.02, 0.12, 0.016, L); // back band down to the shafts
    beam(B, 'fabric', sd * 0.42, 1.12, -0.75, sd * 0.47, 1.02, 0.3, 0.014, L); // breeching straps
  }
  box(B, 'fabric', 0, 1.6, 0.05, 0.5, 0.06, 0.34, '#5a3c28', { rx: 0.05 });
  box(B, 'gold', 0, 1.64, 0.05, 0.08, 0.04, 0.2, '#c8a050');
  B.add('fabric', new THREE.TorusGeometry(1, 0.05, 5, 16, Math.PI), 0, 1.13, -0.5, -Math.PI / 2, 0, 0, 0.42, 0.52, 0.5, { color: L, ao: false, order: 'XYZ' });
  HARNESS = B.build();
  return HARNESS;
}
function yokeTemplate() {
  if (YOKE) return YOKE;
  const B = new Builder(null);
  beam(B, 'wood', -0.55, 1.32, 0.8, 0.55, 1.32, 0.8, 0.07, '#8a6444');
  for (const sd of [-1, 1]) B.add('wood', geo().halfHoop, sd * 0.001, 1.3, 0.8, 0, 0, Math.PI, 0.2, 0.32, 0.2, { color: DARK, ao: false });
  box(B, 'fabric', 0, 1.36, 0.8, 0.2, 0.05, 0.22, '#6a4a30');
  YOKE = B.build();
  return YOKE;
}

// small bundle left on the road by a knocked-down traveller
let BUNDLE = null;
function bundleTemplate() {
  if (BUNDLE) return BUNDLE;
  const B = new Builder(null);
  B.add('fabric', geo().sph, 0, 0.16, 0, 0, 0, 0, 0.24, 0.16, 0.2, { color: '#d8c498', ao: false });
  B.add('fabric', geo().cone, 0, 0.36, 0, 0, 0, 0, 0.07, 0.12, 0.07, { color: '#c8b080', ao: false });
  B.add('fabric', geo().ring, 0, 0.3, 0, Math.PI / 2, 0, 0, 0.06, 0.06, 0.06, { color: '#8a6a44', ao: false });
  B.add('plain', geo().sphLo, 0.2, 0.06, 0.12, 0, 0, 0, 0.06, 0.06, 0.06, { color: '#e8404a', ao: false });
  B.add('plain', geo().sph, -0.18, 0.07, 0.14, 0, 0.5, 0, 0.12, 0.07, 0.08, { color: '#e0b070', ao: false });
  BUNDLE = B.build();
  return BUNDLE;
}

// things walkers carry, attached to the Humanoid's bones (bone space)
const CARRY = {};
function carryTemplate(kind) {
  if (CARRY[kind]) return CARRY[kind];
  const B = new Builder(null);
  const G = geo();
  if (kind === 'bundle') {
    // sack slung on the back with a strap over the shoulder
    B.add('fabric', G.sph, 0, 0.22, -0.27, 0, 0, 0.2, 0.22, 0.26, 0.16, { color: '#d8c498', ao: false });
    B.add('fabric', G.cone, 0.04, 0.5, -0.26, 0, 0, 0.2, 0.07, 0.12, 0.06, { color: '#c8b080', ao: false });
    beam(B, 'fabric', 0.16, 0.48, -0.12, -0.14, 0.02, 0.15, 0.018, '#6a4a30');
  } else if (kind === 'pack') {
    // pedlar's frame pack: box, rolled blanket, pots and a lantern
    box(B, 'wood', 0, 0.2, -0.3, 0.42, 0.55, 0.24, '#9a7250');
    box(B, 'fabric', 0, 0.2, -0.43, 0.36, 0.44, 0.02, '#b84a4a');
    B.add('fabric', G.cyl, 0, 0.56, -0.3, 0, 0, Math.PI / 2, 0.1, 0.5, 0.1, { color: '#7a8ab8', ao: false });
    B.add('iron', G.cyl, 0.25, 0.05, -0.3, 0, 0, 0, 0.07, 0.12, 0.07, { color: '#8a8e98', ao: false });
    B.add('wood', G.cyl, -0.25, 0.1, -0.3, 0, 0, 0, 0.07, 0.16, 0.07, { color: '#c8a064', ao: false });
    for (const sd of [-1, 1]) beam(B, 'fabric', sd * 0.15, 0.48, -0.16, sd * 0.12, 0.0, -0.15, 0.02, '#5a3c28');
  } else if (kind === 'firewood') {
    const cols = ['#7a5a40', '#6a4e38', '#8a6a4a'];
    for (let i = 0; i < 6; i++) B.add('wood', G.cyl, -0.12 + (i % 3) * 0.12, 0.15 + Math.floor(i / 3) * 0.11, -0.3, 0, 0, Math.PI / 2 + rr(-0.1, 0.1), 0.05, 0.62, 0.05, { color: pick(cols), ao: false, order: 'XYZ' });
    beam(B, 'fabric', 0.14, 0.48, -0.14, 0.14, 0.05, -0.3, 0.015, '#5a3c28');
    beam(B, 'fabric', -0.14, 0.48, -0.14, -0.14, 0.05, -0.3, 0.015, '#5a3c28');
  } else if (kind === 'basket') {
    // wicker basket held in the hand (hand bone space: arm hangs along -y)
    B.add('wood', new THREE.CylinderGeometry(1, 0.8, 1, 12, 1, true), 0, -0.2, 0.02, 0, 0, 0, 0.17, 0.18, 0.13, { color: '#c8a064', ao: false, side: THREE.DoubleSide });
    B.add('wood', G.cyl, 0, -0.29, 0.02, 0, 0, 0, 0.14, 0.02, 0.1, { color: '#a88450', ao: false });
    B.add('wood', G.halfHoop, 0, -0.12, 0.02, 0, Math.PI / 2, 0, 0.13, 0.1, 0.13, { color: '#a88450', ao: false });
    for (let i = 0; i < 4; i++) B.add('plain', G.sphLo, Math.cos(i * 1.6) * 0.08, -0.14, 0.02 + Math.sin(i * 1.6) * 0.06, 0, 0, 0, 0.055, 0.055, 0.055, { color: i % 2 ? '#e8404a' : '#f0b040', ao: false });
    B.add('plain', G.sph, 0.02, -0.12, 0.0, 0, 0.4, 0, 0.1, 0.05, 0.06, { color: '#e0b070', ao: false });
  } else if (kind === 'goad') {
    beam(B, 'wood', 0, -0.05, -0.2, 0, 0.2, 1.4, 0.014, '#8a6a4a');
  } else if (kind === 'whip') {
    beam(B, 'wood', 0, -0.02, -0.05, 0, 0.35, 0.9, 0.012, '#5a3c28');
    beam(B, 'fabric', 0, 0.35, 0.9, 0, -0.1, 1.1, 0.005, '#3a2a20');
  }
  CARRY[kind] = B.build();
  return CARRY[kind];
}

// =====================================================================================
// looks & lines
// =====================================================================================
const SKIN = [0xf2d0b8, 0xe8c0a0, 0xd8a888, 0xc89878, 0xf6dccb, 0xe0b898];
const HAIR = [0x6b4a36, 0x3a2a22, 0xa0522d, 0xd8b070, 0x8a8a8a, 0xdcdcdc, 0x2a2a3a, 0x9a6a4a];
const LINEN = [0xefe4cc, 0xe0d2b4, 0xd8c8a8, 0xf2ead8];
const EARTH = [0x8a6a4a, 0x7a8a5a, 0x9a5a48, 0x6a7a8a, 0xa08a5a, 0x7a6a8a, 0xb89a70, 0x5a7a6a];
const PANTS = [0x5a4a3a, 0x6a5a48, 0x4a4a4a, 0x5a5048, 0x6b5a4a, 0x4a5a6a];
const SKIRTS = [0xb89a70, 0x9a6a5a, 0x7a8a9a, 0xc8a8a0, 0x8a9a6a, 0xa07a8a];

function peasantLook(female, role) {
  const L = { skin: pick(SKIN), hair: pick(HAIR), boots: pick([0x5a4636, 0x4a3a2e, 0x6a5040]), belt: 0x5a3c28, eyes: pick([0x4a5a8a, 0x5a4a3a, 0x4a6a4a]) };
  if (female) {
    Object.assign(L, { skirt: pick(SKIRTS), shirt: pick(LINEN), hairStyle: pick(['bun', 'braid', 'long']), apron: Math.random() < 0.5 ? pick(LINEN) : null });
    if (Math.random() < 0.4) L.hood = pick([0xe8dcc0, 0xc8a8a0, 0x9aa8b8]);
  } else {
    Object.assign(L, { shirt: Math.random() < 0.5 ? pick(LINEN) : pick(EARTH), pants: pick(PANTS), bulk: rr(0.95, 1.2) });
    if (Math.random() < 0.55) L.beard = L.hair;
    if (Math.random() < 0.15) L.stubble = true;
    const r = Math.random();
    if (r < 0.35) L.hat = pick([0xd8c490, 0xc8b078, 0xe0d0a0]);
    else if (r < 0.55) L.hood = pick([0x7a6a50, 0x6a7a5a, 0x8a7a6a]);
    else if (r < 0.65) { L.hairStyle = 'none'; }
  }
  if (role === 'pilgrim') { L.robe = pick([0x8a7a6a, 0xa09078, 0x7a6a5a]); L.hood = pick([0x8a7a6a, 0x6a5a4a]); L.weapon = 'staff'; L.weaponOpts = {}; L.hat = null; }
  if (role === 'pedlar') { L.shirt = pick([0xb84a4a, 0x4a7ab8, 0x8a5aa8]); L.hat = pick([0x6a4a8a, 0x3a5a3a, 0x8a3a3a]); L.sash = pick([0xf0c860, 0xe8e0d0]); }
  if (role === 'woodcutter') { L.weapon = 'axe'; L.shirt = pick([0x9a5a48, 0x6a7a5a, 0x8a6a4a]); L.bulk = rr(1.1, 1.25); L.hat = null; }
  if (Math.random() < 0.12 && !female) L.scale = rr(0.93, 0.98);
  return L;
}

const LINES = {
  walker: ['Доброго пути!', 'Мир тебе, путник.', 'День-то какой погожий.', 'Далеко ли до Медового Дола?', 'Эх, ноги мои, ноги...', 'Говорят, на дорогах опять пошаливают.', 'На ярмарку иду, может, продам чего.', 'Береги себя у леса, там волки.'],
  pilgrim: ['Свет да хранит тебя, странник.', 'Иду поклониться Сердцу Света.', 'Помолись за нас у алтаря.', 'Дорога длинна, да вера длиннее.'],
  pedlar: ['Нитки, иголки, ленты! Не нужно?', 'Товар лёгкий, дорога длинная.', 'Для тебя, добрый человек, — почти даром!', 'В Люменхолде нынче торговля бойкая.'],
  woodcutter: ['Дрова на зиму сами себя не нарубят.', 'Хороший топор — половина дела.', 'В Шепчущем лесу нынче тихо... слишком тихо.'],
  maid: ['Несу яблоки на рынок.', 'Ох, и корзинка тяжёлая!', 'Доброго денёчка!'],
  cart: ['Но-о, пошла, родимая!', 'Доброго пути, путник!', 'Везу мешки на мельницу к Гуго.', 'Сено нынче доброе, сухое.', 'Бочки для трактира — Гюнтер ждёт.', 'Эх, колесо скрипит, смазать бы...', 'Тпру... а, нет, это я не тебе.'],
  ox: ['Тише едешь — дальше будешь.', 'Цоб-цобе, рыжий!', 'Доброго пути! Мы не торопимся.'],
  blockWalk: ['Позволь пройти.', 'Ох, извини, добрый человек.', 'Разминёмся?'],
  blockCart: ['Дай проехать, добрый человек!', 'Посторонись, будь любезен!', 'Эй! Дорогу телеге!'],
  hitWalk: ['Помогите! Разбойник!', 'Не бей! Всё отдам!', 'Стража! Грабят!', 'За что?!'],
  hitCart: ['Н-но! Гони!', 'Разбой на дороге!', 'Пошла, пошла, выручай!', 'Стража! Грабят!'],
};

// =====================================================================================
// travellers
// =====================================================================================
class Traveller {
  constructor(sys) {
    this.sys = sys; this.game = sys.game;
    this.alive = true; this.visible = true; this.render = true;
    this.fearT = 0; this.down = 0; this.deathT = 0;
    this.waitT = 0; this.barkT = 3 + Math.random() * 8; this.blockT = 0; this.yieldT = 0; this.blockBarkT = 0;
    this.speed = 0; this.lat = 0; this.latT = 0; this.lat0 = 0;
    this.crimeCD = 0;
  }
  ground(x, z, from) { return this.game.collision.groundHeight(x, z, from + 3); }
  right() { const p = this.carrot.p; return { x: -p.tz, z: p.tx }; }
  // steer point = carrot + lateral offset to the traveller's side of the road
  aim(look, x, z) {
    let guard = 0;
    const c = this.carrot;
    // measure to the lane point and require it ahead along the road (else off-centre walkers spin in place)
    const off = () => ({ x: c.p.x - c.p.tz * this.lat, z: c.p.z + c.p.tx * this.lat });
    for (;;) {
      if (guard++ >= 40 || c.end) break;
      const o = off(), ddx = o.x - x, ddz = o.z - z;
      if (ddx * ddx + ddz * ddz >= look * look && ddx * c.p.tx + ddz * c.p.tz > look * 0.6) break;
      c.step(0.7);
    }
    const p = c.p;
    return { x: p.x - p.tz * this.lat, z: p.z + p.tx * this.lat };
  }
  // turn to flee from the player along the road
  fleeFrom(x, z) {
    const p = this.game.player.pos;
    const f = this.carrot.p;
    if ((p.x - x) * f.tx + (p.z - z) * f.tz > -2) this.carrot.reverse(x, z);
  }
  // obstacles ahead on the road: other travellers and mounted patrols
  ahead(x, z, fx, fz, reach, halfW) {
    let want = Infinity, yieldTo = false;
    for (const o of this.sys.list) {
      if (o === this || o.removed) continue;
      for (const q of o.bodies()) {
        const dx = q.x - x, dz = q.z - z;
        const fwd = dx * fx + dz * fz;
        if (fwd <= 0 || fwd > reach + q.r) continue;
        const lat = Math.abs(dx * fz - dz * fx);
        if (lat > halfW + q.r) continue;
        const oncoming = Math.sin(o.yaw) * fx + Math.cos(o.yaw) * fz < -0.3;
        if (oncoming) { yieldTo = true; if (fwd < q.r + 1.2) want = 0; continue; }
        want = Math.min(want, fwd < q.r + 1.4 ? 0 : o.speed * 0.95);
      }
    }
    for (const r of this.game.riders || []) {
      if (!r.path || !r.visible || r.dismounted) continue;
      const dx = r.pos.x - x, dz = r.pos.z - z;
      const fwd = dx * fx + dz * fz;
      if (fwd <= 0 || fwd > reach + 14) continue;
      const lat = Math.abs(dx * fz - dz * fx);
      if (lat > halfW + 2.2) continue;
      yieldTo = true;
      if (fwd < 3.5 && lat < halfW + 1) want = 0;
    }
    return { want, yieldTo };
  }
  barkNear(d, pool) {
    const g = this.game;
    this.barkT -= this._dt || 0;
    if (this.barkT > 0 || d > 6 || !this.render || this.down > 0 || this.fearT > 0 || g.mode !== 'play' || g.cine || (g._barkCD || 0) > g.time) return;
    this.barkT = 40 + Math.random() * 30;
    g._barkCD = g.time + 5;
    const line = Math.random() < 0.3 ? pickBark(g, this) : pick(pool);
    if (line) { g.ui.bark(this, line); if (Math.random() < 0.5) g.audio.vocal('hum', this.fem, 0.6); }
  }
}

class Walker extends Traveller {
  constructor(sys, role, carrot, lat) {
    super(sys);
    const g = this.game;
    this.kind = 'walker';
    this.role = role;
    const fem = role === 'maid' || (role === 'walker' && Math.random() < 0.45) || (role === 'pilgrim' && Math.random() < 0.35);
    this.fem = fem;
    this.look = peasantLook(fem, role);
    this.body = new Humanoid(this.look);
    this.root = this.body.root;
    const carry = role === 'pedlar' ? 'pack' : role === 'woodcutter' ? 'firewood' : role === 'maid' ? 'basket' : role === 'walker' && Math.random() < 0.6 ? (fem ? 'basket' : 'bundle') : role === 'pilgrim' ? 'bundle' : null;
    if (carry === 'basket') this.body.j.handL.add(carryTemplate('basket').clone());
    else if (carry) this.body.j.torso.add(carryTemplate(carry).clone());
    g.scene.add(this.root);
    this.name = { walker: fem ? 'Крестьянка' : 'Крестьянин', pilgrim: 'Паломник', pedlar: 'Коробейник', woodcutter: 'Дровосек', maid: 'Крестьянка' }[role];
    this.def = { named: false, traffic: true, name: this.name, look: this.look };
    this.radius = 0.4; this.height = 1.8 * (this.look.scale || 1);
    this.maxHp = 45; this.hp = this.maxHp;
    this.walk = rr(1.15, 1.45) * (role === 'pilgrim' ? 0.85 : 1);
    this.carrot = carrot;
    this.lat = this.latT = this.lat0 = lat;
    const p = carrot.p;
    this.pos = new THREE.Vector3(p.x - p.tz * lat, 0, p.z + p.tx * lat);
    this.pos.y = this.ground(this.pos.x, this.pos.z, g.terrain.getHeight(this.pos.x, this.pos.z) + 2);
    this.yaw = Math.atan2(p.tx, p.tz);
    this.sync();
  }
  roots() { return [this.root]; }
  bodies() { return [{ x: this.pos.x, z: this.pos.z, r: 0.45 }]; }

  takeHit(dmg) {
    const g = this.game;
    if (this.down > 0) return null;
    this.hp -= dmg;
    g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + this.height + 0.3, this.pos.z), dmg, 'enemy');
    this.body.anim.play('hit', 0.4);
    this.sys.crime(this);
    if (this.hp <= 0) {
      this.down = 28; this.deathT = 0; this.fearT = 0;
      g.ui.bark(this, '(падает без чувств)');
      if (Math.random() < 0.5) this.sys.dropLoot(this.pos, false);
      return { killed: true };
    }
    this.scare(12, true);
    return { hit: true };
  }

  scare(t, hurt = false) {
    if (this.down > 0) return;
    const first = this.fearT <= 0;
    this.fearT = Math.max(this.fearT, t);
    if (first) {
      this.fleeFrom(this.pos.x, this.pos.z);
      if (hurt || Math.random() < 0.5) this.game.ui.bark(this, pick(LINES.hitWalk));
      if (this.pos.distanceTo(this.game.player.pos) < 16) this.game.audio.vocal('gasp', this.fem);
    }
  }

  update(dt) {
    const g = this.game, P = g.player.pos;
    this._dt = dt;
    const dx = P.x - this.pos.x, dz = P.z - this.pos.z, pd = Math.hypot(dx, dz);
    if (this.down > 0) {
      this.down -= dt; this.deathT += dt;
      if (this.render) this.body.update(dt, { dead: this.down > 1.2, deathT: this.deathT, grounded: true });
      if (this.down <= 0) { this.hp = this.maxHp; this.deathT = 0; this.scare(10); }
      this.sync();
      return;
    }
    let want = this.walk, face = null;
    if (this.fearT > 0) { this.fearT -= dt; want = pd < 30 ? 4.3 : 2.2; }
    const tgt = this.aim(this.fearT > 0 ? 3 : 2.4, this.pos.x, this.pos.z);
    const tx = tgt.x - this.pos.x, tz = tgt.z - this.pos.z;
    face = Math.atan2(tx, tz);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    // end of the road: wait a moment, then head back (the system removes those out of sight)
    if (this.carrot.end && Math.hypot(tx, tz) < 1.2) {
      this.arrived = true;
      if (this.waitT <= 0) this.waitT = rr(3, 6);
    }
    if (this.waitT > 0) {
      this.waitT -= dt; want = 0;
      if (this.waitT <= 0 && this.carrot.end) { this.carrot.reverse(this.pos.x, this.pos.z); this.arrived = false; }
    }
    if (this.fearT <= 0) {
      // keep a gap behind slower folk, step to the verge for carts, patrols and the player
      const ob = this.ahead(this.pos.x, this.pos.z, fx, fz, 2.4, 0.5);
      want = Math.min(want, ob.want);
      if (ob.yieldTo) { this.latT = Math.sign(this.lat0) * 3.7; this.yieldT = 2.5; }
      const ahead = dx * fx + dz * fz, side = dx * fz - dz * fx;
      if (ahead > 0 && ahead < 4 && Math.abs(side) < 1.1 && !g.player.mount) {
        this.latT = this.lat + (side > 0 ? 1.5 : -1.5);
        this.latT = Math.max(-3.8, Math.min(3.8, this.latT));
        this.yieldT = 2.5;
        if (pd < 1.3) { want = 0; face = Math.atan2(dx, dz); }
        this.blockT += dt;
        if (this.blockT > 2 && this.blockBarkT <= 0 && g.mode === 'play') { this.blockBarkT = 25; g.ui.bark(this, pick(LINES.blockWalk)); }
      } else this.blockT = Math.max(0, this.blockT - dt);
      if (g.player.mount && ahead > 0 && ahead < 7 && Math.abs(side) < 2) { this.latT = Math.sign(this.lat0 || 1) * 3.8; this.yieldT = 3; }
      if (pd < 2.4 && this.speed < 0.3) face = Math.atan2(dx, dz);
    }
    this.blockBarkT -= dt;
    if (this.yieldT > 0) this.yieldT -= dt; else this.latT = this.lat0;
    this.lat = damp(this.lat, this.latT, 1.5, dt);
    this.barkNear(pd, LINES[this.role] || LINES.walker);
    this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-5 * dt));
    this.speed = damp(this.speed, want, 5, dt);
    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    this.pos.y = damp(this.pos.y, this.ground(this.pos.x, this.pos.z, this.pos.y), 12, dt);
    if (this.render) this.body.update(dt, { speed: this.speed, grounded: true, base: 'relaxed', lookAround: 0.6 });
    this.sync();
  }

  sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
  setRender(v) { this.render = v; this.root.visible = v; }
}

class Cart extends Traveller {
  constructor(sys, animal, carrot, lat) {
    super(sys);
    const g = this.game;
    this.kind = 'cart';
    this.animal = animal; // 'horse' | 'ox'
    this.ox = animal === 'ox';
    const v = {
      wood: pick(WOODS), canvas: pick(['#efe6d2', '#e2d6bc', '#e8dcc8', '#d8d0c0']), cushion: pick(['#9a4a4a', '#4a6a9a', '#6a8a4a', '#8a6a9a']),
      cargo: this.ox ? pick(['logs', 'hay', 'barrels', 'sacks']) : pick(['barrels', 'sacks', 'hay', 'cover', 'cover', 'produce']),
    };
    this.cargo = v.cargo;
    // cart body + wheels
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.root.add(sys.cartModel(this.ox ? 'ox' : 'wagon', v));
    this.wheels = [];
    const addWheel = (parent, x, z, r) => { const w = makeWheel(r); w.position.set(x, r, z); parent.add(w); this.wheels.push({ w, r, front: parent !== this.root }); };
    if (this.ox) {
      this.L = 3.4; this.rearR = 0.72;
      for (const sd of [-1, 1]) addWheel(this.root, sd * 0.98, 0, 0.72);
    } else {
      this.L = 2.0; this.rearR = 0.56;
      for (const sd of [-1, 1]) addWheel(this.root, sd * 0.8, -1.0, 0.56);
      this.front = new THREE.Group();
      this.front.position.set(0, 0, 1.0);
      this.front.add(sys.cartModel('axle', v));
      for (const sd of [-1, 1]) addWheel(this.front, sd * 0.78, 0, 0.46);
      this.root.add(this.front);
    }
    // draught animal
    if (this.ox) {
      this.beast = new Quadruped('cow', { body: pick([0x9a6a48, 0x7a5a44, 0xb08a64, 0x8a7a6a]), belly: 0xc8a888, spots: null, len: 1.6, h: 1.05, leg: 0.7, legR: 0.08 });
      this.beast.root.add(yokeTemplate().clone());
    } else {
      this.beast = new Equine({ coat: pick(['bay', 'chestnut', 'black', 'grey', 'palomino', 'bay']), saddle: false, bridleOnly: true, bridle: 0x4a3224, trim: 0xb89050, feather: Math.random() < 0.5, scale: rr(1.0, 1.08) });
      this.beast.root.add(harnessTemplate().clone());
    }
    g.scene.add(this.beast.root);
    g.scene.add(this.root);
    // driver on the bench
    const fem = Math.random() < 0.2;
    this.fem = fem;
    this.look = peasantLook(fem, 'walker');
    this.driver = new Humanoid(this.look);
    this.driver.j.handR.add(carryTemplate(this.ox ? 'goad' : 'whip').clone());
    this.seat = this.ox ? new THREE.Vector3(0, 1.615 - 0.47, 0.8) : new THREE.Vector3(0, 1.48 - 0.47, 1.05);
    this.driver.root.position.copy(this.seat);
    this.root.add(this.driver.root);
    this.name = fem ? 'Возница' : 'Возница';
    this.def = { named: false, traffic: true, name: this.name, look: this.look };
    this.radius = 1.3; this.height = 2.3;
    this.maxHp = 55; this.hp = this.maxHp;
    this.walk = this.ox ? rr(1.0, 1.2) : rr(1.6, 1.9);
    this.run = this.ox ? 2.8 : 5.8;
    this.carrot = carrot;
    this.lat = this.latT = this.lat0 = lat;
    // place the team on the road, the cart trailing behind
    const p = carrot.p;
    this.yaw = Math.atan2(p.tx, p.tz);
    this.apos = new THREE.Vector3(p.x - p.tz * lat, 0, p.z + p.tx * lat);
    this.apos.y = this.ground(this.apos.x, this.apos.z, g.terrain.getHeight(this.apos.x, this.apos.z) + 2);
    this.hitch = new THREE.Vector3(); this.axle = new THREE.Vector3();
    this.hitchPoint(this.hitch);
    this.axle.set(this.hitch.x - Math.sin(this.yaw) * this.L, 0, this.hitch.z - Math.cos(this.yaw) * this.L);
    this.pos = new THREE.Vector3();
    this.byaw = this.yaw;
    // the horse / ox can be struck too (it spooks)
    const self = this;
    this.beastProxy = {
      pos: this.apos, radius: 0.8, height: 2.0, alive: true, def: { named: false, traffic: true },
      takeHit(dmg) { return self.hitBeast(dmg); },
    };
    this.beastHp = this.ox ? 160 : 130;
    // player actions: rummage in the cargo, take the reins, unhitch and steal the horse
    this.acts = [
      { kind: 'cartLoot', pos: this.pos, r: 2.4, steal: true,
        active: () => !this.looted && !this.driven && !this.removed && this.render,
        label: () => `Обыскать повозку${this.sys.watchTag(this)}`,
        use: () => this.sys.stealCargo(this) },
      { kind: 'cartDrive', pos: this.pos, r: 2.6, steal: true,
        active: () => !this.driven && !this.removed && this.render && this.driverOff && !this.beastGone && !g.player.mount && !g.player.driving,
        label: () => `Сесть на козлы${this.sys.watchTag(this)}`,
        use: () => this.sys.takeCart(this) },
      { kind: 'cartHorse', pos: this.apos, r: 2.4, steal: true,
        active: () => !this.ox && !this.driven && !this.removed && this.render && !this.beastGone && !g.player.mount && !g.player.driving,
        label: () => `Выпрячь и угнать лошадь${this.sys.watchTag(this)}`,
        use: () => this.sys.stealHorse(this) },
    ];
    for (const a of this.acts) g.interact.dynamic.push(a);
    // reins from the driver's hands to the bit
    if (!this.ox) {
      const m = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
      this.reins = [0, 1].map(() => { const r = new THREE.Mesh(sys.reinGeo(), m); r.castShadow = false; g.scene.add(r); return r; });
    }
    this.kinematics(0);
  }
  roots() { return [this.root, this.beast.root, this.driverOff ? this.driver.root : null]; }
  bodies() {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    return [{ x: this.pos.x, z: this.pos.z, r: 1.5 }, { x: this.apos.x + fx * 0.3, z: this.apos.z + fz * 0.3, r: 1.1 }];
  }
  hitchPoint(out) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    // ox: the pole is pinned to the yoke on the neck; horse: the front axle sits rigidly behind on the shafts
    const k = this.ox ? 0.8 : -2.3;
    return out.set(this.apos.x + fx * k, 0, this.apos.z + fz * k);
  }

  takeHit(dmg, src, opts = {}) {
    const g = this.game;
    if (this.down > 0) return null;
    const at = opts.beast ? this.apos : this.pos;
    g.ui.damageNumber(new THREE.Vector3(at.x, at.y + (opts.beast ? 2.0 : 2.4), at.z), dmg, 'enemy');
    this.sys.crime(this);
    if (!opts.beast) {
      this.hp -= dmg;
      this.driver.anim.play('hit', 0.4);
      if (this.hp <= 0) { this.knockDown(); return { killed: true }; }
    } else if (!this.ox) this.beastRear = 0.9;
    this.scare(12, true);
    return { hit: true };
  }

  hitBeast(dmg) {
    const g = this.game;
    if (this.beastGone) return null;
    g.ui.damageNumber(new THREE.Vector3(this.apos.x, this.apos.y + 2.0, this.apos.z), dmg, 'enemy');
    this.sys.crime(this);
    this.beastHp -= dmg;
    if (this.beastHp <= 0) {
      this.beastGone = 'dead';
      this.beastProxy.alive = false;
      this.beast.root.rotation.z = Math.PI / 2;
      this.beast.root.position.y = this.apos.y + (this.ox ? 0.45 : 0.4);
      if (this.driven) this.sys.leaveCart(this);
      g.audio.play('snort');
      return { killed: true };
    }
    if (!this.ox) this.beastRear = 0.9;
    this.scare(12, true);
    return { hit: true };
  }

  scare(t, hurt = false) {
    if (this.down > 0 || this.driverOff) return;
    const first = this.fearT <= 0;
    this.fearT = Math.max(this.fearT, t);
    if (first) {
      this.fleeFrom(this.apos.x, this.apos.z);
      if (hurt || Math.random() < 0.6) this.game.ui.bark(this, pick(LINES.hitCart));
      if (this.pos.distanceTo(this.game.player.pos) < 18) { this.game.audio.vocal('gasp', this.fem); if (!this.ox) this.game.audio.play('horse', 0.7); }
      this.whipT = 0;
    }
  }

  // the driver tumbles off the bench onto the road; the team stops
  knockDown() {
    const g = this.game;
    this.down = 28; this.deathT = 0; this.fearT = 0;
    const d = this.driver.root;
    this.root.remove(d);
    const rx = Math.cos(this.byaw), rz = -Math.sin(this.byaw);
    const side = (g.player.pos.x - this.pos.x) * rx + (g.player.pos.z - this.pos.z) * rz > 0 ? -1 : 1;
    const x = this.pos.x + rx * side * 1.5, z = this.pos.z + rz * side * 1.5;
    d.position.set(x, this.ground(x, z, this.pos.y + 1), z);
    d.rotation.set(0, this.byaw + side * Math.PI / 2, 0);
    g.scene.add(d);
    this.driverOff = true;
    this.beastProxy.alive = false;
    g.ui.bark(this, '(падает с козел без чувств)');
    if (Math.random() < 0.75) this.sys.dropLoot(d.position, true);
  }

  getUp() {
    const d = this.driver.root;
    if (this.driven || this.beastGone) { this.down = 0; this.game.ui.bark(this, 'Грабят! Стража!'); d.visible = false; return; }
    this.game.scene.remove(d);
    d.position.copy(this.seat); d.rotation.set(0, 0, 0);
    this.root.add(d);
    this.driverOff = false;
    this.beastProxy.alive = true;
    this.hp = this.maxHp; this.deathT = 0;
    this.scare(12);
  }

  update(dt) {
    const g = this.game, P = g.player.pos;
    this._dt = dt;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const dx = P.x - this.apos.x, dz = P.z - this.apos.z, pd = Math.hypot(dx, dz);
    let want = this.walk, face = this.yaw;
    if (this.driverOff && this.down > 0 && (this.driven || this.beastGone)) {
      this.down -= dt; this.deathT += dt;
      if (this.render && this.driver.root.visible) this.driver.update(dt, { dead: this.down > 1.2, deathT: this.deathT, grounded: true });
      if (this.down <= 0) this.getUp();
    }
    if (this.beastGone) {
      want = 0; this.speed = 0;
      if (this.render && !this.driverOff) this.driver.update(dt, { sit: true, grounded: true, base: 'relaxed', speed: 0, lookAround: 1, upperOnly: true });
      return;
    }
    if (this.driven) {
      // the player holds the reins: W drives on (Shift = faster), A/D steer
      const input = g.input, play = g.mode === 'play' && !g.cine;
      want = 0;
      if (play && input.key('KeyW')) want = (input.key('ShiftLeft') || input.key('ShiftRight')) ? this.run : this.walk * 1.8;
      const steer = play ? (input.key('KeyA') ? 1 : 0) - (input.key('KeyD') ? 1 : 0) : 0;
      face = this.yaw + steer * 0.9;
      this.fearT = 0;
    } else if (this.down > 0) {
      this.down -= dt; this.deathT += dt;
      want = 0;
      if (this.render) this.driver.update(dt, { dead: this.down > 1.2, deathT: this.deathT, grounded: true });
      if (this.down <= 0) this.getUp();
    } else {
      if (this.fearT > 0) {
        this.fearT -= dt; want = this.run;
        // the driver lashes the team on
        this.whipT = (this.whipT || 0) - dt;
        if (this.whipT <= 0) {
          this.whipT = rr(1.2, 2.2);
          this.driver.anim.play('heavy', 0.55);
          if (this.render && pd < 30) setTimeout(() => g.audio.noise(0.06, { vol: 0.22, freq: 3200, q: 1.2 }), 260);
        }
      }
      const tgt = this.aim(this.fearT > 0 ? 6 : 5, this.apos.x, this.apos.z);
      const tx = tgt.x - this.apos.x, tz = tgt.z - this.apos.z;
      face = Math.atan2(tx, tz);
      if (this.carrot.end && Math.hypot(tx, tz) < 2) { this.arrived = true; if (this.waitT <= 0) this.waitT = rr(4, 7); }
      if (this.waitT > 0) {
        this.waitT -= dt; want = 0;
        if (this.waitT <= 0 && this.carrot.end) { this.carrot.reverse(this.apos.x, this.apos.z); this.arrived = false; }
      }
      if (this.fearT <= 0) {
        const ob = this.ahead(this.apos.x + fx * 1.0, this.apos.z + fz * 1.0, fx, fz, 4.5, 1.0);
        want = Math.min(want, ob.want);
        if (ob.yieldTo) { this.latT = Math.sign(this.lat0 || 1) * 3.2; this.yieldT = 3; want = Math.min(want, this.walk * 0.6); }
        // the player in the way: stop, call out, after a while go round
        const ax = dx - fx * 1.0, az = dz - fz * 1.0;
        const ahead = ax * fx + az * fz, side = ax * fz - az * fx;
        if (ahead > -0.5 && ahead < 4.2 && Math.abs(side) < 1.5) {
          want = 0;
          this.blockT += dt;
          if (this.blockT > 2.2 && this.blockBarkT <= 0 && g.mode === 'play') { this.blockBarkT = 20; g.ui.bark(this, pick(LINES.blockCart)); }
          if (this.blockT > 6) { this.latT = Math.max(-3.4, Math.min(3.4, this.lat + (side > 0 ? -2.6 : 2.6))); this.yieldT = 4; }
        } else this.blockT = Math.max(0, this.blockT - dt * 0.5);
      }
      this.blockBarkT -= dt;
      if (this.yieldT > 0) this.yieldT -= dt; else if (this.fearT <= 0) this.latT = this.lat0;
      this.lat = damp(this.lat, this.latT, 1.0, dt);
      this.barkNear(Math.hypot(P.x - this.pos.x, P.z - this.pos.z), this.ox ? LINES.ox.concat(LINES.cart.slice(1, 4)) : LINES.cart);
    }
    // the team: turn rate limited like a real draught animal
    this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-(this.fearT > 0 ? 2.4 : 1.6) * dt));
    this.speed = damp(this.speed, want, want > this.speed ? 1.6 : 3, dt);
    this.apos.x += Math.sin(this.yaw) * this.speed * dt;
    this.apos.z += Math.cos(this.yaw) * this.speed * dt;
    this.apos.y = damp(this.apos.y, this.ground(this.apos.x, this.apos.z, this.apos.y), 10, dt);
    this.kinematics(dt);
    if (this.render) {
      const st = { speed: this.speed, graze: this.down > 0 && this.speed < 0.1, rear: this.beastRear > 0 };
      this.beast.update(dt, st);
      if (!this.driverOff) {
        this.driver.update(dt, { sit: true, grounded: true, base: 'relaxed', speed: 0, lookAround: 0.8, upperOnly: true });
        if (!this.driver.anim.action) {
          // hands forward on the reins
          const J = this.driver.j;
          J.shL.rotation.set(-0.75, 0, 0.12); J.elL.rotation.set(-0.95, 0, 0);
          J.shR.rotation.set(-0.7, 0, -0.12); J.elR.rotation.set(-1.0, 0, 0);
          J.handR.rotation.set(0.4, 0, 0);
        }
      }
    }
    if (this.beastRear > 0) this.beastRear -= dt;
  }

  // trailer kinematics: the hitch follows the animal, the rear axle trails the hitch
  kinematics(dt) {
    const oldAx = this.axle.x, oldAz = this.axle.z, oldHx = this.hitch.x, oldHz = this.hitch.z;
    const H = this.hitchPoint(this.hitch);
    let dx = H.x - this.axle.x, dz = H.z - this.axle.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    this.axle.x = H.x - dx * this.L; this.axle.z = H.z - dz * this.L;
    this.byaw = Math.atan2(dx, dz);
    const hA = this.ground(this.axle.x, this.axle.z, this.apos.y + 1);
    const hH = this.ground(H.x, H.z, this.apos.y + 1);
    const pitch = -Math.atan2(hH - hA, this.L);
    if (this.ox) {
      // model origin under the axle; the hit centre is the middle of the bed
      this.root.position.set(this.axle.x, hA, this.axle.z);
      this.pos.set(this.axle.x - dx * 0.1, hA, this.axle.z - dz * 0.1);
    } else {
      // model origin halfway between the axles (the wheelbase is L)
      this.pos.set((this.axle.x + H.x) / 2, (hA + hH) / 2, (this.axle.z + H.z) / 2);
      this.root.position.copy(this.pos);
    }
    this.root.rotation.set(Math.max(-0.35, Math.min(0.35, pitch)), this.byaw, 0);
    if (this.front) this.front.rotation.y = angleDiff(this.byaw, this.yaw);
    // wheels roll with the distance their axle travelled
    if (dt > 0) {
      const sr = (this.axle.x - oldAx) * dx + (this.axle.z - oldAz) * dz;
      const sf = (this.hitch.x - oldHx) * Math.sin(this.yaw) + (this.hitch.z - oldHz) * Math.cos(this.yaw);
      for (const w of this.wheels) w.w.rotation.x += (w.front ? sf : sr) / w.r;
    }
    this.beast.root.position.copy(this.apos);
    this.beast.root.rotation.y = this.yaw;
  }

  // reins drawn between the driver's hands and the bit (only close to the camera)
  updateReins(show) {
    if (!this.reins) return;
    const on = show && !this.driverOff && this.render;
    for (const r of this.reins) r.visible = on;
    if (!on) return;
    this.root.updateMatrixWorld(true);
    this.beast.root.updateMatrixWorld(true);
    const J = this.driver.j;
    [J.handL, J.handR].forEach((h, i) => {
      const a = h.getWorldPosition(_v);
      const b = this.beast.head.localToWorld(_w.set(i ? -0.1 : 0.1, -0.12, 0.42));
      const r = this.reins[i];
      const dir = b.clone().sub(a);
      const len = dir.length();
      r.position.copy(a).addScaledVector(dir, 0.5);
      r.position.y -= Math.min(0.25, len * 0.04);
      r.quaternion.setFromUnitVectors(_up, dir.normalize());
      r.scale.set(1, len, 1);
    });
  }

  setRender(v) {
    this.render = v;
    this.root.visible = v;
    this.beast.root.visible = v;
    if (this.driverOff) this.driver.root.visible = v;
    if (!v && this.reins) for (const r of this.reins) r.visible = false;
  }

  pushPlayer() {
    const g = this.game, p = g.player;
    if (p.mount || p.state === 'dead' || !this.render) return;
    const P = p.pos;
    if (Math.abs(P.y - this.pos.y) > 2.2) return;
    // cart bed as an oriented box
    const c = Math.cos(this.byaw), s = Math.sin(this.byaw);
    const cz = this.ox ? -0.1 : 0, hz = (this.ox ? 1.25 : 1.55) + 0.35, hx = (this.ox ? 1.1 : 0.95) + 0.35;
    const ox = this.ox ? this.axle.x : this.root.position.x, oz = this.ox ? this.axle.z : this.root.position.z;
    let dx = P.x - ox, dz = P.z - oz;
    let lx = dx * c - dz * s, lz = dx * s + dz * c - cz;
    if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
      if (hx - Math.abs(lx) < hz - Math.abs(lz)) lx = Math.sign(lx || 1) * hx; else lz = Math.sign(lz || 1) * hz;
      lz += cz;
      P.x = ox + lx * c + lz * s; P.z = oz - lx * s + lz * c;
    }
    // the animal: two circles along its body
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    for (const k of [-0.6, 0.55]) {
      const cx = this.apos.x + fx * k, cz2 = this.apos.z + fz * k;
      const ex = P.x - cx, ez = P.z - cz2, d = Math.hypot(ex, ez), R = (this.ox ? 0.55 : 0.5) + 0.35;
      if (d < R && d > 1e-4) { P.x = cx + (ex / d) * R; P.z = cz2 + (ez / d) * R; }
    }
  }
}

// =====================================================================================
// the traffic system
// =====================================================================================
export class Traffic {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.loot = [];
    this.spawnT = 4;
    this.models = new Map();
  }

  cartModel(kind, v) {
    const key = kind === 'axle' ? 'axle' + v.wood : kind + '|' + v.cargo + '|' + v.wood + '|' + v.canvas + '|' + v.cushion;
    let m = this.models.get(key);
    if (!m) {
      m = kind === 'axle' ? buildFrontAxle(v) : kind === 'ox' ? buildOxCart(v) : buildWagon(v);
      this.models.set(key, m);
    }
    return m.clone();
  }
  reinGeo() { return this._rein || (this._rein = new THREE.CylinderGeometry(0.008, 0.008, 1, 4, 1)); }

  // how many travellers the roads carry right now
  target() {
    const g = this.game;
    if (g.sky.isNight()) return 1;
    let n = (g.q?.charDist || 120) < 90 ? 3 : 5;
    if (g.weather?.kind === 'rain' || g.weather?.kind === 'storm') n -= 2;
    return Math.max(1, n);
  }

  // hittables for the player's blows and arrows (only close ones)
  addHittables(hl) {
    const p = this.game.player.pos;
    for (const t of this.list) {
      if (t.down > 0 || !t.visible) continue;
      const d = Math.abs(t.pos.x - p.x) + Math.abs(t.pos.z - p.z);
      if (t.kind === 'cart') {
        if (d < 14) hl.push(t);
        if (Math.abs(t.apos.x - p.x) + Math.abs(t.apos.z - p.z) < 10) hl.push(t.beastProxy);
      } else if (d < 9) hl.push(t);
    }
  }

  update(dt) {
    const g = this.game;
    const pp = g.player.pos, cp = g.camera.position;
    const CD = g.q?.charDist || 120;
    this.spawner(dt, CD);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      const d = Math.abs(t.pos.x - pp.x) + Math.abs(t.pos.z - pp.z);
      const dc = Math.hypot(t.pos.x - cp.x, t.pos.z - cp.z);
      // despawn: far away, or arrived at a road end out of sight, or too many at night
      const seen = dc < CD + 10 && this.inView(t.pos, 6);
      const fleeing = t.fearT > 0 || t.down > 0 || t.driven;
      if (d > 320 || (d > 220 && !seen && !fleeing) || (t.arrived && !seen && !fleeing) || (this.list.length > this.target() + 1 && dc > CD + 20 && !fleeing)) { this.remove(t); this.list.splice(i, 1); continue; }
      t.visible = d < 240;
      t.setRender(t.visible && dc < CD * (t.kind === 'cart' ? 1.25 : 1));
      g.charShadow(t, dc, ...t.roots());
      const st = g.charStep(t, Math.min(dc, d), dt);
      if (st >= 0) t.update(st);
      if (t.kind === 'cart') {
        if (d < 10) t.pushPlayer();
        t.updateReins(dc < 45);
      }
    }
    // unclaimed bundles rot away after a while
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const it = this.loot[i];
      it.ttl -= dt;
      if (it.ttl <= 0 || it.taken) { this.removeLoot(it); this.loot.splice(i, 1); }
    }
  }

  inView(pos, r) {
    const g = this.game;
    if (!g._lodFr) return false;
    const s = this._sph || (this._sph = new THREE.Sphere());
    s.center.set(pos.x, pos.y + 1.2, pos.z); s.radius = r;
    return g._lodFr.intersectsSphere(s);
  }

  spawner(dt, CD) {
    const g = this.game;
    if (g.mode !== 'play' || g.cine || g.duel) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = rr(2.5, 5);
    if (this.list.length >= this.target()) return;
    const G = roadGraph();
    if (!G.edges.length) return;
    const P = g.player.pos;
    const tmp = {};
    for (let tries = 0; tries < 14; tries++) {
      let r = Math.random() * G.total, e = G.edges[0];
      for (const ed of G.edges) { if (r < ed.len) { e = ed; break; } r -= ed.len; }
      const s = Math.random() * e.len;
      const p = edgePoint(e, s, tmp);
      const d = Math.hypot(p.x - P.x, p.z - P.z);
      if (d < 50 || d > CD + 70) continue;
      const y = g.terrain.getHeight(p.x, p.z);
      if (d < CD + 8 && this.inView({ x: p.x, y, z: p.z }, 5)) continue;
      if (this.list.some((t) => Math.abs(t.pos.x - p.x) + Math.abs(t.pos.z - p.z) < 22)) continue;
      // most travellers come the player's way, so they are actually met
      const towards = (P.x - p.x) * p.tx + (P.z - p.z) * p.tz > 0 ? 1 : -1;
      const dir = Math.random() < 0.65 ? towards : -towards;
      this.spawnAt(e, s, dir);
      return;
    }
  }

  // dev/test: spawn a given kind ('horse' | 'ox' | a walker role) on the road nearest to (x, z)
  debugSpawn(kind, x, z, dir = 1) {
    let best = null, bd = 1e9;
    for (const e of roadGraph().edges) { const s = edgeProject(e, x, z), p = edgePoint(e, s); const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { e, s }; } }
    if (!best) return null;
    this.spawnAt(best.e, best.s, dir, kind);
    return this.list[this.list.length - 1];
  }

  spawnAt(e, s, dir, force = null) {
    const carts = this.list.filter((t) => t.kind === 'cart').length;
    const r = Math.random();
    const side = 1; // everyone keeps to the right-hand side of the road
    if (force ? force === 'horse' || force === 'ox' : r < 0.42 && carts < 2) {
      const c = new Cart(this, force ? force : Math.random() < 0.3 ? 'ox' : 'horse', new Carrot(e, s, dir), side * 1.5);
      this.list.push(c);
      return;
    }
    const role = force || pick(['walker', 'walker', 'walker', 'pilgrim', 'pedlar', 'woodcutter', 'maid']);
    const w = new Walker(this, role, new Carrot(e, s, dir), side * rr(2.7, 3.2));
    this.list.push(w);
    // company on the road: a second traveller a little behind
    if (Math.random() < 0.35 && !force) {
      const c2 = new Carrot(e, s, dir);
      c2.step(-1.9);
      const w2 = new Walker(this, role === 'pedlar' || role === 'woodcutter' ? 'walker' : role, c2, side * rr(2.4, 3.4));
      w2.walk = w.walk;
      this.list.push(w2);
    }
  }

  remove(t) {
    const g = this.game;
    for (const a of t.acts || []) { const i = g.interact.dynamic.indexOf(a); if (i >= 0) g.interact.dynamic.splice(i, 1); }
    t.removed = true; t.visible = false; t.alive = false;
    if (t.beastProxy) t.beastProxy.alive = false;
    const dispose = (root) => {
      if (!root) return;
      g.scene.remove(root);
      root.parent?.remove(root);
      root.traverse((m) => { if (m.isSkinnedMesh) { m.geometry.dispose(); m.skeleton?.dispose?.(); } });
    };
    // rigged bodies own their merged geometry; wagon parts, harness and carried props are shared templates
    if (t.kind === 'cart') {
      dispose(t.driver.root);
      if (t.beastGone !== 'stolen') dispose(t.beast.root);
      for (const r of t.reins || []) g.scene.remove(r);
      g.scene.remove(t.root);
    } else dispose(t.root);
  }

  // an attack on a traveller: a crime; mounted knight patrols nearby ride in, guards in sight turn hostile
  crime(victim) {
    const g = this.game;
    if (victim.crimeCD > g.time) { this.panic(victim.pos, 26, victim); return; }
    victim.crimeCD = g.time + 4;
    const p = g.player.pos;
    const knights = (g.riders || []).filter((r) => r.human && r.o?.look?.armor && !r.dismounted && r.visible && Math.hypot(r.pos.x - p.x, r.pos.z - p.z) < 48);
    if (knights.length) {
      g.tutorial?.show('crime');
      knights.forEach((r, i) => {
        r.dismounted = true;
        r.human.root.visible = false;
        r.path = null; r.maxSpeed = 0; r.speed = 0;
        g.spawnHostileKnight(r);
        if (i === 0) { g.ui.bark(r, 'Разбой на королевской дороге! Стоять!'); g.audio.vocal('shout', false); }
      });
      for (const n of g.npcs) if (n.visible && !n.def.guard && n.pos.distanceTo(p) < 18) n.scare(8 + Math.random() * 6);
      g.crimeHeat(25, true);
    } else g.onCivilianHit({ def: { guard: false, traffic: true }, pos: victim.pos });
    this.panic(victim.pos, 26, victim);
  }

  panic(pos, r, except) {
    for (const t of this.list) {
      if (t === except || t.down > 0) continue;
      if (Math.abs(t.pos.x - pos.x) + Math.abs(t.pos.z - pos.z) < r) t.scare(8 + Math.random() * 5);
    }
  }

  dropLoot(pos, rich) {
    const g = this.game;
    const pool = rich ? [['bread', 2], ['apple', 3], ['cheese', 1], ['honey', 1], ['ham', 1], ['wine', 1]] : [['bread', 1], ['apple', 2], ['cheese', 1], ['berries', 1]];
    const items = [];
    const n = rich ? 2 : 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) { const it = pick(pool); if (!items.some((x) => x[0] === it[0])) items.push(it); }
    const gold = Math.random() < (rich ? 0.8 : 0.55) ? Math.floor(rr(rich ? 8 : 3, rich ? 26 : 12)) : 0;
    const mesh = bundleTemplate().clone();
    const x = pos.x + rr(-0.6, 0.6), z = pos.z + rr(-0.6, 0.6);
    const p = new THREE.Vector3(x, g.collision.groundHeight(x, z, pos.y + 2), z);
    mesh.position.copy(p);
    mesh.rotation.y = Math.random() * 6;
    g.scene.add(mesh);
    const self = this;
    const it = {
      kind: 'trafficLoot', pos: p, r: 1.7, steal: true, mesh, ttl: 150,
      label: () => 'Подобрать оброненный узелок',
      use() {
        if (it.taken) return;
        it.taken = true;
        for (const [id, k] of items) g.giveItem(id, k);
        if (gold) g.addGold(gold);
        self.removeLoot(it);
      },
    };
    g.interact.dynamic.push(it);
    this.loot.push(it);
  }

  removeLoot(it) {
    const g = this.game;
    g.scene.remove(it.mesh);
    const i = g.interact.dynamic.indexOf(it);
    if (i >= 0) g.interact.dynamic.splice(i, 1);
  }

  // ---------- theft from travellers ----------
  witness(t) {
    const g = this.game, P = g.player.pos;
    if (t && !t.driverOff && !(t.down > 0)) {
      const y = t.byaw ?? t.yaw, dx = P.x - t.pos.x, dz = P.z - t.pos.z;
      const behind = dx * Math.sin(y) + dz * Math.cos(y) < -0.8;
      if (!behind || Math.hypot(dx, dz) < 1.6) return t;
    }
    for (const o of this.list) {
      if (o === t || o.removed || o.down > 0 || o.fearT > 0 || !o.visible) continue;
      if (Math.hypot(o.pos.x - P.x, o.pos.z - P.z) < 9) return o;
    }
    return g.npcs.find((n) => g.npcNotices(n)) || null;
  }
  watchTag(t) {
    if (!((t._wT || 0) > this.game.time)) { t._wT = this.game.time + 0.25; t._w = this.witness(t); }
    return t._w ? ` · вас видит ${t._w.name || 'путник'}` : ' · никто не видит';
  }
  caught(w, price) {
    const g = this.game;
    const fine = Math.min(g.state.gold, 15 + Math.round(price * 0.5));
    const line = pick(['Эй! Это моё добро!', 'Вор! Держи вора!', 'Руки прочь от телеги!', 'Стража! Грабят!']);
    g.ui.notify(`<b>${w.name || 'Путник'}:</b> «${line}»`);
    if (w.pos && w.def) g.ui.bark(w, line);
    if (fine > 0) { g.state.gold -= fine; g.ui.hint(`Вас поймали на краже. Штраф: ${fine} золотых.`); }
    else g.ui.hint('Вас поймали на краже.');
    g.state.stats.thefts = (g.state.stats.thefts || 0) + 1;
    g.audio.play('ui');
  }
  stealCargo(t) {
    const g = this.game;
    const w = this.witness(t);
    if (w) { this.caught(w, 30); return; }
    t.looted = true;
    const pool = { barrels: [['wine', 2]], sacks: [['bread', 3], ['apple', 4]], hay: [['apple', 2]], cover: [['cheese', 2], ['honey', 1], ['bread', 2]], produce: [['apple', 5], ['cheese', 2]], logs: [['iron_ore', 1]] }[t.cargo] || [['bread', 2]];
    for (const [id, n] of pool) g.giveItem(id, n);
    if (Math.random() < 0.6) g.addGold(Math.floor(rr(8, 30)));
  }
  takeCart(t) {
    const g = this.game;
    const w = this.witness(t);
    if (w) { this.caught(w, 80); return; }
    t.driven = true;
    g.player.driving = t;
    g.ui.hint('W — вперёд, Shift — быстрее, A/D — поворот, E — сойти');
  }
  leaveCart(t) {
    const p = this.game.player;
    if (p.driving !== t) return;
    t.driven = false;
    p.driving = null;
    const rx = Math.cos(t.byaw), rz = -Math.sin(t.byaw);
    p.setPosition(t.pos.x + rx * 1.8, t.pos.y + 0.5, t.pos.z + rz * 1.8, t.byaw);
  }
  stealHorse(t) {
    const g = this.game;
    const w = this.witness(t);
    if (w) { this.caught(w, 150); return; }
    t.beastGone = 'stolen';
    t.beastProxy.alive = false;
    for (const r of t.reins || []) r.visible = false;
    const body = t.beast;
    body.root.position.copy(t.apos);
    body.root.rotation.set(0, t.yaw, 0);
    const horse = new Mount(g, { body, name: 'Лошадь' });
    registerHorse(g, horse);
    g.player.mountUp(horse);
  }

  // nothing of the traffic survives a load / new game / return to the title
  clear() {
    const g = this.game;
    if (g.player?.driving) { g.player.driving.driven = false; g.player.driving = null; }
    for (const h of g.horses || []) { h.rider = null; g.scene.remove(h.body.root); const i = g.interact.dynamic.indexOf(h._act); if (i >= 0) g.interact.dynamic.splice(i, 1); }
    if (g.horses) g.horses.length = 0;
    for (const t of this.list) this.remove(t);
    this.list.length = 0;
    for (const it of this.loot) this.removeLoot(it);
    this.loot.length = 0;
    this.spawnT = 3;
  }

  // hidden travellers skip the per-frame world-matrix pass
  syncMatrices() {
    for (const t of this.list) for (const r of t.roots()) if (r) r.matrixWorldAutoUpdate = r.visible;
  }
}

// a horse the player may ride (stolen)
export function registerHorse(g, horse) {
  (g.horses || (g.horses = [])).push(horse);
  horse._act = {
    kind: 'mount', pos: horse.pos, r: 2.8,
    active: () => horse.alive && !g.player.mount && !g.player.driving,
    label: () => `Оседлать: ${horse.name}`,
    use: () => g.player.mountUp(horse),
  };
  g.interact.dynamic.push(horse._act);
}
