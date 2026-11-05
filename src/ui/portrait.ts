// A second tiny renderer that draws Commander Zix for briefings and radio messages.
import * as THREE from 'three';
import { makeGrayAlien } from '../gfx/models';

export const portrait = {
  r: null as THREE.WebGLRenderer | null, scene: null as THREE.Scene, cam: null as THREE.PerspectiveCamera, alien: null as THREE.Object3D,
  el: null as HTMLElement | null, t: 0, talk: 0,
  init() {
    try { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { this.r = null; return; }
    this.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xb8a8ff, 0x201830, 1.4));
    const key = new THREE.DirectionalLight(0xe8dcff, 2.6); key.position.set(1.5, 3, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fe0ff, 2.2); rim.position.set(-3, 2, -2); this.scene.add(rim);
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
    this.r.render(this.scene, this.cam);
  },
};
