// Reference UI for the Moon Base rooms, following Zayid's wireframe: the room plays live in a central "viewport window",
// control buttons sit around and over its edges. Positions are the wireframe's, scaled to a 1280 x 707 screen.
const { chromium } = require('playwright');
const ROOMS = {
  hybrid: { name: 'Hybrid Lab', sub: 'Grow clones and hybrids', lvl: 1,
    main: ['GROW GRAY CLONE', '10 biomass', 'slime'], b1: ['×5 CLONES', '50 biomass', 'slime'], b2: ['BRUTE', '6 humans · 4 bio', 'slime'],
    status: ['Vat 3', 'Growing… 72%'], tip: 'Clones are grown from biomass. Brutes are abducted humans in hypno-helmets.' },
  shipyard: { name: 'Shipyard', sub: 'Build saucers and war machines', lvl: 1,
    main: ['BUILD SAUCER', '16 metal · 2 humans', 'slime'], b1: ['×5 SAUCERS', '80 metal', 'slime'], b2: ['WALKER', '44 metal · 20 bio', 'slime'],
    status: ['Bay 2', 'Welding… 40%'], tip: 'War machines are built from stolen metal.' },
  research: { name: 'Research Lab', sub: 'Invent new tech and powers', lvl: 1,
    main: ['UPGRADE BEAM ▸ LV 3', '30 metal · 10 humans', 'slime'], b1: ['SHIELD ▸ LV 2', '20 metal', ''], b2: ['ENGINE ▸ LV 2', '20 metal', ''],
    status: ['Next tech', 'Cloaking device'], tip: 'Upgrade your saucer. The full research tree comes next.' },
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 707 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('alien-invasion-prefs', JSON.stringify({ qualityUser: 'high' })); } catch {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4175/'); await p.waitForFunction(() => document.getElementById('loading').hidden, null, { timeout: 180000 }); await p.waitForTimeout(9000);
  await p.evaluate(() => { const A = window.__AI, G = A.G; A.TUT.stop(); G.save.tutorial = { done: true, ms: 3, globe: true }; const d = new Date(); G.save.daily.lastClaim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    G.save.res = { humans: 64, biomass: 212, metal: 148 }; G.save.day = 4; G.moonSeen = true; A.goMoon(); A.simulate(1); A.renderer.setAnimationLoop(null); });
  for (const [id, R] of Object.entries(ROOMS)) {
    await p.evaluate(id => { const e = document.getElementById('rb-' + id) || document.getElementById('ml-' + id); e.click(); }, id);
    await p.evaluate(() => { window.__AI.simulate(1.4); window.__AI.renderFrame(); });
    await p.evaluate(([id, R]) => {
      const A = window.__AI, THREE_ = A.camera.constructor; const cam = A.camera;
      // undo the side-panel offset (move the camera back to the room's centre line) and frame the room in the window
      const right = { x: cam.matrixWorld.elements[0], y: cam.matrixWorld.elements[1], z: cam.matrixWorld.elements[2] };
      const fwd = { x: -cam.matrixWorld.elements[8], y: -cam.matrixWorld.elements[9], z: -cam.matrixWorld.elements[10] };
      const k = -8.5, back = -3;
      cam.position.x += right.x * k + fwd.x * back; cam.position.y += right.y * k + fwd.y * back + 0.6; cam.position.z += right.z * k + fwd.z * back;
      for (const s of ['scr-moon', 'moon-labels', 'tut', 'comm', 'hint', 'pops']) { const e = document.getElementById(s); if (e) e.style.display = 'none'; }
      let ov = document.getElementById('ref-ui'); if (ov) ov.remove();
      ov = document.createElement('div'); ov.id = 'ref-ui'; document.body.appendChild(ov);
      const wallet = ['humans', 'biomass', 'metal'].map(r => `<div class="rrow ${r}"><svg class="ico"><use href="#i-${r}"/></svg><span>${r[0].toUpperCase() + r.slice(1)}</span><b>${A.G.save.res[r]}</b></div>`).join('');
      const btn = (cls, x, y, w, h, inner, extra = '') => `<button class="btn ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}">${inner}</button>`;
      const two = (a, b2) => `<span class="t">${a}</span><small>${b2}</small>`;
      ov.innerHTML = `
        <style>
          #ref-ui { position: fixed; inset: 0; z-index: 90; pointer-events: none; font-family: var(--font-ui); }
          #ref-ui .frame { position: absolute; left: 54px; top: 60px; width: 1159px; height: 584px; border-radius: 26px;
            box-shadow: 0 0 0 4px #1a1033, 0 0 0 9px #6a3fe0, 0 0 0 12px #1a1033, 0 0 0 2000px #241552, inset 0 0 40px rgba(156,255,63,.35), inset 0 0 0 2px rgba(156,255,63,.6); }
          #ref-ui .bezel-shine { position: absolute; inset: 0; background:
            radial-gradient(circle at 18px 18px, #8f7dff 2.5px, transparent 3.5px) 0 0 / 46px 46px,
            linear-gradient(180deg, rgba(255,255,255,.05), transparent 30%); -webkit-mask: linear-gradient(#000,#000); }
          #ref-ui .corner { position: absolute; width: 30px; height: 30px; border: 4px solid #9cff3f; filter: drop-shadow(0 0 6px #9cff3f); }
          #ref-ui .scan { position: absolute; left: 54px; top: 60px; width: 1159px; height: 584px; border-radius: 26px; overflow: hidden; }
          #ref-ui .scan::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(156,255,63,.035) 0 2px, transparent 2px 5px); }
          #ref-ui .btn { position: absolute; pointer-events: auto; display: grid; place-items: center; align-content: center; gap: 2px; padding: 4px 10px; box-sizing: border-box; text-align: center; line-height: 1.05; }
          #ref-ui .btn .t { font: 19px/1 var(--font-display); letter-spacing: .02em; } #ref-ui .btn small { font: 700 12px/1.1 var(--font-ui); opacity: .85; }
          #ref-ui .plate { position: absolute; left: 32px; top: 34px; width: 242px; height: 70px; display: grid; grid-template-columns: 56px 1fr; align-items: center; box-sizing: border-box;
            border: 3px solid #1a1033; border-radius: 16px; background: #2b1b72; box-shadow: 0 5px 0 #1a1033; overflow: hidden; }
          #ref-ui .plate .back { height: 100%; display: grid; place-items: center; background: #ffd23f; border-right: 3px solid #1a1033; font: 28px/1 var(--font-display); color: #1a1033; }
          #ref-ui .plate .nm { padding: 0 12px; } #ref-ui .plate b { display: block; font: 22px/1 var(--font-display); color: #ffd23f; text-shadow: 0 2px 0 #1a1033; }
          #ref-ui .plate small { font: 600 11.5px/1.2 var(--font-ui); color: #e2d2ff; }
          #ref-ui .res { position: absolute; left: 1040px; top: 34px; width: 195px; height: 193px; box-sizing: border-box; padding: 10px 12px; display: grid; gap: 6px; align-content: start;
            border: 3px solid #1a1033; border-radius: 16px; background: #2b1b72; box-shadow: 0 5px 0 #1a1033; color: #fff; }
          #ref-ui .res .hd { display: flex; justify-content: space-between; font: 15px/1 var(--font-display); color: #e2d2ff; letter-spacing: .03em; }
          #ref-ui .rrow { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 10px; background: #1b1150; border: 2px solid #1a1033; font: 600 12.5px/1 var(--font-ui); }
          #ref-ui .rrow b { font: 20px/1 var(--font-display); } #ref-ui .rrow .ico { width: 22px; height: 22px; }
          #ref-ui .rrow.humans b { color: #ffb38a; } #ref-ui .rrow.biomass b { color: #c6f04a; } #ref-ui .rrow.metal b { color: #7fd6ff; }
          #ref-ui .status { position: absolute; left: 1040px; top: 474px; width: 195px; height: 70px; box-sizing: border-box; padding: 8px 12px; border: 3px solid #1a1033; border-radius: 16px; background: #1b1150; box-shadow: 0 5px 0 #1a1033; color: #fff; }
          #ref-ui .status small { display: block; font: 700 11px/1 var(--font-ui); color: #4ff0d0; letter-spacing: .06em; text-transform: uppercase; }
          #ref-ui .status b { display: block; font: 17px/1.2 var(--font-display); margin-top: 3px; }
          #ref-ui .status i { display: block; height: 8px; margin-top: 4px; border-radius: 4px; border: 2px solid #1a1033; background: linear-gradient(90deg, #9cff3f 72%, #2b1b72 72%); }
          #ref-ui .tag { position: absolute; padding: 2px 8px; border-radius: 6px; background: #ff5a4f; color: #fff; font: 700 11px/1.3 var(--font-ui); border: 2px solid #1a1033; }
          #ref-ui .tip { position: absolute; left: 330px; top: 34px; width: 520px; padding: 8px 14px; box-sizing: border-box; border-radius: 14px; background: rgba(15,8,40,.72); border: 2px solid rgba(156,255,63,.5); color: #eaffd0; font: 600 13px/1.35 var(--font-ui); }
        </style>
        <div class="frame"></div><div class="scan"></div>
        <i class="corner" style="left:46px;top:52px;border-right:0;border-bottom:0;border-top-left-radius:24px"></i><i class="corner" style="left:1191px;top:52px;border-left:0;border-bottom:0;border-top-right-radius:24px"></i>
        <i class="corner" style="left:46px;top:622px;border-right:0;border-top:0;border-bottom-left-radius:24px"></i><i class="corner" style="left:1191px;top:622px;border-left:0;border-top:0;border-bottom-right-radius:24px"></i>
        <div class="plate"><div class="back">◀</div><div class="nm"><b>${R.name}</b><small>${R.sub}</small></div></div>
        <div class="tip">💡 ${R.tip}</div>
        <div class="res"><div class="hd"><span>RESOURCES</span><span>DAY ${A.G.save.day}</span></div>${wallet}</div>
        ${btn('', 32, 331, 146, 70, two('🌙 MOON MAP', 'all rooms'))}
        ${btn('', 32, 421, 146, 70, two('◀ ▶ ROOMS', 'next / previous'))}
        ${btn('', 1088, 352, 146, 70, two('ⓘ INFO', 'how it works'))}
        <div class="status"><small>${R.status[0]}</small><b>${R.status[1]}</b><i></i></div>
        ${btn('slime', 32, 588, 263, 70, two(R.main[0], R.main[1]), 'font-size:20px')}
        ${btn(R.b1[2], 396, 588, 146, 70, two(R.b1[0], R.b1[1]))}
        ${btn(R.b2[2], 566, 588, 146, 70, two(R.b2[0], R.b2[1]))}
        ${btn('primary', 1040, 588, 195, 70, two('🌍 TO EARTH', 'pick a target'))}
        ${btn('', 1088 - 0, 352 + 92 - 92, 0, 0, '', 'display:none')}`;
      A.simulate(0.05); A.renderFrame();
    }, [id, R]);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${process.argv[2]}/ref_${id}.png`, timeout: 120000 });
  }
  console.log('errors', errs.slice(0, 3)); await b.close();
})();
