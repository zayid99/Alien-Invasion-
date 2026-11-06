// Sound: synthesized effects (no files needed) + a few CC0 samples + music.
import { prefs, savePrefs } from './save';
import { platform } from './platform';
import { clamp, rand } from './util';

type Pos = { x: number; z: number } | null;
const SAMPLES: Record<string, string> = { ui: 'ui', confirm: 'confirm', levelup: 'level_up', coin: 'coin', impact: 'impact', bigkill: 'big_kill', boss: 'boss', hurt: 'hurt' };

class Sfx {
  ctx: AudioContext | null = null; master: GainNode | null = null; muted = !!prefs.muted; adPaused = false; gamePaused = false;
  private last: Record<string, number> = {}; private noiseBuf: AudioBuffer | null = null;
  private loops: Record<string, { g: GainNode; nodes: OscillatorNode[]; base: number[] }> = {};
  private buffers: Record<string, AudioBuffer> = {};
  private music: HTMLAudioElement | null = null; private musicWanted = false;
  listener: () => Pos = () => null;
  mood: 'calm' | 'tense' | 'battle' | 'none' = 'calm'; private step = 0; private nextT = 0;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.audible() ? 0.6 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.loops.beam = this.makeLoop([[110, 'sawtooth'], [111.5, 'sawtooth'], [220.7, 'triangle']], 700);
    this.loops.engine = this.makeLoop([[48, 'triangle'], [72.5, 'sine']], 300);
    setInterval(() => this.schedule(), 60);
    for (const [k, f] of Object.entries(SAMPLES)) fetch(`assets/audio/sfx/${f}.ogg`).then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).then(ab => { this.buffers[k] = ab; }).catch(() => {});
  }
  audible() { return !this.muted && !this.adPaused && !platform.muted(); }
  refreshVolume() {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.audible() ? 0.6 : 0, this.ctx.currentTime, 0.05);
    if (this.music) { if (this.audible() && this.musicWanted && !this.gamePaused && !document.hidden) this.music.play().catch(() => {}); else this.music.pause(); }
    // a hidden tab is silent: suspend the whole audio graph, resume it when the player comes back
    if (this.ctx) { if (document.hidden || this.adPaused) { if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); } else if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  }
  setMuted(m: boolean) { this.muted = m; prefs.muted = m; savePrefs(); this.refreshVolume(); }
  private makeLoop(oscs: [number, OscillatorType][], cutoff: number) {
    const c = this.ctx!, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = 0; f.connect(g); g.connect(this.master!);
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 6; lfoG.gain.value = cutoff * 0.35; lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();
    const nodes = oscs.map(([fr, type]) => { const o = c.createOscillator(); o.type = type; o.frequency.value = fr; o.connect(f); o.start(); return o; });
    return { g, nodes, base: oscs.map(o => o[0]) };
  }
  setLoop(name: string, vol: number, pitch = 1) {
    const L = this.loops[name]; if (!L || !this.ctx) return; const t = this.ctx.currentTime;
    L.g.gain.setTargetAtTime(vol, t, 0.08); L.nodes.forEach((o, i) => o.frequency.setTargetAtTime(L.base[i] * pitch, t, 0.1));
  }
  stopLoops() { this.setLoop('beam', 0); this.setLoop('engine', 0); }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, filt: [BiquadFilterType, number, number?] | null = null) {
    const c = this.ctx!, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out: AudioNode = o;
    if (filt) { const f = c.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; f.Q.value = filt[2] || 1; o.connect(f); out = f; }
    out.connect(g); g.connect(this.master!); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, delay = 0, q = 1) {
    const c = this.ctx!, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(Math.max(0.0002, vol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master!); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  private sample(k: string, vol = 0.5, rate = 1) {
    const b = this.buffers[k]; if (!b || !this.ctx) return false;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(this.master!); s.start(); return true;
  }
  /** Play a named effect; pos fades it with distance from the saucer. */
  play(name: string, pos: Pos = null, gap = 0.04) {
    if (!this.ctx || !this.audible()) return;
    const now = this.ctx.currentTime; if (now - (this.last[name] || 0) < gap) return; this.last[name] = now;
    let v = 1; const L = this.listener();
    if (pos && L) v = clamp(1.15 - Math.hypot(pos.x - L.x, pos.z - L.z) / 110, 0.08, 1);
    const r = rand(0.92, 1.08);
    switch (name) {
      case 'zap': this.tone('square', 1500 * r, 260, 0.09, 0.05 * v); this.tone('sine', 2400 * r, 900, 0.06, 0.04 * v); break;
      case 'abduct': this.tone('sine', 320 * r, 1300, 0.2, 0.16); this.tone('triangle', 900 * r, 2600, 0.16, 0.06, 0.05); break;
      case 'scream': this.tone('sawtooth', 820 * r, 1250 * r, 0.32, 0.035 * v, 0, ['bandpass', 1100, 3]); break;
      case 'moo': this.tone('sawtooth', 150 * r, 108, 0.6, 0.12 * v, 0, ['lowpass', 520, 2]); break;
      case 'baa': this.tone('sawtooth', 310 * r, 270, 0.32, 0.06 * v, 0, ['bandpass', 950, 4]); break;
      case 'oink': this.tone('square', 230 * r, 150, 0.12, 0.05 * v, 0, ['lowpass', 900]); this.tone('square', 210 * r, 140, 0.12, 0.05 * v, 0.14, ['lowpass', 900]); break;
      case 'cluck': for (let i = 0; i < 3; i++) this.tone('square', 900 * r, 700, 0.05, 0.03 * v, i * 0.08, ['bandpass', 1200, 2]); break;
      case 'bark': this.tone('square', 420 * r, 260, 0.09, 0.06 * v, 0, ['bandpass', 800, 2]); this.tone('square', 400 * r, 250, 0.09, 0.06 * v, 0.16, ['bandpass', 800, 2]); break;
      case 'hit': if (!this.sample('hurt', 0.35)) { this.noise(0.14, 0.18, 'lowpass', 2400, 400); this.tone('square', 140, 70, 0.12, 0.08); } break;
      case 'shot': this.noise(0.06, 0.07 * v, 'highpass', 1600, 900); break;
      case 'cannon': this.noise(0.45, 0.22 * v, 'lowpass', 700, 90); this.tone('sine', 90, 38, 0.4, 0.2 * v); break;
      case 'missile': this.noise(0.7, 0.07 * v, 'bandpass', 900, 2600, 0, 2); break;
      case 'boom': this.sample('impact', 0.5 * v, 0.8); this.noise(0.9, 0.38 * v, 'lowpass', 1400, 70); this.tone('sine', 70, 28, 0.7, 0.28 * v); break;
      case 'smallboom': this.noise(0.4, 0.2 * v, 'lowpass', 1800, 120); break;
      case 'alarm': for (let i = 0; i < 4; i++) this.tone('square', i % 2 ? 640 : 860, i % 2 ? 640 : 860, 0.16, 0.04, i * 0.17, ['lowpass', 2000]); break;
      case 'send': this.sample('coin', 0.4); this.tone('sine', 180, 2200, 0.9, 0.12); this.noise(0.9, 0.05, 'highpass', 2000, 8000); break;
      case 'ui': if (!this.sample('ui', 0.4)) this.tone('sine', 700, 760, 0.06, 0.07); break;
      case 'buy': if (!this.sample('confirm', 0.45)) { this.tone('triangle', 520, 520, 0.08, 0.1); this.tone('triangle', 780, 780, 0.12, 0.1, 0.07); } break;
      case 'error': this.tone('square', 170, 150, 0.14, 0.06, 0, ['lowpass', 900]); break;
      case 'heavy': this.tone('sine', 110, 60, 0.18, 0.12); break;
      case 'warp': this.tone('sawtooth', 1600, 60, 1.2, 0.08, 0, ['lowpass', 2400]); this.noise(1.2, 0.08, 'bandpass', 3000, 200, 0, 3); break;
      case 'deploy': this.tone('sine', 900, 300, 0.35, 0.12); this.noise(0.3, 0.08, 'highpass', 3000, 900); break;
      case 'surrender': this.tone('triangle', 500 * r, 380, 0.2, 0.05 * v); break;
      case 'fanfare': if (!this.sample('levelup', 0.5)) [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.1, i * 0.16)); break;
      case 'pylon': if (!this.sample('bigkill', 0.5)) this.play('boom'); break;
      case 'battle': this.sample('boss', 0.45); break;
      case 'sad': [392, 370, 349, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.5, 0.08, i * 0.22)); break;
      case 'step': this.tone('sine', 1200, 1500, 0.08, 0.06); break;
    }
  }
  /** Background music: a CC0 track for battles, generative ambience everywhere else. */
  setMusic(mood: 'calm' | 'tense' | 'battle' | 'none') {
    this.mood = mood; this.musicWanted = mood === 'battle'; this.gamePaused = false;   // a new scene is never paused
    if (this.musicWanted && !this.music) { this.music = new Audio('assets/audio/music/battle_theme_a.mp3'); this.music.loop = true; this.music.volume = 0.35; }
    this.refreshVolume();
  }
  private schedule() {
    if (!this.ctx || !this.audible() || document.hidden || this.mood === 'none' || this.musicWanted) return;
    const c = this.ctx; if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    const tempo = this.mood === 'calm' ? 0.32 : 0.2, scale = [0, 3, 5, 7, 10, 12, 15];
    while (this.nextT < c.currentTime + 0.25) {
      const st = this.step++, d = this.nextT - c.currentTime;
      if (st % 8 === 0) this.tone('triangle', 55, 54, tempo * 7, 0.07, d, ['lowpass', 300]);
      if (Math.random() < (this.mood === 'calm' ? 0.28 : 0.4)) { const n = scale[Math.floor(Math.random() * scale.length)] + (Math.random() < 0.3 ? 12 : 0); this.tone('sine', 220 * 2 ** (n / 12), 219 * 2 ** (n / 12), tempo * 1.6, 0.03, d, ['lowpass', 1800]); }
      if (this.mood === 'tense' && st % 4 === 2) this.noise(0.05, 0.03, 'highpass', 5000, 4000, d);
      this.nextT += tempo;
    }
  }
}
export const SFX = new Sfx();
