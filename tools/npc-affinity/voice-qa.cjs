// Exercise actual browser media playback, including a replay, a chained personal line and cancellation.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { newWorld, continueWorld } = require('../farm-cooking-b/qa/lib.cjs');
const { visitResident } = require('./qa-helpers.cjs');

async function verify(browser,url,mobile,muted) {
  const page = await browser.newPage({viewport:mobile ? {width:390,height:844} : {width:1280,height:800},
    isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  const press = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
  try {
    await page.addInitScript(muted=>{
      localStorage.setItem('sandstar-audio-v1',JSON.stringify({enabled:!muted,volume:0.4}));
      window.testVoicePlayers = [];
      window.testVoiceStarts = [];
      const Original = window.Audio;
      window.Audio = class extends Original {
        constructor(...args) {
          super(...args);
          window.testVoicePlayers.push(this);
          this.addEventListener('playing',()=>window.testVoiceStarts.push(new URL(this.currentSrc).pathname));
        }
      };
    },muted);
    await page.goto(url);
    await newWorld(page);
    const {seed,key}=await page.evaluate(()=>({seed:window.__sandstarCharacter.snapshot(),key:window.__sandstarM1.state().saveKey}));
    seed.affinity.npc.sola.points=74;
    seed.affinity.npc.sola.memory='nickname';
    seed.affinity.npc.sola.recalled=true;
    seed.livingP0.bag.carrot=2;
    Object.assign(seed.storyM1,{forestVisited:true,crystalSeen:true,springRepaired:true});
    await page.addInitScript(({seed,key})=>{if(!sessionStorage.getItem('voice-fixture')){
      localStorage.setItem(key,JSON.stringify(seed)); sessionStorage.setItem('voice-fixture','1');
    }},{seed,key});
    await page.reload();
    await continueWorld(page);
    await visitResident(page,press,'sola');
    const played = (part,count=1) => page.waitForFunction(({part,count})=>
      window.testVoiceStarts.filter(u=>u.includes('/sola/'+part+'-')).length>=count,{part,count},{timeout:20000});
    await press('.ss-chapter-talk > summary');
    if(!muted) await played('arrival');
    await press('[data-chapter-topic="springRepaired"]');
    if(!muted) {
      await played('springRepaired');
      await played('personal-nickname');
      await press('.ss-chapter-response .ss-npc-listen');
      await played('springRepaired',2);
      await press('[data-chapter-topic="crystalSeen"]');
      await played('crystalSeen');
      assert.equal(await page.evaluate(()=>window.testVoicePlayers.filter(a=>!a.paused).length),1);
    }
    await press('.ss-affinity > summary');
    await press('.ss-affinity-hint .ss-npc-listen');
    if(!muted) await played('hint');
    await press('[data-affinity-gift="carrot"]');
    if(!muted) await played('gift-carrot');
    await press('.ss-affinity-result .ss-npc-listen');
    if(!muted) await played('gift-carrot',2);
    assert.equal(await page.locator('[data-affinity-gift="carrot"]').isDisabled(),true);
    await press('#backBtn');
    const state=await page.evaluate(()=>({playing:window.testVoicePlayers.filter(a=>!a.paused).length,
      newStarts:window.testVoiceStarts.filter(s=>s.includes('/npc-voices/v4/')).length}));
    assert.equal(state.playing,0);
    if(muted) assert.equal(state.newStarts,0);
    await visitResident(page,press,'harin');
    await press('.ss-chapter-talk > summary');
    await press('#ssNpcStoryBtn');
    if(!muted) await page.waitForFunction(()=>window.testVoiceStarts.some(s=>s.includes('/harin/story-repaired-')));
    await press('#backBtn');
    assert.deepEqual(errors,[]);
    console.log('NPC v4 media PASS',mobile?'390x844':'1280x800',muted?'muted':'sound on');
  } finally {await page.close();}
}

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,
    args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  try {
    for(const [mobile,muted] of [[false,false],[true,false],[true,true]])
      await verify(browser,process.argv[2],mobile,muted);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
