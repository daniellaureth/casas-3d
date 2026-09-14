const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),VM=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'Casas3D.html'),'utf8');
function fixture(model='50',panelFactory) {
  const elements={'quest-vr':{},'quest-status':{}};
  const errors=[];
  class Layer {constructor(){this.framebuffer={};this.framebufferWidth=2000;this.framebufferHeight=1000;}getViewport(view){return {x:view.eye==='left'?0:1000,y:0,width:1000,height:1000};}}
  const ctx=VM.createContext({console:{...console,error:(...args)=>errors.push(args)},AbortController,performance,URL,queueMicrotask,XRWebGLLayer:Layer,navigator:{userAgent:'Android OculusBrowser Quest 3S'},window:{isSecureContext:true},document:{getElementById:id=>elements[id],body:{classList:{add(){},remove(){}}}}});
  VM.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+['walk-layout.js','walk-physics.js','quest-vr.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')+';globalThis.api={XRManager:vm,Group:Ce,Vector3:q,Quaternion:ii,Matrix4:$t,PerspectiveCamera:Qe,xx,Box3:si,createHousePhysics,createQuestVR};',ctx);
  const T=ctx.api,house=T.xx(model,{width:15,depth:30}),physics=T.createHousePhysics(house,{Box3:T.Box3});
  const camera=new T.PerspectiveCamera(38,1,.1,500),scene=new T.Group(),controls={enabled:true};camera.position.set(4,6,8);
  let callback,curtain;const listeners=new Map();
  const session={inputSources:[],renderState:{},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},removeEventListener(){},updateRenderState(value){Object.assign(this.renderState,value);},requestReferenceSpace:async()=>({}),requestAnimationFrame(fn){callback=fn;return 1;},cancelAnimationFrame(){},end:async()=>{for(const fn of listeners.get('end')||[])fn();}};
  ctx.navigator.xr={requestSession:async()=>session};
  const renderer={shadowMap:{enabled:false},info:{reset(){}},getRenderTarget:()=>null,getPixelRatio:()=>1,getSize:out=>out.set(1400,1000),setPixelRatio(){},setSize(){},setRenderTarget(){},setRenderTargetFramebuffer(){},outputColorSpace:'srgb'};
  renderer.xr=new T.XRManager(renderer,{getContextAttributes:()=>({xrCompatible:true,depth:true,stencil:false,antialias:true})});
  renderer.setAnimationLoop=fn=>renderer.xr.setAnimationLoop(fn);
  renderer.render=()=>{scene.updateMatrixWorld();renderer.xr.updateCamera(camera);};
  const mode=T.createQuestVR({...T,renderer,scene,camera,controls,airLink:false,makeCurtain:()=>{curtain=new T.Group();return curtain;},prepare(){},restore(){},invalidate(){},getPhysics:()=>physics,createPanel:panelFactory});
  function tick(time,{x=0,y=1.7,z=0,yaw=0,tracked=true}={}) {
    const projection=new T.PerspectiveCamera(90,1,.1,500).projectionMatrix.toArray();
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
    const views=['left','right'].map(eye=>({eye,projectionMatrix:projection,transform:{matrix:new T.Matrix4().compose(new T.Vector3(x+(eye==='left'?-.032:.032),y,z),rotation,new T.Vector3(1,1,1)).toArray()}}));
    callback(time,{getViewerPose:()=>tracked?{views}:null});
    return {head:camera.getWorldPosition(new T.Vector3()).toArray(),curtain:curtain.visible,rig:camera.parent?.position.toArray()};
  }
  return {mode,tick,physics,camera,session,renderer,errors};
}
test('real Three XR manager keeps a stationary tracked head outside walls',async()=>{
  for(const model of ['50','60','62','69']) {
    const f=fixture(model);await f.mode.enter();
    for(let i=0;i<10;i++) {const state=f.tick(i*14,{x:2,z:3});assert.equal(state.curtain,false,model+' '+JSON.stringify(state));}
    await f.mode.end();
  }
});
test('the exit panel remains selectable while wall protection covers the house',async()=>{
  let options;
  const f=fixture('50',o=>{options=o;return {visible:true,open(){},update:()=>[],dispose(){},select(){void options.exitVR();return true;}};});
  f.physics.headPathBlocked=()=>true;await f.mode.enter();assert.equal(f.tick(0).curtain,true);
  f.renderer.xr.getController(0).dispatchEvent({type:'select'});await Promise.resolve();assert.equal(f.mode.active,false);
});
test('holding B or Y exits even without a viewer pose or working pointer',async()=>{
  const f=fixture();await f.mode.enter();
  f.session.inputSources=[{handedness:'right',gamepad:{buttons:[{},{},{},{},{},{pressed:true}],axes:[0,0,0,0]}}];
  f.tick(0,{tracked:false});assert.equal(f.mode.active,true);f.tick(1600,{tracked:false});await Promise.resolve();assert.equal(f.mode.active,false);
});
test('a rendering failure ends the session instead of leaving an unusable black scene',async()=>{
  const f=fixture();await f.mode.enter();f.renderer.render=()=>{throw Error('simulated frame failure');};
  f.tick(0);await Promise.resolve();assert.equal(f.mode.active,false);assert.equal(f.mode.diagnostics.frameError,'simulated frame failure');
  assert.equal(f.errors.length,1);
});
test('tracking can start after a frame without a viewer pose',async()=>{
  const f=fixture();await f.mode.enter();f.tick(0,{tracked:false});
  for(let i=1;i<5;i++){const state=f.tick(i*14,{x:3,z:4});assert.equal(state.curtain,false,JSON.stringify(state));assert.ok(Math.hypot(state.head[0]-f.physics.spawn.x,state.head[2]-f.physics.spawn.z)<.08,JSON.stringify(state));}
  await f.mode.end();
});
