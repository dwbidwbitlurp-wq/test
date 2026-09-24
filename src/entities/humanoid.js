// Procedural humanoid rig built from primitives (baked into skinned meshes)
// + keyframed/procedural animation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { damp } from '../engine/noise.js';
import { RigBuilder, PRIM, capsule, MATS, lathe, taper, foldedLathe, DOME } from './rig.js';
import { headGeometry, faceMaterial, lockGeometry } from './face.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide });
    matCache.set(key, m);
  }
  return m;
}

// ---------- simple merged prop builder (weapons, shields) ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function propPart(list, geo, color, t) {
  const g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
  _q.setFromEuler(_e);
  _m4.compose(_p.set(t.x || 0, t.y || 0, t.z || 0), _q, _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1));
  g.applyMatrix4(_m4);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ng = g.index ? g.toNonIndexed() : g;
  list.push(ng);
}
function propMesh(groups) {
  const obj = new THREE.Group();
  for (const [kind, list] of Object.entries(groups)) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list), MATS[kind]);
    mesh.castShadow = kind !== 'glow';
    obj.add(mesh);
  }
  return obj;
}

// ---------- weapons ----------
const _xform = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1); // (x,y,z)->(z,x,y)
const WRAP = new THREE.TorusGeometry(0.026, 0.007, 10, 10);
function extruded(shape, depth, bevel = 0.006) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const AXE_HEAD = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.02, -0.06);
  s.quadraticCurveTo(0.16, -0.08, 0.26, -0.2);
  s.quadraticCurveTo(0.36, 0.0, 0.26, 0.2);
  s.quadraticCurveTo(0.16, 0.08, 0.02, 0.06);
  s.closePath();
  const g = extruded(s, 0.022, 0.006);
  g.applyMatrix4(_xform);
  return g;
})();
const KITE = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.24, 0.24);
  s.quadraticCurveTo(0, 0.3, 0.24, 0.24);
  s.quadraticCurveTo(0.25, -0.08, 0, -0.42);
  s.quadraticCurveTo(-0.25, -0.08, -0.24, 0.24);
  return extruded(s, 0.035, 0.012);
})();
const LEAF = new THREE.OctahedronGeometry(1, 0);

export function makeWeapon(kind, opts = {}) {
  const metal = [], matte = [], glow = [];
  const bladeCol = opts.bladeColor || 0xe8eef8;
  const blade = opts.glow ? glow : metal;
  const bcol = opts.glow ? opts.glow : bladeCol;
  const dark = new THREE.Color(bcol).multiplyScalar(opts.glow ? 0.6 : 0.72).getHex();
  const guardC = opts.guard || 0xf0c860;
  const gripC = opts.grip || 0x4a2e22;
  let length = 1;
  if (kind === 'sword' || kind === 'greatsword') {
    const big = kind === 'greatsword';
    const L = big ? 1.7 : 1.0;
    const W = big ? 0.12 : 0.072;
    const gripL = big ? 0.34 : 0.2;
    // blade + fuller + tip
    propPart(blade, PRIM.box, bcol, { z: 0.14 + L / 2, sx: W, sy: 0.018, sz: L });
    propPart(blade, PRIM.box, dark, { z: 0.14 + L * 0.42, sx: W * 0.26, sy: 0.021, sz: L * 0.72 });
    propPart(blade, PRIM.cone, bcol, { z: 0.14 + L + 0.09, sx: W * 0.5, sy: 0.18, sz: 0.009, rx: Math.PI / 2 });
    // ricasso + crossguard with curved quillons
    propPart(metal, PRIM.box, guardC, { z: 0.115, sx: W * 1.3, sy: 0.05, sz: 0.06 });
    for (const sd of [-1, 1]) {
      propPart(metal, PRIM.cyl, guardC, { x: sd * W * 1.35, z: 0.13, sx: 0.014, sy: W * 2.1, sz: 0.014, rz: sd * (Math.PI / 2 - 0.35) });
      propPart(metal, PRIM.sphereLo, guardC, { x: sd * W * 2.3, z: 0.2, sx: 0.022, sy: 0.022, sz: 0.022 });
    }
    // wrapped grip + pommel with gem
    propPart(matte, PRIM.cyl, gripC, { z: 0.08 - gripL / 2, sx: 0.022, sy: gripL, sz: 0.022, rx: Math.PI / 2 });
    const wraps = big ? 6 : 4;
    for (let i = 0; i < wraps; i++) propPart(matte, WRAP, 0x2e1c14, { z: 0.06 - (i + 0.5) * (gripL / wraps), rx: 0 });
    propPart(metal, PRIM.sphereLo, guardC, { z: 0.06 - gripL - 0.03, sx: 0.04, sy: 0.04, sz: 0.045 });
    propPart(glow, PRIM.sphereLo, opts.gem || (opts.glow ? opts.glow : 0xff8fc8), { z: 0.06 - gripL - 0.03, y: 0.03, sx: 0.016, sy: 0.016, sz: 0.016 });
    propPart(glow, PRIM.sphereLo, opts.gem || (opts.glow ? opts.glow : 0xff8fc8), { z: 0.115, y: 0.028, sx: 0.014, sy: 0.014, sz: 0.014 });
    length = 0.14 + L + 0.15;
  } else if (kind === 'axe' || kind === 'greataxe' || kind === 'hammer') {
    const big = kind === 'greataxe';
    const hl = big ? 1.6 : 1.1;
    propPart(matte, PRIM.cyl, 0x6a4a36, { z: hl * 0.32, sx: big ? 0.035 : 0.028, sy: hl, sz: big ? 0.035 : 0.028, rx: Math.PI / 2 });
    for (let i = 0; i < 3; i++) propPart(matte, WRAP, 0x3a2418, { z: -0.05 + i * 0.07 });
    const hz = hl * 0.32 + hl / 2 - 0.12;
    if (kind === 'hammer') {
      propPart(metal, PRIM.box, 0x8a8f9c, { z: hz, sx: 0.12, sy: 0.12, sz: 0.24, ry: 0 });
    } else {
      const sc = big ? 1.7 : 1;
      propPart(blade, AXE_HEAD, bcol, { z: hz, sx: 1, sy: sc, sz: sc });
      if (big) propPart(blade, AXE_HEAD, bcol, { z: hz, sy: -sc, sz: sc });
      propPart(metal, PRIM.cyl, guardC, { z: hz, sx: 0.045, sy: 0.12, sz: 0.045, rx: Math.PI / 2 });
    }
    propPart(metal, PRIM.cone, guardC, { z: hz + 0.12, sx: 0.03, sy: 0.1, sz: 0.03, rx: Math.PI / 2 });
    length = hz + 0.25;
  } else if (kind === 'spear') {
    propPart(matte, PRIM.cyl, 0x7a5a42, { z: 0.5, sx: 0.022, sy: 2.0, sz: 0.022, rx: Math.PI / 2 });
    propPart(metal, PRIM.cyl, guardC, { z: 1.48, sx: 0.03, sy: 0.07, sz: 0.03, rx: Math.PI / 2 });
    propPart(blade, LEAF, bcol, { z: 1.66, sx: 0.06, sy: 0.012, sz: 0.2 });
    propPart(matte, PRIM.cone, 0xf2a6c9, { z: 1.46, y: -0.05, sx: 0.03, sy: 0.14, sz: 0.01 });
    length = 1.86;
  } else if (kind === 'staff') {
    propPart(matte, PRIM.cyl, 0x8a6246, { z: 0.3, sx: 0.028, sy: 1.8, sz: 0.028, rx: Math.PI / 2 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      propPart(metal, PRIM.cone, guardC, { x: Math.cos(a) * 0.045, y: Math.sin(a) * 0.045, z: 1.24, sx: 0.018, sy: 0.14, sz: 0.018, rx: Math.PI / 2 - Math.cos(a) * 0.3, ry: 0 });
    }
    propPart(metal, PRIM.cyl, guardC, { z: 1.18, sx: 0.04, sy: 0.04, sz: 0.04, rx: Math.PI / 2 });
    propPart(glow, LEAF, opts.glow || 0x9fd0ff, { z: 1.32, sx: 0.06, sy: 0.06, sz: 0.11 });
    length = 1.4;
  } else if (kind === 'dagger') {
    propPart(blade, LEAF, bcol, { z: 0.3, sx: 0.035, sy: 0.01, sz: 0.24 });
    propPart(metal, PRIM.box, guardC, { z: 0.08, sx: 0.14, sy: 0.035, sz: 0.035 });
    propPart(matte, PRIM.cyl, gripC, { z: 0.0, sx: 0.02, sy: 0.14, sz: 0.02, rx: Math.PI / 2 });
    length = 0.55;
  } else if (kind === 'bow') {
    const arc = new THREE.TorusGeometry(0.55, 0.022, 12, 24, Math.PI * 0.85);
    propPart(matte, arc, 0x8a6246, { rx: Math.PI / 2 + 0.23, ry: Math.PI / 2 });
    propPart(matte, PRIM.cyl, 0xf0ece0, { sx: 0.004, sy: 1.02, sz: 0.004, y: -0.2 });
    propPart(matte, WRAP, 0x3a2418, { rx: Math.PI / 2 });
    length = 0.3;
  } else if (kind === 'crystal') {
    propPart(glow, PRIM.cone, 0x9fd8ff, { z: 0.6, sx: 0.18, sy: 1.2, sz: 0.18, rx: Math.PI / 2 });
    propPart(glow, PRIM.cone, 0xffc6ec, { z: 0.35, x: 0.12, sx: 0.08, sy: 0.6, sz: 0.08, rx: Math.PI / 2, ry: 0.4 });
    length = 1.2;
  }
  const g = propMesh({ metal, matte, glow });
  g.userData.length = length;
  return g;
}

export function makeShield(color = 0x9fb8e8, emblem = 0xf0c860) {
  const metal = [], glow = [];
  propPart(metal, KITE, color, { ry: Math.PI / 2 });
  // rim
  propPart(metal, KITE, emblem, { ry: Math.PI / 2, sx: 1.08, sy: 1.08, sz: 0.6, x: -0.004 });
  // sun emblem
  propPart(metal, PRIM.cyl, emblem, { x: 0.03, y: 0.02, sx: 0.07, sy: 0.012, sz: 0.07, rz: Math.PI / 2 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    propPart(metal, PRIM.cone, emblem, { x: 0.03, y: 0.02 + Math.cos(a) * 0.1, z: Math.sin(a) * 0.1, sx: 0.018, sy: 0.06, sz: 0.006, rx: a });
  }
  propPart(glow, PRIM.sphereLo, 0xfff0c0, { x: 0.035, y: 0.02, sx: 0.025, sy: 0.025, sz: 0.025 });
  return propMesh({ metal, glow });
}

// ---------- rig ----------
const HAIRCAP = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.6);
const DEFAULT_LOOK = {
  skin: 0xf2d0b8, hair: 0x6b4a36, hairStyle: 'short', eyes: 0x4a5a8a,
  shirt: 0xf5efe6, pants: 0x6b5a7a, boots: 0x5a4636, belt: 0x6b4a2e,
  armor: null, armorTrim: 0xf0c860, pauldrons: false, helmet: null, cape: null, capeTrim: 0xf0c860,
  skirt: null, robe: null, beard: null, crown: false, tiara: false, hood: null, hat: null, beret: null,
  weapon: null, weaponOpts: {}, shield: null, scale: 1, bulk: 1, glowEyes: null, gloves: null,
  apron: null, crystalBody: false, tabard: null, emblem: 0xf0c860, tunic: undefined, female: false,
  puff: false, quiver: false, elf: false, lips: 0xc8727e, collar: null, sash: null,
};

export class Humanoid {
  constructor(look = {}) {
    this.look = { ...DEFAULT_LOOK, ...look };
    const L = this.look;
    const fem = L.female || !!L.skirt || L.hairStyle === 'long' || L.hairStyle === 'bun' || L.hairStyle === 'braid';
    this.root = new THREE.Group();
    const R = new RigBuilder();
    const bulk = L.bulk;
    const sw = fem ? 0.92 : 1; // shoulder width factor
    const base = R.bone('base', null, 0, 0, 0);
    const hips = R.bone('hips', base, 0, 0.95, 0);
    const torso = R.bone('torso', hips, 0, 0.08, 0);
    const neck = R.bone('neck', torso, 0, 0.55, 0);
    const head = R.bone('head', neck, 0, 0.045, 0);
    const shL = R.bone('shL', torso, 0.235 * bulk * sw, 0.47, 0);
    const elL = R.bone('elL', shL, 0, -0.29, 0);
    const handL = R.bone('handL', elL, 0, -0.27, 0);
    const shR = R.bone('shR', torso, -0.235 * bulk * sw, 0.47, 0);
    const elR = R.bone('elR', shR, 0, -0.29, 0);
    const handR = R.bone('handR', elR, 0, -0.27, 0);
    const hipL = R.bone('hipL', hips, 0.095 * bulk, -0.03, 0);
    const kneeL = R.bone('kneeL', hipL, 0, -0.44, 0);
    const hipR = R.bone('hipR', hips, -0.095 * bulk, -0.03, 0);
    const kneeR = R.bone('kneeR', hipR, 0, -0.44, 0);
    let cape = null, capeLow = null;
    if (L.cape) {
      cape = R.bone('cape', torso, 0, 0.5, -0.14 * bulk);
      capeLow = R.bone('capeLow', cape, 0, -0.5, 0);
    }

    const metalK = L.crystalBody ? 'glow' : 'metal';
    const S = PRIM.sphere, SL = PRIM.sphereLo, B = PRIM.box, CY = PRIM.cyl, CO = PRIM.cone;
    const trim = L.armorTrim;
    const tunic = L.tunic === undefined ? L.shirt : L.tunic;
    const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();

    // ---------------- torso ----------------
    R.part(hips, lathe([[0.001, -0.13], [0.1, -0.12], [0.15, -0.06], [0.155, 0.02], [0.14, 0.1], [0.001, 0.11]]), L.pants, { sx: bulk * (fem ? 1.08 : 1), sz: bulk * 0.72 });
    const torsoProf = fem
      ? [[0.001, -0.04], [0.12, -0.03], [0.118, 0.06], [0.14, 0.18], [0.158, 0.3], [0.152, 0.38], [0.15, 0.44], [0.12, 0.5], [0.06, 0.55], [0.001, 0.56]]
      : [[0.001, -0.04], [0.135, -0.03], [0.14, 0.08], [0.155, 0.2], [0.172, 0.32], [0.18, 0.41], [0.165, 0.48], [0.11, 0.535], [0.05, 0.56], [0.001, 0.57]];
    R.part(torso, lathe(torsoProf, 16), L.shirt, { sx: bulk * sw * 1.12, sz: bulk * 0.74 });
    if (fem && !L.armor) R.part(torso, S, L.shirt, { y: 0.31, z: 0.06, sx: 0.13 * bulk, sy: 0.065, sz: 0.06 });
    if (!fem && !L.armor) for (const sd of [-1, 1]) R.part(torso, S, L.shirt, { x: sd * 0.075 * bulk, y: 0.35, z: 0.075 * bulk, sx: 0.085 * bulk, sy: 0.06, sz: 0.05 });
    R.part(torso, S, L.armor && !L.crystalBody ? L.armor : L.shirt, { y: 0.49, z: -0.02, sx: 0.19 * bulk * sw, sy: 0.06, sz: 0.1 * bulk }, L.armor ? metalK : 'matte');
    // tunic skirt below the belt
    const tunicC = L.tunic === undefined && L.armor ? shade(L.pants, 0.9) : tunic;
    if (!L.skirt && !L.robe && tunicC !== null) {
      R.part(hips, lathe([[0.165, 0.05], [0.19, -0.06], [0.235, -0.2], [0.26, -0.28]], 16), tunicC, { sx: bulk, sz: bulk * 0.8 }, 'cloth');
    }
    // collar
    R.part(torso, new THREE.TorusGeometry(0.075, 0.022, 12, 14), L.collar || shade(L.shirt, 0.8), { y: 0.53, rx: Math.PI / 2, sz: 0.9 });
    // belt, buckle, pouch
    R.part(torso, CY, L.belt, { y: 0.03, sx: 0.195 * bulk, sy: 0.06, sz: 0.135 * bulk });
    R.part(torso, B, trim, { y: 0.03, z: 0.135 * bulk, sx: 0.05, sy: 0.045, sz: 0.02 }, 'metal');
    if (!L.skirt && !L.robe) R.part(torso, B, shade(L.belt, 1.2), { x: 0.16 * bulk, y: -0.03, z: 0.06, sx: 0.06, sy: 0.08, sz: 0.05 });
    if (L.sash) R.part(torso, B, L.sash, { y: 0.3, z: 0.02, sx: 0.07, sy: 0.62, sz: 0.28 * bulk, rz: 0.75 });
    if (L.armor) {
      R.part(torso, lathe([[0.001, 0.08], [0.15, 0.09], [0.165, 0.2], [0.182, 0.32], [0.188, 0.41], [0.17, 0.48], [0.11, 0.53], [0.001, 0.535]], 16), L.armor, { sx: bulk * sw * 1.13, sz: bulk * 0.8 }, metalK);
      R.part(torso, B, trim, { y: 0.32, z: 0.146 * bulk, sx: 0.035, sy: 0.3, sz: 0.02 }, 'metal');
      R.part(torso, B, trim, { y: 0.13, z: 0.12 * bulk, sx: 0.3 * bulk, sy: 0.025, sz: 0.06 }, 'metal');
      R.part(torso, CY, L.armor, { y: 0.52, sx: 0.085, sy: 0.07, sz: 0.085 }, metalK); // gorget
      // fauld (plated skirt)
      R.part(hips, new THREE.CylinderGeometry(0.2, 0.25, 0.2, 28, 1, true), L.armor, { y: -0.02, sx: bulk, sz: bulk * 0.85 }, metalK);
      R.part(hips, new THREE.CylinderGeometry(0.255, 0.255, 0.025, 28, 1, true), trim, { y: -0.12, sx: bulk, sz: bulk * 0.85 }, 'metal');
    }
    if (L.tabard) {
      R.part(torso, B, L.tabard, { y: 0.22, z: 0.16 * bulk, sx: 0.24 * bulk, sy: 0.5, sz: 0.012 });
      R.part(hips, B, L.tabard, { y: -0.22, z: 0.165 * bulk, sx: 0.22 * bulk, sy: 0.36, sz: 0.012 }, 'cloth');
      R.part(torso, CY, L.emblem, { y: 0.32, z: 0.168 * bulk, sx: 0.06, sy: 0.008, sz: 0.06, rx: Math.PI / 2 }, 'metal');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        R.part(torso, CO, L.emblem, { x: Math.sin(a) * 0.08, y: 0.32 + Math.cos(a) * 0.08, z: 0.168 * bulk, sx: 0.014, sy: 0.04, sz: 0.004, rz: -a }, 'metal');
      }
    }
    if (L.apron) R.part(torso, B, L.apron, { y: 0.02, z: 0.14 * bulk, sx: 0.3 * bulk, sy: 0.62, sz: 0.02 });
    if (L.quiver) {
      R.part(torso, CY, 0x7a5a3a, { y: 0.3, z: -0.16, sx: 0.06, sy: 0.5, sz: 0.06, rz: 0.4 });
      for (let i = 0; i < 4; i++) R.part(torso, CY, 0xf0ece0, { x: -0.1 + i * 0.02, y: 0.6, z: -0.16, sx: 0.006, sy: 0.2, sz: 0.006, rz: 0.4 });
    }

    // ---------------- head ----------------
    const skin = L.skin;
    R.part(neck, taper(0.052, 0.058, 0.1), skin, { y: 0.08 }, 'skin');
    const HS = { x: 0.118, y: 0.126, z: 0.12 };
    const HY = 0.112;
    const young = L.scale < 0.8;
    const brow = L.brow || (L.hairStyle === 'none' ? shade(skin, 0.6) : shade(L.hair, 0.8));
    if (L.glowEyes && L.helmet) {
      R.part(head, PRIM.sphere, skin, { y: HY, sx: HS.x, sy: HS.y, sz: HS.z }, 'skin');
    } else {
      const fmat = faceMaterial({
        skin: new THREE.Color(skin).getHex(), eyes: L.glowEyes || L.eyes, brow: new THREE.Color(brow).getHex(), fem,
        lips: L.lipColor || null, stubble: !!L.stubble, freckles: !!L.freckles || young, angry: !!L.angry,
        hi: !!L.hiFace,
      });
      R.part(head, headGeometry(fem), 0xffffff, { y: HY, sx: HS.x, sy: HS.y, sz: HS.z }, fmat);
      if (L.glowEyes) for (const sd of [-1, 1]) R.part(head, SL, L.glowEyes, { x: sd * 0.04, y: HY + 0.017, z: 0.108, sx: 0.02, sy: 0.009, sz: 0.006 }, 'glow');
    }
    // ears
    for (const sd of [-1, 1]) {
      if (L.elf) R.part(head, CO, skin, { x: sd * 0.118, y: 0.13, z: -0.02, sx: 0.02, sy: 0.09, sz: 0.012, rz: -sd * 1.0 }, 'skin');
      else {
        R.part(head, SL, skin, { x: sd * 0.108, y: 0.108, z: -0.005, sx: 0.016, sy: 0.034, sz: 0.024, rz: -sd * 0.15 }, 'skin');
        R.part(head, SL, shade(skin, 0.85), { x: sd * 0.112, y: 0.108, z: 0.0, sx: 0.008, sy: 0.022, sz: 0.014 }, 'skin');
      }
    }
    // blinking eyelids (scaled by the lids bone)
    let lids = null;
    if (!L.glowEyes) {
      lids = R.bone('lids', head, 0, HY + 0.018, 0);
      for (const sd of [-1, 1]) R.part(lids, SL, shade(skin, 0.97), { x: sd * 0.04, y: 0.0, z: 0.1, sx: 0.026, sy: 0.02, sz: 0.014 }, 'skin');
    }
    // hair made of locks
    const hc = L.hair;
    const lock = (len, w, a, y, rad, tilt, curl = 0.15, twist = 0, roll = 0) => {
      R.part(head, lockGeometry(len, w, curl), hc, { x: Math.sin(a) * rad * HS.x / 0.12, y, z: Math.cos(a) * rad * HS.z / 0.12, rx: -tilt, ry: a + twist, rz: roll, order: 'YXZ' }, 'hair');
    };
    if (L.hairStyle !== 'none' && !L.helmet) {
      // scalp cap: top + back only, front edge at the hairline
      R.part(head, HAIRCAP, hc, { y: HY + 0.012, z: -0.006, sx: HS.x * 1.07, sy: HS.y * 1.05, sz: HS.z * 1.07, rx: -0.62 }, 'hair');
      if (!L.hood) {
        if (L.hairStyle === 'short' || L.hairStyle === 'ponytail' || L.hairStyle === 'curly') {
          // swept-back top locks hugging the scalp
          for (let i = -2; i <= 2; i++) R.part(head, lockGeometry(0.13, 0.04, -0.45), hc, { x: i * 0.03, y: HY + 0.095, z: 0.09 - Math.abs(i) * 0.012, rx: 1.95, ry: i * 0.12, order: 'YXZ' }, 'hair');
          for (const sd of [-1, 1]) R.part(head, lockGeometry(0.09, 0.03, -0.3), hc, { x: sd * 0.08, y: HY + 0.08, z: 0.06, rx: 1.4, ry: sd * 0.9, order: 'YXZ' }, 'hair');
        } else {
          // center parting with locks sweeping to the temples
          for (const sd of [-1, 1]) {
            for (let i = 0; i < 3; i++) R.part(head, lockGeometry(0.12 - i * 0.01, 0.036, -0.35), hc, { x: sd * (0.012 + i * 0.012), y: HY + 0.118 - i * 0.004, z: 0.07 - i * 0.02, rx: 0.35 + i * 0.1, rz: sd * (1.15 - i * 0.1), order: 'YXZ' }, 'hair');
          }
        }
      }
      if (L.hairStyle === 'short') {
        for (let i = 0; i < 12; i++) {
          const a = Math.PI * 0.42 + (i / 11) * Math.PI * 1.16;
          lock(0.07 + (i % 3) * 0.012, 0.034, a, HY + 0.08, 0.108, 0.3, 0.1);
        }
      } else if (L.hairStyle === 'long') {
        for (let i = 0; i < 15; i++) {
          const a = Math.PI * 0.45 + (i / 14) * Math.PI * 1.1;
          const back = 1 - Math.abs(Math.cos(a));
          lock(0.3 + back * 0.12 + (i % 3) * 0.02, 0.05, a, HY + 0.07, 0.11, 0.12 + back * 0.05, 0.12);
        }
        for (const sd of [-1, 1]) {
          lock(0.26, 0.032, sd * 1.25, HY + 0.05, 0.112, 0.05, 0.08);
          lock(0.22, 0.028, sd * 1.05, HY + 0.02, 0.112, 0.02, 0.06);
        }
      } else if (L.hairStyle === 'bun') {
        R.part(head, PRIM.sphere, hc, { y: HY + 0.1, z: -0.12, sx: 0.065, sy: 0.06, sz: 0.065 }, 'hair');
        R.part(head, new THREE.TorusGeometry(0.05, 0.012, 12, 16), shade(hc, 1.15), { y: HY + 0.1, z: -0.125, sx: 1, sy: 1 }, 'hair');
        for (let i = 0; i < 9; i++) lock(0.06, 0.03, Math.PI * 0.55 + (i / 8) * Math.PI * 0.9, HY + 0.06, 0.1, 0.4, 0.1);
        for (const sd of [-1, 1]) lock(0.16, 0.018, sd * 1.2, HY + 0.02, 0.112, 0.02, 0.2);
      } else if (L.hairStyle === 'braid') {
        for (let i = 0; i < 9; i++) lock(0.07, 0.032, Math.PI * 0.55 + (i / 8) * Math.PI * 0.9, HY + 0.06, 0.1, 0.4, 0.1);
        for (let i = 0; i < 6; i++) R.part(head, PRIM.sphere, hc, { x: 0.015 * Math.sin(i * 2.2), y: HY - 0.07 - i * 0.07, z: -0.11 - i * 0.012, sx: 0.034, sy: 0.043, sz: 0.032, rz: (i % 2 ? 0.4 : -0.4) }, 'hair');
        R.part(head, PRIM.sphereLo, 0xf2a6c9, { y: HY - 0.5, z: -0.18, sx: 0.028, sy: 0.02, sz: 0.028 });
      } else if (L.hairStyle === 'ponytail') {
        for (let i = 0; i < 9; i++) lock(0.07, 0.032, Math.PI * 0.55 + (i / 8) * Math.PI * 0.9, HY + 0.06, 0.1, 0.4, 0.1);
        R.part(head, CY, 0x5a3a4a, { y: HY + 0.02, z: -0.13, sx: 0.025, sy: 0.02, sz: 0.025, rx: 0.9 });
        for (let i = 0; i < 4; i++) R.part(head, lockGeometry(0.3, 0.035, 0.2), hc, { x: (i - 1.5) * 0.012, y: HY + 0.02, z: -0.14, rx: 0.35, ry: Math.PI + (i - 1.5) * 0.2, order: 'YXZ' }, 'hair');
      } else if (L.hairStyle === 'curly') {
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          R.part(head, PRIM.sphere, hc, { x: Math.sin(a) * 0.11, y: HY + 0.07 + Math.cos(a * 3) * 0.02, z: Math.cos(a) * 0.11 - 0.02, sx: 0.045, sy: 0.045, sz: 0.045 }, 'hair');
        }
      }
    }
    if (L.beard) {
      const bc = L.beard;
      for (let i = 0; i < 9; i++) {
        const a = -1.0 + (i / 8) * 2.0;
        R.part(head, lockGeometry(L.longBeard ? 0.2 : 0.08, 0.035, 0.12), bc, { x: Math.sin(a) * 0.085, y: HY - 0.035 - Math.abs(a) * -0.02, z: Math.cos(a) * 0.075 + 0.005, rx: 0.15, ry: a, order: 'YXZ' }, 'hair');
      }
      for (const sd of [-1, 1]) R.part(head, lockGeometry(0.05, 0.018, 0.1), bc, { x: sd * 0.02, y: HY - 0.035, z: 0.114, rx: -0.2, ry: sd * 0.6, rz: sd * 1.1, order: 'YXZ' }, 'hair');
      if (L.longBeard) R.part(head, lockGeometry(0.3, 0.05, 0.1), bc, { y: HY - 0.09, z: 0.085, rx: 0.05, order: 'YXZ' }, 'hair');
    }
    if (L.crown) {
      R.part(head, CY, trim, { y: 0.238, sx: 0.13, sy: 0.045, sz: 0.13 }, 'metal');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        R.part(head, CO, trim, { x: Math.sin(a) * 0.125, y: 0.283 + (i % 2) * 0.02, z: Math.cos(a) * 0.125, sx: 0.018, sy: 0.06 + (i % 2) * 0.03, sz: 0.018 }, 'metal');
        if (i % 2 === 0) R.part(head, SL, i === 0 ? 0xff7fbf : 0x9fd0ff, { x: Math.sin(a) * 0.133, y: 0.24, z: Math.cos(a) * 0.133, sx: 0.013, sy: 0.013, sz: 0.013 }, 'glow');
      }
    }
    if (L.tiara) {
      R.part(head, new THREE.TorusGeometry(0.125, 0.008, 10, 20, Math.PI), trim, { y: 0.225, z: 0.0, rx: -0.3 }, 'metal');
      R.part(head, LEAF, 0xbfe6ff, { y: 0.27, z: 0.1, sx: 0.016, sy: 0.03, sz: 0.01 }, 'glow');
    }
    if (L.helmet) {
      const hm = L.helmet;
      R.part(head, S, hm, { y: 0.13, sx: 0.148, sy: 0.158, sz: 0.152 }, metalK);
      R.part(head, B, 0x14121a, { y: 0.125, z: 0.135, sx: 0.17, sy: 0.022, sz: 0.04 });
      if (L.glowEyes) for (const sd of [-1, 1]) R.part(head, SL, L.glowEyes, { x: sd * 0.04, y: 0.125, z: 0.152, sx: 0.022, sy: 0.009, sz: 0.006 }, 'glow');
      R.part(head, B, hm, { y: 0.1, z: 0.145, sx: 0.022, sy: 0.08, sz: 0.02 }, metalK); // nasal
      for (const sd of [-1, 1]) R.part(head, B, hm, { x: sd * 0.1, y: 0.05, z: 0.07, sx: 0.035, sy: 0.1, sz: 0.1, ry: sd * 0.3 }, metalK);
      R.part(head, B, trim, { y: 0.28, z: 0, sx: 0.02, sy: 0.02, sz: 0.28 }, 'metal');
      if (L.plume) {
        for (let i = 0; i < 4; i++) R.part(head, capsule(0.028, 0.14), L.plume, { y: 0.3 + i * 0.01, z: -0.02 - i * 0.07, rx: -0.5 - i * 0.35 });
      }
      if (L.horns) for (const sd of [-1, 1]) R.part(head, CO, hm, { x: sd * 0.16, y: 0.25, sx: 0.035, sy: 0.24, sz: 0.035, rz: -sd * 0.6 }, metalK);
    }
    if (L.hood) {
      R.part(head, S, L.hood, { y: 0.135, z: -0.02, sx: 0.162, sy: 0.172, sz: 0.168 });
      R.part(head, CO, L.hood, { y: 0.08, z: -0.16, sx: 0.12, sy: 0.2, sz: 0.08, rx: -1.2 });
      R.part(torso, new THREE.TorusGeometry(0.13, 0.05, 12, 14), L.hood, { y: 0.5, rx: Math.PI / 2 });
    }
    if (L.hat) {
      R.part(head, CY, L.hat, { y: 0.22, sx: 0.27, sy: 0.018, sz: 0.27 });
      R.part(head, CO, L.hat, { y: 0.42, z: -0.03, sx: 0.13, sy: 0.42, sz: 0.13, rx: -0.15 });
      R.part(head, CO, L.hat, { y: 0.66, z: -0.12, sx: 0.04, sy: 0.14, sz: 0.04, rx: -0.9 });
      R.part(head, CY, trim, { y: 0.245, sx: 0.135, sy: 0.03, sz: 0.135 }, 'metal');
      R.part(head, LEAF, 0xfff0a8, { y: 0.34, z: 0.1, sx: 0.025, sy: 0.025, sz: 0.008 }, 'glow');
    }
    if (L.beret) {
      R.part(head, S, L.beret, { y: 0.24, x: 0.02, sx: 0.15, sy: 0.04, sz: 0.14, rz: -0.15 });
      R.part(head, capsule(0.012, 0.2), 0xffffff, { x: 0.1, y: 0.3, z: -0.04, rz: -0.6, rx: -0.3 });
    }

    // ---------------- arms ----------------
    for (const [sh, el, hand, sd] of [[shL, elL, handL, 1], [shR, elR, handR, -1]]) {
      const armored = L.armor && L.gloves !== false;
      R.part(sh, S, L.shirt, { x: sd * 0.01, y: -0.02, sx: 0.07 * bulk, sy: 0.07, sz: 0.07 * bulk }); // deltoid
      R.part(sh, taper(0.06 * bulk, 0.046 * bulk, 0.27), L.shirt, {});
      if (L.puff) {
        R.part(sh, S, L.shirt, { y: -0.04, sx: 0.09, sy: 0.085, sz: 0.09 });
        R.part(sh, new THREE.TorusGeometry(0.075, 0.012, 10, 14), trim, { y: -0.1, rx: Math.PI / 2 }, 'metal');
      }
      if (L.pauldrons && L.armor) {
        // layered plate pauldron: dome + two lames, tilted outward
        R.part(sh, DOME, L.armor, { x: sd * 0.02, y: 0.0, sx: 0.1 * bulk, sy: 0.075, sz: 0.11 * bulk, rz: -sd * 0.35 }, metalK);
        R.part(sh, lathe([[0.1, 0], [0.108, -0.035], [0.1, -0.045]], 16), L.armor, { x: sd * 0.035, y: -0.04, sx: bulk, sz: bulk * 1.05, rz: -sd * 0.35 }, metalK);
        R.part(sh, lathe([[0.094, 0], [0.1, -0.03], [0.092, -0.04]], 16), L.armor, { x: sd * 0.05, y: -0.075, sx: bulk, sz: bulk * 1.05, rz: -sd * 0.35 }, metalK);
        R.part(sh, new THREE.TorusGeometry(0.1, 0.008, 10, 18), trim, { x: sd * 0.036, y: -0.045, rx: Math.PI / 2, ry: -sd * 0.35, sx: bulk, sy: bulk * 1.05 }, 'metal');
        R.part(sh, taper(0.064 * bulk, 0.05 * bulk, 0.22), L.armor, { y: -0.02 }, metalK); // rerebrace
      }
      R.part(el, S, armored ? L.armor : L.shirt, { sx: 0.05 * bulk, sy: 0.05, sz: 0.05 * bulk }, armored ? metalK : 'matte'); // elbow
      if (armored) R.part(el, DOME, L.armor, { z: -0.02, sx: 0.055, sy: 0.04, sz: 0.05, rx: -Math.PI / 2 }, metalK); // couter
      R.part(el, taper(0.049 * bulk, 0.034 * bulk, 0.24), armored ? L.armor : L.shirt, {}, armored ? metalK : 'matte');
      // cuff / gauntlet flare
      R.part(el, lathe(armored ? [[0.04, 0], [0.058, -0.04], [0.06, -0.075], [0.04, -0.08]] : [[0.04, 0], [0.047, -0.035], [0.043, -0.06]], 12), armored ? L.armor : shade(L.shirt, 0.85), { y: -0.18, sx: bulk, sz: bulk }, armored ? metalK : 'matte');
      if (armored) R.part(el, new THREE.TorusGeometry(0.06, 0.006, 10, 14), trim, { y: -0.25, rx: Math.PI / 2, sx: bulk, sy: bulk }, 'metal');
      // hand: palm, four curled fingers, thumb
      const hcol = L.gloves || (armored ? L.armor : skin);
      const hk = armored && !L.gloves ? metalK : (L.gloves ? 'matte' : 'skin');
      R.part(hand, S, hcol, { y: -0.018, sx: 0.036, sy: 0.05, sz: 0.022 }, hk);
      for (let f = 0; f < 4; f++) {
        R.part(hand, capsule(0.0095, 0.035), hcol, { x: -sd * (f - 1.5) * 0.013 * -1, y: -0.07, z: 0.008, rx: 0.5 }, hk);
      }
      R.part(hand, capsule(0.011, 0.03), hcol, { x: -sd * 0.032, y: -0.03, z: 0.02, rz: sd * 0.7, rx: 0.3 }, hk);
    }

    // ---------------- legs ----------------
    const hideLegs = !!(L.skirt || L.robe);
    for (const [hip, knee] of [[hipL, kneeL], [hipR, kneeR]]) {
      if (hideLegs) continue;
      R.part(hip, taper(0.078 * bulk, 0.054 * bulk, 0.42), L.pants, {});
      R.part(knee, taper(0.056 * bulk, 0.045 * bulk, 0.4), L.boots, {});
      R.part(knee, new THREE.CylinderGeometry(0.085, 0.07, 0.1, 24, 1, true), shade(L.boots, 1.15), { y: -0.05, sx: bulk, sz: bulk }, 'cloth'); // boot cuff
      R.part(knee, S, L.boots, { y: -0.43, z: 0.05, sx: 0.052 * bulk, sy: 0.042, sz: 0.11 });
      R.part(knee, S, L.boots, { y: -0.41, z: -0.005, sx: 0.05 * bulk, sy: 0.05, sz: 0.055 });
      R.part(knee, B, shade(L.boots, 0.5), { y: -0.468, z: 0.045, sx: 0.09 * bulk, sy: 0.014, sz: 0.21 });
      if (L.armor) {
        R.part(knee, S, L.armor, { z: 0.035, sx: 0.055, sy: 0.05, sz: 0.045 }, metalK);
        if (L.pauldrons) R.part(knee, taper(0.06 * bulk, 0.05 * bulk, 0.3), L.armor, { y: -0.05, z: 0.008, sz: 0.95 }, metalK);
      }
    }
    if (hideLegs) {
      const gown = L.skirt || L.robe;
      R.part(hips, foldedLathe([[0.15, 0.06], [0.17, -0.05], [0.21, -0.25], [0.29, -0.5], [0.38, -0.75], [0.46, -0.93]], 40, 11, 0.06), gown, { sz: 0.92 }, 'cloth');
      R.part(hips, foldedLathe([[0.35, -0.62], [0.39, -0.7]], 40, 11, 0.05), L.hem || trim, { sz: 0.92 }, L.hem ? 'cloth' : 'metal');
      R.part(hips, new THREE.CylinderGeometry(0.445, 0.46, 0.07, 40, 1, true), L.hem || trim, { y: -0.9 }, L.hem ? 'cloth' : 'metal');
      R.part(hips, new THREE.CylinderGeometry(0.21, 0.28, 0.16, 32, 1, true), shade(gown, 0.92), { y: -0.04 }, 'cloth'); // peplum
      if (L.robe) R.part(hips, B, trim, { y: -0.45, z: 0.3, sx: 0.05, sy: 0.9, sz: 0.01, rx: -0.22 }, 'metal');
      // feet peeking out
      for (const sd of [-1, 1]) R.part(hips, SL, L.boots, { x: sd * 0.1, y: -0.93, z: 0.14, sx: 0.05, sy: 0.035, sz: 0.08 });
      this.hideLegs = true;
    }
    if (cape) {
      const cc = L.cape;
      const top = new THREE.Shape();
      top.moveTo(-0.2 * bulk, 0); top.lineTo(0.2 * bulk, 0); top.lineTo(0.25 * bulk, -0.52); top.lineTo(-0.25 * bulk, -0.52); top.closePath();
      R.part(cape, new THREE.ShapeGeometry(top), cc, {}, 'cloth');
      const low = new THREE.Shape();
      low.moveTo(-0.25 * bulk, 0.02); low.lineTo(0.25 * bulk, 0.02); low.lineTo(0.28 * bulk, -0.5);
      low.quadraticCurveTo(0, -0.66, -0.28 * bulk, -0.5); low.closePath();
      R.part(capeLow, new THREE.ShapeGeometry(low, 6), cc, {}, 'cloth');
      R.part(capeLow, B, L.capeTrim, { y: -0.52, z: -0.004, sx: 0.5 * bulk, sy: 0.025, sz: 0.01 }, 'metal');
      // mantle over shoulders + clasps
      R.part(torso, new THREE.TorusGeometry(0.15 * bulk, 0.045, 12, 18, Math.PI), cc, { y: 0.5, z: -0.02, rx: Math.PI / 2, rz: Math.PI });
      for (const sd of [-1, 1]) R.part(torso, SL, L.capeTrim, { x: sd * 0.12 * bulk, y: 0.49, z: 0.1, sx: 0.025, sy: 0.025, sz: 0.015 }, 'metal');
    }
    if (L.crystalBody) {
      for (let i = 0; i < 5; i++) R.part(torso, CO, 0xbfe6ff, { x: (i - 2) * 0.1, y: 0.5 + (i % 2) * 0.05, z: -0.12, sx: 0.05, sy: 0.3, sz: 0.05, rx: -0.5 }, 'glow');
      for (const sh of [shL, shR]) R.part(sh, CO, 0xffc6ec, { y: 0.08, sx: 0.06, sy: 0.25, sz: 0.06 }, 'glow');
    }
    const built = R.build();
    for (const m of built.meshes) this.root.add(m);
    this.meshes = built.meshes;
    this.body = base;
    this.cape = cape;
    this.capeLow = capeLow;
    this.lids = lids;
    this.j = { hips, torso, neck, head, shL, elL, handL, shR, elR, handR, hipL, kneeL, hipR, kneeR };
    this.weapon = null;
    if (L.weapon) this.setWeapon(L.weapon, L.weaponOpts);
    if (L.shield) {
      this.shield = makeShield(L.shield, L.emblem);
      this.shield.position.set(0.06, 0.02, 0.0);
      handL.add(this.shield);
    }
    this.root.scale.setScalar(L.scale);
    this.anim = new Animator(this);
  }

  setWeapon(kind, opts = {}) {
    if (this.weapon) this.j.handR.remove(this.weapon);
    this.weapon = kind ? makeWeapon(kind, opts) : null;
    if (this.weapon) {
      this.weapon.position.set(0, -0.02, 0);
      this.j.handR.add(this.weapon);
    }
  }

  setVisible(v) { this.root.visible = v; }

  // blade world endpoints for trails / hit tests
  bladePoints(outBase, outTip) {
    if (!this.weapon) return false;
    const L = this.weapon.userData.length || 1;
    this.weapon.updateWorldMatrix(true, false);
    outBase.set(0, 0, 0.18).applyMatrix4(this.weapon.matrixWorld);
    outTip.set(0, 0, L).applyMatrix4(this.weapon.matrixWorld);
    return true;
  }

  update(dt, state) { this.anim.update(dt, state); }
}

// ---------- animation ----------
const JOINTS = ['hips', 'torso', 'neck', 'head', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR', 'hipL', 'kneeL', 'hipR', 'kneeR'];

// Poses: joint -> [x,y,z]. Missing = 0.
export const POSES = {
  guard: { shR: [-0.45, 0, -0.12], elR: [-0.75, 0, 0], handR: [0.25, 0, 0], shL: [-0.2, 0, 0.12], elL: [-0.5, 0, 0] },
  relaxed: { shR: [0.06, 0, -0.14], elR: [-0.28, 0, 0], handR: [0.9, 0, 0], shL: [0.06, 0, 0.14], elL: [-0.24, 0, 0], handL: [0, 0, 0.1] },
  block: { shR: [-1.25, 0.75, -0.1], elR: [-0.9, 0, 0], handR: [0.3, 0, 1.45], shL: [-1.1, -0.5, 0.2], elL: [-1.1, 0, 0], torso: [0.08, 0, 0], hipL: [-0.2, 0, 0], kneeL: [0.3, 0, 0], hipR: [0.25, 0, 0], kneeR: [0.2, 0, 0] },
  shieldBlock: { shL: [-1.35, -0.2, 0.1], elL: [-0.9, 0, 0], shR: [-0.5, 0, -0.12], elR: [-0.8, 0, 0], handR: [0.3, 0, 0], torso: [0.08, 0, 0] },
};

// Action clips: array of [t, pose]. Timing normalized 0..1.
export const CLIPS = {
  slash1: [
    [0, { shR: [-1.3, -1.35, -0.3], elR: [-0.5, 0, 0], handR: [1.25, 0, 0.2], torso: [0.05, -0.75, 0], shL: [-0.4, 0, 0.3], elL: [-0.9, 0, 0] }],
    [0.3, { shR: [-1.35, -1.55, -0.3], elR: [-0.45, 0, 0], handR: [1.3, 0, 0.25], torso: [0.05, -0.85, 0], hipL: [-0.3, 0, 0], kneeL: [0.3, 0, 0] }],
    [0.55, { shR: [-1.45, 0.85, 0.1], elR: [-0.15, 0, 0], handR: [1.35, 0, 0.1], torso: [0.12, 0.65, 0], hipL: [-0.5, 0, 0], kneeL: [0.35, 0, 0], hipR: [0.3, 0, 0] }],
    [1, { shR: [-0.6, 0.5, -0.1], elR: [-0.6, 0, 0], handR: [0.5, 0, 0], torso: [0.05, 0.3, 0] }],
  ],
  slash2: [
    [0, { shR: [-1.4, 0.9, 0.1], elR: [-1.1, 0, 0], handR: [1.1, 0, -0.3], torso: [0.05, 0.6, 0] }],
    [0.3, { shR: [-1.45, 1.05, 0.15], elR: [-1.2, 0, 0], handR: [1.2, 0, -0.3], torso: [0.05, 0.7, 0], hipR: [-0.3, 0, 0], kneeR: [0.3, 0, 0] }],
    [0.55, { shR: [-1.35, -1.4, -0.4], elR: [-0.1, 0, 0], handR: [1.35, 0, 0], torso: [0.12, -0.7, 0], hipR: [-0.5, 0, 0], kneeR: [0.35, 0, 0], hipL: [0.3, 0, 0] }],
    [1, { shR: [-0.6, -0.4, -0.2], elR: [-0.6, 0, 0], handR: [0.5, 0, 0], torso: [0.05, -0.3, 0] }],
  ],
  slash3: [
    [0, { shR: [-2.6, -0.15, -0.1], elR: [-1.4, 0, 0], handR: [0.2, 0, 0], shL: [-2.4, 0.2, 0.2], elL: [-1.5, 0, 0], torso: [-0.2, -0.2, 0] }],
    [0.35, { shR: [-2.9, -0.15, -0.1], elR: [-1.6, 0, 0], handR: [0.1, 0, 0], shL: [-2.7, 0.2, 0.2], elL: [-1.6, 0, 0], torso: [-0.3, -0.2, 0], hipL: [-0.2, 0, 0], kneeL: [0.2, 0, 0] }],
    [0.58, { shR: [-0.55, 0.1, -0.05], elR: [-0.15, 0, 0], handR: [0.95, 0, 0], shL: [-0.6, -0.3, 0.1], elL: [-0.4, 0, 0], torso: [0.45, 0, 0], hipL: [-0.7, 0, 0], kneeL: [0.6, 0, 0], hipR: [0.4, 0, 0], kneeR: [0.2, 0, 0] }],
    [1, { shR: [-0.5, 0, -0.1], elR: [-0.6, 0, 0], handR: [0.5, 0, 0], torso: [0.1, 0, 0] }],
  ],
  heavy: [
    [0, { shR: [-2.3, -0.3, -0.1], elR: [-1.2, 0, 0], handR: [0.3, 0, 0], shL: [-2.2, 0.3, 0.2], elL: [-1.2, 0, 0], torso: [-0.2, -0.5, 0] }],
    [0.45, { shR: [-3.1, -0.4, -0.1], elR: [-1.7, 0, 0], handR: [0.0, 0, 0], shL: [-3.0, 0.4, 0.2], elL: [-1.7, 0, 0], torso: [-0.4, -0.6, 0], hipL: [-0.4, 0, 0], kneeL: [0.4, 0, 0], hipR: [0.3, 0, 0], kneeR: [0.4, 0, 0] }],
    [0.62, { shR: [-0.45, 0.2, -0.05], elR: [-0.1, 0, 0], handR: [1.1, 0, 0], shL: [-0.5, -0.4, 0.1], elL: [-0.3, 0, 0], torso: [0.6, 0.1, 0], hipL: [-0.9, 0, 0], kneeL: [0.8, 0, 0], hipR: [0.5, 0, 0], kneeR: [0.3, 0, 0] }],
    [1, { shR: [-0.45, 0, -0.1], elR: [-0.5, 0, 0], handR: [0.6, 0, 0], torso: [0.15, 0, 0] }],
  ],
  thrust: [
    [0, { shR: [-0.8, -0.2, -0.2], elR: [-1.8, 0, 0], handR: [1.5, 0, 0], torso: [0, -0.4, 0] }],
    [0.4, { shR: [-0.7, -0.3, -0.2], elR: [-2.0, 0, 0], handR: [1.6, 0, 0], torso: [0, -0.5, 0], hipR: [0.3, 0, 0] }],
    [0.6, { shR: [-1.55, 0.1, 0], elR: [0, 0, 0], handR: [1.55, 0, 0], torso: [0.25, 0.3, 0], hipL: [-0.6, 0, 0], kneeL: [0.5, 0, 0], hipR: [0.4, 0, 0] }],
    [1, { shR: [-0.5, 0, -0.1], elR: [-0.6, 0, 0], handR: [0.4, 0, 0] }],
  ],
  cast: [
    [0, { shL: [-0.5, 0, 0.3], elL: [-1.8, 0, 0], torso: [0, -0.2, 0] }],
    [0.4, { shL: [-0.8, 0.2, 0.2], elL: [-2.0, 0, 0], torso: [-0.05, -0.3, 0] }],
    [0.6, { shL: [-1.6, 0, 0.05], elL: [-0.05, 0, 0], torso: [0.1, 0.3, 0], hipL: [-0.4, 0, 0], kneeL: [0.3, 0, 0] }],
    [1, { shL: [-0.4, 0, 0.1], elL: [-0.6, 0, 0] }],
  ],
  drink: [
    [0, { shL: [-0.4, 0, 0.1], elL: [-1.0, 0, 0] }],
    [0.3, { shL: [-0.9, 0.4, 0.1], elL: [-2.4, 0, 0], head: [-0.3, 0, 0] }],
    [0.75, { shL: [-1.0, 0.45, 0.1], elL: [-2.5, 0, 0], head: [-0.45, 0, 0] }],
    [1, { shL: [-0.2, 0, 0.1], elL: [-0.4, 0, 0] }],
  ],
  roll: [
    [0, { torso: [0.5, 0, 0], hipL: [-1.4, 0, 0], kneeL: [2.0, 0, 0], hipR: [-1.3, 0, 0], kneeR: [2.1, 0, 0], shL: [-1.0, 0, 0.2], elL: [-1.4, 0, 0], shR: [-1.0, 0, -0.2], elR: [-1.3, 0, 0], head: [0.5, 0, 0] }],
    [0.8, { torso: [0.5, 0, 0], hipL: [-1.4, 0, 0], kneeL: [2.0, 0, 0], hipR: [-1.3, 0, 0], kneeR: [2.1, 0, 0], shL: [-1.0, 0, 0.2], elL: [-1.4, 0, 0], shR: [-1.0, 0, -0.2], elR: [-1.3, 0, 0], head: [0.5, 0, 0] }],
    [1, { torso: [0.1, 0, 0], hipL: [-0.3, 0, 0], kneeL: [0.4, 0, 0] }],
  ],
  hit: [
    [0, { torso: [-0.35, 0.2, 0], head: [-0.3, 0, 0], shL: [0.3, 0, 0.4], shR: [0.2, 0, -0.4] }],
    [1, {}],
  ],
  stagger: [
    [0, { torso: [-0.5, 0.3, 0.1], head: [-0.4, 0, 0], shL: [0.5, 0, 0.8], shR: [0.4, 0, -0.8], hipL: [0.3, 0, 0], kneeL: [0.4, 0, 0] }],
    [0.7, { torso: [0.4, 0, 0], head: [0.3, 0, 0], shL: [0.2, 0, 0.3], shR: [0.2, 0, -0.3], hipL: [-0.5, 0, 0], kneeL: [0.8, 0, 0], hipR: [-0.3, 0, 0], kneeR: [0.6, 0, 0] }],
    [1, {}],
  ],
  wave: [
    [0, { shR: [-0.3, 0, -0.4] }],
    [0.25, { shR: [-2.6, 0, -0.5], elR: [-0.6, 0, 0] }],
    [0.45, { shR: [-2.6, 0, -0.2], elR: [-0.9, 0, 0] }],
    [0.65, { shR: [-2.6, 0, -0.6], elR: [-0.5, 0, 0] }],
    [1, { shR: [0, 0, -0.1] }],
  ],
  talk: [
    [0, { shR: [-0.3, 0, -0.1], elR: [-0.9, 0, 0] }],
    [0.3, { shR: [-0.5, 0.3, -0.2], elR: [-1.2, 0.3, 0], shL: [-0.2, 0, 0.1], elL: [-0.6, 0, 0], head: [0.08, 0.1, 0] }],
    [0.6, { shR: [-0.2, -0.1, -0.3], elR: [-0.8, 0, 0], shL: [-0.5, -0.3, 0.2], elL: [-1.1, 0, 0], head: [-0.05, -0.1, 0] }],
    [1, { shR: [0, 0, -0.1], elR: [-0.2, 0, 0] }],
  ],
  kneel: [
    [0, { hipL: [-1.5, 0, 0], kneeL: [1.5, 0, 0], hipR: [0.1, 0, 0], kneeR: [1.6, 0, 0], torso: [0.2, 0, 0], head: [0.4, 0, 0] }],
    [1, { hipL: [-1.5, 0, 0], kneeL: [1.5, 0, 0], hipR: [0.1, 0, 0], kneeR: [1.6, 0, 0], torso: [0.2, 0, 0], head: [0.4, 0, 0] }],
  ],
  slam: [ // two-handed ground slam (golem / boss)
    [0, { shR: [-2.8, 0, -0.3], elR: [-0.4, 0, 0], shL: [-2.8, 0, 0.3], elL: [-0.4, 0, 0], torso: [-0.3, 0, 0] }],
    [0.5, { shR: [-3.1, 0, -0.3], elR: [-0.3, 0, 0], shL: [-3.1, 0, 0.3], elL: [-0.3, 0, 0], torso: [-0.45, 0, 0] }],
    [0.65, { shR: [-0.9, 0, -0.1], elR: [-0.1, 0, 0], shL: [-0.9, 0, 0.1], elL: [-0.1, 0, 0], torso: [0.7, 0, 0], hipL: [-0.6, 0, 0], kneeL: [0.9, 0, 0], hipR: [-0.6, 0, 0], kneeR: [0.9, 0, 0] }],
    [1, { shR: [-0.4, 0, -0.1], elR: [-0.4, 0, 0], shL: [-0.4, 0, 0.1], torso: [0.1, 0, 0] }],
  ],
  spin: [
    [0, { shR: [-1.5, -1.2, -0.4], elR: [-0.2, 0, 0], handR: [1.4, 0, 0], torso: [0.1, -0.9, 0] }],
    [0.3, { shR: [-1.5, -1.3, -0.4], elR: [-0.2, 0, 0], handR: [1.4, 0, 0], torso: [0.1, -1.0, 0] }],
    [0.75, { shR: [-1.5, 1.2, 0.2], elR: [-0.1, 0, 0], handR: [1.4, 0, 0], torso: [0.1, 1.0, 0] }],
    [1, { shR: [-0.5, 0, -0.1], elR: [-0.6, 0, 0], handR: [0.4, 0, 0] }],
  ],
  shoot: [
    [0, { shL: [-1.55, 0.2, 0], elL: [0, 0, 0], shR: [-1.5, 0.6, 0], elR: [-1.8, 0, 0], torso: [0, -0.9, 0], head: [0, 0.9, 0] }],
    [0.7, { shL: [-1.55, 0.2, 0], elL: [0, 0, 0], shR: [-1.4, -0.3, 0], elR: [-2.3, 0, 0], torso: [0, -0.9, 0], head: [0, 0.9, 0] }],
    [1, { shL: [-0.3, 0, 0.1], shR: [-0.2, 0, -0.1], torso: [0, -0.2, 0] }],
  ],
};

function ease(t) { return t * t * (3 - 2 * t); }

class Animator {
  constructor(h) {
    this.h = h;
    this.cur = {};
    for (const k of JOINTS) this.cur[k] = new THREE.Vector3();
    this.target = {};
    for (const k of JOINTS) this.target[k] = new THREE.Vector3();
    this.phase = 0;
    this.t = Math.random() * 10;
    this.action = null; // {clip, t, dur}
    this.hipsY = 0;
    this.bodyRotX = 0;
    this.bodyY = 0;
    this.capeSwing = 0;
  }

  play(name, duration) {
    this.action = { clip: CLIPS[name], name, t: 0, dur: duration };
  }

  stop() { this.action = null; }

  // state: {speed, grounded, base:'guard'|'relaxed'|'block', swim, dead, deathT, ride, sit, lean}
  update(dt, st) {
    this.t += dt;
    const T = this.target;
    for (const k of JOINTS) T[k].set(0, 0, 0);
    const base = POSES[st.base || 'relaxed'];
    if (base) for (const k in base) T[k].set(base[k][0], base[k][1], base[k][2]);

    const sp = st.speed || 0;
    let hipsY = 0;
    let immediate = false;
    if (st.ride) {
      T.hipL.set(-1.2, 0, 0.55); T.hipR.set(-1.2, 0, -0.55);
      T.kneeL.set(1.3, 0, 0); T.kneeR.set(1.3, 0, 0);
      T.torso.x += 0.12 + Math.sin(this.t * 8) * 0.03 * Math.min(1, sp / 10);
      T.shL.set(-0.7, 0, 0.1); T.elL.set(-0.8, 0, 0);
    } else if (st.swim) {
      const moving = sp > 0.6;
      if (moving) {
        // front crawl: alternating arm circles, body roll, flutter kick, head turning to breathe
        this.phase += dt * (3.2 + sp * 0.5);
        const ph = this.phase, s = Math.sin(ph), c = Math.cos(ph);
        T.torso.x = 1.25; T.torso.y = s * 0.28; T.head.x = -1.15; T.head.y = Math.max(0, Math.sin(ph * 0.5)) * 0.5;
        T.shL.set(-1.6 + s * 1.5, 0, 0.25 + Math.max(0, c) * 0.7); T.elL.set(-0.3 - Math.max(0, c) * 1.2, 0, 0);
        T.shR.set(-1.6 - s * 1.5, 0, -0.25 - Math.max(0, -c) * 0.7); T.elR.set(-0.3 - Math.max(0, -c) * 1.2, 0, 0);
        const k = Math.sin(ph * 3);
        T.hipL.set(0.1 + k * 0.28, 0, 0.05); T.hipR.set(0.1 - k * 0.28, 0, -0.05);
        T.kneeL.x = 0.15 + Math.max(0, k) * 0.35; T.kneeR.x = 0.15 + Math.max(0, -k) * 0.35;
        hipsY = Math.sin(ph * 2) * 0.03;
      } else {
        // treading water: upright, sculling arms, slow cycling legs, gentle bob
        this.phase += dt * 2.4;
        const s = Math.sin(this.phase), c = Math.cos(this.phase);
        T.torso.x = 0.12; T.head.x = -0.1;
        T.shL.set(-0.5, s * 0.5, 0.9); T.elL.set(-0.6, 0, 0);
        T.shR.set(-0.5, -s * 0.5, -0.9); T.elR.set(-0.6, 0, 0);
        T.hipL.set(-0.5 + s * 0.35, 0, 0.12); T.hipR.set(-0.5 - s * 0.35, 0, -0.12);
        T.kneeL.x = 0.7 + c * 0.3; T.kneeR.x = 0.7 - c * 0.3;
        hipsY = Math.sin(this.phase * 0.8) * 0.05;
      }
    } else if (!st.grounded && !st.dead) {
      T.hipL.set(-0.6, 0, 0.05); T.kneeL.set(0.9, 0, 0);
      T.hipR.set(0.2, 0, -0.05); T.kneeR.set(0.4, 0, 0);
      T.shL.x -= 0.4; T.shL.z += 0.3;
      if (st.base !== 'guard') { T.shR.x -= 0.4; T.shR.z -= 0.3; }
    } else if (sp > 0.15) {
      const run = Math.min(1, sp / 7);
      this.phase += dt * (3.2 + sp * 1.25);
      const s = Math.sin(this.phase), c = Math.cos(this.phase);
      const amp = 0.45 + run * 0.45;
      T.hipL.x += s * amp; T.hipR.x += -s * amp;
      T.kneeL.x += Math.max(0, -c) * (0.4 + run * 0.9) + 0.05;
      T.kneeR.x += Math.max(0, c) * (0.4 + run * 0.9) + 0.05;
      // slopes: lean into the hill, shorter stride and bent knees going up; lean back a touch going down
      const sl = st.slope || 0;
      if (sl > 0.02) { T.torso.x += sl * 0.9; T.hipL.x -= sl * 0.5; T.hipR.x -= sl * 0.5; T.kneeL.x += sl * 0.6; T.kneeR.x += sl * 0.6; T.head.x -= sl * 0.4; }
      else if (sl < -0.02) { T.torso.x += sl * 0.45; T.kneeL.x -= sl * 0.35; T.kneeR.x -= sl * 0.35; }
      const armAmp = 0.35 + run * 0.5;
      T.shL.x += -s * armAmp;
      if (st.base !== 'guard' && st.base !== 'block') T.shR.x += s * armAmp;
      else T.shR.x += s * armAmp * 0.25;
      T.elL.x -= 0.2 + run * 0.6; if (st.base === 'relaxed') T.elR.x -= run * 0.6;
      T.torso.x += 0.05 + run * 0.18;
      T.torso.y += s * 0.08 * run;
      hipsY = Math.abs(c) * 0.05 * (0.5 + run) - 0.02 * run;
    } else {
      // idle breathing
      const b = Math.sin(this.t * 1.8);
      T.torso.x += b * 0.015;
      T.shL.z += 0.02 + b * 0.015; T.shR.z -= 0.02 + b * 0.015;
      T.head.y += Math.sin(this.t * 0.4) * 0.12 * (st.lookAround ?? 1);
      if (st.base === 'guard') { T.hipL.set(-0.15, 0, 0.06); T.hipR.set(0.12, 0, -0.06); T.kneeL.x = 0.2; T.kneeR.x = 0.15; hipsY = -0.02; }
    }
    if (st.lean) T.torso.z += st.lean;

    // action override
    if (this.action) {
      const a = this.action;
      a.t += dt / a.dur;
      const clip = a.clip;
      if (a.t >= 1) { this.action = null; } else {
        let i = 0;
        while (i < clip.length - 1 && clip[i + 1][0] <= a.t) i++;
        const k0 = clip[i], k1 = clip[Math.min(i + 1, clip.length - 1)];
        const span = k1[0] - k0[0];
        const lt = span > 0 ? ease(Math.min(1, (a.t - k0[0]) / span)) : 1;
        const lower = st.upperOnly; // keep legs from locomotion
        for (const k of JOINTS) {
          if (lower && (k === 'hipL' || k === 'hipR' || k === 'kneeL' || k === 'kneeR')) continue;
          const p0 = k0[1][k], p1 = k1[1][k];
          if (!p0 && !p1) continue;
          const b = base && base[k] ? base[k] : [0, 0, 0];
          const A = p0 || b, Bv = p1 || b;
          T[k].set(A[0] + (Bv[0] - A[0]) * lt, A[1] + (Bv[1] - A[1]) * lt, A[2] + (Bv[2] - A[2]) * lt);
        }
        immediate = true;
        if (a.name === 'roll') {
          this.bodyRotX = ease(Math.min(1, a.t / 0.85)) * Math.PI * 2;
          hipsY = -0.35 * Math.sin(Math.min(1, a.t / 0.85) * Math.PI);
        }
        if (a.name === 'kneel') hipsY = -0.42;
      }
    }
    if (!this.action || this.action.name !== 'roll') this.bodyRotX = 0;

    // death
    let bodyY = 0, deathRot = 0;
    if (st.dead) {
      const dtT = Math.min(1, (st.deathT || 0) / 0.8);
      deathRot = -ease(dtT) * Math.PI / 2;
      bodyY = 0.15 * ease(dtT);
      T.shL.set(-0.3, 0, 1.2); T.shR.set(-0.3, 0, -1.2);
      T.hipL.x = -0.2; T.kneeL.x = 0.3;
    }
    if (st.sit) { T.hipL.x = -1.5; T.hipR.x = -1.5; T.kneeL.x = 1.5; T.kneeR.x = 1.5; hipsY = -0.45; }

    const rate = immediate ? 30 : 12;
    const J = this.h.j;
    for (const k of JOINTS) {
      const c = this.cur[k];
      c.x = damp(c.x, T[k].x, rate, dt);
      c.y = damp(c.y, T[k].y, rate, dt);
      c.z = damp(c.z, T[k].z, rate, dt);
      J[k].rotation.set(c.x, c.y, c.z);
    }
    this.hipsY = damp(this.hipsY, hipsY, 15, dt);
    if (this.h.lids) {
      this.blinkT = (this.blinkT ?? Math.random() * 4) - dt;
      let closed = 0;
      if (this.blinkT < 0.14) closed = Math.sin(Math.max(0, this.blinkT) / 0.14 * Math.PI);
      if (this.blinkT <= 0) this.blinkT = 2.2 + Math.random() * 3.5;
      if (st.dead) closed = 1;
      this.h.lids.scale.y = 0.06 + closed * 0.94;
    }
    J.hips.position.y = 0.95 + this.hipsY;
    const body = this.h.body;
    body.rotation.x = this.bodyRotX + deathRot;
    body.position.y = bodyY + (this.bodyRotX ? 0.5 - 0.5 * Math.cos(this.bodyRotX) * 0 : 0);
    if (this.bodyRotX) {
      // rotate around body center (~0.55 high)
      const cy = 0.5;
      body.position.y = cy - Math.cos(this.bodyRotX) * cy + this.hipsY * 0;
      body.position.z = Math.sin(this.bodyRotX) * cy;
    } else body.position.z = 0;
    // cape
    if (this.h.cape) {
      const target = 0.08 + Math.min(1.2, sp * 0.1) + (st.grounded === false ? 0.5 : 0);
      this.capeSwing = damp(this.capeSwing, target, 5, dt);
      this.h.cape.rotation.x = this.capeSwing * 0.7 + Math.sin(this.t * 3.1) * 0.04 * (1 + sp * 0.2);
      if (this.h.capeLow) this.h.capeLow.rotation.x = this.capeSwing * 0.55 + Math.sin(this.t * 3.7 + 1) * 0.07 * (1 + sp * 0.25) + (st.ride ? 0.6 : 0);
    }
  }
}
