"""Port the P1.6-F drill and hammer onto a generated, rope-enabled game HTML."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def patch(html):
    def replace(old, new):
        nonlocal html
        if html.count(old) != 1:
            raise ValueError(f"Expected one game anchor near {old[:75]!r}")
        html = html.replace(old, new)

    def asset(name):
        return (HERE / name).read_text(encoding='utf-8')

    replace('</head>', '<style>\n' + asset('hud.css') + '</style>\n</head>')
    replace('<div class="mine-direct-area">', '<div class="mine-direct-area">\n' + asset('hud.html'))
    replace('function updateRopeAutoMoveHud(){', asset('hud.js') + '\nfunction updateRopeAutoMoveHud(){')
    replace("function updHud(){ssM15SyncScene();", "function updHud(){ssM15SyncScene();p16UpdateDrillHud();p16UpdateHammerHud();")
    replace('drawMiningImpact();drawMiningPixels();', 'drawMiningImpact();p16DrawHammerFractures();drawMiningPixels();')
    replace('pickaxeLevel:1,pickaxeForge:{rank:0', 'pickaxeLevel:1,drillMotor:{rank:1},drillBits:{owned:["tunnel"],equipped:"tunnel"},hammerCore:{rank:1},pickaxeForge:{rank:0')
    replace('d.pickaxeForge=normalizePickaxeForge(d.pickaxeForge);',
            'd.drillMotor=p16NormalizeDrillMotor(d.drillMotor);d.drillBits=p16a2NormalizeBits(d.drillBits);'
            'd.hammerCore=p16HammerNormalizeCore(d.hammerCore);d.pickaxeForge=normalizePickaxeForge(d.pickaxeForge);')
    replace("else if(section==='attribute')content=forgeAffinityPanel();", """else if(section==='drill')content=p16DrillPanel()+p16a2DrillBitsPanel();
  else if(section==='hammer')content=p16HammerForgePanel();
  else if(section==='attribute')content=forgeAffinityPanel();""")
    replace("['pickaxe','곡괭이','forge'],['attribute'", "['pickaxe','곡괭이','forge'],['drill','드릴','gear'],['hammer','망치','gear'],['attribute'")
    replace("if($('forgeAttempt'))$('forgeAttempt').onclick=attemptPickaxeForge;", """if($('forgeAttempt'))$('forgeAttempt').onclick=attemptPickaxeForge;
  if($('p16MotorUpgrade'))$('p16MotorUpgrade').onclick=p16UpgradeDrillMotor;
  if($('p16HammerUpgrade'))$('p16HammerUpgrade').onclick=p16HammerUpgrade;
  document.querySelectorAll('[data-p16a2-bit]').forEach(btn=>btn.onclick=()=>p16a2ChooseBit(btn.dataset.p16a2Bit));""")
    replace("pickaxeAffinityPower(t):1)*mobilityDerived().mineMultiplier",
            "pickaxeAffinityPower(t):tool==='drill'&&ssRegion==='mine'?p16a2BitPower(t):1)*mobilityDerived().mineMultiplier")
    replace("if(!secondary&&game.tool==='hammer'){for", """if(!secondary&&game.tool==='hammer'&&ssRegion==='mine')p16HammerWave(x,y);
 else if(!secondary&&game.tool==='hammer'){for""")
    replace('function mineHold(dt){let target=miningTarget();if(!target)return;let t=tile(target.x,target.y);if(!t)return;balanceStats().miningSeconds+=dt;doMine(target.x,target.y,dt*miningRate(t))}',
            asset('drill.js') + '\n' + asset('hammer.js'))
    replace('function spawnPlayer(){pickaxeTrace.reset();', 'function spawnPlayer(){p16ResetTools();pickaxeTrace.reset();')
    replace('ssRegion=target;pickaxeTrace.reset();', 'ssRegion=target;p16ResetTools();pickaxeTrace.reset();')
    replace("if(ok){holdLast=null;holdProgress=0;market();", "if(ok){p16ResetTools();market();")
    replace("if(ok){holdLast=null;holdProgress=0;ssOpenItems('bag');", "if(ok){p16ResetTools();ssOpenItems('bag');")
    return html


if __name__ == '__main__':
    source, output = map(Path, sys.argv[1:])
    output.write_text(patch(source.read_text(encoding='utf-8')), encoding='utf-8')
