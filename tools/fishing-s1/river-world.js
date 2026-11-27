// SANDSTAR fishing ground (fishing_01): the town '낚시터 입구' gate leads here.
// Same subworld contract as the farm: save-then-enter with rollback, m25b loading cover, walk to the
// exit to return, continue-after-reload restores the world. The spots A/B/C are physical places;
// standing at one opens the existing fishing view locked to that spot.
// The renderer below is a temporary top-down Canvas2D view. World state, spot geometry, movement,
// transitions and saves do not depend on it, so the 3D engine (still to be chosen) replaces only
// fishingWorldDraw/Resize and the camera.
var FISH_WORLD_ID='fishing_01',FW_W=30,FW_H=22,FW_TILE=32;
var FW_GATE={x:2.6,y:11},FW_SPAWN={x:4.6,y:11};
var FW_SPOTS=Object.freeze({
 A:{x:12.6,y:15.2,face:'right',label:'A 완만한 강가'},
 B:{x:19.2,y:8,face:'right',label:'B 깊은 소'},
 C:{x:22.6,y:19.6,face:'up',label:'C 좁은 물살'}
});
var fishingWorldActive=false,fwPlayer={x:4.6,y:11,face:'down'},fwKeys=new Set(),fwJoy={x:0,y:0},fwPointer=null;
var fwFrame=0,fwToastUntil=0,fwLastEnter=0,fwCanvasW=0,fwCanvasH=0,fwDpr=1,fwHudTimer=0,fwWalkPhase=0;
var fwRoot=document.getElementById('fishWorldRoot'),fwCanvas=document.getElementById('fishWorldCanvas'),fwCtx=fwCanvas?fwCanvas.getContext('2d',{alpha:false}):null;
function fwWater(x,y){
 if(x>14&&x<28.6&&y>2.2&&y<19){
  if(x<15.2&&(y<5||y>17))return false; // softened lake corners
  return true;
 }
 return false;
}
function fwDock(x,y){return x>=13.4&&x<=19.9&&y>=7.35&&y<=8.65;}
function fishingWorldBlocked(x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<1.4||y<1.4||x>FW_W-1.2||y>FW_H-1.2)return true;
 if(fwWater(x,y)&&!fwDock(x,y))return true;
 for(const [tx,ty] of [[6,4],[9,3.2],[4,18],[8,19.4],[10.5,6.5]])if(Math.hypot(x-tx,y-ty)<.8)return true; // trees
 if(Math.hypot(x-24.2,y-20)<.7)return true; // rock
 return false;
}
function fishingWorldNormalize(raw){
 const d={schema:1,activeWorldId:'',position:{...FW_SPAWN},entryCount:0,lastSpot:''};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return d;
 if(raw.activeWorldId===FISH_WORLD_ID)d.activeWorldId=FISH_WORLD_ID;
 if(raw.position&&Number.isFinite(raw.position.x)&&Number.isFinite(raw.position.y)&&!fishingWorldBlocked(raw.position.x,raw.position.y))d.position={x:raw.position.x,y:raw.position.y};
 d.entryCount=Number.isSafeInteger(raw.entryCount)?Math.min(100000,Math.max(0,raw.entryCount)):0;
 if(typeof raw.lastSpot==='string'&&livingOwn(FW_SPOTS,raw.lastSpot))d.lastSpot=raw.lastSpot;
 return d;
}
function fishingWorldInitState(){game.fishingWorldV1=fishingWorldNormalize(game?.fishingWorldV1);return game.fishingWorldV1;}
function fishingWorldNearGate(){return Math.hypot(fwPlayer.x-FW_GATE.x,fwPlayer.y-FW_GATE.y)<2.4;}
function fishingWorldNearSpot(){
 let best='',dist=Infinity;
 for(const [id,s] of Object.entries(FW_SPOTS)){const d=Math.hypot(fwPlayer.x-s.x,fwPlayer.y-s.y);if(d<dist){dist=d;best=id;}}
 return dist<=1.7?best:'';
}
function fishingWorldClearInput(){fwKeys.clear();fwJoy={x:0,y:0};fwPointer=null;}
function fishingWorldToast(msg){const t=document.getElementById('fishWorldToast');if(!t)return;t.textContent=msg;t.classList.add('show');fwToastUntil=performance.now()+2400;}
function fishingWorldActivate(){
 // Fully stop the 2.5D town (class + engine) so its walk pad does not draw over this world.
 if(town25dActive)t25Deactivate();
 fishingWorldActive=true;fwRoot.hidden=false;t25Root.hidden=true;$('app').classList.add('fish-world-active');
 fishingWorldClearInput();ssM15ResetHeldInputs();releaseRope();
 const s=fishingWorldInitState();fwPlayer.x=s.position.x;fwPlayer.y=s.position.y;
 fishingWorldResize();fishingWorldRefreshHud();fishingWorldDraw();
 void ssBgmSwitchRegion(TOWN_WORLD_ID);
}
function fishingWorldDeactivate(){
 if(typeof ssRiverIsOpen!=='undefined'&&ssRiverIsOpen)ssRiverClose();
 fishingWorldClearInput();fishingWorldActive=false;fwRoot.hidden=true;t25Root.hidden=false;$('app').classList.remove('fish-world-active');
 ssM15ResetHeldInputs();last=performance.now();
}
function fishingWorldEnterCore(){
 if(fishingWorldActive||farmWorldActive||archWorldActive)return false;
 if(!saveGame(true)){flash('진입 전 저장에 실패했어요. 월드는 유지됩니다.');return false;}
 const prev=game.fishingWorldV1?JSON.parse(JSON.stringify(game.fishingWorldV1)):null;
 const s=fishingWorldInitState();s.activeWorldId=FISH_WORLD_ID;s.entryCount++;s.position={...FW_SPAWN};
 if(!saveGame(true)){
  if(prev)game.fishingWorldV1=prev;else delete game.fishingWorldV1;
  flash('낚시터 저장에 실패했어요. 진입하지 않았습니다.');return false;
 }
 fishingWorldActivate();fwLastEnter=performance.now();fishingWorldToast('도래 낚시터에 도착했어요. 물가의 자리 A·B·C로 걸어가 보세요.');return true;
}
function fishingWorldExitCore(){
 if(!fishingWorldActive||!fishingWorldNearGate()){fishingWorldToast('서쪽 출입구로 가까이 가야 돌아갈 수 있어요');return false;}
 const s=fishingWorldInitState(),old=JSON.parse(JSON.stringify(s));
 const oldPlayer={x:p.x,y:p.y,vx:p.vx,vy:p.vy};
 s.position={x:fwPlayer.x,y:fwPlayer.y};s.activeWorldId=TOWN_WORLD_ID;
 paused=false;let switched=false;
 try{switched=ssM1Transition(TOWN_WORLD_ID,true,'forest-west-town',true);}
 finally{paused=true;}
 if(!switched){game.fishingWorldV1=old;Object.assign(p,oldPlayer);fishingWorldToast('마을로 돌아가지 못했어요');return false;}
 t25LastRegion=FISH_WORLD_ID;
 if(game?.town25dV1)game.town25dV1.position={x:18,z:-0.6};town25dPlayer={x:18,z:-0.6};
 if(!saveGame(true)){game.fishingWorldV1=old;Object.assign(p,oldPlayer);fishingWorldToast('저장 또는 안전 위치 확인에 실패해 낚시터에 머무릅니다');return false;}
 fishingWorldDeactivate();updHud();flash('도래마을로 돌아왔어요');return true;
}
async function t25EnterFishing(){
 if(!town25dActive||t25TrafficLock||fishingWorldActive||farmWorldActive||m25bBusy)return false;
 t25TrafficLock=true;t25ClearInput();let result=false;
 try{result=await m25bTransition(FISH_WORLD_ID,'fishing-enter',()=>t25EnterForestSubworld(fishingWorldEnterCore),TOWN_WORLD_ID);}
 catch(err){console.warn('town fishing enter',err);}
 finally{t25TrafficLock=false;}
 if(!result)t25Notify('낚시터로 이동하지 못했어요');
 return result;
}
function fishingWorldTryExit(){
 if(!fishingWorldActive||m25bBusy)return false;
 if(!fishingWorldNearGate()){fishingWorldToast('서쪽 출입구로 가까이 가야 돌아갈 수 있어요');return false;}
 return m25bTransition(TOWN_WORLD_ID,'fishing-exit',fishingWorldExitCore,FISH_WORLD_ID);
}
function fishingWorldRestoreAfterContinue(){
 if(!game||ssIsTitle())return;
 const s=fishingWorldInitState();
 if(s.activeWorldId===FISH_WORLD_ID){fishingWorldActivate();fishingWorldToast('낚시터에서 이어서 시작합니다');}
}
function fishingWorldActionLabel(){
 if(fishingWorldNearGate())return '🚪 마을로 돌아가기';
 const spot=fishingWorldNearSpot();
 if(spot){const a=game?.livingP0?.river?.attempt;return a&&a.spot===spot?'🎣 이어서 낚시':'🎣 '+FW_SPOTS[spot].label+'에서 낚시';}
 return '🎣 물가 자리로 걸어가세요';
}
function fishingWorldRefreshHud(){
 if(!game||!fishingWorldActive)return;
 const b=document.getElementById('fishWorldAction');const label=fishingWorldActionLabel();
 if(b.textContent!==label)b.textContent=label;b.disabled=!fishingWorldNearGate()&&!fishingWorldNearSpot();
 const w=game.livingP0,bag=w.bag,info=document.getElementById('fishWorldBag');
 if(info)info.textContent=`🐟 ${bag.river_fish}·${bag.perch}·${bag.carp} · 도감 ${w.fishDex.length}/3`;
 const a=w.river?.attempt,g=document.getElementById('fishWorldGuide');
 if(g)g.textContent=a?`걸려 있는 ${LIVING_FISH[a.fish].name} · 자리 ${a.spot}로 가서 이어하세요`:'자리 A 수초 강가 · B 선착장 끝 · C 바위 물살 · 🚪 서쪽 출구';
}
function fishingWorldAction(){
 if(!fishingWorldActive||m25bBusy)return false;
 if(fishingWorldNearGate())return fishingWorldTryExit();
 const spot=fishingWorldNearSpot();
 if(!spot){fishingWorldToast('물가의 자리 표시까지 걸어가면 낚시할 수 있어요');return false;}
 const a=game.livingP0?.river?.attempt;
 if(a&&a.spot!==spot){fishingWorldToast(`걸려 있는 물고기는 자리 ${a.spot}에 있어요`);return false;}
 fishingWorldClearInput();fwPlayer.face=FW_SPOTS[spot].face;
 game.fishingWorldV1.lastSpot=spot;
 return ssRiverOpen(spot);
}
function fishingWorldResize(){
 if(!fwCanvas)return;const r=fwCanvas.getBoundingClientRect();fwCanvasW=r.width;fwCanvasH=r.height;
 fwDpr=Math.min(devicePixelRatio||1,2);fwCanvas.width=Math.max(1,Math.round(r.width*fwDpr));fwCanvas.height=Math.max(1,Math.round(r.height*fwDpr));fwCtx.imageSmoothingEnabled=false;
}
function fishingWorldMove(){
 if(m25bBusy)return {x:0,y:0};
 let dx=(fwKeys.has('d')||fwKeys.has('arrowright')?1:0)-(fwKeys.has('a')||fwKeys.has('arrowleft')?1:0);
 let dy=(fwKeys.has('s')||fwKeys.has('arrowdown')?1:0)-(fwKeys.has('w')||fwKeys.has('arrowup')?1:0);
 dx+=fwJoy.x;dy+=fwJoy.y;const n=Math.hypot(dx,dy);return n>1?{x:dx/n,y:dy/n}:{x:dx,y:dy};
}
function fishingWorldTick(dt){
 if(!game||ssIsTitle())return;
 if(m25bBusy){fishingWorldDraw();return;}
 if(fwToastUntil&&performance.now()>fwToastUntil){document.getElementById('fishWorldToast').classList.remove('show');fwToastUntil=0;}
 fwFrame++;
 const riverOpen=typeof ssRiverIsOpen!=='undefined'&&ssRiverIsOpen,panel=ssScenePanelOpen();
 if(!riverOpen&&!panel){
  const v=fishingWorldMove(),step=Math.min(.05,dt)*4.6;
  for(const axis of ['x','y']){
   const d=v[axis]*step;if(!d)continue;const next={...fwPlayer,[axis]:fwPlayer[axis]+d},r=.3;
   if(![[-r,-r],[r,-r],[-r,r],[r,r]].some(([ox,oy])=>fishingWorldBlocked(next.x+ox,next.y+oy)))fwPlayer[axis]+=d;
  }
  if(Math.abs(v.x)+Math.abs(v.y)>.1){fwPlayer.face=Math.abs(v.x)>Math.abs(v.y)?(v.x>0?'right':'left'):(v.y>0?'down':'up');fwWalkPhase=(fwWalkPhase+dt*1.6)%1;}else fwWalkPhase=0;
  // Shared life clock: this world's own loop advances it while no fishing view or menu is open
  // (the fishing view advances it itself while active), so it never runs twice.
  livingWorldTick(Math.max(0,dt));
 }
 fwHudTimer+=dt;if(fwHudTimer>.25){fwHudTimer=0;fishingWorldRefreshHud();}
 if(fwFrame%270===0&&!riverOpen){game.fishingWorldV1.position={x:fwPlayer.x,y:fwPlayer.y};saveGame(true);}
 fishingWorldDraw();
}
function fishingWorldDraw(){
 if(!fwCtx||!fishingWorldActive)return;
 const c=fwCtx,W=fwCanvasW,H=fwCanvasH,S=W<520?28:FW_TILE;
 c.setTransform(fwDpr,0,0,fwDpr,0,0);
 const fit=(span,view,at)=>span<=view?(span-view)/2:Math.max(0,Math.min(span-view,at)); // center a map smaller than the view
 const camX=fit(FW_W*S,W,fwPlayer.x*S-W/2),camY=fit(FW_H*S,H,fwPlayer.y*S-H*.55);
 c.fillStyle='#5f9a6e';c.fillRect(0,0,W,H);
 const X=x=>Math.round(x*S-camX),Y=y=>Math.round(y*S-camY),t=fwFrame/60;
 for(let ty=0;ty<FW_H;ty++)for(let tx=0;tx<FW_W;tx++){
  const sx=X(tx),sy=Y(ty);if(sx<-S||sx>W||sy<-S||sy>H)continue;
  const cx=tx+.5,cy=ty+.5;
  if(fwWater(cx,cy)){const deep=Math.min(1,Math.hypot(cx-21,cy-10)/9);c.fillStyle=deep<.45?'#2f7f98':deep<.8?'#3d93a8':'#58aab6';c.fillRect(sx,sy,S,S);}
  else{c.fillStyle=(tx+ty)%2?'#84ba8d':'#7cb286';c.fillRect(sx,sy,S,S);if(fwWater(cx+1,cy)||fwWater(cx-1,cy)||fwWater(cx,cy+1)||fwWater(cx,cy-1)){c.fillStyle='#d8c690';c.fillRect(sx,sy,S,S);}}
 }
 c.strokeStyle='#ffffff38';c.lineWidth=2;for(let i=0;i<14;i++){const x=15+((i*3.7+t*.4)%13),y=3+((i*5.3)%15);c.beginPath();c.moveTo(X(x),Y(y));c.lineTo(X(x+.8),Y(y));c.stroke();}
 // C: current lines + rocks
 c.strokeStyle='#e8fbff88';for(let i=0;i<5;i++){const x=20.5+((t*1.6+i*.9)%4.5);c.beginPath();c.moveTo(X(x),Y(17.6+i*.25));c.lineTo(X(x+.7),Y(17.6+i*.25));c.stroke();}
 c.fillStyle='#8a8a7d';for(const [rx,ry,rr] of [[24.2,20,.62],[21.2,18.3,.45],[24.6,17.6,.4]]){c.beginPath();c.ellipse(X(rx),Y(ry),rr*S,rr*S*.75,0,0,Math.PI*2);c.fill();}
 // A: reeds
 c.fillStyle='#3e7a46';for(let i=0;i<18;i++){const x=14.1+(i%6)*.22,y=13.6+Math.floor(i/6)*1.1;c.fillRect(X(x),Y(y)-6+Math.sin(t*2+i)*1.5,3,12);}
 // B: dock
 c.fillStyle='#9b7448';c.fillRect(X(13.4),Y(7.35),(19.9-13.4)*S,1.3*S);c.fillStyle='#7d5a36';for(let x=13.6;x<19.9;x+=.55)c.fillRect(X(x),Y(7.35),2,1.3*S);
 // trees
 for(const [tx,ty] of [[6,4],[9,3.2],[4,18],[8,19.4],[10.5,6.5]]){c.fillStyle='#5a3f28';c.fillRect(X(tx)-4,Y(ty),8,S*.6);c.fillStyle='#3f7a4f';c.beginPath();c.arc(X(tx),Y(ty)-4,S*.62,0,Math.PI*2);c.fill();}
 // gate
 c.fillStyle='#6a4d31';c.fillRect(X(1.6),Y(9.6),6,2.8*S);c.fillRect(X(1.6),Y(9.6),S*1.2,6);c.fillStyle='#fff0bb';c.font='900 11px system-ui';c.textAlign='center';c.fillText('🚪 마을',X(2.4),Y(9.3));
 // spot markers
 const near=fishingWorldNearSpot(),att=game?.livingP0?.river?.attempt;
 for(const [id,s] of Object.entries(FW_SPOTS)){
  const on=id===near,pulse=1+.08*Math.sin(t*4);
  c.strokeStyle=on?'#ffe28a':'#fff6d2cc';c.lineWidth=on?3:2;c.setLineDash(on?[]:[5,4]);c.beginPath();c.ellipse(X(s.x),Y(s.y),S*.8*pulse,S*.45*pulse,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.fillStyle='#183e42e6';const w=c.measureText(s.label).width+16;c.fillRect(X(s.x)-w/2,Y(s.y)-S*1.35,w,18);
  c.fillStyle=att&&att.spot===id?'#ffb48a':'#fff0bb';c.fillText(s.label+(att&&att.spot===id?' · 걸림':''),X(s.x),Y(s.y)-S*1.35+13);
 }
 // shadows hinting fish (decoration only)
 c.fillStyle='#10303a66';for(let i=0;i<5;i++){const x=16+((t*.25*(i%2?1:-1)+i*2.6)%11+11)%11,y=4+i*2.8;c.beginPath();c.ellipse(X(x),Y(y),6+i*2,3+i*.6,0,0,Math.PI*2);c.fill();}
 // player: reuse the walk sheets (256px cells)
 const dir=fwPlayer.face==='down'?'front':fwPlayer.face==='up'?'back':fwPlayer.face,img=walkSheets[dir]&&walkSheets[dir].naturalWidth===2048?walkSheets[dir]:(walkSpriteImage.naturalWidth===2048?walkSpriteImage:null);
 const px=X(fwPlayer.x),py=Y(fwPlayer.y),h=S*1.9;
 c.fillStyle='#1d393d55';c.beginPath();c.ellipse(px,py+2,S*.42,S*.18,0,0,Math.PI*2);c.fill();
 if(img){const fr=fwWalkPhase?Math.floor(fwWalkPhase*8)%8:0;c.drawImage(img,fr*256,0,256,256,px-h/2,py-h*.94,h,h);}
 else{c.fillStyle='#237f83';c.fillRect(px-7,py-22,14,22);}
}
// input
(function fishingWorldWire(){
 if(!fwRoot)return;
 const pad=document.getElementById('fishDpad');
 const setJoy=e=>{const r=pad.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.34),dy=(e.clientY-r.top-r.height/2)/(r.height*.34),n=Math.max(1,Math.hypot(dx,dy));fwJoy={x:dx/n,y:dy/n};};
 pad.addEventListener('pointerdown',e=>{if(!fishingWorldActive||m25bBusy||fwPointer!==null)return;e.preventDefault();fwPointer=e.pointerId;try{pad.setPointerCapture(e.pointerId)}catch(_){}setJoy(e);});
 pad.addEventListener('pointermove',e=>{if(fwPointer===e.pointerId){e.preventDefault();setJoy(e);}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,e=>{if(fwPointer===e.pointerId){fwPointer=null;fwJoy={x:0,y:0};}});
 document.getElementById('fishWorldAction').addEventListener('click',e=>{e.stopPropagation();fishingWorldAction();});
 window.addEventListener('keydown',e=>{
  if(!fishingWorldActive||m25bBusy||ssIsTitle()||ssScenePanelOpen()||(typeof ssRiverIsOpen!=='undefined'&&ssRiverIsOpen))return;
  if(e.key===' '&&e.target.closest?.('.scene-nav'))return;
  const k=e.key.toLowerCase();if(!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e',' ','escape'].includes(k))return;
  e.preventDefault();e.stopImmediatePropagation();
  if(['e',' '].includes(k)){if(!e.repeat)fishingWorldAction();}
  else if(k==='escape'){if(!e.repeat)fishingWorldTryExit();}
  else fwKeys.add(k);
 },true);
 window.addEventListener('keyup',e=>{if(!fishingWorldActive)return;const k=e.key.toLowerCase();fwKeys.delete(k);if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('blur',fishingWorldClearInput);
 window.addEventListener('resize',()=>{if(fishingWorldActive){fishingWorldResize();fishingWorldDraw();}});
})();
window.__sandstarFishingWorld=Object.freeze({
 state:()=>({worldId:fishingWorldActive?FISH_WORLD_ID:ssRegion,active:fishingWorldActive,player:{...fwPlayer},nearSpot:fishingWorldNearSpot(),nearGate:fishingWorldNearGate(),
  action:document.getElementById('fishWorldAction')?.textContent||'',saved:JSON.parse(JSON.stringify(game?.fishingWorldV1||null)),spots:FW_SPOTS,gate:FW_GATE}),
 testMove:(x,y)=>{if(!fishingWorldActive||fishingWorldBlocked(x,y))return false;fwPlayer.x=x;fwPlayer.y=y;game.fishingWorldV1.position={x,y};fishingWorldRefreshHud();fishingWorldDraw();return true;},
 enterFromTown:()=>t25EnterFishing(),exit:()=>fishingWorldTryExit(),act:()=>fishingWorldAction()
});
