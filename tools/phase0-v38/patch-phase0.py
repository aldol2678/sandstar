#!/usr/bin/env python3
"""SANDSTAR Phase 0 (2026-11-23, phase0-20261123) — Yeoul QA 5+1 fixes on v37.

Baseline: v37-handover/SANDSTAR_v37_main-inner.mjs (SHA 39cfe698...).
NEVER rebuild from npc-p0/build.py (patch 29 / v36 only) — that would roll back
Ark's v37 Ruins Walk. This script patches the extracted v37 HTML directly,
then re-encodes it into a worker module the same way build.py does
(js_escape of the HTML const).

Each replacement is rep_once: exact string, must occur exactly once
(or the stated count), else the script aborts without writing.
"""
import hashlib, re, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "v37-index.html"
DST = HERE / "phase0-index.html"

html = SRC.read_text(encoding="utf-8")
orig_len = len(html)

def rep_once(old, new, label, count=1):
    global html
    n = html.count(old)
    assert n == count, f"{label}: expected {count}, found {n}: {old[:90]!r}"
    html = html.replace(old, new)

# Marker: one comment at the start of the main script block (block 1).
rep_once("<script>\n(()=>{'use strict';",
         "<script>\n/* SANDSTAR Phase 0 2026-11-23 (phase0-20261123): Yeoul QA 5+1, on v37 baseline. */\n(()=>{'use strict';",
         "phase0 marker")

# ---------------------------------------------------------------- P0-1: town objective strip
# Root cause: #m1QuestBadge lives under the 2D-world DOM; town25dRoot is a
# separate full-screen section with its own HUD and no objective element,
# so in town the current quest was invisible on PC and mobile.
rep_once('<div class="t25-help">WASD 이동 · E 이용 · 미니맵을 눌러 자동 이동</div>',
         '<div id="t25Quest" class="t25-quest">✦ <span id="t25QuestText">마을의 오래된 광맥을 조사하세요.</span></div>\n  <div class="t25-help">WASD 이동 · E 이용 · 미니맵을 눌러 자동 이동</div>',
         "P0-1 town quest element")
rep_once(".t25-help{position:absolute;top:calc(env(safe-area-inset-top) + 95px);left:50%;transform:translateX(-50%);background:#0c3037bb;border:1px solid #aacdbaa1;border-radius:14px;padding:6px 10px;font-size:11px;font-weight:750;max-width:68vw;text-align:center;white-space:normal}",
         ".t25-help{position:absolute;top:calc(env(safe-area-inset-top) + 95px);left:50%;transform:translateX(-50%);background:#0c3037bb;border:1px solid #aacdbaa1;border-radius:14px;padding:6px 10px;font-size:11px;font-weight:750;max-width:68vw;text-align:center;white-space:normal} .t25-quest{position:absolute;top:calc(env(safe-area-inset-top) + 58px);left:12px;max-width:min(62vw,430px);background:#173b40ec;border:1px solid #9ac6a6;border-radius:9px;box-shadow:0 3px 12px #03171a88;color:#e6ffe2;padding:6px 9px;font-size:11px;font-weight:700;line-height:1.35;pointer-events:none;text-align:left} .t25-quest span{font-weight:500}",
         "P0-1 town quest css")
rep_once(".town-25d .t25-help{top:53px;font-size:9px;padding:3px 8px}",
         ".town-25d .t25-help{top:53px;font-size:9px;padding:3px 8px}.town-25d .t25-quest{top:76px;max-width:52vw;font-size:9px;padding:4px 7px}",
         "P0-1 town quest css landscape-short")
rep_once(".town-25d .t25-help{top:92px;width:70vw;font-size:10px}",
         ".town-25d .t25-help{top:92px;width:70vw;font-size:10px}.town-25d .t25-quest{top:54px;left:8px;max-width:58vw;font-size:10px;padding:5px 7px}",
         "P0-1 town quest css portrait")
rep_once("function t25RefreshHUD(){if(!town25dActive)return;",
         "function t25RefreshHUD(){if(!town25dActive)return;  {const _qt=$('t25QuestText');if(_qt&&typeof ssM1QuestText==='function'){try{_qt.textContent=ssM1QuestText();}catch(_){}}}",
         "P0-1 town quest sync")

# ---------------------------------------------------------------- P0-2: name unification
# '동쪽 X64 잔빛숲' (quest/guide text) vs town gate name '벌목장 입구'.
# Route wording now always goes through the gate name; the confusing
# '잔빛숲 · 벌목장 개편 예정' gate hint is replaced too.
rep_once("'마을 동쪽 X64 출입구에서 잔빛숲으로 이동하세요.'",
         "'마을 동쪽 벌목장 입구(X64)를 지나 잔빛숲으로 이동하세요.'",
         "P0-2 quest text")
rep_once("'새 지역: 마을 X55의 별광을 조사한 뒤 X64 숲길을 따라 잔빛숲에 들어가세요. 기존 장터와 광산은 그대로 이용할 수 있어요.'",
         "'새 지역: 마을 X55의 별광을 조사한 뒤 벌목장 입구(X64)를 지나 잔빛숲에 들어가세요. 기존 장터와 광산은 그대로 이용할 수 있어요.'",
         "P0-2 guide step")
rep_once("'✦ 별맥의 흔적 발견! 동쪽 X64 숲길로 향하세요.'",
         "'✦ 별맥의 흔적 발견! 동쪽 벌목장 입구(X64)로 향하세요.'",
         "P0-2 crystal flash")
rep_once("마을 동쪽 X64의 나무문을 지나면 잔빛숲으로 이어집니다. 생활권은 별도의 맵이지만 자원과 장비는 공유합니다.",
         "마을 동쪽 벌목장 입구(X64)의 나무문을 지나면 잔빛숲으로 이어집니다. 생활권은 별도의 맵이지만 자원과 장비는 공유합니다.",
         "P0-2 npc modal note")
rep_once("'광산 출입구 X40 → 마을 → 잔빛숲의 별샘을 찾아가세요.'",
         "'광산 출입구 X40 → 마을 벌목장 입구 → 잔빛숲의 별샘을 찾아가세요.'",
         "P0-2 quest text mine branch")
rep_once("hint:'잔빛숲 · 벌목장 개편 예정'",
         "hint:'벌목장 입구 → 잔빛숲'",
         "P0-2 gate hint")

# ---------------------------------------------------------------- P0-3: mining-mode life-action hint
# Root cause: ssM17NearbyObject()/ssM17NearObject() return false while
# ssM15Scene==='mining', so in manual mining mode the forest action button
# (#m1ActionBtn) has no item and hides — the player at a tree sees no
# logging button until they find the small mode toggle. Fix: when a living
# object is nearby in mining mode, show the action button as a mode-switch
# hint instead of hiding it.
rep_once("  const livingObject=ssM17NearbyObject();if(livingObject)return {label:ssM17ActionLabel(livingObject),act:'m17-object',targetId:livingObject.id};",
         "  if(ssM15Scene==='mining'){const _nl=SS_M17_OBJECTS.find(o=>{const _dy=p.y-(terrain(o.x)-1),_dx=p.x-o.x;return Math.abs(_dx)<=3.15&&Math.abs(_dy)<=2.75&&Math.hypot(_dx,_dy*1.3)<=3.85;});if(_nl)return {label:_nl.type==='tree'?'🪓 벌목은 생활 조작에서 · ↩ 생활 조작으로 바꾸기':'↩ 생활 조작으로 바꿔 이용하기',act:'life-mode'};}\n  const livingObject=ssM17NearbyObject();if(livingObject)return {label:ssM17ActionLabel(livingObject),act:'m17-object',targetId:livingObject.id};",
         "P0-3 mining-mode life hint")
rep_once(" if(choice.act==='m17-object')return ssM17DoAction(choice.targetId);",
         " if(choice.act==='life-mode'){ssM15ToggleToolMode();return true;}\n if(choice.act==='m17-object')return ssM17DoAction(choice.targetId);",
         "P0-3 life-mode action")

# ---------------------------------------------------------------- P0-4: first mineable location
# Root cause (verified in code): mine terrain(x)=79 for x 19..67, and the
# historic surface apron makes y79-80 'stationrock' (HP 9999, unmineable)
# across that whole range. The mine portal spawns the player at X40.5, so
# the first thing a new player tries — digging straight down at X44~55 —
# hits protected floor: the stick-pad scan shows a transient notice and
# long-press (holdTarget) returns null with NO notice at all. At X69 the
# apron ends, so dirt/stone mines normally. Fix: name the protected floor
# and point at the nearest diggable ground (east X68+ / west X18-), in
# every stationrock notice path, plus a one-line entry flash while the
# crystal quest is still open.
rep_once("function tileAction(x,y,force=false){",
         "function ssP0ProtectedFloorMsg(x){if(ssRegion!=='mine')return '승강장·시설 바닥은 보호되어 채굴할 수 없어요';if(x>=19&&x<=67)return '이 바닥은 승강장 보호 구역이에요 · 동쪽 X68 이후(또는 서쪽 X18 이전) 흙벽에서 아래로 캘 수 있어요';return '승강장·시설 바닥은 보호되어 채굴할 수 없어요';}\n function tileAction(x,y,force=false){",
         "P0-4 protected-floor helper")
rep_once("ssMineNotice(t==='stationrock'?'승강장·시설 바닥은 보호되어 채굴할 수 없어요':'기반암은 채굴할 수 없어요',true)",
         "ssMineNotice(t==='stationrock'?ssP0ProtectedFloorMsg(x):'기반암은 채굴할 수 없어요',true)",
         "P0-4 tileAction notice")
rep_once("ssMineNotice(t==='stationrock'?'시설 바닥은 보호되어 채굴할 수 없어요':'기반암은 채굴할 수 없어요');return null;",
         "ssMineNotice(t==='stationrock'?ssP0ProtectedFloorMsg(x):'기반암은 채굴할 수 없어요');return null;",
         "P0-4 miningTarget notice")
rep_once("if(holdTarget){let t=tile(holdTarget.x,holdTarget.y);return t&&t!=='bedrock'&&t!=='stationrock'&&canReach(holdTarget.x,holdTarget.y)?holdTarget:null}",
         "if(holdTarget){let t=tile(holdTarget.x,holdTarget.y);if(t==='stationrock'&&canReach(holdTarget.x,holdTarget.y))ssMineNotice(ssP0ProtectedFloorMsg(holdTarget.x));return t&&t!=='bedrock'&&t!=='stationrock'&&canReach(holdTarget.x,holdTarget.y)?holdTarget:null}",
         "P0-4 holdTarget notice")
rep_once("flash(target==='mine'?'광산에 도착했어요':target===TOWN_WORLD_ID?'도래마을에 도착했어요':'새 지역 발견 · 잔빛숲');return true;",
         "flash(target==='mine'&&targetX>=19&&targetX<=67&&game.storyM1&&!game.storyM1.crystalSeen?'광산 입구 바닥은 보호 구역 · 동쪽 X68 흙벽에서 아래로 파세요':target==='mine'?'광산에 도착했어요':target===TOWN_WORLD_ID?'도래마을에 도착했어요':'새 지역 발견 · 잔빛숲');return true;",
         "P0-4 mine entry flash")

# ---------------------------------------------------------------- P0-5: fullmap labels + touch wording
# Fullmap label(): only 3 downward shifts, then it draws overlapping
# anyway (e.g. '여울' vs '연못'/'낚시터 입구', '서온' vs '유적 입구' at
# 390px). Fix: 9 tries alternating down/up, smaller fonts when the canvas
# is narrow, and skip non-essential labels that still collide instead of
# drawing over another label. Gates and '나' always draw.
rep_once("const rects=[];\n const label=(x,z,text,fs,bold)=>{c.font=(bold?'800 ':'')+fs+'px system-ui';c.textAlign='center';const tw=c.measureText(text).width+12;let cx=Math.max(tw/2+4,Math.min(W-tw/2-4,X(x))),cy=Math.max(fs+6,Math.min(H-6,Z(z)));for(let k=0;k<3;k++){let hit=false;for(const r of rects){if(cx-tw/2<r.x1&&cx+tw/2>r.x0&&cy-fs-4<r.y1&&cy+6>r.y0){hit=true;break;}}if(!hit)break;cy=Math.min(H-6,cy+fs+8);}rects.push({x0:cx-tw/2,x1:cx+tw/2,y0:cy-fs-4,y1:cy+6});c.fillStyle='#123c';c.beginPath();c.roundRect(cx-tw/2,cy-fs-4,tw,fs+10,6);c.fill();c.fillStyle='#fff3d1';c.fillText(text,cx,cy+3);};",
         "const rects=[];\n const _fsScale=W<400?0.85:1;\n const label=(x,z,text,fs,bold,essential)=>{fs=Math.max(9,Math.round(fs*_fsScale));c.font=(bold?'800 ':'')+fs+'px system-ui';c.textAlign='center';const tw=c.measureText(text).width+12;let cx=Math.max(tw/2+4,Math.min(W-tw/2-4,X(x)));const step=fs+6;let cy=Math.max(fs+6,Math.min(H-6,Z(z))),placed=false;for(let k=0;k<9;k++){const off=[0,1,-1,2,-2,3,-3,4,-4][k];const tryCy=Math.max(fs+6,Math.min(H-6,Z(z)+off*step));let hit=false;for(const r of rects){if(cx-tw/2<r.x1&&cx+tw/2>r.x0&&tryCy-fs-4<r.y1&&tryCy+6>r.y0){hit=true;break;}}if(!hit){cy=tryCy;placed=true;break;}}if(!placed&&!essential)return;rects.push({x0:cx-tw/2,x1:cx+tw/2,y0:cy-fs-4,y1:cy+6});c.fillStyle='#123c';c.beginPath();c.roundRect(cx-tw/2,cy-fs-4,tw,fs+10,6);c.fill();c.fillStyle='#fff3d1';c.fillText(text,cx,cy+3);};",
         "P0-5 fullmap label collision")
rep_once("for(const t of T25_TARGETS){if(t.type==='gate')label(t.x,t.z-1.6,gateName[t.id]||t.title,13,true);}",
         "for(const t of T25_TARGETS){if(t.type==='gate')label(t.x,t.z-1.6,gateName[t.id]||t.title,13,true,true);}",
         "P0-5 gate labels essential")
rep_once("label(town25dPlayer.x,town25dPlayer.z+1.4,'나',13,true);",
         "label(town25dPlayer.x,town25dPlayer.z+1.4,'나',13,true,true);",
         "P0-5 player label essential")
# Touch devices showed PC key hints (WASD/E) in town, ruins and farm.
rep_once("save:()=>saveGame(true)};\n})();",
         "save:()=>saveGame(true)};\n try{if(window.matchMedia&&matchMedia('(pointer:coarse)').matches){const _th=document.querySelector('.t25-help');if(_th)_th.textContent='조이스틱 이동 · E 버튼 이용 · 미니맵을 눌러 자동 이동';const _ag=document.querySelector('.arch-guide');if(_ag)_ag.textContent='조이스틱 이동 · 화면 드래그 시점 회전 · 조사 버튼 이용';const _fk=document.querySelector('.farm-keyhint');if(_fk)_fk.textContent='· 조이스틱 이동 · 작업 버튼';}}catch(_){}\n})();",
         "P0-5 touch wording")

# ---------------------------------------------------------------- P0-6: rescue without native confirm()
# Yeoul (remote-input play): after tapping free rescue, the page looked
# unresponsive; refresh recovered at the pre-rescue position, i.e. the
# rescue never ran. The rescue path uses synchronous native confirm(),
# which blocks the JS thread and is invisible/unanswerable in some
# remote/headless inputs. travelStation/rescuePlayer themselves are
# synchronous and cannot hang. Fix: ask inside the game modal instead.
rep_once("function ssHubNavigate(target){",
         "function ssRescueConfirm(){showModal('↥ 긴급 구조','<p>마지막 안전 정거장으로 무료 이동할까요?</p><p class=\"note\">이동하면 구조 전 위치로는 돌아갈 수 없어요.</p><div class=\"stack\"><button class=\"cta\" id=\"ssRescueGo\" type=\"button\">무료로 이동하기</button></div>');const _g=$('ssRescueGo');if(_g)_g.onclick=()=>{rescuePlayer();};}\n function ssHubNavigate(target){",
         "P0-6 rescue confirm helper")
rep_once("$('ssEmergencyRescue').onclick=()=>{if(confirm('마지막 안전 정거장으로 이동할까요?'))rescuePlayer();};",
         "$('ssEmergencyRescue').onclick=()=>{ssRescueConfirm();};",
         "P0-6 settings rescue")
rep_once("case 'rescue': if(confirm('마지막 안전 정거장으로 무료 이동할까요?'))rescuePlayer();break;",
         "case 'rescue': ssRescueConfirm();break;",
         "P0-6 hub rescue")

DST.write_text(html, encoding="utf-8")
print(f"patched HTML: {len(html):,} chars (base {orig_len:,}, +{len(html)-orig_len:,})")
print("sha256:", hashlib.sha256(html.encode()).hexdigest())

# ---- guardrails: markers, counts, node --check on script blocks
assert html.count("phase0-20261123") == 1, "phase0 marker count wrong"
assert html.count("town-v35-20261122") == 1, "renewal marker v35 wrong"
assert "town-v34-20261122" not in html, "old marker present"
assert html.count("t25QuestText") == 2, ("t25QuestText count wrong", html.count("t25QuestText"))
assert "마을 동쪽 X64 출입구에서 잔빛숲으로 이동하세요." not in html
assert "잔빛숲 · 벌목장 개편 예정" not in html
assert "벌목장 입구(X64)" in html
assert html.count("ssRescueConfirm") == 3, "ssRescueConfirm count wrong"
assert "confirm('마지막 안전 정거장으로" not in html, "rescue confirm() still present"
assert "confirm('마지막 안전 정거장으로 무료 이동할까요?')" not in html
assert html.count("ssP0ProtectedFloorMsg") == 4, ("helper count wrong", html.count("ssP0ProtectedFloorMsg"))
assert "life-mode" in html and "ssM15ToggleToolMode" in html
assert "WASD 이동 · E 이용" in html, "town help text changed by mistake (only touch runtime swaps it)"
blocks = re.findall(r"<script>(.*?)</script>", html, re.S)
assert len(blocks) == 3, ("script block count changed", len(blocks))
for bi, bb in enumerate(blocks):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as pf:
        pf.write(bb); fname = pf.name
    r = subprocess.run(["node", "--check", fname], capture_output=True, text=True)
    assert r.returncode == 0, (f"script block {bi} syntax error", r.stderr[:500])
print("node --check: all 3 script blocks PASS")
print("guardrails PASS")
