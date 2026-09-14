// Deliberate forward pointing drives the same collision-aware movement as Touch.
function createQuestHandWalk({Vector3,speed=1}) {
  const tip=new Vector3(),base=new Vector3(),thumb=new Vector3(),wrist=new Vector3(),a=new Vector3(),b=new Vector3();
  const direction=new Vector3(),smooth=new Vector3();let held=0,selected=null,active=false;
  function reset(){held=0;selected=null;active=false;smooth.set(0,0,0);}
  function point(hand,name,out){const joint=hand.joints?.[name];if(!joint?.visible)return false;joint.getWorldPosition(out);return true;}
  function update({hands,head,delta,blocked=false,scale=1}) {
    if(blocked){reset();return {x:0,z:0,active:false};}
    let chosen=null;
    for(const hand of hands) {
      if(hand.visible===false||!point(hand,'wrist',wrist)||!point(hand,'index-finger-phalanx-proximal',base)||!point(hand,'index-finger-tip',tip)||!point(hand,'thumb-tip',thumb))continue;
      if(tip.distanceTo(thumb)/scale<.04)continue;
      let length=0,previous=base,valid=true;
      for(const name of ['index-finger-phalanx-intermediate','index-finger-phalanx-distal','index-finger-tip']){
        if(!point(hand,name,a)){valid=false;break;}length+=previous.distanceTo(a);b.copy(a);previous=b;
      }
      if(!valid||length<.02*scale||base.distanceTo(tip)/length<.9)continue;
      direction.copy(tip).sub(base);const full=direction.length();if(Math.abs(direction.y)>full*.55)continue;
      direction.y=0;direction.normalize();
      const dx=(wrist.x-head.x)/scale,dz=(wrist.z-head.z)/scale,distance=Math.hypot(dx,dz);
      if(distance<.23||distance>.9||(dx*direction.x+dz*direction.z)/distance<.55)continue;
      chosen=hand;break;
    }
    if(!chosen){reset();return {x:0,z:0,active:false};}
    if(selected!==chosen){reset();selected=chosen;smooth.copy(direction);}
    held+=Math.min(delta,.05);smooth.lerp(direction,1-Math.exp(-delta*12)).normalize();
    const amount=Math.min(1,Math.max(0,(held-.3)/.3))*speed;active=amount>0;
    return {x:smooth.x*amount,z:smooth.z*amount,active};
  }
  return {update,reset,get active(){return active;}};
}
