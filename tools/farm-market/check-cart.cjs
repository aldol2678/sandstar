// Runs after Gate 2 has grown all three crops and restored the saved farm.
const assert = require('node:assert/strict');

async function checkCart(page) {
  const moveToCart = () => page.evaluate(() => window.__sandstarFarmWorld.testMove(11, 16));
  const snapshot = () => page.evaluate(() => {
    const living = window.__SANDSTAR_LIVING_P11__;
    const saved = JSON.parse(localStorage.getItem(living.getSaveKey()));
    const {wheat, potato, carrot} = living.getState().bag;
    return {wheat, potato, carrot, coins: saved.coins, sold: living.getState().stats.sold};
  });

  assert.ok(await moveToCart());
  const before = await snapshot();
  const action = page.locator('#farmWorldAction');
  assert.match(await action.textContent(), /납품.*29C/);
  await action.click();
  const after = await snapshot();
  assert.deepEqual(after, {
    wheat: before.wheat - 1, potato: before.potato - 1, carrot: before.carrot - 1,
    coins: before.coins + 29, sold: before.sold + 3
  });

  // The action rolls back in-memory state if persistence fails.
  const rolledBack = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    try {
      Storage.prototype.setItem = () => { throw new Error('test write failure'); };
      return window.__sandstarFarmWorld.action() === false;
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  assert.ok(rolledBack);
  assert.deepEqual(await snapshot(), after);

  const {continueWorld} = require('../farm-cooking-b/qa/lib.cjs');
  await page.reload({waitUntil: 'load'});
  await continueWorld(page);
  assert.deepEqual(await snapshot(), after);
  assert.ok(await moveToCart());
  for (let i = 0; i < Math.min(after.wheat, after.carrot, after.potato); i++) await action.click();
  const empty = await snapshot();
  assert.match(await action.textContent(), /필요한 작물/);
  await action.click();
  assert.deepEqual(await snapshot(), empty);
}

module.exports = {checkCart};
