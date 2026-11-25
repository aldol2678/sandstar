"""Apply the farm cart and plot artwork to the v44 rebuild or a current extracted game HTML."""
from pathlib import Path
import sys

def add_land(replace):
    defs = """const FARM_LAND = Object.freeze([
 {id:'farm:west-field', x:24, y:24, name:'남쪽 서편 밭', price:60},
 {id:'farm:east-field', x:30, y:24, name:'남쪽 동편 밭', price:120}
]);
function farmLandById(id){return FARM_LAND.find(lot=>lot.id===id);}
function emptyLivingPlot(){return {plantedAt:null,watered:false,crop:null,stage:0,wateredAt:null};}
"""
    replace("function freshLivingP0(){", defs + "function freshLivingP0(){")
    replace("plots[`plot:${x}`]={plantedAt:null,watered:false,crop:null,stage:0,wateredAt:null};",
            "plots[`plot:${x}`]=emptyLivingPlot();")
    # The presence of an allowlisted plot record represents ownership. Old saves still get three beds.
    replace(" if(raw.plots&&typeof raw.plots==='object')for", """ if(raw.plots&&typeof raw.plots==='object'){
  for(const lot of FARM_LAND){
   const saved=raw.plots[lot.id];
   if(saved&&typeof saved==='object'&&!Array.isArray(saved)&&livingOwn(saved,'plantedAt'))
    state.plots[lot.id]=emptyLivingPlot();
  }
 }
 if(raw.plots&&typeof raw.plots==='object')for""")
    replace("{id:'plot:40',x:30,y:15}]);", "{id:'plot:40',x:30,y:15},...FARM_LAND]);")
    replace("if(target==='farm:cart')return FARM_FOREST_GATE_X;", """const lot=farmLandById(target);
 if(lot)return lot.x;
 if(target==='farm:cart')return FARM_FOREST_GATE_X;""")
    replace(" let award=0,message='',kind=cmd.type;", """ const lot=farmLandById(cmd.target);
 if(lot&&context.worldId!==FARM_WORLD_ID)return bad('도래 농장에서 이용해 주세요');
 let award=0,message='',kind=cmd.type;""")
    replace("  case 'farm.basket':{", """  case 'farm.buyPlot':{
   if(!lot)return bad('구매할 수 있는 밭이 아니에요');
   if(livingOwn(state.plots,lot.id))return bad('이미 보유한 밭이에요');
   if(context.coins<lot.price)return bad('골드가 '+(lot.price-context.coins)+'C 부족해요');
   award=-lot.price;
   state.plots[lot.id]=emptyLivingPlot();
   message=lot.name+' 구매 완료 · 씨앗을 심어 보세요';break;}
  case 'farm.basket':{""")
    replace("if(tx===null||(target==='farm:cart'", """if(farmLandById(target)&&(!farmWorldActive||farmWorldNearPlot()?.id!==target))return false;
 if(tx===null||(target==='farm:cart'""")
    replace("if(!plot)return '🌾 경작 준비 중';", """if(!plot&&near.price){
  const gap=near.price-game.coins;
  return gap>0?`밭 ${near.price}C · ${gap}C 부족`:`밭 구매 ${near.price}C · 보유 ${game.coins}C`;
 }
 if(!plot)return '🌾 경작 준비 중';""")
    replace("function farmWorldAction(){", "function farmWorldAction(buy=false){")
    replace("const plot=game.livingP0.plots[near.id];\n if(plot.plantedAt===null)", """const plot=game.livingP0.plots[near.id];
 if(!plot&&near.price){
  if(buy===true)return farmWorldCommand('farm.buyPlot',near.id);
  farmWorldToast(near.name+' · 구매 버튼에서 '+near.price+'C로 개간');return false;
 }
 if(plot.plantedAt===null)""")
    replace(".addEventListener('click',farmWorldAction);", ".addEventListener('click',()=>farmWorldAction(true));")
    replace("if(['e',' '].includes(k)&&!e.repeat)farmWorldAction();", "if(['e',' '].includes(k)&&!e.repeat)farmWorldAction(true);")
    replace(" farmDrawBed(c,px,py,w,h,plot);", """ if(!plot&&o.price){farmDrawLandForSale(c,px,py,w,h,o);return;}
 farmDrawBed(c,px,py,w,h,plot);""")
    replace("farmDrawSign(c,23,21,'✦ 별맥 토양')", "farmDrawSign(c,23,20,'↓ 밭 분양')")
    replace("'동쪽 밭 · 길가 장터 수레'", "'동쪽 밭 · 남쪽 분양지'")


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
    add_land(replace)
    return html


if __name__ == "__main__":
    source, output = map(Path, sys.argv[1:])
    output.write_text(patch(source.read_text()))
