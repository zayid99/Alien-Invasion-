// Smoke test: serves dist/, checks a new player lands straight in the training night, plays the tutorial,
// goes on to the Moon Base (builds a clone, upgrades the beam, heads to Earth), and fails on console errors.
// Needs: npm install --save-dev playwright && npx playwright install chromium   (then: npm run build && npm test)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
let browser;
try {
  await sleep(2500);
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4174/');
  await page.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 120000 });
  const start = await page.evaluate(() => ({ mode: window.__AI.G.mode, tut: window.__AI.TUT.active }));
  if (start.mode !== 'mission' || !start.tut) errors.push(`a new player should land in the training night, got "${start.mode}"`);
  await sleep(500);
  const ok = await page.evaluate(() => {
    const A = window.__AI, G = A.G, hold = (k, s) => { A.INPUT.keys.add(k); A.simulate(s); A.INPUT.keys.delete(k); };
    hold('KeyW', 2);
    for (let i = 0; i < 2; i++) { const t = G.ents.find(e => e.tutTarget && !e.dead); if (t) { G.player.pos.x = t.pos.x; G.player.pos.z = t.pos.z; } hold('Space', 3.5); }
    A.INPUT.pressed.add('KeyR'); A.simulate(2.2);
    A.simulate(0.2); A.INPUT.tb.zap = true; A.simulate(1.2); A.INPUT.tb.zap = false;
    const cop = G.ents.find(e => e.kind === 'cop' && !e.dead); if (cop) { G.player.pos.x = cop.pos.x; G.player.pos.z = cop.pos.z; } hold('Space', 4);
    return !A.TUT.active;
  });
  if (!ok) errors.push('tutorial did not finish');
  await sleep(4500);
  const mode = await page.evaluate(() => window.__AI.G.mode);
  if (mode !== 'summary') errors.push(`expected the training report, got "${mode}"`);
  else {
    await page.click('#btn-sum-next'); await sleep(7000);
    const next = await page.evaluate(() => window.__AI.G.mode);
    if (next !== 'moonbase') errors.push(`expected the Moon Base after training, got "${next}"`);
    // the Moon Base tutorial: open the Hybrid Lab, build a clone, open the Research Lab, upgrade the beam
    await page.click('#ml-hybrid'); await sleep(1500);
    const clone = await page.evaluate(() => !document.getElementById('btn-build-clone')?.disabled);
    if (!clone) errors.push('a Gray Clone should be affordable in the Hybrid Lab right after training');
    else { await page.click('#btn-build-clone'); await sleep(800); }
    await page.click('#rb-research'); await sleep(1500);
    const beam = await page.evaluate(() => !document.querySelector('[data-up="beam"]')?.disabled);
    if (!beam) errors.push('the beam upgrade should be affordable in the Research Lab right after training');
    else { await page.click('[data-up="beam"]'); await sleep(800); }
    const st = await page.evaluate(() => ({ clone: window.__AI.G.save.army.clone, beam: window.__AI.G.save.up.beam }));
    if (st.clone < 1 || st.beam < 1) errors.push(`Moon Base purchases did not apply: ${JSON.stringify(st)}`);
    await page.click('#btn-moon-earth'); await sleep(5000);
    const g = await page.evaluate(() => window.__AI.G.mode);
    if (g !== 'globe') errors.push(`To Earth should open the globe, got "${g}"`);
  }
  // --- regression checks (docs/STUDIO_REVIEW.md) ---
  // B: ending a night straight away pays no tribute and does not count as a finished night
  const abort = await page.evaluate(() => {
    const A = window.__AI, G = A.G; A.TUT.stop(); G.save.tutorial = { done: true, ms: 3, globe: true };
    G.save.cities = { 'kansas-city': { occupied: true, attempts: 0, since: 1 } };
    const res = { ...G.save.res }, missions = G.save.totals.missions, day = G.save.day;
    A.startMission({ id: 'e2e-abort', type: 'abduct', region: 'us-midwest', lat: 0, lon: 0, name: 'Test', level: 1, expires: 99 });
    A.endNight('abort');
    return { gain: G.save.res.humans - res.humans, missions: G.save.totals.missions - missions, days: G.save.day - day };
  });
  if (abort.gain !== 0 || abort.missions !== 0 || abort.days !== 1) errors.push(`ending a night early: ${JSON.stringify(abort)} (want no tribute, no mission counted, 1 day)`);
  // A: the saucer going down just before the HQ falls is still a victory
  await page.evaluate(() => {
    const A = window.__AI, G = A.G; G.save.cities = {}; G.save.army = { clone: 6, brute: 0, saucer: 0, walker: 0 };
    A.startInvasion({ id: 'kansas-city', name: 'Kansas City', country: 'USA', region: 'us-midwest', lat: 39.1, lon: -94.58, size: 2 });
    A.damagePlayer(1e6); if (!G.player.dead) throw new Error('saucer should be down');   // defeat scheduled in 1.6 s
    G.inv.pylonsLeft = 0; G.inv.hq.onDamage(G.inv.hq, 1e9, 'test');            // ...but the HQ falls first
  });
  await sleep(9000);
  const race = await page.evaluate(() => ({ eyebrow: document.getElementById('end-eyebrow').textContent, occupied: !!window.__AI.G.save.cities['kansas-city']?.occupied }));
  if (!race.eyebrow.includes('Victory') || !race.occupied) errors.push(`HQ down after the saucer fell should be a victory: ${JSON.stringify(race)}`);
  // --- v0.4 acceptance checks (docs/stories.md) ---
  const v4 = await page.evaluate(() => {
    const A = window.__AI, G = A.G, S = G.save, out = [];
    const want = (ok, msg) => { if (!ok) out.push(msg); };
    // 1.2 + 1.4: a County Fair doubles the animals; its goal pays a bonus and the night is graded
    const animals = () => G.ents.filter(e => ['cow', 'sheep', 'pig', 'chicken'].includes(e.kind)).length;
    A.startMission({ id: 'e2e-base', type: 'abduct', region: 'us-midwest', lat: 0, lon: 0, name: 't', level: 2, expires: 99 }); const base = animals(); A.endNight('abort');
    A.startMission({ id: 'e2e-fair', type: 'abduct', region: 'us-midwest', lat: 0, lon: 0, name: 't', level: 2, expires: 99, twist: 'fair' });
    want(animals() >= base * 1.8, `County Fair should double the animals (${base} -> ${animals()})`);
    const bio = S.res.biomass; let n = 0; for (const e of [...G.ents]) if (n < 16 && ['cow', 'sheep', 'pig', 'chicken'].includes(e.kind) && !e.dead) { A.abductEnt(e); n++; }
    G.nightT = 0; A.simulate(0.1);
    want(G.night.grade && G.night.grade.met === true && G.night.grade.stars >= 1, `night grade: ${JSON.stringify(G.night.grade)}`);
    want(S.res.biomass - bio >= 25, 'County Fair bonus not paid');
    // 2.3: losing a city twice raises its defense by 1 only
    S.cities = {}; const kc = { id: 'kansas-city', name: 'Kansas City', country: 'USA', region: 'us-midwest', lat: 39.1, lon: -94.58, size: 2 };
    const L0 = A.cityLevel(kc); S.cities['kansas-city'] = { occupied: false, attempts: 2 }; want(A.cityLevel(kc) - L0 === 1, 'loss penalty should be capped at +1');
    // 3.1 + 3.2: a revolt stops tribute; a night in the region ends it
    S.cities = { 'kansas-city': { occupied: true, attempts: 0, since: 1, res: 99, garrison: 0 } };
    A.startMission({ id: 'e2e-west', type: 'abduct', region: 'us-west', lat: 0, lon: 0, name: 't', level: 1, expires: 99 }); G.nightT = 0; A.simulate(0.1);
    want(S.cities['kansas-city'].revolt === true, 'resistance 100 should start a revolt');
    const h0 = S.res.humans; A.startMission({ id: 'e2e-mid', type: 'abduct', region: 'us-midwest', lat: 0, lon: 0, name: 't', level: 1, expires: 99 }); G.nightT = 0; A.simulate(0.1);
    want(!S.cities['kansas-city'].revolt && S.cities['kansas-city'].res <= 30, `a night in the region should end the revolt: ${JSON.stringify(S.cities['kansas-city'])}`);
    // 5.1 + 5.2: three hours away with two cities pays tribute and triggers a counter-attack
    S.cities.chicago = { occupied: true, attempts: 0, since: 1, res: 0, garrison: 5 };
    const away = A.applyAway(Date.now() - 3 * 3.6e6);
    want(away && away.hours > 2.9 && Object.values(away.gain).some(v => v > 0) && away.attacked === 'Kansas City', `away report: ${JSON.stringify(away)}`);
    // 3.3 + 4.1: conquering New York leaves a garrison and opens chapter 2
    S.cities = {}; S.tierUnlocked = 1; S.army = { clone: 20, brute: 0, saucer: 0, walker: 0 };
    A.startInvasion({ id: 'new-york', name: 'New York', country: 'USA', region: 'us-east', lat: 40.71, lon: -74.01, size: 5 }); G.paused = true;
    want(G.inv.boss?.name === 'Liberty Titan', 'New York should have the Liberty Titan');
    A.endInvasion(true);
    want(S.tierUnlocked === 2, `capturing New York should open chapter 2 (tier ${S.tierUnlocked})`);
    want(S.army.clone === 17 && S.cities['new-york'].garrison === 3, `garrison: army ${S.army.clone}, garrison ${S.cities['new-york'].garrison}`);
    // 4.4: New Game+ keeps the army, resets the map, makes Earth stronger
    A.startNewGamePlus();   // day 1, awareness 0: Kansas City (size 2) is defense 1 normally, 3 in New Game+ 1
    want(S.ngPlus === 1 && S.tierUnlocked === 1 && !S.cities['new-york']?.occupied && S.army.clone === 17 && A.cityLevel(kc) === 3, `New Game+ state: ${JSON.stringify({ ng: S.ngPlus, tier: S.tierUnlocked, army: S.army.clone, kc: A.cityLevel(kc) })}`);
    // 5.3: a daily challenge site exists, seeded by the date
    want(S.sites.some(x => x.daily), 'daily challenge site missing');
    return out;
  });
  errors.push(...v4);
} catch (e) { errors.push(String(e)); }
await browser?.close(); server.kill();
if (errors.length) { console.error('FAILED:\n' + errors.join('\n')); process.exit(1); }
console.log('OK: game boots, tutorial completes, regression checks pass, no console errors.');
