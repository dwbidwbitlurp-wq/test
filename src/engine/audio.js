// Fully synthesized audio: SFX + generative light-fantasy music (WebAudio).
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.mood = 'day'; // day | night | combat | boss | dark | triumph
    this.nextNote = 0;
    this.step = 0;
    this.chordIdx = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.enabled = false; return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(c.destination);
    this.music = c.createGain();
    this.music.gain.value = this.musicVol * 0.35;
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxVol;
    // reverb
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.2);
    this.revGain = c.createGain();
    this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain);
    this.revGain.connect(this.master);
    this.music.connect(this.master);
    this.music.connect(this.reverb);
    this.sfx.connect(this.master);
    this.sfxRev = c.createGain();
    this.sfxRev.gain.value = 0.25;
    this.sfx.connect(this.sfxRev);
    this.sfxRev.connect(this.reverb);
    this.noiseBuf = this.makeNoise();
    this.nextNote = c.currentTime + 0.2;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.2);
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.1);
  }

  impulse(dur, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  makeNoise() {
    const c = this.ctx, len = c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------- primitives ----------
  tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.005, when = 0, dest = null, glide = 0, detune = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', when = 0, sweep = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  // ---------- sfx ----------
  play(name, vol = 1) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'swing': this.noise(0.22, { vol: 0.22 * vol, freq: 900, q: 0.8, sweep: 3, attack: 0.04 }); break;
      case 'heavy': this.noise(0.4, { vol: 0.3 * vol, freq: 400, q: 0.7, sweep: 4, attack: 0.08 }); break;
      case 'hit':
        this.noise(0.12, { vol: 0.35 * vol, freq: 1800, q: 0.9, type: 'bandpass' });
        this.tone(120, 0.18, { type: 'triangle', vol: 0.35 * vol, glide: 0.5 });
        break;
      case 'flesh': this.noise(0.15, { vol: 0.3 * vol, freq: 600, q: 1.2, sweep: 0.5 }); this.tone(90, 0.15, { type: 'sine', vol: 0.3 * vol, glide: 0.6 }); break;
      case 'crit':
        this.noise(0.2, { vol: 0.4 * vol, freq: 2400, q: 1 });
        this.tone(80, 0.4, { type: 'triangle', vol: 0.4 * vol, glide: 0.4 });
        this.tone(1320, 0.5, { type: 'sine', vol: 0.12 * vol });
        break;
      case 'block':
        [1250, 1870, 2630, 3310].forEach((f, i) => this.tone(f, 0.35 - i * 0.05, { type: 'sine', vol: 0.09 * vol }));
        this.noise(0.06, { vol: 0.2 * vol, freq: 3000, q: 2 });
        break;
      case 'parry':
        [880, 1320, 1760, 2640].forEach((f, i) => this.tone(f, 0.8, { type: 'sine', vol: 0.12 * vol, when: i * 0.02 }));
        this.noise(0.08, { vol: 0.3 * vol, freq: 4000, q: 3 });
        break;
      case 'roll': this.noise(0.3, { vol: 0.12 * vol, freq: 500, q: 0.6, sweep: 0.5, attack: 0.05 }); break;
      case 'jump': this.noise(0.15, { vol: 0.08 * vol, freq: 700, q: 0.8 }); break;
      case 'land': this.noise(0.12, { vol: 0.15 * vol, freq: 300, q: 0.8 }); this.tone(70, 0.12, { vol: 0.15 * vol }); break;
      case 'step': this.noise(0.06, { vol: 0.03 * vol, freq: 500 + Math.random() * 300, q: 1 }); break;
      case 'step_stone': this.noise(0.045, { vol: 0.04 * vol, freq: 1700 + Math.random() * 700, q: 1.4 }); this.noise(0.03, { vol: 0.03 * vol, freq: 300, q: 1, when: 0.01 }); break;
      case 'step_grass': this.noise(0.11, { vol: 0.028 * vol, freq: 900 + Math.random() * 500, q: 0.5, attack: 0.02 }); break;
      case 'step_water': this.noise(0.18, { vol: 0.05 * vol, freq: 1300 + Math.random() * 600, q: 0.6, sweep: 0.5, attack: 0.02 }); break;
      case 'hurt': this.tone(220, 0.25, { type: 'sawtooth', vol: 0.08 * vol, glide: 0.6 }); this.noise(0.15, { vol: 0.2 * vol, freq: 500 }); break;
      case 'pickup': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.12 * vol, when: i * 0.06 })); break;
      case 'coin': this.tone(1568, 0.12, { type: 'square', vol: 0.05 * vol }); this.tone(2093, 0.3, { type: 'square', vol: 0.05 * vol, when: 0.07 }); break;
      case 'ui': this.tone(660, 0.08, { type: 'triangle', vol: 0.08 * vol }); break;
      case 'uiOpen': this.tone(523, 0.12, { type: 'triangle', vol: 0.08 * vol }); this.tone(784, 0.18, { type: 'triangle', vol: 0.08 * vol, when: 0.05 }); break;
      case 'uiClose': this.tone(784, 0.1, { type: 'triangle', vol: 0.07 * vol }); this.tone(523, 0.15, { type: 'triangle', vol: 0.07 * vol, when: 0.05 }); break;
      case 'quest': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.9, { type: 'sine', vol: 0.12 * vol, when: i * 0.12 })); break;
      case 'levelup': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 1.2, { type: 'triangle', vol: 0.1 * vol, when: i * 0.09 })); break;
      case 'heal': [659, 880, 1109].forEach((f, i) => this.tone(f, 1.0, { type: 'sine', vol: 0.09 * vol, when: i * 0.08 })); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(0.08, { vol: 0.1 * vol, freq: 900, q: 2, when: i * 0.18 }); break;
      case 'magic':
        this.tone(880, 0.6, { type: 'sine', vol: 0.12 * vol, glide: 2 });
        this.tone(1320, 0.5, { type: 'triangle', vol: 0.06 * vol, glide: 1.5 });
        this.noise(0.4, { vol: 0.12 * vol, freq: 5000, q: 2, sweep: 0.5 });
        break;
      case 'explode': this.noise(0.6, { vol: 0.35 * vol, freq: 300, q: 0.5, sweep: 0.3 }); this.tone(60, 0.6, { vol: 0.35 * vol, glide: 0.5 }); break;
      case 'altar': [523, 784, 1047, 1568].forEach((f, i) => this.tone(f, 2.0, { type: 'sine', vol: 0.08 * vol, when: i * 0.15 })); break;
      case 'death': [392, 311, 262, 196].forEach((f, i) => this.tone(f, 1.6, { type: 'triangle', vol: 0.12 * vol, when: i * 0.35 })); break;
      case 'enemyDie': this.noise(0.5, { vol: 0.15 * vol, freq: 800, q: 0.5, sweep: 0.3 }); this.tone(330, 0.6, { type: 'sine', vol: 0.06 * vol, glide: 0.5 }); break;
      case 'wolf': this.tone(420, 1.4, { type: 'sine', vol: 0.06 * vol, glide: 1.4, attack: 0.3 }); this.tone(424, 1.4, { type: 'triangle', vol: 0.03 * vol, glide: 1.35, attack: 0.3 }); break;
      case 'growl': this.noise(0.5, { vol: 0.12 * vol, freq: 200, q: 3 }); this.tone(85, 0.5, { type: 'sawtooth', vol: 0.05 * vol }); break;
      case 'bird': {
        const f = 2200 + Math.random() * 1600;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(f * (1 + Math.random() * 0.2), 0.09, { type: 'sine', vol: 0.025 * vol, when: i * 0.12, glide: 1.3 });
        break;
      }
      case 'cricket': for (let i = 0; i < 4; i++) this.tone(4400, 0.03, { type: 'square', vol: 0.006 * vol, when: i * 0.05 }); break;
      case 'roar':
        this.noise(1.4, { vol: 0.35 * vol, freq: 250, q: 1.5, sweep: 0.6, attack: 0.2 });
        this.tone(70, 1.4, { type: 'sawtooth', vol: 0.12 * vol, glide: 0.7, attack: 0.2 });
        break;
      case 'gate': this.tone(110, 2.0, { type: 'sawtooth', vol: 0.08 * vol, glide: 0.5, attack: 0.3 }); this.noise(1.5, { vol: 0.1 * vol, freq: 600, q: 2 }); break;
      case 'door': this.tone(150 + Math.random() * 40, 0.55, { type: 'sawtooth', vol: 0.025 * vol, glide: 1.35, attack: 0.08 }); this.noise(0.35, { vol: 0.08 * vol, freq: 260, q: 1.5, attack: 0.05 }); this.noise(0.12, { vol: 0.12 * vol, freq: 180, q: 1, when: 0.45 }); break;
      case 'page': this.noise(0.25, { vol: 0.07 * vol, freq: 2400, q: 0.7, sweep: 0.6, attack: 0.04 }); break;
      case 'sit': this.noise(0.18, { vol: 0.08 * vol, freq: 350, q: 0.8 }); break;
      case 'crackle': for (let i = 0; i < 3; i++) this.noise(0.02, { vol: (0.02 + Math.random() * 0.03) * vol, freq: 2500 + Math.random() * 2500, q: 2, when: Math.random() * 0.3 }); break;
      case 'lute': [392, 494, 587, 740].forEach((f, i) => this.tone(f * (Math.random() < 0.5 ? 1 : 1.5), 1.2, { type: 'triangle', vol: 0.025 * vol, when: i * 0.18 + Math.random() * 0.05 })); break;
      case 'lift': this.tone(330, 1.5, { type: 'sine', vol: 0.06 * vol, glide: 2, attack: 0.3 }); break;
      case 'chest': this.tone(200, 0.25, { type: 'triangle', vol: 0.1 * vol, glide: 1.5 }); this.play('pickup', vol * 0.8); break;
      case 'arrow': this.noise(0.25, { vol: 0.12 * vol, freq: 3000, q: 4, sweep: 0.4 }); break;
      case 'horse': this.tone(600, 0.6, { type: 'sawtooth', vol: 0.03 * vol, glide: 0.6 }); [1319, 1568, 1976].forEach((f, i) => this.tone(f, 0.8, { vol: 0.05 * vol, when: 0.1 + i * 0.07 })); break;
      default: break;
    }
  }

  // ---------- music ----------
  setMood(m) { this.mood = m; }

  // continuous ambience beds (river, wind, tavern crowd): filtered noise loops
  setLoop(name, vol) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    this.loops = this.loops || {};
    let L = this.loops[name];
    if (!L) {
      if (vol <= 0.001) return;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      src.playbackRate.value = name === 'wind' ? 0.5 : 1;
      const f = c.createBiquadFilter();
      const cfg = { water: ['bandpass', 1100, 0.35], wind: ['lowpass', 520, 0.8], crowd: ['bandpass', 480, 1.8], fire: ['bandpass', 2600, 0.9], rain: ['bandpass', 3200, 0.35] }[name] || ['lowpass', 800, 1];
      f.type = cfg[0]; f.frequency.value = cfg[1]; f.Q.value = cfg[2];
      const g = c.createGain();
      g.gain.value = 0;
      // slow modulation gives wind gusts / crowd murmur a living rhythm
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = name === 'wind' ? 0.13 : name === 'crowd' ? 1.7 : name === 'fire' ? 7 : name === 'rain' ? 0.07 : 0.4;
      lfoGain.gain.value = name === 'water' ? 60 : name === 'crowd' ? 140 : name === 'fire' ? 900 : 200;
      lfo.connect(lfoGain);
      lfoGain.connect(f.frequency);
      lfo.start();
      src.connect(f); f.connect(g); g.connect(this.sfx);
      src.start();
      L = this.loops[name] = { g, src };
    }
    L.g.gain.setTargetAtTime(Math.max(0, vol) * this.sfxVol, c.currentTime, 0.6);
  }

  update() {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const c = this.ctx;
    const ahead = c.currentTime + 0.25;
    while (this.nextNote < ahead) {
      this.scheduleStep(this.nextNote);
      const tempo = { day: 0.34, night: 0.5, combat: 0.2, boss: 0.18, dark: 0.45, triumph: 0.3 }[this.mood] || 0.34;
      this.nextNote += tempo;
      this.step++;
    }
  }

  scheduleStep(t) {
    const when = t - this.ctx.currentTime;
    const mood = this.mood;
    const A = 220;
    const n = (semi) => A * Math.pow(2, semi / 12);
    const progs = {
      day: [[2, 6, 9], [9, 13, 16], [11, 14, 18], [7, 11, 14]], // D A Bm G (relative to A3)
      night: [[11, 14, 18], [7, 11, 14], [2, 6, 9], [9, 13, 16]],
      combat: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]],
      boss: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5]],
      dark: [[0, 3, 7], [-4, 0, 3], [0, 3, 7], [-5, -1, 2]],
      triumph: [[2, 6, 9], [7, 11, 14], [9, 13, 16], [2, 6, 9]],
    };
    const prog = progs[mood] || progs.day;
    const barLen = mood === 'combat' || mood === 'boss' ? 8 : 8;
    if (this.step % barLen === 0) {
      this.chordIdx = (this.chordIdx + 1) % prog.length;
      const ch = prog[this.chordIdx];
      const dur = (mood === 'night' || mood === 'dark' ? 0.5 : mood === 'combat' || mood === 'boss' ? 0.2 : 0.34) * barLen * 1.1;
      for (const s of ch) {
        this.tone(n(s - 12), dur, { type: 'sine', vol: 0.05, attack: 0.8, when, dest: this.music });
        this.tone(n(s - 12), dur, { type: 'triangle', vol: 0.02, attack: 1.0, when, dest: this.music, detune: 6 });
      }
      this.tone(n(ch[0] - 24), dur, { type: 'sine', vol: 0.07, attack: 0.3, when, dest: this.music });
    }
    const ch = prog[this.chordIdx];
    // harp arpeggio / melody
    const pent = [0, 2, 4, 7, 9, 12, 14, 16];
    if (mood === 'day' || mood === 'triumph') {
      if (Math.random() < 0.72) {
        const s = ch[this.step % 3] + (this.step % 6 < 3 ? 12 : 24);
        this.tone(n(s), 1.4, { type: 'triangle', vol: 0.045, attack: 0.005, when, dest: this.music });
        this.tone(n(s) * 2, 0.6, { type: 'sine', vol: 0.012, attack: 0.005, when, dest: this.music });
      }
    } else if (mood === 'night') {
      if (Math.random() < 0.35) {
        const s = ch[Math.floor(Math.random() * 3)] + 24;
        this.tone(n(s), 2.4, { type: 'sine', vol: 0.035, attack: 0.02, when, dest: this.music });
      }
    } else if (mood === 'combat' || mood === 'boss') {
      if (this.step % 2 === 0) this.tone(n(ch[0] - 24), 0.25, { type: 'triangle', vol: 0.12, attack: 0.005, when, dest: this.music, glide: 0.5 });
      if (this.step % 4 === 2) this.noise(0.12, { vol: 0.05, freq: 180, q: 1, when });
      if (Math.random() < 0.5) {
        const s = ch[this.step % 3] + 12 + (mood === 'boss' ? 0 : 12);
        this.tone(n(s), 0.3, { type: mood === 'boss' ? 'sawtooth' : 'triangle', vol: mood === 'boss' ? 0.02 : 0.035, when, dest: this.music });
      }
    } else if (mood === 'dark') {
      if (Math.random() < 0.25) this.tone(n(ch[0] + pent[Math.floor(Math.random() * 3)]), 3, { type: 'sine', vol: 0.03, attack: 0.5, when, dest: this.music, glide: 0.98 });
    }
  }
}
