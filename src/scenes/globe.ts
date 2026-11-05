// The strategy layer: a real-world 3D Earth with regions, cities and mission sites.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import countriesTopo from 'world-atlas/countries-110m.json';
import { G, track } from '../game/state';
import { camera, renderer, scene, LIGHT, makeStars, fresnelMaterial } from '../core/engine';
import { REGIONS, CITIES, COUNTRY_REGION, regionById, cityById, TIER_NAMES } from '../data/earth';
import type { City, Region } from '../data/earth';
import { BIOMES } from '../data/biomes';
import { RES } from '../data/balance';
import type { MissionSite } from '../core/save';
import { clearWorld } from '../world/maps/common';
import { regionState, cityState, regionUnlocked, cityLevel, earthPower, armyPower, verdict, occupiedCities } from '../game/campaign';
import { SFX } from '../core/audio';
import { $, UI, ICON } from '../ui/dom';
import { arcDeg, clamp, latLonToVec3 } from '../core/util';

const R = 10;
export const globeHooks = { launchSite: (_s: MissionSite) => {}, invade: (_c: City) => {}, mothership: () => {} };
type Sel = { type: 'site' | 'city' | 'region'; id: string } | null;
const GL = {
  controls: null as OrbitControls, canvas: null as HTMLCanvasElement, tex: null as THREE.CanvasTexture, features: null as any[],
  pins: [] as { obj: THREE.Object3D; proxy: THREE.Mesh; city: City; head: THREE.Mesh }[], sites: [] as { obj: THREE.Group; proxy: THREE.Mesh; site: MissionSite }[],
  earth: null as THREE.Mesh, labels: new Map<string, HTMLElement>(), sel: null as Sel, down: { x: 0, y: 0 }, fly: null as { from: THREE.Vector3; to: THREE.Vector3; t: number } | null, idle: 0,
};
const LAND: Record<string, string> = { temperate: '#4f7a45', desert: '#b39a63', tropical: '#3c7a3c', cold: '#c3d1e0' };
function regionOfCountry(name: string, lat: number, lon: number) {
  if (name in COUNTRY_REGION) return COUNTRY_REGION[name];
  let best = REGIONS[0], bd = 1e9; for (const r of REGIONS) { const d = arcDeg(lat, lon, r.lat, r.lon); if (d < bd) { bd = d; best = r; } } return best.id;
}
export function regionAt(lat: number, lon: number) {
  let best: Region = REGIONS[0], bd = 1e9; for (const r of REGIONS) { const d = arcDeg(lat, lon, r.lat, r.lon); if (d < bd) { bd = d; best = r; } } return best;
}
function prepareFeatures() {
  if (GL.features) return;
  const fc: any = feature(countriesTopo as any, (countriesTopo as any).objects.countries);
  GL.features = fc.features.map((f: any) => {
    const polys = f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
    let big = polys[0]?.[0] || [[0, 0]]; for (const p of polys) if (p[0].length > big.length) big = p[0];
    const lon = big.reduce((a: number, q: number[]) => a + q[0], 0) / big.length, lat = big.reduce((a: number, q: number[]) => a + q[1], 0) / big.length;
    return { name: f.properties.name, polys, region: regionOfCountry(f.properties.name, lat, lon) };
  });
}
function mix(a: string, b: string, t: number) { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return '#' + c.getHexString(); }
function drawEarth() {
  const W = 2048, H = 1024, c = GL.canvas || (GL.canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1d3c'); g.addColorStop(0.5, '#123a6b'); g.addColorStop(1, '#0b1d3c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(160,190,255,0.07)'; x.lineWidth = 1;
  for (let lo = -180; lo <= 180; lo += 30) { x.beginPath(); x.moveTo((lo + 180) / 360 * W, 0); x.lineTo((lo + 180) / 360 * W, H); x.stroke(); }
  for (let la = -60; la <= 60; la += 30) { x.beginPath(); x.moveTo(0, (90 - la) / 180 * H); x.lineTo(W, (90 - la) / 180 * H); x.stroke(); }
  const selRegion = GL.sel?.type === 'region' ? GL.sel.id : GL.sel?.type === 'city' ? cityById(GL.sel.id)?.region : GL.sel?.type === 'site' ? G.save.sites.find(s => s.id === GL.sel.id)?.region : null;
  for (const f of GL.features) {
    const r = regionById(f.region); let col = f.name === 'Antarctica' ? '#e8eef6' : r ? LAND[r.biome] : '#6a7280';
    if (r && !regionUnlocked(r)) col = mix(col, '#2c3548', 0.62);
    else if (r) {
      const alert = regionState(r.id).alert; if (alert > 0) col = mix(col, '#e0483d', alert / 260);
    }
    x.fillStyle = col; x.strokeStyle = f.region === selRegion ? '#ffd65c' : 'rgba(8,12,22,0.6)'; x.lineWidth = f.region === selRegion ? 2.4 : 1;
    for (const poly of f.polys) for (const off of [-360, 0, 360]) {
      x.beginPath();
      for (const ring of poly) {
        let prev = ring[0][0], acc = 0;
        ring.forEach((q: number[], i: number) => { let lon = q[0]; if (i) { if (lon - prev > 180) acc -= 360; else if (prev - lon > 180) acc += 360; } prev = q[0]; lon += acc + off;
          const px = (lon + 180) / 360 * W, py = (90 - q[1]) / 180 * H; if (i) x.lineTo(px, py); else x.moveTo(px, py); });
        x.closePath();
      }
      x.fill('evenodd'); x.stroke();
    }
  }
  for (const city of CITIES) if (G.save.cities[city.id]?.occupied) {   // Gray Empire territory spreads from captured cities
    const px = (city.lon + 180) / 360 * W, py = (90 - city.lat) / 180 * H, rad = (2.5 + city.size * 1.1) / 360 * W;
    const rg = x.createRadialGradient(px, py, 0, px, py, rad); rg.addColorStop(0, 'rgba(176,112,255,0.85)'); rg.addColorStop(0.6, 'rgba(150,90,240,0.45)'); rg.addColorStop(1, 'rgba(140,80,230,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
  }
  if (GL.tex) GL.tex.needsUpdate = true;
}
function placeOnSurface(obj: THREE.Object3D, lat: number, lon: number, lift = 0) {
  const n = latLonToVec3(lat, lon, 1); obj.position.copy(n).multiplyScalar(R + lift); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
}
function buildPins() {
  const stick = track(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6).translate(0, 0.275, 0)), head = track(new THREE.SphereGeometry(0.1, 12, 8).translate(0, 0.58, 0)), proxyGeo = track(new THREE.SphereGeometry(0.42, 8, 6).translate(0, 0.45, 0));
  const stickMat = track(new THREE.MeshBasicMaterial({ color: 0x9aa3b8 }));
  GL.pins = CITIES.map(city => {
    const g = new THREE.Group(), h = new THREE.Mesh(head, new THREE.MeshBasicMaterial({ toneMapped: false })), proxy = new THREE.Mesh(proxyGeo); proxy.visible = false;
    g.add(new THREE.Mesh(stick, stickMat), h, proxy); g.scale.setScalar(0.75 + city.size * 0.12); placeOnSurface(g, city.lat, city.lon); G.world.add(g);
    G.disposables.push(h.material as THREE.Material);
    return { obj: g, proxy, city, head: h };
  });
  colorPins();
}
function colorPins() {
  for (const p of GL.pins) {
    const occ = cityState(p.city.id).occupied, open = regionUnlocked(regionById(p.city.region));
    (p.head.material as THREE.MeshBasicMaterial).color.setRGB(...(occ ? [2.2, 1.3, 4] : open ? [3.2, 1.4, 0.5] : [0.45, 0.48, 0.58]) as [number, number, number]);
  }
}
function buildSites() {
  for (const s of GL.sites) G.world.remove(s.obj);
  const ringGeo = track(new THREE.TorusGeometry(0.32, 0.05, 6, 24).rotateX(Math.PI / 2)), beamGeo = track(new THREE.CylinderGeometry(0.05, 0.12, 1.4, 8, 1, true).translate(0, 0.7, 0)), proxyGeo = track(new THREE.SphereGeometry(0.5, 8, 6));
  const ringMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.3, 4.2), toneMapped: false })), beamMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 3), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  GL.sites = G.save.sites.map(site => {
    const g = new THREE.Group(), proxy = new THREE.Mesh(proxyGeo); proxy.visible = false;
    g.add(new THREE.Mesh(ringGeo, ringMat), new THREE.Mesh(beamGeo, beamMat), proxy); placeOnSurface(g, site.lat, site.lon, 0.02); G.world.add(g);
    return { obj: g, proxy, site };
  });
}
export function enterGlobe() {
  clearWorld(); prepareFeatures();
  scene.fog = null; scene.background = new THREE.Color(0x02030a);
  LIGHT.hemi.color.set(0x9aa8ff); LIGHT.hemi.groundColor.set(0x0a0a20); LIGHT.hemi.intensity = 0.7;
  LIGHT.moon.color.set(0xfff1dc); LIGHT.moon.intensity = 2.4; LIGHT.moon.position.set(60, 40, 80);
  const stars = makeStars(2400, 400, -1); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  drawEarth();
  GL.tex = track(new THREE.CanvasTexture(GL.canvas)); GL.tex.colorSpace = THREE.SRGBColorSpace; GL.tex.anisotropy = 8;
  GL.earth = new THREE.Mesh(track(new THREE.SphereGeometry(R, 128, 64)), track(new THREE.MeshStandardMaterial({ map: GL.tex, roughness: 0.8, metalness: 0 }))); G.world.add(GL.earth);
  const atmo = new THREE.Mesh(track(new THREE.SphereGeometry(R * 1.05, 64, 32)), track(fresnelMaterial(0x6fb8ff, 3.2, 1))); G.world.add(atmo);
  buildPins(); buildSites();
  if (!GL.controls) {
    GL.controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(GL.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 15, maxDistance: 48, rotateSpeed: 0.55, zoomSpeed: 0.7 });
    renderer.domElement.addEventListener('pointerdown', e => { GL.down = { x: e.clientX, y: e.clientY }; GL.idle = 0; GL.fly = null; });
    renderer.domElement.addEventListener('pointerup', e => { if (G.mode === 'globe' && Math.hypot(e.clientX - GL.down.x, e.clientY - GL.down.y) < 7) pick(e.clientX, e.clientY); });
    $('g-panel').addEventListener('click', onPanelClick);
  }
  GL.controls.enabled = true; GL.controls.target.set(0, 0, 0);
  const focus = GL.sel?.type === 'city' ? cityById(GL.sel.id) : { lat: 36, lon: -96 };
  camera.position.copy(latLonToVec3(focus.lat, focus.lon, 30)); camera.lookAt(0, 0, 0);
  makeLabels(); UI.globe(true); renderPanel(); renderTop();
}
export function leaveGlobe() { if (GL.controls) GL.controls.enabled = false; UI.globe(false); for (const el of GL.labels.values()) el.style.opacity = '0'; }
function makeLabels() {
  const box = $('g-labels'); if (GL.labels.size) return;
  for (const c of CITIES) { const el = document.createElement('div'); el.className = 'g-label'; el.textContent = c.name; box.appendChild(el); GL.labels.set(c.id, el); }
}
function flyTo(lat: number, lon: number) { GL.fly = { from: camera.position.clone(), to: latLonToVec3(lat, lon, clamp(camera.position.length(), 22, 34)), t: 0 }; }
function pick(cx: number, cy: number) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const earthHit = ray.intersectObject(GL.earth)[0], limit = earthHit ? earthHit.distance + 0.4 : 1e9;
  const siteHit = ray.intersectObjects(GL.sites.map(s => s.proxy))[0], pinHit = ray.intersectObjects(GL.pins.map(p => p.proxy))[0];
  if (siteHit && siteHit.distance < limit) { select({ type: 'site', id: GL.sites.find(s => s.proxy === siteHit.object).site.id }); return; }
  if (pinHit && pinHit.distance < limit) { select({ type: 'city', id: GL.pins.find(p => p.proxy === pinHit.object).city.id }); return; }
  if (earthHit) { const p = earthHit.point.clone().normalize(), lat = Math.asin(p.y) * 180 / Math.PI, lon = Math.atan2(-p.z, p.x) * 180 / Math.PI; select({ type: 'region', id: regionAt(lat, lon).id }); return; }
  select(null);
}
export function select(s: Sel, fly = false) {
  GL.sel = s; SFX.play('ui'); drawEarth(); renderPanel();
  if (fly && s) { const o = s.type === 'site' ? G.save.sites.find(x => x.id === s.id) : s.type === 'city' ? cityById(s.id) : regionById(s.id); if (o) flyTo(o.lat, o.lon); }
}
function renderTop() {
  const s = G.save;
  UI.set('g-day', 'text', `Day ${s.day} · ${TIER_NAMES[s.tierUnlocked]} unlocked`);
  UI.set('g-aware', 'html', `<span>Aware</span><div class="bar"><i style="width:${s.awareness.toFixed(0)}%"></i></div><b class="val">${s.awareness.toFixed(0)}%</b>`);
  const occ = occupiedCities().length;
  UI.set('g-conq', 'html', `<span>Cities</span><div class="bar"><i style="width:${(occ / CITIES.length * 100).toFixed(1)}%"></i></div><b class="val">${occ}/${CITIES.length}</b>`);
  UI.set('g-wallet', 'html', RES.map(r => `<span class="chip ${r}" title="${r}">${ICON(r)}${Math.floor(s.res[r])}</span>`).join(''));
}
const siteRow = (s: MissionSite) => `<button class="g-site" data-site="${s.id}"><i class="dot abduct"></i><span><b>${s.name}</b><small>${regionById(s.region).name} · ${BIOMES[regionById(s.region).biome].name} · threat ${s.level}</small></span><span class="tag uv">${s.expires - G.save.day + 1}d</span></button>`;
function cityRow(c: City) { const L = cityLevel(c); return `<button class="g-site" data-city="${c.id}"><i class="dot invade"></i><span><b>${c.name}</b><small>${c.country} · defense ${L}</small></span><span class="tag ${verdict(armyPower(), earthPower(L)).cls}">${earthPower(L)}</span></button>`; }
export function renderPanel() {
  const s = G.save, sel = GL.sel; let h = '';
  if (!sel) {
    const targets = CITIES.filter(c => regionUnlocked(regionById(c.region)) && !cityState(c.id).occupied).sort((a, b) => cityLevel(a) - cityLevel(b)).slice(0, 4);
    h = `<div><div class="eyebrow">Day ${s.day}</div><h3>Choose a target</h3><p class="sub">Glowing rings are abduction sites. Orange pins are cities you can invade.</p></div>
      <div class="g-list">${s.sites.map(siteRow).join('') || '<p class="sub">No sites right now.</p>'}</div>
      <h3 style="font-size:15px">Cities in reach</h3><div class="g-list">${targets.map(cityRow).join('')}</div>`;
  } else if (sel.type === 'site') {
    const site = s.sites.find(x => x.id === sel.id); if (!site) { GL.sel = null; return renderPanel(); }
    const r = regionById(site.region), B = BIOMES[r.biome];
    h = `<div><div class="eyebrow">Abduction site · ${r.name}</div><h3>${site.name}</h3><p class="sub">${B.name} at night. Farms, a small town and an army base nearby.</p></div>
      <dl class="kv"><dt>Threat level</dt><dd>${site.level}</dd><dt>Regional alert</dt><dd>${Math.round(regionState(r.id).alert)}%</dd><dt>Animals here</dt><dd>${[...new Set(B.farm)].join(', ')}</dd><dt>Site expires</dt><dd>${site.expires - s.day + 1} day(s)</dd></dl>
      <div class="row"><button class="btn" data-act="back">Back</button><button class="btn primary" data-act="launch" id="btn-launch-site">Launch night</button></div>`;
  } else if (sel.type === 'city') {
    const c = cityById(sel.id), st = cityState(c.id), r = regionById(c.region), open = regionUnlocked(r), L = cityLevel(c), us = armyPower(), them = earthPower(L), v = verdict(us, them);
    h = `<div><div class="eyebrow">${c.country} · ${r.name}</div><h3>${c.name}</h3>
      <p class="sub">${st.occupied ? `Under Gray Empire control since day ${st.since}. Pays tribute every day.` : open ? 'Defended by Earth\'s army: shield pylons, an HQ, tanks and soldiers.' : `Locked. Unlocks with ${TIER_NAMES[r.tier]}.`}</p></div>
      ${st.occupied ? `<span class="tag uv">Conquered</span>` : `<dl class="kv"><dt>City size</dt><dd>${'★'.repeat(c.size)}</dd><dt>Defense level</dt><dd>${L}</dd><dt>Earth power</dt><dd>${them}</dd><dt>Your army</dt><dd>${us}</dd>${st.attempts ? `<dt>Failed attempts</dt><dd>${st.attempts}</dd>` : ''}</dl>
      <p><span class="tag ${v.cls}">${v.text}</span></p>`}
      <div class="row"><button class="btn" data-act="back">Back</button>${!st.occupied && open ? `<button class="btn" data-act="ms">Mothership</button><button class="btn primary" data-act="invade" id="btn-invade-city">Invade</button>` : ''}</div>`;
  } else {
    const r = regionById(sel.id), open = regionUnlocked(r), cities = CITIES.filter(c => c.region === r.id), sites = s.sites.filter(x => x.region === r.id);
    h = `<div><div class="eyebrow">${r.continent}</div><h3>${r.name}</h3><p class="sub">${BIOMES[r.biome].name} · ${open ? `regional alert ${Math.round(regionState(r.id).alert)}%` : `locked until ${TIER_NAMES[r.tier]} unlocks`}</p></div>
      ${sites.length ? `<div class="g-list">${sites.map(siteRow).join('')}</div>` : ''}
      <div class="g-list">${cities.map(c => cityState(c.id).occupied ? `<button class="g-site" data-city="${c.id}"><i class="dot occ"></i><span><b>${c.name}</b><small>Conquered</small></span><span></span></button>` : cityRow(c)).join('')}</div>
      <div class="row"><button class="btn" data-act="back">Back</button></div>`;
  }
  $('g-panel').innerHTML = h;
}
function onPanelClick(e: Event) {
  const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement; if (!t) return;
  if (t.dataset.site) select({ type: 'site', id: t.dataset.site }, true);
  else if (t.dataset.city) select({ type: 'city', id: t.dataset.city }, true);
  else if (t.dataset.act === 'back') select(null);
  else if (t.dataset.act === 'ms') globeHooks.mothership();
  else if (t.dataset.act === 'launch') { const site = G.save.sites.find(x => x.id === GL.sel?.id); if (site) globeHooks.launchSite(site); }
  else if (t.dataset.act === 'invade') { const c = cityById(GL.sel?.id); if (c) globeHooks.invade(c); }
}
const _n = new THREE.Vector3(), _p = new THREE.Vector3();
export function updateGlobe(dt: number, t: number) {
  if (GL.fly) { GL.fly.t = Math.min(1, GL.fly.t + dt * 1.6); const k = 1 - (1 - GL.fly.t) ** 3; camera.position.copy(GL.fly.from).lerp(GL.fly.to, k).setLength(GL.fly.from.length() + (GL.fly.to.length() - GL.fly.from.length()) * k); if (GL.fly.t >= 1) GL.fly = null; }
  GL.idle += dt; GL.controls.autoRotate = GL.idle > 12 && !GL.sel; GL.controls.autoRotateSpeed = 0.25; GL.controls.update();
  const pulse = 1 + Math.sin(t * 4) * 0.18;
  for (const s of GL.sites) { s.obj.children[0].scale.setScalar(pulse * (GL.sel?.id === s.site.id ? 1.5 : 1)); (s.obj.children[1] as THREE.Mesh).scale.y = 0.8 + Math.sin(t * 3 + s.site.lat) * 0.2; }
  for (const p of GL.pins) p.head.scale.setScalar(GL.sel?.id === p.city.id ? 1.6 + Math.sin(t * 5) * 0.2 : 1);
  const W = innerWidth, H = innerHeight, camDir = _p.copy(camera.position).normalize(), far = camera.position.length() > 30;
  for (const c of CITIES) {
    const el = GL.labels.get(c.id); latLonToVec3(c.lat, c.lon, 1, _n);
    const facing = _n.dot(camDir), sel = GL.sel?.id === c.id, show = facing > 0.35 && (!far || c.size >= 4 || sel);
    if (!show) { if (el.style.opacity !== '0') el.style.opacity = '0'; continue; }
    _n.multiplyScalar(R + 0.9).project(camera);
    el.style.opacity = String(Math.min(1, (facing - 0.35) * 4)); el.className = 'g-label' + (cityState(c.id).occupied ? ' occ' : '') + (sel ? ' sel' : '');
    el.style.transform = `translate(${((_n.x * 0.5 + 0.5) * W).toFixed(0)}px, ${((-_n.y * 0.5 + 0.5) * H).toFixed(0)}px) translate(-50%, -100%)`;
  }
}
export function refreshGlobe() { colorPins(); buildSites(); drawEarth(); renderPanel(); renderTop(); }
export function hideLabels() { for (const el of GL.labels.values()) el.style.opacity = '0'; }
/** The painted world map (also used for the Earth seen from the mothership). */
export function earthCanvas() { prepareFeatures(); drawEarth(); return GL.canvas; }
export const globeSelection = () => GL.sel;
