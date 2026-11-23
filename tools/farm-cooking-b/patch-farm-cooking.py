#!/usr/bin/env python3
"""SANDSTAR farm + cooking B (2026-11-23) on the Worker v38 baseline.

Input : <build>/v38-index.html  (extracted from release/v38/main.mjs, SHA f2cb9415...)
Output: <build>/fcb-index.html

Scope (brief 01_BRIEF-FARM-COOKING-B.md, sections 2-3):
- farm_01 loop: plant -> water -> grow -> harvest for wheat/potato/carrot,
  3 visible stages (Duri P3 sprites), growth only while watered.
- cooking at a village kitchen counter: bread wheat x2, carrot soup carrot x2,
  fish stew any fish x1 + potato x1 (Duri P5 sprites), blocked with a reason
  when ingredients are missing, dishes stay in the bag and restore energy.
- countable harvest / cook / delivery records (03_QUESTS note), no quest wiring.

Every replacement is rep_once: the exact string must occur exactly once
(or the stated count) or the script aborts without writing.
"""
import base64, hashlib, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUILD = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE
ASSETS = HERE.parent.parent / "assets" / "duri"
SRC = BUILD / "v38-index.html"
DST = BUILD / "fcb-index.html"

html = SRC.read_text(encoding="utf-8")
base_sha = hashlib.sha256(html.encode()).hexdigest()
assert base_sha == "f2cb9415016dad6d0df5084aa42c2ec66b0c12a8e19b7c41608c535ca641bd51", base_sha


def rep_once(old, new, label, count=1):
    global html
    n = html.count(old)
    assert n == count, f"{label}: expected {count}, found {n}: {old[:90]!r}"
    html = html.replace(old, new)


# ------------------------------------------------------------------ sprites
SPRITES = [
    ("p3", ["crop_wheat_s1", "crop_wheat_s2", "crop_wheat_s3", "crop_potato_s1", "crop_potato_s2",
            "crop_potato_s3", "crop_carrot_s1", "crop_carrot_s2", "crop_carrot_s3",
            "seed_wheat", "seed_potato", "seed_carrot"]),
    ("p5", ["river_fish", "perch", "carp", "bread", "soup", "stew"]),
]
sums = {}
for pack, _ in SPRITES:
    for line in (ASSETS / pack / "SHA256SUMS.txt").read_text().splitlines():
        if line.strip():
            h, name = line.split()
            sums[(pack, name)] = h
sprite_js = []
for pack, ids in SPRITES:
    for sid in ids:
        data = (ASSETS / pack / f"{sid}.png").read_bytes()
        assert hashlib.sha256(data).hexdigest() == sums[(pack, f"{sid}.png")], f"sprite sha {pack}/{sid}"
        sprite_js.append(f"{sid}:'data:image/png;base64,{base64.b64encode(data).decode()}'")
SPRITE_OBJ = ",".join(sprite_js)

# ------------------------------------------------------------------ marker
rep_once("<script>\n/* SANDSTAR Phase 0 2026-11-23 (phase0-20261123): Yeoul QA 5+1, on v37 baseline. Follow-up P0-4b (apron grass notice) + P0-5b (label margin) 2026-11-23. */\n(()=>{'use strict';",
         "<script>\n/* SANDSTAR Phase 0 2026-11-23 (phase0-20261123): Yeoul QA 5+1, on v37 baseline. Follow-up P0-4b (apron grass notice) + P0-5b (label margin) 2026-11-23. */\n/* SANDSTAR farm+cooking B 2026-11-23 (farm-cooking-b-20261123): on v38 baseline. */\n(()=>{'use strict';",
         "fcb marker")

# ------------------------------------------------------------------ data model
rep_once("const LIVING_CROPS=Object.freeze({wheat:{name:'밀',seconds:75,seed:'seed_wheat',price:8},potato:{name:'감자',seconds:105,seed:'seed_potato',price:11},carrot:{name:'당근',seconds:90,seed:'seed_carrot',price:10}});",
         "const LIVING_CROPS=Object.freeze({wheat:{name:'밀',seconds:75,stageSeconds:30,seed:'seed_wheat',price:8},potato:{name:'감자',seconds:105,stageSeconds:40,seed:'seed_potato',price:11},carrot:{name:'당근',seconds:90,stageSeconds:35,seed:'seed_carrot',price:10}});",
         "crops: per-stage growth seconds")
rep_once("const LIVING_RECIPES=Object.freeze({bread:{name:'갓 구운 빵',price:16,needs:{wheat:3},wood:1,buff:'harvest'},soup:{name:'당근 수프',price:18,needs:{carrot:2,potato:1},wood:1,buff:'wood'},stew:{name:'생선 스튜',price:21,needs:{river_fish:1,potato:1},wood:1,buff:'fish'}});",
         "const LIVING_RECIPES=Object.freeze({bread:{name:'갓 구운 빵',price:16,needs:{wheat:2},wood:0,energy:25,buff:'harvest'},soup:{name:'당근 수프',price:18,needs:{carrot:2},wood:0,energy:35,buff:'wood'},stew:{name:'생선 스튜',price:21,needs:{fish:1,potato:1},wood:0,energy:50,buff:'fish'}});",
         "recipes: brief B fixed recipes")

FCB_CORE = r"""
// SANDSTAR farm+cooking B (2026-11-23): Duri P3 crops (9 stages + 3 seeds) and P5 fish/food (6),
// 32x32 PNG, game-asset use only (pack licence forbids AI training use).
const FCB_SPRITE_SRC=Object.freeze({__SPRITES__});
const FCB_IMG=Object.create(null);
function fcbImg(id){if(!FCB_SPRITE_SRC[id])return null;let im=FCB_IMG[id];if(!im){im=FCB_IMG[id]=new Image();im.decoding='async';im.src=FCB_SPRITE_SRC[id];}return im.complete&&im.naturalWidth>0?im:null;}
function fcbIconHtml(id,alt=''){return FCB_SPRITE_SRC[id]?`<img class="fcb-pixel" src="${FCB_SPRITE_SRC[id]}" alt="${alt}" width="32" height="32">`:'';}
const FCB_ITEM_SPRITE=Object.freeze({wheat:'crop_wheat_s3',potato:'crop_potato_s3',carrot:'crop_carrot_s3',seed_wheat:'seed_wheat',seed_potato:'seed_potato',seed_carrot:'seed_carrot',river_fish:'river_fish',perch:'perch',carp:'carp',bread:'bread',soup:'soup',stew:'stew'});
// Energy (기력): v38 has no HP/stamina stat, so cooking restores this farm-work energy.
const LIVING_ENERGY=Object.freeze({max:100,regenSeconds:12,plant:4,water:2,harvest:4});
const LIVING_FISH_ORDER=Object.freeze(['river_fish','perch','carp']);
const LIVING_ITEM_NAMES=Object.freeze({wheat:'밀',potato:'감자',carrot:'당근',crop:'채소',fish:'물고기',river_fish:'은빛 피라미',perch:'강농어',carp:'비단잉어',bread:'갓 구운 빵',soup:'당근 수프',stew:'생선 스튜',seed_wheat:'밀 씨앗',seed_potato:'감자 씨앗',seed_carrot:'당근 씨앗',seed:'채소 씨앗',sapling:'묘목',wood:'원목'});
function livingFreshCounts(){return {harvested:{wheat:0,potato:0,carrot:0,crop:0},cooked:{bread:0,soup:0,stew:0},delivered:{}};}
function livingFishCount(bag){return LIVING_FISH_ORDER.reduce((n,id)=>n+livingInt(bag?.[id]),0);}
function livingNeedHave(bag,item){return item==='fish'?livingFishCount(bag):livingInt(bag?.[item]);}
function livingRecipeShortfall(bag,id){const r=LIVING_RECIPES[id];if(!r)return [{item:id,need:1,have:0}];const out=[];for(const [item,n] of Object.entries(r.needs)){const have=livingNeedHave(bag,item);if(have<n)out.push({item,need:n,have});}return out;}
function livingShortfallText(list){return list.map(x=>`${LIVING_ITEM_NAMES[x.item]||x.item} ${x.need-x.have}개 더 필요 (보유 ${x.have}/${x.need})`).join(' · ');}
function livingStageSeconds(crop){return crop==='legacy'?35:(LIVING_CROPS[crop]?.stageSeconds||35);}
function livingEnergyReason(state,cost){return `기력이 부족해요 (필요 ${cost} · 현재 ${Math.floor(state.energy)}) · 요리를 먹거나 잠시 쉬면 회복돼요`;}
// A watered plot advances exactly one stage after its crop's stage time, then dries out.
function livingGrowPlots(state){if(!state?.plots)return state;for(const plot of Object.values(state.plots)){if(!plot||plot.plantedAt===null)continue;if(plot.watered&&plot.stage<3&&Number.isFinite(plot.wateredAt)&&state.clock-plot.wateredAt>=livingStageSeconds(plot.crop)){plot.stage++;plot.watered=false;plot.wateredAt=null;}}return state;}
""".replace("__SPRITES__", SPRITE_OBJ)

rep_once("const livingInt=(n,max=1000000)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;\n",
         "const livingInt=(n,max=1000000)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;\n" + FCB_CORE,
         "core helpers")

rep_once("for(const x of LIVING_SITES.plots)plots[`plot:${x}`]={plantedAt:null,watered:false,crop:null};",
         "for(const x of LIVING_SITES.plots)plots[`plot:${x}`]={plantedAt:null,watered:false,crop:null,stage:0,wateredAt:null};",
         "fresh plots: stage")
rep_once("   fishDex:[],foodBuff:null,appliedIds:[],events:[]};\n}",
         "   fishDex:[],foodBuff:null,appliedIds:[],events:[],energy:LIVING_ENERGY.max,counts:livingFreshCounts()};\n}",
         "fresh state: energy + counts")
rep_once("""  const crop=plantedAt===null?null:(livingOwn(LIVING_CROPS,v.crop)?v.crop:'legacy');
  state.plots[id]={plantedAt,watered:v.watered===true,crop};""",
         """  const crop=plantedAt===null?null:(livingOwn(LIVING_CROPS,v.crop)?v.crop:'legacy');
  let stage=plantedAt===null?0:(Number.isSafeInteger(v.stage)&&v.stage>=1&&v.stage<=3?v.stage:0),watered=plantedAt!==null&&v.watered===true;
  let wateredAt=watered&&Number.isFinite(v.wateredAt)&&v.wateredAt>=0?Math.min(v.wateredAt,state.clock):null;
  if(plantedAt!==null&&stage===0){ // pre-B save (timer model) -> stage model
   const old=crop==='legacy'?90:LIVING_CROPS[crop].seconds;
   if(watered&&state.clock-plantedAt>=old){stage=3;watered=false;wateredAt=null;}else stage=1;
  }
  if(stage>=3){watered=false;wateredAt=null;}
  if(watered&&wateredAt===null)wateredAt=state.clock;
  state.plots[id]={plantedAt,watered,crop,stage,wateredAt};""",
         "normalize plots: stage migration")
rep_once(" return state;\n}\nfunction livingTargetX(target){",
         """ state.energy=Number.isFinite(raw.energy)?Math.max(0,Math.min(LIVING_ENERGY.max,raw.energy)):LIVING_ENERGY.max;
 if(raw.counts&&typeof raw.counts==='object'){
  for(const group of ['harvested','cooked']){const src=raw.counts[group];if(src&&typeof src==='object')for(const k of Object.keys(state.counts[group]))state.counts[group][k]=livingInt(src[k]);}
  const d=raw.counts.delivered;if(d&&typeof d==='object')for(const [k,v] of Object.entries(d))if(livingOwn(LIVING_ITEM_NAMES,k))state.counts.delivered[k]=livingInt(v);
 }
 return livingGrowPlots(state);
}
function livingTargetX(target){""",
         "normalize: energy, counts, growth")

# ------------------------------------------------------------------ commands
rep_once("""   if(bag(seed)<1)return bad('씨앗이 부족해요');
   state.bag[seed]--;plot.plantedAt=state.clock;plot.watered=false;plot.crop=type;""",
         """   if(bag(seed)<1)return bad('씨앗이 부족해요');
   if(state.energy<LIVING_ENERGY.plant)return bad(livingEnergyReason(state,LIVING_ENERGY.plant));
   state.energy-=LIVING_ENERGY.plant;state.bag[seed]--;plot.plantedAt=state.clock;plot.watered=false;plot.wateredAt=null;plot.stage=1;plot.crop=type;""",
         "plant: stage 1 + energy")
rep_once("""   if(plot.watered)return bad('이미 물을 주었어요');
   plot.watered=true;message='물을 주었어요';break;}""",
         """   if(plot.stage>=3)return bad('다 자랐어요. 수확해 주세요');
   if(plot.watered)return bad('이미 물을 주었어요. 자라는 중이에요');
   if(state.energy<LIVING_ENERGY.water)return bad(livingEnergyReason(state,LIVING_ENERGY.water));
   state.energy-=LIVING_ENERGY.water;plot.watered=true;plot.wateredAt=state.clock;message=`물을 주었어요 · ${livingStageSeconds(plot.crop)}초 뒤 ${plot.stage+1}단계`;break;}""",
         "water: one stage per watering")
rep_once("""   const required=plot.crop==='legacy'?90:LIVING_CROPS[plot.crop].seconds;
   if(!plot.watered||state.clock-plot.plantedAt<required)return bad('아직 수확 시기가 아니에요');""",
         """   if(plot.stage<3)return bad(plot.watered?`아직 자라는 중이에요 (${plot.stage}/3단계)`:`물을 주어야 자라요 (${plot.stage}/3단계)`);
   if(state.energy<LIVING_ENERGY.harvest)return bad(livingEnergyReason(state,LIVING_ENERGY.harvest));
   state.energy-=LIVING_ENERGY.harvest;""",
         "harvest: stage 3 only")
rep_once("   plot.plantedAt=null;plot.crop=null;plot.watered=false;state.stats.harvested++;",
         "   plot.plantedAt=null;plot.crop=null;plot.watered=false;plot.stage=0;plot.wateredAt=null;state.stats.harvested++;state.counts.harvested[crop]=(state.counts.harvested[crop]||0)+1;",
         "harvest: reset plot + count")
rep_once("""   if(stock('wood')<recipe.wood)return bad('요리 연료 원목 1개가 필요해요');
   for(const [item,n] of Object.entries(recipe.needs))if(bag(item)<n)return bad(`${item} 재료가 부족해요`);
   inv.wood-=recipe.wood;for(const [item,n] of Object.entries(recipe.needs))state.bag[item]-=n;
   state.bag[cmd.item]++;state.stats.cooked++;message=recipe.name+' 요리 완료';break;}""",
         """   if(recipe.wood>0&&stock('wood')<recipe.wood)return bad(`요리 연료 원목 ${recipe.wood}개가 필요해요`);
   const short=livingRecipeShortfall(state.bag,cmd.item);if(short.length)return bad('재료가 부족해요: '+livingShortfallText(short));
   if(recipe.wood>0)inv.wood-=recipe.wood;
   for(const [item,n] of Object.entries(recipe.needs)){if(item==='fish'){let need=n;for(const f of LIVING_FISH_ORDER){const use=Math.min(need,state.bag[f]);state.bag[f]-=use;need-=use;if(!need)break;}}else state.bag[item]-=n;}
   state.bag[cmd.item]++;state.stats.cooked++;state.counts.cooked[cmd.item]++;message=recipe.name+' 요리 완료';break;}""",
         "cook: B recipes, any fish, reason")
rep_once("""   state.bag[cmd.item]--;state.foodBuff={type:LIVING_RECIPES[cmd.item].buff,until:state.clock+180};
   message=LIVING_RECIPES[cmd.item].name+' 식사 완료 · 3분 생활 보너스';break;}""",
         """   const before=Math.floor(state.energy),gain=LIVING_RECIPES[cmd.item].energy||0;
   state.bag[cmd.item]--;state.energy=Math.min(LIVING_ENERGY.max,state.energy+gain);state.foodBuff={type:LIVING_RECIPES[cmd.item].buff,until:state.clock+180};
   message=`${LIVING_RECIPES[cmd.item].name} 식사 완료 · 기력 ${before}→${Math.floor(state.energy)} · 3분 생활 보너스`;break;}""",
         "eat: energy restore")
rep_once("if(stock('wood')<6)return bad('목수에게 원목 6개가 필요해요');inv.wood-=6;state.bag.sapling++;",
         "if(stock('wood')<6)return bad('목수에게 원목 6개가 필요해요');inv.wood-=6;state.bag.sapling++;state.counts.delivered.wood=(state.counts.delivered.wood||0)+6;",
         "deliver count: wood")
rep_once("if(bag('wheat')<3)return bad('농부에게 밀 3개가 필요해요');state.bag.wheat-=3;state.bag.seed_potato+=2;",
         "if(bag('wheat')<3)return bad('농부에게 밀 3개가 필요해요');state.bag.wheat-=3;state.bag.seed_potato+=2;state.counts.delivered.wheat=(state.counts.delivered.wheat||0)+3;",
         "deliver count: wheat")
rep_once("let need=2;for(const fish of Object.keys(LIVING_FISH)){const use=Math.min(need,state.bag[fish]);state.bag[fish]-=use;need-=use;if(!need)break;}",
         "let need=2;for(const fish of Object.keys(LIVING_FISH)){const use=Math.min(need,state.bag[fish]);state.bag[fish]-=use;if(use)state.counts.delivered[fish]=(state.counts.delivered[fish]||0)+use;need-=use;if(!need)break;}",
         "deliver count: fish")
rep_once("function livingWorldTick(dt){if(!game||!game.livingP0||!Number.isFinite(dt)||dt<0)return;game.livingP0.clock=Math.min(1e9,game.livingP0.clock+dt)}",
         """function livingWorldTick(dt){if(!game||!game.livingP0||!Number.isFinite(dt)||dt<0)return;const w=game.livingP0;w.clock=Math.min(1e9,w.clock+dt);
 if(Number.isFinite(w.energy)&&w.energy<LIVING_ENERGY.max)w.energy=Math.min(LIVING_ENERGY.max,w.energy+dt/LIVING_ENERGY.regenSeconds);
 if(w.plots)livingGrowPlots(w);}""",
         "tick: energy regen + growth")

# ------------------------------------------------------------------ living menu (legacy side-view panel)
rep_once("push('<h3>🌾 밭 가꾸기</h3><p>씨앗을 심고 물을 준 뒤 성장을 기다려요. 밀 75초, 당근 90초, 감자 105초.</p>');",
         "push(`<h3>🌾 밭 가꾸기</h3><p>씨앗을 심고 물을 주면 한 단계씩 자라요(3단계). 마른 밭은 자라지 않아요. 단계마다 밀 ${LIVING_CROPS.wheat.stageSeconds}초 · 당근 ${LIVING_CROPS.carrot.stageSeconds}초 · 감자 ${LIVING_CROPS.potato.stageSeconds}초 · 기력 ${Math.floor(w.energy)}/${LIVING_ENERGY.max}</p>`);",
         "living menu farm intro")
rep_once("""   else if(!plot.watered)content=action('물 주기','plot.water',id,'',!near(x));
   else{const seconds=plot.crop==='legacy'?90:LIVING_CROPS[plot.crop].seconds,remaining=seconds-(w.clock-plot.plantedAt);
    content=action(remaining<=0?'수확하기':`성장 ${fmt(remaining)}초`,'plot.harvest',id,'',!near(x)||remaining>0);}""",
         """   else if(plot.stage>=3)content=action('수확하기','plot.harvest',id,'',!near(x));
   else if(!plot.watered)content=action(`물 주기 (${plot.stage}/3)`,'plot.water',id,'',!near(x));
   else{const remaining=livingStageSeconds(plot.crop)-(w.clock-plot.wateredAt);content=action(`성장 ${fmt(remaining)}초`,'plot.harvest',id,'',true);}""",
         "living menu farm rows")
rep_once("""  push('<h3>🍳 바람장터 부엌</h3><p>원목을 연료로 요리하고, 음식을 먹으면 생활 보너스가 월드 시간 180초 동안 적용돼요.</p>');
  for(const [id,recipe] of Object.entries(LIVING_RECIPES)){
   const requirements=Object.entries(recipe.needs).map(([item,n])=>`${LIVING_CROPS[item]?.name||LIVING_FISH[item]?.name||item} ${n}`).join(' · ');
   const enough=(game.inv.wood||0)>=recipe.wood&&Object.entries(recipe.needs).every(([item,n])=>w.bag[item]>=n);
   push(row(`${recipe.name} · ${requirements} · 원목 1`,action('요리하기','cook.make','kitchen',id,!near(23)||!enough)));""",
         """  push('<h3>🍳 바람장터 요리대</h3><p>요리는 마을 바람장터 옆 요리대에서 만들어요. 음식을 먹으면 기력이 회복되고 생활 보너스가 월드 시간 180초 동안 적용돼요.</p>');
  for(const [id,recipe] of Object.entries(LIVING_RECIPES)){
   const requirements=Object.entries(recipe.needs).map(([item,n])=>`${LIVING_ITEM_NAMES[item]||item} ${n}`).join(' · ');
   const short=livingRecipeShortfall(w.bag,id);
   push(row(`${recipe.name} · ${requirements} · 기력 +${recipe.energy}`,`<small>${short.length?'재료 부족':'요리대에서 요리 가능'}</small>`));""",
         "living menu cook tab")

# ------------------------------------------------------------------ crop-ready sfx + forest side-view labels
rep_once("""    if(!plot||plot.plantedAt===null||!plot.watered)continue;
    const req=plot.crop==='legacy'?90:((typeof LIVING_CROPS!=='undefined'&&LIVING_CROPS[plot.crop]&&LIVING_CROPS[plot.crop].seconds)||0);
    const key=id+':'+plot.plantedAt;
    if(w.clock-plot.plantedAt>=req&&!ssSfx32CropSeen.has(key)){ssSfx32CropSeen.add(key);playSound('crop_ready');}""",
         """    if(!plot||plot.plantedAt===null||!(plot.stage>=3))continue;
    const key=id+':'+plot.plantedAt;
    if(!ssSfx32CropSeen.has(key)){ssSfx32CropSeen.add(key);playSound('crop_ready');}""",
         "crop ready sfx: stage 3")
rep_once("""  if(!plot.watered)return '💧 밭에 물 주기';
  const sec=plot.crop==='legacy'?90:LIVING_CROPS[plot.crop]?.seconds||90;
  return w.clock-plot.plantedAt>=sec?'🌾 작물 수확':'🌱 작물 성장 확인';""",
         """  if(plot.stage>=3)return '🌾 작물 수확';
  if(!plot.watered)return `💧 밭에 물 주기 (${plot.stage}/3)`;
  return '🌱 작물 성장 확인';""",
         "forest plot label")
rep_once("  const type=plot.watered?'plot.harvest':'plot.water';",
         "  const type=plot.stage>=3||plot.watered?'plot.harvest':'plot.water';",
         "forest plot action")

# ------------------------------------------------------------------ farm_01 world
rep_once('<div class="farm-stats"><div id="farmWorldBag">🌱 씨앗 · 밀 3 / 감자 3 / 당근 3</div><div id="farmWorldCoords">X 6 · Y 16</div></div>',
         '<div class="farm-stats"><div id="farmWorldBag">🌱 씨앗 · 밀 3 / 감자 3 / 당근 3</div><div id="farmWorldEnergy">⚡ 기력</div><div id="farmWorldHarvest">🧺 수확물</div><div id="farmWorldCoords">X 6 · Y 16</div><button id="farmWorldBagBtn" class="fcb-farm-bag" type="button">🎒 가방</button></div>',
         "farm HUD energy + bag button")
rep_once(""" if(plot.plantedAt===null)return '🌱 '+LIVING_CROPS[farmSelectedSeed].name+' 심기';
 if(!plot.watered)return '💧 물 주기';
 const t=plot.crop==='legacy'?90:(LIVING_CROPS[plot.crop]?.seconds||90);
 const remaining=t-(game.livingP0.clock-plot.plantedAt);
 return remaining>0?'🌿 성장 중 '+Math.ceil(remaining)+'초':'🌾 수확하기';""",
         """ if(plot.plantedAt===null)return '🌱 '+LIVING_CROPS[farmSelectedSeed].name+' 심기';
 if(plot.stage>=3)return '🌾 수확하기';
 if(!plot.watered)return `💧 물 주기 (${plot.stage}/3단계)`;
 const remaining=livingStageSeconds(plot.crop)-(game.livingP0.clock-plot.wateredAt);
 return '🌿 자라는 중 '+Math.max(1,Math.ceil(remaining))+'초';""",
         "farm action label")
rep_once(" $('farmWorldBag').textContent=`🌱 밀 ${bag.seed_wheat} · 감자 ${bag.seed_potato} · 당근 ${bag.seed_carrot}`;",
         " $('farmWorldBag').textContent=`🌱 씨앗 밀 ${bag.seed_wheat} · 감자 ${bag.seed_potato} · 당근 ${bag.seed_carrot}`;\n {const e=$('farmWorldEnergy');if(e)e.textContent=`⚡ 기력 ${Math.floor(game.livingP0.energy)}/${LIVING_ENERGY.max}`;const hv=$('farmWorldHarvest');if(hv)hv.textContent=`🧺 밀 ${bag.wheat} · 감자 ${bag.potato} · 당근 ${bag.carrot}`;}",
         "farm HUD refresh")
rep_once(""" if(!plot.watered)return farmWorldCommand('plot.water',near.id);
 return farmWorldCommand('plot.harvest',near.id);""",
         """ if(plot.stage<3&&!plot.watered)return farmWorldCommand('plot.water',near.id);
 return farmWorldCommand('plot.harvest',near.id);""",
         "farm action dispatch")
rep_once("$('farmWorldExit').addEventListener('click',farmWorldTryExit);",
         "$('farmWorldExit').addEventListener('click',farmWorldTryExit);\n$('farmWorldBagBtn').addEventListener('click',e=>{e.stopPropagation();farmWorldClearInput();ssBagCategory='living';ssBagSelection='';bagMenu();});",
         "farm bag button")
rep_once(""" if(plot?.plantedAt!==null&&plot){
  const duration=plot.crop==='legacy'?90:(LIVING_CROPS[plot.crop]?.seconds||90),ratio=Math.min(1,(game.livingP0.clock-plot.plantedAt)/duration);
  const colors=plot.crop==='wheat'?['#6a9c54','#8ebc65','#d8b95d']:plot.crop==='carrot'?['#6ab45b','#6aa94a','#f4a456']:['#55a35e','#80b267','#b8d48b'];
  for(let r=0;r<3;r++)for(let col=0;col<3;col++){
   let xx=px+19+col*29,yy=py+22+r*25;const hgt=10+Math.round(15*ratio);
   c.fillStyle=colors[ratio>.92?2:ratio>.48?1:0];c.fillRect(xx-4,yy-hgt,9,hgt);c.fillStyle='#e7d88c';if(ratio>.8)c.fillRect(xx-2,yy-hgt-5,6,5);
  }
  if(plot.watered){c.fillStyle='#a5e2ed';for(let i=0;i<5;i++)c.fillRect(px+9+i*17,py+h-8,4,3);}
 }""",
         """ if(plot?.plantedAt!==null&&plot){
  const stage=Math.max(1,Math.min(3,plot.stage||1));
  if(plot.watered){c.fillStyle='#5f4635';for(let r=0;r<3;r++)for(let col=0;col<3;col++)c.fillRect(px+4+col*(w-8)/3,py+4+r*(h-8)/3,(w-13)/3,(h-13)/3);}
  const img=plot.crop==='legacy'?null:fcbImg(`crop_${plot.crop}_s${stage}`);
  const colors=plot.crop==='wheat'?['#6a9c54','#8ebc65','#d8b95d']:plot.crop==='carrot'?['#6ab45b','#6aa94a','#f4a456']:['#55a35e','#80b267','#b8d48b'];
  for(let r=0;r<3;r++)for(let col=0;col<3;col++){
   const cx=px+4+col*(w-8)/3+(w-13)/6,by=py+4+r*(h-8)/3+(h-13)/3;
   if(img)c.drawImage(img,Math.round(cx-13.5),Math.round(by-25),27,27);
   else{const hgt=6+stage*6;c.fillStyle=colors[stage-1];c.fillRect(Math.round(cx-4),Math.round(by-hgt),9,hgt);}
  }
  if(plot.watered){c.fillStyle='#a5e2ed';for(let i=0;i<5;i++)c.fillRect(px+9+i*17,py+h-8,4,3);}
 }""",
         "farm plot sprites")
rep_once(" c.fillStyle='#193e31de';c.fillRect(px+10,py-27,w-20,21);c.fillStyle='#fff4ce';c.font='bold 12px system-ui';c.textAlign='center';c.fillText('밭 '+o.id.split(':')[1],px+w/2,py-12);",
         " {const num=o.id.split(':')[1],lab=plot&&plot.plantedAt!==null?`밭 ${num} · ${plot.crop==='legacy'?'채소':LIVING_CROPS[plot.crop].name} ${plot.stage}/3${plot.stage>=3?' 수확':plot.watered?' 💧':' 마름'}`:'밭 '+num;\n  c.font='bold 12px system-ui';const tw=Math.max(w-20,c.measureText(lab).width+16);c.fillStyle='#193e31de';c.fillRect(px+w/2-tw/2,py-27,tw,21);c.fillStyle='#fff4ce';c.textAlign='center';c.fillText(lab,px+w/2,py-12);}",
         "farm plot label")

# ------------------------------------------------------------------ bag: living tab + eat
rep_once("""  items.push({key:'artifact:'+id,id,category:'artifact',name:info.name,count:1,icon:`<span class="ss-item-symbol" aria-hidden="true">${info.icon}</span>`,details:info.tag});
 }
 return items;""",
         """  items.push({key:'artifact:'+id,id,category:'artifact',name:info.name,count:1,icon:`<span class="ss-item-symbol" aria-hidden="true">${info.icon}</span>`,details:info.tag});
 }
 const lv=game.livingP0;
 if(lv?.bag)for(const id of ['bread','soup','stew','wheat','potato','carrot','crop','river_fish','perch','carp','seed_wheat','seed_potato','seed_carrot','seed']){
  const qty=livingInt(lv.bag[id]);if(!qty)continue;const recipe=LIVING_RECIPES[id];
  const icon=FCB_ITEM_SPRITE[id]?`<span class="ss-item-symbol fcb-item-art">${fcbIconHtml(FCB_ITEM_SPRITE[id],'')}</span>`:'<span class="ss-item-symbol" aria-hidden="true">🌱</span>';
  items.push({key:'living:'+id,id,category:'living',name:LIVING_ITEM_NAMES[id]||id,count:qty,icon,details:recipe?`보유 ${qty}개 · 먹으면 기력 +${recipe.energy} · 3분 생활 보너스 (현재 기력 ${Math.floor(lv.energy)}/${LIVING_ENERGY.max})`:`보유 ${qty}개 · ${id.startsWith('seed')?'농장 씨앗':'요리 재료'}`});
 }
 return items;""",
         "bag entries: living items")
rep_once("const belongs=group==='bag'?item.category==='tool'||item.category==='artifact':",
         "const belongs=group==='bag'?item.category==='tool'||item.category==='artifact'||item.category==='living':",
         "bag group: living")
rep_once("const tabs=isBag?[['all','전체'],['tool','도구'],['artifact','유물']]:",
         "const tabs=isBag?[['all','전체'],['tool','도구'],['artifact','유물'],['living','생활']]:",
         "bag tab: living")
rep_once("const labels={tool:'도구',artifact:'유물',ore:'광물',gem:'보석',material:'재료'};",
         "const labels={tool:'도구',artifact:'유물',ore:'광물',gem:'보석',material:'재료',living:'생활 · 농작물·요리'};",
         "bag label: living")
rep_once("${selected?.category==='tool'?(game.tool===selected.id?'사용 중':'도구 장착'):'유물 장착 관리'}",
         "${selected?.category==='tool'?(game.tool===selected.id?'사용 중':'도구 장착'):selected?.category==='living'?(LIVING_RECIPES[selected.id]?'먹기':'요리 재료'):'유물 장착 관리'}",
         "bag action label")
rep_once("  $('ssBagEquip').disabled=!selected||(selected.category==='tool'&&game.tool===selected.id);",
         "  $('ssBagEquip').disabled=!selected||(selected.category==='tool'&&game.tool===selected.id)||(selected.category==='living'&&!LIVING_RECIPES[selected.id]);",
         "bag action disabled")
rep_once("   if(selected.category==='artifact'){characterTab='artifacts';characterMenu();return;}",
         "   if(selected.category==='living'){if(LIVING_RECIPES[selected.id]){livingEatFood(selected.id);ssOpenItems('bag');}return;}\n   if(selected.category==='artifact'){characterTab='artifacts';characterMenu();return;}",
         "bag action: eat")

# ------------------------------------------------------------------ village kitchen counter (2.5D town)
rep_once(" {id:'forge',type:'service',x:9,z:-1.95,title:'작업 대장간',label:'⚒ 대장간 이용',hint:'곡괭이·장비 제작 · 기존 대장간 메뉴'},",
         " {id:'forge',type:'service',x:9,z:-1.95,title:'작업 대장간',label:'⚒ 대장간 이용',hint:'곡괭이·장비 제작 · 기존 대장간 메뉴'},\n {id:'kitchen',type:'service',x:-3.4,z:-6.0,title:'요리대',label:'🍳 요리대 이용',hint:'빵·당근 수프·생선 스튜 만들기'},",
         "town target: kitchen")
rep_once("t25Add('barrel-market','장터 앞 통',-7.9,.35,-2.3,.7,.7,.7,'#765d46');",
         "t25Add('barrel-market','장터 앞 통',-7.9,.35,-2.3,.7,.7,.7,'#765d46');\nt25Add('kitchen-counter','장터 요리대',-3.4,.45,-6.0,1.4,.9,.8,'#90674f');\nt25Add('kitchen-top','요리대 상판',-3.4,.93,-6.0,1.5,.08,.9,'#b5895e');\nt25Add('kitchen-pot','요리대 냄비',-3.75,1.15,-6.0,.5,.36,.5,'#487b76');\nt25Add('kitchen-board','요리대 도마',-3.0,1.0,-6.0,.45,.06,.4,'#e8cc80');",
         "town prop: kitchen counter")
rep_once("[16,-5,3.4,2.4],[0,8,1.8,0.32]];",
         "[16,-5,3.4,2.4],[0,8,1.8,0.32],[-3.4,-6.0,1.5,.9]];",
         "town collision: kitchen")
rep_once("const box=t.id==='market'?[-9,-5,3.2,3.5]:t.id==='forge'?[9,-5,2.4,2.4]:null;",
         "const box=t.id==='market'?[-9,-5,3.2,3.5]:t.id==='forge'?[9,-5,2.4,2.4]:t.id==='kitchen'?[-3.4,-6.0,1.5,.9]:null;",
         "town edge distance: kitchen")
rep_once(" if(target.id==='market'){market();return true;}",
         " if(target.id==='kitchen'){fcbKitchenMenu();return true;}\n if(target.id==='market'){market();return true;}",
         "town interact: kitchen")

FCB_KITCHEN = r"""
// ---- farm+cooking B: village kitchen counter (cooking only here, never inside the farm) ----
function fcbKitchenTarget(){return T25_TARGETS.find(t=>t.id==='kitchen');}
function fcbKitchenNear(){return town25dActive&&t25Distance(fcbKitchenTarget())<=2.65;}
function livingEatFood(id){
 const r=livingAction('food.eat','self',id);
 if(farmWorldActive){farmWorldToast(r.ok?r.message:r.reason);farmWorldRefreshHud();}
 if(town25dActive)t25Notify(r.ok?r.message:r.reason);
 return r;
}
function fcbKitchenMenu(){
 if(!game)return false;
 const w=game.livingP0=normalizeLivingP0(game.livingP0),near=fcbKitchenNear();
 const rows=Object.entries(LIVING_RECIPES).map(([id,r])=>{
  const short=livingRecipeShortfall(w.bag,id);
  const needs=Object.entries(r.needs).map(([item,n])=>{const have=livingNeedHave(w.bag,item);const icon=item==='fish'?fcbIconHtml('river_fish',''):fcbIconHtml(FCB_ITEM_SPRITE[item],'');return `<span class="fcb-need ${have>=n?'ok':'lack'}">${icon}${LIVING_ITEM_NAMES[item]} ${have}/${n}</span>`;}).join('');
  const reason=!near?'요리대 가까이에서 만들 수 있어요':short.length?'재료 부족 · '+livingShortfallText(short):'';
  return `<div class="fcb-recipe" data-fcb-recipe="${id}"><div class="fcb-dish">${fcbIconHtml(id,r.name)}</div><div class="fcb-body"><strong>${r.name}</strong><div class="fcb-needs">${needs}</div><small class="fcb-reason" data-fcb-reason="${id}" ${reason?'':'hidden'}>${reason}</small><small class="fcb-own">보유 ${w.bag[id]}개 · 먹으면 기력 +${r.energy}</small></div><div class="fcb-btns"><button type="button" data-fcb-cook="${id}" ${reason?'disabled':''}>요리하기</button><button type="button" data-fcb-eat="${id}" ${w.bag[id]<1?'disabled':''}>먹기</button></div></div>`;
 }).join('');
 showModal('🍳 바람장터 요리대',`<div class="fcb-kitchen"><div id="fcbScene" class="fcb-scene" aria-hidden="true"></div><p class="fcb-energy">⚡ 기력 ${Math.floor(w.energy)}/${LIVING_ENERGY.max} · 🐟 물고기 ${livingFishCount(w.bag)}마리 (피라미 ${w.bag.river_fish} · 강농어 ${w.bag.perch} · 비단잉어 ${w.bag.carp})</p>${rows}<small class="fcb-tally">요리 ${w.stats.cooked}회 · 빵 ${w.counts.cooked.bread} · 수프 ${w.counts.cooked.soup} · 스튜 ${w.counts.cooked.stew}</small></div>`);
 $('dialog').classList.add('fcb-kitchen-modal');
 $('dialog').querySelectorAll('[data-fcb-cook]').forEach(b=>b.onclick=()=>fcbCook(b.dataset.fcbCook));
 $('dialog').querySelectorAll('[data-fcb-eat]').forEach(b=>b.onclick=()=>{livingEatFood(b.dataset.fcbEat);fcbKitchenMenu();});
 return true;
}
function fcbCook(id){
 if(!game)return {ok:false,reason:'no game'};
 if(!fcbKitchenNear()){flash('요리대 가까이에서 만들 수 있어요');playSound('ui_error');return {ok:false,reason:'요리대 가까이에서 만들 수 있어요'};}
 const cmd={id:'kitchen-'+Date.now()+'-'+(++livingActionSeq),type:'cook.make',target:'kitchen',item:id};
 // Proximity is validated in town coordinates above; the P1.1 engine keeps its canonical kitchen x.
 const r=applyLivingCommandPure(game.livingP0,cmd,{x:livingTargetX('kitchen'),y:0,groundY:0,inv:game.inv,coins:game.coins,seed:game.seed});
 if(!r.ok){flash(r.reason);playSound('ui_error');if(menuType==='🍳 바람장터 요리대')fcbKitchenMenu();return r;}
 const oldState=game.livingP0,oldInv=game.inv,oldCoins=game.coins;
 game.livingP0=r.state;game.inv=r.inv;game.coins=r.coins;
 if(!saveGame(true)){game.livingP0=oldState;game.inv=oldInv;game.coins=oldCoins;flash('저장에 실패해 요리를 취소했어요');return {ok:false,reason:'save failed'};}
 updHud();flash(r.message);t25Notify(r.message);
 if(menuType==='🍳 바람장터 요리대')fcbKitchenMenu();
 return r;
}
window.__sandstarFarmCooking=Object.freeze({version:'farm-cooking-b-20261123',
 state:()=>{const w=game?.livingP0;return w?JSON.parse(JSON.stringify({energy:w.energy,clock:w.clock,plots:w.plots,bag:w.bag,counts:w.counts,stats:w.stats,foodBuff:w.foodBuff})):null},
 recipes:()=>JSON.parse(JSON.stringify(LIVING_RECIPES)),energy:()=>({...LIVING_ENERGY}),
 stageSeconds:()=>Object.fromEntries(Object.entries(LIVING_CROPS).map(([k,v])=>[k,v.stageSeconds])),
 kitchen:()=>{const t=fcbKitchenTarget();return {x:t.x,z:t.z,near:fcbKitchenNear()}},
 openKitchen:()=>fcbKitchenMenu(),cook:id=>fcbCook(id),eat:id=>livingEatFood(id),
 sprites:()=>Object.keys(FCB_SPRITE_SRC),spriteReady:id=>!!fcbImg(id),
 // Local preview / QA only: skip world time. Not exposed on the production host.
 ...(location.hostname!=='sandstar.aldol.app'?{advance:sec=>{if(!Number.isFinite(sec)||sec<0||sec>3600)return false;livingWorldTick(sec);if(farmWorldActive)farmWorldRefreshHud();return true;}}:{})
});
"""
rep_once("function t25Interact(){", FCB_KITCHEN + "function t25Interact(){", "kitchen functions")

# ------------------------------------------------------------------ styles
FCB_CSS = """<style id="fcb-style">
.fcb-pixel{image-rendering:pixelated;width:27px;height:27px;vertical-align:middle;flex:none}
.fcb-item-art .fcb-pixel{width:54px;height:54px}
.ss-item-detail .fcb-item-art .fcb-pixel,.ss-detail-art .fcb-pixel{width:40px;height:40px}
.fcb-farm-bag{pointer-events:auto;margin-top:2px;border:1px solid #f1dfa1aa;border-radius:9px;background:#1d4a40e6;color:#fff4ce;font:800 11px system-ui;padding:4px 9px;cursor:pointer}
#farmWorldEnergy{white-space:normal}
.fcb-kitchen{display:flex;flex-direction:column;gap:8px;min-width:0}
.fcb-scene{display:none}
.fcb-energy{margin:0;font-size:12px;font-weight:700}
.fcb-recipe{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid #9ac6a655;border-radius:10px;background:#0f2d2a99}
.fcb-dish{display:flex;align-items:center;justify-content:center}
.fcb-dish .fcb-pixel{width:36px;height:36px}
.fcb-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.fcb-needs{display:flex;flex-wrap:wrap;gap:4px}
.fcb-need{display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:700;padding:1px 6px 1px 2px;border-radius:8px;background:#ffffff14}
.fcb-need .fcb-pixel{width:20px;height:20px}
.fcb-need.lack{color:#ffb4a0;background:#7a2b2244}
.fcb-need.ok{color:#c8f3c0}
.fcb-reason{color:#ffcf9c;font-weight:700}
.fcb-btns{display:flex;flex-direction:column;gap:5px}
.fcb-btns button{min-width:72px;min-height:34px;white-space:nowrap}
.fcb-tally{opacity:.85}
@media (max-width:420px){.fcb-recipe{grid-template-columns:34px minmax(0,1fr);}.fcb-btns{grid-column:1 / -1;flex-direction:row}.fcb-btns button{flex:1}.fcb-dish .fcb-pixel{width:30px;height:30px}}
</style>
</head>"""
rep_once("</head>", FCB_CSS, "styles")

# ------------------------------------------------------------------ Gate 4: kitchen scene (2.5D stills + lazy 3D GLB)
# 2.5D: 3/4-view stills rendered from the optimized GLBs (assets/fcb-renders, render-stills.cjs) and the P5
# fish sprite, always shown. 3D: v38 already inlines three r160 + GLTFLoader (window.THREE/GLTFLoader, used by
# the ruins); the kitchen reuses that library with its own small renderer, created only while the kitchen
# modal is open, fed by GLBs fetched on demand from the Worker (/fcb/glb/*, add-worker-assets.py), and
# disposed on close. Any failure, mobile/coarse pointer, narrow screen, reduced motion or low-end device
# stays on the 2.5D stills; cooking never depends on the scene.
GLB_DIR = HERE.parent.parent / "assets" / "glb"
RENDERS = HERE.parent.parent / "assets" / "fcb-renders"
glb_sums = dict(reversed(l.split()) for l in (GLB_DIR / "SHA256SUMS.txt").read_text().splitlines() if l.strip())
glb_manifest = {}
for key, stem in [("wheat", "wheat-crop-c073"), ("potato", "potato-crop-c047"), ("carrot", "carrot-crop-carrot")]:
    data = (GLB_DIR / f"{stem}.glb").read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    assert sha == glb_sums[f"{stem}.glb"], f"glb sha {stem}"
    glb_manifest[key] = {"url": f"/fcb/glb/{stem}-{sha[:8]}.glb", "sha256": sha, "bytes": len(data), "source": f"{stem}.glb"}
stills = {k: "data:image/png;base64," + base64.b64encode((RENDERS / f"{k}-3q.png").read_bytes()).decode() for k in ("wheat", "potato", "carrot")}

FCB_SCENE = r"""
// ---- farm+cooking B Gate 4: kitchen scene — 2.5D stills always, lazy 3D GLB highlight on capable desktops ----
const FCB_GLB_MANIFEST=Object.freeze(__GLB_MANIFEST__);
const FCB_STILL_SRC=Object.freeze(__STILLS__);
const FCB_SCENE_ITEMS=Object.freeze([{id:'wheat',name:'밀',glb:true},{id:'potato',name:'감자',glb:true},{id:'carrot',name:'당근',glb:true},{id:'fish',name:'물고기',glb:false}]);
const FCB_RECIPE_FOCUS=Object.freeze({bread:'wheat',soup:'carrot',stew:'potato'});
const FCB_KITCHEN_TITLE='🍳 바람장터 요리대';
const fcbScene={el:null,mode:'off',reason:'',focus:'wheat',want:'auto',three:null,loads:0,frames:0,teardowns:0,lastTeardown:'',fetched:[]};
function fcbSceneStill(id){return id==='fish'?FCB_SPRITE_SRC.river_fish:FCB_STILL_SRC[id];}
function fcbScene3dBlocker(){
 if(fcbScene.want==='2.5d')return 'forced-2.5d';
 if(!window.THREE||!window.GLTFLoader)return 'no-three';
 if(fcbScene.want==='3d')return '';
 try{if(matchMedia('(pointer:coarse)').matches)return 'mobile';}catch(_){}
 if(innerWidth<600)return 'narrow-screen';
 try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return 'reduced-motion';}catch(_){}
 if(navigator.deviceMemory&&navigator.deviceMemory<4)return 'low-memory';
 if(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<4)return 'low-cpu';
 return '';
}
function fcbSceneBuild(){
 const el=document.createElement('div');el.className='fcb-stage';el.dataset.mode='2.5d';
 el.innerHTML=`<div class="fcb-hero"><img class="fcb-hero-still" alt="" width="112" height="112"><span class="fcb-hero-tag"></span></div><div class="fcb-side"><div class="fcb-shelf" role="group" aria-label="재료 미리보기">${FCB_SCENE_ITEMS.map(it=>`<button type="button" class="fcb-shelf-item" data-fcb-focus="${it.id}" aria-label="${it.name} 보기"><img class="${it.glb?'':'fcb-sprite'}" src="${fcbSceneStill(it.id)}" alt="" width="40" height="40"><span>${it.name}</span></button>`).join('')}</div><small class="fcb-mode-note"></small></div>`;
 el.querySelectorAll('[data-fcb-focus]').forEach(b=>b.addEventListener('click',()=>fcbSceneFocus(b.dataset.fcbFocus)));
 return el;
}
function fcbSceneSync(){
 const el=fcbScene.el;if(!el)return;
 const it=FCB_SCENE_ITEMS.find(x=>x.id===fcbScene.focus)||FCB_SCENE_ITEMS[0];
 const show3d=fcbScene.mode==='3d'&&it.glb&&!!fcbScene.three;
 el.dataset.mode=fcbScene.mode;el.dataset.focus=it.id;
 const still=el.querySelector('.fcb-hero-still');still.src=fcbSceneStill(it.id);still.hidden=show3d;still.classList.toggle('fcb-sprite',!it.glb);
 if(fcbScene.three)fcbScene.three.canvas.hidden=!show3d;
 el.querySelector('.fcb-hero-tag').textContent=`${it.name} · ${show3d?'3D':it.glb?'2.5D':'2D'}`;
 el.querySelectorAll('[data-fcb-focus]').forEach(b=>b.classList.toggle('selected',b.dataset.fcbFocus===it.id));
 el.querySelector('.fcb-mode-note').textContent=fcbScene.mode==='3d'?(it.glb?'3D 미리보기 · 끌어서 돌려 보세요':'물고기는 2D 그림으로 보여줘요'):fcbScene.mode==='loading'?'3D 모델 불러오는 중… 그동안 2.5D로 보여줘요':it.glb?'2.5D 렌더 미리보기':'물고기는 2D 그림으로 보여줘요';
}
function fcbSceneFocus(id){if(!FCB_SCENE_ITEMS.some(x=>x.id===id))return false;fcbScene.focus=id;if(fcbScene.three)fcbScene.three.zoomT=0;fcbSceneSync();return true;}
function fcbSceneTeardown(why){
 fcbScene.loads++;
 const th=fcbScene.three;fcbScene.three=null;
 if(th){
  cancelAnimationFrame(th.raf);th.canvas.remove();
  th.scene.traverse(o=>{if(!o.isMesh)return;o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'])m[k]?.dispose?.();m.dispose();}});
  th.renderer.dispose();th.renderer.forceContextLoss();
 }
 if(fcbScene.mode!=='off'){fcbScene.teardowns++;fcbScene.lastTeardown=why;}
 fcbScene.mode='off';fcbScene.reason='';
}
function fcbSceneMount(host,wasOpen){
 if(!host)return;
 if(!fcbScene.el)fcbScene.el=fcbSceneBuild();
 if(!wasOpen)fcbSceneTeardown('reopen');
 host.appendChild(fcbScene.el);
 if(fcbScene.mode==='off'){
  const blocker=fcbScene3dBlocker();
  if(blocker){fcbScene.mode='2.5d';fcbScene.reason=blocker;}
  else void fcbScene3dStart();
 }
 fcbSceneSync();
}
async function fcbScene3dStart(){
 const token=++fcbScene.loads;fcbScene.mode='loading';fcbScene.reason='';fcbSceneSync();
 try{
  const T=window.THREE;
  const canvas=document.createElement('canvas');canvas.className='fcb-hero-3d';canvas.hidden=true;
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(112,112,false);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.1,50),pivot=new T.Group();
  scene.add(new T.HemisphereLight(0xfff4dc,0x2a3a34,1.1));const sun=new T.DirectionalLight(0xffe7c2,1.8);sun.position.set(3,5,4);scene.add(sun);scene.add(pivot);
  const el=30*Math.PI/180;camera.position.set(0,Math.sin(el)*3.6,Math.cos(el)*3.6);camera.lookAt(0,0,0);
  const th={T,renderer,canvas,scene,camera,pivot,models:{},yaw:Math.PI/4,drag:null,zoomT:0,raf:0,last:0};
  fcbScene.three=th;
  const loader=new window.GLTFLoader();
  for(const [id,m] of Object.entries(FCB_GLB_MANIFEST)){
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);let buf;
   try{const res=await fetch(m.url,{signal:ctl.signal});if(!res.ok)throw new Error('http '+res.status+' '+id);buf=await res.arrayBuffer();}finally{clearTimeout(timer);}
   if(token!==fcbScene.loads)return;
   if(buf.byteLength!==m.bytes)throw new Error('size '+id);
   if(crypto?.subtle){const dig=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))].map(b=>b.toString(16).padStart(2,'0')).join('');if(dig!==m.sha256)throw new Error('sha '+id);}
   const gltf=await new Promise((ok,no)=>loader.parse(buf,'',ok,no));
   if(token!==fcbScene.loads){gltf.scene.traverse(o=>{if(o.isMesh){o.geometry?.dispose();}});return;}
   const model=gltf.scene,box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3()),s=1.6/Math.max(size.x,size.y,size.z);
   model.scale.setScalar(s);model.position.set(-c.x*s,-c.y*s,-c.z*s);
   const holder=new T.Group();holder.add(model);holder.visible=false;pivot.add(holder);th.models[id]=holder;fcbScene.fetched.push(id);
  }
  if(token!==fcbScene.loads)return;
  const hero=fcbScene.el?.querySelector('.fcb-hero');if(!hero)throw new Error('scene detached');
  hero.insertBefore(canvas,hero.querySelector('.fcb-hero-tag'));
  canvas.addEventListener('pointerdown',e=>{th.drag={x:e.clientX,yaw:th.yaw};canvas.setPointerCapture?.(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(th.drag)th.yaw=th.drag.yaw+(e.clientX-th.drag.x)*0.012;});
  for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,()=>{th.drag=null;});
  fcbScene.mode='3d';fcbSceneSync();
  th.raf=requestAnimationFrame(fcbScene3dFrame);
 }catch(err){
  if(token!==fcbScene.loads)return;
  fcbSceneTeardown('glb-failed');
  fcbScene.mode='2.5d';fcbScene.reason='glb-failed: '+(err&&err.message||err);
  console.info('kitchen 3D unavailable, 2.5D fallback:',fcbScene.reason);
  fcbSceneSync();
 }
}
function fcbScene3dRender(th){
 for(const [id,h] of Object.entries(th.models))h.visible=id===fcbScene.focus;
 const z=.55+.45*(1-Math.pow(1-th.zoomT,3));
 th.pivot.rotation.y=th.yaw;th.pivot.scale.setScalar(z);
 th.renderer.render(th.scene,th.camera);
}
function fcbScene3dFrame(now){
 const th=fcbScene.three;if(!th)return;
 const open=$('overlay').classList.contains('open')&&menuType===FCB_KITCHEN_TITLE&&!!fcbScene.el?.isConnected;
 if(!open){fcbSceneTeardown('left-kitchen');return;}
 const dt=th.last?Math.min(.05,(now-th.last)/1000):0;th.last=now;
 if(!th.drag)th.yaw+=dt*0.9;
 th.zoomT=Math.min(1,th.zoomT+dt*2.2);
 if(th.models[fcbScene.focus]){fcbScene3dRender(th);fcbScene.frames++;}
 th.raf=requestAnimationFrame(fcbScene3dFrame);
}
function fcbSceneProbe(){
 const th=fcbScene.three;if(!th)return null;
 fcbScene3dRender(th);
 const gl=th.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,d=new Uint8Array(w*h*4);
 gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,d);
 let opaque=0,hsh=2166136261;for(let i=3;i<d.length;i+=4){if(d[i]>0)opaque++;}
 for(let i=0;i<d.length;i+=16){hsh^=d[i];hsh=Math.imul(hsh,16777619)>>>0;}
 return {w,h,opaque,hash:hsh.toString(16),yaw:th.yaw,focus:fcbScene.focus,contextLost:gl.isContextLost()};
}
""".replace("__GLB_MANIFEST__", json.dumps(glb_manifest, separators=(",", ":"))).replace("__STILLS__", json.dumps(stills, separators=(",", ":")))

rep_once("function fcbKitchenMenu(){", FCB_SCENE + "function fcbKitchenMenu(){", "scene functions")
rep_once(" const w=game.livingP0=normalizeLivingP0(game.livingP0),near=fcbKitchenNear();",
         " const w=game.livingP0=normalizeLivingP0(game.livingP0),near=fcbKitchenNear(),sceneWasOpen=!!(fcbScene.el&&fcbScene.el.isConnected&&menuType===FCB_KITCHEN_TITLE&&$('overlay').classList.contains('open'));",
         "kitchen: scene state before re-render")
rep_once(" $('dialog').classList.add('fcb-kitchen-modal');",
         " $('dialog').classList.add('fcb-kitchen-modal');\n fcbSceneMount($('fcbScene'),sceneWasOpen);",
         "kitchen: mount scene")
rep_once(" updHud();flash(r.message);t25Notify(r.message);",
         " updHud();flash(r.message);t25Notify(r.message);\n if(FCB_RECIPE_FOCUS[id])fcbScene.focus=FCB_RECIPE_FOCUS[id];if(fcbScene.three)fcbScene.three.zoomT=0;",
         "cook: highlight main ingredient")
rep_once("function closeModal(){$('overlay').classList.remove('open');",
         "function closeModal(){try{if(fcbScene.mode!=='off')fcbSceneTeardown('closed');}catch(_){}$('overlay').classList.remove('open');",
         "closeModal: dispose kitchen scene")
rep_once(" sprites:()=>Object.keys(FCB_SPRITE_SRC),spriteReady:id=>!!fcbImg(id),",
         " sprites:()=>Object.keys(FCB_SPRITE_SRC),spriteReady:id=>!!fcbImg(id),\n scene:()=>({mode:fcbScene.mode,reason:fcbScene.reason,focus:fcbScene.focus,frames:fcbScene.frames,teardowns:fcbScene.teardowns,lastTeardown:fcbScene.lastTeardown,fetched:[...fcbScene.fetched],has3d:!!fcbScene.three,models:Object.keys(fcbScene.three?.models||{}),manifest:JSON.parse(JSON.stringify(FCB_GLB_MANIFEST))}),\n sceneFocus:id=>fcbSceneFocus(id),sceneProbe:()=>fcbSceneProbe(),",
         "QA hook: scene state")
rep_once(" ...(location.hostname!=='sandstar.aldol.app'?{advance:",
         " ...(location.hostname!=='sandstar.aldol.app'?{setSceneMode:m=>{if(!['auto','2.5d','3d'].includes(m))return false;fcbScene.want=m;return true;},advance:",
         "QA hook: scene mode override (non-prod)")
rep_once(".fcb-scene{display:none}",
         """.fcb-scene{display:block}
.fcb-stage{position:relative;display:flex;gap:10px;align-items:stretch;padding:8px 8px 14px;border-radius:12px;background:linear-gradient(#2f5a52,#1d3d37);border:1px solid #9ac6a655;overflow:hidden}
.fcb-stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:9px;background:repeating-linear-gradient(90deg,#90674f 0 22px,#b5895e 22px 24px)}
.fcb-stage [hidden]{display:none!important}
.fcb-hero{position:relative;flex:none;width:112px;height:112px;border-radius:10px;background:radial-gradient(circle at 50% 62%,#fff4ce40,transparent 70%)}
.fcb-hero-still,.fcb-hero-3d{display:block;width:112px;height:112px;object-fit:contain;touch-action:none}
.fcb-hero-still.fcb-sprite{image-rendering:pixelated;padding:18px;box-sizing:border-box}
.fcb-hero-tag{position:absolute;left:4px;bottom:4px;font-size:10px;font-weight:800;background:#0f2d2acc;border-radius:6px;padding:1px 6px}
.fcb-side{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;justify-content:space-between}
.fcb-shelf{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
.fcb-shelf-item{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;padding:3px 2px;border-radius:8px;border:1px solid #ffffff22;background:#0f2d2a99;color:inherit;font:700 10px system-ui;cursor:pointer}
.fcb-shelf-item img{width:40px;height:40px;object-fit:contain}
.fcb-shelf-item img.fcb-sprite{image-rendering:pixelated;padding:6px;box-sizing:border-box}
.fcb-shelf-item.selected{border-color:#e8cc80;background:#e8cc8026}
.fcb-mode-note{opacity:.85}
.fcb-kitchen .fcb-stage .fcb-shelf-item{min-width:0;min-height:0;margin:0;padding:3px 2px;font:700 10px/1.2 system-ui;white-space:nowrap;letter-spacing:0}
@media (max-width:420px){.fcb-hero,.fcb-hero-still,.fcb-hero-3d{width:88px;height:88px}.fcb-shelf-item img{width:32px;height:32px}.fcb-kitchen .fcb-stage .fcb-shelf-item{font-size:9px;padding:2px 1px}}""",
         "scene styles")

DST.write_text(html, encoding="utf-8")
print("fcb html bytes:", len(html.encode()), "sha256:", hashlib.sha256(html.encode()).hexdigest(),
      "delta:", len(html.encode()) - len(SRC.read_text(encoding='utf-8').encode()))
