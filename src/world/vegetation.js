// Trees, bushes, rocks (static instanced cells with LOD) and
// grass/flower carpets (dynamic chunks streamed around the player).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, hash2, smoothstep } from '../engine/noise.js';
import { forestDensity, meadowFlowers, roadInfo, isFlatZone } from './terrain.js';
import { WORLD, CRAG, LAKE, VILLAGE, CAMP, grassBlocked } from './layout.js';

const windUniform = { value: 0 };
export function windTime(t) { windUniform.value = t; }

function colorize(g, color) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  const col = new THREE.Color(color);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function prep(g) {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) ng.deleteAttribute(k);
  // solid parts sample the opaque corner of the leaf atlas (uv 0,0)
  ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
  return ng;
}

// ---- leaf atlas: bottom-left corner is opaque white (solid crowns sample uv 0,0),
// the rest holds a painted leaf cluster used by the alpha-tested leaf cards ----
let LEAF_TEX = null;
function leafTexture() {
  if (LEAF_TEX) return LEAF_TEX;
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#ffffff'; x.fillRect(0, S - 20, 20, 20);
  const rnd = mulberry32(77);
  const cx = S * 0.56, cy = S * 0.44, R = S * 0.36;
  for (let i = 0; i < 140; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R;
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
    const len = 12 + rnd() * 12, w = len * 0.45;
    const shade = 200 + Math.floor(rnd() * 55);
    x.save();
    x.translate(px, py); x.rotate(a + (rnd() - 0.5) * 1.4);
    x.fillStyle = `rgb(${shade},${shade},${shade})`;
    x.beginPath(); x.ellipse(0, 0, len * 0.5, w * 0.5, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = `rgba(150,150,150,0.5)`; x.lineWidth = 1;
    x.beginPath(); x.moveTo(-len * 0.45, 0); x.lineTo(len * 0.45, 0); x.stroke();
    x.restore();
  }
  LEAF_TEX = new THREE.CanvasTexture(c);
  LEAF_TEX.colorSpace = THREE.SRGBColorSpace;
  return LEAF_TEX;
}

// crown blob with soft spherical normals (no faceting) + optional leaf cards on its surface
function blob(r, x, y, z, color, detail, sy = 1, cards = 0) {
  // with leaf cards the solid core shrinks so the silhouette is made of leaves, not a smooth ball
  const g = new THREE.IcosahedronGeometry(cards ? r * 0.93 : r, detail + 1);
  g.scale(1, sy, 1);
  // organic lumps: the offset is a function of the vertex POSITION, so the copies of a shared corner
  // (the geometry is non-indexed) move together and the surface never cracks into loose shards
  const p = g.attributes.position;
  const rnd = mulberry32(Math.floor((x + 3) * 1000 + y * 77 + z * 13));
  const ph = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const k = 1 + (Math.sin(vx * 3.1 / r + ph) * Math.sin(vy * 2.7 / r + ph * 1.3) * Math.sin(vz * 3.3 / r - ph)) * 0.11;
    p.setXYZ(i, vx * k, vy * k, vz * k);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i) / sy, p.getZ(i)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(x, y, z);
  const out = colorize(prep(g), color);
  if (!cards) return out;
  return mergeGeometries([out, leafCards(r, x, y, z, sy, Math.round(cards * 1.8), color, rnd)]);
}

function leafCards(r, cx, cy, cz, sy, count, color, rnd) {
  const pos = [], nor = [], uv = [];
  const col = new THREE.Color(color);
  const cols = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    // points on the upper/outer shell
    const u = rnd(), v = rnd();
    const th = u * Math.PI * 2, ph = Math.acos(1 - v * 1.6);
    const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    const rr = r * (0.88 + rnd() * 0.22);
    const c = new THREE.Vector3(cx + dir.x * rr, cy + dir.y * rr * sy, cz + dir.z * rr);
    const size = r * (0.42 + rnd() * 0.26);
    const t1 = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
    const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
    const rot = rnd() * Math.PI;
    const a = t1.clone().multiplyScalar(Math.cos(rot)).addScaledVector(t2, Math.sin(rot)).multiplyScalar(size);
    const b = t1.clone().multiplyScalar(-Math.sin(rot)).addScaledVector(t2, Math.cos(rot)).multiplyScalar(size);
    // tilt the card a little out of the tangent plane so crowns look fluffy
    const tilt = dir.clone().multiplyScalar(size * (rnd() - 0.3) * 0.45);
    const q = [c.clone().sub(a).sub(b).sub(tilt), c.clone().add(a).sub(b).sub(tilt), c.clone().add(a).add(b).add(tilt), c.clone().sub(a).add(b).add(tilt)];
    const uvq = [[0.12, 0.08], [1, 0.08], [1, 1], [0.12, 1]];
    const shade = 0.82 + rnd() * 0.3;
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(q[k].x, q[k].y, q[k].z);
      const nn = new THREE.Vector3(q[k].x - cx, (q[k].y - cy) / sy, q[k].z - cz).normalize();
      nor.push(nn.x, nn.y, nn.z);
      uv.push(uvq[k][0], uvq[k][1]);
      cols.push(col.r * shade, col.g * shade, col.b * shade);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
}

function trunk(h, r0, r1, color, seg = 7, lean = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 3);
  g.translate(0, h / 2, 0);
  if (lean) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) + Math.sin((y / h) * 2.2) * lean);
    }
    g.computeVertexNormals();
  }
  return colorize(prep(g), color);
}

function branch(len, r, x, y, z, rx, rz, color) {
  const g = new THREE.CylinderGeometry(r * 0.5, r, len, 5);
  g.translate(0, len / 2, 0);
  g.rotateZ(rz);
  g.rotateX(rx);
  g.translate(x, y, z);
  return colorize(prep(g), color);
}

function cone(r, h, y, color, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, y + h / 2, 0);
  return colorize(prep(g), color);
}

// ---- tree archetypes ----
const TREE_TYPES = {
  oak: (lod) => {
    const parts = [trunk(3.4, 0.42, 0.26, '#8b6a52', lod ? 5 : 7)];
    if (!lod) {
      parts.push(branch(1.8, 0.16, 0, 2.3, 0, 0, 0.9, '#8b6a52'), branch(1.6, 0.14, 0, 2.6, 0, 0.8, -0.7, '#8b6a52'));
      const cols = ['#8ec76b', '#a6d372', '#7fbf66', '#b9d977', '#9acd6e'];
      [[0, 4.9, 0, 2.3], [1.5, 4.3, 0.5, 1.8], [-1.4, 4.4, -0.3, 1.8], [0.3, 4.5, 1.5, 1.7], [-0.4, 5.9, -0.6, 1.6], [0.2, 4.1, -1.5, 1.6]]
        .forEach(([x, y, z, r], i) => parts.push(blob(r, x, y, z, cols[i % cols.length], 1, 1, 16)));
    } else {
      parts.push(blob(2.8, 0, 4.9, 0, '#98cb6e', 1, 0.85, 14));
    }
    return parts;
  },
  golden: (lod) => {
    const parts = [trunk(3.6, 0.4, 0.24, '#8e6d57', lod ? 5 : 7)];
    if (!lod) {
      const cols = ['#f3d27a', '#f7e08f', '#eec46a', '#fae7a6'];
      [[0, 5.1, 0, 2.2], [1.4, 4.5, 0.4, 1.7], [-1.3, 4.6, -0.2, 1.8], [0.2, 4.7, 1.4, 1.6], [0, 6.1, -0.4, 1.5], [-0.3, 4.3, -1.4, 1.5]]
        .forEach(([x, y, z, r], i) => parts.push(blob(r, x, y, z, cols[i % cols.length], 1, 1, 16)));
    } else parts.push(blob(2.7, 0, 5.0, 0, '#f3d680', 1, 0.85, 14));
    return parts;
  },
  blossom: (lod) => {
    const parts = [trunk(2.8, 0.36, 0.2, '#7a5a55', lod ? 5 : 7, 0.35)];
    if (!lod) {
      parts.push(branch(2.2, 0.14, 0.2, 2.0, 0, 0, 1.0, '#7a5a55'), branch(2.0, 0.13, 0.2, 2.2, 0, -0.9, -0.9, '#7a5a55'));
      const cols = ['#f7b7d2', '#fbd0e2', '#f29cc2', '#ffe1ec', '#f5a9cb'];
      [[0.3, 4.0, 0, 2.1, 0.7], [2.0, 3.5, 0.3, 1.6, 0.7], [-1.5, 3.7, -0.7, 1.7, 0.7], [0.5, 3.6, 1.8, 1.5, 0.7], [0.1, 4.8, -0.4, 1.5, 0.75], [-0.6, 3.4, 1.2, 1.3, 0.7]]
        .forEach(([x, y, z, r, sy], i) => parts.push(blob(r, x, y, z, cols[i % cols.length], 1, sy, 16)));
    } else parts.push(blob(2.7, 0.3, 3.9, 0, '#f6bdd6', 1, 0.62, 14));
    return parts;
  },
  lavender: (lod) => {
    const parts = [trunk(3.0, 0.36, 0.22, '#6e5a6e', lod ? 5 : 7, -0.3)];
    if (!lod) {
      const cols = ['#c3a8ec', '#b596e6', '#d6c2f5', '#a88ade'];
      [[0, 4.2, 0, 2.0, 0.75], [1.6, 3.8, 0.5, 1.6, 0.7], [-1.5, 3.9, -0.4, 1.6, 0.7], [0.2, 3.8, 1.6, 1.4, 0.7], [0, 5.0, -0.3, 1.4, 0.75]]
        .forEach(([x, y, z, r, sy], i) => parts.push(blob(r, x, y, z, cols[i % cols.length], 1, sy, 16)));
      // hanging wisteria clusters
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const g = new THREE.ConeGeometry(0.28, 1.4, 5);
        g.rotateX(Math.PI);
        g.translate(Math.cos(a) * 2.1, 2.7, Math.sin(a) * 2.1);
        parts.push(colorize(prep(g), i % 2 ? '#b89be8' : '#d7c3f6'));
      }
    } else parts.push(blob(2.6, 0, 4.1, 0, '#c0a5ea', 1, 0.7, 14));
    return parts;
  },
  birch: (lod) => {
    const parts = [trunk(5.2, 0.26, 0.16, '#f1eee8', lod ? 5 : 7)];
    if (!lod) {
      const cols = ['#c5e08a', '#d7e89a', '#b8d97e'];
      [[0, 5.8, 0, 1.5, 1.3], [0.8, 5.0, 0.3, 1.2, 1.2], [-0.7, 5.2, -0.3, 1.2, 1.2], [0, 6.9, 0, 1.0, 1.3]]
        .forEach(([x, y, z, r, sy], i) => parts.push(blob(r, x, y, z, cols[i % cols.length], 1, sy, 16)));
      for (let i = 0; i < 5; i++) {
        const g = new THREE.BoxGeometry(0.28, 0.05, 0.03);
        g.translate(0, 0.6 + i * 0.9, 0.2);
        g.rotateY(i * 1.3);
        parts.push(colorize(prep(g), '#4a4a4a'));
      }
    } else parts.push(blob(1.8, 0, 5.9, 0, '#c9e18d', 1, 1.4, 10));
    return parts;
  },
  pine: (lod) => {
    const parts = [trunk(2.0, 0.34, 0.24, '#6f5646', 5)];
    const cols = ['#5c9a6c', '#6aa877', '#4f8c62'];
    const n = lod ? 2 : 4;
    for (let i = 0; i < n; i++) {
      const r = 2.6 - i * (lod ? 0.9 : 0.55), h = 3.2 - i * 0.3;
      parts.push(cone(r, h, 1.6 + i * (lod ? 2.6 : 1.6), cols[i % 3], lod ? 6 : 9));
    }
    return parts;
  },
  dead: (lod) => {
    const parts = [trunk(4.2, 0.4, 0.14, '#4b3d58', 5, 0.5)];
    if (!lod) {
      parts.push(
        branch(2.2, 0.14, 0.3, 2.5, 0, 0.2, 1.1, '#4b3d58'), branch(2.0, 0.12, 0.2, 3.0, 0, -0.9, -0.8, '#4b3d58'),
        branch(1.6, 0.1, 0.4, 3.6, 0, 0.9, 0.5, '#4b3d58'),
      );
    }
    return parts;
  },
};

function buildTypeGeo(type, lod) {
  const g = mergeGeometries(TREE_TYPES[type](lod));
  g.computeBoundingSphere();
  return g;
}

function makeFoliageMaterial(opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, ...opts });
  mat.onBeforeCompile = (sh) => {
    // soft sunlit rim on crown edges: painterly, translucent-looking foliage
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rimF = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
      totalEmissiveRadiance += diffuseColor.rgb * pow(rimF, 2.5) * 0.28;`
    );
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sway = smoothstep(2.0, 6.0, position.y);
      transformed.x += sin(uWind * 1.3 + ip.x * 0.08 + ip.z * 0.05) * 0.16 * sway;
      transformed.z += cos(uWind * 1.1 + ip.z * 0.08) * 0.12 * sway;`
    );
  };
  return mat;
}

const grassRadiusUniform = { value: 60 };
function makeGrassMaterial(radius, flower = false) {
  grassRadiusUniform.value = radius;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.uRadius = grassRadiusUniform;
  mat.onBeforeCompile = (sh) => {
    if (flower) {
      // tint only the white petals with the instance colour; stems and leaves stay green
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
        vColor = vec3(1.0);
        vColor *= color.rgb;
        #ifdef USE_INSTANCING_COLOR
          float petal = step(0.8, min(color.r, min(color.g, color.b)));
          vColor *= mix(vec3(1.0), instanceColor.rgb, petal);
        #endif`);
    }
    // foliage-style lighting: normals lean to the sky and back faces are lit like front faces,
    // so thin blades and petals never turn into dark silhouettes
    // (guarded: a blade whose normal points straight down would otherwise normalize a zero vector -> NaN -> bloom smears black)
    sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ vec3 nn = mix(objectNormal, vec3(0.0, 1.0, 0.0), 0.5) + vec3(0.0, 0.02, 0.0); objectNormal = normalize(nn); }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'vec3 normal = vNormal;\nnormal = dot(normal, normal) > 1e-8 ? normalize(normal) : vec3(0.0, 0.0, 1.0);\nvec3 nonPerturbedNormal = normal;');
    sh.uniforms.uWind = windUniform;
    sh.uniforms.uRadius = grassRadiusUniform;
    sh.vertexShader = 'uniform float uWind;\nuniform float uRadius;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float dcam = distance(ip.xz, cameraPosition.xz);
      float fade = 1.0 - smoothstep(uRadius * 0.65, uRadius, dcam);
      transformed *= fade;
      float bend = position.y * position.y;
      transformed.x += (sin(uWind * 2.1 + ip.x * 0.35 + ip.z * 0.21) * 0.22 + 0.08) * bend;
      transformed.z += cos(uWind * 1.7 + ip.z * 0.31) * 0.14 * bend;`
    );
  };
  return mat;
}

export class Vegetation {
  constructor(scene, terrain, collision, quality) {
    this.scene = scene;
    this.terrain = terrain;
    this.collision = collision;
    this.quality = quality;
    this.cells = [];
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    scene.add(this.group);
    this.treeMat = makeFoliageMaterial();
    this.leafDepthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTexture(), alphaTest: 0.45 });
    this.buildStatic();
    // dynamic grass
    this.chunkSize = 24;
    this.grassRadius = quality.grassRadius;
    this.grassMat = makeGrassMaterial(this.grassRadius);
    this.flowerMat = makeGrassMaterial(this.grassRadius, true);
    this.grassGeo = makeGrassClump();
    this.flowerGeos = [makeDaisy(), makeLupine(), makeBell(), makePoppy(), makeCosmos()];
    this.chunks = new Map();
    this.lastChunkUpdate = -1;
    this.dotChunks = new Map();
    const dotTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 14, 0, 6.3); x.fill();
      return new THREE.CanvasTexture(c);
    })();
    this.dotMat = new THREE.PointsMaterial({ size: 0.42, map: dotTex, alphaTest: 0.5, vertexColors: true, sizeAttenuation: true });
    this.treeList = []; // {x,z,type,scale} for other systems (apple trees etc)
  }

  buildStatic() {
    const terrain = this.terrain;
    const W = WORLD.water;
    const CELL = 200;
    const R = WORLD.playRadius + 140;
    const cellsN = Math.ceil((R * 2) / CELL);
    const typeKeys = Object.keys(TREE_TYPES);
    const geos = {};
    for (const t of typeKeys) geos[t] = [buildTypeGeo(t, 0), buildTypeGeo(t, 1)];
    this.treeGeos = geos;
    const rockGeo = makeRockGeo(0), rockGeoL = makeRockGeo(1);
    const bushGeo = makeBushGeo(0), bushGeoL = makeBushGeo(1);
    const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const bushMat = makeFoliageMaterial();
    const rnd = mulberry32(2024);
    const buckets = new Map();
    const bucket = (ci, cj) => {
      const k = ci + ',' + cj;
      let b = buckets.get(k);
      if (!b) { b = { ci, cj, trees: {}, rocks: [], bushes: [] }; buckets.set(k, b); }
      return b;
    };
    const step = this.quality.treeStep;
    const trees = [];
    for (let x = -R; x < R; x += step) {
      for (let z = -R; z < R; z += step) {
        const px = x + rnd() * step, pz = z + rnd() * step;
        const r = Math.hypot(px, pz);
        if (r > R) continue;
        const fd = forestDensity(px, pz);
        const kx = px - CRAG.x, kz = pz - CRAG.z;
        const cragD = Math.hypot(kx, kz);
        let p = fd * 0.85 + 0.035;
        const cr = Math.hypot(px, pz + 260);
        if (cr > 112 && cr < 160) p = Math.max(p, 0.28);
        if (cragD < CRAG.r + 110) p = Math.max(p, 0.35 * (1 - cragD / (CRAG.r + 110)) + 0.1);
        const roll = rnd();
        const ri = roadInfo(px, pz);
        const h = terrain.getHeight(px, pz);
        const n = terrain.getNormal(px, pz);
        const cdx = px - 0, cdz = pz + 260;
        const nearCastle = cdx * cdx + cdz * cdz < 112 * 112 || (Math.abs(px) < 16 && pz > -200 && pz < -40);
        const bad = h < W + 0.8 || ri.d < 7 || (isFlatZone(px, pz) && !(cdx * cdx + cdz * cdz > 112 * 112 && cdx * cdx + cdz * cdz < 140 * 140)) || nearCastle || n.y < 0.6 || h > 150;
        const ci = Math.floor((px + R) / CELL), cj = Math.floor((pz + R) / CELL);
        if (roll < p && !bad) {
          let type;
          const tr = rnd();
          if (cragD < CRAG.r + 120 && rnd() < 0.85) type = 'dead';
          else if (r > 555 || h > 70) type = tr < 0.8 ? 'pine' : 'birch';
          else if (fd > 0.45) type = tr < 0.34 ? 'oak' : tr < 0.52 ? 'blossom' : tr < 0.68 ? 'lavender' : tr < 0.84 ? 'golden' : 'birch';
          else type = tr < 0.45 ? 'blossom' : tr < 0.65 ? 'oak' : tr < 0.8 ? 'lavender' : 'golden';
          const s = 0.8 + rnd() * 0.65;
          const b = bucket(ci, cj);
          (b.trees[type] ||= []).push({ x: px, y: h - 0.2, z: pz, s, ry: rnd() * Math.PI * 2 });
          trees.push({ x: px, z: pz, type, s });
          this.collision.addCylinder(px, pz, 0.45 * s, h - 1, h + 5 * s, { walkable: false });
        } else if ((!bad || (cr > 110 && cr < 170 && n.y > 0.5 && ri.d > 6)) && rnd() < 0.09 + fd * 0.22 + (cr > 110 && cr < 170 ? 0.35 : 0)) {
          const b = bucket(ci, cj);
          b.bushes.push({ x: px + 2, y: h - 0.1, z: pz + 1, s: 0.7 + rnd() * 0.7, ry: rnd() * 6, c: rnd() });
        }
        // rocks: more on slopes / near mountains / crag
        const cliff = cr > 104 && cr < 140 ? 0.3 : 0;
        const rockP = (n.y < 0.9 ? 0.08 : 0.012) + (r > 500 ? 0.05 : 0) + (cragD < CRAG.r + 60 ? 0.06 : 0) + cliff * (n.y < 0.8 ? 1 : 0.2);
        if (rnd() < rockP && ri.d > 6 && (!isFlatZone(px, pz) || cliff) && h > W - 3 && !(cr < 104)) {
          const b = bucket(ci, cj);
          const s = 0.5 + rnd() * rnd() * 3.5;
          b.rocks.push({ x: px + 1.5, y: h - 0.3 * s, z: pz - 1.5, s, ry: rnd() * 6, dark: cragD < CRAG.r + 80 });
          if (s > 0.9) this.collision.addCylinder(px + 1.5, pz - 1.5, 0.9 * s, h - 2, h + 1.1 * s);
        }
      }
    }
    this.treeList = trees;

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (const b of buckets.values()) {
      const cx = -R + (b.ci + 0.5) * CELL, cz = -R + (b.cj + 0.5) * CELL;
      const cell = { x: cx, z: cz, hi: [], lo: [] };
      for (const [type, list] of Object.entries(b.trees)) {
        for (let lod = 0; lod < 2; lod++) {
          const im = new THREE.InstancedMesh(geos[type][lod], this.treeMat, list.length);
          list.forEach((t, i) => {
            q.setFromAxisAngle(up, t.ry);
            m4.compose(ps.set(t.x, t.y, t.z), q, sc.set(t.s, t.s * (0.9 + (i % 5) * 0.05), t.s));
            im.setMatrixAt(i, m4);
            const v = 0.9 + ((i * 37) % 20) / 100;
            im.setColorAt(i, col.setRGB(v, v, v));
          });
          im.castShadow = lod === 0 && this.quality.shadows;
          im.receiveShadow = lod === 0;
          im.customDepthMaterial = this.leafDepthMat;
          im.computeBoundingSphere();
          (lod ? cell.lo : cell.hi).push(im);
          this.group.add(im);
        }
      }
      const bushCols = ['#f4a6c8', '#b8a6f0', '#9fd0f5', '#fff0a8', '#9fcf7f', '#8cc26f', '#f7c6dc'];
      if (b.bushes.length) {
        for (let lod = 0; lod < 2; lod++) {
          const im = new THREE.InstancedMesh(lod ? bushGeoL : bushGeo, bushMat, b.bushes.length);
          b.bushes.forEach((t, i) => {
            q.setFromAxisAngle(up, t.ry);
            m4.compose(ps.set(t.x, t.y, t.z), q, sc.set(t.s, t.s, t.s));
            im.setMatrixAt(i, m4);
            im.setColorAt(i, col.set(bushCols[Math.floor(t.c * bushCols.length)]));
          });
          im.computeBoundingSphere();
          im.receiveShadow = true;
          (lod ? cell.lo : cell.hi).push(im);
          this.group.add(im);
        }
      }
      if (b.rocks.length) {
        for (let lod = 0; lod < 2; lod++) {
          const im = new THREE.InstancedMesh(lod ? rockGeoL : rockGeo, rockMat, b.rocks.length);
          b.rocks.forEach((t, i) => {
            q.setFromEuler(new THREE.Euler(t.ry * 0.3, t.ry, t.ry * 0.2));
            m4.compose(ps.set(t.x, t.y, t.z), q, sc.set(t.s * 1.2, t.s, t.s));
            im.setMatrixAt(i, m4);
            if (t.dark) im.setColorAt(i, col.set('#8a7f98'));
            else { const v = 0.9 + (i % 7) * 0.025; im.setColorAt(i, col.setRGB(v, v * 0.99, v * 0.97)); }
          });
          im.computeBoundingSphere();
          im.castShadow = lod === 0 && this.quality.shadows;
          im.receiveShadow = true;
          (lod ? cell.lo : cell.hi).push(im);
          this.group.add(im);
        }
      }
      this.cells.push(cell);
    }
  }

  updateLOD(camPos) {
    const lodDist = this.quality.lodDist;
    for (const c of this.cells) {
      // distance to the cell's nearest edge (cells are 200 m): trees near the player are always full detail
      const dx = Math.max(0, Math.abs(c.x - camPos.x) - 100), dz = Math.max(0, Math.abs(c.z - camPos.z) - 100);
      const d = Math.hypot(dx, dz);
      const near = d < lodDist * 0.55;
      for (const m of c.hi) m.visible = near;
      for (const m of c.lo) m.visible = !near;
    }
  }

  // ---- grass & flowers ----
  buildChunk(ci, cj) {
    const S = this.chunkSize;
    const x0 = ci * S, z0 = cj * S;
    const rnd = mulberry32(Math.floor(hash2(ci, cj, 9) * 1e9));
    const terrain = this.terrain;
    const W = WORLD.water;
    const grassN = Math.floor(S * S * this.quality.grassDensity);
    const gm = [], gc = [], fm = [[], [], [], [], []], fc = [[], [], [], [], []];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const flowerCols = ['#f7a8c8', '#f4c2dc', '#c7a6f0', '#b18ae8', '#ffffff', '#fff3b0', '#a9d4ff', '#ffb4a2'];
    const castleX = -260; // quick reject: skip castle interior
    for (let i = 0; i < grassN; i++) {
      const x = x0 + rnd() * S, z = z0 + rnd() * S;
      const h = terrain.getHeight(x, z);
      if (h < W + 0.4) continue;
      if (Math.abs(x) < 80 && Math.abs(z - castleX) < 76) continue;
      if (grassBlocked(x, z)) continue;
      const ri = roadInfo(x, z);
      if (ri.d < 3.4) continue;
      const n = terrain.getNormal(x, z);
      if (n.y < 0.75) continue;
      const kx = x - CRAG.x, kz = z - CRAG.z;
      const cragD = Math.hypot(kx, kz);
      const fd = forestDensity(x, z);
      const s = (0.7 + rnd() * 0.7) * (1 - smoothstep(0.6, 1.0, fd) * 0.4);
      q.setFromAxisAngle(up, rnd() * 6.28);
      m4.compose(ps.set(x, h - 0.05, z), q, sc.set(s, s * (0.8 + rnd() * 0.6), s));
      gm.push(m4.clone());
      const t = rnd();
      const c = new THREE.Color().setHSL(0.24 + t * 0.06 - fd * 0.02, 0.5 + t * 0.15, 0.48 + rnd() * 0.12);
      if (cragD < CRAG.r + 80) c.lerp(new THREE.Color('#7a6a8a'), 0.7);
      gc.push(c);
      // flowers
      const fl = meadowFlowers(x, z) * (1 - fd * 0.7) * (cragD < CRAG.r + 90 ? 0.1 : 1);
      if (rnd() < fl * this.quality.flowerDensity * 1.5) {
        const kr = rnd(); const kind = kr < 0.36 ? 0 : kr < 0.55 ? 1 : kr < 0.7 ? 2 : kr < 0.85 ? 3 : 4;
        const fs = 0.95 + rnd() * 0.55;
        const px = x + rnd() - 0.5, pz = z + rnd() - 0.5;
        q.setFromAxisAngle(up, rnd() * 6.28);
        m4.compose(ps.set(px, terrain.getHeight(px, pz) - 0.02, pz), q, sc.set(fs, fs * (0.8 + rnd() * 0.5), fs));
        fm[kind].push(m4.clone());
        // clustered colours
        const k = Math.floor((hash2(Math.floor(x / 9), Math.floor(z / 9), kind) * 0.7 + rnd() * 0.3) * flowerCols.length);
        fc[kind].push(new THREE.Color(flowerCols[k]));
      }
    }
    const group = new THREE.Group();
    const mk = (geo, mat, mats, cols) => {
      if (!mats.length) return;
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
      im.computeBoundingSphere();
      im.receiveShadow = true;
      group.add(im);
    };
    mk(this.grassGeo, this.grassMat, gm, gc);
    for (let k = 0; k < 5; k++) mk(this.flowerGeos[k], this.flowerMat, fm[k], fc[k]);
    return group;
  }

  // ---- mid/far flower colour dots (keeps fields colourful to the horizon) ----
  buildDotChunk(ci, cj) {
    const S = 64;
    const x0 = ci * S, z0 = cj * S;
    const rnd = mulberry32(Math.floor(hash2(ci, cj, 21) * 1e9));
    const terrain = this.terrain;
    const W = WORLD.water;
    const pos = [], col = [];
    const cols = ['#f49ac4', '#f7b9d6', '#c4a3f0', '#a98ae6', '#ffffff', '#fff0a0', '#ffb8c8', '#e8c6ff'].map((c) => new THREE.Color(c));
    const n = Math.floor(S * S * 0.55 * this.quality.flowerDensity);
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * S, z = z0 + rnd() * S;
      const fl = meadowFlowers(x, z) * (1 - forestDensity(x, z) * 0.8);
      if (rnd() > fl) continue;
      const h = terrain.getHeight(x, z);
      if (h < W + 0.5 || h > 90) continue;
      if (Math.abs(x) < 80 && Math.abs(z + 260) < 76) continue;
      if (grassBlocked(x, z)) continue;
      if (roadInfo(x, z).d < 4) continue;
      pos.push(x, h + 0.35, z);
      const k = Math.floor((hash2(Math.floor(x / 11), Math.floor(z / 11), 3) * 0.75 + rnd() * 0.25) * cols.length);
      const c = cols[k];
      col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    const pts = new THREE.Points(g, this.dotMat);
    return pts;
  }

  updateDots(camPos) {
    const S = 64;
    const R = this.quality.dotRadius || 200;
    const ci = Math.floor(camPos.x / S), cj = Math.floor(camPos.z / S);
    const key = ci + ',' + cj;
    if (key === this.lastDotKey) return;
    this.lastDotKey = key;
    const need = new Set();
    const n = Math.ceil(R / S);
    for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) {
      const cx = (i + 0.5) * S - camPos.x, cz = (j + 0.5) * S - camPos.z;
      if (cx * cx + cz * cz > (R + S) ** 2) continue;
      const k = i + ',' + j;
      need.add(k);
      if (!this.dotChunks.has(k)) { const p = this.buildDotChunk(i, j); this.dotChunks.set(k, p); this.group.add(p); }
    }
    for (const [k, p] of this.dotChunks) if (!need.has(k)) { this.group.remove(p); p.geometry.dispose(); this.dotChunks.delete(k); }
  }

  updateChunks(camPos) {
    const S = this.chunkSize;
    const R = Math.ceil(this.grassRadius / S);
    const ci = Math.floor(camPos.x / S), cj = Math.floor(camPos.z / S);
    const key = ci + ',' + cj;
    if (key === this.lastChunkKey) return;
    this.lastChunkKey = key;
    const need = new Set();
    let built = 0;
    for (let i = ci - R; i <= ci + R; i++) {
      for (let j = cj - R; j <= cj + R; j++) {
        const cx = (i + 0.5) * S - camPos.x, cz = (j + 0.5) * S - camPos.z;
        if (cx * cx + cz * cz > (this.grassRadius + S) ** 2) continue;
        const k = i + ',' + j;
        need.add(k);
        if (!this.chunks.has(k)) {
          const g = this.buildChunk(i, j);
          this.chunks.set(k, g);
          this.group.add(g);
          built++;
        }
      }
    }
    for (const [k, g] of this.chunks) {
      if (!need.has(k)) {
        this.group.remove(g);
        g.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
        this.chunks.delete(k);
      }
    }
    return built;
  }

  update(camPos, t) {
    windTime(t);
    this.updateChunks(camPos);
    this.updateDots(camPos);
    if (!this._lodT || t - this._lodT > 0.5) { this._lodT = t; this.updateLOD(camPos); }
  }
}

function makeGrassClump() {
  // fine curved blades: 3 segments each, dark base -> sunlit tip
  const pos = [], col = [], nor = [], uv = [];
  const N = 13;
  const rnd = mulberry32(4242);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.8;
    const r = 0.03 + rnd() * 0.3;
    const h = 0.26 + rnd() * 0.42;
    const w = 0.014 + rnd() * 0.012;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const lean = 0.1 + rnd() * 0.22;
    const dx = Math.cos(a + (rnd() - 0.5)) * lean, dz = Math.sin(a + (rnd() - 0.5)) * lean;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const ring = [];
    const S = 3;
    for (let k = 0; k <= S; k++) {
      const t = k / S;
      const bend = t * t;
      const cx = bx + dx * bend, cy = h * t, cz = bz + dz * bend;
      const ww = (1 - t * 0.85);
      ring.push([[cx - px * ww, cy, cz - pz * ww], [cx + px * ww, cy, cz + pz * ww]]);
    }
    const tip = [bx + dx * 1.15, h * 1.04, bz + dz * 1.15];
    const shade = 0.85 + rnd() * 0.3;
    const cAt = (t) => [(0.36 + t * 0.78) * shade, (0.46 + t * 0.66) * shade, (0.3 + t * 0.55) * shade];
    const push = (v, t) => { pos.push(...v); col.push(...cAt(t)); nor.push(dx * 0.6, 1, dz * 0.6); uv.push(0, v[1]); };
    for (let k = 0; k < S; k++) {
      const [l0, r0] = ring[k], [l1, r1] = ring[k + 1];
      const t0 = k / S, t1 = (k + 1) / S;
      push(l0, t0); push(r0, t0); push(l1, t1);
      push(r0, t0); push(r1, t1); push(l1, t1);
    }
    const [lT, rT] = ring[S];
    push(lT, 1); push(rT, 1); push(tip, 1.15);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ---- flowers: petal geometry (instance colour tints the white petals; stems/leaves keep their green) ----
function stemAndLeaves(h, parts, rnd) {
  const st = new THREE.CylinderGeometry(0.008, 0.012, h, 4);
  st.translate(0, h / 2, 0);
  parts.push(colorize(prep(st), '#4f8a40'));
  for (let i = 0; i < 2; i++) {
    const lf = new THREE.PlaneGeometry(0.035, 0.16, 1, 2);
    const p = lf.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, (y + 0.08) * (y + 0.08) * 1.6); }
    lf.translate(0, 0.08, 0);
    lf.rotateX(-0.9);
    lf.rotateY(i * Math.PI + rnd() * 0.6);
    lf.translate(0, h * (0.2 + i * 0.18), 0);
    parts.push(colorize(prep(lf), '#5f9a4a'));
  }
}

function petalRing(n, len, wid, cup, y, parts, color = '#ffffff') {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const pg = new THREE.BufferGeometry();
    const v = [0, 0, -wid * 0.3, len * 0.55, cup * 0.5, -wid, len, cup, 0, 0, 0, -wid * 0.3, len, cup, 0, len * 0.55, cup * 0.5, wid, 0, 0, wid * 0.3, 0, 0, -wid * 0.3, len * 0.55, cup * 0.5, wid];
    pg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    pg.computeVertexNormals();
    const nn = pg.attributes.normal;
    for (let k = 0; k < nn.count; k++) nn.setXYZ(k, 0, 1, 0);
    pg.rotateY(a);
    pg.translate(0, y, 0);
    parts.push(colorize(prep(pg), color));
  }
}

function makeDaisy() {
  const parts = [];
  const rnd = mulberry32(11);
  const h = 0.4;
  stemAndLeaves(h, parts, rnd);
  petalRing(14, 0.085, 0.014, 0.012, h, parts);
  const c = new THREE.SphereGeometry(0.028, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  c.scale(1, 0.55, 1); c.translate(0, h, 0);
  parts.push(colorize(prep(c), '#ffd84a'));
  return mergeGeometries(parts);
}

function makeLupine() {
  // spike of small florets spiralling up a stem
  const parts = [];
  const rnd = mulberry32(12);
  stemAndLeaves(0.34, parts, rnd);
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const a = i * 2.4;
    const r = 0.034 * (1 - t * 0.7);
    const f = new THREE.SphereGeometry(0.02 * (1.2 - t * 0.6), 5, 3);
    f.scale(1, 0.7, 1);
    f.translate(Math.cos(a) * r, 0.3 + t * 0.26, Math.sin(a) * r);
    parts.push(colorize(prep(f), '#ffffff'));
  }
  return mergeGeometries(parts);
}

function makeBell() {
  // drooping bellflowers on arching stems
  const parts = [];
  const rnd = mulberry32(13);
  stemAndLeaves(0.24, parts, rnd);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + rnd();
    const h = 0.26 + i * 0.06;
    const bx = Math.cos(a) * 0.07, bz = Math.sin(a) * 0.07;
    const st = new THREE.CylinderGeometry(0.006, 0.008, h, 3);
    st.translate(bx * 0.5, h / 2, bz * 0.5);
    parts.push(colorize(prep(st), '#4f8a40'));
    const b = new THREE.CylinderGeometry(0.012, 0.042, 0.06, 7, 1, true);
    b.translate(bx, h - 0.03, bz);
    parts.push(colorize(prep(b), '#ffffff'));
    const inner = new THREE.CylinderGeometry(0.011, 0.04, 0.058, 7, 1, true);
    inner.scale(-1, 1, 1); inner.translate(bx, h - 0.03, bz);
    parts.push(colorize(prep(inner), '#e8e4f4'));
  }
  return mergeGeometries(parts);
}

function makePoppy() {
  // cupped petals, dark heart
  const parts = [];
  const rnd = mulberry32(14);
  const h = 0.44;
  stemAndLeaves(h, parts, rnd);
  petalRing(5, 0.07, 0.05, 0.05, h, parts);
  const c = new THREE.SphereGeometry(0.018, 6, 4);
  c.translate(0, h + 0.012, 0);
  parts.push(colorize(prep(c), '#3a2a3a'));
  return mergeGeometries(parts);
}

function makeCosmos() {
  const parts = [];
  const rnd = mulberry32(15);
  const h = 0.52;
  stemAndLeaves(h, parts, rnd);
  petalRing(8, 0.075, 0.03, 0.006, h, parts);
  const c = new THREE.SphereGeometry(0.02, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  c.translate(0, h, 0);
  parts.push(colorize(prep(c), '#ffcf4a'));
  return mergeGeometries(parts);
}

// weathered boulder: welded sphere displaced by layered noise (no cracks between faces), flattened base,
// warm stone with darker crevices and moss on the upward-facing surfaces
function makeRockGeo(lod) {
  let g = new THREE.IcosahedronGeometry(1, lod ? 1 : 4);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const f = (x, y, z) => Math.sin(x * 1.7 + Math.sin(z * 1.3)) * Math.cos(y * 1.9 + x * 0.7) * 0.5
    + Math.sin(x * 3.9 - z * 2.7 + 1.3) * Math.sin(y * 4.3 + 0.7) * 0.22
    + Math.sin(x * 8.1 + y * 7.3 - z * 6.7) * 0.08;
  const disp = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = f(v.x * 1.1, v.y * 1.1, v.z * 1.1);
    disp[i] = d;
    v.multiplyScalar(1 + d * 0.32);
    // planar facets: cleave a couple of flat faces like split stone
    if (v.x > 0.62) v.x = 0.62 + (v.x - 0.62) * 0.25;
    if (v.z < -0.7) v.z = -0.7 + (v.z + 0.7) * 0.25;
    v.y *= 0.72;
    if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.3; // sits flat on the ground
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal;
  const c = new Float32Array(p.count * 3);
  const stone = new THREE.Color('#b9b0a6'), dark = new THREE.Color('#6f6770'), moss = new THREE.Color('#8fae62'), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const up = n.getY(i);
    col.copy(stone).lerp(dark, THREE.MathUtils.clamp(0.5 - disp[i] * 1.6, 0, 1) * 0.7);
    col.lerp(moss, THREE.MathUtils.clamp((up - 0.55) * 2.2, 0, 1) * 0.75);
    const grain = 0.94 + Math.sin(i * 12.9898) * 0.06;
    c[i * 3] = col.r * grain; c[i * 3 + 1] = col.g * grain; c[i * 3 + 2] = col.b * grain;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function makeBushGeo(lod) {
  const parts = [];
  if (lod) {
    parts.push(blob(0.9, 0, 0.6, 0, '#e6f0dc', 0, 0.8));
  } else {
    [[0, 0.6, 0, 0.8], [0.6, 0.5, 0.2, 0.6], [-0.5, 0.5, -0.2, 0.6], [0.1, 0.5, 0.6, 0.55]].forEach(([x, y, z, r]) => parts.push(blob(r, x, y, z, '#e0ecd6', 1)));
    // blossoms (tinted by instance color, green leaves get tinted slightly too)
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7, rr = 0.55 + (i % 3) * 0.15;
      const s = new THREE.IcosahedronGeometry(0.2, 0);
      s.translate(Math.cos(a) * rr, 0.7 + (i % 3) * 0.2, Math.sin(a) * rr);
      parts.push(colorize(prep(s), '#ffffff'));
    }
  }
  return mergeGeometries(parts);
}

export { TREE_TYPES };
