import * as THREE from 'three';
import { waterNormalTexture } from './textures.js';
import { WORLD, LAKE } from './layout.js';

let sharedMat = null;
export function waterMaterial() {
  if (sharedMat) return sharedMat;
  const n = waterNormalTexture();
  n.repeat.set(24, 24);
  sharedMat = new THREE.MeshStandardMaterial({
    color: 0x9fdcf0,
    roughness: 0.06,
    metalness: 0.15,
    transparent: true,
    opacity: 0.8,
    normalMap: n,
    normalScale: new THREE.Vector2(0.35, 0.35),
    envMapIntensity: 1.2,
    depthWrite: false,
  });
  return sharedMat;
}

export class Water {
  constructor(scene) {
    const mat = waterMaterial();
    const g = new THREE.CircleGeometry(1, 96);
    g.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(g, mat);
    lake.scale.set(LAKE.rx * 1.25, 1, LAKE.rz * 1.25);
    lake.position.set(LAKE.x, WORLD.water, LAKE.z);
    lake.receiveShadow = true;
    lake.renderOrder = 2;
    scene.add(lake);
    this.meshes = [lake];
    this.mat = mat;
  }

  addDisc(scene, x, y, z, r) {
    const g = new THREE.CircleGeometry(r, 32);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, this.mat);
    m.position.set(x, y, z);
    m.renderOrder = 2;
    scene.add(m);
    this.meshes.push(m);
    return m;
  }

  update(dt, t) {
    const off = this.mat.normalMap.offset;
    off.x = (t * 0.004) % 1;
    off.y = (t * 0.0065) % 1;
  }
}
