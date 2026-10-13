/**
 * DontEraseMe — original procedural audio, first edition.
 * Run: node scripts/generate-audio.mjs
 * No samples, models, services, dependencies, or third-party compositions.
 * The composition, synthesis, mixing, WAV encoder, and audit are reproducible.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/assets/audio/', import.meta.url));
const SR = 32000;
const TAU = Math.PI * 2;
const stats = [];
const midi = n => 440 * 2 ** ((n - 69) / 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = v => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
const rand = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

function waveHeader(frames, channels) {
  const b = Buffer.alloc(44 + frames * channels * 2);
  b.write('RIFF', 0); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * channels * 2, 28);
  b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(frames * channels * 2, 40);
  return b;
}

function master(channels, peak, loop) {
  // Remove DC and use modest saturation to control layered transients.
  for (const channel of channels) {
    const mean = channel.reduce((a, b) => a + b, 0) / channel.length;
    for (let i = 0; i < channel.length; i++) channel[i] = Math.tanh((channel[i] - mean) * 1.12) / 1.12;
    if (!loop) {
      const fade = Math.min(Math.round(SR * 0.009), Math.floor(channel.length / 6));
      for (let i = 0; i < fade; i++) channel[channel.length - 1 - i] *= smooth(i / fade);
      const attack = Math.round(SR * 0.00065);
      for (let i = 0; i < attack; i++) channel[i] *= smooth(i / attack);
    }
  }
  let max = 0;
  for (const channel of channels) for (const x of channel) max = Math.max(max, Math.abs(x));
  if (max < 0.00001) throw new Error('Refusing to save silent asset');
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= peak / max;
  return channels;
}

function save(name, channels, metadata = {}) {
  const frames = channels[0].length;
  const buf = waveHeader(frames, channels.length);
  let peak = 0, energy = 0, clipped = 0, maxDelta = 0;
  const boundaryDelta = Math.max(...channels.map(c => Math.abs(c[0] - c[frames - 1])));
  for (let i = 0; i < frames; i++) for (let ch = 0; ch < channels.length; ch++) {
    const s = channels[ch][i];
    if (!Number.isFinite(s)) throw new Error(`${name}: non-finite sample`);
    if (Math.abs(s) >= 0.999) clipped++;
    peak = Math.max(peak, Math.abs(s)); energy += s * s;
    if (i) maxDelta = Math.max(maxDelta, Math.abs(s - channels[ch][i - 1]));
    buf.writeInt16LE(Math.round(clamp(s, -1, 1) * 32767), 44 + 2 * (i * channels.length + ch));
  }
  if (clipped || peak >= 0.9) throw new Error(`${name}: clipping or excessive level`);
  if (metadata.loop && boundaryDelta > 0.015) throw new Error(`${name}: loop discontinuity (${boundaryDelta})`);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), buf);
  stats.push({ name, sampleRate: SR, channels: channels.length, frames,
    seconds: +(frames / SR).toFixed(6), peak: +peak.toFixed(6),
    rms: +Math.sqrt(energy / (frames * channels.length)).toFixed(6),
    boundaryDelta: +boundaryDelta.toFixed(7), maxAdjacentDelta: +maxDelta.toFixed(7), clipped,
    ...metadata });
}

class Score {
  constructor(bpm, seed) {
    this.frames = Math.round(SR * 64 * 60 / bpm);
    this.beat = this.frames / SR / 64;
    this.left = new Float64Array(this.frames);
    this.right = new Float64Array(this.frames);
    this.random = rand(seed);
  }
  add(beat, duration, fn, amplitude, pan = 0) {
    const start = Math.round(beat * this.beat * SR);
    const frames = Math.ceil(duration * SR);
    const l = Math.cos((pan + 1) * Math.PI / 4) * amplitude;
    const r = Math.sin((pan + 1) * Math.PI / 4) * amplitude;
    // Release tails wrap to the beginning; there is never a file-end fade gap.
    for (let i = 0; i < frames; i++) {
      const idx = (start + i) % this.frames;
      const v = fn(i / SR, i) * smooth((duration - i / SR) / 0.025);
      this.left[idx] += v * l; this.right[idx] += v * r;
    }
  }
  note(type, beat, note, length, amplitude, pan = 0) {
    const f = midi(note), hold = length * this.beat;
    const dur = type === 'pad' ? hold + 0.7 : type === 'bass' ? hold + 0.06 : hold + 0.32;
    const phase = this.random() * TAU;
    this.add(beat, dur, t => {
      const a = TAU * f * t;
      const end = smooth((dur - t) / (type === 'pad' ? 0.72 : 0.16));
      if (type === 'pad') return (Math.sin(a + Math.sin(t * 3.7 + phase) * 0.014)
        + 0.22 * Math.sin(a * 1.0021 + phase) + 0.15 * Math.sin(a * 2))
        * smooth(t / 0.24) * end * (0.82 + Math.sin(t * 1.3 + phase) * 0.06);
      if (type === 'bass') return (Math.sin(a) + 0.25 * Math.sin(a * 2) + 0.07 * Math.sin(a * 3))
        * smooth(t / 0.006) * Math.exp(-t * 1.6) * smooth((dur - t) / 0.065);
      if (type === 'wood') return (Math.sin(a) * Math.exp(-t * 4.7)
        + 0.26 * Math.sin(a * 3.997) * Math.exp(-t * 21)
        + 0.09 * Math.sin(a * 7.003) * Math.exp(-t * 38)) * smooth(t / 0.0023) * end;
      if (type === 'keys') return (Math.sin(a + 0.65 * Math.sin(a * 2) * Math.exp(-t * 5))
        + 0.13 * Math.sin(a * 3) * Math.exp(-t * 8)) * smooth(t / 0.004)
        * Math.exp(-t * 2.6) * end;
      if (type === 'bell') return (Math.sin(a) * Math.exp(-t * 2.8)
        + 0.23 * Math.sin(a * 2.01) * Math.exp(-t * 4.9)
        + 0.08 * Math.sin(a * 3.97) * Math.exp(-t * 13)) * smooth(t / 0.0035) * end;
      if (type === 'string') return (Math.sin(a) + 0.29 * Math.sin(2 * a) + 0.12 * Math.sin(3 * a)
        + 0.04 * Math.sin(4 * a)) * smooth(t / 0.016) * Math.exp(-t * 3.2) * end;
      return 0;
    }, amplitude, pan);
  }
  drum(type, beat, gain = 1, pan = 0) {
    const rng = rand(Math.floor(this.random() * 0xffffffff));
    let low = 0, prev = 0;
    const duration = type === 'kick' ? 0.31 : type === 'snare' ? 0.18 : type === 'shaker' ? 0.082 : 0.07;
    this.add(beat, duration, t => {
      const n = rng() * 2 - 1;
      low += (n - low) * 0.18;
      const high = n - low, edge = n - prev; prev = n;
      const attack = smooth(t / 0.0015);
      if (type === 'kick') {
        const phase = TAU * (46 * t + 85 * 0.026 * (1 - Math.exp(-t / 0.026)));
        return (Math.sin(phase) * Math.exp(-t * 17) + low * 0.10 * Math.exp(-t * 130)) * attack * 0.43;
      }
      if (type === 'snare') return (low * 0.7 * Math.exp(-t * 35)
        + high * 0.14 * Math.exp(-t * 49) + Math.sin(TAU * 185 * t) * Math.exp(-t * 47) * 0.35) * attack * 0.29;
      if (type === 'rim') return (Math.sin(TAU * 780 * t) * 0.5 + Math.sin(TAU * 1110 * t) * 0.25
        + low * 0.24) * Math.exp(-t * 90) * attack * 0.20;
      return (high * 0.68 + edge * 0.05) * Math.exp(-t * (type === 'shaker' ? 56 : 87)) * attack * 0.064;
    }, gain, pan);
  }
  render() {
    const original = [this.left.slice(), this.right.slice()];
    // Small rhythmic, cross-stereo reflections; all taps are circular.
    const taps = [[this.beat * 0.75, 0.085], [this.beat * 1.5, 0.047], [0.083, 0.035], [0.139, 0.022]];
    for (let ch = 0; ch < 2; ch++) {
      const out = ch ? this.right : this.left;
      for (const [seconds, amount] of taps) {
        const delay = Math.round(seconds * SR);
        for (let i = 0; i < this.frames; i++) out[i] += original[1 - ch][(i - delay + this.frames) % this.frames] * amount;
      }
      // Two passes converge the filter state around the circular signal.
      const alpha = 1 - Math.exp(-TAU * 5100 / SR);
      let state = 0;
      for (const s of out) state += alpha * (s - state);
      for (let i = 0; i < out.length; i++) { state += alpha * (out[i] - state); out[i] = state; }
    }
    return master([this.left, this.right], 0.56, true);
  }
}

function makeMenu() {
  const s = new Score(90, 14001);
  const chords = [[50, 57, 60, 64], [46, 53, 57, 62], [41, 53, 57, 60], [48, 55, 62, 64]];
  const motif = [[74, 0, 0.29], [69, 1.5, 0.22], [72, 3.25, 0.20], [76, 5, 0.22], [72, 6.5, 0.18]];
  for (let bar = 0; bar < 16; bar++) {
    const base = bar * 4, chord = chords[Math.floor(bar / 2) % 4];
    if (bar % 2 === 0) chord.forEach((n, i) => s.note('pad', base, n + (i ? 12 : 0), 7.85, i ? 0.035 : 0.05, (i - 1.5) * 0.24));
    s.note('bass', base + 0.03, chord[0] - 12, 2.2, 0.16);
    if (bar % 2) s.note('bass', base + 2.75, chord[0] - 5, 0.85, 0.095);
    for (let step = 0; step < 4; step++) {
      const note = chord[1 + (step + bar) % 3] + 12;
      s.note('keys', base + step + (step % 2 ? 0.035 : 0), note, 0.8, step === 0 ? 0.105 : 0.072, step % 2 ? 0.35 : -0.3);
    }
    s.drum('rim', base + 2, 0.24, -0.18);
    s.drum('shaker', base + 1.5, 0.36, 0.43);
    s.drum('shaker', base + 3.5, 0.27, 0.43);
    if (bar >= 8) s.note('wood', base + 2.75, chord[2] + 12, 0.6, 0.075, -0.5);
  }
  // Sparse melodic phrases with chord-aware responses across eight-bar halves.
  for (let phrase = 0; phrase < 8; phrase++) {
    const chord = chords[phrase % 4];
    const line = phrase % 4 === 0 ? motif : [[chord[3] + 12, 0.75, 0.23], [chord[2] + 12, 3, 0.21], [chord[1] + 12, 5.5, 0.22]];
    for (const [note, off, amp] of line) s.note('keys', phrase * 8 + off, note, 1.5, amp * 0.46, 0.12);
  }
  save('menu', s.render(), { loop: true, bpm: 90, beats: 64, bars: 16, style: '夜间画室 · 温暖电钢琴、拨弦、柔软和弦、轻刷节拍' });
}

function makeAtelier() {
  const s = new Score(112, 25002);
  const chords = [[38, 53, 57, 60, 64], [34, 53, 57, 60, 62], [41, 53, 57, 60, 64], [36, 55, 60, 62, 64]];
  const arp = [1, 3, 2, 4, 2, 3];
  for (let bar = 0; bar < 16; bar++) {
    const b = bar * 4, c = chords[Math.floor(bar / 2) % 4];
    if (!(bar % 2)) c.slice(1).forEach((n, i) => s.note('pad', b, n, 7.7, 0.023, (i - 1.5) * 0.3));
    [[0, c[0], 0.85], [1.5, c[0] + 12, 0.35], [2.25, c[0] + 7, 0.6], [3.25, c[0], 0.5]].forEach(([off, n, len]) => s.note('bass', b + off, n, len, 0.24));
    [0, 1.75, 2.5].forEach((off, i) => s.drum('kick', b + off, i ? 0.64 : 0.82));
    s.drum('snare', b + 1, 0.70, -0.1); s.drum('snare', b + 3, 0.79, -0.1);
    s.drum('rim', b + 2.75, 0.36, 0.35);
    for (let i = 0; i < 8; i++) s.drum('shaker', b + i / 2 + (i % 2 ? 0.045 : 0), i % 2 ? 0.60 : 0.32, 0.42);
    for (let i = 0; i < 6; i++) s.note('wood', b + [0, 0.75, 1.5, 2, 2.75, 3.5][i], c[arp[(i + bar % 2) % arp.length]] + 12, 0.55, i % 3 === 0 ? 0.135 : 0.098, i % 2 ? 0.38 : -0.42);
    [0.5, 2.5].forEach(off => c.slice(1, 4).forEach((n, i) => s.note('keys', b + off + i * 0.012, n, 0.32, 0.06, -0.15 + i * 0.12)));
    if (bar >= 8 && bar % 2 === 0) {
      s.note('keys', b + 0.25, c[4] + 12, 1.2, 0.14, 0.12);
      s.note('keys', b + 2, c[3] + 12, 0.75, 0.11, 0.12);
    }
    if (bar === 7 || bar === 15) {
      [3.25, 3.5, 3.75].forEach((off, i) => s.drum('rim', b + off, 0.42 + i * 0.09, -0.35 + i * 0.35));
      s.note('wood', b + 3.75, bar === 15 ? 64 : 62, 0.4, 0.12, -0.25);
    }
  }
  save('atelier', s.render(), { loop: true, bpm: 112, beats: 64, bars: 16, style: '涂鸦律动 · 切分低音、木琴、拨弦、电钢琴、干鼓与轻摇铃' });
}

function makeRuins() {
  const s = new Score(106, 36003);
  const chords = [[40, 55, 59, 62, 66], [36, 55, 59, 62, 64], [33, 52, 57, 59, 64], [35, 54, 57, 59, 62]];
  for (let bar = 0; bar < 16; bar++) {
    const b = bar * 4, c = chords[Math.floor(bar / 2) % 4];
    if (!(bar % 2)) c.slice(1).forEach((n, i) => s.note('pad', b, n, 7.8, 0.025, (i - 1.5) * 0.33));
    [[0, 0.8], [1.5, 0.55], [2.5, 0.55], [3.5, 0.35]].forEach(([off, len], i) => s.note('bass', b + off, c[0] + (i === 2 ? 7 : 0), len, 0.25));
    [0, 1.5, 2.75].forEach((off, i) => s.drum('kick', b + off, i ? 0.61 : 0.82));
    s.drum('snare', b + 2, 0.65, 0.12);
    s.drum('rim', b + 3.25, 0.6, -0.3);
    for (let i = 0; i < 8; i++) s.drum('shaker', b + i / 2, i % 2 ? 0.50 : 0.23, 0.45);
    for (let i = 0; i < 8; i++) {
      const n = c[[1, 2, 3, 2, 1, 3, 4, 2][(i + bar % 2) % 8]];
      s.note('string', b + i / 2, n, 0.22, i % 3 === 0 ? 0.09 : 0.055, i % 2 ? 0.42 : -0.4);
    }
    if (!(bar % 2)) {
      s.note('bell', b + 0.5, c[3] + 12, 1.7, 0.12, -0.12);
      s.note('bell', b + 3.25, c[2] + 12, 1.2, 0.085, 0.24);
    } else s.note('keys', b + 1.25, c[4], 1, 0.07, -0.1);
    if (bar >= 8) s.note('string', b + 2.75, c[4] + 12, 0.75, 0.065, -0.25);
    if (bar === 7 || bar === 15) [3.25, 3.5, 3.75].forEach((off, i) => s.drum('snare', b + off, 0.26 + i * 0.09, -0.2 + i * 0.2));
  }
  save('ruins', s.render(), { loop: true, bpm: 106, beats: 64, bars: 16, style: '守卫废墟 · 断奏低弦、深鼓、切分低音、柔和钟音与悬念和弦' });
}

class Effect {
  constructor(name, seconds) { this.name = name; this.data = new Float64Array(Math.round(seconds * SR)); this.random = rand(hash(name)); }
  layer(start, length, gain, fn) {
    const at = Math.round(start * SR), count = Math.round(length * SR);
    for (let i = 0; i < count && at + i < this.data.length; i++) {
      const t = i / SR;
      this.data[at + i] += gain * fn(t, i) * smooth(t / 0.00065) * smooth((length - t) / Math.min(0.018, length * 0.16));
    }
    return this;
  }
  tone(start, length, gain, f0, f1 = f0, decay = 18, harmonic = 0.15) {
    const sweep = Math.min(0.065, length * 0.32);
    return this.layer(start, length, gain, t => {
      const phase = TAU * (f1 * t + (f0 - f1) * sweep * (1 - Math.exp(-t / sweep)));
      return (Math.sin(phase) + harmonic * Math.sin(phase * 2.01) + harmonic * 0.3 * Math.sin(phase * 3.03)) * Math.exp(-t * decay);
    });
  }
  noise(start, length, gain, cutoff = 2000, decay = 23, air = false) {
    let low = 0, lower = 0;
    const a = 1 - Math.exp(-TAU * cutoff / SR), a2 = 1 - Math.exp(-TAU * 180 / SR);
    return this.layer(start, length, gain, t => {
      const n = this.random() * 2 - 1;
      low += a * (n - low); lower += a2 * (low - lower);
      return (air ? n * 0.17 + low - lower : low) * Math.exp(-t * decay);
    });
  }
  whoosh(start, length, gain, upward = true) {
    let low = 0, highpass = 0;
    return this.layer(start, length, gain, t => {
      const x = t / length, cut = upward ? 400 + 2600 * x : 3000 - 2600 * x;
      const a = 1 - Math.exp(-TAU * cut / SR);
      low += a * ((this.random() * 2 - 1) - low); highpass += 0.035 * (low - highpass);
      return (low - highpass) * Math.sin(Math.PI * x) ** 1.6;
    });
  }
  impact(start = 0, size = 1) {
    return this.tone(start, 0.2, 0.65 * size, 180, 66, 24, 0.18)
      .noise(start, 0.075, 0.56 * size, 2900, 59)
      .tone(start, 0.055, 0.17 * size, 750, 400, 75, 0.24);
  }
  chime(start, note, gain = 0.3, length = 0.38) {
    const f = midi(note);
    this.tone(start, length, gain, f, f, 9, 0.16);
    this.tone(start, length * 0.7, gain * 0.21, f * 3.01, f * 3.01, 19, 0);
    return this;
  }
  save(peak = 0.82) { save(this.name, master([this.data], peak, false), { loop: false }); }
}

function makeEffects() {
  new Effect('shot-brush', 0.20).impact(0, 0.65).noise(0, 0.12, 0.6, 2400, 34, true).tone(0, 0.12, 0.32, 390, 165, 30).save(0.80);
  const spray = new Effect('shot-spray', 0.22);
  for (let i = 0; i < 3; i++) spray.noise(i * 0.035, 0.095, 0.45 - i * 0.06, 2900, 36, true).tone(i * 0.035, 0.07, 0.28, 230, 110, 43);
  spray.save(0.78);
  new Effect('shot-scrape', 0.27).impact(0, 0.6).noise(0.008, 0.18, 0.60, 1700, 19, true).tone(0, 0.17, 0.27, 830, 320, 22, 0.35).tone(0.015, 0.12, 0.18, 1265, 590, 30).save();
  const chain = new Effect('shot-chain', 0.26);
  [0, 0.032, 0.061].forEach((start, i) => chain.impact(start, 0.66 - i * 0.13).tone(start, 0.16, 0.25, 690 + 220 * i, 560 + 160 * i, 31, 0.25));
  chain.save();
  new Effect('shot-ruler', 0.19).impact(0, 0.7).tone(0, 0.09, 0.45, 520, 440, 47, 0.31).tone(0, 0.065, 0.22, 1130, 1050, 70).noise(0, 0.065, 0.34, 2000, 49).save();
  new Effect('shot-ribbon', 0.30).whoosh(0, 0.12, 0.75).impact(0.078, 0.55).tone(0.064, 0.16, 0.4, 850, 230, 28, 0.17).save(0.79);
  new Effect('shot-vortex', 0.38).whoosh(0, 0.15, 0.65).tone(0.04, 0.27, 0.6, 410, 72, 16, 0.28).impact(0.1, 0.45).noise(0.1, 0.17, 0.3, 1350, 22).save();
  new Effect('shot-bucket', 0.33).tone(0, 0.25, 0.65, 240, 64, 17, 0.2).noise(0, 0.18, 0.7, 1200, 21).tone(0.012, 0.16, 0.23, 670, 240, 27, 0.3).noise(0.025, 0.2, 0.24, 3300, 28, true).save(0.85);
  new Effect('shot-pen', 0.15).impact(0, 0.37).tone(0, 0.09, 0.38, 1490, 730, 53, 0.15).noise(0, 0.04, 0.32, 3400, 72).save(0.77);
  new Effect('shot-airbrush', 0.28).tone(0, 0.12, 0.35, 195, 98, 25).noise(0, 0.2, 0.68, 2300, 15, true).noise(0, 0.055, 0.3, 3500, 60).save(0.76);
  new Effect('shot-compass', 0.24).impact(0, 0.5).tone(0, 0.20, 0.34, 620, 520, 21, 0.2).tone(0, 0.18, 0.2, 1235, 1040, 27, 0.12).save(0.79);
  new Effect('shot-dropper', 0.26).tone(0, 0.22, 0.6, 860, 220, 24, 0.12).tone(0, 0.17, 0.4, 190, 76, 24).noise(0, 0.08, 0.32, 1550, 39).tone(0.058, 0.13, 0.18, 670, 350, 28).save(0.79);
  new Effect('hit', 0.17).impact(0, 1).noise(0.007, 0.11, 0.2, 950, 42).save(0.83);
  new Effect('hit-heavy', 0.34).impact(0, 0.95).tone(0, 0.3, 0.72, 125, 47, 16, 0.22).noise(0.01, 0.19, 0.5, 950, 25).tone(0.008, 0.12, 0.22, 290, 170, 37, 0.3).save(0.86);
  new Effect('kill', 0.34).impact(0, 0.65).noise(0.02, 0.18, 0.48, 1950, 30).tone(0, 0.24, 0.42, 530, 135, 23, 0.26).tone(0.035, 0.22, 0.38, 130, 49, 19).save(0.83);
  new Effect('hurt', 0.28).impact(0, 0.75).tone(0.009, 0.23, 0.56, 195, 91, 19, 0.30).noise(0.009, 0.15, 0.4, 780, 18).save(0.83);
  new Effect('shield', 0.48).impact(0, 0.3).chime(0, 79, 0.25, 0.40).chime(0, 86, 0.18, 0.37).tone(0, 0.28, 0.4, 310, 200, 22).whoosh(0.02, 0.21, 0.17, false).save(0.79);
  new Effect('dash', 0.27).whoosh(0, 0.22, 0.78).tone(0, 0.21, 0.33, 280, 84, 25).noise(0, 0.045, 0.3, 2100, 62).save(0.80);
  new Effect('skill', 0.58).whoosh(0, 0.22, 0.68).tone(0, 0.21, 0.3, 150, 430, 6, 0.2).impact(0.14, 0.72).chime(0.14, 74, 0.23).chime(0.18, 81, 0.18).save(0.84);
  new Effect('explosion', 0.59).impact(0, 0.92).tone(0, 0.52, 0.85, 135, 35, 10, 0.27).noise(0, 0.49, 0.88, 750, 10).noise(0, 0.22, 0.62, 2700, 21).noise(0.035, 0.24, 0.25, 1200, 22).save(0.86);
  new Effect('pickup', 0.40).chime(0, 79, 0.23, 0.30).chime(0.065, 86, 0.29, 0.32).tone(0, 0.09, 0.18, 420, 290, 38).save(0.74);
  new Effect('reload', 0.37).tone(0, 0.065, 0.32, 660, 460, 70, 0.2).noise(0, 0.055, 0.4, 1900, 68).whoosh(0.02, 0.16, 0.2).tone(0.19, 0.13, 0.42, 360, 220, 39, 0.21).noise(0.19, 0.07, 0.3, 2400, 55).save(0.76);
  const level = new Effect('level-up', 1.15);
  [62, 65, 69, 74, 77].forEach((n, i) => level.chime(i * 0.09, n, 0.24 + i * 0.022, 0.72));
  level.tone(0, 0.7, 0.27, midi(50), midi(50), 6).whoosh(0, 0.45, 0.15).save(0.8);
  const victory = new Effect('victory', 2.05);
  [62, 65, 69, 74, 77, 81].forEach((n, i) => victory.chime(i * 0.115, n, 0.22, 1.12));
  [50, 57, 62, 65, 69].forEach((n, i) => victory.tone(0.42, 1.58, i ? 0.13 : 0.3, midi(n), midi(n), 2.9, 0.12));
  victory.whoosh(0, 0.45, 0.18).save(0.80);
  const defeat = new Effect('defeat', 1.78);
  [64, 62, 59, 52].forEach((n, i) => defeat.chime(i * 0.18, n, 0.21, 1.08));
  [40, 47, 55, 59].forEach((n, i) => defeat.tone(0.15, 1.55, i ? 0.1 : 0.28, midi(n), midi(n), 3.4, 0.1));
  defeat.noise(0, 0.18, 0.1, 600, 20).save(0.76);
  new Effect('ui-click', 0.075).tone(0, 0.055, 0.26, 950, 640, 91, 0.06).noise(0, 0.025, 0.11, 1900, 110).save(0.64);
  new Effect('magic', 0.56).chime(0, 74, 0.27, 0.40).chime(0.055, 81, 0.18, 0.44).chime(0.12, 86, 0.13, 0.39).whoosh(0, 0.24, 0.3).tone(0, 0.2, 0.24, 330, 165, 16).save(0.78);
}

fs.mkdirSync(OUT, { recursive: true });
makeMenu(); makeAtelier(); makeRuins(); makeEffects();
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify({ edition: 'original-procedural-v1', format: 'PCM signed 16-bit little endian WAV', assets: stats }, null, 2)}\n`);
const table = stats.map(s => `| ${s.name}.wav | ${s.channels === 2 ? '立体声' : '单声道'} | ${s.seconds.toFixed(3)} | ${s.peak.toFixed(3)} | ${s.rms.toFixed(4)} | ${s.loop ? `${s.bpm} / 16` : '—'} |`).join('\n');
const readme = `# DontEraseMe 音频素材 · 原创程序化第一版

这些 WAV 由仓库中的 \`scripts/generate-audio.mjs\` 完全离线合成。它同时包含原创配器、音序、振荡器、噪声塑形、混音、WAV 编码和校验逻辑。没有使用下载采样、第三方音乐、商业曲库、生成式音乐服务或外部依赖；可随本项目用于商业发行，无第三方采样署名或额外授权要求。这是程序化原创第一版，并非音乐工具录制或真人演奏成品。

重新生成：在项目根目录执行 \`node scripts/generate-audio.mjs\`。种子固定，输出可复现；会覆盖本目录中相同文件名的生成素材及本说明。

## 配乐

- **menu**：90 BPM，D 小调夜间画室。温暖电钢琴、轻拨弦、柔软和弦与刷奏感节拍。16 小节 / 64 拍，42.667 秒。
- **atelier**：112 BPM，D 小调涂鸦律动。切分低音、木琴与拨弦音色、干鼓、电钢琴反拍，后八小节增加旋律和收尾。
- **ruins**：106 BPM，E 小调守卫废墟。断奏低弦、深鼓、柔和钟音和悬念和弦；保留清楚的节奏，避免尖锐恐怖音色。

三首均为完整 16 小节（4/4 拍），总帧数由 64 拍时长一次计算后取整，每个事件以该总长的 1/64 定位。音符释放和立体声反射尾音循环回绕；循环滤波状态连续；音乐没有结尾静音淡出。最后样本与第一样本的差值见 manifest.json，生成器要求小于 0.015。90 BPM 的 16 小节数学时长为约 42.67 秒。

## 使用与混音

- 所有文件：32,000 Hz、PCM 16-bit WAV。配乐为双声道；音效为单声道。
- 配乐峰值 0.56，推荐单轨 gain **0.24–0.34**（战斗中可取 0.25），切换时交叉淡化 **0.8–1.2 秒**。
- 射击音效推荐 gain **0.20–0.34**；命中 **0.26–0.40**；重击/爆炸 **0.40–0.55**；受伤 **0.44**；技能 **0.35–0.45**。
- UI/pickup 推荐 gain **0.16–0.24**；胜负与升级 **0.35–0.48**。连射时限制同类并发并加入少量音高变化，比提高总音量更有层次。
- 建议输出主总线再留余量（例如 master gain 0.7），密集战斗增加限幅器；素材自身未削波不等于无限叠加后总线不会削波。
- 音效以低中频主体、柔和噪声瞬态和短尾分层。常规音效最长 0.59 秒；level-up、victory、defeat 是更长的提示旋律。

## 生成审计

所有素材通过有限数值、非静音、峰值 < 0.9、零削波检查；音乐额外检查循环接缝。详细帧数、RMS、边界差值及相邻样本最大差值保存在 manifest.json。以下数值是编码前浮点数据的测量，16 位量化误差不超过 1/32767。

| 文件 | 声道 | 秒 | 峰值 | RMS | BPM / 小节 |
| --- | --- | ---: | ---: | ---: | --- |
${table}
`;
fs.writeFileSync(path.join(OUT, 'README.md'), readme);
console.log(`Generated ${stats.length} original audio assets in ${OUT}`);
for (const s of stats) console.log(`${s.name.padEnd(15)} ${String(s.seconds.toFixed(3)).padStart(7)} s  peak ${s.peak.toFixed(3)}  RMS ${s.rms.toFixed(4)}${s.loop ? `  loop delta ${s.boundaryDelta}` : ''}`);
