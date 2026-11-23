// Shared Playwright helpers for the farm+cooking B gates (local preview only).
const { chromium, devices } = require('playwright');

async function openGame({ url, mobile = false, storageState, serviceWorkers } = {}) {
  const browser = await chromium.launch();
  const ctxOpts = mobile
    ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }
    : { viewport: { width: 1280, height: 800 } };
  if (storageState) ctxOpts.storageState = storageState;
  // 'block' lets page.route intercept fetches that the game's PWA service worker would otherwise handle.
  if (serviceWorkers) ctxOpts.serviceWorkers = serviceWorkers;
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
  page.on('requestfailed', r => problems.push('requestfailed: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText || '')));
  page.on('response', r => { if (r.status() >= 400) problems.push('http ' + r.status() + ': ' + r.url().slice(0, 120)); });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__sandstarTitleP0, null, { timeout: 60000 });
  return { browser, context, page, problems };
}

async function newWorld(page, seed = '12345') {
  await page.click('#ssNew');
  await page.fill('#ssSeedInput', seed);
  await page.click('#ssConfirmCreate');
  await page.waitForFunction(() => window.__sandstarTown25D?.state().active && window.__sandstarTown25D.state().engine === 'running', null, { timeout: 60000 });
  // dismiss the first-run guide if shown
  for (let i = 0; i < 12; i++) {
    const vis = await page.evaluate(() => { const g = document.getElementById('ssGuideActions'); return g && !g.hidden && g.offsetParent !== null; });
    if (!vis) break;
    await page.click('#ssGuideSkip').catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function continueWorld(page) {
  await page.waitForFunction(() => !document.getElementById('ssContinue').disabled, null, { timeout: 30000 });
  await page.click('#ssContinue');
  await page.waitForTimeout(1500);
}

async function enterFarm(page) {
  const ok = await page.evaluate(() => window.__sandstarTown25D.move(-16.6, -2));
  if (!ok) throw new Error('town move to farm gate blocked');
  await page.waitForTimeout(100);
  const label = await page.textContent('#town25dAction');
  await page.click('#town25dAction');
  await page.waitForFunction(() => window.__sandstarWorldLoadingM25B.ready('farm_01') && !window.__sandstarWorldLoadingM25B.state().busy, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  return label;
}

async function exitFarmToTown(page) {
  await page.evaluate(() => window.__sandstarFarmWorld.testMove(4.6, 16.5));
  await page.waitForTimeout(100);
  await page.click('#farmWorldExit');
  await page.waitForFunction(() => window.__sandstarWorldLoadingM25B.ready('village_hub_01') && !window.__sandstarWorldLoadingM25B.state().busy, null, { timeout: 30000 });
  await page.waitForTimeout(400);
}

function log(lines, ...a) { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); lines.push(s); console.log(s); }

module.exports = { openGame, newWorld, continueWorld, enterFarm, exitFarmToTown, log };
