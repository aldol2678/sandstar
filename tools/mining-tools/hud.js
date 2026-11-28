function p16UpdateHammerHud(){
 const el=$('p16HammerHud');if(!el)return;
 const active=game?.tool==='hammer'&&ssRegion==='mine'&&ssM15Scene==='mining'&&!ssIsTitle();
 el.hidden=!active;if(!active)return;
 const rule=P16_HAMMER_CORES[p16HammerRank()];
 $('p16HammerHudName').textContent='충격 망치 · 코어 '+rule.name;
 $('p16HammerHudState').textContent=`충격 ${Math.round(rule.fracture*100)}% · 균열 ${p16HammerFractures.size}칸`;
}
function p16UpdateDrillHud(){
 const el=$('p16DrillHud');if(!el)return;
 const active=game?.tool==='drill'&&ssRegion==='mine'&&ssM15Scene==='mining'&&!ssIsTitle();
 el.hidden=!active;if(!active)return;
 $('p16MotorName').textContent='드릴 '+P16_DRILL_MOTORS[p16DrillRank()].name+' · '+P16A2_DRILL_BITS[p16a2BitId()].name+(p16DrillRank()>=4?' · 관통':'');
 const spin=Math.round(p16DrillMotion.spin*100),heat=Math.round(p16DrillMotion.heat);
 $('p16SpinText').textContent=spin+'%';$('p16HeatText').textContent=heat+'%';
 $('p16SpinFill').style.width=spin+'%';$('p16HeatFill').style.width=heat+'%';
 el.classList.toggle('overheat',p16DrillMotion.overheated);
 el.title=p16DrillMotion.overheated?'과열: 출력을 낮추고 냉각 중':'회전력 '+spin+'%, 발열 '+heat+'%';
}
