// Billboard cumulus clouds: soft puffs in clusters, lit from above, drifting.
import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';

function puffTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const rnd = mulberry32(3);
  const blobs = [];
  for (let i = 0; i < 9; i++) blobs.push([0.5 + (rnd() - 0.5) * 0.4, 0.5 + (rnd() - 0.5) * 0.35, 0.18 + rnd() * 0.16]);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s, v = y / s;
      let a = 0;
      for (const [bx, by, br] of blobs) {
        const d = Math.hypot(u - bx, v - by) / br;
        a += Math.max(0, 1 - d * d);
      }
      const edge = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) * 2);
      a = Math.min(1, a * 0.9) * Math.pow(edge, 0.6);
      a *= 0.85 + rnd() * 0.15;
      // brightness: lighter toward the top-left (sun side), darker toward bottom
      const lit = Math.min(1, Math.max(0, 1.0 - v * 0.9 + (0.5 - u) * 0.15));
      const o = (y * s + x) * 4;
      img.data[o] = lit * 255;
      img.data[o + 1] = lit * 255;
      img.data[o + 2] = lit * 255;
      img.data[o + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
}

const MAXC = 64;

export class Clouds {
  constructor(scene) {
    const rnd = mulberry32(911);
    const clusters = [];
    // sky clusters overhead + distant cloud banks on the horizon
    for (let c = 0; c < 46; c++) {
      const far = c >= 30;
      const a = rnd() * Math.PI * 2;
      const d = far ? 1500 + rnd() * 900 : 150 + rnd() * 1300;
      const W = far ? 260 + rnd() * 320 : 60 + rnd() * 140;
      const H = far ? 90 + rnd() * 130 : 26 + rnd() * 50;
      clusters.push({ x: Math.cos(a) * d, y: far ? 60 + rnd() * 120 : 230 + rnd() * 200, z: Math.sin(a) * d, W, H, speed: 1.5 + rnd() * 2.5, far });
    }
    this.clusters = clusters.slice(0, MAXC);
    const offs = [], size = [], shade = [], rot = [], cid = [];
    this.clusters.forEach((cl, ci) => {
      const n = cl.far ? 34 : 16 + Math.floor(rnd() * 12);
      for (let i = 0; i < n; i++) {
        // half ellipsoid with a flat base
        let x, y, z;
        do { x = rnd() * 2 - 1; y = rnd(); z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
        const core = 1 - Math.hypot(x, z) * 0.6;
        offs.push(x * cl.W * 0.5, y * cl.H * (0.6 + core * 0.6), z * cl.W * 0.35);
        size.push((cl.far ? 95 : 30) * (0.7 + core * 0.9 + rnd() * 0.5) * (cl.W / (cl.far ? 400 : 120)));
        shade.push(Math.min(1, y * 0.85 + 0.15 + rnd() * 0.1));
        rot.push(rnd() * Math.PI * 2);
        cid.push(ci);
      }
    });
    const count = size.length;
    const geo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    geo.index = plane.index;
    geo.setAttribute('position', plane.attributes.position);
    geo.setAttribute('uv', plane.attributes.uv);
    geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(new Float32Array(offs), 3));
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(new Float32Array(size), 1));
    geo.setAttribute('iShade', new THREE.InstancedBufferAttribute(new Float32Array(shade), 1));
    geo.setAttribute('iRot', new THREE.InstancedBufferAttribute(new Float32Array(rot), 1));
    geo.setAttribute('iCluster', new THREE.InstancedBufferAttribute(new Float32Array(cid), 1));
    geo.instanceCount = count;
    this.centers = [];
    for (let i = 0; i < MAXC; i++) this.centers.push(new THREE.Vector3());
    this.uniforms = {
      uTex: { value: puffTexture() },
      uCenters: { value: this.centers },
      uLit: { value: new THREE.Color(1, 1, 1) },
      uShadow: { value: new THREE.Color(0.7, 0.72, 0.85) },
      uSun: { value: new THREE.Color(1, 0.9, 0.8) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uFogColor: { value: new THREE.Color() },
      uFogFar: { value: 3000 },
      uOpacity: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        attribute vec3 iOffset; attribute float iSize; attribute float iShade; attribute float iRot; attribute float iCluster;
        uniform vec3 uCenters[${MAXC}];
        uniform vec3 uSunDir;
        varying vec2 vUv; varying float vShade; varying float vDepth; varying float vSunSide; varying float vY;
        void main() {
          vec3 center = uCenters[int(iCluster)] + iOffset;
          vec4 mv = modelViewMatrix * vec4(center, 1.0);
          float c = cos(iRot), s = sin(iRot);
          vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSize;
          mv.xy += p;
          gl_Position = projectionMatrix * mv;
          vUv = uv;
          vY = p.y / iSize + 0.5;
          vShade = iShade;
          vDepth = -mv.z;
          vec3 toC = normalize(center - cameraPosition);
          vSunSide = dot(toC, uSunDir);
        }`,
      fragmentShader: `
        uniform sampler2D uTex; uniform vec3 uLit; uniform vec3 uShadow; uniform vec3 uSun; uniform vec3 uFogColor; uniform float uFogFar; uniform float uOpacity;
        varying vec2 vUv; varying float vShade; varying float vDepth; varying float vSunSide; varying float vY;
        void main() {
          vec4 t = texture2D(uTex, vUv);
          float a = t.a * uOpacity;
          if (a < 0.01) discard;
          float sh = clamp(vShade * 0.7 + vY * 0.45 - 0.12, 0.0, 1.0);
          vec3 col = mix(uShadow, uLit, sh);
          // silver lining when looking toward the sun
          col += uSun * pow(max(vSunSide, 0.0), 6.0) * (1.0 - t.a) * 1.5;
          col += uSun * pow(sh, 4.0) * 0.18;
          float f = smoothstep(uFogFar * 0.35, uFogFar, vDepth);
          col = mix(col, uFogColor, f * 0.7);
          gl_FragColor = vec4(col, a * (1.0 - f * 0.3));
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -5;
    scene.add(this.mesh);
  }

  update(dt, camPos, s, sunDir, fogColor, gloom) {
    for (let i = 0; i < this.clusters.length; i++) {
      const c = this.clusters[i];
      c.x += c.speed * dt;
      if (c.x > 2600) c.x -= 5200;
      this.centers[i].set(c.x, c.y, c.z);
    }
    const U = this.uniforms;
    U.uLit.value.copy(s.cloud).multiplyScalar(1.12);
    U.uShadow.value.copy(s.hor).lerp(s.top, 0.35).multiplyScalar(0.92).lerp(s.cloud, 0.25);
    U.uSun.value.copy(s.light).multiplyScalar(Math.min(1, s.li / 3));
    U.uSunDir.value.copy(sunDir);
    U.uFogColor.value.copy(fogColor);
    U.uOpacity.value = 1 - gloom * 0.4;
  }
}
