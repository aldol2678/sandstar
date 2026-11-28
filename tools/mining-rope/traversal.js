function detachRopeWithoutJump(){
 if(!rope.active)return false;
 const a=rope.anchor;
 if(a){ropeSnap={ax:a.faceX,ay:a.faceY,bx:p.x,by:p.y-PLAYER_CENTER_FROM_FEET,life:.24,maxLife:.24};}
 const preserveSwing=rope.mode==='swing';
 releaseRope();
 if(!preserveSwing){p.vx=0;p.vy=0;}
 p.grounded=false;ropeGrabCooldown=Math.max(ropeGrabCooldown,.18);
 input.reelIn=false;input.reelOut=false;
 ropeStatusNotice=.6;
 flash('로프 해제 · 점프 없이 자유낙하');
 return true;
}
function toggleRope(){
 if(paused||ssM16TransitionLocked)return false;
 if(rope.active)return detachRopeWithoutJump();
 ropeAutoMoveEnabled=false;
 if(ropeGrabCooldown>0&&!(ropeChainWindow>0&&ropeChainRemaining>0&&!collides(p.x,p.y+.055)))return false;
 const chaining=ropeChainWindow>0&&ropeChainRemaining>0&&!collides(p.x,p.y+.055);
 const a=findRopeAnchor();
 if(!a){flash('위쪽에 잡을 수 있는 암벽과 빈 통로가 필요해요');playSound('ui_error');return false;}
 if(chaining){
  ropeChainRemaining--;ropeChainWindow=0;ropeGrabCooldown=0;
  const d=Math.hypot(p.x-a.faceX,p.y-PLAYER_CENTER_FROM_FEET-a.faceY);
  rope={active:true,anchor:a,targetY:a.targetY,attached:true,mode:'swing',swingLength:Math.max(ROPE_MIN_LENGTH,Math.min(ROPE_MAX_LENGTH,d+.12)),swingElapsed:0};
 }else{
  rope={active:true,anchor:a,targetY:a.targetY,originY:p.y,attached:false,mode:'vertical',surfaceExitPlan:a.surfaceExitPlan||null};
 }
 ropeAscentStartY=p.y;ropeStatusNotice=.95;
 p.vy=0;p.vx=0;
 holdTarget=null;holdLast=null;holdProgress=0;stopMineStick();
 if(hudPadDir)hudRefreshPadInput();
 return true;
}

// Once attached, motion along the rope requires directional input or the auto button.
function moveAlongRope(dt, dir) {
 const pulling = rope.mode === 'pull';
 if (dir && (!pulling || rope.attached)) {
  if (pulling) {
   startRopeSwing(dir);
  } else {
   const distance = Math.hypot(p.x-rope.anchor.faceX, p.y-PLAYER_CENTER_FROM_FEET-rope.anchor.faceY);
   rope.mode = 'swing';
   rope.attached = true;
   rope.swingLength = Math.min(ROPE_MAX_LENGTH, Math.max(ROPE_MIN_LENGTH, distance+.08));
   rope.swingElapsed = 0;
   rope.swingStarted = true;
   p.vx = dir*2.4;
   p.vy = 0;
  }
  updateRopeSwing(dt, dir);
  return;
 }

 p.vx = p.vy = 0;
 p.grounded = false;
 coyoteTime = 0;
 const up = input.reelIn || ropeAutoMoveEnabled;
 if (!up) rope.nextSearchSpent = false;
 const direction = Number(up) - Number(input.reelOut);
 if (direction) {
  const ascending = direction > 0;
  const endX = pulling ? (ascending ? rope.targetX : rope.originX) : p.x;
  const endY = ascending ? rope.targetY : (rope.originY ?? p.y);
  const dx = endX-p.x, dy = endY-p.y;
  const distance = Math.hypot(dx,dy);
  if (distance > .001) {
   const travel = Math.min(distance, mobilityDerived().ropeClimbSpeed*ssCargoRopeFactor()*dt);
   const beforeX = p.x, beforeY = p.y;
   moveStep(dx/distance*travel, dy/distance*travel);
   if (ropeAutoMoveEnabled && Math.hypot(p.x-beforeX,p.y-beforeY) < travel*.05) {
    ropeAutoMoveEnabled = false;
   }
  }
  if (!ascending) rope.attached = false;
  else if (Math.hypot(endX-p.x,endY-p.y) <= .065) {
   if (!rope.attached) {
    rope.attached = true;
    // A descent and second ascent on the same line must not award another ascent.
    if (!rope.ascentCounted && !rope.surfaceExitPlan) noteRopeAscent();
    rope.ascentCounted = true;
   }
   if (pulling) ropeAutoMoveEnabled = false;
   else if (!rope.nextSearchSpent) {
    rope.nextSearchSpent = true;
    if (rope.surfaceExitPlan && finishRopeSurfaceExit()) {
     moveCamera(dt);
     return;
    }
    const next = findRopeAnchor(true);
    if (next && next.targetY < p.y-.08) {
     rope = {active:true, anchor:next, targetY:next.targetY, attached:false,
      mode:'vertical', originY:p.y, surfaceExitPlan:next.surfaceExitPlan || null};
     ropeAscentStartY = p.y;
    } else ropeAutoMoveEnabled = false;
   }
  }
 }
 moveCamera(dt);
}
