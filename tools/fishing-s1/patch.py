"""Apply 흙별 fishing S1 (낚시 실장 구상 v0.4 · 제작 순서 A) to a generated game HTML.

One riverbank vertical slice in 잔빛숲 X61~68: existing 3 species, walkable spots A/B/C,
target selection → lure → bite → recovery-type tug, result card, save compatibility.

Usage: patch.py <in.html> <out.html>
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

CSS = """<style id="river-s1-style">
#riverOverlay{position:absolute;inset:0;z-index:91;display:flex;flex-direction:column;gap:6px;box-sizing:border-box;
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
#fishWorldCanvas{display:block;width:100%;height:100%;image-rendering:pixelated;touch-action:none}
#fishWorldGl{position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;cursor:grab}
#fishWorldGl[hidden],#fishWorldCanvas[hidden]{display:none!important}
#app.fish-world-active #ssHubBackdrop{z-index:92}#app.fish-world-active #ssHub{z-index:93}#app.fish-world-active #overlay{z-index:94}
#app.ss-portal-transition #fishWorldRoot{pointer-events:none!important}
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
 <section id="fishWorldRoot" class="farm-world fish-world" aria-label="도래 낚시터" hidden>
  <canvas id="fishWorldGl" aria-label="3D 도래 낚시터 · 화면을 끌면 시점이 돌아가요"></canvas>
  <canvas id="fishWorldCanvas" aria-label="걸어 다니는 낚시터 지형 (대체 화면)" hidden></canvas>
  <div class="farm-world-hud">
   <header class="farm-world-header"><div class="farm-heading"><strong>🎣 도래 낚시터</strong></div><div class="farm-stats"><span id="fishWorldBag" class="fcb-farm-chip">🐟 0·0·0</span><button id="fishViewReset" class="fcb-farm-bag" type="button">⟳ 시점</button><span class="scene-nav"><button type="button" data-scene-profile aria-label="광부 프로필 열기">프로필</button><button type="button" data-scene-menu aria-label="전체 메뉴 열기" aria-controls="ssHub" aria-expanded="false">☰ 메뉴</button></span></div></header>
   <div id="fishWorldGuide" class="farm-world-guide">자리 A 수초 강가 · B 선착장 끝 · C 바위 물살 · 🚪 서쪽 출구</div>
   <div class="farm-world-bottom">
    <div id="fishDpad" class="farm-dpad" aria-label="낚시터 이동 패드" role="group"><span class="farm-dpad-ring"></span><span class="farm-dpad-icon">✣</span><span class="farm-dpad-note">이동</span></div>
    <div class="farm-bottom-right"><button id="fishWorldAction" class="farm-world-action" type="button">🎣 물가 자리로 걸어가세요</button></div>
   </div>
   <div id="fishWorldToast" class="farm-world-toast" role="status" aria-live="polite"></div>
  </div>
 </section>
"""


def patch(html):
    def replace(old, new, count=1):
        nonlocal html
        if html.count(old) != count:
            raise ValueError(f"Expected {count} match(es) for {old[:90]!r}, found {html.count(old)}")
        html = html.replace(old, new)

    core = (HERE / 'river-core.js').read_text(encoding='utf8')
    poses = json.loads((HERE.parent.parent / "assets/fishing-a/angler-atlas.json").read_text(encoding="utf8"))
    poses = {name: [p["fps"], p["loop"], [[*f["rect"][:2], *f["pivot"], *f["rod_tip"]] for f in p["frame_data"]]] for name, p in poses.items()}
    art = "const ssRiverPoseSpec=" + json.dumps(poses, separators=(",", ":")) + ";\n"
    art += (HERE / 'river-art.js').read_text(encoding='utf8')
    ui = art + (HERE / 'river-ui.js').read_text(encoding='utf8') + (HERE / 'river-world.js').read_text(encoding='utf8')
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
            " ...LIVING_SITES.trees.map(x=>Object.freeze({id:'tree:'+x,type:'tree',x})),\n ...(RIVER_FOREST_BANK?[Object.freeze({id:'pond',type:'pond',x:LIVING_SITES.pond})]:[])\n]);")
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
    replace("✦ 별샘 X120 · 🎣 낚시터는 준비 중</div>", "✦ 별샘 X120 · 🎣 도래 낚시터(마을 낚시터 입구)</div>")
    start = html.index("  push('<h3>🎣 낚시</h3><p>마을 낚시터는 준비 중이에요. 낚싯대 재료는 원목 3개예요.</p>');")
    end_marker = "action('줄 풀기','pond.slacken','pond','',!near(64))}`));}\n"
    end = html.index(end_marker, start) + len(end_marker)
    if html.count(end_marker) != 1:
        raise ValueError('fish tab end marker not unique')
    html = html[:start] + (
        "  push('<h3>🎣 도래 낚시터</h3><p>마을 낚시터 입구로 들어가 물가의 자리 A·B·C에서 낚시해요. 낚싯대는 낚시 자리에서 원목 3개로 만들 수 있어요.</p>');\n"
        "  {const a=w.river?.attempt;push(row(a?`걸려 있는 ${LIVING_FISH[a.fish].name} · 발밑까지 ${a.progress}%`:w.fishing?`예전에 걸어 둔 ${LIVING_FISH[w.fishing.id].name}`:w.rod?'나무 낚싯대 보유':'나무 낚싯대 · 원목 3개 (강변에서 제작)',"
        "`<small>마을 낚시터 입구 → 자리 A·B·C</small>`));}\n"
        "  push(`<p>최고 크기: ${LIVING_FISH_ORDER.map(id=>LIVING_FISH[id].name+' '+(w.river?.best?.[id]?(w.river.best[id]/10).toFixed(1)+'cm':(w.fishDex.includes(id)?'크기 미기록':'-'))).join(' · ')}</p>`);\n"
    ) + html[end:]
    replace("label:'🎣 낚시터 (준비 중)',hint:'마을 낚시터 준비 중 · 낚싯대 재료는 원목 3개'", "label:'🎣 낚시터로 이동',hint:'도래 낚시터 · 물가의 자리 A·B·C에서 낚시해요'")
    replace("if(target.id==='fishing'){t25Notify('마을 낚시터 준비 중 · 낚싯대 재료는 원목 3개');return true;}", "if(target.id==='fishing'){void t25EnterFishing();return true;}")

    # --- fishing_01 subworld: same loading/rollback/continue contract as farm_01
    replace("if(farmWorldActive){farmWorldTick(dt);requestAnimationFrame(loop);return;}",
            "if(fishingWorldActive){fishingWorldTick(dt);requestAnimationFrame(loop);return;}if(farmWorldActive){farmWorldTick(dt);requestAnimationFrame(loop);return;}")
    replace("const should=ssRegion===T25_ID&&!farmWorldActive&&!archWorldActive&&!ssIsTitle();",
            "const should=ssRegion===T25_ID&&!farmWorldActive&&!archWorldActive&&!fishingWorldActive&&!ssIsTitle();")
    replace("else if(t25LastRegion==='ruins_3d_01')town25dPlayer={x:17,z:-11};",
            "else if(t25LastRegion==='ruins_3d_01')town25dPlayer={x:17,z:-11};else if(t25LastRegion==='fishing_01')town25dPlayer={x:18,z:-0.6};")
    replace("if(farmWorldActive&&game?.farmWorldV1)game.farmWorldV1.position={x:farmPlayer.x,y:farmPlayer.y};",
            "if(farmWorldActive&&game?.farmWorldV1)game.farmWorldV1.position={x:farmPlayer.x,y:farmPlayer.y};if(fishingWorldActive&&game?.fishingWorldV1)game.fishingWorldV1.position={x:fwPlayer.x,y:fwPlayer.y};")
    replace("farmWorldRestoreAfterContinue();lumberWorldRestoreAfterContinue();archWorldRestoreAfterContinue();",
            "farmWorldRestoreAfterContinue();lumberWorldRestoreAfterContinue();archWorldRestoreAfterContinue();fishingWorldRestoreAfterContinue();")
    replace("farm:copy(game.farmWorldV1),arch:", "farm:copy(game.farmWorldV1),fishing:copy(game.fishingWorldV1),arch:")
    replace("  farmActive:farmWorldActive,archActive:archWorldActive,lumberActive:", "  farmActive:farmWorldActive,fishingActive:fishingWorldActive,archActive:archWorldActive,lumberActive:")
    replace("farmPosition:{...farmPlayer},", "farmPosition:{...farmPlayer},fishingPosition:{...fwPlayer},")
    replace(" if(snapshot.arch===undefined)delete game.archWorldV1;else game.archWorldV1=snapshot.arch;\n",
            " if(snapshot.arch===undefined)delete game.archWorldV1;else game.archWorldV1=snapshot.arch;\n if(snapshot.fishing===undefined)delete game.fishingWorldV1;else game.fishingWorldV1=snapshot.fishing;\n")
    replace(" if(snapshot.townActive){\n  if(!town25dActive)t25Activate();",
            " if(snapshot.fishingActive){if(snapshot.fishingPosition)Object.assign(fwPlayer,snapshot.fishingPosition);if(!fishingWorldActive)fishingWorldActivate();else fishingWorldDraw();}\n else if(fishingWorldActive)fishingWorldDeactivate();\n if(snapshot.townActive){\n  if(!town25dActive)t25Activate();")
    replace(" if(worldId==='lumber_01'){\n  if(!lumberWorldActive",
            " if(worldId==='fishing_01')return fishingWorldReadyCheck();\n if(worldId==='lumber_01'){\n  if(!lumberWorldActive")
    replace("if(ssRegion!==worldId||farmWorldActive||archWorldActive||town25dActive||lumberWorldActive)return false;",
            "if(ssRegion!==worldId||farmWorldActive||archWorldActive||town25dActive||lumberWorldActive||fishingWorldActive)return false;")
    replace(" if(typeof archWorldClearInput==='function')archWorldClearInput();",
            " if(typeof archWorldClearInput==='function')archWorldClearInput();\n if(typeof fishingWorldClearInput==='function')fishingWorldClearInput();")
    replace("ready:worldId=>worldId==='farm_01'&&farmWorldActive?",
            "ready:worldId=>worldId==='fishing_01'?(fishingWorldActive&&(fwRenderer==='three'?!!(fw3&&fw3.ready):fwCanvas.width>1)):worldId==='farm_01'&&farmWorldActive?")
    replace("['mine','life_forest_01'].includes(worldId)&&!farmWorldActive&&",
            "['mine','life_forest_01'].includes(worldId)&&!farmWorldActive&&!fishingWorldActive&&")
    replace("worlds:['village_hub_01','mine','life_forest_01','farm_01','ruins_3d_01','lumber_01']\n});\n// M2.5-C",
            "worlds:['village_hub_01','mine','life_forest_01','farm_01','ruins_3d_01','lumber_01','fishing_01']\n});\n// M2.5-C")
    replace("repeat:'숲의 숨결을 다시 느껴요'}\n});",
            "repeat:'숲의 숨결을 다시 느껴요'},\n fishing_01:{name:'도래 낚시터',subtitle:'물길을 읽는 조용한 시간',index:'07',first:'물가의 자리 A·B·C로 걸어가 보세요',repeat:'물고기 그림자가 다시 모였어요'}\n});")
    replace("$('m25WorldIndex').textContent='WORLD '+meta.index+' / 06';", "$('m25WorldIndex').textContent='WORLD '+meta.index+' / 07';")
    replace(" if(farmWorldActive)return '도래 농장';", " if(fishingWorldActive)return '도래 낚시터';\n if(farmWorldActive)return '도래 농장';")
    return html


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, dst = map(Path, sys.argv[1:])
    dst.write_text(patch(src.read_text(encoding='utf8')), encoding='utf8')


if __name__ == '__main__':
    main()
