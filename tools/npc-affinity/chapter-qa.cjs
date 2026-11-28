// Verify chapter progress through game interactions. Fixtures supply materials, past memories and travel positions.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { newWorld, continueWorld } = require('../farm-cooking-b/qa/lib.cjs');
const { visitResident, rejectNextSave } = require('./qa-helpers.cjs');

async function verify(browser, url, mobile, fishing) {
  const context = await browser.newContext({
    viewport: mobile ? {width:390,height:844} : {width:1280,height:800},
    isMobile:mobile, hasTouch:mobile, serviceWorkers:'block'
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const press = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    const snapshot = () => page.evaluate(() => window.__sandstarCharacter.snapshot());
    const visit = id => visitResident(page,press,id);
    const close = () => press('#backBtn');
    const hear = key => press('[data-chapter-topic="' + key + '"]');
    async function reachTownGate(x, name, world) {
      assert.ok(await page.evaluate(x => window.__sandstarTown25D.move(x,11),x));
      assert.match(await page.locator('#town25dAction').textContent(), name);
      await press('#town25dAction');
      await waitRegion(world);
    }
    async function waitRegion(world) {
      await page.waitForFunction(world => window.__sandstarM1.state().region === world
        && !window.__sandstarWorldLoadingM25B.state().busy && !window.__sandstarPortalM16.get().locked
        && performance.now() - window.__sandstarPortalM16.get().lastTravelAt >= 1000, world);
    }
    async function interactAt(x, action) {
      const result = await page.evaluate(async x => {
        window.__sandstarHUDM15.setTestPosition(x,window.__sandstarTownM22.surface(Math.floor(x))-1);
        const action = window.__sandstarM1.nearby()?.act;
        const done = await window.__sandstarM1.interact();
        return {action, done, region:window.__sandstarM1.state().region, travel:window.__sandstarPortalM16.get().lastResult};
      },x);
      assert.equal(result.action,action);
      assert.ok(result.done,JSON.stringify(result));
    }
    await page.goto(url);
    await newWorld(page);
    const seed = await snapshot();
    const key = await page.evaluate(() => window.__sandstarM1.state().saveKey);
    seed.mined = 1;
    seed.inv.wood = 2;
    seed.inv.stone = 2;
    seed.affinity.npc.sola.points = 70;
    seed.affinity.npc.sola.memory = mobile ? 'nickname' : 'date';
    seed.affinity.npc.harin.points = 32;
    seed.affinity.npc.harin.memory = 'trace';
    for (const resident of Object.values(seed.affinity.npc)) delete resident.chapterHeard;
    if (fishing) seed.livingP0.river.rewards = ['river-record-marks-1'];
    await page.addInitScript(({seed,key}) => {
      if (sessionStorage.getItem('chapter-fixture')) return;
      localStorage.setItem(key,JSON.stringify(seed));
      sessionStorage.setItem('chapter-fixture','1');
    },{seed,key});
    await page.reload();
    await continueWorld(page);
    await visit('harin');
    await press('.ss-chapter-talk summary');
    assert.equal(await page.locator('[data-chapter-topic]').count(),0);
    await close();
    await reachTownGate(15,/잔빛숲/,'life_forest_01');
    await interactAt(120,'spring');
    assert.ok(await page.locator('#m1RepairBtn').isDisabled());
    assert.match(await page.locator('#dialog').innerText(),/미발견 · 광산 X55/);
    assert.equal(await page.locator('.ss-chapter-field').count(),0);
    await close();
    await interactAt(113,'seon');
    await press('.ss-chapter-talk summary');
    assert.equal(await page.locator('[data-chapter-topic]').count(),1);
    await rejectNextSave(page);
    await hear('forestVisited');
    assert.match(await page.locator('.ss-chapter-response').innerText(),/기록하지 못/);
    assert.deepEqual((await snapshot()).affinity.npc.seoon.chapterHeard,[]);
    await hear('forestVisited');
    assert.deepEqual((await snapshot()).affinity.npc.seoon.chapterHeard,['forestVisited']);
    await close();
    await interactAt(22.5,'exit');
    await waitRegion('village_hub_01');
    for (const id of ['yeoul','sola']) {
      await visit(id);
      await press('.ss-chapter-talk summary');
      await hear('forestVisited');
      const text = await page.locator('.ss-chapter-response').innerText();
      assert.equal(text.includes('물이 지나간 자리'), id === 'sola');
      await close();
    }
    await reachTownGate(-15,/광산/,'mine');
    await interactAt(55,'crystal');
    assert.ok((await snapshot()).storyM1.crystalSeen);
    await interactAt(40.5,'mine-exit');
    await waitRegion('village_hub_01');
    await reachTownGate(15,/잔빛숲/,'life_forest_01');
    await interactAt(120,'spring');
    await press('.ss-chapter-field summary');
    const dryNotes = await page.locator('.ss-chapter-field').innerText();
    assert.match(dryNotes,/물이 지나간 자리/);
    assert.ok(!dryNotes.includes('돌아온 별샘 물길'));
    await rejectNextSave(page);
    await press('#m1RepairBtn');
    const failed = await snapshot();
    assert.ok(!failed.storyM1.springRepaired);
    assert.equal(failed.inv.wood,2);
    assert.equal(failed.inv.stone,2);
    await press('#m1RepairBtn');
    const repaired = await snapshot();
    assert.ok(repaired.storyM1.springRepaired);
    assert.equal(repaired.inv.wood,0);
    assert.equal(repaired.inv.stone,0);
    await interactAt(22.5,'exit');
    await waitRegion('village_hub_01');
    for (const id of ['sola','yeoul','maru','tobak','gaengi','harin','seoon']) {
      await visit(id);
      if (id === 'harin') {
        await press('.ss-chapter-talk summary');
        await press('#ssNpcStoryBtn');
        assert.match(await page.locator('#dialog').innerText(),/다음 물높이/);
      }
      await press('.ss-chapter-talk summary');
      assert.equal(await page.locator('[data-chapter-topic]').count(),3);
      await hear('crystalSeen');
      if (id === 'gaengi') assert.match(await page.locator('.ss-chapter-response').innerText(),/등불과 화덕 밖에서/);
      await hear('forestVisited');
      await hear('springRepaired');
      const conversation = await page.locator('.ss-chapter-response').innerText();
      if (id === 'sola') assert.match(conversation,mobile ? /낮잠밭/ : /네 글씨/);
      if (id === 'harin') assert.ok(!conversation.includes('문틀'));
      if (id === 'yeoul') assert.equal(conversation.includes('네 도감'),fishing);
      if (id === 'seoon') assert.match(conversation,/수문턱의 금과 장치의 글/);
      const before = await snapshot();
      await hear('springRepaired');
      const after = await snapshot();
      assert.deepEqual(after.affinity,before.affinity);
      assert.deepEqual(after.inv,before.inv);
      assert.equal(after.coins,before.coins);
      assert.ok(await page.locator('#dialog').evaluate(el => el.scrollWidth <= el.clientWidth+1));
      await close();
    }
    await page.reload();
    await continueWorld(page);
    await reachTownGate(15,/잔빛숲/,'life_forest_01');
    await interactAt(120,'spring');
    await press('.ss-chapter-field summary');
    assert.equal(await page.locator('.ss-chapter-field li').count(),21);
    assert.equal(await page.locator('.ss-chapter-field p').count(),3);
    assert.match(await page.locator('#dialog').innerText(),/무엇이 잠들어 있는지도 기억하라/);
    assert.deepEqual(errors,[]);
    console.log('Chapter 1 PASS', mobile ? '390×844' : '1280×800', fishing ? 'with fishing' : 'base');
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,
    args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    for (const mobile of [false,true]) await verify(browser,process.argv[2],mobile,process.argv.includes('--river'));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
