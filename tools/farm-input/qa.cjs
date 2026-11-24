// Targeted, deterministic regression checks against actual candidate farm functions.
// Not a browser or device test. No save data or production state is touched.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2],'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,a);return html.slice(i,j);}
const clear=section('let farmTapTarget=null;','function farmWorldActivate');
const blocked=section('function farmWorldBlocked','function farmWorldInitState');
const move=section('function farmWorldMoveDelta(dt)','const farmRand=');
const input=section("farmCanvas.addEventListener('pointerdown'","window.addEventListener('keyup'");
const body=`
let farmMoveKeys=new Set(),farmJoystick={x:0,y:0},farmPointer=null,farmPlayer={x:6.5,y:16.5,face:'down'},farmWorldActive=true,m25bBusy=false,panel=false,farmCanvasW=320,farmCanvasH=320,farmCamera={x:0,y:0},FARM_TILE=32,FARM_W=46,FARM_H=32,FARM_PLOTS=[{id:'plot:34',x:18,y:15}],farmFrame=0,farmToastUntil=0,farmChangeTimer=0,game={farmWorldV1:{}};
let actions=0,exits=0;const ssIsTitle=()=>false,ssScenePanelOpen=()=>panel,farmWorldDraw=()=>{},farmWorldRefreshHud=()=>{},livingWorldTick=()=>{},saveGame=()=>{},farmWorldNearbyGate=()=>Math.hypot(farmPlayer.x-3.9,farmPlayer.y-16.5)<3.1,farmWorldNearPlot=()=>FARM_PLOTS.find(o=>Math.hypot(o.x-farmPlayer.x,o.y-farmPlayer.y)<=3.15),farmWorldAction=()=>actions++,farmWorldTryExit=()=>exits++;
let canvasHandler,joyHandler;const rect={left:0,top:0,width:320,height:320};const farmCanvas={getBoundingClientRect:()=>rect,addEventListener:(k,v)=>canvasHandler=v};const $=id=>({classList:{contains:()=>panel},getBoundingClientRect:()=>rect,addEventListener:(k,v)=>{if(k==='pointerdown')joyHandler=v;}});const window={addEventListener:()=>{}};
${clear}
${blocked}
${move}
${input}
const tap=(x,y,button=0)=>canvasHandler({clientX:x*32-farmCamera.x,clientY:y*32-farmCamera.y,pointerType:'mouse',button,isPrimary:true,preventDefault(){}});const run=()=>{for(let i=0;i<500;i++)farmWorldTick(.016)};const reset=(x=6.5,y=16.5)=>{farmWorldClearInput();farmPlayer={x,y,face:'down'};panel=false;actions=exits=0};const results=[];const check=(name,v)=>results.push({name,pass:!!v});
tap(10,16.5);run();check('tap arrives',Math.hypot(farmPlayer.x-10,farmPlayer.y-16.5)<.04&&farmTapTarget===null);
reset();tap(10,16.5,2);run();check('right-click ignored',farmPlayer.x===6.5);
reset();tap(10,16.5);farmMoveKeys.add('a');farmWorldTick(.016);check('keyboard cancels target',farmTapTarget===null&&farmPlayer.x<6.5);
reset();tap(10,16.5);panel=true;farmWorldTick(.016);check('panel cancels',farmTapTarget===null&&farmPlayer.x===6.5);
reset(6.5,6);tap(16,6);run();check('wall blocks',farmPlayer.x<8&&farmTapTarget===null);
reset();tap(18,15);check('remote plot no action',actions===0&&farmTapTarget!==null);
reset(17,15);tap(18,15);check('near plot works',actions===1&&farmTapTarget===null);
reset();tap(10,16.5);farmWorldClearInput();check('clear stops walk',farmTapTarget===null);
reset();farmCamera={x:64,y:96};tap(10,16.5);check('camera mapping',farmTapTarget?.x===10&&farmTapTarget?.y===16.5);
results;`;
const results=vm.runInNewContext(body,{Math},{timeout:5000});
for(const t of results){console.log(t.pass?'PASS':'FAIL',t.name);assert(t.pass,t.name);}
console.log(results.length+'/'+results.length+' targeted farm input checks passed');
