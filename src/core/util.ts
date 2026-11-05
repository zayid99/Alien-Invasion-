// Small math + random helpers used everywhere.
import * as THREE from 'three';

export const V3 = THREE.Vector3;
export type Vec3 = THREE.Vector3;
export const _v1 = new V3(), _v2 = new V3(), _v3 = new V3();
export const _q1 = new THREE.Quaternion();
export const _m1 = new THREE.Matrix4();
export const _e1 = new THREE.Euler();
export const _c1 = new THREE.Color();

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent smoothing toward b. */
export const damp = (a: number, b: number, k: number, dt: number) => lerp(a, b, 1 - Math.exp(-k * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;
export const hdist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
export const angWrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const angTo = (cur: number, target: number, maxStep: number) => cur + clamp(angWrap(target - cur), -maxStep, maxStep);
export const fmtTime = (s: number) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Run fn with Math.random seeded, so procedural maps look the same every visit. */
export function seeded<T>(seed: number, fn: () => T): T {
  const orig = Math.random; Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = orig; }
}
export function hashString(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Latitude/longitude (degrees) to a point on a sphere, matching three.js SphereGeometry UVs. */
export function latLonToVec3(lat: number, lon: number, r: number, out = new V3()) {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  return out.set(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
/** Great-circle distance in degrees. */
export function arcDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a))) / r;
}
