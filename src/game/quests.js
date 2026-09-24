// Quest definitions + quest log logic.
import { CASTLE, CAMP, RUINS, CRAG } from '../world/layout.js';

const P = (x, z, y = null) => ({ x, z, y });

export const QUESTS = {
  main1: {
    title: 'Путь к свету', main: true,
    giver: 'Паломница Ива',
    summary: 'Вы очнулись среди цветущих лугов, не помня, как сюда попали. Паломница Ива говорит, что свет королевства угасает.',
    stages: [
      { text: 'Поговорите с паломницей Ивой', markers: (g) => [g.npcPos('iva')] },
      { text: 'Доберитесь до замка Люменхолд на севере', obj: { type: 'reach', loc: 'castle' }, markers: () => [P(0, -186, CASTLE.y)] },
      { text: 'Найдите капитана Роланда у ворот замка', markers: (g) => [g.npcPos('roland')] },
      { text: 'Получите аудиенцию у королевы Элианы в тронном зале донжона', markers: (g) => [g.npcPos('queen')] },
    ],
  },
  main2: {
    title: 'Осколки Рассвета', main: true,
    giver: 'Королева Элиана',
    summary: 'Сердце Света над Люменхолдом тускнеет: три Осколка Рассвета похищены. Магистр Орвин знает, где их искать.',
    stages: [
      { text: 'Поднимитесь в обсерваторию к магистру Орвину (левитационный круг в шпиле на крыше донжона)', markers: (g) => [g.npcPos('orvin')] },
      {
        text: (g) => `Добудьте Осколки Рассвета (${g.shardCount()}/3)`,
        markers: (g) => {
          const m = [];
          if (!g.state.flags.shard_camp) m.push(P(CAMP.x, CAMP.z));
          if (!g.state.flags.shard_ruins) m.push(P(RUINS.x, RUINS.z));
          if (!g.state.flags.shard_crag) m.push(P(CRAG.x, CRAG.z, CRAG.y));
          return m;
        },
        sub: (g) => [
          ['Лагерь Чёрной Лисы (запад, в лесу)', !!g.state.flags.shard_camp],
          ['Хрустальные руины (восточный берег озера)', !!g.state.flags.shard_ruins],
          ['Сумеречный утёс (северо-запад) — барьер спадёт после двух осколков', !!g.state.flags.shard_crag],
        ],
      },
      { text: 'Верните осколки магистру Орвину в обсерваторию', markers: (g) => [g.npcPos('orvin')] },
    ],
  },
  main3: {
    title: 'Новый рассвет', main: true,
    giver: 'Магистр Орвин',
    summary: 'Сердце Света вновь сияет. Королева ждёт вас в тронном зале.',
    stages: [
      { text: 'Поговорите с королевой Элианой', markers: (g) => [g.npcPos('queen')] },
    ],
  },
  wolves: {
    title: 'Волчья напасть', giver: 'Охотник Вольф',
    summary: 'Сумрак сделал волков Шепчущего леса злыми и бесстрашными. Вольф просит проредить стаи.',
    stages: [
      { text: (g) => `Убейте волков (${Math.min(6, g.qprog('wolves', 'kills'))}/6)`, obj: { type: 'kill', kind: 'wolf', count: 6, key: 'kills' }, markers: (g) => { const m = g.enemyMarkers('wolf').concat(g.enemyMarkers('darkwolf')); return m.length ? m.slice(0, 3) : [P(-300, 60)]; } },
      { text: 'Вернитесь к охотнику Вольфу в Медовый Дол', markers: (g) => [g.npcPos('volk')] },
    ],
  },
  moon: {
    title: 'Лунные цветы', giver: 'Алхимик Сельма',
    summary: 'Сельме нужны лунные цветы для зелий. Они растут у берегов Зеркального озера и светятся ночью.',
    stages: [
      { text: (g) => `Соберите лунные цветы (${Math.min(5, g.itemCount('moonflower'))}/5)`, obj: { type: 'collect', item: 'moonflower', count: 5 }, markers: (g) => { const m = g.gatherMarkers('moonflower', 3); return m.length ? m : [P(300, 120), P(140, -40)]; } },
      { text: 'Отнесите цветы алхимику Сельме', markers: (g) => [g.npcPos('selma')] },
    ],
  },
  cat: {
    title: 'Пропавший Пушок', giver: 'Нелли',
    summary: 'У маленькой Нелли убежал кот Пушок. Она видела, как он забирался по лестнице на стену.',
    stages: [
      { text: 'Найдите кота Пушка (ищите на стенах замка)', markers: (g) => (g.state.flags.cat_hint ? [g.catPos()] : []) },
      { text: 'Вернитесь к Нелли у фонтана', markers: (g) => [g.npcPos('nelly')] },
    ],
  },
  blade: {
    title: 'Сталь и свет', giver: 'Кузнец Брам',
    summary: 'Брам может выковать Лунный клинок, если принести ему три светлых кристалла.',
    stages: [
      { text: (g) => `Добудьте светлые кристаллы (${Math.min(3, g.itemCount('light_crystal'))}/3)`, obj: { type: 'collect', item: 'light_crystal', count: 3 }, markers: (g) => { const m = g.gatherMarkers('crystal', 3); return m.length ? m : [P(RUINS.x, RUINS.z)]; } },
      { text: 'Принесите кристаллы кузнецу Браму (и 250 золота)', markers: (g) => [g.npcPos('bram')] },
    ],
  },
  hermit: {
    title: 'Грибная похлёбка', giver: 'Отшельник Эльм',
    summary: 'Старый Эльм давно не выходит из хижины. Он просит собрать лесные грибы.',
    stages: [
      { text: (g) => `Соберите лесные грибы (${Math.min(4, g.itemCount('mushroom'))}/4)`, obj: { type: 'collect', item: 'mushroom', count: 4 }, markers: (g) => g.gatherMarkers('mushroom', 3) },
      { text: 'Отнесите грибы отшельнику Эльму', markers: (g) => [g.npcPos('elm')] },
    ],
  },
  bandits: {
    title: 'Дороги без страха', giver: 'Капитан Роланд',
    summary: 'Разбойники Чёрной Лисы грабят путников на дорогах. Роланд просит разобраться с ними.',
    stages: [
      { text: (g) => `Одолейте разбойников (${Math.min(8, g.qprog('bandits', 'kills'))}/8)`, obj: { type: 'kill', kind: 'bandit', count: 8, key: 'kills' }, markers: () => [P(CAMP.x, CAMP.z)] },
      { text: 'Доложите капитану Роланду', markers: (g) => [g.npcPos('roland')] },
    ],
  },
  letter: {
    title: 'Письмо без подписи', giver: 'Принцесса Аурелия',
    summary: 'Кто-то оставляет принцессе Аурелии нежные письма, подписанные лишь буквой «С.». Она хочет знать, кто их пишет, — и боится, что брат узнает раньше неё.',
    stages: [
      { text: 'Найдите письмо в саду на крыше королевского крыла', markers: (g) => [g.castleSpot('roofGarden')] },
      { text: 'Узнайте, чей это почерк: спросите библиотекаря Эдмунда (галерея тронного зала)', markers: (g) => [g.npcPos('edmund')] },
      { text: 'Поговорите с бардом Флорианом в «Золотом Грифоне»', markers: (g) => [g.npcPos('florian')] },
      {
        text: (g) => (g.state.flags.letter_report ? 'Расскажите обо всём принцу Седрику' : g.itemCount('royal_rose') ? 'Отнесите розу принцессе Аурелии' : 'Сорвите розу в саду на крыше — знак от Флориана'),
        markers: (g) => (g.state.flags.letter_report ? [g.npcPos('cedric')] : g.itemCount('royal_rose') ? [g.npcPos('aurelia')] : [g.castleSpot('roofGarden')]),
      },
    ],
  },
  duel: {
    title: 'Честь принца', giver: 'Принц Седрик',
    summary: 'Принц Седрик тоскует по достойному противнику: стража ему поддаётся. Он предлагает учебный поединок — до просьбы о пощаде.',
    stages: [
      { text: 'Одолейте принца Седрика в учебном поединке (тренировочный двор у казармы)', markers: (g) => [g.npcPos('cedric')] },
      { text: 'Поговорите с принцем Седриком', markers: (g) => [g.npcPos('cedric')] },
    ],
  },
  feast: {
    title: 'Пир на весь замок', giver: 'Повариха Берта',
    summary: 'Королева затеяла пир в честь света, а кладовая Берты пуста. Нужны мясо, мёд из Медового Дола и лесные грибы.',
    stages: [
      {
        text: (g) => `Продукты для пира: мясо ${Math.min(3, g.itemCount('raw_meat'))}/3, мёд ${Math.min(2, g.itemCount('honey'))}/2, грибы ${Math.min(4, g.itemCount('mushroom'))}/4`,
        obj: { type: 'custom', ok: (g) => g.itemCount('raw_meat') >= 3 && g.itemCount('honey') >= 2 && g.itemCount('mushroom') >= 4 },
        markers: (g) => [
          ...(g.itemCount('raw_meat') < 3 ? [g.npcPos('volk')] : []),
          ...(g.itemCount('honey') < 2 ? g.gatherMarkers('honey', 1) : []),
          ...(g.itemCount('mushroom') < 4 ? g.gatherMarkers('mushroom', 2) : []),
        ],
      },
      { text: 'Отнесите продукты Берте на кухню (под террасой, западный вход)', markers: (g) => [g.npcPos('bertha')] },
    ],
  },
  tomes: {
    title: 'Потерянные тома', giver: 'Библиотекарь Эдмунд',
    summary: 'Рассеянный Эдмунд одолжил три редких тома и забыл кому. Один, кажется, читали в трактире, другой — в казарме, третий — в часовне.',
    stages: [
      {
        text: (g) => `Найдите потерянные тома (${Math.min(3, g.itemCount('lost_tome'))}/3)`,
        obj: { type: 'collect', item: 'lost_tome', count: 3 },
        markers: (g) => (g.state.flags.tome_hints ? g.tomeSpots() : []),
        sub: (g) => [['В трактире «Золотой Грифон»', g.taken('tome_tavern')], ['В казарме стражи', g.taken('tome_barracks')], ['В часовне', g.taken('tome_chapel')]],
      },
      { text: 'Верните тома Эдмунду в библиотеку тронного зала', markers: (g) => [g.npcPos('edmund')] },
    ],
  },
  prisoner: {
    title: 'Узник казематов', giver: 'Янек-Лис',
    summary: 'В казематах под террасой сидит разбойник Янек. Он клянётся, что знает, где Гарт спрятал долю награбленного.',
    stages: [
      { text: 'Янек просит сдобную булочку... или открыть его камеру', markers: (g) => [g.npcPos('janek')] },
      { text: 'Найдите тайник Гарта у старого дуба к северу от лагеря Чёрной Лисы', markers: (g) => [g.stashPos()] },
    ],
  },
  ballad: {
    title: 'Баллада о страннике', giver: 'Бард Флориан',
    summary: 'Флориан хочет сложить о вас балладу, но без вдохновения не может. Вдохновение, по его словам, хранится в королевском погребе.',
    stages: [
      { text: 'Добудьте бутылку вина Люменхолда (королевский погреб под террасой)', obj: { type: 'collect', item: 'wine', count: 1 }, markers: (g) => [g.castleSpot('cellar')] },
      { text: 'Отдайте вино Флориану', markers: (g) => [g.npcPos('florian')] },
    ],
  },
  swarm: {
    title: 'Сбежавший рой', giver: 'Пасечница Грета',
    summary: 'Лучший рой Греты улетел к опушке Шепчущего леса. Без матки пасека зачахнет.',
    stages: [
      { text: 'Найдите рой у опушки леса к западу от Медового Дола', markers: (g) => [g.swarmPos()] },
      { text: 'Вернитесь к пасечнице Грете', markers: (g) => [g.npcPos('greta')] },
    ],
  },
  flour: {
    title: 'Мука для замка', giver: 'Мельник Гуго',
    summary: 'Гуго боится дороги через лес и просит доставить мешок муки поварихе Берте в Люменхолд.',
    stages: [
      { text: 'Отнесите мешок муки Берте на кухню замка', markers: (g) => [g.npcPos('bertha')] },
    ],
  },
  troll: {
    title: 'Гроза Шепчущего леса', giver: 'Охотник Вольф',
    summary: 'В глубине Шепчущего леса поселился древний тролль. Он разоряет силки и пугает дровосеков. Вольф обещает научить своему охотничьему приёму того, кто с ним справится.',
    stages: [
      { text: 'Одолейте лесного тролля в глубине Шепчущего леса', obj: { type: 'kill', kind: 'troll', count: 1, key: 'kills' }, markers: (g) => g.enemyMarkers('troll') },
      { text: 'Вернитесь к охотнику Вольфу в Медовый Дол', markers: (g) => [g.npcPos('volk')] },
    ],
  },
  ore: {
    title: 'Руда для кузни', giver: 'Кузнец Брам',
    summary: 'Обоз с рудой не пришёл: на дорогах неспокойно. Браму нужна железная руда — её можно добыть в рудных жилах на горных склонах.',
    stages: [
      { text: (g) => `Добудьте железную руду (${Math.min(6, g.itemCount('iron_ore'))}/6)`, obj: { type: 'collect', item: 'iron_ore', count: 6 }, markers: (g) => g.gatherMarkers('ore', 3) },
      { text: 'Принесите руду Браму', markers: (g) => [g.npcPos('bram')] },
    ],
  },
  beasts: {
    title: 'Записки о тварях Сумрака', giver: 'Магистр Орвин',
    summary: 'Орвин пишет трактат о том, как Сумрак меняет живое. Ему нужны наблюдения из первых рук — изучите побольше разных тварей.',
    stages: [
      { text: (g) => `Изучите разных существ в бестиарии (${Math.min(6, Object.keys(g.state.bestiary || {}).length)}/6) — клавиша B`, obj: { type: 'custom', ok: (g) => Object.keys(g.state.bestiary || {}).length >= 6 }, markers: (g) => g.unstudiedMarkers(3) },
      { text: 'Расскажите обо всём магистру Орвину в обсерватории', markers: (g) => [g.npcPos('orvin')] },
    ],
  },
};

export class QuestLog {
  constructor(game) {
    this.game = game;
  }

  get s() { return this.game.state.quests; }

  status(id) {
    const q = this.s[id];
    if (!q) return 'none';
    return q.done ? 'done' : 'active';
  }

  stage(id) { return this.s[id] ? this.s[id].stage : -1; }
  active(id) { return this.status(id) === 'active'; }
  done(id) { return this.status(id) === 'done'; }

  start(id) {
    if (this.s[id]) return;
    this.s[id] = { stage: 0, prog: {}, done: false };
    if (!this.game.state.tracked || QUESTS[id].main) this.game.state.tracked = id;
    this.game.ui.questToast('Новое задание', QUESTS[id].title);
    this.game.audio.play('quest');
    this.check(id);
  }

  setStage(id, n) {
    const q = this.s[id];
    if (!q || q.done) return;
    q.stage = n;
    q.prog = {};
    this.game.ui.questToast('Задание обновлено', QUESTS[id].title);
    this.game.audio.play('ui');
    this.check(id);
  }

  advance(id) { this.setStage(id, this.stage(id) + 1); }

  complete(id) {
    const q = this.s[id];
    if (!q) return;
    q.done = true;
    if (this.game.state.tracked === id) {
      const next = Object.keys(this.s).find((k) => !this.s[k].done);
      this.game.state.tracked = next || null;
    }
    this.game.ui.questToast('Задание выполнено', QUESTS[id].title, true);
    this.game.audio.play('quest');
  }

  // auto-progress objectives
  check(id) {
    const q = this.s[id];
    if (!q || q.done) return;
    const st = QUESTS[id].stages[q.stage];
    if (!st || !st.obj) return;
    const o = st.obj;
    let ok = false;
    if (o.type === 'collect') ok = this.game.itemCount(o.item) >= o.count;
    if (o.type === 'kill') ok = (q.prog[o.key] || 0) >= o.count;
    if (o.type === 'reach') ok = this.game.state.locations.includes(o.loc);
    if (o.type === 'custom') ok = o.ok(this.game);
    if (ok) this.advance(id);
  }

  event(type, data) {
    for (const id of Object.keys(this.s)) {
      const q = this.s[id];
      if (q.done) continue;
      const st = QUESTS[id].stages[q.stage];
      if (!st || !st.obj) continue;
      const o = st.obj;
      if (type === 'kill' && o.type === 'kill' && data.kinds.includes(o.kind)) {
        q.prog[o.key] = (q.prog[o.key] || 0) + 1;
        this.game.ui.refreshQuestTracker();
      }
      this.check(id);
    }
  }

  stageText(id) {
    const q = this.s[id];
    if (!q) return '';
    if (q.done) return 'Выполнено';
    const st = QUESTS[id].stages[q.stage];
    if (!st) return '';
    return typeof st.text === 'function' ? st.text(this.game) : st.text;
  }

  // markers are cheap to read but some are costly to compute (nearest bushes/veins/enemies): cache briefly
  markers() {
    const now = performance.now();
    if (this._mk && now - this._mkT < 500 && this._mkTracked === this.game.state.tracked) return this._mk.slice();
    this._mk = this.computeMarkers(); this._mkT = now; this._mkTracked = this.game.state.tracked;
    return this._mk.slice();
  }

  computeMarkers() {
    const out = [];
    for (const id of Object.keys(this.s)) {
      const q = this.s[id];
      if (q.done) continue;
      const st = QUESTS[id].stages[q.stage];
      if (!st || !st.markers) continue;
      const tracked = this.game.state.tracked === id;
      for (const m of st.markers(this.game)) if (m) out.push({ x: m.x, z: m.z, y: m.y, tracked, main: !!QUESTS[id].main, quest: id });
    }
    return out;
  }
}
