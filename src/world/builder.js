// Geometry batching builder: collects primitive pieces per material, bakes
// world transforms + vertex colors + world-space UVs, merges into few meshes,
// and registers colliders along the way.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stoneTexture, cobbleTexture, roofTexture, woodTexture, fabricTexture, marbleTexture } from './textures.js';

let MATS = null;

export function getMaterials() {
  if (MATS) return MATS;
  const stoneTex = stoneTexture();
  const cobbleTex = cobbleTexture();
  const roofTex = roofTexture();
  const woodTex = woodTexture();
  const fabTex = fabricTexture();
  const marbleTex = marbleTexture();
  const N = (t, k) => ({ normalMap: t.userData.normal, normalScale: new THREE.Vector2(k, k) });
  MATS = {
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, ...N(stoneTex, 0.9), vertexColors: true, roughness: 0.86, metalness: 0 }),
    cobble: new THREE.MeshStandardMaterial({ map: cobbleTex, ...N(cobbleTex, 1.0), vertexColors: true, roughness: 0.92 }),
    roof: new THREE.MeshStandardMaterial({ map: roofTex, ...N(roofTex, 1.0), vertexColors: true, roughness: 0.5, metalness: 0.08 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, ...N(woodTex, 0.7), vertexColors: true, roughness: 0.85 }),
    fabric: new THREE.MeshLambertMaterial({ map: fabTex, vertexColors: true, side: THREE.DoubleSide }),
    plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    marble: new THREE.MeshStandardMaterial({ map: marbleTex, normalMap: marbleTex.userData.normal, normalScale: new THREE.Vector2(0.3, 0.3), vertexColors: true, roughness: 0.25, metalness: 0.05 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf3cf6e, metalness: 0.95, roughness: 0.28, vertexColors: true }),
    iron: new THREE.MeshStandardMaterial({ color: 0x8a8f9c, metalness: 0.8, roughness: 0.45, vertexColors: true }),
    window: new THREE.MeshStandardMaterial({ color: 0x6f8fc0, emissive: 0xffc97a, emissiveIntensity: 0.15, roughness: 0.2, metalness: 0.3, vertexColors: true }),
    stained: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.3 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffc46b, emissiveIntensity: 0.4, vertexColors: true }),
    crystal: new THREE.MeshStandardMaterial({ color: 0xc9e6ff, emissive: 0x7fb4ff, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.88, vertexColors: true }),
    crystalPink: new THREE.MeshStandardMaterial({ color: 0xffd3ec, emissive: 0xff8fd0, emissiveIntensity: 0.5, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.88, vertexColors: true }),
    darkCrystal: new THREE.MeshStandardMaterial({ color: 0x5a3a7a, emissive: 0x9b4dff, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.3, vertexColors: true }),
    darkStone: new THREE.MeshStandardMaterial({ map: stoneTex, ...N(stoneTex, 1.0), color: 0x6b6078, vertexColors: true, roughness: 0.9 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffa040, vertexColors: true }),
    water: null,
  };
  // stained glass: use vertex colors as emissive tint via onBeforeCompile
  MATS.stained.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb;'
    );
  };
  return MATS;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _white = new THREE.Color(1, 1, 1);

export class Builder {
  constructor(collision) {
    this.col = collision;
    this.parts = new Map();
  }

  // add geometry with transform. opts: color, worldUV (default true), uvScale, flat
  add(matKey, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, opts = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rx, ry, rz, opts.order || 'YXZ');
    _q.setFromEuler(_e);
    _s.set(sx, sy, sz);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    if (opts.flat) { g.deleteAttribute('normal'); g.computeVertexNormals(); }
    const n = g.attributes.position.count;
    // color
    const col = new Float32Array(n * 3);
    const c = opts.color ? (opts.color.isColor ? opts.color : new THREE.Color(opts.color)) : _white;
    const jitter = opts.jitter ?? 0;
    const jr = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
    const pos0 = g.attributes.position;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) { const y = pos0.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (opts.aoBase !== undefined) minY = opts.aoBase;
    const ao = opts.ao !== false && maxY - minY > 1.2;
    const aoH = Math.min(3.5, (maxY - minY) * 0.5);
    for (let i = 0; i < n; i++) {
      let k = jr;
      if (ao) {
        const t = Math.min(1, Math.max(0, (pos0.getY(i) - minY) / aoH));
        k *= 0.62 + 0.38 * (t * t * (3 - 2 * t));
      }
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // uv
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (opts.worldUV !== false) {
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
      const k = opts.uvScale ?? 0.25;
      for (let i = 0; i < n; i++) {
        _n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
        const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        if (ay >= ax && ay >= az) uv.setXY(i, px * k, pz * k);
        else if (ax >= az) uv.setXY(i, pz * k, py * k);
        else uv.setXY(i, px * k, py * k);
      }
    } else if (opts.uvRepeat) {
      const uv = g.attributes.uv;
      for (let i = 0; i < n; i++) uv.setXY(i, uv.getX(i) * opts.uvRepeat[0], uv.getY(i) * opts.uvRepeat[1]);
    }
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    }
    let arr = this.parts.get(matKey);
    if (!arr) { arr = []; this.parts.set(matKey, arr); }
    arr.push(g);
    return g;
  }

  // Box with bottom at y (not center!)
  box(mat, x, y, z, w, h, d, ry = 0, opts = {}) {
    this.add(mat, BOX, x, y + h / 2, z, 0, ry, 0, w, h, d, opts);
    if (opts.collide !== false && this.col) {
      this.col.addBox(x, z, w / 2, d / 2, y, y + h, ry, { walkable: opts.walkable });
    }
  }

  // cylinder with bottom at y
  cyl(mat, x, y, z, rTop, rBot, h, seg = 16, opts = {}) {
    const geo = cylGeo(seg, rTop / Math.max(rBot, 1e-4));
    this.add(mat, geo, x, y + h / 2, z, 0, opts.ry || 0, 0, rBot, h, rBot, opts);
    if (opts.collide !== false && this.col) this.col.addCylinder(x, z, Math.max(rTop, rBot), y, y + h);
  }

  cone(mat, x, y, z, r, h, seg = 16, opts = {}) {
    const geo = coneGeo(seg);
    this.add(mat, geo, x, y + h / 2, z, 0, opts.ry || 0, 0, r, h, r, { worldUV: false, uvRepeat: [seg / 4, h / 3], ...opts });
  }

  sphere(mat, x, y, z, r, opts = {}) {
    // tessellation by size: tiny blossoms/leaves don't need 320 triangles each
    const geo = r < 0.2 ? SPHERE_LO : r < 0.55 ? SPHERE_MID : SPHERE;
    this.add(mat, geo, x, y, z, 0, 0, 0, r * (opts.sx || 1), r * (opts.sy || 1), r * (opts.sz || 1), opts);
  }

  // Triangular prism roof: along local z of length L, base width W, height H, bottom at y
  gable(mat, x, y, z, W, H, L, ry = 0, opts = {}) {
    this.add(mat, PRISM, x, y, z, 0, ry, 0, W, H, L, { worldUV: false, uvRepeat: [L / 3, W / 3], flat: true, ...opts });
  }

  pyramid(mat, x, y, z, w, h, d, ry = 0, opts = {}) {
    this.add(mat, PYRAMID, x, y + h / 2, z, 0, ry + Math.PI / 4, 0, w * 0.7072, h, d * 0.7072, { worldUV: false, uvRepeat: [2, h / 3], flat: true, ...opts });
  }

  build(parent) {
    const mats = getMaterials();
    const group = parent || new THREE.Group();
    for (const [key, list] of this.parts) {
      if (!list.length) continue;
      // split huge lists to keep bounding volumes tight
      const merged = mergeGeometries(list, false);
      merged.computeBoundingSphere();
      const mat = typeof key === 'string' ? mats[key] : key;
      const mesh = new THREE.Mesh(merged, mat);
      const noShadow = key === 'fire' || key === 'lamp' || key === 'window' || key === 'stained';
      mesh.castShadow = !noShadow && mat.transparent !== true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.IcosahedronGeometry(1, 4);
const SPHERE_MID = new THREE.SphereGeometry(1, 24, 16);
const SPHERE_LO = new THREE.SphereGeometry(1, 12, 8);
const CYL_CACHE = new Map();
// round shapes get twice the facets (low counts like 3/4/6 are deliberate prisms and stay)
const hiSeg = (seg) => (seg >= 8 ? Math.min(64, seg * 2) : seg);
function cylGeo(seg, ratio) {
  seg = hiSeg(seg);
  const k = seg + ':' + ratio.toFixed(3);
  let g = CYL_CACHE.get(k);
  if (!g) { g = new THREE.CylinderGeometry(ratio, 1, 1, seg); CYL_CACHE.set(k, g); }
  return g;
}
const CONE_CACHE = new Map();
function coneGeo(seg) {
  seg = hiSeg(seg);
  let g = CONE_CACHE.get(seg);
  if (!g) { g = new THREE.ConeGeometry(1, 1, seg); CONE_CACHE.set(seg, g); }
  return g;
}
const PYRAMID = new THREE.ConeGeometry(1, 1, 4);
// unit prism: base width 1 (x), height 1 (y, bottom at 0), length 1 (z)
const PRISM = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.5, 0);
  g.scale(1 / 1.7320508, 1 / 1.5, 1);
  return g;
})();

export { BOX, SPHERE };
