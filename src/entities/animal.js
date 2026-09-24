// Passive wildlife (deer, rabbits, foxes) + ambient birds and butterflies.
import * as THREE from 'three';
import { Quadruped } from './quadruped.js';
import { Motor } from '../engine/collision.js';
import { angleLerp, damp } from '../engine/noise.js';
import { WORLD } from '../world/layout.js';
import { Builder } from '../world/builder.js';

const ANIMALS = {
  deer: { name: 'Олень', hp: 30, walk: 1.6, run: 11, flee: 16, radius: 0.5, height: 1.4, loot: [['raw_meat', 1, 2], ['deer_hide', 0.8, 1]], xp: 6 },
  rabbit: { name: 'Кролик', hp: 8, walk: 1.2, run: 8, flee: 7, radius: 0.25, height: 0.4, loot: [['raw_meat', 0.6, 1], ['rabbit_fur', 0.8, 1]], xp: 2 },
  sheep: { name: 'Овца', hp: 18, walk: 0.8, run: 5.5, flee: 4, radius: 0.4, height: 0.9, loot: [['raw_meat', 1, 1]], xp: 1, owned: 'Марта', wander: 10 },
  cow: { name: 'Корова', hp: 40, walk: 0.6, run: 3.5, flee: 2.5, radius: 0.6, height: 1.4, loot: [['raw_meat', 1, 2]], xp: 1, owned: 'Марта', wander: 12 },
  squirrel: { name: 'Белка', hp: 4, walk: 1.6, run: 7, flee: 9, radius: 0.15, height: 0.25, loot: [], xp: 1 },
  fox: { name: 'Лиса', hp: 16, walk: 1.5, run: 9, flee: 10, radius: 0.35, height: 0.6, loot: [['raw_meat', 0.5, 1], ['rabbit_fur', 0.5, 1]], xp: 4 },
};

export class Animal {
  constructor(game, species, pos) {
    this.game = game;
    this.species = species;
    this.A = ANIMALS[species];
    this.name = this.A.name;
    this.home = pos.clone();
    this.pos = pos.clone();
    this.yaw = Math.random() * Math.PI * 2;
    this.radius = this.A.radius;
    this.height = this.A.height;
    this.hp = this.A.hp;
    this.maxHp = this.A.hp;
    this.alive = true;
    this.body = new Quadruped(species);
    game.scene.add(this.body.root);
    this.motor = new Motor(game.collision, { radius: this.radius, height: this.height, canSwim: false });
    this.state = 'graze';
    this.t = Math.random() * 5;
    this.target = null;
    this.speed = 0;
    this.deathT = 0;
    this.fleeT = 0;
    this.passive = true;
    this.syncBody();
  }

  update(dt) {
    const g = this.game;
    if (!this.alive) {
      this.deathT += dt;
      this.body.update(dt, { dead: true, deathT: this.deathT });
      if (this.deathT > 6) this.body.root.visible = false;
      return;
    }
    const p = g.player;
    const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    this.t -= dt;
    let speed = 0, face = null, mx = 0, mz = 0;
    const fleeR = this.A.flee * (p.sprinting || p.mount ? 1.5 : 1) * (p.state === 'attack' ? 1.4 : 1);
    if (d < fleeR && p.state !== 'dead') this.fleeT = 3 + Math.random() * 2;
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      mx = dx / (d || 1); mz = dz / (d || 1);
      // slight curve
      const c = Math.sin(this.t * 2) * 0.4;
      const rx = mx * Math.cos(c) - mz * Math.sin(c), rz = mx * Math.sin(c) + mz * Math.cos(c);
      mx = rx; mz = rz;
      speed = this.A.run;
      face = Math.atan2(mx, mz);
    } else {
      if (this.t <= 0) {
        this.t = 2 + Math.random() * 6;
        if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * (this.A.wander || 14);
          this.target = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
        } else this.target = null;
      }
      if (this.target) {
        const tx = this.target.x - this.pos.x, tz = this.target.z - this.pos.z;
        const td = Math.hypot(tx, tz);
        if (td > 0.6) { mx = tx / td; mz = tz / td; speed = this.A.walk; face = Math.atan2(tx, tz); } else this.target = null;
      }
    }
    if (speed > 0) {
      const nx = this.pos.x + mx * speed * dt, nz = this.pos.z + mz * speed * dt;
      if (g.terrain.getHeight(nx, nz) < WORLD.water + 0.2) { speed = 0; this.target = null; }
    }
    if (face !== null) this.yaw = angleLerp(this.yaw, face, 1 - Math.exp(-8 * dt));
    this.motor.move(this.pos, mx * speed, mz * speed, dt);
    this.speed = damp(this.speed, speed, 8, dt);
    this.body.update(dt, { speed: this.speed, graze: !this.target && this.fleeT <= 0, alert: this.fleeT > 0 });
    this.syncBody();
  }

  syncBody() {
    this.body.root.position.copy(this.pos);
    this.body.root.rotation.y = this.yaw;
  }

  takeHit(dmg) {
    if (!this.alive) return null;
    this.hp -= dmg;
    this.game.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + this.height + 0.2, this.pos.z), dmg, 'enemy');
    this.fleeT = 5;
    if (this.hp <= 0) {
      this.alive = false;
      this.deathT = 0;
      this.game.onAnimalKilled(this);
      return { killed: true };
    }
    return { hit: true };
  }

  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.pos.copy(this.home);
    this.body.root.visible = true;
    this.deathT = 0;
    this.fleeT = 0;
  }
}

// ---------------- ambient birds ----------------
const WING = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.15, 0, 0, -0.15, 0.6, 0, 0], 3));
  g.computeVertexNormals();
  return g;
})();

export class BirdFlock {
  constructor(scene, center, count = 7, color = 0xffffff) {
    this.center = center.clone();
    this.birds = [];
    this.group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.25, 2, 6), mat);
      body.rotation.x = Math.PI / 2;
      const wl = new THREE.Mesh(WING, mat), wr = new THREE.Mesh(WING, mat);
      wr.scale.x = -1;
      b.add(body, wl, wr);
      b.userData = { wl, wr, a: Math.random() * Math.PI * 2, r: 20 + Math.random() * 25, h: 25 + Math.random() * 20, s: 0.25 + Math.random() * 0.15, ph: Math.random() * 6 };
      this.group.add(b);
      this.birds.push(b);
    }
    scene.add(this.group);
  }

  update(dt, t) {
    for (const b of this.birds) {
      const u = b.userData;
      u.a += dt * u.s;
      const x = this.center.x + Math.cos(u.a) * u.r, z = this.center.z + Math.sin(u.a) * u.r;
      const y = this.center.y + u.h + Math.sin(t * 0.7 + u.ph) * 3;
      b.position.set(x, y, z);
      b.rotation.y = -u.a;
      const flap = Math.sin(t * 9 + u.ph) * 0.7;
      u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
    }
  }
}

// ---------------- butterflies (instanced quads) ----------------
export class Butterflies {
  constructor(scene, count = 40) {
    this.count = count;
    const g = new THREE.PlaneGeometry(0.22, 0.16);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.95, fog: true });
    this.left = new THREE.InstancedMesh(g, mat, count);
    this.right = new THREE.InstancedMesh(g, mat, count);
    this.left.frustumCulled = this.right.frustumCulled = false;
    const cols = ['#ffd3ec', '#fff3a8', '#c7b2ff', '#a9dcff', '#ffffff', '#ffb38a'];
    this.data = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.set(cols[i % cols.length]);
      this.left.setColorAt(i, c); this.right.setColorAt(i, c);
      this.data.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), ph: Math.random() * 6, life: 0 });
    }
    scene.add(this.left, this.right);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.s = new THREE.Vector3(1, 1, 1);
    this.off = new THREE.Vector3();
  }

  update(dt, t, focus, terrain, active) {
    for (let i = 0; i < this.count; i++) {
      const d = this.data[i];
      d.life -= dt;
      const dx = d.p.x - focus.x, dz = d.p.z - focus.z;
      if (d.life <= 0 || dx * dx + dz * dz > 45 * 45) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 30;
        d.p.set(focus.x + Math.cos(a) * r, 0, focus.z + Math.sin(a) * r);
        d.p.y = terrain.getHeight(d.p.x, d.p.z) + 0.6 + Math.random() * 1.2;
        d.life = 10 + Math.random() * 10;
      }
      d.v.x += (Math.sin(t * 0.9 + d.ph * 3) * 1.2 - d.v.x) * dt;
      d.v.z += (Math.cos(t * 0.7 + d.ph * 2) * 1.2 - d.v.z) * dt;
      d.p.x += d.v.x * dt; d.p.z += d.v.z * dt;
      const gy = terrain.getHeight(d.p.x, d.p.z) + 0.5 + Math.sin(t * 2 + d.ph) * 0.3 + 0.5;
      d.p.y += (gy - d.p.y) * dt;
      const flap = Math.sin(t * 18 + d.ph) * 1.1;
      const yaw = Math.atan2(d.v.x, d.v.z);
      const sc = active ? 1 : 0;
      this.s.setScalar(sc);
      for (const [mesh, sgn] of [[this.left, 1], [this.right, -1]]) {
        this.e.set(0, yaw, 0);
        this.q.setFromEuler(this.e);
        const wing = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, sgn * flap));
        this.q.multiply(wing);
        this.off.set(sgn * 0.1, 0, 0).applyQuaternion(this.q);
        this.m.compose(this.off.add(d.p), this.q, this.s);
        mesh.setMatrixAt(i, this.m);
      }
    }
    this.left.instanceMatrix.needsUpdate = true;
    this.right.instanceMatrix.needsUpdate = true;
  }
}

// ---------------- swans gliding on the lake ----------------
export class Swans {
  constructor(scene, center, n, radius, waterY) {
    this.list = [];
    for (let i = 0; i < n; i++) {
      const B = new Builder(null);
      const W = new THREE.Color('#ffffff'), O = new THREE.Color('#f08a3a'), K = new THREE.Color('#1a1a22');
      const u = { worldUV: false, ao: false };
      B.add('plain', new THREE.SphereGeometry(1, 28, 20), 0, 0.12, 0, 0, 0, 0, 0.26, 0.17, 0.42, { ...u, color: W });
      B.add('plain', new THREE.SphereGeometry(1, 24, 16), 0, 0.22, -0.18, -0.4, 0, 0, 0.2, 0.1, 0.26, { ...u, color: W }); // folded wings / tail
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.18, 0.3), new THREE.Vector3(0, 0.42, 0.36), new THREE.Vector3(0, 0.66, 0.28), new THREE.Vector3(0, 0.74, 0.36)]);
      B.add('plain', new THREE.TubeGeometry(curve, 12, 0.045, 7), 0, 0, 0, 0, 0, 0, 1, 1, 1, { ...u, color: W });
      B.add('plain', new THREE.SphereGeometry(1, 20, 16), 0, 0.76, 0.38, 0, 0, 0, 0.06, 0.055, 0.08, { ...u, color: W });
      B.add('plain', new THREE.ConeGeometry(1, 1, 16), 0, 0.745, 0.49, Math.PI / 2, 0, 0, 0.025, 0.1, 0.02, { ...u, color: O });
      B.add('plain', new THREE.SphereGeometry(1, 12, 4), 0, 0.765, 0.43, 0, 0, 0, 0.03, 0.028, 0.03, { ...u, color: K });
      const g = B.build();
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(g);
      this.list.push({ g, a: (i / n) * Math.PI * 2, r: radius * (0.6 + Math.random() * 0.4), sp: 0.03 + Math.random() * 0.03, ph: Math.random() * 6 });
    }
    this.center = center; this.waterY = waterY; this.t = 0;
  }
  update(dt, focus) {
    this.t += dt;
    const far = Math.abs(focus.x - this.center.x) + Math.abs(focus.z - this.center.z) > 420;
    for (const s of this.list) {
      s.g.visible = !far;
      if (far) continue;
      s.a += dt * s.sp;
      const x = this.center.x + Math.cos(s.a) * s.r, z = this.center.z + Math.sin(s.a) * s.r * 0.8;
      s.g.position.set(x, this.waterY - 0.04 + Math.sin(this.t * 1.3 + s.ph) * 0.02, z);
      s.g.rotation.y = Math.atan2(-Math.sin(s.a), Math.cos(s.a) * 0.8);
    }
  }
}
