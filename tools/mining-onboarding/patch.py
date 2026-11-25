"""Apply the mine onboarding changes to a generated game HTML, including live hotfix builds."""
import sys
from pathlib import Path


def patch(html):
    def replace(old, new):
        nonlocal html
        if html.count(old) != 1:
            raise ValueError(f"Expected one match for {old[:80]!r}")
        html = html.replace(old, new)

    replace("function ssBlockedMoveNotice(nextX){", """function ssBlockedMoveNotice(nextX){
 if(ssRegion==='mine' && Math.floor(p.x)===M1_FIRST_DIG_X &&
    !game.storyM1?.crystalSeen && p.y>=terrain(p.x)-.35){
  return matchMedia('(pointer:coarse)').matches
   ? '로프 버튼을 대각선 위로 끌어 벽에 거세요. 연결되면 이동 패드를 위로 밀어 줄을 감으세요.'
   : '대각선 위 벽을 조준하고 우클릭해 로프를 거세요. 연결되면 W를 눌러 줄을 감으세요.';
 }""")
    replace("ssMineNotice('이동이 막혔어요 · 앞의 블록을 채굴하거나 다른 길로 이동하세요');",
            "ssMineNotice(ssBlockedMoveNotice(p.x+Math.sign(dx)*.1));")

    replace("function doMine(x,y,dmg){", """function ssMiningInterrupted(message){
 if(!paused && ssRegion==='mine' && holdLast!==null && holdProgress>0){
  ssMineNotice(message);
 }
}
function doMine(x,y,dmg){""")
    replace("if(holdLast!==key(x,y)){holdLast=key(x,y);",
            "if(holdLast!==key(x,y)){ssMiningInterrupted('조준 칸이 바뀌었어요. 새 칸을 계속 누르세요.');holdLast=key(x,y);")
    replace("const release=()=>{holdTarget=null;", """const release=()=>{
 if(holdTarget)ssMiningInterrupted('채굴이 멈췄어요. 한 칸을 부서질 때까지 누르세요.');
 holdTarget=null;""")
    replace("if(!stickDir||stickDir.dx!==dx||stickDir.dy!==dy){holdProgress=0;", """if(!stickDir||stickDir.dx!==dx||stickDir.dy!==dy){
  if(stickDir)ssMiningInterrupted('채굴 방향이 바뀌었어요. 한 방향을 유지하세요.');
  holdProgress=0;""")
    replace("hudMinePointerId=null;hudMineHeld=false;input.act=false;",
            """if(hudMineHeld)ssMiningInterrupted('채굴이 멈췄어요. 한 방향을 계속 누르세요.');
 hudMinePointerId=null;hudMineHeld=false;input.act=false;""")

    replace("label:'🪓 벌목장으로 이동'", "label:'잔빛숲으로 이동'")
    replace("입고하면 무게가 비워지고 광물은 가방에 남아요.",
            "입고하면 운반 무게가 줄고 광물은 가방에 남아요. 바람장터에서 광물을 팔아 코인을 받으세요.")
    replace("정거장 입고 완료 · 채굴물 보존", "입고 완료 · 광물은 가방에 있어요. 판매는 바람장터에서!")

    # Some live builds already lowered the portrait toast and replaced the compass glyph.
    if '#town25dToast{top:calc(env(safe-area-inset-top) + 232px)}' not in html:
        replace('</head>', """<style>
@media (max-width:480px) and (orientation:portrait){
 #town25dToast{top:calc(env(safe-area-inset-top) + 232px)}
}
</style>
</head>""")
    for icon in ('⌖', '✦'):
        label = f'id="town25dCenter">{icon} 시점 중앙'
        if label in html:
            replace(label, 'id="town25dCenter">시점 중앙')
    return html


if __name__ == '__main__':
    source, output = map(Path, sys.argv[1:])
    output.write_text(patch(source.read_text(encoding='utf-8')), encoding='utf-8')
