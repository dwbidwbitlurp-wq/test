// Lumenhold — main game orchestration.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Terrain } from './world/terrain.js';
import { CollisionWorld } from './engine/collision.js';
import { Sky } from './world/sky.js';
import { Water } from './world/water.js';
import { buildCastle } from './world/castle.js';
import { getMaterials } from './world/builder.js';
import { buildStructures } from './world/structures.js';
import { Vegetation } from './world/vegetation.js';
import { Effects } from './world/effects.js';
import { River, MountainFalls } from './world/river.js';
import { ForestShafts } from './world/shafts.js';
import { Weather } from './world/weather.js';
import { Builder } from './world/builder.js';
import { WORLD, CASTLE, CRAG, LOCATIONS, ALTARS, START, MEADOW, FOREST } from './world/layout.js';
import { meadowFlowers, forestDensity } from './world/terrain.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { clamp, damp, angleLerp, angleDiff, lerp } from './engine/noise.js';
import { Player } from './entities/player.js';
import { Mount } from './entities/mount.js';
import { Butterflies } from './entities/animal.js';
import { Enemy } from './entities/enemy.js';
import { newState, derived, saveGame, loadGame, levelCost, deleteSave, hasSave } from './game/state.js';
import { ITEMS, iconSVG } from './game/items.js';
import { QuestLog, QUESTS } from './game/quests.js';
import { DIALOGUES, SHOPS } from './game/dialogues.js';
import { Interactables } from './game/interact.js';
import { populate } from './game/population.js';
import { UI } from './ui/ui.js';
import { BOOKS } from './game/books.js';
import { Tutorial } from './game/tutorial.js';
import { PERKS, BRANCHES, canLearn, upgradeLevel, upgradeCost, MAX_UPGRADE } from './game/perks.js';

const QUALITY = {
  low: { lights: 4, shadows: false, shadowSize: 1024, bloom: false, pixelRatio: 0.8, grassRadius: 40, grassDensity: 0.55, flowerDensity: 0.55, dotRadius: 130, treeStep: 9.5, lodDist: 170, shadowExtent: 60 },
  medium: { lights: 6, shadows: true, shadowSize: 2048, bloom: true, pixelRatio: 1, grassRadius: 72, grassDensity: 1.3, flowerDensity: 0.95, dotRadius: 220, treeStep: 6.6, lodDist: 280, shadowExtent: 65 },
  high: { lights: 8, shadows: true, shadowSize: 4096, bloom: true, pixelRatio: 1.5, grassRadius: 100, grassDensity: 1.9, flowerDensity: 1.25, dotRadius: 320, treeStep: 5.4, lodDist: 420, shadowExtent: 75 },
};

const DEFAULT_SETTINGS = { quality: 'high', sens: 1, fov: 62, music: 0.55, sfx: 0.85, invertY: false, showFps: false, tutorial: true };

// Color grade + vignette (runs after tone mapping, on display values)
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.28 }, uWarm: { value: new THREE.Vector3(1.02, 1.0, 1.03) }, uSat: { value: 1.08 }, uLift: { value: 0.015 }, uGloom: { value: 0 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uVignette; uniform vec3 uWarm; uniform float uSat; uniform float uLift; uniform float uGloom; uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col *= uWarm;
      // pastel lift in shadows (dreamy)
      col = col + uLift * (1.0 - col) * vec3(1.0, 0.92, 1.05);
      // soft glow in highlights toward peach
      col = mix(col, col * vec3(1.03, 0.99, 0.96), smoothstep(0.6, 1.0, l));
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.1, 1.0)));
      col *= mix(1.0 - uVignette, 1.0, v);
      col = mix(col, col * vec3(0.8, 0.7, 0.95), uGloom * (1.0 - v) * 0.8);
      col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.012;
      gl_FragColor = vec4(col, c.a);
    }`,
};

// Screen-space sun shafts + soft lens flare. Runs on the HDR buffer before bloom.
const ShaftShader = {
  uniforms: {
    tDiffuse: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uIntensity: { value: 0 },
    uAspect: { value: 1 }, uTint: { value: new THREE.Color(1, 0.9, 0.75) }, uFlare: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uIntensity; uniform float uAspect; uniform vec3 uTint; uniform float uFlare;
    varying vec2 vUv;
    float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      if (uIntensity <= 0.001) { gl_FragColor = base; return; }
      const int N = 40;
      vec2 delta = (vUv - uSun) * (0.85 / float(N));
      vec2 uv = vUv;
      float illum = 1.0;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < N; i++) {
        uv -= delta;
        vec3 s = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
        float l = lum(s);
        acc += s * smoothstep(1.05, 2.4, l) * illum;
        illum *= 0.955;
      }
      vec3 col = base.rgb + acc * (0.9 / float(N)) * uIntensity * uTint;
      // lens flare ghosts along the sun -> center axis, gated by sun visibility
      if (uFlare > 0.001) {
        float vis = smoothstep(1.2, 3.0, lum(texture2D(tDiffuse, uSun).rgb));
        vec2 axis = vec2(0.5) - uSun;
        vec2 p = vUv - 0.5; p.x *= uAspect;
        for (int k = 0; k < 5; k++) {
          float t = float(k) * 0.42 + 0.35;
          vec2 g = uSun + axis * t * 2.0;
          vec2 d = vUv - g; d.x *= uAspect;
          float r = 0.02 + float(k) * 0.018;
          float ring = smoothstep(r, r * 0.6, length(d)) * 0.12;
          vec3 gc = mix(vec3(1.0, 0.7, 0.85), vec3(0.7, 0.85, 1.0), float(k) / 4.0);
          col += gc * ring * vis * uFlare;
        }
        vec2 ds = vUv - uSun; ds.x *= uAspect;
        float halo = smoothstep(0.24, 0.2, length(ds)) * smoothstep(0.16, 0.22, length(ds));
        col += vec3(1.0, 0.85, 0.95) * halo * 0.06 * vis * uFlare;
      }
      gl_FragColor = vec4(col, base.a);
    }`,
};

class CameraRig {
  constructor(game) {
    this.game = game;
    this.yaw = Math.PI; // forward = (sin yaw, cos yaw)
    this.pitch = 0.18;
    this.dist = 5.2;
    this.targetDist = 5.2;
    this.focus = new THREE.Vector3();
    this.shakeV = 0;
    this.punchV = 0;
    this.curDist = 5.2;
    this.recenterT = -1;
    this.recYaw = 0;
  }

  shake(v) { this.shakeV = Math.min(1.2, this.shakeV + v); }
  punch(v) { this.punchV = v; }
  recenter(yaw) { this.recYaw = yaw; this.recenterT = 0.35; }

  update(dt, m) {
    const g = this.game;
    const p = g.player;
    const cam = g.camera;
    if (g.mode === 'play') {
      this.yaw -= m.dx * 0.0022;
      this.pitch += m.dy * 0.0022;
      if (!p.lockTarget && m.wheel) this.targetDist = clamp(this.targetDist + m.wheel * 0.6, 2.6, 11);
      if (g.input.key('ArrowLeft')) this.yaw += dt * 2.2;
      if (g.input.key('ArrowRight')) this.yaw -= dt * 2.2;
      if (g.input.key('ArrowUp')) this.pitch -= dt * 1.2;
      if (g.input.key('ArrowDown')) this.pitch += dt * 1.2;
    }
    this.pitch = clamp(this.pitch, -0.75, 1.15);
    if (this.recenterT > 0) {
      this.recenterT -= dt;
      this.yaw = angleLerp(this.yaw, this.recYaw, 1 - Math.exp(-14 * dt));
    }
    // cinematic over-the-shoulder dialogue camera (Witcher-style)
    const ds = g.ui && g.ui.dialogState;
    if (ds && ds.npc) {
      const n = ds.npc;
      const nh = new THREE.Vector3(n.pos.x, n.pos.y + n.height * 0.9, n.pos.z);
      const ph = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
      const d = new THREE.Vector3(ph.x - nh.x, 0, ph.z - nh.z);
      const dl = d.length() || 1;
      d.divideScalar(dl);
      const right = new THREE.Vector3(-d.z, 0, d.x);
      const want = ph.clone().addScaledVector(d, 1.15).addScaledVector(right, 0.62);
      want.y = Math.max(ph.y, nh.y) + 0.08;
      if (!this.dlgPos) { this.dlgPos = cam.position.clone(); this.dlgLook = nh.clone(); }
      this.dlgPos.lerp(want, 1 - Math.exp(-4 * dt));
      const lookAt = nh.clone().addScaledVector(right, 0.15);
      lookAt.y -= 0.08;
      this.dlgLook.lerp(lookAt, 1 - Math.exp(-5 * dt));
      cam.position.copy(this.dlgPos);
      cam.lookAt(this.dlgLook);
      this.yaw = Math.atan2(-d.x, -d.z);
      return;
    }
    this.dlgPos = null;
    const riding = !!p.mount;
    const focusTarget = new THREE.Vector3(p.pos.x, p.pos.y + (riding ? 2.4 : 1.55), p.pos.z);
    if (p.motor.swimming) focusTarget.y += 0.3;
    let wantDist = riding ? Math.max(7.5, this.targetDist) : this.targetDist;
    if (p.lockTarget) {
      const t = p.lockTarget;
      const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z;
      const desiredYaw = Math.atan2(dx, dz);
      this.yaw = angleLerp(this.yaw, desiredYaw, 1 - Math.exp(-6 * dt));
      const d = Math.hypot(dx, dz);
      const hDiff = (t.pos.y + t.height * 0.5) - focusTarget.y;
      const wantPitch = clamp(0.22 - Math.atan2(hDiff, d) * 0.7 + (t.boss ? 0.06 : 0), -0.3, 0.7);
      this.pitch = lerp(this.pitch, wantPitch, 1 - Math.exp(-4 * dt));
      wantDist = Math.max(wantDist, 5.2 + (t.boss ? 2.5 : 0));
      focusTarget.lerp(new THREE.Vector3(t.pos.x, t.pos.y + t.height * 0.5, t.pos.z), 0.12);
    }
    if (g.boss && g.boss.alive && !p.lockTarget) wantDist = Math.max(wantDist, 7);
    this.focus.x = damp(this.focus.x, focusTarget.x, 16, dt);
    this.focus.y = damp(this.focus.y, focusTarget.y, 10, dt);
    this.focus.z = damp(this.focus.z, focusTarget.z, 16, dt);
    this.dist = damp(this.dist, wantDist * (1 - this.punchV * 0.25), 6, dt);
    this.punchV = damp(this.punchV, 0, 3, dt);
    // camera position (orbit behind player: opposite of forward)
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dirX = -Math.sin(this.yaw) * cp, dirY = sp, dirZ = -Math.cos(this.yaw) * cp;
    // shoulder offset (to the right)
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    const shoulder = p.lockTarget || riding ? 0 : 0.45;
    const fx = this.focus.x + rx * shoulder, fz = this.focus.z + rz * shoulder, fy = this.focus.y;
    // collision: shorten if blocked
    let dist = this.dist;
    const col = g.collision;
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * this.dist;
      const x = fx + dirX * t, y = fy + dirY * t, z = fz + dirZ * t;
      if (g.terrain.getHeight(x, z) > y - 0.3 || this.pointBlocked(x, y, z)) { dist = Math.max(0.8, t - 0.4); break; }
    }
    this.curDist = dist < this.curDist ? dist : damp(this.curDist, dist, 4, dt);
    let x = fx + dirX * this.curDist, y = fy + dirY * this.curDist, z = fz + dirZ * this.curDist;
    y = Math.max(y, Math.max(g.terrain.getHeight(x, z), WORLD.water - 0.2) + 0.4);
    // shake
    if (this.shakeV > 0.001) {
      const s = this.shakeV * this.shakeV * 0.35;
      x += (Math.random() - 0.5) * s; y += (Math.random() - 0.5) * s; z += (Math.random() - 0.5) * s;
      this.shakeV = Math.max(0, this.shakeV - dt * 2.2);
    }
    cam.position.set(x, y, z);
    cam.lookAt(fx, fy + 0.15, fz);
  }

  pointBlocked(x, y, z) {
    const col = this.game.collision;
    const list = col.query(x, z, 0.2, this._q || (this._q = []));
    for (const c of list) {
      if (c.type === 'ramp') { if (col.surfaceAt(c, x, z, 0.1) > y && c.y0 < y) return true; continue; }
      if (y < c.y0 || y > c.y1 + 0.2) continue;
      if (col.surfaceAt(c, x, z, 0.2) !== -Infinity) return true;
    }
    return false;
  }
}

class Game {
  constructor() {
    this.settings = this.loadSettings();
    const qp = new URLSearchParams(location.search).get('quality');
    if (qp && QUALITY[qp]) this.settings.quality = qp;
    this.q = QUALITY[this.settings.quality] || QUALITY.medium;
    this.mode = 'loading';
    this.time = 0;
    this.timeScale = 1;
    this.hitStopT = 0;
    this.enemies = [];
    this.animals = [];
    this.npcs = [];
    this.birds = [];
    this.projectiles = [];
    this.shockwaves = [];
    this.state = newState();
    this.boss = null;
    this.frames = 0;
    this.fpsT = 0;
    this.regionT = 0;
    this.nightSpawnT = 60;
    this.titleT = 0;
    this.env = { night: false, flowers: 0, wild: true, gloom: 0, sunUp: 1 };
  }

  loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('lumenhold_settings') || 'null');
      return { ...DEFAULT_SETTINGS, ...(s || {}) };
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  }

  saveSettings() {
    try { localStorage.setItem('lumenhold_settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
  }

  async init() {
    const bar = document.querySelector('#loading .lbar i');
    const msg = document.querySelector('#loading p');
    const step = async (pct, text, fn) => {
      bar.style.width = pct + '%';
      msg.textContent = text;
      await new Promise((r) => setTimeout(r, 30));
      return fn();
    };
    const canvas = document.getElementById('game');
    await step(5, 'Пробуждаем свет...', () => {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.q.bloom, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
      this.renderer.setSize(innerWidth, innerHeight);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.08, 5000);
      this.input = new Input(canvas);
      this.input.sensitivity = this.settings.sens;
      this.input.invertY = this.settings.invertY;
      this.audio = new Audio();
    });
    await step(15, 'Поднимаем холмы и горы...', () => {
      this.terrain = new Terrain();
      this.scene.add(this.terrain.mesh);
      this.collision = new CollisionWorld(this.terrain);
    });
    await step(35, 'Раскрашиваем небо...', () => {
      this.sky = new Sky(this.scene, this.renderer, this.q);
      this.water = new Water(this.scene);
      this.effects = new Effects(this.scene, this.renderer);
      this.effects.waterGlint = { level: WORLD.water, isWater: (x, z) => this.terrain.getHeight(x, z) < WORLD.water - 0.3 };
    });
    await step(45, 'Возводим Люменхолд...', () => {
      this.castle = buildCastle(this.scene, this.collision);
      this.water.addDisc(this.scene, CASTLE.x, CASTLE.y + 0.75, CASTLE.z + 36, 5.8);
    });
    await step(60, 'Строим деревни и руины...', () => {
      this.structures = buildStructures(this.scene, this.terrain, this.collision);
      const rb = new Builder(this.collision);
      this.river = new River(this.scene, this.terrain, this.effects, rb);
      this.falls = new MountainFalls(this.scene, this.terrain);
      this.scene.add(rb.build());
    });
    await step(66, 'Рассыпаем искры...', () => {
      const sp = this.castle.spawn;
      this.effects.addSparkleSource(sp.heart, 3.5, 10, '#fff4d8', 1.2);
      this.effects.addSparkleSource(sp.fountain.clone().add(new THREE.Vector3(0, 6.4, 0)), 1.2, 4, '#dff0ff', 0.6);
      for (const a of this.structures.altars) this.effects.addSparkleSource(a.crystal.position, 0.8, 3, '#fff0c0', 0.55);
      this.effects.addSparkleSource(this.structures.spawns.spireTop.clone().add(new THREE.Vector3(0, -60, 0)), 12, 14, '#e8f4ff', 2.2);
      this.effects.addSparkleSource(this.structures.spawns.spireTop.clone().add(new THREE.Vector3(0, -120, 0)), 10, 10, '#ffe4f4', 1.6);
      for (const f of this.structures.floaters) this.effects.addSparkleSource(f.position, 1.2, 2.5, '#e8f4ff', 0.6);
    });
    await step(70, 'Выращиваем леса и цветы...', () => {
      this.veg = new Vegetation(this.scene, this.terrain, this.collision, this.q);
      this.weather = new Weather(this.scene, this.settings.quality);
      this.forestShafts = new ForestShafts(this.scene, this.terrain, FOREST, 250, this.q.lights >= 6 ? 70 : 40, forestDensity);
    });
    await step(80, 'Зажигаем фонари...', () => {
      this.setupLights();
      this.setupEnv();
      this.setupComposer();
    });
    await step(88, 'Созываем жителей...', () => {
      this.ui = new UI(this);
      this.quests = new QuestLog(this);
      this.player = new Player(this);
      this.mount = new Mount(this);
      this.cam = new CameraRig(this);
      populate(this, this.castle, this.structures);
      this.interact = new Interactables(this, this.castle, this.structures);
      this.tutorial = new Tutorial(this);
      this.butterflies = new Butterflies(this.scene, 36);
      this.shockMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      this.shockGeo = new THREE.RingGeometry(0.85, 1, 48);
      this.shockGeo.rotateX(-Math.PI / 2);
    });
    await step(96, 'Почти готово...', () => {
      this.applyState(this.state);
      this.bindEvents();
      // warm-up render (compile shaders)
      this.cam.update(0.016, { dx: 0, dy: 0, wheel: 0 });
      this.sky.update(0.016, this.state.hour, this.camera, this.player.pos);
      this.veg.update(this.camera.position, 0);
      this.renderer.compile(this.scene, this.camera);
    });
    bar.style.width = '100%';
    document.getElementById('loading').classList.add('done');
    this.mode = 'title';
    this.ui.open('title');
    this.ui.hud.classList.add('hidden');
    this.last = performance.now();
    this.loop();
  }

  setupLights() {
    // warm point lights inside key interiors
    // Interior light anchors are many; a small fixed pool of point lights follows
    // the camera and is assigned to the nearest anchors (constant light count =
    // no shader recompiles, cost independent of how many rooms the castle has).
    const sp = this.castle.spawn;
    this.lightAnchors = [
      { pos: sp.tavernLight, color: 0xffc27a, intensity: 18, dist: 18 },
      { pos: sp.throneLight, color: 0xffe2b0, intensity: 30, dist: 30 },
      { pos: sp.forgeLight, color: 0xff8a3a, intensity: 14, dist: 12, flicker: 0.12 },
      { pos: sp.chapelLight, color: 0xffd8f0, intensity: 14, dist: 14 },
      ...(this.castle.lights || []),
      ...(this.structures.lights || []),
    ];
    this.lightPool = [];
    for (let i = 0; i < (this.q.lights || 6); i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      l.userData.anchor = null;
      this.scene.add(l);
      this.lightPool.push(l);
    }
    // lamp glow sprites (night)
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,230,170,1)');
      g.addColorStop(0.3, 'rgba(255,200,120,0.4)');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    this.lampSprites = new THREE.Group();
    const lampMat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    for (const p of this.castle.lamps.concat(this.structures.lamps)) {
      const s = new THREE.Sprite(lampMat);
      s.position.copy(p);
      s.scale.setScalar(3.2);
      this.lampSprites.add(s);
    }
    this.lampMat = lampMat;
    this.scene.add(this.lampSprites);
    // heart light
    this.heartLight = new THREE.PointLight(0xd8c8ff, 40, 80, 1.5);
    this.heartLight.position.copy(sp.heart);
    this.scene.add(this.heartLight);
  }

  setupEnv() {
    // soft environment for metals / glossy surfaces: sky gradient scene
    const envScene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.55,0.7,1.0); vec3 hor = vec3(1.0,0.9,0.92); vec3 bot = vec3(0.55,0.62,0.45); vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.6)) : mix(hor, bot, pow(-h, 0.5)); gl_FragColor = vec4(c * 1.2, 1.0); }',
    });
    envScene.add(new THREE.Mesh(geo, mat));
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 7, 6) }));
    sun.position.set(5, 7, 3);
    envScene.add(sun);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.6;
  }

  setupComposer() {
    const r = this.renderer;
    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: this.q.bloom ? 4 : 0 }));
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // safety net: a single NaN/inf pixel would be smeared into a black hole by bloom — replace it before any blur
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); bool bad = !(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || c.r > 1e4 || c.g > 1e4 || c.b > 1e4; gl_FragColor = bad ? vec4(0.5, 0.5, 0.5, 1.0) : c; }',
    }));
    this.shafts = new ShaderPass(ShaftShader);
    this.composer.addPass(this.shafts);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.36, 0.55, 1.08);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.bloom.enabled = this.q.bloom;
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
      this.effects.setScale(this.renderer.domElement.height);
    });
    this.input.onUnlock = () => {
      if (this.mode === 'play' && !this.ui.isOpen()) this.ui.open('pause');
    };
    window.addEventListener('keydown', (e) => {
      this.audio.init();
      this.audio.resume();
      if (this.mode === 'loading') return;
      if (this.ui.handleKey(e.code)) { e.preventDefault(); this.input.pressed.delete(e.code); return; }
      if (this.mode !== 'play') return;
      const opens = ['Escape', 'KeyI', 'Tab', 'KeyJ', 'KeyM', 'KeyH', 'KeyK', 'KeyB'];
      if (opens.includes(e.code)) this.input.pressed.delete(e.code);
      if (e.code === 'Escape') this.ui.open('pause');
      else if (e.code === 'KeyI' || e.code === 'Tab') this.ui.open('inventory');
      else if (e.code === 'KeyJ') this.ui.open('journal');
      else if (e.code === 'KeyM') this.ui.open('map');
      else if (e.code === 'KeyK') { this.ui.charTab = 'perks'; this.ui.open('character'); }
      else if (e.code === 'KeyB') { this.ui.charTab = 'bestiary'; this.ui.open('character'); }
      else if (e.code === 'KeyG') this.callMount();
      else if (e.code === 'KeyH') this.ui.open('controls');
    });
    this.renderer.domElement.addEventListener('click', () => {
      this.audio.init();
      this.audio.resume();
      if (this.mode === 'play' && !this.ui.isOpen()) this.input.requestLock();
    });
    document.addEventListener('mousedown', () => { this.audio.init(); this.audio.resume(); });
  }

  // ==================================================================
  // state
  // ==================================================================
  applyState(s) {
    this.state = s;
    const p = s.player;
    let y = p.y;
    if (!y) y = this.collision.groundHeight(p.x, p.z, 500);
    this.player.setPosition(p.x, y + 0.2, p.z, p.yaw);
    this.player.applyLook();
    this.player.revive();
    this.cam.yaw = p.yaw;
    this.cam.focus.set(p.x, y + 1.5, p.z);
    this.interact.placeCat();
    this.interact.setLostGlimmer(s.lostGlimmer);
    if (s.flags.fogOpen) this.interact.openFog();
    for (const n of this.npcs) { n.hidden = false; n.slot = undefined; n.updateSchedule(true); }
    if (s.flags.florian_gone) this.hideNpc('florian');
    if (s.flags.janek_free) this.hideNpc('janek');
    if (this.duel) this.endDuel(false);
    for (const e of this.enemies) {
      if (e.unique && s.killed.includes(e.unique)) { e.alive = false; e.body.root.visible = false; e.state = 'dead'; e.deathT = 99; }
      else e.respawn();
    }
    if (this.mount.summoned) this.mount.dismiss();
    this.player.mount = null;
    this.ui.refreshHotbar();
    this.ui.refreshQuestTracker();
  }

  derived() { return derived(this.state); }
  itemCount(id) { return this.state.inventory[id] || 0; }
  shardCount() { return this.itemCount('dawn_shard'); }
  qprog(id, key) { return this.state.quests[id]?.prog[key] || 0; }
  npcById(id) { return this.npcs.find((n) => n.id === id); }
  enemyMarkers(type) { return this.enemies.filter((e) => e.alive && e.typeId === type).slice(0, 3).map((e) => ({ x: e.home.x, z: e.home.z, y: e.home.y })); }
  gatherMarkers(kind, n) {
    const p = this.player.pos;
    return this.interact.list.filter((o) => o.gk === kind && o.active()).sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p)).slice(0, n).map((o) => ({ x: o.pos.x, z: o.pos.z, y: o.pos.y }));
  }
  npcPos(id) { const n = this.npcById(id); return n ? { x: n.pos.x, z: n.pos.z, y: n.pos.y } : null; }
  catPos() { const p = this.castle.spawn.cat; return { x: p.x, z: p.z, y: p.y }; }
  castleSpot(name) { const p = this.castle.spawn[name]; return p ? { x: p.x, z: p.z, y: p.y } : null; }
  taken(id) { return (this.state.taken || []).includes(id); }
  tomeSpots() { return (this.tomeList || []).filter((t) => !this.taken(t.id)).map((t) => ({ x: t.x, z: t.z, y: t.y })); }
  swarmPos() { return this.swarm ? { x: this.swarm.x, z: this.swarm.z, y: this.swarm.y } : null; }
  stashPos() { return this.stash ? { x: this.stash.x, z: this.stash.z, y: this.stash.y } : null; }
  hideNpc(id) { const n = this.npcById(id); if (n) { n.hidden = true; n.setVisible(false); } }

  // ---------- sparring duel (non-lethal) ----------
  startDuel(npcId) {
    const npc = this.npcById(npcId);
    if (!npc || this.duel) return;
    const e = new Enemy(this, 'prince', npc.pos.clone(), { yaw: npc.yaw, id: 'duel_' + npcId });
    e.aggro && e.aggro();
    this.enemies.push(e);
    npc.hidden = true;
    npc.setVisible(false);
    this.duel = { enemy: e, npc };
    this.ui.setBoss(e);
    this.ui.bigText('Учебный поединок', npc.name + ' · до просьбы о пощаде', 'boss');
    this.audio.play('gate', 0.5);
  }

  endDuel(won) {
    const d = this.duel;
    if (!d) return;
    this.duel = null;
    const e = d.enemy;
    e.alive = false;
    e.remove();
    this.enemies.splice(this.enemies.indexOf(e), 1);
    if (e.trail) e.trail.active = false;
    d.npc.pos.copy(e.pos);
    d.npc.yaw = e.yaw;
    d.npc.hidden = false;
    d.npc.setVisible(true);
    this.ui.setBoss(null);
    this.player.lockTarget = null;
    const f = this.state.flags;
    if (won) {
      f.duel_won = true;
      if (this.quests.active('duel') && this.quests.stage('duel') === 0) this.quests.setStage('duel', 1);
      this.ui.bigText('Победа в поединке', `${d.npc.name} признаёт поражение`, 'victory');
      this.audio.play('levelup');
    } else {
      f.duel_lost = true;
      const p = this.state.player;
      p.hp = Math.max(p.hp, 1);
      this.ui.bigText('Поражение', `${d.npc.name}: «Сдаёшься? Отдохни и приходи снова!»`, 'death');
    }
    setTimeout(() => { if (this.mode === 'play' && d.npc.pos.distanceTo(this.player.pos) < 8) this.startDialog(d.npc); }, 1800);
  }

  npcHasQuest(n) {
    const q = this.quests;
    const f = this.state.flags;
    switch (n.id) {
      case 'iva': return q.stage('main1') < 1;
      case 'roland': return q.stage('main1') === 2 || (q.status('bandits') === 'none' && q.stage('main1') >= 3) || (q.active('bandits') && q.stage('bandits') === 1);
      case 'queen': return q.stage('main1') === 3 || q.active('main3');
      case 'orvin': return q.stage('main2') === 0 || q.stage('main2') === 2;
      case 'bram': return q.status('blade') === 'none' || (q.active('blade') && this.itemCount('light_crystal') >= 3);
      case 'selma': return q.status('moon') === 'none' || (q.active('moon') && this.itemCount('moonflower') >= 5);
      case 'nelly': return q.status('cat') === 'none' || q.stage('cat') === 1;
      case 'volk': return q.status('wolves') === 'none' || q.stage('wolves') === 1;
      case 'elm': return q.status('hermit') === 'none' || (q.active('hermit') && this.itemCount('mushroom') >= 4);
      case 'aurelia': return q.status('letter') === 'none' || (q.stage('letter') === 3 && !f.letter_report && this.itemCount('royal_rose') > 0);
      case 'cedric': return q.status('duel') === 'none' || (f.duel_won && !q.done('duel')) || (q.stage('letter') === 3 && !!f.letter_report);
      case 'bertha': return q.status('feast') === 'none' || (q.active('feast') && this.itemCount('raw_meat') >= 3 && this.itemCount('honey') >= 2 && this.itemCount('mushroom') >= 4);
      case 'edmund': return q.status('tomes') === 'none' || q.stage('tomes') === 1 || q.stage('letter') === 1;
      case 'florian': return q.status('ballad') === 'none' || (q.active('ballad') && this.itemCount('wine') > 0) || q.stage('letter') === 2;
      case 'greta': return q.status('swarm') === 'none' || q.stage('swarm') === 1;
      case 'hugo': return q.status('flour') === 'none';
      case 'janek': return q.status('prisoner') === 'none' || (q.stage('prisoner') === 0 && (this.itemCount('sweet_roll') > 0 || !!f.unlock_cell_1_1));
      default: return false;
    }
  }

  giveItem(id, n = 1) {
    if (!ITEMS[id] || n <= 0) return;
    this.state.inventory[id] = (this.state.inventory[id] || 0) + n;
    this.ui.notify(`${ITEMS[id].name}${n > 1 ? ` ×${n}` : ''}`, iconSVG(id));
    this.audio.play('pickup', 0.6);
    for (const qid of Object.keys(this.state.quests)) this.quests.check(qid);
  }

  takeItem(id, n = 1, silent = false) {
    const inv = this.state.inventory;
    inv[id] = Math.max(0, (inv[id] || 0) - n);
    if (!inv[id]) delete inv[id];
  }

  addGold(n) {
    this.state.gold = Math.max(0, this.state.gold + n);
    if (n > 0) { this.ui.notify(`Золото <b>+${n}</b>`, '<span class="coin" style="width:22px;height:22px"></span>'); this.audio.play('coin'); }
  }

  addGlimmer(n) { this.state.player.glimmer += n; }

  addBuff(b) {
    const list = this.state.buffs;
    const ex = list.find((x) => x.id === b.id);
    if (ex) ex.time = b.time; else list.push({ ...b });
  }

  learnSpell(id) {
    if (this.state.spells.includes(id)) return;
    this.state.spells.push(id);
    this.ui.bigText('Луч света', 'Новое заклинание · клавиша C', 'victory');
    this.audio.play('levelup');
    this.effects.levelUp(this.player.pos);
  }

  fullHeal() {
    const d = this.derived();
    const p = this.state.player;
    p.hp = d.maxHp; p.stamina = d.maxStamina; p.mana = d.maxMana;
    p.flasks = p.flasksMax;
    this.effects.motes(this.player.pos, '#ffe6a0', 30, 0.7, 2, 1.6);
  }

  // ---------- perks & forge ----------
  learnPerk(branch, idx) {
    const s = this.state;
    if (!canLearn(s, branch, idx)) return false;
    const p = PERKS[branch][idx];
    s.perks.push(p.id);
    if (p.id === 'g_flask') { s.player.flasksMax++; s.player.flasks++; }
    this.audio.play('levelup');
    this.effects.burst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), BRANCHES.find((b) => b.id === branch).color, 40, 3, 0.35, 0.9);
    this.ui.notify(`Навык: <b>${p.name}</b>`);
    return true;
  }

  openForge() {
    this.ui.forgeSel = this.state.equipment.weapon;
    this.tutorial?.show('forge');
    setTimeout(() => this.ui.open('forge'), 0);
  }

  upgradeItem(id) {
    const s = this.state;
    const it = ITEMS[id];
    if (!it || !this.itemCount(id)) return false;
    const lvl = upgradeLevel(s, id);
    if (lvl >= MAX_UPGRADE) return false;
    const c = upgradeCost(id, lvl);
    if (s.gold < c.gold) { this.ui.hint('Не хватает золота'); return false; }
    for (const [m, n] of Object.entries(c.mats)) if (this.itemCount(m) < n) { this.ui.hint('Не хватает материалов: ' + ITEMS[m].name); return false; }
    this.addGold(-c.gold);
    for (const [m, n] of Object.entries(c.mats)) this.takeItem(m, n);
    s.upgrades[id] = lvl + 1;
    this.audio.play('block');
    setTimeout(() => this.audio.play('block', 0.7), 260);
    setTimeout(() => this.audio.play('levelup', 0.6), 560);
    this.ui.notify(`${it.name} <b>+${lvl + 1}</b>`);
    this.player.refreshLook?.();
    return true;
  }

  equip(id) {
    const it = ITEMS[id];
    if (!it) return;
    const slot = it.type;
    if (!['weapon', 'armor', 'amulet'].includes(slot)) return;
    this.state.equipment[slot] = id;
    this.player.applyLook();
    const d = this.derived();
    const p = this.state.player;
    p.hp = Math.min(p.hp, d.maxHp);
    p.mana = Math.min(p.mana, d.maxMana);
    this.audio.play('block', 0.5);
  }

  // ---------- trading ----------
  buyPrice(id) { return Math.max(1, Math.round(ITEMS[id].price * 1.0)); }
  sellPrice(shop, id) { return Math.max(1, Math.floor(ITEMS[id].price * (SHOPS[shop].sellMul || 0.5))); }
  // merchant stock & purse, restocked every in-game day
  shopState(shop) {
    const s = this.state;
    s.shops = s.shops || {};
    let st = s.shops[shop];
    if (!st || st.day !== s.day) {
      const stock = {};
      for (const id of SHOPS[shop].items) {
        const t = ITEMS[id].type;
        stock[id] = t === 'weapon' || t === 'armor' ? 1 : t === 'amulet' ? 1 : t === 'potion' ? 5 : 8;
      }
      // keep what the player sold (buy-back), merchants don't forget
      if (st) for (const [id, n] of Object.entries(st.stock)) if (!SHOPS[shop].items.includes(id) && n > 0) stock[id] = n;
      st = s.shops[shop] = { day: s.day, stock, gold: SHOPS[shop].gold || 600 };
    }
    return st;
  }
  buy(shop, id, n = 1) {
    const st = this.shopState(shop);
    const price = this.buyPrice(id);
    n = Math.min(n, st.stock[id] || 0, Math.floor(this.state.gold / price));
    if (n <= 0) { this.ui.hint(!(st.stock[id] > 0) ? 'Товар закончился. Загляните завтра.' : 'Недостаточно золота.'); return; }
    this.state.gold -= price * n;
    st.gold += price * n;
    st.stock[id] -= n;
    this.giveItem(id, n);
    this.audio.play('coin');
  }
  sell(shop, id) {
    if (!this.itemCount(id)) return;
    const st = this.shopState(shop);
    const price = this.sellPrice(shop, id);
    if (st.gold < price) { this.ui.hint('У торговца не хватает золота.'); return; }
    this.takeItem(id, 1);
    this.state.gold += price;
    st.gold -= price;
    st.stock[id] = (st.stock[id] || 0) + 1;
    this.audio.play('coin');
  }

  cook(r, alchemy = false) {
    if (!r) return;
    for (const [id, n] of Object.entries(r.needs)) if (this.itemCount(id) < n) return;
    for (const [id, n] of Object.entries(r.needs)) this.takeItem(id, n);
    this.giveItem(r.id, 1);
    this.audio.play(alchemy ? 'magic' : 'eat');
    if (alchemy) this.effects.motes(this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#b8ffb0', 14, 0.5, 1.4, 1.2);
  }

  // ---------- dialogue ----------
  startDialog(npc) {
    this.player.yaw = Math.atan2(npc.pos.x - this.player.pos.x, npc.pos.z - this.player.pos.z);
    this.player.syncRig();
    const tree = DIALOGUES[npc.dialog] ? DIALOGUES[npc.dialog](this) : DIALOGUES.citizen(this);
    npc.talking = true;
    npc.talkT = 0;
    this.dialogNpc = npc;
    this.ui.openDialog(npc, tree);
    this.onMenuChange();
  }

  endDialog(npc) {
    if (npc) npc.talking = false;
    this.dialogNpc = null;
    this.onMenuChange();
  }

  openShop(id) {
    this.tutorial?.show('trade');
    this.ui.shopMode = 'buy';
    setTimeout(() => this.ui.open('shop', { shop: id }), 0);
  }

  // ---------- altar ----------
  useAltar(a) {
    const s = this.state;
    if (!s.altars.includes(a.id)) {
      s.altars.push(a.id);
      this.ui.bigText('Алтарь Света', a.name, 'victory');
      this.audio.play('altar');
      this.effects.burst(a.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), '#ffe6a0', 60, 5, 0.4, 1.4);
    }
    s.lastAltar = a.id;
    this.ui.open('altar', { altar: a });
  }

  restAtAltar(a) {
    const s = this.state;
    s.lastAltar = a.id;
    this.fullHeal();
    this.player.hot.length = 0;
    for (const e of this.enemies) if (!e.alive || e.state === 'return') e.respawn();
    for (const an of this.animals) if (!an.alive) an.respawn();
    this.audio.play('altar');
    this.save(false);
    this.ui.hint('Вы отдохнули. Раны затянулись, флаконы наполнились. Игра сохранена.');
  }

  applyLevelUp(alloc) {
    const p = this.state.player;
    let total = 0;
    for (const k of Object.keys(alloc)) total += alloc[k];
    let cost = 0;
    for (let i = 0; i < total; i++) cost += levelCost(p.level + i);
    if (cost > p.glimmer || !total) return;
    p.glimmer -= cost;
    for (const k of Object.keys(alloc)) p.stats[k] += alloc[k];
    p.level += total;
    this.fullHeal();
    this.effects.levelUp(this.player.pos);
    this.audio.play('levelup');
    this.ui.bigText('Уровень ' + p.level, 'Свет крепнет в вас', 'victory');
    setTimeout(() => this.ui.notify(`Очки навыков: <b>+${total}</b> — откройте древо навыков <kbd>K</kbd>`), 1200);
    this.tutorial?.show('perks');
  }

  waitUntil(h) {
    const s = this.state;
    if (s.hour > h) s.day++;
    s.hour = h;
    this.refreshSchedules();
    this.ui.close();
    this.ui.hint(h < 12 ? 'Наступило утро.' : 'Опустилась ночь.');
  }

  readBook(id) {
    const s = this.state;
    s.read = s.read || [];
    const b = BOOKS[id];
    if (!b) return;
    if (!s.read.includes(id)) {
      s.read.push(id);
      const xp = b.xp ?? 25;
      if (xp) { this.addGlimmer(xp); this.ui.notify(`Новое знание: <b>${b.title}</b> · сияние +${xp}`); }
      if (b.onRead) b.onRead(this);
      for (const qid of Object.keys(s.quests)) this.quests.check(qid);
    }
    this.audio.play('page');
    this.ui.open('book', { book: id, page: 0 });
  }

  refreshSchedules() { for (const n of this.npcs) if (n.def.schedule) n.updateSchedule(true); }

  sleepAt(h, bed) {
    const s = this.state;
    if (s.hour >= h - 0.01) s.day++;
    s.hour = h;
    this.refreshSchedules();
    const d = this.derived();
    const p = s.player;
    p.hp = d.maxHp; p.stamina = d.maxStamina; p.mana = d.maxMana;
    this.player.hot.length = 0;
    if (bed?.rent) s.flags.roomRented = false;
    this.addBuff({ id: 'rested', name: 'Отдохнувший', stamRegen: 1.3, time: 900 });
    this.ui.close();
    this.ui.fadeScreen(1.2);
    this.save(false);
    this.ui.bigText(h < 11 ? 'Утро' : h < 16 ? 'Полдень' : 'Вечер', `День ${s.day} · вы отдохнувший: выносливость восстанавливается быстрее`, 'loc');
  }

  sleepUntilMorning() {
    const s = this.state;
    if (s.hour > 7) s.day++;
    s.hour = 7;
    this.fullHeal();
    this.save(false);
    this.ui.bigText('Утро', 'Вы хорошо выспались', 'loc');
  }

  canFastTravel() {
    return !this.enemies.some((e) => e.alive && (e.state === 'chase' || e.state === 'attack' || e.state === 'strafe') && e.pos.distanceTo(this.player.pos) < 40);
  }

  fastTravel(id) {
    const a = this.structures.altars.find((x) => x.id === id);
    if (!a) return;
    if (!this.canFastTravel() && !this.ui.menuData?.travel) { this.ui.hint('Нельзя переместиться рядом с врагами'); return; }
    this.ui.close();
    if (this.player.mount) this.player.dismount();
    if (this.mount.summoned) this.mount.dismiss();
    const p = a.pos;
    const off = new THREE.Vector3(3.8, 0, 3.8);
    this.player.setPosition(p.x + off.x, this.collision.groundHeight(p.x + off.x, p.z + off.z, p.y + 3) + 0.1, p.z + off.z, Math.atan2(-off.x, -off.z));
    this.cam.yaw = this.player.yaw;
    this.cam.focus.copy(this.player.pos);
    this.state.lastAltar = id;
    this.effects.burst(this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe6a0', 50, 4, 0.35, 1.2);
    this.audio.play('altar');
    this.ui.bigText(a.name, '', 'loc');
  }

  // ---------- combat hooks ----------
  hittables() { return this._hit || (this._hit = []); }

  hitStop(t) { this.hitStopT = Math.max(this.hitStopT, t); }

  onBossAggro(b) {
    this.boss = b;
    const f = this.state.flags;
    if (f['intro_' + b.typeId]) return;
    f['intro_' + b.typeId] = true;
    const subs = {
      gart: ['Гарт, вожак Чёрной Лисы', 'Тот, кто продаёт свет за золото'],
      golem: ['Хрустальный Страж', 'Проснувшийся хранитель озёрного берега'],
      morgrim: ['Моргрим, Рыцарь Сумрака', 'Светлый рыцарь, которого поглотила тьма'],
    }[b.typeId];
    if (!subs) return;
    const e = b.pos, h = b.height;
    const p = this.player.pos;
    const dir = Math.atan2(p.x - e.x, p.z - e.z);
    const P = (a, r, y) => [e.x + Math.sin(dir + a) * r, e.y + y, e.z + Math.cos(dir + a) * r];
    this.playCine({
      keys: [
        { pos: P(0.9, h * 2.6 + 4, h * 0.6), look: [e.x, e.y + h * 0.6, e.z] },
        { pos: P(0.35, h * 1.6 + 2.5, h * 0.75), look: [e.x, e.y + h * 0.75, e.z] },
        { pos: P(0.05, h * 1.3 + 2, h * 0.85), look: [e.x, e.y + h * 0.8, e.z] },
      ],
      dur: 3.6, freeze: true, title: subs,
    });
  }

  // training dummy: never dies, shows damage and counts combos
  makeDummy(pos) {
    const g = this;
    return {
      isDummy: true, alive: true, pos: pos.clone(), radius: 0.4, height: 2, name: 'Чучело', combo: 0, lastHit: -9,
      takeHit(dmg, src, opts = {}) {
        g.ui.damageNumber(new THREE.Vector3(this.pos.x, this.pos.y + 2.3, this.pos.z), dmg, opts.crit ? 'crit' : 'enemy');
        this.combo = g.time - this.lastHit < 1.6 ? this.combo + 1 : 1;
        this.lastHit = g.time;
        this.total = (this.combo > 1 ? this.total : 0) + dmg;
        if (this.combo >= 3) g.ui.combatText(`Серия ×${this.combo} · ${Math.round(this.total)} урона`, '#fff2c0', true);
        g.effects.dust(this.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 6);
        g.audio.play('hit', 0.6);
        return { hit: true };
      },
    };
  }

  // ---------- cinematics: camera keyframes, letterbox, subtitles ----------
  playCine(c) {
    this.cine = { t: 0, ...c };
    this.ui.letterbox(true);
    if (c.title) setTimeout(() => this.ui.bigText(c.title[0], c.title[1], 'boss'), 400);
    this.cine.lineIdx = -1;
  }

  updateCine(dt) {
    const c = this.cine;
    c.t += dt;
    const k = Math.min(1, c.t / c.dur);
    const n = c.keys.length - 1;
    const f = k * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
    const e = u * u * (3 - 2 * u);
    const A = c.keys[i], Bk = c.keys[i + 1];
    const lerp3 = (a, b) => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
    this.camera.position.set(...lerp3(A.pos, Bk.pos));
    this.camera.lookAt(...lerp3(A.look, Bk.look));
    if (c.lines) {
      const li = Math.min(c.lines.length - 1, Math.floor(k * c.lines.length));
      if (li !== c.lineIdx) { c.lineIdx = li; this.ui.subtitle(c.lines[li]); }
    }
    const skip = this.input.hit('Space') || this.input.hit('Enter') || this.input.hit('Escape');
    if (k >= 1 || (skip && c.t > 0.6)) {
      this.cine = null;
      this.ui.letterbox(false);
      this.ui.subtitle(null);
      if (c.onEnd) c.onEnd();
    }
  }

  introCine() {
    const sp = this.player.pos;
    const C0 = this.castle.spawn.heart;
    this.playCine({
      keys: [
        { pos: [C0.x + 120, C0.y + 40, C0.z + 160], look: [C0.x, C0.y - 10, C0.z] },
        { pos: [C0.x + 40, C0.y - 10, C0.z + 260], look: [C0.x, C0.y - 20, C0.z] },
        { pos: [sp.x + 60, sp.y + 60, sp.z - 120], look: [sp.x, sp.y + 10, sp.z] },
        { pos: [sp.x + 6, sp.y + 4, sp.z - 9], look: [sp.x, sp.y + 1.4, sp.z] },
      ],
      dur: 20,
      lines: [
        'Эфирия. Край бесконечных лугов, белых башен и тёплого света.',
        'Тысячу лет над Люменхолдом сияет Сердце Света, и Сумрак не смеет пересечь горы.',
        'Но в последние недели Сердце тускнеет. Три Осколка Рассвета похищены.',
        'А на цветущем лугу, среди ромашек, просыпается странник, не помнящий своего имени...',
      ],
    });
  }

  onEnemyKilled(e) {
    const s = this.state;
    s.stats.kills++;
    s.bestiary = s.bestiary || {};
    s.bestiary[e.typeId] = (s.bestiary[e.typeId] || 0) + 1;
    const T = e.T;
    const glim = Math.round(T.xp * (1 + (s.player.level - 1) * 0.05));
    s.player.glimmer += glim;
    this.ui.notify(`Сияние <b>+${glim}</b>`, '<span class="gl" style="width:18px;height:18px;margin:4px"></span>');
    if (T.gold[1] > 0) this.addGold(T.gold[0] + Math.floor(Math.random() * (T.gold[1] - T.gold[0] + 1)));
    for (const [id, ch, n] of T.loot) if (Math.random() < ch) this.giveItem(id, n);
    this.quests.event('kill', { kinds: T.kinds, type: e.typeId });
    if (e.unique) {
      s.killed.push(e.unique);
      this.ui.setBoss(null);
      this.boss = null;
      this.ui.bigText('Враг повержен', e.name, 'victory');
      this.audio.play('quest');
      if (T.shard) this.interact.addShard(e.pos, T.shard);
      if (e.typeId === 'morgrim') setTimeout(() => this.ui.hint('Тьма рассеивается... В последний миг глаза Моргрима посветлели. «Спасибо», — шепчет он.', 7), 2500);
    }
    if (this.player.lockTarget === e) this.player.lockTarget = null;
  }

  onAnimalKilled(a) {
    if (a.A.owned) {
      const fine = Math.min(this.state.gold, 30);
      this.state.gold -= fine;
      this.ui.notify(`<b>${a.A.owned}:</b> «Эй! Это же моя ${a.species === 'cow' ? 'корова' : 'овца'}!»`);
      if (fine) this.ui.hint(`Вы заплатили хозяйке ${fine} золотых за скотину.`);
    }
    for (const [id, ch, n] of a.A.loot) if (Math.random() < ch) this.giveItem(id, n);
    this.state.player.glimmer += a.A.xp;
  }

  onPlayerDeath() {
    const s = this.state;
    s.stats.deaths++;
    this.audio.play('death');
    this.ui.setBoss(null);
    if (this.boss) { this.boss.setState('return'); this.boss = null; }
    // drop glimmer
    if (s.player.glimmer > 0) {
      s.lostGlimmer = { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, amount: s.player.glimmer };
      s.player.glimmer = 0;
      if (this.terrain.getHeight(s.lostGlimmer.x, s.lostGlimmer.z) < WORLD.water - 1) {
        const a = this.structures.altars.find((x) => x.id === s.lastAltar);
        s.lostGlimmer.x = a.pos.x + 5; s.lostGlimmer.z = a.pos.z; s.lostGlimmer.y = a.pos.y;
      }
    } else s.lostGlimmer = null;
    this.mode = 'dead';
    this.input.exitLock();
    setTimeout(() => { if (this.mode === 'dead') this.ui.open('death'); }, 2200);
  }

  respawn() {
    const s = this.state;
    const a = this.structures.altars.find((x) => x.id === s.lastAltar) || this.structures.altars[0];
    this.mode = 'respawning';
    this.ui.close();
    this.player.revive();
    const off = new THREE.Vector3(3.8, 0, 3.8);
    this.player.setPosition(a.pos.x + off.x, this.collision.groundHeight(a.pos.x + off.x, a.pos.z + off.z, a.pos.y + 3) + 0.1, a.pos.z + off.z, Math.atan2(-off.x, -off.z));
    this.cam.yaw = this.player.yaw;
    this.fullHeal();
    s.player.satiety = Math.max(s.player.satiety, 40);
    for (const e of this.enemies) if (!e.alive || e.state !== 'idle') e.respawn();
    this.interact.setLostGlimmer(s.lostGlimmer);
    this.mode = 'play';
    this.input.requestLock();
    this.ui.bigText('Свет возвращается', a.name, 'loc');
  }

  spawnProjectile(o) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color).multiplyScalar(o.arrow ? 1 : 3), transparent: true, opacity: 0.95 });
    let mesh;
    if (o.arrow) {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x8a6246 }));
      mesh.rotation.x = Math.PI / 2;
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(o.size, 12, 8), mat);
    }
    g.add(mesh);
    g.position.copy(o.from);
    g.lookAt(o.from.clone().add(o.dir));
    this.scene.add(g);
    this.projectiles.push({ ...o, obj: g, pos: o.from.clone(), vel: o.dir.clone().multiplyScalar(o.speed), t: 0 });
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.t += dt;
      if (pr.homing && pr.homing.alive !== false) {
        const tgt = pr.homing.pos;
        const want = new THREE.Vector3(tgt.x, tgt.y + (pr.homing.height || 1.6) * 0.55, tgt.z).sub(pr.pos).normalize().multiplyScalar(pr.speed);
        pr.vel.lerp(want, Math.min(1, dt * (pr.homingStrength || 3)));
      }
      pr.pos.addScaledVector(pr.vel, dt);
      pr.obj.position.copy(pr.pos);
      pr.obj.lookAt(pr.pos.clone().add(pr.vel));
      if (!pr.arrow && Math.random() < 0.8) {
        if (pr.owner === p) this.effects.motes(pr.pos, pr.color, 1, 0.1, 0.2, 0.4, 0.25);
        else this.effects.motes(pr.pos, pr.color, 1, 0.1, 0.2, 0.5, 0.2);
      }
      let dead = pr.t > pr.life;
      if (this.terrain.getHeight(pr.pos.x, pr.pos.z) > pr.pos.y) dead = true;
      if (!dead && this.camera.position.distanceTo(pr.pos) < 400) {
        const list = this.collision.query(pr.pos.x, pr.pos.z, 0.2, this._pq || (this._pq = []));
        for (const c of list) {
          if (c.type === 'ramp' || pr.pos.y < c.y0 || pr.pos.y > c.y1) continue;
          if (this.collision.surfaceAt(c, pr.pos.x, pr.pos.z, 0) !== -Infinity) { dead = true; break; }
        }
      }
      if (!dead) {
        if (pr.owner === p) {
          for (const t of this.hittables()) {
            if (!t.alive) continue;
            const dx = t.pos.x - pr.pos.x, dz = t.pos.z - pr.pos.z, dy = t.pos.y + t.height * 0.5 - pr.pos.y;
            if (dx * dx + dz * dz < (t.radius + 0.5) ** 2 && Math.abs(dy) < t.height * 0.6 + 0.5) {
              t.takeHit(pr.dmg, p, { spell: true, poise: 1.5 });
              this.effects.burst(pr.pos, '#fff1b8', 30, 5, 0.35, 0.6);
              this.audio.play('hit', 0.6);
              dead = true;
              break;
            }
          }
        } else {
          const dx = p.pos.x - pr.pos.x, dz = p.pos.z - pr.pos.z, dy = p.pos.y + 1 - pr.pos.y;
          if (dx * dx + dz * dz < 0.55 * 0.55 + 0.2 && Math.abs(dy) < 1.1 && p.state !== 'dead') {
            const res = p.takeHit(pr.dmg, pr.owner, { projectile: true });
            if (!res.dodged) { dead = true; this.effects.sparks(pr.pos, pr.color, 12, 4); }
          }
        }
      }
      if (dead) {
        if (!pr.arrow) this.effects.burst(pr.pos, pr.color, 14, 3, 0.3, 0.5);
        this.scene.remove(pr.obj);
        this.projectiles.splice(i, 1);
      }
    }
  }

  spawnShockwave(pos, radius, color) {
    const m = new THREE.Mesh(this.shockGeo, this.shockMat.clone());
    m.material.color.set(color);
    m.position.copy(pos);
    m.position.y = this.collision.groundHeight(pos.x, pos.z, pos.y + 1) + 0.15;
    this.scene.add(m);
    this.shockwaves.push({ m, t: 0, r: radius });
  }

  updateShockwaves(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.t += dt;
      const k = s.t / 0.55;
      s.m.scale.setScalar(0.5 + k * s.r);
      s.m.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.scene.remove(s.m); s.m.material.dispose(); this.shockwaves.splice(i, 1); }
    }
  }

  callMount() {
    if (!this.state.flags.hasMount) { this.ui.hint('У вас пока нет верного скакуна.'); return; }
    if (this.player.mount) { this.player.dismount(); return; }
    if (this.player.motor.swimming) return;
    if (this.inCastle(this.player.pos)) { this.ui.hint('Астра не любит тесные стены замка.'); return; }
    if (this.enemies.some((e) => e.alive && e.boss && e.state !== 'idle' && e.pos.distanceTo(this.player.pos) < 60)) { this.ui.hint('Астра боится сумрачных чудовищ.'); return; }
    if (!this.mount.summoned || this.mount.pos.distanceTo(this.player.pos) > 12) this.mount.summon();
    this.player.mountUp(this.mount);
  }

  inCastle(p) { return Math.abs(p.x - CASTLE.x) < 76 && Math.abs(p.z - CASTLE.z) < 72 && p.y > CASTLE.y - 2; }

  // ---------- story finale ----------
  restoreHeart() {
    this.takeItem('dawn_shard', 3);
    this.state.flags.heartRestored = true;
    this.quests.setStage('main2', 3);
    this.quests.complete('main2');
    this.audio.play('levelup');
    this.audio.setMood('triumph');
    this.cam.shake(0.6);
    this.effects.burst(this.castle.spawn.heart, '#fff1c9', 200, 14, 0.8, 2.5);
    this.ui.bigText('Сердце Света', 'вновь сияет над Эфирией', 'victory');
    { const H0 = this.castle.spawn.heart;
      this.playCine({ keys: [
        { pos: [H0.x + 8, H0.y - 4, H0.z + 12], look: [H0.x, H0.y, H0.z] },
        { pos: [H0.x + 40, H0.y + 10, H0.z + 60], look: [H0.x, H0.y + 20, H0.z] },
        { pos: [H0.x + 120, H0.y - 20, H0.z + 260], look: [H0.x, H0.y + 40, H0.z] },
      ], dur: 11, lines: ['Три осколка возвращаются туда, где родились.', 'Свет поднимается над башнями, и его видно из каждого уголка Эфирии.', 'Луга вспыхивают цветом. Сумрак отступает за горы.'] }); }
    setTimeout(() => {
      this.giveItem('dawn_blade', 1);
      this.giveItem('heart_amulet', 1);
      this.addGold(500);
      this.quests.start('main3');
      this.ui.hint('Магистр Орвин: «Невероятно... Иди к королеве — она должна услышать это от тебя».', 7);
    }, 2500);
    this.save(false);
  }

  // ---------- save / load / flow ----------
  save(verbose) {
    this.state.player.x = this.player.pos.x;
    this.state.player.y = this.player.pos.y;
    this.state.player.z = this.player.pos.z;
    const ok = saveGame(this.state);
    if (verbose) this.ui.hint(ok ? 'Игра сохранена' : 'Не удалось сохранить (хранилище браузера недоступно)');
    try { window.claude?.hot?.snapshot?.(() => ({ state: this.state })); } catch (e) { /* ignore */ }
    return ok;
  }

  loadSaved() {
    const s = loadGame();
    if (!s) { this.ui.hint('Сохранение не найдено'); return; }
    this.ui.close();
    this.applyState(s);
    this.startPlay();
  }

  newGame() {
    setTimeout(() => { if (this.mode === 'play') this.introCine(); }, 50);
    this.applyState(newState());
    const p = this.player;
    p.setPosition(START.x, this.collision.groundHeight(START.x, START.z, 200) + 0.1, START.z, START.yaw);
    this.cam.yaw = START.yaw;
    this.cam.pitch = 0.12;
    this.cam.focus.set(p.pos.x, p.pos.y + 1.5, p.pos.z);
    this.ui.close();
    this.startPlay();
    this.intro = 0;
    setTimeout(() => this.ui.bigText('Цветущие луга', 'Королевство Эфирия', 'loc'), 800);
    setTimeout(() => this.ui.hint('Поговорите с паломницей Ивой (E). Мышь — обзор, WASD — движение.', 7), 4500);
    this.state.locations.push('meadow');
  }

  continueGame() {
    const s = loadGame();
    if (!s) { this.newGame(); return; }
    this.ui.close();
    this.applyState(s);
    this.startPlay();
  }

  startPlay() {
    this.mode = 'play';
    this.ui.hud.classList.remove('hidden');
    this.input.requestLock();
    this.audio.init();
    this.audio.resume();
  }

  toTitle() {
    this.save(false);
    this.ui.close();
    this.mode = 'title';
    this.ui.hud.classList.add('hidden');
    this.ui.open('title');
    this.input.exitLock();
  }

  onMenuChange(closed) {
    if (this.mode === 'title' || this.mode === 'loading' || this.mode === 'dead' || this.mode === 'respawning') return;
    if (this.ui.isOpen()) {
      this.mode = 'menu';
      this.input.exitLock();
    } else {
      this.mode = 'play';
      this.input.requestLock();
    }
    this.ui.hud.classList.toggle('in-menu', !!this.ui.menu);
    this.ui.hud.classList.toggle('in-dialog', !!this.ui.dialogState);
  }

  // ---------- settings ----------
  setQuality(q) {
    this.settings.quality = q;
    this.q = QUALITY[q];
    this.saveSettings();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(innerWidth, innerHeight);
    this.bloom.enabled = this.q.bloom;
    this.sky.sun.castShadow = this.q.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.veg.grassRadius = this.q.grassRadius;
    this.veg.quality = { ...this.veg.quality, grassDensity: this.q.grassDensity, flowerDensity: this.q.flowerDensity, lodDist: this.q.lodDist };
    this.veg.grassMat.userData.uRadius.value = this.q.grassRadius;
    for (const [k, g] of this.veg.chunks) { this.veg.group.remove(g); }
    this.veg.chunks.clear();
    this.veg.lastChunkKey = null;
    this.effects.setScale(this.renderer.domElement.height);
    this.ui.hint('Плотность деревьев изменится после перезагрузки страницы.');
  }

  toggleSetting(k) {
    this.settings[k] = !this.settings[k];
    this.saveSettings();
    this.input.invertY = this.settings.invertY;
    if (!this.settings.showFps) this.ui.setFPS(0);
  }

  setSetting(k, v) {
    this.settings[k] = v;
    this.saveSettings();
    this.input.sensitivity = this.settings.sens;
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.audio.setVolumes(this.settings.music, this.settings.sfx);
  }

  // ---------- map ----------
  renderMapImage(size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    const R = WORLD.playRadius + 60;
    const col = this.terrain.mesh.geometry.attributes.color;
    const n = this.terrain.seg + 1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const wx = (x / size) * 2 * R - R, wz = (y / size) * 2 * R - R;
        const i = Math.round((wx + this.terrain.half) / this.terrain.step), j = Math.round((wz + this.terrain.half) / this.terrain.step);
        const k = j * n + i;
        let r = col.getX(k), g = col.getY(k), b = col.getZ(k);
        const h = this.terrain.heights[k];
        const hx = this.terrain.h(i + 1, j) - this.terrain.h(i - 1, j);
        const hz = this.terrain.h(i, j + 1) - this.terrain.h(i, j - 1);
        let shade = 1 + (-hx - hz) * 0.035;
        shade = clamp(shade, 0.6, 1.35);
        if (h < WORLD.water) { r = 0.55; g = 0.8; b = 0.92; shade = 1; }
        const fd = forestDensity(wx, wz);
        if (fd > 0.45 && h > WORLD.water) { r *= 0.8; g *= 0.9; b *= 0.8; }
        const o = (y * size + x) * 4;
        // parchment tint + gamma
        img.data[o] = clamp(Math.pow(r * shade, 1 / 2.2) * 255 * 0.92 + 18, 0, 255);
        img.data[o + 1] = clamp(Math.pow(g * shade, 1 / 2.2) * 255 * 0.92 + 16, 0, 255);
        img.data[o + 2] = clamp(Math.pow(b * shade, 1 / 2.2) * 255 * 0.9 + 14, 0, 255);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // castle outline
    const toMap = (x, z) => [((x + R) / (2 * R)) * size, ((z + R) / (2 * R)) * size];
    const [cx, cy] = toMap(CASTLE.x - 75, CASTLE.z - 70);
    const [cx2, cy2] = toMap(CASTLE.x + 75, CASTLE.z + 70);
    ctx.fillStyle = 'rgba(255,252,245,0.9)';
    ctx.strokeStyle = '#b08a2a';
    ctx.lineWidth = 2;
    ctx.fillRect(cx, cy, cx2 - cx, cy2 - cy);
    ctx.strokeRect(cx, cy, cx2 - cx, cy2 - cy);
    // vignette border
    const grd = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
    grd.addColorStop(0, 'rgba(250,240,220,0)');
    grd.addColorStop(1, 'rgba(230,215,190,0.85)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    return cv;
  }

  // ==================================================================
  // loop
  // ==================================================================
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT > 0.5) {
      if (this.settings.showFps) this.ui.setFPS(Math.round(this.frames / this.fpsT));
      this.frames = 0; this.fpsT = 0;
    }
    try {
      this.update(dt);
      this.render();
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; this.ui?.hint('Ошибка: ' + e.message, 10); }
    }
    this.input.endFrame();
  }

  update(realDt) {
    // hitstop
    let dt = realDt;
    if (this.hitStopT > 0) { this.hitStopT -= realDt; dt = realDt * 0.08; }
    const m = this.input.consumeMouse();
    this.time += dt;
    const s = this.state;
    const playing = this.mode === 'play' || this.mode === 'menu' || this.mode === 'dead';

    if (this.mode === 'title') {
      this.titleT += realDt;
      const a = this.titleT * 0.05 + 2.2;
      const R = 230;
      this.camera.position.set(CASTLE.x + Math.sin(a) * R, CASTLE.y + 70 + Math.sin(this.titleT * 0.1) * 10, CASTLE.z + Math.cos(a) * R);
      this.camera.lookAt(CASTLE.x, CASTLE.y + 30, CASTLE.z);
      s.hour = 17.2;
      this.sky.update(realDt, s.hour, this.camera, this.camera.position);
      this.veg.update(this.camera.position, this.time);
      this.water.update(realDt, this.time);
      this.castle.elevator.update(realDt, this.time);
      this.castle.heart.update(realDt, this.time, 0, false);
      this.effects.update(realDt, this.camera.position, { night: false, flowers: 0, wild: false, gloom: 0 });
      for (const b of this.birds) b.update(realDt, this.time);
      for (const f of this.structures.animated) f(realDt, this.time);
      this.updateLampsAndLights();
      return;
    }
    if (this.mode === 'loading') return;

    // world time (1 game hour = 50 s)
    if (this.mode === 'play') {
      s.hour += realDt / 50;
      if (s.hour >= 24) { s.hour -= 24; s.day++; }
      s.stats.time += realDt;
      for (let i = s.buffs.length - 1; i >= 0; i--) { s.buffs[i].time -= realDt; if (s.buffs[i].time <= 0) s.buffs.splice(i, 1); }
    }

    // hittables list
    const hl = this.hittables();
    hl.length = 0;
    for (const e of this.enemies) if (e.alive && !e.sleeping) hl.push(e);
    for (const a of this.animals) if (a.alive && !a.sleeping) hl.push(a);
    if (!this.dummies) this.dummies = (this.castle.spawn.dummies || []).map((p) => this.makeDummy(p));
    for (const d of this.dummies) if (Math.abs(d.pos.x - this.player.pos.x) + Math.abs(d.pos.z - this.player.pos.z) < 12) hl.push(d);

    // player & camera
    if (this.mode !== 'menu' || this.ui.dialogState) this.player.update(this.mode === 'menu' ? 0 : dt);
    this.mount.update(dt);
    this.cam.update(realDt, this.mode === 'play' ? m : { dx: 0, dy: 0, wheel: 0 });
    if (this.cine) this.updateCine(realDt);
    if (this.debugCam) {
      this.camera.position.set(...this.debugCam.pos);
      this.camera.lookAt(...this.debugCam.look);
    }

    const pp = this.player.pos;
    // entities (active radius)
    for (const e of this.enemies) {
      const d = Math.abs(e.pos.x - pp.x) + Math.abs(e.pos.z - pp.z);
      const active = d < 230 || e.state === 'chase' || e.state === 'return';
      e.sleeping = !active;
      if (e.alive || e.body.root.visible) {
        e.body.root.visible = (d < 320 || e.state !== 'idle') && (e.alive || e.deathT < 3.5);
      }
      if (active && this.mode !== 'menu') e.update(this.cine?.freeze ? 0 : dt);
    }
    for (const a of this.animals) {
      const d = Math.abs(a.pos.x - pp.x) + Math.abs(a.pos.z - pp.z);
      a.sleeping = d > 200;
      a.body.root.visible = d < 260 && (a.alive || a.deathT < 6);
      if (!a.sleeping && this.mode !== 'menu') a.update(dt);
    }
    for (const sw of this.swans || []) sw.update(realDt, pp);
    for (const r of this.riders || []) {
      const d = Math.abs(r.pos.x - pp.x) + Math.abs(r.pos.z - pp.z);
      r.setVisible(d < 240);
      if (d < 180 || r.path) r.update(this.mode === 'menu' ? 0 : realDt);
    }
    for (const n of this.npcs) {
      const d = Math.abs(n.pos.x - pp.x) + Math.abs(n.pos.z - pp.z);
      if (n.def.schedule && Math.random() < 0.03) n.updateSchedule();
      n.setVisible(d < 200 && !n.hidden && !n.offDuty);
      if (n.hidden || n.offDuty) continue;
      if (d < 130 && (this.mode !== 'menu' || n.talking)) n.update(this.mode === 'menu' && !n.talking ? 0 : realDt);
    }
    // enemy separation
    for (let i = 0; i < hl.length; i++) {
      const a = hl[i];
      if (a.sleeping) continue;
      for (let j = i + 1; j < hl.length; j++) {
        const b = hl[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const r = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (r - d) * 0.5;
          a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
        }
      }
    }
    if (this.mode === 'play') {
      this.interact.update(dt, this.time);
      this.tutorial.update(realDt);
      this.updateProjectiles(dt);
    }
    this.updateShockwaves(dt);

    // world systems
    this.sky.update(realDt, s.hour, this.camera, pp);
    this.veg.update(this.camera.position, this.time);
    this.water.update(realDt, this.time);
    this.river.update(realDt, this.time, pp);
    this.falls.update(realDt);
    this.forestShafts.update(realDt, this.camera.position, this.sky.sunDir, this.sky.daylight * (1 - (this.weather.darken || 0) * 2), this.sky.gloom || 0);
    if (this.mode === 'play' || this.mode === 'menu') this.weather.update(realDt, this.camera.position, this.sky.sunDir, this.sky.daylight, this.effects, this.audio, (this.indoor || 0) > 0.5);
    this.castle.elevator.update(dt, this.time);
    this.castle.heart.update(realDt, this.time, this.shardCount() > 0 && s.quests.main2?.stage === 2 ? 3 : 0, !!s.flags.heartRestored);
    for (const b of this.birds) b.update(realDt, this.time);
    for (const f of this.structures.animated) f(realDt, this.time);
    for (const f of this.castle.animated) f(realDt, this.time);
    // region
    this.regionT -= realDt;
    if (this.regionT <= 0) { this.regionT = 0.5; this.updateRegion(); }
    this.effects.update(dt, pp, this.env);
    this.butterflies.update(realDt, this.time, pp, this.terrain, !this.sky.isNight() && this.env.flowers > 0.2);
    this.updateLampsAndLights();
    this.updateMusic();
    this.encounterSpawner(realDt); this.nightSpawner(realDt);
    this.ui.update(realDt);
  }

  // innermost named location containing the point (for regional music)
  regionAt(p) {
    let best = null, br = 1e9;
    for (const L of LOCATIONS) {
      if (Math.hypot(p.x - L.x, p.z - L.z) < L.r && L.r < br) { br = L.r; best = L.id; }
    }
    return best || 'wild';
  }

  updateRegion() {
    const s = this.state;
    const p = this.player.pos;
    for (const L of LOCATIONS) {
      if (s.locations.includes(L.id)) continue;
      if (Math.hypot(p.x - L.x, p.z - L.z) < L.r * 0.8) {
        s.locations.push(L.id);
        this.ui.locationTitle(L.name);
        this.audio.play('altar', 0.6);
        for (const qid of Object.keys(s.quests)) this.quests.check(qid);
      }
    }
    const cd = Math.hypot(p.x - CRAG.x, p.z - CRAG.z);
    const gloomTarget = s.killed.includes('morgrim') ? 0 : clamp(1 - (cd - 60) / 160, 0, 1);
    this.env = {
      sunUp: this.sky.sunDir.y,
      night: this.sky.isNight(),
      flowers: meadowFlowers(p.x, p.z) * (1 - forestDensity(p.x, p.z)),
      wild: !this.inCastle(p),
      gloom: gloomTarget,
      region: this.regionAt(p),
    };
  }

  updateLightPool(night, t) {
    const cp = this.camera.position;
    const anchors = this.lightAnchors;
    for (const a of anchors) {
      const dx = a.pos.x - cp.x, dy = a.pos.y - cp.y, dz = a.pos.z - cp.z;
      a._d = Math.sqrt(dx * dx + dy * dy + dz * dz) - a.dist;
    }
    const pool = this.lightPool;
    const want = anchors.filter((a) => a._d < 45 && (!a.cond || a.cond(this))).sort((a, b) => a._d - b._d).slice(0, pool.length);
    for (const l of pool) if (l.userData.anchor && !want.includes(l.userData.anchor)) l.userData.anchor = null;
    for (const a of want) {
      if (pool.some((l) => l.userData.anchor === a)) continue;
      const free = pool.find((l) => !l.userData.anchor);
      if (!free) break;
      free.userData.anchor = a;
      free.position.copy(a.pos);
      free.color.set(a.color);
      free.distance = a.dist;
      free.userData.fade = 0;
    }
    for (const l of pool) {
      const a = l.userData.anchor;
      if (!a) { l.intensity = 0; continue; }
      l.userData.fade = Math.min(1, (l.userData.fade || 0) + 0.05);
      // fade out as the anchor approaches the edge of the selection radius
      const edge = Math.min(1, Math.max(0, (45 - a._d) / 15));
      const fl = 1 + Math.sin(t * 9 + a.pos.x * 3.1) * 0.04 + (a.flicker ? Math.sin(t * 17 + a.pos.z) * a.flicker : 0);
      l.intensity = a.intensity * (0.55 + night * 0.7 + this.indoor * 0.6) * fl * edge * l.userData.fade;
    }
  }

  updateLampsAndLights() {
    const night = 1 - this.sky.daylight;
    // indoor detection: a roof/ceiling close above the player
    const pp = this.player.pos;
    const ceil = this.collision.ceilingAt(pp.x, pp.z, pp.y + 2.0);
    const indoorT = ceil - pp.y < 22 && this.mode !== 'title' ? 1 : 0;
    this.indoor = damp(this.indoor || 0, indoorT, 3, 0.016);
    const k = this.indoor;
    this.sky.hemi.intensity *= 1 - k * 0.55;
    this.sky.ambient.intensity *= 1 - k * 0.4;
    this.scene.environmentIntensity = 0.6 * (1 - k * 0.5) * (0.4 + this.sky.daylight * 0.6);
    this.renderer.toneMappingExposure = 1.0 + k * 0.18;
    const t = this.time;
    this.lampMat.opacity = night * 0.9;
    const M = getMaterials();
    M.lamp.emissiveIntensity = 0.3 + night * 3.2;
    M.window.emissiveIntensity = 0.12 + night * 1.6;
    M.stained.emissiveIntensity = 0.25 + night * 0.9;
    this.updateLightPool(night, t);
    const restored = this.state.flags.heartRestored ? 1 : 0;
    this.heartLight.intensity = 20 + restored * 140 + night * 30;
    this.heartLight.color.setRGB(0.85 + restored * 0.15, 0.8 + restored * 0.15, 1 - restored * 0.25);
    this.heartLight.distance = 60 + restored * 120;
    // gloom
    const env = this.env || { gloom: 0 };
    this.sky.gloom = damp(this.sky.gloom, Math.max(env.gloom * 0.85, (this.weather?.darken || 0) * 0.55), 1.5, 0.05);
    this.sky.brightBoost = restored;
    if (this.shafts) {
      const sd = this.sky.sunDir;
      const sp = this._sunV || (this._sunV = new THREE.Vector3());
      sp.copy(this.camera.position).addScaledVector(sd, 1000).project(this.camera);
      const camDir = this._camDir || (this._camDir = new THREE.Vector3());
      this.camera.getWorldDirection(camDir);
      const facing = camDir.dot(sd);
      const onScreen = sp.z < 1 && facing > 0 ? Math.max(0, 1 - Math.max(0, Math.max(Math.abs(sp.x), Math.abs(sp.y)) - 0.9) * 1.6) : 0;
      const lowSun = 0.55 + (1 - Math.min(1, Math.max(0, sd.y) * 1.4)) * 0.8;
      const U = this.shafts.uniforms;
      U.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
      U.uAspect.value = innerWidth / innerHeight;
      U.uIntensity.value = onScreen * lowSun * (sd.y > -0.03 ? 1 : 0) * (1 - this.sky.gloom) * (this.settings.quality === 'low' ? 0 : 1);
      U.uFlare.value = onScreen * (sd.y > 0 ? 1 : 0) * (1 - this.sky.gloom);
      U.uTint.value.copy(this.sky.state.light);
      this.shafts.enabled = U.uIntensity.value > 0.001 || U.uFlare.value > 0.001;
    }
    if (this.grade) {
      this.grade.uniforms.uGloom.value = this.sky.gloom;
      this.grade.uniforms.uTime.value = t % 100;
      this.grade.uniforms.uWarm.value.set(1.02 + restored * 0.02, 1.0, 1.03 - night * 0.0 + night * 0.04);
    }
  }

  updateMusic() {
    const a = this.audio;
    if (!a.ctx) return;
    a.update();
    const night = this.sky.isNight();
    const reg = this.env?.region || 'wild';
    const REG = { castle: 'court', forest: 'forest', lake: 'lake', ruins: 'lake', village: 'village', hermit: 'village', camp: 'camp' };
    let mood = REG[reg] && !(night && reg !== 'forest' && reg !== 'camp') ? REG[reg] : night ? 'night' : 'day';
    { const q = this.player.pos, cx = q.x - CASTLE.x, cz = q.z - CASTLE.z; if (cx > -68 && cx < -48 && cz > 22 && cz < 38 && (this.indoor || 0) > 0.5) mood = 'tavern'; }
    if (this.state.flags.heartRestored && this.quests.active('main3')) mood = 'triumph';
    if (this.env?.gloom > 0.4) mood = 'dark';
    const p = this.player.pos;
    if (this.enemies.some((e) => e.alive && !e.sleeping && (e.state === 'chase' || e.state === 'attack' || e.state === 'strafe') && e.pos.distanceTo(p) < 35)) mood = 'combat';
    if (this.boss && this.boss.alive && this.boss.state !== 'idle' && this.boss.state !== 'return') mood = 'boss';
    a.setMood(mood);
    // ambience one-shots (birds by day, crickets & wolves by night) — muted indoors
    const inside = (this.indoor || 0) > 0.5;
    this._ambT = (this._ambT || 0) - 0.016;
    if (this._ambT <= 0) {
      this._ambT = 2 + Math.random() * 4;
      if (this.mode === 'play' && !inside) {
        if (!this.sky.isNight() && this.env?.wild) a.play('bird', 0.8);
        else if (this.sky.isNight()) { a.play('cricket', 1); if (Math.random() < 0.08 && this.env?.wild) a.play('wolf', 0.6); }
      }
    }
    // ambience beds
    const playing = this.mode === 'play' || this.mode === 'menu';
    const dWater = this.river ? this.river.distTo(p) : 999;
    a.setLoop('water', playing ? Math.max(0, 1 - dWater / 70) * 0.09 : 0);
    const alt = p.y - this.terrain.getHeight(p.x, p.z);
    a.setLoop('wind', playing ? (inside ? 0.004 : 0.012 + Math.min(1, Math.max(0, (p.y - 70) / 90)) * 0.05 + Math.min(1, Math.max(0, alt - 8) / 30) * 0.03) : 0);
    const cl = { x: p.x - CASTLE.x, z: p.z - CASTLE.z };
    const inTavern = cl.x > -68 && cl.x < -48 && cl.z > 22 && cl.z < 38;
    const h = this.state.hour;
    const evening = h > 17 || h < 2;
    a.setLoop('crowd', playing && inTavern ? (evening ? 0.05 : 0.018) : 0);
    // fire crackle near hearths and campfires
    this._fireT = (this._fireT || 0) - 0.016;
    if (this._fireT <= 0) {
      this._fireT = 0.25 + Math.random() * 0.4;
      let near = 99;
      for (const f of this.effects.fireSources) { const d = Math.abs(f.pos.x - p.x) + Math.abs(f.pos.z - p.z) + Math.abs(f.pos.y - p.y); if (d < near) near = d; }
      if (near < 9 && this.mode === 'play') a.play('crackle', Math.max(0.2, 1 - near / 9));
      if (inTavern && evening && Math.random() < 0.12 && this.mode === 'play' && !this.state.flags.florian_gone) a.play('lute', 0.8);
    }
  }

  // daytime random encounters on the roads and in the wilds
  encounterSpawner(dt) {
    if (this.mode !== 'play' || this.cine) return;
    this._pruneT = (this._pruneT || 0) - dt;
    if (this._pruneT <= 0) {
      this._pruneT = 5;
      const dead = this.enemies.filter((e) => e.transient && !e.alive && e.deathT > 5);
      for (const e of dead) { e.remove(); this.enemies.splice(this.enemies.indexOf(e), 1); }
    }
    this.encT = (this.encT ?? 120) - dt;
    if (this.encT > 0) return;
    this.encT = 150 + Math.random() * 120;
    const p = this.player.pos;
    if (this.sky.isNight() || !this.env?.wild || this.player.mount || this.duel) return;
    if (Math.hypot(p.x, p.z - MEADOW.z) < 110 || this.enemies.some((e) => e.alive && e.pos.distanceTo(p) < 40)) return;
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * 38, z = p.z + Math.sin(a) * 38;
    if (this.terrain.getHeight(x, z) < WORLD.water + 1 || this.inCastle(new THREE.Vector3(x, 100, z))) return;
    const r = Math.random();
    let types, msg;
    if (r < 0.4 && !this.state.killed.includes('gart')) { types = ['bandit', 'bandit', 'archer']; msg = 'Засада! Разбойники Чёрной Лисы перекрыли дорогу.'; }
    else if (r < 0.6) { types = ['boar']; msg = 'Из кустов с хрюканьем вылетает разъярённый вепрь!'; }
    else if (r < 0.8) { types = ['wolf', 'wolf', 'wolf']; msg = 'Стая волков вышла на охоту.'; }
    else {
      // a lucky find instead of a fight
      const finds = [['herb', 3], ['iron_ore', 2], ['light_crystal', 1], ['potion_hp', 1], ['honey', 2]];
      const [id, n] = finds[Math.floor(Math.random() * finds.length)];
      const gold = 10 + Math.floor(Math.random() * 30);
      this.giveItem(id, n); this.addGold(gold);
      this.ui.hint(`У дороги лежит брошенная сумка путника: ${ITEMS[id].name} ×${n} и ${gold} золотых.`);
      this.audio.play('coin');
      return;
    }
    const list = types.map((t, i) => {
      const ex = x + (i - 1) * 2.5, ez = z + (i % 2) * 2;
      const e = new Enemy(this, t, new THREE.Vector3(ex, this.terrain.getHeight(ex, ez), ez));
      e.transient = true; e.leash = 80;
      this.enemies.push(e);
      return e;
    });
    for (const e of list) e.pack = list;
    list[0].aggro();
    this.ui.hint(msg);
  }

  nightSpawner(dt) {
    if (this.mode !== 'play') return;
    this.nightSpawnT -= dt;
    if (this.nightSpawnT > 0) return;
    this.nightSpawnT = 90 + Math.random() * 60;
    if (!this.sky.isNight() || !this.env?.wild || this.player.mount) return;
    const p = this.player.pos;
    if (Math.hypot(p.x - 0, p.z - MEADOW.z) < 120) return; // meadow is safe-ish
    const a = Math.random() * Math.PI * 2;
    const x = p.x + Math.cos(a) * 45, z = p.z + Math.sin(a) * 45;
    if (this.terrain.getHeight(x, z) < WORLD.water + 1 || this.inCastle(new THREE.Vector3(x, 100, z))) return;
    // reuse a dead wolf if any; otherwise spawn (cap)
    const list = [];
    for (let i = 0; i < 2; i++) {
      const e = new Enemy(this, 'darkwolf', new THREE.Vector3(x + i * 2, this.terrain.getHeight(x + i * 2, z), z));
      e.transient = true;
      this.enemies.push(e);
      list.push(e);
    }
    for (const e of list) { e.pack = list; e.leash = 90; }
    list[0].aggro();
    this.ui.hint('Из темноты доносится вой...');
    this.audio.play('wolf');
    // prune old transient
    const trans = this.enemies.filter((e) => e.transient && !e.alive && e.deathT > 5);
    for (const e of trans) { e.remove(); this.enemies.splice(this.enemies.indexOf(e), 1); }
  }

  render() {
    if (this.bloom.enabled) this.composer.render();
    else {
      // keep grade + output even without bloom
      this.composer.render();
    }
  }
}

// boot
const game = new Game();
window.__game = game;
try {
  const hot = window.claude?.hot;
  if (hot?.snapshot) hot.snapshot(() => ({ state: game.state }));
} catch (e) { /* optional */ }
game.init().catch((e) => {
  console.error(e);
  const p = document.querySelector('#loading p');
  if (p) { p.className = 'err'; p.textContent = 'Не удалось запустить игру: ' + e.message + '. Нужен браузер с поддержкой WebGL2.'; }
});
