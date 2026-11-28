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
