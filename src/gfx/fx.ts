// Effects ("Moonlit Toybox", docs/ART_STYLE.md §6 and §9): HDR sparks, toon cotton-puff smoke, laser bolts and the
// stun ray, explosions with a shock ring, banded light pillars, jelly abduction bubbles, dizzy stars, stepped
// fresnel shields, floating text with comic SFX words (styled in fx.css), and the slime tractor beam.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { camera, scene, LIGHT, QUALITY } from '../core/engine';
import { SFX } from '../core/audio';
import { V3, _e1, _m1, _q1, _v1, _v2, _v3, clamp, damp, pick, rand } from '../core/util';
import type { Vec3 } from '../core/util';
import { toonMaterial, inkify } from './toon';
import { PAL } from './palette';
import './fx.css';

/** HDR effect colours (§6). Alien = slime / violet / bubblegum, Earth fire = orange, never mixed. */
export const FXC = {
  slime: new THREE.Color(0.9, 2.4, 0.5),          // beam ring, BLORP sparks
  slimeCore: new THREE.Color(2.2, 2.6, 1.6),      // beam sparkles, hard rings
  violet: new THREE.Color(PAL.violet).multiplyScalar(2.6),   // Empire tech (unit drops)
  bubblegum: new THREE.Color(3.2, 1.1, 2.4),      // stun ray core + its hit sparks
  white: new THREE.Color(3, 3, 3),                // stun ray inner line
  poster: new THREE.Color(3.2, 2.6, 0.6),         // dizzy stars, star sparks, confetti
  fireYellow: new THREE.Color(4, 3.2, 0.8),       // explosion sparks
  fireOrange: new THREE.Color(4, 1.6, 0.4),       // explosion sparks, tank shells
  pistol: new THREE.Color(4, 2.4, 0.6),           // Earth small arms
};

type Bolt = { pos: Vec3; vel: Vec3; trail: number; width: number; color: THREE.Color };
/** Anything that can be stunned: gets dizzy stars while `stun > 0` (§6 "Dizzy stars"). */
export type DizzyEnt = { pos: Vec3; hh: number; r: number; stun: number; dead: boolean; lift?: number; seed?: number };
/** Something a jelly bubble can wrap (an entity being lifted). */
export type JellyTarget = { pos: Vec3; hh: number; r: number; dead: boolean; lift?: number };
export type WordKind = 'beam' | 'lift' | 'bank' | 'zap' | 'pow' | 'boom' | 'pylon' | 'hq' | 'send' | 'bonk';

const boltSources: (() => Bolt[])[] = [];
const dizzySources: (() => readonly DizzyEnt[])[] = [];
let shakeHook: (pos: Vec3, size: number) => void = () => {};
const low = () => QUALITY === 'low';

// ---------- smoke colour over life (§6: cream → poster → orange → lavender) ----------
const SMOKE_COL = PAL.smoke.map(c => new THREE.Color(c));
const _sc = new THREE.Color();
function smokeColor(t: number, hot: boolean, out: THREE.Color) {
  const [c0, c1, c2, c3] = SMOKE_COL;
  if (!hot) return out.copy(c0).lerp(c3, clamp((t - 0.1) / 0.5, 0, 1));   // dust: cream → lavender
  if (t < 0.15) return out.copy(c0);
  if (t < 0.35) return out.copy(c0).lerp(c1, (t - 0.15) / 0.2);
  if (t < 0.6) return out.copy(c1).lerp(c2, (t - 0.35) / 0.25);
  return out.copy(c2).lerp(c3, (t - 0.6) / 0.4);
}

// ---------- stepped fresnel (shields, jelly bubbles) ----------
/**
 * Cartoon fresnel shell (§6 "Shields"): fresnel quantised as floor(f*3+0.15)/3, the hex shimmer of the old
 * shield, a white hit flash (`flash` 0..1) and a vertex wobble along the normal (`wob` 0..1 × `wobAmp` units).
 * Additive and never inked. Every instance shares one program.
 */
export function shellMaterial(color: THREE.ColorRepresentation, power = 2.0, opacity = 0.6, o: { hex?: boolean; wobAmp?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, opacity: { value: opacity }, time: { value: 0 },
      flash: { value: 0 }, wob: { value: 0 }, wobAmp: { value: o.wobAmp ?? 0.2 }, hexOn: { value: o.hex === false ? 0 : 1 } },
    // View-space normal via normalMatrix (correct under the non-uniform scale of the squashed player shield);
    // the wobble phase uses the unit direction so the ripple size is the same on a 1 m bubble and the 30 m HQ dome.
    vertexShader: /* glsl */`uniform float time; uniform float wob; uniform float wobAmp;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vec3 d = normalize(position);
        vec3 p = position + normal * (wob * wobAmp * sin(d.y * 7.0 + d.x * 4.5 + time * 24.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vP = position;
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform vec3 color; uniform float power; uniform float opacity; uniform float time; uniform float flash; uniform float hexOn;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), power);
        f = min(1.0, floor(f * 3.0 + 0.15) / 3.0);
        float hex = mix(1.0, 0.75 + 0.25 * sin(vP.x * 2.2 + time * 2.0) * sin(vP.y * 2.2 - time * 1.3) * sin(vP.z * 2.2), hexOn);
        vec3 c = mix(color, vec3(3.0), flash);
        gl_FragColor = vec4(c * (f * hex + 0.06), opacity * clamp(f + 0.08 + flash * 0.4, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------- banded pillar shader (send cargo, unit drop, saucer down): 4 hard bands scrolling up ----------
function pillarMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { color: { value: new THREE.Color() }, opacity: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform vec3 color; uniform float opacity; uniform float time; varying vec2 vUv;
      void main(){
        float band = step(0.55, fract(vUv.y * 4.0 - time * 1.8));
        float a = (0.28 + 0.6 * band) * (1.0 - 0.55 * vUv.y) * opacity;
        gl_FragColor = vec4(color * (0.8 + band * 0.9), min(a, 0.9));
        #include <colorspace_fragment>
      }`,
  });
}

/** A pillar or a flat shock ring. Both share one pool of slots (§6 "It reuses a pillar slot"). */
interface Slot {
  m: THREE.Mesh; kind: 'pillar' | 'ring'; life: number; max: number;
  pmat: THREE.ShaderMaterial; rmat: THREE.MeshBasicMaterial; r1: number; c0: THREE.Color; c1: THREE.Color;
}
/** A pooled jelly bubble (§6 "Abduction"). */
interface Bubble { m: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; follow: JellyTarget | null; pop: number; fade: number; t: number; r: number }

// ---------- comic SFX words (§6 table) ----------
const WORDS: Record<WordKind, readonly string[]> = {
  beam: ['FWOOMP!'], lift: ['YOINK!', 'SHLOOP!', 'WHEEE!'], bank: ['BLORP!'], zap: ['ZAP!', 'BZZT!', 'ZZT!'],
  pow: ['POW!', 'BLAM!', 'CLANG!'], boom: ['KA-BOOM!', 'KA-POW!'], pylon: ['KER-CHUNK!'], hq: ['KA-BLOOEY!'],
  send: ['WHOOSH!'], bonk: ['BONK!', 'DOINK!'],
};
/** Per-kind cooldowns on top of the 0.25 s global one. */
const WORD_COOL: Partial<Record<WordKind, number>> = { beam: 1.5, zap: 0.35, boom: 0.4 };
/** Big story beats: they skip the cooldowns and may push out the oldest word. */
const WORD_PRIORITY = new Set<WordKind>(['pylon', 'hq']);
const wordLast: Partial<Record<WordKind, number>> = {};
let fxClock = 0, wordGlobal = -1e9, tutEl: HTMLElement | null = null;

export const FX = {
  sparks: [] as any[], smokes: [] as any[], lines: [] as any[], slots: [] as Slot[], bubbles: [] as Bubble[],
  tweens: [] as ((dt: number) => boolean)[],
  glowMesh: null as THREE.InstancedMesh, smokeMesh: null as THREE.InstancedMesh, boltMesh: null as THREE.InstancedMesh,
  addBoltSource(f: () => Bolt[]) { boltSources.push(f); },
  /** Register a list of entities that get orbiting dizzy stars while stunned. */
  addDizzySource(f: () => readonly DizzyEnt[]) { dizzySources.push(f); },
  onShake(f: typeof shakeHook) { shakeHook = f; },
  init() {
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    this.glowMesh = mk(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), 900);
    this.glowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(900 * 3), 3);
    // cotton puffs: toon + per-instance colour over life + ink hull (§6 "Explosions")
    this.smokeMesh = mk(new THREE.IcosahedronGeometry(0.5, 1), toonMaterial({ color: 0xffffff }), 400);
    this.smokeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(400 * 3), 3);
    inkify(this.smokeMesh);
    this.boltMesh = mk(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 500);
    this.boltMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(500 * 3), 3);
    // pillar / shock-ring slots
    const pgeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0);
    const rgeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const pmat = pillarMaterial();
      const rmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(pgeo, pmat); m.visible = false; m.renderOrder = 3; scene.add(m);
      m.userData.geos = { pillar: pgeo, ring: rgeo };
      this.slots.push({ m, kind: 'pillar', life: 0, max: 1, pmat, rmat, r1: 1, c0: new THREE.Color(), c1: new THREE.Color() });
    }
    // jelly bubbles: SphereGeometry(1, 16, 10), slime fresnel power 1.4, opacity 0.5, stepped (pool of 6)
    const bgeo = new THREE.SphereGeometry(1, 16, 10);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(bgeo, shellMaterial(PAL.slime, 1.4, 0.5, { hex: false, wobAmp: 0 }));
      m.visible = false; m.renderOrder = 2; scene.add(m);
      this.bubbles.push({ m, follow: null, pop: 0, fade: 0, t: 0, r: 1 });
    }
  },
  clear() {
    this.sparks.length = 0; this.smokes.length = 0; this.lines.length = 0; this.tweens.length = 0;
    this.slots.forEach(p => { p.life = 0; p.m.visible = false; });
    this.bubbles.forEach(b => { b.follow = null; b.pop = 0; b.fade = 0; b.m.visible = false; });
    FT.clear();
  },
  spark(pos: Vec3, color: THREE.ColorRepresentation, n = 8, speed = 8, size = 0.35, life = 0.5, grav = -12) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.sparks.length < 780; i++) {   // 900 instances minus room for 120 dizzy stars
      const v = new V3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
      this.sparks.push({ p: pos.clone(), v, life: life * rand(0.6, 1), max: life, size: size * rand(0.6, 1.3), c, grav });
    }
  },
  /** Toon puffs. `hot` (default) runs the fire colours; false is dust (cream → lavender). Rise speed ×0.8. */
  smoke(pos: Vec3, n = 4, size = 1.4, life = 1.6, spread = 1, hot = true) {
    for (let i = 0; i < n && this.smokes.length < 400; i++) {
      const l = life * rand(0.7, 1.2);
      this.smokes.push({ p: new V3(pos.x + rand(-spread, spread), pos.y + rand(0, spread), pos.z + rand(-spread, spread)), v: new V3(rand(-1, 1), rand(1.2, 2.8), rand(-1, 1)),
        life: l, max: l, size: size * rand(0.7, 1.3), hot, spin: rand(0, 6) });
    }
  },
  line(a: Vec3, b: Vec3, color: THREE.ColorRepresentation, width = 0.25, life = 0.09) { this.lines.push({ a: a.clone(), b: b.clone(), c: new THREE.Color(color), w: width, life, max: life }); },
  /**
   * Stun ray (§6): bubblegum core (width 0.32) plus a white inner line (width 0.12). The inner line is nudged
   * toward the camera so it sits on the front face of the opaque core box instead of inside it.
   */
  ray(a: Vec3, b: Vec3) {
    this.line(a, b, FXC.bubblegum, 0.32, 0.09);
    const off = _v1.addVectors(a, b).multiplyScalar(0.5); off.subVectors(camera.position, off).normalize().multiplyScalar(0.24);
    this.line(_v2.copy(a).add(off), _v3.copy(b).add(off), FXC.white, 0.12, 0.09);
  },
  explode(pos: Vec3, size = 1, quiet = false) {
    pos = pos.clone();
    // fire sparks: counts −30 %, poster 0.9 / orange 0.7, life 0.45 s
    this.spark(pos, FXC.fireOrange, Math.round(18 * size), 14 * size, 0.7 * size, 0.45, -6);
    this.spark(pos, FXC.fireYellow, Math.round(8 * size), 7 * size, 0.9 * size, 0.45, 0);
    this.smoke(pos, Math.round(7 * size), 2.2 * size, 0.95, 1.5 * size);
    // shock ring: flat at y 0.1 (or at the blast when it is high in the air), white → poster, 0 → 6 × size in 0.25 s
    this.ring(_v1.set(pos.x, pos.y < 6 ? 0.1 : pos.y, pos.z), 6 * size, 0.25, FXC.white, FXC.poster);
    LIGHT.flash.position.copy(pos).y += 3; LIGHT.flash.intensity = 900 * size;
    shakeHook(pos, size);
    if (!quiet) { SFX.play(size > 1.3 ? 'boom' : 'smallboom', pos, 0.02); this.word(pos, size > 1.3 ? 'boom' : 'pow', size); }
  },
  /** Find a free slot; pillars may take over the oldest one, rings only use free slots. */
  _slot(steal: boolean) {
    let s = this.slots.find(q => q.life <= 0);
    if (!s && steal) s = this.slots.reduce((a, b) => (b.kind === 'ring' && a.kind !== 'ring') || (b.kind === a.kind && b.life < a.life) ? b : a);
    return s || null;
  },
  pillar(pos: Vec3, color: THREE.ColorRepresentation, height = 160, life = 1.2, radius = 2) {
    const p = this._slot(true);
    p.kind = 'pillar'; p.m.geometry = p.m.userData.geos.pillar; p.m.material = p.pmat;
    p.m.position.set(pos.x, 0, pos.z); p.m.scale.set(radius, height, radius); p.pmat.uniforms.color.value.set(color).multiplyScalar(2.5);
    p.life = p.max = life; p.m.visible = true;
  },
  /** Flat expanding ring (explosion / stun shockwave): radius 0 → r1 over `life`, colour c0 → c1, fading out. */
  ring(pos: Vec3, r1: number, life: number, c0: THREE.ColorRepresentation, c1: THREE.ColorRepresentation = c0) {
    const s = this._slot(false); if (!s) return;
    s.kind = 'ring'; s.m.geometry = s.m.userData.geos.ring; s.m.material = s.rmat;
    s.m.position.copy(pos); s.m.scale.setScalar(0.01); s.r1 = r1; s.c0.set(c0); s.c1.set(c1); s.rmat.color.copy(s.c0); s.rmat.opacity = 1;
    s.life = s.max = life; s.m.visible = true;
  },
  /** Run `fn(dt)` every frame until it returns false (flag pops, springs). Cleared with the world. */
  tween(fn: (dt: number) => boolean) { this.tweens.push(fn); },

  // ---------- jelly bubbles ----------
  /** Wrap a lifted target in a slime jelly bubble (×1.4 its radius). At most 6 (4 on low); returns false when full. */
  bubble(target: JellyTarget) {
    if (this.bubbles.some(b => b.follow === target)) return true;
    const cap = low() ? 4 : 6;
    const b = this.bubbles.slice(0, cap).find(q => !q.follow && q.pop <= 0 && q.fade <= 0); if (!b) return false;
    b.follow = target; b.t = 0; b.pop = 0; b.fade = 0; b.r = 1.4 * Math.max(target.r, target.hh);
    b.m.material.uniforms.opacity.value = 0.5; b.m.visible = true;
    return true;
  },
  /** Bubble pop on arrival: scale 1 → 1.4 and opacity → 0 over 0.18 s. */
  popBubble(target: JellyTarget) {
    const b = this.bubbles.find(q => q.follow === target); if (!b) return;
    b.follow = null; b.pop = 0.18;
  },

  // ---------- comic words ----------
  /**
   * Comic SFX word (§6 table) as DOM '.ft.sfx.sfx-<kind>'. Throttled: 0.25 s global cooldown, per-kind cooldowns,
   * at most 5 alive (3 on low or while the tutorial card is open), and on low only events with size ≥ 1.
   * Only shown in missions and invasions (not on the title).
   */
  word(pos: Vec3, kind: WordKind, size = 1) {
    const mode = document.body.dataset.mode;
    if (mode !== 'mission' && mode !== 'invasion' && mode !== 'victory') return;
    if (low() && size < 1) return;
    const prio = WORD_PRIORITY.has(kind);
    if (!prio && (fxClock - wordGlobal < 0.25 || fxClock - (wordLast[kind] ?? -1e9) < (WORD_COOL[kind] ?? 0))) return;
    tutEl = tutEl || document.getElementById('tut');
    const cap = (tutEl && !tutEl.hidden) || low() ? 3 : 5;
    const alive = FT.active.filter(a => a.sfx);
    if (alive.length >= cap) { if (!prio) return; FT.kill(alive[0]); }
    wordGlobal = fxClock; wordLast[kind] = fxClock;
    FT.spawn(pos, pick(WORDS[kind]), `sfx sfx-${kind}`, 0.7, 3.5);
  },

  update(dt: number) {
    fxClock += dt;
    for (let i = this.tweens.length - 1; i >= 0; i--) if (!this.tweens[i](dt)) { this.tweens[i] = this.tweens[this.tweens.length - 1]; this.tweens.pop(); }
    // ---- sparks ----
    let n = 0; const M = this.glowMesh;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.life -= dt;
      if (s.life <= 0) { this.sparks[i] = this.sparks[this.sparks.length - 1]; this.sparks.pop(); continue; }
      s.v.y += s.grav * dt; s.v.multiplyScalar(1 - 1.5 * dt); s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.1) { s.p.y = 0.1; s.v.y *= -0.3; }
      const k = s.size * (s.life / s.max);
      _m1.compose(s.p, _q1.identity(), _v2.set(k, k, k)); M.setMatrixAt(n, _m1); M.setColorAt(n, s.c); n++;
    }
    // ---- dizzy stars: 3 poster stars orbiting at head height, r 0.55, 4 rev/s; cap 40 entities (20 on low) ----
    let dizzy = 0; const dcap = low() ? 20 : 40;
    for (const src of dizzySources) for (const e of src()) {
      if (dizzy >= dcap) break;
      if (!(e.stun > 0) || e.dead || e.lift) continue;
      dizzy++;
      const R = Math.max(0.55, e.r * 0.5), y = e.pos.y + e.hh * 2 + 0.25, k = 0.44 * clamp(e.stun / 0.3, 0, 1);   // radius 0.22 (unit ico is r 0.5)
      for (let j = 0; j < 3; j++) {
        const a = fxClock * 4 * Math.PI * 2 + j * (Math.PI * 2 / 3) + (e.seed || 0);
        _v1.set(e.pos.x + Math.cos(a) * R, y + Math.sin(a * 2) * 0.06, e.pos.z + Math.sin(a) * R);
        _m1.compose(_v1, _q1.identity(), _v2.set(k, k, k)); M.setMatrixAt(n, _m1); M.setColorAt(n, FXC.poster); n++;
      }
    }
    M.count = n; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
    // ---- cotton puffs: pop 0 → 1.15 in 0.12 s, settle at 1.0, shrink to 0 over the last 45 % ----
    n = 0; const S = this.smokeMesh;
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.life -= dt;
      if (s.life <= 0) { this.smokes[i] = this.smokes[this.smokes.length - 1]; this.smokes.pop(); continue; }
      s.p.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - 0.8 * dt);
      const age = s.max - s.life, t = age / s.max;
      let k = age < 0.12 ? 1.15 * Math.sin(age / 0.12 * Math.PI / 2) : age < 0.24 ? 1.15 - 0.15 * (age - 0.12) / 0.12 : 1;
      if (t > 0.55) k *= 1 - (t - 0.55) / 0.45;
      k *= s.size;
      if (k < 0.06) continue;   // nearly gone: skip it, or its constant-width ink hull would linger as a dark speck
      _m1.compose(s.p, _q1.setFromEuler(_e1.set(s.spin + t * 1.5, s.spin * 0.7 + t * 2, 0)), _v2.set(k, k, k)); S.setMatrixAt(n, _m1);
      S.setColorAt(n, smokeColor(t, s.hot, _sc)); n++;
    }
    S.count = n; S.instanceMatrix.needsUpdate = true; if (S.instanceColor) S.instanceColor.needsUpdate = true;
    // ---- bolts and lines ----
    n = 0; const B = this.boltMesh;
    const draw = (a: Vec3, b: Vec3, w: number, c: THREE.Color) => {
      const len = a.distanceTo(b); if (len < 0.01 || n >= 500) return;
      _v3.addVectors(a, b).multiplyScalar(0.5); _m1.lookAt(a, b, THREE.Object3D.DEFAULT_UP); _q1.setFromRotationMatrix(_m1);
      _m1.compose(_v3, _q1, _v2.set(w, w, len)); B.setMatrixAt(n, _m1); B.setColorAt(n, c); n++;
    };
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i]; L.life -= dt;
      if (L.life <= 0) { this.lines[i] = this.lines[this.lines.length - 1]; this.lines.pop(); continue; }
      draw(L.a, L.b, L.w * (0.4 + 0.6 * L.life / L.max), L.c);
    }
    for (const src of boltSources) for (const p of src()) { _v1.copy(p.pos).addScaledVector(p.vel, -p.trail / Math.max(1, p.vel.length())); draw(_v1, p.pos, p.width, p.color); }
    B.count = n; B.instanceMatrix.needsUpdate = true; if (B.instanceColor) B.instanceColor.needsUpdate = true;
    // ---- pillars and shock rings ----
    for (const p of this.slots) if (p.life > 0) {
      p.life -= dt; const f = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'pillar') {
        p.pmat.uniforms.opacity.value = f * 0.7; p.pmat.uniforms.time.value = fxClock;
        p.m.scale.x = p.m.scale.z = p.m.scale.x * (1 - dt * 0.6);
      } else {
        const u = 1 - f, e = 1 - (1 - u) * (1 - u);   // ease-out growth
        p.m.scale.setScalar(Math.max(0.01, p.r1 * e)); p.rmat.color.copy(p.c0).lerp(p.c1, u); p.rmat.opacity = f;
      }
      if (p.life <= 0) p.m.visible = false;
    }
    // ---- jelly bubbles ----
    for (const b of this.bubbles) {
      if (!b.m.visible) continue;
      b.t += dt; const U = b.m.material.uniforms; U.time.value = fxClock;
      const T = b.follow;
      if (T && (T.dead || T.lift !== 1)) { b.follow = null; b.fade = 0.15; }   // dropped: fade away
      if (b.follow) {
        b.m.position.set(T.pos.x, T.pos.y + T.hh, T.pos.z);
        const w = Math.sin(b.t * 9) * 0.06, grow = Math.min(1, b.t / 0.12);   // jelly wobble, quick grow-in
        b.m.scale.set(b.r * (1 - w) * grow, b.r * (1 + w) * grow, b.r * (1 - w) * grow);
      } else if (b.pop > 0) {
        b.pop -= dt; const u = 1 - clamp(b.pop / 0.18, 0, 1);
        b.m.scale.setScalar(b.r * (1 + 0.4 * u)); U.opacity.value = 0.5 * (1 - u);
        if (b.pop <= 0) b.m.visible = false;
      } else if (b.fade > 0) {
        b.fade -= dt; U.opacity.value = 0.5 * clamp(b.fade / 0.15, 0, 1);
        if (b.fade <= 0) b.m.visible = false;
      } else b.m.visible = false;
    }
    LIGHT.flash.intensity = Math.max(0, LIGHT.flash.intensity - dt * 2600);
    FT.update(dt);
  },
};

// ---------- floating text (DOM), optionally following an object ----------
// Positioned with the `translate` property (not `transform`) so the CSS pop (`scale`) and tilt (`rotate: var(--rot)`)
// from style.css / fx.css apply around the label itself (§9: individual scale/rotate props, never transform).
type Follow = { pos: Vec3; hh: number; dead?: boolean };
type FtEntry = { el: HTMLElement; pos: Vec3; life: number; max: number; rise: number; follow: Follow | null; off: number; sfx: boolean };
export const FT = {
  layer: document.getElementById('float-layer') as HTMLElement, pool: [] as HTMLElement[],
  active: [] as FtEntry[],
  spawn(pos: Vec3, text: string, cls = '', life = 1.1, rise = 2.2, follow: Follow | null = null) {
    if (this.active.length > 40) return;
    const el = this.pool.pop() || document.createElement('div');
    const sfx = cls.split(' ').includes('sfx');
    el.className = 'ft ' + cls; el.textContent = text; el.style.opacity = '1';
    el.style.setProperty('--rot', `${(sfx ? rand(-12, 12) : rand(-4, 4)).toFixed(1)}deg`);
    this.layer.appendChild(el);   // (re)inserting restarts the CSS pop animation
    this.active.push({ el, pos: pos.clone(), life, max: life, rise, follow, off: 0, sfx });
  },
  kill(a: FtEntry) { a.el.remove(); this.pool.push(a.el); const i = this.active.indexOf(a); if (i >= 0) this.active.splice(i, 1); },
  clear() { for (const a of this.active) { a.el.remove(); this.pool.push(a.el); } this.active.length = 0; },
  update(dt: number) {
    const W = innerWidth, H = innerHeight;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i]; a.life -= dt; a.off += a.rise * dt;
      if (a.life <= 0 || (a.follow && a.follow.dead)) { a.el.remove(); this.pool.push(a.el); this.active.splice(i, 1); continue; }
      _v1.copy(a.follow ? a.follow.pos : a.pos); _v1.y += (a.follow ? a.follow.hh * 2 + 0.8 : 0) + a.off; _v1.project(camera);
      if (_v1.z > 1) { a.el.style.opacity = '0'; continue; }
      a.el.style.translate = `calc(${((_v1.x * 0.5 + 0.5) * W).toFixed(1)}px - 50%) calc(${((-_v1.y * 0.5 + 0.5) * H).toFixed(1)}px - 100%)`;
      a.el.style.opacity = String(clamp(a.life / 0.35, 0, 1));
    }
  },
};

// ---------- tractor beam (§6: slime, hard rising bands, fresnel edge, bubbles, vertex wobble) ----------
export const BEAM = {
  mat: null as THREE.ShaderMaterial, cone: null as THREE.Mesh, ring: null as THREE.Group, dashes: null as THREE.Mesh, ringMat: null as THREE.MeshBasicMaterial,
  on: 0, wasActive: false, frame: 0,
  init() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, alpha: { value: 0 } },
      vertexShader: /* glsl */`uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          vUv = uv;
          vec3 p = position; p.xz *= 1.0 + 0.04 * sin(uv.y * 12.0 + time * 5.0);   // jelly wobble of the radius
          // view space + normalMatrix: the cone is scaled (radius, height, radius), so mat3(modelMatrix) would
          // tilt every normal toward the long axis and the fresnel edge would vanish
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform float time; uniform float alpha; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          float y = vUv.y;
          float band = step(0.55, fract(vUv.y * 7.0 - time * 1.8));                        // hard rings rising
          float edge = smoothstep(0.55, 0.62, 1.0 - abs(dot(normalize(vN), normalize(vV))));
          vec2 bp = vec2(vUv.x * 20.0, vUv.y * 8.0 - time * 1.2), cell = floor(bp), f = fract(bp);
          vec2 c = 0.3 + 0.4 * vec2(hash(cell + 7.1), hash(cell + 3.7));
          float bub = step(hash(cell), 0.35) * (1.0 - step(0.18, length(f - c)));         // rising goo bubbles
          float a = min((0.12 + 0.38 * band * (1.0 - 0.6 * y) + 0.5 * edge + 0.25 * bub) * alpha, 0.55);
          vec3 col = mix(vec3(0.55, 1.6, 0.35), vec3(2.2, 2.6, 1.6), max(max(band * 0.6, edge), bub));
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 1, 1, 40, 16, true).translate(0, -0.5, 0), this.mat);
    this.cone.renderOrder = 3; this.cone.visible = false; scene.add(this.cone);
    // ground ring: solid outer RingGeometry(0.88, 1, 64) in slime HDR + 12 inner dashes rotating at 1.2 rad/s
    this.ringMat = new THREE.MeshBasicMaterial({ color: FXC.slime, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.ring = new THREE.Group();
    this.ring.add(new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 64).rotateX(-Math.PI / 2), this.ringMat));
    const dash: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) dash.push(new THREE.RingGeometry(0.68, 0.78, 3, 1, i / 12 * Math.PI * 2, Math.PI * 2 / 12 * 0.55));
    this.dashes = new THREE.Mesh(mergeGeometries(dash).rotateX(-Math.PI / 2), this.ringMat); dash.forEach(g => g.dispose());
    this.ring.add(this.dashes);
    this.ring.children.forEach(c => { c.renderOrder = 1; });
    this.ring.position.y = 0.08; this.ring.visible = false; scene.add(this.ring);
  },
  hide() { this.cone.visible = false; this.ring.visible = false; LIGHT.beam.intensity = 0; this.on = 0; this.wasActive = false; },
  update(dt: number, pos: Vec3, radius: number, active: boolean, time: number) {
    this.on = damp(this.on, active ? 1 : 0, 12, dt);
    this.mat.uniforms.time.value += dt; this.mat.uniforms.alpha.value = this.on;
    const h = pos.y - 1.3;
    this.cone.visible = this.on > 0.02; this.cone.position.set(pos.x, pos.y - 1.3, pos.z); this.cone.scale.set(radius, h, radius);
    this.ring.visible = true; this.ring.position.x = pos.x; this.ring.position.z = pos.z; this.ring.scale.setScalar(radius * (1 + 0.04 * Math.sin(time * 6)));
    this.dashes.rotation.y += 1.2 * dt;
    this.ringMat.opacity = 0.22 + 0.5 * this.on;
    LIGHT.beam.position.set(pos.x, pos.y - 1.5, pos.z); LIGHT.beam.target.position.set(pos.x, 0, pos.z);
    LIGHT.beam.intensity = 600 * this.on; LIGHT.beam.angle = Math.atan2(radius * 1.1, h);
    // FWOOMP! when the beam switches on (1.5 s cooldown inside FX.word)
    if (active && !this.wasActive) FX.word(_v1.set(pos.x, Math.max(2, pos.y * 0.45), pos.z), 'beam');
    this.wasActive = active;
    // rising sparkles: 2 per frame (1 every 2 frames on low), slime-core, gravity +6, size 0.25
    this.frame++;
    if (this.on > 0.5 && (!low() || this.frame % 2 === 0)) {
      for (let i = low() ? 1 : 2; i > 0; i--) {
        const a = rand(0, Math.PI * 2), rr = radius * 0.85 * Math.sqrt(Math.random());
        FX.spark(_v1.set(pos.x + Math.cos(a) * rr, rand(0.2, 1.5), pos.z + Math.sin(a) * rr), FXC.slimeCore, 1, 1.5, 0.25, 0.9, 6);
      }
    }
  },
};
