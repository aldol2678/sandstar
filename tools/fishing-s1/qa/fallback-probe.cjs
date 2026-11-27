// Fallback probe (local preview only): hide window.THREE, enter fishing_01 and fish on the 2D renderer.
// Usage: node fallback-probe.cjs <outdir> [url]
const { chromium, devices } = require('playwright');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  // simulate a device without three.js/WebGL: the inline bundle's assignment is swallowed
  await ctx.addInitScript(() => { Object.defineProperty(window, 'THREE', { configurable: false, get: () => undefined, set: () => {} }); });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(process.argv[3] || 'http://127.0.0.1:8790/', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  await page.click('#ssNew'); await page.fill('#ssSeedInput', '7'); await page.click('#ssConfirmCreate');
  await page.waitForFunction(() => window.__sandstarTown25D?.state().active, null, { timeout: 60000 });
  for (let i = 0; i < 8; i++) { await page.click('#ssGuideSkip').catch(() => {}); await wait(100); }
  await page.evaluate(() => window.__sandstarTown25D.move(18, -0.5)); await wait(250);
  await page.tap('#town25dAction');
  const ok = await page.waitForFunction(() => window.__sandstarWorldLoadingM25B.ready('fishing_01') && !window.__sandstarWorldLoadingM25B.state().busy, null, { timeout: 30000 }).then(() => true, () => false);
  await wait(800);
  const st = await page.evaluate(() => window.__sandstarFishingWorld.state());
  console.log(JSON.stringify({ entered: ok, renderer: st.renderer, active: st.active, errs: errs.slice(0, 3) }));
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(12.6, 15.2)); await wait(300);
  await page.tap('#fishWorldAction'); await wait(500);
  console.log('river open on cpu fallback:', await page.evaluate(() => window.__sandstarRiver.isOpen()));
  await page.screenshot({ path: process.argv[2] + '/cpu-fallback.png' });
  await browser.close();
})();
