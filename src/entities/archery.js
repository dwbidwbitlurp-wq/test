// Archery: a detailed recurve bow with a live string, arrow meshes, and the two-arm aim IK
// (bow arm extended along the shot line, string hand drawing the nock back to the cheek).
import * as THREE from 'three';

// ---- bow geometry (local frame: grip at the origin, limbs along ±Y, shooting toward +Z, string behind at -Z) ----
export const BOW = {
  brace: 0.145, // grip -> string at rest
  drawLen: 0.5, // extra pull at full draw
  nockY: 0.07, // nocking point / arrow shelf height above the grip centre
  rest: new THREE.Vector3(0.019, 0.07, 0.0), // arrow rest (left side of the riser)
  pivot: 0.13, // limb/riser joint
  anchor: new THREE.Vector3(0, 0.615, -0.148), // where the string leaves the upper limb (mirrored below)
};

// upper limb centre line (y, z) from the riser joint to the recurved tip
const LIMB = [[0.13, 0.0], [0.22, -0.018], [0.33, -0.058], [0.45, -0.103], [0.55, -0.135], [0.615, -0.142], [0.665, -0.126], [0.7, -0.096], [0.718, -0.066]];
const RISER = [[-0.17, 0.0], [-0.1, 0.018], [0, 0.028], [0.1, 0.018], [0.17, 0.0]];

// a swept, tapered, flattened tube along a (y,z) polyline; width along X, thickness in the YZ plane
function sweep(pts, w0, w1, t0, t1, ring = 10, sub = 5) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([y, z]) => new THREE.Vector3(0, y, z)), false, 'centripetal');
  const n = (pts.length - 1) * sub;
  const pos = [], idx = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T);
    N.crossVectors(X, T).normalize();
    const w = w0 + (w1 - w0) * u, t = t0 + (t1 - t0) * u;
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * Math.PI * 2;
      pos.push(P.x + Math.cos(a) * w, P.y + N.y * Math.sin(a) * t, P.z + N.z * Math.sin(a) * t);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k, b = i * ring + ((k + 1) % ring), c = a + ring, d = b + ring;
      idx.push(a, c, b, b, c, d);
    }
  }
  // caps
  const capA = pos.length / 3; pos.push(...curve.getPointAt(0).toArray());
  const capB = pos.length / 3; pos.push(...curve.getPointAt(1).toArray());
  for (let k = 0; k < ring; k++) {
    idx.push(capA, k, (k + 1) % ring);
    idx.push(capB, n * ring + ((k + 1) % ring), n * ring + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const matCache = new Map();
function bmat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide });
    matCache.set(key, m);
  }
  return m;
}

let GEO = null;
function bowGeo() {
  if (GEO) return GEO;
  const limb = sweep(LIMB, 0.019, 0.009, 0.012, 0.007);
  limb.translate(0, -BOW.pivot, 0); // pivot at the riser joint
  GEO = {
    limb,
    riser: sweep(RISER, 0.02, 0.02, 0.026, 0.026, 12, 6),
    grip: new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12),
    band: new THREE.CylinderGeometry(0.024, 0.024, 0.016, 12),
    shelf: new THREE.BoxGeometry(0.012, 0.022, 0.05),
    tip: new THREE.SphereGeometry(0.014, 10, 8),
    string: (() => { const s = new THREE.CylinderGeometry(0.0042, 0.0042, 1, 5, 1); s.translate(0, 0.5, 0); return s; })(),
    loop: new THREE.TorusGeometry(0.012, 0.0035, 6, 10),
    serving: new THREE.CylinderGeometry(0.0065, 0.0065, 0.08, 6),
  };
  return GEO;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// kind: 'hunting' (dark yew, leather grip) | 'elven' (pale wood, gold fittings, glowing tips)
export function makeBow(opts = {}) {
  const G = bowGeo();
  const elven = !!opts.glow;
  const wood = bmat(elven ? 0xefe2bf : 0x7a4a28, { rough: 0.55 });
  const riserM = bmat(elven ? 0xd9c28e : 0x5a3620, { rough: 0.5 });
  const leather = bmat(elven ? 0x6a4a8a : 0x3a2418, { rough: 0.9 });
  const fitting = bmat(0xf0c860, { metal: 0.85, rough: 0.3 });
  const horn = elven ? bmat(opts.glow, { emissive: opts.glow, ei: 1.6 }) : bmat(0xe8dcc0, { rough: 0.4 });
  const stringM = bmat(elven ? 0xfff6d8 : 0xf2ecdc, { rough: 0.8, emissive: elven ? 0x6a5a30 : 0x3a3630 });
  const bow = new THREE.Group();
  bow.name = 'bow';
  const add = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  add(bow, G.riser, riserM);
  add(bow, G.grip, leather, 0, 0, 0.004);
  add(bow, G.shelf, riserM, 0.02, BOW.nockY - 0.018, 0.0);
  for (const s of [-1, 1]) add(bow, G.band, fitting, 0, s * 0.155, 0.0);
  const limbs = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.y = s * BOW.pivot;
    if (s < 0) pivot.scale.y = -1; // mirrored lower limb
    add(pivot, G.limb, wood);
    const tip = add(pivot, G.tip, horn, 0, LIMB[LIMB.length - 1][0] - BOW.pivot, LIMB[LIMB.length - 1][1]);
    tip.scale.set(1, 1.5, 1);
    // string lying along the recurve up to the tip nock
    const tail = add(pivot, G.string, stringM);
    const ay = BOW.anchor.y - BOW.pivot, az = BOW.anchor.z;
    const ty = LIMB[LIMB.length - 1][0] - BOW.pivot - 0.01, tz = LIMB[LIMB.length - 1][1] - 0.012;
    tail.position.set(0, ay, az);
    _a.set(0, ty - ay, tz - az);
    tail.scale.set(1, _a.length(), 1);
    tail.quaternion.setFromUnitVectors(_up, _a.normalize());
    add(pivot, G.loop, stringM, 0, ty, tz, 0, Math.PI / 2, 0);
    bow.add(pivot);
    limbs.push(pivot);
  }
  // the live string: two straight segments from the limb anchors to the nocking point
  const strU = add(bow, G.string, stringM), strL = add(bow, G.string, stringM);
  strU.castShadow = strL.castShadow = false;
  const serving = add(bow, G.serving, bmat(0x2a2220, { rough: 0.9 }));
  // the nocked arrow (shown while drawing)
  const arrow = makeArrow({ player: true, glow: opts.glow });
  arrow.visible = false;
  bow.add(arrow);
  const nock = new THREE.Vector3();
  const setDraw = (draw = 0, nocked = false) => {
    const k = Math.max(0, Math.min(1, draw));
    // limbs flex back as the string is pulled
    limbs[0].rotation.x = -k * 0.14;
    limbs[1].rotation.x = k * 0.14; // mirrored group: same visual flex
    nock.set(0, BOW.nockY, -BOW.brace - k * BOW.drawLen);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const piv = limbs[i];
      piv.updateMatrix();
      // anchor in bow space (through the flexed limb pivot)
      _a.set(0, BOW.anchor.y - BOW.pivot, BOW.anchor.z).applyMatrix4(piv.matrix);
      const seg = i === 0 ? strU : strL;
      seg.position.copy(_a);
      _b.subVectors(nock, _a);
      seg.scale.set(1, _b.length(), 1);
      seg.quaternion.setFromUnitVectors(_up, _b.normalize());
      void s;
    }
    serving.position.copy(nock);
    arrow.visible = nocked;
    if (nocked) {
      _b.subVectors(BOW.rest, nock).normalize();
      arrow.position.copy(nock).addScaledVector(_b, ARROW.nockOffset);
      arrow.quaternion.setFromUnitVectors(_fwd, _b);
    }
  };
  setDraw(0, false);
  bow.userData.setDraw = setDraw;
  bow.userData.nock = nock;
  bow.userData.arrow = arrow;
  return bow;
}

// ---- arrows (local +Z = flight direction, origin at the shaft centre) ----
export const ARROW = { len: 0.84, nockOffset: 0.42 };
const _fwd = new THREE.Vector3(0, 0, 1);
let AGEO = null;
function arrowGeo() {
  if (AGEO) return AGEO;
  const vane = new THREE.BufferGeometry();
  // swept feather vane: leading edge low, trailing edge tall
  vane.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.0, 0, 0.0, -0.16, 0, 0.042, -0.13, 0, 0.034, -0.03], 3));
  vane.setIndex([0, 1, 2, 0, 2, 3]);
  vane.computeVertexNormals();
  AGEO = {
    shaft: (() => { const g = new THREE.CylinderGeometry(0.0115, 0.0115, ARROW.len, 8); g.rotateX(Math.PI / 2); return g; })(),
    head: (() => { const g = new THREE.ConeGeometry(0.03, 0.12, 4); g.rotateX(Math.PI / 2); return g; })(),
    ferrule: (() => { const g = new THREE.CylinderGeometry(0.014, 0.012, 0.04, 8); g.rotateX(Math.PI / 2); return g; })(),
    nock: (() => { const g = new THREE.CylinderGeometry(0.015, 0.013, 0.035, 8); g.rotateX(Math.PI / 2); return g; })(),
    vane,
  };
  return AGEO;
}

const fMats = new Map();
function featherMat(color) {
  let m = fMats.get(color);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }); fMats.set(color, m); }
  return m;
}

// opts: player (pink fletching), glow (elven burning arrows), broken (half shaft)
export function makeArrow(opts = {}) {
  const G = arrowGeo();
  const g = new THREE.Group();
  const shaftM = bmat(0xe0c090, { rough: 0.55, emissive: 0x3a2a14 });
  const headM = bmat(opts.glow ? opts.glow : 0xe8eef8, { metal: opts.glow ? 0.2 : 0.8, rough: 0.28, emissive: opts.glow || 0x202428, ei: opts.glow ? 1.4 : 1 });
  const featherA = featherMat(opts.player ? 0xff8cc4 : 0xd8cfb8);
  const featherB = featherMat(opts.player ? 0xffffff : 0xa89a80);
  const half = ARROW.len / 2;
  const shaft = new THREE.Mesh(G.shaft, shaftM);
  g.add(shaft);
  const head = new THREE.Mesh(G.head, headM); head.position.z = half + 0.05; g.add(head);
  const fer = new THREE.Mesh(G.ferrule, bmat(0x8a8f9c, { metal: 0.8, rough: 0.35 })); fer.position.z = half - 0.01; g.add(fer);
  const nk = new THREE.Mesh(G.nock, bmat(opts.player ? 0xf2a6c9 : 0x3a3030, { rough: 0.5 })); nk.position.z = -half; g.add(nk);
  for (let k = 0; k < 3; k++) {
    const v = new THREE.Mesh(G.vane, k === 0 ? featherB : featherA);
    v.position.z = -half + 0.19;
    v.rotation.z = (k / 3) * Math.PI * 2;
    v.position.x = Math.sin(v.rotation.z) * -0.006; v.position.y = Math.cos(v.rotation.z) * 0.006;
    g.add(v);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// ---- two-bone arm IK (shoulder -> elbow -> wrist), rotations blended by w ----
// Elbows bend about their local X (negative angle folds the forearm toward the arm's +Z), bones hang along -Y.
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _H = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();
const _a1 = new THREE.Vector3(), _a2 = new THREE.Vector3(), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);
export function solveArm(sh, el, hand, target, pole, w = 1) {
  sh.updateWorldMatrix(true, true);
  sh.getWorldPosition(_S); el.getWorldPosition(_E); hand.getWorldPosition(_H);
  const l1 = _E.distanceTo(_S), l2 = _H.distanceTo(_E);
  _u.subVectors(target, _S);
  let d = _u.length();
  if (d < 1e-5) return;
  _u.divideScalar(d);
  d = Math.max(Math.abs(l1 - l2) + 1e-3, Math.min(d, (l1 + l2) * 0.9995));
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _w.copy(pole).addScaledVector(_u, -pole.dot(_u));
  if (_w.lengthSq() < 1e-8) _w.set(0, -1, 0).addScaledVector(_u, _u.y);
  _w.normalize();
  _a1.copy(_u).multiplyScalar(cosA).addScaledVector(_w, sinA); // upper arm direction (elbow toward the pole)
  _E.copy(_S).addScaledVector(_a1, l1);
  _a2.copy(_S).addScaledVector(_u, d).sub(_E).normalize(); // forearm direction
  const beta = Math.acos(Math.max(-1, Math.min(1, _a1.dot(_a2))));
  _Y.copy(_a1).negate();
  _Z.copy(_w).negate().addScaledVector(_a1, _w.dot(_a1));
  if (_Z.lengthSq() < 1e-8) _Z.set(0, 0, 1);
  _Z.normalize();
  _X.crossVectors(_Y, _Z).normalize();
  _Z.crossVectors(_X, _Y);
  _m.makeBasis(_X, _Y, _Z);
  _qw.setFromRotationMatrix(_m);
  sh.parent.getWorldQuaternion(_qp);
  _qp.invert().multiply(_qw);
  sh.quaternion.slerp(_qp, w);
  _qe.setFromAxisAngle(_xAxis, -beta);
  el.quaternion.slerp(_qe, w);
  hand.quaternion.slerp(_qi, w);
  sh.updateWorldMatrix(false, true);
}

// Pose the archer: bow arm along the shot line, bow upright in the fist, string hand at the nock.
// h: Humanoid, bow: makeBow() group (a child of the scene), dir: world aim direction, draw 0..1, w: blend weight
const _R = new THREE.Vector3(), _U = new THREE.Vector3(), _A = new THREE.Vector3(), _G = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3(), _D = new THREE.Vector3();
export function aimRig(h, bow, dir, draw, w, nocked) {
  const J = h.j;
  h.root.updateMatrixWorld(true);
  _D.copy(dir).normalize();
  _R.set(-_D.z, 0, _D.x);
  if (_R.lengthSq() < 1e-6) _R.set(-1, 0, 0);
  _R.normalize(); // archer's right
  _U.crossVectors(_D, _R).normalize(); // up, perpendicular to the shot line
  const sc = h.root.scale.x || 1;
  // anchor: under the right cheekbone; the arrow line runs from it to the bow's arrow rest
  J.head.getWorldPosition(_A);
  _A.addScaledVector(_U, 0.04 * sc).addScaledVector(_R, 0.075 * sc).addScaledVector(_D, 0.05 * sc);
  const reach = (BOW.brace + BOW.drawLen + 0.02) * sc;
  _G.copy(_A).addScaledVector(_D, reach).addScaledVector(_U, -BOW.nockY * sc); // grip centre
  // bow arm: wrist a hand-length behind the grip, elbow rolled out and down
  _T.copy(_G).addScaledVector(_D, -0.075 * sc);
  _P.copy(_R).multiplyScalar(-0.8).addScaledVector(_U, -0.6);
  solveArm(J.shL, J.elL, J.handL, _T, _P, w);
  // bow in the fist
  J.handL.getWorldPosition(_T);
  J.elL.getWorldPosition(_P);
  _P.subVectors(_T, _P).normalize();
  bow.position.copy(_T).addScaledVector(_P, 0.075 * sc);
  _X.crossVectors(_U, _D).normalize();
  _m.makeBasis(_X, _U, _D);
  bow.quaternion.setFromRotationMatrix(_m);
  bow.scale.setScalar(sc);
  bow.userData.setDraw(draw, nocked);
  bow.updateMatrixWorld(true);
  // string hand: fingers on the nock, wrist just behind, elbow high and back
  _T.copy(bow.userData.nock);
  bow.localToWorld(_T);
  _T.addScaledVector(_D, -0.06 * sc).addScaledVector(_R, 0.012 * sc);
  _P.copy(_R).addScaledVector(_D, -0.9).addScaledVector(_U, 0.35);
  solveArm(J.shR, J.elR, J.handR, _T, _P, w);
}

// world position of the nocked arrow's centre and its direction (for loosing it)
export function nockedArrow(bow, outPos, outDir) {
  bow.updateMatrixWorld(true);
  const n = _a.copy(bow.userData.nock);
  outDir.subVectors(BOW.rest, n).normalize().transformDirection(bow.matrixWorld);
  bow.localToWorld(n);
  outPos.copy(n).addScaledVector(outDir, ARROW.nockOffset);
  return outPos;
}
