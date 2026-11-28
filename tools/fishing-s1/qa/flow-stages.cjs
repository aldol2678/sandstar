// 별샘 물길 단계 QA (local preview only, default build).
// Save fixtures put the player in the fishing ground with chosen spring/flow states, then real time
// passes (no clock hooks): stage 0 before the spring is repaired, 1 right after, 2 after 180s of active
// time, 3 only after 480s AND a later visit. Active time must grow while walking or fishing, and not
// while a pause card is up or the game is closed.
// Usage: node flow-stages.cjs <url> <outdir> <pc|m390>
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
  const fw = () => page.evaluate(() => window.__sandstarFishingWorld.state());
  const rs = () => page.evaluate(() => window.__sandstarRiver.state());
  const press = sel => (mobile ? page.tap(sel) : page.click(sel));
  const act = async () => { if (mobile) await page.tap('#fishWorldAction'); else await page.keyboard.press('e'); await wait(500); };
  async function load(repaired, flow, at = { x: 6.4, y: 11 }) {
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await page.evaluate(([repaired, flow, at]) => {
      const k = window.__SANDSTAR_LIVING_P11__.getSaveKey(), g = JSON.parse(localStorage.getItem(k));
      g.storyM1.springRepaired = repaired; g.storyM1.region = 'life_forest_01'; g.livingP0.rod = true;
      g.livingP0.river = { schema: 1, best: { river_fish: 0, perch: 0, carp: 0 }, spots: { A: 0, B: 0, C: 0 }, attempt: null, done: [], assist: false, keep: { river_fish: 0, perch: 0, carp: 0 }, flow };
      g.fishingWorldV1 = { schema: 1, activeWorldId: 'fishing_01', position: at, entryCount: 5, lastSpot: '' };
      localStorage.setItem(k, JSON.stringify(g));
    }, [repaired, flow, at]);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await continueWorld(page); await wait(1500);
  }
  const fresh = { active: 0, stage: 0, stage2Entry: 0, seen: 0 };

  await newWorld(page, '919191'); await wait(800);

  // ---- before repair
  await load(false, fresh);
  await wait(3500);
  let w = await fw();
  check('spring not repaired → stage 0, no active time', w.active && w.flow.stage === 0 && w.flow.active === 0 && w.drawnFlowStage === 0, JSON.stringify(w.flow));
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(22.6, 19.6)); await wait(300); await act();
  let s = await rs();
  check('C before repair: weaker current (flow 0.13)', s.open && s.spot === 'C' && Math.abs(s.live.flow - .13) < 1e-9, JSON.stringify(s.live));
  check('observation log shows the pre-repair note', /C 물살이 약해요/.test(await page.textContent('#riverFlowLog')));
  await press('#riverExit'); await wait(300);

  // ---- right after repair: stage 1 on the first visit, one notice
  await load(true, fresh);
  await wait(4200);
  w = await fw();
  const toast1 = (await page.textContent('#fishWorldToast')).trim();
  check('repaired → stage 1 and the first-seen notice once', w.flow.stage === 1 && w.flow.seen === 1 && /C 물살까지 닿았어요/.test(toast1) && w.drawnFlowStage === 1, JSON.stringify({ flow: w.flow, toast1 }));
  await page.screenshot({ path: path.join(out, `${mode}-flow-stage1-world.png`) });
  // active time: walking world 3s
  let a0 = (await fw()).flow.active; await wait(3000); let a1 = (await fw()).flow.active;
  check('active time grows in the fishing ground (~3s per 3s)', a1 - a0 > 2.4 && a1 - a0 < 3.8, `+${(a1 - a0).toFixed(2)}`);
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(22.6, 19.6)); await wait(300); await act();
  s = await rs();
  check('C after repair: livelier current (flow 0.18) and more perch in the mix', Math.abs(s.live.flow - .18) < 1e-9 && s.live.stage === 1, JSON.stringify(s.live));
  a0 = (await fw()).flow.active; await wait(3000); a1 = (await fw()).flow.active;
  check('active time grows while fishing (~3s per 3s)', a1 - a0 > 2.4 && a1 - a0 < 3.8, `+${(a1 - a0).toFixed(2)}`);
  await press('#riverPause'); await wait(200);
  a0 = (await fw()).flow.active; await wait(3000); a1 = (await fw()).flow.active;
  check('no active time while the pause card is up', a1 === a0, `${a0.toFixed(2)} → ${a1.toFixed(2)}`);
  await page.screenshot({ path: path.join(out, `${mode}-flow-stage1-C.png`) });
  await press('#riverCard button[data-river="resume"]'); await wait(1100);
  await press('#riverExit'); await wait(300);
  // closing the game neither adds nor costs: compare the stored value while the game is closed
  const before = (await fw()).flow.active;
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem(window.__SANDSTAR_LIVING_P11__.getSaveKey())).livingP0.river.flow.active);
  const s0 = await stored(); await wait(4000); const s1 = await stored();
  check('while closed nothing accrues; stored time is the last save (≤10s behind)', s1 === s0 && s0 <= before + 1 && s0 >= before - 10.5, `live ${before.toFixed(1)} · stored ${s0.toFixed(1)} → ${s1.toFixed(1)} after 4s closed`);
  await continueWorld(page); await wait(400);

  // ---- stage 2 after 180s of active time
  await load(true, { active: 178.5, stage: 1, stage2Entry: 0, seen: 1 });
  await wait(4500);
  w = await fw();
  const toast2 = (await page.textContent('#fishWorldToast')).trim();
  check('180s active → stage 2 (B ripples), stage2Entry = this visit, one notice', w.flow.stage === 2 && w.flow.stage2Entry === 5 && w.flow.seen === 2 && /잔물결/.test(toast2) && w.drawnFlowStage === 2, JSON.stringify({ flow: w.flow, toast2 }));
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(19.2, 8)); await wait(300); await act();
  s = await rs();
  check('B at stage 2: shadows approach 15% faster', s.spot === 'B' && Math.abs(s.live.approach - 1.15) < 1e-9, JSON.stringify(s.live));
  await page.screenshot({ path: path.join(out, `${mode}-flow-stage2-B.png`) });
  await press('#riverExit'); await wait(300);

  // ---- stage 3 needs 480s AND a later visit
  await load(true, { active: 500, stage: 2, stage2Entry: 5, seen: 2 });
  await wait(3500);
  w = await fw();
  check('480s but the same visit → still stage 2', w.flow.stage === 2, JSON.stringify(w.flow));
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(2.8, 11)); await wait(300); await act();
  await travelDone(page, 'village_hub_01'); await wait(500);
  await page.evaluate(() => window.__sandstarTown25D.move(18, -0.5)); await wait(250);
  await press('#town25dAction'); await travelDone(page, 'fishing_01'); await wait(4500);
  w = await fw();
  const toast3 = (await page.textContent('#fishWorldToast')).trim();
  check('a later visit → stage 3 (A clearer), one notice', w.flow.stage === 3 && w.flow.seen === 3 && /A 강가 물이 한결 맑아졌어요/.test(toast3) && w.drawnFlowStage === 3, JSON.stringify({ flow: w.flow, entry: w.saved.entryCount, toast3 }));
  await page.screenshot({ path: path.join(out, `${mode}-flow-stage3-world.png`) });
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(12.6, 15.2)); await wait(300); await act();
  s = await rs();
  const log3 = await page.textContent('#riverFlowLog');
  check('A at stage 3: clear water flag; log lists stages 1–3', s.live.clear === 1 && /C 물살까지/.test(log3) && /잔물결/.test(log3) && /맑아졌어요/.test(log3), JSON.stringify({ live: s.live, log3: log3.slice(0, 120) }));
  await page.screenshot({ path: path.join(out, `${mode}-flow-stage3-A.png`) });
  await press('#riverExit'); await wait(300);

  const real = problems.filter(p => !/vibrate|favicon/i.test(p));
  check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(out, `flow-${mode}.log`), lines.join('\n') + `\n${pass} pass, ${fail} fail\n`);
  log(lines, `${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
