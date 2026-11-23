// Gate 5: regression — Phase 0 (P0-1..P0-6 + 0b) and Phase 1 ruins walk-in/out behave the same on the
// farm+cooking B build as on the untouched v38 baseline, with zero console/page errors and failed requests.
// Every scenario runs on both builds with the same world seed; values are compared field by field.
// Usage: node gate5-regression.cjs <baseline-url> <fcb-url> <outdir> [<v38-url-for-old-save-fixture>]
// baseline = the production base the fcb build sits on (v41 / v39 / v38); fcb = default (non-QA) build.
// On v40+ bases the lumber_01 scenario and the baseline-save carry-over check also run.
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, continueWorld, log } = require('./lib.cjs');

const [baseUrl, fcbUrl, out, oldSaveUrl] = [process.argv[2] || 'http://127.0.0.1:8738/', process.argv[3] || 'http://127.0.0.1:8739/', process.argv[4] || '.', process.argv[5] || ''];
const SAVE_KEY = 'sandstar-p1-world-v1:official-m25d';
fs.mkdirSync(out, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; log(lines, `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const travelDone = (page, world) => page.waitForFunction(w => window.__sandstarWorldLoadingM25B.ready(w) && !window.__sandstarWorldLoadingM25B.state().busy, world, { timeout: 30000 });

async function townGate(page, x, z) {
  await page.evaluate(([x, z]) => window.__sandstarTown25D.move(x, z), [x, z]);
  await wait(150);
  return (await page.textContent('#town25dAction')).trim();
}

const SCENARIOS = {
  // P0-1 objective strip, P0-2 naming, P0-5 touch wording + fullmap labels, kitchen target is label-free
  async town(page, mobile) {
    const r = {};
    r.qaHooks = await page.evaluate(() => { const k = window.__sandstarFarmCooking; return k ? { qaHooks: k.qaHooks, advance: typeof k.advance, setSceneMode: typeof k.setSceneMode } : null; });
    r.quest = await page.evaluate(() => { const el = document.getElementById('t25Quest'); const t = document.getElementById('t25QuestText'); return { visible: !!el && el.offsetParent !== null && el.getBoundingClientRect().height > 0, text: t?.textContent || '' }; });
    r.help = await page.evaluate(() => document.querySelector('.t25-help')?.textContent || '');
    r.loggingAction = await townGate(page, 15, 11);
    r.loggingSub = (await page.textContent('#town25dSub')).trim();
    r.mineAction = await townGate(page, -15, 11);
    r.farmAction = await townGate(page, -16.6, -2);
    await page.evaluate(() => window.__sandstarTown25D.move(0, 4));
    await wait(150);
    // fullmap: record every label the map draws (text + position)
    await page.evaluate(() => {
      window.__fmLabels = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...rest) { if (this.canvas?.id === 't25FullmapCanvas') window.__fmLabels.push(`${t}@${Math.round(x)},${Math.round(y)}`); return orig.call(this, t, x, y, ...rest); };
    });
    await page.click('#t25Minimap');
    await wait(400);
    r.fullmapOpen = await page.evaluate(() => !document.getElementById('t25Fullmap').hidden);
    r.fullmapLabels = await page.evaluate(() => [...new Set(window.__fmLabels)].sort());
    await page.screenshot({ path: path.join(out, `${this.tag}-fullmap.png`) });
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { const b = document.querySelector('#t25Fullmap button'); if (b && !document.getElementById('t25Fullmap').hidden) b.click(); });
    await wait(200);
    // P0-6 rescue opens an in-game modal, never native confirm()
    let nativeDialog = false;
    page.once('dialog', d => { nativeDialog = true; d.dismiss().catch(() => {}); });
    await page.click('#town25dMenu');
    await page.waitForSelector('#ssEmergencyRescue', { timeout: 5000 });
    await page.click('#ssEmergencyRescue');
    await wait(250);
    r.rescue = { nativeDialog, modalHasRescue: await page.evaluate(() => !!document.getElementById('ssRescueGo') && document.getElementById('overlay').classList.contains('open')) };
    await page.click('#backBtn').catch(() => {});
    if (mobile) r.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    return r;
  },
  // Phase 1: walk down the town stairs into ruins_3d_01 and walk back out
  async ruins(page) {
    const r = {};
    await page.evaluate(() => window.__sandstarTown25D.move(17, -10.6));
    await wait(200);
    await page.keyboard.down('ArrowUp');
    try { await page.waitForFunction(() => window.__sandstarArchWorld.state().active, null, { timeout: 25000 }); } catch (_) {}
    await page.keyboard.up('ArrowUp');
    await travelDone(page, 'ruins_3d_01').catch(() => {});
    await wait(600);
    const a = await page.evaluate(() => window.__sandstarArchWorld.state());
    r.entered = a.active && a.worldId === 'ruins_3d_01';
    r.renderer = a.renderer;
    await page.keyboard.down('ArrowDown');
    try { await page.waitForFunction(() => window.__sandstarTown25D.state().active, null, { timeout: 25000 }); } catch (_) {}
    await page.keyboard.up('ArrowDown');
    await travelDone(page, 'village_hub_01').catch(() => {});
    await wait(400);
    r.returned = await page.evaluate(() => window.__sandstarTown25D.state().active && !window.__sandstarArchWorld.state().active);
    return r;
  },
  // P0-4 / P0-4b: protected mine apron explains itself
  async mine(page) {
    const r = {};
    r.gate = await townGate(page, -15, 11);
    await page.click('#town25dAction');
    await travelDone(page, 'mine');
    await wait(500);
    r.region = await page.evaluate(() => window.__sandstarM1.state().region);
    // the player arrives standing on the station-protected apron (y78 grass over y79-80 stationrock);
    // tapping the tile under the player is the first thing a new player does (Yeoul #4)
    const tapped = await page.evaluate(() => { const p = window.__sandstarM1.state().player, x = Math.floor(p.x), y = Math.floor(p.y); window.__sandstarDebug.tap(x, y); return { x, y, tile: window.__sandstarTownM22.tile(x, y) }; });
    await wait(300);
    r.tapped = tapped;
    r.notice = await page.evaluate(() => document.getElementById('ssMineFeedback')?.textContent || '');
    // protected apron cells across the old 49-cell range X19-67 (y79/y80 read as stationrock when protected)
    r.protectedCells = await page.evaluate(() => { const M = window.__sandstarTownM22, out = []; for (let x = 19; x <= 67; x++) if (M.tile(x, 79) === 'stationrock' || M.tile(x, 80) === 'stationrock') out.push(x); return out; });
    // first dig at X46 (v39 quest step): stand at X46 and tap the floor until it breaks
    await page.evaluate(() => { const y = window.__sandstarM1.state().player.y; window.__sandstarHUDM15.setTestPosition(46.5, y); });
    await wait(300);
    const before = await page.evaluate(() => ({ mined: window.__sandstarTitleP0.state().worldMined, tile: window.__sandstarTownM22.tile(46, Math.floor(window.__sandstarM1.state().player.y) + 1) }));
    let afterDig = before;
    for (let i = 0; i < 40 && afterDig.mined === before.mined; i++) {
      await page.evaluate(() => { const p = window.__sandstarM1.state().player; window.__sandstarDebug.tap(46, Math.floor(p.y) + 1); });
      await wait(120);
      afterDig = await page.evaluate(() => ({ mined: window.__sandstarTitleP0.state().worldMined, tile: window.__sandstarTownM22.tile(46, Math.floor(window.__sandstarM1.state().player.y) + 1) }));
    }
    r.firstDig = { before, after: afterDig };
    return r;
  },
  // P0-3: in mining mode next to a tree the life button stays visible as a mode-switch hint
  async forest(page) {
    const r = {};
    r.gate = await townGate(page, 15, 11);
    await page.click('#town25dAction');
    await travelDone(page, 'life_forest_01');
    r.arrivalToast = await page.evaluate(() => document.getElementById('toast')?.textContent || '');
    await wait(500);
    r.region = await page.evaluate(() => window.__sandstarM1.state().region);
    await page.evaluate(() => { const y = window.__sandstarTownM22.surface(82); window.__sandstarHUDM15.setTestPosition(82.5, y - 1); });
    await wait(300);
    const before = await page.evaluate(() => window.__sandstarHUDM15.get());
    if (!before.manualMining) await page.evaluate(() => window.__sandstarHUDM15.toggleTool());
    await wait(300);
    r.mode = await page.evaluate(() => window.__sandstarHUDM15.get().scene);
    r.lifeButton = await page.evaluate(() => { const b = document.getElementById('m1ActionBtn'); return { visible: !!b && !b.hidden && b.offsetParent !== null, text: (b?.textContent || '').trim() }; });
    return r;
  },
  // v40/v41 잔빛 벌목장 (lumber_01): enter from the forest gate, grove A vitality 3→0 (P16 fix),
  // depletion penalty, 4th chop blocked, state kept across a save + reload, exit back to the forest.
  async lumber(page) {
    const r = {};
    if (!(await page.evaluate(() => !!window.__sandstarLumberWorld))) { r.absent = true; return r; }
    await townGate(page, 15, 11);
    await page.click('#town25dAction');
    await travelDone(page, 'life_forest_01');
    await wait(500);
    await page.evaluate(() => { const x = window.__sandstarLumberWorld.portalX; const y = window.__sandstarTownM22.surface(Math.floor(x)); window.__sandstarHUDM15.setTestPosition(x, y - 1); });
    await wait(300);
    if ((await page.evaluate(() => window.__sandstarHUDM15.get().scene)) === 'mining') await page.evaluate(() => window.__sandstarHUDM15.toggleTool());
    await wait(300);
    r.gateButton = await page.evaluate(() => { const b = document.getElementById('lumberForestGateAction'); return !!b && !b.hidden; });
    r.tryEnter = await page.evaluate(() => window.__sandstarLumberWorld.tryEnter());
    await travelDone(page, 'lumber_01').catch(() => {});
    await wait(500);
    r.entered = await page.evaluate(() => window.__sandstarLumberWorld.state().active);
    const fcbEnergy = () => page.evaluate(() => window.__sandstarFarmCooking?.state?.()?.energy ?? null);
    r.fcbOnly = { energyBefore: await fcbEnergy() };
    const read = () => page.evaluate(() => { const s = window.__sandstarLumberWorld.state(), g = s.v1.groves.grove_a; return { vitality: g.vitality, penalty: (g.depletedUntil || 0) > Date.now(), wood: s.wood, softPine: s.v1.woods.soft_pine, pineSapling: s.v1.saplings.pine_sapling, cutCounter: s.v1.cutCounter, lastCut: s.v1.lastCutGroveId }; });
    r.chops = [await read()];
    for (let i = 0; i < 4; i++) { const ret = await page.evaluate(() => window.__sandstarLumberWorld.action('chop', 'grove_a')); await wait(150); r.chops.push({ ret, ...(await read()) }); }
    r.fcbOnly.energyAfter = await fcbEnergy();
    await page.evaluate(() => window.__sandstarDebug.save());
    await wait(200);
    r.saved = await page.evaluate(k => { const g = JSON.parse(localStorage.getItem(k) || '{}'), a = g.lumberWorldV1?.groves?.grove_a; return a ? { vitality: a.vitality, penalty: (a.depletedUntil || 0) > Date.now(), softPine: g.lumberWorldV1.woods.soft_pine } : null; }, SAVE_KEY);
    r.exit = await page.evaluate(() => window.__sandstarLumberWorld.exit(true));
    await travelDone(page, 'life_forest_01').catch(() => {});
    await wait(500);
    r.back = await page.evaluate(() => ({ lumberActive: window.__sandstarLumberWorld.state().active, region: window.__sandstarM1.state().region }));
    return r;
  },
};

(async () => {
  const results = {};
  for (const mobile of [false, true]) {
    for (const name of Object.keys(SCENARIOS)) {
      if (mobile && !['town', 'ruins'].includes(name)) continue;
      for (const [build, url] of [['base', baseUrl], ['fcb', fcbUrl]]) {
        const tag = `${mobile ? 'm390' : 'pc'}-${name}-${build}`;
        const { browser, page, problems } = await openGame({ url, mobile });
        await newWorld(page, '424242');
        let r;
        try { r = await SCENARIOS[name].call({ tag }, page, mobile); } catch (e) { r = { error: String(e).slice(0, 300) }; }
        r.problems = problems;
        results[tag] = r;
        log(lines, `-- ${tag}: ${JSON.stringify({ ...r, fullmapLabels: r.fullmapLabels ? r.fullmapLabels.length + ' labels' : undefined })}`);
        await browser.close();
      }
    }
  }
  const pairs = [...new Set(Object.keys(results).map(k => k.replace(/-(base|fcb)$/, '')))];
  for (const key of pairs) {
    const a = results[`${key}-base`], b = results[`${key}-fcb`];
    const strip = o => { const c = { ...o }; delete c.problems; delete c.qaHooks; delete c.fcbOnly; return c; };
    check(`${key}: fcb == base (all fields except qaHooks/fcbOnly)`, JSON.stringify(strip(a)) === JSON.stringify(strip(b)), JSON.stringify(strip(b)).slice(0, 300));
    check(`${key}: fcb no page/console errors, no failed requests`, b.problems.length === 0, b.problems.slice(0, 3).join(' | '));
    check(`${key}: baseline also clean (reference)`, a.problems.length === 0, a.problems.slice(0, 3).join(' | '));
  }
  // absolute expectations on the fcb build
  const t = results['pc-town-fcb'], tm = results['m390-town-fcb'];
  check('P0-1 pc: town objective strip visible with quest text', t.quest.visible && t.quest.text.length > 5, t.quest.text);
  check('P0-1 m390: town objective strip visible', tm.quest.visible && tm.quest.text.length > 5);
  check('P0-2: logging gate named 벌목장 입구 → 잔빛숲', /벌목장/.test(t.loggingAction) && t.loggingSub === '벌목장 입구 → 잔빛숲', `${t.loggingAction} / ${t.loggingSub}`);
  check('P0-5 pc: PC help text', /WASD/.test(t.help), t.help);
  check('P0-5 m390: no PC keys in town help on touch', !/WASD/.test(tm.help) && /조이스틱/.test(tm.help), tm.help);
  check('P0-5: fullmap opens and draws gate + player labels (pc, m390)', t.fullmapOpen && tm.fullmapOpen && ['광산 입구', '벌목장 입구', '농장 입구', '유적 입구', '나'].every(n => t.fullmapLabels.some(l => l.startsWith(n + '@')) && tm.fullmapLabels.some(l => l.startsWith(n + '@'))), `${t.fullmapLabels.length}/${tm.fullmapLabels.length} labels`);
  check('P0-5: kitchen counter adds no fullmap label', !t.fullmapLabels.some(l => l.startsWith('요리대')) && !tm.fullmapLabels.some(l => l.startsWith('요리대')));
  check('P0-6: rescue uses the in-game modal, no native dialog', t.rescue.modalHasRescue && !t.rescue.nativeDialog && tm.rescue.modalHasRescue && !tm.rescue.nativeDialog);
  check('m390: town has no horizontal overflow', tm.overflow <= 0, String(tm.overflow));
  const ru = results['pc-ruins-fcb'], rum = results['m390-ruins-fcb'];
  check('Phase 1 pc: walk into ruins and back out', ru.entered && ru.returned, JSON.stringify(ru));
  check('Phase 1 m390: walk into ruins and back out', rum.entered && rum.returned, JSON.stringify(rum));
  const mi = results['pc-mine-fcb'];
  check('P0-4: mine apron shows the protected-floor guidance', mi.region === 'mine' && /보호/.test(mi.notice), mi.notice);
  check('mine: protected cells identical to baseline', JSON.stringify(mi.protectedCells) === JSON.stringify(results['pc-mine-base'].protectedCells), `${mi.protectedCells.length} cells: ${mi.protectedCells.join(',')}`);
  check('mine: first dig at X46 works', mi.firstDig.after.mined > mi.firstDig.before.mined, JSON.stringify(mi.firstDig));
  check('fcb default build exposes no QA hooks', JSON.stringify(t.qaHooks) === JSON.stringify({ qaHooks: false, advance: 'undefined', setSceneMode: 'undefined' }) && JSON.stringify(tm.qaHooks) === JSON.stringify(t.qaHooks), JSON.stringify(t.qaHooks));
  check('forest: arrival toast matches baseline', results['pc-forest-fcb'].arrivalToast === results['pc-forest-base'].arrivalToast, results['pc-forest-fcb'].arrivalToast);
  const fo = results['pc-forest-fcb'];
  check('P0-3: life button stays visible in mining mode next to a tree', fo.region === 'life_forest_01' && fo.lifeButton.visible && /생활 조작/.test(fo.lifeButton.text), JSON.stringify(fo.lifeButton));
  const lu = results['pc-lumber-fcb'];
  if (lu && !lu.absent) {
    check('lumber: forest gate button shows and entry reaches lumber_01', lu.gateButton && lu.tryEnter && lu.entered, JSON.stringify({ gate: lu.gateButton, tryEnter: lu.tryEnter, entered: lu.entered }));
    check('lumber: grove A vitality 3→2→1→0, penalty on the 3rd chop, 4th chop blocked (v41 P16)', JSON.stringify(lu.chops.map(c => c.vitality)) === '[3,2,1,0,0]' && lu.chops[3].penalty && lu.chops[4].ret === false, JSON.stringify(lu.chops));
    check('lumber: cutCounter/lastCut/sapling kept (no orphan state)', lu.chops[4].lastCut === 'grove_a' && lu.chops[4].pineSapling >= 1 && lu.chops[4].softPine >= 2, JSON.stringify(lu.chops[4]));
    check('lumber: depleted grove + woods persisted in the save', lu.saved && lu.saved.vitality === 0 && lu.saved.penalty && lu.saved.softPine === lu.chops[4].softPine, JSON.stringify(lu.saved));
    check('lumber: exit returns to life_forest_01', lu.exit !== false && !lu.back.lumberActive && lu.back.region === 'life_forest_01', JSON.stringify(lu.back));
    check('lumber: chopping does not touch farm 기력 (separate from grove 활력)', lu.fcbOnly.energyBefore !== null && lu.fcbOnly.energyBefore === lu.fcbOnly.energyAfter, JSON.stringify(lu.fcbOnly));
  }
  // ---- old save restore: a save made on the archived v38 build loads on baseline and fcb alike
  if (oldSaveUrl) {
    log(lines, `== old save fixture from ${oldSaveUrl}`);
    let s = await openGame({ url: oldSaveUrl });
    await newWorld(s.page, '777001');
    // mine edits on v38: dig at X70 (outside every protected range)
    await townGate(s.page, -15, 11); await s.page.click('#town25dAction'); await travelDone(s.page, 'mine'); await wait(500);
    await s.page.evaluate(() => { const y = window.__sandstarTownM22.surface(70); window.__sandstarHUDM15.setTestPosition(70.5, y - 1); });
    await wait(300);
    for (let i = 0; i < 40; i++) { const m = await s.page.evaluate(() => { window.__sandstarDebug.tap(70, window.__sandstarTownM22.surface(70)); return window.__sandstarTitleP0.state().worldMined; }); if (m > 0) break; await wait(120); }
    await s.page.evaluate(() => window.__sandstarHUDM15.setTestPosition(40.5, window.__sandstarM1.state().player.y));
    await wait(200);
    await s.page.evaluate(() => window.__sandstarDebug.save()); // existing v38 debug hook: persist the mining edit now
    await wait(200);
    // a half-grown v38 plot (timer model): plant + water wheat on plot 34 directly in the save
    const state = await s.context.storageState();
    await s.browser.close();
    let fixture;
    for (const o of state.origins) for (const it of o.localStorage) if (it.name === SAVE_KEY) {
      const g = JSON.parse(it.value);
      g.livingP0.clock = Math.max(g.livingP0.clock, 200);
      g.livingP0.plots['plot:34'] = { plantedAt: g.livingP0.clock - 10, watered: true, crop: 'wheat' };   // 10s into 75s: still growing
      g.livingP0.plots['plot:37'] = { plantedAt: 0, watered: true, crop: 'carrot' };                     // 200s >= 90s: ripe
      g.livingP0.bag.seed_wheat = 2; g.livingP0.bag.seed_carrot = 2; g.livingP0.bag.carrot = 4; g.coins = 77;
      delete g.livingP0.energy; delete g.livingP0.counts;
      it.value = JSON.stringify(g); fixture = g;
    }
    log(lines, 'fixture', { mined: fixture.mined, coins: fixture.coins, plots: fixture.livingP0.plots, region: fixture.storyM1?.region });
    const loaded = {};
    for (const [build, url] of [['base', baseUrl], ['fcb', fcbUrl]]) {
      // localStorage is per origin (port included): move the fixture to the target server's origin
      const st = JSON.parse(JSON.stringify(state)); for (const o of st.origins) o.origin = new URL(url).origin;
      const t2 = await openGame({ url, storageState: st });
      await continueWorld(t2.page);
      await wait(800);
      loaded[build] = await t2.page.evaluate(() => { const L = window.__SANDSTAR_LIVING_P11__.getState(); return { title: window.__sandstarTitleP0.state(), region: window.__sandstarM1.state().region, bag: L.bag, plots: L.plots, energy: L.energy }; });
      loaded[build].problems = t2.problems;
      await t2.browser.close();
    }
    const keep = o => JSON.stringify({ mined: o.title.worldMined, coins: o.title.worldCoins, seed: o.title.worldSeed, region: o.region, bag: o.bag });
    check('old save: fixture carries a v38 mining edit', fixture.mined >= 1, String(fixture.mined));
    check('old save: v38 save loads on baseline and fcb with the same world, coins, mining edits and bag', keep(loaded.base) === keep(loaded.fcb) && loaded.fcb.title.worldMined === fixture.mined && loaded.fcb.title.worldCoins === 77, keep(loaded.fcb));
    const p34 = loaded.fcb.plots['plot:34'], p37 = loaded.fcb.plots['plot:37'];
    check('old save: growing v38 plots migrate to the stage model', p34.crop === 'wheat' && p34.stage === 1 && p34.watered === true && p37.crop === 'carrot' && p37.stage === 3 && !p37.watered, JSON.stringify({ p34, p37 }));
    check('old save: missing energy defaults to 100', loaded.fcb.energy === 100, String(loaded.fcb.energy));
    check('old save: no errors on baseline or fcb', loaded.base.problems.length === 0 && loaded.fcb.problems.length === 0, [...loaded.base.problems, ...loaded.fcb.problems].slice(0, 3).join(' | '));
    results.oldSave = { fixture: { mined: fixture.mined, coins: fixture.coins, plots: fixture.livingP0.plots }, loaded };
  }
  // ---- current-production save: a save made on the baseline after logging loads on fcb unchanged
  if (results['pc-lumber-base'] && !results['pc-lumber-base'].absent) {
    log(lines, `== baseline save (lumber) from ${baseUrl}`);
    const s = await openGame({ url: baseUrl });
    await newWorld(s.page, '777002');
    await SCENARIOS.lumber.call({ tag: 'save-fixture' }, s.page, false);
    await s.page.evaluate(() => window.__sandstarDebug.save());
    await wait(200);
    const snap = page => page.evaluate(k => { const g = JSON.parse(localStorage.getItem(k) || '{}'); return { lumber: g.lumberWorldV1 ? { groves: Object.fromEntries(Object.entries(g.lumberWorldV1.groves).map(([id, v]) => [id, v.vitality])), woods: g.lumberWorldV1.woods, saplings: g.lumberWorldV1.saplings, quests: g.lumberWorldV1.quests } : null, wood: g.inv?.wood, coins: g.coins, mined: g.mined, bag: g.livingP0?.bag }; }, SAVE_KEY);
    const before = await snap(s.page);
    const state = await s.context.storageState();
    await s.browser.close();
    for (const o of state.origins) o.origin = new URL(fcbUrl).origin;
    const t2 = await openGame({ url: fcbUrl, storageState: state });
    await continueWorld(t2.page);
    await wait(800);
    const live = await t2.page.evaluate(() => { const v = window.__sandstarLumberWorld.state().v1; return { groves: Object.fromEntries(Object.entries(v.groves).map(([id, g]) => [id, g.vitality])), woods: v.woods, saplings: v.saplings, energy: window.__sandstarFarmCooking.state().energy }; });
    await t2.page.evaluate(() => window.__sandstarDebug.save());
    await wait(200);
    const after = await snap(t2.page);
    const problems = t2.problems;
    await t2.browser.close();
    const strip = o => JSON.stringify({ ...o, bag: undefined });
    check('baseline save: lumber grove/woods/saplings/quests, wood, coins carry over to fcb unchanged after re-save', before.lumber && strip(before) === strip(after) && JSON.stringify(live.groves) === JSON.stringify(before.lumber.groves), `${strip(before).slice(0, 200)} → ${strip(after).slice(0, 200)}`);
    check('baseline save: living bag kept, energy defaults to 100, no errors', JSON.stringify(before.bag) === JSON.stringify(Object.fromEntries(Object.keys(before.bag).map(k => [k, after.bag[k]]))) && live.energy === 100 && problems.length === 0, JSON.stringify({ energy: live.energy, problems: problems.slice(0, 3) }));
    results.baselineSave = { before, after, live };
  }
  fs.writeFileSync(path.join(out, 'gate5-results.json'), JSON.stringify(results, null, 1));
  log(lines, `== Gate 5 total: ${pass} pass, ${fail} fail`);
  fs.writeFileSync(path.join(out, 'gate5.log'), lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { log(lines, 'ERROR ' + e.stack); fs.writeFileSync(path.join(out, 'gate5.log'), lines.join('\n') + '\n'); process.exit(2); });
