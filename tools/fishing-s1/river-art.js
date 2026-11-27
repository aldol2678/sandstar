// A-only visual layer. Simulation coordinates and the world stay unchanged.
const ssRiverImages={};
const ssRiverMotion=matchMedia('(prefers-reduced-motion: reduce)');
const ssRiverArtRoot='/fishing-s1/a-v03/';
const ssRiverArt=['far-background','underwater-gradient','surface-tile','bottom-tile','front-bank',
 'angler-atlas','river_fish','perch','carp','prop-reeds','prop-stones','bobber-32'];
let ssRiverCastAt=-Infinity,ssRiverPoseName='',ssRiverPoseAt=0;
function ssRiverLoadImage(key,root){
 if(!ssRiverImages[key]){const img=new Image();img.src=root+key+'.webp';ssRiverImages[key]=img;}
}
let ssRiverGrain=null;
function ssRiverGrainFill(c,x,y,w,h,opacity){
 if(!ssRiverGrain){
  const tile=document.createElement('canvas');tile.width=127;tile.height=113;
  const g=tile.getContext('2d');let seed=7741;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<980;i++){
   const dark=rnd()<.48,x0=Math.floor(rnd()*127),y0=Math.floor(rnd()*113);
   g.globalAlpha=.16+rnd()*.44;g.fillStyle=dark?'#123330':'#e5d4a5';
   g.fillRect(x0,y0,1+Math.floor(rnd()*3),1+Math.floor(rnd()*2));
  }
  ssRiverGrain=c.createPattern(tile,'repeat');
 }
 c.save();c.globalAlpha=opacity;c.fillStyle=ssRiverGrain;c.fillRect(x,y,w,h);c.restore();
}
function ssRiverAView(){
 if(ssRiver.spot!=='A'||!ssRiverArt.every(key=>ssRiverImage(key)))return null;
 const H=ssRiver.H,head=Math.min(31,H*.077);
 return {head,sy:1-head/H};
}
function ssRiverPaintA(c,W,H,surf,bot,bank,t,top){
 c.drawImage(ssRiverImage('far-background'),0,0,780,198,0,top,W,surf-top+2);
 const haze=c.createLinearGradient(0,top,0,surf);
 haze.addColorStop(0,'#587c6744');haze.addColorStop(1,'#e2c98c38');
 c.fillStyle=haze;c.fillRect(0,top,W,surf-top);
 const water=c.createLinearGradient(0,surf,0,H);
 water.addColorStop(0,'#397f77');water.addColorStop(.47,'#24574f');water.addColorStop(1,'#152f32');
 c.fillStyle=water;c.fillRect(0,surf,W,H-surf);
 c.save();c.globalAlpha=.38;c.drawImage(ssRiverImage('underwater-gradient'),0,197,780,323,0,surf,W,H-surf);c.restore();
 const light=c.createRadialGradient(W*.61,surf,0,W*.61,surf,Math.max(W*.60,H*.56));
 light.addColorStop(0,'#afc99e4d');light.addColorStop(.5,'#82be9240');light.addColorStop(1,'#82be9200');
 c.fillStyle=light;c.fillRect(0,surf,W,H-surf);
 c.drawImage(ssRiverImage('bottom-tile'),0,21,780,119,0,bot,W,H-bot);
 c.fillStyle='#473c2d2b';c.fillRect(0,bot,W,H-bot);
 ssRiverGrainFill(c,0,top,W,surf-top,.17);
 ssRiverGrainFill(c,0,surf,W,bot-surf,.11);
 ssRiverGrainFill(c,0,bot,W,H-bot,.22);
 const flow=ssRiverMotion.matches?0:Math.floor(t*8)%W;
 for(const x of [-flow,W-flow])c.drawImage(ssRiverImage('surface-tile'),x,surf-8,W+1,37);
 const img=ssRiverImage('front-bank'),bankW=bank*1.40;
 // Preserve the reviewed ledge and keep the walkable water clear.
 c.drawImage(img,0,116,247,31,0,surf-26,bankW,20);
 c.drawImage(img,0,147,247,159,0,surf-6,bankW,H-surf+6);
 const w=Math.max(26,Math.min(58,W*.09));
 c.drawImage(ssRiverImage('prop-stones'),W*.63,bot-w*.38,w,w*.58);
}
function ssRiverDrawAngler(c,surf,bank,t,view){
 const phase=ssRiver.phase;
 const pose=ssRiver.paused||phase==='result'?'rest':phase==='lure'&&t-ssRiverCastAt<.46?'cast':
  phase==='fight'||(phase==='lure'&&ssRiver.hold)?(ssRiver.hold?'reel':'rest'):'wait';
 if(pose!==ssRiverPoseName){ssRiverPoseName=pose;ssRiverPoseAt=pose==='cast'?ssRiverCastAt:t;}
 const [fps,loop,frames]=ssRiverPoseSpec[pose], elapsed=Math.max(0,Math.floor((t-ssRiverPoseAt)*fps));
 const i=ssRiverMotion.matches?({wait:0,cast:4,reel:2,rest:2})[pose]:loop?elapsed%frames.length:Math.min(frames.length-1,elapsed);
 const [sx,sy,px,py,rx,ry]=frames[i];
 // One scale and foot anchor across all poses. Leave room for the overhead cast frame.
 const scale=Math.max(.21,Math.min(1.10,(surf-12+view.head/view.sy)/127,(bank*1.09-4)/59))/1.6;
 const fx=Math.max(bank*.70,59*scale*1.6+4),fy=surf-6;
 const ox=fx-px*scale,oy=fy-py*scale;
 c.fillStyle='#26352266';c.beginPath();c.ellipse(fx,fy+1,13*scale*1.6,3*scale*1.6,0,0,Math.PI*2);c.fill();
 c.drawImage(ssRiverImage('angler-atlas'),sx,sy,256,256,ox,oy,256*scale,256*scale);
 return [ox+rx*scale,oy+ry*scale];
}
function ssRiverImage(key){
 const img=ssRiverImages[key];return img?.complete&&img.naturalWidth>0?img:null;
}
function ssRiverSheet(c,key,frame,x,y,w,h,cols,px,py,scale){
 const img=ssRiverImage(key);if(!img)return false;
 c.drawImage(img,(frame%cols)*w,Math.floor(frame/cols)*h,w,h,x-px*scale,y-py*scale,w*scale,h*scale);
 return true;
}
