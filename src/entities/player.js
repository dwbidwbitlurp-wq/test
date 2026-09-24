// Player controller: movement, souls-like combat, consumables, mount riding.
import * as THREE from 'three';
import { Humanoid } from './humanoid.js';
import { Motor } from '../engine/collision.js';
import { clamp, damp, angleLerp, angleDiff } from '../engine/noise.js';
import { ITEMS } from '../game/items.js';
import { hasPerk } from '../game/perks.js';
import { CASTLE, WORLD } from '../world/layout.js';

const ATTACKS = {
  slash1: { clip: 'slash1', dur: 0.62, active: [0.34, 0.56], mult: 1.0, stam: 14, lunge: 2.0, arc: 1.25, range: 2.7 },
  slash2: { clip: 'slash2', dur: 0.6, active: [0.34, 0.56], mult: 1.05, stam: 14, lunge: 2.0, arc: 1.25, range: 2.7 },
  slash3: { clip: 'slash3', dur: 0.8, active: [0.42, 0.62], mult: 1.4, stam: 18, lunge: 2.8, arc: 0.85, range: 2.9 },
  heavy: { clip: 'heavy', dur: 1.15, active: [0.5, 0.68], mult: 2.3, stam: 30, lunge: 3.2, arc: 0.95, range: 3.0, heavy: true },
  run: { clip: 'thrust', dur: 0.75, active: [0.42, 0.62], mult: 1.3, stam: 18, lunge: 4.5, arc: 0.7, range: 3.0 },
  riposte: { clip: 'thrust', dur: 0.95, active: [0.46, 0.64], mult: 3.6, stam: 0, lunge: 1.2, arc: 0.9, range: 3.2, crit: true },
  backstab: { clip: 'thrust', dur: 1.0, active: [0.46, 0.64], mult: 4.2, stam: 0, lunge: 1.0, arc: 1.0, range: 3.0, crit: true },
  plunge: { clip: 'slam', dur: 0.75, active: [0.05, 0.3], mult: 2.6, stam: 0, lunge: 0, arc: Math.PI, range: 3.2, heavy: true },
  skill: { clip: 'spin', dur: 0.9, active: [0.3, 0.72], mult: 1.8, stam: 22, lunge: 1.5, arc: Math.PI, range: 3.6, heavy: true, skill: true },
  // heavier weapons: axes swing slower but hit harder
  axe1: { clip: 'slash3', dur: 0.85, active: [0.44, 0.62], mult: 1.1, stam: 17, lunge: 2.0, arc: 0.9, range: 2.8 },
  axe2: { clip: 'slash1', dur: 0.8, active: [0.36, 0.58], mult: 1.1, stam: 17, lunge: 2.0, arc: 1.3, range: 2.8 },
  axe3: { clip: 'heavy', dur: 1.0, active: [0.5, 0.68], mult: 1.6, stam: 22, lunge: 2.6, arc: 0.9, range: 3.0 },
  // greatsword: wide slow sweeps that break guards and poise
  gs1: { clip: 'slash1', dur: 0.95, active: [0.44, 0.66], mult: 1.1, stam: 21, lunge: 2.2, arc: 1.6, range: 3.5, poise: 2.2 },
  gs2: { clip: 'slash2', dur: 0.95, active: [0.44, 0.66], mult: 1.15, stam: 21, lunge: 2.2, arc: 1.6, range: 3.5, poise: 2.2 },
  gs3: { clip: 'slam', dur: 1.15, active: [0.5, 0.7], mult: 1.8, stam: 26, lunge: 3.0, arc: 0.8, range: 3.6, poise: 3.5, heavy: true },
  // spear: quick long thrusts, narrow arc, then a sweeping cut
  sp1: { clip: 'thrust', dur: 0.55, active: [0.3, 0.5], mult: 0.95, stam: 12, lunge: 2.6, arc: 0.42, range: 4.0 },
  sp2: { clip: 'thrust', dur: 0.55, active: [0.3, 0.5], mult: 1.0, stam: 12, lunge: 2.6, arc: 0.42, range: 4.0 },
  sp3: { clip: 'slash3', dur: 0.8, active: [0.4, 0.6], mult: 1.35, stam: 17, lunge: 2.0, arc: 1.3, range: 3.7 },
};
const COMBO_GS = ['gs1', 'gs2', 'gs3'];
const COMBO_SPEAR = ['sp1', 'sp2', 'sp3'];
const COMBO_AXE = ['axe1', 'axe2', 'axe3'];
const COMBO = ['slash1', 'slash2', 'slash3'];

const TREE_LEAF = {
  oak: ['#7fb85e', '#98cb6e', '#6aa550'], blossom: ['#f7b7d2', '#fbd0e2', '#ffffff'], lavender: ['#c3a8ec', '#d6c2f5', '#b596e6'],
  golden: ['#f3d680', '#e8c060', '#f7e2a0'], birch: ['#c9e18d', '#b8d474', '#e0eea8'], pine: ['#5c9a6c', '#4f8c62'], dead: ['#8a7a6a', '#6a5a4a'],
};
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _base = new THREE.Vector3(), _tip = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.radius = 0.42;
    this.height = 1.8;
    this.motor = new Motor(game.collision, { radius: 0.42, height: 1.8 });
    this.state = 'free';
    this.stateT = 0;
    this.queued = false;
    this.lmbHeld = 0;
    this.lmbWasDown = false;
    this.blockHeld = false;
    this.blockStart = -10;
    this.iframes = 0;
    this.lockTarget = null;
    this.hitSet = new Set();
    this.stamDelay = 0;
    this.exhausted = false;
    this.hot = [];
    this.attack = null;
    this.charge = 0;
    this.moveSpeed = 0;
    this.sprinting = false;
    this.mount = null;
    this.alive = true;
    this.deathT = 0;
    this.stepT = 0;
    this.lookKey = '';
    this.rig = null;
    this.trail = game.effects.addTrail('#fff4d8');
    this.applyLook();
    this.combatT = 0; // time since last combat action
  }

  get s() { return this.game.state.player; }

  applyLook() {
    const eq = this.game.state.equipment;
    const armor = ITEMS[eq.armor]?.look || ITEMS.traveler_clothes.look;
    const w = ITEMS[eq.weapon] || ITEMS.rusty_sword;
    const key = eq.armor + '|' + eq.weapon;
    if (key === this.lookKey) return;
    this.lookKey = key;
    const look = {
      skin: 0xf3d3bd, hair: 0xe9d3a4, hairStyle: 'short', shirt: 0xf1e8dc, pants: 0x7a6a8a, boots: 0x6a5040,
      ...armor, weapon: w.model, weaponOpts: w.modelOpts || {},
    };
    const old = this.rig;
    this.rig = new Humanoid(look);
    this.game.scene.add(this.rig.root);
    if (old) {
      this.game.scene.remove(old.root);
      this.rig.anim.cur = old.anim.cur;
    }
    const glow = w.modelOpts?.glow;
    this.trail.setColor(glow ? '#' + glow.toString(16).padStart(6, '0') : '#fff4d8');
    this.trail.intensity = glow ? 1.0 : 0.6;
  }

  setPosition(x, y, z, yaw = this.yaw) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.motor.vy = 0;
    this.motor.grounded = false;
    this.motor.fallStartY = y;
    this.motor.swimming = false;
  }

  // ------------------------------------------------------------------
  update(dt) {
    const g = this.game;
    const input = g.input;
    const d = g.derived();
    const s = this.s;
    this.stateT += dt;
    if (this.iframes > 0) this.iframes -= dt;
    this.combatT += dt;

    if (this.state === 'dead') {
      this.deathT += dt;
      this.rig.update(dt, { dead: true, deathT: this.deathT, grounded: true });
      this.syncRig();
      return;
    }

    if (this.state === 'sit') { this.updateSit(dt); return; }

    // mounted: the mount drives movement
    if (this.mount) {
      this.updateMounted(dt, d);
      return;
    }

    const menuBlock = g.mode !== 'play' || !!g.cine;
    const cam = g.cam;
    // ---- input direction (camera relative) ----
    let ix = 0, iz = 0;
    if (!menuBlock) {
      if (input.key('KeyW')) iz += 1;
      if (input.key('KeyS')) iz -= 1;
      if (input.key('KeyA')) ix -= 1;
      if (input.key('KeyD')) ix += 1;
    }
    const ilen = Math.hypot(ix, iz);
    let wantX = 0, wantZ = 0;
    if (ilen > 0) {
      ix /= ilen; iz /= ilen;
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      // right vector = (-fz, fx)... camera looks along (fx,fz); right = (-fz, fx) rotated: use (fz*-1)
      wantX = fx * iz - fz * ix;
      wantZ = fz * iz + fx * ix;
    }

    // ---- lock-on validation ----
    if (this.lockTarget && (!this.lockTarget.alive || this.lockTarget.pos.distanceTo(this.pos) > 34)) this.lockTarget = null;

    // ---- actions ----
    const lmbDown = !menuBlock && input.btn(0);
    const lmbPressed = !menuBlock && input.click(0);
    const lmbReleased = !menuBlock && input.release(0);
    const swim = this.motor.swimming;
    if (lmbPressed) this.lmbHeld = 0;
    if (lmbDown) this.lmbHeld += dt;

    const canAct = this.state === 'free' && !swim;
    // block
    this.blockHeld = !menuBlock && input.btn(2) && (this.state === 'free' || this.state === 'block') && !swim;
    if (this.blockHeld && this.state === 'free') {
      this.state = 'block';
      this.blockStart = g.time;
    } else if (!this.blockHeld && this.state === 'block') {
      this.state = 'free';
    }
    const canAttack = (this.state === 'free' || this.state === 'block') && !swim;

    // riposte / backstab opportunity, plunge when falling
    if (lmbPressed && canAttack) {
      const vic = this.findRiposte();
      if (vic) { this.startAttack('riposte', vic); this.lmbHeld = -99; }
      else {
        const bs = this.findBackstab();
        if (bs) { this.startAttack('backstab', bs); this.lmbHeld = -99; g.ui.combatText('Удар в спину', '#ffe08a', true); }
      }
    }
    if (lmbPressed && this.state === 'free' && !this.motor.grounded && !swim && this.motor.vy < 1 && !this.plunging) {
      this.plunging = true;
      this.lmbHeld = -99;
      this.rig.anim.play('heavy', 1.2);
      g.audio.play('heavy');
    }
    if (this.plunging) {
      const act = this.rig.anim.action;
      if (act && act.t > 0.44) act.t = 0.44;
      if (this.motor.grounded || swim) {
        this.plunging = false;
        if (!swim) {
          this.startAttack('plunge');
          g.effects.dust(this.pos, 22);
          g.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.3, this.pos.z), '#fff0c0', 30, 7, 0.3, 0.5);
          g.cam.shake(0.45);
          this.motor.lastFall = 0;
        }
      }
    }
    // weapon skill: Vortex of Light (V)
    if (!menuBlock && input.hit('KeyV') && canAttack) {
      const vCost = hasPerk(g.state, 'l_dawn') ? 13 : 20;
      if (s.mana < vCost) g.ui.hint('Недостаточно маны для «Вихря света»');
      else if (s.stamina <= 0) g.ui.hint('Нет выносливости');
      else {
        s.mana -= vCost;
        this.startAttack('skill');
        g.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 1, this.pos.z), '#fff1c0', 50, 6, 0.35, 0.8);
        g.audio.play('magic');
        const w = ITEMS[g.state.equipment.weapon];
        if (w?.modelOpts?.glow) {
          const dir = new THREE.Vector3(Math.sin(this.yaw), 0.02, Math.cos(this.yaw));
          const from = new THREE.Vector3(this.pos.x, this.pos.y + 1.1, this.pos.z).addScaledVector(dir, 0.8);
          g.spawnProjectile({ from, dir, speed: 26, dmg: g.derived().damage * 1.2, owner: this, color: '#' + w.modelOpts.glow.toString(16).padStart(6, '0'), size: 0.5, life: 0.9, light: true });
        }
      }
    }
    // light attack fires on press (no release latency); holding it turns the swing into a charged heavy
    if (lmbPressed && this.lmbHeld >= 0) {
      if (canAttack && s.stamina > 0 && this.motor.grounded) {
        this.startAttack(this.sprinting ? 'run' : this.comboList()[0]);
        this.attack.fromPress = true;
      } else if (this.state === 'attack' && this.attack && !this.attack.def.heavy && this.attack.t > 0.25) {
        this.queued = true;
      } else if (this.state !== 'dead') {
        this.buffer = { kind: 'attack', t: 0.4 };
      }
    }
    if (lmbDown && this.lmbHeld >= 0.26 && this.state === 'attack' && this.attack?.fromPress && this.attack.t < 0.42 && !this.charging && s.stamina > 0) {
      s.stamina += this.attack.def.stam || 0; // the light swing turns into the heavy: pay only once
      this.startAttack('heavy');
      this.charging = true;
    }
    // buffered inputs (souls-like): a press slightly early still happens
    if (this.buffer) {
      this.buffer.t -= dt;
      if (this.buffer.t <= 0) this.buffer = null;
      else if (canAttack && this.buffer.kind === 'attack' && s.stamina > 0 && this.motor.grounded) {
        this.buffer = null;
        this.startAttack(this.comboList()[0]);
      } else if ((canAct || this.state === 'block') && this.buffer.kind === 'roll' && s.stamina > 0) {
        this.buffer = null;
        this.startRoll(wantX, wantZ);
      }
    }
    if (this.charging) {
      if (lmbDown && this.charge < 1.0 && this.state === 'attack') {
        this.charge += dt;
        const act = this.rig.anim.action;
        if (act && act.t > 0.44) act.t = 0.44;
        this.attack.t = Math.min(this.attack.t, 0.44);
        if (Math.random() < dt * 20) g.effects.motes(this.handPos(), '#ffe6a0', 1, 0.2, 0.5, 0.4, 0.12);
      } else this.charging = false;
    }

    // dodge
    if (!menuBlock && input.hit('Space')) {
      if ((canAct || this.state === 'block' || (this.state === 'attack' && this.attack && this.attack.t > 0.65)) && s.stamina > 0) this.startRoll(wantX, wantZ);
      else if (this.state !== 'dead') this.buffer = { kind: 'roll', t: 0.35 };
    }
    // jump
    if (!menuBlock && input.hit('KeyF') && (canAct || this.state === 'block') && this.motor.grounded && s.stamina >= 6) {
      if (this.motor.jump(8.4)) { this.useStamina(8); g.audio.play('jump'); this.state = 'free'; }
    }
    // flask
    if (!menuBlock && input.hit('KeyR') && canAct) this.useFlask();
    // quick items
    if (!menuBlock && canAct) {
      for (let k = 0; k < 4; k++) if (input.hit('Digit' + (k + 1))) this.useQuick(k);
    }
    // spell
    if (!menuBlock && input.hit('KeyC') && canAct) this.castSpell();
    // lock-on
    if (!menuBlock && (input.hit('KeyQ') || input.click(1))) this.toggleLock();

    // ---- state updates ----
    let speed = 0, mx = 0, mz = 0;
    let faceYaw = null;
    const locked = this.lockTarget;
    this.sprinting = false;
    switch (this.state) {
      case 'free':
      case 'block': {
        const wantsSprint = !menuBlock && (input.key('ShiftLeft') || input.key('ShiftRight'));
        let sp = swim ? 3.2 : 5.6;
        if (ilen > 0 && wantsSprint && !this.exhausted && this.state === 'free' && s.stamina > 0) {
          sp = swim ? 5 : 9.8; this.sprinting = true;
          this.useStamina(dt * (swim ? 14 : 11), 0.3);
        }
        if (this.state === 'block') sp *= 0.45;
        if (ilen > 0) { mx = wantX; mz = wantZ; speed = sp; }
        if (locked && !this.sprinting) {
          faceYaw = Math.atan2(locked.pos.x - this.pos.x, locked.pos.z - this.pos.z);
        } else if (ilen > 0) faceYaw = Math.atan2(wantX, wantZ);
        break;
      }
      case 'attack': {
        const a = this.attack;
        a.t += dt / a.dur;
        const def = a.def;
        // steer slightly at start
        if (a.t < 0.25) {
          if (a.victim) faceYaw = Math.atan2(a.victim.pos.x - this.pos.x, a.victim.pos.z - this.pos.z);
          else if (locked) faceYaw = Math.atan2(locked.pos.x - this.pos.x, locked.pos.z - this.pos.z);
          else if (ilen > 0) faceYaw = Math.atan2(wantX, wantZ);
        }
        // lunge
        if (a.t > def.active[0] - 0.18 && a.t < def.active[1]) {
          const span = def.active[1] - (def.active[0] - 0.18);
          let lunge = def.lunge;
          if (locked) {
            const dist = Math.hypot(locked.pos.x - this.pos.x, locked.pos.z - this.pos.z) - locked.radius - 0.9;
            lunge = clamp(dist, 0, def.lunge * 1.4);
          }
          speed = lunge / (span * a.dur);
          mx = Math.sin(this.yaw); mz = Math.cos(this.yaw);
        }
        // hits
        if (a.t >= def.active[0] && a.t <= def.active[1]) {
          this.trail.active = true;
          if (!a.swung) { a.swung = true; g.audio.play(def.heavy || def.crit ? 'heavy' : 'swing'); }
          this.doHits(a);
        } else this.trail.active = false;
        if (a.t > 0.55 && this.queued && !def.heavy && !def.crit && def !== ATTACKS.run) {
          const cmb = this.comboList();
          const next = (a.comboIdx + 1) % cmb.length;
          if (s.stamina > 0 && a.t > 0.62) { this.queued = false; this.startAttack(cmb[next], null, next); break; }
        }
        if (a.t >= 1) { this.state = 'free'; this.attack = null; this.trail.active = false; this.queued = false; }
        break;
      }
      case 'roll': {
        const r = this.roll;
        r.t += dt / r.dur;
        const k = 1 - r.t * r.t;
        speed = r.speed * Math.max(0, k);
        mx = r.dx; mz = r.dz;
        if (r.back) faceYaw = null; else faceYaw = Math.atan2(r.dx, r.dz);
        if (r.t >= 1) this.state = 'free';
        break;
      }
      case 'hit':
      case 'stagger': {
        const k = Math.max(0, 1 - this.stateT / this.stateDur);
        speed = this.knock * k;
        mx = this.knockX; mz = this.knockZ;
        if (this.stateT >= this.stateDur) this.state = 'free';
        break;
      }
      case 'use': {
        const u = this.using;
        u.t += dt;
        if (ilen > 0) { mx = wantX; mz = wantZ; speed = 1.6; faceYaw = Math.atan2(wantX, wantZ); }
        if (!u.applied && u.t >= u.applyAt) { u.applied = true; u.apply(); }
        if (u.t >= u.dur) this.state = 'free';
        break;
      }
      case 'cast': {
        const c = this.casting;
        c.t += dt;
        if (locked) faceYaw = Math.atan2(locked.pos.x - this.pos.x, locked.pos.z - this.pos.z);
        else faceYaw = g.cam.yaw;
        if (!c.fired && c.t >= 0.36) { c.fired = true; this.fireBolt(); }
        if (c.t >= 0.7) this.state = 'free';
        break;
      }
      default: break;
    }

    // facing
    if (faceYaw !== null) {
      const rate = this.state === 'attack' ? 20 : this.state === 'roll' ? 30 : 12;
      this.yaw = angleLerp(this.yaw, faceYaw, 1 - Math.exp(-rate * dt));
    }

    // move: locomotion accelerates/decelerates for weight; actions (lunge, roll, knockback) stay crisp
    let vx = mx * speed, vz = mz * speed;
    if (this.state === 'free' || this.state === 'block' || this.state === 'use') {
      const accel = speed > 0.1 ? 11 : 16;
      this.vel.x = damp(this.vel.x, vx, accel, dt);
      this.vel.z = damp(this.vel.z, vz, accel, dt);
      vx = this.vel.x; vz = this.vel.z;
    } else { this.vel.set(vx, 0, vz); }
    const moved = this.motor.move(this.pos, vx, vz, dt);
    this.moveSpeed = damp(this.moveSpeed, moved / Math.max(dt, 1e-4), 12, dt);
    if (this.motor.grounded && this.motor.lastFall > 0.5) this.onLand(this.motor.lastFall);

    // footsteps
    if (this.motor.grounded && this.moveSpeed > 1) {
      this.stepT += dt * this.moveSpeed * 0.35;
      if (this.stepT > 1) {
        this.stepT = 0;
        const ground = g.terrain.getHeight(this.pos.x, this.pos.z);
        const onBuilt = this.pos.y - ground > 0.15 || (Math.abs(this.pos.x - CASTLE.x) < 76 && Math.abs(this.pos.z - CASTLE.z) < 72);
        const wet = ground < WORLD.water + 0.25;
        g.audio.play(wet ? 'step_water' : onBuilt ? 'step_stone' : 'step_grass', this.sprinting ? 1.4 : 1);
      }
    }

    // stamina regen
    this.stamDelay -= dt;
    const sat = s.satiety;
    if (this.stamDelay <= 0 && !this.sprinting) {
      let rate = d.stamRegen * (this.state === 'block' ? 0.35 : 1) * (sat <= 0 ? 0.6 : 1);
      if (this.state === 'attack' || this.state === 'roll') rate = 0;
      s.stamina = Math.min(d.maxStamina, s.stamina + rate * dt);
    }
    if (this.exhausted && s.stamina > d.maxStamina * 0.3) this.exhausted = false;
    s.mana = Math.min(d.maxMana, s.mana + d.manaRegen * dt);
    // heal over time
    for (let i = this.hot.length - 1; i >= 0; i--) {
      const h = this.hot[i];
      const amt = Math.min(h.left, h.rate * dt);
      h.left -= amt;
      s.hp = Math.min(d.maxHp, s.hp + amt);
      if (h.left <= 0) this.hot.splice(i, 1);
    }
    if (d.hpRegen > 0) s.hp = Math.min(d.maxHp, s.hp + d.hpRegen * dt);
    if (this.poison) {
      this.poison.left -= dt;
      s.hp = Math.max(1, s.hp - this.poison.dps * dt);
      if (Math.random() < dt * 6) g.effects.motes(this.pos, '#b58cff', 1, 0.4, 1.2, 0.9, 0.12);
      if (this.poison.left <= 0) this.poison = null;
    }
    // satiety
    s.satiety = Math.max(0, s.satiety - dt * 0.055);
    if (sat > 60 && this.combatT > 8) s.hp = Math.min(d.maxHp, s.hp + dt * 0.5);
    s.hp = Math.min(s.hp, d.maxHp);
    s.stamina = Math.min(s.stamina, d.maxStamina);

    // animation
    const base = this.state === 'block' ? 'block' : (this.combatT < 6 || locked ? 'guard' : 'relaxed');
    // ground contact for the animation: stepping down a slope isn't "in the air"
    const gh = g.terrain.getHeight(this.pos.x, this.pos.z);
    const nearGround = this.motor.grounded || (this.pos.y - gh < 0.45 && (this.motor.vy || 0) <= 0.5);
    // slope along the facing direction (+ uphill)
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const slope = this.moveSpeed > 0.3 && nearGround && !swim ? Math.max(-0.6, Math.min(0.6, g.terrain.getHeight(this.pos.x + fx * 0.8, this.pos.z + fz * 0.8) - gh)) : 0;
    this.slopeS = damp(this.slopeS || 0, slope, 6, dt);
    this.rig.update(dt, {
      speed: this.moveSpeed, grounded: nearGround, base, swim, slope: this.slopeS,
    });
    this.syncRig(dt);

    // weapon trail
    if (this.trail.active && this.rig.bladePoints(_base, _tip)) this.trail.push(_base, _tip);

    // store
    s.x = this.pos.x; s.y = this.pos.y; s.z = this.pos.z; s.yaw = this.yaw;
  }

  // ---- sitting on benches, chairs, thrones ----
  sit(seat) {
    if (this.state !== 'free' || this.mount) return;
    this.state = 'sit';
    this.seat = seat;
    this.stateT = 0;
    this.lockTarget = null;
    this.sitFrom = this.pos.clone();
    this.game.audio.play('sit');
  }

  standUp() {
    const seat = this.seat;
    this.state = 'free';
    this.seat = null;
    if (!seat) return;
    const f = seat.face ?? 0;
    const x = seat.x + Math.sin(f) * 0.8, z = seat.z + Math.cos(f) * 0.8;
    const y = this.game.collision.groundHeight(x, z, seat.y + 1.5);
    this.setPosition(x, y + 0.05, z, f);
  }

  updateSit(dt) {
    const g = this.game;
    const input = g.input;
    const seat = this.seat;
    const d = g.derived();
    const s = this.s;
    const k = Math.min(1, this.stateT / 0.35);
    const tx = seat.x, tz = seat.z, ty = seat.y + (seat.h ?? 0.5) - 0.5;
    this.pos.set(this.sitFrom.x + (tx - this.sitFrom.x) * k, this.sitFrom.y + (ty - this.sitFrom.y) * k, this.sitFrom.z + (tz - this.sitFrom.z) * k);
    this.yaw = angleLerp(this.yaw, seat.face ?? 0, 1 - Math.exp(-10 * dt));
    this.motor.vy = 0;
    this.motor.fallStartY = this.pos.y;
    // resting while seated
    s.stamina = Math.min(d.maxStamina, s.stamina + d.stamRegen * 1.5 * dt);
    if (s.satiety > 20) s.hp = Math.min(d.maxHp, s.hp + dt * 1.2);
    s.satiety = Math.max(0, s.satiety - dt * 0.03);
    if (g.mode === 'play' && this.stateT > 0.45 && (input.hit('KeyE') || input.key('KeyW') || input.key('KeyS') || input.key('KeyA') || input.key('KeyD') || input.hit('Space'))) this.standUp();
    this.rig.update(dt, { speed: 0, grounded: true, base: 'relaxed', sit: true, lookAround: 0.8 });
    this.syncRig();
    s.x = this.pos.x; s.y = this.pos.y; s.z = this.pos.z; s.yaw = this.yaw;
  }

  syncRig(dt = 0) {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    // smooth out small vertical steps (slope facets, stair treads) so the body glides instead of jittering
    if (dt > 0 && this.motor.grounded && this.visY !== undefined && Math.abs(this.pos.y - this.visY) < 0.6) this.visY = damp(this.visY, this.pos.y, 16, dt);
    else this.visY = this.pos.y;
    this.rig.root.position.y = this.visY;
    if (this.motor.swimming) this.rig.root.position.y += 0.35 + Math.sin(performance.now() * 0.002) * 0.04;
  }

  handPos() {
    this.rig.j.handR.updateWorldMatrix(true, false);
    return _v2.setFromMatrixPosition(this.rig.j.handR.matrixWorld);
  }

  useStamina(n, delay = 0.7) {
    const s = this.s;
    s.stamina -= n;
    if (s.stamina <= 0) { s.stamina = 0; this.exhausted = true; }
    this.stamDelay = Math.max(this.stamDelay, delay);
  }

  startAttack(name, victim = null, comboIdx = 0) {
    const def = ATTACKS[name];
    const d = this.game.derived();
    const spd = def.crit ? 1 : d.weaponSpeed;
    this.state = 'attack';
    this.stateT = 0;
    this.attack = { def, t: 0, dur: def.dur / spd, comboIdx, victim, swung: false };
    this.hitSet.clear();
    this.charge = 0;
    this.charging = false;
    this.queued = false;
    this.useStamina(def.stam);
    this.rig.anim.play(def.clip, def.dur / spd);
    this.combatT = 0;
    if (def.crit) this.game.cam.punch(0.5);
  }

  startRoll(dx, dz) {
    const g = this.game;
    let back = false;
    if (dx === 0 && dz === 0) {
      if (this.lockTarget) { back = true; dx = -Math.sin(this.yaw); dz = -Math.cos(this.yaw); } else { dx = Math.sin(this.yaw); dz = Math.cos(this.yaw); }
    }
    this.state = 'roll';
    this.stateT = 0;
    this.attack = null;
    this.trail.active = false;
    this.roll = back ? { t: 0, dur: 0.38, speed: 8, dx, dz, back: true } : { t: 0, dur: 0.6, speed: 10.5, dx, dz, back: false };
    this.iframes = back ? 0.26 : 0.42;
    this.useStamina(back ? 12 : 18);
    if (!back) this.rig.anim.play('roll', 0.6); else this.rig.anim.play('hit', 0.38);
    g.audio.play('roll');
    g.effects.dust(this.pos, 6);
    this.combatT = 0;
  }

  comboList() {
    const w = ITEMS[this.game.state.equipment.weapon];
    const m = w && w.model;
    return m === 'axe' ? COMBO_AXE : m === 'greatsword' ? COMBO_GS : m === 'spear' ? COMBO_SPEAR : COMBO;
  }

  findBackstab() {
    let best = null, bd = 2.6;
    for (const e of this.game.enemies) {
      if (!e.alive || e.boss || e.T.body === 'wisp') continue;
      if (e.state !== 'idle' && e.state !== 'return' && e.state !== 'alert') continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz) - e.radius;
      if (dist > bd) continue;
      const behind = Math.abs(angleDiff(e.yaw, Math.atan2(dx, dz))) > 2.2;
      if (behind) { bd = dist; best = e; }
    }
    return best;
  }

  findRiposte() {
    let best = null, bd = 3.4;
    for (const e of this.game.enemies) {
      if (!e.alive || !e.vulnerable) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz) - e.radius;
      if (dist < bd) { bd = dist; best = e; }
    }
    return best;
  }

  // a swing that connects with a tree trunk shakes its crown: leaves rain down
  hitTrees(a) {
    const g = this.game;
    if (a.treeHit || !g.veg?.treeList) return;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    for (const t of g.veg.treeList) {
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
      if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
      const dist = Math.hypot(dx, dz);
      if (dist > a.def.range + 0.6) continue;
      if ((dx * fx + dz * fz) / (dist || 1) < Math.cos(Math.min(1.2, a.def.arc))) continue;
      a.treeHit = true;
      const cols = TREE_LEAF[t.type] || TREE_LEAF.oak;
      const ty = g.terrain.getHeight(t.x, t.z);
      g.effects.leaves({ x: t.x, y: ty + 4.2 * t.s, z: t.z }, cols, a.def.heavy ? 70 : 40, 2.6 * t.s);
      g.effects.dust({ x: t.x - dx / dist * 0.4, y: ty + 1.2, z: t.z - dz / dist * 0.4 }, 4, '#8a6a52');
      g.audio.play('block', 0.5);
      g.hitStop(0.04);
      g.cam.shake(0.12);
      return;
    }
  }

  doHits(a) {
    const g = this.game;
    const d = g.derived();
    const def = a.def;
    this.hitTrees(a);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const targets = g.hittables();
    for (const t of targets) {
      if (!t.alive || this.hitSet.has(t)) continue;
      if (a.victim && t !== a.victim) continue;
      if (t.isDummy && def.arc < Math.PI && Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) > 3.2) continue;
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist - t.radius > def.range) continue;
      if (Math.abs(t.pos.y + t.height * 0.5 - (this.pos.y + 1)) > 2.2 + t.height * 0.5) continue;
      const ang = Math.acos(clamp((dx * fx + dz * fz) / (dist || 1), -1, 1));
      if (ang > def.arc && dist > t.radius + 0.7) continue;
      this.hitSet.add(t);
      let dmg = d.damage * def.mult * (1 + this.charge * 0.45) * (0.92 + Math.random() * 0.16);
      const st = g.state;
      if (hasPerk(st, 'b_flow') && !def.crit && !def.heavy) dmg *= 1 + 0.1 * (a.comboIdx || 0);
      if (hasPerk(st, 'b_exec') && def.crit) dmg *= 1.5;
      const res = t.takeHit(dmg, this, { heavy: !!def.heavy, crit: !!def.crit, poise: def.poise || (def.heavy ? 3 : 1), dir: { x: fx, z: fz } });
      if (res && !res.blocked && t.applyStatus) {
        if (d.effect) t.applyStatus(d.effect, d.damage, def.heavy || def.crit ? 1 : 0.45);
        if (hasPerk(st, 'b_rend') && d.effect !== 'bleed') t.applyStatus('bleed', d.damage, 0.2);
      }
      if (res && !res.blocked && hasPerk(st, 'l_drain')) st.player.mana = Math.min(d.maxMana, st.player.mana + 2);
      _v.set(t.pos.x, t.pos.y + t.height * 0.6, t.pos.z);
      if (res && res.blocked) {
        g.effects.sparks(_v, '#ffffff', 10, 5);
        g.audio.play('block');
        g.hitStop(0.05);
        // recoil
        if (!def.heavy) { this.state = 'hit'; this.stateT = 0; this.stateDur = 0.45; this.knock = 3; this.knockX = -fx; this.knockZ = -fz; this.rig.anim.play('hit', 0.45); this.trail.active = false; }
        return;
      }
      g.effects.sparks(_v, def.crit ? '#ffe08a' : '#fff6e0', def.crit ? 30 : 14, def.crit ? 8 : 6);
      g.effects.burst(_v, '#ffffff', 6, 2, 0.25, 0.3);
      g.audio.play(def.crit ? 'crit' : 'hit');
      g.hitStop(def.crit ? 0.18 : def.heavy ? 0.1 : 0.055);
      g.cam.shake(def.crit ? 0.5 : def.heavy ? 0.35 : 0.15);
      this.combatT = 0;
    }
  }

  // ------------------------------------------------------------------
  takeHit(dmg, attacker, opts = {}) {
    const g = this.game;
    if (this.state === 'dead') return { dodged: true };
    if (this.state === 'sit') this.standUp();
    if (this.iframes > 0 && !opts.aoeGround) return { dodged: true };
    if (opts.aoeGround && !this.motor.grounded) return { dodged: true };
    if (opts.aoeGround && this.iframes > 0) return { dodged: true };
    this.combatT = 0;
    const d = g.derived();
    const s = this.s;
    const ax = attacker ? attacker.pos.x - this.pos.x : 0, az = attacker ? attacker.pos.z - this.pos.z : 0;
    const al = Math.hypot(ax, az) || 1;
    const front = Math.abs(angleDiff(this.yaw, Math.atan2(ax, az))) < 1.4;
    if (this.mount) this.dismount(true);
    if (this.state === 'block' && front && !opts.unblockable) {
      const since = g.time - this.blockStart;
      if (since <= (hasPerk(g.state, 'g_riposte') ? 0.36 : 0.24) && attacker && attacker.canBeParried && !opts.projectile) {
        if (hasPerk(g.state, 'g_riposte')) s.stamina = Math.min(d.maxStamina, s.stamina + 30);
        attacker.parried();
        g.effects.sparks(this.handPos(), '#ffe08a', 30, 9);
        g.audio.play('parry');
        g.hitStop(0.16);
        g.cam.shake(0.3);
        g.ui.combatText('ПАРИРОВАНИЕ', '#ffe08a');
        return { parried: true };
      }
      const cost = (dmg * 1.1 + 6) * (hasPerk(g.state, 'g_wall') ? 0.65 : 1);
      g.effects.sparks(this.handPos(), '#ffffff', 12, 6);
      g.audio.play('block');
      if (s.stamina >= cost) {
        this.useStamina(cost, 0.6);
        this.applyDamage(dmg * 0.12, attacker, false);
        this.knockback(ax, az, al, 2.5, 0.25);
        return { blocked: true };
      }
      // guard break
      s.stamina = 0; this.exhausted = true;
      this.applyDamage(dmg * 0.45, attacker, false);
      this.state = 'stagger'; this.stateT = 0; this.stateDur = 1.0;
      this.knock = 3; this.knockX = -ax / al; this.knockZ = -az / al;
      this.rig.anim.play('stagger', 1.0);
      g.ui.combatText('Защита пробита', '#ff9a9a');
      return { guardBreak: true };
    }
    const def = d.defense;
    const final = dmg * 100 / (100 + def * 3.2);
    this.applyDamage(final, attacker, true);
    if (this.state !== 'dead') {
      const heavyHyper = this.state === 'attack' && this.attack?.def.heavy && this.attack.t > 0.35 && this.attack.t < 0.7;
      if (!heavyHyper) {
        this.state = 'hit'; this.stateT = 0; this.stateDur = opts.knock ? 0.75 : 0.42;
        this.knock = opts.knock || 2.5; this.knockX = -ax / al; this.knockZ = -az / al;
        this.rig.anim.play(opts.knock ? 'stagger' : 'hit', this.stateDur);
        this.attack = null; this.trail.active = false; this.charging = false;
      }
    }
    return { hit: true };
  }

  knockback(ax, az, al, k, dur) {
    this.state = 'hit'; this.stateT = 0; this.stateDur = dur;
    this.knock = k; this.knockX = -ax / al; this.knockZ = -az / al;
  }

  applyDamage(n, attacker, flinch) {
    const g = this.game;
    const s = this.s;
    s.hp -= n;
    g.ui.flash(flinch ? 0.55 : 0.25);
    g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + 2, this.pos.z), n, 'player');
    if (flinch) { g.audio.play('hurt'); g.cam.shake(0.3); }
    if (s.hp <= 0) {
      if (g.duel && attacker === g.duel.enemy) { s.hp = 1; g.endDuel(false); return; }
      s.hp = 0; this.die();
    }
  }

  onLand(fall) {
    const g = this.game;
    if (fall > 2.5) { g.audio.play('land'); g.effects.dust(this.pos, 8); }
    if (fall > 9 && !this.motor.swimming) {
      const dmg = fall > 32 ? 9999 : (fall - 9) * 7;
      this.applyDamage(dmg, null, true);
    }
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.deathT = 0;
    this.lockTarget = null;
    this.trail.active = false;
    this.game.onPlayerDeath();
  }

  revive() {
    this.state = 'free';
    this.deathT = 0;
    this.hot.length = 0;
    this.rig.anim.stop();
    this.iframes = 1.5;
  }

  // ------------------------------------------------------------------
  useFlask() {
    const g = this.game, s = this.s;
    if (s.flasks <= 0) { g.ui.hint('Флакон пуст. Наполните его у Алтаря Света.'); return; }
    s.flasks--;
    this.state = 'use';
    this.stateT = 0;
    this.rig.anim.play('drink', 1.0);
    this.using = {
      t: 0, dur: 1.0, applyAt: 0.55, applied: false,
      apply: () => {
        const d = g.derived();
        this.hot.push({ rate: d.maxHp * 1.6, left: (d.maxHp * 0.45 + 25) * d.healMul });
        g.effects.motes(this.pos, '#ffd98a', 26, 0.6, 1.8, 1.4);
        g.audio.play('heal');
      },
    };
  }

  useQuick(k) {
    const g = this.game;
    const id = g.state.hotbar[k];
    if (!id) return;
    if (!g.itemCount(id)) { g.ui.hint('Нет в сумке: ' + ITEMS[id].name); return; }
    this.consume(id);
  }

  consume(id) {
    const g = this.game;
    const it = ITEMS[id];
    if (!it || (it.type !== 'food' && it.type !== 'potion')) return false;
    if (this.state !== 'free') return false;
    g.takeItem(id, 1, true);
    this.state = 'use';
    this.stateT = 0;
    this.rig.anim.play('drink', 1.0);
    this.using = {
      t: 0, dur: 1.0, applyAt: 0.6, applied: false,
      apply: () => {
        const s = this.s;
        const d = g.derived();
        if (it.heal) { const hm = this.game.derived().healMul; this.hot.push({ rate: it.heal * hm / 5, left: it.heal * hm }); }
        if (it.type === 'potion' && this.poison) { this.poison = null; g.ui.combatText('Яд нейтрализован', '#b8ffb0', true); }
        if (it.sat) s.satiety = Math.min(100, s.satiety + it.sat);
        if (it.instant?.hp) { s.hp = Math.min(d.maxHp, s.hp + it.instant.hp); g.effects.motes(this.pos, '#ff9ab8', 18); }
        if (it.instant?.mana) { s.mana = Math.min(d.maxMana, s.mana + it.instant.mana); g.effects.motes(this.pos, '#9ac8ff', 18); }
        if (it.buff) g.addBuff({ ...it.buff, id, name: it.name });
        g.audio.play(it.type === 'food' ? 'eat' : 'heal');
      },
    };
    return true;
  }

  castSpell() {
    const g = this.game;
    const s = this.s;
    if (!g.state.spells.includes('light_bolt')) return;
    if (s.mana < 14) { g.ui.hint('Недостаточно маны'); return; }
    s.mana -= 14;
    this.state = 'cast';
    this.stateT = 0;
    this.casting = { t: 0, fired: false };
    this.rig.anim.play('cast', 0.7);
    g.audio.play('magic');
    this.combatT = 0;
  }

  fireBolt() {
    const g = this.game;
    const d = g.derived();
    this.rig.j.handL.updateWorldMatrix(true, false);
    const from = new THREE.Vector3().setFromMatrixPosition(this.rig.j.handL.matrixWorld);
    let dir;
    if (this.lockTarget) {
      dir = new THREE.Vector3(this.lockTarget.pos.x, this.lockTarget.pos.y + this.lockTarget.height * 0.55, this.lockTarget.pos.z).sub(from).normalize();
    } else {
      dir = new THREE.Vector3();
      g.camera.getWorldDirection(dir);
      dir.y = Math.max(-0.2, Math.min(0.3, dir.y + 0.05));
      dir.normalize();
    }
    g.spawnProjectile({ from, dir, speed: 36, dmg: d.spellDmg, owner: this, color: '#fff1b8', size: 0.35, life: 2.2, light: true, homing: this.lockTarget });
  }

  toggleLock() {
    const g = this.game;
    if (this.lockTarget) { this.lockTarget = null; return; }
    const camDir = new THREE.Vector3();
    g.camera.getWorldDirection(camDir);
    let best = null, bs = Infinity;
    for (const e of g.enemies) {
      if (!e.alive || e.passive) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 28) continue;
      const ang = Math.acos(clamp((dx * camDir.x + dz * camDir.z) / (dist * Math.hypot(camDir.x, camDir.z) || 1), -1, 1));
      if (ang > 1.3) continue;
      const score = ang * 12 + dist;
      if (score < bs) { bs = score; best = e; }
    }
    this.lockTarget = best;
    if (!best) g.cam.recenter(this.yaw);
  }

  // ------------------------------------------------------------------
  mountUp(mount) {
    this.mount = mount;
    this.lockTarget = null;
    this.state = 'free';
    mount.rider = this;
    this.game.audio.play('horse');
  }

  dismount(forced = false) {
    const m = this.mount;
    if (!m) return;
    this.mount = null;
    m.rider = null;
    const side = new THREE.Vector3(Math.cos(m.yaw), 0, -Math.sin(m.yaw)).multiplyScalar(1.4);
    this.pos.set(m.pos.x + side.x, m.pos.y + 0.2, m.pos.z + side.z);
    this.motor.vy = 0;
    this.motor.grounded = false;
    this.motor.fallStartY = this.pos.y;
    if (forced) { this.state = 'stagger'; this.stateT = 0; this.stateDur = 0.8; this.knock = 2; this.knockX = side.x; this.knockZ = side.z; this.rig.anim.play('stagger', 0.8); }
  }

  updateMounted(dt, d) {
    const g = this.game;
    const m = this.mount;
    const input = g.input;
    if (g.mode === 'play' && (input.hit('KeyG') || input.hit('KeyE'))) { this.dismount(); return; }
    if (g.mode === 'play' && input.hit('KeyR')) this.useFlask();
    this.moveSpeed = m.speed;
    const seat = m.seatPos(_v);
    this.pos.copy(seat);
    this.yaw = m.yaw;
    this.rig.update(dt, { speed: m.speed, grounded: true, base: 'relaxed', ride: true, upperOnly: true });
    this.rig.root.position.copy(seat);
    this.rig.root.rotation.y = m.yaw;
    const s = this.s;
    this.stamDelay -= dt;
    if (this.stamDelay <= 0) s.stamina = Math.min(d.maxStamina, s.stamina + d.stamRegen * dt);
    s.mana = Math.min(d.maxMana, s.mana + d.manaRegen * dt);
    s.satiety = Math.max(0, s.satiety - dt * 0.055);
    for (let i = this.hot.length - 1; i >= 0; i--) {
      const h = this.hot[i];
      const amt = Math.min(h.left, h.rate * dt);
      h.left -= amt;
      s.hp = Math.min(d.maxHp, s.hp + amt);
      if (h.left <= 0) this.hot.splice(i, 1);
    }
    if (this.state === 'use') {
      this.using.t += dt;
      if (!this.using.applied && this.using.t >= this.using.applyAt) { this.using.applied = true; this.using.apply(); }
      if (this.using.t >= this.using.dur) this.state = 'free';
    }
    s.x = m.pos.x; s.y = m.pos.y; s.z = m.pos.z; s.yaw = m.yaw;
  }
}

export { ATTACKS };
