// RigBuilder: assemble primitive parts attached to bones, then bake them into
// 1-3 SkinnedMeshes (matte / metal / glow) sharing one skeleton.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MATS = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.85 }),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 2.2 }),
  cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
};
MATS.glow.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;');
};

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export const PRIM = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 12),
  capsule: new Map(),
};
export function capsule(r, l) {
  const k = r.toFixed(3) + ':' + l.toFixed(3);
  let g = PRIM.capsule.get(k);
  if (!g) { g = new THREE.CapsuleGeometry(r, l, 4, 10); PRIM.capsule.set(k, g); }
  return g;
}

export class RigBuilder {
  constructor() {
    this.bones = [];
    this.parts = [];
  }

  bone(name, parent, x = 0, y = 0, z = 0) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    this.bones.push(b);
    return b;
  }

  // geo in bone local space; t = {x,y,z, sx,sy,sz, rx,ry,rz}; kind: matte|metal|glow|cloth
  part(bone, geo, color, t = {}, kind = 'matte') {
    this.parts.push({ bone, geo, color, t, kind });
  }

  build() {
    const root = this.bones[0];
    root.updateMatrixWorld(true);
    const byKind = new Map();
    const index = new Map(this.bones.map((b, i) => [b, i]));
    for (const p of this.parts) {
      const g = p.geo.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const t = p.t;
      _e.set(t.rx || 0, t.ry || 0, t.rz || 0, 'XYZ');
      _q.setFromEuler(_e);
      _m.compose(_v.set(t.x || 0, t.y || 0, t.z || 0), _q, _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1));
      g.applyMatrix4(_m);
      g.applyMatrix4(p.bone.matrixWorld);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      _c.set(p.color);
      for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const bi = index.get(p.bone);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      if (!g.index) {
        const idx = new Uint32Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      let arr = byKind.get(p.kind);
      if (!arr) { arr = []; byKind.set(p.kind, arr); }
      arr.push(g);
    }
    const skeleton = new THREE.Skeleton(this.bones);
    const meshes = [];
    let first = null;
    for (const [kind, list] of byKind) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.SkinnedMesh(geo, MATS[kind]);
      mesh.castShadow = kind !== 'glow';
      mesh.receiveShadow = true;
      if (!first) {
        first = mesh;
        mesh.add(root);
        mesh.bind(skeleton);
      } else {
        mesh.bind(skeleton, first.bindMatrix);
      }
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.2);
      meshes.push(mesh);
    }
    return { meshes, skeleton, root };
  }
}

// ---- shaped primitives (cached) ----
const _shapeCache = new Map();
// Lathe from [r, y] pairs (y may go up or down); cross-section is round.
export function lathe(points, segs = 14) {
  const key = 'L' + segs + JSON.stringify(points);
  let g = _shapeCache.get(key);
  if (!g) {
    const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
    g = new THREE.LatheGeometry(pts, segs);
    g.computeVertexNormals();
    _shapeCache.set(key, g);
  }
  return g;
}

// Tapered limb hanging down from origin: radius r1 at top, r2 at -len.
export function taper(r1, r2, len, segs = 10) {
  const key = `T${r1.toFixed(3)}:${r2.toFixed(3)}:${len.toFixed(3)}:${segs}`;
  let g = _shapeCache.get(key);
  if (!g) {
    const pts = [];
    const n = 5;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([Math.sin(a) * r1, Math.cos(a) * r1 * 0.9]); }
    const mid = r1 * 0.55 + r2 * 0.45;
    pts.push([Math.max(r1, mid * 1.06), -len * 0.3]);
    pts.push([r2 * 1.02, -len * 0.8]);
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([Math.cos(a) * r2, -len - Math.sin(a) * r2 * 0.9]); }
    const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)).reverse();
    g = new THREE.LatheGeometry(v, segs);
    g.computeVertexNormals();
    _shapeCache.set(key, g);
  }
  return g;
}
