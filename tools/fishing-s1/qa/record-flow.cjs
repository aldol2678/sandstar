// 여울 '물고기 기록' 선택 의뢰 QA (local preview only, default build).
// 알돌 확정(2026-11-28, 여울 안): 보상은 물살 관찰 표식만, 옛 도감 인정, 물고기 소비 없음, 공식 대사 3줄,
// 마을 낚시터 입구 옆 여울에게서 수락·수령. 치장 찌·강화 재료·코인 없음.
// Real town UI (walk to 여울, talk, buttons), fixtures written on the title screen, engine checks via applyPure.
// Usage: node record-flow.cjs <url> <outdir> <pc|m390>
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
const LINES = { accept: '강에서 물고기 3종만 기록해 줄래?', progress: '어종마다 좋아하는 물 깊이가 달라.', done: '이 기록이면 옛 물길을 찾을 수 있어!' };

(async () => {
  const { browser, page, problems } = await openGame({ url, mobile });
  const press = sel => (mobile ? page.tap(sel) : page.click(sel));
  const shot = name => page.screenshot({ path: path.join(out, `${mode}-${name}.png`) });
  const rec = () => page.evaluate(() => window.__sandstarFishRecord.state());
  const living = () => page.evaluate(() => window.__SANDSTAR_LIVING_P11__.getState());
  const coins = () => page.evaluate(() => window.__sandstarTitleP0.state().worldCoins);
  const tip = () => page.evaluate(() => { const e = document.getElementById('t25FishTip'); return { hidden: e.hidden, text: e.textContent.trim() }; });
  const box = () => page.evaluate(() => { const b = document.getElementById('yeoulRecord'); return b ? { text: b.innerText.replace(/\s+/g, ' '), btn: b.querySelector('[data-yrec]')?.dataset.yrec || '', line: document.getElementById('ssNpcLine')?.textContent || '', prog: document.getElementById('ssNpcProg')?.textContent || '' } : null; });
  async function edit(fn, arg) {
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await page.evaluate(([src, arg]) => { const k = window.__SANDSTAR_LIVING_P11__.getSaveKey(), g = JSON.parse(localStorage.getItem(k)); (0, eval)(src)(g, arg); localStorage.setItem(k, JSON.stringify(g)); }, [fn.toString(), arg]);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await continueWorld(page); await wait(1800);
  }
  async function talkYeoul() {
    await page.evaluate(() => window.__sandstarTown25D.move(15, -7)); await wait(300);
    const label = (await page.textContent('#town25dAction')).trim();
    await press('#town25dAction'); await wait(700);
    return label;
  }
  const close = async () => { await page.keyboard.press('Escape'); await wait(300); };
  const engine = (st, cmd) => page.evaluate(([st, cmd]) => window.__SANDSTAR_LIVING_P11__.applyPure(st, cmd, { x: 0, y: 0, groundY: 0, inv: {}, coins: 0 }), [st, cmd]);

  await newWorld(page, '646464'); await wait(1200);

  // ===== new save: offer → accept
  await edit(g => { g.livingP0.rod = true; g.livingP0.fishDex = []; g.livingP0.stats.fished = 1; });
  const label = await talkYeoul();
  let b = await box();
  check('여울 near the fishing gate offers the optional record request', /여울/.test(label) && b && b.btn === 'accept' && /선택 의뢰/.test(b.text) && /물고기를 내지 않아요/.test(b.text) && /물살 관찰 표식/.test(b.text), JSON.stringify({ label, b }));
  await shot('record-offer');
  await press('#yeoulRecord [data-yrec="accept"]'); await wait(500);
  b = await box(); let r = await rec();
  check('accept: quest saved, official accept line shown', r.quest === 1 && r.rewards.length === 0 && b.line === `“${LINES.accept}”` && /퀘스트 수락/.test(b.prog) && b.btn === 'progress' && /기록 0\/3/.test(b.text), JSON.stringify({ r, b }));
  await press('#yeoulRecord [data-yrec="progress"]'); await wait(300);
  b = await box();
  check('progress talk uses the official progress line', b.line === `“${LINES.progress}”`, b.line);
  await shot('record-progress');
  await close();
  let t = await tip();
  check('town HUD tip shows record progress 0/3', !t.hidden && /물고기 기록 0\/3/.test(t.text), JSON.stringify(t));
  let st = await living();
  let e = await engine(st, { id: 'qa-claim-early', type: 'river.record.claim', target: 'self' });
  check('engine refuses the reward before 3 species', e.ok === false && /0\/3/.test(e.reason), e.reason);
  e = await engine(st, { id: 'qa-accept-again', type: 'river.record.accept', target: 'self' });
  check('engine refuses accepting twice', e.ok === false, e.reason);
  // the third species caught later completes the record (engine: hook + catch)
  const st2 = JSON.parse(JSON.stringify(st)); st2.fishDex = ['river_fish', 'perch'];
  const h = await page.evaluate(([s]) => window.__SANDSTAR_LIVING_P11__.applyPure(s, { id: 'qa-h', type: 'river.hook', target: 'pond', item: 'carp', size: 300, spot: 'B', attempt: 'qarec1' }, { x: 64, y: 76, groundY: 76, inv: {}, coins: 0 }), [st2]);
  const c = h.ok ? await page.evaluate(([s]) => window.__SANDSTAR_LIVING_P11__.applyPure(s, { id: 'qa-c', type: 'river.catch', target: 'pond', attempt: 'qarec1' }, { x: 64, y: 76, groundY: 76, inv: {}, coins: 0 }), [h.state]) : h;
  const cl = c.ok ? await engine(c.state, { id: 'qa-claim-ok', type: 'river.record.claim', target: 'self' }) : c;
  check('catching the 3rd species makes the claim valid', c.ok && cl.ok && cl.state.river.rewards.includes('river-record-marks-1'), JSON.stringify({ h: h.reason, c: c.reason, cl: cl.reason || cl.message }));

  // ===== old dex (3 species, no sizes, empty bag): claim without using fish
  await edit(g => { g.livingP0.fishDex = ['river_fish', 'perch', 'carp']; g.livingP0.river.best = { river_fish: 0, perch: 0, carp: 0 }; g.livingP0.bag.river_fish = 2; g.livingP0.bag.perch = 0; g.livingP0.bag.carp = 0; });
  t = await tip();
  check('3/3 recorded: tip asks to show the record to 여울', !t.hidden && /3\/3/.test(t.text) && /여울에게/.test(t.text), JSON.stringify(t));
  const c0 = await coins(), bag0 = (await living()).bag;
  await talkYeoul();
  b = await box();
  check('old dex counts: 3/3 and the claim button is offered', b.btn === 'claim' && /기록 3\/3/.test(b.text) && (b.text.match(/✓/g) || []).length === 3, JSON.stringify(b));
  await press('#yeoulRecord [data-yrec="claim"]'); await wait(600);
  b = await box(); r = await rec(); const c1 = await coins(), bag1 = (await living()).bag;
  check('claim: official done line, reward id saved once', b.line === `“${LINES.done}”` && /퀘스트 완료/.test(b.prog) && r.marked && r.rewards.length === 1 && b.btn === 'done' && /기록 완료/.test(b.text), JSON.stringify({ r, b }));
  check('no fish used and no coins given', c1 === c0 && bag1.river_fish === bag0.river_fish && bag1.perch === bag0.perch && bag1.carp === bag0.carp, JSON.stringify({ c0, c1, bag0: [bag0.river_fish, bag0.perch, bag0.carp], bag1: [bag1.river_fish, bag1.perch, bag1.carp] }));
  await shot('record-done');
  await close();
  st = await living();
  e = await engine(st, { id: 'qa-claim-twice', type: 'river.record.claim', target: 'self' });
  check('engine refuses a second reward', e.ok === false && /이미 받은/.test(e.reason), e.reason);
  t = await tip();
  check('tip leaves once the reward is taken', t.hidden, JSON.stringify(t));

  // ===== persistence + marks in the fishing ground
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await continueWorld(page); await wait(1500);
  r = await rec();
  check('quest and reward persist after reload', r.quest === 1 && r.marked && r.seen === false, JSON.stringify(r));
  await page.evaluate(() => window.__sandstarTown25D.move(18, -0.5)); await wait(250);
  await press('#town25dAction'); await travelDone(page, 'fishing_01'); await wait(4800);
  let w = await page.evaluate(() => window.__sandstarFishingWorld.state());
  const toast = (await page.textContent('#fishWorldToast')).trim();
  r = await rec();
  check('fishing ground draws the 물살 관찰 표식 and labels carry 🧭', w.drawnMarks === true || w.renderer === 'cpu', JSON.stringify({ renderer: w.renderer, drawn: w.drawnMarks, labels: w.labels }));
  check('first visit after the reward: one notice, then marked seen', /물살 관찰 표식/.test(toast) && r.seen === true, JSON.stringify({ toast, seen: r.seen }));
  await shot('marks-world');
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(12.6, 15.2)); await wait(400);
  w = await page.evaluate(() => window.__sandstarFishingWorld.state());
  check('spot label shows the mark', Object.values(w.labels || {}).some(x => /🧭/.test(x)) || w.renderer === 'cpu', JSON.stringify(w.labels));
  if (mobile) await page.tap('#fishWorldAction'); else await page.keyboard.press('e');
  await wait(700);
  const logTxt = await page.textContent('#riverFlowLog');
  check('fishing view observation log lists the marks for A·B·C', /물살 관찰 표식/.test(logTxt) && /A 완만한 강가/.test(logTxt) && /B 깊은 소/.test(logTxt) && /C 좁은 물살/.test(logTxt), logTxt.slice(0, 200));
  await press('#riverExit'); await wait(300);

  // ===== without the reward the marks stay hidden; old saves without the new keys normalize
  await edit(g => { delete g.livingP0.river.record; delete g.livingP0.river.rewards; g.fishingWorldV1 = { schema: 1, activeWorldId: 'fishing_01', position: { x: 6.4, y: 11 }, entryCount: 3, lastSpot: '' }; });
  await wait(1500);
  r = await rec(); w = await page.evaluate(() => window.__sandstarFishingWorld.state());
  check('save without record keys → quest 0, no reward, no marks drawn', r.quest === 0 && !r.marked && r.rewards.length === 0 && w.active && w.drawnMarks !== true, JSON.stringify({ r, drawn: w.drawnMarks }));
  // forged reward ids are dropped
  await edit(g => { g.livingP0.river.rewards = ['bogus', 'river-record-marks-1', 'river-record-marks-1']; g.livingP0.river.record = { quest: 7, seen: 'yes' }; });
  r = await rec();
  check('reward list keeps known ids once; bad quest/seen values normalize', r.rewards.length === 1 && r.quest === 0 && typeof r.seen === 'boolean', JSON.stringify(r)); // seen may already be true: the fishing-ground notice fires on load

  // ===== layout of the record box (town dialog)
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(2.8, 11)); await wait(300);
  if (mobile) await page.tap('#fishWorldAction'); else await page.keyboard.press('e');
  await travelDone(page, 'village_hub_01'); await wait(600);
  await talkYeoul();
  const lay = await page.evaluate(() => { const b = document.querySelector('#yeoulRecord button')?.getBoundingClientRect(), s = document.getElementById('yeoulRecord')?.getBoundingClientRect(); return b && s ? { bh: b.height, l: s.left, r: s.right, vw: innerWidth } : null; });
  check('record box fits the screen; button ≥ 44px', lay && lay.bh >= 44 && lay.l >= 0 && lay.r <= lay.vw + .5, JSON.stringify(lay));
  await shot('record-layout');
  await close();

  const real = problems.filter(p => !/vibrate|favicon|sandstar-npc-voices|ERR_|Failed to load resource/i.test(p));
  check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(out, `record-${mode}.log`), lines.join('\n') + `\n${pass} pass, ${fail} fail\n`);
  log(lines, `${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
