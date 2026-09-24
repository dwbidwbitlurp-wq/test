// Friendly NPCs: named characters, guards and townsfolk.
import * as THREE from 'three';
import { Humanoid } from './humanoid.js';
import { Motor } from '../engine/collision.js';
import { angleLerp, damp } from '../engine/noise.js';
import { pickBark } from '../game/barks.js';

export class NPC {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.title = def.title || '';
    this.dialog = def.dialog || def.id;
    this.pos = def.pos.clone();
    this.home = def.pos.clone();
    this.yaw = def.yaw ?? 0;
    this.baseYaw = this.yaw;
    this.radius = 0.4;
    this.height = 1.8 * (def.look?.scale || 1);
    this.body = new Humanoid(def.look || {});
    game.scene.add(this.body.root);
    this.motor = new Motor(game.collision, { radius: 0.35, height: 1.7, canSwim: false });
    this.behavior = def.behavior || 'stand';
    this.path = def.path || null;
    this.pathIdx = 0;
    this.waitT = Math.random() * 3;
    this.speed = 0;
    this.talking = false;
    this.talkT = 0;
    this.gestureT = 2 + Math.random() * 6;
    this.sit = !!def.sit;
    this.seat = def.seatRef || null;
    this.hidden = false;
    this.visible = true;
    this.pos.y = def.pos.y;
    this.fixedY = def.fixedY || false;
    this.alive = true;
    this.maxHp = def.guard ? 160 : 60;
    this.hp = this.maxHp;
    this.fearT = 0;
    this.down = 0;
    this.syncBody();
  }

  // struck by the player: pain, fear, and a crime the town will remember
  takeHit(dmg, src, opts = {}) {
    const g = this.game;
    if (this.down > 0) return null;
    this.hp -= dmg;
    g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + this.height + 0.3, this.pos.z), dmg, 'enemy');
    if (this.sit) { this.sit = false; this.fixedY = false; }
    if (this.body.anim) this.body.anim.play('hit', 0.4);
    if ((this.crimeCD || 0) < g.time) { this.crimeCD = g.time + 4; g.onCivilianHit(this); }
    if (this.hp <= 0) {
      this.down = 30; this.deathT = 0; this.fearT = 0;
      g.ui.bark(this, this.def.guard ? 'Ты... за это... ответишь...' : '(теряет сознание)');
      return { killed: true };
    }
    if (!this.def.guard) this.scare(12);
    else { g.ui.bark(this, 'Именем короны — стоять!'); g.audio.say('Именем короны, стоять!', { pitch: 0.8, rate: 1.1 }); }
    return { hit: true };
  }

  scare(t) {
    if (this.talking || this.down > 0) return;
    const first = this.fearT <= 0;
    this.fearT = Math.max(this.fearT, t);
    this.walkTo = null;
    if (this.sit) { this.sit = false; this.fixedY = false; }
    if (first) {
      const line = ['Помогите! Стража!', 'Не трогай меня!', 'Убивают!', 'Бегите!'][Math.floor(Math.random() * 4)];
      this.game.ui.bark(this, line);
      if (this.pos.distanceTo(this.game.player.pos) < 14) this.game.audio.say(line, { pitch: this.def.look?.skirt ? 1.5 : 1.0, rate: 1.3 });
      if (this.pos.distanceTo(this.game.player.pos) < 20) this.game.audio.play('scream', 0.8);
    }
  }

  // daily routine: [{ from, to, pos?, yaw?, sit?, seat?, behavior?, off? }]
  // switches only when the player is not watching (far away), like NPCs going about their day
  updateSchedule(force = false) {
    const sch = this.def.schedule;
    if (!sch || this.talking) return;
    const h = this.game.state.hour;
    const slot = sch.find((s) => (s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to)) || null;
    if (slot === this.slot) return;
    const target = slot && !slot.off ? (slot.seat ? new THREE.Vector3(slot.seat.x, slot.seat.y, slot.seat.z) : (slot.pos || this.def.pos)) : null;
    const seen = this.visible && !this.offDuty && this.pos.distanceTo(this.game.player.pos) < 60;
    // walk there on foot when the destination is on the same level and not too far
    if (!force && seen && !this.walkTo) {
      const goal = target || this.def.home || null;
      if (goal && Math.abs(goal.y - this.pos.y) < 1.5 && goal.distanceTo(this.pos) < 90) {
        this.walkTo = { slot, goal: goal.clone(), t: 0 };
        this.sit = false; this.fixedY = false; this.behavior = 'stand';
        return;
      }
      if (this.pos.distanceTo(this.game.player.pos) < 24) return;
    }
    this.applySlot(slot);
  }

  applySlot(slot) {
    this.walkTo = null;
    this.slot = slot;
    this.offDuty = !slot || !!slot.off;
    if (!slot || slot.off) { this.setVisible(false); return; }
    const pos = slot.seat ? new THREE.Vector3(slot.seat.x, slot.seat.y, slot.seat.z) : (slot.pos || this.def.pos);
    this.pos.copy(pos);
    this.home.copy(pos);
    this.yaw = this.baseYaw = slot.seat ? slot.seat.face : (slot.yaw ?? this.def.yaw ?? 0);
    this.sit = !!(slot.sit || slot.seat);
    this.seat = slot.seat || null;
    this.fixedY = this.sit || !!slot.fixedY;
    this.behavior = slot.behavior || 'stand';
    this.target = null;
    this.motor.vy = 0;
    this.syncBody();
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    let speed = 0, face = null, mx = 0, mz = 0;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const pd = Math.hypot(dx, dz);
    // ambient one-liners when the player walks past
    this.barkT = (this.barkT ?? 4 + Math.random() * 10) - dt;
    if (this.barkT <= 0 && pd < 5.5 && this.visible && !this.talking && g.mode === 'play' && !g.cine && (g._barkCD || 0) < g.time && this.def.talk) {
      this.barkT = 35 + Math.random() * 30;
      const line = pickBark(g, this);
      if (line) { g._barkCD = g.time + 5; g.ui.bark(this, line); if (!line.startsWith('(')) g.audio.say(line, { pitch: this.def.look?.skirt ? 1.3 : 0.9, rate: 1.0, vol: 0.75 }); }
    } else if (this.barkT <= 0) this.barkT = 1;
    // work loop (smith hammering at the anvil)
    if (this.def.work && !this.talking && !this.walkTo && this.visible && !this.sit) {
      this.workT = (this.workT || 0) - dt;
      if (this.workT <= 0) {
        this.workT = this.def.work.every;
        this.body.anim.play(this.def.work.clip, this.def.work.dur);
        if (this.def.work.sound && pd < 18) setTimeout(() => g.audio.play(this.def.work.sound, Math.max(0.1, 0.6 - pd / 30)), this.def.work.dur * 520);
      }
      this.gestureT = 99;
    }
    if (this.down > 0) {
      // knocked out: lies on the ground, then gets back up
      this.down -= dt; this.deathT = (this.deathT || 0) + dt;
      this.body.update(dt, { dead: this.down > 1.2, deathT: this.deathT, grounded: true });
      this.syncBody();
      if (this.down <= 0) { this.hp = this.maxHp; this.deathT = 0; this.scare(10); }
      return;
    }
    if (this.fearT > 0 && !this.talking) {
      // run away from the player, glancing back
      this.fearT -= dt;
      const d = Math.max(0.001, pd);
      mx = -dx / d; mz = -dz / d;
      if (this.stuckT > 1.2) { const a = Math.atan2(mx, mz) + (Math.random() < 0.5 ? 1.4 : -1.4); mx = Math.sin(a); mz = Math.cos(a); }
      speed = pd < 25 ? 4.4 : 1.6; face = Math.atan2(mx, mz);
      if (this.fearT <= 0) { this.home.copy(this.pos); this.target = null; }
    } else if (this.walkTo && !this.talking) {
      const w = this.walkTo;
      w.t += dt;
      const tx = w.goal.x - this.pos.x, tz = w.goal.z - this.pos.z, td = Math.hypot(tx, tz);
      if (td < 0.7 || w.t > 90 || (this.stuckT > 4 && pd > 20)) { this.applySlot(w.slot); }
      else { mx = tx / td; mz = tz / td; speed = this.def.speed || 1.45; face = Math.atan2(tx, tz); if (pd < 1.6) { speed = 0; } }
    } else if (this.talking) {
      face = Math.atan2(dx, dz);
      this.talkT -= dt;
      if (this.talkT <= 0) { this.talkT = 2 + Math.random() * 2; this.body.anim.play('talk', 1.6); }
    } else if (this.behavior === 'patrol' && this.path) {
      const tgt = this.path[this.pathIdx];
      const tx = tgt.x - this.pos.x, tz = tgt.z - this.pos.z;
      const td = Math.hypot(tx, tz);
      if (this.waitT > 0) { this.waitT -= dt; }
      else if (td < 0.6) { this.pathIdx = (this.pathIdx + 1) % this.path.length; this.waitT = 1 + Math.random() * 3; }
      else { mx = tx / td; mz = tz / td; speed = this.def.speed || 1.5; face = Math.atan2(tx, tz); }
      if (pd < 2.2) { speed = 0; face = Math.atan2(dx, dz); }
    } else if (this.behavior === 'wander') {
      this.waitT -= dt;
      if (!this.target && this.waitT <= 0) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * (this.def.wanderR || 8);
        this.target = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
      }
      if (this.target) {
        const tx = this.target.x - this.pos.x, tz = this.target.z - this.pos.z;
        const td = Math.hypot(tx, tz);
        if (td < 0.6 || this.stuckT > 3) { this.target = null; this.waitT = 2 + Math.random() * 5; this.stuckT = 0; }
        else { mx = tx / td; mz = tz / td; speed = 1.3; face = Math.atan2(tx, tz); }
      }
      if (pd < 2.2) { speed = 0; face = Math.atan2(dx, dz); }
    } else {
      // stand: look at player when close
      if (pd < 5) face = Math.atan2(dx, dz);
      else face = this.baseYaw;
      this.gestureT -= dt;
      if (this.gestureT <= 0) {
        this.gestureT = 5 + Math.random() * 8;
        if (!this.sit) this.body.anim.play(this.def.gesture || 'talk', 1.6);
      }
    }
    if (face !== null) this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-5 * dt));
    if (!this.fixedY) {
      const before = this.pos.clone();
      this.motor.move(this.pos, mx * speed, mz * speed, dt);
      if (speed > 0 && before.distanceTo(this.pos) < speed * dt * 0.2) this.stuckT = (this.stuckT || 0) + dt; else this.stuckT = 0;
    }
    this.speed = damp(this.speed, speed, 8, dt);
    this.body.update(dt, { speed: this.speed, grounded: true, base: this.def.guard ? 'guard' : 'relaxed', sit: this.sit, lookAround: 0.6 });
    this.syncBody();
  }

  syncBody() {
    this.body.root.position.copy(this.pos);
    this.body.root.rotation.y = this.yaw;
  }

  setVisible(v) {
    if (this.visible === v) return;
    this.visible = v;
    this.body.root.visible = v;
  }
}
