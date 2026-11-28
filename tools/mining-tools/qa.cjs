// Chromium integration test: only the legacy inventory and travel/target positions are fixtures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { newWorld, continueWorld } = require('../farm-cooking-b/qa/lib.cjs');

async function run(browser, url, mobile) {
 const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},
  isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
 try {
  const page=await context.newPage(), errors=[];
  page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));
  const press=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
  const state=()=>page.evaluate(()=>window.__sandstarCharacter.snapshot());
  async function visit(x,z){
   assert.ok(await page.evaluate(([x,z])=>window.__sandstarTown25D.move(x,z),[x,z]));
   await press('#town25dAction');
  }
  await page.goto(url);
  await newWorld(page);
  const old=await state(), key=await page.evaluate(()=>window.__sandstarM1.state().saveKey);
  delete old.drillMotor;delete old.drillBits;delete old.hammerCore;
  old.coins=19000;
  for(const id of ['stone','copper','iron','crystal','titanium','starshard','opal']) old.inv[id]=80;
  await page.addInitScript(({key,old})=>{
   if(!sessionStorage.getItem('tool-fixture')){
    localStorage.setItem(key,JSON.stringify(old));sessionStorage.setItem('tool-fixture','1');
   }
  },{key,old});
  await page.reload();await continueWorld(page);
  const migrated=await state();
  assert.deepEqual(migrated.drillMotor,{rank:1});
  assert.deepEqual(migrated.hammerCore,{rank:1});
  assert.deepEqual(migrated.drillBits,{owned:['tunnel'],equipped:'tunnel'});
  await visit(6,-5);
  await press('[data-section="drill"]');
  assert.ok(await page.locator('#p16MotorUpgrade').isDisabled());
  await press('#venueClose');
  await visit(-9,-1.7);
  await press('[data-section="gear"]');
  await press('[data-tool="hammer"]');await press('[data-tool="drill"]');
  await press('#venueClose');
  await visit(6,-5);
  await press('[data-section="drill"]');
  // Force exactly one failed game save and verify the transaction rolls back.
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){
   if(k===window.__sandstarM1.state().saveKey){Storage.prototype.setItem=original;throw Error('QA save failure');}
   return original.call(this,k,v);
  };});
  const before=await state();
  await press('#p16MotorUpgrade');
  const rollback=await state();
  assert.equal(rollback.coins,before.coins);assert.deepEqual(rollback.inv,before.inv);
  assert.equal(rollback.drillMotor.rank,1);
  for(let i=1;i<5;i++)await press('#p16MotorUpgrade');
  assert.ok(await page.locator('#p16MotorUpgrade').isDisabled());
  await press('[data-p16a2-bit="hard"]');await press('[data-p16a2-bit="cooling"]');
  await press('[data-p16a2-bit="hard"]');
  await press('[data-section="hammer"]');
  await press('#p16HammerUpgrade');await press('#p16HammerUpgrade');
  assert.ok(await page.locator('#p16HammerUpgrade').isDisabled());
  const forged=await state();
  assert.equal(forged.coins,19000-250-180-260-760-1550-3200-440-350-480-1150);
  assert.deepEqual(forged.drillBits,{owned:['tunnel','hard','cooling'],equipped:'hard'});
  assert.equal(forged.drillMotor.rank,5);assert.equal(forged.hammerCore.rank,3);
  await press('#venueClose');
  await visit(-15,11);
  await page.waitForFunction(()=>window.__sandstarM1.state().region==='mine'&&!window.__sandstarWorldLoadingM25B.state().busy);
  await page.evaluate(()=>window.__sandstarDebug.teleport(46.5,78));
  const cdp=mobile?await context.newCDPSession(page):null;
  async function digDown(until){
   const pad=await page.locator('#mineDirectPad').boundingBox();
   const center={x:pad.x+pad.width/2,y:pad.y+pad.height/2};
   if(mobile){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x,y:center.y+28}]});
   }else{
    await page.mouse.move(center.x,center.y+pad.height*.3);await page.mouse.down();
   }
   try {await page.waitForFunction(until);}
   finally {
    if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    else await page.mouse.up();
   }
  }
  await digDown(()=>parseInt(document.querySelector('#p16SpinText').textContent)>20&&parseInt(document.querySelector('#p16HeatText').textContent)>0);
  await page.waitForFunction(()=>document.querySelector('#p16SpinText').textContent==='0%'&&document.querySelector('#p16HeatText').textContent==='0%');
  assert.ok((await state()).mined>forged.mined);
  await press('#bagBtn');await press('[data-ss-item-key="tool:hammer"]');await press('#ssBagEquip');await press('#backBtn');
  await page.locator('#p16HammerHud').waitFor({state:'visible'});
  await digDown(()=>window.__sandstarM1.state().player.y>=82);
  if(mobile)await press('#ropeBtn');
  else {
   const aim=await page.evaluate(()=>window.__sandstarRopeAB.screen());
   const box=await page.locator('#world').boundingBox();
   await page.mouse.click(box.x+aim.x,box.y+aim.y-65,{button:'right'});
  }
  await press('#ropeAutoMove');
  await page.waitForFunction(()=>!window.__sandstarRopeAB.get().rope.active&&Math.floor(window.__sandstarM1.state().player.x)!==46);
  // Strike two neighboring natural blocks with the production mining routine; the core III
  // shockwaves overlap a third block. One nearby natural ore must survive until struck directly.
  const impact=await page.evaluate(()=>{
   const d=window.__sandstarDebug,w=window.__sandstarTownM22;
   const natural=new Set(['stone','dirt','sand','snow']),ores=new Set(['copper','iron','orecoal','crystal']);
   for(let y=86;y<180;y++)for(let x=48;x<130;x++){
    const ore=w.tile(x+1,y);
    if(!ores.has(ore)||![w.tile(x,y),w.tile(x,y-1),w.tile(x,y+1)].every(t=>natural.has(t)))continue;
    d.teleport(x+.5,y+1);
    const a=d.get(), ledger=a.inv[ore]||0;
    d.mine(x,y-1);
    const once=w.tile(x,y);
    d.mine(x,y+1);
    const twice=w.tile(x,y), sideOre=w.tile(x+1,y), prev=d.get().inv[ore]||0;
    d.mine(x+1,y);d.mine(x+1,y);
    const payout=(d.get().inv[ore]||0)-prev;
    d.teleport(40.5,79);const shield=w.tile(40,79);d.mine(40,79);
    return {once,twice,ore,sideOre,sideGain:prev-ledger,payout,shield,afterShield:w.tile(40,79)};
   }
   throw Error('No accessible ore fixture for this seed');
  });
  assert.ok(impact.once);assert.equal(impact.twice,null);assert.equal(impact.sideOre,impact.ore);
  assert.equal(impact.sideGain,0);assert.equal(impact.payout,1);
  assert.equal(impact.shield,'stationrock');assert.equal(impact.afterShield,impact.shield);
  await press('#bagBtn');await press('[data-ss-item-key="tool:pickaxe"]');await press('#ssBagEquip');await press('#backBtn');
  await page.locator('#p16HammerHud').waitFor({state:'hidden'});
  await page.evaluate(()=>window.__sandstarCharacter.save());
  const saved=await state();await page.reload();await continueWorld(page);
  const resumed=await state();
  for(const k of ['drillBits','drillMotor','hammerCore','inv','coins','tool','mined','edits'])assert.deepEqual(resumed[k],saved[k],k);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({input:mobile?'touch':'mouse',ranks:[resumed.drillMotor.rank,resumed.hammerCore.rank],impact,saveRestored:true}));
 } finally {await context.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 try {for(const mobile of [false,true])await run(browser,process.argv[2],mobile);}
 finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
