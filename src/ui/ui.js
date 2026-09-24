// All HTML UI: HUD, dialogue, inventory, shop, journal, map, menus.
import * as THREE from 'three';
import { ITEMS, CATEGORIES, iconSVG, iconRaw, describeItem, compareItem } from '../game/items.js';
import { QUESTS } from '../game/quests.js';
import { SHOPS } from '../game/dialogues.js';
import { BOOKS } from '../game/books.js';
import { LESSONS } from '../game/tutorial.js';
import { PERKS, BRANCHES, hasPerk, perkPoints, canLearn, upgradeLevel, upgradeCost, upgradeBonus, MAX_UPGRADE } from '../game/perks.js';
import { BESTIARY } from '../game/bestiary.js';
import { ENEMY_TYPES } from '../entities/enemy.js';
import { levelCost, formatHour, hasSave } from '../game/state.js';
import { LOCATIONS, ALTARS, WORLD } from '../world/layout.js';

const $ = (sel, root = document) => root.querySelector(sel);
const cmpHtml = (c) => (c && c.diffs.length
  ? `<div class="cmp"><small>по сравнению с «${esc(c.vs)}»</small>${c.diffs.map(([k, v, u]) => `<div class="kv"><span>${k}</span><b class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '▲ +' : '▼ '}${v}${u}</b></div>`).join('')}</div>`
  : '');
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RECIPES = [
  { id: 'cooked_meat', name: 'Жареное мясо', needs: { raw_meat: 1 } },
  { id: 'stew', name: 'Рагу странника', needs: { raw_meat: 1, mushroom: 2 } },
  { id: 'berry_tea', name: 'Ягодный чай', needs: { herb: 1, berries: 2 } },
  { id: 'honey_pie', name: 'Медовый пирог', needs: { honey: 1, bread: 1, apple: 1 } },
];

// alchemy (cauldron in Selma's shop, alchemist tables)
const ALCHEMY = [
  { id: 'potion_hp', name: 'Зелье здоровья', needs: { herb: 2, berries: 1 } },
  { id: 'potion_stamina', name: 'Зелье выносливости', needs: { honey: 1, herb: 1 } },
  { id: 'potion_mana', name: 'Зелье маны', needs: { moonflower: 1, berries: 2 } },
  { id: 'elixir_light', name: 'Эликсир света', needs: { moonflower: 2, light_crystal: 1 } },
];

const STAT_NAMES = {
  vig: ['Живучесть', 'Здоровье +14'],
  end: ['Стойкость', 'Выносливость +9'],
  str: ['Сила', 'Урон оружием +7.5%'],
  mind: ['Разум', 'Мана +9, сила магии +11%'],
};

export class UI {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.menu = null; // current menu name
    this.dialogState = null;
    this.invCat = 'all';
    this.invSel = null;
    this.shopMode = 'buy';
    this.journalSel = null;
    this.labels = new Map();
    this.dmgNums = [];
    this.notifQueue = [];
    this.boss = null;
    this.buildHUD();
    this.buildMenus();
    this._v = new THREE.Vector3();
  }

  // ==================================================================
  // HUD
  // ==================================================================
  buildHUD() {
    const h = el('div', 'hud');
    h.id = 'hud';
    h.innerHTML = `
      <div class="bars">
        <div class="lvl" id="h-lvl">1</div>
        <div class="barwrap">
          <div class="brow"><div class="bar hp" title="Здоровье: падает от ударов. Лечение — флакон (R), еда и зелья (1–4), отдых у алтаря"><div class="fill" id="h-hp"></div><div class="ghost" id="h-hpg"></div></div><i class="blab" id="h-hpt"></i></div>
          <div class="brow"><div class="bar st" title="Выносливость: тратится на удары, блок, перекаты и бег, быстро восстанавливается сама"><div class="fill" id="h-st"></div></div><i class="blab" id="h-stt"></i></div>
          <div class="brow"><div class="bar mp" title="Мана: для «Вихря света» (V) и «Луча света» (C)"><div class="fill" id="h-mp"></div></div><i class="blab" id="h-mpt"></i></div>
          <div class="subrow"><span class="sat" id="h-sat" title="Сытость: убывает со временем. На нуле выносливость восстанавливается медленнее; сидя на скамье вы лечитесь, только если сыты. Ешьте еду (1–4)"></span><i class="blab" id="h-satt"></i><span id="h-buffs" class="buffs"></span></div>
        </div>
      </div>
      <div class="compass"><div class="strip" id="h-compass"></div><div class="needle"></div></div>
      <div class="clock" id="h-clock"></div>
      <div class="tracker" id="h-tracker"></div>
      <div class="hotbar" id="h-hotbar"></div>
      <div class="purse"><div><span class="coin"></span><b id="h-gold">0</b></div><div class="glim"><span class="gl"></span><b id="h-glim">0</b></div></div>
      <div class="prompt" id="h-prompt"></div>
      <div class="bossbar" id="h-boss"><div class="bname" id="h-bname"></div><div class="bbar"><div class="fill" id="h-bfill"></div><div class="ghost" id="h-bghost"></div></div></div>
      <div class="notifs" id="h-notifs"></div>
      <div class="toasts" id="h-toasts"></div>
      <div class="bigtext" id="h-big"></div>
      <div class="hint" id="h-hint"></div>
      <div class="ctext" id="h-ctext"></div>
      <div class="flash" id="h-flash"></div>
      <div class="lockon" id="h-lock"></div>
      <div class="labels" id="h-labels"></div>
      <div class="fps" id="h-fps"></div>
    `;
    this.root.appendChild(h);
    this.hud = h;
    this.e = {};
    for (const id of ['hpt', 'stt', 'mpt', 'satt', 'lvl', 'hp', 'hpg', 'st', 'mp', 'sat', 'buffs', 'compass', 'clock', 'tracker', 'hotbar', 'gold', 'glim', 'prompt', 'boss', 'bname', 'bfill', 'bghost', 'notifs', 'toasts', 'big', 'hint', 'ctext', 'flash', 'lock', 'labels', 'fps']) {
      this.e[id] = $('#h-' + id, h);
    }
    this.fadeEl = el('div', 'fadeov', '');
    this.root.appendChild(this.fadeEl);
    // compass letters
    const dirs = [['С', 0], ['СВ', 45], ['В', 90], ['ЮВ', 135], ['Ю', 180], ['ЮЗ', 225], ['З', 270], ['СЗ', 315]];
    this.compassItems = dirs.map(([t, deg]) => {
      const d = el('span', 'cdir' + (t.length === 1 ? ' main' : ''), t);
      this.e.compass.appendChild(d);
      return { el: d, deg };
    });
    this.compassMarkers = [];
    this.hpGhost = 1;
    this.bossGhost = 1;
  }

  refreshHotbar() {
    const g = this.game;
    const s = g.state;
    let html = `<div class="slot flask" title="Флакон слёз рассвета (R)">${iconRaw('flask', '#ffcf7a')}<i>R</i><b>${s.player.flasks}</b></div>`;
    for (let k = 0; k < 4; k++) {
      const id = s.hotbar[k];
      const n = id ? g.itemCount(id) : 0;
      html += `<div class="slot ${id && !n ? 'empty' : ''}">${id ? iconSVG(id) : ''}<i>${k + 1}</i>${id ? `<b>${n}</b>` : ''}</div>`;
    }
    if (s.spells.includes('light_bolt')) html += `<div class="slot spell" title="Луч света (C) — 14 маны">${iconRaw('spell')}<i>C</i></div>`;
    this.e.hotbar.innerHTML = html;
  }

  refreshQuestTracker() {
    const g = this.game;
    const id = g.state.tracked;
    if (!id || !g.state.quests[id] || g.state.quests[id].done) { this.e.tracker.innerHTML = ''; return; }
    const q = QUESTS[id];
    let sub = '';
    const st = q.stages[g.state.quests[id].stage];
    if (st && st.sub) sub = st.sub(g).map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${esc(t)}</li>`).join('');
    this.e.tracker.innerHTML = `<div class="qt ${q.main ? 'main' : ''}">${esc(q.title)}</div><div class="qo">${esc(g.quests.stageText(id))}</div>${sub ? `<ul>${sub}</ul>` : ''}`;
  }

  update(dt) {
    const g = this.game;
    const s = g.state;
    const p = s.player;
    const d = g.derived();
    // bars (widths scale with max)
    const hpf = Math.max(0, p.hp / d.maxHp);
    this.e.hp.style.width = hpf * 100 + '%';
    this.hpGhost = Math.max(hpf, this.hpGhost - dt * 0.35);
    this.e.hpg.style.width = this.hpGhost * 100 + '%';
    this.e.hp.parentElement.style.width = Math.min(46, 16 + d.maxHp * 0.1) + 'vw';
    this.e.st.style.width = Math.max(0, p.stamina / d.maxStamina) * 100 + '%';
    this.e.st.parentElement.style.width = Math.min(40, 13 + d.maxStamina * 0.09) + 'vw';
    this.e.st.parentElement.classList.toggle('exhausted', g.player.exhausted);
    this.e.mp.style.width = Math.max(0, p.mana / d.maxMana) * 100 + '%';
    this.e.mp.parentElement.style.width = Math.min(34, 8 + d.maxMana * 0.12) + 'vw';
    this.e.lvl.textContent = p.level;
    const satPct = Math.round(p.satiety);
    this.e.sat.innerHTML = `<i style="width:${satPct}%"></i>`;
    this.e.sat.classList.toggle('hungry', satPct <= 15);
    this.e.hpt.textContent = `Здоровье ${Math.ceil(p.hp)}/${d.maxHp}`;
    this.e.stt.textContent = g.player.exhausted ? 'Выносливость — нет сил!' : `Выносливость ${Math.round(p.stamina)}`;
    this.e.mpt.textContent = `Мана ${Math.floor(p.mana)}`;
    this.e.satt.textContent = `Сытость ${satPct}%`;
    this.e.gold.textContent = s.gold;
    this.e.glim.textContent = p.glimmer;
    // buffs
    const bh = s.buffs.map((b) => `<span title="${esc(b.name)}">${iconSVG(b.id)}<em>${Math.ceil(b.time)}</em></span>`).join('');
    if (bh !== this._buffHtml) { this.e.buffs.innerHTML = bh; this._buffHtml = bh; }
    // clock
    const night = g.sky.isNight();
    this.e.clock.innerHTML = `<span class="${night ? 'moon' : 'sun'}"></span>${formatHour(s.hour)} <small>День ${s.day}</small>`;
    // compass
    this.updateCompass();
    // hotbar refresh occasionally
    this._hbT = (this._hbT || 0) - dt;
    if (this._hbT <= 0) { this._hbT = 0.4; this.refreshHotbar(); this.refreshQuestTracker(); }
    // boss
    if (this.boss) {
      const b = this.boss;
      const f = Math.max(0, b.hp / b.maxHp);
      this.e.bfill.style.width = f * 100 + '%';
      this.bossGhost = Math.max(f, this.bossGhost - dt * 0.25);
      this.e.bghost.style.width = this.bossGhost * 100 + '%';
      if (!b.alive || g.player.pos.distanceTo(b.pos) > 90) this.setBoss(null);
    }
    this.updateLabels(dt);
    // flash decay
    if (this.flashV > 0) { this.flashV = Math.max(0, this.flashV - dt * 1.6); this.e.flash.style.opacity = this.flashV; }
    const low = hpf < 0.25 && g.player.state !== 'dead';
    this.e.flash.classList.toggle('low', low);
  }

  updateCompass() {
    const g = this.game;
    const yaw = g.cam.yaw; // forward = (sin yaw, cos yaw). North = -z
    // heading in degrees where 0 = north(-z), 90 = east(+x)
    const heading = ((Math.atan2(Math.sin(yaw), -Math.cos(yaw)) * 180) / Math.PI + 360) % 360;
    const W = this.e.compass.clientWidth || 400;
    const fov = 180;
    const place = (elem, deg) => {
      let diff = ((deg - heading + 540) % 360) - 180;
      const vis = Math.abs(diff) < fov / 2;
      elem.style.display = vis ? '' : 'none';
      if (vis) elem.style.left = (W / 2 + (diff / (fov / 2)) * (W / 2)) + 'px';
    };
    for (const c of this.compassItems) place(c.el, c.deg);
    // markers
    const markers = g.quests.markers();
    const p = g.player.pos;
    for (const a of ALTARS) if (g.state.altars.includes(a.id)) markers.push({ x: a.x, z: a.z, altar: true });
    if (g.state.mapPin) markers.push({ x: g.state.mapPin.x, z: g.state.mapPin.z, pin: true });
    while (this.compassMarkers.length < markers.length) {
      const m = el('span', 'cmark');
      this.e.compass.appendChild(m);
      this.compassMarkers.push(m);
    }
    this.compassMarkers.forEach((m, i) => {
      const mk = markers[i];
      if (!mk) { m.style.display = 'none'; return; }
      const dx = mk.x - p.x, dz = mk.z - p.z;
      const deg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      m.className = 'cmark' + (mk.pin ? ' pin' : mk.altar ? ' altar' : mk.main ? ' main' : '') + (mk.tracked ? ' tracked' : '');
      const dist = Math.hypot(dx, dz);
      m.innerHTML = mk.altar ? '' : `<em>${dist < 1000 ? Math.round(dist) + 'м' : ''}</em>`;
      if (mk.altar && dist > 300) { m.style.display = 'none'; return; }
      place(m, deg);
    });
  }

  // ---------- world-space labels (npc names, enemy bars, damage numbers) ----------
  project(v) {
    const cam = this.game.camera;
    this._v.copy(v).project(cam);
    if (this._v.z > 1 || this._v.z < -1) return null;
    return { x: (this._v.x * 0.5 + 0.5) * innerWidth, y: (-this._v.y * 0.5 + 0.5) * innerHeight };
  }

  label(key, cls) {
    let l = this.labels.get(key);
    if (!l) {
      l = el('div', 'lbl ' + cls);
      this.e.labels.appendChild(l);
      this.labels.set(key, l);
    }
    l._used = true;
    return l;
  }

  updateLabels(dt) {
    const g = this.game;
    const p = g.player;
    for (const l of this.labels.values()) l._used = false;
    const inMenu = g.mode !== 'play';
    if (!inMenu) {
      // NPC names
      for (const n of g.npcs) {
        if (!n.visible) continue;
        const d = n.pos.distanceTo(p.pos);
        if (d > 9 || !n.def.named) continue;
        const sp = this.project(this._tmp().set(n.pos.x, n.pos.y + n.height + 0.35, n.pos.z));
        if (!sp) continue;
        const l = this.label('n' + n.id, 'npc');
        l.innerHTML = `<b>${esc(n.name)}</b>${n.title ? `<small>${esc(n.title)}</small>` : ''}${g.npcHasQuest(n) ? '<i class="qmark">!</i>' : ''}`;
        l.style.transform = `translate(${sp.x}px, ${sp.y}px)`;
        l.style.opacity = Math.min(1, (9 - d) / 3);
      }
      // enemy bars
      for (const e of g.enemies) {
        if (!e.alive || e.boss) continue;
        const recent = g.time - e.lastHit < 6 || p.lockTarget === e;
        if (!recent) continue;
        const d = e.pos.distanceTo(p.pos);
        if (d > 40) continue;
        const sp = this.project(this._tmp().set(e.pos.x, e.pos.y + e.height + 0.5, e.pos.z));
        if (!sp) continue;
        const l = this.label('e' + e.id, 'ebar');
        l.innerHTML = `<div class="en">${esc(e.name)}</div><div class="eb"><i style="width:${(e.hp / e.maxHp) * 100}%"></i></div>`;
        l.style.transform = `translate(${sp.x}px, ${sp.y}px)`;
      }
    }
    // speech barks
    for (let i = (this.barks || []).length - 1; i >= 0; i--) {
      const b = this.barks[i];
      b.t += dt;
      const n = b.npc;
      if (b.t > 4 || !n.visible || n.pos.distanceTo(p.pos) > 18) { b.el.remove(); this.barks.splice(i, 1); continue; }
      const sp = inMenu ? null : this.project(this._tmp().set(n.pos.x, n.pos.y + n.height + (n.def.named ? 0.9 : 0.45), n.pos.z));
      b.el.style.display = sp ? '' : 'none';
      if (!sp) continue;
      b.el.style.transform = `translate(${sp.x}px, ${sp.y}px)`;
      b.el.style.opacity = Math.min(1, b.t * 4, (4 - b.t) * 2);
    }
    for (const [k, l] of this.labels) if (!l._used) { l.remove(); this.labels.delete(k); }
    // lock-on reticle
    const t = p.lockTarget;
    if (t && !inMenu) {
      const sp = this.project(this._tmp().set(t.pos.x, t.pos.y + t.height * 0.6, t.pos.z));
      if (sp) { this.e.lock.style.display = 'block'; this.e.lock.style.transform = `translate(${sp.x}px, ${sp.y}px)`; this.e.lock.classList.toggle('vuln', !!t.vulnerable); } else this.e.lock.style.display = 'none';
    } else this.e.lock.style.display = 'none';
    // damage numbers
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const n = this.dmgNums[i];
      n.t += dt;
      n.pos.y += dt * 1.2;
      const sp = this.project(n.pos);
      if (n.t > 1.1 || !sp) { n.el.remove(); this.dmgNums.splice(i, 1); continue; }
      n.el.style.transform = `translate(${sp.x}px, ${sp.y}px) scale(${1 + Math.max(0, 0.3 - n.t) * 1.5})`;
      n.el.style.opacity = Math.min(1, (1.1 - n.t) * 3);
    }
  }

  bark(npc, text) {
    this.barks = this.barks || [];
    for (const b of this.barks) if (b.npc === npc) b.t = 99;
    const e = el('div', 'bark', esc(text));
    this.e.labels.appendChild(e);
    this.barks.push({ npc, el: e, t: 0 });
  }

  _tmp() { return this._tv || (this._tv = new THREE.Vector3()); }

  damageNumber(pos, amount, kind, color) {
    const txt = typeof amount === 'string';
    if (!txt && amount < 0.5) return;
    const e = el('div', 'dmg ' + kind, txt ? esc(amount) : Math.round(amount));
    if (color) e.style.color = color;
    this.e.labels.appendChild(e);
    this.dmgNums.push({ el: e, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), t: 0 });
  }

  // ---------- messages ----------
  notify(html, icon = null) {
    const n = el('div', 'notif', `${icon ? `<span class="ni">${icon}</span>` : ''}<span>${html}</span>`);
    this.e.notifs.appendChild(n);
    setTimeout(() => n.classList.add('out'), 3200);
    setTimeout(() => n.remove(), 3800);
    while (this.e.notifs.children.length > 6) this.e.notifs.firstChild.remove();
  }

  questToast(head, title, done = false) {
    const t = el('div', 'toast' + (done ? ' done' : ''), `<small>${esc(head)}</small><b>${esc(title)}</b>`);
    this.e.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4500);
    this.refreshQuestTracker();
  }

  hint(text, dur = 3.5) {
    this.e.hint.textContent = text;
    this.e.hint.classList.add('on');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => this.e.hint.classList.remove('on'), dur * 1000);
  }

  prompt(text, cls = '') {
    const key = text ? text + '|' + cls : null;
    if (key === this._prompt) return;
    this._prompt = key;
    this.e.prompt.innerHTML = text ? `<kbd>E</kbd> ${esc(text)}` : '';
    this.e.prompt.className = 'prompt' + (text ? ' on' : '') + (cls ? ' ' + cls : '');
  }

  combatText(text, color = '#fff', small = false) {
    const c = this.e.ctext;
    c.textContent = text;
    c.style.color = color;
    c.className = 'ctext on' + (small ? ' small' : '');
    clearTimeout(this._ctT);
    this._ctT = setTimeout(() => c.classList.remove('on'), 1300);
  }

  bigText(text, sub = '', cls = '') {
    const b = this.e.big;
    b.className = 'bigtext on ' + cls;
    b.innerHTML = `<div class="bt">${esc(text)}</div>${sub ? `<div class="bs">${esc(sub)}</div>` : ''}`;
    clearTimeout(this._bigT);
    this._bigT = setTimeout(() => b.classList.remove('on'), cls === 'death' ? 3600 : 4200);
  }

  locationTitle(name) { this.bigText(name, 'Новое место', 'loc'); }

  // tutorial card: slides in at the left, stays ~11 s, one at a time (queued)
  tutorialCard(L) {
    this._tutQ = this._tutQ || [];
    this._tutQ.push(L);
    if (!this._tutBusy) this._nextTut();
  }

  _nextTut() {
    const L = this._tutQ.shift();
    if (!L) { this._tutBusy = false; return; }
    this._tutBusy = true;
    if (!this.tutEl) { this.tutEl = el('div', 'tutcard', ''); this.root.appendChild(this.tutEl); }
    const t = this.tutEl;
    t.innerHTML = `<small>Обучение</small><h4>${esc(L.title)}</h4><div class="tk">${L.keys.map(([k, v]) => `<div><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`).join('')}</div><p>${esc(L.text)}</p>`;
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    this.game.audio.play('ui');
    clearTimeout(this._tutT);
    this._tutT = setTimeout(() => { t.classList.remove('on'); setTimeout(() => this._nextTut(), 600); }, 11000);
  }

  render_lessons() {
    // full handbook: every lesson is readable at any time (seen ones first)
    const seen = this.game.state.tutorial || [];
    const list = [...LESSONS.filter((l) => seen.includes(l.id)), ...LESSONS.filter((l) => !seen.includes(l.id))];
    return `<div class="pausebox wide lessons"><h2>Справочник</h2>${list.length ? list.map((L) => `<div class="lesson"><h4>${esc(L.title)}</h4><div class="tk">${L.keys.map(([k, v]) => `<div><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`).join('')}</div><p>${esc(L.text)}</p></div>`).join('') : '<p class="empty-note">Уроки появятся по мере игры.</p>'}<button data-act="back">Назад</button></div>`;
  }

  letterbox(on) {
    if (!this.lbEl) {
      this.lbEl = el('div', 'letterbox', '<i></i><i></i><div class="sub"></div><div class="skip">Пробел — пропустить</div>');
      this.root.appendChild(this.lbEl);
    }
    this.lbEl.classList.toggle('on', on);
    this.hud.classList.toggle('in-cine', on);
  }

  subtitle(text) {
    if (!this.lbEl) return;
    const sub = this.lbEl.querySelector('.sub');
    sub.classList.remove('show');
    const token = this._subTok = (this._subTok || 0) + 1;
    if (!text) return;
    setTimeout(() => { if (token !== this._subTok) return; sub.textContent = text; sub.classList.add('show'); }, 250);
  }

  // full-screen fade (sleep, travel): fades in, holds, fades out
  fadeScreen(hold = 0.8, color = '#1c1530') {
    const f = this.fadeEl;
    f.style.background = color;
    f.classList.add('on');
    clearTimeout(this._fadeT);
    this._fadeT = setTimeout(() => f.classList.remove('on'), 450 + hold * 1000);
  }

  flash(v) { this.flashV = Math.min(0.9, (this.flashV || 0) + v); this.e.flash.style.opacity = this.flashV; }

  setBoss(b, onlyIf) {
    if (onlyIf && this.boss !== onlyIf) return;
    this.boss = b;
    this.e.boss.classList.toggle('on', !!b);
    if (b) { this.e.bname.textContent = b.name; this.bossGhost = b.hp / b.maxHp; }
  }

  setFPS(v) { this.e.fps.textContent = v ? v + ' FPS' : ''; }

  // ==================================================================
  // MENUS
  // ==================================================================
  buildMenus() {
    const m = el('div', 'menus');
    m.id = 'menus';
    m.innerHTML = `
      <div class="dialog" id="m-dialog"><div class="dname" id="m-dname"></div><div class="dtext" id="m-dtext"></div><ol class="dopts" id="m-dopts"></ol></div>
      <div class="panel" id="m-panel"></div>
    `;
    this.root.appendChild(m);
    this.menusEl = m;
    this.dEl = { box: $('#m-dialog', m), name: $('#m-dname', m), text: $('#m-dtext', m), opts: $('#m-dopts', m) };
    this.panel = $('#m-panel', m);
    this.panel.addEventListener('click', (e) => this.onPanelClick(e));
    this.dEl.opts.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-i]');
      if (li) this.chooseOption(+li.dataset.i);
    });
  }

  isOpen() { return !!this.menu || !!this.dialogState; }

  // ---------- dialogue ----------
  openDialog(npc, tree) {
    this.dialogState = { npc, tree, node: tree.start };
    this.dEl.box.classList.add('on');
    this.renderDialog();
    this.game.audio.play('uiOpen');
  }

  renderDialog() {
    const ds = this.dialogState;
    if (!ds) return;
    const node = ds.tree.nodes[ds.node];
    if (!node) { this.closeDialog(); return; }
    const text = typeof node.text === 'function' ? node.text() : node.text;
    this.dEl.name.innerHTML = `${esc(ds.npc.name)}${ds.npc.title ? `<small>${esc(ds.npc.title)}</small>` : ''}`;
    // typewriter
    this.dEl.text.textContent = '';
    clearInterval(this._tw);
    let i = 0;
    this._twFull = text;
    this._tw = setInterval(() => {
      i += 2;
      this.dEl.text.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(this._tw);
    }, 16);
    ds.options = node.options.filter((o) => !o.cond || o.cond());
    this.dEl.opts.innerHTML = ds.options.map((o, k) => `<li data-i="${k}"><kbd>${k + 1}</kbd>${esc(typeof o.text === 'function' ? o.text() : o.text)}</li>`).join('');
  }

  chooseOption(i) {
    const ds = this.dialogState;
    if (!ds) return;
    // finish typewriter first
    if (this.dEl.text.textContent.length < (this._twFull || '').length) {
      clearInterval(this._tw);
      this.dEl.text.textContent = this._twFull;
      return;
    }
    const o = ds.options[i];
    if (!o) return;
    this.game.audio.play('ui');
    if (o.close) this.closeDialog();
    if (o.action) o.action();
    if (!o.close && o.next) { ds.node = o.next; this.renderDialog(); }
  }

  closeDialog() {
    if (!this.dialogState) return;
    const npc = this.dialogState.npc;
    this.dialogState = null;
    clearInterval(this._tw);
    this.dEl.box.classList.remove('on');
    this.game.endDialog(npc);
  }

  // ---------- generic panel ----------
  open(name, data = null) {
    this.openedAt = performance.now();
    this.menu = name;
    this.menuData = data;
    this.panel.className = 'panel on ' + name;
    this.render();
    this.game.onMenuChange();
    this.game.audio.play('uiOpen');
  }

  close() {
    if (!this.menu) return;
    const was = this.menu;
    this.menu = null;
    this.panel.className = 'panel';
    this.panel.innerHTML = '';
    this.game.onMenuChange(was);
    this.game.audio.play('uiClose');
  }

  render() {
    const fn = this['render_' + this.menu];
    if (fn) this.panel.innerHTML = fn.call(this);
    if (this.menu === 'map') this.drawMap();
    if (this.menu === 'settings') this.bindSettingsInputs();
  }

  handleKey(code) {
    // returns true if consumed
    if (this.dialogState) {
      if (/^Digit[1-9]$/.test(code)) { this.chooseOption(+code.slice(5) - 1); return true; }
      if (code === 'Space' || code === 'Enter' || code === 'KeyE') {
        if (this.dEl.text.textContent.length < (this._twFull || '').length) { this.chooseOption(0); return true; }
        if (this.dialogState.options.length === 1) this.chooseOption(0);
        return true;
      }
      if (code === 'Escape') { this.closeDialog(); return true; }
      return true;
    }
    if (!this.menu) return false;
    const m = this.menu;
    if (code === 'Escape' && performance.now() - (this.openedAt || 0) < 300) return true;
    if (code === 'Escape' || (code === 'Tab' && m === 'inventory') || (code === 'KeyI' && m === 'inventory') || (code === 'KeyJ' && m === 'journal') || (code === 'KeyM' && m === 'map') || ((code === 'KeyK' || code === 'KeyB') && m === 'character')) {
      if (m === 'title' || m === 'death' || m === 'ending') return true;
      if (m === 'settings' || m === 'controls' || m === 'lessons') { this.open(this.prevMenu || 'pause'); return true; }
      if (m === 'levelup' || (m === 'map' && this.menuData?.travel)) { this.open('altar', this.altarData); return true; }
      this.close();
      return true;
    }
    if (m === 'book' && (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowLeft' || code === 'KeyA')) {
      const d = code === 'ArrowRight' || code === 'KeyD' ? 2 : -2;
      const n = BOOKS[this.menuData.book].pages.length;
      const np = (this.menuData.page || 0) + d;
      if (np >= 0 && np < n) { this.menuData.page = np; this.game.audio.play('page'); this.render(); }
      return true;
    }
    if (m === 'book' && code === 'KeyE') { this.close(); return true; }
    if (m === 'inventory' && this.invSel && /^Digit[1-4]$/.test(code)) {
      this.assignHotbar(this.invSel, +code.slice(5) - 1);
      return true;
    }
    return true;
  }

  onPanelClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const g = this.game;
    const act = t.dataset.act;
    const arg = t.dataset.arg;
    g.audio.play('ui');
    switch (act) {
      case 'close': this.close(); break;
      case 'cat': this.invCat = arg; this.render(); break;
      case 'sel': this.invSel = arg; this.render(); break;
      case 'equip': g.equip(arg); this.render(); break;
      case 'use': if (g.player.consume(arg)) this.close(); break;
      case 'hot': this.assignHotbar(this.invSel, +arg); break;
      case 'drop': g.takeItem(arg, 1); if (!g.itemCount(arg)) this.invSel = null; this.render(); break;
      case 'shopmode': this.shopMode = arg; this.render(); break;
      case 'buy': g.buy(this.menuData.shop, arg); this.render(); break;
      case 'buy5': g.buy(this.menuData.shop, arg, 5); this.render(); break;
      case 'sell': g.sell(this.menuData.shop, arg); this.render(); break;
      case 'qsel': this.journalSel = arg; this.render(); break;
      case 'track': g.state.tracked = arg; this.refreshQuestTracker(); this.render(); break;
      case 'rest': g.restAtAltar(this.menuData.altar); this.render(); break;
      case 'levelup': this.altarData = this.menuData; this.open('levelup', { ...this.menuData, alloc: { vig: 0, end: 0, str: 0, mind: 0 } }); break;
      case 'stat': this.addStat(arg, +t.dataset.d); break;
      case 'confirmLevel': g.applyLevelUp(this.menuData.alloc); this.open('altar', this.altarData); break;
      case 'travelmap': this.altarData = this.menuData; this.open('map', { travel: true }); break;
      case 'wait': g.waitUntil(+arg); this.render(); break;
      case 'travel': g.fastTravel(arg); break;
      case 'cook': g.cook((this.menuData?.alchemy ? ALCHEMY : RECIPES).find((r) => r.id === arg), !!this.menuData?.alchemy); this.render(); break;
      case 'resume': this.close(); break;
      case 'save': g.save(true); break;
      case 'load': g.loadSaved(); break;
      case 'settings': this.prevMenu = this.menu; this.open('settings'); break;
      case 'controls': this.prevMenu = this.menu; this.open('controls'); break;
      case 'lessons': this.prevMenu = this.menu; this.open('lessons'); break;
      case 'back': this.open(this.prevMenu || 'pause'); break;
      case 'quality': g.setQuality(arg); this.render(); break;
      case 'toggle': g.toggleSetting(arg); this.render(); break;
      case 'quit': g.toTitle(); break;
      case 'newgame': g.newGame(); break;
      case 'continue': g.continueGame(); break;
      case 'respawn': g.respawn(); break;
      case 'endcontinue': this.close(); break;
      case 'bpage': this.menuData.page = Math.max(0, (this.menuData.page || 0) + +arg); g.audio.play('page'); this.render(); break;
      case 'sleep': g.sleepAt(+arg, this.menuData.bed); break;
      case 'jtab': this.journalTab = arg; this.render(); break;
      case 'openbook': this.prevMenu = 'journal'; g.readBook(arg); break;
      case 'ctab': this.charTab = arg; this.render(); break;
      case 'perk': { const [b, i] = arg.split(':'); if (g.learnPerk(b, +i)) this.render(); break; }
      case 'beast': this.beastSel = arg; this.render(); break;
      case 'fsel': this.forgeSel = arg; this.render(); break;
      case 'forge': if (g.upgradeItem(arg)) this.render(); break;
      case 'character': this.charTab = 'perks'; this.open('character'); break;
      default: break;
    }
  }

  assignHotbar(id, k) {
    const g = this.game;
    const it = ITEMS[id];
    if (!it || (it.type !== 'food' && it.type !== 'potion')) { this.hint('На панель можно поместить только еду и зелья'); return; }
    const hb = g.state.hotbar;
    for (let i = 0; i < 4; i++) if (hb[i] === id) hb[i] = null;
    hb[k] = id;
    this.refreshHotbar();
    this.render();
  }

  addStat(stat, delta) {
    const g = this.game;
    const a = this.menuData.alloc;
    const total = Object.values(a).reduce((x, y) => x + y, 0);
    if (delta > 0) {
      let cost = 0;
      for (let i = 0; i <= total; i++) cost += levelCost(g.state.player.level + i);
      if (cost > g.state.player.glimmer) { this.hint('Недостаточно сияния'); return; }
      a[stat]++;
    } else if (a[stat] > 0) a[stat]--;
    this.render();
  }

  // ---------- inventory ----------
  render_inventory() {
    const g = this.game;
    const s = g.state;
    const d = g.derived();
    const items = Object.keys(s.inventory).filter((id) => s.inventory[id] > 0 && ITEMS[id] && (this.invCat === 'all' || ITEMS[id].type === this.invCat));
    const typeOrder = ['weapon', 'armor', 'amulet', 'food', 'potion', 'material', 'quest'];
    items.sort((a, b) => typeOrder.indexOf(ITEMS[a].type) - typeOrder.indexOf(ITEMS[b].type) || ITEMS[a].name.localeCompare(ITEMS[b].name));
    if (this.invSel && !s.inventory[this.invSel]) this.invSel = null;
    const eqd = (slot, label) => {
      const id = s.equipment[slot];
      return `<div class="eqslot" data-act="sel" data-arg="${id || ''}"><div class="ico">${id ? iconSVG(id) : ''}</div><div><small>${label}</small><b>${id ? esc(ITEMS[id].name) + (upgradeLevel(s, id) ? ' +' + upgradeLevel(s, id) : '') : '—'}</b></div></div>`;
    };
    const st = s.player.stats;
    const sel = this.invSel && ITEMS[this.invSel];
    let detail = '<div class="empty-note">Выберите предмет</div>';
    if (sel) {
      const id = this.invSel;
      const equipped = Object.values(s.equipment).includes(id);
      const lines = describeItem(id).map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('');
      let btns = '';
      if (['weapon', 'armor', 'amulet'].includes(sel.type)) btns += equipped ? '<button disabled>Экипировано</button>' : `<button data-act="equip" data-arg="${id}">Экипировать</button>`;
      if (sel.type === 'food' || sel.type === 'potion') {
        btns += `<button data-act="use" data-arg="${id}">Использовать</button>`;
        btns += `<div class="hotassign">На панель: ${[0, 1, 2, 3].map((k) => `<button class="sm" data-act="hot" data-arg="${k}">${k + 1}</button>`).join('')}</div>`;
      }
      if (sel.type !== 'quest' && !equipped) btns += `<button class="ghost" data-act="drop" data-arg="${id}">Выбросить 1</button>`;
      detail = `<div class="dicon">${iconSVG(id)}</div><h3>${esc(sel.name)}${upgradeLevel(s, id) ? ' +' + upgradeLevel(s, id) : ''}</h3><p class="desc">${esc(sel.desc || '')}</p><div class="kvs">${lines}</div>${cmpHtml(compareItem(id, s.equipment))}<div class="btns">${btns}</div>`;
    }
    return `
      <header><h2>Снаряжение</h2><button class="x" data-act="close">✕</button></header>
      <div class="inv">
        <aside class="char">
          <div class="eqs">${eqd('weapon', 'Оружие')}${eqd('armor', 'Броня')}${eqd('amulet', 'Амулет')}</div>
          <div class="stats">
            <h5 class="sth">Показатели</h5>
            <div class="kv" title="Повышается у алтаря за сияние"><span>Уровень</span><b>${s.player.level}</b></div>
            <div class="kv" title="Изученные навыки; свободные очки тратятся в древе (K)"><span>Навыки</span><b>${(s.perks || []).length}${perkPoints(s) ? ` <button class="sm" data-act="character">+${perkPoints(s)}</button>` : ''}</b></div>
            <div class="kv" title="Розовая полоска"><span>Здоровье</span><b>${Math.round(s.player.hp)} / ${d.maxHp}</b></div>
            <div class="kv" title="Зелёная полоска: удары, блок, перекаты, бег"><span>Выносливость</span><b>${d.maxStamina}</b></div>
            <div class="kv" title="Синяя полоска: заклинания"><span>Мана</span><b>${d.maxMana}</b></div>
            <div class="kv" title="Урон обычного удара текущим оружием"><span>Урон</span><b>${Math.round(d.damage)}</b></div>
            <div class="kv" title="Снижает получаемый урон; даёт броня"><span>Защита</span><b>${d.defense}</b></div>
            <div class="kv" title="Жёлтая полоска под маной"><span>Сытость</span><b>${Math.round(s.player.satiety)}%</b></div>
            <h5 class="sth">Характеристики <small>растут у алтаря</small></h5>
            ${Object.entries(STAT_NAMES).map(([k, [n, desc]]) => `<div class="kv stat"><span>${n}<small>${desc} за очко</small></span><b>${st[k]}</b></div>`).join('')}
          </div>
        </aside>
        <section class="grid-wrap">
          <nav class="tabs">${CATEGORIES.map((c) => `<button class="${this.invCat === c.id ? 'on' : ''}" data-act="cat" data-arg="${c.id}">${c.name}</button>`).join('')}</nav>
          <div class="grid">${items.map((id) => `<div class="cell ${this.invSel === id ? 'sel' : ''} ${Object.values(s.equipment).includes(id) ? 'eq' : ''}" data-act="sel" data-arg="${id}" title="${esc(ITEMS[id].name)}">${iconSVG(id)}${s.inventory[id] > 1 ? `<b>${s.inventory[id]}</b>` : ''}</div>`).join('') || '<div class="empty-note">Пусто</div>'}</div>
        </section>
        <aside class="detail">${detail}</aside>
      </div>
      <footer><span><kbd>1–4</kbd> назначить на панель</span><span><kbd>Esc</kbd> закрыть</span></footer>`;
  }

  // ---------- shop ----------
  render_shop() {
    const g = this.game;
    const s = g.state;
    const shop = SHOPS[this.menuData.shop];
    const ss = g.shopState(this.menuData.shop);
    const buyList = Object.keys(ss.stock).map((id) => {
      const it = ITEMS[id];
      const price = g.buyPrice(id);
      const left = ss.stock[id] || 0;
      const can = s.gold >= price && left > 0;
      const cmp = compareItem(id, s.equipment);
      const tags = cmp && cmp.diffs.length ? `<span class="cmpt">${cmp.diffs.map(([k, v, u]) => `<i class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${v}${u} ${k.toLowerCase()}</i>`).join(' ')}</span>` : '';
      const multi = (it.type === 'food' || it.type === 'potion' || it.type === 'material') && left >= 5 && s.gold >= price * 5;
      return `<div class="row ${can ? '' : 'dim'}"><div class="ico">${iconSVG(id)}</div><div class="nm"><b>${esc(it.name)} <small class="stock">${left ? '×' + left : 'нет в наличии'}</small></b><small>${esc(it.desc)}</small>${tags}</div><div class="pr"><span class="coin"></span>${price}</div><div class="bb"><button ${can ? '' : 'disabled'} data-act="buy" data-arg="${id}">Купить</button>${multi ? `<button class="sm" data-act="buy5" data-arg="${id}">×5</button>` : ''}</div></div>`;
    }).join('');
    const sellable = Object.keys(s.inventory).filter((id) => s.inventory[id] > 0 && ITEMS[id] && ITEMS[id].type !== 'quest' && ITEMS[id].price > 0 && !Object.values(s.equipment).includes(id));
    const sellList = sellable.map((id) => {
      const it = ITEMS[id];
      return `<div class="row"><div class="ico">${iconSVG(id)}</div><div class="nm"><b>${esc(it.name)}${s.inventory[id] > 1 ? ` ×${s.inventory[id]}` : ''}</b><small>${esc(it.desc)}</small></div><div class="pr"><span class="coin"></span>${g.sellPrice(this.menuData.shop, id)}</div><button data-act="sell" data-arg="${id}">Продать</button></div>`;
    }).join('') || '<div class="empty-note">Нечего продать</div>';
    return `
      <header><h2>${esc(shop.name)}</h2><div class="mgold" title="Золото торговца">у торговца: ${ss.gold}</div><div class="gold"><span class="coin"></span>${s.gold}</div><button class="x" data-act="close">✕</button></header>
      <nav class="tabs"><button class="${this.shopMode === 'buy' ? 'on' : ''}" data-act="shopmode" data-arg="buy">Купить</button><button class="${this.shopMode === 'sell' ? 'on' : ''}" data-act="shopmode" data-arg="sell">Продать</button></nav>
      <div class="list">${this.shopMode === 'buy' ? buyList : sellList}</div>
      <footer><span><kbd>Esc</kbd> закрыть</span></footer>`;
  }

  // ---------- journal ----------
  render_journal() {
    const g = this.game;
    const s = g.state;
    const jt = this.journalTab || 'quests';
    const tabs = `<nav class="tabs"><button class="${jt === 'quests' ? 'on' : ''}" data-act="jtab" data-arg="quests">Задания</button><button class="${jt === 'books' ? 'on' : ''}" data-act="jtab" data-arg="books">Книги и записки</button><button class="${jt === 'chronicle' ? 'on' : ''}" data-act="jtab" data-arg="chronicle">Хроника</button></nav>`;
    if (jt === 'books') {
      const read = (s.read || []).filter((id) => BOOKS[id]);
      const list = read.map((id) => `<li data-act="openbook" data-arg="${id}">${esc(BOOKS[id].title)}</li>`).join('') || '<li class="none">—</li>';
      return `<header><h2>Журнал</h2><button class="x" data-act="close">✕</button></header>${tabs}
        <div class="journal"><aside><h4>Прочитано ${read.length} / ${Object.keys(BOOKS).length}</h4><ul>${list}</ul></aside><section><div class="empty-note">Выберите книгу, чтобы перечитать её. Каждая новая книга приносит сияние.</div></section></div>
        <footer><span><kbd>J</kbd> / <kbd>Esc</kbd> закрыть</span></footer>`;
    }
    if (jt === 'chronicle') {
      const t = s.stats.time || 0;
      const qd = Object.values(s.quests).filter((q) => q.done).length;
      const rows = [
        ['Время в пути', `${Math.floor(t / 3600)} ч ${Math.floor((t % 3600) / 60)} мин`], ['День', s.day], ['Уровень', s.player.level],
        ['Выполнено заданий', `${qd} / ${Object.keys(QUESTS).length}`], ['Открыто мест', `${s.locations.length} / ${LOCATIONS.length}`], ['Алтарей', `${s.altars.length} / ${ALTARS.length}`],
        ['Побеждено врагов', s.stats.kills], ['Падений', s.stats.deaths], ['Изучено в бестиарии', Object.keys(s.bestiary || {}).length],
        ['Прочитано книг', (s.read || []).length], ['Навыков', (s.perks || []).length], ['Золото', s.gold],
      ];
      const feats = [];
      if (s.killed.includes('gart')) feats.push('Разогнал Чёрную Лису');
      if (s.killed.includes('golem')) feats.push('Одолел Хрустального Стража');
      if (s.killed.includes('morgrim')) feats.push('Сразил Моргрима, Рыцаря Сумрака');
      if (s.flags.duel_won) feats.push('Победил принца Седрика в поединке');
      if (s.flags.heartRestored) feats.push('Вернул свет Сердцу Люменхолда');
      return `<header><h2>Журнал</h2><button class="x" data-act="close">✕</button></header>${tabs}
        <div class="journal chron"><aside><h4>Подвиги</h4><ul>${feats.map((f) => `<li class="feat">✦ ${esc(f)}</li>`).join('') || '<li class="none">Всё ещё впереди</li>'}</ul></aside>
        <section><div class="kvs">${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div></section></div>
        <footer><span><kbd>J</kbd> / <kbd>Esc</kbd> закрыть</span></footer>`;
    }
    const ids = Object.keys(s.quests);
    const active = ids.filter((id) => !s.quests[id].done);
    const done = ids.filter((id) => s.quests[id].done);
    if (!this.journalSel || !s.quests[this.journalSel]) this.journalSel = s.tracked || active[0] || done[0] || null;
    const item = (id) => `<li class="${this.journalSel === id ? 'on' : ''} ${QUESTS[id].main ? 'main' : ''} ${s.quests[id].done ? 'done' : ''}" data-act="qsel" data-arg="${id}">${s.tracked === id ? '<i class="trk"></i>' : ''}${esc(QUESTS[id].title)}</li>`;
    let det = '<div class="empty-note">Заданий пока нет. Поговорите с людьми.</div>';
    const id = this.journalSel;
    if (id) {
      const q = QUESTS[id];
      const qs = s.quests[id];
      const stages = q.stages.slice(0, qs.done ? q.stages.length : qs.stage).map((st) => `<li class="ok">${esc(typeof st.text === 'function' ? st.text(g).replace(/\s*\(.*\)$/, '') : st.text)}</li>`).join('');
      const cur = qs.done ? '' : `<li class="cur">${esc(g.quests.stageText(id))}</li>`;
      const st = q.stages[qs.stage];
      const sub = !qs.done && st?.sub ? `<ul class="sub">${st.sub(g).map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${esc(t)}</li>`).join('')}</ul>` : '';
      det = `<h3>${esc(q.title)}</h3><div class="giver">${q.main ? 'Основное задание' : 'Поручение'} · ${esc(q.giver)}</div><p class="desc">${esc(q.summary)}</p><ol class="stages">${stages}${cur}</ol>${sub}${!qs.done && s.tracked !== id ? `<button data-act="track" data-arg="${id}">Отслеживать</button>` : ''}`;
    }
    return `
      <header><h2>Журнал</h2><button class="x" data-act="close">✕</button></header>${tabs}
      <div class="journal">
        <aside><h4>Активные</h4><ul>${active.map(item).join('') || '<li class="none">—</li>'}</ul><h4>Выполненные</h4><ul>${done.map(item).join('') || '<li class="none">—</li>'}</ul></aside>
        <section>${det}</section>
      </div>
      <footer><span><kbd>J</kbd> / <kbd>Esc</kbd> закрыть</span></footer>`;
  }

  // ---------- map ----------
  render_map() {
    const travel = this.menuData?.travel;
    return `
      <header><h2>Карта Эфирии</h2><button class="x" data-act="close">✕</button></header>
      <div class="mapwrap"><canvas id="mapcv" width="900" height="900"></canvas><div class="mapicons" id="mapicons"></div></div>
      <div class="mlegend" id="mlegend">
        <span data-k="altar" title="Алтари Света появляются, когда вы их находите"><i class="lg-altar"></i>Алтарь</span>
        <span data-k="quest" title="Цели активных заданий"><i class="lg-quest"></i>Задание</span>
        <span data-k="shop" title="Торговцы отмечаются, когда вы открываете их город (замок, деревню)"><i class="lg-shop"></i>Торговец</span>
        <span data-k="smith" title="Кузница Брама — в нижнем дворе замка"><i class="lg-smith"></i>Кузница</span>
        <span data-k="lost" title="Место, где вы пали и оставили сияние"><i class="lg-lost"></i>Потерянное сияние</span>
        <span data-k="mount" title="Появится, когда королева подарит вам единорога"><i class="lg-mount"></i>Астра</span>
        <span data-k="pin" title="Щёлкните по карте, чтобы поставить метку; она видна на компасе"><i class="lg-pin"></i>Ваша метка</span>
        <em class="lgnote">Тусклые пункты ещё не открыты. Щелчок по карте ставит метку.</em>
      </div>
      <footer><span>${travel || this.game.canFastTravel() ? 'Нажмите на открытый алтарь, чтобы переместиться' : 'Перемещение недоступно рядом с врагами'}</span><span><kbd>M</kbd> / <kbd>Esc</kbd> закрыть</span></footer>`;
  }

  drawMap() {
    const g = this.game;
    const cv = $('#mapcv', this.panel);
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!this.mapImage) this.mapImage = g.renderMapImage(900);
    ctx.drawImage(this.mapImage, 0, 0);
    const R = WORLD.playRadius + 60;
    const toMap = (x, z) => [((x + R) / (2 * R)) * cv.width, ((z + R) / (2 * R)) * cv.height];
    const icons = $('#mapicons', this.panel);
    let html = '';
    const pct = (v) => (v / cv.width) * 100 + '%';
    for (const L of LOCATIONS) {
      const [x, y] = toMap(L.x, L.z);
      const known = g.state.locations.includes(L.id);
      html += `<div class="mloc ${known ? '' : 'unk'}" style="left:${pct(x)};top:${pct(y)}">${known ? esc(L.name) : '???'}</div>`;
    }
    const canTravel = this.menuData?.travel || g.canFastTravel();
    for (const a of ALTARS) {
      const [x, y] = toMap(a.x, a.z);
      const known = g.state.altars.includes(a.id);
      if (!known) continue;
      html += `<div class="maltar ${canTravel ? 'can' : ''}" ${canTravel ? `data-act="travel" data-arg="${a.id}"` : ''} style="left:${pct(x)};top:${pct(y)}" title="${esc(a.name)}"><span></span><em>${esc(a.name)}</em></div>`;
    }
    for (const m of g.quests.markers()) {
      const [x, y] = toMap(m.x, m.z);
      html += `<div class="mquest ${m.main ? 'main' : ''} ${m.tracked ? 'tracked' : ''}" style="left:${pct(x)};top:${pct(y)}"></div>`;
    }
    // merchants and the smith, once their home location is known
    for (const n of g.npcs) {
      if (!n.def.named || !SHOPS[n.id] || !g.state.locations.some((id) => { const L = LOCATIONS.find((l) => l.id === id); return L && Math.hypot(n.home.x - L.x, n.home.z - L.z) < L.r; })) continue;
      const [x, y] = toMap(n.home.x, n.home.z);
      html += `<div class="mshop ${n.id === 'bram' ? 'smith' : ''}" style="left:${pct(x)};top:${pct(y)}" title="${esc(SHOPS[n.id].name)}"><em>${esc(SHOPS[n.id].name)}</em></div>`;
    }
    const lg = g.state.lostGlimmer;
    if (lg) { const [x, y] = toMap(lg.x, lg.z); html += `<div class="mlost" style="left:${pct(x)};top:${pct(y)}" title="Потерянное сияние"></div>`; }
    if (g.mount?.summoned) { const [x, y] = toMap(g.mount.pos.x, g.mount.pos.z); html += `<div class="mmount" style="left:${pct(x)};top:${pct(y)}" title="Астра"></div>`; }
    const pin = g.state.mapPin;
    if (pin) { const [x, y] = toMap(pin.x, pin.z); html += `<div class="mpin" style="left:${pct(x)};top:${pct(y)}"></div>`; }
    const p = g.player.pos;
    const [px, py] = toMap(p.x, p.z);
    const deg = (-g.player.yaw * 180) / Math.PI + 180;
    html += `<div class="mplayer" style="left:${pct(px)};top:${pct(py)};transform:translate(-50%,-50%) rotate(${deg}deg)"></div>`;
    icons.innerHTML = html;
    const has = { altar: /class="maltar/.test(html), quest: /class="mquest/.test(html), shop: /class="mshop "/.test(html) || /class="mshop"/.test(html), smith: /mshop smith/.test(html), lost: /class="mlost/.test(html), mount: /class="mmount/.test(html), pin: /class="mpin/.test(html) };
    this.panel.querySelectorAll('#mlegend [data-k]').forEach((e) => e.classList.toggle('off', !has[e.dataset.k] && e.dataset.k !== 'pin'));
    if (!cv._pinBound) {
      cv._pinBound = true;
      cv.addEventListener('click', (e) => {
        if (this.menuData?.travel) return;
        const r = cv.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
        const wx = mx * 2 * R - R, wz = my * 2 * R - R;
        const cur = g.state.mapPin;
        g.state.mapPin = cur && Math.hypot(cur.x - wx, cur.z - wz) < R * 0.03 ? null : { x: wx, z: wz };
        g.audio.play('ui');
        this.drawMap();
      });
    }
  }

  // ---------- altar ----------
  render_altar() {
    const g = this.game;
    const a = this.menuData.altar;
    const s = g.state;
    const cost = levelCost(s.player.level);
    return `
      <div class="altarbox">
        <div class="aglow"></div>
        <h2>${esc(a.name)}</h2>
        <p class="asub">Тёплый свет касается ваших ран.</p>
        <div class="alist">
          <button data-act="rest">Отдохнуть <small>исцеление, флаконы, сохранение · враги вернутся</small></button>
          <button data-act="levelup">Повысить уровень <small>сияние: ${s.player.glimmer} / нужно ${cost}</small></button>
          <button data-act="travelmap">Перемещение <small>к другим алтарям</small></button>
          <button data-act="wait" data-arg="7">Ждать до утра</button>
          <button data-act="wait" data-arg="20">Ждать до ночи</button>
          <button class="ghost" data-act="close">Уйти</button>
        </div>
      </div>`;
  }

  render_levelup() {
    const g = this.game;
    const s = g.state;
    const a = this.menuData.alloc;
    const total = Object.values(a).reduce((x, y) => x + y, 0);
    let cost = 0;
    for (let i = 0; i < total; i++) cost += levelCost(s.player.level + i);
    const next = levelCost(s.player.level + total);
    return `
      <div class="altarbox wide">
        <h2>Повышение уровня</h2>
        <p class="asub">Уровень ${s.player.level}${total ? ` → ${s.player.level + total}` : ''} · Сияние: ${s.player.glimmer - cost} · Следующий уровень: ${next}</p>
        <div class="statlist">
          ${Object.entries(STAT_NAMES).map(([k, [n, desc]]) => `<div class="statrow"><div><b>${n}</b><small>${desc}</small></div><div class="sv"><button class="sm" data-act="stat" data-arg="${k}" data-d="-1">−</button><span>${s.player.stats[k] + a[k]}</span><button class="sm" data-act="stat" data-arg="${k}" data-d="1">+</button></div></div>`).join('')}
        </div>
        <div class="btns"><button ${total ? '' : 'disabled'} data-act="confirmLevel">Подтвердить</button><button class="ghost" data-act="close">Отмена</button></div>
      </div>`;
  }


  // ---------- character: skill tree + bestiary ----------
  render_character() {
    const g = this.game;
    const s = g.state;
    const tab = this.charTab || 'perks';
    let body = '';
    if (tab === 'perks') {
      const pts = perkPoints(s);
      const cols = BRANCHES.map((b) => {
        const list = PERKS[b.id].map((p, i) => {
          const have = hasPerk(s, p.id);
          const can = canLearn(s, b.id, i);
          const cls = have ? 'have' : can ? 'can' : 'lock';
          return `<div class="perk ${cls}" ${can ? `data-act="perk" data-arg="${b.id}:${i}"` : ''}><i class="pd">${have ? '✦' : i + 1}</i><div><b>${esc(p.name)}</b><small>${esc(p.desc)}</small></div></div>`;
        }).join('<div class="plink"></div>');
        return `<section class="branch" style="--bc:${b.color}"><h3>${esc(b.name)}</h3><p class="bd">${esc(b.desc)}</p>${list}</section>`;
      }).join('');
      body = `<p class="ppts">${pts ? `Свободных очков: <b>${pts}</b> — нажмите на подсвеченный навык` : 'Свободных очков нет. Очко навыка даётся за каждый новый уровень.'}</p><div class="tree">${cols}</div>`;
    } else {
      const known = Object.keys(ENEMY_TYPES).filter((k) => BESTIARY[k] && (s.bestiary?.[k] || 0) > 0);
      const total = Object.keys(BESTIARY).length;
      if (!this.beastSel || !known.includes(this.beastSel)) this.beastSel = known[0] || null;
      const list = Object.keys(BESTIARY).map((k) => {
        const n = s.bestiary?.[k] || 0;
        return n ? `<li class="${this.beastSel === k ? 'on' : ''}" data-act="beast" data-arg="${k}">${esc(ENEMY_TYPES[k].name)}<small>${n}</small></li>` : '<li class="none unk">???</li>';
      }).join('');
      let det = '<div class="empty-note">Победите врага, чтобы узнать о нём больше.</div>';
      const k = this.beastSel;
      if (k) {
        const T = ENEMY_TYPES[k], B = BESTIARY[k], n = s.bestiary[k];
        const weak = [];
        if (T.gloom) weak.push('Свет', 'сияющий ожог');
        if ((T.poise || 0) < 25) weak.push('легко сбить с ног');
        det = `<h3>${esc(T.name)}</h3><div class="giver">${esc(B.where)} · побеждено: ${n}</div><p class="desc">${esc(B.lore)}</p>
          <div class="kvs"><div class="kv"><span>Здоровье</span><b>${T.hp}</b></div><div class="kv"><span>Урон</span><b>${T.dmg}</b></div><div class="kv"><span>Стойкость</span><b>${T.poise >= 200 ? 'несокрушим' : T.poise}</b></div>${weak.length ? `<div class="kv"><span>Слабость</span><b>${weak.join(', ')}</b></div>` : ''}</div>
          <p class="tip">${n >= 3 || T.boss ? esc(B.tip) : `<i>Совет откроется после трёх побед (${n}/3)</i>`}</p>`;
      }
      body = `<div class="journal"><aside><h4>Изучено ${known.length} / ${total}</h4><ul>${list}</ul></aside><section>${det}</section></div>`;
    }
    return `
      <header><h2>${tab === 'perks' ? 'Древо навыков' : 'Бестиарий'}</h2><button class="x" data-act="close">✕</button></header>
      <nav class="tabs"><button class="${tab === 'perks' ? 'on' : ''}" data-act="ctab" data-arg="perks">Навыки <kbd>K</kbd></button><button class="${tab === 'bestiary' ? 'on' : ''}" data-act="ctab" data-arg="bestiary">Бестиарий <kbd>B</kbd></button></nav>
      ${body}
      <footer><span><kbd>Esc</kbd> закрыть</span></footer>`;
  }

  // ---------- Bram's forge ----------
  render_forge() {
    const g = this.game;
    const s = g.state;
    const gear = Object.keys(s.inventory).filter((id) => s.inventory[id] > 0 && ITEMS[id] && (ITEMS[id].type === 'weapon' || ITEMS[id].type === 'armor'));
    gear.sort((a, b) => (ITEMS[a].type === 'weapon' ? 0 : 1) - (ITEMS[b].type === 'weapon' ? 0 : 1) || (ITEMS[b].price || 0) - (ITEMS[a].price || 0));
    if (!gear.includes(this.forgeSel)) this.forgeSel = gear[0];
    const list = gear.map((id) => {
      const l = upgradeLevel(s, id);
      const eq = Object.values(s.equipment).includes(id);
      return `<li class="${this.forgeSel === id ? 'on' : ''}" data-act="fsel" data-arg="${id}"><span class="fi">${iconSVG(id)}</span>${esc(ITEMS[id].name)}${l ? ` <b class="up">+${l}</b>` : ''}${eq ? ' <small>надето</small>' : ''}</li>`;
    }).join('');
    let det = '<div class="empty-note">Нечего улучшать</div>';
    const id = this.forgeSel;
    if (id) {
      const it = ITEMS[id];
      const lvl = upgradeLevel(s, id);
      const cur = upgradeBonus(it, lvl), nxt = upgradeBonus(it, lvl + 1);
      const stat = it.type === 'weapon' ? ['Урон', it.dmg + (cur.dmg || 0), it.dmg + (nxt.dmg || 0)] : ['Защита', it.def + (cur.def || 0), it.def + (nxt.def || 0)];
      const pips = Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      if (lvl >= MAX_UPGRADE) {
        det = `<div class="dicon">${iconSVG(id)}</div><h3>${esc(it.name)} +${lvl}</h3><div class="pips">${pips}</div><p class="desc">Брам: «Лучше уже не сделать. Даже дед бы не смог».</p><div class="kvs"><div class="kv"><span>${stat[0]}</span><b>${stat[1]}</b></div></div>`;
      } else {
        const c = upgradeCost(id, lvl);
        let ok = s.gold >= c.gold;
        const mats = Object.entries(c.mats).map(([m, n]) => { const have = g.itemCount(m); if (have < n) ok = false; return `<div class="mat ${have >= n ? '' : 'miss'}"><span class="fi">${iconSVG(m)}</span>${esc(ITEMS[m].name)} <b>${have}/${n}</b></div>`; }).join('');
        det = `<div class="dicon">${iconSVG(id)}</div><h3>${esc(it.name)}${lvl ? ' +' + lvl : ''}</h3><div class="pips">${pips}</div>
          <div class="kvs"><div class="kv"><span>${stat[0]}</span><b>${stat[1]} → <em class="upv">${stat[2]}</em></b></div></div>
          <h4>Нужно для +${lvl + 1}</h4><div class="mats"><div class="mat ${s.gold >= c.gold ? '' : 'miss'}"><span class="coin"></span>Золото <b>${s.gold}/${c.gold}</b></div>${mats}</div>
          <div class="btns"><button ${ok ? '' : 'disabled'} data-act="forge" data-arg="${id}">Закалить</button></div>`;
      }
    }
    return `
      <header><h2>Кузница Брама</h2><div class="gold"><span class="coin"></span>${s.gold}</div><button class="x" data-act="close">✕</button></header>
      <div class="journal forge"><aside><h4>Оружие и броня</h4><ul>${list}</ul></aside><section>${det}</section></div>
      <footer><span>Руду продаёт сам Брам, кристаллы — в Хрустальных руинах, эссенция — с тварей Сумрака</span><span><kbd>Esc</kbd> закрыть</span></footer>`;
  }

  // ---------- cooking ----------
  // ---------- books & notes ----------
  render_book() {
    const b = BOOKS[this.menuData.book];
    const p = this.menuData.page || 0;
    const n = b.pages.length;
    const spread = [b.pages[p], b.pages[p + 1]];
    const pageHtml = (txt, i) => txt === undefined ? '<div class="bpage empty"></div>' : `<div class="bpage">${i === 0 && p === 0 ? `<h3>${esc(b.title)}</h3><div class="orn"></div>` : ''}<p>${esc(txt)}</p><span class="pn">${p + i + 1}</span></div>`;
    return `
      <div class="bookbox">
        <div class="bookspread">${pageHtml(spread[0], 0)}${n > 1 ? pageHtml(spread[1], 1) : ''}</div>
        <div class="bookctl">
          <button data-act="bpage" data-arg="-2" ${p <= 0 ? 'disabled' : ''}>‹ Назад</button>
          <span>${Math.min(n, p + 2)} / ${n}</span>
          <button data-act="bpage" data-arg="2" ${p + 2 >= n ? 'disabled' : ''}>Дальше ›</button>
          <button class="ghost" data-act="close">Закрыть <kbd>Esc</kbd></button>
        </div>
      </div>`;
  }

  // ---------- bed ----------
  render_bed() {
    const s = this.game.state;
    return `
      <div class="altarbox">
        <h2>Отдых</h2>
        <p class="asub">Сейчас ${formatHour(s.hour)}. Мягкая постель и тишина.</p>
        <div class="alist">
          <button data-act="sleep" data-arg="7">Спать до утра <small>исцеление · «Отдохнувший» · сохранение</small></button>
          <button data-act="sleep" data-arg="12">Спать до полудня</button>
          <button data-act="sleep" data-arg="19">Спать до вечера</button>
          <button class="ghost" data-act="close">Встать</button>
        </div>
      </div>`;
  }

  render_cook() {
    const g = this.game;
    const alch = !!this.menuData?.alchemy;
    const list = alch ? ALCHEMY : RECIPES;
    const rows = list.map((r) => {
      const ok = Object.entries(r.needs).every(([id, n]) => g.itemCount(id) >= n);
      const needs = Object.entries(r.needs).map(([id, n]) => `<span class="${g.itemCount(id) >= n ? 'ok' : 'no'}">${esc(ITEMS[id].name)} ${g.itemCount(id)}/${n}</span>`).join(' · ');
      return `<div class="row ${ok ? '' : 'dim'}"><div class="ico">${iconSVG(r.id)}</div><div class="nm"><b>${esc(r.name)}</b><small>${needs}</small></div><button ${ok ? '' : 'disabled'} data-act="cook" data-arg="${r.id}">${alch ? 'Сварить' : 'Готовить'}</button></div>`;
    }).join('');
    return alch
      ? `<header><h2>Алхимический котёл</h2><button class="x" data-act="close">✕</button></header><div class="list">${rows}</div><footer><span>Солнечник растёт на лугах, ягоды — в Шепчущем лесу, лунные цветы — у озера</span><span><kbd>Esc</kbd> закрыть</span></footer>`
      : `<header><h2>Костёр</h2><button class="x" data-act="close">✕</button></header><div class="list">${rows}</div><footer><span>Мясо добывают на охоте, грибы и травы — в лесах и лугах</span><span><kbd>Esc</kbd> закрыть</span></footer>`;
  }

  // ---------- pause / settings / controls ----------
  render_pause() {
    return `
      <div class="pausebox">
        <h2>Пауза</h2>
        <button data-act="resume">Продолжить</button>
        <button data-act="character">Навыки и бестиарий</button>
        <button data-act="save">Сохранить игру</button>
        <button data-act="load" ${hasSave() ? '' : 'disabled'}>Загрузить сохранение</button>
        <button data-act="settings">Настройки</button>
        <button data-act="controls">Управление</button>
        <button data-act="lessons">Справочник (как играть)</button>
        <button class="ghost" data-act="quit">Выйти в главное меню</button>
      </div>`;
  }

  render_settings() {
    const g = this.game;
    const o = g.settings;
    const q = (id, n) => `<button class="${o.quality === id ? 'on' : ''}" data-act="quality" data-arg="${id}">${n}</button>`;
    const tg = (key, n) => `<div class="setrow"><span>${n}</span><button class="${o[key] ? 'on' : ''}" data-act="toggle" data-arg="${key}">${o[key] ? 'Вкл' : 'Выкл'}</button></div>`;
    return `
      <div class="pausebox wide">
        <h2>Настройки</h2>
        <div class="setrow"><span>Графика</span><div class="seg">${q('low', 'Низкая')}${q('medium', 'Средняя')}${q('high', 'Высокая')}</div></div>
        <div class="setrow"><span>Чувствительность мыши</span><input type="range" id="set-sens" min="0.2" max="2.5" step="0.05" value="${o.sens}"></div>
        <div class="setrow"><span>Поле зрения</span><input type="range" id="set-fov" min="50" max="85" step="1" value="${o.fov}"></div>
        <div class="setrow"><span>Музыка</span><input type="range" id="set-music" min="0" max="1" step="0.05" value="${o.music}"></div>
        <div class="setrow"><span>Звуки</span><input type="range" id="set-sfx" min="0" max="1" step="0.05" value="${o.sfx}"></div>
        ${tg('invertY', 'Инверсия по вертикали')}
        ${tg('showFps', 'Показывать FPS')}
        ${tg('tutorial', 'Подсказки обучения')}
        <button data-act="back">Назад</button>
      </div>`;
  }

  bindSettingsInputs() {
    const g = this.game;
    for (const [id, key] of [['set-sens', 'sens'], ['set-fov', 'fov'], ['set-music', 'music'], ['set-sfx', 'sfx']]) {
      const inp = $('#' + id, this.panel);
      if (inp) inp.oninput = () => g.setSetting(key, parseFloat(inp.value));
    }
  }

  render_controls() {
    const rows = [
      ['W A S D', 'Движение'], ['Shift', 'Бег'], ['Пробел', 'Перекат / уклонение'], ['F', 'Прыжок'],
      ['ЛКМ', 'Атака (серия из 3 ударов)'], ['Удерживать ЛКМ', 'Мощный заряженный удар'], ['ПКМ', 'Блок. В момент удара — парирование'],
      ['ЛКМ по открытому врагу', 'Критический удар'], ['ЛКМ со спины', 'Удар в спину'], ['ЛКМ в прыжке с высоты', 'Удар с высоты'],
      ['V', 'Вихрь света (круговой удар, мана)'], ['Q / СКМ', 'Захват цели'], ['C', 'Заклинание «Луч света»'],
      ['R', 'Флакон слёз рассвета'], ['1–4', 'Быстрые предметы'], ['E', 'Говорить, открыть дверь, взять, читать, сесть, лечь спать'], ['G', 'Позвать единорога / спешиться'],
      ['I / Tab', 'Снаряжение'], ['J', 'Журнал'], ['M', 'Карта'], ['Esc', 'Пауза'],
    ];
    return `<div class="pausebox wide"><h2>Управление</h2><div class="ctrls">${rows.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div><button data-act="back">Назад</button></div>`;
  }

  // ---------- title ----------
  render_title() {
    const save = hasSave();
    return `
      <div class="title">
        <div class="logo"><small>Сказание о</small><h1>Люменхолд</h1><div class="subt">Сердце Света</div></div>
        <div class="tbtns">
          ${save ? '<button data-act="continue">Продолжить</button>' : ''}
          <button data-act="newgame">Новая игра</button>
          <button data-act="controls">Управление</button>
          <button data-act="settings">Настройки</button>
        </div>
        <div class="tnote" id="tnote">Для игры нужны клавиатура и мышь. Звук включится после первого клика.</div>
      </div>`;
  }

  render_death() {
    return `<div class="death"><div class="dt">Свет угас</div><div class="ds">Потерянное сияние ждёт вас там, где вы пали</div><button data-act="respawn">Очнуться у алтаря</button></div>`;
  }

  render_ending() {
    const g = this.game;
    const s = g.state, f = s.flags;
    const done = (id) => g.quests.status(id) === 'done';
    const fates = [];
    if (done('letter')) fates.push(f.florian_gone ? 'Принцесса Аурелия долго не выходила в сад на крыше. Флориан покинул Люменхолд, и его песен больше не слышали в «Золотом Грифоне».' : 'На празднике Рассвета бард Флориан впервые спел при дворе. Говорят, принцесса Аурелия знала каждое слово его баллады наизусть.');
    if (f.duel_won) fates.push('Принц Седрик больше не скучает на ристалище: теперь он тренируется до рассвета, чтобы однажды взять реванш.');
    if (done('prisoner')) fates.push(f.janek_free ? 'Янек-Лис, отпущенный на волю, пропал без следа. Но на пороге трактира иногда находят корзину с дичью — без подписи.' : 'Янек-Лис отсидел своё и теперь чинит сети у Зеркального озера. Он клянётся, что завязал.');
    if (s.killed.includes('gart')) fates.push('Без Гарта шайка Чёрной Лисы рассеялась, и дороги Эфирии снова стали безопасны для обозов.');
    if (done('wolves') || done('troll')) fates.push('В Медовом Доле снова спят спокойно: охотник Вольф рассказывает у костра о страннике, одолевшем чудовищ Шепчущего леса.');
    if (done('feast')) fates.push('Пир Берты вспоминали всю зиму. Королева лично поднимала кубок за «того, кто принёс мёд из Медового Дола».');
    if (done('beasts')) fates.push('Трактат магистра Орвина «О тварях Сумрака» переписывают в библиотеках трёх королевств, а на первой странице стоит ваше имя.');
    if (done('cat')) fates.push('Кот Пушок по-прежнему лазает по стенам. Нелли больше не плачет: она знает, кто его всегда найдёт.');
    const side = Object.keys(s.quests).filter((id) => !QUESTS[id].main && done(id)).length;
    const title = side >= 10 ? 'Рыцарь Рассвета и друг каждого дома' : side >= 5 ? 'Рыцарь Рассвета' : 'Странник, вернувший свет';
    return `
      <div class="ending">
        <small>Сердце Света вновь сияет</small>
        <h1>Эфирия спасена</h1>
        <p>Луч рассвета пронзил небо над Люменхолдом, и Сумрак отступил за горы. Королева Элиана нарекла вас титулом «${esc(title)}», а барды уже слагают песни о страннике, упавшем со звёзд на цветущие луга.</p>
        ${fates.length ? `<div class="fates">${fates.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
        <div class="estats"><span>Уровень <b>${s.player.level}</b></span><span>Поручений <b>${side}</b></span><span>Побеждено врагов <b>${s.stats.kills}</b></span><span>Прочитано книг <b>${(s.read || []).length}</b></span></div>
        <p class="thanks">Спасибо за игру. Мир остаётся открытым: охотьтесь, выполняйте поручения, исследуйте каждый уголок королевства.</p>
        <button data-act="endcontinue">Продолжить путешествие</button>
      </div>`;
  }

  showEnding() {
    setTimeout(() => this.open('ending'), 600);
  }
}

export { RECIPES };
