// Renderer, camera, bloom, lights and shared sky helpers.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { prefs, savePrefs } from './save';
import { rand } from './util';

export const canvas = document.getElementById('game') as HTMLCanvasElement;
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
export let QUALITY: 'high' | 'low' = prefs.quality || (IS_TOUCH ? 'low' : 'high');

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1600);
let composer: EffectComposer | null = null;
const resizeHooks: (() => void)[] = [];
export const onResizeHook = (f: () => void) => resizeHooks.push(f);

const pixelRatio = () => Math.min(devicePixelRatio || 1, QUALITY === 'high' ? 1.75 : 1.25);
export function setQuality(q: 'high' | 'low') {
  QUALITY = q; prefs.quality = q; savePrefs();
  renderer.setPixelRatio(pixelRatio());
  if (q === 'high' && !composer) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.42, 0.86));
    composer.addPass(new OutputPass());
  }
  onResize();
}
export function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 64 : 50; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  resizeHooks.forEach(f => f());
}
addEventListener('resize', onResize);
export function renderFrame() { if (QUALITY === 'high' && composer) composer.render(); else renderer.render(scene, camera); }

// Lights are created once and never removed (adding lights later would recompile every shader).
export const LIGHT = {
  hemi: new THREE.HemisphereLight(0x7d8cff, 0x16241a, 1.15),
  moon: new THREE.DirectionalLight(0xb8c8ff, 1.5),
  ufo: new THREE.PointLight(0xc7a2ff, 120, 45, 1.6),
  beam: new THREE.SpotLight(0xe2c8ff, 0, 60, 0.4, 0.55, 1.3),
  flash: new THREE.PointLight(0xffa24a, 0, 90, 1.7),
};
LIGHT.moon.position.set(-120, 200, -80);
scene.add(LIGHT.hemi, LIGHT.moon, LIGHT.ufo, LIGHT.beam, LIGHT.beam.target, LIGHT.flash);

export function gradientSky(top: number, horizon: number, bottom: number, radius: number) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
      void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.6, y), 0.7)) : mix(horizon, bottom, smoothstep(0.0, 0.15, -y));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
}
export function makeStars(n: number, radius: number, minY = -0.1) {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(minY, 1), rand(-1, 1)).normalize().multiplyScalar(radius);
    pos.push(v.x, v.y, v.z); c.setHSL(rand(0.55, 0.75), 0.5, rand(0.6, 1)); const k = rand(0.6, 2.2); col.push(c.r * k, c.g * k, c.b * k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, toneMapped: false, depthWrite: false }));
}
// A soft environment map so metal surfaces have something to reflect.
const envScene = new THREE.Scene();
envScene.add(gradientSky(0x101634, 0x6b4fa8, 0x10160f, 10));
const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.4, 1.8) }));
moonGlow.position.set(-5, 6, -4); envScene.add(moonGlow);
const pm = new THREE.PMREMGenerator(renderer);
export const envTex = pm.fromScene(envScene, 0.04).texture; pm.dispose();
scene.environment = envTex;

/** Bubble shader: bright rim, see-through centre (shields, domes, atmosphere). */
export function fresnelMaterial(color: number, power = 2.2, opacity = 0.6) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, opacity: { value: opacity }, time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 color; uniform float power; uniform float opacity; uniform float time; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), power);
        float hex = 0.75 + 0.25 * sin(vP.x * 2.2 + time * 2.0) * sin(vP.y * 2.2 - time * 1.3) * sin(vP.z * 2.2);
        gl_FragColor = vec4(color * (f * hex + 0.06), opacity * clamp(f + 0.08, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
