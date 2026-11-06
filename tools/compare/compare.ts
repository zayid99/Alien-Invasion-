// Side-by-side: current models vs the Blender remakes, both through the game's toon shading + ink outlines,
// the mission light rig and the same cameras. Not shipped: a dev page for the art decision.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeUFO, makeGrayAlien, makeCow, addHouse } from '../../src/gfx/models';
import { Kit } from '../../src/gfx/kit';
import { preload, instance, play } from '../../src/core/assets';
import { toonMaterial, inkify, setInkResolution, setRimColor } from '../../src/gfx/toon';
import { PAL } from '../../src/gfx/palette';

const W = 360, H = 300, GW = 1280, GH = 720;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.domElement.id = 'r'; renderer.domElement.style.display = 'none'; document.body.appendChild(renderer.domElement);
renderer.setPixelRatio(1); renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.25));
const key = new THREE.DirectionalLight(PAL.moonKey, 3.0); key.position.set(-60, 120, 90); scene.add(key);
setRimColor(PAL.rimMission);
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), toonMaterial({ color: PAL.grass }));
scene.add(ground);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 500);

// ---- Blender GLB -> game materials (the kind is the material-name tag written by build_models.py) ----
function toGame(root: THREE.Object3D) {
  root.traverse(o => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial, tag = (src.name.split('__')[1] || 'std');
    const color = src.color.clone();
    if (tag.startsWith('glow')) { const k = parseFloat(tag.slice(4)) || 1.5; m.material = new THREE.MeshBasicMaterial({ color: color.multiplyScalar(k), toneMapped: false }); }
    else if (tag === 'glass') { m.material = toonMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false }); m.renderOrder = 2; }
    else m.material = toonMaterial({ color, variant: (tag === 'metal' || tag === 'gloss') ? tag : 'std' } as any);
  });
  inkify(root);
  return root;
}
const loader = new GLTFLoader();
const blender = async (f: string) => toGame((await loader.loadAsync(`/tools/compare/models/${f}.glb`)).scene);

function stats(o: THREE.Object3D) {
  let tris = 0, draws = 0;
  o.traverse(c => { const m = c as THREE.Mesh; if (!m.isMesh) return; const g = m.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const mats = Array.isArray(m.material) ? m.material.length : 1; tris += n; draws += mats; });
  return { tris: Math.round(tris), draws };
}

function shot(obj: THREE.Object3D, view: 'close' | 'game', lift = 0): string {
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  if (view === 'close') {
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = 30; setInkResolution(W, H, 1);
    const dir = new THREE.Vector3(0.55, 0.45, 1).normalize();
    camera.position.copy(c).addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(15)) * 1.05);
    camera.lookAt(c);
  } else {
    // the mission camera: fov 50, distance 36, 0.62 up / 0.78 back, looking at the ground under the saucer
    renderer.setSize(GW, GH, false); camera.aspect = GW / GH; camera.fov = 50; setInkResolution(GW, GH, 1);
    const tgt = new THREE.Vector3(0, lift, 0);
    camera.position.set(0, lift + 36 * 0.62, 36 * 0.78); camera.lookAt(tgt);
  }
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color('#2b1f60');
  ground.visible = true;
  renderer.render(scene, camera);
  scene.remove(obj);
  if (view === 'close') return renderer.domElement.toDataURL('image/png');
  // crop the middle of the 1280x720 frame at true in-game pixel size
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  cv.getContext('2d').drawImage(renderer.domElement, (GW - W) / 2, (GH - H) / 2, W, H, 0, 0, W, H);
  return cv.toDataURL('image/png');
}

function cur(kind: string): THREE.Object3D {
  switch (kind) {
    case 'saucer': { const u = makeUFO(); u.shield.visible = false; return u.group; }
    case 'alien': return makeGrayAlien();
    case 'cow': return makeCow();
    case 'house': { const k = new Kit(); addHouse(k, 0, 0, 0, ['#ffe3b8'], ['#e0533d'], { w: 7, d: 6 }); return k.build(); }
    case 'tank': return instance('tank').root;
    case 'civilian': { const i = instance('mini_female_a'); play(i, 'idle'); i.mixer?.update(0.4); return i.root; }
  }
}

const ROWS: [string, string, string][] = [
  ['saucer', 'Flying saucer', 'player · code-built now'],
  ['alien', 'Gray alien clone', 'army unit / Zix · code-built now'],
  ['cow', 'Cow', 'farm animal · code-built now'],
  ['house', 'House', 'scenery · code-built now'],
  ['tank', 'Tank', 'enemy · Kenney pack now'],
  ['civilian', 'Civilian', 'human · Kenney pack now (animated)'],
];

(async () => {
  await preload(['tank', 'mini_female_a']);
  const grid = document.getElementById('grid');
  grid.innerHTML = `<div></div><div class="h cur">Current · close-up</div><div class="h bl">Blender · close-up</div><div class="h cur">Current · in-game size</div><div class="h bl">Blender · in-game size</div>`;
  const out: any = {};
  for (const [id, name, sub] of ROWS) {
    const a = cur(id), b = await blender(id);
    // the saucer flies at ufoY 15 in game; everything else stands on the ground
    const lift = id === 'saucer' ? 0 : 0;
    const sa = stats(a), sb = stats(b);
    out[id] = { current: sa, blender: sb };
    const cells = [shot(a, 'close'), shot(b, 'close'), shot(a, 'game', lift), shot(b, 'game', lift)];
    const labels = [`${sa.tris.toLocaleString()} tris`, `${sb.tris.toLocaleString()} tris`, '', ''];
    grid.insertAdjacentHTML('beforeend', `<div class="name">${name}<small>${sub}</small></div>` +
      cells.map((u, i) => `<div class="cell"><img src="${u}">${labels[i] ? `<span>${labels[i]}</span>` : ''}</div>`).join(''));
  }
  (window as any).__done = out;
})().catch(e => { (window as any).__err = String(e?.stack || e); });
