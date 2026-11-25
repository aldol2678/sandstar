const assert = require('node:assert/strict');
const {continueWorld} = require('../farm-cooking-b/qa/lib.cjs');

async function checkLand(page, mobile) {
  const key = await page.evaluate(() => window.__SANDSTAR_LIVING_P11__.getSaveKey());
  // Load a copy of an existing save with one growing plot and funds for both purchases.
  await page.addInitScript(key => {
    if (sessionStorage.getItem('farm-land-fixture')) return;
    const saved = JSON.parse(localStorage.getItem(key));
    saved.coins = 180;
    localStorage.setItem(key, JSON.stringify(saved));
    sessionStorage.setItem('farm-land-fixture', '1');
  }, key);
  async function restore() {
    await page.reload({waitUntil: 'load'});
    await continueWorld(page);
    await page.waitForFunction(() => window.__sandstarFarmWorld.state().active);
  }
  const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
  const move = (x, y) => page.evaluate(([x, y]) => window.__sandstarFarmWorld.testMove(x, y), [x, y]);
  const button = page.locator('#farmWorldAction');
  const act = () => mobile ? button.tap() : button.click();
  await restore();
  const west = 'farm:west-field', east = 'farm:east-field';
  const original = await saved();
  assert.equal(Object.keys(original.livingP0.plots).length, 3);
  assert.ok(await move(24, 25));
  assert.match(await button.textContent(), /밭 구매 60C · 보유 180C/);

  // Selection on the canvas only shows the offer, on both input paths.
  const point = await page.evaluate(() => {
    const rect = document.getElementById('farmWorldCanvas').getBoundingClientRect();
    const {camera} = window.__sandstarFarmWorld.viewport();
    return {x:rect.left + 24 * 32 - Math.round(camera.x), y:rect.top + 24 * 32 - Math.round(camera.y)};
  });
  if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  assert.equal((await saved()).coins, 180);
  assert.match(await button.textContent(), /밭 구매 60C/);

  const failedWrite = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    try {
      Storage.prototype.setItem = () => {throw new Error('test write failure');};
      return window.__sandstarFarmWorld.action(true) === false;
    } finally {Storage.prototype.setItem = original;}
  });
  assert.ok(failedWrite);
  assert.match(await button.textContent(), /밭 구매 60C/);
  assert.equal((await saved()).livingP0.plots[west], undefined);

  await act();
  let current = await saved();
  assert.equal(current.coins, 120);
  assert.equal(current.livingP0.plots[west].plantedAt, null);
  for (const [id, old] of Object.entries(original.livingP0.plots))
    assert.equal(current.livingP0.plots[id].crop, old.crop);

  const reasons = await page.evaluate(([west, east]) => {
    const l = window.__SANDSTAR_LIVING_P11__, state = l.getState();
    function tryBuy(target, x, coins) {
      return l.applyPure(state, {id:'purchase-test',type:'farm.buyPlot',target},
        {worldId:'farm_01', x, y:76, groundY:76, coins, inv:{}}).reason;
    }
    return [tryBuy(west,24,120),tryBuy(east,30,119)];
  }, [west, east]);
  assert.match(reasons[0], /이미 보유/);
  assert.match(reasons[1], /1C 부족/);
  await page.locator('[data-farm-seed="carrot"]').click();
  await act();
  await act();
  await restore();
  current = await saved();
  assert.equal(current.coins, 120);
  assert.equal(current.livingP0.plots[west].crop, 'carrot');
  assert.equal(current.livingP0.plots[west].watered, true);

  assert.ok(await move(30, 25));
  await act();
  current = await saved();
  assert.equal(current.coins, 0);
  assert.equal(Object.keys(current.livingP0.plots).length, 5);
  assert.equal(current.livingP0.plots[east].plantedAt, null);
  assert.ok(await move(24, 25));
  await page.evaluate(() => window.__sandstarFarmCooking.advance(36));
  await act(); // water the second stage
  await page.evaluate(() => window.__sandstarFarmCooking.advance(36));
  assert.match(await button.textContent(), /수확/);
  const carrots = (await saved()).livingP0.bag.carrot;
  await act();
  await restore();
  current = await saved();
  assert.equal(current.livingP0.bag.carrot, carrots + 3);
  assert.equal(current.livingP0.plots[west].plantedAt, null);
  assert.equal(Object.keys(current.livingP0.plots).length, 5);
  assert.equal(current.coins, 0);
}
module.exports = {checkLand};
