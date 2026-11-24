// Gate 3: cooking — bread (wheat x2), carrot soup (carrot x2), fish stew (any fish x1 + potato x1)
// at the village kitchen counter; blocked with a visible reason when short; dishes stay in the bag
// and restore energy when eaten; state survives reload. PC 1280x800 and mobile 390x844.
// Fish come from a save fixture (fishing itself is out of B scope); crops are farmed for real.
// Usage: node gate3-cooking.cjs <url> <outdir>
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, continueWorld, enterFarm, exitFarmToTown, log } = require('./lib.cjs');

const url = process.argv[2] || 'http://127.0.0.1:8739/';
const out = process.argv[3] || '.';
fs.mkdirSync(out, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; log(lines, `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const SAVE_KEY = 'sandstar-p1-world-v1:official-m25d';
const PLOTS = { wheat: [18, 15], potato: [24, 15], carrot: [30, 15] };

const st = page => page.evaluate(() => window.__sandstarFarmCooking.state());
async function farmOnce(page, crop) {
  const [x, y] = PLOTS[crop];
  await page.evaluate(([x, y]) => window.__sandstarFarmWorld.testMove(x, y + 2.2), [x, y]);
  await page.click(`[data-farm-seed="${crop}"]`);
  const sec = (await page.evaluate(() => window.__sandstarFarmCooking.stageSeconds()))[crop];
  await page.click('#farmWorldAction'); // plant
  for (let i = 0; i < 2; i++) { await page.click('#farmWorldAction'); await page.evaluate(s => window.__sandstarFarmCooking.advance(s), sec + 0.01); }
  await page.click('#farmWorldAction'); // harvest
}
async function goKitchen(page) {
  const ok = await page.evaluate(() => window.__sandstarTown25D.move(-3.4, -4.8));
  await page.waitForTimeout(150);
  return ok && (await page.evaluate(() => window.__sandstarFarmCooking.kitchen().near));
}
async function openKitchen(page) {
  await page.click('#town25dAction');
  await page.waitForSelector('.fcb-kitchen', { timeout: 5000 });
}
async function closeModal(page) {
  await page.click('#backBtn').catch(() => {});
  await page.waitForTimeout(150);
}
const reasonOf = (page, id) => page.evaluate(id => { const el = document.querySelector(`[data-fcb-reason="${id}"]`); return el && !el.hidden ? el.textContent : ''; }, id);
const cookDisabled = (page, id) => page.evaluate(id => document.querySelector(`[data-fcb-cook="${id}"]`).disabled, id);

(async () => {
  for (const mobile of [false, true]) {
    const tag = mobile ? 'm390' : 'pc';
    log(lines, `== Gate 3 ${tag} ${new Date().toISOString()} ${url}`);
    let { browser, page, problems } = await openGame({ url, mobile });
    await newWorld(page, mobile ? '97531' : '13579');
    log(lines, 'recipes', await page.evaluate(() => Object.fromEntries(Object.entries(window.__sandstarFarmCooking.recipes()).map(([k, v]) => [k, { needs: v.needs, energy: v.energy, wood: v.wood }]))));

    // --- far from the counter: cooking refused
    const far = await page.evaluate(() => window.__sandstarFarmCooking.cook('bread'));
    check(`${tag}: cooking away from the counter refused`, far.ok === false && /요리대 가까이/.test(far.reason), far.reason);

    // --- empty bag: all three blocked with reasons
    check(`${tag}: walk to village kitchen counter`, await goKitchen(page));
    const lbl = (await page.textContent('#town25dAction')).trim();
    check(`${tag}: action button offers the counter`, lbl === '🍳 요리대 이용', lbl);
    await openKitchen(page);
    for (const [id, re] of [['bread', /밀 2개 더 필요 \(보유 0\/2\)/], ['soup', /당근 2개 더 필요 \(보유 0\/2\)/], ['stew', /물고기 1개 더 필요 \(보유 0\/1\).*감자 1개 더 필요 \(보유 0\/1\)/]]) {
      const reason = await reasonOf(page, id);
      check(`${tag}: ${id} blocked with reason when bag is empty`, (await cookDisabled(page, id)) && re.test(reason), reason);
    }
    await page.screenshot({ path: path.join(out, `${tag}-kitchen-empty.png`) });
    const eng = await page.evaluate(() => window.__sandstarFarmCooking.cook('stew'));
    check(`${tag}: engine also refuses stew with reason`, eng.ok === false && /재료가 부족해요/.test(eng.reason), eng.reason);
    await closeModal(page);

    // --- farm real ingredients
    await enterFarm(page);
    for (const crop of ['wheat', 'carrot', 'potato']) await farmOnce(page, crop);
    let s = await st(page);
    check(`${tag}: farmed wheat/carrot/potato 3 each`, s.bag.wheat === 3 && s.bag.carrot === 3 && s.bag.potato === 3, JSON.stringify({ w: s.bag.wheat, c: s.bag.carrot, p: s.bag.potato }));
    await exitFarmToTown(page);

    // --- fixture: one perch (not the default river fish, proves "any fish"), energy 40
    // The game saves on unload, so edit the save in a closed session and reopen with it.
    await page.evaluate(() => window.__sandstarTown25D.move(0, 4));
    await page.waitForTimeout(300);
    const state = await page.context().storageState();
    check(`${tag}: no errors before fixture`, problems.length === 0, problems.slice(0, 5).join(' | '));
    await browser.close();
    for (const o of state.origins) for (const it of o.localStorage) if (it.name === SAVE_KEY) { const g = JSON.parse(it.value); g.livingP0.bag.perch = 1; g.livingP0.energy = 40; it.value = JSON.stringify(g); }
    ({ browser, page, problems } = await openGame({ url, mobile, storageState: state }));
    await continueWorld(page);
    await page.waitForFunction(() => window.__sandstarTown25D.state().active, null, { timeout: 30000 });
    s = await st(page);
    check(`${tag}: fixture loaded (perch 1, energy 40)`, s.bag.perch === 1 && Math.floor(s.energy) === 40, JSON.stringify({ perch: s.bag.perch, energy: s.energy }));

    // --- cook all three through the UI
    await goKitchen(page);
    await openKitchen(page);
    await page.screenshot({ path: path.join(out, `${tag}-kitchen-ready.png`) });
    for (const id of ['bread', 'soup', 'stew']) {
      const before = await st(page);
      check(`${tag}: ${id} enabled with ingredients`, !(await cookDisabled(page, id)), await reasonOf(page, id));
      await page.click(`[data-fcb-cook="${id}"]`);
      await page.waitForTimeout(150);
      const after = await st(page);
      check(`${tag}: cooked ${id} -> bag +1, counted`, after.bag[id] === before.bag[id] + 1 && after.counts.cooked[id] === before.counts.cooked[id] + 1 && after.stats.cooked === before.stats.cooked + 1);
    }
    s = await st(page);
    check(`${tag}: ingredients consumed exactly (wheat 3-2, carrot 3-2, potato 3-1, perch 1-1)`, s.bag.wheat === 1 && s.bag.carrot === 1 && s.bag.potato === 2 && s.bag.perch === 0 && s.bag.river_fish === 0 && s.bag.carp === 0, JSON.stringify({ w: s.bag.wheat, c: s.bag.carrot, p: s.bag.potato, perch: s.bag.perch }));
    for (const [id, re] of [['bread', /밀 1개 더 필요 \(보유 1\/2\)/], ['soup', /당근 1개 더 필요 \(보유 1\/2\)/], ['stew', /물고기 1개 더 필요 \(보유 0\/1\)/]]) {
      const reason = await reasonOf(page, id);
      check(`${tag}: ${id} blocked again after use, partial shortfall shown`, (await cookDisabled(page, id)) && re.test(reason), reason);
    }
    const stewReason = await reasonOf(page, 'stew');
    check(`${tag}: stew reason does not ask for potato (2 owned)`, !/감자/.test(stewReason), stewReason);
    if (mobile) {
      const ov = await page.evaluate(() => { const vw = innerWidth; const d = document.getElementById('dialog'); const bad = [...d.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5); }).map(el => el.className || el.tagName); return { scrollW: document.documentElement.scrollWidth, dialogW: d.scrollWidth - d.clientWidth, vw, bad, pcKeys: /WASD|방향키/.test(d.innerText) }; });
      check(`${tag}: kitchen modal fits 390 (no overflow)`, ov.scrollW <= ov.vw && ov.dialogW <= 0 && ov.bad.length === 0, JSON.stringify(ov));
      check(`${tag}: no PC key hints in kitchen modal`, !ov.pcKeys);
    }
    await page.screenshot({ path: path.join(out, `${tag}-kitchen-cooked.png`) });

    // --- eat: soup from the kitchen, bread from the bag (가방 > 생활)
    let before = await st(page);
    await page.click('[data-fcb-eat="soup"]');
    await page.waitForTimeout(150);
    let after = await st(page);
    check(`${tag}: eat soup at kitchen -> energy +35, soup -1, buff`, Math.floor(after.energy) === Math.min(100, Math.floor(before.energy) + 35) && after.bag.soup === before.bag.soup - 1 && after.foodBuff?.type === 'wood', `${Math.floor(before.energy)}->${Math.floor(after.energy)}`);
    await closeModal(page);
    await page.click('#town25dBag');
    await page.waitForSelector('[data-ss-item-tab="living"]');
    await page.click('[data-ss-item-tab="living"]');
    await page.waitForTimeout(100);
    const bagItems = await page.evaluate(() => [...document.querySelectorAll('[data-ss-item-key]')].map(b => b.dataset.ssItemKey));
    check(`${tag}: bag 생활 tab lists dishes and crops`, ['living:bread', 'living:stew', 'living:wheat', 'living:potato', 'living:carrot'].every(k => bagItems.includes(k)), bagItems.join(','));
    await page.click('[data-ss-item-key="living:bread"]');
    await page.waitForTimeout(100);
    const btn = (await page.textContent('#ssBagEquip')).trim();
    await page.screenshot({ path: path.join(out, `${tag}-bag-living.png`) });
    before = await st(page);
    await page.click('#ssBagEquip');
    await page.waitForTimeout(150);
    after = await st(page);
    check(`${tag}: eat bread from bag (button "${btn}") -> energy +25 (cap 100), bread -1`, btn === '먹기' && Math.floor(after.energy) === Math.min(100, Math.floor(before.energy) + 25) && after.bag.bread === before.bag.bread - 1 && after.foodBuff?.type === 'harvest', `${Math.floor(before.energy)}->${Math.floor(after.energy)}`);
    await page.click('[data-ss-item-key="living:wheat"]').catch(() => {});
    await page.waitForTimeout(100);
    check(`${tag}: ingredient in bag is not edible`, await page.evaluate(() => document.getElementById('ssBagEquip').disabled));
    await closeModal(page);
    const none = await page.evaluate(() => window.__sandstarFarmCooking.eat('bread'));
    check(`${tag}: eating with no bread refused`, none.ok === false && /먹을 요리가 없어요/.test(none.reason), none.reason);

    // --- persistence
    const keep = o => JSON.stringify({ bag: o.bag, counts: o.counts, cooked: o.stats.cooked, buff: o.foodBuff?.type });
    const pre = await st(page);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await continueWorld(page);
    const post = await st(page);
    check(`${tag}: dishes, counts and buff survive reload`, keep(pre) === keep(post) && post.bag.stew === 1, keep(post));
    check(`${tag}: energy survives reload`, Math.abs(post.energy - pre.energy) < 2, `${pre.energy} -> ${post.energy}`);
    check(`${tag}: no page/console errors, no failed requests`, problems.length === 0, problems.slice(0, 5).join(' | '));
    await browser.close();
  }
  log(lines, `== Gate 3 total: ${pass} pass, ${fail} fail`);
  fs.writeFileSync(path.join(out, 'gate3.log'), lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { log(lines, 'ERROR ' + e.stack); fs.writeFileSync(path.join(out, 'gate3.log'), lines.join('\n') + '\n'); process.exit(2); });
