// Run against a locally built game. Only positions, the old save and the storage failure are fixtures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { newWorld, continueWorld } = require('../farm-cooking-b/qa/lib.cjs');

async function verify(browser, url, mobile) {
  const context = await browser.newContext({
    viewport: mobile ? {width:390,height:844} : {width:1280,height:800},
    isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block'
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const press = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    const snapshot = () => page.evaluate(() => window.__sandstarCharacter.snapshot());
    async function visit(id) {
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
    async function failNextSave() {
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
    await page.goto(url);
    await newWorld(page);
    const old = await snapshot();
    assert.equal(Object.keys(old.affinity.npc).length, 7);
    delete old.affinity;
    old.inv.wood = 6;
    old.livingP0.bag.wheat = 3;
    old.livingP0.bag.perch = 2;
    const key = await page.evaluate(() => window.__sandstarM1.state().saveKey);
    await page.addInitScript(({key,old}) => {
      if (sessionStorage.getItem('affinity-fixture')) return;
      localStorage.setItem(key, JSON.stringify(old));
      sessionStorage.setItem('affinity-fixture','1');
    }, { key, old });
    await page.reload(); await continueWorld(page);
    assert.equal((await snapshot()).affinity.npc.harin.points, 0);
    await visit('harin');
    assert.equal((await snapshot()).affinity.npc.harin.points, 6);
    await press('#ssNpcNextBtn'); await press('#ssNpcHintBtn');
    await press('.ss-affinity summary');
    assert.equal(await page.locator('.ss-affinity-roster li').count(), 7);
    const fits = await page.locator('#dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1);
    assert.equal(fits, true);
    const before = await snapshot();
    await failNextSave();
    await press('#ssAffinityDeliver');
    const failed = await snapshot();
    assert.deepEqual(failed.affinity, before.affinity);
    assert.equal(failed.inv.wood, 6); assert.equal(failed.coins, before.coins);
    assert.deepEqual(failed.livingP0.npcs, before.livingP0.npcs);
    await press('#ssAffinityDeliver');
    let game = await snapshot();
    assert.equal(game.inv.wood, 0); assert.equal(game.coins, before.coins + 26);
    assert.equal(game.affinity.npc.harin.points, 8);
    assert.ok(await page.locator('#ssAffinityDeliver').isDisabled());
    await press('#backBtn');
    for (const [id, target, amount] of [['sola','wheat',24],['yeoul','perch',25]]) {
      await visit(id);
      const riverTest = id === 'yeoul' && process.argv.includes('--river');
      if (riverTest) {
        const fishBefore = (await snapshot()).livingP0.bag.perch;
        await press('#yeoulRecord [data-yrec="accept"]');
        const accepted = await snapshot();
        assert.equal(accepted.livingP0.bag.perch, fishBefore);
        assert.equal(accepted.affinity.npc.yeoul.points, 6);
      }
      await press('.ss-affinity summary');
      await press('#ssAffinityDeliver');
      const next = await snapshot();
      assert.equal(next.livingP0.bag[target], 0); assert.equal(next.coins, game.coins + amount);
      assert.equal(next.affinity.npc[id].points, 8);
      if (riverTest) {
        assert.equal(next.livingP0.river.record.quest, 1);
        assert.deepEqual(next.livingP0.river.rewards, []);
        assert.match(await page.locator('#yeoulRecord').innerText(), /기록 0\/3/);
      }
      game = next;
      await press('#backBtn');
    }
    for (const id of ['seoon','maru','tobak','gaengi']) {
      if (id === 'maru') {
        await failNextSave(); await visit(id);
        assert.match(await page.locator('.ss-affinity-result').innerText(), /저장하지 못/);
        assert.equal((await snapshot()).affinity.npc[id].points, 0);
        await press('#backBtn');
      }
      await visit(id);
      assert.equal((await snapshot()).affinity.npc[id].points, 6);
      await press('#backBtn');
    }
    await page.reload(); await continueWorld(page);
    await visit('harin');
    assert.equal((await snapshot()).affinity.npc.harin.points, 8);
    await press('#backBtn');
    const poised = await snapshot();
    poised.affinity.npc.sola = {points:29,level:1};
    await page.addInitScript(({key,poised}) => {
      if (sessionStorage.getItem('milestone-fixture')) return;
      localStorage.setItem(key,JSON.stringify(poised));
      sessionStorage.setItem('milestone-fixture','1');
    },{key,poised});
    await page.reload(); await continueWorld(page); await visit('sola');
    await press('.ss-affinity summary');
    assert.match(await page.locator('.ss-affinity').innerText(), /밀 씨앗/);
    assert.equal((await snapshot()).affinity.tickets, 2);
    await press('#backBtn'); await visit('sola');
    assert.equal((await snapshot()).affinity.tickets, 2);
    assert.deepEqual(errors, []);
    console.log(mobile ? 'Mobile 390×844 PASS' : 'Desktop 1280×800 PASS');
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined,
    args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    for (const mobile of [false,true]) await verify(browser,process.argv[2] || 'http://127.0.0.1:8814',mobile);
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
