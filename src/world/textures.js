// Procedural canvas textures (no external assets needed)
import * as THREE from 'three';
import { mulberry32 } from '../engine/noise.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function finish(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(repeat, repeat);
  return t;
}

// Derive a tangent-space normal map from the luminance of a canvas (bright = raised)
export function normalFromCanvas(src, strength = 2.5, blur = 1) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const data = sctx.getImageData(0, 0, w, h).data;
  const hgt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hgt[i] = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) / 255;
  if (blur) {
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 0;
      for (let k = -1; k <= 1; k++) a += hgt[y * w + ((x + k + w) % w)];
      tmp[y * w + x] = a / 3;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 0;
      for (let k = -1; k <= 1; k++) a += tmp[((y + k + h) % h) * w + x];
      hgt[y * w + x] = a / 3;
    }
  }
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = hgt[y * w + ((x - 1 + w) % w)], r = hgt[y * w + ((x + 1) % w)];
      const u = hgt[((y - 1 + h) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const o = (y * w + x) * 4;
      img.data[o] = (nx / len * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz / len * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(ctx, w, h, rnd, amount, alpha) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rnd() * 60);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

// Light stone blocks (castle walls). World-uv: 1 unit = 1/4 tex
export function stoneTexture() {
  const s = 512, c = canvas(s), ctx = c.getContext('2d');
  const rnd = mulberry32(7);
  ctx.fillStyle = '#b9b0a8';
  ctx.fillRect(0, 0, s, s);
  const rows = 8, rh = s / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -rh * 0.8 : 0;
    while (x < s) {
      const bw = rh * (1.4 + rnd() * 1.2);
      const v = 232 + Math.floor(rnd() * 20);
      const tint = rnd() < 0.15 ? [v, v - 7, v - 1] : rnd() < 0.2 ? [v - 5, v - 3, v + 3] : [v, v - 4, v - 10];
      ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
      const k = 5;
      const x0 = x + 3, y0 = r * rh + 3, x1 = x + bw - 3, y1 = r * rh + rh - 3;
      ctx.beginPath();
      ctx.moveTo(x0 + k, y0); ctx.lineTo(x1 - k, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + k);
      ctx.lineTo(x1, y1 - k); ctx.quadraticCurveTo(x1, y1, x1 - k, y1); ctx.lineTo(x0 + k, y1);
      ctx.quadraticCurveTo(x0, y1, x0, y1 - k); ctx.lineTo(x0, y0 + k); ctx.quadraticCurveTo(x0, y0, x0 + k, y0);
      ctx.fill();
      // bevel light (top-left) and shade (bottom-right)
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.18, 'rgba(255,255,255,0.0)');
      g.addColorStop(0.85, 'rgba(0,0,0,0.0)');
      g.addColorStop(1, 'rgba(60,40,50,0.18)');
      ctx.fillStyle = g;
      ctx.fill();
      // subtle surface mottling
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,250,245' : '120,110,120'},${0.04 + rnd() * 0.05})`;
        ctx.beginPath();
        ctx.ellipse(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 4 + rnd() * 14, 3 + rnd() * 8, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      x += bw;
    }
  }
  speckle(ctx, s, s, rnd, 7000, 0.16);
  const t = finish(c);
  t.userData = { normal: normalFromCanvas(c, 3.2) };
  return t;
}

export function cobbleTexture() {
  const s = 512, c = canvas(s), ctx = c.getContext('2d');
  const rnd = mulberry32(11);
  ctx.fillStyle = '#b3aaa2';
  ctx.fillRect(0, 0, s, s);
  const rows = 12, rh = s / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * rh * 0.5 - rh;
    while (x < s + rh) {
      const w = rh * (0.8 + rnd() * 0.6);
      const v = 222 + Math.floor(rnd() * 26);
      ctx.fillStyle = `rgb(${v},${v - 5},${v - 10})`;
      ctx.beginPath();
      const x0 = x + 2 + rnd() * 2, x1 = x + w - 2 - rnd() * 2;
      const y0 = r * rh + 2 + rnd() * 2, y1 = r * rh + rh - 2 - rnd() * 2;
      const k = 5;
      ctx.moveTo(x0 + k, y0); ctx.lineTo(x1 - k, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + k);
      ctx.lineTo(x1, y1 - k); ctx.quadraticCurveTo(x1, y1, x1 - k, y1); ctx.lineTo(x0 + k, y1);
      ctx.quadraticCurveTo(x0, y1, x0, y1 - k); ctx.lineTo(x0, y0 + k); ctx.quadraticCurveTo(x0, y0, x0 + k, y0);
      ctx.fill();
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0.07)');
      ctx.fillStyle = g;
      ctx.fill();
      x += w;
    }
  }
  speckle(ctx, s, s, rnd, 5000, 0.12);
  const t = finish(c);
  t.userData = { normal: normalFromCanvas(c, 3.5) };
  return t;
}

export function roofTexture() {
  const s = 256, c = canvas(s), ctx = c.getContext('2d');
  const rnd = mulberry32(5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  const rows = 8, rh = s / rows, cw = s / 8;
  for (let r = 0; r < rows; r++) {
    for (let i = -1; i <= 8; i++) {
      const x = i * cw + (r % 2 ? cw / 2 : 0);
      const y = r * rh;
      const v = 215 + Math.floor(rnd() * 40);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cw, y);
      ctx.lineTo(x + cw, y + rh * 0.6);
      ctx.quadraticCurveTo(x + cw / 2, y + rh * 1.25, x, y + rh * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const hg = ctx.createLinearGradient(0, y, 0, y + rh);
      hg.addColorStop(0, 'rgba(0,0,0,0.12)');
      hg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.fill();
    }
  }
  const t = finish(c);
  t.userData = { normal: normalFromCanvas(c, 4) };
  return t;
}

export function woodTexture() {
  const s = 256, c = canvas(s), ctx = c.getContext('2d');
  const rnd = mulberry32(3);
  ctx.fillStyle = '#e8d8c4';
  ctx.fillRect(0, 0, s, s);
  const planks = 6, pw = s / planks;
  for (let p = 0; p < planks; p++) {
    const v = 220 + Math.floor(rnd() * 30);
    ctx.fillStyle = `rgb(${v},${v - 12},${v - 26})`;
    ctx.fillRect(p * pw + 1, 0, pw - 2, s);
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = `rgba(90,60,30,${0.08 + rnd() * 0.1})`;
      ctx.beginPath();
      const x = p * pw + rnd() * pw;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + rnd() * 6 - 3, s * 0.3, x + rnd() * 6 - 3, s * 0.6, x, s);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,40,20,0.35)';
    ctx.fillRect(p * pw, 0, 1.5, s);
  }
  const t = finish(c);
  t.userData = { normal: normalFromCanvas(c, 2) };
  return t;
}

export function barkTexture() {
  const s = 128, c = canvas(s), ctx = c.getContext('2d');
  const rnd = mulberry32(21);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * s;
    ctx.strokeStyle = `rgba(60,40,30,${0.1 + rnd() * 0.25})`;
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + rnd() * 8 - 4, s);
    ctx.stroke();
  }
  return finish(c);
}

// soft radial sprite (for particles / glows)
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const s = 64, c = canvas(s), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.5)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function petalTexture() {
  const s = 32, c = canvas(s), ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(s / 2, s / 2, s * 0.22, s * 0.42, 0.5, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function waterNormalTexture() {
  const s = 256, c = canvas(s), ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const hgt = new Float32Array(s * s);
  const rnd = mulberry32(17);
  const waves = [];
  for (let i = 0; i < 18; i++) {
    waves.push({ fx: Math.floor(rnd() * 6) - 3 || 1, fy: Math.floor(rnd() * 6) - 3 || 2, a: 0.3 + rnd(), p: rnd() * 6.28 });
  }
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let h = 0;
      for (const w of waves) h += Math.sin(((x * w.fx + y * w.fy) / s) * Math.PI * 2 + w.p) * w.a;
      hgt[y * s + x] = h;
    }
  }
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const hl = hgt[y * s + ((x - 1 + s) % s)], hr = hgt[y * s + ((x + 1) % s)];
      const hu = hgt[((y - 1 + s) % s) * s + x], hd = hgt[((y + 1) % s) * s + x];
      let nx = (hl - hr) * 0.35, ny = (hu - hd) * 0.35, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const o = (y * s + x) * 4;
      img.data[o] = (nx * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function fabricTexture() {
  const s = 64, c = canvas(s), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < s; i += 4) ctx.fillRect(i, 0, 2, s);
  return finish(c);
}
