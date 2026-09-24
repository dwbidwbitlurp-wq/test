import * as THREE from 'three';
import { Simplex2, clamp, lerp, smoothstep, distToSegment2 } from '../engine/noise.js';
import {
  WORLD, CASTLE, CRAG, LAKE, VILLAGE, CAMP, FOREST, MEADOW, ROADS, HERMIT, RUINS, RIVER,
} from './layout.js';

const noise = new Simplex2(1337);
const noise2 = new Simplex2(4242);

const PEAKS = (() => {
  const out = [];
  let seed = 77;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.12;
    const rr = 690 + rnd() * 230;
    out.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, h: 110 + rnd() * rnd() * 300, w: 70 + rnd() * 80 });
  }
  return out;
})();

function rawHeight(x, z) {
  let h = 13 + noise.fbm(x * 0.0028, z * 0.0028, 4) * 17 + noise.fbm(x * 0.013, z * 0.013, 3) * 2.6;
  // soft hills in the south-east
  h += Math.max(0, noise2.fbm(x * 0.005 + 10, z * 0.005, 3)) * 14;
  // keep dry land above the water line (smooth floor)
  const floor = WORLD.water + 2.5;
  if (h < floor + 3) h = floor + 3 * Math.exp((h - floor - 3) / 3);
  // mountain ring: rounded majestic peaks + soft foothills + fine rocky detail
  const r = Math.sqrt(x * x + z * z) + noise2.noise(x * 0.004, z * 0.004) * 50;
  const m = smoothstep(545, 780, r);
  if (m > 0) {
    let peak = 0;
    for (const P of PEAKS) {
      const dx = x - P.x, dz = z - P.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > P.w * P.w * 9) continue;
      const k = P.h * Math.exp(-d2 / (P.w * P.w));
      peak = Math.max(peak, k) + Math.min(peak, k) * 0.25;
    }
    const foot = 40 + noise.fbm(x * 0.003, z * 0.003, 3) * 30;
    const detail = noise.ridged(x * 0.012, z * 0.012, 2) * 14 + noise.fbm(x * 0.03, z * 0.03, 2) * 3;
    h += m * (foot + peak * m + detail * Math.min(1, peak / 80 + 0.3));
  }
  return h;
}

function lakeFactor(x, z) {
  const dx = (x - LAKE.x) / LAKE.rx;
  const dz = (z - LAKE.z) / LAKE.rz;
  return Math.sqrt(dx * dx + dz * dz) + noise2.noise(x * 0.012, z * 0.012) * 0.07;
}

function heightNoRoads(x, z) {
  let h = rawHeight(x, z);
  // castle plateau
  {
    const dx = x - CASTLE.x, dz = z - CASTLE.z;
    const d = Math.sqrt(dx * dx + dz * dz) + noise.noise(x * 0.03, z * 0.03) * 4;
    const w = 1 - smoothstep(108, 132, d);
    if (w > 0) h = lerp(h, CASTLE.y, w);
  }
  // twilight crag plateau
  {
    const dx = x - CRAG.x, dz = z - CRAG.z;
    const d = Math.sqrt(dx * dx + dz * dz) + noise.noise(x * 0.04, z * 0.04) * 5;
    const w = 1 - smoothstep(CRAG.r, CRAG.r + 30, d);
    if (w > 0) h = lerp(h, CRAG.y, w);
  }
  // flattened village / camp / hermit / ruins
  for (const p of FLATS) {
    const dx = x - p.x, dz = z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const w = 1 - smoothstep(p.r, p.r + 25, d);
    if (w > 0) h = lerp(h, p.h, w);
  }
  // river channel
  if (RIVER_SEGS.length) {
    const rv = riverInfo(x, z);
    if (rv.d < RIVER.width * 0.5 + 7) {
      const w = 1 - smoothstep(RIVER.width * 0.35, RIVER.width * 0.5 + 7, rv.d);
      h = lerp(h, Math.min(h, rv.bed), w);
    }
  }
  // lake
  const lf = lakeFactor(x, z);
  if (lf < 1.1) {
    const s = smoothstep(1.1, 0.8, lf);
    const bottom = WORLD.water - 1.5 - 13 * smoothstep(0.85, 0.2, lf);
    h = lerp(h, Math.min(h, bottom), s);
  }
  return h;
}

// river: precompute bed heights before carving
const RIVER_SEGS = [];
export function riverInfo(x, z) {
  let best = 1e9, bed = 0, water = 0, t = 0, seg = null;
  for (const s of RIVER_SEGS) {
    if (x < s.minx || x > s.maxx || z < s.minz || z > s.maxz) continue;
    const r = distToSegment2(x, z, s.ax, s.az, s.bx, s.bz);
    if (r.d < best) { best = r.d; water = lerp(s.wa, s.wb, r.t); bed = water - 1.3; t = r.t; seg = s; }
  }
  return { d: best, bed, water, seg, t };
}
function initRiver() {
  const up = RIVER.upper, lo = RIVER.lower;
  const upY = CASTLE.y - 0.35;
  const pts = up.map((p) => ({ ...p, w: upY }));
  let prev = Infinity;
  const lows = lo.map((p, i) => {
    let hh = Math.min(prev - 0.4, heightNoRoads(p.x, p.z) - 0.3);
    if (i === lo.length - 1) hh = WORLD.water;
    hh = Math.max(WORLD.water, hh);
    prev = hh;
    return { ...p, w: hh };
  });
  // smooth monotonic descent to the lake
  for (let i = 1; i < lows.length; i++) lows[i].w = Math.min(lows[i].w, lows[i - 1].w - 0.3);
  const all = pts.concat(lows);
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i], b = all[i + 1];
    RIVER_SEGS.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, wa: a.w, wb: b.w, cascade: i === pts.length - 1,
      minx: Math.min(a.x, b.x) - 16, maxx: Math.max(a.x, b.x) + 16, minz: Math.min(a.z, b.z) - 16, maxz: Math.max(a.z, b.z) + 16 });
  }
  RIVER_POINTS.push(...all);
}
export const RIVER_POINTS = [];

const FLATS = [];
function initFlats() {
  const list = [
    { x: VILLAGE.x, z: VILLAGE.z, r: VILLAGE.r },
    { x: CAMP.x, z: CAMP.z, r: CAMP.r },
    { x: HERMIT.x, z: HERMIT.z, r: 18 },
    { x: RUINS.x, z: RUINS.z, r: 42 },
    { x: 34, z: 470, r: 14 },
  ];
  for (const p of list) FLATS.push({ ...p, h: Math.max(WORLD.water + 3, rawHeight(p.x, p.z)) });
}
initFlats();
initRiver();

// Precompute road segment heights
const ROAD_SEGS = [];
function initRoads() {
  for (const road of ROADS) {
    const pts = road.map((p) => ({ x: p.x, z: p.z, h: p.h !== undefined ? p.h : Math.max(WORLD.water + 1.5, heightNoRoads(p.x, p.z)) }));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      ROAD_SEGS.push({
        ax: a.x, az: a.z, bx: b.x, bz: b.z, ha: a.h, hb: b.h,
        minx: Math.min(a.x, b.x) - 20, maxx: Math.max(a.x, b.x) + 20,
        minz: Math.min(a.z, b.z) - 20, maxz: Math.max(a.z, b.z) + 20,
      });
    }
  }
}
initRoads();

const ROAD_HALF = 4.2;

// returns {d, h} nearest road info
export function roadInfo(x, z) {
  let best = 1e9, bh = 0;
  for (const s of ROAD_SEGS) {
    if (x < s.minx || x > s.maxx || z < s.minz || z > s.maxz) continue;
    const r = distToSegment2(x, z, s.ax, s.az, s.bx, s.bz);
    if (r.d < best) { best = r.d; bh = lerp(s.ha, s.hb, r.t); }
  }
  return { d: best, h: bh };
}

export function heightAt(x, z) {
  let h = heightNoRoads(x, z);
  const ri = roadInfo(x, z);
  if (ri.d < ROAD_HALF + 12) {
    const w = 1 - smoothstep(ROAD_HALF, ROAD_HALF + 12, ri.d);
    h = lerp(h, ri.h, w);
  }
  return h;
}

export function forestDensity(x, z) {
  const dx = x - FOREST.x, dz = z - FOREST.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  let f = 1 - smoothstep(FOREST.r * 0.55, FOREST.r * 1.05, d + noise.noise(x * 0.01, z * 0.01) * 60);
  // groves scattered around
  const g = noise2.fbm(x * 0.006 + 50, z * 0.006 - 20, 3);
  f = Math.max(f, smoothstep(0.28, 0.55, g) * 0.8);
  // north-west pine belt near the mountains
  const r = Math.sqrt(x * x + z * z);
  f = Math.max(f, smoothstep(470, 560, r) * (1 - smoothstep(600, 660, r)) * 0.9);
  // keep meadow open
  const mx = x - MEADOW.x, mz = z - MEADOW.z;
  f *= smoothstep(MEADOW.r * 0.5, MEADOW.r * 1.1, Math.sqrt(mx * mx + mz * mz));
  return clamp(f, 0, 1);
}

export function meadowFlowers(x, z) {
  const mx = x - MEADOW.x, mz = z - MEADOW.z;
  const md = Math.sqrt(mx * mx + mz * mz);
  let f = 1 - smoothstep(MEADOW.r * 0.6, MEADOW.r * 1.4, md);
  f = Math.max(f, smoothstep(0.1, 0.5, noise2.fbm(x * 0.008 - 90, z * 0.008 + 30, 3)) * 0.85);
  return clamp(f, 0, 1);
}

export function isInLake(x, z) { return lakeFactor(x, z) < 1.0; }

export function isFlatZone(x, z) {
  const cx = x - CASTLE.x, cz = z - CASTLE.z;
  if (cx * cx + cz * cz < 135 * 135) return true;
  const kx = x - CRAG.x, kz = z - CRAG.z;
  if (kx * kx + kz * kz < (CRAG.r + 10) ** 2) return true;
  for (const p of FLATS) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz < (p.r + 5) ** 2) return true;
  }
  return false;
}

const _c = new THREE.Color();
const C = (hex) => new THREE.Color(hex);
const COL = {
  grassA: C('#8cc455'), grassB: C('#b8d66a'), grassC: C('#6fb24e'),
  forest: C('#5f9a4c'), forestDark: C('#4a7d44'), moss: C('#6f9f55'),
  pink: C('#ec8fbf'), lilac: C('#a98ae6'), gold: C('#e8dc7a'), white: C('#f5f0ea'), pinkSoft: C('#d9b8d8'),
  road: C('#e0cda6'), roadEdge: C('#c9b88c'),
  sand: C('#eadfb8'), under: C('#8cb8ae'),
  rock: C('#c4b8ae'), rockDark: C('#a0949e'), snow: C('#f8faff'), mountain: C('#a3a2c2'),
  crag: C('#5f5070'), cragGrass: C('#80708f'),
  plateau: C('#c5d58c'),
};

export class Terrain {
  constructor() {
    const { size, segments } = WORLD;
    this.size = size;
    this.seg = segments;
    this.half = size / 2;
    this.step = size / segments;
    const n = segments + 1;
    this.heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -this.half + i * this.step;
        const z = -this.half + j * this.step;
        this.heights[j * n + i] = heightAt(x, z);
      }
    }
    this.mesh = this.buildMesh();
  }

  h(i, j) {
    const n = this.seg + 1;
    i = clamp(i, 0, this.seg); j = clamp(j, 0, this.seg);
    return this.heights[j * n + i];
  }

  getHeight(x, z) {
    const fx0 = (x + this.half) / this.step;
    const fz0 = (z + this.half) / this.step;
    const i = clamp(Math.floor(fx0), 0, this.seg - 1);
    const j = clamp(Math.floor(fz0), 0, this.seg - 1);
    const fx = clamp(fx0 - i, 0, 1), fz = clamp(fz0 - j, 0, 1);
    const ha = this.h(i, j), hb = this.h(i + 1, j), hc = this.h(i, j + 1), hd = this.h(i + 1, j + 1);
    if (fx + fz <= 1) return ha + (hb - ha) * fx + (hc - ha) * fz;
    return hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
  }

  getNormal(x, z, out = new THREE.Vector3()) {
    const e = 1.5;
    const hl = this.getHeight(x - e, z), hr = this.getHeight(x + e, z);
    const hu = this.getHeight(x, z - e), hdn = this.getHeight(x, z + e);
    out.set(hl - hr, 2 * e, hu - hdn).normalize();
    return out;
  }

  colorAt(x, z, h, slope) {
    const W = WORLD.water;
    // base grass
    const n1 = noise.noise(x * 0.02, z * 0.02) * 0.5 + 0.5;
    const n2 = noise2.noise(x * 0.07, z * 0.07) * 0.5 + 0.5;
    _c.copy(COL.grassA).lerp(COL.grassB, n1 * 0.7).lerp(COL.grassC, n2 * 0.3);
    // flowers tint (visible from afar)
    const fl = meadowFlowers(x, z);
    if (fl > 0.05) {
      const k = noise.noise(x * 0.018 + 7, z * 0.018 - 3);
      if (k > 0.12) _c.lerp(COL.pink, fl * smoothstep(0.12, 0.45, k) * 0.6);
      else if (k < -0.18) _c.lerp(COL.lilac, fl * smoothstep(-0.18, -0.5, k) * 0.55);
      else if (Math.abs(k) < 0.04) _c.lerp(COL.gold, fl * 0.3);
    }
    // forest floor
    const fd = forestDensity(x, z);
    if (fd > 0.2) _c.lerp(n2 > 0.5 ? COL.forest : COL.forestDark, smoothstep(0.2, 0.8, fd) * 0.75);
    // sand + underwater
    if (h < W + 2.2) _c.lerp(COL.sand, smoothstep(W + 2.2, W + 0.4, h));
    if (h < W - 0.6) _c.lerp(COL.under, smoothstep(W - 0.6, W - 5, h));
    // road
    const ri = roadInfo(x, z);
    if (ri.d < ROAD_HALF + 2.5) {
      const w = 1 - smoothstep(ROAD_HALF - 1.2, ROAD_HALF + 2.5, ri.d + (n2 - 0.5) * 2);
      _c.lerp(n1 > 0.5 ? COL.road : COL.roadEdge, w);
    }
    // crag
    const kx = x - CRAG.x, kz = z - CRAG.z;
    const kd = Math.sqrt(kx * kx + kz * kz);
    if (kd < CRAG.r + 80) _c.lerp(n1 > 0.5 ? COL.crag : COL.cragGrass, (1 - smoothstep(CRAG.r, CRAG.r + 80, kd)) * 0.85);
    // rock on slopes
    const mossW = smoothstep(0.35, 0.8, slope);
    if (mossW > 0) _c.lerp(COL.moss, mossW * 0.5);
    const high = smoothstep(45, 90, h);
    const rockW = smoothstep(1.05 - high * 0.3, 1.6 - high * 0.4, slope + (n2 - 0.5) * 0.35) * (0.55 + high * 0.45);
    if (rockW > 0) _c.lerp(n1 > 0.4 ? COL.rock : COL.rockDark, rockW);
    // high mountains
    if (h > 70) _c.lerp(COL.mountain, smoothstep(70, 130, h) * 0.9);
    if (h > 150) _c.lerp(COL.snow, smoothstep(150 + n2 * 30, 195, h) * (1 - rockW * 0.25));
    return _c;
  }

  buildMesh() {
    const n = this.seg + 1;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -this.half + i * this.step;
        const z = -this.half + j * this.step;
        const h = this.heights[k];
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
        const dhx = (this.h(i + 1, j) - this.h(i - 1, j)) / (2 * this.step);
        const dhz = (this.h(i, j + 1) - this.h(i, j - 1)) / (2 * this.step);
        const slope = Math.sqrt(dhx * dhx + dhz * dhz);
        const c = this.colorAt(x, z, h, slope);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        uv[k * 2] = x / 6; uv[k * 2 + 1] = z / 6;
      }
    }
    const idx = new Uint32Array(this.seg * this.seg * 6);
    let p = 0;
    for (let j = 0; j < this.seg; j++) {
      for (let i = 0; i < this.seg; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();

    const tex = makeGroundTexture();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }
}

function makeGroundTexture() {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(s, s);
  const nz = new Simplex2(99);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // tileable-ish noise via torus mapping
      const ax = (x / s) * Math.PI * 2, ay = (y / s) * Math.PI * 2;
      const u = Math.cos(ax) * 2, v = Math.sin(ax) * 2, w = Math.cos(ay) * 2, q = Math.sin(ay) * 2;
      let n = nz.noise(u + w * 0.7, v + q * 0.7) * 0.5 + nz.noise(u * 3 + q, v * 3 + w) * 0.3 + nz.noise(u * 9 - w, v * 9 + q * 2) * 0.2;
      const val = 236 + n * 20 + (Math.random() - 0.5) * 12;
      const o = (y * s + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = clamp(val, 0, 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
