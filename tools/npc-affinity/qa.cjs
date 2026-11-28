// Run against a locally built game. Only positions, the old save and the storage failure are fixtures.
const assert = require('node:assert/strict');
const { visitResident, rejectNextSave } = require('./qa-helpers.cjs');
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
    const visit = id => visitResident(page, press, id);
    const failNextSave = () => rejectNextSave(page);
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
    await press('.ss-affinity > summary');
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
      await press('.ss-affinity > summary');
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
    await press('.ss-affinity > summary');
    assert.match(await page.locator('.ss-affinity').innerText(), /밀 씨앗/);
    assert.equal((await snapshot()).affinity.tickets, 2);
    await press('#backBtn'); await visit('sola');
    assert.equal((await snapshot()).affinity.tickets, 2);
    await press('#backBtn');
    const social = await snapshot();
    for (const r of Object.values(social.affinity.npc)) r.points = 40;
    social.pickaxeForge.rank = 7;
    social.economy.reserveForgeMaterials = true;
    social.inv.iron = 4; social.inv.crystal = 2; social.inv.copper = 20; social.inv.orecoal = 3;
    Object.assign(social.livingP0.bag, {bread:4, wheat:2, carrot:2, carp:2, perch:2, stew:2, potato:2});
    if (process.argv.includes('--river')) social.livingP0.river.keep.carp = 2;
    await page.addInitScript(({key,social}) => {
      if (sessionStorage.getItem('social-fixture')) return;
      localStorage.setItem(key,JSON.stringify(social));
      sessionStorage.setItem('social-fixture','1');
    },{key,social});
    await page.reload(); await continueWorld(page);
    const gifts = {
      harin:['iron','bread'], sola:['carrot','wheat'], yeoul:['perch','perch'],
      seoon:['crystal','copper'], maru:['stew','potato'], tobak:['orecoal','iron'], gaengi:['orecoal','bread']
    };
    const step = mobile ? 1 : 0;
    for (const [id,pair] of Object.entries(gifts)) {
      await visit(id);
      await press('.ss-affinity > summary');
      const item = pair[step], gift = '[data-affinity-gift="' + item + '"]';
      const options = page.locator('[data-affinity-choice]');
      assert.equal(await options.count(),2);
      const choice = await options.nth(step).getAttribute('data-affinity-choice');
      const number = world => ['iron','crystal','orecoal','copper'].includes(item)
        ? world.inv[item] : world.livingP0.bag[item];
      const before = await snapshot();
      if (id === 'harin') {
        assert.match(await page.locator('[data-affinity-gift="iron"]').innerText(), /가능 1개.*보관 3개/);
        await failNextSave(); await press(gift);
        assert.equal(number(await snapshot()), number(before));
        assert.deepEqual((await snapshot()).affinity,before.affinity);
        assert.match(await page.locator('.ss-affinity-result').innerText(), /저장하지 못/);
      }
      if (id === 'yeoul' && process.argv.includes('--river'))
        assert.ok(await page.locator('[data-affinity-gift="carp"]').isDisabled());
      if (id === 'tobak' && !mobile)
        assert.ok(await page.locator('[data-affinity-gift="iron"]').isDisabled());
      await press(gift);
      const afterGift = await snapshot();
      assert.equal(number(afterGift),number(before)-1);
      assert.equal(afterGift.coins,before.coins);
      assert.equal(afterGift.affinity.npc[id].tastes.join(','),item);
      assert.ok(await page.locator(gift).isDisabled());
      assert.match(await page.locator('.ss-affinity-result').innerText(), /호감도 \+/);
      const select = '[data-affinity-choice="' + choice + '"]';
      if (id === 'harin') {
        await failNextSave(); await press(select);
        assert.equal((await snapshot()).affinity.npc[id].memory,'');
        assert.equal(await options.count(),2);
      }
      await press(select);
      assert.equal(await options.count(),0);
      const selected = await snapshot();
      assert.equal(selected.affinity.npc[id].memory,choice);
      assert.equal(selected.affinity.npc[id].recalled,false);
      assert.equal(selected.affinity.npc[id].points,afterGift.affinity.npc[id].points);
      const immediate = await page.locator('.ss-affinity-result').innerText();
      await press('#backBtn');
      if (id === 'harin') { await page.reload(); await continueWorld(page); }
      await visit(id);
      const echo = await page.locator('.ss-affinity-result').innerText();
      assert.ok(echo.includes('“') && echo !== immediate);
      assert.equal((await snapshot()).affinity.npc[id].recalled,true);
      await press('.ss-affinity > summary');
      assert.match(await page.locator('.ss-affinity').innerText(), /내 선택/);
      assert.ok(await page.locator(gift).isDisabled());
      assert.equal((await snapshot()).affinity.tickets,selected.affinity.tickets);
      assert.ok(await page.locator('#dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await press('#backBtn');
      if (id === 'harin') {
        await visit(id);
        assert.ok(!(await page.locator('.ss-affinity-result').textContent()).includes(echo));
        await press('#backBtn');
      }
    }
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
