// SANDSTAR fishing S1 (낚시 실장 구상 v0.4 · 제작 순서 A): one riverbank vertical slice.
// 잔빛숲 X61~68 (already dig-protected as water). Existing 3 species, walkable spots A/B/C,
// target selection → lure → bite → recovery-type tug (release is safe, only reeling advances).
// Payouts go through applyLivingCommandPure (river.hook / river.catch); progress and release are
// non-reward state written straight to livingP0.river and saved.
const RIVER_SPOTS=Object.freeze({
 A:{name:'완만한 강가',short:'A 강가',x:60.4,bottom:.66,flow:.05,weights:{river_fish:58,perch:24,carp:18},bias:1.25,
    blocks:[[.2,.31]],desc:'약한 흐름과 수초. 작은 그림자가 자주 보여요.'},
 B:{name:'깊은 소',short:'B 깊은 소',x:64,bottom:.93,flow:.02,weights:{river_fish:22,perch:30,carp:48},bias:.62,
    blocks:[],desc:'느린 큰 그림자와 바닥 쪽 저항. 큰 기록을 노려요.'},
 C:{name:'좁은 물살',short:'C 물살',x:67.6,bottom:.78,flow:.16,weights:{river_fish:26,perch:54,carp:20},bias:1,
    blocks:[[.56,.67]],desc:'바위 뒤 흐름. 찌가 물살을 타고 그림자 앞을 지나가요.'}
});
const RIVER_FISH_SIZE=Object.freeze({river_fish:[60,120],perch:[140,300],carp:[200,450]});
// Fight tuning: seconds of reeling inside open gaps needed to land the fish.
const RIVER_FIGHT=Object.freeze({
 river_fish:{need:2.4,phases:[['gap',.55,.95],['flutter',.45,.8]]},
 perch:{need:4.2,phases:[['gap',1.1,1.7],['warn',.75,.75],['dash',.9,1.3]]},
 carp:{need:5.4,phases:[['loose',1.9,2.7],['hold',1.6,2.4]]}
});
const RIVER_HINTS=Object.freeze({
 river_fish:'작은 그림자는 짧게 당겼다 멈추면 다가와요.',
 perch:'중간 그림자는 지나가는 길 앞에서 당기면 쫓아와요.',
 carp:'큰 그림자는 당기지 말고 바닥 가까이 조용히 흘려 두세요.'
});
const RIVER_BITE_WINDOW=2.6;
function livingRiverFresh(){return {schema:1,best:{river_fish:0,perch:0,carp:0},spots:{A:0,B:0,C:0},attempt:null,done:[],assist:false};}
function livingRiverNormalize(raw){
 const r=livingRiverFresh();if(!raw||typeof raw!=='object'||Array.isArray(raw))return r;
 if(raw.best&&typeof raw.best==='object')for(const id of Object.keys(r.best)){const v=raw.best[id];if(Number.isSafeInteger(v)&&v>=0)r.best[id]=Math.min(v,RIVER_FISH_SIZE[id][1]);}
 if(raw.spots&&typeof raw.spots==='object')for(const id of Object.keys(r.spots))r.spots[id]=livingInt(raw.spots[id]);
 const a=raw.attempt;
 if(a&&typeof a==='object'&&typeof a.id==='string'&&/^[\w-]{4,64}$/.test(a.id)&&livingOwn(LIVING_FISH,a.fish)&&livingOwn(RIVER_SPOTS,a.spot)){
  const [lo,hi]=RIVER_FISH_SIZE[a.fish];
  r.attempt={id:a.id,fish:a.fish,spot:a.spot,size:Number.isSafeInteger(a.size)?Math.max(lo,Math.min(hi,a.size)):lo,progress:Math.min(100,livingInt(a.progress))};
 }
 if(Array.isArray(raw.done))r.done=raw.done.filter(id=>typeof id==='string'&&/^[\w-]{4,64}$/.test(id)).slice(-32);
 if(r.attempt&&r.done.includes(r.attempt.id))r.attempt=null;
 r.assist=raw.assist===true;
 return r;
}
function livingRiverCommand(state,cmd,kind,bad,hasBuff){
 const river=state.river;
 if(cmd.target!=='pond')return bad('강변 낚시터에서 이용해 주세요');
 if(!state.rod)return bad('낚싯대를 먼저 제작해 주세요');
 if(kind==='river.hook'){
  if(river.attempt)return bad('이미 물고기가 걸려 있어요');
  if(typeof cmd.attempt!=='string'||!/^[\w-]{4,64}$/.test(cmd.attempt)||river.done.includes(cmd.attempt))return bad('낚시 시도를 확인해 주세요');
  if(!livingOwn(RIVER_SPOTS,cmd.spot))return bad('낚시 자리를 확인해 주세요');
  let fish=cmd.item,progress=0;
  if(cmd.legacy===true){
   if(!state.fishing)return bad('이어서 할 낚시가 없어요');
   fish=state.fishing.id;progress=Math.min(99,livingInt(state.fishing.progress));state.fishing=null;
  }
  if(!livingOwn(LIVING_FISH,fish))return bad('등록되지 않은 물고기예요');
  const [lo,hi]=RIVER_FISH_SIZE[fish];
  if(!Number.isSafeInteger(cmd.size)||cmd.size<lo||cmd.size>hi)return bad('물고기 크기를 확인해 주세요');
  river.attempt={id:cmd.attempt,fish,spot:cmd.spot,size:cmd.size,progress};
  return {message:LIVING_FISH[fish].name+'이(가) 걸렸어요! 틈에 감고, 버티면 손을 떼세요'};
 }
 // river.catch: lands the hooked fish exactly once (attempt id + done list + appliedIds).
 const a=river.attempt;
 if(!a||cmd.attempt!==a.id)return bad('걸린 물고기가 없어요');
 if(river.done.includes(a.id))return bad('이미 기록한 물고기예요');
 const id=a.fish,prevBest=river.best[id]||0,record=a.size>prevBest;
 state.bag[id]++;state.stats.fished++;state.fishDex=[...new Set([...state.fishDex,id])];
 if(record)river.best[id]=a.size;
 river.spots[a.spot]++;river.done.push(a.id);if(river.done.length>32)river.done.shift();
 river.attempt=null;
 return {message:LIVING_FISH[id].name+' '+(a.size/10).toFixed(1)+'cm · 가방에 보관했어요 (판매 전)',record,size:a.size,fish:id,firstDex:prevBest===0};
}
