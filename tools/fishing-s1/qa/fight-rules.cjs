// Fight-rule check (local preview only), independent of luring luck.
// Each species starts from a save fixture that already has a hooked fish at spot B of the fishing
// ground (river.attempt, progress 0) and the player standing on the B ring, so the fight starts
// every time. The bot only reads __sandstarRiver.state() and presses/releases the real hold button.
//
// Expected values (river-core/river-ui RIVER_FIGHT):
//   idle     5s without input → progress unchanged (exact)
//   hold     holding nonstop reaches stall within 10s; 1s more holding after the stall → progress unchanged
//   release  after letting go, progress never decreases (2s), and the stall clears (strain decays 0.9/s)
//   land     holding only in gap/loose (and not while stalled) lands the fish: phase result, bag +1,
//            river.attempt cleared, attempt id in river.done
// Usage: node fight-rules.cjs <url> <outdir> <pc|m390> [species,...]
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, continueWorld, log } = require('../../farm-cooking-b/qa/lib.cjs');

const [url, out, mode, list] = [process.argv[2] || 'http://127.0.0.1:8790/', process.argv[3] || '.', process.argv[4] || 'pc', process.argv[5] || 'river_fish,perch,carp'];
const SIZE = { river_fish: 90, perch: 220, carp: 320 };
fs.mkdirSync(out, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; log(lines, `${ok ? 'PASS' : 'FAIL'} ${mode}: ${name}${detail ? ' — ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function runSpecies(species) {
  const { browser, page, problems } = await openGame({ url, mobile: mode === 'm390' });
  const rs = () => page.evaluate(() => window.__sandstarRiver.state());
  async function holdBtn(on) {
    const b = await page.locator('#riverHold').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    if (on) await page.mouse.down(); else await page.mouse.up();
  }
  try {
    await newWorld(page, '414141');
    await wait(800);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    const attemptId = 'qa-fight-' + species;
    // fixture written on the title screen, then a clean reload so the game reads it
    await page.evaluate(([fish, size, id]) => {
      const k = window.__SANDSTAR_LIVING_P11__.getSaveKey(), g = JSON.parse(localStorage.getItem(k));
      g.livingP0.rod = true;
      g.livingP0.river = { schema: 1, best: { river_fish: 0, perch: 0, carp: 0 }, spots: { A: 0, B: 0, C: 0 }, attempt: { id, fish, spot: 'B', size, progress: 0 }, done: [], assist: false };
      g.fishingWorldV1 = { schema: 1, activeWorldId: 'fishing_01', position: { x: 19.2, y: 8 }, entryCount: 1, lastSpot: 'B' };
      g.storyM1.region = 'life_forest_01';
      localStorage.setItem(k, JSON.stringify(g));
    }, [species, SIZE[species], attemptId]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
    await continueWorld(page); await wait(2500);
    const w = await page.evaluate(() => window.__sandstarFishingWorld.state());
    check(`${species}: fixture opens in the fishing ground at B`, w.active && w.nearSpot === 'B', JSON.stringify({ active: w.active, near: w.nearSpot }));
    if (mode === 'm390') await page.tap('#fishWorldAction'); else await page.keyboard.press('e');
    await wait(500);
    let s = await rs();
    check(`${species}: hooked fish restored with the resume card`, s.open && s.card === 'resume' && s.fight && s.fight.fish === species, JSON.stringify({ open: s.open, card: s.card, fight: s.fight }));
    if (!(s.open && s.fight)) return;
    await page.click('#riverCard button[data-river="resume"]'); await wait(1100);

    // idle
    const a = (await rs()).fight.progress; await wait(5000); const b = (await rs()).fight.progress;
    check(`${species}: 5s without input → progress unchanged`, a === b, JSON.stringify({ before: a, after: b }));
    // hold → stall
    await holdBtn(true);
    let stall = null; const t0 = Date.now();
    while (Date.now() - t0 < 10000) { const st = await rs(); if (st.fight.stall) { stall = { atMs: Date.now() - t0, progress: st.fight.progress, strain: +st.fight.strain.toFixed(2) }; break; } await wait(50); }
    let afterStall = null; if (stall) { await wait(1000); afterStall = (await rs()).fight.progress; }
    check(`${species}: holding nonstop reaches a stall within 10s`, !!stall, JSON.stringify(stall));
    check(`${species}: 1s more holding while stalled → progress unchanged`, !!stall && afterStall === stall.progress, JSON.stringify({ stalled: stall && stall.progress, after: afterStall }));
    // release
    await holdBtn(false);
    const r0 = (await rs()).fight.progress; await wait(2000); const r1s = await rs();
    check(`${species}: releasing never lowers progress`, r1s.fight.progress >= r0, JSON.stringify({ atRelease: r0, after2s: r1s.fight.progress }));
    check(`${species}: the stall clears after resting`, r1s.fight.stall === false, JSON.stringify({ strain: +r1s.fight.strain.toFixed(2), stall: r1s.fight.stall }));
    // land with the skilled policy
    let held = false; const t1 = Date.now();
    while (Date.now() - t1 < 60000) {
      const st = await rs(); if (st.phase !== 'fight') break;
      const open = (st.fight.phase === 'gap' || st.fight.phase === 'loose') && !st.fight.stall;
      if (open !== held) { await holdBtn(open); held = open; }
      await wait(50);
    }
    if (held) await holdBtn(false);
    await wait(300);
    s = await rs();
    const lv = await page.evaluate(() => window.__SANDSTAR_LIVING_P11__.getState());
    check(`${species}: holding only in open gaps lands the fish once`, s.phase === 'result' && lv.bag[species] === 1 && lv.river.attempt === null && lv.river.done.includes(attemptId), JSON.stringify({ phase: s.phase, bag: lv.bag[species], attempt: lv.river.attempt, landedInS: ((Date.now() - t1) / 1000).toFixed(1) }));
    const real = problems.filter(p => !/vibrate|favicon/i.test(p));
    check(`${species}: no page errors`, real.length === 0, real.slice(0, 3).join(' | '));
  } finally { await browser.close(); }
}

(async () => {
  for (const sp of list.split(',')) await runSpecies(sp.trim());
  fs.writeFileSync(path.join(out, `fight-rules-${mode}.log`), lines.join('\n') + `\n${pass} pass, ${fail} fail\n`);
  log(lines, `${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
