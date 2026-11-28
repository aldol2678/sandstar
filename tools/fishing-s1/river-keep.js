// 남길 수량 + 판매·요리 미리보기 (v0.4 4절 '요리·농사·판매', 제작 순서 B).
// - 바람장터 '생활 물품' 탭: v44 town has no working sale for fish/crops/dishes (the old living-menu
//   buttons check the side-scroll X23). Each row previews count and coins before selling and never
//   sells kept fish.
// - 요리대: pick which fish the stew uses; the preview names what will be consumed and what stays.
// - 남길 수량 steppers: market tab, kitchen, fishing result card, living-menu fish tab.
// All writes go through applyLivingCommandPure (fish.keep / market.sell / cook.make) with save rollback.
let ssFishCookPick='';
function livingVenueCommand(type,target,item,extra={}){
 const cmd={id:'venue-'+type.replace('.','-')+'-'+Date.now()+'-'+(++livingActionSeq),type,target,item,...extra};
 const x=target==='self'?0:livingTargetX(target);if(x===null)return {ok:false,reason:'이용 장소를 확인해 주세요'};
 // proximity is checked by the venue that calls this (market door / kitchen / fishing spot)
 const r=applyLivingCommandPure(game.livingP0,cmd,{x,y:0,groundY:0,inv:game.inv,coins:game.coins,seed:game.seed});
 if(!r.ok)return r;
 const old=[game.livingP0,game.inv,game.coins];
 game.livingP0=r.state;game.inv=r.inv;game.coins=r.coins;
 if(!saveGame(true)){[game.livingP0,game.inv,game.coins]=old;return {ok:false,reason:'저장에 실패해 취소했어요. 저장 공간을 확인해 주세요'};}
 updHud();return r;
}
function ssFishKeepSet(id,count){
 const w=game.livingP0;if(!livingOwn(LIVING_FISH,id))return {ok:false};
 const n=Math.max(0,Math.min(RIVER_KEEP_MAX,count|0));if(n===livingFishKeep(w,id))return {ok:true,same:true};
 const r=livingVenueCommand('fish.keep','self',id,{count:n});flash(r.ok?r.message:r.reason);return r;
}
function ssFishKeepStepper(id){
 const w=game.livingP0,k=livingFishKeep(w,id);
 return `<span class="keep-step" role="group" aria-label="${LIVING_FISH[id].name} 남길 수량"><button type="button" data-lkeep="${id}" data-d="-1" ${k<1?'disabled':''} aria-label="남김 줄이기">−</button><b>남김 ${k}</b><button type="button" data-lkeep="${id}" data-d="1" ${k>=RIVER_KEEP_MAX?'disabled':''} aria-label="남김 늘리기">+</button></span>`;
}
function ssFishKeepWire(root,after){
 (root||document).querySelectorAll('[data-lkeep]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();
  const id=b.dataset.lkeep,k=livingFishKeep(game.livingP0,id);ssFishKeepSet(id,k+Number(b.dataset.d));if(after)after();});
}
// ---- 바람장터 · 생활 물품
function ssLivingPrices(){return {crop:7,...Object.fromEntries(Object.entries(LIVING_CROPS).map(([k,v])=>[k,v.price])),...Object.fromEntries(Object.entries(LIVING_FISH).map(([k,v])=>[k,v.price])),...Object.fromEntries(Object.entries(LIVING_RECIPES).map(([k,v])=>[k,v.price]))};}
function ssLivingMarketMarkup(){
 const w=game.livingP0=normalizeLivingP0(game.livingP0),prices=ssLivingPrices();
 const order=[...LIVING_FISH_ORDER,'stew','soup','bread','wheat','potato','carrot','crop'];
 let totalN=0,totalC=0,keptN=0;
 const rows=order.filter(id=>livingInt(w.bag[id])>0||(livingOwn(LIVING_FISH,id)&&livingFishKeep(w,id)>0)).map(id=>{
  const fish=livingOwn(LIVING_FISH,id),have=livingInt(w.bag[id]),keep=fish?livingFishKeep(w,id):0,free=fish?livingFishFree(w,id):have,p=prices[id];
  totalN+=free;totalC+=free*p;keptN+=Math.min(keep,have);
  const name=LIVING_ITEM_NAMES[id]||id,icon=FCB_ITEM_SPRITE[id]?fcbIconHtml(FCB_ITEM_SPRITE[id],''):'';
  const sell=(n,label)=>`<button type="button" data-lsell="${id}" data-n="${n}" ${free<n||n<1?'disabled':''}>${label}</button>`;
  return `<div class="line market-item living-sell" data-lrow="${id}"><div class="market-meta"><strong>${icon}${name} ${have}개</strong><small>개당 ${p}C${fish?` · 남김 ${keep} · 판매 가능 ${free}`:''}</small>${fish?ssFishKeepStepper(id):''}</div>`+
   `<div class="market-actions" role="group" aria-label="${name} 판매">${sell(1,`1개 판매 +${p}C`)}${free>1?sell(free,`${fish&&keep?'남김 빼고 ':''}${free}개 판매 +${free*p}C`):''}</div></div>`;
 }).join('');
 const summary=rows?`<section class="market-summary"><strong>${totalN?`판매 가능 ${totalN}개 · ${totalC}C`:'지금 팔 수 있는 생활 물품이 없어요.'}</strong>${keptN?`<p>남겨 둔 물고기 ${keptN}마리는 팔지 않아요. 요리·납품에도 쓰지 않아요.</p>`:''}<p class="living-sell-note">낚은 물고기·작물·요리는 여기서 팔아요. 버튼에 팔 개수와 받을 코인이 적혀 있어요.</p></section>`:
  '<section class="market-summary"><strong>팔 생활 물품이 없어요.</strong><p>낚시터·농장·요리대에서 얻은 물품을 여기서 팔 수 있어요.</p></section>';
 return summary+rows;
}
function ssLivingMarketWire(){
 document.querySelectorAll('[data-lsell]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.lsell,n=Number(b.dataset.n)||1;
  const r=livingVenueCommand('market.sell','market',id,n>1?{count:n}:{});
  if(r.ok){try{playSound('coin_sell');}catch(_){}flash(r.message);}else{flash(r.reason);try{playSound('ui_error');}catch(_){}}
  market();
 });
 ssFishKeepWire(document.getElementById('dialog'),()=>market());
}
// ---- 요리대: which fish the recipe uses, and what stays
function ssFishCookChoice(id){
 const r=LIVING_RECIPES[id];if(!r||!r.needs.fish)return undefined;
 const w=game.livingP0;if(ssFishCookPick&&livingFishFree(w,ssFishCookPick)>0)return ssFishCookPick;
 return LIVING_FISH_ORDER.find(f=>livingFishFree(w,f)>0);
}
function ssFishKitchenDecorate(){
 const w=game.livingP0,dlg=document.getElementById('dialog');if(!dlg)return;
 const head=dlg.querySelector('.fcb-energy');
 const kept=LIVING_FISH_ORDER.filter(f=>livingFishKeep(w,f)>0).map(f=>`${LIVING_FISH[f].name} ${Math.min(livingFishKeep(w,f),w.bag[f])}`);
 if(head&&kept.length&&!head.querySelector('.keep-note'))head.insertAdjacentHTML('beforeend',`<span class="keep-note"> · 남김 ${kept.join(' · ')}</span>`);
 for(const [id,r] of Object.entries(LIVING_RECIPES)){
  if(!r.needs.fish)continue;
  const row=dlg.querySelector(`[data-fcb-recipe="${id}"]`);if(!row)continue;
  const pick=ssFishCookChoice(id),freeTotal=LIVING_FISH_ORDER.reduce((n,f)=>n+livingFishFree(w,f),0);
  const chips=LIVING_FISH_ORDER.map(f=>{const free=livingFishFree(w,f),keep=livingFishKeep(w,f);
   return `<button type="button" class="fish-pick ${f===pick?'on':''}" data-fish-pick="${f}" ${free<1?'disabled':''} aria-pressed="${f===pick}">${fcbIconHtml(f,'')}${LIVING_FISH[f].name} ${free}${keep?` <small>(남김 ${Math.min(keep,w.bag[f])})</small>`:''}</button>`;}).join('');
  const others=Object.entries(r.needs).filter(([k])=>k!=='fish').map(([k,n])=>`${LIVING_ITEM_NAMES[k]} ${n}`);
  const preview=pick?`쓰는 재료: ${[...others,`${LIVING_FISH[pick].name} ${r.needs.fish}`].join(' · ')}${kept.length?' · 남긴 물고기는 그대로':''}`:
   (livingFishCount(w.bag)>0?'남길 수량을 빼면 쓸 물고기가 없어요':'물고기가 없어요');
  const body=row.querySelector('.fcb-body')||row;
  body.insertAdjacentHTML('beforeend',`<div class="fish-picks" role="group" aria-label="${r.name}에 쓸 물고기">${chips}</div><small class="fish-preview" data-fish-preview="${id}">${preview}</small>`);
  const cookBtn=row.querySelector('[data-fcb-cook]');
  if(cookBtn&&freeTotal<r.needs.fish){cookBtn.disabled=true;
   // only reword the kitchen's own reason when fish exist but are kept back
   if(livingFishCount(w.bag)>=r.needs.fish){const why=row.querySelector('[data-fcb-reason]');if(why){why.hidden=false;why.textContent='남길 수량을 빼면 물고기가 부족해요';}}}
 }
 dlg.querySelectorAll('[data-fish-pick]').forEach(b=>b.onclick=e=>{e.preventDefault();ssFishCookPick=b.dataset.fishPick;fcbKitchenMenu();});
}
window.__sandstarFishKeep=Object.freeze({
 state:()=>{const w=game?.livingP0;return w?{keep:{...w.river.keep},free:Object.fromEntries(LIVING_FISH_ORDER.map(f=>[f,livingFishFree(w,f)])),bag:Object.fromEntries(LIVING_FISH_ORDER.map(f=>[f,w.bag[f]])),pick:ssFishCookPick}:null;}
});

// ---- QA 1차 (여울): 원목이 '가방'에 안 보이고, 새 세이브 안내가 광산만 가리켰다.
function ssBagWoodEntry(){
 const n=Math.max(0,Math.floor(Number(game.inv?.wood)||0));if(!n)return null;
 return {key:'living:wood',id:'wood',category:'living',categoryLabel:'생활 · 재료',name:'원목',count:n,icon:'<span class="ss-item-symbol" aria-hidden="true">🪵</span>',
  details:`보유 ${n}개 · 낚싯대 제작 3 · 목수 납품 6 · 집짓기 12 (인벤토리 '재료'의 원목과 같은 개수)`};
}
function ssFishTownTip(){
 const el=document.getElementById('t25FishTip');if(!el||!game?.livingP0)return;
 const w=game.livingP0,wood=Math.floor(Number(game.inv?.wood)||0),rec=w.river?.record,n=livingFishRecordCount(w);
 const questOpen=rec?.quest===1&&!livingRiverMarked(w),show=questOpen||(w.stats.fished===0&&!(w.river?.attempt));
 el.hidden=!show;if(!show)return;
 const t=questOpen?(n>=3?'선택 · 물고기 기록 3/3 · 여울에게 기록을 보여 주세요':`선택 · 여울의 물고기 기록 ${n}/3 · 어종마다 좋아하는 물 깊이가 달라요`):
  w.rod?'선택 · 낚시: 낚시터 입구로 가서 자리 A·B·C에서 낚시해요':wood>=3?'선택 · 낚시: 원목 3개가 있어요 · 낚시터 입구에서 낚싯대를 만들어요':'선택 · 낚시: 잔빛숲 나무를 베어 원목 3개를 모으면 낚싯대를 만들 수 있어요';
 const sp=el.querySelector('span');if(sp&&sp.textContent!==t)sp.textContent=t;
}

// ---- 여울 '물고기 기록' (선택 의뢰, 2026-11-28 알돌 확정 · 여울 안)
// 수락·진행·완료 대사는 06_흙별_NPC별_최종대사목록_M0 의 여울 7~9번 줄 그대로 (음성 yeoul-07~09).
const YEOUL_RECORD_LINES=Object.freeze({accept:{text:'강에서 물고기 3종만 기록해 줄래?',voice:7,tag:'퀘스트 수락'},progress:{text:'어종마다 좋아하는 물 깊이가 달라.',voice:8,tag:'퀘스트 진행'},done:{text:'이 기록이면 옛 물길을 찾을 수 있어!',voice:9,tag:'퀘스트 완료'}});
function ssYeoulRecordSay(kind){
 const L=YEOUL_RECORD_LINES[kind],line=document.getElementById('ssNpcLine'),prog=document.getElementById('ssNpcProg');
 if(line)line.textContent='“'+L.text+'”';if(prog)prog.textContent='물고기 기록 · '+L.tag;
 try{ssNpcPlayVoice('yeoul',L.voice);}catch(_){}
}
function ssYeoulRecordRender(){
 const dlg=document.getElementById('dialog');if(!dlg||!game?.livingP0)return;
 let box=document.getElementById('yeoulRecord');
 if(!box){const stack=dlg.querySelector('.stack');if(!stack)return;stack.insertAdjacentHTML('beforebegin','<section id="yeoulRecord" class="yeoul-record" aria-label="여울의 물고기 기록 의뢰"></section>');box=document.getElementById('yeoulRecord');}
 const w=game.livingP0,q=w.river.record.quest,done=livingRiverMarked(w),n=livingFishRecordCount(w);
 const dex=LIVING_FISH_ORDER.map(id=>`<span class="rec-fish ${w.fishDex.includes(id)?'on':''}">${w.fishDex.includes(id)?'✓':'·'} ${LIVING_FISH[id].name}</span>`).join('');
 let note,btn='';
 if(done){note='기록 완료 · 물살 관찰 표식이 도래 낚시터에 남아 있어요.';btn='<button type="button" class="ghost" data-yrec="done">완료 이야기 다시 듣기</button>';}
 else if(q!==1){note='선택 의뢰예요. 예전 도감도 인정하고, 물고기를 내지 않아요. 보상: 물살 관찰 표식.';btn='<button type="button" class="cta" data-yrec="accept">📜 의뢰 받기</button>';}
 else if(n<3){note='도감에 강 어종 3종이 모이면 여울에게 보여 주세요. 물고기는 쓰지 않아요.';btn='<button type="button" class="ghost" data-yrec="progress">진행 이야기 듣기</button>';}
 else{note='3종이 모두 기록됐어요. 물고기는 쓰지 않아요.';btn='<button type="button" class="cta" data-yrec="claim">📖 기록 보여 주기</button>';}
 box.innerHTML=`<strong>📜 물고기 기록 <small>${done?'완료':q===1?`기록 ${n}/3`:'선택 의뢰'}</small></strong><div class="rec-dex">${dex}</div><p>${note}</p>${btn}`;
 box.querySelectorAll('[data-yrec]').forEach(b=>b.onclick=e=>{e.preventDefault();ssYeoulRecordAct(b.dataset.yrec);});
}
function ssYeoulRecordAct(act){
 if(act==='progress'||act==='done'){ssYeoulRecordSay(act);return;}
 const r=livingVenueCommand(act==='accept'?'river.record.accept':'river.record.claim','self');
 if(!r.ok){flash(r.reason);try{playSound('ui_error');}catch(_){}ssYeoulRecordRender();return;}
 flash(r.message);
 if(act==='accept')ssYeoulRecordSay('accept');
 else{ssYeoulRecordSay('done');try{playSound('level_up');}catch(_){}}
 ssYeoulRecordRender();try{ssFishTownTip();}catch(_){}
}
window.__sandstarFishRecord=Object.freeze({
 state:()=>{const w=game?.livingP0;return w?{quest:w.river.record.quest,seen:w.river.record.seen,rewards:[...w.river.rewards],count:livingFishRecordCount(w),marked:livingRiverMarked(w),dex:[...w.fishDex]}:null;},
 lines:()=>JSON.parse(JSON.stringify(YEOUL_RECORD_LINES))
});
