// Ambient one-liners NPCs say when the player walks past. Context first, then role, then generic.
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const ROLE = {
  guard: ['Проходи, не задерживайся.', 'Спокойно сегодня. Слишком спокойно.', 'Слава короне.', 'Держи клинок в ножнах в городе.', 'Капитан Роланд опять гоняет нас по стенам.'],
  merchant: ['Заходи, товар свежий!', 'Лучшие цены по эту сторону гор!', 'Для героя — скидка... почти.', 'Золото звенит — товар летит!'],
  noble: ['Какой чудесный день для прогулки.', 'Вы слышали новый сонет Флориана?', 'Сады в этом году цветут особенно пышно.', 'Ах, эти придворные сплетни...'],
  folk: ['Доброго дня!', 'Опять цены на мёд подняли...', 'Говорят, в лесу видели белую лань.', 'Ох, спина моя, спина.', 'Хлеб у Отто сегодня — объедение.', 'Слыхал? Принц снова на ристалище.', 'Только бы урожай не подвёл.'],
  smith: ['Хорошая сталь любит терпение.', 'Принесёшь руды — сделаю из железяки клинок.', '(звон молота)'],
};

const SHOP_IDS = new Set(['mirta', 'gunter', 'selma', 'orvin', 'volk', 'otto', 'marta']);
const NOBLE_IDS = new Set(['aurelia', 'cedric', 'edmund', 'florian', 'isolde', 'queen', 'king']);

export function pickBark(g, npc) {
  const s = g.state;
  const d = npc.def;
  const p = s.player;
  const dm = g.derived();
  const h = s.hour;
  const eq = s.equipment;
  const ctx = [];
  if (p.hp < dm.maxHp * 0.35) ctx.push('Вы ранены! Лекарь у часовни, поспешите.', 'Выглядишь, будто тебя тролль жевал.');
  if (s.flags.heartRestored) ctx.push('Сердце Света снова сияет! Это ведь вы, да?', 'Спасибо тебе, герой. Мы спим спокойно.');
  if (s.killed?.includes('gart')) ctx.push('Это ты разогнал Чёрную Лису? Дороги стали безопасны!');
  if (eq.armor === 'dawn_armor' || eq.armor === 'royal_armor') ctx.push('Какие латы... Вы из королевской гвардии?');
  if (eq.weapon === 'dawn_blade') ctx.push('Этот клинок светится, как само утро!');
  if (g.weather?.kind === 'rain') ctx.push('Ну и ливень! Скорее бы под крышу.', 'Дождь — к хорошему урожаю.');
  if (h >= 20 || h < 5) ctx.push('Поздно уже. Ночью за стенами бродят тени.', 'Не гуляй в темноте без фонаря.');
  else if (h < 9) ctx.push('Утро доброе!', 'Рано ты сегодня.');
  if (s.flags.duel_won) ctx.push('Это вы одолели принца на ристалище? Вот это да!');
  if (ctx.length && Math.random() < 0.45) return pick(ctx);
  if (d.id === 'bram') return pick(ROLE.smith);
  if (d.guard) return pick(ROLE.guard);
  if (SHOP_IDS.has(d.id)) return pick(ROLE.merchant);
  if (NOBLE_IDS.has(d.id)) return pick(ROLE.noble);
  if (!d.named) return pick(ROLE.folk);
  return Math.random() < 0.5 ? pick(ctx.length ? ctx : ROLE.folk) : null;
}
