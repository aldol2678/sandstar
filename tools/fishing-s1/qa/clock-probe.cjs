// Life-clock probe (local preview only): same save, livingP0.clock while walking in 잔빛숲, while fishing
// (active), while the fishing pause card is up, after closing, and in the 2.5D town. Read-only state reads.
// Usage: node clock-probe.cjs <url> <outdir> <label>
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, log } = require('../../farm-cooking-b/qa/lib.cjs');
const [url, out, label] = [process.argv[2], process.argv[3] || '.', process.argv[4] || 'build'];
fs.mkdirSync(out, { recursive: true });
const lines = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page } = await openGame({ url });
  const clock = () => page.evaluate(() => window.__SANDSTAR_LIVING_P11__.getState().clock);
  async function span(name, ms, during) {
    const a = await clock(), t = Date.now();
    if (during) await during(ms); else await wait(ms);
    const b = await clock(), real = (Date.now() - t) / 1000;
    log(lines, `${label} · ${name}: clock +${(b - a).toFixed(2)}s over ${real.toFixed(2)}s real`);
  }
  await newWorld(page, '424242');
  await span('town 2.5D idle', 4000);
  await page.evaluate(() => window.__sandstarTown25D.move(15, 11)); await wait(200);
  await page.click('#town25dAction');
  await page.waitForFunction(() => window.__sandstarWorldLoadingM25B.ready('life_forest_01') && !window.__sandstarWorldLoadingM25B.state().busy, null, { timeout: 30000 });
  await wait(600);
  const h = await page.evaluate(() => window.__sandstarHUDM15.get()); if (h.manualMining) await page.evaluate(() => window.__sandstarHUDM15.toggleTool());
  await page.evaluate(() => { const y = window.__sandstarTownM22.surface(52); window.__sandstarHUDM15.setTestPosition(52.5, y - 1); }); await wait(300);
  await span('forest side-scroll, walking right', 4000, async ms => { await page.keyboard.down('ArrowRight'); await wait(ms / 2); await page.keyboard.up('ArrowRight'); await wait(ms / 2); });
  await page.evaluate(() => { const y = window.__sandstarTownM22.surface(82); window.__sandstarHUDM15.setTestPosition(82.5, y - 1); }); await wait(300);
  await page.keyboard.press('e'); await wait(400); // chop: 3 wood for the rod
  await page.evaluate(() => { const y = window.__sandstarTownM22.surface(63); window.__sandstarHUDM15.setTestPosition(63.5, y - 1); }); await wait(300);
  await page.keyboard.press('e'); await wait(400);
  await page.click('#riverCard button[data-river="craft"]').catch(() => {}); await wait(300);
  log(lines, `${label} · fishing open: ${await page.evaluate(() => window.__sandstarRiver.isOpen())}`);
  await span('fishing view, active (idle, no card)', 3000);
  await page.click('#riverPause').catch(() => {}); await wait(200);
  const st = await page.evaluate(() => window.__sandstarRiver.state());
  log(lines, `${label} · after pause button: paused=${st.paused} card=${st.card}`);
  await span('fishing view, paused card', 3000);
  await page.keyboard.press('Escape'); await wait(300);
  await span('forest after closing fishing', 3000);
  fs.writeFileSync(path.join(out, `clock-${label}.log`), lines.join('\n') + '\n');
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
