// Synthesized sound effects and background music (Web Audio, no asset files).
(() => {
  'use strict';
  const ON = (window.ON = window.ON || {});

  const Sfx = {
    ac: null,
    sfxGain: null,
    musicGain: null,
    soundOn: true,
    musicOn: true,
    ducked: false,

    unlock() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        const comp = this.ac.createDynamicsCompressor();
        comp.connect(this.ac.destination);
        this.sfxGain = this.ac.createGain();
        this.musicGain = this.ac.createGain();
        this.sfxGain.connect(comp);
        this.musicGain.connect(comp);
        this.apply();
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    configure({ sound, music }) {
      this.soundOn = sound;
      this.musicOn = music;
      this.apply();
    },
    // mute everything while an ad is on screen
    duck(on) {
      this.ducked = on;
      this.apply();
    },
    apply() {
      if (!this.ac) return;
      const t = this.ac.currentTime;
      this.sfxGain.gain.setTargetAtTime(this.soundOn && !this.ducked ? 0.6 : 0, t, 0.02);
      this.musicGain.gain.setTargetAtTime(this.musicOn && !this.ducked ? 0.45 : 0, t, 0.1);
    },

    tone(freq, dur, { type = 'sine', vol = 0.3, slide = 1, delay = 0, attack = 0.005, out } = {}) {
      if (!this.ac) return;
      if (!out && !this.soundOn) return;
      const t = this.ac.currentTime + delay;
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(out || this.sfxGain);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise(dur, { vol = 0.2, freq = 1200, delay = 0 } = {}) {
      if (!this.ac || !this.soundOn) return;
      const t = this.ac.currentTime + delay;
      const len = Math.floor(this.ac.sampleRate * dur);
      const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ac.createBufferSource();
      src.buffer = buf;
      const f = this.ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      const g = this.ac.createGain();
      g.gain.value = vol;
      src.connect(f).connect(g).connect(this.sfxGain);
      src.start(t);
    },

    select() { this.tone(620, 0.06, { type: 'triangle', vol: 0.16, slide: 1.25 }); },
    deselect() { this.tone(520, 0.06, { type: 'triangle', vol: 0.1, slide: 0.8 }); },
    match(combo) {
      const base = 523 * Math.pow(2, Math.min(combo - 1, 8) / 12);
      this.tone(base, 0.12, { type: 'triangle', vol: 0.22 });
      this.tone(base * 1.5, 0.18, { type: 'triangle', vol: 0.16, delay: 0.06 });
      this.noise(0.08, { vol: 0.1, freq: 3200, delay: 0.04 });
    },
    combo(n) {
      const notes = [659, 784, 988, 1175, 1319];
      for (let i = 0; i < Math.min(n, 5); i++) this.tone(notes[i], 0.1, { type: 'square', vol: 0.05, delay: 0.12 + i * 0.045 });
    },
    wrong() { this.tone(180, 0.16, { type: 'sawtooth', vol: 0.08, slide: 0.8 }); },
    hint() { [880, 1175].forEach((f, i) => this.tone(f, 0.14, { type: 'sine', vol: 0.16, delay: i * 0.08 })); },
    shuffle() { this.noise(0.35, { vol: 0.22, freq: 1400 }); [400, 520, 660].forEach((f, i) => this.tone(f, 0.08, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); },
    slide() { this.noise(0.12, { vol: 0.08, freq: 700 }); },
    tick() { this.tone(1000, 0.04, { type: 'square', vol: 0.05 }); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.18, delay: i * 0.09 })); },
    star(i) { this.tone(784 * Math.pow(1.26, i), 0.2, { type: 'triangle', vol: 0.2 }); this.noise(0.1, { vol: 0.08, freq: 4000 }); },
    over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, delay: i * 0.16, slide: 0.97 })); },
    click() { this.tone(700, 0.05, { type: 'triangle', vol: 0.12 }); },
    revive() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, { type: 'triangle', vol: 0.18, delay: i * 0.06 })); },
  };

  // Gentle generative loop: pentatonic plucks over a vi-IV-I-V bass line.
  const Music = {
    timer: 0,
    nextT: 0,
    step: 0,
    playing: false,
    bpm: 100,
    start() {
      if (this.playing || !Sfx.ac) return;
      this.playing = true;
      this.nextT = Sfx.ac.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 100);
    },
    stop() {
      this.playing = false;
      clearInterval(this.timer);
    },
    schedule() {
      const ac = Sfx.ac;
      if (!ac) return;
      const eighth = 60 / this.bpm / 2;
      const roots = [110.0, 174.61, 130.81, 196.0]; // A F C G
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
      while (this.nextT < ac.currentTime + 0.3) {
        const bar = Math.floor(this.step / 8) % 4;
        const delay = Math.max(0, this.nextT - ac.currentTime);
        if (this.step % 8 === 0 || this.step % 8 === 5) {
          Sfx.tone(roots[bar], eighth * 3, { vol: 0.09, delay, attack: 0.02, out: Sfx.musicGain });
        }
        if (Math.random() < (this.step % 2 ? 0.2 : 0.5)) {
          const f = scale[Math.floor(Math.random() * scale.length)];
          Sfx.tone(f, eighth * 1.4, { type: 'triangle', vol: 0.04, delay, out: Sfx.musicGain });
        }
        this.nextT += eighth;
        this.step++;
      }
    },
  };

  ON.Sfx = Sfx;
  ON.Music = Music;
})();
