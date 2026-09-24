// Particles (sparks, magic, petals, fireflies, fire, motes) and sword trails.
import * as THREE from 'three';

const VS = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  float a = smoothstep(1.0, uSoft, d);
  if (a <= 0.01) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
  #include <colorspace_fragment>
}`;

const FS_STAR = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float cross = max(exp(-abs(p.x) * 34.0) * exp(-abs(p.y) * 5.0), exp(-abs(p.y) * 34.0) * exp(-abs(p.x) * 5.0));
  vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.7071;
  float diag = max(exp(-abs(q.x) * 40.0) * exp(-abs(q.y) * 9.0), exp(-abs(q.y) * 40.0) * exp(-abs(q.x) * 9.0)) * 0.5;
  float core = exp(-d * d * 90.0);
  float a = max(max(cross, diag), core);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * (1.0 + core), a * vAlpha);
  #include <colorspace_fragment>
}`;

class ParticleSystem {
  constructor(scene, max, additive, star = false) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.flick = new Uint8Array(max);
    this.wob = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: star ? FS_STAR : FS,
      uniforms: { uScale: { value: 400 }, uSoft: { value: additive ? 0.0 : 0.6 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.t = 0;
  }

  emit(x, y, z, vx, vy, vz, color, size, life, opts = {}) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.life[i] = life; this.maxLife[i] = life;
    this.grav[i] = opts.grav ?? 0;
    this.drag[i] = opts.drag ?? 1.5;
    this.s0[i] = size; this.s1[i] = opts.sizeEnd ?? size * 0.2;
    this.a0[i] = opts.alpha ?? 1;
    this.flick[i] = opts.flicker ? 1 : 0;
    this.wob[i] = opts.wobble ?? 0;
  }

  update(dt) {
    this.t += dt;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap remove
        const j = --this.n;
        if (i !== j) this.copy(j, i);
        continue;
      }
      const k = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt; this.vel[k + 2] *= dr;
      if (this.wob[i]) {
        this.vel[k] += Math.sin(this.t * 2.3 + i) * this.wob[i] * dt;
        this.vel[k + 2] += Math.cos(this.t * 1.9 + i * 1.7) * this.wob[i] * dt;
      }
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      let a = this.a0[i] * Math.min(1, (1 - t) * 3) * Math.min(1, t * 8 + 0.2);
      if (this.flick[i]) a *= 0.5 + 0.5 * Math.sin(this.t * 6 + i * 3.1);
      this.alpha[i] = a;
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }

  copy(from, to) {
    for (let c = 0; c < 3; c++) {
      this.pos[to * 3 + c] = this.pos[from * 3 + c];
      this.vel[to * 3 + c] = this.vel[from * 3 + c];
      this.col[to * 3 + c] = this.col[from * 3 + c];
    }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
    this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from]; this.a0[to] = this.a0[from];
    this.size[to] = this.size[from]; this.alpha[to] = this.alpha[from];
    this.flick[to] = this.flick[from]; this.wob[to] = this.wob[from];
  }
}

const _c = new THREE.Color();
const R = () => Math.random() - 0.5;

export class Effects {
  constructor(scene, renderer) {
    this.glow = new ParticleSystem(scene, 4000, true);
    this.soft = new ParticleSystem(scene, 2500, false);
    this.stars = new ParticleSystem(scene, 1500, true, true);
    this.sparkleSources = [];
    this.waterGlint = null;
    this.trails = [];
    this.scene = scene;
    this.ambientT = 0;
    this.fireSources = [];
    this.setScale(renderer.domElement.height);
  }

  setScale(h) {
    this.glow.mat.uniforms.uScale.value = h * 0.9;
    this.soft.mat.uniforms.uScale.value = h * 0.9;
    this.stars.mat.uniforms.uScale.value = h * 0.9;
  }

  addSparkleSource(pos, radius = 1, rate = 3, color = '#ffffff', size = 0.5) {
    this.sparkleSources.push({ pos, radius, rate, color: new THREE.Color(color), size });
  }

  twinkle(p, color = '#ffffff', size = 0.6, life = 0.5) {
    _c.set(color);
    this.stars.emit(p.x, p.y, p.z, 0, 0.05, 0, _c, size, life, { drag: 1, sizeEnd: size * 0.2 });
  }

  sparks(p, color = '#fff2c0', n = 14, speed = 6) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      this.glow.emit(p.x, p.y, p.z, R() * speed, Math.random() * speed * 0.8, R() * speed, _c, 0.18 + Math.random() * 0.1, 0.3 + Math.random() * 0.3, { grav: 9, drag: 2 });
    }
  }

  burst(p, color = '#ffe6a0', n = 30, speed = 4, size = 0.35, life = 0.9) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.glow.emit(p.x, p.y, p.z, Math.cos(a) * s * Math.sqrt(1 - e * e), e * s, Math.sin(a) * s * Math.sqrt(1 - e * e), _c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), { drag: 2.5, grav: -0.5 });
    }
  }

  motes(p, color = '#fff0b0', n = 20, radius = 0.6, rise = 1.5, life = 1.6, size = 0.18) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      this.glow.emit(p.x + R() * radius * 2, p.y + Math.random() * 1.6, p.z + R() * radius * 2, R() * 0.4, rise * (0.5 + Math.random()), R() * 0.4, _c, size * (0.7 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.8), { drag: 0.5, wobble: 0.8 });
    }
  }

  dust(p, n = 10, color = '#d8ccb8') {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      this.soft.emit(p.x + R() * 0.6, p.y + 0.1, p.z + R() * 0.6, R() * 2, Math.random() * 1.2, R() * 2, _c, 0.6 + Math.random() * 0.5, 0.6 + Math.random() * 0.4, { drag: 3, sizeEnd: 1.4, alpha: 0.45 });
    }
  }

  smoke(p, color = '#6a4a8a', n = 12) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      this.soft.emit(p.x + R() * 0.8, p.y + Math.random() * 1.5, p.z + R() * 0.8, R() * 0.8, 1 + Math.random(), R() * 0.8, _c, 0.8, 1.3 + Math.random(), { drag: 1, sizeEnd: 2.2, alpha: 0.5 });
    }
  }

  levelUp(p) {
    _c.set('#ffe08a');
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.3;
      this.glow.emit(p.x + Math.cos(a) * r, p.y + Math.random() * 0.3, p.z + Math.sin(a) * r, 0, 3 + Math.random() * 4, 0, _c, 0.25, 1.4, { drag: 0.6 });
    }
  }

  // fire source registration (campfires, forge)
  addFire(pos, scale = 1) { this.fireSources.push({ pos, scale }); }

  addTrail(color) {
    const t = new Trail(this.scene, color);
    this.trails.push(t);
    return t;
  }

  update(dt, focus, env) {
    this.ambientT += dt;
    // fires
    const fc = new THREE.Color('#ffa24a'), fc2 = new THREE.Color('#ffdd88');
    for (const f of this.fireSources) {
      const dx = f.pos.x - focus.x, dz = f.pos.z - focus.z;
      if (dx * dx + dz * dz > 120 * 120) continue;
      for (let i = 0; i < 2; i++) {
        this.glow.emit(f.pos.x + R() * 0.5 * f.scale, f.pos.y + 0.2, f.pos.z + R() * 0.5 * f.scale, R() * 0.3, 1.6 + Math.random() * 1.2, R() * 0.3, Math.random() < 0.5 ? fc : fc2, 0.5 * f.scale, 0.5 + Math.random() * 0.4, { drag: 0.5, sizeEnd: 0.05 });
      }
      if (Math.random() < 0.08) this.glow.emit(f.pos.x, f.pos.y + 0.5, f.pos.z, R(), 2.5, R(), fc2, 0.08, 1.5, { drag: 0.3, wobble: 2 });
    }
    // ambient
    if (env) {
      const night = env.night;
      // petals drifting in meadows (day)
      if (!night && env.flowers > 0.3 && Math.random() < dt * 14 * env.flowers) {
        _c.set(Math.random() < 0.6 ? '#f7b6d2' : Math.random() < 0.5 ? '#ffffff' : '#d8c4f5');
        const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 22;
        this.soft.emit(focus.x + Math.cos(a) * d, focus.y + 1 + Math.random() * 5, focus.z + Math.sin(a) * d, 1.2 + Math.random(), -0.3, 0.6 + R(), _c, 0.16, 6, { drag: 0.2, wobble: 1.5, sizeEnd: 0.14, alpha: 0.95 });
      }
      // sunlit motes
      if (!night && Math.random() < dt * 6) {
        _c.set('#fff6d0');
        const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 15;
        this.glow.emit(focus.x + Math.cos(a) * d, focus.y + 0.5 + Math.random() * 4, focus.z + Math.sin(a) * d, R() * 0.2, 0.05, R() * 0.2, _c, 0.07, 5, { drag: 0.1, wobble: 0.3, sizeEnd: 0.07, alpha: 0.7 });
      }
      // fireflies at night
      if (night && env.wild && Math.random() < dt * 10) {
        _c.set(Math.random() < 0.7 ? '#e8ff9a' : '#9fe8ff');
        const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 25;
        this.glow.emit(focus.x + Math.cos(a) * d, focus.y + 0.3 + Math.random() * 3, focus.z + Math.sin(a) * d, R() * 0.5, R() * 0.3, R() * 0.5, _c, 0.22, 7, { drag: 0.2, wobble: 1.2, flicker: true, sizeEnd: 0.2 });
      }
      // gloom motes near the crag
      if (env.gloom > 0.1 && Math.random() < dt * 25 * env.gloom) {
        _c.set(Math.random() < 0.5 ? '#9b6bff' : '#5a3a8a');
        const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * 20;
        this.glow.emit(focus.x + Math.cos(a) * d, focus.y + Math.random() * 3, focus.z + Math.sin(a) * d, R() * 0.3, 0.4 + Math.random() * 0.5, R() * 0.3, _c, 0.15, 4, { drag: 0.2, wobble: 0.6 });
      }
    }
    // sparkles around crystals / gold / altars
    for (const src of this.sparkleSources) {
      const dx = src.pos.x - focus.x, dz = src.pos.z - focus.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 260 * 260) continue;
      if (Math.random() < dt * src.rate) {
        const r = src.radius;
        this.stars.emit(src.pos.x + R() * r * 2, src.pos.y + R() * r * 2, src.pos.z + R() * r * 2, 0, 0.1, 0, src.color, src.size * (0.6 + Math.random() * 0.8), 0.35 + Math.random() * 0.5, { drag: 1, sizeEnd: 0.05 });
      }
    }
    if (env) {
      // daylight glints floating in the air
      if (!env.night && Math.random() < dt * 5) {
        _c.set(Math.random() < 0.5 ? '#fff8e0' : '#ffe6f4');
        const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 18;
        this.stars.emit(focus.x + Math.cos(a) * d, focus.y + 0.6 + Math.random() * 3.5, focus.z + Math.sin(a) * d, R() * 0.1, 0.05, R() * 0.1, _c, 0.25 + Math.random() * 0.25, 0.4 + Math.random() * 0.6, { drag: 0.5, sizeEnd: 0.02 });
      }
      // water glitter near the player when the sun is up
      if (!env.night && this.waterGlint && env.sunUp > 0.05) {
        const wg = this.waterGlint;
        for (let k = 0; k < 3; k++) {
          if (Math.random() > dt * 40) continue;
          const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 70;
          const x = focus.x + Math.cos(a) * d, z = focus.z + Math.sin(a) * d;
          if (!wg.isWater(x, z)) continue;
          _c.set('#fffaf0');
          this.stars.emit(x, wg.level + 0.05, z, 0, 0, 0, _c, 0.3 + Math.random() * 0.5, 0.15 + Math.random() * 0.25, { drag: 1, sizeEnd: 0.02 });
        }
      }
    }
    this.glow.update(dt);
    this.soft.update(dt);
    this.stars.update(dt);
    for (const t of this.trails) t.update(dt);
  }
}

// Ribbon trail following a blade
export class Trail {
  constructor(scene, color = '#ffffff', segs = 18) {
    this.segs = segs;
    this.base = [];
    this.tip = [];
    this.age = [];
    const g = new THREE.BufferGeometry();
    this.posArr = new Float32Array(segs * 2 * 3);
    this.alphaArr = new Float32Array(segs * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphaArr, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < segs - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); \n#include <colorspace_fragment>\n }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
    this.active = false;
    this.intensity = 0.7;
  }

  setColor(c) { this.mat.uniforms.uColor.value.set(c); }

  push(b, t) {
    if (!this.active) return;
    this.base.unshift(b.clone());
    this.tip.unshift(t.clone());
    this.age.unshift(0);
    if (this.base.length > this.segs) { this.base.pop(); this.tip.pop(); this.age.pop(); }
  }

  update(dt) {
    for (let i = 0; i < this.age.length; i++) this.age[i] += dt;
    while (this.age.length && this.age[this.age.length - 1] > 0.18) { this.base.pop(); this.tip.pop(); this.age.pop(); }
    const n = this.base.length;
    for (let i = 0; i < this.segs; i++) {
      const k = Math.min(i, n - 1);
      if (n === 0) { this.alphaArr[i * 2] = this.alphaArr[i * 2 + 1] = 0; continue; }
      const b = this.base[k], t = this.tip[k];
      this.posArr[i * 6] = b.x; this.posArr[i * 6 + 1] = b.y; this.posArr[i * 6 + 2] = b.z;
      this.posArr[i * 6 + 3] = t.x; this.posArr[i * 6 + 4] = t.y; this.posArr[i * 6 + 5] = t.z;
      const a = i < n ? (1 - i / this.segs) * (1 - this.age[k] / 0.18) * this.intensity : 0;
      this.alphaArr[i * 2] = a * 0.15;
      this.alphaArr[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
  }
}
