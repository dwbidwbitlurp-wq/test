// Friendly NPCs: named characters, guards and townsfolk.
import * as THREE from 'three';
import { Humanoid } from './humanoid.js';
import { Motor } from '../engine/collision.js';
import { angleLerp, damp } from '../engine/noise.js';

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
    this.visible = true;
    this.pos.y = def.pos.y;
    this.fixedY = def.fixedY || false;
    this.syncBody();
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    let speed = 0, face = null, mx = 0, mz = 0;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const pd = Math.hypot(dx, dz);
    if (this.talking) {
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
