// QA 1차 후속 3건 (local preview only, default build).
// 1) first bite: the lure stays in the water without input (no auto-retrieve), shadows show ?/! cues,
//    and a newcomer's simple twitch pattern gets a first bite in a measured time (logged, 3 tries at A).
// 2) wood shows in 가방 and the town HUD gives a fishing tip on a new save (text follows wood/rod),
//    hidden once a fish has been caught.
// 3) the fight distance bar is bigger with a readable label (canvas drawing: screenshots at ~40% / ≥80%).
// Usage: node followups.cjs <url> <outdir> <pc|m390>
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
  const rs = () => page.evaluate(() => window.__sandstarRiver.state());
  const shot = name => page.screenshot({ path: path.join(out, `${mode}-${name}.png`) });
  const press = sel => (mobile ? page.tap(sel) : page.click(sel));
  const tip = () => page.evaluate(() => { const e = document.getElementById('t25FishTip'); return e ? { hidden: e.hidden || getComputedStyle(e).display === 'none', text: e.textContent.trim() } : null; });
  async function holdBtn(on) {
    const b = await page.locator('#riverHold').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    if (on) await page.mouse.down(); else await page.mouse.up();
  }
  async function tapWater(x, y) {
    const c = await page.locator('#riverCanvas').boundingBox();
    if (mobile) await page.touchscreen.tap(c.x + x, c.y + y); else await page.mouse.click(c.x + x, c.y + y);
  }
  async function edit(fn, arg) {
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await page.evaluate(([src, arg]) => { const k = window.__SANDSTAR_LIVING_P11__.getSaveKey(), g = JSON.parse(localStorage.getItem(k)); (0, eval)(src)(g, arg); localStorage.setItem(k, JSON.stringify(g)); }, [fn.toString(), arg]);
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await continueWorld(page); await wait(1800);
  }

  await newWorld(page, '828282'); await wait(1500);

  // ===== 2) town tip + bag wood
  let t = await tip();
  check('new save: town HUD shows the fishing tip (no wood yet → chop 3 wood)', t && !t.hidden && /원목 3개를 모으면/.test(t.text), JSON.stringify(t));
  await shot('town-tip-nowood');
  await edit((g, n) => { g.inv = g.inv || {}; g.inv.wood = n; }, 3);
  t = await tip();
  check('with 3 wood the tip points to the gate to make a rod', t && !t.hidden && /원목 3개가 있어요/.test(t.text), JSON.stringify(t));
  await press('#town25dRoot [data-scene-profile]'); await wait(600); await press('#ssProfileBag'); await wait(600);
  const bag = await page.evaluate(() => { const b = document.querySelector('#dialog [data-ss-item-key="living:wood"]'); if (!b) return null; b.click(); return b.getAttribute('aria-label'); });
  await wait(400);
  const detail = await page.evaluate(() => document.getElementById('dialog')?.innerText.replace(/\s+/g, ' ') || '');
  check('가방 lists 원목 with its count and uses', bag === '원목 3개' && /낚싯대 제작 3/.test(detail), JSON.stringify({ bag, detail: detail.slice(0, 160) }));
  await shot('bag-wood');
  await page.keyboard.press('Escape'); await wait(300);
  const lay = await page.evaluate(() => { const r = document.getElementById('t25FishTip').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight }; });
  check('tip stays inside the screen', lay.r > lay.l && lay.l >= 0 && lay.r <= lay.vw + .5 && lay.b < lay.vh, JSON.stringify(lay));
  await shot('town-tip-wood');
  await edit(g => { g.livingP0.rod = true; });
  t = await tip();
  check('with a rod the tip sends the player to spots A·B·C', t && !t.hidden && /자리 A·B·C/.test(t.text), JSON.stringify(t));
  await edit(g => { g.livingP0.stats.fished = 1; });
  t = await tip();
  check('after the first catch the tip is gone', t && t.hidden, JSON.stringify(t));

  // ===== 1) first bite at A
  await edit(g => {
    g.livingP0.rod = true; g.livingP0.stats.fished = 0;
    g.fishingWorldV1 = { schema: 1, activeWorldId: 'fishing_01', position: { x: 12.6, y: 15.2 }, entryCount: 2, lastSpot: '' };
  });
  await wait(1500);
  if (mobile) await page.tap('#fishWorldAction'); else await page.keyboard.press('e');
  await wait(800);
  let s = await rs();
  check('spot A opens from the fishing ground', s.open && s.spot === 'A', JSON.stringify({ open: s.open, spot: s.spot }));
  // no-input cast: the lure must not come back on its own
  const fishTarget = () => s.fish.filter(f => f.species === 'river_fish' && f.state !== 'leave').sort((a, b) => b.x - a.x)[0];
  for (let i = 0; i < 30 && !fishTarget(); i++) { await wait(400); s = await rs(); }
  let tg = fishTarget();
  await tapWater(Math.max(s.W * .4, Math.min(s.W * .9, (tg ? tg.x : s.W * .7) + 40)), s.surface + 25); await wait(300);
  s = await rs();
  const castOk = s.phase === 'lure';
  let maxInterest = 0, cueSeen = false;
  const q0 = Date.now();
  while (Date.now() - q0 < 20000) {
    s = await rs(); if (s.phase !== 'lure') break;
    for (const f of s.fish) { maxInterest = Math.max(maxInterest, f.interest); if (f.interest > .15 && f.state !== 'leave') cueSeen = true; }
    await wait(300);
  }
  check('no input for 20s: the lure stays in the water (no auto-retrieve)', castOk && (s.phase === 'lure' || s.phase === 'bite'), `phase ${s.phase}`);
  check('splash/drift makes a shadow show interest (?/! cue drawn at interest > .15)', cueSeen, `max interest ${maxInterest.toFixed(2)}`);
  await shot('lure-cue');
  if (s.phase === 'lure') { await press('#riverRetrieve'); await wait(400); }
  if (s.phase === 'bite') { await wait(2500); }
  // newcomer pattern: cast near the shadow, short tap every second
  const times = [];
  for (let trial = 0; trial < 3; trial++) {
    s = await rs();
    if (s.phase === 'result') { await press('#riverCard button[data-river="again"]'); await wait(400); s = await rs(); }
    if (s.phase === 'lure') { await press('#riverRetrieve'); await wait(400); s = await rs(); }
    for (let i = 0; i < 30 && !fishTarget(); i++) { await wait(400); s = await rs(); }
    tg = fishTarget();
    await tapWater(Math.max(s.W * .4, Math.min(s.W * .9, (tg ? tg.x : s.W * .7) + 50)), s.surface + 25); await wait(250);
    const t0 = Date.now(); let bit = false;
    while (Date.now() - t0 < 40000) {
      s = await rs();
      if (s.phase === 'bite') { bit = true; break; }
      if (s.phase === 'idle') { tg = fishTarget(); await tapWater(Math.max(s.W * .4, Math.min(s.W * .9, (tg ? tg.x : s.W * .7) + 50)), s.surface + 25); await wait(250); continue; }
      await holdBtn(true); await wait(300); await holdBtn(false); await wait(700);
    }
    times.push(bit ? +((Date.now() - t0) / 1000).toFixed(1) : null);
    if (!bit) continue;
    if (trial === 0) await shot('bite-first');
    // hook and fight; take bar screenshots
    await holdBtn(true); await holdBtn(false); await wait(150);
    s = await rs();
    if (s.phase !== 'fight') continue;
    let held = false, s40 = false, s80 = false;
    const f0 = Date.now();
    while (Date.now() - f0 < 60000) {
      s = await rs(); if (s.phase !== 'fight' || s.card) break;
      const open = (s.fight.phase === 'gap' || s.fight.phase === 'loose') && !s.fight.stall;
      if (open && !held) { await holdBtn(true); held = true; }
      if (!open && held) { await holdBtn(false); held = false; }
      if (trial === 0 && !s40 && s.fight.progress > 40) { s40 = true; await shot('fight-bar-40'); }
      if (trial === 0 && !s80 && s.fight.progress >= 82) { s80 = true; await shot('fight-bar-80'); }
      await wait(60);
    }
    if (held) await holdBtn(false);
    await wait(500);
  }
  log(lines, `first-bite times at A (newcomer twitch pattern, s): ${JSON.stringify(times)}`);
  const got = times.filter(x => x !== null);
  check('newcomer pattern gets a bite in every try within 40s', got.length === 3, JSON.stringify(times));
  check('median first bite ≤ 20s', got.length >= 2 && got.sort((a, b) => a - b)[Math.floor(got.length / 2)] <= 20, JSON.stringify(times));

  // ===== 이온 지적: 옛 도감(크기 0)에 있던 물고기는 '새로 기록'이 아니라 '첫 크기 기록'
  const dex = await page.evaluate(() => {
    const L = window.__SANDSTAR_LIVING_P11__, st = JSON.parse(JSON.stringify(L.getState()));
    st.rod = true; st.fishDex = ['river_fish']; st.river.best = { river_fish: 0, perch: 0, carp: 0 }; st.river.attempt = null;
    const ctx = { x: 64, y: 76, groundY: 76, inv: {}, coins: 0 };
    const run = (s, fish, n) => {
      const size = fish === 'river_fish' ? 90 : fish === 'perch' ? 200 : 300;
      const h = L.applyPure(s, { id: 'qa-dex-h' + n, type: 'river.hook', target: 'pond', item: fish, size, spot: 'A', attempt: 'qadex' + n }, ctx);
      if (!h.ok) return { err: h.reason };
      const c = L.applyPure(h.state, { id: 'qa-dex-c' + n, type: 'river.catch', target: 'pond', attempt: 'qadex' + n }, ctx);
      return c.ok ? { st: c.state, firstDex: c.river?.firstDex, firstSize: c.river?.firstSize, record: c.river?.record } : { err: c.reason };
    };
    const a = run(st, 'river_fish', 1), b = a.st ? run(a.st, 'perch', 2) : { err: 'skip' }, c = a.st ? run(a.st, 'river_fish', 3) : { err: 'skip' };
    const strip = r => ({ err: r.err, firstDex: r.firstDex, firstSize: r.firstSize, record: r.record });
    return { a: strip(a), b: strip(b), c: strip(c) };
  });
  check('old dex entry with no size: first catch is a first size record, not a new dex entry', dex.a.firstDex === false && dex.a.firstSize === true, JSON.stringify(dex.a));
  check('a species not in the dex is still a new dex entry', dex.b.firstDex === true && dex.b.firstSize === false, JSON.stringify(dex.b));
  check('same species again: neither new dex nor first size', dex.c.firstDex === false && dex.c.firstSize === false, JSON.stringify(dex.c));

  const real = problems.filter(p => !/vibrate|favicon/i.test(p));
  check('no page errors', real.length === 0, real.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(out, `followups-${mode}.log`), lines.join('\n') + `\n${pass} pass, ${fail} fail\n`);
  log(lines, `${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
