// Measure the actual game dialog and exercise its keyboard and touch entry points.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { newWorld } = require('../farm-cooking-b/qa/lib.cjs');
const { visitResident } = require('./qa-helpers.cjs');

async function verify(browser, url, width, height, mobile) {
  const page = await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const press = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
  const summary = '.ss-affinity > summary';
  const box = page.locator('#dialog');
  try {
    await page.goto(url);
    await newWorld(page);
    const ids = mobile ? ['harin'] : ['harin','sola','yeoul','tobak','gaengi','maru','seoon'];
    const portraits = new Set();
    for (const id of ids) {
      await visitResident(page,press,id);
      await page.waitForFunction(() => !!document.querySelector('.ss-npc-portrait canvas'));
      const metrics = await box.evaluate(el => {
        const speech = el.querySelector('#ssNpcLine'), next = el.querySelector('#ssNpcNextBtn');
        const line = speech.getBoundingClientRect(), button = next.getBoundingClientRect();
        const portrait = el.querySelector('.ss-npc-portrait canvas');
        return {lineSize:parseFloat(getComputedStyle(speech).fontSize), btnSize:parseFloat(getComputedStyle(next).fontSize),
          width:el.clientWidth, full:el.scrollWidth, rect:el.getBoundingClientRect().toJSON(),
          gap:button.top-line.bottom, buttonBottom:button.bottom, portrait:portrait.toDataURL(),
          tooSmall:[...el.querySelectorAll('button,summary')].filter(e => e.checkVisibility()
            && (e.offsetHeight < 44 || e.offsetWidth < 44)).map(e => e.id || e.textContent)};
      });
      assert.ok(metrics.lineSize >= 20 && metrics.btnSize >= 15);
      assert.equal(metrics.full,metrics.width);
      assert.ok(metrics.rect.left >= 0 && metrics.rect.right <= width+1);
      assert.ok(metrics.rect.top >= 0 && metrics.rect.bottom <= height+1);
      assert.ok(metrics.gap >= 0 && metrics.gap <= 16);
      assert.ok(metrics.buttonBottom <= metrics.rect.bottom);
      assert.deepEqual(metrics.tooSmall,[]);
      assert.equal(await page.getByRole('dialog').getAttribute('aria-labelledby'),'ssNpcSpeaker');
      assert.equal(await page.locator('#ssNpcNextBtn').evaluate(el => el === document.activeElement),true);
      portraits.add(metrics.portrait);
      if (id === 'harin') {
        const line = page.locator('#ssNpcLine');
        const previous = await line.innerText();
        if (mobile) await press('#ssNpcNextBtn'); else await page.keyboard.press('Enter');
        assert.notEqual(await line.innerText(),previous);
        await press('#ssNpcHintBtn');
        assert.equal(await page.locator('#ssNpcProg').innerText(),'힌트');
        const hint = await line.innerText();
        await press('#ssNpcReplay');
        assert.equal(await line.innerText(),hint);
        await press(summary);
        await press('.ss-npc-roster summary');
        assert.equal(await page.locator('.ss-affinity-roster li:visible').count(),7);
        await box.evaluate(el => el.scrollTop=el.scrollHeight);
        assert.ok(await box.evaluate(el => {
          const close=el.querySelector('#backBtn').getBoundingClientRect(), dialog=el.getBoundingClientRect();
          return close.top>=dialog.top && close.bottom<=dialog.bottom && el.scrollWidth<=el.clientWidth+1;
        }));
        if (!mobile) {
          await page.locator('#backBtn').focus();
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(()=>document.activeElement.matches('.ss-chapter-talk > summary')),true);
        }
      }
      await press('#backBtn');
      assert.equal(await page.locator('#overlay').isVisible(),false);
    }
    assert.equal(portraits.size,ids.length);
    assert.deepEqual(errors,[]);
    console.log('Resident dialog PASS',width,height);
  } finally {await page.close();}
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,
    args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    for (const [w,h,mobile] of [[320,568,true],[390,844,true],[844,390,true],[1280,800,false]])
      await verify(browser,process.argv[2],w,h,mobile);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
