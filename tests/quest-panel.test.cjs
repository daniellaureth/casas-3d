const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const html=read('Casas3D.html');
const context=vm.createContext({console,AbortController,performance,URL});
vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+';globalThis.three={Matrix3:Jt,Group:Ce,Mesh:Zt,PlaneGeometry:Ns,CanvasTexture:rd,MeshBasicMaterial:zo,MeshStandardMaterial:Gr,BufferGeometry:je,BufferAttribute:me,Vector3:q,InstancedMesh:vu,SphereGeometry:_o,CylinderGeometry:ti};',context);
const T=context.three;
const canvasContext={scale(){},clearRect(){},fillRect(){},beginPath(){},roundRect(){},fill(){},fillText(){},measureText(s){return {width:s.length*12};}};
context.document={createElement(){return {getContext:()=>canvasContext};}};
vm.runInContext(read('quest-panel.js')+read('quest-hands.js')+read('quest-lighting.js')+';globalThis.api={createQuestLighting,createQuestPanel,questSafePosition,createQuestHandVisual};',context);

function panelFixture(){
  const state={model:'50',models:['50','60','62','69'].map(value=>({value,label:value+' m²'})),modelDescription:'50 m² · 2 quartos',facades:['Contemporânea','Madeira natural','Urbana grafite','Minimalista areia','Clássica clean'],facade:0,high:false,garage:true,garageSpaces:1,twoSpaces:false,width:12,depth:21,furniture:true,evening:false,boundary:true,amplitude:1,destinations:[{id:'entry',name:'Entrada'}]};
  const scene=new T.Group(),camera=new T.Group();camera.position.y=1.65;scene.add(camera);
  const changes=[],moves=[];
  const panel=context.api.createQuestPanel({...T,scene,camera,getState:()=>state,getTourState:()=>state.tour,change(key,value){changes.push([key,value]);if(key!=='tour')state[key]=value;return '';},navigate(id){moves.push(id);},door:()=>true});
  panel.open(new T.Vector3(0,1.65,0),new T.Vector3(0,0,-1));
  function select(id){
    const item=panel.buttons.find(b=>b.id===id);assert.ok(item,id+' exists');
    const point=panel.root.localToWorld(new T.Vector3(((item.x+item.w/2)/1040-.5)*1.04,(.5-(item.y+item.h/2)/820)*.82,0));
    const ray=new T.Group();ray.position.set(0,1.65,0);ray.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),point.sub(ray.position).normalize());ray.updateMatrixWorld(true);
    assert.equal(panel.select(ray),true,id+' is selected by an XR ray');
  }
  return {panel,state,select,changes,moves,scene,camera};
}
test('stereo panel choices work by ray and unavailable garage choices cannot apply',()=>{
  const f=panelFixture();f.select('model-60');assert.equal(f.state.model,'60');
  f.select('facade-3');assert.equal(f.state.facade,3);
  const before=f.changes.length;f.select('garage-2');assert.equal(f.changes.length,before);
  f.select('tab-terreno');f.select('more-width');f.select('apply-lot');assert.equal(f.state.lot.width,13);
  f.select('tab-passeio');f.select('go-entry');assert.deepEqual(f.moves,['entry']);
  f.select('tab-visao');f.select('amplitude-2');assert.equal(f.state.amplitude,2);
  f.select('close');assert.equal(f.panel.visible,false);
  f.panel.dispose();assert.equal(f.camera.children.length,0);assert.equal(f.scene.children.length,1);
});
test('every panel control stays within the canvas and hand pinch uses the same ray hit path',()=>{
  const f=panelFixture();
  for(const tab of ['casa','terreno','passeio','visao','tour']){
    f.select('tab-'+tab);for(const b of f.panel.buttons)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=1040&&b.y+b.h<=772,b.id+' bounds');
  }
  const backwardRay=new T.Group();backwardRay.position.set(0,1.65,0);backwardRay.rotation.y=Math.PI;
  assert.equal(f.panel.select(backwardRay),false);f.panel.dispose();
});

test('VR panel and compact controls retain high resolution without mipmap downsampling',()=>{
 const f=panelFixture();
 for(const group of [f.panel.root,f.panel.dock]){
  const texture=group.children[0].material.map;
  assert.equal(texture.image.width,2048);assert.equal(texture.generateMipmaps,false);assert.equal(texture.minFilter,1006);
 }
 assert.equal(f.panel.root.scale.x,1.08);f.panel.dispose();
});

test('tour starts from the initial VR panel and remains accessible on every tab without day/night',()=>{
  const f=panelFixture();f.select('tour-quick');assert.deepEqual(f.changes.at(-1),['tour','start']);
  for(const tab of ['casa','terreno','passeio','visao','tour']){
    f.select('tab-'+tab);assert.ok(f.panel.buttons.some(b=>b.id==='tour-quick'));assert.ok(!f.panel.buttons.some(b=>b.id==='day'||b.id==='night'));
  }
  f.state.tour={active:true,paused:false,label:'Sala de estar',revision:1};f.panel.close();f.panel.update([],'');
  const children=f.camera.children.length,sceneChildren=f.scene.children.length;
  function selectDock(index,action){
    const point=f.panel.dock.localToWorld(new T.Vector3(((20+index*198+92)/1024-.5)*.78,(.5-246/320)*.24,0));
    const ray=new T.Group();ray.position.copy(f.camera.position);ray.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),point.sub(ray.position).normalize());ray.updateMatrixWorld(true);
    assert.equal(f.panel.hit(ray).button.id,'dock-tour-'+action);assert.equal(f.panel.select(ray),true);assert.deepEqual(f.changes.at(-1),['tour',action]);
  }
  selectDock(0,'pause');f.state.tour.paused=true;f.state.tour.revision++;f.panel.update([],'');selectDock(1,'resume');
  selectDock(2,'next');selectDock(3,'previous');selectDock(4,'stop');
  assert.equal(f.camera.children.length,children);assert.equal(f.scene.children.length,sceneChildren);f.panel.dispose();
});
test('safe destinations respect room bounds and avoid new furniture and walls',()=>{
  const physics={radius:.2,spawn:{x:5,z:5},blocked:(x,z)=>Math.abs(x)<.4&&Math.abs(z)<.4};
  const bounds={minX:-1,maxX:1,minZ:-1,maxZ:1};
  const p=context.api.questSafePosition(physics,{x:0,z:0},bounds);assert.ok(p);assert.equal(physics.blocked(p.x,p.z),false);assert.ok(Math.abs(p.x)<=.8&&Math.abs(p.z)<=.8);
  assert.equal(context.api.questSafePosition({...physics,blocked:()=>true},{x:0,z:0},bounds),null);
});
test('an open panel remains reachable after recentering or walking physically',()=>{
  const f=panelFixture(),head=new T.Vector3(5,1.65,5);f.panel.ensureReachable(head,new T.Vector3(0,0,-1));
  assert.ok(f.panel.root.position.distanceTo(head)<1.3);assert.ok(Math.abs(f.panel.root.position.y-head.y)<.2);f.panel.dispose();
});
test('hand visualization follows real joints and disappears on tracking loss',()=>{
  const hand=require('./hand-fixture.cjs')(T),originalCount=hand.children.length;
  const visual=context.api.createQuestHandVisual({...T,hand});
  assert.equal(visual.update(),true);const meshes=hand.children.filter(c=>c.isMesh);assert.equal(meshes.length,3);
  assert.equal(meshes[1].count,3);assert.equal(meshes[2].count,5);
  for(const attribute of ['position','normal'])assert.ok(Array.from(meshes[0].geometry.attributes[attribute].array).every(Number.isFinite));
  meshes[0].geometry.computeBoundingBox();assert.ok(meshes[0].geometry.boundingBox.max.y>.16,'skin reaches the fingertips');
  hand.visible=false;assert.equal(visual.update(),false);assert.ok(meshes.every(m=>!m.visible));
  visual.dispose();assert.equal(hand.children.length,originalCount);
});
test('Quest diffuse lighting keeps textures and colors, shares materials and restores desktop originals',()=>{
  const scene=new T.Group(),geometry=new T.SphereGeometry(1,8,6),texture=new T.CanvasTexture({}),material=new T.MeshStandardMaterial({color:0xbbaabb,map:texture});
  const meshes=[new T.Mesh(geometry,material),new T.Mesh(geometry,material)];meshes.forEach(m=>scene.add(m));
  const lighting=context.api.createQuestLighting({...T,scene});lighting.apply();
  assert.equal(lighting.count,2);assert.ok(meshes[0].material.isMeshBasicMaterial);assert.equal(meshes[0].material,meshes[1].material);assert.equal(meshes[0].material.map,texture);
  assert.notEqual(meshes[0].geometry,geometry);assert.equal(geometry.attributes.color,undefined);
  const colors=meshes[0].geometry.attributes.color.array;assert.ok([...colors].every(v=>Number.isFinite(v)&&v>0));assert.ok(Math.max(...colors)>Math.min(...colors)*1.4);
  lighting.restore();assert.equal(lighting.count,0);assert.equal(meshes[0].geometry,geometry);assert.equal(meshes[0].material,material);assert.equal(material.vertexColors,false);
  lighting.apply();lighting.restore();assert.equal(meshes[1].geometry,geometry);
});

test('live VR choices preserve headset pose, floor height and the session while avoiding replacement walls',async()=>{
  const elements={'quest-vr':{},'quest-status':{}};
  context.document.getElementById=id=>elements[id];context.document.body={classList:{add(){},remove(){}}};
  context.window={isSecureContext:true};context.queueMicrotask=queueMicrotask;
  let end;const session={inputSources:[],enabledFeatures:['hand-tracking'],addEventListener(type,fn){if(type==='end')end=fn;},async end(){end();}};
  context.navigator={xr:{requestSession:async()=>session}};
  vm.runInContext(read('walk-physics.js')+read('quest-vr.js')+';globalThis.createMode=createQuestVR;globalThis.makePhysics=createWalkPhysics;',context);
  const makePhysics=boxes=>Object.assign(context.makePhysics({boxes}),{spawn:{x:0,z:2}});
  let physics=makePhysics([]),panelOptions,disposed=0;
  const camera=new T.Group();camera.position.set(4,6,8);camera.rotation.y=.7;camera.clearViewOffset=()=>{};
  camera.getWorldDirection=function(target){return target.set(0,0,-1).applyQuaternion(this.getWorldQuaternion(this.quaternion.clone()));};
  const initial=camera.quaternion.clone(),scene=new T.Group(),controls={enabled:true};scene.add(camera);
  const renderer={shadowMap:{enabled:true},info:{reset(){}},render(){},setAnimationLoop(fn){this.frame=fn;},xr:{enabled:false,isPresenting:true,setReferenceSpaceType(){},setFramebufferScaleFactor(){},getController:()=>new T.Group(),getCamera:()=>camera,updateCamera(c){c.updateWorldMatrix(true,false);},async setSession(){},setFoveation(){}}};
  const mode=context.createMode({...T,renderer,scene,camera,controls,airLink:false,makeCurtain:()=>new T.Group(),prepare(){},restore(){},getPhysics:()=>physics,invalidate(){},
    getConfiguration:()=>({destinations:[]}),changeConfiguration(){physics=makePhysics([{minX:-.3,maxX:.3,minZ:1.7,maxZ:2.3,bottom:0,top:3}]);},
    createPanel(options){panelOptions=options;return {visible:false,open(){},place(){},update:()=>[],dispose(){disposed++;}};}});
  await mode.enter();camera.position.set(0,1.65,0);renderer.frame(0);
  const before=camera.getWorldPosition(new T.Vector3());
  panelOptions.change('amplitude',2);renderer.frame(16);
  assert.ok(camera.getWorldPosition(new T.Vector3()).distanceTo(before)<1e-8,'amplitude keeps eye position and floor height');
  assert.equal(camera.parent.scale.x,.5);assert.equal(panelOptions.getState().amplitude,2);
  panelOptions.change('model','60');renderer.frame(32);
  const moved=camera.getWorldPosition(new T.Vector3());assert.equal(physics.blocked(moved.x,moved.z),false);assert.ok(Math.abs(moved.y-before.y)<1e-8);
  assert.equal(mode.active,true);assert.equal(controls.enabled,false);
  await mode.end();assert.equal(disposed,1);assert.ok(camera.position.distanceTo(new T.Vector3(4,6,8))<1e-8);assert.ok(camera.quaternion.angleTo(initial)<1e-8);assert.equal(camera.scale.x,1);
});
