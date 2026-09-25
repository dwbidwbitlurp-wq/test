// Astra — the royal unicorn mount.
import * as THREE from 'three';
import { Equine } from './equine.js';
import { Motor } from '../engine/collision.js';
import { angleLerp, damp } from '../engine/noise.js';
import { WORLD } from '../world/layout.js';

export class Mount {
  // o.body: an existing horse body (a stolen cart horse / a knight's charger) — it stays where it is left
  constructor(game, o = {}) {
    this.game = game;
    this.name = o.name || 'Астра';
    this.wild = !!o.body;
    this.body = o.body || new Equine({ coat: 'unicorn', horn: true, feather: true, saddle: true, blanket: 0xf2a6c9, trim: 0xf0c860, bridle: 0xf4f0ff, scale: 1.05 });
    if (!this.wild) this.body.root.visible = false;
    if (!this.body.root.parent) game.scene.add(this.body.root);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    if (this.wild) { this.pos.copy(this.body.root.position); this.yaw = this.body.root.rotation.y; this.summoned = true; }
    this.alive = true; this.hp = 140; this.height = 2.0;
    this.speed = 0;
    this.motor = new Motor(game.collision, { radius: 0.7, height: 2.0, canSwim: false });
    this.rider = null;
    this.summoned = this.summoned || false;
    this.target = null;
    this.radius = 0.8;
    this.sparkT = 0;
    // stamina: galloping drains it, walking / standing restores it; spent = no gallop until 35% again
    this.stamina = 100;
    this.maxStamina = 100;
    this.exhausted = false;
    this.stamDelay = 0;
    this.galloping = false;
    this.hoofN = 0;
    this.vel = 0;
  }

  summon() {
    const g = this.game;
    const p = g.player;
    const a = p.yaw + Math.PI * 0.6;
    this.pos.set(p.pos.x + Math.sin(a) * 6, p.pos.y + 1, p.pos.z + Math.cos(a) * 6);
    this.pos.y = g.collision.groundHeight(this.pos.x, this.pos.z, this.pos.y + 3);
    if (g.terrain.getHeight(this.pos.x, this.pos.z) < WORLD.water) this.pos.copy(p.pos);
    this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    this.summoned = true;
    this.body.root.visible = true;
    this.motor.vy = 0;
    g.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z), '#ffe3f4', 60, 5, 0.4, 1.2);
    g.effects.motes(this.pos, '#d8c4ff', 30, 1.2, 2, 2);
    g.audio.play('horse');
  }

  dismiss() {
    const g = this.game;
    g.effects.burst(new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z), '#ffe3f4', 40, 4, 0.4, 1);
    this.summoned = false;
    this.body.root.visible = false;
  }

  seatPos(out) {
    return out.set(this.pos.x + Math.sin(this.yaw) * 0.18, this.pos.y + this.body.seatHeight, this.pos.z + Math.cos(this.yaw) * 0.18);
  }

  update(dt) {
    if (!this.summoned) return;
    const g = this.game;
    const p = g.player;
    let mx = 0, mz = 0, speed = 0, face = null;
    if (this.rider) {
      const input = g.input;
      let ix = 0, iz = 0;
      if (g.mode === 'play') {
        if (input.key('KeyW')) iz += 1;
        if (input.key('KeyS')) iz -= 1;
        if (input.key('KeyA')) ix -= 1;
        if (input.key('KeyD')) ix += 1;
      }
      const l = Math.hypot(ix, iz);
      if (l > 0) {
        ix /= l; iz /= l;
        const fx = Math.sin(g.cam.yaw), fz = Math.cos(g.cam.yaw);
        mx = fx * iz - fz * ix; mz = fz * iz + fx * ix;
        const wantGallop = input.key('ShiftLeft') || input.key('ShiftRight');
        const gallop = wantGallop && !this.exhausted && this.stamina > 0;
        if (wantGallop && this.exhausted && (this.tiredHintT || 0) < g.time) { this.tiredHintT = g.time + 6; g.ui.hint(`${this.name} выбилась из сил — дайте ей перейти на шаг`); }
        speed = gallop ? 19 : 10;
        this.galloping = gallop;
        face = Math.atan2(mx, mz);
        // turn-rate limited movement along facing; only a real turn slows down (a small camera glance used to cut the pace)
        mx = Math.sin(this.yaw); mz = Math.cos(this.yaw);
        const diff = Math.abs(((face - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        speed *= diff < 0.5 ? 1 : Math.max(0.3, Math.cos(Math.min(diff - 0.5, Math.PI / 2)));
      } else this.galloping = false;
      // a jump costs the horse stamina (not possible when spent)
      if (g.mode === 'play' && (input.hit('KeyF') || input.hit('Space')) && this.motor.grounded) {
        if (this.stamina >= 12 && !this.exhausted) { this.motor.jump(10); g.audio.play('jump'); this.stamina -= 12; this.stamDelay = 1.2; }
        else if ((this.tiredHintT || 0) < g.time) { this.tiredHintT = g.time + 4; g.ui.hint(`${this.name} слишком устала для прыжка`); }
      }
    } else if (this.wild) {
      // a stolen horse waits where it was left
    } else {
      // follow the player loosely, wait when close
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 60) { this.dismiss(); return; }
      if (d > 5) { mx = dx / d; mz = dz / d; speed = d > 14 ? 12 : 4; face = Math.atan2(dx, dz); }
    }
    if (face !== null) this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-(this.rider ? 4.5 : 6) * dt));
    // don't walk into deep water (probe a fixed distance ahead, independent of the frame time)
    const nx = this.pos.x + mx * 1.2, nz = this.pos.z + mz * 1.2;
    if (speed > 0 && g.terrain.getHeight(nx, nz) < WORLD.water - 0.3) speed = 0;
    // a horse takes rough, steep ground in its stride: the human slope limit used to stop it dead on every
    // short steep bump (then it re-accelerated), which read as "sometimes it won't run"
    this.motor.climb = !!this.rider;
    // momentum: speed builds up and eases off instead of snapping
    this.vel = damp(this.vel, speed, speed > this.vel ? 3.2 : 5, dt);
    const moved = this.motor.move(this.pos, mx * this.vel, mz * this.vel, dt);
    const realSpeed = moved / Math.max(dt, 1e-4);
    // stamina
    if (this.rider && this.galloping && realSpeed > 11) {
      this.stamina = Math.max(0, this.stamina - dt * 9);
      this.stamDelay = 1.0;
      if (this.stamina <= 0 && !this.exhausted) { this.exhausted = true; g.audio.play('snort'); }
    } else {
      this.stamDelay -= dt;
      if (this.stamDelay <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + dt * (realSpeed < 0.5 ? 18 : realSpeed < 11 ? 11 : 4));
    }
    if (this.exhausted && this.stamina > this.maxStamina * 0.35) this.exhausted = false;
    if (this.motor.grounded && this.motor.lastFall > 8 && this.rider) {
      this.rider.applyDamage((this.motor.lastFall - 8) * 4, null, true);
    }
    this.speed = damp(this.speed, Math.min(realSpeed, 22), 8, dt);
    this.body.update(dt, { speed: this.speed, graze: !this.rider && this.speed < 0.2 });
    // hoofbeats: one per foot strike, clopping at the walk, drumming at the gallop
    if (this.body.strikes !== undefined && this.body.strikes !== this.hoofN) {
      const n = this.body.strikes - this.hoofN;
      this.hoofN = this.body.strikes;
      if (this.motor.grounded && this.speed > 0.6 && this.pos.distanceTo(g.camera.position) < 45) {
        const gait = this.speed > 6.2 ? 1 : this.speed > 2.6 ? 0.7 : 0.45;
        // one soft beat per pair of foot strikes, never faster than a real gait rhythm
        this.hoofPair = (this.hoofPair || 0) + n;
        const gap = this.speed > 6.2 ? 0.2 : this.speed > 2.6 ? 0.28 : 0.42;
        if (this.hoofPair >= 2 && g.time - (this.hoofT || 0) > gap) { this.hoofPair = 0; this.hoofT = g.time; g.audio.play('hoof', gait); }
      }
    }
    this.body.root.position.copy(this.pos);
    this.body.root.rotation.y = this.yaw;
    // magical hoof sparkles when galloping
    this.sparkT += dt;
    if (!this.wild && this.speed > 12 && this.sparkT > 0.05) {
      this.sparkT = 0;
      g.effects.motes(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z), Math.random() < 0.5 ? '#ffd6f0' : '#d8c8ff', 2, 0.6, 0.8, 0.9, 0.14);
    }
  }

  // any horse but Astra can be struck down
  takeHit(dmg) {
    const g = this.game;
    if (!this.wild || !this.alive) return null;
    g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + 2, this.pos.z), dmg, 'enemy');
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
      if (this.rider) this.rider.dismount(true);
      this.summoned = false;
      this.body.root.rotation.z = Math.PI / 2;
      this.body.root.position.y = this.pos.y + 0.35;
      g.audio.play('snort');
      return { killed: true };
    }
    g.audio.play('horse', 0.6);
    return { hit: true };
  }
}
