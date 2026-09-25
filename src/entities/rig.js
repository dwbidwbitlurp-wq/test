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
// fine twill weave with fibre noise (256px): reads as real cloth up close
const weaveN = toNormal((x, y) => {
  const a = Math.sin((x + y * 0.5) * Math.PI / 2.5) * (Math.floor(y / 5) % 2 ? 1 : -1);
  const b = Math.sin((y - x * 0.3) * Math.PI / 2.5) * (Math.floor(x / 5) % 2 ? -1 : 1);
  const fibre = Math.sin(x * 2.1 + Math.sin(y * 0.7) * 3) * 0.12;
  return (a + b) * 0.45 + fibre + (Math.random() - 0.5) * 0.18;
}, 256, 0.9);
weaveN.repeat.set(6, 6);
// polished plate: hammered dents, brushing and engraved scrollwork (light-fantasy filigree)
const metalN = toNormal((x, y) => {
  let v = Math.sin(x * 0.4 + Math.sin(y * 0.2) * 2) * 0.1 + (Math.random() - 0.5) * 0.12;
  const cx = (x % 64) - 32, cy = (y % 64) - 32;
  v += Math.exp(-(cx * cx + cy * cy) / 260) * 0.5;
  const r = Math.hypot(cx, cy), ang = Math.atan2(cy, cx);
  const scroll = Math.abs(Math.sin(r * 0.35 - ang * 2.0));
  v -= (scroll < 0.08 && r > 8 && r < 30 ? 1 : 0) * 0.9;
  return v;
}, 256, 1.4);
metalN.repeat.set(2, 2);
// hair: fine strands running along the lock
const hairN = toNormal((x, y) => Math.sin(x * 1.7 + Math.sin(y * 0.05) * 4) * 0.5 + Math.sin(x * 4.3) * 0.25 + (Math.random() - 0.5) * 0.2, 128, 1.0);
hairN.repeat.set(4, 1);
// skin: very soft pores
const skinN = toNormal(() => (Math.random() - 0.5) * 0.35, 128, 0.6);
skinN.repeat.set(8, 8);

export const MATS = {
  matte: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, normalMap: weaveN, normalScale: new THREE.Vector2(0.4, 0.4), sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color(1, 0.95, 0.92) }),
  metal: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.88, normalMap: metalN, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.6, clearcoatRoughness: 0.18 }),
  glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 2.2 }),
  cloth: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide, normalMap: weaveN, normalScale: new THREE.Vector2(0.55, 0.55), sheen: 0.9, sheenRoughness: 0.45, sheenColor: new THREE.Color(1, 0.96, 0.95) }),
  skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0, emissive: 0x2a1410, emissiveIntensity: 1, normalMap: skinN, normalScale: new THREE.Vector2(0.12, 0.12) }),
  hair: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, normalMap: hairN, normalScale: new THREE.Vector2(0.5, 0.5), sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 0.95, 0.85) }),
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
    this.parts.push({ bone, geo, color, t, kind, blend: t.blend });
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
      let ly = null;
      if (p.blend) { const pa = g.attributes.position; ly = new Float32Array(pa.count); for (let i = 0; i < pa.count; i++) ly[i] = pa.getY(i); }
      g.applyMatrix4(p.bone.matrixWorld);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      _c.set(p.color);
      for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const bi = index.get(p.bone);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      // soft joints: vertices near a joint share weight with the neighbouring bone, so knees, elbows,
      // hips and shoulders bend as one smooth surface instead of two primitives sliding apart
      if (p.blend) {
        for (const [ob, yFull, yNone, maxW = 0.5] of p.blend) {
          const oi = index.get(ob);
          if (oi === undefined) continue;
          for (let i = 0; i < n; i++) {
            const y = ly[i];
            let k = (y - yNone) / (yFull - yNone);
            if (k <= 0) continue;
            k = Math.min(1, k); k = k * k * (3 - 2 * k);
            const w = k * maxW;
            sw[i * 4] -= w; si[i * 4 + 1] = oi; sw[i * 4 + 1] = w;
          }
        }
      }
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
    g = new THREE.LatheGeometry(smoothProfile(points), segs);
    g.computeVertexNormals();
    _shapeCache.set(key, g);
  }
  return g;
}

// profile points -> dense centripetal Catmull-Rom curve (smooth silhouettes, no visible kinks)
export function smoothProfile(points, per = 4) {
  const raw = points.map(([r, y]) => new THREE.Vector3(Math.max(0.0001, r), y, 0));
  if (raw.length < 3) return raw.map((v) => new THREE.Vector2(v.x, v.y));
  const curve = new THREE.CatmullRomCurve3(raw, false, 'centripetal');
  const n = (raw.length - 1) * per;
  const out = [];
  for (let i = 0; i <= n; i++) { const v = curve.getPoint(i / n); out.push(new THREE.Vector2(Math.max(0.0001, v.x), v.y)); }
  return out;
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
    g = new THREE.LatheGeometry(smoothProfile(points), segs);
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
