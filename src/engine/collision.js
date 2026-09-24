// Lightweight collision world: oriented boxes, cylinders, ramps (solid wedges)
// + heightfield terrain. Used by a capsule-ish character controller.
import { WORLD } from '../world/layout.js';

const STEP_UP = 0.6;

export class CollisionWorld {
  constructor(terrain, cellSize = 16) {
    this.terrain = terrain;
    this.cell = cellSize;
    this.grid = new Map();
    this.colliders = [];
    this.dynamic = []; // moving platforms
  }

  key(i, j) { return i * 73856093 ^ j * 19349663; }

  _insert(c) {
    this.colliders.push(c);
    const r = c.bound;
    const i0 = Math.floor((c.x - r) / this.cell), i1 = Math.floor((c.x + r) / this.cell);
    const j0 = Math.floor((c.z - r) / this.cell), j1 = Math.floor((c.z + r) / this.cell);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(c);
      }
    }
    return c;
  }

  // Oriented box: center x,z, half extents hx,hz, rotation rotY, vertical y0..y1
  addBox(x, z, hx, hz, y0, y1, rotY = 0, opts = {}) {
    const c = {
      type: 'box', x, z, hx, hz, y0, y1, rot: rotY,
      cos: Math.cos(rotY), sin: Math.sin(rotY),
      bound: Math.sqrt(hx * hx + hz * hz), walkable: opts.walkable !== false, tag: opts.tag,
    };
    return this._insert(c);
  }

  addCylinder(x, z, r, y0, y1, opts = {}) {
    const c = { type: 'cyl', x, z, r, y0, y1, bound: r, walkable: opts.walkable !== false, tag: opts.tag };
    return this._insert(c);
  }

  // Ramp rising along local +z: height yA at local z=-hz, yB at local z=+hz. Solid below surface down to y0.
  addRamp(x, z, hx, hz, rotY, yA, yB, y0 = null) {
    const c = {
      type: 'ramp', x, z, hx, hz, rot: rotY, cos: Math.cos(rotY), sin: Math.sin(rotY),
      yA, yB, y0: y0 === null ? Math.min(yA, yB) - 0.5 : y0, y1: Math.max(yA, yB),
      bound: Math.sqrt(hx * hx + hz * hz), walkable: true,
    };
    return this._insert(c);
  }

  // a platform whose y can change (levitation disc)
  addDynamicDisc(x, z, r, y) {
    const c = { type: 'disc', x, z, r, y, bound: r };
    this.dynamic.push(c);
    return c;
  }

  query(x, z, radius, out) {
    out.length = 0;
    const i0 = Math.floor((x - radius) / this.cell), i1 = Math.floor((x + radius) / this.cell);
    const j0 = Math.floor((z - radius) / this.cell), j1 = Math.floor((z + radius) / this.cell);
    const stamp = ++this._stamp || (this._stamp = 1);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const arr = this.grid.get(this.key(i, j));
        if (!arr) continue;
        for (const c of arr) {
          if (c._s === stamp) continue;
          c._s = stamp;
          out.push(c);
        }
      }
    }
    return out;
  }

  // local coords for oriented shapes
  _toLocal(c, x, z) {
    const dx = x - c.x, dz = z - c.z;
    // inverse rotation around Y: Three uses rotation.y; local = R(-rot) * d
    return { lx: dx * c.cos - dz * c.sin, lz: dx * c.sin + dz * c.cos };
  }

  _fromLocal(c, lx, lz) {
    return { x: c.x + lx * c.cos + lz * c.sin, z: c.z - lx * c.sin + lz * c.cos };
  }

  _rampHeight(c, lz) {
    const t = (lz + c.hz) / (2 * c.hz);
    return c.yA + (c.yB - c.yA) * Math.min(1, Math.max(0, t));
  }

  // top surface height under point, or -Infinity
  surfaceAt(c, x, z, pad = 0) {
    if (c.type === 'cyl') {
      const dx = x - c.x, dz = z - c.z;
      return dx * dx + dz * dz <= (c.r + pad) ** 2 ? c.y1 : -Infinity;
    }
    if (c.type === 'disc') {
      const dx = x - c.x, dz = z - c.z;
      return dx * dx + dz * dz <= (c.r + pad) ** 2 ? c.y : -Infinity;
    }
    const { lx, lz } = this._toLocal(c, x, z);
    if (Math.abs(lx) > c.hx + pad || Math.abs(lz) > c.hz + pad) return -Infinity;
    if (c.type === 'ramp') return this._rampHeight(c, lz);
    return c.y1;
  }

  groundHeight(x, z, feetY, list = this._tmp || (this._tmp = [])) {
    let g = this.terrain.getHeight(x, z);
    this.query(x, z, 0.5, list);
    for (const c of list) {
      if (!c.walkable) continue;
      const s = this.surfaceAt(c, x, z, 0.05);
      if (s > g && s <= feetY + STEP_UP) g = s;
    }
    for (const c of this.dynamic) {
      const s = this.surfaceAt(c, x, z, 0);
      if (s > g && s <= feetY + STEP_UP + 0.2) g = s;
    }
    return g;
  }

  // Push a circle (x,z,radius) at vertical span [feetY, feetY+height] out of colliders.
  resolve(pos, radius, height, list = this._tmp2 || (this._tmp2 = [])) {
    const feet = pos.y;
    const lo = feet + STEP_UP, hi = feet + height;
    this.query(pos.x, pos.z, radius + 1, list);
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of list) {
        if (c.type === 'cyl') {
          if (c.y1 < lo || c.y0 > hi) continue;
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const d2 = dx * dx + dz * dz;
          const rr = c.r + radius;
          if (d2 < rr * rr) {
            const d = Math.sqrt(d2) || 0.0001;
            pos.x = c.x + (dx / d) * rr;
            pos.z = c.z + (dz / d) * rr;
            hit = true;
          }
          continue;
        }
        // box / ramp
        if (c.y0 > hi) continue;
        const { lx, lz } = this._toLocal(c, pos.x, pos.z);
        const cx = Math.max(-c.hx, Math.min(c.hx, lx));
        const cz = Math.max(-c.hz, Math.min(c.hz, lz));
        let top = c.type === 'ramp' ? this._rampHeight(c, cz) : c.y1;
        if (top < lo) continue;
        const ex = lx - cx, ez = lz - cz;
        const d2 = ex * ex + ez * ez;
        if (d2 >= radius * radius) continue;
        let nlx, nlz;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nlx = cx + (ex / d) * radius;
          nlz = cz + (ez / d) * radius;
        } else {
          // inside: push out along shortest axis
          const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
          if (px < pz) { nlx = Math.sign(lx || 1) * (c.hx + radius); nlz = lz; }
          else { nlx = lx; nlz = Math.sign(lz || 1) * (c.hz + radius); }
        }
        const w = this._fromLocal(c, nlx, nlz);
        pos.x = w.x; pos.z = w.z;
        hit = true;
      }
    }
    return hit;
  }

  // ceiling check: lowest collider bottom above head
  ceilingAt(x, z, headY, list = this._tmp3 || (this._tmp3 = [])) {
    let ceil = Infinity;
    this.query(x, z, 0.4, list);
    for (const c of list) {
      if (c.type === 'ramp') continue;
      if (c.y0 < headY - 0.3) continue;
      if (this.surfaceAt(c, x, z, 0) === -Infinity) continue;
      if (c.y0 < ceil) ceil = c.y0;
    }
    return ceil;
  }

  // simple line-of-sight / raycast along segment against boxes/cyls (2.5D sampling)
  segmentBlocked(ax, ay, az, bx, by, bz, list = this._tmp4 || (this._tmp4 = [])) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(2, Math.ceil(len / 1.2));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
      if (this.terrain.getHeight(x, z) > y) return true;
      this.query(x, z, 0.2, list);
      for (const c of list) {
        if (c.type === 'ramp') continue;
        if (y < c.y0 || y > c.y1) continue;
        if (this.surfaceAt(c, x, z, 0) !== -Infinity) return true;
      }
    }
    return false;
  }
}

// Character motor shared by player / NPCs / enemies
export class Motor {
  constructor(world, opts = {}) {
    this.world = world;
    this.radius = opts.radius ?? 0.45;
    this.height = opts.height ?? 1.8;
    this.gravity = opts.gravity ?? 26;
    this.vy = 0;
    this.grounded = false;
    this.swimming = false;
    this.maxSlope = opts.maxSlope ?? 0.62; // min normal.y
    this.fallStartY = 0;
    this.lastFall = 0;
    this.canSwim = opts.canSwim ?? true;
    this._n = { x: 0, y: 1, z: 0 };
  }

  // pos: THREE.Vector3 (feet). vx,vz: desired horizontal velocity
  move(pos, vx, vz, dt) {
    const world = this.world;
    const terrain = world.terrain;
    const ox = pos.x, oz = pos.z;
    const speed = Math.sqrt(vx * vx + vz * vz);
    const sub = Math.max(1, Math.ceil((speed * dt) / 0.35));
    const sdt = dt / sub;
    this.lastFall = 0;
    for (let s = 0; s < sub; s++) {
      const px = pos.x, pz = pos.z;
      pos.x += vx * sdt;
      pos.z += vz * sdt;
      // steep terrain: block uphill movement
      const hOld = terrain.getHeight(px, pz);
      const hNew = terrain.getHeight(pos.x, pos.z);
      if (hNew > hOld + 0.02 && pos.y < hNew + 0.5) {
        const dist = Math.hypot(pos.x - px, pos.z - pz) || 1e-6;
        const grad = (hNew - hOld) / dist;
        if (grad > 1.35) { pos.x = px; pos.z = pz; }
      }
      world.resolve(pos, this.radius, this.height);
      // vertical
      if (!this.swimming) {
        this.vy -= this.gravity * sdt;
        if (this.vy < -50) this.vy = -50;
      }
      pos.y += this.vy * sdt;
      if (this.vy > 0) {
        const ceil = world.ceilingAt(pos.x, pos.z, pos.y + this.height);
        if (pos.y + this.height > ceil) { pos.y = ceil - this.height; this.vy = 0; }
      }
      const g = world.groundHeight(pos.x, pos.z, Math.max(pos.y, pos.y - this.vy * sdt));
      const wasGrounded = this.grounded;
      if (pos.y <= g) {
        if (!wasGrounded) this.lastFall = Math.max(this.lastFall, this.fallStartY - g);
        pos.y = g; this.vy = 0; this.grounded = true;
      } else if (wasGrounded && this.vy <= 0 && pos.y - g < 0.75) {
        pos.y = g; this.vy = 0; this.grounded = true; // snap down slopes / stairs
      } else {
        if (wasGrounded) this.fallStartY = pos.y;
        else if (pos.y > this.fallStartY) this.fallStartY = pos.y;
        this.grounded = false;
      }
      // water
      const W = WORLD.water;
      const swimY = W - this.height * 0.72;
      if (this.canSwim && g < swimY - 0.05 && pos.y <= swimY + 0.05) {
        this.swimming = true;
        pos.y = swimY; this.vy = 0; this.grounded = false; this.fallStartY = pos.y;
      } else if (this.swimming && (g >= swimY - 0.05 || pos.y > swimY + 0.3)) {
        this.swimming = false;
      }
    }
    // world bound
    const r = Math.hypot(pos.x, pos.z);
    const R = WORLD.playRadius;
    if (r > R) { pos.x *= R / r; pos.z *= R / r; }
    return Math.hypot(pos.x - ox, pos.z - oz);
  }

  jump(v) {
    if (this.grounded) {
      this.vy = v;
      this.grounded = false;
      this.fallStartY = -1e9;
      return true;
    }
    return false;
  }
}
