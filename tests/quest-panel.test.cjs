const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const html=read('Casas3D.html');
const context=vm.createContext({console,AbortController,performance,URL});
vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+';globalThis.three={Group:Ce,Mesh:Zt,PlaneGeometry:Ns,CanvasTexture:rd,MeshBasicMaterial:Gr,Vector3:q,InstancedMesh:vu,SphereGeometry:_o,CylinderGeometry:ti};',context);
const T=context.three;
const canvasContext={clearRect(){},fillRect(){},beginPath(){},roundRect(){},fill(){},fillText(){},measureText(s){return {width:s.length*12};}};
context.document={createElement(){return {getContext:()=>canvasContext};}};
vm.runInContext(read('quest-panel.js')+read('quest-hands.js')+';globalThis.api={createQuestPanel,questSafePosition,createQuestHandVisual};',context);

function panelFixture(){
  const state={model:'50',models:['50','60','62','69'].map(value=>({value,label:value+' m²'})),modelDescription:'50 m² · 2 quartos',facades:['Contemporânea','Madeira natural','Urbana grafite','Minimalista areia','Clássica clean'],facade:0,high:false,garage:true,garageSpaces:1,twoSpaces:false,width:12,depth:21,furniture:true,evening:false,boundary:true,amplitude:1,destinations:[{id:'entry',name:'Entrada'}]};
  const scene=new T.Group(),camera=new T.Group();camera.position.y=1.65;scene.add(camera);
  const changes=[],moves=[];
  const panel=context.api.createQuestPanel({...T,scene,camera,getState:()=>state,change(key,value){changes.push([key,value]);state[key]=value;return '';},navigate(id){moves.push(id);},door:()=>true});
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
  for(const tab of ['casa','terreno','passeio','visao']){
    f.select('tab-'+tab);for(const b of f.panel.buttons)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=1040&&b.y+b.h<=710,b.id+' bounds');
  }
  const backwardRay=new T.Group();backwardRay.position.set(0,1.65,0);backwardRay.rotation.y=Math.PI;
  assert.equal(f.panel.select(backwardRay),false);f.panel.dispose();
});
test('safe destinations respect room bounds and avoid new furniture and walls',()=>{
  const physics={radius:.2,spawn:{x:5,z:5},blocked:(x,z)=>Math.abs(x)<.4&&Math.abs(z)<.4};
  const bounds={minX:-1,maxX:1,minZ:-1,maxZ:1};
  const p=context.api.questSafePosition(physics,{x:0,z:0},bounds);assert.ok(p);assert.equal(physics.blocked(p.x,p.z),false);assert.ok(Math.abs(p.x)<=.8&&Math.abs(p.z)<=.8);
  assert.equal(context.api.questSafePosition({...physics,blocked:()=>true},{x:0,z:0},bounds),null);
});
test('hand visualization follows real joints and disappears on tracking loss',()=>{
  const hand=new T.Group();hand.joints={};
  for(const [name,x] of [['index-finger-phalanx-distal',0],['index-finger-tip',.025]]){const j=new T.Group();j.position.set(x,1,0);j.jointRadius=.006;hand.joints[name]=j;}
  const visual=context.api.createQuestHandVisual({...T,hand});
  assert.equal(visual.update(),true);assert.equal(hand.children[0].count,2);assert.equal(hand.children[1].count,1);
  hand.visible=false;assert.equal(visual.update(),false);assert.equal(hand.children[0].count,0);
  visual.dispose();assert.equal(hand.children.length,0);
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
