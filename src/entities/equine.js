// Equine: sculpted horse / unicorn with tack, a flowing mane & tail, and gait-correct
// leg animation (4-beat walk, diagonal trot, transverse gallop). Faces +z, stands at y=0.
import * as THREE from 'three';
import { RigBuilder, lathe, taper, capsule, PRIM } from './rig.js';
import { lockGeometry } from './face.js';
import { damp } from '../engine/noise.js';

export const COATS = {
  white: { coat: 0xf6f3f7, mane: 0xfbf8ff, hoof: 0x5a5058, muzzle: 0xe6d6dc, socks: null },
  unicorn: { coat: 0xfbf8ff, mane: 0xffffff, maneTint: [0xffe4f2, 0xeee4ff, 0xe4f2ff], hoof: 0xf0c860, muzzle: 0xf2dfe8, socks: null },
  grey: { coat: 0xc9c6cf, mane: 0xeeeef2, hoof: 0x4a4048, muzzle: 0x8a8490, socks: null, dapple: true },
  bay: { coat: 0x8a5a3a, mane: 0x2a201c, hoof: 0x3a302c, muzzle: 0x4a3428, socks: 0x2a201c },
  chestnut: { coat: 0xb0663a, mane: 0xc87a44, hoof: 0x4a3a30, muzzle: 0x7a4a30, socks: 0xf4ece4 },
  black: { coat: 0x2a2630, mane: 0x16141a, hoof: 0x2a2428, muzzle: 0x3a3440, socks: null },
  palomino: { coat: 0xe0b870, mane: 0xfbf4e6, hoof: 0x5a4a40, muzzle: 0xc09a60, socks: 0xfbf4e6 },
};

// gait tables: leg phase offsets (LF, RF, LH, RH), duty factor, swing amplitude, flex, stride length
const GAITS = {
  walk: { off: [0.25, 0.75, 0.0, 0.5], duty: 0.62, amp: 0.3, flex: 0.75, stride: 1.7 },
  trot: { off: [0.0, 0.5, 0.5, 0.0], duty: 0.44, amp: 0.42, flex: 1.05, stride: 2.6 },
  gallop: { off: [0.55, 0.42, 0.12, 0.0], duty: 0.34, amp: 0.62, flex: 1.3, stride: 4.2 },
};

export class Equine {
  constructor(opts = {}) {
    const o = { coat: 'bay', saddle: true, blanket: 0xf2a6c9, trim: 0xf0c860, bridle: 0x6a4030, scale: 1, horn: false, feather: false, ...opts };
    const C = COATS[o.coat] || COATS.bay;
    this.o = o;
    this.root = new THREE.Group();
    const R = new RigBuilder();
    const coat = C.coat, belly = C.coat, muzzle = C.muzzle;
    const base = R.bone('base', null, 0, 0, 0);
    const body = R.bone('body', base, 0, 1.2, 0);

    // ---------------- body ----------------
    // barrel along +z (lathe axis y -> z), slightly narrow
    const barrel = lathe([[0.02, -0.98], [0.2, -0.95], [0.31, -0.84], [0.36, -0.64], [0.37, -0.36], [0.38, -0.06], [0.375, 0.22], [0.35, 0.5], [0.29, 0.72], [0.18, 0.85], [0.02, 0.9]], 18);
    R.part(body, barrel, coat, { rx: Math.PI / 2, sx: 0.8 });
    R.part(body, PRIM.sphere, belly, { y: -0.2, z: 0.02, sx: 0.29, sy: 0.2, sz: 0.62 });
    for (const s of [-1, 1]) {
      R.part(body, PRIM.sphere, coat, { x: s * 0.15, y: 0.08, z: -0.6, sx: 0.23, sy: 0.33, sz: 0.33 }); // hindquarters
      R.part(body, PRIM.sphere, coat, { x: s * 0.16, y: -0.02, z: 0.5, sx: 0.19, sy: 0.35, sz: 0.25 }); // shoulders
    }
    R.part(body, PRIM.sphere, coat, { y: 0.22, z: -0.55, sx: 0.3, sy: 0.17, sz: 0.4 }); // croup
    R.part(body, PRIM.sphere, coat, { y: 0.3, z: 0.42, sx: 0.17, sy: 0.14, sz: 0.3 }); // withers
    R.part(body, PRIM.sphere, coat, { y: -0.08, z: 0.72, sx: 0.26, sy: 0.3, sz: 0.19 }); // chest
    if (C.dapple) for (let i = 0; i < 14; i++) R.part(body, PRIM.sphereLo, 0xd2cfd7, { x: (i % 2 ? 1 : -1) * 0.287, y: -0.02 + ((i * 7) % 5) * 0.05, z: -0.55 + (i % 7) * 0.15, sx: 0.012, sy: 0.045, sz: 0.045 });

    // ---------------- neck & head ----------------
    const neck = R.bone('neck', body, 0, 0.22, 0.62);
    R.part(neck, lathe([[0.215, -0.04], [0.2, 0.18], [0.165, 0.46], [0.135, 0.72], [0.12, 0.86], [0.06, 0.93]], 14), coat, { sx: 0.62, sz: 1.25, z: 0.03 });
    R.part(neck, PRIM.sphere, coat, { y: 0.78, z: 0.07, sx: 0.09, sy: 0.12, sz: 0.13 }); // throat latch
    const head = R.bone('head', neck, 0, 0.86, 0.02);
    R.part(head, PRIM.sphere, coat, { y: -0.02, z: 0.06, sx: 0.12, sy: 0.13, sz: 0.16 }); // skull
    R.part(head, PRIM.sphere, coat, { y: -0.11, z: 0.03, sx: 0.105, sy: 0.15, sz: 0.17 }); // jowl
    R.part(head, lathe([[0.1, 0], [0.096, 0.1], [0.086, 0.25], [0.076, 0.36], [0.07, 0.43]], 14), coat, { rx: Math.PI / 2, y: -0.05, z: 0.1, sx: 0.84, sz: 1.1 }); // face
    R.part(head, PRIM.sphere, muzzle, { y: -0.1, z: 0.52, sx: 0.083, sy: 0.088, sz: 0.1 });
    R.part(head, PRIM.sphere, muzzle, { y: -0.165, z: 0.49, sx: 0.072, sy: 0.045, sz: 0.085 }); // lower lip
    for (const s of [-1, 1]) {
      R.part(head, PRIM.sphereLo, 0x2a1e22, { x: s * 0.042, y: -0.075, z: 0.6, sx: 0.018, sy: 0.026, sz: 0.018 }, 'hair'); // nostrils
      R.part(head, PRIM.sphere, 0x241a1e, { x: s * 0.1, y: 0.0, z: 0.13, sx: 0.028, sy: 0.03, sz: 0.032 }, 'hair'); // eyes
      R.part(head, PRIM.sphereLo, coat, { x: s * 0.098, y: 0.022, z: 0.13, sx: 0.034, sy: 0.014, sz: 0.036 }); // upper lid
      R.part(head, PRIM.cone, coat, { x: s * 0.055, y: 0.13, z: -0.03, sx: 0.036, sy: 0.14, sz: 0.028, rz: -s * 0.25, rx: 0.15 }); // ears
      R.part(head, PRIM.cone, 0xd8c8cc, { x: s * 0.057, y: 0.125, z: -0.02, sx: 0.022, sy: 0.1, sz: 0.012, rz: -s * 0.25, rx: 0.15 });
    }
    if (C.coat === 0x8a5a3a || o.blaze) R.part(head, PRIM.sphereLo, 0xf6f0ea, { y: 0.02, z: 0.28, sx: 0.03, sy: 0.02, sz: 0.2, rx: -0.12 }); // blaze
    // forelock
    const maneCols = C.maneTint ? [C.mane, ...C.maneTint] : [C.mane];
    for (let i = 0; i < 5; i++) R.part(head, lockGeometry(0.2 + (i % 2) * 0.05, 0.03, 0.2), maneCols[i % maneCols.length], { x: (i - 2) * 0.018, y: 0.12, z: 0.03, rx: -1.55 + (i % 3) * 0.1, rz: (i - 2) * 0.15 }, 'hair');
    if (o.horn) {
      // pearl spiral horn
      R.part(head, lathe([[0.034, 0], [0.028, 0.12], [0.018, 0.28], [0.006, 0.42], [0.001, 0.46]], 12), 0xfff4dc, { y: 0.1, z: 0.13, rx: 0.95 }, 'glow');
      for (let i = 0; i < 7; i++) {
        const t = i / 7;
        R.part(head, new THREE.TorusGeometry(1, 0.18, 6, 14), 0xf0c860, { y: 0.1 + Math.cos(0.95) * t * 0.4, z: 0.13 + Math.sin(0.95) * t * 0.4, sx: 0.034 * (1 - t * 0.85), sy: 0.034 * (1 - t * 0.85), sz: 0.034 * (1 - t * 0.85), rx: 0.95 + Math.PI / 2 + 0.25 }, 'metal');
      }
    }
    // bridle
    if (o.saddle || o.bridleOnly) {
      const bc = o.bridle;
      R.part(head, new THREE.TorusGeometry(1, 0.08, 6, 20), bc, { y: -0.08, z: 0.4, sx: 0.09, sy: 0.1, sz: 0.1, ry: Math.PI / 2 });
      R.part(head, new THREE.TorusGeometry(1, 0.06, 6, 20), o.trim, { y: 0.05, z: 0.04, sx: 0.125, sy: 0.125, sz: 0.1, ry: Math.PI / 2, rz: 0.2 }, 'metal'); // browband
      for (const s of [-1, 1]) {
        R.part(head, PRIM.box, bc, { x: s * 0.11, y: -0.04, z: 0.2, sx: 0.012, sy: 0.025, sz: 0.4, rx: 0.12 });
        R.part(head, new THREE.TorusGeometry(1, 0.25, 6, 12), o.trim, { x: s * 0.075, y: -0.14, z: 0.44, sx: 0.028, sy: 0.028, sz: 0.028, ry: Math.PI / 2 }, 'metal');
        R.part(head, PRIM.sphereLo, o.trim, { x: s * 0.12, y: 0.05, z: 0.04, sx: 0.022, sy: 0.022, sz: 0.012 }, 'metal'); // rosettes
      }
    }
    // mane: two bones along the crest so it can sway
    const maneA = R.bone('maneA', neck, 0, 0.12, -0.1);
    const maneB = R.bone('maneB', neck, 0, 0.5, -0.07);
    const maneN = o.horn ? 16 : 13;
    for (let i = 0; i < maneN; i++) {
      const t = i / (maneN - 1);
      const bone = t < 0.5 ? maneA : maneB;
      const y = t < 0.5 ? t * 0.76 : (t - 0.5) * 0.76;
      const len = (o.horn ? 0.55 : 0.4) + Math.sin(t * Math.PI) * 0.12 + (i % 3) * 0.03;
      R.part(bone, lockGeometry(len, 0.052 + (i % 2) * 0.012, 0.25), maneCols[i % maneCols.length], { x: 0.035, y, z: 0.0 - t * 0.02, rx: -0.55, rz: -0.42 - (i % 3) * 0.12 }, 'hair');
      if (i % 2 === 0) R.part(bone, lockGeometry(len * 0.8, 0.04, 0.2), maneCols[(i + 1) % maneCols.length], { x: -0.02, y, z: 0.0, rx: -0.55, rz: 0.2 }, 'hair');
    }

    // ---------------- tail ----------------
    const tail1 = R.bone('tail1', body, 0, 0.23, -0.9);
    const tail2 = R.bone('tail2', tail1, 0, -0.32, 0);
    const tail3 = R.bone('tail3', tail2, 0, -0.34, 0);
    R.part(tail1, taper(0.055, 0.035, 0.3, 8), coat, {});
    const tailLocks = (bone, n, len, spread) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        R.part(bone, lockGeometry(len * (0.85 + (i % 3) * 0.1), 0.05, 0.18), maneCols[i % maneCols.length], { x: Math.cos(a) * spread, z: Math.sin(a) * spread, y: -0.02, rz: Math.cos(a) * 0.12, rx: Math.sin(a) * 0.12 }, 'hair');
      }
    };
    tailLocks(tail1, 9, 0.42, 0.03);
    tailLocks(tail2, 9, 0.45, 0.05);
    tailLocks(tail3, 7, o.horn ? 0.5 : 0.4, 0.06);

    // ---------------- legs ----------------
    this.legs = [];
    const sock = C.socks;
    const hoofC = C.hoof;
    const hoofKind = o.coat === 'unicorn' || o.goldHooves ? 'metal' : 'matte';
    const mkLower = (fet, front) => {
      const pastern = R.bone('pastern', fet, 0, 0, 0);
      R.part(fet, PRIM.sphere, sock || coat, { sx: 0.052, sy: 0.055, sz: 0.058, z: -0.005 });
      R.part(pastern, taper(0.04, 0.046, 0.11, 8), sock || coat, { rx: -0.35 });
      R.part(pastern, lathe([[0.044, 0.02], [0.056, -0.04], [0.066, -0.1], [0.001, -0.1]], 14), hoofC, { y: -0.1, z: 0.035, rx: -0.12 }, hoofKind);
      if (o.feather) for (let i = 0; i < 5; i++) R.part(pastern, lockGeometry(0.13, 0.03, 0.2), maneCols[i % maneCols.length], { x: (i - 2) * 0.022, y: 0.02, z: -0.04, rx: 0.3, rz: (i - 2) * 0.2 }, 'hair');
      return pastern;
    };
    for (const [side, front] of [[1, 1], [-1, 1], [1, 0], [-1, 0]]) {
      if (front) {
        const up = R.bone('shoulder', body, side * 0.16, -0.16, 0.52);
        R.part(up, taper(0.085, 0.06, 0.43, 10), coat, { sz: 1.15 });
        R.part(up, PRIM.sphere, coat, { y: -0.06, z: 0.02, sx: 0.085, sy: 0.14, sz: 0.1 }); // forearm muscle
        const knee = R.bone('knee', up, 0, -0.44, 0);
        R.part(knee, PRIM.sphere, coat, { sx: 0.055, sy: 0.06, sz: 0.058 });
        R.part(knee, taper(0.043, 0.038, 0.33, 8), sock || coat, {});
        const fet = R.bone('fetlock', knee, 0, -0.36, 0);
        const pas = mkLower(fet, true);
        this.legs.push({ up, knee, fet, pas, front: true, side, baseUp: 0, baseKnee: 0 });
      } else {
        const up = R.bone('hip', body, side * 0.15, -0.14, -0.62);
        R.part(up, PRIM.sphere, coat, { y: -0.08, z: 0.02, sx: 0.13, sy: 0.25, sz: 0.19 }); // thigh
        R.part(up, taper(0.09, 0.058, 0.47, 10), coat, { rx: 0.27, sz: 1.2 }); // gaskin
        const hock = R.bone('hock', up, 0, -0.455, -0.125);
        R.part(hock, PRIM.sphere, coat, { sx: 0.05, sy: 0.068, sz: 0.07, z: -0.015 });
        R.part(hock, taper(0.045, 0.039, 0.36, 8), sock || coat, {});
        const fet = R.bone('fetlock', hock, 0, -0.38, 0);
        const pas = mkLower(fet, false);
        this.legs.push({ up, knee: hock, fet, pas, front: false, side, baseUp: 0, baseKnee: 0 });
      }
    }

    // ---------------- tack ----------------
    if (o.saddle) {
      const blanket = o.blanket, trim = o.trim;
      R.part(body, PRIM.box, blanket, { y: 0.35, z: 0.16, sx: 0.46, sy: 0.03, sz: 0.74 }, 'cloth');
      for (const s of [-1, 1]) {
        R.part(body, PRIM.box, blanket, { x: s * 0.3, y: 0.18, z: 0.16, sx: 0.02, sy: 0.4, sz: 0.74, rz: s * 0.42 }, 'cloth');
        R.part(body, PRIM.box, trim, { x: s * 0.385, y: 0.0, z: 0.16, sx: 0.02, sy: 0.05, sz: 0.76, rz: s * 0.42 }, 'metal');
        R.part(body, PRIM.box, trim, { x: s * 0.33, y: 0.18, z: 0.535, sx: 0.022, sy: 0.4, sz: 0.03, rz: s * 0.42 }, 'metal');
        // tassel
        R.part(body, PRIM.cone, trim, { x: s * 0.4, y: -0.06, z: -0.2, sx: 0.025, sy: 0.07, sz: 0.025, rx: Math.PI }, 'metal');
        // stirrup leathers + irons
        R.part(body, PRIM.box, 0x5a3a28, { x: s * 0.27, y: 0.05, z: 0.26, sx: 0.015, sy: 0.42, sz: 0.035, rz: s * 0.25 });
        R.part(body, new THREE.TorusGeometry(1, 0.14, 6, 14), trim, { x: s * 0.33, y: -0.17, z: 0.26, sx: 0.06, sy: 0.055, sz: 0.06, ry: Math.PI / 2 }, 'metal');
        // girth
        R.part(body, PRIM.box, 0x5a3a28, { x: s * 0.22, y: -0.08, z: 0.4, sx: 0.02, sy: 0.4, sz: 0.06, rz: s * 0.3 });
        // reins from the bit rings toward the pommel
        R.part(body, PRIM.box, o.bridle, { x: s * 0.1, y: 0.47, z: 0.72, sx: 0.01, sy: 0.01, sz: 0.62, rx: -0.55 });
      }
      R.part(body, lathe([[0.001, 0.04], [0.14, 0.035], [0.2, 0.0], [0.19, -0.04], [0.001, -0.045]], 16), 0x8a5a38, { y: 0.4, z: 0.18, sx: 1.0, sz: 1.5 });
      R.part(body, PRIM.sphere, 0x7a4a30, { y: 0.47, z: 0.44, sx: 0.12, sy: 0.07, sz: 0.06 }); // pommel
      R.part(body, PRIM.sphere, 0x7a4a30, { y: 0.49, z: -0.1, sx: 0.17, sy: 0.08, sz: 0.05 }); // cantle
      R.part(body, PRIM.sphereLo, trim, { y: 0.51, z: 0.46, sx: 0.035, sy: 0.035, sz: 0.035 }, 'metal');
      // breastplate with a golden medallion
      R.part(body, new THREE.TorusGeometry(1, 0.05, 6, 24, Math.PI), 0x6a4030, { y: 0.05, z: 0.72, sx: 0.3, sy: 0.32, sz: 0.3, rx: -0.4, rz: Math.PI });
      R.part(body, PRIM.cyl, trim, { y: -0.12, z: 0.9, sx: 0.06, sy: 0.015, sz: 0.06, rx: Math.PI / 2 - 0.3 }, 'metal');
      R.part(body, PRIM.sphereLo, 0xff8ac8, { y: -0.12, z: 0.915, sx: 0.025, sy: 0.025, sz: 0.012 }, 'glow');
    }

    const built = R.build();
    for (const m of built.meshes) {
      m.boundingSphere.center.set(0, 1.1, 0);
      m.boundingSphere.radius = 2.2;
      this.root.add(m);
    }
    this.root.scale.setScalar(o.scale);
    this.base = base; this.bodyB = body; this.neck = neck; this.head = head;
    this.maneA = maneA; this.maneB = maneB; this.tail = [tail1, tail2, tail3];
    this.seatHeight = 0.74 * o.scale; // rider root offset above the horse's feet
    this.phase = Math.random();
    this.t = Math.random() * 10;
    this.graze = 0;
    this.gaitMix = { walk: 1, trot: 0, gallop: 0 };
    this.headToss = 0;
    this.swish = 0;
    this.deadT = 0;
    this.pose();
  }

  pose() {
    this.neck.rotation.x = 0.62;
    this.head.rotation.x = 0.2;
    this.tail[0].rotation.x = 0.32;
  }

  // compatible with Quadruped.update(dt, { speed, graze, rear, dead, deathT, alert })
  update(dt, st = {}) {
    this.t += dt;
    const sp = st.speed || 0;
    const want = sp < 2.6 ? 'walk' : sp < 6.2 ? 'trot' : 'gallop';
    for (const k of Object.keys(this.gaitMix)) this.gaitMix[k] = damp(this.gaitMix[k], k === want ? 1 : 0, 6, dt);
    const G = GAITS[want];
    const moving = sp > 0.15;
    this.phase = (this.phase + dt * sp / G.stride) % 1;
    const w = this.gaitMix;
    const amp = GAITS.walk.amp * w.walk + GAITS.trot.amp * w.trot + GAITS.gallop.amp * w.gallop;
    const flex = GAITS.walk.flex * w.walk + GAITS.trot.flex * w.trot + GAITS.gallop.flex * w.gallop;
    const mv = Math.min(1, sp / 1.2);
    const order = [0, 1, 2, 3]; // LF RF LH RH -> legs array order [RF? ...] mapping below
    this.legs.forEach((L, i) => {
      // legs pushed as: front R(+x), front L(-x), hind R, hind L. gait offsets: LF, RF, LH, RH
      const gi = L.front ? (L.side > 0 ? 1 : 0) : (L.side > 0 ? 3 : 2);
      const p = (this.phase + G.off[gi]) % 1;
      let a, f;
      if (p < G.duty) { a = amp * (1 - (2 * p) / G.duty); f = 0; } else {
        const s = (p - G.duty) / (1 - G.duty);
        const e = s * s * (3 - 2 * s);
        a = -amp + 2 * amp * e;
        f = flex * Math.sin(s * Math.PI);
      }
      a *= mv; f *= mv;
      if (L.front) {
        L.up.rotation.x = damp(L.up.rotation.x, -a + (st.rear ? -1.1 : 0), 18, dt);
        L.knee.rotation.x = damp(L.knee.rotation.x, f * 1.1 + (st.rear ? 1.4 : 0), 18, dt);
        L.fet.rotation.x = damp(L.fet.rotation.x, f * 0.5, 18, dt);
      } else {
        L.up.rotation.x = damp(L.up.rotation.x, -a * 0.85 + (moving ? 0 : (i === 2 ? Math.sin(this.t * 0.3) * 0.04 : 0)), 18, dt);
        L.knee.rotation.x = damp(L.knee.rotation.x, -f * 0.75, 18, dt);
        L.fet.rotation.x = damp(L.fet.rotation.x, f * 0.6, 18, dt);
      }
    });
    // body motion per gait
    const ph2 = this.phase * Math.PI * 2;
    const bob = (w.walk * Math.sin(ph2 * 2) * 0.012 + w.trot * Math.abs(Math.sin(ph2 * 2)) * 0.05 + w.gallop * Math.sin(ph2) * 0.07) * mv;
    const pitch = (w.gallop * Math.sin(ph2 + 0.8) * 0.09 + w.walk * Math.sin(ph2 * 2) * 0.01) * mv;
    this.bodyB.position.y = damp(this.bodyB.position.y, 1.2 + bob + (st.rear ? 0.35 : 0), 20, dt);
    this.bodyB.rotation.x = damp(this.bodyB.rotation.x, pitch + (st.rear ? -0.55 : 0), 14, dt);
    // neck & head: nod with the stride, graze when idle, occasional toss
    if (st.graze) this.graze = damp(this.graze, 1, 1.5, dt); else this.graze = damp(this.graze, 0, 4, dt);
    this.headToss -= dt;
    if (!moving && this.headToss < -6 - Math.random() * 6) this.headToss = 0.8;
    const toss = this.headToss > 0 ? Math.sin((1 - this.headToss / 0.8) * Math.PI) * 0.25 : 0;
    const nod = (w.walk * Math.sin(ph2 * 2 + 1) * 0.06 + w.gallop * Math.sin(ph2 + 2) * 0.16 + w.trot * 0.08) * mv;
    this.neck.rotation.x = damp(this.neck.rotation.x, 0.62 + nod + this.graze * 1.45 - toss - (st.alert ? 0.2 : 0) + w.gallop * mv * 0.2, 8, dt);
    this.neck.rotation.y = damp(this.neck.rotation.y, moving ? 0 : Math.sin(this.t * 0.37) * 0.12, 3, dt);
    this.head.rotation.x = damp(this.head.rotation.x, 0.2 - this.graze * 0.35 + toss * 0.5, 8, dt);
    // mane blows back with speed and ripples
    const wind = Math.min(1, sp / 9);
    this.maneA.rotation.x = damp(this.maneA.rotation.x, -wind * 0.35 + Math.sin(this.t * 6 + 1) * 0.04 * (0.3 + wind), 10, dt);
    this.maneB.rotation.x = damp(this.maneB.rotation.x, -wind * 0.45 + Math.sin(this.t * 6.5) * 0.05 * (0.3 + wind), 10, dt);
    this.maneA.rotation.z = Math.sin(this.t * 2.2) * 0.05; this.maneB.rotation.z = Math.sin(this.t * 2.2 + 0.7) * 0.06;
    // tail: raised at speed, swishes flies away when standing
    this.swish -= dt;
    if (!moving && this.swish < -3 - Math.random() * 4) this.swish = 1.2;
    const sw = this.swish > 0 ? Math.sin((1 - this.swish / 1.2) * Math.PI * 3) * 0.6 : 0;
    const [t1, t2, t3] = this.tail;
    t1.rotation.x = damp(t1.rotation.x, 0.32 + wind * 0.9 + Math.sin(ph2 * 2) * 0.05 * mv, 6, dt);
    t1.rotation.z = damp(t1.rotation.z, sw * 0.6 + Math.sin(this.t * 1.1) * 0.05, 8, dt);
    t2.rotation.x = damp(t2.rotation.x, wind * 0.5 + Math.sin(this.t * 3 + 0.5) * 0.05, 5, dt);
    t2.rotation.z = damp(t2.rotation.z, sw * 0.5, 5, dt);
    t3.rotation.x = damp(t3.rotation.x, wind * 0.4 + Math.sin(this.t * 3 + 1.1) * 0.08, 4, dt);
    t3.rotation.z = damp(t3.rotation.z, sw * 0.4, 4, dt);
    // death: lie on the side
    if (st.dead) {
      this.deadT = Math.min(1, (st.deathT || 0) / 0.8);
      this.base.rotation.z = this.deadT * Math.PI / 2;
      this.base.position.y = this.deadT * 0.4;
    } else if (this.deadT) { this.deadT = 0; this.base.rotation.z = 0; this.base.position.y = 0; }
  }
}
