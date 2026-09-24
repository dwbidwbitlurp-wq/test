// Item database + inline SVG icons.

export const CATEGORIES = [
  { id: 'all', name: 'Все' },
  { id: 'weapon', name: 'Оружие' },
  { id: 'armor', name: 'Броня' },
  { id: 'amulet', name: 'Амулеты' },
  { id: 'food', name: 'Еда' },
  { id: 'potion', name: 'Зелья' },
  { id: 'material', name: 'Материалы' },
  { id: 'quest', name: 'Особые' },
];

// food: heal (over time), sat = satiety, buff
export const ITEMS = {
  // ---- weapons ----
  rusty_sword: { name: 'Меч странника', type: 'weapon', icon: 'sword', color: '#c9c3bb', dmg: 14, speed: 1.0, model: 'sword', price: 20, desc: 'Старый, но надёжный клинок. Видал много дорог.' },
  iron_sword: { name: 'Железный меч', type: 'weapon', icon: 'sword', color: '#dfe6ef', dmg: 21, speed: 1.0, model: 'sword', price: 160, desc: 'Добротная работа кузнецов Люменхолда.' },
  knight_sword: { name: 'Меч рыцаря Люменхолда', type: 'weapon', icon: 'sword', color: '#f3e3a8', dmg: 28, speed: 1.0, model: 'sword', modelOpts: { guard: 0xf0c860 }, price: 460, desc: 'Клинок королевской гвардии с золотой гардой.' },
  war_axe: { name: 'Боевой топор', type: 'weapon', icon: 'axe', color: '#d8d0c8', dmg: 33, speed: 0.82, model: 'axe', effect: 'bleed', price: 380, desc: 'Тяжёлый и медленный, зато пробивает любую защиту.' },
  guard_spear: { name: 'Копьё стражи', type: 'weapon', icon: 'spear', color: '#e6ecf4', dmg: 22, speed: 1.12, model: 'spear', price: 280, desc: 'Длинное и быстрое. Колет на две сажени, но плохо рубит толпу.' },
  great_sword: { name: 'Двуручный меч гвардии', type: 'weapon', icon: 'greatsword', color: '#eef2f8', dmg: 40, speed: 0.76, model: 'greatsword', modelOpts: { guard: 0xf0c860 }, price: 560, desc: 'Широкие медленные взмахи сносят щиты и сбивают с ног.' },
  thorn_spear: { name: 'Копьё Шиповника', type: 'weapon', icon: 'spear', color: '#ffb0cf', dmg: 30, speed: 1.1, model: 'spear', modelOpts: { guard: 0xf2a6c9 }, effect: 'bleed', price: 720, desc: 'Наконечник в форме шипа розы. Раны от него долго кровоточат.' },
  moon_blade: { name: 'Лунный клинок', type: 'weapon', icon: 'sword', color: '#a9d6ff', dmg: 37, speed: 1.05, model: 'sword', modelOpts: { glow: 0x8fc8ff, guard: 0xd8e6ff }, effect: 'frost', price: 900, desc: 'Выкован из светлых кристаллов. Мерцает холодным лунным светом.' },
  dawn_blade: { name: 'Рассветный клинок', type: 'weapon', icon: 'sword', color: '#ffd98a', dmg: 48, speed: 1.08, model: 'sword', modelOpts: { glow: 0xffd27a }, effect: 'burn', price: 2000, desc: 'Меч, рождённый в Сердце Света. Разгоняет любой сумрак.' },

  // ---- armor ----
  traveler_clothes: { name: 'Одежда странника', type: 'armor', icon: 'armor', color: '#e9dccb', def: 2, price: 10, look: { shirt: 0xf1e8dc, pants: 0x7a6a8a, armor: null, cape: 0xe8a0c0 }, desc: 'Простая дорожная одежда и любимый розовый плащ.' },
  leather_armor: { name: 'Кожаный доспех', type: 'armor', icon: 'armor', color: '#b58962', def: 8, price: 140, look: { shirt: 0xa77a55, pants: 0x5a4a3a, armor: null, cape: 0x8a6a8a }, desc: 'Лёгкая защита охотников Медового Дола.' },
  steel_armor: { name: 'Стальная кираса', type: 'armor', icon: 'armor', color: '#d6dde8', def: 16, price: 420, look: { shirt: 0xdfe4ee, pants: 0x5a5a7a, armor: 0xdde3ee, pauldrons: true, cape: 0x9fb8e8 }, desc: 'Надёжная сталь. Звенит при каждом шаге.' },
  royal_armor: { name: 'Латы королевской гвардии', type: 'armor', icon: 'armor', color: '#f4f0ff', def: 21, price: 700, look: { shirt: 0xf6f2ff, pants: 0x6b5a9a, armor: 0xf4f6fc, pauldrons: true, cape: 0xf2a6c9 }, desc: 'Белые латы с золотой каймой — гордость Люменхолда.' },
  dawn_armor: { name: 'Доспех Рассвета', type: 'armor', icon: 'armor', color: '#ffe3a0', def: 28, price: 1500, look: { shirt: 0xfff4dc, pants: 0x8a6a4a, armor: 0xf7df9a, pauldrons: true, cape: 0xfff0c8 }, desc: 'Древний доспех, что светится изнутри тёплым золотом.' },

  // ---- amulets ----
  moon_amulet: { name: 'Лунный амулет', type: 'amulet', icon: 'amulet', color: '#a9d6ff', mana: 25, manaRegen: 1.5, price: 300, desc: '+25 к мане, ускоренное восстановление маны.' },
  wolf_charm: { name: 'Оберег волчьего клыка', type: 'amulet', icon: 'amulet', color: '#e8e0d0', dmgMul: 0.12, price: 250, desc: '+12% к урону оружием.' },
  heart_amulet: { name: 'Амулет Живого Сердца', type: 'amulet', icon: 'amulet', color: '#ff9ecb', hp: 40, regen: 1.0, price: 1200, desc: '+40 к здоровью и медленная регенерация.' },

  // ---- food ----
  apple: { name: 'Яблоко', type: 'food', icon: 'apple', color: '#ff6b7a', heal: 15, sat: 10, price: 3, desc: 'Сочное яблоко из садов Медового Дола.' },
  bread: { name: 'Хлеб', type: 'food', icon: 'bread', color: '#e0b070', heal: 25, sat: 25, price: 6, desc: 'Тёплый каравай с хрустящей корочкой.' },
  cheese: { name: 'Сыр', type: 'food', icon: 'cheese', color: '#ffd35a', heal: 30, sat: 22, price: 10, desc: 'Ароматный горный сыр.' },
  raw_meat: { name: 'Сырое мясо', type: 'food', icon: 'meat', color: '#e07a7a', heal: 6, sat: 12, price: 4, desc: 'Лучше приготовить на костре.' },
  cooked_meat: { name: 'Жареное мясо', type: 'food', icon: 'meat', color: '#b0653a', heal: 45, sat: 40, price: 18, desc: 'Сытное, горячее, с дымком.' },
  mushroom: { name: 'Лесной гриб', type: 'food', icon: 'mushroom', color: '#f09a7a', heal: 8, sat: 6, price: 4, desc: 'Съедобный. Скорее всего.' },
  honey: { name: 'Мёд', type: 'food', icon: 'honey', color: '#f5c542', heal: 20, sat: 12, buff: { stamRegen: 1.6, time: 60 }, price: 12, desc: 'Золотой мёд. Ускоряет восстановление выносливости.' },
  honey_pie: { name: 'Медовый пирог', type: 'food', icon: 'pie', color: '#e9b460', heal: 60, sat: 50, buff: { stamRegen: 1.6, time: 120 }, price: 35, desc: 'Фирменный пирог «Золотого Грифона».' },
  stew: { name: 'Рагу странника', type: 'food', icon: 'stew', color: '#c77a4a', heal: 80, sat: 65, buff: { maxStam: 20, time: 180 }, price: 40, desc: 'Мясо и грибы, томлённые на костре.' },
  wine: { name: 'Вино Люменхолда', type: 'food', icon: 'bottle', color: '#b0305a', heal: 12, sat: 4, buff: { dmgMul: 0.05, time: 90 }, price: 22, desc: 'Розовое вино с южных склонов. Прибавляет храбрости.' },
  ham: { name: 'Копчёный окорок', type: 'food', icon: 'meat', color: '#c0704a', heal: 55, sat: 50, price: 24, desc: 'Из кладовой замковой кухни. Пахнет дымком и можжевельником.' },
  sweet_roll: { name: 'Сдобная булочка', type: 'food', icon: 'roll', color: '#e0a060', heal: 22, sat: 14, buff: { stamRegen: 1.2, time: 45 }, price: 9, desc: 'С глазурью и вишенкой. Слабость каждого стражника.' },
  berries: { name: 'Лесные ягоды', type: 'food', icon: 'berries', color: '#b8406a', heal: 12, sat: 6, price: 3, desc: 'Малина и черника из Шепчущего леса.' },
  berry_tea: { name: 'Ягодный чай', type: 'food', icon: 'potion', color: '#d67ab8', heal: 10, sat: 5, buff: { manaRegen: 2, time: 90 }, price: 8, desc: 'Согревает и проясняет мысли.' },

  // ---- potions ----
  potion_hp: { name: 'Зелье здоровья', type: 'potion', icon: 'potion', color: '#ff6b8a', instant: { hp: 70 }, price: 45, desc: 'Мгновенно восстанавливает 70 здоровья.' },
  potion_stamina: { name: 'Зелье выносливости', type: 'potion', icon: 'potion', color: '#8fe07a', buff: { stamRegen: 2.2, time: 60 }, price: 35, desc: 'Выносливость восстанавливается вдвое быстрее.' },
  potion_mana: { name: 'Зелье маны', type: 'potion', icon: 'potion', color: '#7ab0ff', instant: { mana: 60 }, price: 40, desc: 'Восстанавливает 60 маны.' },
  elixir_light: { name: 'Эликсир света', type: 'potion', icon: 'potion', color: '#ffe08a', buff: { dmgMul: 0.3, time: 60 }, price: 110, desc: '+30% к урону на минуту.' },

  // ---- materials ----
  wolf_pelt: { name: 'Волчья шкура', type: 'material', icon: 'pelt', color: '#9a93a8', price: 16, desc: 'Тёплый мех. Охотно купят торговцы.' },
  wolf_fang: { name: 'Волчий клык', type: 'material', icon: 'fang', color: '#f4efe4', price: 10, desc: 'Острый, как игла.' },
  deer_hide: { name: 'Оленья шкура', type: 'material', icon: 'pelt', color: '#d0976a', price: 14, desc: 'Мягкая, светлая шкура.' },
  boar_tusk: { name: 'Клык вепря', type: 'material', icon: 'fang', color: '#fff4dc', price: 14, desc: 'Изогнутый клык лесного вепря.' },
  rabbit_fur: { name: 'Кроличий мех', type: 'material', icon: 'pelt', color: '#f1ebe2', price: 6, desc: 'Пушистый и мягкий.' },
  herb: { name: 'Солнечник', type: 'material', icon: 'herb', color: '#f7d65a', price: 5, desc: 'Золотистая трава. Основа целебных зелий.' },
  moonflower: { name: 'Лунный цветок', type: 'material', icon: 'flower', color: '#bfe0ff', price: 14, desc: 'Светится в темноте. Растёт у воды.' },
  light_crystal: { name: 'Светлый кристалл', type: 'material', icon: 'crystal', color: '#a9d6ff', price: 45, desc: 'Кристалл, хранящий частичку света.' },
  shadow_essence: { name: 'Эссенция сумрака', type: 'material', icon: 'crystal', color: '#8a5ad6', price: 28, desc: 'Холодная и беспокойная. Алхимики платят за неё хорошо.' },
  bandit_mask: { name: 'Маска Чёрной Лисы', type: 'material', icon: 'mask', color: '#3a3040', price: 20, desc: 'Трофей с разбойника.' },

  gem: { name: 'Розовый топаз', type: 'material', icon: 'crystal', color: '#ff9ecb', price: 120, desc: 'Драгоценный камень чистой воды.' },
  iron_ore: { name: 'Железная руда', type: 'material', icon: 'ore', color: '#9aa0ac', price: 18, desc: 'Руда с горных жил. Кузнецу нужна для закалки оружия и брони.' },
  silver_ring: { name: 'Серебряное кольцо', type: 'material', icon: 'ring', color: '#e8ecf8', price: 70, desc: 'Тонкая работа ювелиров Люменхолда.' },

  // ---- quest ----
  treasury_key: { name: 'Ключ от сокровищницы', type: 'quest', icon: 'key', color: '#f0c860', price: 0, desc: 'Тяжёлый золотой ключ с гербом Люменхолда.' },
  cell_key: { name: 'Ключ от казематов', type: 'quest', icon: 'key', color: '#b8c0cc', price: 0, desc: 'Ржавый ключ тюремщика.' },
  lute: { name: 'Лютня Флориана', type: 'quest', icon: 'lute', color: '#c08850', price: 0, desc: 'Инкрустированная перламутром лютня придворного барда.' },
  royal_rose: { name: 'Роза с королевской крыши', type: 'quest', icon: 'rose', color: '#e8487a', price: 0, desc: 'Роза из сада на крыше королевского крыла.' },
  flour_sack: { name: 'Мешок муки', type: 'quest', icon: 'pelt', color: '#f4efe4', price: 0, desc: 'Мука с мельницы Гуго для замковой кухни.' },
  lost_tome: { name: 'Потерянный том', type: 'quest', icon: 'book', color: '#6a4a8a', price: 0, desc: 'Книга из библиотеки магистра Эдмунда.' },
  dawn_shard: { name: 'Осколок Рассвета', type: 'quest', icon: 'shard', color: '#ffe6a0', price: 0, desc: 'Частица Сердца Света. Тёплый, как утреннее солнце.' },
  royal_seal: { name: 'Королевская печать', type: 'quest', icon: 'seal', color: '#f0c860', price: 0, desc: 'Даёт право подняться в обсерваторию магистра.' },
  unicorn_bell: { name: 'Серебряный колокольчик', type: 'quest', icon: 'bell', color: '#e6ecff', price: 0, desc: 'Позвоните (G), и единорог Астра придёт к вам.' },
};

export function item(id) { return ITEMS[id]; }

const ICONS = {
  sword: '<path d="M44 6 L58 6 L58 20 L28 50 L22 44 Z" fill="C"/><path d="M14 40 L24 50 L20 54 L10 44 Z" fill="#f0c860"/><path d="M10 48 L16 54 L8 60 L4 56 Z" fill="#6a4a36"/>',
  spear: '<path d="M10 58 L46 18" stroke="#8a6246" stroke-width="4" stroke-linecap="round"/><path d="M44 8 L58 6 L56 20 L46 22 L42 18 Z" fill="C"/><path d="M38 22 L46 30" stroke="#f0c860" stroke-width="4"/>',
  greatsword: '<path d="M46 4 L60 4 L60 18 L24 54 L14 44 Z" fill="C"/><path d="M8 36 L28 56 L24 60 L4 40 Z" fill="#f0c860"/><path d="M6 52 L12 58 L4 62 Z" fill="#6a4a36"/>',
  ore: '<path d="M8 44 L18 22 L36 14 L54 26 L58 46 L40 56 L18 54 Z" fill="C"/><path d="M22 30 L30 26 L34 34 Z M40 38 L48 34 L46 44 Z" fill="#e8ecf8" opacity="0.8"/>',
  axe: '<rect x="30" y="8" width="5" height="52" rx="2" fill="#7a5a42"/><path d="M34 10 C52 8 58 22 54 34 C48 28 42 26 34 28 Z" fill="C"/>',
  armor: '<path d="M18 14 L26 10 C30 16 34 16 38 10 L46 14 L54 22 L48 30 L46 28 L46 54 L18 54 L18 28 L16 30 L10 22 Z" fill="C"/><path d="M32 20 L32 52" stroke="#f0c860" stroke-width="3"/>',
  amulet: '<path d="M16 8 C20 30 44 30 48 8" stroke="#f0c860" stroke-width="3" fill="none"/><circle cx="32" cy="40" r="13" fill="C"/><circle cx="32" cy="40" r="6" fill="#fff" opacity="0.6"/>',
  apple: '<circle cx="26" cy="38" r="15" fill="C"/><circle cx="38" cy="38" r="15" fill="C"/><path d="M32 22 L34 12" stroke="#6a4a36" stroke-width="3"/><path d="M34 16 C40 10 46 12 46 12 C44 18 38 18 34 16Z" fill="#7cc26a"/>',
  bread: '<ellipse cx="32" cy="36" rx="24" ry="15" fill="C"/><path d="M20 30 L24 40 M30 28 L34 40 M40 28 L44 40" stroke="#fff3d6" stroke-width="3" opacity="0.7"/>',
  cheese: '<path d="M8 44 L40 16 L56 30 L56 50 L8 50 Z" fill="C"/><circle cx="28" cy="40" r="4" fill="#e0b030"/><circle cx="44" cy="36" r="3" fill="#e0b030"/>',
  meat: '<ellipse cx="28" cy="34" rx="18" ry="14" fill="C"/><rect x="40" y="38" width="16" height="6" rx="3" transform="rotate(30 40 38)" fill="#f4efe4"/><circle cx="56" cy="50" r="5" fill="#f4efe4"/>',
  mushroom: '<rect x="27" y="30" width="10" height="24" rx="4" fill="#f4efe4"/><path d="M8 34 C8 12 56 12 56 34 Z" fill="C"/><circle cx="24" cy="24" r="3" fill="#fff"/><circle cx="38" cy="22" r="4" fill="#fff"/>',
  honey: '<path d="M18 22 L46 22 L50 54 L14 54 Z" fill="C"/><rect x="16" y="14" width="32" height="9" rx="3" fill="#d8b070"/><path d="M22 32 C26 40 38 40 42 32" stroke="#fff3c0" stroke-width="3" fill="none"/>',
  pie: '<path d="M6 38 L58 38 L52 52 L12 52 Z" fill="#c98a4a"/><path d="M8 38 C12 22 52 22 56 38 Z" fill="C"/><path d="M18 32 L46 32 M22 26 L42 26" stroke="#fff0c0" stroke-width="2"/>',
  stew: '<path d="M8 30 L56 30 C56 48 44 56 32 56 C20 56 8 48 8 30 Z" fill="#8a6246"/><ellipse cx="32" cy="30" rx="24" ry="6" fill="C"/><circle cx="24" cy="29" r="3" fill="#f09a7a"/><circle cx="38" cy="30" r="3" fill="#b0653a"/>',
  potion: '<rect x="26" y="6" width="12" height="12" rx="2" fill="#d8c0a0"/><path d="M24 18 L40 18 L40 24 C52 30 54 54 32 56 C10 54 12 30 24 24 Z" fill="C"/><path d="M20 38 C24 46 40 46 44 38" stroke="#fff" stroke-width="3" opacity="0.5" fill="none"/>',
  pelt: '<path d="M12 18 C22 8 42 8 52 18 L56 34 L48 38 L50 54 L14 54 L16 38 L8 34 Z" fill="C"/>',
  fang: '<path d="M22 10 C40 10 50 20 44 56 C38 40 30 28 18 22 Z" fill="C"/>',
  herb: '<path d="M32 58 L32 26" stroke="#6f9e55" stroke-width="3"/><circle cx="32" cy="18" r="9" fill="C"/><path d="M32 40 C22 36 18 28 18 28 C26 28 30 34 32 40 M32 46 C42 42 46 34 46 34 C38 34 34 40 32 46" fill="#7cc26a"/>',
  flower: '<path d="M32 58 L32 34" stroke="#6f9e55" stroke-width="3"/><circle cx="32" cy="16" r="8" fill="C"/><circle cx="22" cy="26" r="8" fill="C"/><circle cx="42" cy="26" r="8" fill="C"/><circle cx="26" cy="36" r="7" fill="C"/><circle cx="38" cy="36" r="7" fill="C"/><circle cx="32" cy="27" r="5" fill="#fff8d0"/>',
  crystal: '<path d="M32 4 L46 24 L40 58 L24 58 L18 24 Z" fill="C"/><path d="M32 4 L32 58 M18 24 L46 24" stroke="#fff" stroke-width="2" opacity="0.5"/>',
  mask: '<path d="M8 22 C20 14 44 14 56 22 C56 38 44 44 32 36 C20 44 8 38 8 22 Z" fill="C"/><ellipse cx="22" cy="26" rx="6" ry="4" fill="#f4efe4"/><ellipse cx="42" cy="26" rx="6" ry="4" fill="#f4efe4"/>',
  shard: '<path d="M32 2 L48 28 L32 62 L16 28 Z" fill="C"/><path d="M32 2 L32 62" stroke="#fff" stroke-width="2" opacity="0.7"/><circle cx="32" cy="28" r="6" fill="#fff" opacity="0.8"/>',
  seal: '<circle cx="32" cy="34" r="20" fill="C"/><path d="M22 34 L32 24 L42 34 L32 44 Z" fill="#b8404a"/><path d="M26 10 L38 10 L36 16 L28 16 Z" fill="C"/>',
  bell: '<path d="M16 46 C16 18 48 18 48 46 Z" fill="C"/><rect x="12" y="44" width="40" height="5" rx="2" fill="C"/><circle cx="32" cy="54" r="4" fill="#f0c860"/><path d="M28 18 C28 10 36 10 36 18" stroke="#f0c860" stroke-width="3" fill="none"/>',
  bottle: '<rect x="27" y="4" width="10" height="8" rx="2" fill="#c9a57a"/><path d="M27 12 L37 12 L37 22 C44 26 46 30 46 36 L46 56 C46 59 44 60 42 60 L22 60 C20 60 18 59 18 56 L18 36 C18 30 20 26 27 22 Z" fill="C"/><rect x="20" y="38" width="24" height="12" fill="#f3e6c8"/><path d="M24 26 L24 56" stroke="#fff" stroke-width="3" opacity="0.35"/>',
  roll: '<ellipse cx="32" cy="40" rx="24" ry="14" fill="C"/><path d="M12 36 C18 24 46 24 52 36 C44 32 20 32 12 36 Z" fill="#fff6ea"/><circle cx="32" cy="26" r="5" fill="#e8485a"/>',
  berries: '<circle cx="22" cy="38" r="9" fill="C"/><circle cx="36" cy="42" r="9" fill="C"/><circle cx="30" cy="28" r="8" fill="#5a4ab8"/><circle cx="44" cy="30" r="7" fill="#5a4ab8"/><path d="M30 20 C34 10 44 10 48 14 C42 16 36 16 30 20 Z" fill="#7cc26a"/>',
  ring: '<circle cx="32" cy="38" r="17" fill="none" stroke="C" stroke-width="6"/><path d="M32 8 L40 18 L32 24 L24 18 Z" fill="#ff9ecb"/>',
  key: '<circle cx="18" cy="32" r="11" fill="none" stroke="C" stroke-width="6"/><rect x="28" y="29" width="30" height="6" fill="C"/><rect x="48" y="35" width="5" height="10" fill="C"/><rect x="40" y="35" width="4" height="7" fill="C"/>',
  lute: '<ellipse cx="24" cy="42" rx="17" ry="15" fill="C"/><circle cx="24" cy="42" r="5" fill="#3a2a1a"/><rect x="34" y="14" width="7" height="26" transform="rotate(35 37 27)" fill="#6a4a36"/><rect x="46" y="6" width="10" height="9" transform="rotate(35 51 10)" fill="#6a4a36"/>',
  rose: '<path d="M32 60 L32 30" stroke="#4f8a4a" stroke-width="3"/><path d="M32 46 C24 44 20 38 20 38 C28 38 30 42 32 46" fill="#7cc26a"/><circle cx="32" cy="22" r="13" fill="C"/><path d="M26 20 C30 14 38 16 38 22 C34 20 30 22 30 26" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/>',
  book: '<rect x="12" y="10" width="40" height="46" rx="3" fill="C"/><rect x="16" y="14" width="34" height="38" fill="#fbf3df"/><rect x="12" y="10" width="8" height="46" fill="C"/><circle cx="34" cy="32" r="7" fill="#f0c860"/>',
  coin: '<circle cx="32" cy="32" r="22" fill="#f5cf5a"/><circle cx="32" cy="32" r="15" fill="none" stroke="#fff3c0" stroke-width="3"/>',
  spell: '<circle cx="32" cy="32" r="12" fill="#fff4c8"/><path d="M32 4 L36 26 L60 32 L36 38 L32 60 L28 38 L4 32 L28 26 Z" fill="#ffe08a"/>',
  flask: '<rect x="27" y="4" width="10" height="10" rx="2" fill="#d8c0a0"/><path d="M26 14 L38 14 L38 22 C50 28 52 54 32 58 C12 54 14 28 26 22 Z" fill="C"/><path d="M22 40 C26 48 38 48 42 40" stroke="#fff" stroke-width="3" opacity="0.6" fill="none"/>',
};

export function iconSVG(id, colorOverride) {
  const it = ITEMS[id];
  const key = it ? it.icon : id;
  const color = colorOverride || (it ? it.color : '#ffffff');
  const body = (ICONS[key] || ICONS.crystal).replace(/"C"/g, `"${color}"`);
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

export function iconRaw(key, color = '#ffffff') {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${(ICONS[key] || '').replace(/"C"/g, `"${color}"`)}</svg>`;
}

const EFFECT_LABEL = { bleed: 'кровотечение', burn: 'сияющий ожог', frost: 'лунный холод' };

export function describeItem(id) {
  const it = ITEMS[id];
  if (!it) return [];
  const lines = [];
  if (it.dmg) lines.push(['Урон', it.dmg]);
  if (it.speed && it.speed !== 1) lines.push(['Скорость', Math.round(it.speed * 100) + '%']);
  if (it.effect) lines.push(['Эффект', EFFECT_LABEL[it.effect]]);
  if (it.def) lines.push(['Защита', it.def]);
  if (it.hp) lines.push(['Здоровье', '+' + it.hp]);
  if (it.mana) lines.push(['Мана', '+' + it.mana]);
  if (it.dmgMul && it.type === 'amulet') lines.push(['Урон', '+' + Math.round(it.dmgMul * 100) + '%']);
  if (it.heal) lines.push(['Лечение', '+' + it.heal]);
  if (it.sat) lines.push(['Сытость', '+' + it.sat]);
  if (it.instant?.hp) lines.push(['Лечение', '+' + it.instant.hp]);
  if (it.instant?.mana) lines.push(['Мана', '+' + it.instant.mana]);
  if (it.buff) {
    const b = it.buff;
    if (b.stamRegen) lines.push(['Выносл.', '×' + b.stamRegen + ' ' + b.time + 'с']);
    if (b.dmgMul) lines.push(['Урон', '+' + Math.round(b.dmgMul * 100) + '% ' + b.time + 'с']);
    if (b.maxStam) lines.push(['Макс. выносл.', '+' + b.maxStam + ' ' + b.time + 'с']);
    if (b.manaRegen) lines.push(['Мана', '×' + b.manaRegen + ' ' + b.time + 'с']);
  }
  if (it.price) lines.push(['Цена', it.price]);
  return lines;
}

// difference between an item and what is currently equipped in its slot
export function compareItem(id, equipment) {
  const it = ITEMS[id];
  if (!it || !['weapon', 'armor', 'amulet'].includes(it.type)) return null;
  const curId = equipment[it.type];
  if (curId === id) return null;
  const cur = ITEMS[curId] || {};
  const out = [];
  const d = (label, a, b, suffix = '') => { const v = Math.round((a || 0) - (b || 0)); if (v) out.push([label, v, suffix]); };
  if (it.type === 'weapon') { d('Урон', it.dmg, cur.dmg); d('Скорость', (it.speed || 1) * 100, (cur.speed || 1) * 100, '%'); }
  if (it.type === 'armor') d('Защита', it.def, cur.def);
  if (it.type === 'amulet') { d('Здоровье', it.hp, cur.hp); d('Мана', it.mana, cur.mana); d('Урон', (it.dmgMul || 0) * 100, (cur.dmgMul || 0) * 100, '%'); d('Регенерация', it.regen, cur.regen); }
  return { vs: cur.name || 'ничего', diffs: out };
}
