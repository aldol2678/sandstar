const p16HammerFractures=new Map();
const P16_HAMMER_CORES=Object.freeze([null,
 Object.freeze({name:'I',fracture:.34,chainMax:1,maxDepth:0,cost:0,items:[]}),
 Object.freeze({name:'II',fracture:.42,chainMax:2,maxDepth:1,cost:480,items:[['stone',10],['iron',3]]}),
 Object.freeze({name:'III',fracture:.50,chainMax:3,maxDepth:2,cost:1150,items:[['stone',16],['iron',4],['crystal',4]]})]);
const P16_HAMMER_NATURAL=new Set(['dirt','stone','sand','snow']);
const P16_HAMMER_DIRS=Object.freeze([[1,0],[-1,0],[0,1],[0,-1]]);
function p16HammerNormalizeCore(raw){
 const n=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.rank:undefined;
 return {rank:Number.isSafeInteger(n)&&n>=1&&n<=3?n:1};
}
function p16HammerRank(state=game){return p16HammerNormalizeCore(state?.hammerCore).rank;}
function p16HammerNextRule(state=game){return P16_HAMMER_CORES[p16HammerRank(state)+1]||null;}
function p16HammerForgePanel(){
 const rank=p16HammerRank(),next=p16HammerNextRule(),owned=game.unlockedTools.includes('hammer');
 const needs=next?next.items.map(([id,n])=>`${MATERIAL_NAMES[id]} ${forgeAvailable(id)}/${n}`).join(' · '):'';
 const ready=!!next&&owned&&game.coins>=next.cost&&next.items.every(([id,n])=>forgeAvailable(id)>=n);
 const c=P16_HAMMER_CORES[rank];
 return `<section class="ss-p14-panel" aria-label="충격 망치 전문 강화"><h3>충격 망치 · 충격 코어 ${c.name}</h3>
 <p>중심 암석을 깨면 인접 자연 지층에 ${Math.round(c.fracture*100)}% 균열을 전달해요. 균열이 누적되면 한 번의 파쇄에서 최대 ${c.chainMax}개의 주변 암석까지 연쇄 파괴할 수 있어요. 광석·유물·보물·배치 구조물·시설은 충격파로 파괴되지 않아요. 균열은 저장되지 않고 도구를 바꾸면 사라져요.</p>
 <div class="ss-p14-craft-row"><strong>${next?'다음 충격 코어 '+next.name:'충격 코어 III · 최고 단계'}</strong>
 <small>${next?`균열 ${Math.round(next.fracture*100)}% · 연쇄 파쇄 최대 ${next.chainMax}타일`:'망치 전문화 완성'}</small>
 <small>${!owned?'바람장터에서 망치를 먼저 구매해야 해요.':next?`비용 ${next.cost} C · 보유 ${game.coins} C · ${needs}`:'추가 강화 단계 없음'}</small>
 <button type="button" id="p16HammerUpgrade" ${ready?'':'disabled'}>${!owned?'망치 필요':next?'충격 코어 강화':'최대 강화'}</button></div></section>`;
}
function p16HammerUpgrade(){
 if(!canOpenBuilding('forge'))return false;
 const ok=safeMarketTransaction(d=>{
  if(!d.unlockedTools.includes('hammer'))return false;
  const rule=p16HammerNextRule(d);if(!rule||d.coins<rule.cost||!rule.items.every(([id,n])=>forgeAvailable(id,d)>=n))return false;
  d.coins-=rule.cost;for(const [id,n] of rule.items)d.inv[id]-=n;
  d.hammerCore={rank:p16HammerRank(d)+1};d.economy.balanceMetrics.toolCreditsSpent+=rule.cost;
  return true;
 });
 if(ok){p16HammerFractures.clear();forgeMenu();flash('충격 망치 코어 '+P16_HAMMER_CORES[p16HammerRank()].name+' 강화 완료');}
 return ok;
}
function p16HammerEligible(x,y){
 if(!game||!p||ssRegion!=='mine'||paused||ssM16TransitionLocked||!canReach(x,y)||
    x<0||x>=WW||y<0||y>=WH-5||y<terrain(x)+3||stationGeneratedTile(x,y)!==undefined)return false;
 const k=key(x,y);
 // An edited tile includes mined voids AND player-built stone. Neither can be fractured.
 if(Object.prototype.hasOwnProperty.call(game.edits,k))return false;
 return P16_HAMMER_NATURAL.has(tile(x,y));
}
function p16HammerWave(x,y){
 if(game.tool!=='hammer'||ssRegion!=='mine'||paused)return false;
 const rule=P16_HAMMER_CORES[p16HammerRank()];
 let broken=0,affected=0;const seen=new Set([key(x,y)]),queue=[{x,y,depth:0}];
 // Finite radius, 24 cells inspected per impact, no global flood fill.
 while(queue.length&&affected<24&&broken<rule.chainMax){
  const at=queue.shift();if(at.depth>rule.maxDepth)continue;
  for(const [dx,dy] of P16_HAMMER_DIRS){
   const nx=at.x+dx,ny=at.y+dy,k=key(nx,ny);
   if(seen.has(k))continue;seen.add(k);
   if(!p16HammerEligible(nx,ny))continue;
   affected++;
   const t=tile(nx,ny),hp=tileHP(t),last=p16HammerFractures.get(k);
   // Depth attenuation prevents a single strike from clearing a large cavern.
   const damage=hp*rule.fracture*(at.depth===0?1:.68);
   const next=(last?.type===t?last.damage:0)+damage;
   if(next+1e-6>=hp&&broken<rule.chainMax){
    p16HammerFractures.delete(k);
    if(breakBlock(nx,ny,t,true)){
     broken++;
     if(at.depth<rule.maxDepth)queue.push({x:nx,y:ny,depth:at.depth+1});
    }
   }else{
    p16HammerFractures.set(k,{x:nx,y:ny,type:t,damage:Math.min(hp-.001,next)});
    mineSpark(nx,ny,t,false);
   }
   if(p16HammerFractures.size>128)p16HammerFractures.delete(p16HammerFractures.keys().next().value);
   if(broken>=rule.chainMax||affected>=24)break;
  }
 }
 return true;
}
function p16DrawHammerFractures(){
 if(game?.tool!=='hammer'||ssRegion!=='mine'||!p16HammerFractures.size)return;
 ctx.save();ctx.lineWidth=1.5;
 for(const [k,v] of p16HammerFractures){
  if(tile(v.x,v.y)!==v.type){p16HammerFractures.delete(k);continue;}
  const sx=Math.round(v.x*T-camera.x),sy=Math.round(v.y*T-camera.y);
  if(sx<-T||sy<-T||sx>viewW+T||sy>viewH+T)continue;
  const stage=Math.max(1,Math.min(4,Math.ceil(v.damage/tileHP(v.type)*4)));
  ctx.strokeStyle=stage>=3?'#f2d08b':'#d7b37b';ctx.globalAlpha=.48+stage*.09;
  ctx.beginPath();ctx.moveTo(sx+T*.25,sy+T*.28);ctx.lineTo(sx+T*.53,sy+T*.5);ctx.lineTo(sx+T*.34,sy+T*.78);
  if(stage>=2){ctx.moveTo(sx+T*.53,sy+T*.5);ctx.lineTo(sx+T*.78,sy+T*.36);}
  if(stage>=3){ctx.moveTo(sx+T*.53,sy+T*.5);ctx.lineTo(sx+T*.75,sy+T*.81);}
  ctx.stroke();
 }
 ctx.restore();
}

function p16ResetTools(){
 p16HammerFractures.clear();
 p16ResetDrillMotion(true);
 holdLast=null;holdProgress=0;mineFXTimer=0;
}
