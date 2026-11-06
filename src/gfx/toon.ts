// Toon shading and ink outlines (docs/ART_STYLE.md §4). This module is the base of the
// "Moonlit Toybox" look; everything here is shared, so programs compile once per variant.
//
//   TOON_RAMP          the 4-band light ramp every MeshToonMaterial uses as gradientMap
//   toonMaterial()     MeshToonMaterial + ramp + rim (std) or rim + hard specular glint (metal / gloss)
//   setRimColor()      the rim colour is one shared uniform, set per scene
//   INK                the shared inverted-hull outline material (BackSide, vertex-stage only)
//   inkify()           adds the ink hull to every eligible mesh under an object (idempotent)
//   ensureOnormal()    the smoothed "outline normal" attribute the ink hull is pushed along
//   setInk()           switch a mesh tree's ink on/off (LOD) without touching geometry
//   setInkResolution() / withInkResolution()   keep the outline a constant width in screen pixels
//
// The ink hull is drawn as a second material slot on the same mesh: material = [toon, INK],
// geometry groups (0,n,0) + (0,n,1). It works for Mesh, SkinnedMesh and InstancedMesh, and for
// geometries shared between many meshes (the groups are ignored while a mesh has a single material).
import * as THREE from 'three';
import { PAL } from './palette';

// ---------------------------------------------------------------------------------------------
// Toon ramp
// ---------------------------------------------------------------------------------------------

/** 8×1 red ramp sampled at dotNL*0.5+0.5: core shadow .33, terminator .58, mid .83, lit 1.0. */
export const TOON_RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array([84, 84, 84, 84, 148, 212, 255, 255]), 8, 1, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

// ---------------------------------------------------------------------------------------------
// Toon materials (std / metal / gloss)
// ---------------------------------------------------------------------------------------------

export type ToonVariant = 'std' | 'metal' | 'gloss';

/** One shared rim colour uniform for every toon material (missions #8f7dff, snow #a8c8ff, space #7fd6ff). */
const RIM_COLOR = { value: new THREE.Color(PAL.rimMission) };
export function setRimColor(color: THREE.ColorRepresentation) { RIM_COLOR.value.set(color); }

/** Patch values per variant (§4 table). std has no specular glint, only the rim. */
const VARIANT: Record<ToonVariant, { spec: boolean; uSpecCut: { value: number }; uSpec: { value: number }; uRim: { value: number } }> = {
  std: { spec: false, uSpecCut: { value: 2 }, uSpec: { value: 0 }, uRim: { value: 0.28 } },
  metal: { spec: true, uSpecCut: { value: 0.965 }, uSpec: { value: 0.75 }, uRim: { value: 0.40 } },
  gloss: { spec: true, uSpecCut: { value: 0.92 }, uSpec: { value: 0.6 }, uRim: { value: 0.50 } },
};

/** Fragment code inserted before `#include <opaque_fragment>` (normal + geometryViewDir are in view space there). */
const SPEC_GLSL = /* glsl */`
#if NUM_DIR_LIGHTS > 0
  vec3 toonH = normalize(directionalLights[0].direction + geometryViewDir);
  float toonSp = step(uSpecCut, dot(normal, toonH));
  outgoingLight += vec3(1.0) * toonSp * uSpec;
#endif
`;
const RIM_GLSL = /* glsl */`
  float toonRim = smoothstep(0.60, 0.66, 1.0 - max(dot(normal, geometryViewDir), 0.0));
  outgoingLight += uRimColor * toonRim * uRim;
`;

// One onBeforeCompile function per variant, so every material of a variant produces identical source
// and shares one program ('toon-std' / 'toon-metal' / 'toon-gloss' + three's own feature flags).
const PATCH = {} as Record<ToonVariant, (s: THREE.WebGLProgramParametersWithUniforms) => void>;
for (const v of Object.keys(VARIANT) as ToonVariant[]) {
  const P = VARIANT[v];
  PATCH[v] = s => {
    s.uniforms.uRimColor = RIM_COLOR; s.uniforms.uRim = P.uRim;
    if (P.spec) { s.uniforms.uSpecCut = P.uSpecCut; s.uniforms.uSpec = P.uSpec; }
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uRimColor;\nuniform float uRim;\n${P.spec ? 'uniform float uSpecCut;\nuniform float uSpec;\n' : ''}`)
      .replace('#include <opaque_fragment>', `${P.spec ? SPEC_GLSL : ''}${RIM_GLSL}\n#include <opaque_fragment>`);
  };
}

/** Turn an existing MeshToonMaterial into a toon variant (ramp + rim / spec patch). Returns it. */
export function applyToon<T extends THREE.MeshToonMaterial>(m: T, variant: ToonVariant = 'std'): T {
  if (!m.gradientMap) m.gradientMap = TOON_RAMP;
  m.onBeforeCompile = PATCH[variant];
  m.customProgramCacheKey = () => 'toon-' + variant;
  m.userData.toon = variant;
  m.needsUpdate = true;
  return m;
}

/** A MeshToonMaterial with the shared ramp and the rim / specular patch of `variant` (default 'std'). */
export function toonMaterial(params: THREE.MeshToonMaterialParameters & { variant?: ToonVariant } = {}): THREE.MeshToonMaterial {
  const { variant = 'std', ...rest } = params;
  return applyToon(new THREE.MeshToonMaterial({ gradientMap: TOON_RAMP, ...rest }), variant);
}

// ---------------------------------------------------------------------------------------------
// Ink outline material (inverted hull)
// ---------------------------------------------------------------------------------------------

/** Drawing-buffer size of the canvas being rendered; shared by every ink material. */
export const INK_RES = { value: new THREE.Vector2(1280, 720) };
let inkPixelRatio = 1, inkQuality: 'high' | 'low' = 'high';
/** Default outline width in CSS px (§4: 1.9 on high, 1.5 on low). */
const defaultInkPx = () => (inkQuality === 'high' ? 1.9 : 1.5);

interface InkInfo { css: number | null; uInkPx: { value: number }; uFadeOn: { value: number } }
const INK_INFO = new Map<THREE.Material, InkInfo>();   // every ink material ever made (a handful)

const INK_VERT_HEAD = /* glsl */`
attribute vec3 onormal;
uniform float uInkPx;
uniform vec2 uRes;
uniform float uFadeOn;
`;
// After <project_vertex>: push the vertex outward in clip space along the smoothed normal,
// by a constant number of screen pixels (gl_Position.w cancels the perspective divide).
const INK_VERT_PUSH = /* glsl */`
#ifdef USE_SKINNING
  vec3 inkN = objectNormal;          // = onormal, skinned by <skinnormal_vertex>
#else
  vec3 inkN = onormal;
#endif
#ifdef USE_INSTANCING
  inkN = mat3(instanceMatrix) * inkN;
#endif
vec2 inkD = normalize((projectionMatrix * vec4(normalize(normalMatrix * inkN), 0.0)).xy + 1e-5);
float inkFade = mix(1.0, clamp(1.0 - (-mvPosition.z - 70.0) / 220.0, 0.35, 1.0), uFadeOn);
gl_Position.xy += inkD * uInkPx * inkFade * 2.0 / uRes * gl_Position.w;
`;

function makeInk(css: number | null, fade: boolean): THREE.MeshBasicMaterial {
  // polygonOffset pushes the hull a hair behind coincident surfaces: on double-sided open parts (the glTF
  // colormap materials are doubleSided) the visible back face then wins over the hull drawn at the same depth.
  const m = new THREE.MeshBasicMaterial({ color: PAL.ink, side: THREE.BackSide, fog: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  m.name = 'ink';
  const info: InkInfo = { css, uInkPx: { value: (css ?? defaultInkPx()) * inkPixelRatio }, uFadeOn: { value: fade ? 1 : 0 } };
  m.onBeforeCompile = s => {
    s.uniforms.uInkPx = info.uInkPx; s.uniforms.uRes = INK_RES; s.uniforms.uFadeOn = info.uFadeOn;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\n' + INK_VERT_HEAD)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = onormal;')   // only compiled with skinning / envmap
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + INK_VERT_PUSH);
    // The hull is always pure ink: ignore vertex colours and instance colours of the mesh it outlines.
    s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', '');
  };
  m.customProgramCacheKey = () => 'ink';
  m.userData.ink = true;
  INK_INFO.set(m, info);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Building collapse (city destruction): merged city meshes carry a per-vertex building id ('bid'); a 512×1
// texture holds each building's collapse amount (0 standing … 1 rubble). The vertex stage squashes and tilts
// the building toward the ground, so one merged mesh (and its ink hull) can crumble building by building.
// ---------------------------------------------------------------------------------------------
export const COLLAPSE_N = 512;
export const COLLAPSE = { data: new Uint8Array(COLLAPSE_N), tex: null as THREE.DataTexture | null };
export function collapseTexture() {
  if (!COLLAPSE.tex) {
    const t = new THREE.DataTexture(COLLAPSE.data, COLLAPSE_N, 1, THREE.RedFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; COLLAPSE.tex = t;
  }
  return COLLAPSE.tex;
}
const CLP_HEAD = `attribute float bid;\nuniform sampler2D uCollapse;\n`;
const CLP_BODY = `
float clp = texture2D(uCollapse, vec2((bid + 0.5) / ${COLLAPSE_N}.0, 0.5)).r;
float hy = transformed.y;
transformed.x += sin(bid * 3.7) * clp * hy * 0.18;
transformed.z += cos(bid * 2.3) * clp * hy * 0.18;
transformed.y = hy * (1.0 - 0.93 * clp);
`;
/** Add the collapse step to a material's vertex shader (chains any existing onBeforeCompile). */
export function withCollapse<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey?.bind(m), tex = { value: collapseTexture() };
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uCollapse = tex;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + CLP_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + CLP_BODY);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|collapse';
  return m;
}
/** An ink hull material that collapses with its building (a private instance: the shared INK stays untouched). */
export function collapseInk() { return withCollapse(makeInk(null, true)); }

/** The shared ink material: default width, distance fade on. */
export const INK = makeInk(null, true);
const INK_VARIANTS = new Map<string, THREE.MeshBasicMaterial>([['d|1', INK]]);
/** The ink material for a width (CSS px; omitted = default) and fade setting. Cached, so programs are shared. */
export function inkMaterial(px?: number, fade = true): THREE.MeshBasicMaterial {
  const key = (px === undefined ? 'd' : String(px)) + '|' + (fade ? 1 : 0);
  let m = INK_VARIANTS.get(key);
  if (!m) { m = makeInk(px ?? null, fade); INK_VARIANTS.set(key, m); }
  return m;
}
export const isInk = (m: THREE.Material | null | undefined) => !!m && INK_INFO.has(m);

/**
 * Keep outlines a constant width in screen pixels. Call on every resize / quality change with the
 * drawing-buffer size and pixel ratio of the main renderer (engine.ts does this in onResize).
 */
export function setInkResolution(w: number, h: number, pixelRatio: number, quality: 'high' | 'low' = inkQuality) {
  INK_RES.value.set(Math.max(1, w), Math.max(1, h)); inkPixelRatio = pixelRatio; inkQuality = quality;
  for (const info of INK_INFO.values()) info.uInkPx.value = (info.css ?? defaultInkPx()) * pixelRatio;
}
/** Render something into a different-sized canvas (e.g. the portrait) with correct ink width, then restore. */
export function withInkResolution<T>(w: number, h: number, fn: () => T): T {
  const pw = INK_RES.value.x, ph = INK_RES.value.y;
  INK_RES.value.set(Math.max(1, w), Math.max(1, h));
  try { return fn(); } finally { INK_RES.value.set(pw, ph); }
}

// ---------------------------------------------------------------------------------------------
// onormal: smoothed outline normals
// ---------------------------------------------------------------------------------------------

/**
 * Add the 'onormal' attribute: for every vertex, the angle-weighted average of the face normals of
 * all triangles that touch its position (positions grouped on a 1e-3 grid by an integer hash in a
 * typed open-addressing table; never string keys). Split vertices at hard edges / UV seams get the same direction,
 * so the inverted hull has no cracks at box corners. Computed once per geometry; no-op if present.
 */
export function ensureOnormal(geo: THREE.BufferGeometry): void {
  if (geo.attributes.onormal) return;
  const pos = geo.attributes.position as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  if (!pos) return;
  const n = pos.count, index = geo.index;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  const plain = !(pos as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute && !pos.normalized && pos.itemSize === 3;
  if (plain) { const a = (pos as THREE.BufferAttribute).array; for (let i = 0, j = 0; i < n; i++, j += 3) { px[i] = a[j]; py[i] = a[j + 1]; pz[i] = a[j + 2]; } }
  else for (let i = 0; i < n; i++) { px[i] = pos.getX(i); py[i] = pos.getY(i); pz[i] = pos.getZ(i); }
  const idx = index ? index.array : null;

  // 1. group vertices by quantised position (integer hash, open addressing in a typed table)
  const gid = new Int32Array(n), gx = new Int32Array(n), gy = new Int32Array(n), gz = new Int32Array(n);
  let cap = 1024; while (cap < n * 2) cap <<= 1;
  const table = new Int32Array(cap).fill(-1), mask = cap - 1;
  let groups = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.round(px[i] * 1000), y = Math.round(py[i] * 1000), z = Math.round(pz[i] * 1000);
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask, g = table[h];
    while (g >= 0 && (gx[g] !== x || gy[g] !== y || gz[g] !== z)) { h = (h + 1) & mask; g = table[h]; }
    if (g < 0) { g = groups++; gx[g] = x; gy[g] = y; gz[g] = z; table[h] = g; }
    gid[i] = g;
  }

  // 2. accumulate angle-weighted face normals per group
  const acc = new Float32Array(groups * 3);
  const tris = index ? index.count : n;
  const corner = (a: number, b: number, c: number) => {   // angle at a in triangle abc
    const ux = px[b] - px[a], uy = py[b] - py[a], uz = pz[b] - pz[a], vx = px[c] - px[a], vy = py[c] - py[a], vz = pz[c] - pz[a];
    const d = Math.sqrt((ux * ux + uy * uy + uz * uz) * (vx * vx + vy * vy + vz * vz));
    return d > 0 ? Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / d))) : 0;
  };
  for (let t = 0; t + 2 < tris; t += 3) {
    const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
    const ux = px[b] - px[a], uy = py[b] - py[a], uz = pz[b] - pz[a], vx = px[c] - px[a], vy = py[c] - py[a], vz = pz[c] - pz[a];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz); if (len < 1e-12) continue;   // degenerate
    nx /= len; ny /= len; nz /= len;
    const wa = corner(a, b, c), wb = corner(b, c, a), wc = Math.max(0, Math.PI - wa - wb);
    let k = gid[a] * 3; acc[k] += nx * wa; acc[k + 1] += ny * wa; acc[k + 2] += nz * wa;
    k = gid[b] * 3; acc[k] += nx * wb; acc[k + 1] += ny * wb; acc[k + 2] += nz * wb;
    k = gid[c] * 3; acc[k] += nx * wc; acc[k + 1] += ny * wc; acc[k + 2] += nz * wc;
  }

  // 3. write the normalised sum per vertex (fall back to the vertex normal for isolated points)
  const out = new Float32Array(n * 3), nrm = geo.attributes.normal;
  for (let i = 0; i < n; i++) {
    const k = gid[i] * 3; let x = acc[k], y = acc[k + 1], z = acc[k + 2];
    let l = Math.sqrt(x * x + y * y + z * z);
    if (l < 1e-8) { if (nrm) { x = nrm.getX(i); y = nrm.getY(i); z = nrm.getZ(i); } else { x = 0; y = 1; z = 0; } l = Math.sqrt(x * x + y * y + z * z) || 1; }
    out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
  }
  geo.setAttribute('onormal', new THREE.BufferAttribute(out, 3));
}

// ---------------------------------------------------------------------------------------------
// inkify
// ---------------------------------------------------------------------------------------------

export interface InkOpts {
  /** Outline width in CSS px (default 1.9 on high / 1.5 on low). Globe Earth 3.5, mothership 2.5. */
  px?: number;
  /** Distance fade (default true). Globe and mothership use fade:false. */
  fade?: boolean;
  /** Also ink MeshBasicMaterial parts (e.g. the white-flag cloth or pin heads). Transparent/additive still never inked. */
  basic?: boolean;
}

/** Can this material carry an ink hull? (opaque, normal blending, not alpha-cut, not a glow / custom shader) */
function inkable(m: THREE.Material, basic: boolean) {
  if (!m || !m.visible || m.transparent || m.blending !== THREE.NormalBlending || !m.depthWrite || !m.colorWrite || m.alphaTest > 0) return false;
  if ((m as THREE.ShaderMaterial).isShaderMaterial) return false;          // sky, beam, fresnel, raw shaders
  if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial) return basic && !isInk(m);   // glow parts
  const lit = m as THREE.Material & { isMeshToonMaterial?: boolean; isMeshStandardMaterial?: boolean; isMeshLambertMaterial?: boolean; isMeshPhongMaterial?: boolean };
  return !!(lit.isMeshToonMaterial || lit.isMeshStandardMaterial || lit.isMeshLambertMaterial || lit.isMeshPhongMaterial);
}
const drawCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count);

/**
 * Hull material of meshes whose ink is switched off by setInk(false). A WeakMap rather than userData:
 * Object3D.clone() deep-copies userData through JSON, which would turn a stored material into a plain object.
 */
const INK_OFF = new WeakMap<THREE.Mesh, THREE.Material>();

/**
 * Give every eligible mesh under `obj` an ink outline: material becomes [toon, ink] with geometry
 * groups (0,n,0) and (0,n,1). Skips Points/Lines/Sprites, transparent or additive materials,
 * MeshBasicMaterial glow parts (unless opts.basic), custom shaders and meshes with userData.noInk.
 * Idempotent: an already-inked mesh only has its ink slot swapped when px/fade options are given.
 * Single-material geometries get their groups replaced by the two ink groups (harmless: a mesh with one
 * material ignores groups, so the same geometry still renders normally on un-inked meshes).
 */
export function inkify(obj: THREE.Object3D, opts: InkOpts = {}): void {
  const custom = opts.px !== undefined || opts.fade !== undefined;
  const ink = inkMaterial(opts.px, opts.fade ?? true);
  obj.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.noInk || !mesh.geometry?.attributes.position) return;
    const geo = mesh.geometry;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const at = mats.findIndex(isInk);
    if (at >= 0) {                                   // already inked: maybe swap width / fade
      if (custom && mats[at] !== ink) { const a = mats.slice(); a[at] = ink; mesh.material = a; }
      return;
    }
    // A mesh that was inked and later switched off by setInk(false) keeps its hull material in INK_OFF.
    if (INK_OFF.has(mesh)) { if (custom) INK_OFF.set(mesh, ink); return; }
    if (!mats.length || !mats.every(m => inkable(m, !!opts.basic))) return;
    ensureOnormal(geo);
    const n = drawCount(geo);
    if (Array.isArray(mesh.material)) {
      // Multi-material mesh: keep its groups, add one ink group over everything.
      const k = mats.length;
      if (!geo.groups.some(g => g.materialIndex === k && g.start === 0 && g.count >= n)) geo.addGroup(0, n, k);
      mesh.material = [...mats, ink];
    } else {
      const G = geo.groups;
      const ours = G.length === 2 && G[0].start === 0 && G[0].materialIndex === 0 && G[1].start === 0 && G[1].materialIndex === 1;
      if (!ours) {
        // A single-material mesh ignores groups, so primitive groups (BoxGeometry faces, cylinder caps)
        // can be replaced. (Do not share such a geometry with a multi-material mesh.)
        geo.clearGroups(); geo.addGroup(0, n, 0); geo.addGroup(0, n, 1);
      }
      mesh.material = [mats[0], ink];
    }
  });
}

/**
 * Switch ink on or off for already-inked meshes under `obj` (LOD: far civilians, low-quality props).
 * Off swaps the [toon, ink] array for the plain toon material; geometry is untouched, so it is cheap.
 */
export function setInk(obj: THREE.Object3D, on: boolean): void {
  obj.traverse(o => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    if (!on) {
      if (!Array.isArray(mesh.material) || mesh.material.length !== 2 || !isInk(mesh.material[1])) return;
      INK_OFF.set(mesh, mesh.material[1]); mesh.material = mesh.material[0];
    } else {
      const ink = INK_OFF.get(mesh);
      if (ink && !Array.isArray(mesh.material)) mesh.material = [mesh.material, ink];
      INK_OFF.delete(mesh);
    }
  });
}
