const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function mineFixture(){
 const cell=(x,y)=>x+','+y;
 const tiles=new Map(),protectedCells=new Set(),blocked=new Set(),broken=[];
 const engine={
  game:{tool:'drill',drillMotor:{rank:5},hammerCore:{rank:3},edits:{}},
  p:{x:60.5,y:102},ssRegion:'mine',paused:false,ssM16TransitionLocked:false,
  stickActive:true,stickDir:{dx:1,dy:0},holdTarget:null,input:{},rope:{active:false},
  PLAYER_CENTER_FROM_FEET:.8,WW:200,WH:320,key:cell,terrain:()=>79,
  canReach:(x,y)=>!blocked.has(cell(x,y)),tile:(x,y)=>tiles.get(cell(x,y))||null,
  stationGeneratedTile:(x,y)=>protectedCells.has(cell(x,y))?'stationrock':undefined,
  tileHP:()=>40,mineSpark(){},burstMiningPixels(){},holdLast:null,holdProgress:0,mineFXTimer:0,miningHitFX:null,
  breakBlock:(x,y,t,secondary)=>{assert.ok(secondary);assert.equal(tiles.get(cell(x,y)),t);tiles.delete(cell(x,y));broken.push(cell(x,y));return true;}
 };
 const ctx=vm.createContext(engine);
 for(const file of ['drill.js','hammer.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),ctx);
 return {engine,tiles,blocked,protectedCells,broken,run:code=>vm.runInContext(code,ctx)};
}

test('motor acceleration, direction change, overheat and idle cooling',()=>{
 const {engine,run}=mineFixture();
 run('p16DrillWork(.9,"right")');assert.ok(run('p16DrillMotion.spin')>.9);
 run('p16DrillWork(.01,"left")');assert.ok(run('p16DrillMotion.spin')<.3);
 run('for(let i=0;i<300;i++)p16DrillWork(.04,"left")');
 assert.equal(run('p16DrillMotion.overheated'),true);
 assert.equal(run('p16DrillMotion.effective'),1.025);
 run('p16DrillIdle(1)');assert.equal(run('p16DrillMotion.overheated'),true);
 run('p16DrillIdle(1)');assert.equal(run('p16DrillMotion.overheated'),false);
 engine.game.drillBits={owned:['tunnel','hard','cooling'],equipped:'cooling'};
 assert.equal(run('p16a2BitHeatGain()'),.58);assert.equal(run('p16a2BitCoolRate()'),1.5);
});
test('bore head start checks both tiles and grants zero downstream rewards',()=>{
 const {engine,tiles,blocked,protectedCells,broken,run}=mineFixture();
 engine.miningTarget=()=>({x:60,y:101});engine.balanceStats=()=>({});engine.miningRate=()=>100;
 engine.doMine=(x,y)=>tiles.delete(engine.key(x,y));
 function strike(primary='stone',next='stone',spin=.8){
  tiles.set('60,101',primary);tiles.set('61,101',next);
  run('p16ResetDrillMotion(true)');engine.holdProgress=0;run('p16DrillMotion.spin='+spin);
  run('mineHold(.016)');return engine.holdProgress;
 }
 assert.equal(strike(),40*.38);engine.game.drillMotor.rank=4;assert.equal(strike(),40*.24);
 engine.game.drillMotor.rank=3;assert.equal(strike(),0);engine.game.drillMotor.rank=5;
 assert.equal(strike('stone','stone',.02),0);assert.equal(strike('iron'),0);
 for(const t of ['copper','relic','stationrock','chest'])assert.equal(strike('stone',t),0);
 blocked.add('61,101');assert.equal(strike(),0);blocked.clear();
 protectedCells.add('61,101');assert.equal(strike(),0);protectedCells.clear();
 engine.game.edits['60,101']='stone';assert.equal(strike(),0);delete engine.game.edits['60,101'];
 engine.game.edits['61,101']='stone';assert.equal(strike(),0);assert.deepEqual(broken,[]);
 assert.equal(tiles.get('61,101'),'stone');
});
test('hammer wave excludes ore, structures, player edits and unreachable ground; caps chain rewards',()=>{
 const {engine,tiles,blocked,protectedCells,broken,run}=mineFixture();engine.game.tool='hammer';
 for(let x=55;x<=65;x++)for(let y=96;y<=106;y++)tiles.set(engine.key(x,y),'stone');
 for(const t of ['iron','relic','bed','chest','bedrock','stationrock']){
  tiles.set('61,101',t);assert.equal(run('p16HammerEligible(61,101)'),false);
 }
 tiles.set('61,101','stone');blocked.add('61,101');assert.equal(run('p16HammerEligible(61,101)'),false);blocked.clear();
 protectedCells.add('61,101');assert.equal(run('p16HammerEligible(61,101)'),false);protectedCells.clear();
 engine.game.edits['61,101']='stone';assert.equal(run('p16HammerEligible(61,101)'),false);
 // Pre-crack all eligible cells to stress the per-impact chain limit.
 run('for(let x=55;x<=65;x++)for(let y=96;y<=106;y++)p16HammerFractures.set(key(x,y),{x,y,type:"stone",damage:39})');
 run('p16HammerWave(60,101)');assert.equal(broken.length,3);assert.equal(new Set(broken).size,3);
 assert.equal(tiles.get('61,101'),'stone');run('p16ResetTools()');assert.equal(run('p16HammerFractures.size'),0);
});
