// Effects: sparks, smoke, laser bolts, explosions, light pillars, floating text and the tractor beam.
import * as THREE from 'three';
import { camera, scene, LIGHT } from '../core/engine';
import { SFX } from '../core/audio';
import { V3, _e1, _m1, _q1, _v1, _v2, _v3, clamp, damp, rand } from '../core/util';
import type { Vec3 } from '../core/util';

type Bolt = { pos: Vec3; vel: Vec3; trail: number; width: number; color: THREE.Color };
const boltSources: (() => Bolt[])[] = [];
let shakeHook: (pos: Vec3, size: number) => void = () => {};

export const FX = {
  sparks: [] as any[], smokes: [] as any[], lines: [] as any[], pillars: [] as { m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; life: number; max: number }[],
  glowMesh: null as THREE.InstancedMesh, smokeMesh: null as THREE.InstancedMesh, boltMesh: null as THREE.InstancedMesh,
  addBoltSource(f: () => Bolt[]) { boltSources.push(f); },
  onShake(f: typeof shakeHook) { shakeHook = f; },
  init() {
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    this.glowMesh = mk(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), 900);
    this.glowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(900 * 3), 3);
    this.smokeMesh = mk(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x45434f, roughness: 1, flatShading: true }), 400);
    this.boltMesh = mk(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), 500);
    this.boltMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(500 * 3), 3);
    const pgeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m); this.pillars.push({ m, life: 0, max: 1 });
    }
  },
  clear() { this.sparks.length = 0; this.smokes.length = 0; this.lines.length = 0; this.pillars.forEach(p => { p.life = 0; p.m.visible = false; }); FT.clear(); },
  spark(pos: Vec3, color: THREE.ColorRepresentation, n = 8, speed = 8, size = 0.35, life = 0.5, grav = -12) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.sparks.length < 900; i++) {
      const v = new V3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
      this.sparks.push({ p: pos.clone(), v, life: life * rand(0.6, 1), max: life, size: size * rand(0.6, 1.3), c, grav });
    }
  },
  smoke(pos: Vec3, n = 4, size = 1.4, life = 1.6, spread = 1) {
    for (let i = 0; i < n && this.smokes.length < 400; i++)
      this.smokes.push({ p: new V3(pos.x + rand(-spread, spread), pos.y + rand(0, spread), pos.z + rand(-spread, spread)), v: new V3(rand(-1, 1), rand(1.5, 3.5), rand(-1, 1)), life: life * rand(0.7, 1.2), max: life, size: size * rand(0.7, 1.3) });
  },
  line(a: Vec3, b: Vec3, color: THREE.ColorRepresentation, width = 0.25, life = 0.09) { this.lines.push({ a: a.clone(), b: b.clone(), c: new THREE.Color(color), w: width, life, max: life }); },
  explode(pos: Vec3, size = 1, quiet = false) {
    pos = pos.clone();
    this.spark(pos, new THREE.Color(4, 1.6, 0.4), Math.round(26 * size), 14 * size, 0.7 * size, 0.7, -6);
    this.spark(pos, new THREE.Color(4, 3, 1.2), Math.round(12 * size), 7 * size, 1.0 * size, 0.35, 0);
    this.smoke(pos, Math.round(7 * size), 2.2 * size, 2.2, 1.5 * size);
    LIGHT.flash.position.copy(pos).y += 3; LIGHT.flash.intensity = 900 * size;
    shakeHook(pos, size);
    if (!quiet) SFX.play(size > 1.3 ? 'boom' : 'smallboom', pos, 0.02);
  },
  pillar(pos: Vec3, color: THREE.ColorRepresentation, height = 160, life = 1.2, radius = 2) {
    const p = this.pillars.find(q => q.life <= 0) || this.pillars[0];
    p.m.position.set(pos.x, 0, pos.z); p.m.scale.set(radius, height, radius); p.m.material.color.copy(new THREE.Color(color)).multiplyScalar(2.5);
    p.life = p.max = life; p.m.visible = true;
  },
  update(dt: number) {
    let n = 0; const M = this.glowMesh;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]; s.life -= dt;
      if (s.life <= 0) { this.sparks[i] = this.sparks[this.sparks.length - 1]; this.sparks.pop(); continue; }
      s.v.y += s.grav * dt; s.v.multiplyScalar(1 - 1.5 * dt); s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.1) { s.p.y = 0.1; s.v.y *= -0.3; }
      const k = s.size * (s.life / s.max);
      _m1.compose(s.p, _q1.identity(), _v2.set(k, k, k)); M.setMatrixAt(n, _m1); M.setColorAt(n, s.c); n++;
    }
    M.count = n; M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true;
    n = 0; const S = this.smokeMesh;
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.life -= dt;
      if (s.life <= 0) { this.smokes[i] = this.smokes[this.smokes.length - 1]; this.smokes.pop(); continue; }
      s.p.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - 0.8 * dt);
      const t = 1 - s.life / s.max, k = s.size * Math.sin(Math.min(1, t * 1.3) * Math.PI) + 0.01;
      _m1.compose(s.p, _q1.setFromEuler(_e1.set(t * 2, t * 3, 0)), _v2.set(k, k, k)); S.setMatrixAt(n++, _m1);
    }
    S.count = n; S.instanceMatrix.needsUpdate = true;
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
    for (const p of this.pillars) if (p.life > 0) { p.life -= dt; p.m.material.opacity = clamp(p.life / p.max, 0, 1) * 0.7; p.m.scale.x = p.m.scale.z = p.m.scale.x * (1 - dt * 0.6); if (p.life <= 0) p.m.visible = false; }
    LIGHT.flash.intensity = Math.max(0, LIGHT.flash.intensity - dt * 2600);
    FT.update(dt);
  },
};

// ---------- floating text (DOM), optionally following an object ----------
type Follow = { pos: Vec3; hh: number; dead?: boolean };
export const FT = {
  layer: document.getElementById('float-layer') as HTMLElement, pool: [] as HTMLElement[],
  active: [] as { el: HTMLElement; pos: Vec3; life: number; max: number; rise: number; follow: Follow | null; off: number }[],
  spawn(pos: Vec3, text: string, cls = '', life = 1.1, rise = 2.2, follow: Follow | null = null) {
    if (this.active.length > 40) return;
    const el = this.pool.pop() || document.createElement('div');
    el.className = 'ft ' + cls; el.textContent = text; el.style.opacity = '1'; this.layer.appendChild(el);
    this.active.push({ el, pos: pos.clone(), life, max: life, rise, follow, off: 0 });
  },
  clear() { for (const a of this.active) { a.el.remove(); this.pool.push(a.el); } this.active.length = 0; },
  update(dt: number) {
    const W = innerWidth, H = innerHeight;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i]; a.life -= dt; a.off += a.rise * dt;
      if (a.life <= 0 || (a.follow && a.follow.dead)) { a.el.remove(); this.pool.push(a.el); this.active.splice(i, 1); continue; }
      _v1.copy(a.follow ? a.follow.pos : a.pos); _v1.y += (a.follow ? a.follow.hh * 2 + 0.8 : 0) + a.off; _v1.project(camera);
      if (_v1.z > 1) { a.el.style.opacity = '0'; continue; }
      a.el.style.transform = `translate(${((_v1.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-_v1.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%, -100%)`;
      a.el.style.opacity = String(clamp(a.life / 0.35, 0, 1));
    }
  },
};

// ---------- tractor beam ----------
export const BEAM = {
  mat: null as THREE.ShaderMaterial, cone: null as THREE.Mesh, ring: null as THREE.Mesh, ringMat: null as THREE.MeshBasicMaterial, on: 0,
  init() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0.75, 0.45, 1.6) }, alpha: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float time; uniform vec3 color; uniform float alpha; varying vec2 vUv;
        void main(){ float y = vUv.y;
          float rings = smoothstep(0.55, 1.0, sin(y * 22.0 - time * 10.0) * 0.5 + 0.5);
          float swirl = 0.5 + 0.5 * sin(vUv.x * 6.2831 * 7.0 + y * 9.0 + time * 4.0);
          float a = (0.09 + 0.34 * rings + 0.12 * swirl) * (0.35 + 0.65 * (1.0 - y));
          gl_FragColor = vec4(color * (1.0 + rings * 1.6), a * alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 1, 1, 40, 1, true).translate(0, -0.5, 0), this.mat);
    this.cone.renderOrder = 3; this.cone.visible = false; scene.add(this.cone);
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.8, 2.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.position.y = 0.08; this.ring.renderOrder = 1; this.ring.visible = false; scene.add(this.ring);
  },
  hide() { this.cone.visible = false; this.ring.visible = false; LIGHT.beam.intensity = 0; this.on = 0; },
  update(dt: number, pos: Vec3, radius: number, active: boolean, time: number) {
    this.on = damp(this.on, active ? 1 : 0, 12, dt);
    this.mat.uniforms.time.value += dt; this.mat.uniforms.alpha.value = this.on;
    const h = pos.y - 1.3;
    this.cone.visible = this.on > 0.02; this.cone.position.set(pos.x, pos.y - 1.3, pos.z); this.cone.scale.set(radius, h, radius);
    this.ring.visible = true; this.ring.position.x = pos.x; this.ring.position.z = pos.z; this.ring.scale.setScalar(radius * (1 + 0.04 * Math.sin(time * 6)));
    this.ringMat.opacity = 0.22 + 0.5 * this.on;
    LIGHT.beam.position.set(pos.x, pos.y - 1.5, pos.z); LIGHT.beam.target.position.set(pos.x, 0, pos.z);
    LIGHT.beam.intensity = 520 * this.on; LIGHT.beam.angle = Math.atan2(radius * 1.1, h);
  },
};
