// Serializable game state + derived stats + save/load (localStorage, guarded).
import { ITEMS } from './items.js';
import { START } from '../world/layout.js';

const SAVE_KEY = 'lumenhold_save_v1';

export function newState() {
  return {
    version: 1,
    player: {
      x: START.x, y: 0, z: START.z, yaw: START.yaw,
      hp: 100, stamina: 100, mana: 40, satiety: 70,
      level: 1, glimmer: 0,
      stats: { vig: 1, end: 1, str: 1, mind: 1 },
      flasks: 3, flasksMax: 3,
    },
    gold: 25,
    inventory: { rusty_sword: 1, traveler_clothes: 1, bread: 2, apple: 3 },
    equipment: { weapon: 'rusty_sword', armor: 'traveler_clothes', amulet: null },
    hotbar: ['bread', 'apple', null, null],
    quests: {},
    tracked: null,
    flags: {},
    hour: 8.5,
    day: 1,
    lastAltar: 'a_meadow',
    altars: ['a_meadow'],
    locations: [],
    chests: [],
    killed: [],
    gathered: {},
    lostGlimmer: null,
    spells: [],
    buffs: [],
    stats: { kills: 0, deaths: 0, time: 0 },
  };
}

export function levelCost(level) {
  return Math.floor(60 + Math.pow(level, 1.55) * 45);
}

// derived stats from state
export function derived(s) {
  const st = s.player.stats;
  const eq = s.equipment;
  const w = ITEMS[eq.weapon] || ITEMS.rusty_sword;
  const a = ITEMS[eq.armor];
  const am = ITEMS[eq.amulet];
  let buffDmg = 0, buffStam = 1, buffMaxStam = 0, buffMana = 1;
  for (const b of s.buffs) {
    if (b.dmgMul) buffDmg += b.dmgMul;
    if (b.stamRegen) buffStam = Math.max(buffStam, b.stamRegen);
    if (b.maxStam) buffMaxStam += b.maxStam;
    if (b.manaRegen) buffMana = Math.max(buffMana, b.manaRegen);
  }
  const d = {
    maxHp: 100 + (st.vig - 1) * 14 + (am?.hp || 0),
    maxStamina: 100 + (st.end - 1) * 9 + buffMaxStam,
    maxMana: 40 + (st.mind - 1) * 9 + (am?.mana || 0),
    damage: w.dmg * (1 + (st.str - 1) * 0.075) * (1 + (am?.dmgMul || 0) + buffDmg),
    weaponSpeed: w.speed || 1,
    spellDmg: 34 * (1 + (st.mind - 1) * 0.11) * (1 + buffDmg),
    defense: (a?.def || 0),
    stamRegen: 30 * buffStam,
    manaRegen: 1.2 * buffMana + (am?.manaRegen || 0),
    hpRegen: (am?.regen || 0),
  };
  return d;
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return null;
    // fill missing keys from defaults
    const def = newState();
    for (const k of Object.keys(def)) if (s[k] === undefined) s[k] = def[k];
    return s;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

export function formatHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
