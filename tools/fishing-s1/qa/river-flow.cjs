// Fishing S1 QA (local preview only): 잔빛숲 강변 one-bank vertical slice on the real default build.
// Inputs are ordinary: keyboard E / action button to open, taps on the water canvas to cast, press-and-hold on
// the big button to reel. __sandstarRiver.state() is read only (the bot reads fish positions/phases the way a
// player reads the screen). Long walks use the base game's own __sandstarHUDM15.setTestPosition hook.
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
  async function toForest() {
    await page.evaluate(() => window.__sandstarTown25D.move(15, 11));
    await wait(200);
    await page.click('#town25dAction');
    await travelDone(page, 'life_forest_01');
    await wait(600);
  }
  async function standAt(x) {
    await page.evaluate(x => { const y = window.__sandstarTownM22.surface(Math.floor(x)); window.__sandstarHUDM15.setTestPosition(x, y - 1); }, x);
    await wait(300);
  }
  async function ensureLifeMode() {
    const h = await page.evaluate(() => window.__sandstarHUDM15.get());
    if (h.manualMining) { await page.evaluate(() => window.__sandstarHUDM15.toggleTool()); await wait(250); }
  }
  async function openByAction() {
    if (mobile) await page.tap('#m1ActionBtn'); else await page.keyboard.press('e');
    await wait(400);
    return (await rs()).open;
  }
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

  // ===== world: new player → forest → chop for wood → riverbank
  await newWorld(page, '515151');
  await toForest();
  check('arrive in 잔빛숲', (await page.evaluate(() => window.__sandstarM1.state().region)) === 'life_forest_01');
  await ensureLifeMode();
  await standAt(82.5);
  if (mobile) await page.tap('#m1ActionBtn'); else await page.keyboard.press('e');
  await wait(500);
  const wood = await page.evaluate(() => window.__sandstarTitleP0?.state?.().inv?.wood ?? null);
  await standAt(57.5);
  // PC: walk the last stretch with the real arrow key; mobile: position hook
  if (!mobile) { await page.keyboard.down('ArrowRight'); for (let i = 0; i < 40; i++) { await wait(60); if (await page.evaluate(() => window.__sandstarM17.get().nearby === 'pond')) break; } await page.keyboard.up('ArrowRight'); await wait(200); }
  else await standAt(63.5);
  const m17 = await page.evaluate(() => window.__sandstarM17.get());
  const label = await page.evaluate(() => (document.getElementById('m1ActionBtn')?.textContent || '').trim());
  check('riverbank is an action spot again (nearby=pond, label)', m17.nearby === 'pond' && /낚싯대 준비|강변 낚시/.test(label), `${m17.nearby} · ${label} · wood=${wood}`);
  await shot('world-riverbank');
  check('open the riverbank view with E / action button', await openByAction());
  let s = await rs();
  check('no rod → rod card (원목 3), no fishing yet', s.card === 'rod', JSON.stringify({ card: s.card }));
  await shot('rod-card');
  await press('#riverCard button[data-river="craft"]');
  await wait(300);
  s = await rs();
  const lv0 = await living();
  check('craft rod spends 3 wood once, card closes', lv0.rod === true && s.card === null, `rod=${lv0.rod}`);
  const coins0 = await page.evaluate(() => window.__sandstarTitleP0?.state?.().coins ?? null);

  // ===== spots: A/B/C change the water, not a species lock
  const spotFish = {};
  for (const sp of ['A', 'C', 'B']) {
    await press(`#riverSpots button[data-spot="${sp}"]`);
    await wait(250);
    s = await rs();
    spotFish[sp] = s.fish.map(f => f.species[0] + Math.round(f.size / 10));
    if (sp !== 'B') await shot(`spot-${sp}`);
  }
  check('spot buttons switch A/C/B and repopulate shadows', s.spot === 'B' && Object.values(spotFish).every(a => a.length >= 3), JSON.stringify(spotFish));
  await shot('spot-B-idle');

  // invalid zone: tap the A weeds → lands on the nearest valid water
  await press('#riverSpots button[data-spot="A"]'); await wait(200);
  s = await rs();
  await tapWater(s.W * .25, s.surface + 20); await wait(200);
  const sA = await rs();
  check('cast into weeds snaps to nearest valid water (no cost)', sA.phase === 'lure' && sA.lure.x >= s.W * .31 - 12 && /수초·바위를 피해/.test(sA.hint), `lure x=${sA.lure && sA.lure.x.toFixed(1)} W=${s.W} · ${sA.hint}`);
  await press('#riverRetrieve'); await wait(200);
  check('retrieve returns to idle', (await rs()).phase === 'idle');

  // ===== three species with their own patterns
  const caught = {};
  const plan = [['A', 'river_fish'], ['C', 'perch'], ['B', 'carp']];
  for (const [sp, species] of plan) {
    await press(`#riverSpots button[data-spot="${sp}"]`); await wait(250);
    let r = null;
    for (let tries = 0; tries < 4 && !(r && r.ok); tries++) {
      if (r) { const cur = await rs(); if (cur.phase === 'lure') await press('#riverRetrieve'); await press(`#riverSpots button[data-spot="${sp}"]`); await wait(300); }
      r = await catchOne(species, { shots: true });
    }
    caught[species] = r;
    check(`catch ${species} at ${sp} with its own pattern`, r.ok && r.result.fish === species, JSON.stringify(r).slice(0, 260));
    if (r.ok) { await shot(`result-${species}`); await press('#riverCard button[data-river="again"]'); await wait(250); }
  }
  const lv1 = await living();
  const coins1 = await page.evaluate(() => window.__sandstarTitleP0?.state?.().coins ?? null);
  check('bag +1 each, dex 3/3, fished 3, best sizes saved', lv1.bag.river_fish === 1 && lv1.bag.perch === 1 && lv1.bag.carp === 1 && lv1.fishDex.length === 3 && lv1.stats.fished === 3 && Object.values(lv1.river.best).every(v => v > 0), JSON.stringify({ bag: lv1.bag, dex: lv1.fishDex, best: lv1.river.best }));
  check('catching does not pay coins (sale happens at the market)', coins0 === coins1, `${coins0} → ${coins1}`);

  // ===== fight rules: no input never lands, holding through stalls, release keeps progress
  await press('#riverSpots button[data-spot="B"]'); await wait(250);
  let probe = {};
  const anySpecies = async () => { const st = await rs(); return (st.fish.find(f => f.species === 'river_fish') || st.fish[0]).species; };
  const sp1 = await anySpecies();
  const r1 = await catchOne(sp1, {
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
  log(lines, 'probe fight', JSON.stringify(r1).slice(0, 300), JSON.stringify(probe));
  check('fight: 5s with no input → no progress', probe.idle && probe.idle.a === probe.idle.b, JSON.stringify(probe.idle));
  check('fight: holding nonstop ends in a stall with no progress', probe.hold && probe.hold.stalled && probe.hold.after === probe.hold.before, JSON.stringify(probe.hold));
  check('fight: releasing never lowers progress', probe.release && probe.release.relB >= probe.release.relA, JSON.stringify(probe.release));

  // ===== mid-fight persistence: progress saved, reload restores the same fish paused
  let s2 = await rs();
  if (s2.phase !== 'fight') check('mid-fight test reached a fight', false, JSON.stringify(r1).slice(0, 200));
  for (let i = 0; i < 400; i++) { const st = await rs(); if (st.fight.progress >= 30) break; const open = (st.fight.phase === 'gap' || st.fight.phase === 'loose') && !st.fight.stall; await holdBtn(open); await wait(60); }
  await holdBtn(false);
  s2 = await rs();
  const savedAttempt = s2.saved.attempt;
  check('attempt saved with progress ≥25% before reload', savedAttempt && savedAttempt.progress >= 25, JSON.stringify(savedAttempt));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await continueWorld(page);
  await wait(2500);
  const region2 = await page.evaluate(() => window.__sandstarM1.state().region);
  if (region2 !== 'life_forest_01') await toForest();
  await ensureLifeMode();
  await standAt(63.5);
  const label2 = await page.evaluate(() => (document.getElementById('m1ActionBtn')?.textContent || '').trim());
  check('after reload the bank offers "이어하기"', /이어하기/.test(label2), label2);
  await openByAction();
  s2 = await rs();
  check('reload restores the same hooked fish, paused with resume card', s2.card === 'resume' && s2.paused && s2.fight && s2.saved.attempt.id === savedAttempt.id && s2.saved.attempt.size === savedAttempt.size && s2.fight.progress >= savedAttempt.progress, JSON.stringify({ card: s2.card, fight: s2.fight, a: s2.saved.attempt }));
  await shot('resume-card');
  await press('#riverCard button[data-river="resume"]');
  await wait(1100);
  const dexBefore = (await living()).stats.fished;
  for (let i = 0; i < 800; i++) { const st = await rs(); if (st.phase !== 'fight') break; const open = (st.fight.phase === 'gap' || st.fight.phase === 'loose') && !st.fight.stall; await holdBtn(open); await wait(60); }
  await holdBtn(false); await wait(250);
  const lv2 = await living();
  s2 = await rs();
  check('restored fish lands exactly once', s2.phase === 'result' && lv2.stats.fished === dexBefore + 1 && lv2.river.attempt === null && lv2.river.done.includes(savedAttempt.id), JSON.stringify({ phase: s2.phase, fished: lv2.stats.fished, done: lv2.river.done }));
  // duplicate catch through the pure engine is rejected
  const dup = await page.evaluate(id => { const L = window.__SANDSTAR_LIVING_P11__, st = L.getState(); st.river.attempt = null; return L.applyPure(st, { id: 'river-catch-' + id, type: 'river.catch', target: 'pond', attempt: id }, { x: 64, y: 77, groundY: 77, inv: {}, coins: 0 }); }, savedAttempt.id);
  check('replaying the same catch is rejected', dup.ok === false, dup.reason);

  // ===== pause on hide, resume
  await press('#riverCard button[data-river="again"]'); await wait(200);
  await tapWater((await rs()).W * .7, (await rs()).surface + 20); await wait(200);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(200);
  const ps = await rs();
  await page.evaluate(() => { delete document.hidden; });
  check('tab hide pauses the cast (pause card)', ps.paused && ps.card === 'pause', JSON.stringify({ paused: ps.paused, card: ps.card }));
  await press('#riverCard button[data-river="resume"]'); await wait(1000);
  check('resume continues after a short ready', !(await rs()).paused);

  // ===== layout at 390: hold button and canvas fully on screen, no page scroll needed
  const layout = await page.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { vh: innerHeight, vw: innerWidth, hold: r('riverHold'), stage: r('riverCanvas'), exit: r('riverExit'), pause: r('riverPause') }; });
  const inView = b => b.top >= 0 && b.bottom <= layout.vh + 0.5 && b.left >= 0 && b.right <= layout.vw + 0.5;
  check('layout: canvas + hold button + exit/pause inside the viewport, touch targets ≥44px', inView(layout.hold) && inView(layout.stage) && inView(layout.exit) && layout.hold.height >= 44 && layout.exit.height >= 44 && layout.pause.height >= 44, JSON.stringify({ vh: layout.vh, hold: [layout.hold.top, layout.hold.bottom], stage: [layout.stage.top, layout.stage.bottom] }));

  // ===== close: world resumes, menu copy points to the riverbank
  await press('#riverExit'); await wait(300);
  const closed = await page.evaluate(() => ({ open: window.__sandstarRiver.isOpen(), paused: window.__sandstarM17.get().paused }));
  check('exit closes the view and unpauses the world', !closed.open && !closed.paused, JSON.stringify(closed));

  // ===== legacy save: old in-progress m17 fishing + dex without sizes
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  // edit the stored save on the title screen (the running game saves on unload)
  await page.evaluate(() => { const k = window.__SANDSTAR_LIVING_P11__.getSaveKey(), g = JSON.parse(localStorage.getItem(k)); delete g.livingP0.river; g.livingP0.fishing = { id: 'perch', progress: 40, tension: 30, round: 2 }; g.livingP0.fishDex = ['river_fish']; g.livingP0.bag.perch = 0; localStorage.setItem(k, JSON.stringify(g)); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await continueWorld(page); await wait(2500);
  if ((await page.evaluate(() => window.__sandstarM1.state().region)) !== 'life_forest_01') await toForest();
  await ensureLifeMode(); await standAt(63.5);
  await openByAction();
  s = await rs();
  check('legacy save: old hooked fish offered as "이어서 끌어올리기"', s.card === 'legacy', s.card + ' ' + JSON.stringify((await living()).fishing));
  check('legacy save: river state created fresh, old dex shown as 크기 미기록', s.saved && s.saved.best.river_fish === 0 && /크기 미기록/.test(await page.textContent('#riverDex')));
  await shot('legacy-card');
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
