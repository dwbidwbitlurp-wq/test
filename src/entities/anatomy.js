// Sculpted body parts for the humanoid rig: anatomical torso and pelvis, muscled limbs,
// articulated hands with nails, shaped boots with soles and straps, real ears, eye glints,
// lined capes. Every geometry is cached and shared between characters.
import * as THREE from 'three';
import { smoothProfile, capsule, PRIM } from './rig.js';

const CACHE = new Map();
const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
// gaussian bump in (angle, y)
const gA = (phi, c, w) => { const d = wrap(phi - c) / w; return Math.exp(-d * d); };
const gY = (y, c, w) => { const d = (y - c) / w; return Math.exp(-d * d); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Lathe with a sculpted surface. disp(phi, y, t) adds to the radius; sect(phi, t) scales it
// (phi = 0 faces +z / forward, +PI/2 faces +x). Seam sits at the back and its normals are welded.
function sculpt(key, profile, segs, per, disp, sect) {
  let g = CACHE.get(key);
  if (g) return g;
  const pts = smoothProfile(profile, per);
  const rows = pts.length;
  g = new THREE.LatheGeometry(pts, segs, Math.PI, TAU);
  const p = g.attributes.position;
  const y0 = pts[0].y, y1 = pts[rows - 1].y;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const phi = Math.atan2(x, z);
    const t = (y - y0) / (y1 - y0 || 1);
    const nr = Math.max(0.0005, r * (sect ? sect(phi, t, y) : 1) + (disp ? disp(phi, y, t, r) : 0));
    p.setXYZ(i, Math.sin(phi) * nr, y, Math.cos(phi) * nr);
  }
  g.computeVertexNormals();
  // weld the seam normals (first and last meridian share positions)
  const n = g.attributes.normal;
  const last = segs * rows;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    a.fromBufferAttribute(n, j); b.fromBufferAttribute(n, last + j);
    a.add(b).normalize();
    n.setXYZ(j, a.x, a.y, a.z); n.setXYZ(last + j, a.x, a.y, a.z);
  }
  CACHE.set(key, g);
  return g;
}
// rounded-rectangle cross-section (superellipse), fading to round where `k` is 0
const squarish = (phi, p, k) => {
  const c = Math.abs(Math.cos(phi)), s = Math.abs(Math.sin(phi));
  const f = Math.pow(Math.pow(c, p) + Math.pow(s, p), -1 / p);
  return 1 + (f - 1) * k;
};

// ---------- torso (torso bone space, y -0.04 .. 0.57) ----------
export function torsoGeometry(profile, fem, cloth) {
  return sculpt('torso' + fem + cloth + JSON.stringify(profile), profile, 56, 6, (phi, y) => {
    let d = 0;
    for (const s of [-1, 1]) {
      // pectorals / upper chest and the soft crease below them
      d += gA(phi, s * 0.55, 0.45) * gY(y, 0.36, 0.07) * (fem ? 0.005 : 0.013);
      d -= gA(phi, s * 0.5, 0.5) * gY(y, 0.285, 0.02) * (fem ? 0 : 0.004);
      // clavicles
      d += gA(phi, s * 0.5, 0.35) * gY(y, 0.5, 0.016) * 0.004;
      // trapezius: shoulders slope into the neck instead of a dome
      d += gA(phi, s * Math.PI / 2, 0.55) * gY(y, 0.5, 0.045) * 0.016;
      // latissimus (V taper) and waist
      d += gA(phi, s * (Math.PI / 2 + 0.45), 0.4) * gY(y, 0.3, 0.09) * (fem ? 0.003 : 0.011);
      d -= gA(phi, s * Math.PI / 2, 0.5) * gY(y, 0.1, 0.06) * (fem ? 0.012 : 0.005);
      // shoulder blades
      d += gA(phi, Math.PI + s * 0.55, 0.32) * gY(y, 0.38, 0.065) * 0.01;
      // ribcage flare
      d += gA(phi, s * 1.0, 0.4) * gY(y, 0.22, 0.05) * 0.004;
    }
    // abdomen, spine groove
    d += gA(phi, 0, 0.55) * gY(y, 0.14, 0.07) * (fem ? 0.004 : 0.006);
    d -= gA(phi, Math.PI, 0.12) * smooth(0.02, 0.1, y) * smooth(0.48, 0.4, y) * 0.006;
    if (cloth) {
      // fabric: soft wrinkles gathered above the belt and a few folds pulling from the chest
      d += Math.sin(y * 150 + Math.sin(phi * 3) * 2) * 0.0014 * smooth(0.2, 0.06, y) * smooth(-0.02, 0.05, y);
      d += Math.sin(phi * 9 + y * 20) * 0.0012 * smooth(0.25, 0.08, y);
      d += gA(phi, 0, 0.9) * Math.sin(phi * 5 + 0.5) * 0.0012 * gY(y, 0.25, 0.08);
    }
    return d;
  }, (phi, t) => squarish(phi, 2.5, smooth(0, 0.15, t) * smooth(0.95, 0.75, t) * (fem ? 0.6 : 1)));
}

// ---------- pelvis (hips bone space) ----------
export function pelvisGeometry(profile, fem) {
  return sculpt('pelvis' + fem + JSON.stringify(profile), profile, 56, 6, (phi, y) => {
    let d = 0;
    for (const s of [-1, 1]) {
      d += gA(phi, Math.PI + s * 0.5, 0.42) * gY(y, -0.055, 0.05) * (fem ? 0.028 : 0.018); // glutes
      d += gA(phi, s * Math.PI / 2, 0.5) * gY(y, -0.02, 0.05) * (fem ? 0.012 : 0.004); // hips
      d -= gA(phi, s * 0.6, 0.25) * gY(y, -0.08, 0.035) * 0.006; // groin crease
    }
    d -= gA(phi, Math.PI, 0.1) * gY(y, -0.06, 0.04) * 0.006;
    return d;
  }, (phi, t) => squarish(phi, 2.3, smooth(0, 0.2, t) * smooth(1, 0.8, t)));
}

// ---------- limbs (hang down from the joint, y 0 .. -len) ----------
// side: +1 left limb (+x), -1 right; kind: thigh | shin | upper | fore
export function limbGeometry(kind, r1, r2, len, side, cloth = false) {
  const key = `limb${kind}${r1.toFixed(3)}${r2.toFixed(3)}${len.toFixed(3)}${side}${cloth}`;
  const prof = [];
  const n = 9;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; prof.push([Math.sin(a) * r1, Math.cos(a) * r1 * 0.9]); }
  for (let i = 1; i < 12; i++) { const t = i / 12; prof.push([r1 + (r2 - r1) * t, -len * t]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; prof.push([Math.cos(a) * r2, -len - Math.sin(a) * r2 * 0.9]); }
  prof.reverse(); // bottom -> top keeps the lathe winding (normals) facing outward
  const inner = -side * Math.PI / 2, outer = side * Math.PI / 2;
  const R = (r1 + r2) / 2;
  return sculpt(key, prof, 44, 3, (phi, y) => {
    const t = -y / len;
    let d = 0;
    if (kind === 'thigh') {
      d += gA(phi, 0.15 * side, 0.8) * gY(t, 0.42, 0.22) * R * 0.16; // quadriceps
      d += gA(phi, inner + 0.5 * side, 0.5) * gY(t, 0.82, 0.1) * R * 0.12; // vastus medialis
      d += gA(phi, outer, 0.55) * gY(t, 0.35, 0.25) * R * 0.08; // vastus lateralis
      d += gA(phi, Math.PI, 0.7) * gY(t, 0.35, 0.22) * R * 0.1; // hamstrings
      d -= gA(phi, inner, 0.45) * gY(t, 0.15, 0.12) * R * 0.05;
      d += gA(phi, 0, 0.4) * gY(t, 1.0, 0.06) * R * 0.1; // kneecap
      if (cloth) d += Math.sin(t * 60 + phi * 2) * R * 0.02 * gY(t, 0.97, 0.08);
    } else if (kind === 'shin') {
      for (const s of [-0.45, 0.45]) d += gA(phi, Math.PI + s, 0.5) * gY(t, 0.28, 0.14) * R * 0.2; // calf
      d += gA(phi, 0, 0.3) * gY(t, 0.08, 0.06) * R * 0.08; // tibia head
      d -= gA(phi, 0, 0.4) * gY(t, 0.55, 0.3) * R * 0.03;
    } else if (kind === 'upper') {
      d += gA(phi, outer, 0.9) * gY(t, 0.08, 0.12) * R * 0.14; // deltoid insertion
      d += gA(phi, 0, 0.6) * gY(t, 0.55, 0.16) * R * 0.14; // biceps
      d += gA(phi, Math.PI + 0.3 * side, 0.7) * gY(t, 0.4, 0.2) * R * 0.12; // triceps
      if (cloth) d += Math.sin(t * 50 + phi * 3) * R * 0.02 * gY(t, 0.95, 0.08);
    } else if (kind === 'fore') {
      d += gA(phi, outer - 0.4 * side, 0.7) * gY(t, 0.22, 0.14) * R * 0.16; // brachioradialis
      d += gA(phi, Math.PI, 0.8) * gY(t, 0.25, 0.18) * R * 0.08;
    }
    return d;
  }, kind === 'fore' ? (phi, t) => 1 + (Math.abs(Math.sin(phi)) - 0.5) * 0.25 * smooth(0.4, 0.9, t) : null);
}

// ---------- hand: palm, 4 fingers x 3 phalanges, 2-joint thumb, knuckles, nails ----------
const FINGERS = [ // x offset factor, length, radius, base y
  [-1.5, 0.066, 0.0092, -0.056], [-0.5, 0.074, 0.0096, -0.058], [0.5, 0.069, 0.0091, -0.056], [1.5, 0.055, 0.0079, -0.051],
];
const CURL = [0.3, 0.72, 1.12];
const PALM = (() => {
  const g = new THREE.SphereGeometry(1, 36, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // squarer at the knuckle line, slightly cupped palm, raised back
    const sq = 1 + 0.25 * (1 - Math.abs(y)) * Math.abs(x);
    p.setXYZ(i, x * sq, y < 0 ? y * 0.92 : y, z < 0 ? z * (0.8 - 0.25 * (1 - x * x)) : z);
  }
  g.computeVertexNormals();
  return g;
})();
export function addHand(R, hand, sd, col, kind, opts = {}) {
  const nailC = opts.nail;
  const k = opts.gauntlet;
  const blend = opts.blendBone ? [[opts.blendBone, 0.01, -0.03, 0.4]] : undefined;
  R.part(hand, PALM, col, { y: -0.025, sx: 0.037, sy: 0.034, sz: 0.019, blend }, kind);
  // thenar and hypothenar pads (palm side = -z)
  R.part(hand, PRIM.sphereLo, col, { x: -sd * 0.019, y: -0.026, z: -0.006, sx: 0.017, sy: 0.026, sz: 0.013, rz: sd * 0.3 }, kind);
  R.part(hand, PRIM.sphereLo, col, { x: sd * 0.022, y: -0.03, z: -0.004, sx: 0.012, sy: 0.024, sz: 0.011 }, kind);
  for (let f = 0; f < 4; f++) {
    const [xf, len, r, by] = FINGERS[f];
    const x = sd * xf * 0.0135;
    let y = by, z = 0.0;
    // knuckle on the back of the hand
    R.part(hand, PRIM.sphereLo, col, { x, y: y + 0.004, z: 0.007, sx: r * 1.15, sy: r, sz: r }, kind);
    const segL = [len * 0.43, len * 0.32, len * 0.25];
    for (let s = 0; s < 3; s++) {
      const a = CURL[s] + (f === 3 ? 0.1 : 0);
      const l = segL[s], rr = r * (1 - s * 0.1);
      const dy = -Math.cos(a) * l, dz = -Math.sin(a) * l;
      R.part(hand, capsule(rr, Math.max(0.001, l - rr)), col, { x, y: y + dy / 2, z: z + dz / 2, rx: a }, kind);
      if (s === 2 && nailC) R.part(hand, PRIM.sphereLo, nailC, { x, y: y + dy * 0.62, z: z + dz * 0.62 + Math.cos(a) * rr * 0.8, sx: rr * 0.8, sy: l * 0.36, sz: rr * 0.3, rx: a }, 'skin');
      y += dy; z += dz;
    }
    if (k) R.part(hand, PRIM.box, col, { x, y: by - 0.012, z: 0.006, sx: r * 2.1, sy: 0.02, sz: r * 1.6, rx: 0.3 }, kind); // finger plate
  }
  // thumb: metacarpal pad + two phalanges curling across the palm
  {
    let x = -sd * 0.03, y = -0.022, z = -0.004;
    const dirs = [[0.55, 0.2, 0.026, 0.0105], [0.35, 0.75, 0.024, 0.0098], [0.2, 1.15, 0.02, 0.009]];
    for (let s = 0; s < 3; s++) {
      const [spread, a, l, r] = dirs[s];
      const dx = -sd * Math.sin(spread) * l * 0.6, dy = -Math.cos(a) * l, dz = -Math.sin(a) * l * 0.8;
      R.part(hand, capsule(r, Math.max(0.001, l - r)), col, { x: x + dx / 2, y: y + dy / 2, z: z + dz / 2, rx: a * 0.8, rz: sd * spread }, kind);
      if (s === 2 && nailC) R.part(hand, PRIM.sphereLo, nailC, { x: x + dx * 0.6, y: y + dy * 0.6, z: z + dz * 0.6 + r * 0.7, sx: r * 0.8, sy: l * 0.35, sz: r * 0.3, rx: a * 0.8, rz: sd * spread }, 'skin');
      x += dx; y += dy; z += dz;
    }
  }
  // tendons on the back of the hand
  if (!k) for (let f = 0; f < 4; f++) R.part(hand, capsule(0.0028, 0.03), col, { x: sd * FINGERS[f][0] * 0.011, y: -0.03, z: 0.016, rx: -0.05 }, kind);
}

// ---------- boots (knee bone space, sole at y = -0.475) ----------
const FOOT = (() => {
  const g = new THREE.SphereGeometry(1, 48, 32);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (z + 1) / 2; // 0 heel .. 1 toe
    const w = 0.042 + 0.012 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.85) - 0.012 * smooth(0.85, 1, t);
    const top = 0.1 - 0.07 * smooth(0.2, 0.85, t); // tall at the ankle, low over the toes
    const yy = y < 0 ? y * 0.004 : y * top;
    const zz = -0.075 + t * 0.285;
    p.setXYZ(i, x * w, -0.461 + yy, zz);
  }
  g.computeVertexNormals();
  return g;
})();
const SOLE = (() => {
  const s = new THREE.Shape();
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    const c = Math.cos(a), sn = Math.sin(a);
    const t = (sn + 1) / 2;
    const w = 0.046 + 0.014 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.85) - 0.012 * smooth(0.85, 1, t);
    pts.push(new THREE.Vector2(c * w, -0.08 + t * 0.296));
  }
  s.setFromPoints(pts);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 12 });
  g.rotateX(Math.PI / 2); // extrude goes down (-y)
  g.translate(0, -0.461, 0);
  return g;
})();
export function addBoot(R, knee, bulk, col, opts = {}) {
  const dark = new THREE.Color(col).multiplyScalar(0.55).getHex();
  const light = new THREE.Color(col).multiplyScalar(1.18).getHex();
  R.part(knee, FOOT, col, {}, 'matte');
  R.part(knee, SOLE, dark, {}, 'matte');
  // heel block and toe cap seam
  R.part(knee, PRIM.box, dark, { y: -0.462, z: -0.045, sx: 0.07 * bulk, sy: 0.026, sz: 0.06 }, 'matte');
  R.part(knee, new THREE.TorusGeometry(1, 0.06, 6, 28, Math.PI), light, { y: -0.448, z: 0.135, sx: 0.05, sy: 0.05, sz: 0.04, rx: -Math.PI / 2 + 0.25 }, 'matte');
  // turned-down cuff at the top of the shaft
  R.part(knee, lathe2([[0.078, 0.0], [0.086, -0.035], [0.084, -0.075], [0.074, -0.085]]), light, { y: -0.03, sx: bulk, sz: bulk }, 'cloth');
  // straps with buckles around the shaft and the ankle
  const metal = opts.buckle ?? 0xd8c080;
  for (const [y, r] of [[-0.3, 0.052], [-0.39, 0.05]]) {
    R.part(knee, new THREE.TorusGeometry(r, 0.006, 8, 32), dark, { y, sx: bulk, sy: bulk * 0.95, rx: Math.PI / 2 }, 'matte');
    R.part(knee, PRIM.box, metal, { x: r * bulk * 0.9, y, z: 0.01, sx: 0.006, sy: 0.016, sz: 0.018 }, 'metal');
  }
  // lacing over the instep
  for (let i = 0; i < 4; i++) {
    const y = -0.415 + i * 0.016, z = 0.07 - i * 0.022;
    for (const s of [-1, 1]) R.part(knee, capsule(0.0022, 0.028), dark, { y, z, rz: s * 1.1, rx: -0.6 }, 'matte');
  }
}
const lathe2 = (pts) => {
  const key = 'l2' + JSON.stringify(pts);
  let g = CACHE.get(key);
  if (!g) { g = new THREE.LatheGeometry(smoothProfile([...pts].sort((a, b) => a[1] - b[1]), 5), 48); g.computeVertexNormals(); CACHE.set(key, g); }
  return g;
};

// ---------- ear: rim (helix), bowl, lobe, tragus ----------
const HELIX = new THREE.TorusGeometry(1, 0.26, 10, 28, Math.PI * 1.45);
export function addEar(R, head, sd, skin, y0 = 0.108) {
  const dark = new THREE.Color(skin).multiplyScalar(0.8).getHex();
  const x = sd * 0.107;
  const t = { x, y: y0, z: -0.008 };
  // base disc against the head
  R.part(head, PRIM.sphereLo, skin, { ...t, x: x - sd * 0.002, sx: 0.009, sy: 0.03, sz: 0.021, rz: -sd * 0.12 }, 'skin');
  // helix: open toward the front-bottom
  R.part(head, HELIX, skin, { ...t, x: x + sd * 0.004, sx: 0.022, sy: 0.029, sz: 0.022, ry: sd * Math.PI / 2, rx: 0, rz: 0, order: 'YXZ' }, 'skin');
  // concha (bowl) and lobe, tragus
  R.part(head, PRIM.sphereLo, dark, { ...t, x: x + sd * 0.004, y: y0 - 0.004, sx: 0.004, sy: 0.013, sz: 0.01 }, 'skin');
  R.part(head, PRIM.sphereLo, skin, { ...t, x: x + sd * 0.003, y: y0 - 0.03, z: -0.002, sx: 0.007, sy: 0.011, sz: 0.009 }, 'skin');
  R.part(head, PRIM.sphereLo, skin, { ...t, x: x + sd * 0.004, y: y0 - 0.006, z: 0.012, sx: 0.004, sy: 0.007, sz: 0.004 }, 'skin');
}

// ---------- eye glint: a clear, glossy cornea over each painted eye ----------
export const EYE_MAT = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.22, depthWrite: false });
export function addEyeGlints(R, bone, y, fem) {
  for (const sd of [-1, 1]) R.part(bone, PRIM.sphereLo, 0xffffff, { x: sd * 0.036, y, z: 0.1025, sx: 0.0185, sy: fem ? 0.0115 : 0.0095, sz: 0.006, ry: sd * 0.3 }, EYE_MAT);
}

// ---------- cape trim strip / lining panel ----------
export function capeStrip(wTop, wBot, h, f0, f1, bulk, u0, u1, hem = false, zOff = 0) {
  const key = `cape${wTop}${wBot}${h}${f0}${f1}${bulk}${u0}${u1}${hem}${zOff}`;
  let g = CACHE.get(key);
  if (g) return g;
  const nu = Math.max(2, Math.round((u1 - u0) * 44)), nv = 28;
  g = new THREE.PlaneGeometry(1, 1, nu, nv);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = u0 + (p.getX(i) + 0.5) * (u1 - u0), v = 0.5 - p.getY(i);
    const w = wTop + (wBot - wTop) * v;
    const x = (u - 0.5) * w;
    const fold = f0 + (f1 - f0) * v;
    const wrapZ = Math.pow((u - 0.5) * 2, 2) * 0.07 * bulk;
    const folds = Math.sin(u * Math.PI * 7) * 0.018 * fold + Math.sin(u * Math.PI * 3 + 0.6) * 0.012 * fold;
    let y = -v * h;
    if (hem && v > 0.9) y -= Math.sin(u * Math.PI * 6) * 0.02 * (v - 0.9) * 10;
    p.setXYZ(i, x, y, wrapZ + folds + zOff);
  }
  g.computeVertexNormals();
  CACHE.set(key, g);
  return g;
}

// ---------- plate cuirass: medial ridge, sculpted chest plates, articulated belly lames ----------
export function cuirassGeometry(profile, fem) {
  return sculpt('cuirass' + fem + JSON.stringify(profile), profile, 56, 6, (phi, y) => {
    let d = 0;
    d += gA(phi, 0, 0.09) * smooth(0.12, 0.2, y) * smooth(0.5, 0.42, y) * 0.007; // keel
    for (const s of [-1, 1]) {
      d += gA(phi, s * 0.55, 0.5) * gY(y, 0.36, 0.08) * (fem ? 0.004 : 0.009);
      d += gA(phi, Math.PI + s * 0.55, 0.35) * gY(y, 0.38, 0.07) * 0.006; // backplate over the blades
    }
    // lames: stepped overlapping bands below the breastplate
    if (y < 0.2) {
      const band = ((0.2 - y) / 0.045) % 1;
      d += (0.5 - band) * 0.006 * smooth(0.08, 0.14, y + 0.12) - 0.002 * gY(band, 0, 0.12);
    }
    // rolled edge at the arm openings and the neck
    d += gA(phi, Math.PI / 2, 0.25) * gY(y, 0.44, 0.02) * 0.004 + gA(phi, -Math.PI / 2, 0.25) * gY(y, 0.44, 0.02) * 0.004;
    return d;
  }, (phi, t) => squarish(phi, 2.3, smooth(0, 0.15, t) * smooth(0.95, 0.75, t)));
}
