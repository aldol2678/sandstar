"""Integrate P1.6-F rope inputs with the game's existing mobility stats and save format."""
import hashlib
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def patch(html):
    def replace(old, new, count=1):
        nonlocal html
        if html.count(old) != count:
            raise ValueError(f"Unexpected baseline near {old[:80]!r}")
        html = html.replace(old, new)

    def section(start, end, digest, new):
        begin = html.index(start)
        old = html[begin:html.index(end, begin)]
        if hashlib.sha256(old.encode()).hexdigest() != digest:
            raise ValueError(f"Changed game code at {start!r}")
        replace(old, new)

    replace('</head>', '<style>\n' + (HERE / 'auto-hud.css').read_text() + '</style>\n</head>')
    footer = '<footer id="footer">'
    replace(footer, '<button id="ropeAutoMove" type="button" hidden aria-pressed="false" '
            'aria-label="로프 자동 상승 시작"><span class="rope-auto-symbol" aria-hidden="true">▶</span> '
            '<span class="rope-auto-label">자동 상승</span></button>\n  ' + footer)
    replace('let ropeLeapLedgePlan=null,ropeAutoChain=false;', 'let ropeLeapLedgePlan=null,ropeAutoMoveEnabled=false;')
    replace('ropeLeapLedgePlan=null;ropeAutoChain=false;', 'ropeLeapLedgePlan=null;ropeAutoMoveEnabled=false;')
    replace("targetY:a.targetY,attached:false,mode:'pull'", "targetY:a.targetY,originX:p.x,originY:p.y,attached:false,mode:'pull'")
    section('function toggleRope', 'function moveCamera', 'b18a702f1f5b73922ee353f4a4ed35005e490a00bf0ea7866a49ac98a44bc681',
            (HERE / 'traversal.js').read_text() + '\n')
    start = 'if(rope.active){\n  ropeAim=dir;'
    end = ' const onFloor='
    physics = html[html.index(start):html.index(end, html.index(start))]
    prefix = physics[:physics.index('  else {')]
    prefix = prefix.replace('  ropeAim=dir;', """  if(input.reelIn||input.reelOut||dir||ropePointerAim||rope.mode==='swing')ropeAutoMoveEnabled=false;
  ropeAim=dir;""")
    section(start, end, 'c4309a9ee6ca22cacc86e3582854c48035a093a466bd34c147a60725e35d1b95', prefix + '  else {moveAlongRope(dt,dir);return;}\n }\n')
    replace("const ropeButton=$('ropeBtn');", (HERE / 'auto-hud.js').read_text() + "const ropeButton=$('ropeBtn');")
    replace('function updateMobilityHud(){', 'function updateMobilityHud(){updateRopeAutoMoveHud();')
    replace('!!rope.active&&!!rope.attached&&d.dy', '!!rope.active&&d.dy', 2)
    replace("&&rope.active&&rope.attached&&(rope.mode==='swing'||rope.mode==='pull')){if(rope.mode==='pull')startRopeSwing(0);input.reel",
            "&&rope.active){input.reel", 2)
    replace("onControl&&!moveKey", "onControl&&!moveKey&&!(k0==='r'&&rope.active)")
    replace("ropeHoldFromActive=rope.active;ropeHold=rope.active;", "ropeHoldFromActive=rope.active;ropeHold=false;")
    replace("window.addEventListener('blur',()=>{hudReleaseMine();", "window.addEventListener('blur',()=>{ropeAutoMoveEnabled=false;hudReleaseMine();")
    replace('if(document.hidden){hudReleaseMine();', 'if(document.hidden){ropeAutoMoveEnabled=false;hudReleaseMine();')
    replace("paused=true;input.left=input.right=input.jump=input.act=input.reelIn=input.reelOut=false;",
            "paused=true;updateRopeAutoMoveHud();input.left=input.right=input.jump=input.act=input.reelIn=input.reelOut=false;")
    replace("rope.active?(rope.attached?(rope.mode==='swing'?`줄 ${rope.swingLength.toFixed(1)}↕`:rope.mode==='pull'?'좌우: 스윙':'이어서'):'이동 중')",
            "rope.active?'로프 해제'")
    replace('짧게 터치해 자동 상승', '짧게 터치해 로프 연결')
    replace('누르면 로프 해제; 위아래 드래그로 감기 또는 풀기, 좌우 드래그로 다른 암벽 연결',
            '누르면 로프 해제. 이동 패드 위아래로 감기·풀기, 자동 상승은 별도 버튼')
    replace('로프 버튼을 대각선 위로 끌어 벽에 거세요. 연결되면 이동 패드를 위로 밀어 줄을 감으세요.',
            '로프 버튼을 한 번 탭해 거세요. 이동 패드를 위로 밀거나 자동 상승을 누르면 턱 위로 올라가요.')
    replace('대각선 위 벽을 조준하고 우클릭해 로프를 거세요. 연결되면 W를 눌러 줄을 감으세요.',
            'R로 로프를 거세요. W를 누르고 있거나 자동 상승을 누르면 턱 위로 올라가요. R을 다시 누르면 해제돼요.')
    return html


if __name__ == '__main__':
    source, output = map(Path, sys.argv[1:])
    output.write_text(patch(source.read_text(encoding='utf-8')), encoding='utf-8')
