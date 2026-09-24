import * as THREE from 'three';
import { Terrain } from '../world/terrain.js';
import { CollisionWorld } from '../engine/collision.js';
import { Sky } from '../world/sky.js';
import { Water } from '../world/water.js';
import { buildCastle } from '../world/castle.js';
import { buildStructures } from '../world/structures.js';
import { Vegetation } from '../world/vegetation.js';
import { Humanoid } from '../entities/humanoid.js';
import { Quadruped } from '../entities/quadruped.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 5000);
const t0 = performance.now();
const terrain = new Terrain();
scene.add(terrain.mesh);
const col = new CollisionWorld(terrain);
const t1 = performance.now();
const quality = { shadows: true, shadowSize: 2048, grassRadius: 70, grassDensity: 0.6, flowerDensity: 0.5, treeStep: 7, lodDist: 260 };
const sky = new Sky(scene, renderer, quality);
const water = new Water(scene);
const castle = buildCastle(scene, col);
const t2 = performance.now();
const st = buildStructures(scene, terrain, col);
const t3 = performance.now();
const veg = new Vegetation(scene, terrain, col, quality);
const t4 = performance.now();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new (await import('three/addons/environments/RoomEnvironment.js')).RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
window.__timing = { terrain: t1 - t0, castle: t2 - t1, struct: t3 - t2, veg: t4 - t3, colliders: col.colliders.length };

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'meadow';
const hour = parseFloat(params.get('hour') || '10');
const views = {
  meadow: [[20, 0, 500], [0, 60, -260]],
  castleFar: [[40, 0, -20], [0, 60, -260]],
  gate: [[0, 0, -150], [0, 50, -200]],
  ward: [[10, 0, -220], [0, 50, -300]],
  throne: [[0, 0, -275], [0, 51, -310]],
  spire: [[20, 0, -300], [0, 90, -260]],
  top: [[0, 0, -260], [0, 40, -260]],
  forest: [[-250, 0, 100], [-330, 10, 60]],
  lake: [[250, 0, 140], [420, 30, -60]],
  village: [[230, 0, 380], [260, 5, 330]],
  camp: [[-340, 0, 200], [-400, 5, 180]],
  crag: [[-330, 0, -300], [-400, 60, -380]],
  chars: [[0, 0, 0], [0, 0, 0]],
};
const [eye, target] = views[view];
let ey = eye[1];
if (view === 'top') { camera.position.set(0, 420, -60); camera.lookAt(0, 40, -260); }
else if (view === 'throne') { camera.position.set(0, 52.5, -275); camera.lookAt(0, 51, -310); }
else if (view === 'ward') { camera.position.set(12, 58, -175); camera.lookAt(0, 48, -300); }
else {
  camera.position.set(eye[0], terrain.getHeight(eye[0], eye[2]) + 4 + (view === 'castleFar' ? 30 : 0), eye[2]);
  camera.lookAt(target[0], target[1], target[2]);
}
if (view === 'chars') {
  const g = new THREE.Group();
  const base = new THREE.Vector3(20, terrain.getHeight(20, 470), 470);
  g.position.copy(base);
  scene.add(g);
  const pose = params.get('pose') || '';
  const list = [
    new Humanoid({ armor: 0xf4f6fc, pauldrons: true, cape: 0xf2a6c9, weapon: 'sword', hairStyle: 'short', hair: 0xe8d2a0, tabard: 0xf6f2ff, shield: 0xf4f6fc }),
    new Humanoid({ skirt: 0xd9c3f5, shirt: 0xf8eefc, hairStyle: 'long', hair: 0xf2d68a, crown: true, cape: 0xf6b6d2, puff: true }),
    new Humanoid({ robe: 0x6b7fd6, shirt: 0x5a6ec8, hat: 0x4f63c0, beard: 0xf0f0f0, longBeard: true, hair: 0xf0f0f0, weapon: 'staff', weaponOpts: { glow: 0x9fd0ff } }),
    new Humanoid({ armor: 0x3e3552, pauldrons: true, helmet: 0x3e3552, plume: 0x8a5ad6, cape: 0x3a2a4a, glowEyes: 0xb07bff, weapon: 'greatsword', weaponOpts: { glow: 0x9b6bff }, scale: 1.2 }),
    new Humanoid({ shirt: 0x8a6a4a, pants: 0x5a4a3a, hood: 0x5a6a3a, beard: 0x6a5a4a, weapon: 'bow', quiver: true }),
    new Humanoid({ shirt: 0xb9d6f5, tunic: 0x7a9ad8, pants: 0xf4f0f8, beret: 0x6b5a9a, hairStyle: 'short', hair: 0x2a2a3a, cape: 0x6f8fd8, weapon: 'sword', sash: 0xf0c860 }),
    new Humanoid({ bulk: 1.25, apron: 0x5a4030, shirt: 0xd8b898, beard: 0x9a4a2a, hair: 0x6a3a2a, pants: 0x4a3a3a, weapon: 'hammer' }),
  ];
  list.forEach((h, i) => { h.root.position.set(i * 1.25 - 3.75, 0, 0); h.root.rotation.y = Math.PI + (params.get('turn') ? parseFloat(params.get('turn')) : 0); g.add(h.root); });
  const animals = ['deer', 'wolf', 'rabbit', 'boar', 'unicorn', 'fox'].map((s, i) => { const q = new Quadruped(s); q.root.position.set(i * 2.4 - 6, 0, 4); q.root.rotation.y = Math.PI / 2 + 0.4; g.add(q.root); return q; });
  const cz = parseFloat(params.get('dist') || '6');
  camera.position.set(base.x + parseFloat(params.get('cx') || '0'), base.y + 1.5, base.z - cz);
  camera.lookAt(base.x + parseFloat(params.get('cx') || '0'), base.y + 1.0, base.z + 1);
  let tt = 0;
  for (let k = 0; k < 40; k++) {
    tt += 0.03;
    list.forEach((h, i) => {
      if (pose && k === 0) h.anim.play(pose, 1.0);
      h.update(0.02, { speed: pose === 'walk' ? 4 : pose === 'run' ? 8 : 0, grounded: true, base: i === 0 ? (pose === 'block' ? 'block' : 'guard') : 'relaxed' });
    });
    animals.forEach((a) => a.update(0.03, { speed: pose === 'walk' ? 3 : 0 }));
  }
}
sky.update(0.016, hour, camera, camera.position);
veg.update(camera.position, 1);
water.update(0.016, 1);
renderer.render(scene, camera);
window.__ready = true;
window.__info = renderer.info.render;
