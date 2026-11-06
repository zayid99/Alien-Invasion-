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
  }
} catch (e) { errors.push(String(e)); }
await browser?.close(); server.kill();
if (errors.length) { console.error('FAILED:\n' + errors.join('\n')); process.exit(1); }
console.log('OK: game boots, tutorial completes, no console errors.');
