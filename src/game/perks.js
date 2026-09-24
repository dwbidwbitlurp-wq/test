// Skill tree (one point per level) and Bram's forge upgrades (+1..+5).
import { ITEMS } from './items.js';

export const BRANCHES = [
  { id: 'blade', name: 'Клинок', color: '#ffd98a', desc: 'Сила и точность удара' },
  { id: 'guard', name: 'Страж', color: '#a9d6ff', desc: 'Защита, блок и стойкость' },
  { id: 'light', name: 'Свет', color: '#ffb8e0', desc: 'Мана, чары и исцеление' },
];

// Perks in a branch unlock in order.
export const PERKS = {
  blade: [
    { id: 'b_edge', name: 'Острота', desc: '+10% урона оружием.' },
    { id: 'b_flow', name: 'Поток', desc: 'Каждый следующий удар серии наносит +10% урона.' },
    { id: 'b_rend', name: 'Рассечение', desc: 'Любое оружие с шансом 20% вызывает кровотечение.' },
    { id: 'b_exec', name: 'Казнь', desc: 'Рипост и удар в спину наносят +50% урона.' },
  ],
  guard: [
    { id: 'g_hide', name: 'Закалка', desc: '+6 защиты.' },
    { id: 'g_wall', name: 'Стена', desc: 'Блок тратит на 35% меньше выносливости.' },
    { id: 'g_flask', name: 'Второе дыхание', desc: '+1 флакон слёз рассвета.' },
    { id: 'g_riposte', name: 'Отражение', desc: 'Окно парирования шире на 50%. Парирование возвращает 30 выносливости.' },
  ],
  light: [
    { id: 'l_spark', name: 'Искра', desc: '+25 маны.' },
    { id: 'l_drain', name: 'Сияющий клинок', desc: 'Каждый удар оружием восстанавливает 2 маны.' },
    { id: 'l_grace', name: 'Благодать', desc: 'Флакон и еда лечат на 35% сильнее.' },
    { id: 'l_dawn', name: 'Рассветный вихрь', desc: 'Заклинания +35% урона, «Вихрь света» дешевле на треть.' },
  ],
};

export function hasPerk(s, id) { return !!(s.perks && s.perks.includes(id)); }

export function perkPoints(s) {
  return Math.max(0, s.player.level - 1 + (s.bonusPerks || 0) - (s.perks ? s.perks.length : 0));
}

export function canLearn(s, branch, idx) {
  const list = PERKS[branch];
  const p = list[idx];
  if (!p || hasPerk(s, p.id) || perkPoints(s) <= 0) return false;
  return idx === 0 || hasPerk(s, list[idx - 1].id);
}

// ---------- forge ----------
export const MAX_UPGRADE = 5;

export function upgradeLevel(s, id) { return (s.upgrades && s.upgrades[id]) || 0; }

// what the next level costs: gold + materials, scaled by the item's value
export function upgradeCost(id, lvl) {
  const it = ITEMS[id];
  const n = lvl + 1;
  const gold = Math.round((40 + (it.price || 40) * 0.22) * n * (0.8 + n * 0.25) / 5) * 5;
  const mats = {};
  if (n <= 2) mats.iron_ore = n + 1;
  else if (n <= 4) { mats.iron_ore = 2; mats.light_crystal = n - 2; }
  else { mats.light_crystal = 2; mats.shadow_essence = 2; }
  return { gold, mats };
}

export function upgradeBonus(it, lvl) {
  if (!lvl) return {};
  if (it.type === 'weapon') return { dmg: Math.round(it.dmg * 0.09 * lvl + lvl) };
  if (it.type === 'armor') return { def: Math.round(it.def * 0.08 * lvl + lvl * 1.5) };
  return {};
}

export const EFFECT_NAMES = {
  bleed: ['Кровотечение', '#ff6b7a'],
  burn: ['Сияющий ожог', '#ffd27a'],
  frost: ['Лунный холод', '#a9d6ff'],
};
