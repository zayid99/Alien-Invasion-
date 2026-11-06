// Art-style reference renders: one game scene (saucer beaming up a cow, house, tank, alien, townspeople,
// trees) drawn in 10 candidate styles. Dev-only page: /tools/styles/?s=1..10
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import '@fontsource/bangers';
import '@fontsource/lilita-one';
import '@fontsource/fredoka/600.css';

const W = 1200, H = 720;
const S = Number(new URLSearchParams(location.search).get('s') || 1);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, 0.5, 400);
camera.position.set(24, 19, 26); camera.lookAt(0, 3, 0);

// ------------------------------------------------------------------ deterministic random
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ------------------------------------------------------------------ helpers
const named = (hex: string, tag = 'std') => { const m = new THREE.MeshStandardMaterial({ color: hex }); m.name = `${hex.replace('#', '')}__${tag}`; return m; };
function parse(m: THREE.Material) {
  const [hex, tag = 'std'] = m.name.split('__');
  const kind = tag.startsWith('glow') ? 'glow' : tag;
  return { color: new THREE.Color('#' + hex), kind, k: kind === 'glow' ? parseFloat(tag.slice(4)) || 1.5 : 1 };
}
function gradientTex(stops: [number, string][], w = 4, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h); for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
function toonRamp(levels: number[]) {
  const d = new Uint8Array(levels.map(v => Math.round(v * 255)));
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
/** Inverted-hull outline in a chosen colour (object-space normal push). */
function outline(root: THREE.Object3D, color: string, w: number) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${w.toFixed(3)};`); };
  const list: THREE.Mesh[] = [];
  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.noInk) list.push(m); });
  for (const m of list) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.every(x => x.transparent)) continue;
    const h = new THREE.Mesh(m.geometry, mat); h.userData.noInk = true; h.raycast = () => {}; m.add(h);
  }
}
function restyle(root: THREE.Object3D, fn: (p: ReturnType<typeof parse>, mesh: THREE.Mesh) => THREE.Material) {
  root.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh || m.userData.noInk || m.userData.keep) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const out = mats.map(x => fn(parse(x), m));
    m.material = Array.isArray(m.material) ? out : out[0];
  });
}
const shadows = (root: THREE.Object3D) => root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

// ------------------------------------------------------------------ scene content
const loader = new GLTFLoader();
const glb = async (f: string) => (await loader.loadAsync(`/tools/compare/models/${f}.glb`)).scene;
function tree(x: number, z: number, s: number) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8), named('#7a4a2a')); trunk.position.y = 0.8; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.35, 1.9, 10), named('#4fae4a')); c.position.y = 2 + i * 1.0; g.add(c);
  }
  g.position.set(x, 0, z); g.scale.setScalar(s); return g;
}
function groundGroup() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), named('#3f8a3a')); ground.userData.ground = true; g.add(ground);
  const road = new THREE.Mesh(new THREE.BoxGeometry(120, 0.06, 5.5), named('#3d3a5c')); road.position.set(0, 0.03, 9.5); road.userData.ground = true; g.add(road);
  for (let x = -50; x <= 50; x += 6) { const d = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.3), named('#ffd23f')); d.position.set(x, 0.05, 9.5); d.userData.ground = true; g.add(d); }
  return g;
}

interface Built { world: THREE.Group; parts: Record<string, THREE.Object3D>; beam: THREE.Mesh }
async function build(): Promise<Built> {
  const world = new THREE.Group(); scene.add(world);
  const [saucer, cow, house, tank, alien, civ] = await Promise.all(['saucer', 'cow', 'house', 'tank', 'alien', 'civilian'].map(glb));
  const parts: Record<string, THREE.Object3D> = { saucer, cow, house, tank, alien, civ };
  world.add(groundGroup());
  house.position.set(-10, 0, -7); house.rotation.y = 0.45; world.add(house);
  const house2 = house.clone(); house2.position.set(-20, 0, 2); house2.rotation.y = 1.2; world.add(house2); parts.house2 = house2;
  tank.position.set(11, 0, 4); tank.rotation.y = -2.2; world.add(tank);
  saucer.scale.setScalar(0.72); saucer.position.set(2, 10.5, -2); saucer.rotation.z = 0.06; world.add(saucer);
  cow.position.set(2, 3.6, -2); cow.rotation.set(0.25, 0.9, -0.3); world.add(cow);
  alien.position.set(6.5, 0, -7); alien.rotation.y = -0.6; world.add(alien);
  const a2 = alien.clone(); a2.position.set(8.2, 0, -5.4); a2.rotation.y = -0.9; world.add(a2);
  civ.position.set(-3, 0, 5.5); civ.rotation.y = 0.9; world.add(civ);
  const c2 = civ.clone(); c2.position.set(-5.2, 0, 6.6); c2.rotation.y = 0.5; world.add(c2);
  for (const [x, z, s] of [[-2, -14, 1.1], [4, -15, 0.9], [12, -10, 1.2], [-17, -10, 1.0], [16, -2, 0.9], [-26, -4, 1.2], [20, -14, 1.1]] as const) world.add(tree(x, z, s));
  // tractor beam: open cone from the emitter to the ground
  const beamGeo = new THREE.CylinderGeometry(0.9, 3.2, 9.2, 32, 1, true); beamGeo.translate(0, 4.6, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#9cff3f', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(2, 0, -2); beam.userData.keep = true; beam.userData.noInk = true; world.add(beam);
  return { world, parts, beam };
}
function kawaiiFace(target: THREE.Object3D, pts: { eyes: [number, number, number][]; r: number; blush?: [number, number, number][] }) {
  const black = new THREE.MeshBasicMaterial({ color: '#2a1f3f' }), white = new THREE.MeshBasicMaterial({ color: '#ffffff' }), pink = new THREE.MeshBasicMaterial({ color: '#ff8fbf', transparent: true, opacity: 0.85 });
  for (const p of pts.eyes) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(pts.r, 16, 12), black); e.position.set(...p); e.scale.set(0.8, 1.15, 0.5); e.userData.keep = true; target.add(e);
    const s = new THREE.Mesh(new THREE.SphereGeometry(pts.r * 0.35, 8, 6), white); s.position.set(p[0] + pts.r * 0.25, p[1] + pts.r * 0.4, p[2] + pts.r * 0.4); s.userData.keep = true; s.userData.noInk = true; target.add(s);
  }
  for (const p of pts.blush || []) { const b = new THREE.Mesh(new THREE.SphereGeometry(pts.r * 0.8, 12, 8), pink); b.position.set(...p); b.scale.set(1, 0.55, 0.25); b.userData.keep = true; b.userData.noInk = true; target.add(b); }
}

// ------------------------------------------------------------------ post shaders
const FULL = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const NOISE = `float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }`;
const pass = (frag: string, uniforms: Record<string, any> = {}) => new ShaderPass({ uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(W, H) }, ...uniforms }, vertexShader: FULL, fragmentShader: frag });
/** Film grain, paper tint and vignette in one pass (runs on sRGB output). */
const gradePass = (o: { grain?: number; vignette?: number; tint?: string; tintAmt?: number; sat?: number; posterize?: number }) => pass(`
  uniform sampler2D tDiffuse; uniform vec2 res; uniform float grain, vig, tintAmt, sat, poster; uniform vec3 tint; varying vec2 vUv; ${NOISE}
  void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    if (poster > 0.0) c = floor(c * poster + 0.5) / poster;
    c = mix(c, c * tint, tintAmt);
    c += (hash(vUv * res + 3.1) - 0.5) * grain;
    vec2 d = vUv - 0.5; c *= 1.0 - vig * dot(d, d) * 2.2;
    gl_FragColor = vec4(c, 1.0); }`,
  { grain: { value: o.grain ?? 0 }, vig: { value: o.vignette ?? 0 }, tint: { value: new THREE.Color(o.tint ?? '#ffffff') }, tintAmt: { value: o.tintAmt ?? 0 }, sat: { value: o.sat ?? 1 }, poster: { value: o.posterize ?? 0 } });
/** Halftone: ink dots grow where the image is dark. */
const halftonePass = (cell: number, strength: number, ink: string, angle = 0.4) => pass(`
  uniform sampler2D tDiffuse; uniform vec2 res; uniform float cell, strength, ang; uniform vec3 ink; varying vec2 vUv;
  void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299,.587,.114));
    vec2 p = vUv * res; mat2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)); vec2 q = r * p / cell;
    vec2 f = fract(q) - 0.5; float rad = sqrt(clamp(1.0 - l * 1.35, 0.0, 1.0)) * 0.62;
    float dot_ = 1.0 - smoothstep(rad - 0.08, rad + 0.08, length(f));
    gl_FragColor = vec4(mix(c, ink, dot_ * strength), 1.0); }`,
  { cell: { value: cell }, strength: { value: strength }, ink: { value: new THREE.Color(ink) }, ang: { value: angle } });
/** Tilt-shift: blur away from a horizontal focus band (two passes). */
const tiltPass = (dir: [number, number], focus = 0.52, band = 0.16, amount = 5) => pass(`
  uniform sampler2D tDiffuse; uniform vec2 res, dir; uniform float focus, band, amount; varying vec2 vUv;
  void main(){ float b = smoothstep(band, band + 0.28, abs(vUv.y - focus)) * amount;
    vec3 s = vec3(0.0); float wsum = 0.0;
    for (int i = -6; i <= 6; i++) { float w = exp(-float(i*i) / 18.0); s += texture2D(tDiffuse, vUv + dir * float(i) * b / res).rgb * w; wsum += w; }
    gl_FragColor = vec4(s / wsum, 1.0); }`,
  { dir: { value: new THREE.Vector2(...dir) }, focus: { value: focus }, band: { value: band }, amount: { value: amount } });
/** Watercolour: Kuwahara smoothing + wobbly UVs + pigment pooling at edges + paper grain. */
const watercolourPass = () => pass(`
  uniform sampler2D tDiffuse; uniform vec2 res; varying vec2 vUv; ${NOISE}
  vec3 kuwa(vec2 uv){ vec2 px = 1.0 / res; vec3 m[4]; vec3 s[4];
    for (int k=0;k<4;k++){ m[k]=vec3(0.0); s[k]=vec3(0.0); }
    for (int j=-4;j<=0;j++) for (int i=-4;i<=0;i++) {
      vec3 a = texture2D(tDiffuse, uv + vec2(i,j)*px*2.4).rgb; m[0]+=a; s[0]+=a*a;
      vec3 b = texture2D(tDiffuse, uv + vec2(-i,j)*px*2.4).rgb; m[1]+=b; s[1]+=b*b;
      vec3 c = texture2D(tDiffuse, uv + vec2(i,-j)*px*2.4).rgb; m[2]+=c; s[2]+=c*c;
      vec3 d = texture2D(tDiffuse, uv + vec2(-i,-j)*px*2.4).rgb; m[3]+=d; s[3]+=d*d; }
    float best = 1e9; vec3 outc = vec3(0.0);
    for (int k=0;k<4;k++){ vec3 mu = m[k]/25.0; vec3 v = abs(s[k]/25.0 - mu*mu); float vv = v.r+v.g+v.b; if (vv < best) { best = vv; outc = mu; } }
    return outc; }
  void main(){
    vec2 wob = (vec2(vnoise(vUv*res/38.0), vnoise(vUv*res/38.0 + 9.0)) - 0.5) * 14.0 / res;
    vec2 uv = vUv + wob; vec3 c = kuwa(uv);
    vec2 px = 1.0/res; float l = dot(c, vec3(.3,.59,.11));
    float lx = dot(kuwa(uv + vec2(2.0,0.0)*px) - kuwa(uv - vec2(2.0,0.0)*px), vec3(.3,.59,.11));
    float ly = dot(kuwa(uv + vec2(0.0,2.0)*px) - kuwa(uv - vec2(0.0,2.0)*px), vec3(.3,.59,.11));
    float edge = clamp(length(vec2(lx, ly)) * 4.5, 0.0, 1.0);
    c = mix(c, c * c * 0.75, edge);                                  // pigment pools at edges
    float paper = vnoise(vUv * res / 3.0) * 0.6 + vnoise(vUv * res / 14.0) * 0.4;
    float wash = vnoise(vUv * res / 120.0);
    c = mix(c, vec3(0.99,0.97,0.92), 0.14 + 0.18 * wash); c *= 0.86 + paper * 0.2;
    gl_FragColor = vec4(c, 1.0); }`);
/** Paper fibre overlay. */
const paperPass = (amt: number) => pass(`
  uniform sampler2D tDiffuse; uniform vec2 res; uniform float amt; varying vec2 vUv; ${NOISE}
  void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec2 p = vUv * res;
    float f = vnoise(p / 2.0) * 0.5 + vnoise(p / 7.0) * 0.3 + vnoise(vec2(p.x / 40.0, p.y / 2.0)) * 0.2;
    gl_FragColor = vec4(c * (1.0 - amt + f * amt * 1.6), 1.0); }`, { amt: { value: amt } });

// ------------------------------------------------------------------ UI overlay per style
function ui(html: string, css: string) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.getElementById('ui').innerHTML = html;
}

// ------------------------------------------------------------------ the 10 styles
const lights = (hemiSky: string, hemiGround: string, hemiI: number, key: string, keyI: number, pos: [number, number, number] = [-30, 50, 30]) => {
  const h = new THREE.HemisphereLight(hemiSky, hemiGround, hemiI); scene.add(h);
  const d = new THREE.DirectionalLight(key, keyI); d.position.set(...pos); scene.add(d); return d;
};
const enableShadows = (d: THREE.DirectionalLight, b: Built, size = 2048) => {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  d.castShadow = true; d.shadow.mapSize.set(size, size); const c = d.shadow.camera as THREE.OrthographicCamera;
  c.left = c.bottom = -32; c.right = c.top = 32; c.near = 1; c.far = 160; d.shadow.bias = -0.0005; d.shadow.normalBias = 0.04;
  shadows(b.world); b.beam.castShadow = false;
};
const glowBasic = (p: ReturnType<typeof parse>, boost = 1) => new THREE.MeshBasicMaterial({ color: p.color.clone().multiplyScalar(p.k * boost), toneMapped: p.k * boost <= 1 });
const glassMat = (p: ReturnType<typeof parse>, opacity = 0.3) => new THREE.MeshLambertMaterial({ color: p.color, transparent: true, opacity, depthWrite: false });

type Style = { name: string; run: (b: Built, composer: EffectComposer) => void };
const STYLES: Style[] = [
  // 1 ------------------------------------------------------------- Moonlit Toybox (current)
  { name: 'Moonlit Toybox', run: (b, comp) => {
    scene.background = gradientTex([[0, '#1b1150'], [0.55, '#5a3cc0'], [1, '#7a5ad8']]);
    lights('#8f7dff', '#2b1f4f', 1.25, '#d6e4ff', 3.0);
    const ramp = toonRamp([0.33, 0.33, 0.58, 0.83, 1.0]);
    restyle(b.world, p => p.kind === 'glow' ? glowBasic(p, 1.4) : p.kind === 'glass' ? glassMat(p) : new THREE.MeshToonMaterial({ color: p.color, gradientMap: ramp }));
    outline(b.world, '#1a1033', 0.06);
    comp.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.55, 0.3, 1.1));
    ui(`<div class="t1">ALIEN<span>INVASION!</span></div><div class="b1">NEW GAME</div>`,
      `.t1{position:absolute;left:36px;top:26px;font:64px/0.9 'Lilita One';color:#9cff3f;-webkit-text-stroke:3px #1a1033;text-shadow:0 6px 0 #1a1033}
       .t1 span{display:block;font-size:30px;color:#ffd23f;margin-top:6px}
       .b1{position:absolute;left:36px;bottom:30px;font:26px 'Lilita One';color:#1a1033;background:#ffd23f;border:3px solid #1a1033;border-radius:14px;padding:10px 26px;box-shadow:0 6px 0 #1a1033}`);
  } },
  // 2 ------------------------------------------------------------- 1950s B-movie poster
  { name: '1950s B-movie', run: (b, comp) => {
    scene.background = gradientTex([[0, '#173f47'], [0.5, '#2f8f8a'], [0.78, '#e8b33a'], [1, '#d7322b']]);
    lights('#f3e6c8', '#6a5040', 1.6, '#ffe2b0', 3.4, [-20, 45, 40]);
    const pal = (c: THREE.Color) => { const h = { h: 0, s: 0, l: 0 }; c.getHSL(h, THREE.SRGBColorSpace);
      if (h.l > 0.82) return '#f3e6c8'; if (h.l < 0.16) return '#1d1a1a';
      if (h.s < 0.18) return h.l > 0.5 ? '#c9c1a8' : '#6b6a63';
      const d = h.h * 360; if (d < 25 || d > 330) return '#d7322b'; if (d < 70) return '#e8b33a'; if (d < 170) return '#5f8a3a'; if (d < 250) return '#2f6f8f'; return '#8a3a6a'; };
    const ramp = toonRamp([0.35, 0.65, 1.0]);
    restyle(b.world, p => p.kind === 'glow' ? new THREE.MeshBasicMaterial({ color: p.color.getHSL({ h: 0, s: 0, l: 0 }).h > 0.18 && p.color.getHSL({ h: 0, s: 0, l: 0 }).h < 0.45 ? '#c8ff6a' : pal(p.color) }) : p.kind === 'glass' ? glassMat(p, 0.35) : new THREE.MeshToonMaterial({ color: pal(p.color), gradientMap: ramp }));
    (b.beam.material as THREE.MeshBasicMaterial).color.set('#c8ff6a');
    outline(b.world, '#1d1a1a', 0.07);
    comp.addPass(new OutputPass());
    comp.addPass(halftonePass(6, 0.38, '#3a1a14'));
    comp.addPass(gradePass({ grain: 0.1, vignette: 0.6, tint: '#f7e3b5', tintAmt: 0.3, sat: 0.95 }));
    ui(`<div class="t2">THEY CAME<br>FROM <em>SPACE!</em></div><div class="s2">IN TERRIFYING 3-D!</div><div class="b2">★ NEW GAME ★</div>`,
      `.t2{position:absolute;right:40px;top:26px;font:72px/0.86 Bangers;color:#e8b33a;letter-spacing:2px;transform:rotate(-4deg);-webkit-text-stroke:2px #1d1a1a;text-shadow:5px 5px 0 #d7322b,8px 8px 0 #1d1a1a;text-align:right}
       .t2 em{font-style:normal;color:#f3e6c8}
       .s2{position:absolute;right:46px;top:192px;font:24px Bangers;color:#f3e6c8;letter-spacing:3px;background:#d7322b;padding:4px 12px;transform:rotate(-4deg)}
       .b2{position:absolute;left:40px;bottom:32px;font:30px Bangers;letter-spacing:3px;color:#1d1a1a;background:#e8b33a;border:4px solid #1d1a1a;padding:8px 26px;box-shadow:6px 6px 0 #d7322b}`);
  } },
  // 3 ------------------------------------------------------------- Comic book
  { name: 'Comic book', run: (b, comp) => {
    scene.background = gradientTex([[0, '#7fd0ff'], [0.7, '#cdeeff'], [1, '#fdf6e3']]);
    lights('#ffffff', '#8090a0', 1.3, '#ffffff', 2.6, [-30, 50, 25]);
    const ramp = toonRamp([0.42, 1.0]);
    restyle(b.world, p => { if (p.kind === 'glow') return glowBasic(p, 1); if (p.kind === 'glass') return glassMat(p, 0.4);
      const c = p.color.clone(); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h); c.setHSL(h.h, Math.min(1, h.s * 1.35), h.l);
      return new THREE.MeshToonMaterial({ color: c, gradientMap: ramp }); });
    outline(b.world, '#000000', 0.11);
    comp.addPass(new OutputPass());
    comp.addPass(halftonePass(7, 0.7, '#1a1a40', 0.785));
    comp.addPass(gradePass({ grain: 0.03, tint: '#fff8e8', tintAmt: 0.2 }));
    ui(`<div class="z3">ZAP!</div><div class="c3">MEANWHILE, IN A QUIET FARM TOWN...</div><div class="b3">NEW GAME!</div>`,
      `.z3{position:absolute;left:520px;top:30px;font:96px Bangers;color:#ffe600;-webkit-text-stroke:4px #000;transform:rotate(-10deg);text-shadow:6px 6px 0 #ff2a2a;padding:10px 40px;background:radial-gradient(circle,#ff2a2a 0 30%,transparent 31%)}
       .c3{position:absolute;left:24px;top:22px;font:22px Bangers;letter-spacing:1px;background:#fff6a8;border:3px solid #000;padding:8px 14px;box-shadow:5px 5px 0 #000}
       .b3{position:absolute;right:36px;bottom:30px;font:32px Bangers;letter-spacing:2px;color:#fff;background:#ff2a2a;border:4px solid #000;border-radius:50px;padding:6px 30px;box-shadow:6px 6px 0 #000}`);
  } },
  // 4 ------------------------------------------------------------- Voxel
  { name: 'Voxel', run: (b, comp) => {
    scene.background = gradientTex([[0, '#4aa8ff'], [0.7, '#a8dcff'], [1, '#e0f4ff']]);
    const sun = lights('#cfe8ff', '#4a6a3a', 1.2, '#fff4d8', 2.6, [-25, 50, 20]);
    const V = 0.32, map = new Map<string, THREE.Color>(); const v = new THREE.Vector3(), a = new THREE.Vector3(), bb = new THREE.Vector3(), c = new THREE.Vector3();
    b.world.updateMatrixWorld(true);
    const voxels: THREE.Object3D[] = [];
    b.world.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || m === b.beam || o.parent?.userData.ground || m.userData.ground) return; voxels.push(m); });
    for (const o of voxels) {
      const m = o as THREE.Mesh, g = m.geometry, pos = g.attributes.position, idx = g.index;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const groups = Array.isArray(m.material) && g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
      for (const gr of groups) {
        const p = parse(mats[gr.materialIndex ?? 0]); if (p.kind === 'glass') continue;
        const col = p.kind === 'glow' ? p.color.clone().multiplyScalar(1.3) : p.color;
        for (let i = gr.start; i < gr.start + gr.count; i += 3) {
          const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
          a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); bb.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
          const area = new THREE.Vector3().subVectors(bb, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
          const n = Math.max(1, Math.ceil(area / (V * V) * 3));
          for (let k = 0; k < n; k++) {
            let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
            v.copy(a).addScaledVector(new THREE.Vector3().subVectors(bb, a), r1).addScaledVector(new THREE.Vector3().subVectors(c, a), r2);
            const key = `${Math.round(v.x / V)},${Math.round(v.y / V)},${Math.round(v.z / V)}`;
            if (!map.has(key)) map.set(key, col);
          }
        }
      }
      m.visible = false;
    }
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(V, V, V), new THREE.MeshLambertMaterial(), map.size);
    let i = 0; const mm = new THREE.Matrix4();
    for (const [k, col] of map) { const [x, y, z] = k.split(',').map(Number); mm.makeTranslation(x * V, y * V, z * V); inst.setMatrixAt(i, mm); inst.setColorAt(i, col); i++; }
    inst.userData.keep = true; scene.add(inst);
    const grid = (g: CanvasRenderingContext2D, a: string, b2: string) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? a : b2; g.fillRect(x * 4, y * 4, 4, 4); } };
    restyle(b.world, (p, mesh) => {
      if (mesh.userData.ground && p.color.getHexString() === '3f8a3a') return new THREE.MeshLambertMaterial({ map: (() => { const t = canvasTex(64, 64, g => grid(g, '#5cb83a', '#52a834'), 120 / (V * 16 * 2)); t.magFilter = THREE.NearestFilter; return t; })() });
      return new THREE.MeshLambertMaterial({ color: p.color });
    });
    (b.beam.material as THREE.MeshBasicMaterial).opacity = 0.4;
    enableShadows(sun, b); inst.castShadow = true;
    comp.addPass(new OutputPass());
    ui(`<div class="t4">ALIEN INVASION</div><div class="b4">&gt; NEW GAME</div><div class="h4">♥♥♥♡ &nbsp; ⛁ 128</div>`,
      `.t4,.b4,.h4{font-family:'Courier New',monospace;font-weight:900;image-rendering:pixelated}
       .t4{position:absolute;left:30px;top:24px;font-size:52px;color:#fff;text-shadow:4px 0 #2a2a6a,-4px 0 #2a2a6a,0 4px #2a2a6a,0 -4px #2a2a6a,6px 6px #2a2a6a;letter-spacing:2px}
       .b4{position:absolute;left:30px;bottom:30px;font-size:30px;color:#fff;background:#3a8a2a;padding:10px 22px;box-shadow:0 0 0 4px #1a3a12,6px 6px 0 4px #1a3a12}
       .h4{position:absolute;right:30px;top:30px;font-size:28px;color:#ff3a3a;background:#1a1a2acc;padding:8px 16px;box-shadow:0 0 0 4px #fff}`);
  } },
  // 5 ------------------------------------------------------------- Low-poly flat
  { name: 'Low-poly flat', run: (b, comp) => {
    scene.background = gradientTex([[0, '#7a6ad0'], [0.55, '#e89ab8'], [1, '#ffc49a']]);
    scene.fog = new THREE.Fog('#f0b0b0', 45, 110);
    lights('#ffd8e8', '#5a4a8a', 1.1, '#fff0d8', 2.4, [-40, 30, 10]);
    restyle(b.world, p => { if (p.kind === 'glow') return glowBasic(p, 1); if (p.kind === 'glass') return glassMat(p, 0.4);
      return new THREE.MeshLambertMaterial({ color: p.color.clone().lerp(new THREE.Color('#ffffff'), 0.1), flatShading: true }); });
    b.world.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.attributes.position.count > 200 && !m.userData.ground) { m.geometry = m.geometry.toNonIndexed(); m.geometry.computeVertexNormals(); } });
    comp.addPass(new OutputPass());
    ui(`<div class="t5">Alien Invasion</div><div class="b5">Play</div>`,
      `.t5{position:absolute;left:40px;top:34px;font:600 46px Fredoka;color:#fff;letter-spacing:1px}
       .b5{position:absolute;left:40px;bottom:36px;font:600 24px Fredoka;color:#6a5ac0;background:#ffffffe0;border-radius:40px;padding:12px 44px}`);
  } },
  // 6 ------------------------------------------------------------- Claymation
  { name: 'Claymation', run: (b, comp) => {
    scene.background = gradientTex([[0, '#c9a98a'], [0.6, '#e9d8bf'], [1, '#f2e6d2']]);
    const key = lights('#fff0e0', '#6a5040', 0.9, '#ffe2c0', 3.2, [-25, 35, 30]);
    const clay = (color: THREE.Color) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 });
      m.onBeforeCompile = s => {
        s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vWp;\n${NOISE.replace(/vec2/g, 'vec2')}`)
          .replace('#include <begin_vertex>', `vec3 transformed = position + normal * (vnoise(position.xz * 1.6 + position.y * 1.3) - 0.5) * 0.22;`)
          .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
        s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWp;\n${NOISE}`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            vec2 q = vWp.xz * 4.0 + vWp.y * 3.0; float e = 0.03;
            float n0 = vnoise(q) + 0.5 * vnoise(q * 3.1); float nx = vnoise(q + vec2(e,0.0)) + 0.5 * vnoise((q + vec2(e,0.0)) * 3.1); float ny = vnoise(q + vec2(0.0,e)) + 0.5 * vnoise((q + vec2(0.0,e)) * 3.1);
            normal = normalize(normal + vec3(nx - n0, (nx - ny) * 0.5, ny - n0) * 9.0);`);
      };
      return m;
    };
    restyle(b.world, p => { if (p.kind === 'glow') return glowBasic(p, 1.1); if (p.kind === 'glass') return glassMat(p, 0.45);
      const c = p.color.clone(); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h); c.setHSL(h.h, h.s * 0.85, Math.min(0.8, h.l));
      return clay(c); });
    b.world.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.ground) { (m.material as any).color?.offsetHSL(0, -0.1, 0.05); } });
    enableShadows(key, b);
    comp.addPass(new OutputPass());
    comp.addPass(gradePass({ vignette: 0.7, tint: '#ffe8cc', tintAmt: 0.25, grain: 0.035 }));
    ui(`<div class="t6">Alien<br>Invasion</div><div class="b6">Play!</div>`,
      `.t6{position:absolute;left:40px;top:26px;font:62px/0.95 'Lilita One';color:#9ccf4a;text-shadow:0 2px 0 #6a8a2a,0 4px 0 #5a7a22,0 7px 8px #0005;letter-spacing:1px}
       .b6{position:absolute;left:40px;bottom:34px;font:30px 'Lilita One';color:#fff;background:radial-gradient(circle at 35% 30%,#ff8a6a,#d8483a);border-radius:46% 54% 50% 50%/60% 55% 45% 40%;padding:16px 46px;box-shadow:inset -6px -8px 10px #0003,0 8px 12px #0004}`);
  } },
  // 7 ------------------------------------------------------------- Paper diorama
  { name: 'Paper diorama', run: (b, comp) => {
    scene.background = gradientTex([[0, '#bfe0ef'], [0.7, '#e8f0e0'], [1, '#e8dcc0']]);
    const key = lights('#ffffff', '#b0a080', 1.2, '#fff8ec', 2.6, [-20, 40, 35]);
    restyle(b.world, p => { if (p.kind === 'glow') return glowBasic(p, 1); if (p.kind === 'glass') return glassMat(p, 0.5);
      return new THREE.MeshLambertMaterial({ color: p.color.clone().lerp(new THREE.Color('#fff8ec'), 0.12), flatShading: true }); });
    // stacked cardboard ground layers
    for (const [r, y, col] of [[62, -0.6, '#8a6a4a'], [61, -0.3, '#5a9a4a']] as const) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 64), new THREE.MeshLambertMaterial({ color: col })); d.position.y = y; d.receiveShadow = true; scene.add(d);
    }
    outline(b.world, '#fffaf0', 0.05);
    enableShadows(key, b);
    comp.addPass(new OutputPass());
    comp.addPass(tiltPass([1, 0])); comp.addPass(tiltPass([0, 1]));
    comp.addPass(paperPass(0.12));
    ui(`<div class="t7">Alien Invasion</div><div class="b7">Start</div>`,
      `.t7{position:absolute;left:36px;top:30px;font:50px 'Lilita One';color:#d8483a;background:#fffaf0;padding:6px 22px 10px;transform:rotate(-2deg);box-shadow:3px 5px 0 #0002,6px 10px 14px #0003;clip-path:polygon(0 4%,8% 0,30% 5%,55% 0,80% 4%,100% 0,98% 50%,100% 96%,70% 100%,40% 95%,12% 100%,0 96%,2% 50%)}
       .b7{position:absolute;left:44px;bottom:36px;font:28px 'Lilita One';color:#fff;background:#3d7be0;padding:10px 40px;transform:rotate(1.5deg);box-shadow:4px 6px 0 #0003;border-radius:4px}`);
  } },
  // 8 ------------------------------------------------------------- Neon synthwave
  { name: 'Neon synthwave', run: (b, comp) => {
    scene.background = gradientTex([[0, '#06021a'], [0.6, '#2a0848'], [1, '#5a0a6a']]);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 256, g => {
      const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffe24a'); gr.addColorStop(1, '#ff2ecb'); g.fillStyle = gr;
      g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) g.fillRect(0, 150 + i * 15, 256, 3 + i * 1.5); }), fog: false }));
    sun.position.set(-70, 22, -110); sun.scale.setScalar(55); scene.add(sun);
    const edgeCol = (p: ReturnType<typeof parse>) => { const h = { h: 0, s: 0, l: 0 }; p.color.getHSL(h); return h.s < 0.2 ? (h.l > 0.5 ? '#00e5ff' : '#ff2ecb') : new THREE.Color().setHSL(h.h, 1, 0.6); };
    b.world.updateMatrixWorld(true);
    const list: THREE.Mesh[] = []; b.world.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m !== b.beam && !m.userData.ground) list.push(m); });
    for (const m of list) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const geo = m.geometry, groups = Array.isArray(m.material) && geo.groups.length ? geo.groups : [{ start: 0, count: geo.index ? geo.index.count : geo.attributes.position.count, materialIndex: 0 }];
      for (const gr of groups) {
        const p = parse(mats[gr.materialIndex ?? 0]); if (p.kind === 'glass') continue;
        const sub = new THREE.BufferGeometry(); sub.setAttribute('position', geo.attributes.position);
        sub.setIndex(geo.index ? Array.from((geo.index.array as any).slice(gr.start, gr.start + gr.count)) : Array.from({ length: gr.count }, (_, i) => gr.start + i));
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(sub, 28), new THREE.LineBasicMaterial({ color: edgeCol(p) as any }));
        lines.userData.keep = true; m.add(lines);
      }
    }
    restyle(b.world, (p, mesh) => mesh.userData.ground ? new THREE.MeshBasicMaterial({ color: p.color.getHexString() === 'ffd23f' ? '#00e5ff' : '#07021a' })
      : p.kind === 'glow' ? glowBasic(p, 1.6) : p.kind === 'glass' ? new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.18, depthWrite: false }) : new THREE.MeshBasicMaterial({ color: '#0b0420' }));
    const grid = new THREE.GridHelper(120, 60, '#ff2ecb', '#ff2ecb'); grid.position.y = 0.08; scene.add(grid);
    (b.beam.material as THREE.MeshBasicMaterial).color.set('#00e5ff');
    comp.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 1.1, 0.55, 0.05));
    comp.addPass(new OutputPass());
    ui(`<div class="t8">ALIEN<br>INVASION</div><div class="b8">PRESS START</div>`,
      `.t8{position:absolute;right:46px;top:30px;font:italic 64px/0.92 'Lilita One';text-align:right;color:#fff;text-shadow:0 0 6px #ff2ecb,0 0 18px #ff2ecb,0 0 40px #ff2ecb;letter-spacing:4px}
       .b8{position:absolute;left:44px;bottom:36px;font:26px 'Lilita One';letter-spacing:6px;color:#00e5ff;border:3px solid #00e5ff;padding:10px 28px;box-shadow:0 0 14px #00e5ff,inset 0 0 14px #00e5ff;text-shadow:0 0 10px #00e5ff}`);
  } },
  // 9 ------------------------------------------------------------- Kawaii chibi
  { name: 'Kawaii chibi', run: (b, comp) => {
    scene.background = gradientTex([[0, '#c8b4ff'], [0.6, '#ffd6ec'], [1, '#fff0f6']]);
    lights('#fff0fa', '#b49ad8', 1.4, '#ffffff', 2.3, [-30, 50, 30]);
    const ramp = toonRamp([0.55, 0.8, 1.0]);
    restyle(b.world, p => { if (p.kind === 'glow') return glowBasic(p, 1); if (p.kind === 'glass') return glassMat(p, 0.4);
      const c = p.color.clone(); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h); c.setHSL(h.h, Math.min(1, h.s * 0.9 + 0.1), 0.62 + h.l * 0.3);
      return new THREE.MeshToonMaterial({ color: c, gradientMap: ramp }); });
    for (const hz of [b.parts.house, b.parts.house2]) kawaiiFace(hz, { eyes: [[-1.05, 3.6, 3.12], [1.05, 3.6, 3.12]], r: 0.3, blush: [[-1.75, 3.25, 3.1], [1.75, 3.25, 3.1]] });
    kawaiiFace(b.parts.tank, { eyes: [[-0.6, 2.2, 1.12], [0.6, 2.2, 1.12]], r: 0.26, blush: [[-0.95, 1.95, 1.0], [0.95, 1.95, 1.0]] });
    outline(b.world, '#8a5a8a', 0.05);
    (b.beam.material as THREE.MeshBasicMaterial).color.set('#ff9fd8');
    // sparkles + hearts
    const star = canvasTex(64, 64, g => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(36, 28, 64, 32); g.quadraticCurveTo(36, 36, 32, 64); g.quadraticCurveTo(28, 36, 0, 32); g.quadraticCurveTo(28, 28, 32, 0); g.fill(); });
    const heart = canvasTex(64, 64, g => { g.fillStyle = '#ff6fb5'; g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(-8, 30, 12, 0, 32, 18); g.bezierCurveTo(52, 0, 72, 30, 32, 56); g.fill(); });
    for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: i % 4 ? star : heart, transparent: true, color: i % 4 ? ['#ffffff', '#fff3a0', '#c8f0ff'][i % 3] : '#ffffff' }));
      s.position.set(-24 + rnd() * 44, 4 + rnd() * 14, -16 + rnd() * 22); s.scale.setScalar(i % 4 ? 0.7 + rnd() * 0.9 : 1.1); scene.add(s); }
    comp.addPass(new OutputPass());
    ui(`<div class="t9">Alien ✧ Invasion</div><div class="b9">♡ Let's play! ♡</div>`,
      `.t9{position:absolute;left:36px;top:28px;font:56px Fredoka;font-weight:600;color:#fff;-webkit-text-stroke:3px #c86aa8;text-shadow:0 5px 0 #c86aa8}
       .b9{position:absolute;left:40px;bottom:34px;font:600 28px Fredoka;color:#fff;background:#ff8fc8;border:4px solid #fff;border-radius:40px;padding:10px 34px;box-shadow:0 6px 0 #d86aa8}`);
  } },
  // 10 ------------------------------------------------------------ Watercolour storybook
  { name: 'Watercolour storybook', run: (b, comp) => {
    scene.background = gradientTex([[0, '#9ec8e8'], [0.55, '#e8eef0'], [1, '#f6efe0']]);
    lights('#ffffff', '#c0b090', 1.4, '#fff4e0', 2.2, [-30, 45, 30]);
    restyle(b.world, p => { if (p.kind === 'glow') return glowBasic(p, 0.9); if (p.kind === 'glass') return glassMat(p, 0.45);
      const c = p.color.clone(); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h); c.setHSL(h.h, h.s * 0.8, Math.min(0.85, h.l * 1.05 + 0.05));
      return new THREE.MeshLambertMaterial({ color: c }); });
    comp.addPass(new OutputPass());
    comp.addPass(watercolourPass());
    ui(`<div class="t10">Alien Invasion</div><div class="s10">Chapter One: The Night the Cows Flew</div><div class="b10">Begin the story</div>`,
      `.t10{position:absolute;left:42px;top:24px;font:italic 700 54px Georgia,serif;color:#4a3a6a}
       .s10{position:absolute;left:46px;top:92px;font:italic 22px Georgia,serif;color:#6a5a7a}
       .b10{position:absolute;left:46px;bottom:36px;font:italic 26px Georgia,serif;color:#4a3a6a;border-bottom:2px solid #4a3a6a;padding:4px 6px}`);
  } },
];

// ------------------------------------------------------------------ run
(async () => {
  const b = await build();
  const style = STYLES[S - 1];
  const comp = new EffectComposer(renderer); comp.setSize(W, H);
  comp.addPass(new RenderPass(scene, camera));
  style.run(b, comp);
  if (!comp.passes.some(p => p instanceof OutputPass)) comp.addPass(new OutputPass());
  await document.fonts.ready;
  comp.render(); comp.render();
  (window as any).__ready = style.name;
})().catch(e => { (window as any).__err = String(e?.stack || e); });
