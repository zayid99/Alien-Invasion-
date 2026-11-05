// Keyboard, mouse and touch (virtual joystick + hold buttons).
import { camera } from './engine';
import { SFX } from './audio';
import { _v1 } from './util';
import type { Vec3 } from './util';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
export const INPUT = {
  keys: new Set<string>(), pressed: new Set<string>(), wheel: 0, touch: false,
  mouse: { x: innerWidth / 2, y: innerHeight / 2, down: false, has: false },
  joy: { x: 0, y: 0, active: false, id: -1 },
  tb: { beam: false, zap: false, boost: false },
  /** set by the game: true while flying a mission (arrow keys/space must not scroll) */
  captureKeys: () => false,
  onTouchEnabled: () => {},
  init() {
    addEventListener('keydown', e => {
      SFX.init();
      if (this.captureKeys() && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return; this.keys.add(e.code); this.pressed.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    const canvas = $('game');
    canvas.addEventListener('pointerdown', e => { SFX.init(); if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = true; canvas.focus({ preventScroll: true }); });
    addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = false; });
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true; } });
    canvas.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('touchstart', () => this.enableTouch(), { passive: true });
    const joy = $('joy'), knob = $('joy-knob');
    const setJoy = (e: PointerEvent) => {
      const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.42;
      let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      this.joy.x = dx / R; this.joy.y = dy / R; knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    joy.addEventListener('pointerdown', e => { this.joy.active = true; this.joy.id = e.pointerId; joy.setPointerCapture(e.pointerId); setJoy(e); SFX.init(); });
    joy.addEventListener('pointermove', e => { if (this.joy.active && e.pointerId === this.joy.id) setJoy(e); });
    const endJoy = (e: PointerEvent) => { if (e.pointerId !== this.joy.id) return; this.joy.active = false; this.joy.x = this.joy.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
    for (const [id, k] of [['t-beam', 'beam'], ['t-zap', 'zap'], ['t-boost', 'boost']] as const) {
      const b = $(id);
      b.addEventListener('pointerdown', e => { this.tb[k] = true; b.classList.add('on'); b.setPointerCapture(e.pointerId); SFX.init(); });
      const off = () => { this.tb[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    }
    $('t-send').addEventListener('pointerdown', () => this.pressed.add('KeyR'));
  },
  enableTouch() { if (this.touch) return; this.touch = true; document.body.classList.add('touch'); this.onTouchEnabled(); },
  down(c: string) { return this.keys.has(c); },
  hit(c: string) { return this.pressed.has(c); },
  endFrame() { this.pressed.clear(); this.wheel = 0; },
  move() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.joy.active) { x += this.joy.x; z -= this.joy.y; }
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    return { x, z };
  },
  beam() { return this.down('Space') || this.tb.beam; },
  zap() { return this.mouse.down || this.tb.zap; },
  boost() { return this.down('ShiftLeft') || this.down('ShiftRight') || this.tb.boost; },
  /** Where the mouse points on the ground (y = 0). */
  aim(out: Vec3) {
    _v1.set((this.mouse.x / innerWidth) * 2 - 1, -(this.mouse.y / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
    if (_v1.y > -0.02) return null;
    return out.copy(camera.position).addScaledVector(_v1, -camera.position.y / _v1.y);
  },
};
