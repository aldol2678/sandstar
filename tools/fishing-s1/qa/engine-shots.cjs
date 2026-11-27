// Engine comparison evidence (local preview only): 390×844 screenshots + frame timing of the three existing
// world renderers a dedicated fishing ground could reuse: town (Canvas2D isometric), farm (Canvas2D top-down),
// ruins (three/WebGL). Headless Chromium uses software GL, so frame times are relative evidence, not device numbers.
// Usage: node engine-shots.cjs <url> <outdir>
const fs = require('fs');
const path = require('path');
const { openGame, newWorld, enterFarm, exitFarmToTown, log } = require('../../farm-cooking-b/qa/lib.cjs');
const [url, out] = [process.argv[2], process.argv[3] || '.'];
fs.mkdirSync(out, { recursive: true });
const lines = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page } = await openGame({ url, mobile: true });
  const fps = name => page.evaluate(async name => {
    const t = []; let last = performance.now();
    await new Promise(res => { let n = 0; const f = now => { t.push(now - last); last = now; if (++n < 90) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    t.sort((a, b) => a - b); return { name, medianMs: +t[45].toFixed(1), p90Ms: +t[81].toFixed(1) };
  }, name);
  await newWorld(page, '313131');
  await page.evaluate(() => window.__sandstarTown25D.move(18, -0.5)); await wait(500);
  await page.screenshot({ path: path.join(out, 'engine-town-fishing-gate.png') });
  log(lines, JSON.stringify(await fps('town canvas2d-isometric')));
  await enterFarm(page); await wait(500);
  await page.screenshot({ path: path.join(out, 'engine-farm.png') });
  log(lines, JSON.stringify(await fps('farm canvas2d-topdown')));
  await exitFarmToTown(page);
  await page.evaluate(() => window.__sandstarTown25D.move(17, -10.6)); await wait(200);
  await page.keyboard.down('ArrowUp');
  try { await page.waitForFunction(() => window.__sandstarArchWorld.state().active, null, { timeout: 25000 }); } catch (_) {}
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => window.__sandstarWorldLoadingM25B.ready('ruins_3d_01') && !window.__sandstarWorldLoadingM25B.state().busy, null, { timeout: 30000 }).catch(() => {});
  await wait(1200);
  const a = await page.evaluate(() => window.__sandstarArchWorld.state());
  log(lines, 'ruins state: ' + JSON.stringify({ active: a.active, renderer: a.renderer, worldId: a.worldId }));
  await page.screenshot({ path: path.join(out, 'engine-ruins-three.png') });
  log(lines, JSON.stringify(await fps('ruins three/webgl')));
  fs.writeFileSync(path.join(out, 'engine-shots.log'), lines.join('\n') + '\n');
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
