// Renderer, camera, bloom, lights and shared sky helpers ("Moonlit Toybox", docs/ART_STYLE.md §4).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { prefs, savePrefs } from './save';
import { rand } from './util';
import { setInkResolution } from '../gfx/toon';

export const canvas = document.getElementById('game') as HTMLCanvasElement;
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
/** Low-memory devices (e.g. 4 GB Chromebooks, a big share of CrazyGames players) start on low graphics. */
const LOW_MEM = ((navigator as any).deviceMemory ?? 8) <= 4;
export let QUALITY: 'high' | 'low' = prefs.qualityUser || prefs.quality || (IS_TOUCH || LOW_MEM ? 'low' : 'high');

// Antialias on every device (the low path has no composer, so this is its only MSAA).
// Neutral tone mapping keeps candy hues saturated (ACES greyed them out). Toon materials need no
// environment map, so there is no PMREM env and no scene.environment any more.
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1600);
let composer: EffectComposer | null = null;
const resizeHooks: (() => void)[] = [];
export const onResizeHook = (f: () => void) => resizeHooks.push(f);

/**
 * The output pass of the high path: the same tone-mapping and colour-space chunks as OutputPass
 * (it subclasses it, so the defines follow renderer.toneMapping / outputColorSpace), plus saturation
 * ×1.06 and a plum vignette. It *replaces* OutputPass, so it costs no extra full-screen pass.
 */
class ToonOutputPass extends OutputPass {
  constructor() {
    super();
    this.material.name = 'ToonOutputShader';
    this.material.fragmentShader = /* glsl */`
      precision highp float;
      uniform sampler2D tDiffuse;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(tDiffuse, vUv);
        #ifdef LINEAR_TONE_MAPPING
          gl_FragColor.rgb = LinearToneMapping(gl_FragColor.rgb);
        #elif defined(REINHARD_TONE_MAPPING)
          gl_FragColor.rgb = ReinhardToneMapping(gl_FragColor.rgb);
        #elif defined(CINEON_TONE_MAPPING)
          gl_FragColor.rgb = CineonToneMapping(gl_FragColor.rgb);
        #elif defined(ACES_FILMIC_TONE_MAPPING)
          gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);
        #elif defined(AGX_TONE_MAPPING)
          gl_FragColor.rgb = AgXToneMapping(gl_FragColor.rgb);
        #elif defined(NEUTRAL_TONE_MAPPING)
          gl_FragColor.rgb = NeutralToneMapping(gl_FragColor.rgb);
        #endif
        // saturation x1.06 (linear, after tone mapping)
        float luma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = max(mix(vec3(luma), gl_FragColor.rgb, 1.06), 0.0);
        #ifdef SRGB_TRANSFER
          gl_FragColor = sRGBTransferOETF(gl_FragColor);
          const vec3 INK = vec3(0.10196, 0.06275, 0.2);          // #1a1033 (sRGB)
        #else
          const vec3 INK = vec3(0.01016, 0.00518, 0.03310);      // #1a1033 (linear)
        #endif
        // vignette toward the ink colour
        float vig = smoothstep(0.58, 1.0, length(vUv - 0.5) * 1.414) * 0.45;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, INK, vig);
      }`;
  }
}

const pixelRatio = () => Math.min(devicePixelRatio || 1, QUALITY === 'high' ? 1.75 : 1.25);
/** `user`: the player chose it in the menu, so the automatic frame-rate check leaves it alone from then on. */
export function setQuality(q: 'high' | 'low', user = false) {
  QUALITY = q; prefs.quality = q; if (user) prefs.qualityUser = q; savePrefs();
  renderer.setPixelRatio(pixelRatio());
  if (q === 'high' && !composer) {
    // Render (MSAA x4) -> Bloom -> ToonOutput. The bloom input is linear HDR before tone mapping, where a pale
    // surface under the 3.0 moon key already reads 2-3, so a 0.95 threshold bloomed every lit wall, the snow and
    // the whole saucer hull into a white blob. 1.7 with a soft knee keeps bloom on glow parts (k >= 2.6),
    // explosions, sirens and the beam core only.
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.25, 1.7);
    bloom.highPassUniforms['smoothWidth'].value = 0.35;
    composer.addPass(bloom);
    composer.addPass(new ToonOutputPass());
  }
  onResize();
}
const _buf = new THREE.Vector2();
export function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 64 : 50; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  // Ink outlines stay a constant number of CSS pixels wide (uInkPx = px × pixelRatio, uRes = drawing buffer).
  renderer.getDrawingBufferSize(_buf); setInkResolution(_buf.x, _buf.y, renderer.getPixelRatio(), QUALITY);
  resizeHooks.forEach(f => f());
}
addEventListener('resize', onResize);
export function renderFrame() { if (QUALITY === 'high' && composer) composer.render(); else renderer.render(scene, camera); }
/**
 * Compile every material of the current scene (call behind the loading screen or the closed iris,
 * after a scene is built) so the first frames do not stutter. Never rejects.
 */
export function prewarm(): Promise<void> {
  return renderer.compileAsync(scene, camera).then(() => undefined, e => { console.warn('prewarm failed', e); });
}

// Lights are created once and never removed (adding lights later would recompile every shader).
// Defaults are the mission values of §4; nightSky() and the globe / mothership scenes override them.
export const LIGHT = {
  hemi: new THREE.HemisphereLight(0x8f7dff, 0x2b1f4f, 1.25),   // lavender fill: shadows read purple, never black
  moon: new THREE.DirectionalLight(0xd6e4ff, 3.0),             // the toon key light
  ufo: new THREE.PointLight(0x9cff6a, 140, 42, 1.5),           // slime underglow
  beam: new THREE.SpotLight(0xeaffd0, 0, 60, 0.4, 0.25, 1.3),  // tractor beam (max 600)
  flash: new THREE.PointLight(0xff9a3c, 0, 90, 1.7),           // Earth explosions
};
LIGHT.moon.position.set(-150, 170, -170);
scene.add(LIGHT.hemi, LIGHT.moon, LIGHT.ufo, LIGHT.beam, LIGHT.beam.target, LIGHT.flash);

/** Sky dome with painted bands: 6 hard steps from the horizon colour up to the top colour. */
export function gradientSky(top: number, horizon: number, bottom: number, radius: number) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
      void main(){ float y = vDir.y; float t = floor(smoothstep(0.0, 0.6, y) * 6.0) / 6.0;
      vec3 c = y > 0.0 ? mix(horizon, top, t) : mix(horizon, bottom, smoothstep(0.0, 0.15, -y));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
}

// Star textures (shared): a round dot for the plain stars, a four-point sparkle for the bright ones.
const starTex = (draw: (x: CanvasRenderingContext2D, S: number) => void, S: number) => {
  const c = document.createElement('canvas'); c.width = c.height = S; draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
let DOT_TEX: THREE.Texture | null = null, SPARKLE_MAT: THREE.ShaderMaterial | null = null;
/** Shared sparkle material: a 32 px four-point star texture, alpha-tested at 0.3, twinkling on a time uniform. */
function sparkleMaterial() {
  if (SPARKLE_MAT) return SPARKLE_MAT;
  const tex = starTex((x, S) => {
    const h = S / 2; x.fillStyle = '#fff';
    x.beginPath(); x.moveTo(h, 0); x.quadraticCurveTo(h, h, S, h); x.quadraticCurveTo(h, h, h, S); x.quadraticCurveTo(h, h, 0, h); x.quadraticCurveTo(h, h, h, 0); x.fill();
  }, 32);
  SPARKLE_MAT = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, time: { value: 0 }, size: { value: 7 } },
    vertexShader: `attribute vec3 color; attribute float phase; uniform float time; uniform float size; varying vec3 vC; varying float vTw;
      void main(){ vC = color; vTw = 0.55 + 0.45 * sin(time * (1.6 + fract(phase * 7.3)) + phase * 6.2831);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (0.75 + 0.35 * vTw); }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vTw;
      void main(){ float a = texture2D(map, gl_PointCoord).a; if (a < 0.3) discard; gl_FragColor = vec4(vC * (0.8 + 1.4 * vTw), 1.0);
      #include <colorspace_fragment>
      }`,
    depthWrite: false, fog: false, toneMapped: false,
  });
  return SPARKLE_MAT;
}
/**
 * Night stars: 85% round dots (2 px) plus 15% four-point sparkles (7 px, cream / violet-hot, twinkling).
 * The sparkles are a child Points object; their geometry is freed together with the parent geometry,
 * so callers keep tracking only `stars.geometry` and `stars.material`.
 */
export function makeStars(n: number, radius: number, minY = -0.1) {
  const pos: number[] = [], col: number[] = [], spos: number[] = [], scol: number[] = [], sph: number[] = [], c = new THREE.Color();
  const cream = new THREE.Color('#fff6e0'), violet = new THREE.Color('#e2d2ff');
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(minY, 1), rand(-1, 1)).normalize().multiplyScalar(radius);
    if (Math.random() < 0.15) {
      spos.push(v.x, v.y, v.z); const k = Math.random() < 0.5 ? cream : violet; scol.push(k.r * 1.6, k.g * 1.6, k.b * 1.6); sph.push(Math.random());
    } else {
      pos.push(v.x, v.y, v.z); c.setHSL(rand(0.55, 0.75), 0.5, rand(0.6, 1)); const k = rand(0.6, 2.2); col.push(c.r * k, c.g * k, c.b * k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  DOT_TEX ??= starTex((x, S) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); x.fill(); }, 16);
  // PointsMaterial sizes are CSS px: three multiplies them by the renderer's pixel ratio itself.
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, map: DOT_TEX, alphaTest: 0.5, fog: false, toneMapped: false, depthWrite: false }));
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(scol, 3)); sg.setAttribute('phase', new THREE.Float32BufferAttribute(sph, 1));
  const mat = sparkleMaterial(), sparkles = new THREE.Points(sg, mat);
  // The custom shader sizes in drawing-buffer px, so scale by the pixel ratio of whichever renderer draws it.
  sparkles.onBeforeRender = r => { mat.uniforms.time.value = performance.now() / 1000; mat.uniforms.size.value = 7 * r.getPixelRatio(); };
  g.addEventListener('dispose', () => sg.dispose());
  stars.add(sparkles);
  return stars;
}

/**
 * Bubble shader: bright rim, see-through centre (shields, domes, atmosphere).
 * steps > 0 quantises the rim into cartoon bands: f = floor(f*steps + bias) / steps
 * (§6 shields / jelly bubble: steps 3, bias 0.15; §8 atmosphere: steps 2, bias 0.2). Default 0 = smooth.
 */
export function fresnelMaterial(color: number, power = 2.2, opacity = 0.6, steps = 0, bias = 0) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, opacity: { value: opacity }, time: { value: 0 }, steps: { value: steps }, bias: { value: bias } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 color; uniform float power; uniform float opacity; uniform float time; uniform float steps; uniform float bias; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), power);
        if (steps > 0.0) f = min(1.0, floor(f * steps + bias) / steps);
        float hex = 0.75 + 0.25 * sin(vP.x * 2.2 + time * 2.0) * sin(vP.y * 2.2 - time * 1.3) * sin(vP.z * 2.2);
        gl_FragColor = vec4(color * (f * hex + 0.06), opacity * clamp(f + 0.08, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
