// ---------- UI ----------
let ssRiverIsOpen=false,ssRiverRaf=0,ssRiverLast=0,ssRiverSeq=0;
const ssRiver={fixedSpot:'',spot:'B',phase:'idle',fish:[],lure:null,hold:false,holdT:0,lastPullT:0,idleLureT:0,hint:'',hintUntil:0,
 bite:null,fight:null,paused:false,ready:0,result:null,card:null,spawnT:0,t:0,W:360,H:300,dpr:1,pointerId:null,savedQuarter:0,lastMsg:''};
function ssRiverEl(id){return document.getElementById(id);}
function ssRiverState(){return game?.livingP0?.river||null;}
function ssRiverRand(a,b){return a+Math.random()*(b-a);}
function ssRiverPick(weights){const total=Object.values(weights).reduce((s,v)=>s+v,0);let r=Math.random()*total;for(const [k,v] of Object.entries(weights)){if((r-=v)<0)return k;}return 'river_fish';}
function ssRiverSurface(){return ssRiver.H*.2;}
function ssRiverBottom(){return ssRiver.H*RIVER_SPOTS[ssRiver.spot].bottom;}
function ssRiverBankX(){return ssRiver.W*.13;}
function ssRiverSpawn(initial){
 const s=RIVER_SPOTS[ssRiver.spot],species=ssRiverPick(s.weights),[lo,hi]=RIVER_FISH_SIZE[species];
 const size=Math.round(lo+(hi-lo)*Math.pow(Math.random(),s.bias));
 const top=ssRiverSurface()+18,bot=ssRiverBottom()-10;
 const y=species==='carp'?ssRiverRand(bot-ssRiver.H*.12,bot):species==='perch'?ssRiverRand(top+(bot-top)*.3,top+(bot-top)*.7):ssRiverRand(top,top+(bot-top)*.55);
 const x=initial?ssRiverRand(ssRiver.W*.3,ssRiver.W*.92):(Math.random()<.5?ssRiver.W*1.05:ssRiver.W*.35);
 ssRiver.fish.push({id:++ssRiverSeq,species,size,x,y,homeY:y,dir:Math.random()<.5?-1:1,speed:species==='river_fish'?34:species==='perch'?24:16,
  interest:0,state:'roam',turnT:ssRiverRand(1.5,4),react:0,leaveT:0,stayT:ssRiverRand(22,40),patrol:[ssRiver.W*ssRiverRand(.3,.5),ssRiver.W*ssRiverRand(.7,.95)]});
}
function ssRiverResetWater(){
 ssRiver.fish=[];ssRiver.lure=null;ssRiver.bite=null;ssRiver.spawnT=0;ssRiver.idleLureT=0;
 const n=ssRiver.spot==='B'?3:3+(Math.random()<.4?1:0);for(let i=0;i<n;i++)ssRiverSpawn(true);
}
function ssRiverResize(){
 const cv=ssRiverEl('riverCanvas');if(!cv)return;
 const r=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 ssRiver.W=Math.max(240,r.width||360);ssRiver.H=Math.max(180,r.height||280);ssRiver.dpr=dpr;
 cv.width=Math.round(ssRiver.W*dpr);cv.height=Math.round(ssRiver.H*dpr);
}
function ssRiverOpen(fixedSpot){
 if(ssRiverIsOpen||!game||!game.livingP0||$('overlay').classList.contains('open'))return false;
 let near='';
 if(fishingWorldActive){
  if(!livingOwn(RIVER_SPOTS,fixedSpot)||fishingWorldNearSpot()!==fixedSpot){fishingWorldToast('자리 표시 안으로 걸어가면 낚시할 수 있어요');return false;}
  near=fixedSpot;
 }else{
  if(!RIVER_FOREST_BANK)return false;
  const o=ssM17ObjectById('pond');if(!o||!ssM17NearObject(o)){flash('강변 낚시터에 조금 더 가까이 가세요');return false;}
  near=Object.entries(RIVER_SPOTS).map(([k,v])=>[k,Math.abs(p.x-v.x)]).sort((a,b)=>a[1]-b[1])[0][0];
 }
 game.livingP0=normalizeLivingP0(game.livingP0);
 ssM15ResetHeldInputs();releaseRope();paused=true;ssRiverIsOpen=true;
 const root=ssRiverEl('riverOverlay');root.hidden=false;$('app').classList.add('river-active');
 const at=ssRiverState().attempt;
 if(at&&fishingWorldActive&&at.spot!==near){paused=false;ssRiverIsOpen=false;root.hidden=true;$('app').classList.remove('river-active');fishingWorldToast(`걸려 있는 물고기는 자리 ${at.spot}에 있어요`);return false;}
 ssRiver.fixedSpot=fishingWorldActive?near:'';ssRiver.spot=at?at.spot:near;
 ssRiver.phase='idle';ssRiver.result=null;ssRiver.card=null;ssRiver.paused=false;ssRiver.hold=false;ssRiver.fight=null;ssRiver.hint='';ssRiver.hintUntil=0;
 ssRiverCastAt=-Infinity;ssRiverPoseName='';
 if(ssRiver.spot==='A')for(const key of ssRiverArt)ssRiverLoadImage(key,ssRiverArtRoot);
 ssRiverResize();ssRiverResetWater();
 if(at){ssRiverStartFight(at,true);}
 else if(game.livingP0.fishing){ssRiver.card='legacy';}
 if(!game.livingP0.rod)ssRiver.card='rod';
 ssRiverRender();ssRiverLast=performance.now();cancelAnimationFrame(ssRiverRaf);ssRiverRaf=requestAnimationFrame(ssRiverLoop);
 ssRiverEl('riverHold').focus({preventScroll:true});
 return true;
}
function ssRiverClose(){
 if(!ssRiverIsOpen)return false;
 ssRiverRelease();ssRiverSaveProgress(true);
 ssRiverIsOpen=false;cancelAnimationFrame(ssRiverRaf);
 ssRiverEl('riverOverlay').hidden=true;$('app').classList.remove('river-active');
 paused=ssIsTitle()||$('overlay').classList.contains('open')||!!ssM17PanelKind;
 if(fishingWorldActive){fishingWorldClearInput();fishingWorldRefreshHud();}
 ssM15ResetHeldInputs();updHud();return true;
}
function ssRiverSetSpot(id){
 if(!livingOwn(RIVER_SPOTS,id)||ssRiver.phase==='fight'||ssRiver.phase==='bite')return;
 if(ssRiver.fixedSpot&&id!==ssRiver.fixedSpot){ssRiverSay('다른 자리는 낚시터에서 걸어가서 골라요',2.4);return;}
 ssRiver.spot=id;ssRiver.phase='idle';ssRiverResetWater();ssRiverSay(RIVER_SPOTS[id].desc,3.5);ssRiverRender();
}
function ssRiverSay(text,sec=2.6){ssRiver.hint=text;ssRiver.hintUntil=ssRiver.t+sec;const el=ssRiverEl('riverHint');if(el)el.textContent=text;}
function ssRiverValidX(x){
 const s=RIVER_SPOTS[ssRiver.spot],W=ssRiver.W,min=W*.2,max=W*.95;
 const blocked=v=>s.blocks.some(([a,b])=>v>a*W&&v<b*W);
 x=Math.max(min,Math.min(max,x));if(!blocked(x))return x;
 const cands=[];for(const [a,b] of s.blocks){cands.push(a*W-1,b*W+1);}
 return cands.filter(v=>v>=min&&v<=max&&!blocked(v)).sort((a,b)=>Math.abs(a-x)-Math.abs(b-x))[0]??x;
}
function ssRiverCast(tx){
 if(ssRiver.paused||ssRiver.card||!game.livingP0.rod)return;
 if(ssRiver.phase==='lure'){ssRiverSay('먼저 회수하거나 찌를 지켜보세요');return;}
 if(ssRiver.phase!=='idle')return;
 const x=ssRiverValidX(tx);
 ssRiverCastAt=ssRiver.t;
 ssRiver.lure={x,y:ssRiverSurface()+4,vy:0,drop:0};ssRiver.phase='lure';ssRiver.idleLureT=0;ssRiver.lastPullT=0;ssRiver.holdT=0;
 try{playSound('fish_cast');}catch(_){}
 ssRiverSay(Math.abs(x-tx)>6?'수초·바위를 피해 가까운 물에 떨어졌어요':'찌가 떨어졌어요. 그림자의 반응을 보세요',2.4);ssRiverRender();
}
function ssRiverRetrieve(){
 if(ssRiver.phase!=='lure')return;
 for(const f of ssRiver.fish)f.interest=Math.max(0,f.interest-.3);
 ssRiver.lure=null;ssRiver.phase='idle';ssRiverSay('찌를 회수했어요. 다른 곳에 던지거나 자리를 바꿔 보세요');ssRiverRender();
}
function ssRiverPress(){
 if(ssRiver.paused||ssRiver.card||ssRiver.ready>0)return;
 if(ssRiver.phase==='idle'){ssRiverCast(ssRiver.W*.62);return;}
 if(ssRiver.phase==='bite'){ssRiverHook();return;}
 if(ssRiver.phase==='result'){ssRiverContinue();return;}
 ssRiver.hold=true;ssRiver.holdT=0;ssRiverEl('riverHold').classList.add('down');
}
function ssRiverRelease(){
 if(!ssRiver.hold){ssRiverEl('riverHold')?.classList.remove('down');return;}
 ssRiver.hold=false;ssRiverEl('riverHold').classList.remove('down');
 if(ssRiver.phase==='lure'&&ssRiver.lure){
  const pull=ssRiver.holdT;ssRiver.lastPullT=ssRiver.t;
  // 피라미: short pull (not a mash) followed by a stop draws it in.
  if(pull>=.15&&pull<=.7)for(const f of ssRiver.fish){if(f.species!=='river_fish'||f.state==='leave')continue;
   const d=Math.hypot(f.x-ssRiver.lure.x,f.y-ssRiver.lure.y);if(d<ssRiver.W*.42){f.interest=Math.min(1,f.interest+.36);f.react=.6;}}
 }
}
function ssRiverHook(){
 const b=ssRiver.bite;if(!b)return;
 const f=b.fish,attempt='r'+Date.now().toString(36)+(++ssRiverSeq);
 const r=ssRiverCommand('river.hook',{item:f.species,size:f.size,spot:ssRiver.spot,attempt});
 if(!r.ok){ssRiverSay(r.reason||'걸지 못했어요');ssRiver.bite=null;ssRiver.phase='lure';return;}
 ssRiver.fish=ssRiver.fish.filter(x=>x!==f);ssRiver.bite=null;ssRiver.lure=null;
 try{playSound('fish_bite');}catch(_){}
 ssRiverStartFight(ssRiverState().attempt,false);
}
function ssRiverStartFight(a,restored){
 const tune=RIVER_FIGHT[a.fish];
 ssRiver.fight={id:a.id,fish:a.fish,size:a.size,progress:a.progress,strain:0,stall:false,pi:0,pt:0,pdur:0,bonus:0,taut:0,wob:0};
 ssRiverNextPhase(true);ssRiver.phase='fight';ssRiver.savedQuarter=Math.floor(a.progress/25);
 if(restored){ssRiver.paused=true;ssRiver.card='resume';ssRiverClearHint();}
 else ssRiverSay(tune.phases[0][0]==='loose'?'힘이 풀렸어요. 길게 감으세요':'틈이 보이면 감으세요. 손을 떼도 진도는 남아요',2.6);
 ssRiverRender();
}
function ssRiverNextPhase(first){
 const f=ssRiver.fight,ph=RIVER_FIGHT[f.fish].phases;
 if(!first)f.pi=(f.pi+1)%ph.length;
 const [name,a,b]=ph[f.pi];f.pdur=ssRiverRand(a,b)+(['gap','loose'].includes(name)?f.bonus:0);f.pt=0;
 if(['gap','loose'].includes(name))f.bonus=0;
 const hints={gap:'틈이 생겼어요 · 감으세요',flutter:'파닥거려요 · 잠깐 멈춰요',warn:'몸을 꺾어요 · 곧 손을 떼세요',dash:'돌진! 손을 떼고 흘려 보내세요',loose:'힘이 풀렸어요 · 길게 감으세요',hold:'바닥에서 버텨요 · 기다리세요'};
 if(!f.stall)ssRiverSay(hints[name],f.pdur+.2);
}
function ssRiverTickFight(dt){
 const f=ssRiver.fight,ph=RIVER_FIGHT[f.fish].phases[f.pi][0];
 f.pt+=dt;if(f.pt>=f.pdur){
  if(ph==='dash'&&!f.dashHeld)f.bonus=.45; // let the run go → longer next gap
  f.dashHeld=false;ssRiverNextPhase(false);
 }
 const cur=RIVER_FIGHT[f.fish].phases[f.pi][0],open=cur==='gap'||cur==='loose';
 f.taut=0;
 if(ssRiver.hold){
  ssRiver.holdT+=dt;
  if(!f.stall&&open)f.progress=Math.min(100,f.progress+dt*100/RIVER_FIGHT[f.fish].need*(cur==='loose'?1:1));
  else if(!f.stall&&cur==='warn')f.progress=Math.min(100,f.progress+dt*100/RIVER_FIGHT[f.fish].need*.25);
  f.strain=Math.min(1.2,f.strain+dt*(open?.2:cur==='warn'?.35:.75));
  if(!open)f.taut=1;if(cur==='dash')f.dashHeld=true;
  if(f.strain>=1&&!f.stall){f.stall=true;ssRiverSay('무리했어요 · 잠깐 손을 떼면 회복돼요',2.4);try{navigator.vibrate?.(40);}catch(_){}}
  if(f.stall)f.taut=1;
 }else{
  f.strain=Math.max(0,f.strain-dt*.9);
  if(f.stall&&f.strain<.35){f.stall=false;ssRiverSay('회복했어요 · 다시 틈을 노리세요',1.6);}
 }
 f.wob+=dt*(f.taut?26:6);
 const q=Math.floor(f.progress/25);if(q>ssRiver.savedQuarter){ssRiver.savedQuarter=q;ssRiverSaveProgress(false);}
 if(f.progress>=100)ssRiverLand();
}
function ssRiverSaveProgress(silent){
 const a=ssRiverState()?.attempt,f=ssRiver.fight;if(!a||!f||a.id!==f.id)return;
 const v=Math.min(100,Math.floor(f.progress));if(v<=a.progress)return;
 a.progress=v;saveGame(true);
}
function ssRiverLand(){
 const f=ssRiver.fight;ssRiver.hold=false;ssRiverEl('riverHold').classList.remove('down');
 const r=ssRiverCommand('river.catch',{attempt:f.id});
 if(!r.ok){ssRiver.card='savefail';ssRiver.lastMsg=r.reason||'';ssRiver.paused=true;ssRiverRender();return;}
 ssRiver.fight=null;ssRiver.phase='result';ssRiver.result=r.river;ssRiverSay('끌어올렸어요! 가방에 보관했어요',3);
 try{playSound('craft_complete');}catch(_){}
 ssRiverRender();
}
function ssRiverReleaseFish(){
 const a=ssRiverState()?.attempt;if(a){ssRiverState().attempt=null;saveGame(true);}
 ssRiver.fight=null;ssRiver.phase='idle';ssRiver.card=null;ssRiver.paused=false;ssRiverSay('물고기를 놓아줬어요. 보상은 없어요');ssRiverRender();
}
function ssRiverContinue(){ssRiver.result=null;ssRiver.phase='idle';if(ssRiver.fish.length<2)ssRiverSpawn(false);ssRiverRender();}
function ssRiverContext(){
 if(fishingWorldActive){
  if(!ssRiver.fixedSpot||fishingWorldNearSpot()!==ssRiver.fixedSpot)return null;
  return {x:LIVING_SITES.pond,y:76,groundY:76}; // proximity already checked in fishing_01 coordinates
 }
 return {x:p.x,y:p.y,groundY:terrain(p.x)-1};
}
function ssRiverCommand(type,extra){
 const where=ssRiverContext();if(!where)return {ok:false,reason:'낚시 자리에서 벗어났어요'};
 const cmd={id:'river-'+type.replace('.','-')+'-'+(extra.attempt||Date.now()),type,target:'pond',...extra};
 const r=applyLivingCommandPure(game.livingP0,cmd,{...where,inv:game.inv,coins:game.coins,seed:game.seed});
 if(!r.ok)return r;
 const oldState=game.livingP0,oldInv=game.inv,oldCoins=game.coins;
 game.livingP0=r.state;game.inv=r.inv;game.coins=r.coins;
 if(!saveGame(true)){game.livingP0=oldState;game.inv=oldInv;game.coins=oldCoins;return {ok:false,reason:'저장에 실패해 결과를 확정하지 못했어요. 저장 공간을 확인해 주세요'};}
 updHud();return r;
}
function ssRiverClearHint(){ssRiver.hint='';ssRiver.hintUntil=0;const el=ssRiverEl('riverHint');if(el)el.textContent=ssRiverDefaultHint();}
function ssRiverPause(reason){
 if(!ssRiverIsOpen||ssRiver.paused)return;
 ssRiverRelease();ssRiverClearHint();
 if(ssRiver.phase==='fight'||ssRiver.phase==='bite'||ssRiver.phase==='lure'){ssRiver.paused=true;ssRiver.card='pause';ssRiverSaveProgress(true);ssRiverRender();}
}
function ssRiverResume(){ssRiver.paused=false;ssRiver.card=null;ssRiver.ready=.9;ssRiverSay('준비…',.9);ssRiverRender();}
function ssRiverTickLure(dt){
 const L=ssRiver.lure,s=RIVER_SPOTS[ssRiver.spot],surf=ssRiverSurface(),bot=ssRiverBottom();
 if(ssRiver.hold){ssRiver.holdT+=dt;L.x-=dt*ssRiver.W*.13;L.y=Math.max(surf+6,L.y-dt*12);}
 else{L.y=Math.min(bot-8,L.y+dt*30);L.x-=dt*ssRiver.W*s.flow*.55;}
 if(L.x<ssRiverBankX()+8){ssRiver.lure=null;ssRiver.phase='idle';ssRiverSay('찌가 발밑까지 돌아왔어요');ssRiverRender();return;}
 const quietFor=ssRiver.hold?0:ssRiver.t-ssRiver.lastPullT;
 let anyInterest=false;
 for(const f of ssRiver.fish){
  if(f.state==='leave')continue;
  const dx=L.x-f.x,dy=L.y-f.y,d=Math.hypot(dx,dy),R=ssRiver.W*(f.species==='carp'?.3:.42);
  if(f.species==='perch'&&ssRiver.hold&&d<ssRiver.W*.45&&Math.abs(dy)<ssRiver.H*.28&&dx*f.dir>0){f.interest+=dt*.7;f.react=.4;}
  else if(f.species==='carp'&&d<R){
   if(ssRiver.hold){f.interest=Math.max(0,f.interest-dt*.5);if(f.interest===0&&ssRiver.holdT>.8){f.state='leave';f.dir=dx>0?-1:1;}}
   else if(quietFor>.8&&(L.y>bot-ssRiver.H*.2||s.flow>.1)){f.interest+=dt*.24;f.react=.3;}
  }
  else if(f.species==='river_fish'&&ssRiver.hold&&ssRiver.holdT>1&&d<R)f.interest=Math.max(0,f.interest-dt*.3);
  if(!ssRiver.hold&&f.species!=='carp'&&quietFor>3)f.interest=Math.max(0,f.interest-dt*.06);
  f.interest=Math.min(1.05,f.interest);
  if(f.interest>.3)anyInterest=true;
  if(f.interest>=1&&d<20&&!ssRiver.bite){ssRiver.bite={fish:f,t:0};ssRiver.phase='bite';ssRiver.hold=false;ssRiverEl('riverHold').classList.remove('down');
   ssRiverSay('찌가 가라앉았어요! 지금 걸기',RIVER_BITE_WINDOW);try{playSound('fish_bite');navigator.vibrate?.(60);}catch(_){}ssRiverRender();return;}
 }
 ssRiver.idleLureT=anyInterest?0:ssRiver.idleLureT+dt;
 if(ssRiver.idleLureT>8){ssRiver.idleLureT=-6;const near=ssRiver.fish.filter(f=>f.state!=='leave').sort((a,b)=>Math.abs(a.x-L.x)-Math.abs(b.x-L.x))[0];if(near)ssRiverSay(RIVER_HINTS[near.species],4);}
}
function ssRiverTickFish(dt){
 const L=ssRiver.lure,surf=ssRiverSurface()+14,bot=ssRiverBottom()-8;
 for(const f of ssRiver.fish){
  f.react=Math.max(0,f.react-dt);
  if(f.state==='leave'){f.x+=f.dir*f.speed*2.2*dt;continue;}
  if(ssRiver.bite&&ssRiver.bite.fish===f){f.x+=(L.x-f.x)*Math.min(1,dt*6);f.y+=(L.y-f.y)*Math.min(1,dt*6);continue;}
  if(L&&f.interest>.25){
   const dx=L.x-f.x,dy=L.y-f.y,d=Math.hypot(dx,dy)||1,sp=f.speed*(.6+f.interest*1.2);
   f.dir=dx>=0?1:-1;f.x+=dx/d*sp*dt;f.y+=dy/d*sp*dt*.8;
  }else{
   if(!L)f.interest=Math.max(0,f.interest-dt*.2);
   // shadows drift on after a while so the spot's mix rotates without reopening the view
   f.stayT-=dt;if(f.stayT<=0&&f.interest<.1){f.state='leave';f.dir=f.x>ssRiver.W*.6?1:-1;ssRiverSpawn(false);continue;}
   if(f.species==='perch'){if(f.x<f.patrol[0])f.dir=1;else if(f.x>f.patrol[1])f.dir=-1;}
   else{f.turnT-=dt;if(f.turnT<=0){f.turnT=ssRiverRand(1.5,4);f.dir*=-1;}}
   f.x+=f.dir*f.speed*.5*dt;f.y+=(f.homeY-f.y)*dt*.5+Math.sin(ssRiver.t*1.3+f.id)*dt*(f.species==='carp'?2:5);
   if(f.x<ssRiver.W*.24)f.dir=1;if(f.x>ssRiver.W*.97)f.dir=-1;
  }
  f.y=Math.max(surf,Math.min(bot,f.y));
 }
 ssRiver.fish=ssRiver.fish.filter(f=>f.x>-60&&f.x<ssRiver.W+60);
 const respawn=(game.livingP0.foodBuff?.type==='fish'&&game.livingP0.foodBuff.until>game.livingP0.clock)?6:LIVING_CLOCK_FISH;
 if(ssRiver.fish.length<3){ssRiver.spawnT+=dt;if(ssRiver.spawnT>=respawn){ssRiver.spawnT=0;ssRiverSpawn(false);}}else ssRiver.spawnT=0;
}
function ssRiverLoop(now){
 if(!ssRiverIsOpen)return;
 const dt=Math.min(.05,Math.max(0,(now-ssRiverLast)/1000));ssRiverLast=now;
 if(!ssRiver.paused&&!ssRiver.card){
  ssRiver.t+=dt;
  // The side-scroll loop is paused while this view is open, so the shared life clock (crops,
  // energy, tree regrowth, food buffs, NPC cooldowns) advances here instead: active time only,
  // never while the pause/resume card is up, and never twice.
  livingWorldTick(dt);
  if(ssRiver.ready>0){ssRiver.ready=Math.max(0,ssRiver.ready-dt);}
  else{
   if(ssRiver.phase==='lure'&&ssRiver.lure)ssRiverTickLure(dt);
   if(ssRiver.phase==='bite'&&ssRiver.bite){ssRiver.bite.t+=dt;if(ssRiver.bite.t>=RIVER_BITE_WINDOW){const f=ssRiver.bite.fish;f.state='leave';f.interest=0;f.dir=1;ssRiver.bite=null;ssRiver.phase='lure';ssRiverSay('놓쳤어요. 다른 그림자를 노려 보세요',2.4);ssRiverRender();}
    else if(ssRiverState()?.assist&&ssRiver.bite.t>.5)ssRiverHook();}
   if(ssRiver.phase==='fight'&&ssRiver.fight)ssRiverTickFight(dt);
   if(ssRiver.phase!=='fight'&&ssRiver.phase!=='result')ssRiverTickFish(dt);
  }
  if(ssRiver.hintUntil&&ssRiver.t>ssRiver.hintUntil){ssRiver.hintUntil=0;const el=ssRiverEl('riverHint');if(el)el.textContent=ssRiverDefaultHint();}
 }
 ssRiverDraw();ssRiverSyncButton();
 ssRiverRaf=requestAnimationFrame(ssRiverLoop);
}
function ssRiverDefaultHint(){
 if(ssRiver.phase==='idle')return '수면을 눌러 던지세요 · 빗금은 던질 수 없는 곳';
 if(ssRiver.phase==='lure')return '누르면 감고, 떼면 멈춰요 · 그림자의 방향을 보세요';
 if(ssRiver.phase==='fight')return '틈에 감고, 버티면 손을 떼세요';
 return '';
}
function ssRiverSyncButton(){
 const b=ssRiverEl('riverHold');if(!b)return;
 const label=ssRiver.phase==='idle'?'가운데로 던지기':ssRiver.phase==='lure'?(ssRiver.hold?'감는 중…':'누르고 있으면 감기'):ssRiver.phase==='bite'?'지금 걸기!':ssRiver.phase==='fight'?(ssRiver.fight?.stall?'잠깐 손을 떼세요':ssRiver.hold?'감는 중…':'누르고 있으면 감기'):'계속 낚시';
 if(b.textContent!==label)b.textContent=label;
 b.classList.toggle('bite',ssRiver.phase==='bite');
 const rt=ssRiverEl('riverRetrieve');if(rt)rt.disabled=ssRiver.phase!=='lure';
}
function ssRiverDraw(){
 const cv=ssRiverEl('riverCanvas');if(!cv)return;const c=cv.getContext('2d'),W=ssRiver.W,H=ssRiver.H,s=RIVER_SPOTS[ssRiver.spot];
 c.setTransform(ssRiver.dpr,0,0,ssRiver.dpr,0,0);
 const surf=ssRiverSurface(),bot=ssRiverBottom(),bank=ssRiverBankX(),t=ssRiver.t;
 const art=ssRiverAView();
 if(art){c.translate(0,art.head);c.scale(1,art.sy);ssRiverPaintA(c,W,H,surf,bot,bank,t,-art.head/art.sy);}else{
 const sky=c.createLinearGradient(0,0,0,surf);sky.addColorStop(0,'#b9e3dc');sky.addColorStop(1,'#d9efd3');c.fillStyle=sky;c.fillRect(0,0,W,surf);
 const lit=game.storyM1?.springRepaired;
 const g=c.createLinearGradient(0,surf,0,H);g.addColorStop(0,lit?'#3f9fae':'#4a8b96');g.addColorStop(1,'#163d4a');c.fillStyle=g;c.fillRect(0,surf,W,H-surf);
 c.fillStyle='#5b4a35';c.beginPath();c.moveTo(0,bot+20);for(let x=0;x<=W;x+=24)c.lineTo(x,bot+Math.sin(x*.05)*5);c.lineTo(W,H);c.lineTo(0,H);c.fill();
 // flow streaks
 c.strokeStyle='#ffffff2e';c.lineWidth=1.5;
 for(let i=0;i<9;i++){const yy=surf+12+i*(bot-surf-20)/9,off=((t*s.flow*W*.9+i*53)%(W+80));c.beginPath();c.moveTo(W-off,yy);c.lineTo(W-off+18+s.flow*120,yy);c.stroke();}
 c.fillStyle='#ffffff55';for(let x=0;x<W;x+=22){c.fillRect((x+t*12)%W,surf-1+Math.sin(x+t*2)*1.5,10,2);}
 }
 // blocked zones (weeds / rock)
 for(const [a,b] of s.blocks){const A=a*W,B=b*W;
  if(art){const w=Math.min(48,Math.max(19,(B-A)*.72));for(let x=A;x<B;x+=w*.72)c.drawImage(ssRiverImage('prop-reeds'),x-w*.11,bot-w*.82,w,w*.87);}
  else if(ssRiver.spot==='A'){c.fillStyle='#3e7a46';for(let x=A;x<B;x+=7){c.fillRect(x,surf-10-Math.sin(x)*4,3,bot-surf+10);}}
  else{c.fillStyle='#6f6f66';c.beginPath();c.moveTo(A,bot);c.lineTo(A+8,surf-14);c.lineTo(B-6,surf-18);c.lineTo(B,bot);c.fill();}
  if(ssRiver.phase==='idle'){c.save();c.strokeStyle='#ffd27a';c.lineWidth=1;c.setLineDash([4,4]);c.strokeRect(A,surf-22,B-A,18);c.restore();
   c.fillStyle='#ffd27a';c.font='bold 10px system-ui';c.textAlign='center';c.fillText('불가',(A+B)/2,surf-9);}
 }
 // bank + angler
 let tipX=bank+16,tipY=surf-48;
 if(art){[tipX,tipY]=ssRiverDrawAngler(c,surf,bank,t,art);}else{
 c.fillStyle='#6e9a52';c.fillRect(0,surf-6,bank,8);c.fillStyle='#7b5a3c';c.fillRect(0,surf+2,bank,H);
 c.fillStyle='#2b3b49';c.fillRect(bank-22,surf-34,10,28);c.fillStyle='#f1c99b';c.fillRect(bank-23,surf-44,12,11);
 c.strokeStyle='#8a5b33';c.lineWidth=3;c.beginPath();c.moveTo(bank-12,surf-24);c.lineTo(tipX,tipY);c.stroke();
 }
 // fish shadows
 const drawFish=(x,y,size,dir,species,alpha,glow,bend)=>{
  const len=12+size/450*58,h=len*(species==='carp'?.42:species==='perch'?.34:.28);
  c.save();c.translate(x,y);c.scale(dir,1);c.rotate(bend||0);c.globalAlpha=alpha;
  if(glow){c.strokeStyle='#fff3b0';c.lineWidth=2;c.beginPath();c.ellipse(0,0,len*.62,h*.9,0,0,Math.PI*2);c.stroke();}
  if(art){const fps={river_fish:7,perch:8,carp:5}[species],frame=ssRiverMotion.matches?0:Math.floor(t*fps+x*.025)%6;
   ssRiverSheet(c,species,(frame+6)%6,0,0,192,112,6,112,56,len/128);c.restore();return;}
  c.fillStyle=species==='carp'?'#10222a':'#132a33';c.beginPath();c.ellipse(0,0,len/2,h/2,0,0,Math.PI*2);c.fill();
  c.beginPath();c.moveTo(-len/2+2,0);c.lineTo(-len/2-len*.28,-h*.55);c.lineTo(-len/2-len*.28,h*.55);c.fill();c.restore();
 };
 if(ssRiver.phase!=='fight'&&ssRiver.phase!=='result')for(const f of ssRiver.fish)drawFish(f.x,f.y,f.size,f.dir,f.species,.62+Math.min(.3,f.interest*.3),f.react>0||f.interest>.3,0);
 // line + lure / bobber
 const L=ssRiver.lure;
 if(L&&ssRiver.phase!=='fight'){
  const sink=ssRiver.phase==='bite'?6+Math.sin(t*20)*2:0;
  const bx=L.x,by=surf+sink;
  c.strokeStyle='#f5f2e2aa';c.lineWidth=1;c.beginPath();c.moveTo(tipX,tipY);c.quadraticCurveTo((tipX+bx)/2,surf-30,bx,by-3);c.stroke();
  c.beginPath();c.moveTo(bx,by);c.lineTo(L.x,L.y);c.stroke();
  if(art)c.drawImage(ssRiverImage('bobber-32'),bx-10,by-12,20,20);
  else{c.fillStyle='#e84c3d';c.beginPath();c.arc(bx,by-2,5,Math.PI,0);c.fill();c.fillStyle='#fafafa';c.beginPath();c.arc(bx,by-2,5,0,Math.PI);c.fill();}
  c.fillStyle='#ffd27a';c.fillRect(L.x-2,L.y-2,4,4);
  if(ssRiver.phase==='bite'){c.strokeStyle='#fff3b0';c.lineWidth=2;const r=10+(ssRiver.bite.t*18)%16;c.beginPath();c.ellipse(bx,surf,r,r*.35,0,0,Math.PI*2);c.stroke();}
 }
 if(ssRiver.phase==='fight'&&ssRiver.fight){
  const f=ssRiver.fight,ph=RIVER_FIGHT[f.fish].phases[f.pi][0],dist=1-f.progress/100;
  let fx=bank+30+dist*(W*.78-30),fy=surf+(bot-surf)*(f.fish==='carp'?.75:.45);
  let bend=0;
  if(ph==='dash'){fx+=Math.min(1,f.pt/f.pdur)*W*.08;bend=Math.sin(t*14)*.25;}
  else if(ph==='warn'){bend=Math.sin(t*22)*.35;}
  else if(ph==='hold'){fy=bot-12;}
  else if(ph==='flutter'){bend=Math.sin(t*30)*.3;fy+=Math.sin(t*18)*4;}
  const dir=(ph==='dash'||ph==='hold'||ph==='flutter')?1:-1;
  const tense=f.taut||f.stall;
  c.strokeStyle=tense?'#ff8a5c':'#f5f2e2cc';c.lineWidth=tense?2:1.2;c.beginPath();c.moveTo(tipX,tipY);
  const mx=(tipX+fx)/2,my=tense?(tipY+fy)/2+Math.sin(f.wob)*3:(tipY+fy)/2+30;c.quadraticCurveTo(mx,my,fx,fy);c.stroke();
  drawFish(fx,fy,f.size,dir,f.fish,.95,ph==='gap'||ph==='loose',bend);
  if(ph==='hold'&&ssRiver.hold){c.fillStyle='#c9b58d88';for(let i=0;i<5;i++)c.fillRect(fx-14+i*7+Math.sin(t*9+i)*3,bot-4-((t*30+i*9)%14),3,3);}
  // distance track (no numeric tension)
  c.fillStyle='#0b1f2799';c.fillRect(12,H-20,W-24,8);c.fillStyle='#ffe28a';c.fillRect(12,H-20,(W-24)*f.progress/100,8);
  c.fillStyle='#fff';c.font='bold 10px system-ui';c.textAlign='left';c.fillText('발밑까지',12,H-25);
  // reel indicator
  c.save();c.translate(bank-6,surf-18);c.rotate(ssRiver.hold?t*(f.stall||!['gap','loose'].includes(ph)?30:8):0);c.strokeStyle=f.stall?'#ff8a5c':'#f8e9aa';c.lineWidth=2;c.beginPath();c.arc(0,0,6,0,Math.PI*1.6);c.stroke();c.restore();
 }
 if(ssRiver.ready>0){c.fillStyle='#081d2a88';c.fillRect(0,0,W,H);c.fillStyle='#fff3b0';c.font='900 22px system-ui';c.textAlign='center';c.fillText('준비…',W/2,H/2);}
}
function ssRiverDexHtml(){
 const w=game.livingP0,r=w.river;
 return LIVING_FISH_ORDER.map(id=>{const has=w.fishDex.includes(id);const best=r.best[id];
  return `<span class="river-dex ${has?'has':''}">${has?fcbIconHtml(id,''):'<i>?</i>'}<b>${has?LIVING_FISH[id].name:'미발견'}</b><small>${has?(best?'최고 '+(best/10).toFixed(1)+'cm':'크기 미기록'):''}</small></span>`;}).join('');
}
function ssRiverRender(){
 if(!ssRiverIsOpen)return;
 const w=game.livingP0,r=w.river,s=RIVER_SPOTS[ssRiver.spot];
 ssRiverEl('riverTitle').textContent=(fishingWorldActive?'🎣 도래 낚시터 · ':'🎣 잔빛숲 강변 · ')+s.short;
 for(const b of document.querySelectorAll('#riverSpots button')){const id=b.dataset.spot;b.classList.toggle('on',id===ssRiver.spot);b.disabled=ssRiver.phase==='fight'||ssRiver.phase==='bite'||!!ssRiver.card||(!!ssRiver.fixedSpot&&id!==ssRiver.fixedSpot);}
 ssRiverEl('riverBag').innerHTML=`도감 ${w.fishDex.length}/3 · 가방 피라미 ${w.bag.river_fish} · 강농어 ${w.bag.perch} · 비단잉어 ${w.bag.carp}`;
 const el=ssRiverEl('riverHint');if(el&&!ssRiver.hintUntil)el.textContent=ssRiverDefaultHint();
 const card=ssRiverEl('riverCard');let html='';
 if(ssRiver.card==='rod'){
  const wood=game.inv.wood||0;
  html=`<h3>나무 낚싯대가 필요해요</h3><p>원목 3개로 만들어요 (보유 ${wood}). 한 번 만들면 다시 내지 않아요.</p><div class="river-row"><button type="button" data-river="craft" ${wood<3?'disabled':''}>🪵 낚싯대 만들기</button><button type="button" data-river="exit" class="alt">나가기</button></div>${wood<3?'<small>잔빛숲 나무를 벌목하면 원목을 얻어요.</small>':''}`;
 }else if(ssRiver.card==='legacy'){
  const f=w.fishing;html=`<h3>예전에 걸어 둔 물고기</h3><p>${LIVING_FISH[f.id].name}이(가) 아직 줄에 있어요. 새 방식으로 이어서 끌어올릴 수 있어요.</p><div class="river-row"><button type="button" data-river="legacy">이어서 끌어올리기</button><button type="button" data-river="dismiss" class="alt">새로 시작</button></div>`;
 }else if(ssRiver.card==='resume'||ssRiver.card==='pause'){
  const f=ssRiver.fight;
  html=`<h3>${ssRiver.card==='resume'?'걸려 있던 물고기':'일시정지'}</h3><p>${f?LIVING_FISH[f.fish].name+' · 발밑까지 '+Math.floor(f.progress)+'% · 진도는 그대로예요.':'준비되면 다시 시작하세요.'}</p><div class="river-row"><button type="button" data-river="resume">준비 후 재개</button>${f?'<button type="button" data-river="letgo" class="alt">놓아주기</button>':''}</div>`;
 }else if(ssRiver.card==='exitfight'){
  html=`<h3>낚시를 멈출까요?</h3><p>닫아도 걸린 물고기와 진도는 저장돼요. 놓아주면 보상 없이 끝나요.</p><div class="river-row"><button type="button" data-river="close">닫고 나중에 이어하기</button><button type="button" data-river="letgo" class="alt">놓아주기</button><button type="button" data-river="resume" class="alt">계속하기</button></div>`;
 }else if(ssRiver.card==='savefail'){
  html=`<h3>저장하지 못했어요</h3><p>${ssRiver.lastMsg||'저장 공간을 확인해 주세요.'} 물고기는 아직 줄에 있어요.</p><div class="river-row"><button type="button" data-river="retry">다시 확정</button><button type="button" data-river="close" class="alt">닫기</button></div>`;
 }else if(ssRiver.phase==='result'&&ssRiver.result){
  const x=ssRiver.result,info=LIVING_FISH[x.fish];
  html=`<div class="river-result">${fcbIconHtml(x.fish,info.name)}<div><h3>${info.name} · ${(x.size/10).toFixed(1)}cm</h3><p>${x.firstDex?'📖 도감에 새로 기록했어요':x.record?'🏅 최고 크기 신기록!':'📖 도감 기록 확인'}</p></div></div>
   <ul class="river-facts"><li>🎒 가방에 보관됨 · <b>판매 전</b> (보유 ${w.bag[x.fish]})</li><li>🪙 바람장터에서 ${info.price}C에 팔 수 있어요</li><li>🍲 요리: 생선 스튜 = 물고기 1 + 감자 1 (바람장터 요리대)</li></ul>
   <div class="river-row"><button type="button" data-river="again">계속 낚시</button><button type="button" data-river="exit" class="alt">나가기</button></div>`;
 }
 card.innerHTML=html;card.hidden=!html;
 ssRiverEl('riverDex').innerHTML=ssRiverDexHtml();
 ssRiverEl('riverAssist').checked=!!r.assist;
 ssRiverSyncButton();
}
function ssRiverCardAction(act){
 const w=game.livingP0;
 if(act==='exit'||act==='close'){ssRiver.card=null;ssRiverClose();return;}
 if(act==='craft'){const r=ssRiverCommand('craft.rod',{});if(!r.ok)ssRiverSay(r.reason||'제작하지 못했어요',2.6);if(r.ok){ssRiver.card=w.fishing?'legacy':null;ssRiverSay('나무 낚싯대를 만들었어요. 수면을 눌러 던져 보세요',3);}ssRiverRender();if(fishingWorldActive)fishingWorldRefreshHud();return;}
 if(act==='legacy'){const r=ssRiverCommand('river.hook',{legacy:true,item:game.livingP0.fishing?.id,size:(()=>{const id=game.livingP0.fishing?.id,[lo,hi]=RIVER_FISH_SIZE[id]||[60,120];return Math.round(ssRiverRand(lo,hi));})(),spot:ssRiver.spot,attempt:'r'+Date.now().toString(36)+(++ssRiverSeq)});
  if(!r.ok){ssRiverSay(r.reason||'이어하지 못했어요');ssRiver.card=null;ssRiverRender();return;}
  ssRiver.card=null;ssRiverStartFight(ssRiverState().attempt,false);return;}
 if(act==='dismiss'){ssRiver.card=null;ssRiverRender();return;}
 if(act==='resume'){ssRiverResume();return;}
 if(act==='letgo'){ssRiverReleaseFish();return;}
 if(act==='retry'){ssRiver.card=null;ssRiver.paused=false;ssRiverLand();return;}
 if(act==='again'){ssRiverContinue();return;}
}
(function ssRiverWire(){
 const root=ssRiverEl('riverOverlay');if(!root)return;
 const cv=ssRiverEl('riverCanvas'),hold=ssRiverEl('riverHold');
 cv.addEventListener('pointerdown',e=>{e.preventDefault();if(ssRiver.phase!=='idle'){if(ssRiver.phase==='bite')ssRiverHook();return;}
  const r=cv.getBoundingClientRect(),x=e.clientX-r.left,view=ssRiverAView(),screenY=e.clientY-r.top,y=view?(screenY-view.head)/view.sy:screenY;
  if(y<ssRiverSurface()-30||x<ssRiverBankX()){ssRiverSay('물 위를 눌러 던지세요');return;}ssRiverCast(x);});
 hold.addEventListener('pointerdown',e=>{e.preventDefault();if(ssRiver.pointerId!==null)return;ssRiver.pointerId=e.pointerId;try{hold.setPointerCapture(e.pointerId);}catch(_){}ssRiverPress();});
 const up=e=>{if(ssRiver.pointerId!==e.pointerId)return;ssRiver.pointerId=null;ssRiverRelease();};
 hold.addEventListener('pointerup',up);hold.addEventListener('pointercancel',up);hold.addEventListener('lostpointercapture',up);
 hold.addEventListener('contextmenu',e=>e.preventDefault());
 hold.addEventListener('click',e=>{if(e.detail===0){ssRiverPress();setTimeout(ssRiverRelease,120);}});
 ssRiverEl('riverRetrieve').addEventListener('click',()=>ssRiverRetrieve());
 ssRiverEl('riverPause').addEventListener('click',()=>{if(ssRiver.paused)ssRiverResume();else{ssRiverRelease();ssRiverClearHint();ssRiver.paused=true;ssRiver.card='pause';ssRiverSaveProgress(true);ssRiverRender();}});
 ssRiverEl('riverExit').addEventListener('click',()=>{if(ssRiver.phase==='fight'){ssRiverRelease();ssRiverClearHint();ssRiver.paused=true;ssRiver.card='exitfight';ssRiverSaveProgress(true);ssRiverRender();}else ssRiverClose();});
 ssRiverEl('riverSpots').addEventListener('click',e=>{const b=e.target.closest('button[data-spot]');if(b)ssRiverSetSpot(b.dataset.spot);});
 ssRiverEl('riverCard').addEventListener('click',e=>{const b=e.target.closest('button[data-river]');if(b){e.preventDefault();ssRiverCardAction(b.dataset.river);}});
 ssRiverEl('riverAssist').addEventListener('change',e=>{const r=ssRiverState();if(r){r.assist=!!e.target.checked;saveGame(true);}});
 window.addEventListener('keydown',e=>{if(!ssRiverIsOpen)return;const k=e.key.toLowerCase();
  if(k===' '||k==='f'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)ssRiverPress();}
  else if(k==='escape'){e.preventDefault();e.stopImmediatePropagation();if(ssRiver.phase==='fight'){ssRiverRelease();ssRiverClearHint();ssRiver.paused=true;ssRiver.card='exitfight';ssRiverSaveProgress(true);ssRiverRender();}else ssRiverClose();}
  else if(['1','2','3'].includes(k)){e.preventDefault();e.stopImmediatePropagation();ssRiverSetSpot('ABC'[Number(k)-1]);}
  else if(k==='r'){e.preventDefault();e.stopImmediatePropagation();ssRiverRetrieve();}
  else if(['w','a','s','d','e','arrowleft','arrowright','arrowup','arrowdown','m','t'].includes(k)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 window.addEventListener('keyup',e=>{if(!ssRiverIsOpen)return;const k=e.key.toLowerCase();if(k===' '||k==='f'){e.preventDefault();e.stopImmediatePropagation();ssRiverRelease();}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)ssRiverPause('hidden');});
 window.addEventListener('blur',()=>ssRiverPause('blur'));
 window.addEventListener('orientationchange',()=>{ssRiverPause('rotate');setTimeout(()=>{if(ssRiverIsOpen){ssRiverResize();ssRiverResetWaterKeep();}},250);});
 window.addEventListener('resize',()=>{if(!ssRiverIsOpen)return;const oW=ssRiver.W,oH=ssRiver.H;ssRiverResize();if(Math.abs(oW-ssRiver.W)>40||Math.abs(oH-ssRiver.H)>40){ssRiverPause('resize');ssRiverResetWaterKeep();}});
})();
function ssRiverResetWaterKeep(){if(ssRiver.phase==='lure'||ssRiver.phase==='bite'){ssRiver.phase='idle';ssRiver.lure=null;ssRiver.bite=null;}ssRiverResetWater();ssRiverRender();}
// World: draw the riverbank band (X61~68 is already protected from digging) with drifting shadows.
function ssRiverDrawWorld(){
 if(!RIVER_FOREST_BANK||ssRegion!=='life_forest_01'||!game)return;
 const x0=Math.round(61*T-camera.x),x1=Math.round(69*T-camera.x),surf=Math.round((ssM1ForestTerrain(64)-1)*T-camera.y);
 if(x1<-60||x0>viewW+60)return;
 const lit=game.storyM1?.springRepaired;
 ctx.save();
 ctx.fillStyle=lit?'#3b9fb4':'#3f7f8c';ctx.fillRect(x0,surf+3,x1-x0,T*2.4);
 ctx.fillStyle=lit?'#88e7d9':'#8cc3c6';for(let i=0;i<6;i++){const xx=x0+((frame*.6+i*41)%(x1-x0));ctx.fillRect(xx,surf+6+(i%3)*14,12,2);}
 ctx.fillStyle='#0f2a3399';for(let i=0;i<3;i++){const xx=x0+20+((frame*(.25+i*.1)+i*70)%(x1-x0-40)),yy=surf+20+i*12;ctx.beginPath();ctx.ellipse(xx,yy,8+i*4,3+i,0,0,Math.PI*2);ctx.fill();}
 // boardwalk across the bank so the walkway reads as a bridge over the water
 ctx.fillStyle='#8b6a45';ctx.fillRect(x0,surf,x1-x0,5);ctx.fillStyle='#a7825a';for(let x=61;x<69;x+=.5)ctx.fillRect(Math.round(x*T-camera.x),surf,1,5);
 ctx.fillStyle='#6a4d31';for(let x=61.3;x<69;x+=1.3)ctx.fillRect(Math.round(x*T-camera.x),surf+5,4,T*2.3);
 ctx.fillStyle='#3e7a46';for(let x=61;x<62.2;x+=.22)ctx.fillRect(Math.round(x*T-camera.x),surf-8-Math.sin(x*9+frame*.05)*3,2,14);
 ctx.fillStyle='#77756a';ctx.beginPath();ctx.moveTo(Math.round(67.4*T-camera.x),surf+10);ctx.lineTo(Math.round(67.8*T-camera.x),surf-10);ctx.lineTo(Math.round(68.7*T-camera.x),surf-12);ctx.lineTo(Math.round(69*T-camera.x),surf+10);ctx.fill();
 if(ssM17NearbyObject()?.id!=='pond'&&Math.abs(p.x-64)<14){ctx.fillStyle='#193e42cc';ctx.fillRect(Math.round(64*T-camera.x)-34,surf-44,72,18);ctx.fillStyle='#fff0bb';ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillText('🎣 강변 낚시터',Math.round(64*T-camera.x)+2,surf-31);}
 ctx.restore();
}
window.__sandstarRiver=Object.freeze({
 isOpen:()=>ssRiverIsOpen,open:()=>ssRiverOpen(),close:()=>ssRiverClose(),
 state:()=>({open:ssRiverIsOpen,spot:ssRiver.spot,phase:ssRiver.phase,paused:ssRiver.paused,card:ssRiver.card,ready:ssRiver.ready,hint:ssRiverEl('riverHint')?.textContent||'',
  W:ssRiver.W,H:ssRiver.H,surface:ssRiverSurface(),lure:ssRiver.lure?{x:ssRiver.lure.x,y:ssRiver.lure.y}:null,
  fish:ssRiver.fish.map(f=>({id:f.id,species:f.species,size:f.size,x:f.x,y:f.y,dir:f.dir,interest:f.interest,state:f.state})),
  fight:ssRiver.fight?{fish:ssRiver.fight.fish,progress:ssRiver.fight.progress,strain:ssRiver.fight.strain,stall:ssRiver.fight.stall,phase:RIVER_FIGHT[ssRiver.fight.fish].phases[ssRiver.fight.pi][0]}:null,
  result:ssRiver.result?{fish:ssRiver.result.fish,size:ssRiver.result.size,record:ssRiver.result.record}:null,
  saved:JSON.parse(JSON.stringify(game?.livingP0?.river||null))}),
 spots:RIVER_SPOTS
});
