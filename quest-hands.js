// Two instanced draws per tracked hand; no downloaded models or textures.
function createQuestHandVisual({hand,Group,InstancedMesh,SphereGeometry,CylinderGeometry,MeshBasicMaterial,Vector3}) {
  const fingers=['thumb','index-finger','middle-finger','ring-finger','pinky-finger'];
  const chains=fingers.map(f=>['wrist',f+'-metacarpal',f+'-phalanx-proximal',...(f==='thumb'?[]:[f+'-phalanx-intermediate']),f+'-phalanx-distal',f+'-tip']);
  const names=[...new Set(chains.flat())],links=chains.flatMap(chain=>chain.slice(1).map((name,i)=>[chain[i],name]));
  const dotsGeometry=new SphereGeometry(1,8,6),bonesGeometry=new CylinderGeometry(1,1,1,6);
  const material=new MeshBasicMaterial({color:0xead3b9,toneMapped:false});
  const dots=new InstancedMesh(dotsGeometry,material,names.length),bones=new InstancedMesh(bonesGeometry,material,links.length);
  dots.frustumCulled=bones.frustumCulled=false;hand.add(dots,bones);
  const dummy=new Group(),up=new Vector3(0,1,0),v=new Vector3();
  function update() {
    let count=0,boneCount=0;
    if(hand.visible!==false) {
      for(const name of names){const joint=hand.joints?.[name];if(!joint?.visible)continue;
        dummy.position.copy(joint.position);dummy.quaternion.identity();dummy.scale.setScalar(Math.max(.005,joint.jointRadius||.007));dummy.updateMatrix();dots.setMatrixAt(count++,dummy.matrix);}
      for(const [from,to] of links){const a=hand.joints?.[from],b=hand.joints?.[to];if(!a?.visible||!b?.visible)continue;
        v.copy(b.position).sub(a.position);const length=v.length();if(length<.0001)continue;
        dummy.position.copy(a.position).add(b.position).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,v.divideScalar(length));dummy.scale.set(.0045,length,.0045);dummy.updateMatrix();bones.setMatrixAt(boneCount++,dummy.matrix);}
    }
    dots.count=count;bones.count=boneCount;dots.instanceMatrix.needsUpdate=true;bones.instanceMatrix.needsUpdate=true;
    return count>0;
  }
  return {update,dispose(){hand.remove(dots,bones);dots.dispose();bones.dispose();dotsGeometry.dispose();bonesGeometry.dispose();material.dispose();}};
}
