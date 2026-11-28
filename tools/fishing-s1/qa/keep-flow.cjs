// 남길 수량 + 판매·요리 미리보기 QA (local preview only, default build).
// Fixture: fish/potatoes in the bag (written on the title screen), then the real town UI:
// 바람장터 '생활 물품' tab (previews, keep steppers, selling), 요리대 fish pick + preview + cook,
// fisher delivery and kept-fish sale rejected by the engine, keep survives reload.
// Usage: node keep-flow.cjs <url> <outdir> <pc|m390>
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

(async () => {
  const { browser, page, problems } = await openGame({ url, mobile });
  const press = sel => (mobile ? page.tap(sel) : page.click(sel));
  const shot = name => page.screenshot({ path: path.join(out, `${mode}-${name}.png`) });
  const living = () => page.evaluate(() => window.__SANDSTAR_LIVING_P11__.getState());
  const coins = () => page.evaluate(() => window.__sandstarTitleP0.state().worldCoins);
  const fixture = async bag => {
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await page.evaluate(b => { const k = window.__SANDSTAR_LIVING_P11__.getSaveKey(), g = JSON.parse(localStorage.getItem(k)); Object.assign(g.livingP0.bag, b); localStorage.setItem(k, JSON.stringify(g)); }, bag);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await continueWorld(page); await wait(2000);
  };
  async function openMarketLiving() {
    await page.evaluate(() => window.__sandstarTown25D.move(-9, -1.7)); await wait(300);
    await press('#town25dAction'); await wait(500);
    await press('[data-section="living"]'); await wait(400);
  }
  const row = id => page.evaluate(id => { const r = document.querySelector(`[data-lrow="${id}"]`); return r ? { text: r.innerText.replace(/\s+/g, ' '), sells: [...r.querySelectorAll('[data-lsell]')].map(b => ({ n: +b.dataset.n, label: b.textContent, off: b.disabled })) } : null; }, id);
  const closeModal = async () => { await page.keyboard.press('Escape'); await wait(300); };

  await newWorld(page, '737373'); await wait(800);
  await fixture({ river_fish: 2, perch: 2, carp: 1, potato: 3 });

  // ===== market · 생활 물품
  await openMarketLiving();
  let rf = await row('river_fish'), pe = await row('perch');
  check('market has a 생활 물품 tab listing fish with price and sellable count', !!rf && /개당 8C/.test(rf.text) && /판매 가능 2/.test(rf.text) && !!pe, JSON.stringify({ rf, pe }).slice(0, 220));
  check('sell buttons preview count and coins', rf.sells.some(s => s.n === 1 && /\+8C/.test(s.label)) && rf.sells.some(s => s.n === 2 && /\+16C/.test(s.label)), JSON.stringify(rf.sells));
  await shot('market-living');
  // keep two perch
  for (let i = 0; i < 2; i++) { await press('[data-lkeep="perch"][data-d="1"]'); await wait(350); }
  pe = await row('perch');
  let lv = await living();
  check('keep stepper sets 남김 2 for perch (saved state)', lv.river.keep.perch === 2 && /남김 2/.test(pe.text) && /판매 가능 0/.test(pe.text) && pe.sells.every(s => s.off), JSON.stringify({ keep: lv.river.keep, pe }).slice(0, 220));
  const summary = await page.evaluate(() => document.querySelector('.market-summary')?.innerText || '');
  check('market summary says kept fish are not sold', /남겨 둔 물고기 2마리/.test(summary), summary.slice(0, 120));
  await shot('market-keep');
  const c0 = await coins();
  await press('[data-lsell="river_fish"][data-n="2"]'); await wait(400);
  lv = await living(); const c1 = await coins();
  check('selling 2 river fish pays exactly the previewed +16C', c1 - c0 === 16 && lv.bag.river_fish === 0, `${c0} → ${c1}, bag ${lv.bag.river_fish}`);
  const rej = await page.evaluate(() => { const L = window.__SANDSTAR_LIVING_P11__, st = L.getState(); return L.applyPure(st, { id: 'qa-sell-kept', type: 'market.sell', target: 'market', item: 'perch' }, { x: 23, y: 0, groundY: 0, inv: {}, coins: 0 }); });
  check('engine refuses to sell a kept perch', rej.ok === false && /남길 수량/.test(rej.reason), rej.reason);
  await closeModal();

  // ===== kitchen · pick + preview
  await page.evaluate(() => window.__sandstarTown25D.move(-3.4, -4.8)); await wait(300);
  await press('#town25dAction'); await wait(800);
  let k = await page.evaluate(() => { const r = document.querySelector('[data-fcb-recipe="stew"]'); return { picks: [...r.querySelectorAll('[data-fish-pick]')].map(b => b.dataset.fishPick + (b.disabled ? '-' : '+') + (b.classList.contains('on') ? '*' : '')), preview: r.querySelector('[data-fish-preview]')?.textContent || '', head: document.querySelector('.fcb-energy')?.textContent || '' }; });
  check('stew offers only unkept fish (carp), preview names it and keeps the rest', k.picks.join(',') === 'river_fish-,perch-,carp+*' && /비단잉어 1/.test(k.preview) && /남긴 물고기는 그대로/.test(k.preview) && /남김 강농어 2/.test(k.head), JSON.stringify(k));
  await shot('kitchen-pick');
  await press('[data-fcb-cook="stew"]'); await wait(600);
  lv = await living();
  check('cooking uses the picked carp, kept perch untouched', lv.bag.carp === 0 && lv.bag.perch === 2 && lv.bag.potato === 2 && lv.bag.stew === 1, JSON.stringify({ carp: lv.bag.carp, perch: lv.bag.perch, potato: lv.bag.potato, stew: lv.bag.stew }));
  k = await page.evaluate(() => { const r = document.querySelector('[data-fcb-recipe="stew"]'); return { off: r.querySelector('[data-fcb-cook]')?.disabled, why: r.querySelector('[data-fcb-reason]')?.textContent || '', preview: r.querySelector('[data-fish-preview]')?.textContent || '' }; });
  check('with only kept fish left, stew is blocked with the keep reason', k.off === true && /남길 수량/.test(k.why), JSON.stringify(k));
  await closeModal();

  // ===== fisher delivery respects keep (engine), keep lowered through the living menu
  const del = await page.evaluate(() => { const L = window.__SANDSTAR_LIVING_P11__, st = L.getState(); return L.applyPure(st, { id: 'qa-deliver', type: 'npc.deliver', target: 'npc:fisher' }, { x: 64, y: 0, groundY: 0, inv: {}, coins: 0 }); });
  check('fisher delivery refuses kept fish', del.ok === false && /남길 물고기 제외/.test(del.reason), del.reason);
  await page.evaluate(() => window.__SANDSTAR_LIVING_P11__.setTab('fish')); await wait(400);
  check('living menu fish tab shows keep steppers', await page.evaluate(() => !!document.querySelector('#dialog [data-lkeep="perch"]')));
  await press('#dialog [data-lkeep="perch"][data-d="-1"]'); await wait(400);
  lv = await living();
  check('lowering 남김 in the living menu frees one perch', lv.river.keep.perch === 1, JSON.stringify(lv.river.keep));
  await closeModal();

  // ===== keep survives reload
  await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await continueWorld(page); await wait(1500);
  lv = await living();
  check('남길 수량 persists after reload', lv.river.keep.perch === 1 && lv.bag.perch === 2, JSON.stringify({ keep: lv.river.keep, perch: lv.bag.perch }));

  // ===== layout at the market tab
  await openMarketLiving();
  const lay = await page.evaluate(() => { const b = document.querySelector('[data-lkeep="perch"][data-d="1"]')?.getBoundingClientRect(); return b ? { w: b.width, h: b.height, right: b.right, vw: innerWidth } : null; });
  check('keep buttons are at least 40px and inside the screen', lay && lay.h >= 40 && lay.w >= 40 && lay.right <= lay.vw, JSON.stringify(lay));
  await closeModal();

  const real = problems.filter(p => !/vibrate|favicon/i.test(p));
  check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(out, `keep-${mode}.log`), lines.join('\n') + `\n${pass} pass, ${fail} fail\n`);
  log(lines, `${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
