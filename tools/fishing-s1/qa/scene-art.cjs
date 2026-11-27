const {chromium, devices}=require('playwright');
const {newWorld}=require('../../farm-cooking-b/qa/lib.cjs');
const assert=require('node:assert/strict');
const [url,out,mode]=process.argv.slice(2);
if(new URL(url).hostname!=='127.0.0.1')throw Error('local only');
(async()=>{
 const mobile=mode.startsWith('m'),reduced=mode.endsWith('reduce');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const c=await browser.newContext({...mobile?devices['iPhone 13']:{viewport:{width:1280,height:800}},...mobile?{viewport:{width:390,height:844}}:{},serviceWorkers:'block',reducedMotion:reduced?'reduce':'no-preference'});
  const p=await c.newPage(),errors=[],assetResponses=new Map();
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('/a-v03/'))assetResponses.set(r.url(),[r.status(),r.headers()['content-type']]);});
  await p.addInitScript(()=>{
   const d=CanvasRenderingContext2D.prototype.drawImage;
   window.seen={};
   CanvasRenderingContext2D.prototype.drawImage=function(img,...a){
    if(this.canvas.id==='riverCanvas' && img.src?.includes('/a-v03/')){
     const file=img.src.split('/').pop();(window.seen[file]??={})[file==='angler-atlas.webp'?a[1]:0]=a;
    }
    return d.call(this,img,...a);
   };
  });
  // Only the test browser grants three logs; crafting and casting still use the UI.
  await p.route(url,async route=>{
   const response=await route.fetch(), body=await response.text();
   const marker='window.__sandstarRiver=Object.freeze({';
   assert.equal(body.split(marker).length,2);
   await route.fulfill({response,body:body.replace(marker,'window.__artTestLogs=()=>{game.inv.wood=3;};\n'+marker)});
  });
  await p.goto(url,{waitUntil:'domcontentloaded'});await newWorld(p,'515151');
  await p.evaluate(()=>window.__sandstarTown25D.move(18,-.5));await p.locator('#town25dAction').click();
  await p.waitForFunction(()=>window.__sandstarWorldLoadingM25B.ready('fishing_01')&&!window.__sandstarWorldLoadingM25B.state().busy);
  await p.evaluate(()=>{window.__artTestLogs();window.__sandstarFishingWorld.testMove(12.6,15.2);});
  await p.locator('#fishWorldAction').click();
  await p.locator('#riverCanvas').waitFor({state:'visible'});
  await p.waitForFunction(()=>['far-background','underwater-gradient','surface-tile','bottom-tile','front-bank','prop-reeds','prop-stones'].every(k=>Object.hasOwn(window.seen,k+'.webp'))&&window.seen['angler-atlas.webp']?.[0],null,{timeout:7000});
  assert.equal(assetResponses.size,12);for(const x of assetResponses.values())assert.deepEqual(x,[200,'image/webp']);
  console.log('PASS',mode,'all 12 images loaded; five layers, props and wait pose drawn into actual game canvas');
  if(mobile)assert.deepEqual(await p.evaluate(()=>[innerWidth,innerHeight]),[390,844]);
  const model=await p.evaluate(()=>{const a=window.seen['angler-atlas.webp'][0], img=[...performance.getEntriesByType('resource')].find(x=>x.name.endsWith('/angler-atlas.webp'));
   return {slice:a.slice(2,4), loaded:!!img};});
  assert.deepEqual(model,{slice:[256,256],loaded:true});
  console.log('PASS',mode,'256px pose frame drawn from shipped atlas');
  await p.locator('[data-river=craft]').click();
  const area=await p.locator('#riverCanvas').boundingBox(),touchpoint={x:Math.round(area.x+area.width*.62),y:Math.round(area.y+area.height*.4)};
  if(mobile)await p.touchscreen.tap(touchpoint.x,touchpoint.y);else await p.mouse.click(touchpoint.x,touchpoint.y);
  await p.waitForFunction(()=>window.seen['angler-atlas.webp']?.[256]&&window.seen['bobber-32.webp']);
  console.log('PASS',mode,'casting row and bobber drawn through normal input');
  await p.screenshot({path:out+'/'+mode+'-a-lure.png',scale:'css'});
  const btn=await p.locator('#riverHold').boundingBox();
  await p.mouse.move(btn.x+btn.width*.5,btn.y+btn.height*.5);await p.mouse.down();
  await p.waitForFunction(()=>window.seen['angler-atlas.webp']?.[512]);await p.mouse.up();
  await p.locator('#riverPause').click();
  await p.waitForFunction(()=>window.seen['angler-atlas.webp']?.[768]);
  console.log('PASS',mode,'reel and rest rows drawn');
  await p.locator('#riverExit').click();
  await p.evaluate(()=>{window.seen={};window.__sandstarFishingWorld.testMove(19.2,8);});
  await p.locator('#fishWorldAction').click();
  await p.waitForFunction(()=>window.__sandstarRiver.state().open&&window.__sandstarRiver.state().spot==='B');
  await p.waitForTimeout(250);
  assert.deepEqual(await p.evaluate(()=>Object.keys(window.seen)),[]);
  console.log('PASS',mode,'B keeps original presentation');
  assert.deepEqual(errors,[]);console.log('PASS',mode,'no uncaught page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
