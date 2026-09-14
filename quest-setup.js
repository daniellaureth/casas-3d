function questConfiguration() {
  const plan=ue.userData.plan,options=kn[et('model').value];
  const destinations=[{id:'entry',name:'Entrada',...walkPhysics.spawn}];
  plan.rooms.forEach(([name,x,z,w,d],i)=>destinations.push({id:'room-'+i,name,
    x:x+w/2-plan.w/2,z:plan.d/2-z-d/2,
    bounds:{minX:x-plan.w/2,maxX:x+w-plan.w/2,minZ:plan.d/2-z-d,maxZ:plan.d/2-z}}));
  return {model:et('model').value,models:Array.from(et('model').options,o=>({value:o.value,label:o.value+' m²'})),
    modelDescription:et('model').selectedOptions[0].textContent,facades:ps.map(f=>f.name),facade:options.facade,
    high:options.high,garage:options.garage,garageSpaces:options.garageSpaces,twoSpaces:!et('garage-spaces').options[1].disabled,
    width:Re.width,depth:Re.depth,furniture:!!Zn,evening:vs,tour:houseTour?.state,boundary:et('boundary').checked,destinations};
}
function questBatchHouse() {
  hn=100;Xe=0;Un=Number(Zn);Vn=false;De=null;Bn=null;dc(100);
  bd();bn=Wm(ue);Tn.add(bn);Eo=gs;ue.visible=false;bn.visible=true;
}
function questChangeConfiguration(key,value) {
  et('configuration-error').textContent='';et('lot-error').textContent='';
  if(key==='facade')Nx[value]?.click();
  else if(key==='lot') {
    et('lot-width').value=value.width;et('lot-depth').value=value.depth;et('lot-preset').value='custom';et('apply-lot').click();
  } else if(['furniture','light'].includes(key))et(key).click();
  else {
    const id=key==='garageSpaces'?'garage-spaces':key;
    if(!['model','high','garage','garage-spaces','boundary'].includes(id))throw new Error('Escolha indisponível.');
    const control=et(id);if(control.type==='checkbox')control.checked=!!value;else control.value=String(value);
    control.dispatchEvent(new Event('change',{bubbles:true}));
  }
  questBatchHouse();
  return et('lot-error').textContent||et('configuration-error').textContent||
    (key==='garage'||key==='garageSpaces'?et('garage-status').textContent:'')||'Escolha aplicada.';
}
questMode=createQuestVR({renderer:ee,scene:Tn,camera:Je,controls:xe,Group:Ce,Vector3:q,
  getTour:()=>houseTour,
  lighting:questProfile.lightweight?createQuestLighting({scene:Tn,MeshBasicMaterial:zo,BufferAttribute:me,Vector3:q,Matrix3:Jt,getEvening:()=>vs}):null,
  createLoading(options){return createQuestLoading({...options,Scene:Jo,Group:Ce,Mesh:Zt,PlaneGeometry:Ns,CanvasTexture:rd,MeshBasicMaterial:zo,Vector3:q});},
  getConfiguration:questConfiguration,changeConfiguration:questChangeConfiguration,
  createPanel(options){return createQuestPanel({...options,Group:Ce,Mesh:Zt,PlaneGeometry:Ns,CanvasTexture:rd,MeshBasicMaterial:zo,Vector3:q});},
  createHand(hand){return createQuestHandVisual({hand,Group:Ce,Mesh:Zt,InstancedMesh:vu,BufferGeometry:je,BufferAttribute:me,SphereGeometry:_o,MeshStandardMaterial:Gr,Vector3:q});},
  createPointer(controller){
    const material=new zo({color:0x78af87,depthTest:false,depthWrite:false,toneMapped:false});
    const beam=new Zt(new ti(.0015,.0015,1,6),material),dot=new Zt(new _o(.006,8,6),material);
    beam.rotation.x=Math.PI/2;beam.renderOrder=1002;dot.renderOrder=1003;controller.add(beam,dot);
    return {update(hit,scale){const distance=(hit?.distance||.65)*scale;beam.scale.y=distance;beam.position.z=-distance/2;dot.position.z=-distance;dot.visible=!!hit;material.color.set(hit?.button&&!hit.button.disabled?0xf0bf67:0x78af87);},
      dispose(){controller.remove(beam,dot);beam.geometry.dispose();dot.geometry.dispose();material.dispose();}};
  },
  makeCurtain(){const mesh=new Zt(new Ns(4,4),new zo({color:0,transparent:true,depthTest:false,depthWrite:false}));mesh.position.z=-0.2;mesh.renderOrder=9999;mesh.frustumCulled=false;return mesh;},
  prepare(){
    walkMode.stop();ke();
    if(Br){cancelAnimationFrame(Br);Br=0;}
  },
  prepareScene(){
    ji(100);hn=100;Vn=false;Xe=0;Un=Number(Zn);De=null;Bn=null;dc(100);
    et('xray').setAttribute('aria-pressed','false');
    questBatchHouse();
  },
  restore(){lc();Io=performance.now();},getPhysics:()=>walkPhysics,invalidate:Gn});
