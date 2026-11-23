// No-hook flow check (pre-deploy gap raised by 이온; not one of the brief Gates 1-6): the DEFAULT build (no QA hooks) plays the whole loop with ordinary controls
// and real world time — seeds → plant → water → stage 2 → water → stage 3 → harvest (wheat/potato/carrot) →
// village kitchen → cook bread + soup (stew blocked with a reason, no fish) → eat → reload keeps dishes.
// No time skip: the farm grows on the game's own clock (crops 30/35/40 s per stage).
// PC: walking uses the real keyboard (arrow keys). Mobile 390: taps for every button; walking to a spot uses the
// base game's own position hooks (__sandstarTown25D.move / __sandstarFarmWorld.testMove, present in v41 itself),
// because the touch joystick is a drag gesture. __sandstarFarmCooking.state() is read only, never written.
// Usage: node nohook-flow.cjs <fcb-default-build-url> <outdir> <pc|m390>
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, continueWorld, log } = require('./lib.cjs');

const [url, out, mode] = [process.argv[2] || 'http://127.0.0.1:8752/', process.argv[3] || '.', process.argv[4] || 'pc'];
const mobile = mode === 'm390';
fs.mkdirSync(out, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; log(lines, `${ok ? 'PASS' : 'FAIL'} ${mode}: ${name}${detail ? ' — ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const PLOTS = { wheat: { id: 'plot:34', x: 18, y: 15 }, potato: { id: 'plot:37', x: 24, y: 15 }, carrot: { id: 'plot:40', x: 30, y: 15 } };
const walkLog = [];

(async () => {
  const { browser, page, problems } = await openGame({ url, mobile });
  const press = sel => (mobile ? page.tap(sel) : page.click(sel));
  const st = () => page.evaluate(() => window.__sandstarFarmCooking.state());
  const busyDone = world => page.waitForFunction(w => window.__sandstarWorldLoadingM25B.ready(w) && !window.__sandstarWorldLoadingM25B.state().busy, world, { timeout: 30000 });

  // ---- walking
  async function holdKeys(keys, ms) { for (const k of keys) await page.keyboard.down(k); await wait(ms); for (const k of keys) await page.keyboard.up(k); await wait(60); }
  async function walkFarm(tx, ty, tol = 0.35) {
    if (mobile) { const ok = await page.evaluate(([x, y]) => window.__sandstarFarmWorld.testMove(x, y), [tx, ty]); walkLog.push(`farm hook ${tx},${ty}`); return ok; }
    for (let i = 0; i < 60; i++) {
      const p = await page.evaluate(() => window.__sandstarFarmWorld.state().player);
      const dx = tx - p.x, dy = ty - p.y;
      if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) { walkLog.push(`farm keys ${tx},${ty} in ${i} steps`); return true; }
      const keys = [];
      if (Math.abs(dx) > tol) keys.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (Math.abs(dy) > tol) keys.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      await holdKeys(keys, Math.max(25, Math.min(400, Math.max(Math.abs(dx), Math.abs(dy)) * 190)));
    }
    walkLog.push(`farm keys ${tx},${ty} FAILED`); return false;
  }
  // town is isometric: ArrowRight = (+x,-z), ArrowUp = (-x,-z)
  async function walkTown(tx, tz, tol = 0.45) {
    if (mobile) { const ok = await page.evaluate(([x, z]) => window.__sandstarTown25D.move(x, z), [tx, tz]); walkLog.push(`town hook ${tx},${tz}`); return ok; }
    let last = null, stuck = 0;
    for (let i = 0; i < 90; i++) {
      const p = await page.evaluate(() => window.__sandstarTown25D.state().position);
      const dx = tx - p.x, dz = tz - p.z;
      if (Math.hypot(dx, dz) <= tol) { walkLog.push(`town keys ${tx},${tz} in ${i} steps`); return true; }
      if (last && Math.hypot(p.x - last.x, p.z - last.z) < 0.05) stuck++; else stuck = 0;
      last = p;
      const r = (dx - dz) / 2, u = -(dx + dz) / 2, keys = [];
      if (stuck > 2) { keys.push(i % 2 ? 'ArrowLeft' : 'ArrowDown'); stuck = 0; }   // side-step around props
      else {
        if (Math.abs(r) > tol / 2) keys.push(r > 0 ? 'ArrowRight' : 'ArrowLeft');
        if (Math.abs(u) > tol / 2) keys.push(u > 0 ? 'ArrowUp' : 'ArrowDown');
      }
      await holdKeys(keys, Math.max(30, Math.min(350, Math.max(Math.abs(r), Math.abs(u)) * 160)));
    }
    walkLog.push(`town keys ${tx},${tz} FAILED`); return false;
  }

  await newWorld(page, '626262');
  const hooks = await page.evaluate(() => { const k = window.__sandstarFarmCooking; return { qaHooks: k.qaHooks, advance: typeof k.advance, setSceneMode: typeof k.setSceneMode, sceneProbe: typeof k.sceneProbe, sceneFocus: typeof k.sceneFocus }; });
  check('default build: no QA hooks (no time skip, no scene probe/focus)', hooks.qaHooks === false && ['advance', 'setSceneMode', 'sceneProbe', 'sceneFocus'].every(k => hooks[k] === 'undefined'), JSON.stringify(hooks));

  // ---- town → farm gate
  check('walk to the farm gate', await walkTown(-16.6, -2, 0.8));
  const gateLabel = (await page.textContent('#town25dAction')).trim();
  await press('#town25dAction');
  await busyDone('farm_01');
  await wait(400);
  check('enter farm_01 through the gate button', /농장/.test(gateLabel) && (await page.evaluate(() => window.__sandstarFarmWorld.state().active)), gateLabel);
  const s0 = await st();
  const t0 = Date.now();

  // ---- plant + water all three
  for (const [crop, plot] of Object.entries(PLOTS)) {
    check(`${crop}: walk next to ${plot.id}`, await walkFarm(plot.x, plot.y + 2.2));
    await press(`[data-farm-seed="${crop}"]`);
    const lp = (await page.textContent('#farmWorldAction')).trim();
    await press('#farmWorldAction');
    const lw = (await page.textContent('#farmWorldAction')).trim();
    await press('#farmWorldAction');
    const s = await st(), pl = s.plots[plot.id];
    check(`${crop}: plant + water with the action button`, pl.crop === crop && pl.stage === 1 && pl.watered === true, `${lp} → ${lw} · ${JSON.stringify(pl)}`);
  }
  // ---- real time: water again whenever a plot is dry and not ripe, until all three are stage 3
  const seen = { wheat: [1], potato: [1], carrot: [1] };
  for (let tick = 0; tick < 400; tick++) {
    const s = await st();
    let allRipe = true;
    for (const [crop, plot] of Object.entries(PLOTS)) {
      const pl = s.plots[plot.id];
      if (seen[crop][seen[crop].length - 1] !== pl.stage) seen[crop].push(pl.stage);
      if (pl.stage < 3) allRipe = false;
      if (pl.stage < 3 && !pl.watered) { await walkFarm(plot.x, plot.y + 2.2); await press('#farmWorldAction'); }
    }
    if (allRipe) break;
    await wait(1000);
  }
  const grownSec = (Date.now() - t0) / 1000;
  for (const crop of Object.keys(PLOTS)) check(`${crop}: grew 1 → 2 → 3 on the game clock`, JSON.stringify(seen[crop]) === '[1,2,3]', JSON.stringify(seen[crop]));
  log(lines, `real time from first plant to all ripe: ${grownSec.toFixed(0)} s`);
  await page.screenshot({ path: path.join(out, `nohook-${mode}-ripe.png`) });

  // ---- harvest
  for (const [crop, plot] of Object.entries(PLOTS)) {
    await walkFarm(plot.x, plot.y + 2.2);
    const before = await st();
    const lh = (await page.textContent('#farmWorldAction')).trim();
    await press('#farmWorldAction');
    const after = await st();
    check(`${crop}: harvest → +3 ${crop}, plot empty`, after.bag[crop] === before.bag[crop] + 3 && after.plots[plot.id].crop === null, `${lh} · ${before.bag[crop]}→${after.bag[crop]}`);
  }
  const s1 = await st();
  check('energy was spent on the loop (plant 4 · water 2 · harvest 4) and regenerates', s1.energy < 100 && s1.energy > s0.energy - 3 * 12 - 1, `${s0.energy.toFixed(1)} → ${s1.energy.toFixed(1)} after ${grownSec.toFixed(0)} s`);

  // ---- back to town → kitchen
  check('walk to the farm exit', await walkFarm(4.6, 16.5));
  // v44 has no exit button: at the west gate the action button reads "마을로…" and exits
  const exitSel = (await page.$('#farmWorldExit')) && (await page.isVisible('#farmWorldExit')) ? '#farmWorldExit' : '#farmWorldAction';
  const exitLabel = (await page.textContent(exitSel)).trim();
  await press(exitSel);
  log(lines, `farm exit via ${exitSel} ("${exitLabel}")`);
  await busyDone('village_hub_01');
  await wait(400);
  check('walk to the village kitchen counter', await walkTown(-3.4, -4.8, 0.5) && (await page.evaluate(() => window.__sandstarFarmCooking.kitchen().near)));
  const kLabel = (await page.textContent('#town25dAction')).trim();
  await press('#town25dAction');
  await page.waitForSelector('.fcb-kitchen', { timeout: 5000 });
  check('kitchen opens from the action button', /요리/.test(kLabel), kLabel);
  const stewReason = await page.evaluate(() => { const el = document.querySelector('[data-fcb-reason="stew"]'); return el && !el.hidden ? el.textContent : ''; });
  const stewDisabled = await page.evaluate(() => document.querySelector('[data-fcb-cook="stew"]').disabled);
  check('fish stew blocked with a visible reason (no fish)', stewDisabled && /물고기/.test(stewReason), stewReason);
  for (const [id, item] of [['bread', 'wheat'], ['soup', 'carrot']]) {
    const before = await st();
    await press(`[data-fcb-cook="${id}"]`);
    await wait(200);
    const after = await st();
    check(`cook ${id}: ${item} -2, ${id} +1`, after.bag[id] === before.bag[id] + 1 && after.bag[item] === before.bag[item] - 2, `${item} ${before.bag[item]}→${after.bag[item]}`);
  }
  const be = await st();
  await press('[data-fcb-eat="bread"]');
  await wait(200);
  const ae = await st();
  check('eat bread → energy +25 (cap 100), bread -1', ae.bag.bread === be.bag.bread - 1 && Math.floor(ae.energy) === Math.min(100, Math.floor(be.energy) + 25), `${be.energy.toFixed(1)} → ${ae.energy.toFixed(1)}`);
  if (mobile) {
    const ov = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, vw: innerWidth }));
    check('kitchen fits 390 (no horizontal overflow)', ov.scrollW <= ov.vw, JSON.stringify(ov));
  }
  await page.screenshot({ path: path.join(out, `nohook-${mode}-kitchen.png`) });
  await press('#backBtn').catch(() => {});
  await wait(300);

  // ---- reload: dishes, crops and plots persist (the game saves on its own)
  const kept = await st();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await continueWorld(page);
  await wait(800);
  const back = await st();
  check('after reload: soup / wheat / potato / carrot counts kept', ['soup', 'bread', 'wheat', 'potato', 'carrot'].every(k => back.bag[k] === kept.bag[k]), JSON.stringify(['soup', 'bread', 'wheat', 'potato', 'carrot'].map(k => `${k} ${kept.bag[k]}→${back.bag[k]}`)));
  check('after reload: cook / harvest counters kept', JSON.stringify(back.counts) === JSON.stringify(kept.counts), JSON.stringify(back.counts));
  check('no page/console errors, no failed requests', problems.length === 0, problems.slice(0, 3).join(' | '));
  log(lines, 'walk', walkLog.join(' · '));
  await browser.close();
  log(lines, `== no-hook flow ${mode} total: ${pass} pass, ${fail} fail`);
  fs.writeFileSync(path.join(out, `nohook-${mode}.log`), lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { log(lines, 'ERROR ' + e.stack); fs.writeFileSync(path.join(out, `nohook-${mode}.log`), lines.join('\n') + '\n'); process.exit(2); });
