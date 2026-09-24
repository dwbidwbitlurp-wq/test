// Enemies: wolves, boars, bandits, archers, twilight knights, wisps,
// and bosses (Gart, Crystal Guardian, Morgrim).
import * as THREE from 'three';
import { Humanoid } from './humanoid.js';
import { Quadruped } from './quadruped.js';
import { RigBuilder, PRIM, taper, lathe } from './rig.js';
import { Motor } from '../engine/collision.js';
import { clamp, angleLerp, angleDiff, damp } from '../engine/noise.js';
import { WORLD } from '../world/layout.js';
import { EFFECT_NAMES } from '../game/perks.js';

const _sp = new THREE.Vector3();

const A = (clip, dur, active, mult, range, arc, lunge, extra = {}) => ({ clip, dur, active, mult, range, arc, lunge, ...extra });

export const ENEMY_TYPES = {
  wolf: {
    name: 'Волк', kinds: ['wolf'], body: 'quad', species: 'wolf', hp: 46, dmg: 10, walk: 2.5, run: 8.2, sight: 22, radius: 0.55, height: 0.9,
    xp: 16, gold: [0, 0], loot: [['wolf_pelt', 0.55, 1], ['wolf_fang', 0.35, 1], ['raw_meat', 0.5, 1]], poise: 10, aggro: true, pack: true,
    attacks: [A('bite', 0.85, [0.38, 0.56], 1, 1.7, 0.9, 5.5)], cooldown: [0.9, 2.0], strafe: 0.45, keep: 3.8,
  },
  darkwolf: {
    name: 'Сумрачный волк', kinds: ['wolf'], body: 'quad', species: 'darkwolf', hp: 78, dmg: 15, walk: 2.8, run: 9, sight: 26, radius: 0.6, height: 1.0,
    xp: 32, gold: [0, 0], loot: [['wolf_pelt', 0.6, 1], ['shadow_essence', 0.3, 1], ['raw_meat', 0.5, 1]], poise: 16, aggro: true, pack: true, gloom: true,
    attacks: [A('bite', 0.8, [0.36, 0.55], 1, 1.8, 0.9, 6)], cooldown: [0.8, 1.7], strafe: 0.5, keep: 4,
  },
  boar: {
    name: 'Вепрь', kinds: ['boar'], body: 'quad', species: 'boar', hp: 70, dmg: 14, walk: 1.8, run: 9.5, sight: 14, radius: 0.6, height: 0.9,
    xp: 20, gold: [0, 0], loot: [['raw_meat', 0.9, 2], ['boar_tusk', 0.5, 1]], poise: 24, aggro: false, neutral: true,
    attacks: [A('bite', 1.3, [0.2, 0.75], 1, 1.8, 0.8, 11, { charge: true, knock: 5 })], cooldown: [1.4, 2.6], strafe: 0.2, keep: 7,
  },
  // city guard turned hostile after witnessing a crime (never counted in the bestiary, drops nothing)
  guard: {
    name: 'Стражник Люменхолда', kinds: ['guard'], body: 'human', hp: 140, dmg: 16, walk: 2.2, run: 6.2, sight: 34, radius: 0.45, height: 1.8, noBestiary: true, lawful: true,
    look: { armor: 0xf4f6fc, pauldrons: true, helmet: 0xf4f6fc, plume: 0xf2a6c9, cape: 0x9fb8e8, shirt: 0xdfe6f5, pants: 0x6b5a9a, boots: 0x6a5a7a, weapon: 'sword', shield: 0xf4f6fc },
    xp: 0, gold: [0, 0], loot: [], poise: 40, aggro: true,
    attacks: [A('slash1', 1.0, [0.46, 0.62], 1, 2.4, 1.0, 2), A('slash3', 1.25, [0.52, 0.66], 1.35, 2.5, 0.7, 2.4), A('thrust', 0.95, [0.48, 0.64], 1.1, 2.7, 0.6, 3.5)],
    cooldown: [0.8, 1.8], strafe: 0.5, keep: 3.2, block: 0.35, parryable: true,
  },
  bandit: {
    name: 'Разбойник Чёрной Лисы', kinds: ['bandit'], body: 'human', hp: 78, dmg: 13, walk: 2, run: 5.8, sight: 20, radius: 0.45, height: 1.8,
    look: { shirt: 0x6a4a44, pants: 0x3e3440, hood: 0x2a2430, boots: 0x3a2e2a, weapon: 'sword', weaponOpts: { bladeColor: 0xbfc4cc } },
    xp: 30, gold: [5, 16], loot: [['bread', 0.3, 1], ['bandit_mask', 0.3, 1], ['potion_hp', 0.07, 1], ['cheese', 0.15, 1]], poise: 18, aggro: true,
    attacks: [A('slash1', 1.0, [0.46, 0.62], 1, 2.4, 1.0, 2), A('slash3', 1.25, [0.52, 0.66], 1.35, 2.5, 0.7, 2.4), A('thrust', 0.95, [0.48, 0.64], 1.1, 2.7, 0.6, 3.5)],
    cooldown: [0.9, 2.2], strafe: 0.5, keep: 3.4, block: 0.18, parryable: true,
  },
  archer: {
    name: 'Лучник Чёрной Лисы', kinds: ['bandit'], body: 'human', hp: 55, dmg: 12, walk: 2, run: 5.5, sight: 30, radius: 0.45, height: 1.8,
    look: { shirt: 0x5a5a3a, pants: 0x3e3440, hood: 0x3a4a2a, weapon: 'bow' },
    xp: 28, gold: [4, 12], loot: [['bread', 0.3, 1], ['bandit_mask', 0.2, 1]], poise: 12, aggro: true, ranged: { speed: 30, color: '#e8e0c8', every: [2.2, 3.5], range: 28, keep: 12, clip: 'shoot', size: 0.12, arrow: true },
    attacks: [A('slash1', 1.0, [0.46, 0.62], 0.8, 2.2, 1.0, 1.5)], cooldown: [1.2, 2.2], strafe: 0.3, keep: 12, parryable: true,
  },
  knight: {
    name: 'Сумеречный рыцарь', kinds: ['knight'], body: 'human', hp: 160, dmg: 20, walk: 2, run: 5.2, sight: 22, radius: 0.5, height: 1.9,
    look: { armor: 0x3e3552, pauldrons: true, helmet: 0x3e3552, plume: 0x8a5ad6, cape: 0x3a2a4a, shirt: 0x2a2436, pants: 0x2a2436, boots: 0x201a28, glowEyes: 0xb07bff, weapon: 'sword', weaponOpts: { glow: 0x9b6bff }, shield: 0x3e3552, scale: 1.08 },
    xp: 75, gold: [15, 35], loot: [['shadow_essence', 0.6, 1], ['potion_hp', 0.15, 1]], poise: 40, aggro: true, gloom: true,
    attacks: [A('slash1', 1.05, [0.46, 0.62], 1, 2.6, 1.0, 2.2), A('slash2', 1.0, [0.46, 0.62], 1, 2.6, 1.0, 2.2), A('thrust', 1.1, [0.5, 0.64], 1.25, 3.0, 0.6, 4), A('heavy', 1.6, [0.56, 0.7], 1.7, 2.9, 0.8, 3, { knock: 4 })],
    combos: [['slash1', 'slash2'], ['thrust'], ['heavy'], ['slash1', 'slash2', 'heavy']],
    cooldown: [0.8, 1.8], strafe: 0.55, keep: 3.8, block: 0.4, parryable: true,
  },
  wisp: {
    name: 'Тень', kinds: ['wisp'], body: 'wisp', hp: 42, dmg: 14, walk: 2, run: 4.5, sight: 26, radius: 0.5, height: 1.2, fly: 2.4,
    xp: 34, gold: [0, 0], loot: [['shadow_essence', 0.7, 1]], poise: 5, aggro: true, gloom: true,
    ranged: { speed: 16, color: '#b58cff', every: [1.8, 3.2], range: 22, keep: 9, size: 0.3, homing: 0.6 },
    attacks: [], cooldown: [1, 2], strafe: 0.7, keep: 9,
  },
  gart: {
    name: 'Гарт, вожак Чёрной Лисы', kinds: ['bandit', 'boss'], body: 'human', unique: 'gart', boss: true, hp: 380, dmg: 21, walk: 2.2, run: 5.4, sight: 20, radius: 0.6, height: 2.2,
    look: { shirt: 0x5a3a3a, pants: 0x2a2430, armor: 0x5a4a3a, pauldrons: true, hood: null, helmet: 0x4a3a2a, horns: true, cape: 0x2a2430, weapon: 'greataxe', weaponOpts: { bladeColor: 0xcfd4dc }, scale: 1.22, bulk: 1.15 },
    xp: 220, gold: [80, 120], loot: [['potion_hp', 1, 2]], poise: 70, aggro: true, shard: 'shard_camp',
    attacks: [A('slash3', 1.35, [0.52, 0.66], 1.3, 3.2, 0.8, 3), A('spin', 1.4, [0.35, 0.75], 1.1, 3.4, 3.2, 1.5), A('heavy', 1.8, [0.55, 0.7], 1.8, 3.4, 0.8, 4, { knock: 5 })],
    combos: [['slash3'], ['spin'], ['heavy'], ['slash3', 'spin']],
    cooldown: [0.7, 1.6], strafe: 0.35, keep: 4, parryable: true,
  },
  troll: {
    name: 'Лесной тролль', kinds: ['troll'], body: 'human', hp: 460, dmg: 26, walk: 1.6, run: 4.4, sight: 20, radius: 0.9, height: 3.6,
    look: { skin: 0x8fa084, shirt: 0x8fa084, pants: 0x5a4a3a, boots: 0x7a8a70, hair: 0x4f6a3a, hairStyle: 'short', beard: 0x5f7a44, longBeard: true, bulk: 1.6, scale: 1.85, weapon: 'hammer', weaponOpts: { bladeColor: 0x8a8070 }, gloves: 0x7a8a70, belt: 0x4a3a2a },
    xp: 180, gold: [20, 45], loot: [['raw_meat', 0.8, 2], ['mushroom', 0.6, 3], ['light_crystal', 0.25, 1]], poise: 90, aggro: true, leash: 40,
    attacks: [A('slash1', 1.5, [0.52, 0.66], 1, 3.4, 1.1, 2), A('slam', 2.1, [0.62, 0.72], 1.5, 5.0, 3.2, 0, { aoe: 5, knock: 6 }), A('heavy', 1.9, [0.58, 0.72], 1.7, 3.6, 0.8, 3, { knock: 6 })],
    combos: [['slash1'], ['slam'], ['heavy'], ['slash1', 'heavy']],
    cooldown: [1.2, 2.4], strafe: 0.15, keep: 4.2, parryable: false,
  },
  spider: {
    name: 'Сумеречный паук', kinds: ['spider'], body: 'spider', scale: 1.15, hp: 120, dmg: 16, walk: 2.4, run: 7.5, sight: 18, radius: 0.9, height: 1.1,
    xp: 60, gold: [0, 0], loot: [['shadow_essence', 0.5, 1]], poise: 22, aggro: true, gloom: true,
    attacks: [A('bite', 0.8, [0.36, 0.55], 1, 2.2, 0.9, 6, { poison: true }), A('bite', 1.1, [0.2, 0.7], 1.3, 2.4, 0.8, 10, { charge: true, knock: 3 })],
    cooldown: [0.8, 1.8], strafe: 0.65, keep: 4,
  },
  duskmage: {
    name: 'Сумеречный маг', kinds: ['mage'], body: 'human', hp: 110, dmg: 18, walk: 2, run: 5, sight: 30, radius: 0.45, height: 1.85, blink: true,
    look: { robe: 0x3a2a4e, shirt: 0x2e2240, hood: 0x2a2038, glowEyes: 0xc07bff, weapon: 'staff', weaponOpts: { glow: 0xa06bff }, cape: 0x4a2a5a },
    xp: 85, gold: [15, 40], loot: [['shadow_essence', 0.8, 1], ['potion_mana', 0.3, 1], ['moonflower', 0.3, 1]], poise: 14, aggro: true, gloom: true,
    ranged: { speed: 14, color: '#b58cff', every: [1.6, 2.6], range: 26, keep: 12, size: 0.34, homing: 0.8, clip: 'cast' },
    attacks: [A('slash1', 1.0, [0.46, 0.62], 0.8, 2.2, 1.0, 1.5)], cooldown: [1.2, 2.2], strafe: 0.6, keep: 12, parryable: true,
  },
  prince: {
    name: 'Принц Седрик', kinds: ['duel'], body: 'human', hp: 300, dmg: 11, walk: 2.4, run: 5.6, sight: 30, radius: 0.5, height: 1.85, duel: true,
    look: { armor: 0xf4f6fc, armorTrim: 0xf0c860, pauldrons: true, cape: 0x6f7fd8, capeTrim: 0xf0c860, shirt: 0xdfe6f5, pants: 0x4a4a7a, boots: 0x5a4a3a, hair: 0xc89a5a, hairStyle: 'short', skin: 0xf2d0b8, weapon: 'sword', weaponOpts: { guard: 0xf0c860 }, shield: 0xf4f6fc, tabard: 0x6f7fd8, emblem: 0xf0c860 },
    xp: 0, gold: [0, 0], loot: [], poise: 45, aggro: true, leash: 60,
    attacks: [A('slash1', 0.95, [0.44, 0.6], 1, 2.6, 1.0, 2.4), A('slash2', 0.9, [0.44, 0.6], 1, 2.6, 1.0, 2.4), A('thrust', 1.0, [0.48, 0.62], 1.2, 3.0, 0.6, 4.5), A('heavy', 1.5, [0.55, 0.7], 1.6, 2.9, 0.8, 3, { knock: 3 })],
    combos: [['slash1', 'slash2'], ['thrust'], ['slash1', 'slash2', 'thrust'], ['heavy']],
    cooldown: [0.6, 1.4], strafe: 0.6, keep: 3.4, block: 0.35, parryable: true,
  },
  golem: {
    name: 'Хрустальный Страж', kinds: ['golem', 'boss'], body: 'human', unique: 'golem', boss: true, hp: 700, dmg: 28, walk: 1.6, run: 3.6, sight: 24, radius: 1.3, height: 4.4,
    look: { crystalBody: true, shirt: 0xbfe0ff, pants: 0x9fc0e8, armor: 0xd6ecff, pauldrons: true, helmet: 0xd6ecff, boots: 0x8fb0d8, skin: 0xd6ecff, glowEyes: 0xffffff, scale: 2.4, bulk: 1.5, weapon: 'crystal', gloves: 0xd6ecff },
    xp: 450, gold: [0, 0], loot: [['light_crystal', 1, 3]], poise: 999, aggro: true, shard: 'shard_ruins', leash: 45,
    attacks: [A('slash1', 1.4, [0.46, 0.62], 1, 4.6, 1.1, 2), A('slam', 2.0, [0.62, 0.7], 1.5, 6.5, 3.2, 0, { aoe: 6.5, knock: 6 }), A('spin', 1.8, [0.35, 0.75], 1.0, 5.0, 3.2, 1)],
    combos: [['slash1'], ['slam'], ['spin'], ['slash1', 'slam']],
    cooldown: [1.0, 2.0], strafe: 0.2, keep: 4.5,
  },
  morgrim: {
    name: 'Моргрим, Рыцарь Сумрака', kinds: ['knight', 'boss'], body: 'human', unique: 'morgrim', boss: true, hp: 1150, dmg: 32, walk: 2.2, run: 6.2, sight: 26, radius: 0.9, height: 3.6,
    look: { armor: 0x2e2640, pauldrons: true, helmet: 0x2e2640, horns: true, cape: 0x4a2a5a, shirt: 0x1e1a28, pants: 0x1e1a28, boots: 0x1a1620, glowEyes: 0xc07bff, weapon: 'greatsword', weaponOpts: { glow: 0xa06bff }, scale: 1.9, bulk: 1.1 },
    xp: 1200, gold: [300, 300], loot: [], poise: 160, aggro: true, gloom: true, shard: 'shard_crag', leash: 40,
    attacks: [A('slash1', 1.05, [0.46, 0.62], 1, 4.2, 1.1, 3), A('slash2', 1.0, [0.46, 0.62], 1, 4.2, 1.1, 3), A('slash3', 1.2, [0.5, 0.64], 1.35, 4.4, 0.8, 3.5), A('thrust', 1.2, [0.5, 0.64], 1.3, 5.2, 0.5, 7), A('slam', 1.9, [0.6, 0.7], 1.6, 6.5, 3.2, 0, { aoe: 6.5, knock: 6 }), A('spin', 1.5, [0.35, 0.75], 1.1, 4.6, 3.2, 2)],
    combos: [['slash1', 'slash2', 'slash3'], ['thrust'], ['slam'], ['slash1', 'slash2'], ['spin', 'thrust']],
    cooldown: [0.6, 1.4], strafe: 0.3, keep: 4.5, parryable: true,
  },
};

const WISP_CORE = new THREE.SphereGeometry(0.28, 16, 12);
const WISP_HALO = new THREE.SphereGeometry(0.5, 16, 12);

class WispBody {
  constructor() {
    this.root = new THREE.Group();
    this.core = new THREE.Mesh(WISP_CORE, new THREE.MeshStandardMaterial({ color: 0x1a1024, emissive: 0x7a3aff, emissiveIntensity: 1.5 }));
    this.halo = new THREE.Mesh(WISP_HALO, new THREE.MeshBasicMaterial({ color: 0x9b6bff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.core.position.y = 1.2; this.halo.position.y = 1.2;
    this.root.add(this.core, this.halo);
    this.t = Math.random() * 10;
  }
  update(dt, st) {
    this.t += dt;
    const k = st.dead ? Math.max(0, 1 - (st.deathT || 0) / 0.6) : 1;
    this.core.scale.setScalar(k * (1 + Math.sin(this.t * 6) * 0.08));
    this.halo.scale.setScalar(k * (1 + Math.sin(this.t * 3) * 0.2));
    this.core.position.y = this.halo.position.y = 1.2 + Math.sin(this.t * 2) * 0.25;
  }
  setVisible(v) { this.root.visible = v; }
}

// Giant twilight spider: 8 two-segment legs in an alternating tetrapod gait
class SpiderBody {
  constructor(scale = 1) {
    this.root = new THREE.Group();
    const R = new RigBuilder();
    const base = R.bone('base', null, 0, 0, 0);
    const body = R.bone('body', base, 0, 0.62, 0);
    const abd = R.bone('abdomen', body, 0, 0.08, -0.42);
    const head = R.bone('head', body, 0, 0.02, 0.36);
    const chitin = 0x2e2438, dark = 0x1c1624, glowC = 0xc07bff;
    R.part(body, PRIM.sphere, chitin, { sx: 0.34, sy: 0.24, sz: 0.4 }, 'metal');
    R.part(abd, PRIM.sphere, chitin, { z: -0.35, y: 0.12, sx: 0.55, sy: 0.46, sz: 0.66, rx: -0.25 }, 'metal');
    // glowing rune markings on the abdomen
    for (let i = 0; i < 5; i++) R.part(abd, PRIM.sphereLo, glowC, { z: -0.12 - i * 0.14, y: 0.55 - Math.abs(i - 2) * 0.05, sx: 0.07 - Math.abs(i - 2) * 0.012, sy: 0.02, sz: 0.05 }, 'glow');
    for (const s of [-1, 1]) R.part(abd, PRIM.sphereLo, glowC, { x: s * 0.28, z: -0.42, y: 0.4, sx: 0.05, sy: 0.02, sz: 0.12, rz: s * 0.6 }, 'glow');
    R.part(head, PRIM.sphere, dark, { sx: 0.2, sy: 0.17, sz: 0.2 }, 'metal');
    for (let i = 0; i < 6; i++) R.part(head, PRIM.sphereLo, 0xe0b0ff, { x: (i % 3 - 1) * 0.07, y: 0.08 + Math.floor(i / 3) * 0.05, z: 0.16, sx: 0.028, sy: 0.028, sz: 0.02 }, 'glow');
    for (const s of [-1, 1]) R.part(head, PRIM.cone, 0x3a2a44, { x: s * 0.06, y: -0.1, z: 0.2, sx: 0.035, sy: 0.14, sz: 0.035, rx: 2.6 }, 'metal'); // fangs
    this.legs = [];
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const z = 0.22 - i * 0.16;
        const hip = R.bone('hip', body, s * 0.22, 0, z);
        const knee = R.bone('knee', hip, 0, 0, 0);
        const spread = (i - 1.5) * 0.35;
        hip.rotation.set(0, spread * -s, 0);
        R.part(hip, taper(0.045, 0.035, 0.62, 6), chitin, { rz: s * (Math.PI / 2 - 0.55), x: 0, y: 0 }, 'metal');
        knee.position.set(s * 0.52, 0.34, 0);
        R.part(knee, taper(0.035, 0.012, 0.95, 6), dark, { rz: s * 0.28 }, 'metal');
        this.legs.push({ hip, knee, s, i, group: (i + (s > 0 ? 1 : 0)) % 2, spread });
      }
    }
    const built = R.build();
    for (const m of built.meshes) { m.boundingSphere.center.set(0, 0.6, 0); m.boundingSphere.radius = 2.2; this.root.add(m); }
    this.root.scale.setScalar(scale);
    this.base = base; this.body = body; this.abd = abd; this.head = head;
    this.phase = 0; this.t = Math.random() * 10; this.biteT = -1;
  }
  bite() { this.biteT = 0; }
  update(dt, st) {
    this.t += dt;
    const sp = st.speed || 0;
    this.phase += dt * sp * 1.6;
    for (const L of this.legs) {
      const ph = this.phase * Math.PI * 2 + (L.group ? Math.PI : 0) + L.i * 0.3;
      const lift = sp > 0.1 ? Math.max(0, Math.sin(ph)) * 0.35 : 0;
      L.hip.rotation.y = -L.spread * L.s + (sp > 0.1 ? Math.cos(ph) * 0.3 : Math.sin(this.t * 1.3 + L.i) * 0.02);
      L.hip.rotation.z = L.s * lift;
      L.knee.rotation.z = -L.s * lift * 0.5;
    }
    this.body.position.y = 0.62 + (sp > 0.1 ? Math.abs(Math.sin(this.phase * Math.PI * 4)) * 0.03 : Math.sin(this.t * 2) * 0.01);
    this.abd.rotation.x = Math.sin(this.t * 1.7) * 0.05;
    if (this.biteT >= 0) {
      this.biteT += dt / 0.45;
      const a = Math.sin(Math.min(1, this.biteT) * Math.PI);
      this.body.rotation.x = -a * 0.35;
      this.head.rotation.x = a * 0.3;
      if (this.biteT >= 1) this.biteT = -1;
    } else { this.body.rotation.x = st.alert ? -0.08 : 0; }
    if (st.dead) {
      const k = Math.min(1, (st.deathT || 0) / 0.6);
      this.base.rotation.z = k * Math.PI;
      this.base.position.y = k * 0.8;
      for (const L of this.legs) L.knee.rotation.z = -L.s * k * 1.2;
    } else { this.base.rotation.z = 0; this.base.position.y = 0; }
  }
  setVisible(v) { this.root.visible = v; }
}

let enemyId = 0;

export class Enemy {
  constructor(game, typeId, pos, opts = {}) {
    this.game = game;
    this.id = opts.id || typeId + '_' + (enemyId++);
    this.typeId = typeId;
    this.T = ENEMY_TYPES[typeId];
    const T = this.T;
    this.name = T.name;
    this.home = pos.clone();
    this.pos = pos.clone();
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.radius = T.radius;
    this.height = T.height;
    this.maxHp = T.hp;
    this.hp = T.hp;
    this.alive = true;
    this.boss = !!T.boss;
    this.unique = T.unique;
    this.gloom = !!T.gloom;
    this.passive = !!T.neutral;
    this.canBeParried = !!T.parryable;
    this.motor = new Motor(game.collision, { radius: T.radius, height: T.height, canSwim: false });
    if (T.body === 'human') {
      this.body = new Humanoid(T.look);
    } else if (T.body === 'quad') {
      this.body = new Quadruped(T.species);
    } else if (T.body === 'spider') {
      this.body = new SpiderBody(T.scale || 1);
    } else {
      this.body = new WispBody();
    }
    game.scene.add(this.body.root);
    this.state = 'idle';
    this.stateT = 0;
    this.cool = 1;
    this.poiseDmg = 0;
    this.lastHit = -10;
    this.speed = 0;
    this.wanderT = Math.random() * 4;
    this.wanderTarget = null;
    this.sightT = 0;
    this.deathT = 0;
    this.vulnerable = false;
    this.phase = 1;
    this.shotT = 2;
    this.strafeDir = 1;
    this.rangedCool = 2 + Math.random() * 2;
    this.leash = T.leash || 70;
    this.pack = opts.pack || null;
    this.trail = T.body === 'human' && T.look.weapon && T.look.weapon !== 'bow' ? game.effects.addTrail(T.look.weaponOpts?.glow ? '#b58cff' : '#ffffff') : null;
    if (this.trail) this.trail.intensity = T.look.weaponOpts?.glow ? 0.9 : 0.35;
    this.visible = true;
    this.sleeping = false;
    if (T.fly) this.pos.y += 0;
    this.syncBody();
  }

  get dmg() { return this.T.dmg * (this.phase === 2 ? 1.15 : 1); }

  // ------------------------------------------------------------------
  update(dt) {
    const g = this.game;
    const T = this.T;
    const p = g.player;
    this.stateT += dt;
    if (!this.alive) {
      this.deathT += dt;
      this.body.update(dt, { dead: true, deathT: this.deathT, grounded: true });
      this.syncBody();
      if (this.deathT > 3.5 && this.body.root.visible) {
        this.body.root.visible = false;
      }
      return;
    }
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);
    const playerAlive = p.state !== 'dead';
    let mx = 0, mz = 0, speed = 0, face = null;

    if (this.status) this.tickStatus(dt);
    if (!this.alive) return;
    const slow = this.status?.frost ? 0.6 : 1;
    if (this.cool > 0) this.cool -= dt * slow;
    this.poiseDmg = Math.max(0, this.poiseDmg - dt * T.poise * 0.25);

    switch (this.state) {
      case 'idle': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 3 + Math.random() * 6;
          const a = Math.random() * Math.PI * 2, r = Math.random() * 10;
          this.wanderTarget = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
          if (this.boss || Math.random() < 0.4) this.wanderTarget = null;
        }
        if (this.wanderTarget) {
          const wx = this.wanderTarget.x - this.pos.x, wz = this.wanderTarget.z - this.pos.z;
          const wd = Math.hypot(wx, wz);
          if (wd > 0.8) { mx = wx / wd; mz = wz / wd; speed = T.walk; face = Math.atan2(wx, wz); } else this.wanderTarget = null;
        }
        // noticing
        this.sightT -= dt;
        if (this.sightT <= 0 && playerAlive && !p.mount?.hidden) {
          this.sightT = 0.35;
          const sight = T.sight * (g.sky.isNight() && !T.gloom ? 0.75 : 1) * (p.sprinting ? 1.2 : 1);
          if (T.aggro && dist < sight && Math.abs(p.pos.y - this.pos.y) < 12) {
            if (dist < 6 || !g.collision.segmentBlocked(this.pos.x, this.pos.y + 1.5, this.pos.z, p.pos.x, p.pos.y + 1.5, p.pos.z)) this.aggro();
          }
        }
        break;
      }
      case 'alert': {
        face = toPlayer;
        if (this.stateT > 0.6) this.setState('chase');
        break;
      }
      case 'chase': {
        face = toPlayer;
        const homeD = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
        if (!playerAlive || homeD > this.leash || dist > T.sight * 2.4) { this.setState('return'); break; }
        if (T.blink && dist < 3.5 && (this.blinkCool || 0) <= 0) {
          this.blinkCool = 6;
          const a = Math.random() * Math.PI * 2;
          const nx = p.pos.x + Math.cos(a) * 11, nz = p.pos.z + Math.sin(a) * 11;
          g.effects.smoke(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#5a3a8a', 16);
          this.pos.set(nx, g.collision.groundHeight(nx, nz, this.pos.y + 6), nz);
          g.effects.burst(this.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), '#c7a6ff', 30, 3, 0.3, 0.8);
          g.audio.play('magic', 0.7);
        }
        this.blinkCool = (this.blinkCool || 0) - dt;
        if (T.ranged) {
          const keep = T.ranged.keep;
          if (dist > T.ranged.range) { mx = dx / dist; mz = dz / dist; speed = T.run; }
          else if (dist < keep * 0.6 && T.attacks.length && dist < 3) { this.tryMelee(dist); }
          else if (dist < keep * 0.7) { mx = -dx / dist; mz = -dz / dist; speed = T.walk * 1.4; }
          else { const s = this.strafeDir; mx = -dz / dist * s; mz = dx / dist * s; speed = T.walk * 0.8; }
          this.rangedCool -= dt;
          if (this.rangedCool <= 0 && dist < T.ranged.range) this.startShot();
          break;
        }
        const reach = this.nextAttackRange();
        if (dist > reach * 0.85) {
          mx = dx / dist; mz = dz / dist; speed = dist > 8 ? T.run : T.run * 0.7;
        } else if (this.cool <= 0) {
          // attack tokens: at most two ordinary foes swing at the player at once, the rest circle and wait
          let busy = 0;
          if (!this.boss) for (const o of g.enemies) if (o !== this && o.alive && !o.boss && o.state === 'attack' && Math.abs(o.pos.x - p.pos.x) + Math.abs(o.pos.z - p.pos.z) < 9) busy++;
          if (busy >= 2) { this.cool = 0.4 + Math.random() * 0.5; this.setState('strafe'); this.strafeDir = Math.random() < 0.5 ? -1 : 1; break; }
          this.startAttack();
          break;
        } else if (Math.random() < T.strafe * dt * 1.5) {
          this.setState('strafe');
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        }
        if (dist < T.keep * 0.6 && this.cool > 0) { mx = -dx / dist; mz = -dz / dist; speed = T.walk; }
        break;
      }
      case 'strafe': {
        face = toPlayer;
        const s = this.strafeDir;
        mx = (-dz / dist) * s; mz = (dx / dist) * s;
        if (dist > T.keep + 1) { mx += dx / dist * 0.6; mz += dz / dist * 0.6; }
        if (dist < T.keep - 1) { mx -= dx / dist * 0.6; mz -= dz / dist * 0.6; }
        const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
        speed = T.walk * 1.1;
        if (this.stateT > 1.2 + Math.random() * 1.5 || this.cool <= 0) this.setState('chase');
        break;
      }
      case 'attack': {
        const a = this.atk;
        a.t += dt / a.def.dur;
        const def = a.def;
        if (a.t < def.active[0] * 0.8) face = toPlayer;
        if (def.clip === 'bite' && !a.bit && a.t >= def.active[0] * 0.75 && this.body.bite) { a.bit = true; this.body.bite(); }
        if (def.charge) {
          // boar charge: run straight
          if (a.t > def.active[0] && a.t < def.active[1]) { mx = Math.sin(this.yaw); mz = Math.cos(this.yaw); speed = def.lunge; }
        } else if (a.t > def.active[0] - 0.15 && a.t < def.active[1] && def.lunge) {
          const room = Math.max(0, dist - this.radius - p.radius - 0.6);
          speed = Math.min(def.lunge / (def.dur * 0.3), room / 0.2);
          mx = Math.sin(this.yaw); mz = Math.cos(this.yaw);
        }
        if (a.t >= def.active[0] && a.t <= def.active[1]) {
          if (this.trail) this.trail.active = true;
          if (!a.sfx) { a.sfx = true; g.audio.play(def.aoe ? 'heavy' : 'swing', 0.7); }
          if (!a.hit) this.tryHitPlayer(def, a);
        } else if (this.trail) this.trail.active = false;
        if (this.trail && this.trail.active && this.body.bladePoints && this.body.bladePoints(_b, _t)) this.trail.push(_b, _t);
        if (a.t >= 1) {
          if (this.trail) this.trail.active = false;
          if (a.queue && a.queue.length && dist < 9) { this.startAttack(a.queue); break; }
          const [c0, c1] = T.cooldown;
          this.cool = (c0 + Math.random() * (c1 - c0)) * (this.phase === 2 ? 0.7 : 1) + (a.comboLen >= 3 ? 1.2 : 0);
          this.setState(Math.random() < T.strafe ? 'strafe' : 'chase');
        }
        break;
      }
      case 'shoot': {
        face = toPlayer;
        if (this.stateT > 0.55 && !this.shot) { this.shot = true; this.fire(); }
        if (this.stateT > 0.95) {
          const r = T.ranged.every;
          this.rangedCool = r[0] + Math.random() * (r[1] - r[0]);
          this.setState('chase');
        }
        break;
      }
      case 'stagger':
      case 'hit': {
        if (this.stateT > this.stateDur) { this.vulnerable = false; this.setState('chase'); }
        speed = Math.max(0, 1 - this.stateT / 0.3) * 2.5;
        mx = -Math.sin(this.yaw); mz = -Math.cos(this.yaw);
        break;
      }
      case 'return': {
        const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z;
        const hd = Math.hypot(hx, hz);
        if (hd < 1.5) { this.setState('idle'); this.hp = this.maxHp; if (this.boss) g.ui.setBoss(null, this); break; }
        mx = hx / hd; mz = hz / hd; speed = T.run * 0.8; face = Math.atan2(hx, hz);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2 * dt);
        if (playerAlive && dist < T.sight * 0.5 && hd < this.leash * 0.7 && this.stateT > 1.5) this.setState('chase');
        break;
      }
      default: break;
    }

    // phase 2 for Morgrim
    if (this.typeId === 'morgrim' && this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      g.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 2, this.pos.z), '#a06bff', 80, 8, 0.6, 1.2);
      g.audio.play('roar');
      g.cam.shake(0.8);
      g.ui.combatText('Сумрак пробуждается...', '#c09bff');
      this.stagger(1.2, false);
    }
    if (this.phase === 2 && Math.random() < dt * 8) g.effects.smoke(new THREE.Vector3(this.pos.x, this.pos.y + 0.5, this.pos.z), '#5a3a8a', 1);

    // facing & move
    if (face !== null) {
      const turn = this.state === 'attack' ? 6 : 8;
      this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-turn * dt));
    }
    speed *= slow;
    if (speed > 0) {
      const nx = this.pos.x + mx * speed * dt, nz = this.pos.z + mz * speed * dt;
      if (g.terrain.getHeight(nx, nz) < WORLD.water - 0.4) speed = 0;
    }
    if (T.fly) {
      this.pos.x += mx * speed * dt; this.pos.z += mz * speed * dt;
      const gy = g.terrain.getHeight(this.pos.x, this.pos.z);
      this.pos.y = damp(this.pos.y, Math.max(gy, WORLD.water) + 0.3, 3, dt);
      g.collision.resolve(this.pos, this.radius, 1.8);
    } else {
      this.motor.move(this.pos, mx * speed, mz * speed, dt);
    }
    // separation from player
    const pd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const minD = this.radius + p.radius;
    if (pd < minD && pd > 0.001 && !p.mount) {
      const push = (minD - pd) * 0.5;
      this.pos.x -= (dx / pd) * push; this.pos.z -= (dz / pd) * push;
      p.pos.x += (dx / pd) * push; p.pos.z += (dz / pd) * push;
    }
    this.speed = damp(this.speed, speed, 10, dt);
    const st = { speed: this.speed, grounded: true, base: this.state === 'idle' || this.state === 'return' ? 'relaxed' : (this.T.look?.shield && this.blocking ? 'shieldBlock' : 'guard'), alert: this.state !== 'idle', graze: this.state === 'idle' && !this.wanderTarget && this.T.body === 'quad', lookAround: 0.5 };
    this.body.update(dt, st);
    this.syncBody();
  }

  syncBody() {
    this.body.root.position.copy(this.pos);
    this.body.root.rotation.y = this.yaw;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    this.blocking = false;
  }

  aggro(fromPack = false) {
    if (!this.alive || this.state === 'chase' || this.state === 'attack' || this.state === 'strafe' || this.state === 'alert') return;
    this.setState('alert');
    this.passive = false;
    const g = this.game;
    if (this.T.body === 'quad' && this.T.species !== 'boar') g.audio.play('growl', 0.8);
    if (this.boss) { g.ui.setBoss(this); g.onBossAggro(this); }
    if (!fromPack && this.pack) for (const e of this.pack) if (e !== this) e.aggro(true);
  }

  nextAttackRange() {
    const T = this.T;
    if (!T.attacks.length) return 2;
    if (!this.nextCombo) this.pickCombo();
    const first = T.attacks.find((a) => a.clip === this.nextCombo[0]) || T.attacks[0];
    return Math.max(first.range * 0.9, 1.6) + this.radius;
  }

  pickCombo() {
    const T = this.T;
    if (T.combos) {
      let list = T.combos;
      this.nextCombo = [...list[Math.floor(Math.random() * list.length)]];
      if (this.phase === 2 && Math.random() < 0.5) this.nextCombo.push('slam');
    } else {
      this.nextCombo = [T.attacks[Math.floor(Math.random() * T.attacks.length)].clip];
    }
  }

  tryMelee(dist) {
    if (this.cool <= 0 && this.T.attacks.length) this.startAttack();
  }

  startAttack(queue = null) {
    const T = this.T;
    const continuing = !!queue;
    if (!queue) { if (!this.nextCombo) this.pickCombo(); queue = this.nextCombo; this.nextCombo = null; }
    const name = queue[0];
    const def = T.attacks.find((a) => a.clip === name) || T.attacks[0];
    const comboLen = continuing && this.atk ? this.atk.comboLen + 1 : 1;
    this.setState('attack');
    const dur = def.dur / (this.phase === 2 ? 1.12 : 1);
    this.atk = { def: { ...def, dur }, t: 0, hit: false, queue: queue.slice(1), comboLen, bit: false };
    if (def.clip !== 'bite' && this.body.anim) this.body.anim.play(def.clip, dur);
    if (this.boss && Math.random() < 0.15) this.game.audio.play('growl', 0.6);
    // wind-up telegraph: a glint (gold = parryable, red = heavy/area — dodge!)
    if (!continuing || def.mult >= 1.3) {
      const g = this.game;
      const danger = def.aoe || def.knock >= 4 || def.charge;
      const hp = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * this.radius, this.pos.y + this.height * 0.85, this.pos.z + Math.cos(this.yaw) * this.radius);
      g.effects.twinkle(hp, danger ? '#ff7a8a' : '#fff2b0', danger ? 1.6 : 1.1, 0.45);
      if (danger) g.audio.play('ui', 0.5);
    }
  }

  tryHitPlayer(def, a) {
    const g = this.game;
    const p = g.player;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (Math.abs(p.pos.y - this.pos.y) > (this.height + 1.5)) return;
    if (def.aoe) {
      // ground slam at the active start
      if (a.t < def.active[0] + 0.03) return;
      a.hit = true;
      const center = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 2, this.pos.y + 0.2, this.pos.z + Math.cos(this.yaw) * 2);
      g.effects.burst(center, this.gloom ? '#a06bff' : '#bfe6ff', 60, 10, 0.5, 0.8);
      g.effects.dust(center, 20);
      g.spawnShockwave(center, def.aoe, this.gloom ? '#a06bff' : '#bfe6ff');
      g.audio.play('explode');
      g.cam.shake(0.7);
      const cd = Math.hypot(p.pos.x - center.x, p.pos.z - center.z);
      if (cd < def.aoe) p.takeHit(this.dmg * def.mult, this, { aoeGround: true, knock: def.knock, unblockable: false });
      return;
    }
    if (dist - p.radius > def.range) return;
    const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
    if (ang > def.arc && dist > this.radius + 1) return;
    a.hit = true;
    const res = p.takeHit(this.dmg * def.mult * (0.9 + Math.random() * 0.2), this, { knock: def.knock });
    if (res.hit) {
      g.effects.sparks(new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z), '#ff9ab0', 10, 4);
      g.audio.play('flesh', 0.8);
      if (def.poison) { p.poison = { left: 6, dps: 2.5 }; g.ui.combatText('Отравление', '#b58cff', true); }
    }
  }

  startShot() {
    this.setState('shoot');
    this.shot = false;
    if (this.body.anim && this.T.ranged.clip) this.body.anim.play(this.T.ranged.clip, 1.0);
  }

  fire() {
    const g = this.game;
    const R = this.T.ranged;
    const from = new THREE.Vector3(this.pos.x, this.pos.y + (this.T.fly ? 1.2 : 1.45), this.pos.z);
    const p = g.player;
    const target = new THREE.Vector3(p.pos.x, p.pos.y + 1.1, p.pos.z);
    // lead the target a bit
    const tt = from.distanceTo(target) / R.speed;
    target.x += (p.moveSpeed * Math.sin(p.yaw)) * tt * 0.5;
    target.z += (p.moveSpeed * Math.cos(p.yaw)) * tt * 0.5;
    const dir = target.sub(from).normalize();
    g.spawnProjectile({ from, dir, speed: R.speed, dmg: this.dmg, owner: this, color: R.color, size: R.size, life: 3, arrow: R.arrow, homing: R.homing ? p : null, homingStrength: R.homing || 0 });
    g.audio.play(R.arrow ? 'arrow' : 'magic', 0.6);
  }

  // ------------------------------------------------------------------
  takeHit(dmg, src, opts = {}) {
    const g = this.game;
    if (!this.alive) return null;
    this.lastHit = g.time;
    if (this.state === 'idle' || this.state === 'return' || this.state === 'alert') {
      this.aggro();
      if (this.state === 'alert') this.setState('chase');
    }
    // shield / weapon block (not from behind, not during own attack)
    if (this.T.block && this.state !== 'attack' && this.state !== 'stagger' && !opts.crit && !opts.spell && Math.random() < this.T.block) {
      const ang = Math.abs(angleDiff(this.yaw, Math.atan2(src.pos.x - this.pos.x, src.pos.z - this.pos.z)));
      if (ang < 1.2) {
        this.blocking = true;
        this.poiseDmg += (opts.heavy ? 25 : 8);
        if (opts.heavy && this.poiseDmg > this.T.poise) { this.stagger(1.2, false); return { blocked: false }; }
        if (this.body.anim) this.body.anim.play('hit', 0.3);
        this.cool = Math.min(this.cool, 0.3);
        return { blocked: true };
      }
    }
    let amount = dmg;
    if (opts.spell && this.gloom) amount *= 1.6;
    if (this.status?.frost) amount *= 1.15;
    if (this.vulnerable && opts.crit) amount *= 1.0;
    this.hp -= amount;
    g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + this.height + 0.3, this.pos.z), amount, opts.crit ? 'crit' : 'enemy');
    if (this.T.duel && this.hp <= this.maxHp * 0.15) { this.hp = this.maxHp * 0.15; g.endDuel(true); return { hit: true }; }
    if (this.hp <= 0) { this.die(); return { killed: true }; }
    // poise
    this.poiseDmg += (opts.heavy ? 30 : 12) * (opts.poise || 1);
    if (opts.crit) { this.vulnerable = false; this.stagger(0.8, false); }
    else if (this.poiseDmg >= this.T.poise) {
      this.poiseDmg = 0;
      this.stagger(this.boss ? 1.4 : 0.55, false);
    } else if (this.state !== 'attack' && !this.boss) {
      this.cool = Math.max(this.cool, 0.25);
    }
    return { hit: true };
  }

  // weapon status effects: bleed (strong DoT), radiant burn (DoT, x2 on gloom), frost (slow + vulnerability)
  applyStatus(kind, baseDmg, chance) {
    if (!this.alive || Math.random() > chance) return;
    const g = this.game;
    this.status = this.status || {};
    const fresh = !this.status[kind];
    const bossK = this.boss ? 0.5 : 1;
    if (kind === 'bleed') this.status.bleed = { t: 4, dps: baseDmg * 0.32 * bossK, tick: 0 };
    else if (kind === 'burn') this.status.burn = { t: 3.5, dps: baseDmg * 0.22 * (this.gloom ? 2 : 1), tick: 0 };
    else if (kind === 'frost') this.status.frost = { t: 3.5 * bossK + 1, tick: 0 };
    if (fresh) {
      const [name, col] = EFFECT_NAMES[kind];
      g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + this.height + 0.8, this.pos.z), name, 'status', col);
      g.bestiaryNote?.(this, 'status');
    }
  }

  tickStatus(dt) {
    const g = this.game;
    const S = this.status;
    let any = false;
    const c = _sp.set(this.pos.x, this.pos.y + this.height * 0.55, this.pos.z);
    for (const k of ['bleed', 'burn', 'frost']) {
      const e = S[k];
      if (!e) continue;
      e.t -= dt;
      e.tick -= dt;
      if (e.tick <= 0) {
        e.tick = 0.5;
        const [, col] = EFFECT_NAMES[k];
        if (e.dps) {
          const amt = e.dps * 0.5;
          this.hp -= amt;
          g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + this.height + 0.2, this.pos.z), amt, 'dot', col);
        }
        if (k === 'bleed') g.effects.sparks(c, col, 6, 2.5);
        else if (k === 'burn') g.effects.motes(c, col, 6, this.radius + 0.2, 1.2, 0.8);
        else g.effects.motes(c, col, 5, this.radius + 0.3, 0.6, 1.0);
      }
      if (e.t <= 0) S[k] = null; else any = true;
    }
    if (!any) this.status = null;
    if (this.hp <= 0 && this.alive) {
      if (this.T.duel) { this.hp = this.maxHp * 0.15; this.status = null; g.endDuel(true); return; }
      this.die();
    }
  }

  stagger(dur, vulnerable) {
    this.setState('stagger');
    this.stateDur = dur;
    this.vulnerable = vulnerable;
    if (this.trail) this.trail.active = false;
    if (this.body.anim) this.body.anim.play(vulnerable ? 'stagger' : 'hit', Math.min(dur, vulnerable ? dur : 0.5));
  }

  parried() {
    this.stagger(this.boss ? 1.6 : 2.0, true);
    this.game.ui.combatText('Враг открыт — атакуйте!', '#fff2c0', true);
  }

  die() {
    const g = this.game;
    this.alive = false;
    this.hp = 0;
    this.state = 'dead';
    this.deathT = 0;
    this.vulnerable = false;
    if (this.trail) this.trail.active = false;
    if (this.body.anim) this.body.anim.stop();
    const c = new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z);
    if (this.gloom) g.effects.smoke(c, '#5a3a8a', 20);
    g.effects.motes(c, this.gloom ? '#c7a6ff' : '#fff0c0', this.boss ? 120 : 24, this.radius + 0.3, 2.2, 2.2);
    g.audio.play('enemyDie');
    g.onEnemyKilled(this);
  }

  respawn() {
    if (this.unique && this.game.state.killed.includes(this.unique)) return;
    if (this.transient && !this.alive) return;
    this.alive = true;
    this.hp = this.maxHp;
    this.status = null;
    this.phase = 1;
    this.pos.copy(this.home);
    this.body.root.visible = true;
    this.setState('idle');
    this.deathT = 0;
    this.vulnerable = false;
    this.passive = !!this.T.neutral;
    this.motor.vy = 0;
    if (this.body.anim) this.body.anim.stop();
    this.syncBody();
  }

  remove() {
    this.game.scene.remove(this.body.root);
  }
}

const _b = new THREE.Vector3(), _t = new THREE.Vector3();
