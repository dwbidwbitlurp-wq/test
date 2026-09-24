// Interactive world objects: hinged doors, items you can pick up (or steal),
// readable books & notes, lootable containers, seats and beds.
// Structures push plain descriptors; this module builds meshes + interactables.
import * as THREE from 'three';
import { Builder } from '../world/builder.js';
import { ITEMS } from './items.js';
import { BOOKS } from './books.js';

const C = (h) => new THREE.Color(h);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const SPH = new THREE.SphereGeometry(1, 14, 10);
const TOR = new THREE.TorusGeometry(1, 0.22, 8, 20);
const OCT = new THREE.OctahedronGeometry(1, 0);
const WEDGE = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI * 0.4);
const HALF = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);

let GLASS = null;
function glass() {
  if (!GLASS) GLASS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.82, envMapIntensity: 1.4 });
  return GLASS;
}

const rot = (ry, x, z) => [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];

// ---------- small prop models (built around the local origin, resting on y=0) ----------
function model(kind, B, opts = {}) {
  const u = { worldUV: false, ao: false };
  switch (kind) {
    case 'bottle': {
      const c = C(opts.color || '#6a1f3a');
      B.add(glass(), CYL, 0, 0.13, 0, 0, 0, 0, 0.06, 0.26, 0.06, { ...u, color: c });
      B.add(glass(), SPH, 0, 0.26, 0, 0, 0, 0, 0.058, 0.04, 0.058, { ...u, color: c });
      B.add(glass(), CYL, 0, 0.32, 0, 0, 0, 0, 0.018, 0.1, 0.018, { ...u, color: c });
      B.add('wood', CYL, 0, 0.38, 0, 0, 0, 0, 0.02, 0.03, 0.02, { ...u, color: C('#c9a57a') });
      B.add('plain', CYL, 0, 0.12, 0, 0, 0, 0, 0.061, 0.08, 0.061, { ...u, color: C('#f3e6c8') });
      break;
    }
    case 'potion': {
      const c = C(opts.color || '#ff6b8a');
      B.add(glass(), SPH, 0, 0.09, 0, 0, 0, 0, 0.085, 0.085, 0.085, { ...u, color: c });
      B.add(glass(), CYL, 0, 0.19, 0, 0, 0, 0, 0.022, 0.07, 0.022, { ...u, color: C('#e8f0ff') });
      B.add('wood', CYL, 0, 0.235, 0, 0, 0, 0, 0.025, 0.03, 0.025, { ...u, color: C('#c9a57a') });
      break;
    }
    case 'bread':
      B.add('plain', SPH, 0, 0.06, 0, 0, 0, 0, 0.16, 0.08, 0.1, { ...u, color: C('#d9a05b') });
      for (let i = -1; i <= 1; i++) B.add('plain', BOX, i * 0.06, 0.125, 0, 0, 0.5, 0, 0.012, 0.012, 0.09, { ...u, color: C('#f6dcae') });
      break;
    case 'roll':
      B.add('plain', SPH, 0, 0.045, 0, 0, 0, 0, 0.07, 0.05, 0.07, { ...u, color: C('#c98a4a') });
      B.add('plain', SPH, 0, 0.07, 0, 0, 0, 0, 0.055, 0.03, 0.055, { ...u, color: C('#fff6ea') });
      B.add('plain', SPH, 0, 0.1, 0, 0, 0, 0, 0.018, 0.018, 0.018, { ...u, color: C('#e8485a') });
      break;
    case 'cheese':
      B.add('plain', WEDGE, 0, 0.06, 0, 0, 0.3, 0, 0.2, 0.12, 0.2, { ...u, color: C('#ffd35a') });
      B.add('plain', CYL, 0.02, 0.06, 0.02, 0, 0, 0, 0.03, 0.122, 0.03, { ...u, color: C('#ffe28a') });
      break;
    case 'apple':
      for (let i = 0; i < 3; i++) B.add('plain', SPH, Math.cos(i * 2.1) * 0.07, 0.06, Math.sin(i * 2.1) * 0.07, 0, 0, 0, 0.06, 0.058, 0.06, { ...u, color: C(i === 1 ? '#f6c04a' : '#e8485a') });
      break;
    case 'berries':
      B.add('wood', CYL, 0, 0.04, 0, 0, 0, 0, 0.12, 0.08, 0.12, { ...u, color: C('#c9a06a') });
      for (let i = 0; i < 9; i++) B.add('plain', SPH, Math.cos(i * 2.4) * 0.06 * (i % 3) * 0.6, 0.09 + (i % 2) * 0.02, Math.sin(i * 2.4) * 0.06 * (i % 3) * 0.6, 0, 0, 0, 0.03, 0.03, 0.03, { ...u, color: C(i % 3 ? '#b8406a' : '#5a4ab8') });
      break;
    case 'ham':
      B.add('plain', SPH, 0, 0.1, 0, 0, 0.4, 0.2, 0.2, 0.1, 0.12, { ...u, color: C('#b0653a') });
      B.add('plain', CYL, 0.2, 0.1, -0.08, 0, 0.4, Math.PI / 2, 0.025, 0.14, 0.025, { ...u, color: C('#f4efe4') });
      break;
    case 'coins':
      for (let i = 0; i < 7; i++) B.add('gold', CYL, Math.cos(i * 2.2) * 0.05 * (i % 3), 0.006 + Math.floor(i / 3) * 0.012, Math.sin(i * 2.2) * 0.05 * (i % 3), (i % 2) * 0.1, 0, 0, 0.035, 0.01, 0.035, { ...u });
      break;
    case 'purse':
      B.add('fabric', SPH, 0, 0.08, 0, 0, 0, 0, 0.1, 0.09, 0.1, { ...u, color: C('#8a5a9a') });
      B.add('gold', TOR, 0, 0.16, 0, Math.PI / 2, 0, 0, 0.04, 0.04, 0.04, { ...u });
      B.add('gold', CYL, 0.13, 0.006, 0.02, 0, 0, 0, 0.03, 0.01, 0.03, { ...u });
      break;
    case 'key':
      B.add('gold', TOR, -0.07, 0.012, 0, Math.PI / 2, 0, 0, 0.035, 0.035, 0.035, { ...u });
      B.add('gold', BOX, 0.03, 0.012, 0, 0, 0, 0, 0.14, 0.014, 0.014, { ...u });
      B.add('gold', BOX, 0.09, 0.012, 0.018, 0, 0, 0, 0.018, 0.012, 0.03, { ...u });
      B.add('gold', BOX, 0.06, 0.012, 0.014, 0, 0, 0, 0.012, 0.012, 0.022, { ...u });
      break;
    case 'gem':
      B.add('crystalPink', OCT, 0, 0.06, 0, 0, 0.4, 0, 0.05, 0.07, 0.05, { ...u });
      break;
    case 'ring':
      B.add('iron', TOR, 0, 0.012, 0, Math.PI / 2, 0, 0, 0.03, 0.03, 0.03, { ...u, color: C('#f2f4ff') });
      B.add('crystalPink', OCT, 0.03, 0.02, 0, 0, 0, 0, 0.012, 0.014, 0.012, { ...u });
      break;
    case 'sword':
      B.add('iron', BOX, 0.1, 0.02, 0, 0, 0, 0, 0.8, 0.012, 0.055, { ...u, color: C('#eef2fa') });
      B.add('gold', BOX, -0.32, 0.025, 0, 0, 0, 0, 0.04, 0.03, 0.26, { ...u });
      B.add('wood', CYL, -0.42, 0.025, 0, 0, 0, Math.PI / 2, 0.02, 0.18, 0.02, { ...u, color: C('#5a3a2a') });
      B.add('gold', SPH, -0.52, 0.025, 0, 0, 0, 0, 0.032, 0.032, 0.032, { ...u });
      break;
    case 'book': {
      const c = C(opts.color || '#8a4a5a');
      B.add('plain', BOX, 0, 0.035, 0, 0, 0, 0, 0.32, 0.06, 0.24, { ...u, color: C('#f6ecd6') });
      B.add('plain', BOX, 0, 0.004, 0, 0, 0, 0, 0.34, 0.008, 0.26, { ...u, color: c });
      B.add('plain', BOX, 0, 0.066, 0, 0, 0, 0, 0.34, 0.008, 0.26, { ...u, color: c });
      B.add('plain', BOX, -0.168, 0.035, 0, 0, 0, 0, 0.012, 0.07, 0.26, { ...u, color: c });
      B.add('gold', BOX, 0.02, 0.071, 0, 0, 0, 0, 0.12, 0.004, 0.12, { ...u });
      break;
    }
    case 'openbook': {
      const c = C(opts.color || '#6a4a8a');
      for (const s of [-1, 1]) {
        B.add('plain', BOX, s * 0.16, 0.02 + 0.012, 0, 0, 0, -s * 0.12, 0.3, 0.025, 0.22, { ...u, color: C('#fbf3df') });
        B.add('plain', BOX, s * 0.16, 0.012, 0, 0, 0, -s * 0.12, 0.32, 0.01, 0.24, { ...u, color: c });
        for (let l = 0; l < 5; l++) B.add('plain', BOX, s * 0.16, 0.047, -0.07 + l * 0.035, 0, 0, -s * 0.12, 0.22, 0.002, 0.006, { ...u, color: C('#7a6a8a') });
      }
      B.add('fabric', BOX, 0.02, 0.03, 0.12, 0, 0, 0, 0.012, 0.004, 0.12, { ...u, color: C('#c94f7c') });
      break;
    }
    case 'note':
      B.add('plain', BOX, 0, 0.003, 0, 0, 0.2, 0, 0.21, 0.004, 0.28, { ...u, color: C('#fbf3df') });
      for (let l = 0; l < 6; l++) B.add('plain', BOX, 0.01, 0.0055, -0.1 + l * 0.035, 0, 0.2, 0, 0.15, 0.001, 0.006, { ...u, color: C('#8a7a9a') });
      break;
    case 'scroll':
      B.add('plain', CYL, 0, 0.035, 0, 0, 0.3, Math.PI / 2, 0.035, 0.3, 0.035, { ...u, color: C('#f6ecd6') });
      B.add('fabric', CYL, 0, 0.035, 0, 0, 0.3, Math.PI / 2, 0.037, 0.03, 0.037, { ...u, color: C('#c94f7c') });
      break;
    case 'lute':
      B.add('wood', SPH, 0, 0.06, 0, 0, 0, 0, 0.2, 0.06, 0.15, { ...u, color: C('#c08850') });
      B.add('wood', BOX, 0.36, 0.08, 0, 0, 0, 0, 0.45, 0.025, 0.05, { ...u, color: C('#6a4a36') });
      B.add('wood', BOX, 0.6, 0.09, 0, 0, 0, -0.5, 0.1, 0.02, 0.06, { ...u, color: C('#6a4a36') });
      B.add('plain', CYL, 0, 0.12, 0, 0, 0, 0, 0.05, 0.004, 0.05, { ...u, color: C('#3a2a1a') });
      break;
    case 'rose':
      B.add('plain', CYL, 0, 0.012, 0, 0, 0.5, Math.PI / 2, 0.006, 0.34, 0.006, { ...u, color: C('#4f8a4a') });
      B.add('plain', SPH, 0.18, 0.03, -0.1, 0, 0, 0, 0.04, 0.035, 0.04, { ...u, color: C('#e8487a') });
      break;
    case 'herbs':
      for (let i = 0; i < 5; i++) B.add('plain', CYL, 0, 0.012, (i - 2) * 0.012, 0, 0, Math.PI / 2 + (i - 2) * 0.1, 0.006, 0.3, 0.006, { ...u, color: C('#6f9e55') });
      for (let i = 0; i < 5; i++) B.add('plain', SPH, 0.15, 0.02, (i - 2) * 0.03, 0, 0, 0, 0.025, 0.02, 0.025, { ...u, color: C('#f7d65a') });
      break;
    case 'stash': {
      // gnarled old stump with roots + a mound of fresh earth hiding a small chest
      B.add('wood', CYL, -0.9, 0.5, -0.3, 0, 0, 0, 0.75, 1.0, 0.75, { ...u, color: C('#6a5040') });
      B.add('wood', CYL, -0.9, 1.05, -0.3, 0, 0, 0.3, 0.55, 0.3, 0.55, { ...u, color: C('#5a4434') });
      for (let i = 0; i < 5; i++) { const a = i * 1.26; B.add('wood', CYL, -0.9 + Math.cos(a) * 0.8, 0.12, -0.3 + Math.sin(a) * 0.8, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2, 0.14, 0.9, 0.14, { ...u, color: C('#5a4434') }); }
      B.add('plain', HALF, 0.4, 0, 0.3, 0, 0, 0, 0.8, 0.35, 0.7, { ...u, color: C('#7a5a3a') });
      B.add('wood', BOX, 0.4, 0.3, 0.3, 0, 0.3, 0.2, 0.6, 0.25, 0.4, { ...u, color: C('#8a5c3b') });
      B.add('gold', BOX, 0.4, 0.43, 0.3, 0, 0.3, 0.2, 0.62, 0.05, 0.1, { ...u });
      break;
    }
    case 'candle':
      B.add('plain', CYL, 0, 0.08, 0, 0, 0, 0, 0.025, 0.16, 0.025, { ...u, color: C('#fbf3e6') });
      B.add('lamp', SPH, 0, 0.18, 0, 0, 0, 0, 0.012, 0.025, 0.012, { ...u });
      break;
    default:
      B.add('plain', SPH, 0, 0.08, 0, 0, 0, 0, 0.08, 0.08, 0.08, { ...u, color: C('#ffffff') });
  }
}

const MODEL_FOR = {
  wine: 'bottle', bread: 'bread', sweet_roll: 'roll', cheese: 'cheese', apple: 'apple', berries: 'berries', ham: 'ham', raw_meat: 'ham',
  potion_hp: 'potion', potion_mana: 'potion', potion_stamina: 'potion', elixir_light: 'potion', berry_tea: 'potion',
  gem: 'gem', silver_ring: 'ring', treasury_key: 'key', cell_key: 'key', iron_sword: 'sword', knight_sword: 'sword', lute: 'lute', royal_rose: 'rose', herb: 'herbs', lost_tome: 'book',
};

function buildMesh(kind, opts, x, y, z, ry) {
  const B = new Builder(null);
  model(kind, B, opts);
  const g = B.build();
  g.position.set(x, y, z);
  g.rotation.y = ry || 0;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

function barsDoorMesh(w, h) {
  const B = new Builder(null);
  const u = { worldUV: false, ao: false };
  const iron = C('#4a4e5a');
  for (const yy of [0.08, h * 0.5, h - 0.08]) B.add('iron', BOX, 0, yy, w / 2, 0, 0, 0, 0.07, 0.07, w, { ...u, color: iron });
  for (const zz of [0.04, w - 0.04]) B.add('iron', BOX, 0, h / 2, zz, 0, 0, 0, 0.08, h, 0.08, { ...u, color: iron });
  const n = Math.round(w / 0.2);
  for (let i = 1; i < n; i++) B.add('iron', CYL, 0, h / 2, (i / n) * w, 0, 0, 0, 0.025, h, 0.025, { ...u, color: iron });
  B.add('iron', BOX, 0, h * 0.5, w - 0.18, 0, 0, 0, 0.14, 0.22, 0.16, { ...u, color: C('#6a6050') });
  const g = B.build();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function doorMesh(w, h, color, arched, style) {
  if (style === 'bars') return barsDoorMesh(w, h);
  const B = new Builder(null);
  const u = { worldUV: false, ao: false };
  const wood = C(color || '#9a6a44');
  const dark = wood.clone().multiplyScalar(0.72);
  // planks with small gaps (panel spans local +z from the hinge)
  const n = Math.max(3, Math.round(w / 0.28));
  for (let i = 0; i < n; i++) {
    const pw = w / n;
    B.add('wood', BOX, 0, h / 2, (i + 0.5) * pw, 0, 0, 0, 0.1, h, pw - 0.012, { ...u, color: i % 2 ? wood : wood.clone().multiplyScalar(0.94), uvRepeat: [1, 2] });
  }
  if (arched) B.add('wood', CYL, 0, h, w / 2, 0, 0, Math.PI / 2, w / 2, 0.1, w / 2, { ...u, color: wood });
  B.add('wood', BOX, 0, h / 2, w / 2, 0, 0, 0, 0.13, h, 0.012, { ...u, color: dark });
  // iron straps with round nail heads
  for (const f of [0.16, 0.5, 0.84]) {
    B.add('iron', BOX, 0, h * f, w * 0.46, 0, 0, 0, 0.13, 0.07, w * 0.9, { ...u, color: C('#4a4e5a') });
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) B.add('iron', SPH, s * 0.07, h * f, 0.12 + k * (w * 0.8) / 3, 0, 0, 0, 0.018, 0.018, 0.018, { ...u, color: C('#3a3e4a') });
  }
  // ring handles both sides
  for (const s of [-1, 1]) {
    B.add('gold', TOR, s * 0.09, h * 0.47, w * 0.8, 0, Math.PI / 2, 0, 0.07, 0.07, 0.07, { ...u });
    B.add('gold', CYL, s * 0.07, h * 0.53, w * 0.8, Math.PI / 2, 0, 0, 0.03, 0.02, 0.03, { ...u });
  }
  const g = B.build();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildWorldObjects(game, descs) {
  const g = game;
  const out = [];
  const scene = g.scene;
  const S = g.state;
  const taken = () => (S.taken || (S.taken = []));

  // is a theft seen? returns the witness NPC or null
  const witness = (pos) => {
    for (const n of g.npcs) {
      if (!n.visible || n.def.sleeping) continue;
      const d = n.pos.distanceTo(pos);
      if (d > 11) continue;
      if (Math.abs(n.pos.y - pos.y) > 3.5) continue;
      if (g.collision.segmentBlocked && g.collision.segmentBlocked(n.pos.x, n.pos.y + 1.5, n.pos.z, pos.x, pos.y + 0.4, pos.z)) continue;
      return n;
    }
    return null;
  };
  const caught = (n, what) => {
    const fine = Math.min(S.gold, 15 + Math.round((what.price || 10) * 0.5));
    const lines = ['Эй! Положи на место!', 'Воришка! Стража!', 'Это не твоё, странник.', 'Я всё видел! Плати штраф.'];
    g.ui.notify(`<b>${n.name}:</b> «${lines[Math.floor(Math.random() * lines.length)]}»`);
    if (fine > 0) { S.gold -= fine; g.ui.hint(`Вас поймали на краже. Штраф: ${fine} золотых.`); }
    else g.ui.hint('Вас поймали на краже. Пришлось вернуть вещь.');
    S.stats.thefts = (S.stats.thefts || 0) + 1;
    g.audio.play('ui');
  };

  for (const d of descs) {
    if (d.t === 'door') {
      const hinge = rot(d.ry, 0, -d.w / 2);
      const mesh = doorMesh(d.w, d.h, d.color, d.arched, d.style);
      mesh.position.set(d.x + hinge[0], d.y, d.z + hinge[1]);
      mesh.rotation.y = d.ry;
      scene.add(mesh);
      const col = g.collision.addBox(d.x, d.z, 0.12, d.w / 2, d.y, d.y + d.h, d.ry, { walkable: false });
      const nx = Math.cos(d.ry), nz = -Math.sin(d.ry);
      const it = {
        kind: 'door', pos: new THREE.Vector3(d.x, d.y, d.z), r: Math.max(2.0, d.w * 0.9), priority: 0.6, mesh, open: 0, target: d.startOpen ? -1.5 : 0, desc: d,
        label: () => {
          if (d.lock && !S.flags['unlock_' + d.id]) return g.itemCount(d.lock) ? `Отпереть: ${d.name || 'дверь'}` : `Заперто${d.name ? ': ' + d.name : ''}`;
          return (Math.abs(it.target) > 0.1 ? 'Закрыть' : 'Открыть') + (d.name ? `: ${d.name}` : ' дверь');
        },
        use: () => {
          if (d.lock && !S.flags['unlock_' + d.id]) {
            if (!g.itemCount(d.lock)) { g.ui.hint(d.lockHint || `Нужен ключ: ${ITEMS[d.lock]?.name || 'ключ'}.`); g.audio.play('ui'); return; }
            S.flags['unlock_' + d.id] = true;
            g.ui.hint(`Вы отперли дверь (${ITEMS[d.lock].name}).`);
            g.audio.play('chest');
          }
          if (Math.abs(it.target) > 0.1) it.target = 0;
          else {
            const side = (g.player.pos.x - d.x) * nx + (g.player.pos.z - d.z) * nz;
            it.target = side > 0 ? -1.55 : 1.55;
          }
          g.audio.play('door');
        },
        update: (dt) => {
          it.open += (it.target - it.open) * Math.min(1, dt * 5);
          mesh.rotation.y = d.ry + it.open;
          mesh.visible = (it.d2 ?? 0) < 8100;
          const isOpen = Math.abs(it.open) > 0.35;
          col.y0 = isOpen ? -1000 : d.y; col.y1 = isOpen ? -999 : d.y + d.h;
        },
      };
      if (d.startOpen) it.open = -1.5;
      out.push(it);
    } else if (d.t === 'pickup') {
      const itemDef = ITEMS[d.item];
      const kind = d.model || MODEL_FOR[d.item] || (d.gold ? 'coins' : 'default');
      const mesh = buildMesh(kind, { color: d.color || itemDef?.color }, d.x, d.y, d.z, d.ry || 0);
      scene.add(mesh);
      const name = d.gold ? `${d.gold} золотых` : (itemDef ? itemDef.name + (d.n > 1 ? ` ×${d.n}` : '') : d.item);
      const it = {
        kind: 'pickup', pos: new THREE.Vector3(d.x, d.y, d.z), r: 1.7, priority: 1, mesh,
        active: () => !taken().includes(d.id) && (!d.cond || d.cond(g)),
        label: () => (d.owner ? 'Украсть: ' : 'Взять: ') + name,
        steal: !!d.owner,
        use: () => {
          if (d.owner) {
            const w = witness(it.pos);
            if (w) { caught(w, itemDef || { price: d.gold || 10 }); return; }
          }
          taken().push(d.id);
          if (d.gold) g.addGold(d.gold);
          else g.giveItem(d.item, d.n || 1);
          if (d.onTake) d.onTake(g);
          g.effects.motes(it.pos, '#fff0c0', 6, 0.2, 0.8, 0.8, 0.1);
        },
        update: () => { mesh.visible = it.active() && it.near; },
      };
      out.push(it);
    } else if (d.t === 'book') {
      const book = BOOKS[d.book];
      if (!book) continue;
      const mesh = buildMesh(d.model || 'openbook', { color: d.color }, d.x, d.y, d.z, d.ry || 0);
      scene.add(mesh);
      const it = {
        kind: 'book', pos: new THREE.Vector3(d.x, d.y, d.z), r: 1.8, priority: 1.1, mesh,
        active: () => !d.cond || d.cond(g),
        label: () => `Читать: ${book.title}` + ((S.read || []).includes(d.book) ? '' : ' ✦'),
        use: () => g.readBook(d.book),
        update: () => { mesh.visible = it.near && it.active(); },
      };
      out.push(it);
    } else if (d.t === 'container') {
      const id = d.id;
      let mesh = null;
      if (d.model) { mesh = buildMesh(d.model, {}, d.x, d.y, d.z, d.ry || 0); mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(mesh); }
      const it = {
        kind: 'container', pos: new THREE.Vector3(d.x, d.y, d.z), r: d.r || 1.6, priority: 0.4,
        active: () => (S.gathered[id] || 0) <= S.stats.time && (!d.cond || d.cond(g)),
        update: () => { if (mesh) mesh.visible = it.near && (!d.cond || d.cond(g) || (S.gathered[id] || 0) > S.stats.time); },
        label: () => (d.owner ? 'Украсть из: ' : 'Обыскать: ') + d.name,
        steal: !!d.owner,
        use: () => {
          if (d.owner) {
            const w = witness(it.pos);
            if (w) { caught(w, { price: 20 }); return; }
          }
          S.gathered[id] = S.stats.time + (d.respawn || 1500);
          const loot = typeof d.loot === 'function' ? d.loot(g) : d.loot;
          let any = false;
          for (const [item, a, b] of loot) {
            const chance = b === undefined ? 1 : b;
            if (Math.random() > chance) continue;
            const n = Array.isArray(a) ? a[0] + Math.floor(Math.random() * (a[1] - a[0] + 1)) : a;
            if (n <= 0) continue;
            any = true;
            if (item === 'gold') g.addGold(n); else g.giveItem(item, n);
          }
          if (!any) g.ui.hint(`${d.name}: пусто.`);
          g.audio.play('pickup', 0.5);
          if (d.onUse) d.onUse(g);
        },
      };
      out.push(it);
    } else if (d.t === 'seat') {
      out.push({
        kind: 'seat', pos: new THREE.Vector3(d.x, d.y, d.z), r: 1.3, priority: -0.4,
        active: () => g.player.state === 'free' && !seatTaken(g, d),
        label: () => d.name ? `Сесть: ${d.name}` : 'Сесть',
        use: () => g.player.sit(d),
      });
    } else if (d.t === 'bed') {
      out.push({
        kind: 'bed', pos: new THREE.Vector3(d.x, d.y, d.z), r: 2.0, priority: 0.2,
        label: () => {
          if (d.royal) return 'Королевское ложе';
          if (d.owner) return `Кровать (${d.owner})`;
          if (d.rent && !S.flags.roomRented) return 'Кровать (комната не снята)';
          return 'Лечь спать';
        },
        use: () => {
          if (d.royal) { g.ui.hint('Спать в королевских покоях? Лучше не стоит.'); return; }
          if (d.owner) { g.ui.hint('Это чужая кровать. Снимите комнату в «Золотом Грифоне» или отдохните у алтаря.'); return; }
          if (d.rent && !S.flags.roomRented) { g.ui.hint('Комнату можно снять у трактирщика Гюнтера — 15 золотых за ночь.'); return; }
          if (g.enemies.some((e) => e.alive && (e.state === 'chase' || e.state === 'attack') && e.pos.distanceTo(g.player.pos) < 40)) { g.ui.hint('Нельзя спать, когда рядом враги.'); return; }
          g.ui.open('bed', { bed: d });
        },
      });
    } else if (d.t === 'custom') {
      out.push(d.make(g));
    }
  }
  return out;
}

function seatTaken(g, d) {
  for (const n of g.npcs) if (n.seat === d) return true;
  return false;
}
