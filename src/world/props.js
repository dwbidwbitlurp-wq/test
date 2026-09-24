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

// ======================================================================
// Interior furnishing kit (castle halls, royal wing, tavern rooms, houses)
// Conventions: ry = facing yaw; local +z = front (toward the room / sitter's forward).
// ======================================================================
const HALF_SPH = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const RING = new THREE.TorusGeometry(1, 0.05, 6, 24);
const LATHE_TORSO = new THREE.LatheGeometry([[0.001, -0.42], [0.2, -0.4], [0.23, -0.2], [0.26, 0.0], [0.28, 0.2], [0.25, 0.34], [0.13, 0.42], [0.001, 0.43]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
const KITE = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5); s.quadraticCurveTo(0.42, 0.5, 0.42, 0.18); s.quadraticCurveTo(0.38, -0.2, 0, -0.55); s.quadraticCurveTo(-0.38, -0.2, -0.42, 0.18); s.quadraticCurveTo(-0.42, 0.5, 0, 0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -0.025);
  return g;
})();
const at = (x, z, ry, lx, lz) => { const [ox, oz] = rot(ry, lx, lz); return [x + ox, z + oz]; };

export function torch(B, x, y, z, ry, lamps, fires) {
  const [bx, bz] = at(x, z, ry, 0, 0.12);
  B.add('iron', BOX, bx, y, bz, 0, ry, 0, 0.08, 0.3, 0.2, { color: IRON, ao: false });
  const [hx, hz] = at(x, z, ry, 0, 0.3);
  B.add('wood', CYL8, hx, y + 0.2, hz, -0.35, ry, 0, 0.035, 0.55, 0.035, { color: DARKWOOD, ao: false, order: 'YXZ' });
  const [fx, fz] = at(x, z, ry, 0, 0.4);
  B.add('iron', CYL8, fx, y + 0.44, fz, 0, 0, 0, 0.07, 0.12, 0.05, { color: IRON, ao: false });
  B.add('fire', SPH, fx, y + 0.56, fz, 0, 0, 0, 0.06, 0.13, 0.06, { color: C('#ffb347'), ao: false });
  if (lamps) lamps.push(new THREE.Vector3(fx, y + 0.6, fz));
  if (fires) fires.push(new THREE.Vector3(fx, y + 0.52, fz));
  return new THREE.Vector3(fx, y + 0.8, fz);
}

// bed: length along local z, head at local -z. opts: w, len, canopy, blanket, posts color
export function bed(B, x, y, z, ry, opts = {}) {
  const w = opts.w || 1.4, len = opts.len || 2.2;
  const frame = C(opts.frame || '#8a5c3b');
  const P = (lx, lz) => at(x, z, ry, lx, lz);
  let [px, pz] = P(0, 0);
  B.add('wood', BOX, px, y + 0.25, pz, 0, ry, 0, w, 0.2, len, { color: frame, ao: false });
  for (const [lx, lz] of [[-w / 2 + 0.06, -len / 2 + 0.06], [w / 2 - 0.06, -len / 2 + 0.06], [-w / 2 + 0.06, len / 2 - 0.06], [w / 2 - 0.06, len / 2 - 0.06]]) {
    [px, pz] = P(lx, lz);
    B.add('wood', BOX, px, y + 0.2, pz, 0, ry, 0, 0.1, 0.4, 0.1, { color: frame, ao: false });
  }
  [px, pz] = P(0, 0.05);
  B.add('plain', BOX, px, y + 0.44, pz, 0, ry, 0, w - 0.08, 0.2, len - 0.15, { color: C('#fbf6ee'), ao: false });
  // blanket (folded back at the head)
  [px, pz] = P(0, 0.28);
  B.add('fabric', BOX, px, y + 0.56, pz, 0, ry, 0, w - 0.02, 0.06, len * 0.72, { color: C(opts.blanket || '#c7a6f0'), ao: false });
  [px, pz] = P(0, -len * 0.08);
  B.add('fabric', BOX, px, y + 0.6, pz, 0, ry, 0, w - 0.02, 0.07, 0.25, { color: C(opts.blanket || '#c7a6f0').multiplyScalar(0.85), ao: false });
  for (const s of (w > 1.1 ? [-0.3, 0.3] : [0])) {
    [px, pz] = P(s * w / 1.4, -len / 2 + 0.32);
    B.add('plain', SPH, px, y + 0.62, pz, 0, ry, 0, w > 1.1 ? 0.3 : 0.28, 0.1, 0.18, { color: C('#ffffff'), ao: false });
  }
  // headboard
  [px, pz] = P(0, -len / 2 + 0.04);
  B.add('wood', BOX, px, y + 0.7, pz, 0, ry, 0, w + 0.1, 0.9, 0.08, { color: frame, ao: false });
  B.add(opts.canopy ? 'gold' : 'wood', CYL8, px, y + 1.15, pz, 0, ry, Math.PI / 2, 0.05, w + 0.1, 0.05, { color: opts.canopy ? undefined : frame, ao: false, order: 'YXZ' });
  if (opts.canopy) {
    const H = 2.5;
    for (const [lx, lz] of [[-w / 2, -len / 2], [w / 2, -len / 2], [-w / 2, len / 2], [w / 2, len / 2]]) {
      [px, pz] = P(lx, lz);
      B.add('wood', CYL8, px, y + H / 2, pz, 0, 0, 0, 0.05, H, 0.05, { color: frame, ao: false });
      B.add('gold', SPH, px, y + H + 0.05, pz, 0, 0, 0, 0.07, 0.07, 0.07, { ao: false });
    }
    [px, pz] = P(0, 0);
    B.add('fabric', BOX, px, y + H, pz, 0, ry, 0, w + 0.2, 0.06, len + 0.2, { color: C(opts.canopy), ao: false });
    // draped curtains at the corners + valance
    for (const sd of [-1, 1]) {
      for (const lz of [-len / 2 + 0.2, len / 2 - 0.25]) {
        [px, pz] = P(sd * (w / 2 + 0.04), lz);
        B.add('fabric', BOX, px, y + H / 2 + 0.2, pz, 0, ry, 0, 0.04, H - 0.4, 0.45, { color: C(opts.canopy), ao: false });
      }
      [px, pz] = P(sd * (w / 2 + 0.06), 0);
      B.add('fabric', BOX, px, y + H - 0.2, pz, 0, ry, 0, 0.03, 0.35, len + 0.2, { color: C(opts.canopy).multiplyScalar(0.9), ao: false });
    }
    [px, pz] = P(0, len / 2 + 0.06);
    B.add('fabric', BOX, px, y + H - 0.2, pz, 0, ry, 0, w + 0.2, 0.35, 0.03, { color: C(opts.canopy).multiplyScalar(0.9), ao: false });
    B.add('gold', BOX, px, y + H - 0.4, pz, 0, ry, 0, w + 0.22, 0.03, 0.035, { ao: false });
  }
  B.col && B.col.addBox(x, z, w / 2, len / 2, y, y + 0.62, ry, { walkable: true });
}

export function wardrobe(B, x, y, z, ry, w = 1.4, h = 2.2, color = '#9a6a44') {
  const col = C(color);
  B.box('wood', x, y, z, w, h, 0.6, ry, { color: col });
  const [fx, fz] = at(x, z, ry, 0, 0.31);
  for (const sd of [-1, 1]) {
    const [dx, dz] = at(fx, fz, ry, sd * w / 4, 0);
    B.add('wood', BOX, dx, y + h * 0.52, dz, 0, ry, 0, w / 2 - 0.12, h * 0.78, 0.03, { color: col.clone().multiplyScalar(1.1), ao: false });
    const [kx, kz] = at(fx, fz, ry, sd * 0.08, 0.03);
    B.add('gold', SPH, kx, y + h * 0.52, kz, 0, 0, 0, 0.03, 0.03, 0.03, { ao: false });
  }
  B.add('wood', BOX, x, y + h + 0.06, z, 0, ry, 0, w + 0.12, 0.12, 0.7, { color: col.clone().multiplyScalar(0.8), ao: false });
}

// chair facing ry. returns a seat descriptor
export function chair(B, x, y, z, ry, opts = {}) {
  const col = C(opts.color || '#9a6a44');
  const cushion = opts.cushion ? C(opts.cushion) : null;
  B.add('wood', BOX, x, y + 0.46, z, 0, ry, 0, 0.46, 0.05, 0.46, { color: col, ao: false });
  if (cushion) B.add('fabric', BOX, x, y + 0.5, z, 0, ry, 0, 0.42, 0.05, 0.42, { color: cushion, ao: false });
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    const [px, pz] = at(x, z, ry, lx, lz);
    B.add('wood', BOX, px, y + 0.22, pz, 0, ry, 0, 0.05, 0.44, 0.05, { color: col.clone().multiplyScalar(0.8), ao: false });
  }
  const bh = opts.high ? 1.2 : 0.55;
  const [bx, bz] = at(x, z, ry, 0, -0.21);
  B.add('wood', BOX, bx, y + 0.48 + bh / 2, bz, 0, ry, 0, 0.44, bh, 0.05, { color: col, ao: false });
  if (cushion && opts.high) { const [cx, cz] = at(x, z, ry, 0, -0.18); B.add('fabric', BOX, cx, y + 0.5 + bh / 2, cz, 0, ry, 0, 0.36, bh - 0.2, 0.03, { color: cushion, ao: false }); }
  if (opts.high) B.add('gold', SPH, bx, y + 0.5 + bh, bz, 0, 0, 0, 0.05, 0.05, 0.05, { ao: false });
  B.col && B.col.addBox(x, z, 0.23, 0.23, y, y + 0.5, ry, { walkable: true });
  return { t: 'seat', x, y, z, face: ry, h: 0.5 };
}

export function rug(B, x, y, z, ry, w, d, colA = '#c94f7c', colB = '#f0c860') {
  B.add('fabric', BOX, x, y + 0.012, z, 0, ry, 0, w, 0.02, d, { color: C(colB), ao: false, worldUV: false });
  B.add('fabric', BOX, x, y + 0.02, z, 0, ry, 0, w - 0.3, 0.02, d - 0.3, { color: C(colA), ao: false, worldUV: false });
  B.add('fabric', BOX, x, y + 0.028, z, 0, ry, 0, w * 0.4, 0.02, d * 0.4, { color: C(colB).lerp(C(colA), 0.5), ao: false, worldUV: false });
}

// fireplace against a wall; opening faces local +z
export function fireplace(B, x, y, z, ry, w, lamps, fires, opts = {}) {
  const stone = C(opts.color || '#e2d6c8');
  const P = (lx, lz) => at(x, z, ry, lx, lz);
  for (const sd of [-1, 1]) { const [px, pz] = P(sd * (w / 2 - 0.25), 0); B.box('stone', px, y, pz, 0.5, 1.5, 0.9, ry, { color: stone }); }
  let [px, pz] = P(0, 0);
  B.box('stone', px, y + 1.5, pz, w, 0.5, 0.95, ry, { color: stone });
  [px, pz] = P(0, 0.12);
  B.box('stone', px, y + 2.0, pz, w + 0.3, 0.14, 1.1, ry, { color: TRIM, collide: false });
  [px, pz] = P(0, -0.1);
  B.box('stone', px, y + 2.14, pz, w - 0.4, opts.hood ?? 2.4, 0.7, ry, { color: stone, collide: false });
  [px, pz] = P(0, -0.25);
  B.box('stone', px, y, pz, w - 1, 1.5, 0.3, ry, { color: C('#4a4048'), collide: false });
  [px, pz] = P(0, 0.05);
  B.box('stone', px, y, pz, w - 0.9, 0.12, 0.8, ry, { color: C('#6a5a58'), collide: false });
  for (let i = 0; i < 3; i++) {
    const [lx, lz] = P(-0.3 + i * 0.3, 0.05);
    B.add('wood', CYL8, lx, y + 0.2, lz, 0, ry + 0.3 * (i - 1), Math.PI / 2, 0.08, 0.8, 0.08, { color: DARKWOOD, ao: false, order: 'YXZ' });
  }
  [px, pz] = P(0, 0.05);
  B.add('fire', SPH, px, y + 0.4, pz, 0, ry, 0, 0.45, 0.3, 0.2, { color: C('#ffb347'), ao: false });
  if (fires) fires.push(new THREE.Vector3(px, y + 0.25, pz));
  if (lamps) lamps.push(new THREE.Vector3(px, y + 0.6, pz));
  // mantle decor
  if (opts.decor !== false) {
    for (let i = 0; i < 3; i++) {
      const [cx, cz] = P(-w / 2 + 0.5 + i * (w - 1) / 2, 0.35);
      if (i === 1) B.add('crystal', OCTA, cx, y + 2.35, cz, 0, 0, 0, 0.1, 0.2, 0.1, { ao: false, worldUV: false });
      else { B.add('plain', CYL8, cx, y + 2.28, cz, 0, 0, 0, 0.03, 0.16, 0.03, { color: C('#fff6e6'), ao: false }); B.add('lamp', SPH, cx, y + 2.4, cz, 0, 0, 0, 0.02, 0.04, 0.02, { ao: false }); }
    }
  }
  return new THREE.Vector3(px, y + 0.9, pz);
}

// row of iron bars from (x0,z0) to (x1,z1) with a collider; gaps: [{at, w}] along the row (0..len)
export function bars(B, x0, z0, x1, z1, y, h, gaps = []) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
  const n = Math.floor(len / 0.22);
  for (let i = 0; i <= n; i++) {
    const d = (i / n) * len;
    if (gaps.some((g) => Math.abs(d - g.at) < g.w / 2)) continue;
    B.add('iron', CYL8, x0 + (x1 - x0) * (d / len), y + h / 2, z0 + (z1 - z0) * (d / len), 0, 0, 0, 0.028, h, 0.028, { color: C('#4a4e5a'), ao: false });
  }
  for (const f of [0.08, 0.5, 0.95]) B.add('iron', BOX, (x0 + x1) / 2, y + h * f, (z0 + z1) / 2, 0, ang, 0, 0.06, 0.06, len, { color: C('#3e424c'), ao: false });
  if (!B.col) return;
  let cur = 0;
  const cuts = gaps.map((g) => [g.at - g.w / 2, g.at + g.w / 2]).sort((a, b) => a[0] - b[0]);
  for (const [a, b] of cuts.concat([[len, len]])) {
    if (a - cur > 0.05) {
      const m = (cur + a) / 2;
      B.col.addBox(x0 + (x1 - x0) * (m / len), z0 + (z1 - z0) * (m / len), 0.08, (a - cur) / 2, y, y + h, ang);
    }
    cur = b;
  }
}

export function weaponRack(B, x, y, z, ry, w = 2.2) {
  B.box('wood', x, y, z, w, 0.12, 0.5, ry, { color: DARKWOOD, collide: false });
  const [tx, tz] = at(x, z, ry, 0, -0.12);
  B.add('wood', BOX, tx, y + 1.5, tz, 0, ry, 0, w, 0.1, 0.12, { color: DARKWOOD, ao: false });
  for (const sd of [-1, 1]) { const [px, pz] = at(x, z, ry, sd * (w / 2 - 0.05), -0.12); B.add('wood', BOX, px, y + 0.8, pz, 0, ry, 0, 0.1, 1.6, 0.1, { color: DARKWOOD, ao: false }); }
  const n = Math.floor(w / 0.32);
  for (let i = 0; i < n; i++) {
    const lx = -w / 2 + 0.25 + i * ((w - 0.5) / Math.max(1, n - 1));
    const [px, pz] = at(x, z, ry, lx, 0);
    const kind = i % 3;
    if (kind === 0) { // sword
      B.add('iron', BOX, px, y + 0.85, pz, -0.12, ry, 0, 0.05, 1.1, 0.012, { color: C('#e6ebf4'), ao: false, order: 'YXZ' });
      B.add('gold', BOX, px, y + 1.42, pz - 0.0, -0.12, ry, 0, 0.26, 0.04, 0.04, { ao: false, order: 'YXZ' });
      B.add('wood', CYL8, px, y + 1.55, pz, -0.12, ry, 0, 0.02, 0.2, 0.02, { color: C('#4a3024'), ao: false, order: 'YXZ' });
    } else if (kind === 1) { // spear
      B.add('wood', CYL8, px, y + 1.1, pz, -0.1, ry, 0, 0.022, 2.1, 0.022, { color: C('#8a6a52'), ao: false, order: 'YXZ' });
      B.add('iron', OCTA, px, y + 2.2, pz - 0.1, -0.1, ry, 0, 0.05, 0.18, 0.015, { color: C('#e6ebf4'), ao: false, order: 'YXZ' });
    } else { // axe
      B.add('wood', CYL8, px, y + 0.75, pz, -0.14, ry, 0, 0.025, 1.4, 0.025, { color: C('#8a6a52'), ao: false, order: 'YXZ' });
      B.add('iron', BOX, px, y + 1.32, pz, -0.14, ry, 0, 0.26, 0.2, 0.025, { color: C('#d8dde6'), ao: false, order: 'YXZ' });
    }
  }
}

// kite shield on a wall (face local +z)
export function shield(B, x, y, z, ry, color = '#6f7fd8') {
  B.add('plain', KITE, x, y, z, 0, ry, 0, 1, 1, 1, { color: C(color), ao: false, worldUV: false });
  const [fx, fz] = at(x, z, ry, 0, 0.05);
  B.add('gold', CYL, fx, y + 0.05, fz, Math.PI / 2, ry, 0, 0.13, 0.02, 0.13, { ao: false, order: 'YXZ' });
  B.add('gold', BOX, fx, y - 0.05, fz, 0, ry, 0, 0.05, 0.8, 0.02, { ao: false });
  B.add('gold', BOX, fx, y + 0.12, fz, 0, ry, 0, 0.6, 0.05, 0.02, { ao: false });
}

export function armorStand(B, x, y, z, ry, color = '#e8ecf4', trim = '#f0c860') {
  B.cyl('wood', x, y, z, 0.3, 0.32, 0.08, 10, { color: DARKWOOD });
  B.cyl('wood', x, y, z, 0.04, 0.05, 1.75, 6, { color: DARKWOOD, collide: false });
  B.add('iron', LATHE_TORSO, x, y + 1.2, z, 0, ry, 0, 1.05, 1, 0.8, { color: C(color), worldUV: false, ao: false });
  for (const sd of [-1, 1]) {
    const [px, pz] = at(x, z, ry, sd * 0.3, 0);
    B.add('iron', HALF_SPH, px, y + 1.52, pz, 0, ry, sd * 0.5, 0.17, 0.12, 0.17, { color: C(color), worldUV: false, ao: false });
    B.add('gold', RING, px, y + 1.52, pz, Math.PI / 2, ry, sd * 0.5, 0.17, 0.17, 0.17, { worldUV: false, ao: false, order: 'YXZ' });
  }
  B.add('gold', BOX, x, y + 1.25, z, 0, ry, 0, 0.5, 0.04, 0.46, { ao: false });
  B.add('iron', SPH, x, y + 1.88, z, 0, ry, 0, 0.15, 0.17, 0.16, { color: C(color), ao: false });
  const [vx, vz] = at(x, z, ry, 0, 0.13);
  B.add('iron', BOX, vx, y + 1.88, vz, 0, ry, 0, 0.18, 0.025, 0.04, { color: C('#2a2e38'), ao: false });
  B.add('gold', CONE, x, y + 2.08, z, 0, 0, 0, 0.04, 0.12, 0.04, { ao: false });
  const [cx, cz] = at(x, z, ry, 0, -0.18);
  B.add('fabric', BOX, cx, y + 1.0, cz, 0.05, ry, 0, 0.5, 1.0, 0.03, { color: C(trim === '#f0c860' ? '#e89ac0' : trim), ao: false, order: 'YXZ' });
}

// framed painting on a wall (canvas faces local +z). kind: 'land' | 'portrait' | 'sea'
export function painting(B, x, y, z, ry, w = 1.2, h = 0.9, kind = 'land') {
  B.add('gold', BOX, x, y, z, 0, ry, 0, w + 0.12, h + 0.12, 0.05, { ao: false });
  const [fx, fz] = at(x, z, ry, 0, 0.03);
  const band = (yy, hh, col) => B.add('plain', BOX, fx, y + yy, fz, 0, ry, 0, w, hh, 0.012, { color: C(col), ao: false });
  if (kind === 'portrait') {
    band(0, h, '#6a5a7a');
    const [px, pz] = at(x, z, ry, 0, 0.045);
    B.add('plain', SPH, px, y + 0.12 * h, pz, 0, ry, 0, 0.12 * w, 0.16 * h, 0.01, { color: C('#f2d2bc'), ao: false });
    B.add('plain', SPH, px, y - 0.3 * h, pz, 0, ry, 0, 0.3 * w, 0.22 * h, 0.01, { color: C('#e89ac0'), ao: false });
    B.add('plain', SPH, px, y + 0.24 * h, pz, 0, ry, 0, 0.14 * w, 0.1 * h, 0.012, { color: C('#e8c070'), ao: false });
  } else {
    band(h * 0.25, h * 0.5, kind === 'sea' ? '#9fd0f2' : '#bcd8f5');
    band(h * 0.05, h * 0.12, '#f7d6e6');
    band(-h * 0.2, h * 0.3, kind === 'sea' ? '#5aa0d0' : '#9ac878');
    band(-h * 0.4, h * 0.2, kind === 'sea' ? '#f0e0c0' : '#e8a8c8');
    const [px, pz] = at(x, z, ry, w * 0.25, 0.04);
    B.add('lamp', CYL, px, y + h * 0.28, pz, Math.PI / 2, ry, 0, 0.08 * w, 0.01, 0.08 * w, { ao: false, order: 'YXZ' });
    if (kind === 'land') { const [cx, cz] = at(x, z, ry, -w * 0.2, 0.04); B.add('plain', CONE, cx, y + h * 0.05, cz, 0, ry, 0, 0.12 * w, 0.4 * h, 0.01, { color: C('#f6f0ff'), ao: false }); }
  }
}

export function vanity(B, x, y, z, ry) {
  B.box('wood', x, y, z, 1.2, 0.8, 0.5, ry, { color: C('#f2e8dc') });
  for (const sd of [-1, 1]) { const [px, pz] = at(x, z, ry, sd * 0.3, 0.26); B.add('gold', SPH, px, y + 0.55, pz, 0, 0, 0, 0.025, 0.025, 0.025, { ao: false }); }
  const [mx, mz] = at(x, z, ry, 0, -0.18);
  B.add('gold', CYL, mx, y + 1.35, mz, Math.PI / 2, ry, 0, 0.36, 0.04, 0.46, { ao: false, order: 'YXZ' });
  const [gx, gz] = at(x, z, ry, 0, -0.15);
  B.add('crystal', CYL, gx, y + 1.35, gz, Math.PI / 2, ry, 0, 0.31, 0.02, 0.41, { color: C('#eef6ff'), ao: false, order: 'YXZ' });
  const cols = ['#ff9ecf', '#b8e0ff', '#ffe08a'];
  for (let i = 0; i < 3; i++) { const [px, pz] = at(x, z, ry, -0.4 + i * 0.15, 0.08); B.add('crystal', SPH, px, y + 0.87, pz, 0, 0, 0, 0.04, 0.06, 0.04, { color: C(cols[i]), ao: false }); }
}

// bougainvillea: magenta/pink cascade hanging from (x, y, z) down to y - h, spread w along local z
export function bougainvillea(B, x, y, z, ry, w = 2, h = 2, dense = 1) {
  const cols = ['#e8409a', '#f062b0', '#ff8ac8', '#d83a8a', '#ffb0d8'];
  // clusters of small papery bracts along hanging strands, with leaves between
  const strands = Math.max(3, Math.floor(w * 3.2 * dense));
  for (let k = 0; k < strands; k++) {
    const u = (k + Math.random() * 0.8) / strands - 0.5;
    const len = h * (0.45 + Math.random() * 0.55);
    const n = Math.floor(len * 14);
    for (let i = 0; i < n; i++) {
      const v = (i / n) * len;
      const sway = Math.sin(v * 2.1 + k) * 0.12;
      const [ox, oz] = rot(ry, 0.1 + Math.random() * 0.16 + v * 0.02, u * w + sway + (Math.random() - 0.5) * 0.25);
      const leaf = Math.random() < 0.28;
      B.sphere('plain', x + ox, y - v, z + oz, leaf ? 0.07 : 0.045 + Math.random() * 0.04, { color: C(leaf ? (Math.random() < 0.5 ? '#5f9a4a' : '#78b060') : cols[Math.floor(Math.random() * cols.length)]), ao: false, sy: leaf ? 0.55 : 0.8 });
    }
  }
}

export function pergola(B, x, y, z, ry, w, d, h = 2.8) {
  const P = (lx, lz) => at(x, z, ry, lx, lz);
  for (const lx of [-w / 2, 0, w / 2]) for (const lz of [-d / 2, d / 2]) {
    const [px, pz] = P(lx, lz);
    B.cyl('stone', px, y, pz, 0.12, 0.15, h, 10, { color: C('#f4efe8') });
  }
  for (const lz of [-d / 2, d / 2]) { const [px, pz] = P(0, lz); B.add('wood', BOX, px, y + h + 0.08, pz, 0, ry, 0, w + 0.5, 0.16, 0.14, { color: C('#f4efe8'), ao: false }); }
  for (let i = 0; i <= Math.round(w / 0.6); i++) {
    const [px, pz] = P(-w / 2 - 0.1 + i * 0.6, 0);
    B.add('wood', BOX, px, y + h + 0.2, pz, 0, ry, 0, 0.08, 0.1, d + 0.5, { color: C('#f4efe8'), ao: false });
  }
  const cols = ['#e8409a', '#f062b0', '#ff8ac8', '#d83a8a', '#ffb0d8', '#6f9f55'];
  for (let i = 0; i < w * d * 22; i++) {
    const [px, pz] = P((Math.random() - 0.5) * (w + 0.6), (Math.random() - 0.5) * (d + 0.6));
    B.sphere('plain', px, y + h + 0.18 + Math.random() * 0.28, pz, 0.06 + Math.random() * 0.06, { color: C(cols[Math.floor(Math.random() * cols.length)]), ao: false, sy: 0.8 });
  }
  for (const lz of [-d / 2, d / 2]) { const [px, pz] = P(0, lz); bougainvillea(B, px, y + h + 0.15, pz, ry + Math.PI / 2, w, 1.3, 0.6); }
}

// huge wine tun lying on a cradle, face toward local +z
export function tun(B, x, y, z, ry, r = 1.2, len = 2.2) {
  B.box('wood', x, y, z, r * 1.6, 0.35, len * 0.8, ry, { color: DARKWOOD, collide: false });
  B.add('wood', new THREE.CylinderGeometry(1, 1, 1, 20), x, y + r + 0.2, z, Math.PI / 2, ry, 0, r, len, r, { color: C('#b07a4c'), order: 'YXZ' });
  for (const f of [-0.42, -0.15, 0.15, 0.42]) {
    const [px, pz] = at(x, z, ry, 0, f * len);
    B.add('iron', new THREE.CylinderGeometry(1, 1, 1, 20), px, y + r + 0.2, pz, Math.PI / 2, ry, 0, r + 0.02, 0.07, r + 0.02, { color: IRON, ao: false, order: 'YXZ' });
  }
  const [fx, fz] = at(x, z, ry, 0, len / 2 + 0.01);
  B.add('wood', new THREE.CylinderGeometry(1, 1, 1, 20), fx, y + r + 0.2, fz, Math.PI / 2, ry, 0, r * 0.94, 0.03, r * 0.94, { color: C('#8a5a38'), ao: false, order: 'YXZ' });
  const [sx, sz] = at(x, z, ry, 0, len / 2 + 0.12);
  B.add('gold', CYL8, sx, y + 0.6, sz, Math.PI / 2, ry, 0, 0.05, 0.25, 0.05, { ao: false, order: 'YXZ' });
  B.add('gold', CYL, fx, y + r + 0.2, fz, Math.PI / 2, ry, 0, r * 0.3, 0.05, r * 0.3, { ao: false, order: 'YXZ' });
  B.col && B.col.addBox(x, z, r, len / 2, y, y + r * 2 + 0.2, ry);
}

// wine rack: diamond-ish grid with bottle ends facing local +z
export function wineRack(B, x, y, z, ry, w = 2, h = 2) {
  B.box('wood', x, y, z, w, h, 0.5, ry, { color: DARKWOOD });
  const cols = Math.floor(w / 0.2), rows = Math.floor(h / 0.2);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if ((i * 7 + j * 3) % 5 === 0) continue;
    const [px, pz] = at(x, z, ry, -w / 2 + 0.1 + i * 0.2, 0.26);
    B.add('plain', CYL8, px, y + 0.12 + j * 0.2, pz, Math.PI / 2, ry, 0, 0.055, 0.03, 0.055, { color: C((i + j) % 3 ? '#4a1a2a' : '#2a3a1a'), ao: false, order: 'YXZ' });
  }
}

export function straw(B, x, y, z, w = 1.6, d = 1.2) {
  for (let i = 0; i < 10; i++) B.sphere('plain', x + (Math.random() - 0.5) * w, y + 0.04, z + (Math.random() - 0.5) * d, 0.35 + Math.random() * 0.2, { color: C(Math.random() < 0.5 ? '#e8cf7a' : '#d8bb62'), sy: 0.18, ao: false });
}

export function chains(B, x, y, z, ry) {
  for (const sd of [-0.3, 0.3]) {
    const [px, pz] = at(x, z, ry, sd, 0.06);
    B.add('iron', BOX, px, y, pz, 0, ry, 0, 0.08, 0.08, 0.06, { color: C('#3a3e48'), ao: false });
    for (let k = 0; k < 5; k++) B.add('iron', RING, px, y - 0.1 - k * 0.1, pz, 0, ry + (k % 2) * Math.PI / 2, 0, 0.05, 0.05, 0.05, { color: C('#4a4e58'), ao: false, worldUV: false });
    B.add('iron', RING, px, y - 0.62, pz, Math.PI / 2, 0, 0, 0.09, 0.09, 0.09, { color: C('#4a4e58'), ao: false, worldUV: false });
  }
}

export function lectern(B, x, y, z, ry) {
  B.cyl('wood', x, y, z, 0.25, 0.3, 0.08, 8, { color: DARKWOOD });
  B.cyl('wood', x, y, z, 0.07, 0.09, 1.0, 8, { color: DARKWOOD, collide: false });
  B.add('wood', BOX, x, y + 1.08, z, -0.35, ry, 0, 0.55, 0.05, 0.42, { color: C('#8a5c3b'), ao: false, order: 'YXZ' });
  return new THREE.Vector3(x, y + 1.13, z);
}

export function chandelier(B, x, y, z, r, lamps, ceilY) {
  B.add('gold', RING, x, y, z, Math.PI / 2, 0, 0, r, r, r, { worldUV: false, ao: false });
  B.add('gold', RING, x, y + 0.3, z, Math.PI / 2, 0, 0, r * 0.6, r * 0.6, r * 0.6, { worldUV: false, ao: false });
  const n = Math.max(6, Math.round(r * 6));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    B.add('plain', CYL8, px, y + 0.1, pz, 0, 0, 0, 0.03, 0.18, 0.03, { color: C('#fff6e6'), ao: false });
    B.add('lamp', SPH, px, y + 0.24, pz, 0, 0, 0, 0.025, 0.05, 0.025, { ao: false });
    if (lamps && i % 3 === 0) lamps.push(new THREE.Vector3(px, y + 0.25, pz));
  }
  B.add('crystal', OCTA, x, y - 0.3, z, 0, 0, 0, 0.12, 0.3, 0.12, { ao: false, worldUV: false });
  if (ceilY) B.add('gold', CYL8, x, (y + ceilY) / 2, z, 0, 0, 0, 0.02, ceilY - y, 0.02, { ao: false });
}

export function vase(B, x, y, z, col = '#f7a8c8') {
  B.add('plain', new THREE.LatheGeometry([[0.001, 0], [0.09, 0.02], [0.12, 0.12], [0.08, 0.26], [0.06, 0.3], [0.08, 0.34]].map(([r, yy]) => new THREE.Vector2(r, yy)), 12), x, y, z, 0, 0, 0, 1, 1, 1, { color: C('#eef2fb'), ao: false, worldUV: false });
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9, r = 0.06 + (i % 3) * 0.04;
    B.sphere('plain', x + Math.cos(a) * r, y + 0.42 + (i % 2) * 0.06, z + Math.sin(a) * r, 0.05, { color: C(i % 3 ? col : '#ffffff'), ao: false });
  }
  for (let i = 0; i < 4; i++) B.sphere('plain', x + Math.cos(i * 1.6) * 0.12, y + 0.36, z + Math.sin(i * 1.6) * 0.12, 0.05, { color: C('#6f9f55'), ao: false, sy: 0.5 });
}

export function goldPile(B, x, y, z, r = 0.8) {
  B.sphere('gold', x, y, z, r, { sy: 0.35, ao: false });
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (0.6 + Math.random() * 0.7);
    B.add('gold', CYL8, x + Math.cos(a) * d, y + 0.02 + Math.random() * 0.1, z + Math.sin(a) * d, Math.random() * 0.6, Math.random() * 3, 0, 0.05, 0.012, 0.05, { ao: false });
  }
  for (let i = 0; i < 3; i++) B.add(i % 2 ? 'crystalPink' : 'crystal', OCTA, x + (Math.random() - 0.5) * r, y + r * 0.3, z + (Math.random() - 0.5) * r, 0, Math.random() * 3, 0.3, 0.07, 0.1, 0.07, { ao: false, worldUV: false });
}

// open treasure chest (static)
export function openChest(B, x, y, z, ry) {
  B.box('wood', x, y, z, 1.0, 0.5, 0.62, ry, { color: C('#8a5c3b') });
  for (const sd of [-0.38, 0.38]) { const [px, pz] = at(x, z, ry, sd, 0); B.add('gold', BOX, px, y + 0.25, pz, 0, ry, 0, 0.08, 0.52, 0.64, { ao: false }); }
  const [lx, lz] = at(x, z, ry, 0, -0.42);
  B.add('wood', BOX, lx, y + 0.78, lz, 0.25, ry, 0, 1.0, 0.56, 0.08, { color: C('#8a5c3b'), ao: false, order: 'YXZ' });
  B.sphere('gold', x, y + 0.5, z, 0.42, { sx: 1.1, sy: 0.3, sz: 0.65, ao: false });
}

export function crownDisplay(B, x, y, z) {
  B.cyl('stone', x, y, z, 0.35, 0.42, 1.0, 12, { color: C('#f4efe8') });
  B.box('fabric', x, y + 1.0, z, 0.6, 0.16, 0.6, 0, { color: C('#b8407a'), collide: false });
  B.add('gold', new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), x, y + 1.3, z, 0, 0, 0, 0.18, 0.16, 0.18, { ao: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    B.add('gold', CONE, x + Math.sin(a) * 0.18, y + 1.46, z + Math.cos(a) * 0.18, 0, 0, 0, 0.04, 0.12, 0.04, { ao: false });
    if (i % 2 === 0) B.add(i % 4 ? 'crystalPink' : 'crystal', OCTA, x + Math.sin(a) * 0.185, y + 1.3, z + Math.cos(a) * 0.185, 0, a, 0, 0.03, 0.045, 0.03, { ao: false, worldUV: false });
  }
}

export function pot(B, x, y, z, r = 0.3, col = '#5a5e6a') {
  B.add('iron', new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), x, y + r * 0.85, z, 0, 0, 0, r, r, r, { color: C(col), ao: false });
  B.add('iron', RING, x, y + r * 1.3, z, Math.PI / 2, 0, 0, r * 0.8, r * 0.8, r * 0.8, { color: C(col), ao: false, worldUV: false });
}

export function hangingHerbs(B, x, y, z, ry, n = 5) {
  const [ax, az] = at(x, z, ry, 0, 0);
  B.add('wood', CYL8, ax, y, az, 0, ry, Math.PI / 2, 0.025, n * 0.35, 0.025, { color: DARKWOOD, ao: false, order: 'YXZ' });
  for (let i = 0; i < n; i++) {
    const [px, pz] = at(x, z, ry, 0, -n * 0.175 + 0.175 + i * 0.35);
    const col = ['#7aa65a', '#b8a060', '#9a7ac8', '#c8b050', '#6a9a6a'][i % 5];
    B.add('plain', CONE, px, y - 0.28, pz, Math.PI, 0, 0, 0.1, 0.45, 0.1, { color: C(col), ao: false });
    if (i % 2) B.add('plain', SPH, px, y - 0.5, pz, 0, 0, 0, 0.06, 0.06, 0.06, { color: C('#f7a8c8'), ao: false });
  }
}

export function stool(B, x, y, z) {
  B.add('wood', CYL, x, y + 0.45, z, 0, 0, 0, 0.2, 0.05, 0.2, { color: C('#a47650'), ao: false });
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; B.add('wood', CYL8, x + Math.cos(a) * 0.13, y + 0.22, z + Math.sin(a) * 0.13, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12, 0.022, 0.45, 0.022, { color: DARKWOOD, ao: false }); }
  return { t: 'seat', x, y, z, face: 0, h: 0.48, free: true };
}
