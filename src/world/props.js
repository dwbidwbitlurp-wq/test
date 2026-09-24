// Reusable detailed props, built into a Builder (world coordinates).
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const HALF_CYL = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI);
const TORUS_HALF = new THREE.TorusGeometry(1, 0.1, 6, 16, Math.PI);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const SPH = new THREE.SphereGeometry(1, 12, 9);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE = new THREE.ConeGeometry(1, 1, 10);
const OCTA = new THREE.OctahedronGeometry(1, 0);
const TOR = new THREE.TorusGeometry(1, 0.08, 6, 18);

const TRIM = C('#ece4da');
const WOOD = C('#a47650');
const DARKWOOD = C('#7a5238');
const IRON = C('#5a5f6c');

// rotate a local offset (ox along local x, oz along local z) by ry
function rot(ry, ox, oz) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [ox * c + oz * s, -ox * s + oz * c];
}

// Arched window in the local YZ plane (thin along local x), centred at (x, y, z) = bottom-centre of the opening.
export function archWindow(B, x, y, z, ry, w = 1.0, h = 1.8, opts = {}) {
  const mat = opts.mat || 'window';
  const col = opts.color || C('#ffffff');
  // glass
  B.add(mat, BOX, x, y + h / 2, z, 0, ry, 0, 0.06, h, w, { color: col, ao: false });
  B.add(mat, HALF_CYL, x, y + h, z, Math.PI / 2, ry + Math.PI / 2, 0, w / 2, 0.06, w / 2, { color: col, ao: false, order: 'YXZ' });
  // frame
  for (const sd of [-1, 1]) {
    const [ox, oz] = rot(ry, 0, sd * (w / 2 + 0.07));
    B.add('stone', BOX, x + ox, y + h / 2, z + oz, 0, ry, 0, 0.2, h, 0.14, { color: TRIM, ao: false });
  }
  B.add('stone', TORUS_HALF, x, y + h, z, 0, ry + Math.PI / 2, 0, w / 2 + 0.07, w / 2 + 0.07, 1.4, { color: TRIM, ao: false, worldUV: false, order: 'YXZ' });
  // sill
  B.add('stone', BOX, x, y - 0.08, z, 0, ry, 0, 0.34, 0.16, w + 0.42, { color: TRIM, ao: false });
  // mullions
  if (!opts.noMullion) {
    B.add('iron', BOX, x, y + h / 2 + 0.1, z, 0, ry, 0, 0.08, h + w * 0.4, 0.04, { color: C('#8a8070'), ao: false });
    B.add('iron', BOX, x, y + h * 0.55, z, 0, ry, 0, 0.08, 0.04, w, { color: C('#8a8070'), ao: false });
  }
  // flower box
  if (opts.flowers) {
    const [ox, oz] = rot(ry, opts.flowers * 0.22, 0);
    B.add('wood', BOX, x + ox, y - 0.25, z + oz, 0, ry, 0, 0.35, 0.3, w + 0.3, { color: WOOD, ao: false });
    const cols = ['#f7a8c8', '#fff3b0', '#c7a6f0', '#ffffff', '#ff9eb8'];
    for (let i = 0; i < 6; i++) {
      const [px, pz] = rot(ry, opts.flowers * 0.24, -w / 2 + (i + 0.5) * (w / 6));
      B.sphere('plain', x + px, y - 0.02, z + pz, 0.12, { color: C(cols[i % cols.length]), ao: false });
    }
  }
}

// Wooden door with iron bands and a ring; open = angle in radians (0 closed)
export function door(B, x, y, z, ry, w = 1.8, h = 2.8, open = 0, color = '#8a5c3b') {
  // hinge on local -z edge
  const hr = ry + open;
  const [cx, cz] = rot(hr, 0, w / 2);
  const [hx, hz] = rot(ry, 0, -w / 2);
  const bx = x + hx + cx, bz = z + hz + cz;
  B.add('wood', BOX, bx, y + h / 2, bz, 0, hr, 0, 0.12, h, w, { color: C(color), ao: false });
  for (const f of [0.2, 0.55, 0.85]) B.add('iron', BOX, bx, y + h * f, bz, 0, hr, 0, 0.14, 0.08, w * 0.96, { color: IRON, ao: false });
  const [rx, rz] = rot(hr, 0.09, w * 0.3);
  B.add('gold', TOR, bx + rx, y + h * 0.48, bz + rz, 0, hr + Math.PI / 2, 0, 0.1, 0.1, 0.1, { worldUV: false, ao: false });
}

// Stone statue of a knight or queen on a pedestal (faces +z rotated by ry)
export function statue(B, x, y, z, ry, kind = 'knight', scale = 1) {
  const S = scale;
  const stone = C('#f2eee8');
  const P = (ox, oy, oz) => { const [a, b] = rot(ry, ox * S, oz * S); return [x + a, y + oy * S, z + b]; };
  B.box('stone', x, y, z, 1.6 * S, 1.2 * S, 1.6 * S, ry, { color: TRIM });
  B.box('stone', x, y + 1.2 * S, z, 1.3 * S, 0.2 * S, 1.3 * S, ry, { color: C('#e2d9ce'), collide: false });
  const by = 1.4;
  if (kind === 'queen') {
    let p = P(0, by, 0); B.add('stone', CONE, p[0], p[1] + 1.1 * S, p[2], 0, ry, 0, 0.6 * S, 2.2 * S, 0.55 * S, { color: stone, ao: false });
    p = P(0, by + 2.3, 0); B.add('stone', SPH, p[0], p[1], p[2], 0, ry, 0, 0.3 * S, 0.45 * S, 0.24 * S, { color: stone });
    p = P(0, by + 2.95, 0); B.add('stone', SPH, p[0], p[1], p[2], 0, 0, 0, 0.17 * S, 0.19 * S, 0.17 * S, { color: stone });
    p = P(0, by + 3.12, 0); B.add('gold', CYL8, p[0], p[1], p[2], 0, 0, 0, 0.16 * S, 0.1 * S, 0.16 * S, { ao: false });
    for (const sd of [-1, 1]) {
      p = P(sd * 0.28, by + 2.9, 0.12); B.add('stone', CYL8, p[0], p[1], p[2], 0, ry, sd * 0.5, 0.07 * S, 0.8 * S, 0.07 * S, { color: stone, order: 'YXZ' });
    }
    p = P(0, by + 3.5, 0.2); B.add('crystal', OCTA, p[0], p[1], p[2], 0, 0, 0, 0.2 * S, 0.34 * S, 0.2 * S, { worldUV: false, ao: false });
  } else {
    for (const sd of [-1, 1]) { const p = P(sd * 0.17, by + 0.6, 0); B.add('stone', CYL8, p[0], p[1], p[2], 0, ry, 0, 0.13 * S, 1.2 * S, 0.14 * S, { color: stone }); }
    let p = P(0, by + 1.55, 0); B.add('stone', SPH, p[0], p[1], p[2], 0, ry, 0, 0.36 * S, 0.5 * S, 0.24 * S, { color: stone });
    p = P(0, by + 2.3, 0); B.add('stone', SPH, p[0], p[1], p[2], 0, 0, 0, 0.19 * S, 0.21 * S, 0.19 * S, { color: stone });
    p = P(0, by + 2.55, -0.05); B.add('stone', BOX, p[0], p[1], p[2], 0, ry, 0, 0.04 * S, 0.14 * S, 0.3 * S, { color: stone });
    for (const sd of [-1, 1]) { const q = P(sd * 0.36, by + 1.9, 0); B.add('stone', SPH, q[0], q[1], q[2], 0, ry, 0, 0.17 * S, 0.14 * S, 0.17 * S, { color: stone }); }
    for (const sd of [-1, 1]) { const q = P(sd * 0.2, by + 1.35, 0.22); B.add('stone', CYL8, q[0], q[1], q[2], 0.6, ry, -sd * 0.6, 0.08 * S, 0.55 * S, 0.08 * S, { color: stone, order: 'YXZ' }); }
    // greatsword, point down in front
    p = P(0, by + 0.9, 0.34); B.add('stone', BOX, p[0], p[1], p[2], 0, ry, 0, 0.14 * S, 1.8 * S, 0.04 * S, { color: C('#fbf8f2') });
    p = P(0, by + 1.82, 0.34); B.add('gold', BOX, p[0], p[1], p[2], 0, ry, 0, 0.6 * S, 0.08 * S, 0.08 * S, { ao: false });
    // cape
    p = P(0, by + 1.1, -0.22); B.add('stone', BOX, p[0], p[1], p[2], 0.08, ry, 0, 0.7 * S, 1.9 * S, 0.06 * S, { color: stone, order: 'YXZ' });
  }
}

export function candelabra(B, x, y, z, lights, h = 1.7) {
  B.cyl('gold', x, y, z, 0.05, 0.22, 0.12, 10, { ao: false });
  B.cyl('gold', x, y + 0.1, z, 0.035, 0.05, h, 8, { collide: false, ao: false });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.28;
    const px = x + Math.cos(a) * r * (i ? 1 : 0), pz = z + Math.sin(a) * r * (i ? 1 : 0);
    if (i) B.add('gold', CYL8, x + Math.cos(a) * 0.14, y + h - 0.05, z + Math.sin(a) * 0.14, 0, -a, Math.PI / 2, 0.02, 0.3, 0.02, { ao: false, order: 'YXZ' });
    B.add('plain', CYL8, px, y + h + 0.08 + (i ? 0 : 0.1), pz, 0, 0, 0, 0.035, 0.22, 0.035, { color: C('#fff6e6'), ao: false });
    B.add('lamp', SPH, px, y + h + 0.24 + (i ? 0 : 0.1), pz, 0, 0, 0, 0.035, 0.07, 0.035, { ao: false });
    if (lights) lights.push(new THREE.Vector3(px, y + h + 0.3, pz));
  }
}

export function tapestry(B, x, y, z, ry, w, h, colA, colB, emblem = '#f0c860') {
  B.add('fabric', BOX, x, y - h / 2, z, 0, ry, 0, 0.05, h, w, { color: C(colA), ao: false });
  for (const f of [0.08, 0.92]) B.add('fabric', BOX, x, y - h * f, z, 0, ry, 0, 0.06, h * 0.05, w * 0.96, { color: C(colB), ao: false });
  const [ox, oz] = rot(ry, 0.04, 0);
  B.add('gold', CYL, x + ox, y - h * 0.45, z + oz, 0, ry + Math.PI / 2, Math.PI / 2, w * 0.22, 0.02, w * 0.22, { ao: false, order: 'YXZ' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const [ex, ez] = rot(ry, 0.045, Math.sin(a) * w * 0.3);
    B.add('gold', OCTA, x + ex, y - h * 0.45 + Math.cos(a) * w * 0.3, z + ez, 0, ry, a, 0.04, w * 0.08, 0.02, { ao: false, order: 'YXZ' });
  }
  B.add('gold', CYL8, x, y + 0.05, z, 0, ry, Math.PI / 2, 0.04, w + 0.3, 0.04, { ao: false, order: 'YXZ' });
  // tassels
  for (let i = 0; i < 5; i++) {
    const [tx, tz] = rot(ry, 0, -w / 2 + (i + 0.5) * (w / 5));
    B.add('fabric', CONE, x + tx, y - h - 0.12, z + tz, Math.PI, 0, 0, 0.05, 0.22, 0.05, { color: C(colB), ao: false });
  }
}

export function barrel(B, x, y, z, s = 1, lying = false) {
  if (lying) {
    B.add('wood', CYL, x, y + 0.42 * s, z, 0, 0, Math.PI / 2, 0.42 * s, 1.0 * s, 0.42 * s, { color: WOOD, ao: false });
  } else {
    B.add('wood', new THREE.CylinderGeometry(0.88, 0.88, 1, 14), x, y + 0.5 * s, z, 0, 0, 0, 0.42 * s, 1.0 * s, 0.42 * s, { color: WOOD, ao: false });
    B.add('wood', CYL, x, y + 0.5 * s, z, 0, 0, 0, 0.4 * s, 0.94 * s, 0.4 * s, { color: WOOD, ao: false });
    for (const f of [0.15, 0.85]) B.add('iron', CYL, x, y + f * s, z, 0, 0, 0, 0.405 * s, 0.05 * s, 0.405 * s, { color: IRON, ao: false });
    B.col && B.col.addCylinder(x, z, 0.42 * s, y, y + s);
  }
}

export function crate(B, x, y, z, s = 1, ry = 0) {
  B.box('wood', x, y, z, s, s, s, ry, { color: C('#c49a6c') });
  for (const f of [0.05, 0.95]) B.box('wood', x, y + f * s - 0.04, z, s * 1.02, 0.08, s * 1.02, ry, { color: DARKWOOD, collide: false, ao: false });
}

export function sack(B, x, y, z, s = 1) {
  B.add('fabric', SPH, x, y + 0.3 * s, z, 0, 0, 0, 0.32 * s, 0.34 * s, 0.28 * s, { color: C('#e0cfa8') });
  B.add('fabric', CONE, x, y + 0.7 * s, z, 0, 0, 0, 0.1 * s, 0.14 * s, 0.1 * s, { color: C('#d8c498'), ao: false });
}

export function table(B, x, y, z, ry, w = 2.2, d = 1.2, withDishes = true) {
  B.box('wood', x, y + 0.82, z, w, 0.1, d, ry, { color: C('#b88a60') });
  for (const [lx, lz] of [[-w / 2 + 0.12, -d / 2 + 0.12], [w / 2 - 0.12, -d / 2 + 0.12], [-w / 2 + 0.12, d / 2 - 0.12], [w / 2 - 0.12, d / 2 - 0.12]]) {
    const [ox, oz] = rot(ry, lx, lz);
    B.box('wood', x + ox, y, z + oz, 0.1, 0.82, 0.1, ry, { color: DARKWOOD, collide: false, ao: false });
  }
  B.col && B.col.addBox(x, z, w / 2, d / 2, y, y + 0.92, ry);
  if (!withDishes) return;
  const items = [[-0.6, -0.25], [0.5, 0.2], [0.1, -0.3], [-0.2, 0.3]];
  items.forEach(([lx, lz], i) => {
    const [ox, oz] = rot(ry, lx * w / 2.2, lz);
    const px = x + ox, pz = z + oz;
    if (i % 2 === 0) {
      B.add('plain', CYL, px, y + 0.88, pz, 0, 0, 0, 0.16, 0.02, 0.16, { color: C('#f4efe6'), ao: false });
      B.add('plain', SPH, px, y + 0.93, pz, 0, 0, 0, 0.08, 0.05, 0.08, { color: C(['#e8b060', '#e05a6a', '#9ad37a'][i % 3]), ao: false });
    } else {
      B.add('wood', CYL, px, y + 0.97, pz, 0, 0, 0, 0.06, 0.16, 0.06, { color: C('#9a6a42'), ao: false });
      B.add('plain', CYL, px, y + 1.05, pz, 0, 0, 0, 0.055, 0.01, 0.055, { color: C('#fff4d8'), ao: false });
    }
  });
  const [cx, cz] = rot(ry, 0, 0);
  B.add('plain', CYL8, x + cx, y + 0.95, z + cz, 0, 0, 0, 0.03, 0.14, 0.03, { color: C('#fff6e6'), ao: false });
  B.add('lamp', SPH, x + cx, y + 1.06, z + cz, 0, 0, 0, 0.025, 0.05, 0.025, { ao: false });
}

export function bench(B, x, y, z, ry, len = 2) {
  B.box('wood', x, y + 0.42, z, 0.45, 0.08, len, ry, { color: C('#b88a60') });
  for (const sd of [-1, 1]) {
    const [ox, oz] = rot(ry, 0, sd * (len / 2 - 0.2));
    B.box('wood', x + ox, y, z + oz, 0.4, 0.42, 0.08, ry, { color: DARKWOOD, collide: false, ao: false });
  }
  B.col && B.col.addBox(x, z, 0.22, len / 2, y, y + 0.5, ry);
}

export function bookshelf(B, x, y, z, ry, w = 2, h = 2.4) {
  B.box('wood', x, y, z, 0.45, h, w, ry, { color: C('#7a5238') });
  const cols = ['#b84a5a', '#4a6ab8', '#6a9a4a', '#8a5ab8', '#d8a040', '#4a8a8a', '#c07040'];
  const rows = Math.floor(h / 0.5);
  for (let r = 0; r < rows; r++) {
    let at = -w / 2 + 0.08;
    let k = r * 3;
    while (at < w / 2 - 0.15) {
      const bw = 0.06 + ((k * 7) % 5) * 0.012, bh = 0.3 + ((k * 3) % 4) * 0.03;
      const [ox, oz] = rot(ry, 0.2, at + bw / 2);
      B.add('plain', BOX, x + ox, y + 0.12 + r * 0.5 + bh / 2, z + oz, 0, ry, 0, 0.26, bh, bw, { color: C(cols[k % cols.length]), ao: false });
      at += bw + 0.01;
      k++;
    }
  }
}

export function bottleShelf(B, x, y, z, ry, w = 2, glowy = true) {
  for (let s = 0; s < 3; s++) {
    B.box('wood', x, y + 0.5 + s * 0.6, z, 0.4, 0.06, w, ry, { color: WOOD, collide: false, ao: false });
    for (let i = 0; i < Math.floor(w / 0.22); i++) {
      const [ox, oz] = rot(ry, 0, -w / 2 + 0.15 + i * 0.22);
      const tall = 0.18 + ((i + s) % 3) * 0.06;
      const col = C(['#ff9ecf', '#9fd8ff', '#b8ffb0', '#e2b8ff', '#ffe08a'][(i + s * 2) % 5]);
      B.add(glowy ? 'crystal' : 'plain', CYL8, x + ox, y + 0.56 + s * 0.6 + tall / 2, z + oz, 0, 0, 0, 0.06, tall, 0.06, { color: col, ao: false });
      B.add('wood', CYL8, x + ox, y + 0.56 + s * 0.6 + tall + 0.03, z + oz, 0, 0, 0, 0.025, 0.06, 0.025, { color: DARKWOOD, ao: false });
    }
  }
}

export function pottedTree(B, x, y, z, kind = 'blossom') {
  B.cyl('stone', x, y, z, 0.55, 0.42, 0.7, 12, { color: TRIM });
  B.cyl('wood', x, y + 0.7, z, 0.08, 0.12, 1.4, 6, { color: C('#8a6a52'), collide: false });
  const col = kind === 'blossom' ? ['#f7b7d2', '#fbd0e2', '#f29cc2'] : kind === 'lemon' ? ['#8ec76b', '#a6d372', '#8ec76b'] : ['#c3a8ec', '#d6c2f5', '#b596e6'];
  [[0, 2.4, 0, 0.75], [0.4, 2.15, 0.2, 0.5], [-0.35, 2.2, -0.15, 0.5], [0.1, 2.75, -0.1, 0.45]].forEach(([ox, oy, oz, r], i) => B.sphere('plain', x + ox, y + oy, z + oz, r, { color: C(col[i % 3]), ao: false }));
  if (kind === 'lemon') for (let i = 0; i < 6; i++) B.sphere('plain', x + Math.cos(i) * 0.55, y + 2.2 + (i % 2) * 0.3, z + Math.sin(i) * 0.55, 0.09, { color: C('#ffe066'), ao: false });
}

// climbing roses on a wall face: cluster of blossoms + leaves (plane = local YZ, thin along x)
export function roses(B, x, y, z, ry, w = 2, h = 3, col = '#f7a8c8') {
  const n = Math.floor(w * h * 5);
  for (let i = 0; i < n; i++) {
    const u = Math.random() - 0.5, v = Math.random();
    const taper = 1 - v * 0.6;
    const [ox, oz] = rot(ry, 0.12 + Math.random() * 0.12, u * w * taper);
    const leaf = Math.random() < 0.55;
    B.sphere('plain', x + ox, y + v * h, z + oz, leaf ? 0.14 : 0.11, { color: C(leaf ? (Math.random() < 0.5 ? '#6f9f55' : '#83b563') : (Math.random() < 0.7 ? col : '#ffffff')), ao: false, sx: 1, sy: leaf ? 0.6 : 1 });
  }
}

export function wallLantern(B, x, y, z, ry, lamps) {
  const [ox, oz] = rot(ry, 0.35, 0);
  B.add('iron', BOX, x + ox * 0.5, y + 0.3, z + oz * 0.5, 0, ry, 0, 0.5, 0.05, 0.05, { color: IRON, ao: false });
  B.add('lamp', BOX, x + ox, y, z + oz, 0, ry, 0, 0.26, 0.36, 0.26, { ao: false });
  B.add('iron', CONE, x + ox, y + 0.28, z + oz, 0, Math.PI / 4, 0, 0.24, 0.22, 0.24, { color: IRON, ao: false });
  if (lamps) lamps.push(new THREE.Vector3(x + ox, y, z + oz));
}

export function dummy(B, x, y, z, ry) {
  B.cyl('wood', x, y, z, 0.07, 0.08, 1.9, 6, { color: DARKWOOD });
  B.add('fabric', SPH, x, y + 1.3, z, 0, ry, 0, 0.3, 0.42, 0.22, { color: C('#e8d098') });
  B.add('fabric', SPH, x, y + 1.95, z, 0, 0, 0, 0.18, 0.2, 0.18, { color: C('#e8d098') });
  B.add('wood', CYL8, x, y + 1.55, z, 0, ry, Math.PI / 2, 0.05, 1.2, 0.05, { color: DARKWOOD, order: 'YXZ' });
  const [ox, oz] = rot(ry, 0, 0.25);
  B.add('fabric', CYL, x + ox, y + 1.35, z + oz, Math.PI / 2, ry, 0, 0.12, 0.02, 0.12, { color: C('#e05a6a'), ao: false, order: 'YXZ' });
}

export function grindstone(B, x, y, z, ry) {
  for (const sd of [-1, 1]) { const [ox, oz] = rot(ry, sd * 0.25, 0); B.box('wood', x + ox, y, z + oz, 0.08, 0.9, 0.5, ry, { color: DARKWOOD, collide: false }); }
  B.add('stone', CYL, x, y + 0.9, z, 0, ry, Math.PI / 2, 0.42, 0.14, 0.42, { color: C('#b8b0a8'), order: 'YXZ' });
  B.col && B.col.addCylinder(x, z, 0.5, y, y + 1.3);
}

export function armillary(scene, x, y, z, r = 1.2) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const gold = new THREE.MeshStandardMaterial({ color: 0xf3cf6e, metalness: 0.95, roughness: 0.25 });
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r - i * 0.18, 0.035, 8, 48), gold);
    m.rotation.x = i * 0.9;
    m.rotation.y = i * 0.6;
    g.add(m);
    rings.push(m);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, emissive: 0x7fb8ff, emissiveIntensity: 1.8 }));
  g.add(core);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, y > 0 ? 1.1 : 1, 10), gold);
  stand.position.y = -r - 0.55;
  g.add(stand);
  scene.add(g);
  return (dt) => { rings.forEach((m, i) => { m.rotation.y += dt * (0.2 + i * 0.15); m.rotation.z += dt * 0.1 * (i - 1); }); };
}

export function cart(B, x, y, z, ry) {
  B.box('wood', x, y + 0.6, z, 1.3, 0.12, 2.2, ry, { color: WOOD });
  for (const sd of [-1, 1]) {
    const [ox, oz] = rot(ry, sd * 0.68, 0);
    B.box('wood', x + ox, y + 0.72, z + oz, 0.06, 0.5, 2.2, ry, { color: WOOD, collide: false });
    const [wx, wz] = rot(ry, sd * 0.75, -0.4);
    B.add('wood', CYL, x + wx, y + 0.45, z + wz, 0, ry, Math.PI / 2, 0.45, 0.08, 0.45, { color: DARKWOOD, order: 'YXZ' });
  }
  const [hx, hz] = rot(ry, 0, 1.6);
  B.add('wood', BOX, x + hx, y + 0.5, z + hz, 0, ry, 0, 0.08, 0.08, 1.4, { color: DARKWOOD });
  for (let i = 0; i < 6; i++) {
    const [px, pz] = rot(ry, -0.35 + (i % 2) * 0.7, -0.7 + Math.floor(i / 2) * 0.6);
    B.sphere('plain', x + px, y + 0.85, z + pz, 0.28, { color: C(['#ffd166', '#ff8a8a', '#9ad37a'][i % 3]), ao: false });
  }
}

export function well(B, x, y, z) {
  B.cyl('stone', x, y, z, 1.2, 1.3, 1.0, 16, { color: C('#e6ddd2') });
  for (const sd of [-1, 1]) B.box('wood', x + sd * 1.0, y, z, 0.18, 2.6, 0.18, 0, { color: DARKWOOD, collide: false });
  B.add('wood', CYL8, x, y + 2.2, z, 0, 0, Math.PI / 2, 0.08, 2.1, 0.08, { color: DARKWOOD });
  B.gable('roof', x, y + 2.5, z, 2.8, 1.1, 2.6, 0, { color: C('#e59bb5') });
  B.cyl('wood', x + 0.2, y + 1.2, z, 0.18, 0.15, 0.35, 8, { color: WOOD, collide: false });
}
