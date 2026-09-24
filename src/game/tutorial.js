// Contextual tutorial: each lesson appears once, at the moment the skill is first needed.
// Seen lessons are stored in the save and can be re-read from the pause menu.
export const LESSONS = [
  { id: 'move', title: 'Движение и камера', keys: [['W A S D', 'идти'], ['Мышь', 'осмотреться'], ['Shift', 'бежать'], ['F', 'прыжок']], text: 'Мышь поворачивает камеру, колесо приближает её. Бег тратит выносливость — зелёную полосу.' },
  { id: 'talk', title: 'Разговор и действия', keys: [['E', 'говорить, открыть, взять']], text: 'Подойдите к человеку или предмету — внизу появится подсказка. Цифры 1–4 выбирают ответ в диалоге.' },
  { id: 'combat', title: 'Бой', keys: [['ЛКМ', 'удар (серия из трёх)'], ['Удерживать ЛКМ', 'мощный удар'], ['ПКМ', 'блок'], ['Пробел', 'перекат'], ['Q', 'захват цели']], text: 'Каждое действие тратит выносливость. Перекат делает вас неуязвимым на миг — катитесь сквозь удар, а не от него.' },
  { id: 'telegraph', title: 'Читайте врага', keys: [['Золотой блик', 'можно парировать'], ['Красный блик', 'уклоняйтесь']], text: 'Перед ударом у врага вспыхивает блик. Поднимите блок (ПКМ) в самый миг удара — это парирование: враг открыт, жмите ЛКМ для сокрушительного удара.' },
  { id: 'heal', title: 'Лечение', keys: [['R', 'флакон слёз рассвета'], ['1–4', 'еда и зелья']], text: 'Флаконы наполняются у алтарей Света. Еда лечит медленно, но её легко найти: яблоки, ягоды, хлеб у торговцев.' },
  { id: 'loot', title: 'Добыча', keys: [['E', 'открыть, обыскать'], ['I', 'снаряжение']], text: 'Сундуки, бочки и шкафы хранят припасы. Предметы на столах можно взять. В инвентаре сравнивайте оружие: зелёные цифры — лучше надетого.' },
  { id: 'altar', title: 'Алтари Света', keys: [['E', 'отдохнуть']], text: 'У алтаря вы исцеляетесь, наполняете флаконы, повышаете уровень за сияние и перемещаетесь к другим алтарям. Но враги вокруг оживают.' },
  { id: 'glimmer', title: 'Сияние и уровень', keys: [['Алтарь', 'повысить уровень']], text: 'За победы вы получаете сияние. У алтаря обменяйте его на уровень и выберите навык. Если падёте, сияние останется там — вернитесь и заберите.' },
  { id: 'night', title: 'Ночь', keys: [['Фонари', 'безопаснее']], text: 'Ночью выходят тени и сумеречные волки, горожане расходятся по домам, а лавки закрываются. Переждать ночь можно у алтаря или в кровати.' },
  { id: 'trade', title: 'Торговля', keys: [['×5', 'купить сразу пять']], text: 'У каждого торговца свой запас и свой кошелёк — товар и золото обновляются каждый день.' },
  { id: 'theft', title: 'Чужое', keys: [['Красная подсказка', 'кража']], text: 'Вещи хозяев подсвечены красным. Если кто-то увидит кражу — придётся заплатить штраф.' },
  { id: 'book', title: 'Книги', keys: [['E', 'читать'], ['← →', 'листать']], text: 'Каждая новая книга приносит сияние и знания: о врагах, о мире, а иногда — ключ к тайне.' },
  { id: 'panels', title: 'Журнал и карта', keys: [['J', 'журнал заданий'], ['M', 'карта'], ['I', 'снаряжение'], ['Esc', 'пауза']], text: 'Отслеживаемое задание отмечено на компасе и карте.' },
  { id: 'mount', title: 'Единорог Астра', keys: [['G', 'позвать или спешиться'], ['Shift', 'галоп']], text: 'Серебряный колокольчик зовёт Астру, где бы вы ни были.' },
  { id: 'perks', title: 'Древо навыков', keys: [['K', 'навыки'], ['B', 'бестиарий']], text: 'Каждый уровень даёт очко навыка. Три ветви — Клинок, Страж и Свет; навыки в ветви открываются по порядку.' },
  { id: 'forge', title: 'Кузница', keys: [['Брам', 'улучшить до +5']], text: 'Кузнец Брам закаляет оружие и броню: нужны золото, железная руда, а для высоких уровней — светлые кристаллы и эссенция сумрака.' },
  { id: 'skill', title: 'Вихрь света', keys: [['V', 'круговой удар'], ['C', 'луч света']], text: 'Вихрь бьёт всех вокруг и тратит ману. Светящиеся клинки посылают вперёд волну света.' },
];

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.checkT = 0;
  }

  seen() { const s = this.game.state; return s.tutorial || (s.tutorial = []); }

  show(id) {
    const g = this.game;
    if (g.settings.tutorial === false) return;
    const seen = this.seen();
    if (seen.includes(id)) return;
    const L = LESSONS.find((l) => l.id === id);
    if (!L) return;
    seen.push(id);
    g.ui.tutorialCard(L);
  }

  update(dt) {
    const g = this.game;
    if (g.mode !== 'play' || g.cine) return;
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 0.5;
    const p = g.player, s = g.state;
    const t = s.stats.time;
    if (t > 1) this.show('move');
    if (g.interact.current) {
      const c = g.interact.current;
      if (c.npc) this.show('talk');
      else if (c.kind === 'chest' || c.kind === 'container' || c.kind === 'pickup') { this.show('loot'); if (c.steal) this.show('theft'); }
      else if (c.kind === 'altar') this.show('altar');
      else if (c.kind === 'book') this.show('book');
    }
    const fighting = g.enemies.some((e) => e.alive && !e.sleeping && (e.state === 'chase' || e.state === 'attack' || e.state === 'strafe') && e.pos.distanceTo(p.pos) < 25);
    if (fighting) this.show('combat');
    if (fighting && this.seen().includes('combat') && (this.combatT = (this.combatT || 0) + 0.5) > 12) this.show('telegraph');
    if (s.player.hp < g.derived().maxHp * 0.55) this.show('heal');
    if (s.player.glimmer > 120) this.show('glimmer');
    if (g.sky.isNight() && t > 30) this.show('night');
    if (Object.keys(s.quests).length >= 2) this.show('panels');
    if (g.itemCount('unicorn_bell')) this.show('mount');
    if (s.player.level >= 2 || (s.player.mana >= 20 && t > 240)) this.show('skill');
  }
}
