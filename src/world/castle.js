// Lumenhold — the multi-level castle of light.
// Levels: lower ward (market/town) -> grand stair -> upper ward (gardens/chapel)
// -> keep throne room + gallery -> keep roof -> mage spire observatory (levitation disc).
import * as THREE from 'three';
import { Builder, getMaterials } from './builder.js';
import { CASTLE } from './layout.js';
import * as PR from './props.js';

const C = (h) => new THREE.Color(h);
const WHITE = C('#eee7dc');
const TRIM = C('#ddd2c3');
const WARM = C('#fff4e6');
const ROOF_BLUE = C('#7d97d8');
const ROOF_LILAC = C('#a894d8');
const ROOF_TEAL = C('#6fb3c6');
const ROOF_ROSE = C('#e59bb5');
const ROOF_GOLD = C('#f0c96a');
const WOOD = C('#b58962');

export const CASTLE_DIM = {
  wallX: 75, wallZ: 70, wallH: 14, wallT: 3,
  terraceH: 10, terraceX: 44, terraceZ0: -68.5, terraceZ1: -6,
  keepX: 18, keepZ0: -60, keepZ1: -32, keepH: 16,
  mezzY: 17, roofY: 26, spireTop: 84, obsY: 74,
};

export function buildCastle(scene, collision) {
  const B = new Builder(collision);
  const P = CASTLE.y;
  const OX = CASTLE.x, OZ = CASTLE.z;
  const D = CASTLE_DIM;
  const lamps = []; // world positions of lamps (for night lights/particles)
  const interactables = [];
  const spawn = {}; // named positions for NPCs etc

  // local -> world
  const X = (x) => OX + x;
  const Z = (z) => OZ + z;
  const Y = (y) => P + y;

  // ---------- helpers ----------
  const merlons = (x0, z0, x1, z1, y, outwardX, outwardZ, mat = 'stone') => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const n = Math.floor(len / 2.2);
    for (let i = 0; i <= n; i++) {
      const t = (i + 0.5) / (n + 1);
      const x = x0 + (x1 - x0) * t + outwardX, z = z0 + (z1 - z0) * t + outwardZ;
      B.box(mat, X(x), Y(y), Z(z), 0.7, 1.3, 1.1, ang, { color: TRIM, collide: false });
    }
    // low parapet collider along the edge
    const mx = (x0 + x1) / 2 + outwardX, mz = (z0 + z1) / 2 + outwardZ;
    B.box(mat, X(mx), Y(y), Z(mz), 0.7, 0.55, len, ang, { color: TRIM, walkable: false });
  };

  // straight wall segment (thick box), walkable top + merlons on outside
  const wall = (x0, z0, x1, z1, h, t, outSign, y0 = 0) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    B.box('stone', X(cx), Y(y0 - 4), Z(cz), t, h + 4, len, ang, { color: WHITE, aoBase: Y(y0) });
    // cornice
    B.box('stone', X(cx), Y(y0 + h - 0.35), Z(cz), t + 0.5, 0.35, len, ang, { color: TRIM, collide: false });
    // outward normal
    const nx = Math.cos(ang) * outSign, nz = -Math.sin(ang) * outSign;
    merlons(x0, z0, x1, z1, y0 + h, nx * (t / 2 - 0.35), nz * (t / 2 - 0.35));
    // arrow slits / decorative bands on outer face
    const n = Math.floor(len / 8);
    for (let i = 1; i < n; i++) {
      const tt = i / n;
      const x = x0 + (x1 - x0) * tt + nx * (t / 2 + 0.02), z = z0 + (z1 - z0) * tt + nz * (t / 2 + 0.02);
      B.box('window', X(x), Y(y0 + h * 0.55), Z(z), 0.12, 1.8, 0.5, ang, { collide: false, color: C('#ffffff') });
    }
  };

  // round tower. type: 'open' (belvedere on top of wall height), 'closed'
  const tower = (x, z, r, h, opts = {}) => {
    const roofC = opts.roof || ROOF_BLUE;
    const base = opts.y0 ?? 0;
    if (opts.open) {
      // solid base up to walkway level, open pavilion above
      const walkY = opts.walkY;
      B.cyl('stone', X(x), Y(base - 4), Z(z), r, r * 1.06, walkY - base + 4, 24, { color: WHITE, aoBase: Y(base) });
      B.cyl('stone', X(x), Y(walkY - 0.4), Z(z), r + 0.35, r + 0.35, 0.4, 24, { color: TRIM, collide: false });
      // parapet ring
      const segs = 14;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const px = x + Math.sin(a) * (r - 0.3), pz = z + Math.cos(a) * (r - 0.3);
        const w = 2 * r * Math.tan(Math.PI / segs);
        if ((opts.gaps || []).some((g) => Math.abs(angleWrap(a - g)) < 0.42)) continue;
        B.box('stone', X(px), Y(walkY), Z(pz), 0.55, 1.0, w * 0.98, a + Math.PI / 2, { color: TRIM, walkable: false });
        if (i % 2 === 0) B.box('stone', X(px), Y(walkY + 1), Z(pz), 0.6, 0.7, w * 0.6, a + Math.PI / 2, { color: TRIM, collide: false });
      }
      // pillars + roof
      const pillarsN = 6;
      const topY = walkY + (opts.pavH || 6);
      for (let i = 0; i < pillarsN; i++) {
        const a = (i / pillarsN) * Math.PI * 2 + Math.PI / pillarsN;
        B.cyl('stone', X(x + Math.sin(a) * (r - 0.6)), Y(walkY), Z(z + Math.cos(a) * (r - 0.6)), 0.3, 0.35, topY - walkY, 8, { color: WHITE });
      }
      B.cyl('stone', X(x), Y(topY), Z(z), r + 0.2, r - 0.2, 1.0, 24, { color: TRIM, collide: false });
      const orh = (opts.roofH || r * 2.2) * 1.35;
      B.cone('roof', X(x), Y(topY + 1), Z(z), r + 1.0, orh, 24, { color: roofC });
      B.cyl('gold', X(x), Y(topY + 0.9), Z(z), r + 1.05, r + 1.05, 0.25, 24, { collide: false, ao: false });
      B.sphere('gold', X(x), Y(topY + 1 + orh + 0.3), Z(z), 0.45);
      B.cyl('gold', X(x), Y(topY + 1 + orh), Z(z), 0.05, 0.08, 3, 6, { collide: false });
      // banner pennant
      B.add('fabric', PENNANT, X(x) + 0.1, Y(topY + 1 + orh + 2.2), Z(z), 0, opts.flagDir || 0.7, 0, 1.6, 0.8, 1, { color: opts.flag || C('#f5a3c7'), worldUV: false });
    } else {
      B.cyl('stone', X(x), Y(base - 4), Z(z), r, r * 1.08, h + 4, 24, { color: WHITE, aoBase: Y(base) });
      // decorative rings
      for (let k = 1; k <= Math.floor(h / 9); k++) {
        B.cyl('stone', X(x), Y(base + k * 9 - 0.3), Z(z), r + 0.25, r + 0.25, 0.3, 24, { color: TRIM, collide: false });
      }
      // windows around
      const wn = Math.max(3, Math.floor(r * 1.2));
      for (let k = 0; k < Math.floor(h / 7); k++) {
        for (let i = 0; i < wn; i++) {
          const a = (i / wn) * Math.PI * 2 + k * 0.4;
          PR.archWindow(B, X(x + Math.sin(a) * (r + 0.05)), Y(base + 4.2 + k * 7), Z(z + Math.cos(a) * (r + 0.05)), a - Math.PI / 2, 0.85, 1.6);
        }
      }
      // machicolation + roof
      B.cyl('stone', X(x), Y(base + h), Z(z), r + 0.6, r, 1.2, 24, { color: TRIM, collide: false });
      const rh = (opts.roofH || r * 2.6) * 1.35;
      B.cone('roof', X(x), Y(base + h + 1.2), Z(z), r + 1.1, rh, 24, { color: roofC });
      B.cyl('gold', X(x), Y(base + h + 1.1), Z(z), r + 1.15, r + 1.15, 0.25, 24, { collide: false, ao: false });
      // dormer windows on tall roofs
      if (rh > 12) for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const dr = (r + 1.1) * 0.62;
        B.box('stone', X(x + Math.sin(a) * dr), Y(base + h + 1.2 + rh * 0.28), Z(z + Math.cos(a) * dr), 1.0, 1.4, 1.0, a, { color: WHITE, collide: false });
        PR.archWindow(B, X(x + Math.sin(a) * (dr + 0.52)), Y(base + h + 1.2 + rh * 0.28 + 0.1), Z(z + Math.cos(a) * (dr + 0.52)), a - Math.PI / 2, 0.55, 0.7, { noMullion: true });
        B.pyramid('roof', X(x + Math.sin(a) * dr), Y(base + h + 1.2 + rh * 0.28 + 1.4), Z(z + Math.cos(a) * dr), 1.3, 1.1, 1.3, a, { color: roofC });
      }
      B.sphere('gold', X(x), Y(base + h + 1.2 + rh + 0.35), Z(z), 0.5);
      B.cyl('gold', X(x), Y(base + h + 1.2 + rh), Z(z), 0.06, 0.09, 3.5, 6, { collide: false });
      B.add('fabric', PENNANT, X(x) + 0.1, Y(base + h + 1.2 + rh + 2.8), Z(z), 0, opts.flagDir || 0.7, 0, 2, 1, 1, { color: opts.flag || C('#f5a3c7'), worldUV: false });
    }
  };

  // stair: ramp collider + visual steps. Rises from (x,z0,y0) to (x,z1,y1) along z (or rotated)
  const stairs = (cx, cz, width, length, y0, y1, ry = 0, opts = {}) => {
    // ramp rising along local -z (from +z end at y0 toward -z end at y1)
    collision.addRamp(X(cx), Z(cz), width / 2, length / 2, ry, Y(y1), Y(y0));
    const steps = Math.max(2, Math.round((y1 - y0) / 0.5));
    const sd = length / steps, sh = (y1 - y0) / steps;
    const cos = Math.cos(ry), sin = Math.sin(ry);
    for (let i = 0; i < steps; i++) {
      const lz = length / 2 - (i + 0.5) * sd;
      const wx = cx + lz * sin, wz = cz + lz * cos;
      const top = y0 + (i + 1) * sh;
      B.box(opts.mat || 'stone', X(wx), Y(y0 - 0.2), Z(wz), width, top - y0 + 0.2, sd + 0.02, ry, { color: opts.color || TRIM, collide: false });
    }
    if (opts.rails) {
      for (const side of [-1, 1]) {
        const ox = side * (width / 2 + 0.25);
        // wedge cheek wall collider (top = ramp surface + 1)
        collision.addRamp(X(cx + ox * cos), Z(cz - ox * sin), 0.25, length / 2, ry, Y(y1 + 1.1), Y(y0 + 1.1), Y(y0 - 0.5));
        // visual: posts following the slope
        const n = Math.ceil(length / 1.6);
        for (let i = 0; i <= n; i++) {
          const lz = length / 2 - (i / n) * length;
          const yy = y0 + (i / n) * (y1 - y0);
          const wx = cx + ox * cos + lz * sin, wz = cz - ox * sin + lz * cos;
          B.box('stone', X(wx), Y(yy - 0.2), Z(wz), 0.4, 1.3, 0.4, ry, { color: TRIM, collide: false });
        }
        // sloped handrail
        const midY = (y0 + y1) / 2 + 1.1;
        const ang = Math.atan2(y1 - y0, length);
        B.add('stone', BOXU, X(cx + ox * cos), Y(midY), Z(cz - ox * sin), ang, ry, 0, 0.5, 0.25, Math.hypot(length, y1 - y0), { color: TRIM });
        // solid cheek below (visual)
        B.add('stone', WEDGE, X(cx + ox * cos), Y(y0 - 0.2), Z(cz - ox * sin), 0, ry, 0, 0.45, y1 - y0 + 0.2, length, { color: WHITE, flat: true });
      }
    }
  };

  // Rectangular building with door openings. doors: [{side:'s'|'n'|'e'|'w', at, w, h}]
  const building = (cx, cz, w, d, h, ry, opts = {}) => {
    const y0 = opts.y0 ?? 0;
    const t = 0.6;
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const toW = (lx, lz) => [cx + lx * cos + lz * sin, cz - lx * sin + lz * cos];
    const wallMat = opts.wallMat || 'stone';
    const wallCol = opts.wallColor || WARM;
    const doors = opts.doors || [];
    const sides = {
      s: { lx: 0, lz: d / 2, len: w, along: 'x' },
      n: { lx: 0, lz: -d / 2, len: w, along: 'x' },
      e: { lx: w / 2, lz: 0, len: d, along: 'z' },
      w: { lx: -w / 2, lz: 0, len: d, along: 'z' },
    };
    for (const [key, s] of Object.entries(sides)) {
      const ds = doors.filter((dd) => dd.side === key).sort((a, b) => a.at - b.at);
      const cuts = [];
      let cur = -s.len / 2;
      for (const dd of ds) {
        cuts.push([cur, dd.at - dd.w / 2]);
        cur = dd.at + dd.w / 2;
      }
      cuts.push([cur, s.len / 2]);
      const segRot = s.along === 'x' ? ry + Math.PI / 2 : ry;
      for (let [a, b] of cuts) {
        if (b - a < 0.05) continue;
        if (s.along === 'x') {
          if (a <= -s.len / 2 + 1e-6) a -= t / 2;
          if (b >= s.len / 2 - 1e-6) b += t / 2;
        }
        const mid = (a + b) / 2;
        const lx = s.along === 'x' ? mid : s.lx;
        const lz = s.along === 'x' ? s.lz : mid;
        const [wx, wz] = toW(lx, lz);
        B.box(wallMat, X(wx), Y(y0 - 1), Z(wz), t, h + 1, b - a, segRot, { color: wallCol, aoBase: Y(y0) });
      }
      for (const dd of ds) {
        const lx = s.along === 'x' ? dd.at : s.lx;
        const lz = s.along === 'x' ? s.lz : dd.at;
        const [wx, wz] = toW(lx, lz);
        B.box(wallMat, X(wx), Y(y0 + dd.h), Z(wz), t, h - dd.h, dd.w, segRot, { color: wallCol });
        // door frame trim
        B.box('stone', X(wx), Y(y0 + dd.h), Z(wz), t + 0.2, 0.4, dd.w + 0.6, segRot, { color: TRIM, collide: false });
      }
      // windows on the outside face
      if (opts.windows !== false) {
        const wn = Math.floor(s.len / 4);
        for (let i = 0; i < wn; i++) {
          const at = -s.len / 2 + (i + 0.5) * (s.len / wn);
          if (ds.some((dd) => Math.abs(dd.at - at) < dd.w / 2 + 0.9)) continue;
          const off = key === 's' || key === 'e' ? t / 2 + 0.03 : -(t / 2 + 0.03);
          const lx = s.along === 'x' ? at : s.lx + off;
          const lz = s.along === 'x' ? s.lz + off : at;
          const [wx, wz] = toW(lx, lz);
          for (let fl = 0; fl < Math.max(1, Math.floor(h / 5)); fl++) {
            PR.archWindow(B, X(wx), Y(y0 + 1.3 + fl * 4.5), Z(wz), segRot, 0.95, 1.5, { flowers: opts.flowerWindows && fl === 0 ? ((key === 's' || key === 'w') ? -1 : 1) : 0 });
          }
        }
      }
    }
    // timber trims for houses
    if (opts.timber) {
      for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
        const [wx, wz] = toW(lx, lz);
        B.box('wood', X(wx), Y(y0), Z(wz), 0.75, h, 0.75, ry, { color: WOOD, collide: false });
      }
      for (const [lx, lz, len, rot] of [[0, d / 2, w, ry + Math.PI / 2], [0, -d / 2, w, ry + Math.PI / 2], [w / 2, 0, d, ry], [-w / 2, 0, d, ry]]) {
        const [wx, wz] = toW(lx, lz);
        B.box('wood', X(wx), Y(y0 + h * 0.5), Z(wz), 0.7, 0.4, len, rot, { color: WOOD, collide: false });
        B.box('wood', X(wx), Y(y0 + h - 0.4), Z(wz), 0.7, 0.4, len, rot, { color: WOOD, collide: false });
      }
    }
    // floor
    if (opts.floor !== false) {
      const [fx, fz] = toW(0, 0);
      B.box(opts.floorMat || 'wood', X(fx), Y(y0 - 0.2), Z(fz), w - 0.2, 0.25, d - 0.2, ry, { color: opts.floorColor || C('#e8d6c2'), collide: false, uvScale: opts.floorMat === 'marble' ? 0.14 : 0.25, ao: false });
    }
    // roof
    const roofC = opts.roof || ROOF_BLUE;
    const [rx, rz] = toW(0, 0);
    if (opts.roofType === 'hip') {
      B.pyramid('roof', X(rx), Y(y0 + h), Z(rz), w + 1.6, opts.roofH || 5, d + 1.6, ry, { color: roofC });
    } else if (opts.roofType !== 'none') {
      const alongZ = opts.ridge === 'z';
      B.gable('roof', X(rx), Y(y0 + h), Z(rz), (alongZ ? w : d) + 1.4, opts.roofH || 4.5, (alongZ ? d : w) + 1.2, alongZ ? ry : ry + Math.PI / 2, { color: roofC });
    }
    // ceiling collider so you can't jump through the roof
    if (opts.ceiling !== false) collision.addBox(X(rx), Z(rz), w / 2, d / 2, Y(y0 + h), Y(y0 + h + 0.5), ry, { walkable: true });
    // chimney
    if (opts.chimney) {
      const [chx, chz] = toW(w * 0.3, -d * 0.2);
      B.box('stone', X(chx), Y(y0 + h), Z(chz), 1.2, (opts.roofH || 4.5) + 1.2, 1.2, ry, { color: C('#d8c9bd'), collide: false });
    }
  };

  const lampPost = (x, z, y = 0, h = 3.2) => {
    B.cyl('iron', X(x), Y(y), Z(z), 0.08, 0.12, h, 6, { color: C('#555a66') });
    B.box('iron', X(x), Y(y + h), Z(z), 0.5, 0.08, 0.5, 0, { collide: false, color: C('#555a66') });
    B.box('lamp', X(x), Y(y + h + 0.08), Z(z), 0.36, 0.5, 0.36, 0, { collide: false });
    B.cone('iron', X(x), Y(y + h + 0.58), Z(z), 0.34, 0.35, 4, { color: C('#555a66'), ry: Math.PI / 4 });
    lamps.push(new THREE.Vector3(X(x), Y(y + h + 0.35), Z(z)));
  };

  const banner = (x, y, z, ry, color, h = 5) => {
    B.box('gold', X(x), Y(y + h), Z(z), 1.9, 0.12, 0.12, ry, { collide: false });
    B.add('fabric', BANNER, X(x), Y(y), Z(z), 0, ry, 0, 1.6, h, 1, { color, worldUV: false });
  };

  const flowerBox = (x, z, y, w, d, ry = 0) => {
    B.box('stone', X(x), Y(y), Z(z), w, 0.6, d, ry, { color: TRIM });
    const cols = ['#f7a8c8', '#c7a6f0', '#fff3b0', '#ffffff', '#ffb4a2'];
    const n = Math.floor(w * d * 1.5);
    for (let i = 0; i < n; i++) {
      const lx = (Math.random() - 0.5) * (w - 0.3), lz = (Math.random() - 0.5) * (d - 0.3);
      const cos = Math.cos(ry), sin = Math.sin(ry);
      B.sphere('plain', X(x + lx * cos + lz * sin), Y(y + 0.7 + Math.random() * 0.15), Z(z - lx * sin + lz * cos), 0.16 + Math.random() * 0.08, { color: C(cols[Math.floor(Math.random() * cols.length)]) });
    }
  };

  // ================= OUTER WALLS =================
  const WX = D.wallX, WZ = D.wallZ, WH = D.wallH, WT = D.wallT;
  const cornerR = 7;
  // north wall
  wall(-WX + cornerR, -WZ, WX - cornerR, -WZ, WH, WT, 1);
  // east / west walls (split for mid towers at z=0)
  wall(WX, -WZ + cornerR, WX, -5.5, WH, WT, 1);
  wall(WX, 5.5, WX, WZ - cornerR, WH, WT, 1);
  wall(-WX, -WZ + cornerR, -WX, -5.5, WH, WT, -1);
  wall(-WX, 5.5, -WX, WZ - cornerR, WH, WT, -1);
  // south wall with gatehouse
  wall(-WX + cornerR, WZ, -21.5, WZ, WH, WT, -1);
  wall(21.5, WZ, WX - cornerR, WZ, WH, WT, -1);
  // gate: towers + arch lintel + jambs
  B.box('stone', X(-9.5), Y(-4), Z(WZ), 10, WH + 6, WT + 1, 0, { color: WHITE, aoBase: Y(0) });
  B.box('stone', X(9.5), Y(-4), Z(WZ), 10, WH + 6, WT + 1, 0, { color: WHITE, aoBase: Y(0) });
  // carve: the gate opening is between x=-4.5..4.5, lintel above
  B.box('stone', X(0), Y(10), Z(WZ), 9, WH - 10 + 2, WT + 1, 0, { color: WHITE });
  merlons(-14.5, WZ, 14.5, WZ, WH + 2, 0, (WT + 1) / 2 - 0.35);
  // portcullis (raised) + arch trim
  for (let i = -4; i <= 4; i += 1) B.box('iron', X(i), Y(8.6), Z(WZ + 0.9), 0.14, 1.4, 0.14, 0, { collide: false, color: C('#6d7280') });
  B.box('gold', X(0), Y(9.6), Z(WZ + 2.05), 10, 0.5, 0.3, 0, { collide: false });
  // coat of arms above gate
  B.add('gold', CYLU, X(0), Y(12.6), Z(WZ + 2.1), Math.PI / 2, 0, 0, 1.3, 0.2, 1.3, {});
  tower(-15, WZ + 1, 6.5, 30, { roof: ROOF_BLUE, flag: C('#f7a6c9'), roofH: 20 });
  tower(15, WZ + 1, 6.5, 30, { roof: ROOF_BLUE, flag: C('#f7a6c9'), flagDir: 2.4, roofH: 20 });
  // corner towers (open belvederes reachable from wall walks)
  const corners = [[-WX, -WZ], [WX, -WZ], [-WX, WZ], [WX, WZ]];
  corners.forEach(([x, z], i) => {
    tower(x, z, cornerR, WH, { open: true, walkY: WH, pavH: 7, roof: i % 2 ? ROOF_LILAC : ROOF_BLUE, roofH: 17, gaps: gapsFor(x, z) });
  });
  // mid wall towers
  tower(WX, 0, 5.5, WH, { open: true, walkY: WH, pavH: 5.5, roof: ROOF_TEAL, roofH: 11, gaps: [0, Math.PI] });
  tower(-WX, 0, 5.5, WH, { open: true, walkY: WH, pavH: 5.5, roof: ROOF_TEAL, roofH: 11, gaps: [0, Math.PI] });
  spawn.cat = new THREE.Vector3(X(WX - 2.5), Y(WH), Z(-WZ + 2.5));

  function gapsFor(x, z) {
    // openings toward the adjoining walls
    const g = [];
    g.push(x < 0 ? Math.PI / 2 : -Math.PI / 2); // toward center x (wall along z... east/west wall runs along z)
    g.push(z < 0 ? 0 : Math.PI);
    return g.map((a) => a); // angles measured with sin(a)=x, cos(a)=z
  }

  // wall-walk stairs (inside, along east & west walls)
  stairs(-WX + WT / 2 + 1.7, -4, 3, 28, 0, WH, 0, { rails: false });
  stairs(WX - WT / 2 - 1.7, -4, 3, 28, 0, WH, 0, { rails: false });
  // stairs to the south wall walk near gate
  stairs(-40, WZ - WT / 2 - 1.7, 3, 28, 0, WH, -Math.PI / 2, {});
  stairs(40, WZ - WT / 2 - 1.7, 3, 28, 0, WH, Math.PI / 2, {});

  // ================= LOWER WARD =================
  // cobblestone plaza
  B.add('cobble', BOX, X(0), Y(0.02), Z(0), 0, 0, 0, WX * 2 - WT, 0.04, WZ * 2 - WT, { uvScale: 0.12 });
  // road outside the gate
  B.add('cobble', BOX, X(0), Y(0.02), Z(WZ + 12), 0, 0, 0, 9, 0.04, 22, { uvScale: 0.12 });

  // fountain
  const FX = 0, FZ = 36;
  B.cyl('stone', X(FX), Y(0), Z(FZ), 6, 6.3, 0.9, 32, { color: TRIM });
  B.cyl('stone', X(FX), Y(0), Z(FZ), 1.2, 1.5, 3.2, 16, { color: WHITE });
  B.cyl('stone', X(FX), Y(3.2), Z(FZ), 2.6, 1.0, 0.6, 24, { color: TRIM, collide: false });
  B.cyl('stone', X(FX), Y(3.8), Z(FZ), 0.5, 0.7, 2.2, 12, { color: WHITE, collide: false });
  B.add('crystal', OCTA, X(FX), Y(7.2), Z(FZ), 0, 0, 0, 0.9, 1.6, 0.9, { worldUV: false });
  spawn.fountain = new THREE.Vector3(X(FX), Y(0.75), Z(FZ));

  // market stalls
  const awningCols = [C('#f6a9c6'), C('#c6b2f0'), C('#ffe39a'), C('#a9d8f5'), C('#f7c1a1'), C('#bfe3b4')];
  const stall = (x, z, ry, ci) => {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const tw = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    // counter
    const [cxw, czw] = tw(0, 1.1);
    B.box('wood', X(cxw), Y(0), Z(czw), 4.2, 1.1, 0.9, ry, { color: WOOD });
    for (const [lx, lz] of [[-2, -1.4], [2, -1.4], [-2, 1.4], [2, 1.4]]) {
      const [px, pz] = tw(lx, lz);
      B.box('wood', X(px), Y(0), Z(pz), 0.18, lz < 0 ? 3.4 : 2.8, 0.18, ry, { color: WOOD });
    }
    const [ax, az] = tw(0, 0);
    B.add('fabric', BOX, X(ax), Y(3.15), Z(az), 0.2, ry, 0, 4.6, 0.08, 3.6, { color: awningCols[ci % awningCols.length], worldUV: false });
    // goods on the counter
    for (let i = 0; i < 6; i++) {
      const [gx, gz] = tw(-1.6 + i * 0.64, 1.1);
      B.sphere('plain', X(gx), Y(1.25), Z(gz), 0.2, { color: [C('#ff8a8a'), C('#ffd166'), C('#9ad37a'), C('#f4a261'), C('#c77dff'), C('#ffffff')][(i + ci) % 6] });
    }
  };
  [[-17, 26], [-17, 38], [-17, 50]].forEach(([x, z], i) => stall(x, z, Math.PI / 2, i));
  [[17, 26], [17, 38], [17, 50]].forEach(([x, z], i) => stall(x, z, -Math.PI / 2, i + 3));
  spawn.merchant = new THREE.Vector3(X(-18.5), Y(0), Z(38));

  // tavern "Golden Griffin" (west)
  building(-58, 30, 20, 16, 8, 0, {
    doors: [{ side: 'e', at: 0, w: 2.6, h: 3.4 }], roof: ROOF_ROSE, roofType: 'gable', roofH: 6, ridge: 'z', chimney: true, timber: true,
  });
  // tavern interior
  B.box('wood', X(-62), Y(0), Z(30), 1.2, 1.2, 9, 0, { color: C('#9c6b45') }); // bar
  B.box('wood', X(-64.8), Y(0), Z(30), 0.8, 3.5, 12, 0, { color: C('#8a5c3b') }); // shelf
  for (let i = 0; i < 10; i++) B.cyl('plain', X(-64.5), Y(1.3 + (i % 2) * 1.2), Z(25 + i), 0.14, 0.14, 0.5, 6, { color: [C('#e76f51'), C('#90be6d'), C('#f9c74f'), C('#577590')][i % 4], collide: false });
  B.col = collision;
  for (const [tx, tz] of [[-55, 24.5], [-55, 35], [-51, 24.5]]) {
    PR.table(B, X(tx), Y(0), Z(tz), 0, 1.3, 2.2);
    PR.bench(B, X(tx - 1.0), Y(0), Z(tz), 0, 2.0);
    PR.bench(B, X(tx + 1.0), Y(0), Z(tz), 0, 2.0);
  }
  for (const [bx, bz] of [[-66.6, 36.8], [-66.6, 35.8], [-65.8, 36.9]]) PR.barrel(B, X(bx), Y(0), Z(bz), 0.9);
  PR.barrel(B, X(-66.4), Y(0.9), Z(36.3), 0.8, true);
  for (let i = 0; i < 7; i++) B.sphere('plain', X(-60 + i * 1.6), Y(6.9), Z(24 + (i % 3) * 5), 0.22, { color: C(i % 2 ? '#7aa65a' : '#b8a060'), sy: 1.6 }); // drying herbs
  // notice board outside
  B.box('wood', X(-45.5), Y(0), Z(23.2), 0.15, 2.4, 0.15, 0, { color: C('#7a5238') });
  B.box('wood', X(-45.5), Y(0), Z(25.8), 0.15, 2.4, 0.15, 0, { color: C('#7a5238') });
  B.box('wood', X(-45.5), Y(1.1), Z(24.5), 0.12, 1.3, 2.8, 0, { color: C('#b88a60') });
  for (let i = 0; i < 5; i++) B.box('plain', X(-45.42), Y(1.3 + (i % 2) * 0.5), Z(23.5 + i * 0.5), 0.02, 0.4, 0.34, (i - 2) * 0.05, { color: C('#fbf4e2'), collide: false });
  spawn.tavernFire = new THREE.Vector3(X(-58), Y(0.35), Z(36.5));
  B.box('stone', X(-58), Y(0), Z(37.2), 4, 3.2, 1.2, 0, { color: C('#d8cabd') }); // fireplace
  B.box('fire', X(-58), Y(0.3), Z(36.5), 2, 1.1, 0.3, 0, { collide: false, color: C('#ffb347') });
  spawn.innkeeper = new THREE.Vector3(X(-63.3), Y(0), Z(30));
  spawn.tavernLight = new THREE.Vector3(X(-56), Y(5), Z(30));
  spawn.tavernDoor = new THREE.Vector3(X(-47), Y(0), Z(30));
  banner(-47.6, 4.2, 30, Math.PI / 2, C('#f2c14e'), 2.2);

  // alchemist (west)
  building(-58, 6, 14, 12, 7, 0, {
    doors: [{ side: 'e', at: 0, w: 2.4, h: 3.2 }], roof: ROOF_LILAC, roofType: 'hip', roofH: 5, timber: true,
  });
  PR.bottleShelf(B, X(-64.1), Y(0), Z(6), 0, 8.5, true);
  PR.bookshelf(B, X(-60), Y(0), Z(0.7), -Math.PI / 2, 3.2, 2.6);
  B.add('crystal', PRISM_BALL, X(-60), Y(1.35), Z(6), 0, 0, 0, 0.26, 0.26, 0.26, { worldUV: false, ao: false });
  B.cyl('gold', X(-60), Y(1.1), Z(6), 0.15, 0.2, 0.12, 8, { collide: false, ao: false });
  for (let i = 0; i < 5; i++) B.sphere('plain', X(-62 + i * 1.3), Y(6.2), Z(11.4), 0.2, { color: C(['#b89ae6', '#f7b7d2', '#7aa65a', '#f7d65a', '#9fd8ff'][i]), sy: 1.7 });
  spawn.cauldron = new THREE.Vector3(X(-56), Y(1.0), Z(9.5));
  B.box('wood', X(-64.4), Y(0), Z(6), 0.6, 3.8, 10, 0, { color: C('#8a5c3b') });
  B.box('wood', X(-60), Y(0), Z(6), 1.2, 1.1, 6, 0, { color: WOOD });
  B.cyl('iron', X(-56), Y(0), Z(9.5), 0.7, 0.55, 0.9, 12, { color: C('#4b4f5c') }); // cauldron
  B.cyl('crystal', X(-56), Y(0.9), Z(9.5), 0.6, 0.6, 0.05, 12, { collide: false, color: C('#9bff9b') });
  spawn.alchemist = new THREE.Vector3(X(-61.2), Y(0), Z(6));
  banner(-50.6, 3.8, 6, Math.PI / 2, C('#b9a3e3'), 2.2);

  // smithy (east) — open workshop
  {
    const sx = 58, sz = 30;
    for (const [px, pz] of [[-8, -7], [-8, 7], [0, -7], [0, 7], [8, -7], [8, 7]]) {
      B.box('wood', X(sx + px), Y(0), Z(sz + pz), 0.6, 6, 0.6, 0, { color: WOOD });
    }
    B.box('stone', X(sx + 8.6), Y(0), Z(sz), 0.8, 6, 14.6, 0, { color: WARM });
    B.gable('roof', X(sx), Y(6), Z(sz), 16, 3.5, 18, Math.PI / 2, { color: C('#9aa7c7') });
    B.box('stone', X(sx + 5.5), Y(0), Z(sz - 3), 3, 1.6, 3, 0, { color: C('#b7a99c') }); // forge
    B.box('fire', X(sx + 5.5), Y(1.6), Z(sz - 3), 2, 0.25, 2, 0, { collide: false, color: C('#ff7b2e') });
    B.box('stone', X(sx + 6.2), Y(1.6), Z(sz - 3), 1.2, 5, 1.2, 0, { color: C('#b7a99c'), collide: false }); // chimney
    B.box('iron', X(sx + 1), Y(0), Z(sz + 1), 0.8, 0.8, 0.5, 0, { color: C('#555a66') });
    B.box('iron', X(sx + 1), Y(0.8), Z(sz + 1), 1.4, 0.35, 0.6, 0, { color: C('#6a6f7c') }); // anvil
    // weapon rack
    B.box('wood', X(sx + 7.8), Y(0), Z(sz + 4), 0.4, 2.6, 5, 0, { color: WOOD });
    for (let i = 0; i < 5; i++) B.box('iron', X(sx + 7.5), Y(0.4), Z(sz + 2 + i), 0.08, 2.1, 0.18, 0, { color: C('#c9d0dc'), collide: false });
    spawn.blacksmith = new THREE.Vector3(X(sx + 2.2), Y(0), Z(sz - 1));
    spawn.forgeLight = new THREE.Vector3(X(sx + 5.5), Y(2.5), Z(sz - 3));
  }

  // barracks (east)
  building(58, 4, 18, 13, 9, 0, { doors: [{ side: 'w', at: 0, w: 2.6, h: 3.6 }], roof: ROOF_BLUE, roofType: 'gable', roofH: 5 });
  B.box('stone', X(47), Y(0), Z(4), 1, 0.01, 2.6, 0, { collide: false }); // door marker
  // stables (east strip)
  {
    const sx = 58, sz = -32;
    for (const px of [-6, 0, 6]) for (const pz of [-6, 6]) B.box('wood', X(sx + px), Y(0), Z(sz + pz), 0.5, 4.2, 0.5, 0, { color: WOOD });
    B.gable('roof', X(sx), Y(4.2), Z(sz), 14, 2.6, 14, 0, { color: C('#e7b88c') });
    B.box('wood', X(sx + 6.5), Y(0), Z(sz), 0.3, 1.2, 12, 0, { color: WOOD });
    for (let i = 0; i < 6; i++) B.cyl('plain', X(sx - 2 + (i % 3) * 1.4), Y(0), Z(sz + 2 + Math.floor(i / 3) * 1.4), 0.6, 0.6, 1, 10, { color: C('#f2d58a') }); // hay
    spawn.stable = new THREE.Vector3(X(sx), Y(0), Z(sz));
  }
  // houses near the south wall
  const houseRoofs = [ROOF_ROSE, ROOF_TEAL, ROOF_LILAC, ROOF_GOLD];
  [[-52, 56], [-36, 57], [36, 57], [52, 56]].forEach(([x, z], i) => {
    building(x, z, 11, 8, 6, 0, { doors: [{ side: 'n', at: 0, w: 1.8, h: 2.8 }], roof: houseRoofs[i], roofType: 'gable', roofH: 4, timber: true, chimney: i % 2 === 0 });
    // door (closed)
    B.box('wood', X(x), Y(0), Z(z - 4.05), 1.8, 2.8, 0.15, 0, { color: C('#8a5c3b') });
    flowerBox(x + 3.5, z - 4.6, 0, 2.4, 0.7);
  });
  // lower ward lamps & greenery
  for (const [lx, lz] of [[-6, 62], [6, 62], [-8, 20], [8, 20], [-30, 36], [30, 36], [-8, 48], [8, 48], [-40, 14], [40, 14], [-40, 46], [40, 46], [-60, -20], [60, -20], [-58, -50], [58, -50]]) lampPost(lx, lz);
  for (const [fx, fz] of [[-26, 18], [26, 18], [-26, 56], [26, 56]]) flowerBox(fx, fz, 0, 3, 3);

  // ================= UPPER WARD (terrace) =================
  const TH = D.terraceH, TX = D.terraceX, TZ0 = D.terraceZ0, TZ1 = D.terraceZ1;
  B.box('stone', X(0), Y(-4), Z((TZ0 + TZ1) / 2), TX * 2, TH + 4, TZ1 - TZ0, 0, { color: WHITE, aoBase: Y(0) });
  B.add('cobble', BOX, X(0), Y(TH + 0.02), Z((TZ0 + TZ1) / 2), 0, 0, 0, TX * 2, 0.04, TZ1 - TZ0, { uvScale: 0.14, color: C('#f4efe9') });
  // retaining wall arches (decor on front)
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) <= 1) continue;
    B.box('stone', X(i * 7.6), Y(0), Z(TZ1 + 0.3), 1.0, TH, 0.6, 0, { color: TRIM, collide: false });
    B.box('window', X(i * 7.6 + 3.8), Y(3), Z(TZ1 + 0.05), 2.6, 4, 0.1, 0, { collide: false, color: C('#b8c9e8') });
  }
  // balustrade around terrace edge (with stair opening)
  const balu = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    B.box('stone', X((x0 + x1) / 2), Y(TH), Z((z0 + z1) / 2), 0.5, 1.1, len, ang, { color: TRIM, walkable: false });
    const n = Math.floor(len / 1.2);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.box('stone', X(x0 + (x1 - x0) * t), Y(TH + 1.1), Z(z0 + (z1 - z0) * t), 0.3, 0.2, 0.3, ang, { color: WHITE, collide: false });
    }
  };
  balu(-TX + 0.3, TZ1 - 0.3, -7.3, TZ1 - 0.3);
  balu(7.3, TZ1 - 0.3, TX - 0.3, TZ1 - 0.3);
  balu(-TX + 0.3, TZ1 - 0.3, -TX + 0.3, TZ0 + 1);
  balu(TX - 0.3, TZ1 - 0.3, TX - 0.3, -47);
  balu(TX - 0.3, -53, TX - 0.3, TZ0 + 1);
  // grand staircase
  stairs(0, TZ1 + 10, 14, 20, 0, TH, 0, { rails: true });
  B.cyl('stone', X(-8), Y(0), Z(TZ1 + 20.5), 0.8, 0.9, 1.6, 12, { color: TRIM });
  B.cyl('stone', X(8), Y(0), Z(TZ1 + 20.5), 0.8, 0.9, 1.6, 12, { color: TRIM });
  B.add('crystal', OCTA, X(-8), Y(2.4), Z(TZ1 + 20.5), 0, 0, 0, 0.5, 0.8, 0.5, { worldUV: false });
  B.add('crystal', OCTA, X(8), Y(2.4), Z(TZ1 + 20.5), 0, 0, 0, 0.5, 0.8, 0.5, { worldUV: false });
  // side stair at the back-east for alternate route
  stairs(TX + 2, -40, 4, 20, 0, TH, 0, { rails: false });
  // terrace front towers
  tower(-TX, TZ1, 4.5, 44, { roof: ROOF_LILAC, y0: 0, roofH: 20 });
  tower(TX, TZ1, 4.5, 44, { roof: ROOF_LILAC, y0: 0, roofH: 20, flagDir: 2.4 });
  // terrace lamps
  for (const [lx, lz] of [[-9, -9], [9, -9], [-20, -14], [20, -14], [-20, -28], [20, -28], [-36, -40], [36, -40]]) lampPost(lx, lz, TH);
  spawn.stairTop = new THREE.Vector3(X(0), Y(TH), Z(TZ1 - 2));

  // chapel (west on terrace)
  building(-31, -22, 12, 18, 10, 0, {
    y0: TH, doors: [{ side: 's', at: 0, w: 2.8, h: 4.2 }], roof: ROOF_BLUE, roofType: 'gable', roofH: 8, ridge: 'z', floorMat: 'marble', floorColor: C('#ffffff'),
  });
  B.add('stained', CYLU, X(-31), Y(TH + 7.5), Z(-12.95), Math.PI / 2, 0, 0, 1.6, 0.1, 1.6, { color: C('#ff9ad5') });
  tower(-31, -33.6, 2.4, 22, { y0: TH, roof: ROOF_BLUE, roofH: 7 });
  // chapel interior: altar + benches
  B.box('stone', X(-31), Y(TH), Z(-29), 3, 1.1, 1.4, 0, { color: WHITE });
  B.add('crystal', OCTA, X(-31), Y(TH + 1.9), Z(-29), 0, 0, 0, 0.4, 0.7, 0.4, { worldUV: false });
  for (let r = 0; r < 4; r++) for (const s of [-1, 1]) B.box('wood', X(-31 + s * 2.6), Y(TH), Z(-24 + r * 2.4), 3.2, 0.5, 0.7, 0, { color: WOOD });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) B.box('stained', X(-31 + s * 6.05), Y(TH + 3), Z(-26 + i * 5), 0.1, 4, 1.4, 0, { collide: false, color: [C('#8fd3ff'), C('#ffb3d9'), C('#ffe08a')][i] });
  spawn.priestess = new THREE.Vector3(X(-31), Y(TH), Z(-27.5));
  spawn.chapelLight = new THREE.Vector3(X(-31), Y(TH + 5), Z(-24));

  // gardens (east on terrace): gazebo + flower beds + fountains
  {
    const gx = 30, gz = -22;
    B.cyl('stone', X(gx), Y(TH), Z(gz), 4.5, 4.6, 0.4, 16, { color: TRIM });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.cyl('stone', X(gx + Math.sin(a) * 4), Y(TH + 0.4), Z(gz + Math.cos(a) * 4), 0.18, 0.22, 3.4, 8, { color: WHITE });
    }
    B.cone('roof', X(gx), Y(TH + 3.8), Z(gz), 5.2, 3.2, 16, { color: ROOF_ROSE });
    B.sphere('gold', X(gx), Y(TH + 7.2), Z(gz), 0.35);
    for (const [fx, fz] of [[20, -18], [20, -30], [38, -30], [38, -12], [26, -38]]) flowerBox(fx, fz, TH, 3.5, 2.2, 0.3 * fx);
    spawn.garden = new THREE.Vector3(X(gx - 6), Y(TH), Z(gz + 4));
  }

  // ================= KEEP =================
  const KX = D.keepX, KZ0 = D.keepZ0, KZ1 = D.keepZ1, KH = D.keepH;
  const kcz = (KZ0 + KZ1) / 2, kd = KZ1 - KZ0;
  building(0, kcz, KX * 2, kd, KH, 0, {
    y0: TH, doors: [{ side: 's', at: 0, w: 5, h: 7.5 }], roofType: 'none', ceiling: false, floorMat: 'marble', floorColor: C('#ffffff'), windows: true, wallColor: WHITE,
  });
  // grand doors (open, swung inward)
  PR.door(B, X(-1.25), Y(TH), Z(KZ1), Math.PI / 2, 2.5, 7.4, 1.75, '#a27650');
  PR.door(B, X(1.25), Y(TH), Z(KZ1), -Math.PI / 2, 2.5, 7.4, -1.75, '#a27650');
  B.box('gold', X(0), Y(TH + 7.6), Z(KZ1 + 0.45), 6.4, 0.6, 0.4, 0, { collide: false });
  // roof slab with hole for the inner staircase (x 13.5..17.4, z -44..-36)
  const RY = D.roofY;
  const slab = (x0, x1, z0, z1) => B.box('stone', X((x0 + x1) / 2), Y(RY), Z((z0 + z1) / 2), x1 - x0, 0.6, z1 - z0, 0, { color: TRIM });
  slab(-KX, 13.3, KZ0, KZ1);
  slab(13.3, KX, KZ0, -44);
  slab(13.3, KX, -35.5, KZ1);
  // roof parapet
  merlons(-KX, KZ0, KX, KZ0, RY + 0.6, 0, -0.5);
  merlons(-KX, KZ1, KX, KZ1, RY + 0.6, 0, 0.5);
  merlons(-KX, KZ0, -KX, KZ1, RY + 0.6, -0.5, 0);
  merlons(KX, KZ0, KX, KZ1, RY + 0.6, 0.5, 0);
  B.box('stone', X(0), Y(RY - 0.8), Z(kcz), KX * 2 + 1, 0.8, kd + 1, 0, { color: TRIM, collide: false });
  // keep corner turrets
  for (const [tx, tz] of [[-KX, KZ0], [KX, KZ0], [-KX, KZ1], [KX, KZ1]]) {
    tower(tx, tz, 3, 40, { y0: TH, roof: ROOF_BLUE, roofH: 17, flagDir: tx > 0 ? 2.4 : 0.7 });
  }
  // interior: columns, carpet, throne
  for (const cx of [-9, 9]) {
    for (const cz of [-37, -43, -49]) {
      B.cyl('stone', X(cx), Y(TH), Z(cz), 0.75, 0.85, KH, 16, { color: WHITE });
      B.cyl('gold', X(cx), Y(TH + KH - 1.2), Z(cz), 1.05, 0.75, 1.2, 16, { collide: false });
      B.cyl('stone', X(cx), Y(TH), Z(cz), 1.1, 1.1, 0.6, 16, { color: TRIM, collide: false });
    }
  }
  B.add('fabric', BOX, X(0), Y(TH + 0.04), Z(-41), 0, 0, 0, 4.2, 0.03, 18, { color: C('#c94f7c'), worldUV: false });
  B.add('gold', BOX, X(0), Y(TH + 0.03), Z(-41), 0, 0, 0, 4.8, 0.02, 18.4, {});
  // dais
  B.box('stone', X(0), Y(TH), Z(-49.5), 12, 0.45, 6, 0, { color: WHITE });
  B.box('stone', X(0), Y(TH + 0.45), Z(-50.5), 8, 0.45, 4, 0, { color: TRIM });
  // throne
  B.box('gold', X(0), Y(TH + 0.9), Z(-51.6), 2.2, 0.9, 1.6, 0, {});
  B.box('gold', X(0), Y(TH + 0.9), Z(-52.3), 2.2, 4.2, 0.3, 0, { collide: false });
  B.box('fabric', X(0), Y(TH + 1.8), Z(-51.6), 1.8, 0.15, 1.4, 0, { color: C('#b8407a'), collide: false });
  B.add('crystal', OCTA, X(0), Y(TH + 5.6), Z(-52.3), 0, 0, 0, 0.45, 0.8, 0.45, { worldUV: false });
  spawn.queen = new THREE.Vector3(X(0), Y(TH + 0.9), Z(-50.4));
  spawn.throneLight = new THREE.Vector3(X(0), Y(TH + 9), Z(-44));
  // stained windows on side walls (inside)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      B.box('stained', X(s * (KX - 0.36)), Y(TH + 3), Z(-36 - i * 6), 0.08, 7, 2.2, 0, { collide: false, color: [C('#8fd3ff'), C('#ffb3d9'), C('#ffe08a'), C('#c7b3ff')][i] });
      B.box('stained', X(s * (KX + 0.34)), Y(TH + 3), Z(-36 - i * 6), 0.08, 7, 2.2, 0, { collide: false, color: [C('#8fd3ff'), C('#ffb3d9'), C('#ffe08a'), C('#c7b3ff')][i] });
    }
  }
  // banners inside
  for (const s of [-1, 1]) for (const [bz, ca, cb] of [[-39, '#c94f7c', '#f0c860'], [-45, '#6f7fd8', '#f0c860']]) PR.tapestry(B, X(s * (KX - 0.36)), Y(TH + 8.2), Z(bz), s > 0 ? Math.PI : 0, 2.3, 5.2, ca, cb);
  // chandeliers
  for (const cz of [-38, -46]) {
    B.add('gold', TORUS, X(0), Y(TH + 11), Z(cz), Math.PI / 2, 0, 0, 2.2, 2.2, 2.2, { worldUV: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.sphere('lamp', X(Math.sin(a) * 2.2), Y(TH + 11.35), Z(cz + Math.cos(a) * 2.2), 0.2);
    }
    B.cyl('gold', X(0), Y(TH + 11), Z(cz), 0.04, 0.04, KH - 11, 4, { collide: false });
  }
  // gallery (mezzanine) along the north wall + stair along west wall
  const MY = D.mezzY;
  B.box('stone', X(0), Y(MY - 0.6), Z(KZ0 + 3.5), KX * 2 - 0.6, 0.6, 6.4, 0, { color: TRIM });
  for (let i = -2; i <= 2; i++) B.cyl('stone', X(i * 5), Y(TH), Z(KZ0 + 6.4), 0.35, 0.4, MY - TH - 0.6, 10, { color: WHITE });
  // gallery railing
  B.box('stone', X(0), Y(MY), Z(KZ0 + 6.6), 26, 1.0, 0.3, 0, { color: TRIM, walkable: false });
  // bookshelves on the gallery
  for (let i = -3; i <= 3; i++) PR.bookshelf(B, X(i * 4.6), Y(MY), Z(KZ0 + 0.95), -Math.PI / 2, 3.9, 3.9);
  // reading desk, globe and candles on the gallery
  PR.table(B, X(-6), Y(MY), Z(KZ0 + 4.2), Math.PI / 2, 2.2, 1.1, false);
  for (let i = 0; i < 3; i++) B.box('plain', X(-6.6 + i * 0.5), Y(MY + 0.92), Z(KZ0 + 4.2), 0.34, 0.08, 0.46, i * 0.3, { color: C(['#8a4a5a', '#4a5a8a', '#fbf4e2'][i]), collide: false, ao: false });
  B.sphere('plain', X(6), Y(MY + 1.4), Z(KZ0 + 4.3), 0.45, { color: C('#7fb0d8') });
  B.add('gold', TORUS, X(6), Y(MY + 1.4), Z(KZ0 + 4.3), 0, 0.4, 0, 0.5, 0.5, 0.5, { worldUV: false, ao: false });
  B.cyl('gold', X(6), Y(MY), Z(KZ0 + 4.3), 0.05, 0.2, 0.95, 8, { collide: true, ao: false });
  // stair 1: floor -> gallery (west wall)
  stairs(-KX + 2.2, -46.5, 3, 13, 0 + TH, MY, 0, {});
  B.box('stone', X(-KX + 2.2), Y(MY - 0.6), Z(-40.2), 3, 0.6, 0.5, 0, { color: TRIM, collide: false });
  // stair 2: gallery -> roof (east wall), top passes through roof hole
  stairs(KX - 2.4, -44.9, 3, 16.2, MY, RY + 0.6, Math.PI, {});
  spawn.gallery = new THREE.Vector3(X(-6), Y(MY), Z(KZ0 + 4));
  spawn.keepDoor = new THREE.Vector3(X(0), Y(TH), Z(KZ1 + 3));
  spawn.roof = new THREE.Vector3(X(-8), Y(RY + 0.6), Z(-40));
  // cat hides on the keep roof corner? (use wall tower instead; roof is for the spire)

  // ================= MAGE SPIRE =================
  const SX = 0, SZ = -46, SR = 5.2, OBS = D.obsY, ST = D.spireTop;
  const spireBase = RY + 0.6;
  // hollow 16-gon tower with door on south
  {
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const w = 2 * SR * Math.tan(Math.PI / segs) + 0.08;
      const px = SX + Math.sin(a) * SR, pz = SZ + Math.cos(a) * SR;
      if (i === 0) {
        // doorway (south): lintel only
        B.box('stone', X(px), Y(spireBase + 4.2), Z(pz), 0.7, OBS - spireBase - 4.2, w, a + Math.PI / 2, { color: WHITE });
        B.box('gold', X(px + 0.05), Y(spireBase + 4.2), Z(pz + 0.4), w + 0.4, 0.35, 0.2, 0, { collide: false });
        continue;
      }
      B.box('stone', X(px), Y(spireBase), Z(pz), 0.7, OBS - spireBase, w, a + Math.PI / 2, { color: WHITE });
      if (i % 4 === 2) {
        for (let k = 0; k < 4; k++) B.box('window', X(SX + Math.sin(a) * (SR + 0.37)), Y(spireBase + 7 + k * 8), Z(SZ + Math.cos(a) * (SR + 0.37)), 0.9, 2.2, 0.08, a, { collide: false });
      }
    }
    for (let k = 1; k <= 3; k++) B.cyl('stone', X(SX), Y(spireBase + k * 9), Z(SZ), SR + 0.5, SR + 0.5, 0.4, 24, { color: TRIM, collide: false });
    // observatory ring floor (hole in the middle for the disc)
    const fsegs = 16;
    for (let i = 0; i < fsegs; i++) {
      const a = (i / fsegs) * Math.PI * 2;
      const rIn = 2.5, rOut = 9.5, rm = (rIn + rOut) / 2;
      const w = 2 * rOut * Math.tan(Math.PI / fsegs) + 0.1;
      B.box('stone', X(SX + Math.sin(a) * rm), Y(OBS - 0.6), Z(SZ + Math.cos(a) * rm), rOut - rIn, 0.6, w, a + Math.PI / 2, { color: TRIM, walkable: true });
    }
    B.cyl('stone', X(SX), Y(OBS - 2.4), Z(SZ), 9.6, SR, 1.8, 24, { color: WHITE, collide: false });
    B.add('cobble', CYLU, X(SX), Y(OBS + 0.02), Z(SZ), 0, 0, 0, 9.4, 0.04, 9.4, { uvScale: 0.2, color: C('#f6f0ea') });
    // railing ring
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const w = 2 * 9.2 * Math.tan(Math.PI / 24) + 0.05;
      B.box('stone', X(SX + Math.sin(a) * 9.2), Y(OBS), Z(SZ + Math.cos(a) * 9.2), 0.35, 1.15, w, a + Math.PI / 2, { color: TRIM, walkable: false });
    }
    // crown pillars + golden ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      B.cyl('stone', X(SX + Math.sin(a) * 7.5), Y(OBS), Z(SZ + Math.cos(a) * 7.5), 0.3, 0.35, 6, 8, { color: WHITE });
      B.cone('gold', X(SX + Math.sin(a) * 7.5), Y(OBS + 6), Z(SZ + Math.cos(a) * 7.5), 0.55, 3.2, 8);
    }
    B.add('gold', TORUS, X(SX), Y(OBS + 6.2), Z(SZ), Math.PI / 2, 0, 0, 7.5, 7.5, 7.5, { worldUV: false });
    // gothic lantern crown: ribs rising from the pillars to a needle spire above the Heart
    const apex = OBS + 30;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x0 = Math.sin(a) * 7.5, z0 = Math.cos(a) * 7.5;
      const segN = 6;
      for (let k = 0; k < segN; k++) {
        const t0 = k / segN, t1 = (k + 1) / segN;
        const r0 = 7.5 * Math.cos(t0 * Math.PI / 2) ** 0.7, r1 = 7.5 * Math.cos(t1 * Math.PI / 2) ** 0.7;
        const y0r = OBS + 7 + (apex - OBS - 7) * Math.sin(t0 * Math.PI / 2), y1r = OBS + 7 + (apex - OBS - 7) * Math.sin(t1 * Math.PI / 2);
        const ax = Math.sin(a) * r0, az = Math.cos(a) * r0, bx = Math.sin(a) * r1, bz = Math.cos(a) * r1;
        const len = Math.hypot(bx - ax, y1r - y0r, bz - az);
        const pitch = Math.atan2(Math.hypot(bx - ax, bz - az), y1r - y0r);
        B.add('gold', CYLU, X((ax + bx) / 2), Y((y0r + y1r) / 2), Z((az + bz) / 2), -pitch, a, 0, 0.16, len, 0.16, { worldUV: false, ao: false, order: 'YXZ' });
      }
      B.add('gold', OCTA, X(x0 * 0.7), Y(OBS + 13), Z(z0 * 0.7), 0, a, 0, 0.25, 0.6, 0.25, { worldUV: false, ao: false });
    }
    B.cone('gold', X(SX), Y(apex - 0.5), Z(SZ), 0.9, 16, 12);
    B.sphere('gold', X(SX), Y(apex + 15.8), Z(SZ), 0.5);
    B.add('crystal', OCTA, X(SX), Y(apex + 17.2), Z(SZ), 0, 0, 0, 0.5, 1.1, 0.5, { worldUV: false, ao: false });
    // telescope + desk
    B.cyl('gold', X(SX + 5), Y(OBS), Z(SZ + 3), 0.12, 0.18, 1.4, 8);
    B.add('iron', CYLU, X(SX + 5), Y(OBS + 1.9), Z(SZ + 3), 0.7, 0.5, 0, 0.18, 2.4, 0.18, { color: C('#b89968') });
    B.box('wood', X(SX - 5), Y(OBS), Z(SZ + 2), 2.2, 1.0, 1.2, 0.4, { color: WOOD });
  }
  spawn.spireBottom = new THREE.Vector3(X(SX), Y(spireBase), Z(SZ));
  spawn.spireTop = new THREE.Vector3(X(SX), Y(OBS), Z(SZ));
  spawn.heart = new THREE.Vector3(X(SX), Y(OBS + 10), Z(SZ));
  spawn.mage = new THREE.Vector3(X(SX - 4.5), Y(OBS), Z(SZ + 3.5));

  // ================= DECORATIVE SPIRES (silhouette) =================
  tower(-26, -60, 3.6, 44, { y0: TH, roof: ROOF_BLUE, roofH: 20 });
  tower(26, -60, 3.6, 50, { y0: TH, roof: ROOF_LILAC, roofH: 22, flagDir: 2.4 });
  tower(-40, -62, 3, 34, { y0: TH, roof: ROOF_TEAL, roofH: 16 });
  tower(40, -62, 3, 30, { y0: TH, roof: ROOF_BLUE, roofH: 15, flagDir: 2.4 });
  tower(-11, -64, 2.6, 40, { y0: TH, roof: ROOF_LILAC, roofH: 16 });
  tower(11, -64, 2.6, 36, { y0: TH, roof: ROOF_TEAL, roofH: 15, flagDir: 2.4 });

  // outer banners on the wall faces
  for (const bx of [-40, -25, 25, 40]) banner(bx, 3, WZ + WT / 2 + 0.12, 0, bx < 0 ? C('#f5a3c7') : C('#b9a3e3'), 7);
  for (const bz of [-40, -20, 20, 40]) {
    banner(WX + WT / 2 + 0.12, 3, bz, Math.PI / 2, C('#9fd0f2'), 7);
    banner(-WX - WT / 2 - 0.12, 3, bz, -Math.PI / 2, C('#9fd0f2'), 7);
  }


  // ================= DECOR & LIFE =================
  B.col = collision;
  const lampsExtra = lamps;
  // --- lower ward: market goods, carts, benches, planters ---
  for (const sd of [-1, 1]) {
    for (const [bz, kind] of [[30, 'crate'], [33, 'barrel'], [42, 'sack'], [45, 'crate'], [54, 'barrel']]) {
      const bx = sd * 20.6;
      if (kind === 'crate') { PR.crate(B, X(bx), Y(0), Z(bz), 0.9, 0.2 * sd); PR.crate(B, X(bx), Y(0.9), Z(bz), 0.7, -0.3 * sd); }
      else if (kind === 'barrel') PR.barrel(B, X(bx), Y(0), Z(bz), 0.9);
      else { PR.sack(B, X(bx), Y(0), Z(bz), 1); PR.sack(B, X(bx + sd * 0.5), Y(0), Z(bz + 0.6), 0.9); }
    }
  }
  PR.cart(B, X(-8), Y(0), Z(57), 0.4);
  PR.cart(B, X(26), Y(0), Z(8), -0.6);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    PR.bench(B, X(Math.sin(a) * 9.5), Y(0), Z(36 + Math.cos(a) * 9.5), a + Math.PI / 2, 2.4);
  }
  for (const [px, pz, k] of [[-11, 63, 'lemon'], [11, 63, 'lemon'], [-30, 24, 'blossom'], [30, 24, 'blossom'], [-30, 48, 'lavender'], [30, 48, 'lavender'], [-40, -4, 'blossom'], [40, -4, 'blossom']]) PR.pottedTree(B, X(px), Y(0), Z(pz), k);
  // knight statues at the grand stair and outside the gate
  PR.statue(B, X(-11.5), Y(0), Z(15.5), 0, 'knight', 1.1);
  PR.statue(B, X(11.5), Y(0), Z(15.5), 0, 'knight', 1.1);
  PR.statue(B, X(-8), Y(0), Z(WZ + 7), 0, 'knight', 1.25);
  PR.statue(B, X(8), Y(0), Z(WZ + 7), 0, 'knight', 1.25);
  // climbing roses on walls
  for (const bx of [-9.5, 9.5, -26, 26, -52, 52]) PR.roses(B, X(bx), Y(0), Z(WZ - WT / 2 - 0.02), Math.PI / 2, 2.6, 5, bx % 2 ? '#f7a8c8' : '#ffc0d6');
  for (const bx of [-38, -26, -16, 16, 26, 38]) PR.roses(B, X(bx), Y(0), Z(TZ1 + 0.02), -Math.PI / 2, 3, 7.5, ['#f7a8c8', '#e8a0f0', '#ffd0dc'][Math.abs(bx) % 3]);
  for (const [hx, hz] of [[-52, 56], [-36, 57], [36, 57], [52, 56]]) {
    PR.roses(B, X(hx - 2.8), Y(0), Z(hz - 4.05), Math.PI / 2, 1.2, 3.8, '#f7a8c8');
    PR.wallLantern(B, X(hx + 1.6), Y(2.6), Z(hz - 4.05), Math.PI / 2, lampsExtra);
  }
  // wall lanterns at doors
  PR.wallLantern(B, X(-47.7), Y(2.8), Z(27.9), 0, lampsExtra);
  PR.wallLantern(B, X(-47.7), Y(2.8), Z(32.1), 0, lampsExtra);
  PR.wallLantern(B, X(-50.7), Y(2.6), Z(3.9), 0, lampsExtra);
  PR.wallLantern(B, X(48.7), Y(2.8), Z(1.8), Math.PI, lampsExtra);
  PR.wallLantern(B, X(-3.4), Y(TH + 5.2), Z(KZ1 + 0.3), -Math.PI / 2, lampsExtra);
  PR.wallLantern(B, X(3.4), Y(TH + 5.2), Z(KZ1 + 0.3), -Math.PI / 2, lampsExtra);
  PR.wallLantern(B, X(-33.2), Y(TH + 3.4), Z(-12.7), -Math.PI / 2, lampsExtra);
  PR.wallLantern(B, X(-28.8), Y(TH + 3.4), Z(-12.7), -Math.PI / 2, lampsExtra);
  // training yard by the barracks
  for (const [dx, dz] of [[45, -8], [45, -12.5], [49.5, -12.5]]) PR.dummy(B, X(dx), Y(0), Z(dz), Math.PI / 2);
  spawn.dummies = [[45, -8], [45, -12.5], [49.5, -12.5]].map(([dx, dz]) => new THREE.Vector3(X(dx), Y(0), Z(dz)));
  // barracks interior: bunks + weapon rack
  for (const bz of [-0.5, 3.5, 7.5]) {
    B.box('wood', X(64.8), Y(0), Z(bz), 2.2, 0.5, 1.1, 0, { color: C('#8a6246') });
    B.box('plain', X(64.8), Y(0.5), Z(bz), 2.0, 0.18, 0.95, 0, { color: C('#e8e2f0'), collide: false });
    B.box('wood', X(64.8), Y(1.6), Z(bz), 2.2, 0.1, 1.1, 0, { color: C('#8a6246'), collide: false });
    B.box('plain', X(64.8), Y(1.7), Z(bz), 2.0, 0.18, 0.95, 0, { color: C('#dfe6f5'), collide: false });
  }
  // smithy extras
  PR.grindstone(B, X(52), Y(0), Z(34.5), 0);
  PR.barrel(B, X(51), Y(0), Z(24), 0.9);
  PR.barrel(B, X(51.9), Y(0), Z(24.5), 0.8);
  PR.crate(B, X(64.5), Y(0), Z(24.5), 1.0, 0.3);
  // armor stand
  B.cyl('wood', X(63.5), Y(0), Z(36), 0.06, 0.08, 1.7, 6, { color: C('#7a5238') });
  B.add('iron', LATHE_CHEST, X(63.5), Y(1.05), Z(36), 0, -Math.PI / 2, 0, 1, 1, 0.8, { worldUV: false });
  B.sphere('iron', X(63.5), Y(1.95), Z(36), 0.17, { color: C('#dfe6f0') });
  // --- throne room ---
  for (const sd of [-1, 1]) {
    PR.statue(B, X(sd * 6.5), Y(TH), Z(-34.6), sd < 0 ? Math.PI / 2 : -Math.PI / 2, 'knight', 0.85);
    for (const cz of [-40, -46]) PR.candelabra(B, X(sd * 4.2), Y(TH), Z(cz), lampsExtra, 1.8);
    PR.candelabra(B, X(sd * 5.4), Y(TH + 0.45), Z(-51.2), lampsExtra, 1.4);
    PR.pottedTree(B, X(sd * 15.6), Y(TH), Z(-34.4), 'blossom');
  }
  // throne canopy (baldachin)
  for (const [cx, cz] of [[-1.9, -52.9], [1.9, -52.9], [-1.9, -50.3], [1.9, -50.3]]) B.cyl('gold', X(cx), Y(TH + 0.9), Z(cz), 0.07, 0.09, 4.9, 8, { collide: false, ao: false });
  B.box('fabric', X(0), Y(TH + 5.8), Z(-51.6), 4.4, 0.25, 3.2, 0, { color: C('#b8407a'), collide: false, ao: false });
  B.add('fabric', BANNER, X(0), Y(TH + 1), Z(-52.95), 0, 0, 0, 3.6, 4.8, 1, { color: C('#c94f7c'), worldUV: false });
  B.box('gold', X(0), Y(TH + 6.05), Z(-51.6), 4.6, 0.12, 3.4, 0, { collide: false, ao: false });
  // rose window above the gallery
  {
    const rz = KZ0 + 0.33, ry = TH + 13.2;
    B.add('stained', CYLU, X(0), Y(ry), Z(rz), Math.PI / 2, 0, 0, 2.4, 0.08, 2.4, { color: C('#ffd6f0') });
    B.add('stained', CYLU, X(0), Y(ry), Z(rz + 0.02), Math.PI / 2, 0, 0, 1.0, 0.08, 1.0, { color: C('#ffe8a0') });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      B.add('stained', CYLU, X(Math.sin(a) * 1.7), Y(ry + Math.cos(a) * 1.7), Z(rz + 0.02), Math.PI / 2, 0, 0, 0.45, 0.08, 0.45, { color: C(['#9fd0ff', '#ffb3d9', '#c7b3ff'][i % 3]) });
      B.add('gold', BOXU, X(Math.sin(a) * 1.25), Y(ry + Math.cos(a) * 1.25), Z(rz + 0.06), 0, 0, -a, 0.06, 2.4, 0.04, { order: 'YXZ', ao: false });
    }
    B.add('gold', TORUS, X(0), Y(ry), Z(rz + 0.05), 0, 0, 0, 2.45, 2.45, 2.45, { worldUV: false, ao: false });
    B.add('gold', TORUS, X(0), Y(ry), Z(rz + 0.05), 0, 0, 0, 1.0, 1.0, 1.0, { worldUV: false, ao: false });
  }
  // --- chapel: statue of the First Queen, candles, roses ---
  PR.statue(B, X(-31), Y(TH), Z(-30.15), 0, 'queen', 0.7);
  for (const sd of [-1, 1]) PR.candelabra(B, X(-31 + sd * 2.2), Y(TH), Z(-28.6), lampsExtra, 1.3);
  PR.roses(B, X(-37.3), Y(TH), Z(-18), 0, 2.4, 6, '#f7a8c8');
  PR.roses(B, X(-24.7), Y(TH), Z(-18), Math.PI, 2.4, 6, '#ffc0d6');
  // --- gardens: more flowers & benches ---
  PR.bench(B, X(24), Y(TH), Z(-25), 0.3, 2.2);
  PR.bench(B, X(36), Y(TH), Z(-25), -0.3, 2.2);
  PR.pottedTree(B, X(18), Y(TH), Z(-12), 'blossom');
  PR.pottedTree(B, X(40), Y(TH), Z(-36), 'lavender');
  const group = B.build();
  group.name = 'castle';
  scene.add(group);

  // ---------- dynamic parts ----------
  // levitation disc
  const discMat = new THREE.MeshStandardMaterial({ color: 0xfff3d1, emissive: 0xffd27a, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 32), discMat);
  disc.position.set(X(SX), Y(spireBase) + 0.02, Z(SZ));
  disc.receiveShadow = true;
  scene.add(disc);
  const runes = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 32), new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  runes.rotation.x = -Math.PI / 2;
  runes.position.y = 0.14;
  disc.add(runes);
  const discCol = collision.addDynamicDisc(X(SX), Z(SZ), 2.2, disc.position.y + 0.125);
  const elevator = {
    mesh: disc, col: discCol, runes,
    bottom: Y(spireBase) + 0.02, top: Y(OBS) - 0.125, target: null, speed: 7,
    update(dt, t) {
      runes.rotation.z += dt * 0.8;
      if (this.target !== null) {
        const dy = this.target - disc.position.y;
        const step = Math.sign(dy) * Math.min(Math.abs(dy), this.speed * dt);
        disc.position.y += step;
        if (Math.abs(dy) < 0.001) this.target = null;
      }
      discCol.y = disc.position.y + 0.125;
    },
    moving() { return this.target !== null; },
    atTop() { return Math.abs(disc.position.y - this.top) < 0.1; },
  };

  // Heart of Light
  const heartMat = new THREE.MeshStandardMaterial({ color: 0xd9c8ff, emissive: 0x8f7cff, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.92 });
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), heartMat);
  heart.scale.set(1, 1.7, 1);
  heart.position.copy(spawn.heart);
  scene.add(heart);
  const heartShards = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), heartMat);
    s.scale.set(0.6, 1.4, 0.6);
    s.visible = false;
    scene.add(s);
    heartShards.push(s);
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 600, 24, 1, true), beamMat);
  beam.position.copy(spawn.heart).add(new THREE.Vector3(0, 302, 0));
  scene.add(beam);
  const heartObj = {
    mesh: heart, shards: heartShards, beam, mat: heartMat, restored: 0,
    update(dt, t, shardCount, restored) {
      heart.rotation.y += dt * 0.4;
      heart.position.y = spawn.heart.y + Math.sin(t * 0.8) * 0.4;
      for (let i = 0; i < 3; i++) {
        const s = heartShards[i];
        s.visible = i < shardCount;
        const a = t * 0.9 + (i / 3) * Math.PI * 2;
        s.position.set(spawn.heart.x + Math.sin(a) * 4.2, spawn.heart.y + Math.sin(t * 1.3 + i) * 0.6, spawn.heart.z + Math.cos(a) * 4.2);
        s.rotation.y = a;
      }
      const target = restored ? 1 : 0;
      this.restored += (target - this.restored) * Math.min(1, dt * 0.5);
      const r = this.restored;
      heartMat.emissive.setRGB(0.56 + r * 0.44, 0.49 + r * 0.4, 1.0 - r * 0.35);
      heartMat.emissiveIntensity = 0.6 + r * 2.2 + Math.sin(t * 2) * 0.1;
      heartMat.color.setRGB(0.85 + r * 0.15, 0.78 + r * 0.2, 1);
      beamMat.opacity = r * (0.22 + Math.sin(t * 1.5) * 0.04);
    },
  };

  const animated = [PR.armillary(scene, X(SX + 4.5), Y(OBS + 2.2), Z(SZ - 3), 1.1)];
  return { group, lamps, spawn, elevator, heart: heartObj, interactables, animated };
}

function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ------- shared unit geometries --------
const BOX = new THREE.BoxGeometry(1, 1, 1);
const BOXU = BOX;
const CYLU = new THREE.CylinderGeometry(1, 1, 1, 32);
const OCTA = new THREE.OctahedronGeometry(1, 0);
const PRISM_BALL = new THREE.SphereGeometry(1, 20, 14);
const TORUS = new THREE.TorusGeometry(1, 0.06, 8, 48);
const LATHE_CHEST = new THREE.LatheGeometry([[0.001, -0.4], [0.2, -0.38], [0.22, -0.2], [0.25, 0.0], [0.27, 0.2], [0.24, 0.35], [0.12, 0.42], [0.001, 0.43]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
// banner: plane hanging down from top (y from -1 to 0 scaled), with a pointed tail
const BANNER = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0.5, -0.9); s.lineTo(0, -1); s.lineTo(-0.5, -0.9); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.translate(0, 1, 0.08);
  return g;
})();
const PENNANT = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.3); s.lineTo(1, 0); s.lineTo(0, -0.3); s.closePath();
  return new THREE.ShapeGeometry(s);
})();
// wedge (right triangle prism): bottom at 0, height 1 at local -z, 0 at +z; width x 1, length z 1
const WEDGE = (() => {
  const g = new THREE.BufferGeometry();
  const v = [
    // bottom
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
    // back (tall side at -z)
    -0.5, 0, -0.5, -0.5, 1, -0.5, 0.5, 1, -0.5, -0.5, 0, -0.5, 0.5, 1, -0.5, 0.5, 0, -0.5,
    // slope
    -0.5, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 1, -0.5, 0.5, 0, 0.5, 0.5, 1, -0.5,
    // left side
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, -0.5,
    // right side
    0.5, 0, -0.5, 0.5, 1, -0.5, 0.5, 0, 0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2));
  return g;
})();
