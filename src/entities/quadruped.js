// Procedural four-legged creatures: deer, wolf, rabbit, boar, fox, unicorn.
import * as THREE from 'three';
import { RigBuilder, PRIM, capsule } from './rig.js';
import { damp } from '../engine/noise.js';


export const SPECIES = {
  deer: { len: 1.15, h: 0.95, leg: 0.9, legR: 0.05, body: 0xd0976a, belly: 0xf6e6d2, neck: 0.55, head: 0.16, ears: 'deer', tail: 'short', antlers: true },
  wolf: { len: 1.0, h: 0.72, leg: 0.62, legR: 0.06, body: 0x8c8698, belly: 0xd8d4e0, neck: 0.3, head: 0.17, ears: 'pointy', tail: 'bushy', snout: 0.2 },
  darkwolf: { len: 1.1, h: 0.8, leg: 0.66, legR: 0.07, body: 0x4d4460, belly: 0x7a6e90, neck: 0.3, head: 0.18, ears: 'pointy', tail: 'bushy', snout: 0.22, eyes: 0xc07bff },
  rabbit: { len: 0.32, h: 0.22, leg: 0.18, legR: 0.035, body: 0xeee4d8, belly: 0xffffff, neck: 0.06, head: 0.1, ears: 'rabbit', tail: 'puff' },
  boar: { len: 1.0, h: 0.62, leg: 0.42, legR: 0.07, body: 0x6e5244, belly: 0x8a6a58, neck: 0.12, head: 0.22, ears: 'small', tail: 'thin', tusks: true, snout: 0.22 },
  fox: { len: 0.7, h: 0.45, leg: 0.4, legR: 0.04, body: 0xe8894a, belly: 0xfff3e6, neck: 0.18, head: 0.12, ears: 'pointy', tail: 'bushy', snout: 0.14 },
  cat: { len: 0.42, h: 0.26, leg: 0.22, legR: 0.03, body: 0xfaf6f2, belly: 0xffffff, neck: 0.08, head: 0.11, ears: 'pointy', tail: 'bushy', snout: 0.05 },
  unicorn: { len: 1.7, h: 1.45, leg: 1.2, legR: 0.08, body: 0xfaf7ff, belly: 0xffffff, neck: 0.85, head: 0.24, ears: 'horse', tail: 'mane', horn: true, mane: true },
};

export class Quadruped {
  constructor(species, opts = {}) {
    const S = { ...SPECIES[species], ...opts };
    this.S = S;
    this.species = species;
    this.root = new THREE.Group();
    const R = new RigBuilder();
    const L = S.len;
    const bw = S.len * (species === 'boar' ? 0.34 : species === 'rabbit' ? 0.42 : 0.26);
    const base = R.bone('base', null, 0, 0, 0);
    const torso = R.bone('torso', base, 0, S.leg + S.h * 0.18, 0);
    const neck = R.bone('neck', torso, 0, bw * 0.4, L * 0.48);
    const head = R.bone('head', neck, 0, S.neck, 0);
    const tail = R.bone('tail', torso, 0, bw * 0.3, -L * 0.5);
    const bodyC = S.body, bellyC = S.belly;
    const SP = PRIM.sphere, CO = PRIM.cone;
    R.part(torso, capsule(bw, L * 0.8), bodyC, { rx: Math.PI / 2 });
    R.part(torso, SP, bellyC, { y: -bw * 0.45, sx: bw * 0.8, sy: bw * 0.6, sz: L * 0.45 });
    if (S.neck > 0.1) R.part(neck, capsule(bw * 0.55, S.neck), bodyC, { y: S.neck * 0.5 });
    const hr = S.head;
    R.part(head, SP, bodyC, { sx: hr * 0.85, sy: hr * 0.85, sz: hr * 1.1 });
    const snoutL = S.snout || hr * 1.1;
    R.part(head, capsule(hr * 0.45, snoutL), bodyC, { y: -hr * 0.2, z: hr * 0.7, rx: Math.PI / 2 });
    R.part(head, PRIM.sphereLo, 0x2a2226, { y: -hr * 0.18, z: hr * 0.8 + snoutL * 0.55, sx: hr * 0.18, sy: hr * 0.14, sz: hr * 0.12 });
    for (const s of [-1, 1]) R.part(head, PRIM.sphereLo, S.eyes || 0x1a1418, { x: s * hr * 0.6, y: hr * 0.2, z: hr * 0.45, sx: hr * 0.13, sy: hr * 0.13, sz: hr * 0.1 }, S.eyes ? 'glow' : 'matte');
    for (const s of [-1, 1]) {
      if (S.ears === 'rabbit') R.part(head, capsule(hr * 0.22, hr * 2.2), bodyC, { x: s * hr * 0.35, y: hr * 1.5, z: -hr * 0.2, sz: 0.5, rz: -s * 0.2 });
      else if (S.ears === 'pointy') R.part(head, CO, bodyC, { x: s * hr * 0.5, y: hr * 0.85, z: -hr * 0.2, sx: hr * 0.3, sy: hr * 0.7, sz: hr * 0.15, rz: -s * 0.25 });
      else if (S.ears === 'deer') R.part(head, SP, bodyC, { x: s * hr * 0.85, y: hr * 0.55, z: -hr * 0.3, sx: hr * 0.45, sy: hr * 0.2, sz: hr * 0.12, rz: -s * 0.5 });
      else if (S.ears === 'horse') R.part(head, CO, bodyC, { x: s * hr * 0.4, y: hr * 0.95, z: -hr * 0.4, sx: hr * 0.18, sy: hr * 0.5, sz: hr * 0.12 });
      else R.part(head, SP, bodyC, { x: s * hr * 0.6, y: hr * 0.7, z: -hr * 0.2, sx: hr * 0.25, sy: hr * 0.3, sz: hr * 0.1 });
    }
    if (S.antlers) {
      for (const s of [-1, 1]) {
        const ax = s * hr * 0.35, ay = hr * 0.8, az = -hr * 0.2;
        R.part(head, capsule(0.02, 0.4), 0xf2e3c6, { x: ax + s * 0.08, y: ay + 0.18, z: az, rz: -s * 0.4 });
        R.part(head, capsule(0.016, 0.2), 0xf2e3c6, { x: ax + s * 0.2, y: ay + 0.3, z: az + 0.05, rz: -s * 1.1 });
        R.part(head, capsule(0.016, 0.18), 0xf2e3c6, { x: ax + s * 0.14, y: ay + 0.4, z: az - 0.08, rx: -0.6, rz: -s * 0.4 });
      }
    }
    if (S.horn) R.part(head, CO, 0xf6d27a, { y: hr * 0.9, z: hr * 0.55, sx: hr * 0.14, sy: hr * 1.6, sz: hr * 0.14, rx: 0.6 }, 'glow');
    if (S.tusks) for (const s of [-1, 1]) R.part(head, CO, 0xfff6e0, { x: s * hr * 0.35, y: -hr * 0.2, z: hr * 1.2, sx: hr * 0.06, sy: hr * 0.35, sz: hr * 0.06, rx: -0.6 });
    if (S.mane) {
      const cols = [0xffb3d9, 0xd2b8ff, 0xa8d8ff, 0xffe3a8];
      for (let i = 0; i < 7; i++) R.part(neck, SP, cols[i % 4], { y: S.neck * (0.15 + i * 0.13), z: -bw * 0.45, sx: 0.07, sy: 0.14, sz: 0.1 });
      R.part(head, SP, cols[0], { y: hr * 0.8, z: -hr * 0.1, sx: 0.08, sy: 0.08, sz: 0.14 });
    }
    if (S.tail === 'bushy') R.part(tail, capsule(bw * 0.35, L * 0.4), bodyC, { y: -L * 0.2, z: -L * 0.1, rx: 0.9 });
    else if (S.tail === 'puff') R.part(tail, SP, bellyC, { z: -0.02, sx: 0.06, sy: 0.06, sz: 0.06 });
    else if (S.tail === 'mane') {
      const cols = [0xffb3d9, 0xd2b8ff, 0xa8d8ff];
      for (let i = 0; i < 5; i++) R.part(tail, SP, cols[i % 3], { y: -0.1 - i * 0.14, z: -0.08 - i * 0.04, sx: 0.09, sy: 0.14, sz: 0.09 });
    } else if (S.tail === 'short') R.part(tail, SP, bellyC, { sx: 0.06, sy: 0.1, sz: 0.05 });
    else R.part(tail, capsule(0.015, 0.25), bodyC, { y: -0.15, z: -0.05, rx: 0.4 });
    this.legs = [];
    const lx = bw * 0.62, lzF = L * 0.36, lzB = -L * 0.36;
    for (const [x, z, front] of [[lx, lzF, 1], [-lx, lzF, 1], [lx, lzB, 0], [-lx, lzB, 0]]) {
      const hip = R.bone('hip', torso, x, -bw * 0.2, z);
      const up = S.leg * 0.5;
      const knee = R.bone('knee', hip, 0, -up, 0);
      R.part(hip, capsule(S.legR * (front ? 1.1 : 1.4), up), bodyC, { y: -up * 0.5 });
      R.part(knee, capsule(S.legR * 0.8, up * 0.9), bodyC, { y: -up * 0.5 });
      R.part(knee, PRIM.sphereLo, species === 'unicorn' ? 0xf0c860 : 0x3a302c, { y: -up - 0.02, z: 0.01, sx: S.legR * 1.1, sy: S.legR * 0.8, sz: S.legR * 1.3 }, species === 'unicorn' ? 'metal' : 'matte');
      this.legs.push({ hip, knee, front, side: x > 0 ? 1 : -1 });
    }
    const built = R.build();
    for (const m of built.meshes) {
      m.boundingSphere.center.set(0, S.leg, 0);
      m.boundingSphere.radius = Math.max(1, S.len * 1.2);
      this.root.add(m);
    }
    this.body = base;
    this.torso = torso;
    this.neck = neck; this.head = head; this.tail = tail;
    neck.rotation.x = -0.6;
    head.rotation.x = 0.9;
    this.phase = Math.random() * 6;
    this.t = Math.random() * 10;
    this.graze = 0;
    this.attackT = -1;
    this.deadT = -1;
    this.torsoBaseY = torso.position.y;
  }

  bite() { this.attackT = 0; }

  update(dt, st) {
    this.t += dt;
    const sp = st.speed || 0;
    const S = this.S;
    const stride = S.leg * 2.4;
    this.phase += dt * (sp / Math.max(0.2, stride)) * Math.PI * 2 * 0.8;
    const gallop = sp > S.leg * 7;
    let bob = 0;
    for (const L of this.legs) {
      let ph = this.phase + (L.front ? 0 : Math.PI) + (L.side > 0 ? 0 : gallop ? 0.6 : Math.PI);
      if (!gallop) ph = this.phase + ((L.front ? 1 : 0) ^ (L.side > 0 ? 1 : 0) ? Math.PI : 0);
      const s = Math.sin(ph);
      const amp = sp > 0.1 ? Math.min(0.75, 0.25 + sp * 0.05) : 0;
      L.hip.rotation.x = damp(L.hip.rotation.x, s * amp, 14, dt);
      const kb = sp > 0.1 ? Math.max(0, Math.cos(ph)) * amp * 1.3 : 0;
      L.knee.rotation.x = damp(L.knee.rotation.x, L.front ? -kb * 0.2 + kb : -kb, 14, dt);
      bob += Math.abs(Math.cos(ph));
    }
    // grazing idle
    if (st.graze) this.graze = damp(this.graze, 1, 2, dt); else this.graze = damp(this.graze, 0, 5, dt);
    const alert = st.alert ? 1 : 0;
    this.neck.rotation.x = -0.6 + this.graze * 1.5 - alert * 0.2 + Math.sin(this.t * 1.5) * 0.03;
    this.head.rotation.x = 0.9 - this.graze * 0.3;
    this.tail.rotation.x = Math.sin(this.t * (sp > 1 ? 10 : 2)) * 0.15;
    this.tail.rotation.z = Math.sin(this.t * 3) * 0.2;
    this.torso.position.y = this.torsoBaseY + (sp > 0.1 ? (bob / 4) * 0.04 * S.leg : Math.sin(this.t * 2) * 0.004);
    this.torso.rotation.x = gallop ? Math.sin(this.phase * 2) * 0.05 : 0;
    // bite / charge attack
    if (this.attackT >= 0) {
      this.attackT += dt / 0.45;
      const a = Math.sin(Math.min(1, this.attackT) * Math.PI);
      this.neck.rotation.x = -0.6 + a * 0.55;
      this.torso.rotation.x = -a * 0.15;
      if (this.attackT >= 1) this.attackT = -1;
    }
    if (st.rear) {
      this.torso.rotation.x = -0.6;
      this.legs[0].hip.rotation.x = this.legs[1].hip.rotation.x = -1.0;
    }
    if (st.dead) {
      this.deadT = Math.min(1, (st.deathT || 0) / 0.6);
      this.body.rotation.z = this.deadT * Math.PI / 2;
      this.body.position.y = this.deadT * S.len * 0.18;
    } else {
      this.body.rotation.z = 0;
      this.body.position.y = 0;
    }
  }
}
