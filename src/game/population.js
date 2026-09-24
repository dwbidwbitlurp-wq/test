// Spawns NPCs, enemies and wildlife across Aetheria.
import * as THREE from 'three';
import { NPC } from '../entities/npc.js';
import { Enemy } from '../entities/enemy.js';
import { Animal, BirdFlock } from '../entities/animal.js';
import { CASTLE, CAMP, RUINS, CRAG, FOREST, WORLD, MEADOW, VILLAGE } from '../world/layout.js';
import { mulberry32 } from '../engine/noise.js';
import { isFlatZone } from '../world/terrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function populate(game, castle, st) {
  const P = CASTLE.y, CX = CASTLE.x, CZ = CASTLE.z;
  const L = (x, y, z) => V(CX + x, P + y, CZ + z);
  const H = (x, z) => game.terrain.getHeight(x, z);
  const G = (x, z) => V(x, H(x, z), z);
  const rnd = mulberry32(31337);
  const sp = castle.spawn;

  // ------------------------------------------------ NPCs
  const guardLook = { armor: 0xf4f6fc, pauldrons: true, helmet: 0xf4f6fc, plume: 0xf2a6c9, cape: 0x9fb8e8, shirt: 0xdfe6f5, pants: 0x6b5a9a, boots: 0x6a5a7a, weapon: 'spear', shield: 0xf4f6fc };
  const defs = [
    { id: 'iva', name: 'Ива', title: 'паломница', named: true, talk: true, pos: st.spawns.pilgrim, yaw: -2.2, look: { skirt: 0xe8d8f0, shirt: 0xfff4ea, hairStyle: 'braid', hair: 0x9a6a4a, cape: 0xb9a3e3, weapon: 'staff', weaponOpts: { glow: 0xffe6a8 } } },
    { id: 'roland', name: 'Роланд', title: 'капитан стражи', named: true, talk: true, pos: L(7, 0, 58), yaw: Math.PI, guard: true, look: { armor: 0xe8ecf5, pauldrons: true, cape: 0x6f8fd8, beard: 0x8a6a4a, hair: 0x6a4a3a, shirt: 0xdfe6f5, pants: 0x4a4a6a, weapon: 'sword', shield: 0xe8ecf5 } },
    { id: 'queen', name: 'Элиана', title: 'королева Эфирии', named: true, talk: true, pos: sp.queen, yaw: 0, look: { skirt: 0xd9c3f5, shirt: 0xf8eefc, hairStyle: 'long', hair: 0xf2d68a, crown: true, cape: 0xf6b6d2, skin: 0xf6dccb } },
    { id: 'orvin', name: 'Орвин', title: 'придворный магистр', named: true, talk: true, pos: sp.mage, yaw: 0.6, look: { robe: 0x6b7fd6, shirt: 0x5a6ec8, hat: 0x4f63c0, beard: 0xf0f0f0, hair: 0xf0f0f0, weapon: 'staff', weaponOpts: { glow: 0x9fd0ff } }, gesture: 'cast' },
    { id: 'bram', name: 'Брам', title: 'кузнец', named: true, talk: true, pos: sp.blacksmith, yaw: -Math.PI / 2, look: { bulk: 1.25, apron: 0x5a4030, shirt: 0xd8b898, beard: 0x9a4a2a, hair: 0x6a3a2a, pants: 0x4a3a3a, weapon: 'axe' } },
    { id: 'mirta', name: 'Мирта', title: 'торговка', named: true, talk: true, pos: sp.merchant, yaw: Math.PI / 2, look: { skirt: 0xf3b6c8, shirt: 0xfff0e0, hairStyle: 'bun', hair: 0xa0522d, apron: 0xffffff } },
    { id: 'gunter', name: 'Гюнтер', title: 'трактирщик', named: true, talk: true, pos: sp.innkeeper, yaw: Math.PI / 2, look: { bulk: 1.3, apron: 0xffffff, beard: 0xc08a5a, hairStyle: 'none', shirt: 0xe8d0b0, pants: 0x5a4a3a } },
    { id: 'selma', name: 'Сельма', title: 'алхимик', named: true, talk: true, pos: sp.alchemist, yaw: Math.PI / 2, look: { robe: 0x8a6ac0, shirt: 0x7a5aa8, hairStyle: 'long', hair: 0x2a2a3a } },
    { id: 'nelly', name: 'Нелли', title: '', named: true, talk: true, pos: L(4, 0, 43.5), yaw: 0.4, look: { scale: 0.62, skirt: 0xffc6dc, shirt: 0xfff6fb, hairStyle: 'braid', hair: 0xe0a060 }, gesture: 'wave' },
    { id: 'amalia', name: 'Амалия', title: 'сестра света', named: true, talk: true, pos: sp.priestess, yaw: 0, look: { robe: 0xf6f2ff, shirt: 0xf6f2ff, hood: 0xf0ecfa, hairStyle: 'none' } },
    { id: 'volk', name: 'Вольф', title: 'охотник', named: true, talk: true, pos: st.spawns.hunter, yaw: -2, look: { shirt: 0x8a6a4a, pants: 0x5a4a3a, hood: 0x5a6a3a, beard: 0x6a5a4a, weapon: 'bow' } },
    { id: 'marta', name: 'Марта', title: 'фермерша', named: true, talk: true, pos: st.spawns.farmer, yaw: 2.6, look: { skirt: 0xf2d98a, shirt: 0xffffff, apron: 0xf3b6c8, hairStyle: 'bun', hair: 0xd08a4a } },
    { id: 'elm', name: 'Эльм', title: 'отшельник', named: true, talk: true, pos: st.spawns.hermit, yaw: -2.4, sit: true, look: { robe: 0x8a7a5a, shirt: 0x7a6a4a, beard: 0xdddddd, hairStyle: 'long', hair: 0xdddddd } },
  ];
  // guards
  const guards = [
    [L(-5, 0, 64), Math.PI], [L(5, 0, 64), Math.PI], [L(-9.5, 10, -8.5), 0], [L(9.5, 10, -8.5), 0],
    [L(-4.5, 10, -29), 0], [L(4.5, 10, -29), 0], [L(-3.5, 26.6, -38), 0.5],
  ];
  guards.forEach(([pos, yaw], i) => defs.push({ id: 'guard' + i, name: 'Стражник', dialog: 'guard', talk: true, pos, yaw, guard: true, look: guardLook }));
  // wall patrols
  defs.push({ id: 'gpatrol1', name: 'Стражник', dialog: 'guard', talk: true, guard: true, look: guardLook, behavior: 'patrol', speed: 1.4, pos: L(-75, 14, 55), path: [L(-75, 14, 55), L(-75, 14, 8), L(-75, 14, -8), L(-75, 14, -55)] });
  defs.push({ id: 'gpatrol2', name: 'Стражник', dialog: 'guard', talk: true, guard: true, look: guardLook, behavior: 'patrol', speed: 1.4, pos: L(-55, 14, -70), path: [L(-55, 14, -70), L(55, 14, -70)] });
  defs.push({ id: 'gpatrol3', name: 'Стражник', dialog: 'guard', talk: true, guard: true, look: guardLook, behavior: 'patrol', speed: 1.5, pos: L(-30, 0, 20), path: [L(-30, 0, 20), L(30, 0, 20), L(30, 0, 50), L(-30, 0, 50)] });
  // townsfolk
  const cloth = [0xf6b6d2, 0xb9d6f5, 0xd9c3f5, 0xfff0c0, 0xc9e8c0, 0xf8d0b0, 0xe8e8f8];
  const hairs = [0x6b4a36, 0xe9d3a4, 0x2a2a3a, 0xa0522d, 0xd8b070, 0x8a8a8a];
  const citizen = (i, female) => female
    ? { skirt: cloth[i % cloth.length], shirt: 0xfffaf2, hairStyle: ['long', 'bun', 'braid'][i % 3], hair: hairs[i % hairs.length], skin: [0xf2d0b8, 0xe8c0a0, 0xd8a888][i % 3] }
    : { shirt: cloth[(i + 3) % cloth.length], pants: [0x6b5a7a, 0x5a6a8a, 0x7a6a5a][i % 3], hair: hairs[(i + 2) % hairs.length], beard: i % 3 === 0 ? hairs[(i + 2) % hairs.length] : null, skin: [0xf2d0b8, 0xe8c0a0, 0xd8a888][(i + 1) % 3], hood: i % 4 === 1 ? 0x8a7a9a : null };
  const wanderSpots = [[0, 30], [-10, 45], [10, 25], [0, 55], [-24, 10], [24, 40], [-40, 30], [40, 20]];
  wanderSpots.forEach(([x, z], i) => defs.push({ id: 'cit' + i, name: 'Горожанин', dialog: 'citizen', talk: true, pos: L(x, 0, z), behavior: 'wander', wanderR: 9, look: citizen(i, i % 2 === 0) }));
  // tavern patrons (sitting)
  [[-55, 22.7, 0], [-55, 26.3, Math.PI], [-51, 22.7, 0], [-55, 33.2, 0]].forEach(([x, z, yaw], i) => defs.push({ id: 'pat' + i, name: 'Посетитель', dialog: 'citizen', talk: true, pos: L(x, 0.05, z), yaw, sit: true, fixedY: true, look: citizen(i + 3, i % 2 === 1) }));
  // garden
  defs.push({ id: 'cit_g1', name: 'Придворная дама', dialog: 'citizen', talk: true, pos: L(24, 10, -24), behavior: 'wander', wanderR: 6, look: { ...citizen(5, true), skirt: 0xf6b6d2, crown: false } });
  defs.push({ id: 'cit_g2', name: 'Садовник', dialog: 'citizen', talk: true, pos: L(34, 10, -30), behavior: 'wander', wanderR: 6, look: { ...citizen(2, false), hat: 0xe8d8a0 } });
  // villagers
  st.spawns.villagers.forEach((p, i) => defs.push({ id: 'vil' + i, name: 'Селянин', dialog: 'citizen', talk: true, pos: p, behavior: 'wander', wanderR: 12, look: citizen(i + 7, i % 2 === 0) }));

  for (const d of defs) game.npcs.push(new NPC(game, d));

  // ------------------------------------------------ ENEMIES
  const add = (type, pos, opts) => { const e = new Enemy(game, type, pos, opts); game.enemies.push(e); return e; };
  const pack = (type, cx, cz, n) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = 2 + rnd() * 3;
      list.push(add(type, G(cx + Math.cos(a) * r, cz + Math.sin(a) * r)));
    }
    for (const e of list) e.pack = list;
    return list;
  };
  // forest wolves
  const wolfSpots = [[-260, 20], [-330, -40], [-380, 80], [-240, 110], [-420, 0], [-300, 260], [-180, 60], [-460, 140]];
  wolfSpots.forEach(([x, z], i) => pack('wolf', x, z, 2 + (i % 2)));
  // dark wolves near the crag road + north woods
  pack('darkwolf', -280, -200, 2);
  pack('darkwolf', -340, -300, 3);
  pack('darkwolf', 120, -420, 2);
  // boars
  [[-200, 200], [-150, 300], [140, 250], [-360, -120], [200, 60], [-80, 200]].forEach(([x, z]) => add('boar', G(x, z)));
  // bandit camp
  const campList = st.spawns.campBandits.map((p) => add('bandit', p));
  const archer = add('archer', st.spawns.campArcher.clone(), {});
  campList.push(archer);
  const gart = add('gart', st.spawns.campLeader);
  for (const e of campList) e.pack = campList.concat([gart]);
  gart.pack = campList.concat([gart]);
  // roadside ambushes
  const amb1 = [add('bandit', G(-190, 140)), add('bandit', G(-194, 146)), add('archer', G(-200, 132))];
  amb1.forEach((e) => (e.pack = amb1));
  const amb2 = [add('bandit', G(390, 170)), add('archer', G(398, 178))];
  amb2.forEach((e) => (e.pack = amb2));
  // crystal ruins
  const ruinList = st.spawns.ruinKnights.map((p) => add('knight', p));
  ruinList.push(add('wisp', G(RUINS.x - 30, RUINS.z + 30).add(V(0, 2, 0))));
  ruinList.push(add('wisp', G(RUINS.x + 20, RUINS.z + 40).add(V(0, 2, 0))));
  ruinList.forEach((e) => (e.pack = ruinList));
  add('golem', st.spawns.golem, { yaw: 0 });
  // crag
  st.spawns.cragWisps.forEach((p) => add('wisp', p));
  st.spawns.cragKnights.forEach((p) => add('knight', p));
  add('morgrim', st.spawns.boss, { yaw: Math.PI / 4 });
  // mark killed uniques
  for (const e of game.enemies) if (e.unique && game.state.killed.includes(e.unique)) { e.alive = false; e.body.root.visible = false; e.state = 'dead'; e.deathT = 99; }

  // ------------------------------------------------ WILDLIFE
  const animalAt = (species, x, z) => {
    if (H(x, z) < WORLD.water + 0.5 || isFlatZone(x, z)) return;
    game.animals.push(new Animal(game, species, G(x, z)));
  };
  const herds = [[60, 380], [-120, 400], [150, 300], [-200, 280], [240, -120], [-60, 120], [100, -60]];
  herds.forEach(([x, z]) => { for (let i = 0; i < 3; i++) animalAt('deer', x + (rnd() - 0.5) * 12, z + (rnd() - 0.5) * 12); });
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 40 + rnd() * 460;
    animalAt('rabbit', Math.cos(a) * r, Math.sin(a) * r * 0.9 + 60);
  }
  for (let i = 0; i < 6; i++) animalAt('fox', FOREST.x + (rnd() - 0.5) * 300, FOREST.z + (rnd() - 0.5) * 300);

  // birds
  const flocks = [[0, 380], [-300, 60], [300, 40], [0, -260], [260, 340], [-150, -150]];
  for (const [x, z] of flocks) game.birds.push(new BirdFlock(game.scene, V(x, H(x, z), z), 6 + Math.floor(rnd() * 4), [0xffffff, 0xf8e8ff, 0xfff0e0][Math.floor(rnd() * 3)]));
}
