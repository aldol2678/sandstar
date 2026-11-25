#!/usr/bin/env python3
"""Patch only farm input in an extracted SANDSTAR HTML.
Usage: python3 patch.py CURRENT_EXTRACTED.html CANDIDATE.html
Never patch a live Worker directly. Exact anchors fail closed; source stays unchanged.
"""
import re
import sys
from pathlib import Path

src, dst = map(Path, sys.argv[1:])
if src.resolve() == dst.resolve() or dst.exists():
    raise SystemExit("Use a new output file; do not overwrite the input")
html = src.read_text(encoding="utf-8")

def once(old, new):
    global html
    if html.count(old) != 1:
        raise SystemExit("Unexpected source anchor: " + old[:100])
    html = html.replace(old, new, 1)

once("</head>", """<style id="farm-input-fix-20261124">
/* Farm owns its own controls; suppress the legacy movement HUD only in this world. */
#app.farm-world-active #controls,#app.farm-world-active #town25dRoot,#app.farm-world-active #ruinsWalkPad,#app.farm-world-active #archPad{display:none!important;pointer-events:none!important}
#farmWorldCanvas{touch-action:none}
</style></head>""")
once("function farmWorldClearInput(){farmMoveKeys.clear();farmJoystick={x:0,y:0};farmPointer=null;}",
"""let farmTapTarget=null;
function farmWorldClearInput(){farmMoveKeys.clear();farmJoystick={x:0,y:0};farmPointer=null;farmTapTarget=null;}""")
once("function farmWorldMoveDelta(){", "function farmWorldMoveDelta(dt){")
once(" dx+=farmJoystick.x;dy+=farmJoystick.y;let n=Math.hypot(dx,dy);return n>1?{x:dx/n,y:dy/n}:{x:dx,y:dy};",
""" if(typeof ssScenePanelOpen==='function'&&ssScenePanelOpen()){farmWorldClearInput();return {x:0,y:0};}
 if(farmMoveKeys.size||farmPointer!==null){farmTapTarget=null;}
 dx+=farmJoystick.x;dy+=farmJoystick.y;let n=Math.hypot(dx,dy);
 if(n>0)return n>1?{x:dx/n,y:dy/n}:{x:dx,y:dy};
 if(!farmTapTarget)return {x:0,y:0};
 const tx=farmTapTarget.x-farmPlayer.x,ty=farmTapTarget.y-farmPlayer.y,d=Math.hypot(tx,ty);
 const step=Math.min(.05,Math.max(0,dt))*4.7;
 if(d<.035){farmTapTarget=null;return {x:0,y:0};}
 if(step<=0)return {x:0,y:0};
 const scale=Math.min(1/step,1/d);
 return {x:tx*scale,y:ty*scale};""")
once(" const vec=farmWorldMoveDelta();const delta=Math.min(.05,dt)*4.7;",
""" const vec=farmWorldMoveDelta(dt);const delta=Math.min(.05,dt)*4.7;
 const oldFarmX=farmPlayer.x,oldFarmY=farmPlayer.y;""")
once(" if(Math.abs(vec.x)+Math.abs(vec.y)>.1)farmPlayer.face=",
""" if(farmTapTarget&&delta>0){
  const remaining=Math.hypot(farmTapTarget.x-farmPlayer.x,farmTapTarget.y-farmPlayer.y);
  const traveled=Math.hypot(farmPlayer.x-oldFarmX,farmPlayer.y-oldFarmY);
  if(remaining<.035||traveled<.0001)farmTapTarget=null;
 }
 if(Math.abs(vec.x)+Math.abs(vec.y)>.1)farmPlayer.face=""")
once(" farmDrawPlayer(c,farmPlayer.x*t,farmPlayer.y*t);",
""" if(farmTapTarget){c.save();c.strokeStyle='#fff3c4';c.lineWidth=2;c.beginPath();c.arc(farmTapTarget.x*t,farmTapTarget.y*t,7,0,Math.PI*2);c.stroke();c.restore();}
 farmDrawPlayer(c,farmPlayer.x*t,farmPlayer.y*t);""")
# Replace the one existing canvas handler, not add a competing listener.
pattern = r"farmCanvas\.addEventListener\('pointerdown',e=>\{[\s\S]*?\n\}\);\n(?=// Joystick uses pointer ownership)"
replacement = """farmCanvas.addEventListener('pointerdown',e=>{
 if(!farmWorldActive||m25bBusy||farmPointer!==null||farmMoveKeys.size||$('overlay')?.classList.contains('open')||(typeof ssScenePanelOpen==='function'&&ssScenePanelOpen()))return;
 if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
 e.preventDefault();
 const r=farmCanvas.getBoundingClientRect();if(!r.width||!r.height)return;
 const wx=((e.clientX-r.left)*farmCanvasW/r.width+Math.round(farmCamera.x))/FARM_TILE;
 const wy=((e.clientY-r.top)*farmCanvasH/r.height+Math.round(farmCamera.y))/FARM_TILE;
 farmTapTarget=null;
 // Existing deliberate nearby interactions remain. Never activate a distant plot/gate.
 if(Math.hypot(wx-3.9,wy-16.5)<2.6&&farmWorldNearbyGate()){farmWorldTryExit();return;}
 const o=FARM_PLOTS.find(v=>Math.hypot(v.x-wx,v.y-wy)<2.2);
 if(o&&farmWorldNearPlot()?.id===o.id){farmWorldAction();return;}
 const x=Math.max(1.72,Math.min(FARM_W-2.72,wx)),y=Math.max(1.72,Math.min(FARM_H-2.72,wy));
 const rad=.31;
 if([[-rad,-rad],[rad,-rad],[-rad,rad],[rad,rad]].some(([ox,oy])=>farmWorldBlocked(x+ox,y+oy)))return;
 farmTapTarget={x,y};
});
"""
html, count = re.subn(pattern, lambda _: replacement, html)
if count != 1:
    raise SystemExit("Expected exactly one original farm canvas handler")
# Cancel on manual input immediately, including a press-and-release within one frame.
once("farmPointer=e.pointerId;try{e.currentTarget.setPointerCapture(e.pointerId)}", "farmTapTarget=null;farmPointer=e.pointerId;try{e.currentTarget.setPointerCapture(e.pointerId)}")
once("else if(!['e',' ','escape'].includes(k))farmMoveKeys.add(k);", "else if(!['e',' ','escape'].includes(k)){farmTapTarget=null;farmMoveKeys.add(k);}")
dst.write_text(html, encoding="utf-8")
print("Farm input candidate written:", dst)
