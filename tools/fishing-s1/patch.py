"""Apply 흙별 fishing S1 (낚시 실장 구상 v0.4 · 제작 순서 A) to a generated game HTML.

One riverbank vertical slice in 잔빛숲 X61~68: existing 3 species, walkable spots A/B/C,
target selection → lure → bite → recovery-type tug, result card, save compatibility.

Usage: patch.py <in.html> <out.html>
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

CSS = """<style id="river-s1-style">
#riverOverlay{position:absolute;inset:0;z-index:19;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;
 padding:calc(env(safe-area-inset-top) + 8px) 12px calc(env(safe-area-inset-bottom) + 10px);
 background:linear-gradient(180deg,#123540,#0c2530);color:#f4f5dd;font:600 13px/1.35 system-ui,sans-serif;overflow-y:auto;overscroll-behavior:contain;touch-action:manipulation}
#riverOverlay[hidden]{display:none!important}
#riverOverlay button{min-height:44px;min-width:44px;border:1px solid #91bcae;border-radius:11px;background:#246a62;color:#fff5da;padding:8px 12px;font:800 13px/1.2 system-ui,sans-serif;touch-action:manipulation;-webkit-user-select:none;user-select:none}
#riverOverlay button:disabled{opacity:.45}
#riverOverlay button.alt{background:#384b59;border-color:#6b8d96;color:#e7f2f0}
.river-top{display:flex;align-items:center;gap:8px}
.river-top h2{flex:1;margin:0;font:900 17px/1.2 system-ui,sans-serif;color:#fff0b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.river-top button{background:#384b59!important;border-color:#6b8d96!important}
.river-spots{display:flex;gap:6px}
.river-spots button{flex:1 1 0;padding:6px 4px!important;font-size:12px!important;background:#1d4a52!important}
.river-spots button.on{background:#e3c46a!important;color:#1d2a2a!important;border-color:#fff0b8!important}
.river-stage{position:relative;flex:1 1 auto;min-height:220px;max-height:min(52dvh,430px);border-radius:14px;overflow:hidden;border:2px solid #4f8c88}
#riverCanvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
.river-card{position:absolute;left:10px;right:10px;bottom:10px;max-height:calc(100% - 20px);overflow:auto;box-sizing:border-box;padding:12px;border-radius:14px;border:2px solid #b9d9b7;background:#122d38f2;box-shadow:0 8px 24px #0009}
.river-card[hidden]{display:none}
.river-card h3{margin:0 0 4px;font:900 16px/1.25 system-ui,sans-serif;color:#fff0b8}
.river-card p{margin:0 0 8px;color:#d8e5d8}
.river-card small{color:#a6ccca}
.river-row{display:flex;flex-wrap:wrap;gap:6px}
.river-row button{flex:1 1 120px}
.river-result{display:flex;gap:10px;align-items:center}
.river-result img{width:48px;height:48px;image-rendering:pixelated}
.river-facts{margin:6px 0 10px;padding-left:18px;color:#e9efe0}
.river-facts li{margin:2px 0}
.river-hint{margin:0;min-height:2.6em;color:#fff3c4;font-weight:800;text-align:center}
.river-controls{display:flex;gap:8px}
#riverRetrieve{flex:0 0 76px;background:#384b59!important}
#riverHold{flex:1;min-height:68px!important;font-size:17px!important;border-radius:16px!important;background:#2f7f6d!important}
#riverHold.down{background:#e3c46a!important;color:#1d2a2a!important;transform:translateY(1px)}
#riverHold.bite{background:#d9583f!important;animation:riverPulse .5s infinite alternate}
@keyframes riverPulse{to{filter:brightness(1.25)}}
.river-bag{margin:0;font-size:11px;color:#a6ccca;text-align:center}
.river-help{font-size:12px;color:#d8e5d8}
.river-help summary{min-height:32px;line-height:32px;cursor:pointer;color:#fff0b8}
.river-help p{margin:4px 0}
.river-help label{display:flex;gap:8px;align-items:center;min-height:40px}
.river-dexrow{display:flex;gap:6px;flex-wrap:wrap}
.river-dex{flex:1 1 90px;display:flex;flex-direction:column;align-items:center;padding:6px;border-radius:10px;background:#1d4048;opacity:.6}
.river-dex.has{opacity:1}
.river-dex img{width:32px;height:32px;image-rendering:pixelated}
.river-dex i{font-style:normal;font-size:20px;line-height:32px}
.river-dex small{color:#a6ccca}
@media (min-width:700px){#riverOverlay{padding-left:max(12px,calc(50% - 300px));padding-right:max(12px,calc(50% - 300px))}}
@media (orientation:landscape) and (max-height:500px){.river-stage{min-height:150px}.river-hint{min-height:1.4em}#riverHold{min-height:52px!important}}
</style>
"""

MARKUP = """ <section id="riverOverlay" role="dialog" aria-modal="true" aria-label="잔빛숲 강변 낚시" hidden>
  <div class="river-top"><h2 id="riverTitle">🎣 잔빛숲 강변</h2><button id="riverPause" type="button">일시정지</button><button id="riverExit" type="button">나가기</button></div>
  <div id="riverSpots" class="river-spots" aria-label="낚시 자리"><button type="button" data-spot="A">A 완만한 강가</button><button type="button" data-spot="B">B 깊은 소</button><button type="button" data-spot="C">C 좁은 물살</button></div>
  <div class="river-stage"><canvas id="riverCanvas" aria-label="강변 수면과 물고기 그림자"></canvas><div id="riverCard" class="river-card" hidden></div></div>
  <p id="riverHint" class="river-hint" aria-live="polite"></p>
  <div class="river-controls"><button id="riverRetrieve" type="button">회수</button><button id="riverHold" type="button">누르고 있으면 감기</button></div>
  <p id="riverBag" class="river-bag"></p>
  <details class="river-help"><summary>도감 · 조작 도움말</summary><div id="riverDex" class="river-dexrow"></div>
   <p>수면을 눌러 던지면 가장 가까운 물에 떨어져요. 누르고 있으면 감고, 떼면 멈춰요. 연타는 보너스가 아니에요.</p>
   <p>작은 그림자는 짧게 당겼다 멈추기, 중간 그림자는 지나가는 길 앞에서 당기기, 큰 그림자는 조용히 흘리기에 반응해요.</p>
   <p>걸린 뒤에는 틈에 감고, 몸을 꺾거나 버티면 손을 떼세요. 손을 떼도 진도는 줄지 않지만, 가만히 두면 잡히지 않아요.</p>
   <p>PC: 스페이스·F 감기 · 1/2/3 자리 · R 회수 · Esc 나가기</p>
   <label><input id="riverAssist" type="checkbox"> 자동 걸기 보조 (기록·보상 동일)</label></details>
 </section>
"""


def patch(html):
    def replace(old, new, count=1):
        nonlocal html
        if html.count(old) != count:
            raise ValueError(f"Expected {count} match(es) for {old[:90]!r}, found {html.count(old)}")
        html = html.replace(old, new)

    core = (HERE / 'river-core.js').read_text(encoding='utf8')
    ui = (HERE / 'river-ui.js').read_text(encoding='utf8')
    if '</script>' in core or '</script>' in ui:
        raise ValueError('script terminator inside fishing source')

    # --- styles + overlay markup
    replace('</head>', CSS + '</head>')
    replace('<section id="m17ActivityOverlay" role="dialog" aria-modal="true" aria-label="생활 행동" hidden><div id="m17ActivityCard"></div></section>\n',
            '<section id="m17ActivityOverlay" role="dialog" aria-modal="true" aria-label="생활 행동" hidden><div id="m17ActivityCard"></div></section>\n' + MARKUP)

    # --- pure state + commands (before any save is normalized)
    replace("const livingInt=(n,max=1000000)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;\n",
            "const livingInt=(n,max=1000000)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;\n" + core)
    replace("fishDex:[],foodBuff:null,appliedIds:[],events:[],energy:LIVING_ENERGY.max,counts:livingFreshCounts()};",
            "fishDex:[],foodBuff:null,appliedIds:[],events:[],energy:LIVING_ENERGY.max,counts:livingFreshCounts(),river:livingRiverFresh()};")
    replace(" return livingGrowPlots(state);\n}", " state.river=livingRiverNormalize(raw.river);\n return livingGrowPlots(state);\n}")
    replace("let award=0,message='',kind=cmd.type;", "let award=0,message='',kind=cmd.type,riverExtra=null;")
    replace("  default:return bad('지원하지 않는 행동이에요');",
            "  case 'river.hook':case 'river.catch':{const res=livingRiverCommand(state,cmd,kind,bad,hasBuff);if(res.ok===false)return res;message=res.message;riverExtra=res;break;}\n"
            "  default:return bad('지원하지 않는 행동이에요');")
    replace(" return {ok:true,state,inv,coins:context.coins+award,message};\n}",
            " return {ok:true,state,inv,coins:context.coins+award,message,...(riverExtra?{river:riverExtra}:{})};\n}")

    # --- forest object: the riverbank becomes a real action spot again
    replace(" ...LIVING_SITES.trees.map(x=>Object.freeze({id:'tree:'+x,type:'tree',x}))\n]);",
            " ...LIVING_SITES.trees.map(x=>Object.freeze({id:'tree:'+x,type:'tree',x})),\n Object.freeze({id:'pond',type:'pond',x:LIVING_SITES.pond})\n]);")
    replace("function ssM17NearObject(o,range=3.15){\n",
            "function ssM17NearObject(o,range=3.15){\n if(o&&o.type==='pond')range=Math.max(range,4.8);\n")
    replace(" return w.fishing?'🎣 낚시 이어하기':w.rod?'🎣 낚시 시작':'🎣 낚싯대 준비';",
            " return (w.river?.attempt||w.fishing)?'🎣 강변 낚시 이어하기':w.rod?'🎣 강변 낚시':'🎣 낚싯대 준비 (원목 3)';")
    replace(" if(o.type==='pond'){ssM17OpenPanel('fish','pond');return true;}",
            " if(o.type==='pond'){ssM17LastAction='river.open';return ssRiverOpen();}")
    replace("Math.abs(q.x+.5-o.x)<=(o.type==='tree'?1.8:1.55)", "Math.abs(q.x+.5-o.x)<=(o.type==='tree'?1.8:o.type==='pond'?4.6:1.55)")
    replace("drawLivingWorld();ssM17DrawObjectMarker();", "drawLivingWorld();ssRiverDrawWorld();ssM17DrawObjectMarker();")
    replace("if(k==='escape'){if(ssM17PanelKind){ssM17ClosePanel();return;}",
            "if(k==='escape'){if(ssRiverIsOpen){ssRiverClose();return;}if(ssM17PanelKind){ssM17ClosePanel();return;}")

    # --- UI (after the M1.7 panel wiring so its DOM helpers exist)
    anchor = "window.__sandstarM17={get:()=>"
    i = html.index(anchor)
    j = html.index('\n', i) + 1
    if html.count(anchor) != 1:
        raise ValueError('M17 API anchor not unique')
    html = html[:j] + ui + html[j:]

    # --- living menu + town copy: point to the riverbank instead of "준비 중"
    replace("✦ 별샘 X120 · 🎣 낚시터는 준비 중</div>", "✦ 별샘 X120 · 🎣 강변 낚시 X61~68</div>")
    start = html.index("  push('<h3>🎣 낚시</h3><p>마을 낚시터는 준비 중이에요. 낚싯대 재료는 원목 3개예요.</p>');")
    end_marker = "action('줄 풀기','pond.slacken','pond','',!near(64))}`));}\n"
    end = html.index(end_marker, start) + len(end_marker)
    if html.count(end_marker) != 1:
        raise ValueError('fish tab end marker not unique')
    html = html[:start] + (
        "  push('<h3>🎣 잔빛숲 강변 낚시</h3><p>잔빛숲 강변 X61~68에서 낚시해요. 물가에서 E 또는 탭으로 시작하세요. 마을 낚시터는 아직 준비 중이에요.</p>');\n"
        "  {const a=w.river?.attempt;push(row(a?`걸려 있는 ${LIVING_FISH[a.fish].name} · 발밑까지 ${a.progress}%`:w.fishing?`예전에 걸어 둔 ${LIVING_FISH[w.fishing.id].name}`:w.rod?'나무 낚싯대 보유':'나무 낚싯대 · 원목 3개 (강변에서 제작)',"
        "`<small>${near(64)?'물가에서 E 또는 탭':'잔빛숲 X64로 이동'}</small>`));}\n"
        "  push(`<p>최고 크기: ${LIVING_FISH_ORDER.map(id=>LIVING_FISH[id].name+' '+(w.river?.best?.[id]?(w.river.best[id]/10).toFixed(1)+'cm':(w.fishDex.includes(id)?'크기 미기록':'-'))).join(' · ')}</p>`);\n"
    ) + html[end:]
    replace("hint:'마을 낚시터 준비 중 · 낚싯대 재료는 원목 3개'", "hint:'마을 낚시터 준비 중 · 지금은 잔빛숲 강변(X64)에서 낚시할 수 있어요'")
    replace("t25Notify('마을 낚시터 준비 중 · 낚싯대 재료는 원목 3개');", "t25Notify('마을 낚시터 준비 중 · 지금은 잔빛숲 강변(X64)에서 낚시할 수 있어요');")
    return html


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, dst = map(Path, sys.argv[1:])
    dst.write_text(patch(src.read_text(encoding='utf8')), encoding='utf8')


if __name__ == '__main__':
    main()
