// Sculpted head mesh + hand-painted face textures + hair locks.
// Goal: believable, softly stylized faces (no doll spheres, no uncanny glossy realism).
import * as THREE from 'three';
import { addRim } from './rig.js';

const g3 = (x, y, z, cx, cy, cz, sx, sy, sz) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2 + ((z - cz) / sz) ** 2));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const HEAD_CACHE = new Map();
// Unit-ish head, face toward +z, chin at y≈-1, crown at y≈+1. Planar UVs on the face.
export function headGeometry(fem = false, age = 0) {
  const key = (fem ? 'f' : 'm') + age;
  if (HEAD_CACHE.has(key)) return HEAD_CACHE.get(key);
  const g = new THREE.SphereGeometry(1, 56, 44);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const v = new THREE.Vector3();
  const nose = fem ? 0.72 : 1.0;
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    let { x, y, z } = v;
    // cranium: slightly taller, flatter sides, longer back
    let sx = 0.9, sy = 1.04, sz = 1.0;
    if (z < 0) sz = 1.05;
    // jaw & chin taper
    if (y < 0.05) {
      const k = smooth(0.05, -1, y);
      sx *= 1 - k * (fem ? 0.34 : 0.26);
      sz *= 1 - k * 0.12;
      if (z > 0) sz *= 1 + k * 0.06;
    }
    x *= sx; y *= sy; z *= sz;
    let d = 0;
    const front = smooth(0.2, 0.75, v.z);
    // brow ridge
    d += g3(x, y, z, 0, 0.3, 0.9, fem ? 0.55 : 0.62, 0.09, 0.3) * (fem ? 0.025 : 0.045);
    // eye sockets
    for (const s of [-1, 1]) {
      d -= g3(x, y, z, s * 0.34, 0.13, 0.9, 0.17, 0.12, 0.3) * 0.055;
      // cheekbones
      d += g3(x, y, z, s * 0.5, -0.12, 0.72, 0.2, 0.14, 0.3) * (fem ? 0.04 : 0.035);
      // nostril wings
      d += g3(x, y, z, s * 0.09, -0.33, 0.96, 0.06, 0.05, 0.2) * 0.05 * nose;
      // mouth corners
      d -= g3(x, y, z, s * 0.2, -0.5, 0.86, 0.05, 0.05, 0.2) * 0.02;
    }
    // nose: bridge + tip
    const bridge = Math.exp(-((x / (0.07 + 0.02 * nose)) ** 2)) * smooth(0.18, -0.05, y) * smooth(-0.42, -0.25, y) * front;
    d += bridge * 0.13 * nose;
    d += g3(x, y, z, 0, -0.27, 1.0, 0.085, 0.08, 0.2) * 0.07 * nose;
    d -= g3(x, y, z, 0, -0.38, 0.98, 0.07, 0.03, 0.2) * 0.02; // under nose
    // lips
    d += g3(x, y, z, 0, -0.47, 0.93, fem ? 0.2 : 0.19, 0.035, 0.2) * (fem ? 0.045 : 0.03);
    d += g3(x, y, z, 0, -0.56, 0.9, fem ? 0.17 : 0.16, 0.04, 0.2) * (fem ? 0.05 : 0.035);
    d -= g3(x, y, z, 0, -0.515, 0.93, 0.18, 0.012, 0.2) * 0.02; // mouth line
    d -= g3(x, y, z, 0, -0.65, 0.88, 0.1, 0.04, 0.2) * 0.02; // chin dimple area
    // chin
    d += g3(x, y, z, 0, -0.8, 0.62, fem ? 0.2 : 0.26, 0.14, 0.3) * (fem ? 0.04 : 0.07);
    // jaw angle (male)
    if (!fem) for (const s of [-1, 1]) d += g3(x, y, z, s * 0.55, -0.58, 0.25, 0.15, 0.18, 0.3) * 0.05;
    // temples
    for (const s of [-1, 1]) d -= g3(x, y, z, s * 0.82, 0.3, 0.3, 0.15, 0.2, 0.25) * 0.03;
    const len = Math.hypot(x, y, z) || 1;
    x += (x / len) * d; y += (y / len) * d; z += (z / len) * d;
    p.setXYZ(i, x, y, z);
    // planar UV for the face; back of the head samples plain skin at the texture edge
    const u = 0.5 + x * 0.5, w = 0.5 + y * 0.5;
    if (v.z > -0.05) uv.setXY(i, u, w);
    else uv.setXY(i, x > 0 ? 0.985 : 0.015, 0.5);
  }
  g.computeVertexNormals();
  HEAD_CACHE.set(key, g);
  return g;
}

// ---------------- face painting ----------------
const FACE_CACHE = new Map();
const hex = (c) => '#' + new THREE.Color(c).getHexString();
function mix(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return '#' + ca.lerp(cb, t).getHexString();
}

export function faceMaterial(opts) {
  const key = JSON.stringify(opts);
  if (FACE_CACHE.has(key)) return FACE_CACHE.get(key);
  const N = opts.hi ? 512 : 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const P = (x, y) => [(0.5 + x * 0.5) * N, (0.5 - y * 0.5) * N]; // head coords -> px
  const S = (s) => s * N * 0.5;
  const skin = hex(opts.skin);
  // base skin with subtle warmth
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, N, N);
  const warm = mix(opts.skin, '#e88a8a', 0.35);
  const cool = mix(opts.skin, '#8a7aa0', 0.25);
  const rad = (x, y, r, col, a) => {
    const [px, py] = P(x, y);
    const gr = ctx.createRadialGradient(px, py, 0, px, py, S(r));
    const cc = new THREE.Color(col);
    gr.addColorStop(0, `rgba(${cc.r * 255 | 0},${cc.g * 255 | 0},${cc.b * 255 | 0},${a})`);
    gr.addColorStop(1, `rgba(${cc.r * 255 | 0},${cc.g * 255 | 0},${cc.b * 255 | 0},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(px - S(r), py - S(r), S(r) * 2, S(r) * 2);
  };
  // soft anatomy shading
  for (const s of [-1, 1]) {
    rad(s * 0.5, -0.2, 0.26, warm, opts.fem ? 0.32 : 0.2); // cheeks
    rad(s * 0.34, 0.1, 0.2, cool, 0.35); // eye socket shadow
    rad(s * 0.75, 0.0, 0.35, cool, 0.25); // side shading
  }
  rad(0, -0.28, 0.12, warm, 0.35); // nose tip warmth
  rad(0, 0.55, 0.5, mix(opts.skin, '#ffffff', 0.2), 0.3); // forehead light
  if (opts.stubble) {
    for (let i = 0; i < N * 18; i++) {
      const a = Math.random() * Math.PI, r = 0.45 + Math.random() * 0.5;
      const x = Math.cos(a) * r * 0.85, y = -0.3 - Math.sin(a) * r * 0.6;
      if (y > -0.38 && Math.abs(x) < 0.25) continue;
      const [px, py] = P(x, y);
      ctx.fillStyle = `rgba(60,45,40,${0.12 + Math.random() * 0.12})`;
      ctx.fillRect(px, py, 1, 1);
    }
  }
  if (opts.freckles) {
    for (let i = 0; i < 40; i++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      const [px, py] = P(s * (0.2 + Math.random() * 0.35), -0.1 - Math.random() * 0.2);
      ctx.fillStyle = 'rgba(170,100,70,0.35)';
      ctx.beginPath(); ctx.arc(px, py, N / 300 + Math.random() * N / 400, 0, 6.3); ctx.fill();
    }
  }
  // lips
  const lipC = opts.lips ? hex(opts.lips) : mix(opts.skin, '#c05a6a', opts.fem ? 0.6 : 0.35);
  {
    const [cx, cy] = P(0, -0.515);
    const w = S(opts.fem ? 0.2 : 0.2), hu = S(0.05), hl = S(opts.fem ? 0.065 : 0.05);
    ctx.fillStyle = lipC;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy);
    ctx.quadraticCurveTo(cx - w * 0.5, cy - hu * 1.1, cx - w * 0.12, cy - hu * 0.9);
    ctx.quadraticCurveTo(cx, cy - hu * 0.6, cx + w * 0.12, cy - hu * 0.9);
    ctx.quadraticCurveTo(cx + w * 0.5, cy - hu * 1.1, cx + w, cy);
    ctx.quadraticCurveTo(cx + w * 0.5, cy + hl * 1.5, cx, cy + hl * 1.4);
    ctx.quadraticCurveTo(cx - w * 0.5, cy + hl * 1.5, cx - w, cy);
    ctx.fill();
    ctx.strokeStyle = mix(lipC, '#401820', 0.55);
    ctx.lineWidth = Math.max(1, N / 220);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.95, cy);
    ctx.quadraticCurveTo(cx, cy + hl * 0.25, cx + w * 0.95, cy);
    ctx.stroke();
    const hl2 = ctx.createRadialGradient(cx, cy + hl * 0.7, 0, cx, cy + hl * 0.7, w * 0.5);
    hl2.addColorStop(0, 'rgba(255,255,255,0.28)');
    hl2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl2;
    ctx.fillRect(cx - w, cy, w * 2, hl * 2);
  }
  // eyes
  const iris = new THREE.Color(opts.eyes);
  for (const s of [-1, 1]) {
    const [cx, cy] = P(s * 0.34, 0.13);
    const w = S(0.17), h = S(opts.fem ? 0.085 : 0.07);
    // lid crease shadow
    ctx.strokeStyle = mix(opts.skin, '#6a4a50', 0.45);
    ctx.lineWidth = Math.max(1, N / 170);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.85, cy - h * 0.9);
    ctx.quadraticCurveTo(cx, cy - h * 2.1, cx + w * 0.9, cy - h * 0.8);
    ctx.stroke();
    // almond sclera
    const almond = () => {
      ctx.beginPath();
      ctx.moveTo(cx - s * w, cy + h * 0.1);
      ctx.bezierCurveTo(cx - s * w * 0.5, cy - h * 1.35, cx + s * w * 0.55, cy - h * 1.3, cx + s * w, cy - h * 0.15);
      ctx.bezierCurveTo(cx + s * w * 0.5, cy + h * 0.95, cx - s * w * 0.45, cy + h * 1.0, cx - s * w, cy + h * 0.1);
      ctx.closePath();
    };
    ctx.save();
    almond();
    ctx.fillStyle = '#f6efe9';
    ctx.fill();
    ctx.clip();
    // iris with radial gradient, limbal ring, pupil, highlights
    const ir = h * 1.05;
    const ix = cx + s * w * 0.05, iy = cy - h * 0.1;
    const gi = ctx.createRadialGradient(ix, iy, ir * 0.1, ix, iy, ir);
    gi.addColorStop(0, '#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.35).getHexString());
    gi.addColorStop(0.55, '#' + iris.getHexString());
    gi.addColorStop(0.9, '#' + iris.clone().multiplyScalar(0.45).getHexString());
    gi.addColorStop(1, '#1a1418');
    ctx.fillStyle = gi;
    ctx.beginPath(); ctx.arc(ix, iy, ir, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#120c10';
    ctx.beginPath(); ctx.arc(ix, iy, ir * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(ix - ir * 0.35, iy - ir * 0.35, ir * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(ix + ir * 0.35, iy + ir * 0.3, ir * 0.09, 0, Math.PI * 2); ctx.fill();
    // upper lid shadow onto the eyeball
    const sh = ctx.createLinearGradient(0, cy - h * 1.3, 0, cy);
    sh.addColorStop(0, 'rgba(60,30,40,0.55)');
    sh.addColorStop(1, 'rgba(60,30,40,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(cx - w, cy - h * 1.4, w * 2, h * 1.4);
    ctx.restore();
    // lash line
    ctx.strokeStyle = opts.fem ? '#231519' : '#3a2a2a';
    ctx.lineWidth = opts.fem ? N / 90 : N / 150;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * w * 1.02, cy + h * 0.1);
    ctx.bezierCurveTo(cx - s * w * 0.5, cy - h * 1.35, cx + s * w * 0.55, cy - h * 1.3, cx + s * w * (opts.fem ? 1.12 : 1.0), cy - h * (opts.fem ? 0.45 : 0.15));
    ctx.stroke();
    if (opts.fem) {
      ctx.lineWidth = N / 260;
      for (let k = 0; k < 5; k++) {
        const t = 0.45 + k * 0.12;
        const lx = cx + s * w * (t * 2 - 1), ly = cy - h * (1.15 - Math.abs(t - 0.5) * 1.2);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + s * N / 120, ly - N / 90); ctx.stroke();
      }
    }
    // lower lid
    ctx.strokeStyle = 'rgba(120,70,70,0.45)';
    ctx.lineWidth = N / 320;
    ctx.beginPath();
    ctx.moveTo(cx - s * w * 0.9, cy + h * 0.25);
    ctx.bezierCurveTo(cx - s * w * 0.4, cy + h * 1.05, cx + s * w * 0.45, cy + h * 1.0, cx + s * w * 0.95, cy - h * 0.1);
    ctx.stroke();
    // eyebrow: many soft hair strokes
    const browC = new THREE.Color(opts.brow);
    const bx0 = cx - s * w * 1.05, by0 = cy - h * 2.6;
    for (let k = 0; k < 26; k++) {
      const t = k / 25;
      const bx = bx0 + s * w * 2.15 * t;
      const by = by0 - Math.sin(t * Math.PI * 0.85) * h * (opts.fem ? 0.9 : 0.55) + (opts.angry ? t * h * 0.6 : 0);
      const thick = (opts.fem ? 0.6 : 1.0) * (1 - t * 0.55);
      ctx.strokeStyle = `rgba(${browC.r * 255 | 0},${browC.g * 255 | 0},${browC.b * 255 | 0},${0.55 + Math.random() * 0.3})`;
      ctx.lineWidth = Math.max(1, (N / 150) * thick);
      ctx.beginPath();
      ctx.moveTo(bx, by + h * 0.25 * thick);
      ctx.lineTo(bx + s * N / 70, by - h * 0.25 * thick);
      ctx.stroke();
    }
  }
  // nostrils
  for (const s of [-1, 1]) {
    const [nx, ny] = P(s * 0.075, -0.36);
    ctx.fillStyle = 'rgba(90,50,50,0.35)';
    ctx.beginPath(); ctx.ellipse(nx, ny, N / 110, N / 200, s * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.6, metalness: 0, emissive: 0x2a1410, emissiveIntensity: 1 });
  addRim(mat, 1.4);
  FACE_CACHE.set(key, mat);
  return mat;
}

// ---------------- hair locks ----------------
const LOCK_CACHE = new Map();
// a tapered, slightly flattened and curved lock hanging down from origin
export function lockGeometry(len, width, curl = 0.15) {
  const key = len.toFixed(3) + ':' + width.toFixed(3) + ':' + curl.toFixed(2);
  if (LOCK_CACHE.has(key)) return LOCK_CACHE.get(key);
  const seg = 7;
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const r = width * (1 - Math.pow(t, 1.6) * 0.85) * (0.75 + Math.sin(t * Math.PI) * 0.35);
    pts.push(new THREE.Vector2(Math.max(0.0005, r), -t * len));
  }
  const g = new THREE.LatheGeometry(pts, 7);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = -y / len;
    p.setX(i, p.getX(i) * 1.0);
    p.setZ(i, p.getZ(i) * 0.55 + Math.sin(t * Math.PI * 0.9) * curl * len * 0.5);
  }
  g.computeVertexNormals();
  LOCK_CACHE.set(key, g);
  return g;
}
