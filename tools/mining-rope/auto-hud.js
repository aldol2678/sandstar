function updateRopeAutoMoveHud(){
 const ropeAutoMoveButton=$('ropeAutoMove');
 const show=!!rope.active&&rope.mode!=='swing'&&(rope.mode==='vertical'||rope.mode==='pull')&&!paused&&!ssM16TransitionLocked&&ssM15Scene==='mining'&&ssRegion==='mine';
 if(ropeAutoMoveButton.hidden===show)ropeAutoMoveButton.hidden=!show;
 if(!show)ropeAutoMoveEnabled=false;
 const active=show&&ropeAutoMoveEnabled;
 const pressed=active?'true':'false';
 if(ropeAutoMoveButton.getAttribute('aria-pressed')!==pressed){
  ropeAutoMoveButton.setAttribute('aria-pressed',pressed);
  ropeAutoMoveButton.querySelector('.rope-auto-symbol').textContent=active?'Ⅱ':'▶';
  ropeAutoMoveButton.querySelector('.rope-auto-label').textContent=active?'자동 중지':'자동 상승';
  ropeAutoMoveButton.setAttribute('aria-label',active?'로프 자동 상승 중지':'로프 자동 상승 시작');
 }
}
$('ropeAutoMove').addEventListener('click',e=>{
 e.stopPropagation();
 if(paused||ssM16TransitionLocked||ssM15Scene!=='mining'||ssRegion!=='mine'||!rope.active||(rope.mode!=='vertical'&&rope.mode!=='pull'))return;
 ropeAutoMoveEnabled=!ropeAutoMoveEnabled;
 if(ropeAutoMoveEnabled&&rope.mode==='vertical')rope.nextSearchSpent=false;
 ropeStatusNotice=.6;
 updateRopeAutoMoveHud();
});
