// Sky dome, sun/moon, stars, clouds, lighting & fog driven by time of day.
import * as THREE from 'three';
import { Clouds } from './clouds.js';
import { mulberry32, clamp } from '../engine/noise.js';

const KEYS = [
  // hour, top, horizon, fog, light color, light intensity, hemi sky, hemi ground, hemi int, stars, cloud
  [0, '#0a1030', '#28306a', '#262d5c', '#9fb4ff', 0.6, '#4a5ab0', '#2a2448', 0.62, 1, '#3d4478'],
  [4.5, '#141a48', '#4a3f80', '#3d3a72', '#a9b4ff', 0.5, '#5561b0', '#302a50', 0.6, 0.9, '#4d4a82'],
  [6, '#6a88d8', '#ffb2a8', '#efbcc6', '#ffbd90', 1.6, '#ffd0dc', '#8e7e76', 0.7, 0.1, '#ffcad0'],
  [7.5, '#6aa0f0', '#ffd4d8', '#f2d8e4', '#ffdcb0', 2.8, '#e2e2ff', '#a0a07c', 0.72, 0, '#fff0ea'],
  [10, '#5a92ec', '#f0e0f4', '#e4e0f4', '#fff0dc', 3.5, '#c4d8ff', '#a6ae84', 0.72, 0, '#ffffff'],
  [14, '#5890ec', '#f2e2f2', '#e6e0f2', '#fff3e4', 3.6, '#c4d8ff', '#aab284', 0.72, 0, '#ffffff'],
  [16.5, '#6a8ce2', '#ffd6cc', '#f0d6dc', '#ffd9a8', 3.0, '#e8d8ff', '#a8a07a', 0.72, 0, '#fff0e2'],
  [18, '#5256b4', '#ff96b0', '#e6a4bc', '#ff9a80', 1.6, '#ffbad4', '#8a7078', 0.7, 0.05, '#ffb2c6'],
  [19.3, '#26286c', '#84509a', '#654a88', '#b9a0ff', 0.6, '#7a6cc8', '#3a3058', 0.62, 0.55, '#7d6aa6'],
  [21, '#0e1444', '#2e2e6c', '#2c3266', '#9fb4ff', 0.6, '#4a5ab0', '#2a2448', 0.62, 0.95, '#454b80'],
  [24, '#0a1030', '#28306a', '#262d5c', '#9fb4ff', 0.6, '#4a5ab0', '#2a2448', 0.62, 1, '#3d4478'],
].map((k) => ({
  h: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), fog: new THREE.Color(k[3]),
  light: new THREE.Color(k[4]), li: k[5], hs: new THREE.Color(k[6]), hg: new THREE.Color(k[7]), hi: k[8],
  stars: k[9], cloud: new THREE.Color(k[10]),
}));

export class Sky {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.hour = 8;
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      moonDir: { value: new THREE.Vector3(0, -1, 0) },
      sunColor: { value: new THREE.Color(1, 0.9, 0.8) },
      sunVis: { value: 1 },
      moonVis: { value: 0 },
      gloom: { value: 0 },
      uTime: { value: 0 },
      night: { value: 0 },
      cirrus: { value: 1 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * p;
          gl_Position.z = gl_Position.w; // far plane
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDir; uniform vec3 moonDir;
        uniform vec3 sunColor; uniform float sunVis; uniform float moonVis; uniform float gloom; uniform float uTime; uniform float cirrus; uniform float night;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
        float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.5));
          col = mix(col, horizonColor * 0.92, smoothstep(0.0, -0.25, h));
          // soft lavender band in the middle sky and a warm glow along the horizon on the sun's side
          col = mix(col, col * vec3(1.03, 0.97, 1.07), smoothstep(0.08, 0.3, h) * (1.0 - smoothstep(0.3, 0.65, h)) * 0.8);
          vec3 sh = normalize(vec3(sunDir.x, 0.0, sunDir.z) + 1e-4);
          float az = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), sh), 0.0);
          float low = 1.0 - smoothstep(0.05, 0.5, sunDir.y);
          col += sunColor * pow(az, 4.0) * (1.0 - smoothstep(0.0, 0.35, abs(h))) * 0.35 * low * sunVis;
          // high cirrus: wispy streaks drifting slowly, lit by the sun
          if (h > 0.02 && cirrus > 0.0) {
            vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
            float c = fbm(vec2(uv.x * 0.6, uv.y * 2.2));
            c = smoothstep(0.52, 0.85, c) * smoothstep(0.02, 0.2, h) * (1.0 - smoothstep(0.6, 0.95, h));
            vec3 cc = mix(vec3(1.0), sunColor * 1.2, 0.35 + low * 0.5);
            col = mix(col, cc * (0.75 + sunVis * 0.35), c * 0.45 * cirrus);
          }
          // night: milky way with nebula tints, a shimmering aurora over the northern peaks
          if (night > 0.01 && h > -0.05) {
            vec3 ax = normalize(vec3(0.35, 0.55, -0.76));
            float band = 1.0 - abs(dot(d, ax));
            float mw = pow(band, 7.0);
            vec2 mp = vec2(atan(d.z, d.x) * 3.0, d.y * 6.0);
            float dust = fbm(mp * 1.6);
            float neb = fbm(mp * 0.7 + 3.1);
            vec3 mwc = mix(vec3(0.55, 0.5, 0.95), vec3(0.95, 0.7, 0.9), neb) * (0.35 + dust * 0.9);
            col += mwc * mw * smoothstep(-0.05, 0.2, h) * 0.55 * night * (1.0 - smoothstep(0.35, 0.55, dust) * 0.5);
            col += vec3(0.35, 0.2, 0.55) * pow(band, 3.0) * neb * 0.12 * night;
            float north = smoothstep(0.1, 0.8, -d.z);
            float wave = sin(d.x * 7.0 + uTime * 0.25 + sin(d.x * 3.0 - uTime * 0.12) * 1.5);
            float curtain = smoothstep(0.02, 0.1, h) * (1.0 - smoothstep(0.12 + wave * 0.05, 0.42 + wave * 0.08, h));
            float streak = 0.55 + 0.45 * sin(d.x * 60.0 + uTime * 0.6 + wave * 2.0);
            vec3 auc = mix(vec3(0.35, 1.0, 0.75), vec3(0.8, 0.45, 1.0), smoothstep(0.1, 0.35, h));
            col += auc * curtain * streak * north * 0.32 * night;
          }
          float sd = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.45) * sunVis;
          col += sunColor * smoothstep(0.9993, 0.9997, sd) * 6.0 * sunVis;
          float md = max(dot(d, moonDir), 0.0);
          col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99955, 0.99975, md) * 2.2 + pow(md, 120.0) * 0.25) * moonVis;
          col += vec3(0.7, 0.75, 1.0) * (pow(md, 900.0) * 0.6 + pow(md, 40.0) * 0.06) * moonVis * (0.5 + night * 0.5);
          col = mix(col, col * vec3(0.72, 0.6, 0.9), gloom);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 64, 32), skyMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // stars
    const rnd = mulberry32(55);
    const N = 4000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rnd(), v = rnd() * 0.95 + 0.05;
      const th = u * Math.PI * 2, ph = Math.acos(v);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 2500;
      pos[i * 3 + 1] = Math.cos(ph) * 2500;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 2500;
      const t = rnd();
      // coloured stars: blue-white, lilac, rose and warm gold
      const tint = [[0.8, 0.88, 1], [0.9, 0.8, 1], [1, 0.82, 0.92], [1, 0.92, 0.75], [1, 1, 1]][i % 5];
      const br = 0.75 + t * 0.25;
      col[i * 3] = tint[0] * br; col[i * 3 + 1] = tint[1] * br; col[i * 3 + 2] = tint[2] * br;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starMat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    scene.add(this.stars);

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality.shadows;
    const sz = quality.shadowSize || 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    const ext = quality.shadowExtent || 70;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.9;
    this.shadowExt = ext;
    this.shadowRes = sz;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xdde8ff, 0xb7c98f, 1.1);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(this.ambient);

    scene.fog = new THREE.Fog(0xdde9f8, 160, 1900);

    // clouds (billboard cumulus)
    this.cloudSys = new Clouds(scene);

    this.state = {
      top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), light: new THREE.Color(),
      li: 1, hs: new THREE.Color(), hg: new THREE.Color(), hi: 1, stars: 0, cloud: new THREE.Color(),
    };
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.daylight = 1;
    this.gloom = 0; // darkening near the crag / during boss
    this.brightBoost = 0; // after restoring heart
  }

  isNight() { return this.hour < 5.5 || this.hour > 19.5; }

  sample(hour) {
    let a = KEYS[0], b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (hour >= KEYS[i].h && hour <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const t = (hour - a.h) / (b.h - a.h || 1);
    const s = this.state;
    s.top.copy(a.top).lerp(b.top, t);
    s.hor.copy(a.hor).lerp(b.hor, t);
    s.fog.copy(a.fog).lerp(b.fog, t);
    s.light.copy(a.light).lerp(b.light, t);
    s.li = a.li + (b.li - a.li) * t;
    s.hs.copy(a.hs).lerp(b.hs, t);
    s.hg.copy(a.hg).lerp(b.hg, t);
    s.hi = a.hi + (b.hi - a.hi) * t;
    s.stars = a.stars + (b.stars - a.stars) * t;
    s.cloud.copy(a.cloud).lerp(b.cloud, t);
    return s;
  }

  update(dt, hour, camera, focus) {
    this.hour = hour;
    const s = this.sample(hour);
    // sun path: rises east (+x), noon high south
    const th = ((hour - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(th), Math.sin(th) * 0.95, 0.32).normalize();
    this.moonDir.set(-Math.cos(th) * 0.9, -Math.sin(th) * 0.9, -0.25).normalize();
    const sunUp = this.sunDir.y;
    this.daylight = clamp(sunUp * 4 + 0.3, 0, 1);

    const g = this.gloom;
    const U = this.uniforms;
    U.uTime.value = (U.uTime.value + 0.016) % 100000;
    U.topColor.value.copy(s.top);
    U.horizonColor.value.copy(s.hor);
    U.sunDir.value.copy(this.sunDir);
    U.moonDir.value.copy(this.moonDir);
    U.sunColor.value.copy(s.light);
    U.sunVis.value = clamp(sunUp * 8 + 0.4, 0, 1);
    U.moonVis.value = clamp(-sunUp * 6, 0, 1);
    U.gloom.value = g;
    this.starMat.opacity = s.stars * (1 - g * 0.5) * (0.85 + Math.sin(U.uTime.value * 2.3) * 0.08);
    U.night.value = s.stars * (1 - g * 0.7);

    // main directional light follows the sun by day and the moon by night
    const lightDir = sunUp > -0.05 ? this.sunDir : this.moonDir;
    const lift = Math.max(lightDir.y, 0.18);
    const ld = new THREE.Vector3(lightDir.x, lift, lightDir.z).normalize();
    this.sun.color.copy(s.light);
    this.sun.intensity = s.li * (1 - g * 0.45) * (1 + this.brightBoost * 0.12);
    // snap shadow camera to texel grid to reduce shimmer
    const texel = (this.shadowExt * 2) / this.shadowRes;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + ld.x * 250, focus.y + ld.y * 250, fz + ld.z * 250);
    this.sun.target.updateMatrixWorld();

    this.hemi.color.copy(s.hs);
    this.hemi.groundColor.copy(s.hg);
    this.hemi.intensity = s.hi * (1 - g * 0.3);
    this.ambient.intensity = 0.06 + (1 - this.daylight) * 0.12;

    const fog = this.scene.fog;
    fog.color.copy(s.fog);
    if (g > 0) fog.color.lerp(new THREE.Color('#4a3a66'), g * 0.7);
    fog.near = 160 - g * 130;
    fog.far = 1900 - g * 1500;

    this.cloudSys.update(dt, camera.position, s, this.sunDir, fog.color, g);

    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.stars.rotation.y = hour * 0.02;
  }
}
