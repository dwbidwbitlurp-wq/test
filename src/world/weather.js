// Weather: clear skies, soft summer rain (followed by a rainbow) and petal storms.
// Rain streaks are animated fully on the GPU around the camera.
import * as THREE from 'three';

const RAIN_VS = `
  attribute float aEnd; attribute vec3 aSeed;
  uniform vec3 uCam; uniform float uTime; uniform vec3 uWind;
  varying float vA;
  void main() {
    const float W = 70.0; const float H = 36.0;
    vec3 p = aSeed;
    float fall = uTime * 18.0 * (0.85 + fract(aSeed.x * 7.13) * 0.3);
    p.y = mod(p.y - fall, H);
    vec3 wp;
    wp.x = uCam.x + mod(p.x - uCam.x + uWind.x * p.y * 0.1, W) - W * 0.5;
    wp.z = uCam.z + mod(p.z - uCam.z + uWind.z * p.y * 0.1, W) - W * 0.5;
    wp.y = uCam.y + p.y - H * 0.45;
    wp += (vec3(uWind.x, -18.0, uWind.z) * 0.035) * aEnd;
    vA = (1.0 - aEnd * 0.8) * (1.0 - smoothstep(18.0, 34.0, distance(wp.xz, uCam.xz)));
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`;
const RAIN_FS = `
  uniform float uAlpha; varying float vA;
  void main() { gl_FragColor = vec4(0.85, 0.9, 1.0, vA * uAlpha); }`;

const BOW_FS = `
  varying vec2 vUv; uniform float uAlpha;
  vec3 spectrum(float t) {
    return clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0);
  }
  void main() {
    float r = vUv.y; // 0 inner .. 1 outer
    vec3 c = spectrum(0.85 - r * 0.85);
    float band = smoothstep(0.0, 0.18, r) * (1.0 - smoothstep(0.82, 1.0, r));
    float ends = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
    float a = band * ends * uAlpha;
    gl_FragColor = vec4(mix(c, vec3(1.0), 0.25) * a, a);
  }`;
const BOW_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export class Weather {
  constructor(scene, quality) {
    const n = quality === 'low' ? 1200 : 2600;
    const pos = new Float32Array(n * 2 * 3), end = new Float32Array(n * 2), seed = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      const sx = Math.random() * 70, sy = Math.random() * 36, sz = Math.random() * 70;
      for (let k = 0; k < 2; k++) { const j = i * 2 + k; seed[j * 3] = sx; seed[j * 3 + 1] = sy; seed[j * 3 + 2] = sz; end[j] = k; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    this.rainMat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWind: { value: new THREE.Vector3(3, 0, 1.5) }, uAlpha: { value: 0 } },
    });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
    // rainbow arc (half ring) opposite to the sun
    const rg = new THREE.RingGeometry(0.86, 1.0, 96, 1, 0, Math.PI);
    // remap uvs: x = angle 0..1, y = radius 0..1
    const uv = rg.attributes.uv, p = rg.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      uv.setXY(i, Math.atan2(y, x) / Math.PI, (Math.hypot(x, y) - 0.86) / 0.14);
    }
    this.bowMat = new THREE.ShaderMaterial({ vertexShader: BOW_VS, fragmentShader: BOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uAlpha: { value: 0 } }, fog: false });
    this.bow = new THREE.Mesh(rg, this.bowMat);
    this.bow.visible = false;
    this.bow.renderOrder = -1;
    scene.add(this.bow);
    this.kind = 'clear';
    this.amount = 0; // 0..1 intensity of the current weather
    this.bowT = 0;
    this.nextChange = 400 + Math.random() * 400; // seconds
    this.t = 0;
  }

  set(kind) {
    if (kind === this.kind) return;
    if (this.kind === 'rain' && kind !== 'rain') this.bowT = 240; // rainbow after rain
    this.kind = kind;
  }

  update(dt, cam, sunDir, daylight, effects, audio, indoor) {
    this.t += dt;
    this.nextChange -= dt;
    if (this.nextChange <= 0) {
      const r = Math.random();
      this.set(this.kind !== 'clear' ? 'clear' : r < 0.45 ? 'rain' : r < 0.7 ? 'petals' : 'clear');
      this.nextChange = this.kind === 'clear' ? 500 + Math.random() * 600 : 140 + Math.random() * 160;
    }
    const target = this.kind === 'clear' ? 0 : 1;
    this.amount += (target - this.amount) * Math.min(1, dt * 0.25);
    if (this.kind !== 'clear') this.prevKind = this.kind;
    // rain
    const ra = this.kind === 'rain' || this.prevKind === 'rain' ? this.amount : 0;
    this.rain.visible = ra > 0.02;
    this.rainMat.uniforms.uAlpha.value = ra * 0.35 * (indoor ? 0.2 : 1);
    this.rainMat.uniforms.uTime.value = this.t;
    this.rainMat.uniforms.uCam.value.copy(cam);
    audio.setLoop('rain', ra * (indoor ? 0.03 : 0.08));
    // petals storm
    const pa = this.kind === 'petals' || this.prevKind === 'petals' ? this.amount : 0;
    if (pa > 0.05 && !indoor && daylight > 0.2) {
      const n = Math.floor(pa * 40 * dt + Math.random());
      for (let i = 0; i < n; i++) effects.petal?.(cam, pa);
    }
    // rainbow
    if (this.bowT > 0) this.bowT -= dt;
    const bowA = Math.min(1, this.bowT / 30) * Math.min(1, (240 - this.bowT) / 20) * daylight * (sunDir.y > 0.05 && sunDir.y < 0.75 ? 1 : 0);
    this.bow.visible = bowA > 0.01;
    if (this.bow.visible) {
      const anti = new THREE.Vector3(-sunDir.x, 0, -sunDir.z).normalize();
      this.bow.position.set(cam.x + anti.x * 1400, cam.y - 120 - sunDir.y * 500, cam.z + anti.z * 1400);
      this.bow.lookAt(cam.x, this.bow.position.y, cam.z);
      this.bow.scale.setScalar(820);
      this.bowMat.uniforms.uAlpha.value = bowA * 0.42;
    }
    this.darken = ra * 0.35;
    return { rain: ra, petals: pa };
  }
}
