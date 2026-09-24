// Outdoor landmarks: altars of light, Honey Vale village, bandit camp,
// crystal ruins + giant spire, twilight crag arena, hermit hut, meadow arch.
import * as THREE from 'three';
import { Builder, getMaterials } from './builder.js';
import { ALTARS, VILLAGE, CAMP, RUINS, SPIRE, CRAG, HERMIT, WORLD, NO_GRASS } from './layout.js';
import { mulberry32 } from '../engine/noise.js';
import * as PR from './props.js';

const C = (h) => new THREE.Color(h);
const OCTA = new THREE.OctahedronGeometry(1, 0);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 48);
const TORUS = new THREE.TorusGeometry(1, 0.08, 16, 64);
const ARCH = new THREE.TorusGeometry(1, 0.14, 20, 64, Math.PI);

export function buildStructures(scene, terrain, collision) {
  const B = new Builder(collision);
  const H = (x, z) => terrain.getHeight(x, z);
  const out = {
    altars: [], campfires: [], chests: [], lamps: [], animated: [], spawns: {}, gather: [], fogGate: null,
    windmill: null, lights: [], objects: [],
  };
  const rnd = mulberry32(99);

  // ---------------- ALTARS OF LIGHT ----------------
  const altarCrystalMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffd88a, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2 });
  for (const a of ALTARS) {
    const y = H(a.x, a.z);
    B.cyl('stone', a.x, y - 1, a.z, 3.2, 3.4, 1.3, 8, { color: C('#f3eee8') });
    B.cyl('stone', a.x, y + 0.3, a.z, 2.2, 2.4, 0.3, 8, { color: C('#e8e0d6'), collide: false });
    B.cyl('stone', a.x, y + 0.3, a.z, 0.6, 0.8, 1.6, 8, { color: C('#ffffff') });
    B.cyl('gold', a.x, y + 1.9, a.z, 0.9, 0.6, 0.25, 8, { collide: false });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = a.x + Math.sin(ang) * 2.7, pz = a.z + Math.cos(ang) * 2.7;
      B.box('stone', px, y + 0.3, pz, 0.5, 2.6 + (i % 2) * 0.6, 0.5, ang, { color: C('#f7f3ee') });
      B.cone('gold', px, y + 2.9 + (i % 2) * 0.6, pz, 0.38, 0.8, 4);
    }
    // altar detail: carved steps, a fluted pedestal, gold rings, rune stones and a crown of small crystals
    B.cyl('stone', a.x, y - 0.1, a.z, 2.75, 2.85, 0.28, 48, { color: C('#ebe4dc'), collide: false });
    for (let k = 0; k < 12; k++) {
      const fa = (k / 12) * Math.PI * 2;
      B.cyl('stone', a.x + Math.sin(fa) * 0.66, y + 0.35, a.z + Math.cos(fa) * 0.66, 0.08, 0.1, 1.5, 12, { color: C('#f4efe8'), collide: false });
    }
    B.cyl('gold', a.x, y + 0.55, a.z, 0.86, 0.86, 0.08, 48, { collide: false });
    B.cyl('gold', a.x, y + 1.6, a.z, 0.72, 0.72, 0.08, 48, { collide: false });
    for (let k = 0; k < 8; k++) {
      const ra = (k / 8) * Math.PI * 2 + 0.2;
      const rx = a.x + Math.sin(ra) * 2.3, rz = a.z + Math.cos(ra) * 2.3;
      B.box('stone', rx, y + 0.28, rz, 0.34, 0.26, 0.2, ra, { color: C('#e2d8f0'), collide: false });
      B.add('crystal', OCTA, rx, y + 0.6, rz, 0, ra, 0, 0.09, 0.2, 0.09, { worldUV: false, ao: false });
    }
    for (let k = 0; k < 6; k++) {
      const ca = (k / 6) * Math.PI * 2;
      B.add('crystal', OCTA, a.x + Math.sin(ca) * 0.55, y + 2.25, a.z + Math.cos(ca) * 0.55, 0.35 * Math.cos(ca), 0, -0.35 * Math.sin(ca), 0.1, 0.32, 0.1, { worldUV: false, ao: false });
    }
    const crystal = new THREE.Mesh(OCTA, altarCrystalMat);
    crystal.scale.set(0.45, 0.8, 0.45);
    crystal.position.set(a.x, y + 3.2, a.z);
    scene.add(crystal);
    const ring = new THREE.Mesh(TORUS, new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.scale.setScalar(1.1);
    ring.position.copy(crystal.position);
    scene.add(ring);
    out.altars.push({ ...a, pos: new THREE.Vector3(a.x, y + 0.6, a.z), crystal, ring, baseY: y + 3.2 });
  }
  out.animated.push((dt, t) => {
    for (const a of out.altars) {
      a.crystal.rotation.y += dt * 1.2;
      a.crystal.position.y = a.baseY + Math.sin(t * 1.5 + a.x) * 0.2;
      a.ring.position.y = a.crystal.position.y;
      a.ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.3;
      a.ring.rotation.y += dt * 0.6;
    }
  });

  // ---------------- CAMPFIRE helper ----------------
  const campfire = (x, z) => {
    const y = H(x, z);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      B.sphere('stone', x + Math.sin(a) * 0.9, y + 0.1, z + Math.cos(a) * 0.9, 0.28, { color: C('#9e9892'), sy: 0.7 });
    }
    for (let i = 0; i < 3; i++) B.add('wood', CYL, x, y + 0.2, z, Math.PI / 2, i * 1.05, 0, 0.12, 1.4, 0.12, { color: C('#6d4c38') });
    collision.addCylinder(x, z, 0.9, y - 1, y + 0.45, { walkable: false });
    out.campfires.push(new THREE.Vector3(x, y, z));
  };

  // ---------------- HONEY VALE VILLAGE ----------------
  {
    const vx = VILLAGE.x, vz = VILLAGE.z;
    const vy = H(vx, vz);
    const walls = [C('#fff3e3'), C('#fbe6ef'), C('#eef3ff'), C('#fff8d8')];
    const roofs = [C('#e59bb5'), C('#a894d8'), C('#7d97d8'), C('#f0c96a'), C('#8fc9b8')];
    const houses = [[-28, -14, 0.2], [-8, -30, 0.1], [22, -24, -0.3], [34, 4, -1.4], [-30, 18, 0.5], [6, 28, 3.0]];
    houses.forEach(([hx, hz, ry], i) => {
      const x = vx + hx, z = vz + hz;
      hollowCottage(B, collision, x, vy, z, 9, 7, 4.2, ry, walls[i % 4], roofs[i % 5], ['farm', 'family', 'family2', 'miller', 'hunter', 'bees'][i], out, i);
    });
    // well
    B.cyl('stone', vx + 2, vy, vz - 2, 1.3, 1.4, 1.0, 16, { color: C('#e6ddd2') });
    for (const s of [-1, 1]) B.box('wood', vx + 2 + s * 1.1, vy, vz - 2, 0.2, 2.6, 0.2, 0, { color: C('#8a6246') });
    B.gable('roof', vx + 2, vy + 2.6, vz - 2, 3, 1.2, 3, 0, { color: C('#e59bb5') });
    // windmill
    const mx = vx + 44, mz = vz - 24, my = H(mx, mz);
    B.cyl('stone', mx, my - 1, mz, 3.0, 4.2, 13, 12, { color: C('#fff4e4') });
    B.cone('roof', mx, my + 12, mz, 3.8, 4.5, 12, { color: C('#e59bb5') });
    const mill = new THREE.Group();
    mill.position.set(mx + 3.2, my + 10.5, mz + 0.8);
    mill.rotation.y = -0.4;
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf6efe4, roughness: 0.8 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x8a6246, roughness: 0.8 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 20), hubMat);
    hub.rotation.z = Math.PI / 2;
    mill.add(hub);
    const blades = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8.5, 0.2), hubMat);
      arm.position.y = 4.4;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 6.5, 0.06), bladeMat);
      sail.position.set(0.95, 5, 0);
      const holder = new THREE.Group();
      holder.add(arm, sail);
      holder.rotation.x = 0;
      holder.rotation.z = (i / 4) * Math.PI * 2;
      blades.add(holder);
    }
    blades.rotation.y = Math.PI / 2;
    const bladeWrap = new THREE.Group();
    bladeWrap.add(blades);
    bladeWrap.position.x = 0.6;
    mill.add(bladeWrap);
    mill.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(mill);
    out.animated.push((dt) => { blades.rotation.x += dt * 0.6; });
    // fields (rows of golden wheat) + fences
    for (let r = 0; r < 7; r++) {
      const fx = vx - 60, fz = vz + 20 + r * 2.4;
      B.box('plain', fx, H(fx, fz) - 0.1, fz, 24, 0.9, 1.3, 0, { color: C(r % 2 ? '#f2d98a' : '#ead07a'), collide: false });
    }
    for (let i = 0; i < 12; i++) {
      const fx = vx - 73 + i * 2.2, fz = vz + 17;
      B.box('wood', fx, H(fx, fz), fz, 0.15, 1.1, 0.15, 0, { color: C('#b58962') });
      B.box('wood', fx + 1.1, H(fx, fz) + 0.8, fz, 2.2, 0.1, 0.1, 0, { color: C('#b58962'), collide: false });
    }
    // beehives + apple orchard
    for (let i = 0; i < 4; i++) {
      const bx = vx - 12 + i * 2.2, bz = vz + 40;
      const by = H(bx, bz);
      B.box('wood', bx, by, bz, 0.9, 0.3, 0.9, 0, { color: C('#b58962') });
      B.cyl('plain', bx, by + 0.3, bz, 0.35, 0.5, 0.9, 10, { color: C('#f2cf6b') });
      out.gather.push({ kind: 'honey', x: bx, y: by + 1.3, z: bz });
    }
    const appleMat = new THREE.MeshStandardMaterial({ color: 0xe8485a, roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const ax = vx + 18 + (i % 3) * 7, az = vz + 34 + Math.floor(i / 3) * 8;
      const ay = H(ax, az);
      B.cyl('wood', ax, ay - 0.2, az, 0.2, 0.3, 2.4, 6, { color: C('#8b6a52') });
      B.sphere('plain', ax, ay + 3.1, az, 1.7, { color: C('#8ec76b'), sy: 0.8 });
      B.sphere('plain', ax + 0.9, ay + 2.7, az + 0.4, 1.1, { color: C('#9acd6e') });
      out.gather.push({ kind: 'apple', x: ax + 1.3, y: ay + 2.2, z: az + 0.9 });
    }
    // lamps, crates, cart
    for (const [lx, lz] of [[-10, -6], [12, -8], [-4, 14], [18, 12]]) {
      const x = vx + lx, z = vz + lz, y = H(x, z);
      B.cyl('wood', x, y, z, 0.1, 0.12, 3, 6, { color: C('#6d4c38') });
      B.box('lamp', x, y + 3, z, 0.4, 0.5, 0.4, 0, { collide: false });
      out.lamps.push(new THREE.Vector3(x, y + 3.25, z));
    }
    for (let i = 0; i < 5; i++) {
      const x = vx - 6 + (i % 3) * 1.1, z = vz + 8 + Math.floor(i / 3) * 1.1;
      B.box('wood', x, H(x, z), z, 1, 1, 1, i * 0.3, { color: C('#c49a6c') });
    }
    campfire(vx + 10, vz + 4);
    out.spawns.hunter = new THREE.Vector3(vx + 13, vy, vz + 6);
    out.spawns.farmer = new THREE.Vector3(vx - 3, vy, vz + 9);
    out.spawns.villagers = [[vx - 18, vz - 4], [vx + 20, vz - 10], [vx - 6, vz - 16]].map(([x, z]) => new THREE.Vector3(x, H(x, z), z));
  }

  // ---------------- BANDIT CAMP (Black Fox) ----------------
  {
    const cx = CAMP.x, cz = CAMP.z, cy = H(cx, cz);
    const R = 30;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      // opening toward east (a ~ PI/2 is +x)
      if (Math.abs(a - Math.PI / 2) < 0.28) continue;
      const x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R, y = H(x, z);
      const h = 3.4 + rnd() * 1.2;
      B.cyl('wood', x, y - 0.5, z, 0.25, 0.32, h, 6, { color: C('#7a5a42') });
      B.cone('wood', x, y - 0.5 + h, z, 0.28, 0.6, 6, { color: C('#7a5a42') });
    }
    const tents = [[-12, -10, 0.4], [-16, 6, 1.5], [0, -18, -0.2], [10, 14, 2.6], [-2, 16, 3.3]];
    tents.forEach(([tx, tz, ry], i) => {
      const x = cx + tx, z = cz + tz, y = H(x, z);
      B.gable('fabric', x, y, z, 4.6, 3.2, 5.2, ry, { color: C(['#9b5a4a', '#7c6a8a', '#a0764a', '#6a7a5a', '#8a4a5a'][i]) });
      collision.addBox(x, z, 2.2, 2.5, y, y + 3, ry, { walkable: false });
    });
    // leader tent (big)
    {
      const x = cx - 18, z = cz - 4, y = H(x, z);
      B.pyramid('fabric', x, y, z, 8, 6, 8, 0.2, { color: C('#5a3a4a') });
      NO_GRASS.push({ x, z, hx: 3.4, hz: 3.4, ry: 0 });
      // walls of the tent as segments, entrance facing the camp centre (+x)
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.5) continue;
        collision.addBox(x + Math.sin(a) * 3.3, z + Math.cos(a) * 3.3, 0.2, 1.1, y, y + 3, a, { walkable: false });
      }
      B.box('wood', x, y + 4.2, z, 0.2, 0.2, 0.2, 0, { color: C('#7a5a42'), collide: false });
      B.cyl('wood', x, y, z, 0.1, 0.12, 5.6, 6, { color: C('#7a5a42'), collide: false });
      B.col = collision;
      PR.rug(B, x, y + 0.02, z, 0.2, 4.4, 4.4, '#7a3a4a', '#c8a060');
      PR.table(B, x - 1.2, y, z - 0.6, 0.2, 1.8, 1.0, false);
      B.box('plain', x - 1.2, y + 0.92, z - 0.6, 1.4, 0.01, 0.8, 0.3, { color: C('#e8d8b0'), collide: false });
      PR.goldPile(B, x - 1.8, y, z + 1.6, 0.6);
      PR.barrel(B, x - 2.2, y, z - 1.8, 0.8);
      PR.crate(B, x + 0.2, y, z + 2.2, 0.8, 0.4);
      PR.straw(B, x + 0.8, y, z - 1.6, 1.6, 1.2);
      out.objects.push({ t: 'book', id: 'b_banditnote', book: 'banditnote', x: x - 1.0, y: y + 0.93, z: z - 0.4, ry: 0.3, model: 'note' });
      out.objects.push({ t: 'book', id: 'b_gartplan', book: 'gartplan', x: x - 1.5, y: y + 0.93, z: z - 0.8, ry: 0.1, model: 'scroll' });
      out.objects.push({ t: 'pickup', id: 'camp_gold', item: 'gold', gold: 55, x: x - 1.8, y: y + 0.3, z: z + 1.6 });
      out.objects.push({ t: 'container', id: 'camp_crate', name: 'Ящик с добычей', x: x + 0.2, y: y + 0.5, z: z + 2.2, loot: [['wine', 1], ['cheese', 1], ['gold', [10, 25]]], respawn: 3000 });
      out.lights.push({ pos: new THREE.Vector3(x, y + 3, z), color: 0xffa060, intensity: 6, dist: 8 });
      out.spawns.campLeader = new THREE.Vector3(cx - 8, cy, cz - 2);
    }
    // watchtower
    {
      const x = cx + 16, z = cz - 16, y = H(x, z);
      for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) B.box('wood', x + dx, y, z + dz, 0.3, 6, 0.3, 0, { color: C('#7a5a42') });
      B.box('wood', x, y + 6, z, 4, 0.3, 4, 0, { color: C('#8a6a52') });
      B.box('wood', x, y + 6.3, z - 2, 4, 1, 0.15, 0, { color: C('#8a6a52') });
      B.box('wood', x, y + 6.3, z + 2, 4, 1, 0.15, 0, { color: C('#8a6a52') });
      B.box('wood', x - 2, y + 6.3, z, 0.15, 1, 4, 0, { color: C('#8a6a52') });
      B.box('wood', x + 2, y + 6.3, z, 0.15, 1, 4, 0, { color: C('#8a6a52') });
      B.gable('fabric', x, y + 8.5, z, 4.6, 1.6, 4.6, 0, { color: C('#8a4a5a') });
      out.spawns.campArcher = new THREE.Vector3(x, y + 6.3, z);
      // ladder ramp
      collision.addRamp(x, z + 5, 0.6, 3.2, 0, y + 6.3, y);
      for (let k = 0; k < 10; k++) B.box('wood', x, y + k * 0.63, z + 8 - k * 0.64, 1.2, 0.08, 0.2, 0, { color: C('#8a6a52'), collide: false });
    }
    for (let i = 0; i < 10; i++) {
      const x = cx + (rnd() - 0.5) * 36, z = cz + (rnd() - 0.5) * 36;
      if (Math.hypot(x - cx, z - cz) > 24 || Math.hypot(x - cx, z - cz) < 6) continue;
      B.box('wood', x, H(x, z), z, 1.1, 1.1, 1.1, rnd() * 3, { color: C('#a7825c') });
    }
    campfire(cx, cz);
    out.chests.push({ id: 'chest_camp', x: cx - 21, z: cz - 8, ry: 0.9, loot: [['gold', 120], ['bread', 2], ['potion_hp', 1], ['thorn_spear', 1], ['iron_ore', 3]] });
    out.spawns.campBandits = [[4, 6], [-6, 10], [8, -6], [-10, -14], [14, 2], [-4, -6]].map(([x, z]) => new THREE.Vector3(cx + x, H(cx + x, cz + z), cz + z));
  }

  // ---------------- CRYSTAL RUINS + GIANT SPIRE ----------------
  {
    const rx = RUINS.x, rz = RUINS.z, ry = H(rx, rz);
    B.cyl('stone', rx, ry - 1.5, rz, 26, 27, 1.8, 40, { color: C('#eee8f4') });
    B.cyl('cobble', rx, ry + 0.3, rz, 18, 18, 0.05, 40, { color: C('#f3effa'), collide: false });
    // ring of broken columns
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = rx + Math.sin(a) * 22, z = rz + Math.cos(a) * 22;
      const h = i % 3 === 0 ? 9 : 2 + rnd() * 5;
      B.cyl('stone', x, ry + 0.3, z, 0.9, 1.0, h, 12, { color: C('#f6f2fb') });
      if (i % 3 === 0) {
        B.box('stone', x, ry + 0.3 + h, z, 2.4, 0.6, 2.4, a, { color: C('#e9e2f2') });
      } else if (rnd() < 0.6) {
        B.add('stone', CYL, x + Math.cos(a) * 3, ry + 0.9, z - Math.sin(a) * 3, Math.PI / 2, a + rnd(), 0, 0.9, 4, 0.9, { color: C('#ece5f4') });
      }
    }
    // arch gate facing the road (north-ish +z) — two pillars + lintel
    for (const s of [-1, 1]) B.box('stone', rx + s * 4, ry + 0.3, rz + 26, 1.6, 9, 1.6, 0, { color: C('#f6f2fb') });
    B.box('stone', rx, ry + 9.3, rz + 26, 10, 1.4, 1.8, 0, { color: C('#e9e2f2') });
    // central dais
    B.cyl('stone', rx, ry + 0.3, rz, 6, 6.5, 0.6, 24, { color: C('#e6def0') });
    // crystal clusters
    const cluster = (x, z, s, pink) => {
      const y = H(x, z);
      const n = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const h = s * (1 + rnd() * 2.5);
        B.add(pink ? 'crystalPink' : 'crystal', OCTA, x + (rnd() - 0.5) * s, y + h * 0.5, z + (rnd() - 0.5) * s, (rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7, s * 0.4, h, s * 0.4, { worldUV: false });
      }
      collision.addCylinder(x, z, s * 0.7, y - 1, y + s * 2);
    };
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, d = 28 + rnd() * 40;
      const x = rx + Math.sin(a) * d, z = rz + Math.cos(a) * d;
      if (H(x, z) < WORLD.water - 2) continue;
      cluster(x, z, 0.8 + rnd() * 1.6, rnd() < 0.35);
    }
    out.spawns.golem = new THREE.Vector3(rx, ry + 0.9, rz);
    out.spawns.ruinKnights = [[14, 10], [-12, 16], [18, -10], [-16, -12]].map(([x, z]) => new THREE.Vector3(rx + x, ry + 0.35, rz + z));
    // lore tablets
    [['guardian', -9, 6], ['tablet_first', 10, 8], ['tablet_lake', 0, -16]].forEach(([bk, dx, dz], i) => {
      const x = rx + dx, z = rz + dz, y = H(x, z);
      B.box('stone', x, y - 0.3, z, 1.4, 1.6, 0.35, Math.atan2(rx - x, rz - z), { color: C('#e8e2f2') });
      B.add('crystal', BOX, x, y + 1.35, z, 0, Math.atan2(rx - x, rz - z), 0, 1.1, 0.06, 0.4, {});
      out.objects.push({ t: 'book', id: 'b_' + bk, book: bk, x, y: y + 1.35, z, ry: 0, model: 'note' });
    });
    // puzzle: light the three pylons in the order of the tablets' song (moon, lake, dawn)
    {
      const pyl = [['moon', 14, -6, 0x9fd0ff], ['lake', -14, -6, 0x9fffe0], ['dawn', 0, 14, 0xffd88a]];
      const state = { seq: [] };
      out.ruinsPuzzle = state;
      pyl.forEach(([id, dx, dz, col]) => {
        const x = rx + dx, z = rz + dz, y = H(x, z);
        B.cyl('stone', x, y - 0.5, z, 0.7, 0.9, 2.2, 8, { color: C('#e8e2f2') });
        const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.1, transparent: true, opacity: 0.9 });
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mat);
        m.scale.set(0.7, 1.4, 0.7);
        m.position.set(x, y + 2.4, z);
        scene.add(m);
        out.objects.push({ t: 'custom', make: (g) => ({
          kind: 'pylon', pos: new THREE.Vector3(x, y, z), r: 2.2,
          active: () => !g.state.flags.ruins_solved,
          label: () => 'Коснуться кристалла',
          use: () => {
            state.seq.push(id);
            mat.emissiveIntensity = 2;
            g.audio.play('altar', 0.6);
            const want = ['moon', 'lake', 'dawn'];
            if (state.seq.some((v, i) => v !== want[i])) {
              state.seq = [];
              g.ui.hint('Кристаллы гаснут. Порядок неверен.');
              setTimeout(() => { for (const o of out.pylonMats) o.emissiveIntensity = 0.1; }, 600);
            } else if (state.seq.length === 3) {
              g.state.flags.ruins_solved = true;
              g.ui.bigText('Тайна руин', 'Подземный зал открыт', 'victory');
              g.addGlimmer(150);
              g.audio.play('levelup');
            }
          },
          update: (dt, t) => { m.rotation.y += dt; if (g.state.flags.ruins_solved) mat.emissiveIntensity = 1.5 + Math.sin(t * 2) * 0.3; },
        }) });
        (out.pylonMats = out.pylonMats || []).push(mat);
      });
      const hx = rx + 18, hz = rz + 16, hy = H(hx, hz);
      out.objects.push({ t: 'container', id: 'ruins_vault', name: 'Хрустальный реликварий', x: hx, y: hy + 0.5, z: hz, r: 2.4, model: 'stash', respawn: 1e9,
        loot: [['gold', [200, 260]], ['light_crystal', 2], ['elixir_light', 1], ['gem', 1]],
        cond: (g) => !!g.state.flags.ruins_solved });
    }
    out.chests.push({ id: 'chest_ruins', x: rx - 4, z: rz - 14, ry: 0, loot: [['gold', 180], ['light_crystal', 2], ['potion_hp', 2], ['moon_amulet', 1], ['elven_bow', 1], ['arrow', 20]] });
    // crystal nodes to mine
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3, d = 34 + (i % 2) * 8;
      const x = rx + Math.sin(a) * d, z = rz + Math.cos(a) * d;
      if (H(x, z) < WORLD.water) continue;
      out.gather.push({ kind: 'crystal', x, y: H(x, z), z });
    }
    // giant spire in the lake (landmark visible from everywhere)
    const sx = SPIRE.x, sz = SPIRE.z, sy = H(sx, sz);
    B.add('crystal', OCTA, sx, sy + 70, sz, 0, 0.3, 0, 7, 95, 7, { worldUV: false });
    B.add('crystal', OCTA, sx + 8, sy + 30, sz + 4, 0.15, 0.8, -0.2, 4, 42, 4, { worldUV: false });
    B.add('crystalPink', OCTA, sx - 7, sy + 24, sz - 3, -0.2, 0.2, 0.25, 3.5, 34, 3.5, { worldUV: false });
    B.add('crystal', OCTA, sx - 2, sy + 18, sz + 9, 0.3, 1.1, 0.1, 3, 26, 3, { worldUV: false });
    B.add('crystalPink', OCTA, sx + 5, sy + 14, sz - 8, -0.3, 0.4, -0.1, 2.5, 20, 2.5, { worldUV: false });
    collision.addCylinder(sx, sz, 9, sy - 5, sy + 150);
    out.spawns.spireTop = new THREE.Vector3(sx, sy + 150, sz);
    // floating crystals drifting above the lake shore
    const fMat = getMaterials().crystal, fPink = getMaterials().crystalPink;
    const floaters = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 26 + (i % 3) * 9;
      const m = new THREE.Mesh(OCTA, i % 3 === 0 ? fPink : fMat);
      const s = 0.8 + (i % 4) * 0.5;
      m.scale.set(s * 0.5, s * 1.6, s * 0.5);
      const base = new THREE.Vector3(sx + Math.cos(a) * r, WORLD.water + 6 + (i % 4) * 4, sz + Math.sin(a) * r);
      m.position.copy(base);
      m.userData = { base, ph: i * 1.3 };
      scene.add(m);
      floaters.push(m);
    }
    out.floaters = floaters;
    out.animated.push((dt, t) => {
      for (const m of floaters) {
        m.position.y = m.userData.base.y + Math.sin(t * 0.7 + m.userData.ph) * 1.2;
        m.rotation.y += dt * 0.35;
      }
    });
  }

  // ---------------- TWILIGHT CRAG ARENA ----------------
  {
    const ax = CRAG.x, az = CRAG.z, ay = CRAG.y;
    B.cyl('darkStone', ax, ay - 1.2, az, 30, 31, 1.5, 40, {});
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const x = ax + Math.sin(a) * 28, z = az + Math.cos(a) * 28;
      // entrance gap facing the road (south-east: road comes from +x,+z)
      if (Math.abs(angDiff(a, Math.atan2(1, 1))) < 0.35) continue;
      const h = 4 + rnd() * 9;
      B.box('darkStone', x, ay, z, 2, h, 2, a, {});
      if (rnd() < 0.5) B.add('darkCrystal', OCTA, x, ay + h + 1.5, z, rnd() * 0.5, rnd() * 3, 0, 0.8, 2.4, 0.8, { worldUV: false });
    }
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, d = 34 + rnd() * 30;
      const x = ax + Math.sin(a) * d, z = az + Math.cos(a) * d;
      const y = H(x, z);
      const h = 2 + rnd() * 5;
      B.add('darkCrystal', OCTA, x, y + h * 0.4, z, (rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6, h * 0.25, h, h * 0.25, { worldUV: false });
      collision.addCylinder(x, z, h * 0.2, y - 1, y + h);
    }
    // throne of gloom
    B.box('darkStone', ax, ay, az - 22, 5, 1, 4, 0, {});
    B.box('darkStone', ax, ay + 1, az - 23.5, 4, 6, 1, 0, {});
    out.spawns.boss = new THREE.Vector3(ax, ay, az - 12);
    out.spawns.cragWisps = [[20, 40], [-10, 50], [30, 20]].map(([x, z]) => new THREE.Vector3(ax + x, H(ax + x, az + z) + 2.5, az + z));
    out.spawns.cragKnights = [[36, 36], [44, 22]].map(([x, z]) => new THREE.Vector3(ax + x, H(ax + x, az + z), az + z));
    // fog gate
    const gateA = Math.atan2(1, 1);
    const gx = ax + Math.sin(gateA) * 28, gz = az + Math.cos(gateA) * 28;
    const fogMat = new THREE.MeshBasicMaterial({ color: 0xb58cff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(10, 9, 1, 1), fogMat);
    fog.position.set(gx, ay + 4.5, gz);
    fog.rotation.y = gateA;
    scene.add(fog);
    out.fogGate = { mesh: fog, mat: fogMat, x: gx, z: gz, y: ay, angle: gateA, active: false, collider: null };
    out.chests.push({ id: 'chest_crag', x: ax + 6, z: az - 24, ry: 0, loot: [['gold', 300], ['dawn_armor', 1]] });
  }

  // ---------------- HERMIT HUT ----------------
  {
    const x = HERMIT.x, z = HERMIT.z, y = H(x, z);
    B.cyl('wood', x, y, z, 3.4, 3.6, 3.2, 10, { color: C('#c9a57f') });
    B.cone('roof', x, y + 3.2, z, 4.4, 3.4, 10, { color: C('#d8c07a') });
    B.box('wood', x, y, z + 3.45, 1.4, 2.4, 0.2, 0, { color: C('#7a5a42'), collide: false });
    campfire(x + 5, z + 5);
    out.spawns.hermit = new THREE.Vector3(x + 3.5, y, z + 6.5);
    for (let i = 0; i < 5; i++) out.gather.push({ kind: 'herb', x: x - 6 + i * 1.6, y: H(x - 6 + i * 1.6, z + 6), z: z + 6 });
  }

  // ---------------- MEADOW ARCH (ancient gate framing the castle) ----------------
  {
    const x = 6, z = 452, y = H(x, z);
    for (const s of [-1, 1]) {
      B.box('stone', x + s * 5, y - 0.5, z, 1.4, 9, 1.4, 0, { color: C('#f7f3ee') });
      B.cone('gold', x + s * 5, y + 8.5, z, 0.6, 1.4, 4);
    }
    B.add('stone', ARCH, x, y + 8.5, z, 0, 0, 0, 5, 5, 5, { color: C('#f3eee8') });
    B.add('crystal', OCTA, x, y + 14.6, z, 0, 0, 0, 0.5, 1.0, 0.5, { worldUV: false });
    out.spawns.pilgrim = new THREE.Vector3(26, H(26, 478), 478);
  }

  // ---------------- scattered world gatherables & chests ----------------
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, d = 60 + rnd() * 520;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const y = H(x, z);
    if (y < WORLD.water + 1 || y > 80) continue;
    if (Math.hypot(x - 0, z + 260) < 130) continue;
    const kind = rnd() < 0.55 ? 'herb' : 'mushroom';
    out.gather.push({ kind, x, y, z });
  }
  // iron ore veins on the higher slopes
  for (let i = 0, placed = 0; i < 400 && placed < 22; i++) {
    const a = rnd() * Math.PI * 2, d = 300 + rnd() * 330;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const y = H(x, z);
    if (y < 22 || y > 95 || Math.hypot(x, z + 260) < 150) continue;
    out.gather.push({ kind: 'ore', x, y, z });
    placed++;
  }
  // raspberry & blueberry bushes in the Whispering Forest and along its edges
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, d = 30 + rnd() * 230;
    const x = -330 + Math.cos(a) * d, z = 60 + Math.sin(a) * d;
    const y = H(x, z);
    if (y < WORLD.water + 1 || y > 70) continue;
    out.gather.push({ kind: rnd() < 0.5 ? 'raspberry' : 'blueberry', x, y, z });
  }
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = 120 + rnd() * 380;
    const x = Math.cos(a) * d, z = 200 + Math.sin(a) * d * 0.6;
    const y = H(x, z);
    if (y < WORLD.water + 1 || y > 60) continue;
    out.gather.push({ kind: rnd() < 0.5 ? 'raspberry' : 'blueberry', x, y, z });
  }
  // moonflowers along the lake shore
  for (let i = 0; i < 24; i++) {
    const a = rnd() * Math.PI * 2;
    const x = 300 + Math.cos(a) * 160 * 1.12, z = -40 + Math.sin(a) * 130 * 1.12;
    const y = H(x, z);
    if (y < WORLD.water + 0.3) continue;
    out.gather.push({ kind: 'moonflower', x, y, z });
  }
  out.chests.push({ id: 'chest_forest', x: -300, z: 40, ry: 0.4, loot: [['gold', 60], ['potion_stamina', 1], ['cheese', 2], ['iron_ore', 2], ['arrow', 12]] });
  out.chests.push({ id: 'chest_meadow', x: -90, z: 460, ry: 1.2, loot: [['gold', 40], ['apple', 3], ['potion_hp', 1]] });
  out.chests.push({ id: 'chest_hill', x: 180, z: -120, ry: 0.2, loot: [['gold', 80], ['light_crystal', 1], ['steel_armor', 1], ['iron_ore', 4]] });

  const group = B.build();
  scene.add(group);
  out.group = group;
  return out;
}

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function cottage(B, collision, x, y, z, w, d, h, ry, wallC, roofC, rnd) {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  B.box('plain', x, y - 1, z, w, h + 1, d, ry, { color: wallC });
  // timber frame
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    B.box('wood', x + lx * cos + lz * sin, y, z - lx * sin + lz * cos, 0.4, h, 0.4, ry, { color: C('#9a7050'), collide: false });
  }
  B.box('wood', x, y + h - 0.3, z, w + 0.3, 0.3, d + 0.3, ry, { color: C('#9a7050'), collide: false });
  B.gable('roof', x, y + h, z, d + 1.4, 3.2, w + 1.2, ry + Math.PI / 2, { color: roofC });
  // door + windows (front = local +z)
  const fx = x + (d / 2 + 0.03) * sin, fz = z + (d / 2 + 0.03) * cos;
  B.box('wood', fx, y, fz, 1.3, 2.3, 0.1, ry, { color: C('#8a5c3b'), collide: false });
  for (const s of [-1, 1]) {
    B.box('window', fx + s * 2.4 * cos, y + 1.4, fz - s * 2.4 * sin, 1.1, 1.0, 0.1, ry, { collide: false });
  }
  // flower box under windows
  for (const s of [-1, 1]) {
    const bx = x + (d / 2 + 0.3) * sin + s * 2.4 * cos, bz = z + (d / 2 + 0.3) * cos - s * 2.4 * sin;
    B.box('wood', bx, y + 0.8, bz, 1.2, 0.3, 0.35, ry, { color: C('#9a7050'), collide: false });
    for (let i = 0; i < 4; i++) B.sphere('plain', bx + (i - 1.5) * 0.28 * cos, y + 1.2, bz - (i - 1.5) * 0.28 * sin, 0.13, { color: C(['#f7a8c8', '#fff3b0', '#c7a6f0', '#ffffff'][i]) });
  }
}

// Enterable village cottage: walls with a door, floor, ceiling, furniture by role.
function hollowCottage(B, col, x, y, z, w, d, h, ry, wallC, roofC, role, out, idx) {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  NO_GRASS.push({ x, z, hx: w / 2 + 0.2, hz: d / 2 + 0.2, ry });
  const L = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
  const t = 0.35;
  const wall = (lx, lz, len, alongX, y0 = 0, hh = h) => { const [wx, wz] = L(lx, lz); B.box('plain', wx, y + y0 - (y0 ? 0 : 1), wz, t, hh + (y0 ? 0 : 1), len, alongX ? ry + Math.PI / 2 : ry, { color: wallC }); };
  wall(0, -d / 2, w + t, true);
  wall(-w / 2, 0, d, false);
  wall(w / 2, 0, d, false);
  // front with a door gap (1.4 wide) at centre
  wall(-(w / 4 + 0.35), d / 2, w / 2 - 0.7 + t, true);
  wall(w / 4 + 0.35, d / 2, w / 2 - 0.7 + t, true);
  { const [wx, wz] = L(0, d / 2); B.box('plain', wx, y + 2.4, wz, t, h - 2.4, 1.4, ry + Math.PI / 2, { color: wallC }); }
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { const [px, pz] = L(lx, lz); B.box('wood', px, y, pz, 0.45, h, 0.45, ry, { color: C('#9a7050'), collide: false }); }
  { const [cx, cz] = L(0, 0); B.box('wood', cx, y + h - 0.3, cz, w + 0.4, 0.3, d + 0.4, ry, { color: C('#9a7050'), collide: false }); }
  // cottage detail: fieldstone plinth, half-timber diagonals, shutters, a chimney and climbing roses by the door
  { const [cx, cz] = L(0, 0); B.box('stone', cx, y - 0.3, cz, w + 0.3, 0.75, d + 0.3, ry, { color: C('#c9bfb2'), collide: false }); }
  for (const s2 of [-1, 1]) {
    for (const [lx, lz, along] of [[s2 * w / 4, -d / 2 - t / 2 - 0.04, true], [-w / 2 - t / 2 - 0.04, s2 * d / 4, false], [w / 2 + t / 2 + 0.04, s2 * d / 4, false]]) {
      const [px, pz] = L(lx, lz);
      const span = along ? w / 2 : d / 2;
      B.add('wood', BOX, px, y + h * 0.5, pz, 0, along ? ry : ry + Math.PI / 2, Math.atan2(h * 0.8, span) * s2, span * 1.05, 0.22, 0.12, { color: C('#8a6048'), collide: false });
    }
    for (const sh of [-1, 1]) { const [sx2, sz2] = L(s2 * 2.4 + sh * 0.72, d / 2 + 0.22); B.box('wood', sx2, y + 0.9, sz2, 0.36, 1.05, 0.06, ry, { color: C(['#6f8fd8', '#d86f8f', '#7aa878'][idx % 3]), collide: false }); }
  }
  { const [chx, chz] = L(w * 0.28, -d * 0.18); B.box('stone', chx, y + h, chz, 0.9, 3.9, 0.9, ry, { color: C('#c8b8aa'), collide: false }); B.box('stone', chx, y + h + 3.9, chz, 1.15, 0.2, 1.15, ry, { color: C('#b0a090'), collide: false }); }
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2) / 7;
    const [rx2, rz2] = L(side * (0.95 + Math.sin(i) * 0.12), d / 2 + 0.3);
    B.sphere('plain', rx2, y + 0.3 + k * 2.3, rz2, 0.16 + (i % 3) * 0.04, { color: C(i % 3 ? '#5f8e48' : ['#f7a8c8', '#ffffff', '#ff8fb0'][i % 3]) });
  }
  B.gable('roof', x, y + h, z, d + 1.4, 3.2, w + 1.2, ry + Math.PI / 2, { color: roofC });
  B.box('wood', x, y + 0.01, z, w - 0.3, 0.06, d - 0.3, ry, { color: C('#c8a47a'), collide: false });
  B.box('wood', x, y + h - 0.12, z, w - 0.3, 0.1, d - 0.3, ry, { color: C('#b8906a'), collide: false });
  col.addBox(x, z, w / 2, d / 2, y + h - 0.1, y + h + 0.2, ry, { walkable: true });
  // windows (both faces) + flower boxes
  for (const s2 of [-1, 1]) {
    const [wx, wz] = L(s2 * 2.4, d / 2 + 0.2);
    B.box('window', wx, y + 1.4, wz, 1.1, 1.0, 0.08, ry, { collide: false });
    const [bx, bz] = L(s2 * 2.4, d / 2 + 0.45);
    B.box('wood', bx, y + 0.8, bz, 1.2, 0.3, 0.35, ry, { color: C('#9a7050'), collide: false });
    for (let i = 0; i < 4; i++) { const [fx, fz] = L(s2 * 2.4 + (i - 1.5) * 0.28, d / 2 + 0.45); B.sphere('plain', fx, y + 1.2, fz, 0.13, { color: C(['#f7a8c8', '#fff3b0', '#c7a6f0', '#ffffff'][i]) }); }
  }
  const [dx, dz] = L(0, d / 2);
  out.objects.push({ t: 'door', id: 'vdoor' + idx, x: dx, y, z: dz, ry: ry + Math.PI / 2, w: 1.35, h: 2.35, color: '#8a5c3b', name: { farm: 'Дом Марты', miller: 'Дом мельника', hunter: 'Сторожка охотника', bees: 'Дом пасечницы' }[role] || 'Дом селян' });
  // furniture
  B.col = col;
  const P = (lx, lz) => L(lx, lz);
  const face = (a) => ry + a;
  let [hx, hz] = P(-w / 2 + 0.55, -1);
  PR.fireplace(B, hx, y, hz, face(Math.PI / 2), 2.0, out.lamps, null, { hood: 1.3, decor: true });
  out.lights.push({ pos: new THREE.Vector3(...P(-w / 2 + 1.4, -1).slice(0, 1), y + 1.2, P(-w / 2 + 1.4, -1)[1]), color: 0xff9a4a, intensity: 6, dist: 8, flicker: 0.12 });
  (out.fires = out.fires || []).push(new THREE.Vector3(hx + Math.sin(face(Math.PI / 2)) * 0.1, y + 0.3, hz + Math.cos(face(Math.PI / 2)) * 0.1));
  let [tx, tz] = P(1.0, 0.3);
  PR.table(B, tx, y, tz, ry, 1.6, 1.0, true);
  for (const s2 of [-1, 1]) { const [cx2, cz2] = P(1.0, 0.3 + s2 * 0.85); out.objects.push(PR.chair(B, cx2, y, cz2, face(s2 > 0 ? Math.PI : 0), {})); }
  let [bx, bz] = P(w / 2 - 0.9, -1.8);
  const bedC = { farm: '#f2d98a', family: '#ffc6dc', family2: '#9fd0f2', miller: '#e8e0d0', hunter: '#8a6a4a', bees: '#f7d65a' }[role];
  PR.bed(B, bx, y, bz, face(0), { w: 1.3, len: 2.1, blanket: bedC });
  out.objects.push({ t: 'bed', x: bx, y, z: bz, owner: 'хозяев' });
  let [wx2, wz2] = P(1.4, -d / 2 + 0.45);
  PR.wardrobe(B, wx2, y, wz2, face(0), 1.3, 2.0, '#9a6a44');
  out.objects.push({ t: 'container', id: 'vward' + idx, name: 'Сундук селян', x: wx2, y: y + 1, z: wz2, loot: [['bread', 1, 0.6], ['gold', [2, 10]], ['apple', 1, 0.5], ['honey', 1, 0.2]], owner: 'village', respawn: 2400 });
  const [rx2, rz2] = P(0.3, 0.3);
  PR.rug(B, rx2, y, rz2, ry, 2.8, 2.2, ['#e89ac0', '#9fb8e8', '#c7a6f0', '#f2d98a', '#a8c890', '#f7c0a0'][idx % 6], '#fff0c8');
  out.lights.push({ pos: new THREE.Vector3(tx, y + 2.9, tz), color: 0xffc880, intensity: 3, dist: 6 });
  const cx0 = P(-1.5, 2.3);
  if (role === 'farm') {
    PR.bottleShelf(B, ...P(-2.5, -d / 2 + 0.3).slice(0, 1), y, P(-2.5, -d / 2 + 0.3)[1], face(Math.PI / 2), 2.0, false);
    out.objects.push({ t: 'pickup', id: 'v_cheese', item: 'cheese', x: tx + 0.2, y: y + 0.93, z: tz, owner: 'Марта' });
    out.objects.push({ t: 'book', id: 'b_marta', book: 'marta', x: tx - 0.3, y: y + 0.93, z: tz - 0.1, ry, model: 'book', color: '#8a6a3a' });
    PR.sack(B, cx0[0], y, cx0[1], 1); PR.sack(B, cx0[0] + 0.5, y, cx0[1] + 0.3, 0.9);
  } else if (role === 'miller') {
    for (let i = 0; i < 4; i++) PR.sack(B, cx0[0] + (i % 2) * 0.55, y, cx0[1] - Math.floor(i / 2) * 0.55, 1);
    B.add('stone', CYL, ...P(-2.8, 1.8).slice(0, 1), y + 0.2, P(-2.8, 1.8)[1], 0, 0, 0, 0.7, 0.3, 0.7, { color: C('#c8c0b8') });
    out.objects.push({ t: 'book', id: 'b_mill', book: 'mill', x: tx - 0.3, y: y + 0.93, z: tz, ry, model: 'book', color: '#6a5a4a' });
  } else if (role === 'hunter') {
    const [ax, az] = P(0, -d / 2 + 0.25);
    for (const s2 of [-0.5, 0.5]) { const [px2, pz2] = P(s2, -d / 2 + 0.3); B.add('plain', CYL, px2, y + 2.6, pz2, 0.3, ry, s2 * 1.4, 0.03, 0.8, 0.03, { color: C('#f2e3c6') }); }
    B.sphere('plain', ax, y + 2.3, az, 0.2, { color: C('#b58962') });
    B.box('fabric', ...P(-1.5, -d / 2 + 0.22).slice(0, 1), y + 1.2, P(-1.5, -d / 2 + 0.22)[1], 1.2, 1.0, 0.05, ry, { color: C('#9a8a78'), collide: false });
    out.objects.push({ t: 'book', id: 'b_hunt', book: 'hunting', x: tx - 0.3, y: y + 0.93, z: tz, ry, model: 'book', color: '#5a6a3a' });
  } else if (role === 'bees') {
    PR.bottleShelf(B, ...P(-2.5, -d / 2 + 0.3).slice(0, 1), y, P(-2.5, -d / 2 + 0.3)[1], face(Math.PI / 2), 2.0, false);
    out.objects.push({ t: 'pickup', id: 'v_honey', item: 'honey', x: tx + 0.25, y: y + 0.93, z: tz, owner: 'Грета' });
    for (let i = 0; i < 3; i++) B.box('wood', cx0[0] + i * 0.4, y, cx0[1], 0.35, 0.5, 0.35, ry, { color: C('#f2cf6b'), collide: false });
  } else {
    // family: cradle + toys
    B.box('wood', cx0[0], y, cx0[1], 0.9, 0.5, 0.6, ry, { color: C('#b58962') });
    B.box('fabric', cx0[0], y + 0.5, cx0[1], 0.8, 0.08, 0.5, ry, { color: C('#fff0f6'), collide: false });
  }
}
