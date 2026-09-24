// RigBuilder: assemble primitive parts attached to bones, then bake them into
// a few SkinnedMeshes (matte / metal / glow / cloth / custom textured) sharing one skeleton.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- procedural detail maps: fabric weave + brushed/engraved metal ----
function makeCanvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function toNormal(heightFn, n, strength) {
  const c = makeCanvas(n), ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = heightFn(x, y);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = h[y * n + (x - 1 + n) % n], r = h[y * n + (x + 1) % n], u = h[((y - 1 + n) % n) * n + x], d = h[((y + 1) % n) * n + x];
    let nx = (l - r) * strength, ny = (d - u) * strength; const nz = 1; const len = Math.hypot(nx, ny, nz);
    const o = (y * n + x) * 4;
    img.data[o] = (nx / len * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / len * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / len * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const weaveN = toNormal((x, y) => {
  const a = Math.sin(x * Math.PI / 2) * (Math.floor(y / 4) % 2 ? 1 : -1);
  const b = Math.sin(y * Math.PI / 2) * (Math.floor(x / 4) % 2 ? -1 : 1);
  return (a + b) * 0.5 + (Math.random() - 0.5) * 0.3;
}, 64, 0.8);
weaveN.repeat.set(10, 10);
const metalN = toNormal((x, y) => {
  // soft hammered dents + fine brushing
  let v = Math.sin(x * 0.4 + Math.sin(y * 0.2) * 2) * 0.15 + (Math.random() - 0.5) * 0.25;
  const cx = (x % 32) - 16, cy = (y % 32) - 16;
  v += Math.exp(-(cx * cx + cy * cy) / 60) * 0.8;
  return v;
}, 128, 1.2);
metalN.repeat.set(3, 3);

export const MATS = {
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, normalMap: weaveN, normalScale: new THREE.Vector2(0.35, 0.35) }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85, normalMap: metalN, normalScale: new THREE.Vector2(0.25, 0.25) }),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 2.2 }),
  cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide, normalMap: weaveN, normalScale: new THREE.Vector2(0.45, 0.45) }),
  skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, emissive: 0x2a1410, emissiveIntensity: 1 }),
  hair: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.05 }),
};
// soft painterly rim light for characters (reads as stylized, avoids the "plastic" look)
export const RIM = { color: { value: new THREE.Color(1.0, 0.93, 0.86) }, strength: { value: 0.32 } };
function addRim(m, k = 1) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = RIM.color;
    sh.uniforms.uRimStrength = RIM.strength;
    sh.fragmentShader = 'uniform vec3 uRimColor;\nuniform float uRimStrength;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      totalEmissiveRadiance += uRimColor * pow(rimF, 3.0) * uRimStrength * ${k.toFixed(2)} * diffuseColor.rgb;`
    );
  };
}
addRim(MATS.matte, 1);
addRim(MATS.cloth, 1);
addRim(MATS.metal, 1.6);
addRim(MATS.skin, 1.4);
addRim(MATS.hair, 1.2);
export { addRim };
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
  sphere: new THREE.SphereGeometry(1, 64, 44),
  sphereLo: new THREE.SphereGeometry(1, 32, 24),
  box: new THREE.BoxGeometry(1, 1, 1, 2, 2, 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 56, 2),
  cone: new THREE.ConeGeometry(1, 1, 56, 2),
  capsule: new Map(),
};
export function capsule(r, l) {
  const k = r.toFixed(3) + ':' + l.toFixed(3);
  let g = PRIM.capsule.get(k);
  if (!g) { g = new THREE.CapsuleGeometry(r, l, 10, 24); PRIM.capsule.set(k, g); }
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
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      const t = p.t;
      _e.set(t.rx || 0, t.ry || 0, t.rz || 0, t.order || 'XYZ');
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
      const key = typeof p.kind === 'string' ? p.kind : p.kind.uuid;
      let arr = byKind.get(key);
      if (!arr) { arr = { mat: typeof p.kind === 'string' ? MATS[p.kind] : p.kind, list: [], kind: p.kind }; byKind.set(key, arr); }
      arr.list.push(g);
    }
    const skeleton = new THREE.Skeleton(this.bones);
    const meshes = [];
    let first = null;
    for (const { mat, list, kind } of byKind.values()) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.SkinnedMesh(geo, mat);
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
  segs = Math.max(24, Math.round(segs * 2)); // high-detail silhouettes
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
  segs = Math.max(22, Math.round(segs * 2.2)); // high-detail limbs
  const key = `T${r1.toFixed(3)}:${r2.toFixed(3)}:${len.toFixed(3)}:${segs}`;
  let g = _shapeCache.get(key);
  if (!g) {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([Math.sin(a) * r1, Math.cos(a) * r1 * 0.9]); }
    // smooth muscular profile: a soft belly in the upper third, slimming toward the joint
    const m = 10;
    for (let i = 1; i < m; i++) {
      const t = i / m;
      const base = r1 + (r2 - r1) * t;
      const belly = Math.sin(Math.min(1, t / 0.75) * Math.PI) * (r1 * 0.09 + r2 * 0.03) * (t < 0.75 ? 1 : 0);
      pts.push([base + belly, -len * t]);
    }
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([Math.cos(a) * r2, -len - Math.sin(a) * r2 * 0.9]); }
    const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)).reverse();
    g = new THREE.LatheGeometry(v, segs);
    g.computeVertexNormals();
    _shapeCache.set(key, g);
  }
  return g;
}

// Lathe with vertical fabric folds that deepen toward the hem.
export function foldedLathe(points, segs, folds, amp) {
  segs = Math.max(32, Math.round(segs * 2));
  const key = 'F' + segs + ':' + folds + ':' + amp + JSON.stringify(points);
  let g = _shapeCache.get(key);
  if (!g) {
    const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
    g = new THREE.LatheGeometry(pts, segs);
    const p = g.attributes.position;
    const y0 = points[0][1], y1 = points[points.length - 1][1];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
      const k = 1 + Math.sin(a * folds) * amp * t * t;
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    g.computeVertexNormals();
    _shapeCache.set(key, g);
  }
  return g;
}

export const DOME = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
