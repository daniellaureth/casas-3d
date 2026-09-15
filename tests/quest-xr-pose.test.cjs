const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),VM=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'Casas3D.html'),'utf8');
function fixture(model='50',panelFactory,extra={}) {
  const elements={'quest-vr':{},'quest-status':{}};
  const errors=[];let clock=0,monitor=null;
  class Layer {constructor(){this.framebuffer={};this.framebufferWidth=2000;this.framebufferHeight=1000;}getViewport(view){return {x:view.eye==='left'?0:1000,y:0,width:1000,height:1000};}}
  const ctx=VM.createContext({console:{...console,error:(...args)=>errors.push(args)},AbortController,performance:{now:()=>clock},setInterval(fn){monitor=fn;return 1;},clearInterval(){monitor=null;},URL,queueMicrotask,XRWebGLLayer:Layer,navigator:{userAgent:'Android OculusBrowser Quest 3S'},window:{isSecureContext:true},document:{getElementById:id=>elements[id],body:{classList:{add(){},remove(){}}}}});
  VM.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+['walk-layout.js','walk-physics.js','tour-config.js','house-tour.js','quest-vr.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')+';globalThis.api={XRManager:vm,Group:Ce,Vector3:q,Quaternion:ii,Matrix4:$t,PerspectiveCamera:Qe,xx,Box3:si,createHousePhysics,createQuestVR,createHouseTour,config:CASA_TOUR_CONFIG};',ctx);
  const T=ctx.api,house=T.xx(model,{width:15,depth:30}),physics=T.createHousePhysics(house,{Box3:T.Box3});
  const camera=new T.PerspectiveCamera(38,1,.1,500),scene=new T.Group(),controls={enabled:true};camera.position.set(4,6,8);
  let callback,curtain;const listeners=new Map();
  const session={inputSources:[],renderState:{},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},removeEventListener(){},updateRenderState(value){Object.assign(this.renderState,value);},requestReferenceSpace:async()=>({}),requestAnimationFrame(fn){callback=fn;return 1;},cancelAnimationFrame(){},end:async()=>{for(const fn of listeners.get('end')||[])fn();}};
  ctx.navigator.xr={requestSession:async()=>session};
  const renderer={shadowMap:{enabled:false},info:{reset(){}},getRenderTarget:()=>null,getPixelRatio:()=>1,getSize:out=>out.set(1400,1000),setPixelRatio(){},setSize(){},setRenderTarget(){},setRenderTargetFramebuffer(){},outputColorSpace:'srgb'};
  renderer.xr=new T.XRManager(renderer,{getContextAttributes:()=>({xrCompatible:true,depth:true,stencil:false,antialias:true})});
  renderer.setAnimationLoop=fn=>renderer.xr.setAnimationLoop(fn);
  renderer.render=()=>{scene.updateMatrixWorld();renderer.xr.updateCamera(camera);};
  const mode=T.createQuestVR({...T,renderer,scene,camera,controls,airLink:false,makeCurtain:()=>{curtain=new T.Group();return curtain;},prepare(){},restore(){},invalidate(){},getPhysics:()=>physics,createPanel:panelFactory,...extra});
  function tick(time,{x=0,y=1.7,z=0,yaw=0,pitch=0,roll=0,tracked=true}={}) {
    clock=time;
    const projection=new T.PerspectiveCamera(90,1,.1,500).projectionMatrix.toArray();
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
    rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),pitch)).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll));
    const views=['left','right'].map(eye=>({eye,projectionMatrix:projection,transform:{matrix:new T.Matrix4().compose(new T.Vector3(eye==='left'?-.032:.032,0,0).applyQuaternion(rotation).add(new T.Vector3(x,y,z)),rotation,new T.Vector3(1,1,1)).toArray()}}));
    callback(time,{getViewerPose:()=>tracked?{views}:null});
    return {head:camera.getWorldPosition(new T.Vector3()).toArray(),curtain:curtain.visible,rig:camera.parent?.position.toArray(),tracking:rotation};
  }
  return {mode,tick,physics,house,api:T,camera,session,renderer,errors,advanceClock(ms){clock+=ms;monitor?.();}};
}

test('automatic tour leaves the entrance and visits rooms with continuous tracked head motion',async()=>{
  for(const model of ['50','60','62','69'].filter(m=>!process.env.TOUR_MODEL||process.env.TOUR_MODEL===m)){
    let tour;const f=fixture(model,undefined,{getTour:()=>tour});
    tour=f.api.createHouseTour({getPhysics:()=>f.physics,getPlan:()=>f.house.userData.plan,getModel:()=>model});
    await f.mode.enter();f.tick(0);f.mode.tourAction('start');const seen=new Set();let i=0,opened=false;
    while(tour.state.active&&i++<72*600){
      const pose=f.tick(i*1000/72,{x:.004*Math.sin(i*.17),z:.003*Math.cos(i*.21),yaw:.15*Math.sin(i*.04),pitch:.05*Math.sin(i*.03),roll:.02*Math.cos(i*.06)});
      opened||=f.physics.doors.some(d=>Math.abs(d.angle)>.1);seen.add(tour.state.index);assert.equal(tour.state.paused,false,model+' '+JSON.stringify(tour.state));
      assert.equal(pose.curtain&&tour.state.fade===0,false,model+' wall protection');
      assert.ok(f.camera.quaternion.angleTo(pose.tracking)<1e-7,'head remains tracked');
      if(tour.state.active)assert.ok(pose.head[1]<=tour.heightLimit({x:pose.head[0],y:pose.head[1],z:pose.head[2]})+1e-7,model+' rendered indoor eye stays at or below 1.75 m');
      if(i===72*25)assert.ok(tour.state.index>0,'must automatically leave Entrada: '+JSON.stringify(tour.state));
    }
    assert.equal(tour.state.active,false,model+' completes every room: '+JSON.stringify(tour.state));
    assert.equal(seen.size,tour.points.length);assert.equal(f.mode.active,true);assert.ok(opened);assert.ok(f.physics.doors.every(d=>Math.abs(d.target)<.01));
    console.log(JSON.stringify({vrModel:model,visited:seen.size,simulatedSeconds:i/72}));
    await f.mode.end();assert.deepEqual(f.errors,[]);
  }
});

test('seated head height is capped indoors without replacing native orientation',async()=>{
 let tour;const f=fixture('50',undefined,{getTour:()=>tour});
 tour=f.api.createHouseTour({getPhysics:()=>f.physics,getPlan:()=>f.house.userData.plan,getModel:()=> '50'});
 await f.mode.enter();f.tick(0,{y:1.15});f.mode.tourAction('start');let i=0;
 while(tour.state.index<2&&i++<5000)f.tick(i*1000/72,{y:1.15});
 assert.equal(tour.state.index,2);f.mode.tourAction('pause');
 const pose=f.tick(++i*1000/72,{y:1.45,yaw:.3,pitch:.1,roll:.02}),p={x:pose.head[0],y:pose.head[1],z:pose.head[2]},limit=tour.heightLimit(p);
 assert.ok(Number.isFinite(limit),'test eye is actually inside the house');assert.ok(p.y<=limit+1e-7);
 assert.ok(f.camera.quaternion.angleTo(pose.tracking)<1e-7);assert.equal(pose.curtain,false);
 await f.mode.end();assert.deepEqual(f.errors,[]);
});

test('aerial tilt frames the lot, preserves a sideways seated calibration and levels on cancel and reentry',async()=>{
 const location={x:8,y:21,z:10},focus={x:0,y:.45,z:0};let indoors=false;
 const tour={state:{active:false,paused:false,heading:null,focus,fade:0},heightLimit:()=>indoors?1.75:Infinity,validHead:()=>true,
  action(type,body){if(type==='stop'){this.state.active=false;this.state.heading=null;Object.assign(body,{x:f.physics.spawn.x,y:1.7,z:f.physics.spawn.z});}else{this.state.active=true;this.state.heading=Math.atan2(location.x,location.z);}},
  update(body){if(!this.state.paused)Object.assign(body,location);},stop(){this.state.active=false;}};
 const f=fixture('50',undefined,{getTour:()=>tour});await f.mode.enter();f.tick(0,{yaw:.7,y:1.15});f.mode.tourAction('start');
 let pose,previous=0,maxChange=0;
 for(let i=1;i<=1200;i++){
  pose=f.tick(i*1000/72,{yaw:.7,y:1.15});const dir=f.camera.getWorldDirection(new f.api.Vector3()),pitch=Math.asin(dir.y);
  maxChange=Math.max(maxChange,Math.abs(pitch-previous));previous=pitch;
  assert.ok(f.camera.quaternion.angleTo(pose.tracking)<1e-7,'native pose is not overwritten');assert.equal(pose.curtain,false);
 }
 const wanted=new f.api.Vector3(focus.x-location.x,focus.y-location.y,focus.z-location.z).normalize();
 assert.ok(f.camera.getWorldDirection(new f.api.Vector3()).dot(wanted)>.999,'neutral seated view points down at the lot');
 assert.ok(Math.hypot(...pose.head.map((v,i)=>v-[location.x,location.y,location.z][i]))<1e-6,'rotation stays anchored to the seated eye');
 assert.ok(maxChange<=.21/72+1e-6,'tilt is limited to 12 degrees per second');
 tour.state.paused=true;const base=f.camera.parent.quaternion.clone();
 pose=f.tick(1201*1000/72,{yaw:1.4,pitch:.15,roll:.05,y:1.15});
 assert.ok(base.angleTo(f.camera.parent.quaternion)<1e-7,'pause freezes the base');assert.ok(f.camera.quaternion.angleTo(pose.tracking)<1e-7);
 f.mode.tourAction('stop');f.tick(1202*1000/72,{yaw:.7,y:1.15});
 assert.ok(Math.abs(f.camera.getWorldDirection(new f.api.Vector3()).y)<1e-7,'cancel returns to level walking');
 await f.mode.end();await f.mode.enter();f.tick(0,{y:1.15});assert.ok(Math.abs(f.camera.getWorldDirection(new f.api.Vector3()).y)<1e-7);await f.mode.end();assert.deepEqual(f.errors,[]);
});

test('seated visitor sees each room ahead while retaining 180 degrees of head movement',async()=>{
 let tour;const f=fixture('69',undefined,{getTour:()=>tour});
 tour=f.api.createHouseTour({getPhysics:()=>f.physics,getPlan:()=>f.house.userData.plan,getModel:()=> '69',config:{...f.api.config,dwell:.1,stops:f.api.config.stops.map(s=>({...s,dwell:.1}))}});
 const neutral=.65;await f.mode.enter();f.tick(0,{y:1.15,yaw:neutral});f.mode.tourAction('start');let i=0,previousYaw=tour.state.heading,turns=0;const seen=new Set();
 while(tour.state.active&&i++<72*600){
  const side=Math.PI/2*Math.sin(i*.018),pose=f.tick(i*1000/72,{y:1.15,yaw:neutral+side});
  const rig=f.camera.parent,change=tour.state.active?tour.state.heading-previousYaw:0;previousYaw=tour.state.heading;
  assert.ok(Math.abs(change)<=f.api.config.turnSpeed*Math.PI/180/72+1e-6,'continuous gentle yaw');assert.equal(tour.state.fade,0,'no blackout during flight');if(Math.abs(change)>.001)turns++;
  const indoors=Number.isFinite(tour.heightLimit({x:pose.head[0],y:pose.head[1],z:pose.head[2]}));
  if(indoors){assert.ok(Math.abs(rig.rotation.x)<1e-7);assert.ok(Math.abs(rig.rotation.z)<1e-7);}
  assert.ok(f.camera.quaternion.angleTo(pose.tracking)<1e-7,'head pose is never replaced');
  if(tour.state.phase==='dwell'){
   seen.add(tour.state.index);const p=tour.points[tour.state.index],head=f.camera.getWorldPosition(new f.api.Vector3()),look=f.camera.getWorldDirection(new f.api.Vector3());
   const targetYaw=Math.atan2(head.x-p.focus.x,head.z-p.focus.z),actualYaw=Math.atan2(-look.x,-look.z);
   const error=Math.atan2(Math.sin(actualYaw-targetYaw-side),Math.cos(actualYaw-targetYaw-side));
   const calibratedError=Math.atan2(Math.sin(actualYaw-tour.state.heading-side),Math.cos(actualYaw-tour.state.heading-side));
   if(indoors)assert.ok(Math.abs(calibratedError)<1e-7,'head turning remains relative to the seated forward direction');
   // Physical/optical eye translations remain free, especially in tiny hallways;
   // framing must keep the subject ahead without steering against that motion.
   if(indoors)assert.ok(Math.abs(error)<Math.PI/6,'neutral chair direction faces '+p.label+' '+error);
   assert.ok(Math.abs(head.y-p.y)<.07,'seated eye height is raised for '+p.label);
  }
 }
 assert.equal(tour.state.active,false,JSON.stringify({state:tour.state,diagnostics:f.mode.diagnostics}));assert.equal(seen.size,tour.points.length);assert.ok(turns>3);await f.mode.end();assert.deepEqual(f.errors,[]);
});
test('real Three XR manager keeps a stationary tracked head outside walls',async()=>{
  for(const model of ['50','60','62','69']) {
    const f=fixture(model);await f.mode.enter();
    for(let i=0;i<10;i++) {const state=f.tick(i*14,{x:2,z:3});assert.equal(state.curtain,false,model+' '+JSON.stringify(state));}
    await f.mode.end();assert.equal(f.camera.fov,38);assert.equal(f.camera.zoom,1);
  }
});

test('automatic VR travel leaves head yaw, pitch and roll tracked and ignores manual locomotion',async()=>{
  let updates=0;const tour={state:{active:false,paused:false,fade:0},update(position,dt){updates++;if(!this.state.paused)position.x+=dt*.3;},stop(){this.state.active=false;}};
  const f=fixture('50',undefined,{getTour:()=>tour});await f.mode.enter();f.tick(0);tour.state.active=true;
  f.session.inputSources=[{handedness:'left',gamepad:{buttons:[],axes:[0,0,1,1]}},{handedness:'right',gamepad:{buttons:[],axes:[0,0,1,1]}}];
  const rigRotation=f.camera.parent.quaternion.clone(),initial=f.camera.parent.position.clone();
  for(let i=1;i<=8;i++){
    const result=f.tick(i*14,{yaw:i*.07,pitch:-i*.025,roll:i*.01});
    assert.ok(f.camera.quaternion.angleTo(result.tracking)<1e-7,'native head orientation preserved');
    assert.ok(f.camera.parent.quaternion.angleTo(rigRotation)<1e-7,'manual snap turn suppressed');
  }
  assert.ok(updates>0);assert.ok(f.camera.parent.position.x>initial.x);assert.ok(Math.abs(f.camera.parent.position.z-initial.z)<1e-7,'manual walking suppressed');
  tour.state.paused=true;const paused=f.camera.parent.position.clone();const tracked=f.tick(140,{x:.06,z:.03,yaw:1,pitch:.4,roll:.2});assert.ok(f.camera.parent.position.distanceTo(paused)<1e-7);
  const movedHead=f.tick(154,{x:.09,z:.03,yaw:1,pitch:.4,roll:.2});assert.ok(Math.abs(movedHead.head[0]-tracked.head[0]-.03)<1e-7,'physical translation stays free during pause');
  f.session.visibilityState='visible-blurred';const count=updates;f.tick(160);assert.equal(updates,count,'system menu suspends tour');
  await f.mode.end();assert.equal(tour.state.active,false);await f.mode.enter();f.tick(200);assert.equal(tour.state.active,false);await f.mode.end();assert.deepEqual(f.errors,[]);
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
test('refresh-rate negotiation cannot block the first VR frame',async()=>{
  const f=fixture();f.session.supportedFrameRates=[72];f.session.updateTargetFrameRate=()=>new Promise(()=>{});
  const result=await Promise.race([f.mode.enter().then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),300))]);
  assert.equal(result,true);f.tick(0);assert.equal(f.mode.diagnostics.frames,1);await f.mode.end();
});
test('stopped frames recover to the browser and the Meta menu can pause safely',async()=>{
  const f=fixture();f.session.visibilityState='visible';await f.mode.enter();f.tick(0);
  f.session.visibilityState='visible-blurred';f.advanceClock(30000);assert.equal(f.mode.active,true);
  f.session.visibilityState='visible';f.advanceClock(1000);assert.equal(f.mode.active,true);
  f.advanceClock(21000);await Promise.resolve();assert.equal(f.mode.active,false);assert.match(f.mode.diagnostics.frameError,/parou/);
});
test('a session that never delivers its first frame returns to the browser',async()=>{
  const f=fixture();await f.mode.enter();f.advanceClock(21000);await Promise.resolve();
  assert.equal(f.mode.active,false);assert.match(f.mode.diagnostics.frameError,/não iniciou/);
});
test('VR loading stays in both eyes while compilation waits and reaches 100 only after the house renders',async()=>{
  const loadingScene={},progress=[],draws=[];let finishCompile,prepared=0,disposed=0,opened=0;
  const f=fixture('50',()=>({visible:false,open(){opened++;},update:()=>[],dispose(){}}),{
    prepareScene(){prepared++;},createLoading:()=>({scene:loadingScene,percent:10,set(value){progress.push(value);this.percent=value;},update(){},dispose(){disposed++;}})});
  f.renderer.compileAsync=()=>new Promise(r=>finishCompile=r);
  const render=f.renderer.render;f.renderer.render=(scene,camera)=>{draws.push(scene===loadingScene?'loading':'house');render(scene,camera);};
  await f.mode.enter();assert.equal(prepared,0);f.tick(0);assert.deepEqual(draws,['loading']);
  f.tick(16);assert.equal(prepared,1);f.tick(32);f.tick(48);assert.equal(opened,0);assert.ok(!progress.includes(100));assert.ok(!draws.includes('house'));
  finishCompile();await new Promise(setImmediate);f.tick(64);f.tick(80);assert.equal(progress.at(-1),100);assert.ok(draws.includes('house'));assert.equal(opened,0);
  f.tick(500);f.tick(516);assert.equal(disposed,1);assert.equal(opened,1);await f.mode.end();
});
test('VR loading can be canceled while shaders are still preparing',async()=>{
  let options,disposed=0;const f=fixture('50',undefined,{createLoading:o=>{options=o;return {scene:{},percent:10,set(){},update(){},select(){void options.exitVR();},dispose(){disposed++;}};}});
  f.renderer.compileAsync=()=>new Promise(()=>{});await f.mode.enter();f.tick(0);f.tick(16);f.tick(32);
  f.renderer.xr.getController(0).dispatchEvent({type:'select'});await Promise.resolve();assert.equal(f.mode.active,false);assert.equal(disposed,1);
});


test('an invalid physical head offset during the tour recovers before a black frame is rendered',async()=>{
 let tour;const f=fixture('62',undefined,{getTour:()=>tour});tour=f.api.createHouseTour({getPhysics:()=>f.physics,getPlan:()=>f.house.userData.plan,getModel:()=> '62'});
 await f.mode.enter();f.tick(0);f.mode.tourAction('start');for(let i=1;i<100;i++)f.tick(i*14);
 const bad=f.tick(1400,{x:8,y:-4,z:3,yaw:.4,pitch:.1,roll:.05});assert.equal(bad.curtain,false);assert.ok(bad.head[1]>1.6);assert.ok(f.camera.quaternion.angleTo(bad.tracking)<1e-7);assert.equal(tour.state.active,true);
 assert.ok(Math.abs(f.camera.parent.rotation.x)<1e-7);assert.ok(Math.abs(f.camera.parent.rotation.z)<1e-7);f.mode.tourAction('stop');await f.mode.end();assert.deepEqual(f.errors,[]);
});
