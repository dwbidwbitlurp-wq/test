// Spawns NPCs, enemies and wildlife across Aetheria.
import * as THREE from 'three';
import { NPC } from '../entities/npc.js';
import { Rider } from '../entities/rider.js';
import { Enemy } from '../entities/enemy.js';
import { Animal, BirdFlock, Swans } from '../entities/animal.js';
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
  // seats registered by the castle (benches, chairs) — sitting NPCs occupy them
  const seats = castle.objects.filter((o) => o.t === 'seat');
  const seatAt = (x, z) => seats.reduce((best, o) => { const d = Math.hypot(o.x - x, o.z - z); return !best || d < best.d ? { o, d } : best; }, null)?.o;
  const sitDef = (seat, extra) => ({ pos: V(seat.x, seat.y, seat.z), yaw: seat.face, sit: true, fixedY: true, seatRef: seat, ...extra });
  // tavern patrons (sitting on the benches)
  [[-56, 23.95], [-54, 25.05], [-52, 23.95], [-56, 34.45]].forEach(([x, z], i) => defs.push(sitDef(seatAt(CX + x, CZ + z), { id: 'pat' + i, name: 'Посетитель', dialog: 'citizen', talk: true, look: citizen(i + 3, i % 2 === 1) })));

  // ---- castle residents (interiors) ----
  const royalGuard = { ...guardLook, helmet: null, weapon: null, shield: null };
  defs.push(
    { id: 'aurelia', name: 'Аурелия', title: 'принцесса', named: true, talk: true, pos: sp.aurelia, yaw: Math.PI, look: { skirt: 0xf7b7d2, shirt: 0xfff2f7, hairStyle: 'long', hair: 0xe9c27e, tiara: true, puff: true, sash: 0xf0c860, skin: 0xf8e0d0, lips: 0xd8707e, eyes: 0x5a7ab8 } },
    { id: 'cedric', name: 'Седрик', title: 'наследный принц', named: true, talk: true, pos: L(49, 0, -16.5), yaw: Math.PI, guard: true, look: { armor: 0xf4f6fc, armorTrim: 0xf0c860, pauldrons: true, cape: 0x6f7fd8, capeTrim: 0xf0c860, shirt: 0xdfe6f5, pants: 0x4a4a7a, boots: 0x5a4a3a, hair: 0xc89a5a, hairStyle: 'short', weapon: 'sword', weaponOpts: { guard: 0xf0c860 }, tabard: 0x6f7fd8, emblem: 0xf0c860 } },
    { id: 'bertha', name: 'Берта', title: 'повариха', named: true, talk: true, pos: sp.bertha, yaw: 0, look: { bulk: 1.3, skirt: 0xc8b0e0, shirt: 0xfff4e8, apron: 0xffffff, hairStyle: 'bun', hair: 0x9a5a3a, skin: 0xf0c8b0 } },
    { id: 'pip', name: 'Пип', title: 'поварёнок', talk: true, pos: sp.kitchenBoy, behavior: 'wander', wanderR: 4, look: { scale: 0.74, shirt: 0xf0e0c8, pants: 0x6a5a4a, hair: 0xd8a060, apron: 0xffffff, freckles: true } },
    { id: 'edmund', name: 'Эдмунд', title: 'библиотекарь', named: true, talk: true, pos: sp.gallery.clone().add(V(2.2, 0, 0.6)), yaw: Math.PI, look: { robe: 0x5a4a7a, shirt: 0x4a3a6a, beard: 0xdcdcdc, hair: 0xdcdcdc, beret: 0x4a3a6a } },
    { id: 'florian', name: 'Флориан', title: 'бард', named: true, talk: true, pos: sp.florian, yaw: -2.4, look: { shirt: 0xf6e8ff, pants: 0x6a4a8a, beret: 0xc94f7c, cape: 0xb9a3e3, hair: 0xa0522d, puff: true, sash: 0xf0c860 }, gesture: 'wave' },
    { id: 'hector', name: 'Гектор', title: 'конюший', named: true, talk: true, pos: sp.stable.clone().add(V(-5, 0, 3)), yaw: -Math.PI / 2, look: { shirt: 0x8a6a4a, pants: 0x4a3a2a, apron: 0x6a5040, beard: 0x7a6a5a, hair: 0x7a6a5a, bulk: 1.15 } },
    { id: 'janek', name: 'Янек-Лис', title: 'узник', named: true, talk: true, pos: sp.prisoner, yaw: -Math.PI / 2, look: { shirt: 0x8a7a6a, pants: 0x4a3e3a, hair: 0xd06a2a, freckles: true, stubble: true } },
    sitDef(sp.jailerSeat, { id: 'bruno', name: 'Бруно', title: 'тюремщик', named: true, talk: true, look: { ...royalGuard, bulk: 1.35, hair: 0x5a4a3a, beard: 0x5a4a3a } }),
    { id: 'mila', name: 'Мила', title: 'служанка', named: true, talk: true, pos: sp.servant, yaw: -2.6, look: { skirt: 0xb9d6f5, shirt: 0xffffff, apron: 0xffffff, hairStyle: 'bun', hair: 0x6b4a36 } },
    sitDef(sp.guardSeats[0], { id: 'offg1', name: 'Стражник', dialog: 'offguard', talk: true, look: royalGuard }),
    sitDef(sp.guardSeats[5], { id: 'offg2', name: 'Стражник', dialog: 'offguard', talk: true, look: { ...royalGuard, hair: 0xe9d3a4, beard: 0xe9d3a4 } }),
    { id: 'anna', name: 'Анна', title: 'мать Нелли', named: true, talk: true, pos: sp.houses.anna, yaw: Math.PI, look: { skirt: 0xf2d0e0, shirt: 0xfff8f0, hairStyle: 'braid', hair: 0xe0a060, apron: 0xfff4f8 } },
    sitDef(sp.houses.tobiasSeat, { id: 'tobias', name: 'Тобиас', title: 'старый сержант', named: true, talk: true, look: { shirt: 0x6a7a9a, pants: 0x4a4a5a, beard: 0xcfcfcf, hair: 0xcfcfcf, longBeard: true, bulk: 1.1 } }),
    { id: 'liza', name: 'Лиза', title: 'ткачиха', named: true, talk: true, pos: sp.houses.liza, yaw: -Math.PI / 2, look: { skirt: 0xc7a6f0, shirt: 0xfff4ea, hairStyle: 'long', hair: 0x2a2a3a, sash: 0xf7a8c8 } },
    { id: 'otto', name: 'Отто', title: 'пекарь', named: true, talk: true, pos: sp.houses.otto, yaw: Math.PI, look: { bulk: 1.25, shirt: 0xfff4e8, apron: 0xffffff, hat: 0xffffff, hair: 0xc8a070, beard: 0xc8a070 } },
  );

  // ---- daily routines ----
  const byId = (id) => defs.find((d) => d.id === id);
  const day = (id, from, to) => { const d = byId(id); if (d) d.schedule = [{ from, to, pos: d.pos, yaw: d.yaw, sit: d.sit, seat: d.seatRef, behavior: d.behavior }]; };
  day('mirta', 7, 20); day('bram', 6, 20); day('selma', 7, 21); day('bertha', 5, 21); day('mila', 7, 22); day('edmund', 8, 22);
  day('pip', 6, 21); day('hector', 6, 21); day('liza', 6, 22); day('otto', 5, 20);
  for (const d of defs) if (/^cit\d/.test(d.id)) day(d.id, 6, 21);
  for (const d of defs) if (/^pat\d/.test(d.id)) day(d.id, 11, 2);
  byId('aurelia').schedule = [
    { from: 7, to: 19, pos: sp.aurelia, yaw: Math.PI },
    { from: 19, to: 24, pos: sp.roofGarden, yaw: 0.3 },
  ];
  byId('cedric').schedule = [
    { from: 7, to: 19, pos: L(49, 0, -16.5), yaw: Math.PI },
    { from: 19, to: 23, pos: L(36.4, 10, -53.2), yaw: 0.2 },
    { from: 23, to: 24, pos: sp.cedricRoom, yaw: Math.PI },
  ];
  const florianDesk = seatAt(CX - 57, CZ + 29.6);
  byId('florian').schedule = [
    { from: 10, to: 17, seat: florianDesk },
    { from: 17, to: 24, pos: sp.florian, yaw: -2.4 },
    { from: 0, to: 2, pos: sp.florian, yaw: -2.4 },
  ];
  byId('nelly').schedule = [
    { from: 8, to: 20, pos: byId('nelly').pos, yaw: 0.4 },
    { from: 20, to: 8, pos: sp.houses.anna.clone().add(V(-3.2, 0, 0.6)), yaw: 0.8 },
  ];
  for (const id of ['offg1', 'offg2']) { const d = byId(id); d.schedule = [{ from: 16, to: 2, seat: d.seatRef }]; }
  // evening crowd in the tavern
  [[-52, 25.05], [-54, 35.55], [-56, 25.05]].forEach(([x, z], i) => defs.push({ ...sitDef(seatAt(CX + x, CZ + z), { id: 'eve' + i, name: 'Посетитель', dialog: 'citizen', talk: true, look: citizen(i + 11, i % 2 === 0) }), schedule: [{ from: 18, to: 2, seat: seatAt(CX + x, CZ + z) }] }));

  // ---- quest objects placed around the castle and the world ----
  const tome = (id, x, y, z, ry) => ({ t: 'pickup', id, item: 'lost_tome', x: CX + x, y: P + y, z: CZ + z, ry, model: 'book', color: '#6a4a8a', cond: (g) => g.quests.active('tomes') && g.quests.stage('tomes') === 0 });
  const tomes = [tome('tome_tavern', -51.2, 0.93, 24.2, 0.4), tome('tome_barracks', 64.8, 0.69, 7.4, 1.2), tome('tome_chapel', -28.4, 10.51, -21.6, 0.2)];
  castle.objects.push(...tomes);
  game.tomeList = tomes;
  // the runaway swarm at the forest edge
  const swx = VILLAGE.x - 150, swz = VILLAGE.z - 70;
  game.swarm = { x: swx, z: swz, y: H(swx, swz) };
  castle.objects.push({
    t: 'custom', make: (g) => {
      const bees = [];
      return {
        kind: 'swarm', pos: V(swx, H(swx, swz) + 1.5, swz), r: 3, active: () => g.quests.active('swarm') && g.quests.stage('swarm') === 0,
        label: () => 'Приманить рой (медовым словом)',
        use: () => { g.quests.setStage('swarm', 1); g.effects.burst(V(swx, H(swx, swz) + 2, swz), '#ffd84a', 60, 3, 0.2, 1.2); g.ui.hint('Рой гудит и облаком летит обратно к пасеке.'); },
        update: (dt) => { if (g.quests.active('swarm') && g.quests.stage('swarm') === 0 && Math.random() < dt * 30 && Math.abs(g.player.pos.x - swx) < 80) g.effects.motes(V(swx, H(swx, swz) + 1.5, swz), '#ffd84a', 2, 1.2, 1.2, 1.5, 0.1); },
      };
    },
  });
  const sx = CAMP.x + 6, sz = CAMP.z - 52;
  game.stash = { x: sx, z: sz, y: H(sx, sz) };
  castle.objects.push({
    t: 'container', id: 'gart_stash', name: 'Тайник Гарта у старого дуба', x: sx, y: game.stash.y, z: sz, r: 2.4, model: 'stash', respawn: 1e9,
    loot: [['gold', [140, 180]], ['gem', 1], ['potion_hp', 2], ['bandit_mask', 1]],
    cond: (g) => g.quests.active('prisoner') && g.quests.stage('prisoner') === 1,
    onUse: (g) => { g.quests.complete('prisoner'); g.addGlimmer(80); },
  });
  // garden
  defs.push({ id: 'cit_g1', name: 'Придворная дама', dialog: 'citizen', talk: true, pos: L(24, 10, -24), behavior: 'wander', wanderR: 6, look: { ...citizen(5, true), skirt: 0xf6b6d2, crown: false } });
  defs.push({ id: 'cit_g2', name: 'Садовник', dialog: 'citizen', talk: true, pos: L(34, 10, -30), behavior: 'wander', wanderR: 6, look: { ...citizen(2, false), hat: 0xe8d8a0 } });
  // villagers
  st.spawns.villagers.forEach((p, i) => defs.push({ id: 'vil' + i, name: 'Селянин', dialog: 'citizen', talk: true, pos: p, behavior: 'wander', wanderR: 12, look: citizen(i + 7, i % 2 === 0) }));

  // ---- the court in the fields (straight from the references) ----
  const knightLook = { armor: 0xf6f4fa, armorTrim: 0xf0c860, pauldrons: true, cape: 0xf2a6c9, capeTrim: 0xf0c860, helmet: 0xf6f4fa, plume: 0xf7b7d2, shirt: 0xf6f2ff, pants: 0xe8e4f0, boots: 0xe8e4f0, weapon: 'spear', shield: 0xf4f6fc, tabard: 0xf6f2ff, emblem: 0xf0c860 };
  // knight & lady strolling through the daisy meadow, a white horse led behind
  const mp = [G(52, 452), G(70, 468), G(76, 492), G(60, 510), G(38, 500), G(34, 474)];
  defs.push({ id: 'sir_alaric', name: 'Сэр Аларик', title: 'рыцарь Люменхолда', named: true, talk: true, dialog: 'alaric', behavior: 'patrol', speed: 0.9, pos: mp[0].clone(), path: mp, look: { ...knightLook, helmet: null, weapon: 'sword', shield: null, hairStyle: 'short', hair: 0xd8b070, hiFace: true, stubble: true } });
  defs.push({ id: 'lady_rosamund', name: 'Леди Розамунда', title: 'придворная дама', named: true, talk: true, dialog: 'rosamund', behavior: 'patrol', speed: 0.9, pos: mp[0].clone().add(V(1.1, 0, 0.4)), path: mp.map((q) => q.clone().add(V(1.1, 0, 0.4))), look: { skirt: 0xfbe4ee, shirt: 0xffffff, hairStyle: 'long', hair: 0xc8904a, puff: true, tiara: true, sash: 0xf7b7d2, hiFace: true } });

  // Honey Vale residents
  defs.push({ id: 'greta', name: 'Грета', title: 'пасечница', named: true, talk: true, pos: G(VILLAGE.x - 4, VILLAGE.z + 37), yaw: Math.PI, look: { skirt: 0xf2d98a, shirt: 0xfff8ee, apron: 0xffffff, hairStyle: 'bun', hair: 0xcfcfcf, hat: 0xf2e6c8 }, schedule: null });
  defs.push({ id: 'hugo', name: 'Гуго', title: 'мельник', named: true, talk: true, pos: G(VILLAGE.x + 40, VILLAGE.z - 18), yaw: -2.2, look: { bulk: 1.2, shirt: 0xf4efe4, apron: 0xfbf8f2, pants: 0x7a6a5a, hair: 0xb8a080, beard: 0xb8a080, hat: 0xf4efe4 } });
  for (const d of defs) game.npcs.push(new NPC(game, d));

  const riders = game.riders = [];
  const alaric = game.npcById('sir_alaric');
  riders.push(new Rider(game, { horse: { coat: 'white', saddle: true, blanket: 0xf2a6c9, feather: true }, follow: { target: alaric, back: 2.8, side: -0.6 }, pos: alaric.pos.clone().add(V(0, 0, -3)), speed: 1.6 }));
  // mounted patrol on the royal road (two knights side by side)
  const road = [G(0, -120), G(0, -60), G(-6, 10), G(-8, 80), G(12, 170), G(16, 280), G(-12, 380), G(-6, 440)];
  const greet = ['Доброго пути, странник!', 'Дороги безопасны, пока мы в седле.', 'Слава королеве Элиане!', 'Берегись волков у леса.'];
  riders.push(new Rider(game, { name: 'Рыцарь дозора', horse: { coat: 'white', saddle: true, blanket: 0xf2a6c9 }, look: knightLook, path: road, lateral: -1.3, speed: 2.4, pause: 20, greet }));
  riders.push(new Rider(game, { name: 'Рыцарь дозора', horse: { coat: 'grey', saddle: true, blanket: 0x9fb8e8 }, look: { ...knightLook, cape: 0x9fb8e8, plume: 0xb9d6f5 }, path: road, lateral: 1.3, speed: 2.4, pause: 20, greet }));
  // a lady riding a white horse through the golden field
  const gf = [G(-70, 400), G(-40, 395), G(-25, 420), G(-40, 450), G(-75, 452), G(-90, 425)];
  riders.push(new Rider(game, { name: 'Леди Изольда', horse: { coat: 'white', saddle: true, blanket: 0xf7c8dc, trim: 0xf0c860, bridle: 0xf4f0ff, feather: true, goldHooves: true }, look: { skirt: 0xfff2c8, shirt: 0xffffff, hairStyle: 'long', hair: 0xf2d68a, tiara: true, cape: 0xf7b7d2, puff: true, hiFace: true }, path: gf, loop: true, speed: 1.9, greet: ['Какой чудесный день для прогулки!', 'Вы видели, как цветут луга у озера?'] }));
  // horses resting in the royal stables
  for (const [x, z, yaw, coat, bl] of [[53.5, -29, Math.PI / 2, 'grey', 0x9fb8e8], [53.5, -34.5, Math.PI / 2, 'bay', 0x6f7fd8], [62.3, -34, -Math.PI / 2, 'chestnut', 0xc94f7c], [62.3, -29.5, -Math.PI / 2, 'palomino', 0xf2a6c9]]) {
    riders.push(new Rider(game, { horse: { coat, saddle: false, bridleOnly: true, blanket: bl }, pos: L(x, 0, z), yaw, graze: true }));
  }

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
  // new creatures: forest trolls in the deep woods, twilight spiders, dusk mages on the way to the crag
  add('troll', G(-450, 30), { yaw: 1.2 });
  add('troll', G(-230, -110), { yaw: 2.4 });
  pack('spider', -320, -140, 2);
  pack('spider', -470, 120, 2);
  add('spider', G(-200, 40));
  add('duskmage', G(-350, -270));
  add('duskmage', G(-300, -330));
  add('duskmage', G(460, -110));
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
  const animalAt = (species, x, z, anywhere = false) => {
    if (H(x, z) < WORLD.water + 0.5 || (!anywhere && isFlatZone(x, z))) return;
    game.animals.push(new Animal(game, species, G(x, z)));
  };
  const herds = [[60, 380], [-120, 400], [150, 300], [-200, 280], [240, -120], [-60, 120], [100, -60]];
  herds.forEach(([x, z]) => { for (let i = 0; i < 3; i++) animalAt('deer', x + (rnd() - 0.5) * 12, z + (rnd() - 0.5) * 12); });
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 40 + rnd() * 460;
    animalAt('rabbit', Math.cos(a) * r, Math.sin(a) * r * 0.9 + 60);
  }
  for (let i = 0; i < 6; i++) animalAt('fox', FOREST.x + (rnd() - 0.5) * 300, FOREST.z + (rnd() - 0.5) * 300);
  for (let i = 0; i < 10; i++) animalAt('squirrel', FOREST.x + (rnd() - 0.5) * 360, FOREST.z + (rnd() - 0.5) * 360);
  // Marta's flock and cows on the pastures of Honey Vale
  for (let i = 0; i < 7; i++) animalAt('sheep', VILLAGE.x - 40 + (rnd() - 0.5) * 16, VILLAGE.z - 30 + (rnd() - 0.5) * 16, true);
  for (let i = 0; i < 3; i++) animalAt('cow', VILLAGE.x + 45 + (rnd() - 0.5) * 14, VILLAGE.z - 20 + (rnd() - 0.5) * 14, true);
  // swans on the Mirror Lake
  game.swans = [new Swans(game.scene, V(270, 0, -20), 5, 55, WORLD.water), new Swans(game.scene, V(360, 0, -90), 3, 30, WORLD.water)];

  // birds
  const flocks = [[0, 380], [-300, 60], [300, 40], [0, -260], [260, 340], [-150, -150]];
  for (const [x, z] of flocks) game.birds.push(new BirdFlock(game.scene, V(x, H(x, z), z), 6 + Math.floor(rnd() * 4), [0xffffff, 0xf8e8ff, 0xfff0e0][Math.floor(rnd() * 3)]));
}
