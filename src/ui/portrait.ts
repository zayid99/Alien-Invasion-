// A second tiny renderer that draws Commander Zix for briefings and radio messages.
// Lit per docs/ART_STYLE.md §4 "Zix portrait": lavender hemi, warm key, slime rim light from behind.
import * as THREE from 'three';
import { makeGrayAlien } from '../gfx/models';
import { withInkResolution } from '../gfx/toon';

const _size = new THREE.Vector2();
export const portrait = {
  r: null as THREE.WebGLRenderer | null, scene: null as THREE.Scene, cam: null as THREE.PerspectiveCamera, alien: null as THREE.Object3D,
  el: null as HTMLElement | null, t: 0, talk: 0,
  init() {
    try { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { this.r = null; return; }
    this.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.r.toneMapping = THREE.NeutralToneMapping; this.r.toneMappingExposure = 1.05;   // same look as the main view
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xb8a8ff, 0x2b1f4f, 1.25));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(1.5, 3, 3); this.scene.add(key);
    // Slime rim from behind: lights only the silhouette edge through the toon ramp.
    const rim = new THREE.DirectionalLight(0x9cff3f, 1.6); rim.position.set(-1.2, 2.2, -3); this.scene.add(rim);
    this.alien = makeGrayAlien(); this.scene.add(this.alien);
    this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50); this.cam.position.set(0, 2.05, 3.0); this.cam.lookAt(0, 1.98, 0);
  },
  attach(container: HTMLElement) {
    if (!this.r || this.el === container) return;
    container.appendChild(this.r.domElement); this.el = container; this.resize();
  },
  resize() { if (!this.r || !this.el) return; const s = this.el.clientWidth || 64; this.r.setSize(s, s, false); },
  render(dt: number) {
    if (!this.r || !this.el || !this.el.offsetParent) return;
    this.t += dt; const talking = this.talk > 0 ? 1 : 0; this.talk = Math.max(0, this.talk - dt);
    this.alien.rotation.y = Math.sin(this.t * 0.6) * 0.3; this.alien.rotation.x = Math.sin(this.t * 9) * 0.025 * talking;
    this.alien.position.y = Math.sin(this.t * 1.7) * 0.03;
    // Ink widths are in pixels of the canvas being drawn: swap uRes to this canvas for the render.
    this.r.getDrawingBufferSize(_size);
    withInkResolution(_size.x, _size.y, () => this.r.render(this.scene, this.cam));
  },
};
