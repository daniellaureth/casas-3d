// Skin surfaces follow native joints, with a rounded palm and subtle nails.
// Three draws per hand; no external models or textures.
function createQuestHandVisual({hand,Group,Mesh,InstancedMesh,BufferGeometry,BufferAttribute,SphereGeometry,MeshStandardMaterial,Vector3}) {
  const skin=new MeshStandardMaterial({color:0xd6a384,roughness:.78,metalness:0,emissive:0x352018,emissiveIntensity:.12});
  const nailMaterial=new MeshStandardMaterial({color:0xe3bba2,roughness:.65,metalness:0});
  const sphere=new SphereGeometry(1,16,10),palm=new InstancedMesh(sphere,skin,3),nails=new InstancedMesh(sphere,nailMaterial,5);
  const fingers=['thumb','index-finger','middle-finger','ring-finger','pinky-finger'];
  // Smooth curves with fewer rings keep the per-frame joint update light on Quest.
  const R=18,S=12,vertices=new Float32Array(5*R*S*3),indices=[];
  const axes=['x','y','z'],circle=Array.from({length:S},(_,i)=>[Math.cos(i/S*Math.PI*2),Math.sin(i/S*Math.PI*2)]);
  const chains=fingers.map(name=>name==='thumb'?['thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip']:[name+'-phalanx-proximal',name+'-phalanx-intermediate',name+'-phalanx-distal',name+'-tip']);
  for(let f=0;f<5;f++)for(let r=0;r<R-1;r++)for(let s=0;s<S;s++){
    const i=f*R*S+r*S+s,j=f*R*S+r*S+(s+1)%S;indices.push(i,i+S,j,j,i+S,j+S);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(vertices,3));geometry.setIndex(indices);
  const positions=geometry.attributes.position.array;
  const surface=new Mesh(geometry,skin);surface.frustumCulled=palm.frustumCulled=nails.frustumCulled=false;hand.add(surface,palm,nails);
  for(const mesh of [surface,palm,nails])mesh.userData.questDynamic=true;
  const dummy=new Group(),side=new Vector3(),normal=new Vector3(),long=new Vector3(),center=new Vector3(),tangent=new Vector3(),radial=new Vector3();
  const frame=new Group(),ringNormal=new Vector3(),points=Array.from({length:4},()=>new Vector3()),radii=new Array(4);
  let handedness=hand.userData?.handedness||'right';
  const connected=event=>{handedness=event.data?.handedness||handedness;};hand.addEventListener('connected',connected);
  function joint(name){const p=hand.joints?.[name];return p?.visible?p:null;}
  function volume(index,position,width,length,depth){dummy.position.copy(position);dummy.quaternion.copy(frame.quaternion);dummy.scale.set(width,length,depth);dummy.updateMatrix();palm.setMatrixAt(index,dummy.matrix);}
  function curve(t,out) {
    const u=t*3,i=Math.min(2,Math.floor(u)),s=u-i,s2=s*s,s3=s2*s;
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(3,i+2)];
    for(const axis of axes)out[axis]=.5*((2*p1[axis])+(-p0[axis]+p2[axis])*s+(2*p0[axis]-5*p1[axis]+4*p2[axis]-p3[axis])*s2+(-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis])*s3);
  }
  function update() {
    const wrist=joint('wrist'),middle=joint('middle-finger-phalanx-proximal'),index=joint('index-finger-phalanx-proximal'),pinky=joint('pinky-finger-phalanx-proximal');
    const tracked=hand.visible!==false&&wrist&&middle&&index&&pinky;
    surface.visible=palm.visible=nails.visible=!!tracked;if(!tracked){palm.count=nails.count=0;return false;}
    long.copy(middle.position).sub(wrist.position);const length=long.length();long.normalize();
    side.copy(index.position).sub(pinky.position);const width=side.length();side.normalize();
    normal.crossVectors(side,long).normalize();if(handedness==='right')normal.negate();side.crossVectors(long,normal).normalize();
    frame.matrix.makeBasis(side,long,normal);frame.quaternion.setFromRotationMatrix(frame.matrix);
    center.copy(wrist.position).lerp(middle.position,.54);volume(0,center,width*.69,length*.57,Math.max(.013,width*.22));
    center.copy(wrist.position).lerp(middle.position,.06);volume(1,center,width*.42,length*.28,Math.max(.012,width*.20));
    const thumbBase=joint('thumb-metacarpal');
    if(thumbBase){center.copy(wrist.position).lerp(thumbBase.position,.65).lerp(middle.position,.2);volume(2,center,width*.32,length*.39,width*.24);palm.count=3;}else palm.count=2;
    let nailCount=0;
    for(let f=0;f<5;f++) {
      const name=fingers[f],names=chains[f];
      const joints=names.map(joint),valid=joints.every(Boolean);
      if(valid)for(let i=0;i<4;i++){points[i].copy(joints[i].position);radii[i]=Math.max(.005,Math.min(.014,joints[i].jointRadius||.008))*(i===0?1.15:1.05);}
      if(valid&&name!=='thumb')points[0].lerp(wrist.position,.13);
      for(let r=0;r<R;r++) {
        const t=r/(R-1);if(valid){curve(t,center);curve(Math.min(1,t+.005),tangent);if(t===1){curve(t-.005,tangent);tangent.sub(center).negate();}else tangent.sub(center);tangent.normalize();radial.crossVectors(tangent,normal);if(radial.lengthSq()<1e-8)radial.crossVectors(tangent,side);radial.normalize();ringNormal.crossVectors(radial,tangent).normalize();}
        const u=t*3,i=Math.min(2,Math.floor(u)),radius=valid?(radii[i]+(radii[i+1]-radii[i])*(u-i))*(t>.88?Math.sqrt(Math.max(0,1-((t-.88)/.12)**2)):1):0;
        for(let s=0;s<S;s++){const k=(f*R*S+r*S+s)*3,c=circle[s][0]*radius,n=circle[s][1]*radius;
          positions[k]=valid?center.x+c*radial.x+n*ringNormal.x:wrist.position.x;
          positions[k+1]=valid?center.y+c*radial.y+n*ringNormal.y:wrist.position.y;
          positions[k+2]=valid?center.z+c*radial.z+n*ringNormal.z:wrist.position.z;
        }
      }
      if(valid){dummy.position.copy(points[2]).lerp(points[3],.58).addScaledVector(ringNormal,radii[3]*.83);dummy.matrix.makeBasis(radial,tangent,ringNormal);dummy.quaternion.setFromRotationMatrix(dummy.matrix);dummy.scale.set(radii[3]*.68,points[2].distanceTo(points[3])*.28,.0012);dummy.updateMatrix();nails.setMatrixAt(nailCount++,dummy.matrix);}
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();palm.instanceMatrix.needsUpdate=nails.instanceMatrix.needsUpdate=true;nails.count=nailCount;return true;
  }
  return {update,dispose(){hand.removeEventListener('connected',connected);hand.remove(surface,palm,nails);palm.dispose();nails.dispose();geometry.dispose();sphere.dispose();skin.dispose();nailMaterial.dispose();}};
}
