// P1.6-A2: interchangeable drill heads. Only owned/equipped IDs are saved.
// Mining multipliers do not grant bonus ore and never alter pickaxe/mastery.
const P16A2_DRILL_BITS=Object.freeze({
 tunnel:Object.freeze({id:'tunnel',name:'굴진',desc:'흙·돌·모래·눈 지층 굴진 +14%',cost:0,items:[],heatGain:1,coolRate:1}),
 hard:Object.freeze({id:'hard',name:'경암',desc:'경암 광물 +22%, 일반 돌 -6%',cost:440,items:[['iron',4],['crystal',3]],heatGain:1,coolRate:1}),
 cooling:Object.freeze({id:'cooling',name:'냉각',desc:'발열 42% 감소, 냉각 속도 +50%; 채굴력 -2%',cost:350,items:[['copper',5],['iron',3]],heatGain:.58,coolRate:1.5})
});
const P16A2_BIT_IDS=Object.freeze(['tunnel','hard','cooling']);
const P16A2_SOFT_TILES=new Set(['dirt','sand','snow','stone']);
const P16A2_HARD_TILES=new Set(['iron','crystal','titanium','starshard','opal']);
function p16a2NormalizeBits(raw){
 const owned=['tunnel'];
 if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Array.isArray(raw.owned)){
  for(const id of P16A2_BIT_IDS)if(id!=='tunnel'&&raw.owned.includes(id))owned.push(id);
 }
 const candidate=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.equipped:null;
 return {owned,equipped:owned.includes(candidate)?candidate:'tunnel'};
}
function p16a2Bits(state=game){return p16a2NormalizeBits(state?.drillBits);}
function p16a2BitId(state=game){return p16a2Bits(state).equipped;}
function p16a2BitPower(t,state=game){
 const id=p16a2BitId(state);
 if(id==='tunnel')return P16A2_SOFT_TILES.has(t)?1.14:1;
 if(id==='hard')return P16A2_HARD_TILES.has(t)?1.22:t==='stone'?.94:1;
 return .98;
}
function p16a2BitHeatGain(state=game){return P16A2_DRILL_BITS[p16a2BitId(state)].heatGain;}
function p16a2BitCoolRate(state=game){return P16A2_DRILL_BITS[p16a2BitId(state)].coolRate;}
function p16a2DrillBitsPanel(){
 const state=p16a2Bits(),ownedDrill=game.unlockedTools.includes('drill');
 const lines=P16A2_BIT_IDS.map(id=>{
  const bit=P16A2_DRILL_BITS[id],owned=state.owned.includes(id),equipped=state.equipped===id;
  const available=bit.items.every(([item,n])=>forgeAvailable(item)>=n);
  const ready=ownedDrill&&!equipped&&(owned||game.coins>=bit.cost&&available);
  const requires=bit.items.map(([item,n])=>MATERIAL_NAMES[item]+' '+forgeAvailable(item)+'/'+n).join(' · ');
  return `<div class="ss-p14-craft-row"><strong>${bit.name} 비트${equipped?' · 장착 중':owned?' · 보유':''}</strong>
    <small>${bit.desc}</small>
    <small>${id==='tunnel'?'기본 지급':owned?'보유 중 · 추가 제작 불필요':`제작비 ${bit.cost} C · 보유 ${game.coins} C · ${requires}`}</small>
    <button type="button" data-p16a2-bit="${id}" ${ready?'':'disabled'}>${!ownedDrill?'드릴 필요':equipped?'장착 중':owned?'장착':'제작·장착'}</button></div>`;
 }).join('');
 return `<section class="ss-p14-panel" aria-label="전동 드릴 비트 제작·장착"><h3>교체식 드릴 비트 · 3종</h3>
 <p>비트는 보유 후 자유롭게 교체할 수 있어요. 장착을 바꾸면 회전력과 발열이 초기화돼요. 광물 추가 지급은 없고 실제 채굴 속도와 온도만 달라져요.</p>${lines}</section>`;
}
function p16a2ChooseBit(id){
 if(!Object.prototype.hasOwnProperty.call(P16A2_DRILL_BITS,id)||!canOpenBuilding('forge'))return false;
 const bit=P16A2_DRILL_BITS[id];
 const ok=safeMarketTransaction(d=>{
  if(!d.unlockedTools.includes('drill'))return false;
  const current=p16a2Bits(d);
  if(current.equipped===id)return false;
  if(!current.owned.includes(id)){
   if(d.coins<bit.cost||!bit.items.every(([item,n])=>forgeAvailable(item,d)>=n))return false;
   d.coins-=bit.cost;
   for(const [item,n] of bit.items)d.inv[item]-=n;
   d.economy.balanceMetrics.toolCreditsSpent+=bit.cost;
   current.owned.push(id);
  }
  current.equipped=id;
  d.drillBits=p16a2NormalizeBits(current);
  return true;
 });
 if(ok){p16ResetDrillMotion(true);forgeMenu();flash('드릴 '+bit.name+' 비트 장착 완료');}
 return ok;
}
// P1.6-A1: Drill motor. Existing drill mining power (79/47) stays unchanged.
// Rank is saved; heat/spin are intentionally transient and cannot leak into older saves.
const P16_DRILL_MOTORS=Object.freeze([null,
 Object.freeze({name:'I',speed:1.10,ramp:1.9,heatGain:10.5}),
 Object.freeze({name:'II',speed:1.18,ramp:1.45,heatGain:10.0,cost:260,items:[['stone',8],['iron',2]]}),
 Object.freeze({name:'III',speed:1.24,ramp:1.15,heatGain:9.5,cost:760,items:[['iron',5],['crystal',2]]}),
 Object.freeze({name:'IV',speed:1.30,ramp:1.05,heatGain:9.2,cost:1550,items:[['iron',8],['crystal',5],['titanium',2]]}),
 Object.freeze({name:'V',speed:1.35,ramp:.95,heatGain:9.0,cost:3200,items:[['titanium',6],['starshard',3],['opal',1]]})]);
function p16NormalizeDrillMotor(raw){
 const n=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.rank:undefined;
 return {rank:Number.isSafeInteger(n)&&n>=1&&n<=5?n:1};
}
let p16DrillMotion={spin:0,heat:0,overheated:false,dir:null,working:false,effective:1};
function p16ResetDrillMotion(full=false){
 p16DrillMotion.spin=0;p16DrillMotion.dir=null;p16DrillMotion.working=false;p16DrillMotion.effective=1;
 if(full){p16DrillMotion.heat=0;p16DrillMotion.overheated=false;}
}
function p16DrillRank(state=game){return p16NormalizeDrillMotor(state?.drillMotor).rank;}
function p16DrillNextRule(state=game){return P16_DRILL_MOTORS[p16DrillRank(state)+1]||null;}
function p16DrillDirection(target){
 if(stickActive&&stickDir)return `${stickDir.dx},${stickDir.dy}`;
 if(holdTarget&&target&&p){const dx=target.x+.5-p.x,dy=target.y+.5-(p.y-PLAYER_CENTER_FROM_FEET);
  const k=Math.round(Math.atan2(dy,dx)/(Math.PI/4));return String((k+8)%8);}
 return `${p?.facing||1},0`;
}
function p16DrillIdle(dt){
 p16DrillMotion.spin=Math.max(0,p16DrillMotion.spin-dt*1.6);
 p16DrillMotion.heat=Math.max(0,p16DrillMotion.heat-dt*22*p16a2BitCoolRate());
 if(p16DrillMotion.overheated&&p16DrillMotion.heat<=58)p16DrillMotion.overheated=false;
 p16DrillMotion.working=false;p16DrillMotion.effective=1;
 if(p16DrillMotion.spin===0)p16DrillMotion.dir=null;
}
function p16DrillWork(dt,dir){
 const rule=P16_DRILL_MOTORS[p16DrillRank()];
 if(p16DrillMotion.dir!==null&&p16DrillMotion.dir!==dir)p16DrillMotion.spin*=.25;
 p16DrillMotion.dir=dir;p16DrillMotion.working=true;
 p16DrillMotion.spin=Math.min(1,p16DrillMotion.spin+dt/rule.ramp);
 p16DrillMotion.heat=Math.min(100,p16DrillMotion.heat+dt*rule.heatGain*p16a2BitHeatGain());
 if(p16DrillMotion.heat>=82)p16DrillMotion.overheated=true;
 const heatPressure=Math.max(0,Math.min(1,(p16DrillMotion.heat-66)/16));
 const boost=p16DrillMotion.overheated?.025:(rule.speed-1)*p16DrillMotion.spin*(1-.55*heatPressure);
 p16DrillMotion.effective=1+Math.max(0,boost);
 return p16DrillMotion.effective;
}
function p16DrillPanel(){
 const rank=p16DrillRank(),next=p16DrillNextRule(),owned=game.unlockedTools.includes('drill');
 const req=next?next.items.map(([id,n])=>`${MATERIAL_NAMES[id]} ${forgeAvailable(id)}/${n}`).join(' · '):'';
 const ready=!!next&&owned&&game.coins>=next.cost&&next.items.every(([id,n])=>forgeAvailable(id)>=n);
 const bore=rank>=4?` · 자연 암석 균열 전이 ${Math.round(p16a3BoreRatio()*100)}% (회전력 60% 이상, 비과열, 사거리 내)`:'';
 return `<section class="ss-p14-panel" aria-label="전동 드릴 모터 강화"><h3>전동 드릴 · 모터 ${P16_DRILL_MOTORS[rank].name}</h3>
 <p>같은 방향으로 연속 굴착하면 가속돼요. 모터 IV·V는 자연 생성 일반 암석을 부순 직후 다음 일반 암석에만 부분 균열을 전달해요. 원석·시설·배치 타일은 관통하지 않으며, 사거리와 과열 제한을 지켜요. 회전력·열·균열 진행은 저장하지 않아요.${bore}</p>
 <div class="ss-p14-craft-row"><strong>${next?'다음 모터 '+next.name:'모터 V · 최대 단계'}</strong>
 <small>${next?`최고 가속 ×${next.speed.toFixed(2)} · 가속 시간 ${next.ramp.toFixed(2)}초${rank>=3?' · 관통 균열 '+Math.round((next.name==='IV'?.24:.38)*100)+'%':''}`:'모터 V까지 강화 완료'}</small>
 <small>${!owned?'드릴을 먼저 바람장터에서 구매하세요.':next?`비용 ${next.cost} C · 보유 ${game.coins} C · ${req}`:'최고 모터 · 직선 관통 활성화'}</small>
 <button type="button" id="p16MotorUpgrade" ${ready?'':'disabled'}>${!owned?'드릴 필요':next?'모터 강화':'최대 강화'}</button></div></section>`;
}
function p16UpgradeDrillMotor(){
 if(!canOpenBuilding('forge'))return false;
 const ok=safeMarketTransaction(d=>{
  if(!d.unlockedTools.includes('drill'))return false;
  const rule=p16DrillNextRule(d);if(!rule||d.coins<rule.cost||!rule.items.every(([id,n])=>forgeAvailable(id,d)>=n))return false;
  d.coins-=rule.cost;for(const [id,n] of rule.items)d.inv[id]-=n;
  d.drillMotor={rank:p16DrillRank(d)+1};
  d.economy.balanceMetrics.toolCreditsSpent+=rule.cost;return true;
 });
 if(ok){p16ResetDrillMotion(true);forgeMenu();flash('드릴 모터 '+P16_DRILL_MOTORS[p16DrillRank()].name+' 강화 완료');}
 return ok;
}

// P1.6-A3: bore-through is a *transient next-block head start*, not a second break.
// No tile changes, XP, ore, cargo, or save writes occur in the secondary target.
const P16A3_BORE_NATURAL=new Set(['stone','dirt','sand','snow']);
function p16a3BoreRatio(state=game){return p16DrillRank(state)>=5?.38:p16DrillRank(state)>=4?.24:0;}
function p16a3Vector(target){
 if(stickActive&&stickDir)return {dx:Math.sign(stickDir.dx),dy:Math.sign(stickDir.dy)};
 if(!p||!target)return null;
 const dx=target.x+.5-p.x,dy=target.y+.5-(p.y-PLAYER_CENTER_FROM_FEET);
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<.01)return null;
 const sector=Math.round(Math.atan2(dy,dx)/(Math.PI/4));
 const vectors=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
 const [vx,vy]=vectors[(sector+8)%8];return {dx:vx,dy:vy};
}
function p16a3BoreTransfer(target){
 if(!game||!p||game.tool!=='drill'||ssRegion!=='mine'||paused||ssM16TransitionLocked||
    p16a3BoreRatio()<=0||p16DrillMotion.spin<.60||p16DrillMotion.overheated||
    !p16DrillMotion.working)return false;
 const v=p16a3Vector(target);
 if(!v||(v.dx===0&&v.dy===0))return false;
 const nx=target.x+v.dx,ny=target.y+v.dy;
 if(nx<0||nx>=WW||ny<0||ny>=WH-5||!canReach(nx,ny))return false;
 // No player edits, user-placed tiles, station protection, ore, relic, or chest may be pierced.
 if(Object.prototype.hasOwnProperty.call(game.edits,key(nx,ny))||stationGeneratedTile(nx,ny)!==undefined)return false;
 const nextType=tile(nx,ny);
 if(!P16A3_BORE_NATURAL.has(nextType))return false;
 const partial=tileHP(nextType)*p16a3BoreRatio();
 // Only the immediate next rock; never break/collect the downstream tile for free.
 holdLast=key(nx,ny);holdProgress=partial;mineFXTimer=0;
 mineSpark(nx,ny,nextType,false);burstMiningPixels(nx,ny,nextType,false);
 miningHitFX={x:nx,y:ny,t:nextType,life:.16,maxLife:.16};
 return true;
}
function mineHold(dt){
 if(game.tool!=='hammer'||ssRegion!=='mine')p16HammerFractures.clear();
 const active=game.tool==='drill'&&ssRegion==='mine'&&!ssM16TransitionLocked;
 if(!active){p16ResetDrillMotion(true);}
 if((rope.active||ssM16TransitionLocked)&&ssRegion==='mine'&&(game.tool==='hammer'||game.tool==='drill')){if(active)p16DrillIdle(dt);return;}
 const target=miningTarget();if(!target){if(active)p16DrillIdle(dt);return;}
 const t=tile(target.x,target.y);if(!t||t==='stationrock'||t==='bedrock'){if(active)p16DrillIdle(dt);return;}
 balanceStats().miningSeconds+=dt;
 const boost=active?p16DrillWork(dt,p16DrillDirection(target)):1;
 // Verify the primary block was naturally generated before breakBlock updates game.edits.
 const boreCandidate=active&&t==='stone'&&!Object.prototype.hasOwnProperty.call(game.edits,key(target.x,target.y))&&
   p16a3BoreRatio()>0&&p16DrillMotion.spin>=.60&&!p16DrillMotion.overheated;
 const broken=doMine(target.x,target.y,dt*miningRate(t)*boost);
 if(broken&&boreCandidate)p16a3BoreTransfer(target);
}
