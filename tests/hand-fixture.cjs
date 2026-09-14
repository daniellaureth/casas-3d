// Anatomical joint positions shared by geometry, gesture and visual checks.
module.exports=function makeHand(T,{forward=false,left=false}={}) {
  const hand=new T.Group();hand.joints={};hand.userData.handedness=left?'left':'right';
  function joint(name,x,y,z=0,r=.008){const p=new T.Group();p.position.set(left?-x:x,y,z);p.jointRadius=r;hand.joints[name]=p;hand.add(p);}
  joint('wrist',0,0);
  ['thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip'].forEach((name,i)=>joint(name,-.021-i*.015,.025+i*.019,0,.01-i*.001));
  ['index-finger','middle-finger','ring-finger','pinky-finger'].forEach((name,f)=>{
    const x=[-.026,-.004,.019,.039][f],factor=[.96,1,.93,.76][f];
    ['metacarpal','phalanx-proximal','phalanx-intermediate','phalanx-distal','tip'].forEach((part,i)=>joint(name+'-'+part,x,[.035,.08,.12,.145,.17][i]*factor,0,[.01,.009,.008,.007,.006][i]));
  });
  if(forward){hand.rotation.x=-Math.PI/2;hand.position.set(.15,1.35,-.4);}hand.updateMatrixWorld(true);return hand;
};
