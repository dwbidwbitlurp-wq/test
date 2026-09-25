// Mounted characters (knight patrols, a lady out riding) and horses standing in
// the stables or led on foot. A Rider walks its horse along a looping path.
import * as THREE from 'three';
import { Equine } from './equine.js';
import { Humanoid } from './humanoid.js';
import { angleLerp, damp } from '../engine/noise.js';

export class Rider {
  constructor(game, o) {
    this.game = game;
    this.o = o;
    this.horse = new Equine(o.horse || {});
    this.human = o.look ? new Humanoid(o.look) : null;
    game.scene.add(this.horse.root);
    if (this.human) game.scene.add(this.human.root);
    this.path = o.path || null; // [{x,z}] world
    this.idx = 0;
    this.dir = 1;
    this.lateral = o.lateral || 0;
    this.pos = new THREE.Vector3(o.pos ? o.pos.x : this.path[0].x, 0, o.pos ? o.pos.z : this.path[0].z);
    this.pos.y = this.ground(this.pos.x, this.pos.z, o.pos ? o.pos.y : 500);
    this.yaw = o.yaw ?? 0;
    this.speed = 0;
    this.maxSpeed = o.speed ?? 2.2;
    this.waitT = 0;
    this.greetT = 0;
    this.visible = true;
    this.name = o.name || 'Рыцарь';
    this.follow = o.follow || null; // { target: {pos, yaw}, back, side }
    this.alive = true; this.radius = 1.0; this.height = 2.6; this.def = { named: false, rider: true };
    this.sync();
  }

  // struck by the player: an armoured knight dismounts and fights; anyone else spurs the horse away
  takeHit(dmg) {
    const g = this.game;
    if (!this.human || this.dismounted) return null;
    g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + this.height, this.pos.z), dmg, 'enemy');
    if (this.o.look && this.o.look.armor) {
      this.dismounted = true;
      this.human.root.visible = false;
      this.path = null; this.maxSpeed = 0; this.speed = 0;
      g.spawnHostileKnight(this);
      g.ui.bark(this, 'Измена! К оружию!');
      g.audio.vocal('shout', false);
    } else {
      this.fleeT = 8; this.maxSpeed = 7;
      g.audio.vocal('gasp', true);
      g.ui.bark(this, 'Помогите!');
    }
    g.tutorial?.show('crime');
    g.crimeHeat(this.o.look && this.o.look.armor ? 80 : 30, true);
    return { hit: true };
  }

  // the knight climbs back into the saddle and resumes the patrol (pursuit called off)
  remount() {
    if (!this.dismounted) return;
    this.dismounted = false;
    this.path = this.o.path || null;
    this.maxSpeed = this.o.speed ?? 2.2;
    this.fleeT = 0;
    if (this.human) this.human.root.visible = this.visible;
  }

  ground(x, z, from) {
    return this.game.collision.groundHeight(x, z, from + 3);
  }

  setVisible(v) {
    if (v === this.visible) return;
    this.visible = v;
    this.horse.root.visible = v;
    if (this.human) this.human.root.visible = v && !this.dismounted;
  }

  update(dt) {
    if (this.fleeT > 0) { this.fleeT -= dt; if (this.fleeT <= 0) this.maxSpeed = this.o.speed ?? 2.2; }
    const g = this.game;
    const p = g.player;
    let want = 0, face = null;
    const pd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (this.follow) {
      // led horse / companion: keep a spot behind the target
      const t = this.follow.target;
      const ty = t.yaw;
      const gx = t.pos.x - Math.sin(ty) * this.follow.back + Math.cos(ty) * this.follow.side;
      const gz = t.pos.z - Math.cos(ty) * this.follow.back - Math.sin(ty) * this.follow.side;
      const dx = gx - this.pos.x, dz = gz - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.6) { want = Math.min(this.maxSpeed, d * 1.2); face = Math.atan2(dx, dz); }
      else face = ty;
    } else if (this.path) {
      if (this.waitT > 0) this.waitT -= dt;
      else {
        const tgt = this.path[this.idx];
        // lateral offset lets two knights ride side by side
        const nxt = this.path[Math.min(this.path.length - 1, Math.max(0, this.idx + this.dir))];
        const ax = nxt.x - tgt.x, az = nxt.z - tgt.z, al = Math.hypot(ax, az) || 1;
        const gx = tgt.x + (az / al) * this.lateral, gz = tgt.z - (ax / al) * this.lateral;
        const dx = gx - this.pos.x, dz = gz - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.5) {
          if (this.o.loop) this.idx = (this.idx + 1) % this.path.length;
          else {
            if (this.idx + this.dir >= this.path.length || this.idx + this.dir < 0) { this.dir *= -1; this.waitT = this.o.pause ?? 6; }
            this.idx += this.dir;
          }
        } else { want = this.maxSpeed; face = Math.atan2(dx, dz); }
      }
      // courtesy: stop for the player standing in the way, greet once in a while
      if (pd < 4.5) {
        const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
        const ahead = (p.pos.x - this.pos.x) * fx + (p.pos.z - this.pos.z) * fz;
        if (ahead > 0) want = 0;
        if (this.human && this.greetT <= 0 && this.o.greet && g.mode === 'play') {
          this.greetT = 45;
          g.ui.notify(`<b>${this.name}:</b> «${this.o.greet[Math.floor(Math.random() * this.o.greet.length)]}»`);
        }
      }
    }
    this.greetT -= dt;
    this.speed = damp(this.speed, want, 2.5, dt);
    if (face !== null) this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-2.2 * dt));
    const mx = Math.sin(this.yaw) * this.speed * dt, mz = Math.cos(this.yaw) * this.speed * dt;
    this.pos.x += mx; this.pos.z += mz;
    this.pos.y = damp(this.pos.y, this.ground(this.pos.x, this.pos.z, this.pos.y), 10, dt);
    this.horse.update(dt, { speed: this.speed, graze: this.o.graze && this.speed < 0.1 });
    if (this.human) this.human.update(dt, { speed: this.speed, grounded: true, base: 'relaxed', ride: true, upperOnly: true });
    this.sync();
  }

  sync() {
    this.horse.root.position.copy(this.pos);
    this.horse.root.rotation.y = this.yaw;
    if (this.human) {
      const k = this.horse.o.scale;
      this.human.root.position.set(this.pos.x + Math.sin(this.yaw) * 0.18 * k, this.pos.y + this.horse.seatHeight + this.horse.bodyB.position.y - 1.2, this.pos.z + Math.cos(this.yaw) * 0.18 * k);
      this.human.root.rotation.y = this.yaw;
    }
  }
}
