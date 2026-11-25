"""Apply the farm cart and plot artwork to the v44 rebuild or a current extracted game HTML."""
from pathlib import Path
import sys


def patch(html):
    def replace(old, new):
        nonlocal html
        if html.count(old) != 1:
            raise ValueError(f"Expected one farm anchor: {old[:70]}")
        html = html.replace(old, new, 1)

    helpers = Path(__file__).with_name("farm.js").read_text()
    replace("function farmWorldNearPlot(){", helpers + "\nfunction farmWorldNearPlot(){")
    replace("if(target==='pond')return 64;", "if(target==='farm:cart')return FARM_FOREST_GATE_X;\n if(target==='pond')return 64;")
    replace("  case 'market.sell':{", """  case 'farm.basket':{
   if(cmd.target!=='farm:cart'||context.worldId!==FARM_WORLD_ID)return bad('농장의 장터 수레에서 납품해 주세요');
   if(farmBasketCrops.some(crop=>bag(crop)<1))return bad('밀·감자·당근이 각각 1개 필요해요');
   for(const crop of farmBasketCrops)state.bag[crop]--;
   state.stats.sold+=farmBasketCrops.length;
   award=farmBasketPrice;
   message='바람장터로 한 바구니 납품 · +'+award+'C';break;}
  case 'market.sell':{""")
    replace("if(!near)return '🌾 밭으로 이동하세요';",
            "if(!near)return farmAtCart()?farmCartLabel():'동쪽 밭 · 길가 장터 수레';")
    replace("btn.disabled=!farmWorldNearPlot()&&!farmWorldNearbyGate();",
            "btn.disabled=!farmWorldNearPlot()&&!farmWorldNearbyGate()&&!farmAtCart();")
    replace("if(tx===null)return false;\n // The existing P1.1",
            "if(tx===null||(target==='farm:cart'&&(!farmWorldActive||!farmAtCart())))return false;\n // The existing P1.1")
    replace("cmd,{x:tx,y:76,groundY:76,inv:game.inv,coins:game.coins,seed:game.seed});\n if(!r.ok){farmWorldToast",
            "cmd,{x:tx,y:76,groundY:76,inv:game.inv,coins:game.coins,seed:game.seed,worldId:FARM_WORLD_ID});\n if(!r.ok){farmWorldToast")
    replace("if(farmWorldNearbyGate())return farmWorldTryExit();\n const near=",
            "if(farmWorldNearbyGate())return farmWorldTryExit();\n if(farmAtCart())return farmWorldCommand('farm.basket','farm:cart');\n const near=")
    replace("for(const o of FARM_PLOTS)farmDrawPlot(c,o);", "farmDrawCart(c);\n for(const o of FARM_PLOTS)farmDrawPlot(c,o);")
    start_building = html.index("function farmDrawHouse(")
    end_building = html.index("function farmDrawPlot(", start_building)
    replace(html[start_building:end_building], "")
    replace("farmDrawHouse(c,8,4", "farmDrawBuilding(c,8,4")
    replace("farmDrawHouse(c,33,4", "farmDrawBuilding(c,33,4")
    replace("]])farmDrawTree(c,x,y);", "]])farmDrawOrchardTree(c,x,y);")
    replace("c.fillText('← 잔빛숲',px+8,py-47)", "c.fillText('← 도래마을',px+8,py-47)")
    start_tile = html.index("  const px=x*t,py=y*t,road=path(x,y);")
    end_tile = html.index("\n }\n // Outer fence", start_tile)
    replace(html[start_tile:end_tile], "  farmDrawGround(c,x,y,path);")
    begin = html.index(" c.fillStyle='#4f6944';", html.index("function farmDrawPlot("))
    end = html.index(" if(plot?.plantedAt", begin)
    replace(html[begin:end], " const plot=game?.livingP0?.plots?.[o.id];\n farmDrawBed(c,px,py,w,h,plot);\n")
    begin = html.index("  if(plot.watered){c.fillStyle='#5f4635';", begin)
    replace(html[begin:html.index("  const img=", begin)], "")
    replace(" if(farmWorldNearPlot()?.id===o.id){", " farmDrawProgress(c,px+9,py+h-1,w-18,plot);\n if(farmWorldNearPlot()?.id===o.id){")
    replace(":'밭 '+num;", ":'빈 밭 · 씨 뿌리기';")
    replace("const num=o.id.split(':')[1],lab=", "const lab=")
    replace("`밭 ${num} · ${plot.crop", "`${plot.crop")
    replace("?' 💧':' 마름'", "?' · 자라는 중':' · 물 주기'")
    return html


if __name__ == "__main__":
    source, output = map(Path, sys.argv[1:])
    output.write_text(patch(source.read_text()))
