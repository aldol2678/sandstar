// Run against a local preview. Only the setup uses the game's existing debug API.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { newWorld } = require('../farm-cooking-b/qa/lib.cjs');

async function exercise(browser, url, mobile, landscape = false) {
 const context = await browser.newContext({
  viewport: landscape ? { width:844, height:390 } : mobile ? { width:390, height:844 } : { width:1280, height:800 },
  isMobile:mobile, hasTouch:mobile, serviceWorkers:'block'
 });
 try {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => {errors.push(e.message); console.error(e.message);});
  await page.goto(url);
  await newWorld(page);
  await page.evaluate(() => window.__sandstarTown25D.move(-15,11));
  await page.locator('#town25dAction').click();
  await page.waitForFunction(() => window.__sandstarM1.state().region === 'mine' && !window.__sandstarWorldLoadingM25B.state().busy);
  // Place the fresh miner at the entrance. All excavation and escape use player inputs.
  await page.evaluate(() => window.__sandstarDebug.teleport(46.5,window.__sandstarTownM22.surface(46)-1));
  const cdp = mobile ? await context.newCDPSession(page) : null;
  const pad = await page.locator('#mineDirectPad').boundingBox();
  const center = {x:pad.x+pad.width/2,y:pad.y+pad.height/2};
  if(mobile) {
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x,y:center.y+28}]});
  } else {
   await page.mouse.move(center.x,center.y+pad.height*.3);
   await page.mouse.down();
  }
  await page.waitForFunction(()=>window.__sandstarM1.state().player.y>=81.8,null,{timeout:18000});
  if(mobile) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  else await page.mouse.up();
  const mined = await page.evaluate(()=>window.__sandstarDebug.get().mined);
  assert.ok(mined>0,'first pit excavated with the mining pad');
  const position = () => page.evaluate(() => window.__sandstarM1.state().player);
  const y = async () => (await position()).y;
  const rope = page.locator('#ropeBtn'), auto = page.locator('#ropeAutoMove');
  async function connect() {
   if(mobile) return rope.tap();
   const aim = await page.evaluate(() => window.__sandstarRopeAB.screen());
   const canvas = await page.locator('#world').boundingBox();
   await page.mouse.click(canvas.x+aim.x,canvas.y+aim.y-65,{button:'right'});
  }
  async function hold(key, pressed) {
   if(!mobile) return pressed ? page.keyboard.down(key) : page.keyboard.up(key);
   const box = await page.locator('#mineStick').boundingBox();
   const dx = key==='d' ? .32 : 0, dy = key==='w' ? -.32 : key==='s' ? .32 : 0;
   await cdp.send('Input.dispatchTouchEvent', {
    type:pressed?'touchStart':'touchEnd',
    touchPoints:pressed?[{x:box.x+box.width*(.5+dx), y:box.y+box.height*(.5+dy)}]:[]
   });
  }
  const isActive = active => page.waitForFunction(want => window.__sandstarRopeAB.get().rope.active === want,active,{timeout:6000});
  await hold('d',true);
  await page.waitForFunction(() => document.querySelector('#ssMineFeedback').textContent.includes('자동 상승'));
  await hold('d',false);
  const tip = await page.locator('#ssMineFeedback').innerText();
  assert.ok(tip.includes(mobile?'이동 패드':'W'));
  if(!mobile) assert.ok(tip.includes('우클릭'));
  await connect();
  await isActive(true);
  await auto.waitFor({state:'visible'});
  const floor = await y();
  await page.waitForTimeout(300);
  assert.ok(Math.abs(await y()-floor)<.02,'stationary after connection');
  await hold('w',true);
  await page.waitForFunction(v=>window.__sandstarM1.state().player.y<v-.55,floor);
  await hold('w',false);
  const held = await y();
  await page.waitForTimeout(300);
  assert.ok(Math.abs(await y()-held)<.04,'holds height after release');
  await hold('s',true);
  await page.waitForFunction(v=>window.__sandstarM1.state().player.y>v+.24,held);
  await hold('s',false);
  await connect();
  await isActive(false);
  await page.waitForFunction(v=>window.__sandstarM1.state().player.y>=v-.03,floor);
  await page.waitForTimeout(450);
  await connect();
  await isActive(true);
  await auto.waitFor({state:'visible'});
  const toggle = () => mobile ? auto.tap() : auto.click();
  await toggle();
  await page.waitForFunction(v=>window.__sandstarM1.state().player.y<v-.25,floor);
  await hold('s',true);
  await page.waitForFunction(()=>document.querySelector('#ropeAutoMove').getAttribute('aria-pressed')==='false');
  await hold('s',false);
  if(mobile) await toggle(); else await hold('w',true);
  await isActive(false);
  if(!mobile) await hold('w',false);
  await auto.waitFor({state:'hidden'});
  await page.waitForTimeout(400);
  const bank = await position();
  assert.ok(Math.floor(bank.x)!==46 && bank.y<floor-2,'landed on adjacent bank');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({input:mobile?'touch':'right-click + keyboard',viewport:page.viewportSize(),tip,mined,floor,held,bank}));
 } finally { await context.close(); }
}

(async()=>{
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
 try {
  await exercise(browser, process.argv[2], false);
  await exercise(browser, process.argv[2], true);
  await exercise(browser, process.argv[2], true, true);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
