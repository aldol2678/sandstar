// SANDSTAR fishing ground (fishing_01): the town '낚시터 입구' gate leads here.
// Same subworld contract as the farm: save-then-enter with rollback, m25b loading cover, walk to the
// exit to return, continue-after-reload restores the world. The spots A/B/C are physical places;
// standing at one opens the existing fishing view locked to that spot.
// Rendering follows the ruins engine: three.js (r160, already inlined as window.THREE) with an
// orbit camera (drag / Q·R to rotate) and camera-relative movement; if three or WebGL is unavailable
// or the context is lost, the top-down Canvas2D view is the fallback. World state, spot geometry,
// transitions and saves are renderer-independent (map x → three X, map y → three Z).
var FISH_WORLD_ID='fishing_01',FW_W=30,FW_H=22,FW_TILE=32;
var FW_GATE={x:2.6,y:11},FW_SPAWN={x:6.4,y:11};
var FW_SPOTS=Object.freeze({
 A:{x:12.6,y:15.2,face:'right',label:'A 완만한 강가'},
 B:{x:19.2,y:8,face:'right',label:'B 깊은 소'},
 C:{x:22.6,y:19.6,face:'up',label:'C 좁은 물살'}
});
var fishingWorldActive=false,fwPlayer={x:4.6,y:11,face:'down'},fwKeys=new Set(),fwJoy={x:0,y:0},fwPointer=null;
var FW_VIEW={yaw:-1.2,pitch:.72},fwYaw=FW_VIEW.yaw,fwPitch=FW_VIEW.pitch,fwDrag=null,fw3=null,fwRenderer='uninitialized',fwGl=document.getElementById('fishWorldGl'),fwFrameMs=[],fwLastFrameAt=0;
var fwTickAt=0,fwFrame=0,fwToastUntil=0,fwLastEnter=0,fwCanvasW=0,fwCanvasH=0,fwDpr=1,fwHudTimer=0,fwWalkPhase=0;
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
 fwTickAt=0;fishingWorldInitRenderer();fishingWorldResize();fishingWorldRefreshHud();fishingWorldDraw();
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
 fwYaw=FW_VIEW.yaw;fwPitch=FW_VIEW.pitch;
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
 if(g)g.textContent=a?`걸려 있는 ${LIVING_FISH[a.fish].name} · 자리 ${a.spot}로 가서 이어하세요`:'자리 A 수초 강가 · B 선착장 끝 · C 바위 물살 · 🚪 서쪽 출구'+(fwRenderer==='three'?' · 화면을 끌면 시점 회전':'');
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
 if(!fwCanvas)return;const r=fwRoot.getBoundingClientRect();fwCanvasW=r.width||innerWidth;fwCanvasH=r.height||innerHeight;
 fwDpr=Math.min(devicePixelRatio||1,2);
 if(fwRenderer==='three'&&fw3){fw3.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));fw3.renderer.setSize(fwCanvasW,fwCanvasH,false);return;}
 fwCanvas.width=Math.max(1,Math.round(fwCanvasW*fwDpr));fwCanvas.height=Math.max(1,Math.round(fwCanvasH*fwDpr));fwCtx.imageSmoothingEnabled=false;
}
function fishingWorldReadyCheck(){
 if(!fishingWorldActive||fwRoot.hidden)return false;
 fishingWorldResize();fishingWorldDraw();
 if(fwRenderer==='three')return !!(fw3&&fw3.ready)&&!fwGl.hidden&&fwGl.width>1&&fwGl.height>1;
 return fwCanvas.width>1&&fwCanvas.height>1&&fwCanvasW>1&&fwCanvasH>1;
}
function fishingWorldMove(){
 if(m25bBusy)return {x:0,y:0};
 let dx=(fwKeys.has('d')||fwKeys.has('arrowright')?1:0)-(fwKeys.has('a')||fwKeys.has('arrowleft')?1:0);
 let dy=(fwKeys.has('s')||fwKeys.has('arrowdown')?1:0)-(fwKeys.has('w')||fwKeys.has('arrowup')?1:0);
 dx+=fwJoy.x;dy+=fwJoy.y;const n=Math.hypot(dx,dy);if(n>1){dx/=n;dy/=n;}
 if(fwRenderer!=='three')return {x:dx,y:dy};
 // Same ground basis as the ruins: right=(cos yaw, -sin yaw), forward=(-sin yaw, -cos yaw).
 const f=-dy,cy=Math.cos(fwYaw),sy=Math.sin(fwYaw);
 return {x:dx*cy-f*sy,y:-dx*sy-f*cy};
}
function fishingWorldTick(dt){
 if(!game||ssIsTitle())return;
 if(m25bBusy){fishingWorldDraw();return;}
 if(fwToastUntil&&performance.now()>fwToastUntil){document.getElementById('fishWorldToast').classList.remove('show');fwToastUntil=0;}
 fwFrame++;
 // The main loop caps dt at 45ms; a 3D frame on a slow device can be longer, so this world keeps
 // its own real elapsed time (≤0.25s) for walking and the shared clock.
 const nowT=performance.now();dt=fwTickAt?Math.min(.25,Math.max(0,(nowT-fwTickAt)/1000)):dt;fwTickAt=nowT;
 const riverOpen=typeof ssRiverIsOpen!=='undefined'&&ssRiverIsOpen,panel=ssScenePanelOpen();
 if(!riverOpen&&!panel){
  const v=fishingWorldMove();
  // up to 0.25s per frame in 0.05s steps: slow frames keep real-time walking speed without tunnelling
  for(let left=Math.min(.25,dt);left>1e-4;left-=.05){const step=Math.min(.05,left)*4.6;
   for(const axis of ['x','y']){
    const d=v[axis]*step;if(!d)continue;const next={...fwPlayer,[axis]:fwPlayer[axis]+d},r=.3;
    if(![[-r,-r],[r,-r],[-r,r],[r,r]].some(([ox,oy])=>fishingWorldBlocked(next.x+ox,next.y+oy)))fwPlayer[axis]+=d;
   }
  }
  if(Math.abs(v.x)+Math.abs(v.y)>.1){
   // facing in screen terms: project world motion onto the camera's right/forward axes
   let sx=v.x,sf=-v.y;if(fwRenderer==='three'){const cy=Math.cos(fwYaw),sy=Math.sin(fwYaw);sx=v.x*cy-v.y*sy;sf=-v.x*sy-v.y*cy;}
   fwPlayer.face=Math.abs(sx)>Math.abs(sf)?(sx>0?'right':'left'):(sf>0?'up':'down');fwWalkPhase=(fwWalkPhase+dt*1.6)%1;
  }else fwWalkPhase=0;
  // Shared life clock: this world's own loop advances it while no fishing view or menu is open
  // (the fishing view advances it itself while active), so it never runs twice.
  livingWorldTick(Math.max(0,dt));
 }
 fwHudTimer+=dt;if(fwHudTimer>.25){fwHudTimer=0;fishingWorldRefreshHud();}
 if(fwFrame%270===0&&!riverOpen){game.fishingWorldV1.position={x:fwPlayer.x,y:fwPlayer.y};saveGame(true);}
 if(!riverOpen)fishingWorldDraw(); // the fishing view covers the screen: skip world frames meanwhile
}
function fishingWorldDraw(){
 if(!fishingWorldActive)return;
 const now=performance.now();if(fwLastFrameAt){fwFrameMs.push(now-fwLastFrameAt);if(fwFrameMs.length>90)fwFrameMs.shift();}fwLastFrameAt=now;
 if(fwRenderer==='three'&&fw3&&fw3.ready){fw3Render();return;}
 fishingWorldDraw2D();
}
function fishingWorldDraw2D(){
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
// ---------- three.js fishing ground (primitives only, no GLB/base64 additions) ----------
function fishingWorldInitRenderer(){
 if(fwRenderer!=='uninitialized')return;
 fwRenderer=fw3Create()?'three':'cpu';
 fwGl.hidden=fwRenderer!=='three';fwCanvas.hidden=fwRenderer==='three';
 if(fwRenderer==='three'){
  fwGl.addEventListener('webglcontextlost',e=>{e.preventDefault();fwRenderer='cpu';if(fw3)fw3.ready=false;fwGl.hidden=true;fwCanvas.hidden=false;fishingWorldResize();fishingWorldDraw();});
  fw3Build();
 }
}
function fw3Create(){
 if(!window.THREE||!fwGl)return false;
 try{
  const T=window.THREE;
  const renderer=new T.WebGLRenderer({canvas:fwGl,antialias:false,powerPreference:'low-power'});
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene();scene.background=new T.Color(0xbfe3dc);scene.fog=new T.Fog(0xbfe3dc,26,70);
  const camera=new T.PerspectiveCamera(50,1,.1,140);
  scene.add(new T.HemisphereLight(0xe8f6ff,0x48704f,1.15));
  const sun=new T.DirectionalLight(0xfff0d0,1.35);sun.position.set(-8,16,6);scene.add(sun);
  fw3={ready:false,renderer,scene,camera,player:null,blob:null,rings:{},labels:{},fish:[],flow:[],water:null,sheets:{},t:0};
  return true;
 }catch(e){console.warn('fishing three.js unavailable:',e);fw3=null;return false;}
}
function fw3Mat(color,opts={}){return new window.THREE.MeshStandardMaterial({color,roughness:.88,metalness:0,flatShading:true,...opts});}
function fw3Box(w,h,d,color,x,y,z){const T=window.THREE,m=new T.Mesh(new T.BoxGeometry(w,h,d),fw3Mat(color));m.position.set(x,y,z);fw3.scene.add(m);return m;}
function fw3Plane(x0,z0,x1,z1,y,color,opts){const T=window.THREE,m=new T.Mesh(new T.PlaneGeometry(x1-x0,z1-z0),fw3Mat(color,opts));m.rotation.x=-Math.PI/2;m.position.set((x0+x1)/2,y,(z0+z1)/2);fw3.scene.add(m);return m;}
function fw3Label(text,color){
 const T=window.THREE,c=document.createElement('canvas');c.width=512;c.height=112;const g=c.getContext('2d');
 g.font='900 52px system-ui,sans-serif';const w=Math.min(500,g.measureText(text).width+56);
 g.fillStyle='#183e42e6';g.beginPath();g.roundRect((512-w)/2,10,w,90,24);g.fill();g.strokeStyle='#fff0b8';g.lineWidth=4;g.stroke();
 g.fillStyle=color||'#fff0bb';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,57);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 const sp=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false,transparent:true}));sp.scale.set(3.4,.75,1);sp.renderOrder=10;fw3.scene.add(sp);
 sp.userData.canvas=c;sp.userData.text=text;return sp;
}
function fw3Sheet(dir){
 const T=window.THREE;if(fw3.sheets[dir])return fw3.sheets[dir];
 const img=walkSheets[dir]||walkSpriteImage,tex=new T.Texture(img);
 tex.colorSpace=T.SRGBColorSpace;tex.magFilter=T.NearestFilter;tex.minFilter=T.LinearFilter;tex.generateMipmaps=false;
 tex.repeat.set(1/8,1);if(img.complete&&img.naturalWidth)tex.needsUpdate=true;else img.addEventListener('load',()=>{tex.needsUpdate=true;},{once:true});
 return fw3.sheets[dir]=tex;
}
function fw3Build(){
 const T=window.THREE,st=fw3;
 // ground around the lake basin (lake rect x14..28.6, z2.2..19), basin walls and bed
 const G=0x7cb286,SAND=0xd8c690;
 fw3Plane(-20,-18,14,40,0,G);fw3Plane(28.6,-18,50,40,0,G);fw3Plane(14,-18,28.6,2.2,0,G);fw3Plane(14,19,28.6,40,0,G);
 fw3Plane(14,2.2,15.2,5,0,G);fw3Plane(14,17,15.2,19,0,G);
 fw3Plane(13.3,2.2,14,19,.005,SAND);fw3Plane(28.6,2.2,29.3,19,.005,SAND);fw3Plane(14,1.5,28.6,2.2,.005,SAND);fw3Plane(14,19,28.6,19.7,.005,SAND);
 fw3Plane(14,2.2,28.6,19,-1.1,0x2f5f5a);
 for(const [w,d,x,z] of [[14.6,.1,21.3,2.2],[14.6,.1,21.3,19],[.1,16.8,14,10.6],[.1,16.8,28.6,10.6]])fw3Box(w,1.1,d,0xa38f62,x,-.55,z);
 st.water=fw3Plane(14,2.2,28.6,19,-.12,0x3d93a8,{transparent:true,opacity:.82,roughness:.25,metalness:.05,flatShading:false});
 // B: dock with posts
 fw3Box(6.5,.14,1.3,0x9b7448,16.65,.2,8);for(let x=13.8;x<=19.8;x+=1.5)for(const z of [7.45,8.55])fw3Box(.16,1.2,.16,0x6a4d31,x,-.42,z);
 // A: reeds
 for(let i=0;i<22;i++){const r=fw3Box(.07,.9+((i*37)%5)/10,.07,0x3e7a46,14.15+(i%6)*.2,.35,13.4+Math.floor(i/6)*.95+((i*13)%4)/10);r.rotation.z=(((i*7)%5)-2)*.06;}
 // C: rocks + current streaks
 for(const [x,z,r,y] of [[24.2,20,.62,.2],[21.2,18.3,.45,0],[24.6,17.6,.42,0],[22.6,17.2,.35,-.05]]){const m=new T.Mesh(new T.IcosahedronGeometry(r,0),fw3Mat(0x8a8a7d));m.position.set(x,y,z);m.scale.y=.7;st.scene.add(m);}
 for(let i=0;i<7;i++){const m=fw3Box(.7,.02,.05,0xe8fbff,20.5+i*.6,-.1,17.4+(i%4)*.3);m.material.transparent=true;m.material.opacity=.7;st.flow.push(m);}
 // trees
 for(const [x,z] of [[6,4],[9,3.2],[4,18],[8,19.4],[10.5,6.5],[-2,8],[0,15],[31,6],[32,14],[18,-2],[24,-1.5],[20,22],[27,22.5]]){
  fw3Box(.3,1.3,.3,0x5a3f28,x,.65,z);const f=new T.Mesh(new T.IcosahedronGeometry(1,0),fw3Mat(0x3f7a4f));f.position.set(x,1.9,z);st.scene.add(f);
 }
 // gate to town
 fw3Box(.25,2.4,.25,0x6a4d31,FW_GATE.x,1.2,9.7);fw3Box(.25,2.4,.25,0x6a4d31,FW_GATE.x,1.2,12.3);fw3Box(.3,.25,3,0x6a4d31,FW_GATE.x,2.35,11);
 st.labels.gate=fw3Label('🚪 마을');st.labels.gate.position.set(FW_GATE.x,3.1,11);
 // spot rings + labels
 for(const [id,sp] of Object.entries(FW_SPOTS)){
  const ring=new T.Mesh(new T.TorusGeometry(.85,.07,6,36),fw3Mat(0xfff0b8,{emissive:0xffd27a,emissiveIntensity:.5,flatShading:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(sp.x,fw3Floor(sp.x,sp.y)+.04,sp.y);st.scene.add(ring);st.rings[id]=ring;
  const lab=fw3Label(sp.label);lab.position.set(sp.x,fw3Floor(sp.x,sp.y)+3.1,sp.y);st.labels[id]=lab;
 }
 // fish shadows under the surface (decoration; the fishing view decides real fish)
 for(let i=0;i<6;i++){const m=new T.Mesh(new T.CircleGeometry(.5,14),new T.MeshBasicMaterial({color:0x0e2a33,transparent:true,opacity:.45,depthWrite:false}));m.rotation.x=-Math.PI/2;m.scale.set(1+i*.25,.45+i*.08,1);m.position.y=-.5;st.scene.add(m);st.fish.push({m,cx:17+((i*2.3)%10),cz:4+i*2.4,r:1.2+i*.4,sp:.25+i*.05,ph:i});}
 // player: walk-sheet billboard + blob shadow
 const sprite=new T.Sprite(new T.SpriteMaterial({map:fw3Sheet('front'),transparent:true,alphaTest:.2}));sprite.center.set(.5,.06);sprite.scale.set(2.1,2.1,1);st.scene.add(sprite);st.player=sprite;
 const blob=new T.Mesh(new T.CircleGeometry(.42,16),new T.MeshBasicMaterial({color:0x1d393d,transparent:true,opacity:.35,depthWrite:false}));blob.rotation.x=-Math.PI/2;st.scene.add(blob);st.blob=blob;
 st.ready=true;
}
function fw3Floor(x,y){return fwDock(x,y)?.27:0;}
function fw3Render(){
 const st=fw3,T=window.THREE;if(!st||!st.ready)return;
 const W=fwCanvasW,H=fwCanvasH;if(!W||!H)return;
 st.t+=1/60;const t=st.t;
 const floor=fw3Floor(fwPlayer.x,fwPlayer.y),target=[fwPlayer.x,1+floor,fwPlayer.y];
 const radius=W<H?15:12,eye=[target[0]+Math.sin(fwYaw)*Math.cos(fwPitch)*radius,target[1]+Math.sin(fwPitch)*radius,target[2]+Math.cos(fwYaw)*Math.cos(fwPitch)*radius];
 st.camera.aspect=W/H;st.camera.fov=W<H?58:48;st.camera.position.set(...eye);st.camera.lookAt(...target);st.camera.updateProjectionMatrix();
 // player sprite frame + facing
 const dir=fwPlayer.face==='down'?'front':fwPlayer.face==='up'?'back':fwPlayer.face,tex=fw3Sheet(dir);
 if(st.player.material.map!==tex){st.player.material.map=tex;st.player.material.needsUpdate=true;}
 tex.offset.x=(fwWalkPhase?Math.floor(fwWalkPhase*8)%8:0)/8;
 st.player.position.set(fwPlayer.x,floor,fwPlayer.y);st.blob.position.set(fwPlayer.x,floor+.02,fwPlayer.y);
 // spot rings pulse, near spot highlighted, hooked spot tinted
 const near=fishingWorldNearSpot(),att=game?.livingP0?.river?.attempt;
 for(const [id,ring] of Object.entries(st.rings)){const on=id===near,k=1+(on?.12:.05)*Math.sin(t*4);ring.scale.set(k,k,k);ring.material.emissiveIntensity=on?1.1:.45;ring.material.color.set(att&&att.spot===id?0xffb48a:0xfff0b8);
  const lab=st.labels[id],txt=FW_SPOTS[id].label+(att&&att.spot===id?' · 걸림':'');if(lab.userData.text!==txt){st.scene.remove(lab);const nl=fw3Label(txt,att&&att.spot===id?'#ffb48a':null);nl.position.copy(lab.position);st.labels[id]=nl;}}
 for(const f of st.fish){const a=t*f.sp+f.ph;f.m.position.x=f.cx+Math.cos(a)*f.r;f.m.position.z=f.cz+Math.sin(a*1.3)*f.r*.6;f.m.rotation.z=-a;}
 for(const m of st.flow){m.position.x+=.03;if(m.position.x>25)m.position.x=20.5;}
 st.water.position.y=-.12+Math.sin(t*1.2)*.015;
 st.renderer.render(st.scene,st.camera);
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
 const drag0=e=>{if(!fishingWorldActive||fwDrag||m25bBusy||fwRenderer!=='three')return;e.preventDefault();fwDrag={id:e.pointerId,x:e.clientX,y:e.clientY};try{fwGl.setPointerCapture(e.pointerId)}catch(_){}};
 const drag1=e=>{if(!fwDrag||fwDrag.id!==e.pointerId)return;e.preventDefault();fwYaw-=(e.clientX-fwDrag.x)*.007;fwPitch=Math.max(.38,Math.min(1.05,fwPitch-(e.clientY-fwDrag.y)*.003));fwDrag.x=e.clientX;fwDrag.y=e.clientY;};
 const drag2=e=>{if(fwDrag?.id===e.pointerId)fwDrag=null;};
 fwGl.addEventListener('pointerdown',drag0);fwGl.addEventListener('pointermove',drag1);for(const ev of ['pointerup','pointercancel','lostpointercapture'])fwGl.addEventListener(ev,drag2);
 document.getElementById('fishViewReset').addEventListener('click',e=>{e.stopPropagation();fwYaw=FW_VIEW.yaw;fwPitch=FW_VIEW.pitch;});
 window.addEventListener('keydown',e=>{
  if(!fishingWorldActive||m25bBusy||ssIsTitle()||ssScenePanelOpen()||(typeof ssRiverIsOpen!=='undefined'&&ssRiverIsOpen))return;
  if(e.key===' '&&e.target.closest?.('.scene-nav'))return;
  const k=e.key.toLowerCase();if(!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e',' ','escape','q','r'].includes(k))return;
  e.preventDefault();e.stopImmediatePropagation();
  if(['e',' '].includes(k)){if(!e.repeat)fishingWorldAction();}
  else if(k==='escape'){if(!e.repeat)fishingWorldTryExit();}
  else if(k==='q'){fwYaw-=.32;}
  else if(k==='r'){fwYaw+=.32;}
  else fwKeys.add(k);
 },true);
 window.addEventListener('keyup',e=>{if(!fishingWorldActive)return;const k=e.key.toLowerCase();fwKeys.delete(k);if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('blur',fishingWorldClearInput);
 window.addEventListener('resize',()=>{if(fishingWorldActive){fishingWorldResize();fishingWorldDraw();}});
})();
window.__sandstarFishingWorld=Object.freeze({
 state:()=>({worldId:fishingWorldActive?FISH_WORLD_ID:ssRegion,active:fishingWorldActive,player:{...fwPlayer},renderer:fwRenderer,yaw:fwYaw,pitch:fwPitch,
  frameMs:fwFrameMs.length?(()=>{const a=[...fwFrameMs].sort((x,y)=>x-y);return {median:+a[a.length>>1].toFixed(1),p90:+a[Math.floor(a.length*.9)].toFixed(1),n:a.length};})():null,nearSpot:fishingWorldNearSpot(),nearGate:fishingWorldNearGate(),
  action:document.getElementById('fishWorldAction')?.textContent||'',saved:JSON.parse(JSON.stringify(game?.fishingWorldV1||null)),spots:FW_SPOTS,gate:FW_GATE}),
 testMove:(x,y)=>{if(!fishingWorldActive||fishingWorldBlocked(x,y))return false;fwPlayer.x=x;fwPlayer.y=y;game.fishingWorldV1.position={x,y};fishingWorldRefreshHud();fishingWorldDraw();return true;},
 enterFromTown:()=>t25EnterFishing(),exit:()=>fishingWorldTryExit(),act:()=>fishingWorldAction()
});
