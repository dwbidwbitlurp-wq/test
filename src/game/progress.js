// Completion: story, errands, exploration and knowledge, as one percentage with a breakdown.
import { QUESTS } from './quests.js';
import { LOCATIONS, ALTARS } from '../world/layout.js';
import { BOOKS } from './books.js';
import { BESTIARY } from './bestiary.js';

const BOSSES = ['gart', 'golem', 'morgrim'];

export function computeProgress(s) {
  const q = s.quests || {};
  const ids = Object.keys(QUESTS);
  const mains = ids.filter((id) => QUESTS[id].main), sides = ids.filter((id) => !QUESTS[id].main);
  // a main quest in progress counts by its stage
  const mainPart = mains.reduce((a, id) => {
    const st = q[id];
    if (!st) return a;
    if (st.done) return a + 1;
    return a + Math.min(0.9, (st.stage || 0) / QUESTS[id].stages.length);
  }, 0) / mains.length;
  const sideDone = sides.filter((id) => q[id]?.done).length;
  const parts = [
    ['Сюжет', mainPart, 45],
    ['Поручения', sideDone / sides.length, 30],
    ['Места', (s.locations || []).length / LOCATIONS.length, 7],
    ['Алтари', (s.altars || []).length / ALTARS.length, 5],
    ['Бестиарий', Object.keys(s.bestiary || {}).filter((k) => BESTIARY[k]).length / Object.keys(BESTIARY).length, 5],
    ['Книги', (s.read || []).length / Object.keys(BOOKS).length, 4],
    ['Боссы', BOSSES.filter((b) => (s.killed || []).includes(b)).length / BOSSES.length, 4],
  ];
  const pct = parts.reduce((a, [, v, w]) => a + Math.min(1, v) * w, 0);
  return { pct: Math.round(pct), parts: parts.map(([n, v, w]) => ({ name: n, pct: Math.round(Math.min(1, v) * 100), w })), sideDone, sideTotal: sides.length };
}
