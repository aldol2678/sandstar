// SANDSTAR fishing S1 (낚시 실장 구상 v0.4 · 제작 순서 A): one riverbank vertical slice.
// 잔빛숲 X61~68 (already dig-protected as water). Existing 3 species, walkable spots A/B/C,
// target selection → lure → bite → recovery-type tug (release is safe, only reeling advances).
// Payouts go through applyLivingCommandPure (river.hook / river.catch); progress and release are
// non-reward state written straight to livingP0.river and saved.
// The 잔빛숲 bank (X61~68) was the first control test; the real place is the fishing ground fishing_01.
// Flip to true only for local control comparisons.
const RIVER_FOREST_BANK=false;
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
function livingRiverFresh(){return {schema:1,best:{river_fish:0,perch:0,carp:0},spots:{A:0,B:0,C:0},attempt:null,done:[],assist:false,keep:{river_fish:0,perch:0,carp:0},flow:livingRiverFlowFresh(),record:{quest:0,seen:false},rewards:[]};}
// 남길 수량 (v0.4 4절): fish the player keeps back. Selling, cooking and the fisher's delivery only
// use the fish above this count, so a kept fish is never consumed behind a "kept" label.
const RIVER_KEEP_MAX=99;
// 별샘 물길 (v0.4 4절 '별샘과 돌아올 이유'). Stage 0 until the 잔빛숲 spring is repaired; then
// 1: only the connected stretch (C 물살) changes, 2: after 180s of active fishing-ground time ripples
// reach B, 3: after 480s and a later visit (re-entry) A clears. Only active time counts (walking in the
// fishing ground or an unpaused fishing view); being away or closing the app neither adds nor costs.
// No new species: the same three fish shift a little in mix and approach.
const RIVER_FLOW_STAGE2_SEC=180,RIVER_FLOW_STAGE3_SEC=480;
function livingRiverFlowFresh(){return {active:0,stage:0,stage2Entry:0,seen:0};}
function livingRiverFlowNormalize(raw){
 const f=livingRiverFlowFresh();if(!raw||typeof raw!=='object'||Array.isArray(raw))return f;
 f.active=Number.isFinite(raw.active)&&raw.active>=0?Math.min(raw.active,1e7):0;
 for(const k of ['stage','seen'])f[k]=Math.min(3,livingInt(raw[k]));
 f.stage2Entry=livingInt(raw.stage2Entry);if(f.seen>f.stage)f.seen=f.stage;return f;
}
function livingRiverFlowStage(river,repaired,entryCount){
 if(!repaired)return 0;
 const f=river.flow;let st=Math.max(1,f.stage);
 if(st<2&&f.active>=RIVER_FLOW_STAGE2_SEC)st=2;
 if(st===2&&f.active>=RIVER_FLOW_STAGE3_SEC&&entryCount>f.stage2Entry)st=3;
 return st;
}
function livingRiverSpotLive(id,stage){
 const s=RIVER_SPOTS[id],w={...s.weights};let flow=s.flow,approach=1,clear=0;
 if(id==='C'){flow=stage>=2?.2:stage>=1?.18:.13;if(stage>=1){w.perch+=8;w.river_fish=Math.max(10,w.river_fish-4);}}
 if(id==='B'&&stage>=2)approach=1.15;
 if(id==='A'&&stage>=3){w.carp+=6;clear=1;}
 return {...s,flow,weights:w,approach,clear,stage};
}
const RIVER_FLOW_NOTES=Object.freeze([
 'C 물살이 약해요. 잔빛숲 별샘과 이어져 있는 것 같아요.',
 '별샘 물길이 C 물살까지 닿았어요. 물살이 조금 세졌어요.',
 'B 깊은 소에 잔물결 흔적이 번져요. 큰 그림자가 더 잘 다가와요.',
 '다시 와 보니 A 강가 물이 한결 맑아졌어요.'
]);
const RIVER_RECORD_REWARD='river-record-marks-1',RIVER_REWARD_IDS=Object.freeze([RIVER_RECORD_REWARD]);
function livingFishRecordCount(state){const dex=Array.isArray(state?.fishDex)?state.fishDex:[];return LIVING_FISH_ORDER.filter(id=>dex.includes(id)).length;}
function livingRiverMarked(state){return !!state?.river?.rewards?.includes(RIVER_RECORD_REWARD);}
function livingFishKeep(state,id){return Math.min(RIVER_KEEP_MAX,livingInt(state?.river?.keep?.[id]));}
function livingFishFree(state,id){return Math.max(0,livingInt(state?.bag?.[id])-livingFishKeep(state,id));}
function livingFreeBag(state){const b={...state.bag};for(const id of LIVING_FISH_ORDER)b[id]=livingFishFree(state,id);return b;}
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
 r.flow=livingRiverFlowNormalize(raw.flow);
 if(raw.keep&&typeof raw.keep==='object')for(const id of Object.keys(r.keep))r.keep[id]=Math.min(RIVER_KEEP_MAX,livingInt(raw.keep[id]));
 if(raw.record&&typeof raw.record==='object'){r.record.quest=raw.record.quest===1?1:0;r.record.seen=raw.record.seen===true;}
 if(Array.isArray(raw.rewards))r.rewards=[...new Set(raw.rewards.filter(id=>RIVER_REWARD_IDS.includes(id)))];
 return r;
}
function livingRiverCommand(state,cmd,kind,bad,hasBuff){
 const river=state.river;
 // 여울 '물고기 기록' (선택 의뢰): progress = river species in fishDex (old dex counts, no fish used);
 // the reward is granted once, by id, and is only the 물살 관찰 표식 (no coins, no items).
 if(kind==='river.record.accept'){
  if(river.record.quest===1)return bad('이미 받은 의뢰예요');
  river.record.quest=1;const n=livingFishRecordCount(state);
  return {message:`여울의 물고기 기록 의뢰를 받았어요 · 기록 ${n}/3`,progress:n};
 }
 if(kind==='river.record.claim'){
  if(river.record.quest!==1)return bad('먼저 여울의 의뢰를 받아 주세요');
  if(river.rewards.includes(RIVER_RECORD_REWARD))return bad('이미 받은 보상이에요');
  const n=livingFishRecordCount(state);if(n<3)return bad(`아직 기록이 ${n}/3이에요`);
  river.rewards.push(RIVER_RECORD_REWARD);river.record.seen=false;
  return {message:'물살 관찰 표식을 받았어요 · 도래 낚시터에 남았어요',reward:RIVER_RECORD_REWARD,progress:n};
 }
 if(kind==='fish.keep'){
  if(!livingOwn(LIVING_FISH,cmd.item))return bad('물고기 종류를 확인해 주세요');
  if(!Number.isSafeInteger(cmd.count)||cmd.count<0||cmd.count>RIVER_KEEP_MAX)return bad('남길 수량을 확인해 주세요');
  river.keep[cmd.item]=cmd.count;
  return {message:`${LIVING_FISH[cmd.item].name} ${cmd.count}마리를 남겨 둬요 (판매·요리·납품에 쓰지 않음)`};
 }
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
 const id=a.fish,prevBest=river.best[id]||0,record=a.size>prevBest,hadDex=state.fishDex.includes(id);
 state.bag[id]++;state.stats.fished++;state.fishDex=[...new Set([...state.fishDex,id])];
 if(record)river.best[id]=a.size;
 river.spots[a.spot]++;river.done.push(a.id);if(river.done.length>32)river.done.shift();
 river.attempt=null;
 return {message:LIVING_FISH[id].name+' '+(a.size/10).toFixed(1)+'cm · 가방에 보관했어요 (판매 전)',record,size:a.size,fish:id,firstDex:!hadDex,firstSize:hadDex&&prevBest===0};
}
