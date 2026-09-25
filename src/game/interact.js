// World interactables: altars, chests, gatherables, campfires, elevator,
// the lost cat, dawn shards, lost glimmer, the fog gate.
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { getMaterials, Builder } from '../world/builder.js';
import { Quadruped } from '../entities/quadruped.js';
import { ALTARS } from '../world/layout.js';
import { buildWorldObjects } from './objects.js';

const GATHER = {
  herb: { item: 'herb', n: [1, 2], label: 'Сорвать солнечник', respawn: 240 },
  mushroom: { item: 'mushroom', n: [1, 2], label: 'Собрать грибы', respawn: 240 },
  moonflower: { item: 'moonflower', n: [1, 1], label: 'Сорвать лунный цветок', respawn: 300 },
  ore: { item: 'iron_ore', n: [1, 2], label: 'Добыть железную руду', respawn: 360 },
  crystal: { item: 'light_crystal', n: [1, 1], label: 'Добыть светлый кристалл', respawn: 420 },
  apple: { item: 'apple', n: [2, 3], label: 'Сорвать яблоки', respawn: 200 },
  honey: { item: 'honey', n: [1, 1], label: 'Собрать мёд', respawn: 300 },
  raspberry: { item: 'berries', n: [2, 4], label: 'Собрать малину', respawn: 360 },
  blueberry: { item: 'berries', n: [2, 4], label: 'Собрать чернику', respawn: 360 },
};

// leafy bush with berries on a separate (hideable) mesh, merged per material
function berryBush(kind, seed) {
  const rnd = (i) => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  const leafB = new Builder(null), berryB = new Builder(null);
  const leafCols = kind === 'raspberry' ? ['#5f9a4a', '#6ea854', '#4f8a40'] : ['#4f8a5a', '#5f9a64', '#6aa070'];
  const berryCols = kind === 'raspberry' ? ['#e0405a', '#c8304a', '#f06078'] : ['#4a4ab0', '#5a4ac8', '#3a3a8a'];
  const R = 0.55 + rnd(1) * 0.2;
  for (let i = 0; i < 16; i++) {
    const a = rnd(i + 2) * Math.PI * 2, h = rnd(i + 30) * 0.7, rr = R * (0.3 + rnd(i + 60) * 0.7) * (1 - h * 0.6);
    leafB.sphere('plain', Math.cos(a) * rr, 0.25 + h * R * 1.1, Math.sin(a) * rr, 0.22 + rnd(i + 90) * 0.12, { color: new THREE.Color(leafCols[i % 3]), ao: false, sy: 0.8 });
  }
  for (let i = 0; i < 26; i++) {
    const a = rnd(i + 120) * Math.PI * 2, e = 0.15 + rnd(i + 150) * 1.1;
    const rr = R * 0.95 * Math.cos(e * 0.7), yy = 0.25 + Math.sin(e) * R * 0.85;
    berryB.sphere('plain', Math.cos(a) * rr, yy, Math.sin(a) * rr, kind === 'raspberry' ? 0.045 : 0.038, { color: new THREE.Color(berryCols[i % 3]), ao: false });
  }
  const g = new THREE.Group();
  const leaves = leafB.build(); const berries = berryB.build();
  g.add(leaves, berries);
  g.userData.berries = berries;
  g.userData.bush = true;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function gatherMesh(kind, seed = 0) {
  if (kind === 'raspberry' || kind === 'blueberry') return berryBush(kind, seed + 1);
  const g = new THREE.Group();
  const M = getMaterials();
  if (kind === 'herb') {
    const stem = new THREE.MeshLambertMaterial({ color: 0x6f9e55 });
    const petal = new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xffb020, emissiveIntensity: 0.25 });
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 4), stem);
      s.position.set(Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), petal);
      f.position.set(Math.cos(a) * 0.15, 0.52, Math.sin(a) * 0.15);
      f.scale.y = 0.6;
      g.add(s, f);
    }
  } else if (kind === 'mushroom') {
    const stemM = new THREE.MeshLambertMaterial({ color: 0xf4efe4 });
    const capM = new THREE.MeshStandardMaterial({ color: 0xf07a7a, roughness: 0.6 });
    const dotM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1, sc = 0.7 + i * 0.2;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 16), stemM);
      s.position.set(Math.cos(a) * 0.18, 0.12 * sc, Math.sin(a) * 0.18);
      s.scale.setScalar(sc);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), capM);
      c.position.set(Math.cos(a) * 0.18, 0.24 * sc, Math.sin(a) * 0.18);
      c.scale.setScalar(sc);
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 4), dotM);
      d.position.set(Math.cos(a) * 0.18 + 0.05, 0.36 * sc, Math.sin(a) * 0.18);
      g.add(s, c, d);
    }
  } else if (kind === 'moonflower') {
    const stem = new THREE.MeshLambertMaterial({ color: 0x6f9e95 });
    const petal = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x7fbfff, emissiveIntensity: 1.2 });
    g.userData.glowMat = petal;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.2;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.6, 4), stem);
      s.position.set(Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 12, 1, true), petal);
      f.rotation.x = Math.PI;
      f.position.set(Math.cos(a) * 0.12, 0.66, Math.sin(a) * 0.12);
      g.add(s, f);
    }
  } else if (kind === 'crystal') {
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), M.crystal);
      c.scale.set(0.6, 1.6 + i * 0.4, 0.6);
      c.position.set(Math.cos(i * 1.6) * 0.3, 0.4 + i * 0.1, Math.sin(i * 1.6) * 0.3);
      c.rotation.z = (i - 1.5) * 0.25;
      g.add(c);
    }
  } else if (kind === 'ore') {
    const rock = new THREE.MeshStandardMaterial({ color: 0x7a7680, roughness: 0.9, flatShading: true });
    const fleck = new THREE.MeshStandardMaterial({ color: 0xd8dce8, roughness: 0.25, metalness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 - i * 0.08, 0), rock);
      r.position.set(Math.cos(i * 2.1) * 0.35, 0.2, Math.sin(i * 2.1) * 0.35);
      r.rotation.set(i, i * 2, 0);
      r.scale.y = 0.75;
      g.add(r);
      for (let k = 0; k < 3; k++) {
        const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), fleck);
        f.position.set(r.position.x + Math.cos(k * 2 + i) * 0.28, 0.3 + k * 0.05, r.position.z + Math.sin(k * 2 + i) * 0.28);
        g.add(f);
      }
    }
  } else if (kind === 'apple') {
    const am = new THREE.MeshStandardMaterial({ color: 0xe8485a, roughness: 0.45 });
    for (let i = 0; i < 4; i++) {
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), am);
      a.position.set(Math.cos(i * 1.7) * 0.5, Math.sin(i * 2.3) * 0.3, Math.sin(i * 1.7) * 0.5);
      g.add(a);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function chestMesh() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xa8784f, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf0c860, metalness: 0.9, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.75, 4, 3, 3), wood);
  body.position.y = 0.3;
  g.add(body);
  for (const x of [-0.45, 0.45]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.78), gold);
    band.position.set(x, 0.3, 0);
    g.add(band);
  }
  const lid = new THREE.Group();
  lid.position.set(0, 0.6, -0.375);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 1.2, 24, 1, false, 0, Math.PI), wood);
  top.rotation.z = Math.PI / 2;
  top.position.z = 0.375;
  lid.add(top);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), gold);
  lock.position.set(0, 0.05, 0.76);
  lid.add(lock);
  // detail: plank grooves, lid bands, corner caps, feet, keyhole, studs
  const dark = new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: 0.9 });
  for (let k = 1; k < 4; k++) { const gr = new THREE.Mesh(new THREE.BoxGeometry(1.205, 0.012, 0.755), dark); gr.position.y = k * 0.15; g.add(gr); }
  for (const x of [-0.45, 0.45]) {
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.1, 24, 1, true, 0, Math.PI), gold);
    lb.rotation.z = Math.PI / 2; lb.position.set(x, 0, 0.375); lid.add(lb);
    for (const z of [-0.39, 0.39]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), gold); cap.position.set(x * 1.3, 0.07, z); g.add(cap);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), gold); foot.position.set(x * 1.25, 0.02, z * 0.85); g.add(foot);
    }
    for (let k = 0; k < 4; k++) { const stud = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), gold); stud.position.set(x, 0.1 + k * 0.14, 0.395); g.add(stud); }
  }
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), dark); keyhole.rotation.x = Math.PI / 2; keyhole.position.set(0, 0.03, 0.795); lid.add(keyhole);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 1), new THREE.MeshStandardMaterial({ color: 0xff9ecb, emissive: 0xff5fa0, emissiveIntensity: 0.6, roughness: 0.2 }));
  gem.position.set(0, 0.36, 0.44); lid.add(gem);
  g.add(lid);
  const glow = new THREE.PointLight(0xffd88a, 0, 4);
  glow.position.set(0, 0.8, 0);
  g.add(glow);
  g.userData.lid = lid;
  g.userData.glow = glow;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export class Interactables {
  constructor(game, castle, structures) {
    this.game = game;
    this.list = [];
    const g = game;
    const scene = g.scene;
    const H = (x, z) => g.terrain.getHeight(x, z);

    // altars
    for (const a of structures.altars) {
      this.list.push({
        kind: 'altar', pos: a.pos, r: 3.4, data: a,
        label: () => g.state.altars.includes(a.id) ? 'Отдохнуть у алтаря' : 'Коснуться алтаря',
        use: () => g.useAltar(a),
      });
    }
    // chests
    for (const c of structures.chests) {
      const y = H(c.x, c.z);
      const mesh = chestMesh();
      mesh.position.set(c.x, y, c.z);
      mesh.rotation.y = c.ry;
      scene.add(mesh);
      g.collision.addBox(c.x, c.z, 0.6, 0.4, y, y + 0.9, c.ry, { walkable: true });
      const it = {
        kind: 'chest', pos: new THREE.Vector3(c.x, y, c.z), r: 2.2, data: c, mesh, openT: -1,
        active: () => !g.state.chests.includes(c.id),
        label: () => 'Открыть сундук',
        use: () => {
          g.state.chests.push(c.id);
          it.openT = 0;
          g.audio.play('chest');
          for (const [id, n] of c.loot) {
            if (id === 'gold') g.addGold(n); else g.giveItem(id, n);
          }
        },
        update: (dt) => {
          const opened = g.state.chests.includes(c.id);
          const lid = mesh.userData.lid;
          const target = opened ? -1.9 : 0;
          lid.rotation.x += (target - lid.rotation.x) * Math.min(1, dt * 4);
          if (it.openT >= 0) {
            it.openT += dt;
            mesh.userData.glow.intensity = Math.max(0, 3 * (1 - it.openT / 2));
            if (it.openT < 0.8 && Math.random() < 0.5) g.effects.motes(new THREE.Vector3(c.x, y + 0.6, c.z), '#ffe6a0', 2, 0.4, 1.5, 1);
          }
        },
      };
      this.list.push(it);
    }
    // gatherables
    structures.gather.forEach((n, i) => {
      const def = GATHER[n.kind];
      const id = n.kind + '_' + i;
      let mesh = null;
      if (n.kind !== 'honey') {
        mesh = gatherMesh(n.kind, i);
        mesh.position.set(n.x, n.y, n.z);
        mesh.rotation.y = i * 1.3;
        scene.add(mesh);
      }
      const it = {
        kind: 'gather', pos: new THREE.Vector3(n.x, n.y, n.z), r: n.kind === 'apple' ? 3.2 : 2.0, mesh, gk: n.kind,
        active: () => (g.state.gathered[id] || 0) <= g.state.stats.time,
        label: () => def.label,
        use: () => {
          const cnt = def.n[0] + Math.floor(Math.random() * (def.n[1] - def.n[0] + 1));
          g.giveItem(def.item, cnt);
          g.state.gathered[id] = g.state.stats.time + def.respawn;
          g.audio.play('pickup', 0.7);
          g.effects.motes(it.pos, n.kind === 'moonflower' ? '#bfe0ff' : '#fff0b0', 10, 0.3, 1.2, 1);
        },
        update: (dt, t) => {
          if (!mesh) return;
          const vis = it.active();
          if (mesh.userData.bush) { mesh.visible = (it.d2 ?? 0) < 14400; mesh.userData.berries.visible = vis; return; }
          mesh.visible = vis;
          if (vis && mesh.userData.glowMat) mesh.userData.glowMat.emissiveIntensity = (g.sky.isNight() ? 2.2 : 0.8) + Math.sin(t * 2 + i) * 0.3;
          if (vis && n.kind === 'crystal') mesh.rotation.y += dt * 0.2;
        },
      };
      this.list.push(it);
    });
    // campfires (cooking)
    for (const f of structures.campfires) {
      g.effects.addFire(new THREE.Vector3(f.x, f.y + 0.1, f.z), 1);
      this.list.push({ kind: 'fire', pos: f, r: 2.6, label: () => 'Готовить на костре', use: () => g.ui.open('cook') });
    }
    // tavern hearth + smithy forge fire effects
    g.effects.addFire(new THREE.Vector3(castle.spawn.forgeLight.x, castle.spawn.forgeLight.y - 0.8, castle.spawn.forgeLight.z), 0.8);
    g.effects.addFire(castle.spawn.tavernFire, 0.7);
    g.effects.addSparkleSource(castle.spawn.cauldron, 0.5, 6, '#b8ffb0', 0.35);
    this.list.push({ kind: 'alchemy', pos: castle.spawn.cauldron.clone().add(new THREE.Vector3(0, -1, 0)), r: 2.2, label: () => 'Варить зелья в котле', use: () => g.ui.open('cook', { alchemy: true }) });
    for (const f of castle.fires?.big || []) g.effects.addFire(f, 0.6, 60);
    for (const f of castle.fires?.small || []) g.effects.addFire(f, 0.18, 30);
    for (const f of structures.fires || []) g.effects.addFire(f, 0.45, 50);

    // levitation disc
    const el = castle.elevator;
    this.list.push({
      kind: 'lift', pos: el.mesh.position, r: 2.0, priority: 2,
      active: () => !el.moving() && Math.abs(g.player.pos.y - el.col.y) < 0.6 && Math.hypot(g.player.pos.x - el.mesh.position.x, g.player.pos.z - el.mesh.position.z) < 2.0,
      label: () => el.atTop() ? 'Спуститься на левитационном круге' : 'Подняться в обсерваторию',
      use: () => {
        if (!g.itemCount('royal_seal')) { g.ui.hint('Руны на круге молчат. Нужна королевская печать.'); return; }
        el.target = el.atTop() ? el.bottom : el.top;
        g.audio.play('lift');
      },
    });

    // cat
    const cat = new Quadruped('cat');
    cat.root.position.copy(castle.spawn.cat);
    cat.root.rotation.y = 2.4;
    scene.add(cat.root);
    this.cat = cat;
    this.catSpot = castle.spawn.cat.clone();
    this.catHome = castle.spawn.fountain.clone().add(new THREE.Vector3(3.5, 0, 6.5));
    this.list.push({
      kind: 'cat', pos: cat.root.position, r: 2.2,
      active: () => g.quests.active('cat') && g.quests.stage('cat') === 0,
      label: () => 'Взять Пушка на руки',
      use: () => {
        g.state.flags.cat_found = true;
        g.audio.play('pickup');
        g.ui.notify('Пушок мурлычет у вас на руках и... спрыгивает, убегая к Нелли.');
        g.quests.setStage('cat', 1);
        this.placeCat();
      },
      update: (dt) => cat.update(dt, { speed: 0, graze: false }),
    });
    this.placeCat();

    // fog gate
    const fg = structures.fogGate;
    if (fg) {
      fg.collider = g.collision.addBox(fg.x, fg.z, 5, 0.6, fg.y - 2, fg.y + 12, fg.angle, { walkable: false });
      this.fog = fg;
      this.list.push({
        kind: 'fog', pos: new THREE.Vector3(fg.x, fg.y, fg.z), r: 5,
        active: () => fg.collider.y1 > 0,
        label: () => g.shardCount() >= 2 ? 'Пройти сквозь сумрачный барьер' : 'Сумрачный барьер',
        use: () => {
          if (g.shardCount() >= 2 || g.state.flags.shard_crag) {
            this.openFog();
            g.audio.play('gate');
            g.ui.hint('Осколки вспыхивают — сумрак расступается.');
          } else g.ui.hint('Барьер не пускает. Нужны два Осколка Рассвета.');
        },
        update: (dt, t) => {
          fg.mat.opacity = fg.collider.y1 > 0 ? 0.3 + Math.sin(t * 2) * 0.08 : Math.max(0, fg.mat.opacity - dt);
          fg.mesh.visible = fg.mat.opacity > 0.01;
        },
      });
      if (g.state.flags.fogOpen) this.openFog();
    }
    // unicorn
    this.list.push({
      kind: 'mount', pos: g.mount.pos, r: 2.8,
      active: () => g.mount.summoned && !g.player.mount,
      label: () => 'Оседлать Астру',
      use: () => g.player.mountUp(g.mount),
    });
    // doors, pickups, books, containers, seats, beds
    this.list.push(...buildWorldObjects(g, (castle.objects || []).concat(structures.objects || [])));
    this.dynamic = [];
  }

  openFog() {
    const fg = this.fog;
    if (!fg) return;
    fg.collider.y0 = -1000; fg.collider.y1 = -999;
    this.game.state.flags.fogOpen = true;
  }

  // a new game / an older save: the barrier stands again
  closeFog() {
    const fg = this.fog;
    if (!fg) return;
    fg.collider.y0 = fg.y - 2; fg.collider.y1 = fg.y + 12;
  }

  placeCat() {
    const g = this.game;
    if (g.state.flags.cat_found) {
      this.cat.root.position.copy(this.catHome);
      this.cat.root.rotation.y = -0.6;
    } else {
      this.cat.root.position.copy(this.catSpot);
      this.cat.root.rotation.y = 2.4;
    }
  }

  // dynamic pickups (dawn shards, lost glimmer)
  addShard(pos, flag) {
    const g = this.game;
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd27a, emissiveIntensity: 2.2 });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat);
    mesh.scale.set(0.7, 1.4, 0.7);
    const p = pos.clone();
    p.y = g.collision.groundHeight(p.x, p.z, p.y + 2) + 1.2;
    mesh.position.copy(p);
    g.scene.add(mesh);
    const light = new THREE.PointLight(0xffd88a, 4, 10);
    light.position.copy(p);
    g.scene.add(light);
    const it = {
      kind: 'shard', pos: p, r: 2.5, priority: 3, flag,
      dispose: () => { g.scene.remove(mesh); g.scene.remove(light); mat.dispose(); mesh.geometry.dispose(); },
      label: () => 'Взять Осколок Рассвета',
      use: () => {
        g.giveItem('dawn_shard', 1);
        g.state.flags[flag] = true;
        g.scene.remove(mesh); g.scene.remove(light);
        this.dynamic.splice(this.dynamic.indexOf(it), 1);
        g.audio.play('levelup');
        g.effects.burst(p, '#ffe08a', 80, 6, 0.4, 1.4);
        g.ui.bigText('Осколок Рассвета', `Собрано: ${g.shardCount()} из 3`, 'victory');
        if (g.shardCount() >= 2 && !g.state.flags.fogOpen) g.ui.hint('Два осколка сияют вместе. Барьер на Сумеречном утёсе ослаб.', 6);
        if (g.shardCount() >= 3 && g.quests.stage('main2') === 1) g.quests.setStage('main2', 2);
        g.save(false);
      },
      update: (dt, t) => {
        mesh.rotation.y += dt * 2;
        mesh.position.y = p.y + Math.sin(t * 2) * 0.15;
        if (Math.random() < dt * 20) g.effects.motes(p, '#ffe6a0', 1, 0.3, 0.8, 1, 0.15);
      },
    };
    this.dynamic.push(it);
  }

  // loading a save: shards on the ground belong to the old session (applyState re-drops unclaimed ones)
  clearShards() {
    for (let i = this.dynamic.length - 1; i >= 0; i--) {
      const it = this.dynamic[i];
      if (it.kind !== 'shard') continue;
      it.dispose();
      this.dynamic.splice(i, 1);
    }
  }

  setLostGlimmer(lg) {
    const g = this.game;
    if (this.glimmerObj) { g.scene.remove(this.glimmerObj.mesh); this.dynamic.splice(this.dynamic.indexOf(this.glimmerObj), 1); this.glimmerObj = null; }
    if (!lg) return;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), new THREE.MeshStandardMaterial({ color: 0xe8dcff, emissive: 0xb89cff, emissiveIntensity: 2.5 }));
    const p = new THREE.Vector3(lg.x, lg.y + 1, lg.z);
    mesh.position.copy(p);
    g.scene.add(mesh);
    const it = {
      kind: 'glimmer', pos: p, r: 1.8, auto: true, mesh,
      label: () => 'Вернуть сияние',
      use: () => {
        g.state.player.glimmer += lg.amount;
        g.ui.notify(`Возвращено сияние: <b>${lg.amount}</b>`);
        g.audio.play('levelup');
        g.effects.burst(p, '#d8c8ff', 50, 4, 0.35, 1.2);
        g.state.lostGlimmer = null;
        this.setLostGlimmer(null);
      },
      update: (dt, t) => {
        mesh.position.y = p.y + Math.sin(t * 2.5) * 0.2;
        if (Math.random() < dt * 25) g.effects.motes(p, '#c8b4ff', 1, 0.3, 1.2, 1.2, 0.15);
      },
    };
    this.glimmerObj = it;
    this.dynamic.push(it);
  }

  update(dt, t) {
    const g = this.game;
    const p = g.player;
    let best = null, bd = Infinity;
    const all = this.list.concat(this.dynamic);
    for (const it of all) {
      const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z, dy = it.pos.y - p.pos.y;
      const d2 = dx * dx + dz * dz;
      it.near = d2 < 1600 && Math.abs(dy) < 30;
      it.d2 = d2;
      if (it.update) it.update(dt, t);
      if (it.active && !it.active()) continue;
      if (d2 > it.r * it.r || dy < -1.9 || dy > 2.9) continue;
      const d = Math.sqrt(d2);
      if (it.auto) { it.use(); continue; }
      const score = d - (it.priority || 0);
      if (score < bd) { bd = score; best = it; }
    }
    // NPCs
    let npc = null;
    if (!p.mount) {
      for (const n of g.npcs) {
        if (!n.visible || !n.def.talk) continue;
        const d = n.pos.distanceTo(p.pos);
        if (d < 2.8 && d - 0.5 < bd) { bd = d - 0.5; npc = n; }
      }
    }
    this.current = npc ? { npc } : best;
    if (g.mode === 'play' && p.state === 'sit') { g.ui.prompt('Встать'); return; }
    if (g.mode !== 'play' || p.state === 'dead' || (p.state !== 'free' && p.state !== 'block')) { g.ui.prompt(null); return; }
    if (npc) g.ui.prompt('Говорить: ' + npc.name);
    else if (best) g.ui.prompt(best.label(), best.steal ? 'steal' : '');
    else g.ui.prompt(null);
    if (g.input.hit('KeyE') && !p.mount) {
      if (npc) g.startDialog(npc);
      else if (best) best.use();
    }
  }
}

export { ALTARS };
