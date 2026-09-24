// River ribbon, cascade foam, spring pool, mist — flows from the castle plateau to the lake.
import * as THREE from 'three';
import { RIVER_POINTS } from './terrain.js';
import { RIVER } from './layout.js';
import { waterNormalTexture } from './textures.js';

function foamTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 256);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 64, w = 1 + Math.random() * 4, y = Math.random() * 256, h = 30 + Math.random() * 120;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${0.35 + Math.random() * 0.5})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x, y - 256, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class River {
  constructor(scene, terrain, effects, builder) {
    this.effects = effects;
    const pts = RIVER_POINTS;
    const W = RIVER.width;
    // dense resample along the path
    const samples = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(2, Math.ceil(len / 1.5));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.w + (b.w - a.w) * t, cascade: i === 3 });
      }
    }
    const last = pts[pts.length - 1];
    samples.push({ x: last.x, z: last.z, y: last.w, cascade: false });
    const pos = [], uv = [], idx = [];
    let dist = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const p = samples[Math.max(0, i - 1)], q = samples[Math.min(samples.length - 1, i + 1)];
      const tx = q.x - p.x, tz = q.z - p.z;
      const tl = Math.hypot(tx, tz) || 1;
      const nx = -tz / tl, nz = tx / tl;
      const w = (i < 8 ? 5 : W) * 0.5 + 0.8;
      if (i > 0) dist += Math.hypot(s.x - samples[i - 1].x, s.z - samples[i - 1].z) + Math.abs(s.y - samples[i - 1].y);
      pos.push(s.x + nx * w, s.y, s.z + nz * w, s.x - nx * w, s.y, s.z - nz * w);
      uv.push(0, dist / 7, 1, dist / 7);
      if (i < samples.length - 1) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = waterNormalTexture();
    n.repeat.set(1, 1);
    this.normal = n;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x6cc4de, roughness: 0.12, metalness: 0.02, envMapIntensity: 0.6, transparent: true, opacity: 0.78, normalMap: n, normalScale: new THREE.Vector2(0.45, 0.45), depthWrite: false });
    const mesh = new THREE.Mesh(g, this.mat);
    mesh.renderOrder = 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // cascade foam sheet (over the steep segment)
    const ca = pts[3], cb = pts[4];
    const foamTex = foamTexture();
    this.foamTex = foamTex;
    const fmat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, color: 0xf4fbff });
    const fg = new THREE.PlaneGeometry(6, 1, 1, 8);
    const fp = fg.attributes.position;
    const dx = cb.x - ca.x, dz = cb.z - ca.z, dy = cb.w - ca.w;
    const L = Math.hypot(dx, dz);
    for (let i = 0; i < fp.count; i++) {
      const t = fp.getY(i) + 0.5; // 0 bottom .. 1 top
      const k = 1 - t;
      const bulge = Math.sin(k * Math.PI) * 0.8;
      fp.setXYZ(i, fp.getX(i), 0, 0);
      fp.setY(i, ca.w + dy * k + 0.25 + bulge * 0.3);
      fp.setZ(i, k * L + bulge);
    }
    fg.computeVertexNormals();
    const foam = new THREE.Mesh(fg, fmat);
    foam.position.set(ca.x, 0, ca.z);
    foam.rotation.y = Math.atan2(dx, dz);
    foam.renderOrder = 3;
    scene.add(foam);
    this.foamTex.repeat.set(1, 1.2);
    // spring & plunge pools
    const pool = (x, z, y, r) => {
      const d = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), this.mat);
      d.position.set(x, y + 0.02, z);
      d.renderOrder = 2;
      scene.add(d);
    };
    pool(pts[0].x - 2, pts[0].z, pts[0].w, 5.5);
    pool(cb.x + 1, cb.z + 1, cb.w, 6.5);
    this.mistAt = new THREE.Vector3(cb.x, cb.w + 0.3, cb.z);
    this.topAt = new THREE.Vector3(ca.x, ca.w, ca.z);
    // rocks along the spring pool and the plunge pool
    if (builder) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = 6.2 + (i % 3) * 0.4;
        const x = pts[0].x - 2 + Math.cos(a) * r, z = pts[0].z + Math.sin(a) * r;
        if (Math.cos(a) > 0.6) continue;
        builder.sphere('stone', x, terrain.getHeight(x, z) + 0.1, z, 0.6 + (i % 4) * 0.25, { color: new THREE.Color('#dcd6e2'), sy: 0.6 });
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = cb.x + 1 + Math.cos(a) * 7.2, z = cb.z + 1 + Math.sin(a) * 7.2;
        builder.sphere('stone', x, terrain.getHeight(x, z), z, 0.8 + (i % 3) * 0.4, { color: new THREE.Color('#cfc8d6'), sy: 0.7 });
      }
    }
    this.samples = samples;
  }

  // distance to the waterfall (for ambient sound)
  distTo(p) { return Math.min(p.distanceTo(this.mistAt), p.distanceTo(this.topAt)); }

  update(dt, t, focus) {
    this.normal.offset.y = (this.normal.offset.y - dt * 0.35) % 1;
    this.foamTex.offset.y = (this.foamTex.offset.y + dt * 1.6) % 1;
    const d = focus.distanceTo(this.mistAt);
    if (d < 220) {
      if (Math.random() < dt * 12) this.effects.smoke(this.mistAt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)), '#f4fbff', 1);
      if (Math.random() < dt * 6) this.effects.twinkle(this.mistAt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 3, (Math.random() - 0.5) * 8)), '#ffffff', 0.5, 0.4);
    }
  }
}

// Decorative cascades down the mountain faces (follow the terrain surface downhill)
export class MountainFalls {
  constructor(scene, terrain) {
    const tex = foamTexture();
    tex.repeat.set(1, 4);
    this.tex = tex;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false, color: 0xf2f8ff, side: THREE.DoubleSide, fog: true });
    const angles = [0.35, 1.3, 2.2, 3.4, 4.3, 5.35];
    for (const a of angles) {
      // find a high start point on the ring along this bearing
      let best = null;
      for (let r = 600; r < 900; r += 8) {
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = terrain.getHeight(x, z);
        if (!best || h > best.h) best = { x, z, h };
        if (h > 170) break;
      }
      if (!best || best.h < 90) continue;
      // walk downhill
      const path = [];
      let x = best.x, z = best.z;
      for (let i = 0; i < 90; i++) {
        const h = terrain.getHeight(x, z);
        path.push({ x, y: h + 0.6, z });
        const n = terrain.getNormal(x, z);
        const gl = Math.hypot(n.x, n.z) || 1;
        x += (n.x / gl) * 3; z += (n.z / gl) * 3;
        if (h < 25) break;
      }
      if (path.length < 8) continue;
      const pos = [], uv = [], idx = [];
      let dist = 0;
      path.forEach((p, i) => {
        const q = path[Math.min(path.length - 1, i + 1)], o = path[Math.max(0, i - 1)];
        const tx = q.x - o.x, tz = q.z - o.z, tl = Math.hypot(tx, tz) || 1;
        const w = 1.5 + i * 0.05;
        if (i > 0) dist += Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y, p.z - path[i - 1].z);
        pos.push(p.x - (tz / tl) * w, p.y, p.z + (tx / tl) * w, p.x + (tz / tl) * w, p.y, p.z - (tx / tl) * w);
        uv.push(0, dist / 20, 1, dist / 20);
        if (i < path.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = 3;
      scene.add(m);
    }
  }

  update(dt) { this.tex.offset.y = (this.tex.offset.y + dt * 0.9) % 1; }
}
