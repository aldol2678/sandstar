// 3D fishing ground probe (local preview only): enter fishing_01, read renderer + frame times, screenshots.
// Headless Chromium renders WebGL in software, so frame times are relative, not device numbers.
// Usage: node world3d-probe.cjs <pc|m390> <outdir> [url]
const { openGame, newWorld } = require('../../farm-cooking-b/qa/lib.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const mobile = process.argv[2] === 'm390';
  const { browser, page, problems } = await openGame({ url: process.argv[4] || 'http://127.0.0.1:8790/', mobile });
  await newWorld(page, '99');
  await page.evaluate(() => window.__sandstarTown25D.move(18, -0.5)); await wait(250);
  await page.click('#town25dAction');
  await page.waitForFunction(() => window.__sandstarWorldLoadingM25B.ready('fishing_01') && !window.__sandstarWorldLoadingM25B.state().busy, null, { timeout: 30000 });
  await wait(2500);
  const st = await page.evaluate(() => window.__sandstarFishingWorld.state());
  console.log(JSON.stringify({ renderer: st.renderer, frameMs: st.frameMs, player: st.player }));
  await page.screenshot({ path: process.argv[3] + '/3d-arrive-' + process.argv[2] + '.png' });
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(18.6, 8)); await wait(1500);
  await page.screenshot({ path: process.argv[3] + '/3d-dock-' + process.argv[2] + '.png' });
  await page.evaluate(() => window.__sandstarFishingWorld.testMove(12.2, 15.2)); await wait(1500);
  await page.screenshot({ path: process.argv[3] + '/3d-A-' + process.argv[2] + '.png' });
  console.log(JSON.stringify((await page.evaluate(() => window.__sandstarFishingWorld.state())).frameMs), problems.slice(0, 5));
  await browser.close();
})();
