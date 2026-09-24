// Keyboard + mouse input with pointer lock (and a drag-to-look fallback).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, buttons: new Set(), pressed: new Set(), released: new Set(), x: 0, y: 0 };
    this.locked = false;
    this.lockFailed = false;
    this.enabled = true;
    this.sensitivity = 1;
    this.invertY = false;
    this.onUnlock = null;
    this._dragLook = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code === 'F1' || (e.altKey && e.code !== 'Escape')) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.buttons.clear(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.buttons.add(e.button);
      this.mouse.pressed.add(e.button);
      if (!this.locked) this._dragLook = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (this.mouse.buttons.has(e.button)) this.mouse.released.add(e.button);
      this.mouse.buttons.delete(e.button);
      if (!this.mouse.buttons.size) this._dragLook = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.locked || this._dragLook) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.onUnlock) this.onUnlock();
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
  }

  requestLock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => { this.lockFailed = true; });
    } catch (e) { this.lockFailed = true; }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  key(code) { return this.down.has(code); }
  hit(code) { return this.pressed.has(code); }
  up(code) { return this.released.has(code); }
  btn(b) { return this.mouse.buttons.has(b); }
  click(b) { return this.mouse.pressed.has(b); }
  release(b) { return this.mouse.released.has(b); }

  consumeMouse() {
    const d = { dx: this.mouse.dx * this.sensitivity, dy: this.mouse.dy * this.sensitivity * (this.invertY ? -1 : 1), wheel: this.mouse.wheel };
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    return d;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.pressed.clear();
    this.mouse.released.clear();
  }
}
