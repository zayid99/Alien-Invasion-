// Smoke test: serves dist/, checks a new player lands straight in the training night, plays the tutorial,
// goes on to the mothership, and fails on console errors.
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
    await page.click('#btn-sum-next'); await sleep(6000);
    const next = await page.evaluate(() => window.__AI.G.mode);
    if (next !== 'mothership') errors.push(`expected the mothership after training, got "${next}"`);
    // the mothership tutorial's first purchases must be affordable right after training
    const can = await page.evaluate(() => ({ clone: !document.getElementById('btn-build-clone')?.disabled, beam: !document.querySelector('[data-up="beam"]')?.disabled }));
    if (!can.clone || !can.beam) errors.push(`first purchases not affordable after training: ${JSON.stringify(can)}`);
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
} catch (e) { errors.push(String(e)); }
await browser?.close(); server.kill();
if (errors.length) { console.error('FAILED:\n' + errors.join('\n')); process.exit(1); }
console.log('OK: game boots, tutorial completes, regression checks pass, no console errors.');
