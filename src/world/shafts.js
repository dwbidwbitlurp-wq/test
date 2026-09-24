// Volumetric-looking god rays in the forest: soft additive light shafts slanting
// along the sun direction, visible by day, gently breathing.
import * as THREE from 'three';

const VS = `
  varying vec2 vUv; varying float vFade; varying float vSeed;
  attribute float aSeed;
  uniform vec3 uCam;
  void main() {
    vUv = uv; vSeed = aSeed;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float d = distance(wp.xyz, uCam);
    vFade = smoothstep(6.0, 22.0, d) * (1.0 - smoothstep(140.0, 230.0, d));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FS = `
  varying vec2 vUv; varying float vFade; varying float vSeed;
  uniform float uTime; uniform float uStrength; uniform vec3 uColor;
  void main() {
    float edge = sin(vUv.x * 3.14159);
    edge = pow(edge, 2.2);
    float len = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    float streak = 0.75 + 0.25 * sin(vUv.x * 23.0 + vSeed * 7.0) * sin(vUv.x * 11.0 - uTime * 0.2 + vSeed);
    float breathe = 0.7 + 0.3 * sin(uTime * 0.35 + vSeed * 6.28);
    float a = edge * len * streak * breathe * vFade * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }`;

export class ForestShafts {
  constructor(scene, terrain, center, radius, count, density) {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.88, 0.62) }, uCam: { value: new THREE.Vector3() } },
    });
    const spots = [];
    let tries = 0;
    while (spots.length < count && tries++ < count * 20) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      if (density(x, z) < 0.35) continue;
      spots.push({ x, z, y: terrain.getHeight(x, z), w: 2.5 + Math.random() * 4, h: 18 + Math.random() * 14, seed: Math.random() });
    }
    // two crossed planes per shaft so it reads from any angle
    const n = spots.length * 2;
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    const seeds = new Float32Array(n);
    spots.forEach((s, i) => { seeds[i * 2] = s.seed; seeds[i * 2 + 1] = s.seed; });
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.spots = spots;
    this.mat = mat;
    this.t = 0;
    this.lastAz = null;
    this.orient(new THREE.Vector3(0.4, 0.8, 0.3));
  }

  orient(sunDir) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(sunDir.x, Math.max(0.35, sunDir.y), sunDir.z).normalize(); // shaft axis points toward the sun
    const baseQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    this.spots.forEach((sp, i) => {
      for (let k = 0; k < 2; k++) {
        const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * Math.PI / 2 + sp.seed * 3);
        q.copy(baseQ).multiply(spin);
        s.set(sp.w, sp.h, 1);
        p.set(sp.x, sp.y - 1, sp.z);
        m.compose(p, q, s);
        this.mesh.setMatrixAt(i * 2 + k, m);
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, cam, sunDir, daylight, gloom) {
    this.t += dt;
    const U = this.mat.uniforms;
    U.uTime.value = this.t;
    U.uCam.value.copy(cam);
    const low = 1 - Math.min(1, Math.max(0, sunDir.y - 0.25) / 0.6); // stronger with a lower, golden sun
    U.uStrength.value = daylight * (0.45 + low * 0.45) * (1 - gloom);
    this.mesh.visible = U.uStrength.value > 0.01;
    const az = Math.atan2(sunDir.x, sunDir.z);
    if (this.lastAz === null || Math.abs(az - this.lastAz) > 0.05) { this.lastAz = az; this.orient(sunDir); }
  }
}
