// Astra — the royal unicorn mount.
import * as THREE from 'three';
import { Quadruped } from './quadruped.js';
import { Motor } from '../engine/collision.js';
import { angleLerp, damp } from '../engine/noise.js';
import { WORLD } from '../world/layout.js';

export class Mount {
  constructor(game) {
    this.game = game;
    this.body = new Quadruped('unicorn');
    this.body.root.visible = false;
    game.scene.add(this.body.root);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.motor = new Motor(game.collision, { radius: 0.7, height: 2.0, canSwim: false });
    this.rider = null;
    this.summoned = false;
    this.target = null;
    this.radius = 0.8;
    this.sparkT = 0;
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
    return out.set(this.pos.x - Math.sin(this.yaw) * 0.1, this.pos.y + 1.12, this.pos.z - Math.cos(this.yaw) * 0.1);
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
        const gallop = input.key('ShiftLeft') || input.key('ShiftRight');
        speed = gallop ? 19 : 10;
        face = Math.atan2(mx, mz);
        // turn-rate limited movement along facing
        mx = Math.sin(this.yaw); mz = Math.cos(this.yaw);
        const diff = Math.abs(((face - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        speed *= Math.max(0.25, Math.cos(Math.min(diff, Math.PI / 2)));
      }
      if (g.mode === 'play' && input.hit('KeyF') && this.motor.grounded) { this.motor.jump(10); g.audio.play('jump'); }
      if (g.mode === 'play' && input.hit('Space') && this.motor.grounded) { this.motor.jump(10); g.audio.play('jump'); }
    } else {
      // follow the player loosely, wait when close
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 60) { this.dismiss(); return; }
      if (d > 5) { mx = dx / d; mz = dz / d; speed = d > 14 ? 12 : 4; face = Math.atan2(dx, dz); }
    }
    if (face !== null) this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-(this.rider ? 4.5 : 6) * dt));
    // don't walk into deep water
    const nx = this.pos.x + mx * speed * dt, nz = this.pos.z + mz * speed * dt;
    if (g.terrain.getHeight(nx, nz) < WORLD.water - 0.3) speed = 0;
    this.motor.move(this.pos, mx * speed, mz * speed, dt);
    if (this.motor.grounded && this.motor.lastFall > 8 && this.rider) {
      this.rider.applyDamage((this.motor.lastFall - 8) * 4, null, true);
    }
    this.speed = damp(this.speed, speed, 6, dt);
    this.body.update(dt, { speed: this.speed, graze: !this.rider && this.speed < 0.2 });
    this.body.root.position.copy(this.pos);
    this.body.root.rotation.y = this.yaw;
    // magical hoof sparkles when galloping
    this.sparkT += dt;
    if (this.speed > 12 && this.sparkT > 0.05) {
      this.sparkT = 0;
      g.effects.motes(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z), Math.random() < 0.5 ? '#ffd6f0' : '#d8c8ff', 2, 0.6, 0.8, 0.9, 0.14);
    }
  }
}
