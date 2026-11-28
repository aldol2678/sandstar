const assert = require('node:assert/strict');

async function visitResident(page, press, id) {
  const name = await page.evaluate(id => {
    const n = window.__sandstarNpc.data.find(n => n.id === id);
    for (const step of [0,.5,1,1.5,2]) {
      for (const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1]]) {
        if (window.__sandstarTown25D.move(n.t25.x + step*dx, n.t25.z + step*dz)
            && document.querySelector('#town25dAction').textContent.includes(n.name)) return n.name;
      }
    }
    throw Error('No accessible interaction for ' + id);
  }, id);
  await press('#town25dAction');
  await page.locator('.ss-affinity summary').waitFor();
  assert.match(await page.locator('.ss-affinity summary').innerText(), new RegExp(name));
}
async function rejectNextSave(page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === window.__sandstarM1.state().saveKey) {
        Storage.prototype.setItem = original;
        throw Error('Simulated storage failure');
      }
      return original.call(this, key, value);
    };
  });
}

module.exports = { visitResident, rejectNextSave };
