#!/usr/bin/env python3
"""Build a Worker candidate from the archived SANDSTAR v38 module.

Usage: python3 tools/onboarding/patch-v38.py v38-main.mjs candidate-main.mjs
"""

import argparse
import hashlib
import json
from pathlib import Path


V38_SHA256 = "78b4503ad11f8944710bef061d861e95befc72b5debfc719e205c6c02c60ed07"


def replace_once(source, old, new):
    count = source.count(old)
    if count != 1:
        raise ValueError(f"expected one match, found {count}: {old[:90]!r}")
    return source.replace(old, new, 1)


def patch_html(html):
    # Preserve the flat surface profile and all save data. Only the immutable
    # projection in stationProtectedType changes. Other lift footprints stay intact.
    html = replace_once(
        html,
        "function stationProtectedType(x,y){",
        """const M1_FIRST_DIG_X=TOWN_MINE_PORTAL_X+6;
function ssM1MineFixtureAt(x){
 return (x>=TOWN_MINE_PORTAL_X-2&&x<M1_FIRST_DIG_X)
  ||Math.abs(x-M1_MINE_CRYSTAL_X)<=1;
}
function stationProtectedType(x,y){""",
    )
    html = replace_once(
        html,
        """  // Restore the historic surface apron over all former settlement coordinates.
  // Overrides old excavated cells in the read layer only; edits stay in the mine save.
  if(ssRegion==='mine'&&x>=19&&x<=67){""",
        """  // Keep the mine entrance, spawn landing and crystal accessible.
  // The remaining surface uses natural tiles and existing mine edits.
  if(ssRegion==='mine'&&ssM1MineFixtureAt(x)){""",
    )
    html = replace_once(
        html,
        "function ssP0ProtectedFloorMsg(x){if(ssRegion!=='mine')return '승강장·시설 바닥은 보호되어 채굴할 수 없어요';if(x>=19&&x<=67)return '이 바닥은 승강장 보호 구역이에요 · 동쪽 X68 이후(또는 서쪽 X18 이전) 흙벽에서 아래로 캘 수 있어요';return '승강장·시설 바닥은 보호되어 채굴할 수 없어요';}",
        """function ssP0ProtectedFloorMsg(x){
 if(ssRegion==='mine'&&x>=31&&x<=45)return `승강장과 출입구 바닥은 보호돼요. 동쪽 X${M1_FIRST_DIG_X}부터 캘 수 있어요.`;
 if(ssRegion==='mine'&&Math.abs(x-M1_MINE_CRYSTAL_X)<=1)return '광맥 바로 아래는 보호돼요. 양옆의 흙을 캐세요.';
 return '승강장·시설 바닥은 보호되어 채굴할 수 없어요';
}""",
    )
    html = replace_once(
        html,
        " if(!st.crystalSeen)return '마을 광산 입구 X40으로 내려가 X55의 빛나는 광맥을 조사하세요.';",
        """ if(!st.crystalSeen){
  if(game.mined<1)return `광산 X${M1_FIRST_DIG_X}에서 한 번 채굴한 뒤 X${M1_MINE_CRYSTAL_X} 광맥을 조사하세요.`;
  return `광산 X${M1_MINE_CRYSTAL_X}의 빛나는 광맥을 조사하세요.`;
 }""",
    )
    html = replace_once(
        html,
        "visionCache.cx=-999;updateVisionCache(true);updHud();flash(target==='mine'&&targetX>=19&&targetX<=67&&game.storyM1&&!game.storyM1.crystalSeen?'광산 입구 바닥은 보호 구역 · 동쪽 X68 흙벽에서 아래로 파세요':target==='mine'?'광산에 도착했어요':target===TOWN_WORLD_ID?'도래마을에 도착했어요':'새 지역 발견 · 잔빛숲');return true;",
        """visionCache.cx=-999;updateVisionCache(true);updHud();
 if(target==='mine'){
  flash(!game.storyM1.crystalSeen&&game.mined<1?`입구 동쪽 X${M1_FIRST_DIG_X}에서 아래 방향으로 한 번 캐세요.`:'광산에 도착했어요');
 }else if(target===TOWN_WORLD_ID){
  flash('도래마을에 도착했어요');
 }else{
  flash(prevStory.forestVisited?'잔빛숲에 도착했어요':'새 지역 발견 · 잔빛숲 · 턱은 이동하면서 점프해 넘으세요.');
 }
 return true;""",
    )
    html = replace_once(
        html,
        """function moveStep(dx,dy){if(dx){let n=Math.ceil(Math.abs(dx)/.14);for(let i=0;i<n;i++){let d=dx/n;if(!collides(p.x+d,p.y))p.x+=d;else {if(input.left||input.right)ssMineNotice('이동이 막혔어요 · 앞의 블록을 채굴하거나 다른 길로 이동하세요');p.vx=0;break}}}""",
        """function ssBlockedMoveNotice(nextX){
 if(ssRegion==='life_forest_01'){
  const surface=ssM1ForestTerrain(p.x);
  const leadingEdge=nextX+Math.sign(nextX-p.x)*PLAYER_HALF_WIDTH;
  if(surface-ssM1ForestTerrain(leadingEdge)===1&&Math.abs(p.y-(surface-1))<.35){
   return '낮은 턱이에요. 이동하면서 점프해 넘으세요.';
  }
 }
 return '이동이 막혔어요 · 앞의 블록을 채굴하거나 다른 길로 이동하세요';
}
function moveStep(dx,dy){if(dx){let n=Math.ceil(Math.abs(dx)/.14);for(let i=0;i<n;i++){let d=dx/n;if(!collides(p.x+d,p.y))p.x+=d;else {if(input.left||input.right)ssMineNotice(ssBlockedMoveNotice(p.x+d));p.vx=0;break}}}""",
    )
    return html


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    data = args.baseline.read_bytes()
    if hashlib.sha256(data).hexdigest() != V38_SHA256:
        parser.error("baseline SHA-256 does not match the archived v38 Worker")
    if args.output.resolve() == args.baseline.resolve():
        parser.error("output must be separate from the baseline")

    source = data.decode("utf-8")
    start = source.index('const HTML="') + len("const HTML=")
    html, length = json.JSONDecoder().raw_decode(source[start:])
    patched = json.dumps(patch_html(html), ensure_ascii=False)
    output = (source[:start] + patched + source[start + length:]).encode("utf-8")
    args.output.write_bytes(output)
    print(f"{hashlib.sha256(output).hexdigest()}  {args.output}")


if __name__ == "__main__":
    main()
