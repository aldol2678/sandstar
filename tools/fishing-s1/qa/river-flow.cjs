// Fishing QA (local preview only): the dedicated fishing ground fishing_01 on the real default build.
// Flow: new player → 잔빛숲 chop for wood → back to town → '낚시터 입구' gate → walk to spots A/B/C → fish →
// walk to the exit → town. Inputs are ordinary: arrow keys / E on PC, the action button on mobile, taps on the
// water canvas to cast, press-and-hold on the big button to reel. __sandstarRiver.state() and
// __sandstarFishingWorld.state() are read only (the bot reads positions/phases the way a player reads the screen).
// Long walks on mobile use the worlds' own position hooks (setTestPosition / testMove), as the farm QA does.
// Usage: node river-flow.cjs <default-build-url> <outdir> <pc|m390>
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, continueWorld, log } = require('../../farm-cooking-b/qa/lib.cjs');

const [url, out, mode] = [process.argv[2] || 'http://127.0.0.1:8790/', process.argv[3] || '.', process.argv[4] || 'pc'];
const mobile = mode === 'm390';
fs.mkdirSync(out, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; log(lines, `${ok ? 'PASS' : 'FAIL'} ${mode}: ${name}${detail ? ' — ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const travelDone = (page, world) => page.waitForFunction(w => window.__sandstarWorldLoadingM25B.ready(w) && !window.__sandstarWorldLoadingM25B.state().busy, world, { timeout: 30000 });

(async () => {
  const { browser, page, problems } = await openGame({ url, mobile });
  const rs = () => page.evaluate(() => window.__sandstarRiver.state());
  const fw = () => page.evaluate(() => window.__sandstarFishingWorld.state());
  const living = () => page.evaluate(() => window.__SANDSTAR_LIVING_P11__.getState());
  const shot = name => page.screenshot({ path: path.join(out, `${mode}-${name}.png`) });
  const press = sel => (mobile ? page.tap(sel) : page.click(sel));
  async function holdBtn(on) {
    const b = await page.locator('#riverHold').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    if (on) await page.mouse.down(); else await page.mouse.up();
  }
  async function tapWater(x, y) {
    const c = await page.locator('#riverCanvas').boundingBox();
    if (mobile) await page.touchscreen.tap(c.x + x, c.y + y); else await page.mouse.click(c.x + x, c.y + y);
  }
  async function standAt(x) {
    await page.evaluate(x => { const y = window.__sandstarTownM22.surface(Math.floor(x)); window.__sandstarHUDM15.setTestPosition(x, y - 1); }, x);
    await wait(300);
  }
  async function ensureLifeMode() {
    const h = await page.evaluate(() => window.__sandstarHUDM15.get());
    if (h.manualMining) { await page.evaluate(() => window.__sandstarHUDM15.toggleTool()); await wait(250); }
  }
  async function forestAction() { if (mobile) await page.tap('#m1ActionBtn'); else await page.keyboard.press('e'); await wait(500); }
  async function toForest() {
    await page.evaluate(() => window.__sandstarTown25D.move(15, 11)); await wait(200);
    await page.click('#town25dAction'); await travelDone(page, 'life_forest_01'); await wait(600);
  }
  async function forestToTown() { await standAt(22.5); await forestAction(); await travelDone(page, 'village_hub_01'); await wait(500); }
  async function townToFishing() {
    await page.evaluate(() => window.__sandstarTown25D.move(18, -0.5)); await wait(250);
    const label = (await page.textContent('#town25dAction')).trim();
    await press('#town25dAction'); await travelDone(page, 'fishing_01'); await wait(500);
    return label;
  }
  // PC walks with arrow keys along waypoints; mobile uses the world's own position hook.
  async function walk(points) {
    if (mobile) { const [x, y] = points[points.length - 1]; return page.evaluate(([x, y]) => window.__sandstarFishingWorld.testMove(x, y), [x, y]); }
    for (const [tx, ty] of points) {
      let ok = false;
      for (let i = 0; i < 140; i++) {
        const p = (await fw()).player, dx = tx - p.x, dy = ty - p.y;
        if (Math.abs(dx) <= .3 && Math.abs(dy) <= .3) { ok = true; break; }
        // the 3D camera rotates the stick/arrow basis: convert the wanted map delta to screen input
        const st = await fw(); let ix = dx, iy = dy;
        if (st.renderer === 'three') { const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw); ix = dx * cy - dy * sy; iy = dx * sy + dy * cy; }
        const m = Math.max(Math.abs(ix), Math.abs(iy)) || 1, keys = [];
        if (Math.abs(ix) / m > .38) keys.push(ix > 0 ? 'ArrowRight' : 'ArrowLeft');
        if (Math.abs(iy) / m > .38) keys.push(iy > 0 ? 'ArrowDown' : 'ArrowUp');
        for (const k of keys) await page.keyboard.down(k);
        await wait(Math.max(30, Math.min(300, Math.hypot(dx, dy) * 160)));
        for (const k of keys) await page.keyboard.up(k);
      }
      if (!ok) return false;
    }
    return true;
  }
  const ROUTES = { A: [[8, 11], [8, 15.2], [12.6, 15.2]], B: [[12.4, 11], [12.4, 8], [19.2, 8]], C: [[12.6, 15.2], [12.6, 19.7], [22.6, 19.7]], gate: [[12.4, 11], [2.8, 11]] };
  async function worldAction() { if (mobile) await page.tap('#fishWorldAction'); else await page.keyboard.press('e'); await wait(400); }
  async function openSpot(id, route) {
    const walked = await walk(route || ROUTES[id]);
    const st = await fw();
    if (st.nearSpot !== id) return { ok: false, walked, st };
    const label = st.action;
    await worldAction();
    return { ok: (await rs()).open, label, walked };
  }
  async function closeView() { const st = await rs(); if (st.open) { await press('#riverExit'); await wait(300); } }
  // ----- one full fish: lure the chosen shadow with that species' pattern, hook, fight by phase
  async function catchOne(species, opts = {}) {
    let s = await rs();
    let target = s.fish.filter(f => f.species === species && f.state !== 'leave').sort((a, b) => b.x - a.x)[0];
    for (let i = 0; !target && i < 40; i++) { await wait(500); s = await rs(); target = s.fish.find(f => f.species === species && f.state !== 'leave'); }
    if (!target) return { ok: false, why: 'no ' + species + ' shadow', fish: s.fish.map(f => f.species) };
    const W = s.W, surf = s.surface;
    const castX = species === 'perch' ? target.x + target.dir * W * .16 : species === 'carp' ? target.x + 30 : target.x + 50;
    await tapWater(Math.max(W * .22, Math.min(W * .93, castX)), surf + 25);
    await wait(250);
    s = await rs();
    if (s.phase !== 'lure') return { ok: false, why: 'cast did not land', phase: s.phase };
    const t0 = Date.now(); let pattern = 0;
    while (Date.now() - t0 < 45000) {
      s = await rs();
      if (s.phase === 'bite') break;
      if (s.phase === 'idle') { // lure came back: recast at the target again
        const tg = s.fish.find(f => f.id === target.id) || s.fish.find(f => f.species === species && f.state !== 'leave');
        if (!tg) { await wait(400); continue; }
        target = tg; await tapWater(Math.max(W * .22, Math.min(W * .93, species === 'perch' ? tg.x + tg.dir * W * .16 : tg.x + 40)), surf + 25); await wait(200); continue;
      }
      if (species === 'river_fish') { await holdBtn(true); await wait(320); await holdBtn(false); await wait(650); }
      else if (species === 'perch') {
        const tg = s.fish.find(f => f.id === target.id);
        if (tg && s.lure && (s.lure.x - tg.x) * tg.dir > 0 && Math.abs(s.lure.y - tg.y) < s.H * .25) { await holdBtn(true); await wait(950); await holdBtn(false); await wait(150); }
        else await wait(250);
      } else await wait(400); // carp: quiet drift, no input
      pattern++;
    }
    if (s.phase !== 'bite') return { ok: false, why: 'no bite in 45s', fish: s.fish };
    const biteShot = opts.shots ? shot(`bite-${species}`) : null; await biteShot;
    await holdBtn(true); await holdBtn(false); // tap = hook
    await wait(150);
    s = await rs();
    if (s.phase !== 'fight') return { ok: false, why: 'hook failed', phase: s.phase };
    if (opts.beforeFight) await opts.beforeFight();
    const f0 = Date.now(); let held = false, shotTaken = false;
    while (Date.now() - f0 < 60000) {
      s = await rs();
      if (s.phase !== 'fight' || s.card) break;
      const open = (s.fight.phase === 'gap' || s.fight.phase === 'loose') && !s.fight.stall;
      if (open && !held) { await holdBtn(true); held = true; }
      if (!open && held) { await holdBtn(false); held = false; }
      if (opts.shots && !shotTaken && s.fight.progress > 40) { shotTaken = true; await shot(`fight-${species}`); }
      if (opts.stopAt && s.fight.progress >= opts.stopAt) { if (held) await holdBtn(false); return { ok: true, stopped: true, progress: s.fight.progress }; }
      await wait(60);
    }
    if (held) await holdBtn(false);
    await wait(250);
    s = await rs();
    return { ok: s.phase === 'result', result: s.result, phase: s.phase, card: s.card, saved: s.saved };
  }

  // ===== new player → forest wood → town → fishing ground
  await newWorld(page, '515151');
  await toForest();
  await ensureLifeMode();
  await standAt(82.5); await forestAction();
  const wood = await page.evaluate(() => window.__SANDSTAR_LIVING_P11__ && JSON.parse(localStorage.getItem(window.__SANDSTAR_LIVING_P11__.getSaveKey())).inv.wood);
  check('chop in 잔빛숲 for rod wood', wood >= 3, `wood=${wood}`);
  await forestToTown();
  check('back in the town', (await page.evaluate(() => window.__sandstarM1.state().region)) === 'village_hub_01');
  const gateLabel = await townToFishing();
  let w = await fw();
  check('town 낚시터 입구 opens the fishing ground (fishing_01)', /낚시터로 이동/.test(gateLabel) && w.active && w.worldId === 'fishing_01' && w.saved.activeWorldId === 'fishing_01', `${gateLabel} · ${JSON.stringify({ active: w.active, saved: w.saved })}`);
  await shot('world-arrive');

  // ===== spot A: rod, locked spot, weeds
  let o = await openSpot('A');
  check('walk to spot A and open the fishing view there', o.ok && /A 완만한 강가에서 낚시/.test(o.label), JSON.stringify(o));
  let s = await rs();
  check('no rod → rod card, crafting works inside the fishing ground', s.card === 'rod', s.card);
  await shot('rod-card');
  await press('#riverCard button[data-river="craft"]'); await wait(300);
  s = await rs();
  const lv0 = await living();
  check('rod crafted once (3 wood), card closes', lv0.rod === true && s.card === null);
  const locked = await page.evaluate(() => [...document.querySelectorAll('#riverSpots button')].map(b => b.dataset.spot + (b.disabled ? '-' : '+')).join(''));
  check('view is locked to the spot you walked to (A on, B/C off)', s.spot === 'A' && locked === 'A+B-C-', locked);
  const coins0 = await page.evaluate(() => window.__sandstarTitleP0.state().worldCoins);
  await tapWater(s.W * .25, s.surface + 20); await wait(200);
  const sA = await rs();
  check('cast into weeds snaps to nearest valid water (no cost)', sA.phase === 'lure' && sA.lure.x >= s.W * .31 - 12 && /수초·바위를 피해/.test(sA.hint), `lure x=${sA.lure && sA.lure.x.toFixed(1)} · ${sA.hint}`);
  await press('#riverRetrieve'); await wait(200);
  await shot('spot-A');

  // ===== three species at their physical spots
  const plan = [['A', 'river_fish', null], ['C', 'perch', ROUTES.C], ['B', 'carp', [[12.6, 15.2], [12.4, 11], [12.4, 8], [19.2, 8]]]];
  for (const [sp, species, route] of plan) {
    if (sp !== 'A') { await closeView(); o = await openSpot(sp, route); check(`walk to spot ${sp} and open`, o.ok && (await rs()).spot === sp, JSON.stringify(o).slice(0, 200)); if (sp === 'C') await shot('spot-C'); }
    let r = null;
    for (let tries = 0; tries < 4 && !(r && r.ok); tries++) {
      if (r) { const cur = await rs(); if (cur.phase === 'lure') await press('#riverRetrieve'); if (cur.phase === 'result') await press('#riverCard button[data-river="again"]'); await wait(300); }
      r = await catchOne(species, { shots: true });
    }
    check(`catch ${species} at ${sp} with its own pattern`, r.ok && r.result.fish === species, JSON.stringify(r).slice(0, 220));
    if (r.ok) { await shot(`result-${species}`); await press('#riverCard button[data-river="again"]'); await wait(250); }
  }
  const lv1 = await living();
  const coins1 = await page.evaluate(() => window.__sandstarTitleP0.state().worldCoins);
  check('bag +1 each, dex 3/3, fished 3, best sizes and spot counts saved', lv1.bag.river_fish === 1 && lv1.bag.perch === 1 && lv1.bag.carp === 1 && lv1.fishDex.length === 3 && lv1.stats.fished === 3 && Object.values(lv1.river.best).every(v => v > 0) && lv1.river.spots.A >= 1 && lv1.river.spots.B >= 1 && lv1.river.spots.C >= 1, JSON.stringify({ bag: lv1.bag, best: lv1.river.best, spots: lv1.river.spots }));
  check('catching does not pay coins (sale happens at the market)', Number.isFinite(coins0) && coins0 === coins1, `${coins0} → ${coins1}`);

  // ===== fight rules (at B)
  let probe = {};
  const anySpecies = async () => { const st = await rs(); return (st.fish.find(f => f.species === 'river_fish') || st.fish[0]).species; };
  const r1 = await catchOne(await anySpecies(), {
    stopAt: 1, beforeFight: async () => {
      const a = (await rs()).fight.progress; await wait(5000); const b = (await rs()).fight.progress;
      probe.idle = { a, b };
      await holdBtn(true); let stalled = false, before = null;
      for (let i = 0; i < 120; i++) { const st = await rs(); if (st.fight.stall) { stalled = true; before = st.fight.progress; break; } await wait(60); }
      let after = before; if (stalled) { await wait(900); after = (await rs()).fight.progress; }
      await holdBtn(false);
      const relA = (await rs()).fight.progress; await wait(1500); const relB = (await rs()).fight.progress;
      probe.hold = { stalled, before, after }; probe.release = { relA, relB };
    }
  });
  check('fight: 5s with no input → no progress', probe.idle && probe.idle.a === probe.idle.b, JSON.stringify(probe.idle));
  check('fight: holding nonstop ends in a stall with no progress', probe.hold && probe.hold.stalled && probe.hold.after === probe.hold.before, JSON.stringify(probe.hold));
  check('fight: releasing never lowers progress', probe.release && probe.release.relB >= probe.release.relA, JSON.stringify(probe.release));

  // ===== mid-fight persistence: reload restores the fishing ground and the same fish
  let s2 = await rs();
  if (s2.phase !== 'fight') check('mid-fight test reached a fight', false, JSON.stringify(r1).slice(0, 200));
  for (let i = 0; i < 400; i++) { const st = await rs(); if (st.fight.progress >= 30) break; const open = (st.fight.phase === 'gap' || st.fight.phase === 'loose') && !st.fight.stall; await holdBtn(open); await wait(60); }
  await holdBtn(false);
  s2 = await rs();
  const savedAttempt = s2.saved.attempt;
  check('attempt saved with progress ≥25% before reload', savedAttempt && savedAttempt.progress >= 25 && savedAttempt.spot === 'B', JSON.stringify(savedAttempt));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await continueWorld(page); await wait(2500);
  w = await fw();
  check('continue restores the fishing ground, standing at spot B', w.active && w.nearSpot === 'B' && /이어서 낚시/.test(w.action), JSON.stringify({ active: w.active, near: w.nearSpot, action: w.action }));
  await shot('world-resume');
  const wrong = await openSpot('A', [[19.2, 8], [12.4, 8], [12.4, 11], [8, 11], [8, 15.2], [12.6, 15.2]]);
  check('the hooked fish stays at its spot (A does not open it)', !wrong.ok, JSON.stringify(wrong).slice(0, 160));
  o = await openSpot('B', [[8, 15.2], [8, 11], [12.4, 11], [12.4, 8], [19.2, 8]]);
  s2 = await rs();
  check('back at B: same fish restored paused with resume card', o.ok && s2.card === 'resume' && s2.paused && s2.saved.attempt.id === savedAttempt.id && s2.saved.attempt.size === savedAttempt.size && s2.fight.progress >= savedAttempt.progress, JSON.stringify({ o, card: s2.card, fight: s2.fight }).slice(0, 260));
  await shot('resume-card');
  await press('#riverCard button[data-river="resume"]'); await wait(1100);
  const fishedBefore = (await living()).stats.fished;
  for (let i = 0; i < 800; i++) { const st = await rs(); if (st.phase !== 'fight') break; const open = (st.fight.phase === 'gap' || st.fight.phase === 'loose') && !st.fight.stall; await holdBtn(open); await wait(60); }
  await holdBtn(false); await wait(250);
  const lv2 = await living(); s2 = await rs();
  check('restored fish lands exactly once', s2.phase === 'result' && lv2.stats.fished === fishedBefore + 1 && lv2.river.attempt === null && lv2.river.done.includes(savedAttempt.id), JSON.stringify({ phase: s2.phase, fished: lv2.stats.fished }));
  const dup = await page.evaluate(id => { const L = window.__SANDSTAR_LIVING_P11__, st = L.getState(); st.river.attempt = null; return L.applyPure(st, { id: 'river-river-catch-' + id, type: 'river.catch', target: 'pond', attempt: id }, { x: 64, y: 77, groundY: 77, inv: {}, coins: 0 }); }, savedAttempt.id);
  check('replaying the same catch is rejected', dup.ok === false, dup.reason);

  // ===== pause on hide, layout, close
  await press('#riverCard button[data-river="again"]'); await wait(200);
  await tapWater((await rs()).W * .7, (await rs()).surface + 20); await wait(200);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(200);
  const ps = await rs();
  await page.evaluate(() => { delete document.hidden; });
  check('tab hide pauses the cast (pause card)', ps.paused && ps.card === 'pause', JSON.stringify({ paused: ps.paused, card: ps.card }));
  await press('#riverCard button[data-river="resume"]'); await wait(1000);
  check('resume continues after a short ready', !(await rs()).paused);
  const layout = await page.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { vh: innerHeight, vw: innerWidth, hold: r('riverHold'), stage: r('riverCanvas'), exit: r('riverExit'), pause: r('riverPause') }; });
  const inView = b => b.top >= 0 && b.bottom <= layout.vh + 0.5 && b.left >= 0 && b.right <= layout.vw + 0.5;
  check('layout: canvas + hold button + exit/pause inside the viewport, touch targets ≥44px', inView(layout.hold) && inView(layout.stage) && inView(layout.exit) && layout.hold.height >= 44 && layout.exit.height >= 44 && layout.pause.height >= 44, JSON.stringify({ vh: layout.vh, hold: [layout.hold.top, layout.hold.bottom] }));
  await press('#riverRetrieve').catch(() => {}); await wait(150);
  await press('#riverExit'); await wait(300);
  check('closing the view returns to the fishing ground', !(await page.evaluate(() => window.__sandstarRiver.isOpen())) && (await fw()).active);
  const c0 = (await living()).clock; await wait(3000); const c1 = (await living()).clock;
  check('life clock runs once in the fishing ground (≈3s per 3s)', c1 - c0 > 2.5 && c1 - c0 < 3.6, `+${(c1 - c0).toFixed(2)}s`);
  const hud = await page.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { vh: innerHeight, vw: innerWidth, act: r('fishWorldAction'), pad: r('fishDpad') }; });
  check('fishing ground HUD (action + move pad) inside the viewport', hud.act.bottom <= hud.vh && hud.act.right <= hud.vw && hud.pad.bottom <= hud.vh && hud.act.height >= 44, JSON.stringify({ vh: hud.vh, act: [hud.act.top, hud.act.bottom] }));

  // ===== exit to town through the west gate
  await walk([[19.2, 8], [12.4, 8], [12.4, 11], [2.8, 11]]);
  w = await fw();
  check('west gate offers the way back', w.nearGate && /마을로 돌아가기/.test(w.action), w.action);
  await worldAction();
  await travelDone(page, 'village_hub_01'); await wait(500);
  const back = await page.evaluate(() => ({ region: window.__sandstarM1.state().region, town: window.__sandstarTown25D.state().position, fish: window.__sandstarFishingWorld.state() }));
  check('exit lands in town by the fishing gate, saved as town', back.region === 'village_hub_01' && !back.fish.active && Math.hypot(back.town.x - 18, back.town.z + 0.6) < 1.5 && back.fish.saved.activeWorldId === 'village_hub_01', JSON.stringify({ region: back.region, town: back.town, saved: back.fish.saved }));

  // ===== legacy save: old in-progress m17 fishing + dex without sizes
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await page.evaluate(() => { const k = window.__SANDSTAR_LIVING_P11__.getSaveKey(), g = JSON.parse(localStorage.getItem(k)); delete g.livingP0.river; g.livingP0.fishing = { id: 'perch', progress: 40, tension: 30, round: 2 }; g.livingP0.fishDex = ['river_fish']; g.livingP0.bag.perch = 0; localStorage.setItem(k, JSON.stringify(g)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await continueWorld(page); await wait(2500);
  await townToFishing();
  o = await openSpot('A');
  s = await rs();
  check('legacy save: old hooked fish offered as "이어서 끌어올리기"', o.ok && s.card === 'legacy', s.card + ' ' + JSON.stringify((await living()).fishing));
  check('legacy save: river state created fresh, old dex shown as 크기 미기록', s.saved && s.saved.best.river_fish === 0 && /크기 미기록/.test(await page.textContent('#riverDex')));
  await press('#riverCard button[data-river="legacy"]'); await wait(300);
  s = await rs();
  check('legacy fish continues at its old progress', s.phase === 'fight' && s.fight.fish === 'perch' && s.fight.progress >= 40, JSON.stringify(s.fight));
  for (let i = 0; i < 800; i++) { const st = await rs(); if (st.phase !== 'fight') break; const open = (st.fight.phase === 'gap' || st.fight.phase === 'loose') && !st.fight.stall; await holdBtn(open); await wait(60); }
  await holdBtn(false); await wait(250);
  const lv3 = await living();
  check('legacy fish lands, old fishing field cleared', lv3.fishing === null && lv3.bag.perch === 1 && lv3.fishDex.includes('perch'), JSON.stringify({ fishing: lv3.fishing, bag: lv3.bag.perch }));
  await press('#riverExit'); await wait(200);

  const real = problems.filter(p => !/vibrate|favicon/i.test(p));
  check('no page errors / console errors', real.length === 0, real.slice(0, 5).join(' | '));
  fs.writeFileSync(path.join(out, `river-${mode}.log`), lines.join('\n') + `\n${pass} pass, ${fail} fail\n`);
  log(lines, `${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
