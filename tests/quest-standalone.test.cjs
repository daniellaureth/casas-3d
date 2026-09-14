const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'Casas3D.html'),'utf8');
function context(quest=false){const ctx=vm.createContext({console,AbortController,performance,URL,navigator:{userAgent:quest?'Mozilla/5.0 (Linux; Android 12; Quest 3) OculusBrowser/40.0':'Windows Chrome'}});vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+['walk-layout.js','walk-physics.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')+';globalThis.api={createQuestProfile,questProfile,xx,Wm,Nm,si,createHousePhysics,createWalkPhysics,Group:Ce,Mesh:Zt,Geometry:ye,Material:Gr};',ctx);return ctx.api;}
test('Quest profile detects both headsets without reducing desktop graphics',()=>{
  const api=context();
  for(const device of ['Quest 3','Quest 3S','Quest'])assert.equal(api.createQuestProfile('Mozilla/5.0 (Linux; Android 12; '+device+') OculusBrowser/40').lightweight,true);
  for(const ua of ['Chrome Windows','Chrome Android','Safari Mac'])assert.equal(api.createQuestProfile(ua).lightweight,false);
  assert.equal(api.createQuestProfile('Windows','?quality=quest').lightweight,true);
  assert.equal(api.questProfile.shadows,true);assert.equal(context(true).questProfile.shadows,false);
});
test('Quest batching merges colors, preserves geometry and leaves source materials intact',()=>{
  for(const quest of [false,true]) {
    const a=context(quest),group=new a.Group();
    for(let i=0;i<6;i++){const m=new a.Mesh(new a.Geometry(1,1,1),new a.Material({color:i%2?0xff0000:0x00ff00}));m.position.x=i*2;group.add(m);}
    const colors=group.children.map(m=>m.material.color.getHex()),batch=a.Wm(group);
    assert.equal(batch.children.length,quest?1:2);assert.equal(batch.userData.stats.triangles,72);
    assert.deepEqual(group.children.map(m=>m.material.color.getHex()),colors);
    if(quest){assert.equal(batch.children[0].material.color.getHex(),0xffffff);assert.equal(batch.children[0].geometry.attributes.color.count,216);}
    a.Nm(batch);assert.deepEqual(group.children.map(m=>m.material.color.getHex()),colors);
  }
});
test('Touch ray hits the rotated leaf, rejects occlusion, distance and wrong height',()=>{
  const a=context(true),door={axis:'x',width:1,hingeX:0,hingeZ:0,bottom:0,top:2.2,angle:0,target:0,openAngle:Math.PI/2};
  const p=a.createWalkPhysics({doors:[door]}),o={x:.5,y:1,z:1},r={x:0,y:0,z:-1};
  assert.equal(p.interactRay(o,r),true);assert.equal(door.target,Math.PI/2);
  assert.equal(p.interactRay({...o,y:3},r),false);assert.equal(p.interactRay({...o,z:4},r),false);
  p.boxes.push({minX:0,maxX:1,minZ:.4,maxZ:.5,bottom:0,top:2});assert.equal(p.interactRay(o,r),false);
  p.boxes[0].enabled=()=>false;assert.equal(p.interactRay(o,r),true);
  door.angle=Math.PI/2;assert.equal(p.interactRay({x:1,y:1,z:-.5},{x:-1,y:0,z:0}),true);
  assert.equal(p.interactRay(o,r),false);
});
test('production is self-contained and resolves from a repository subpath',async()=>{
  const {createServer}=require('../scripts/serve.cjs');const server=createServer();
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const base='http://127.0.0.1:'+server.address().port;
    const response=await fetch(base+'/casas-3d/');assert.equal(response.status,200);
    const production=await response.text();assert.equal(production,html);
    const resources=[...production.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]);
    assert.deepEqual(resources.filter(url=>!url.startsWith('data:')&&!url.startsWith('#')),[]);
    assert.equal((await fetch(base+'/casas-3d/missing.glb')).status,404);
    assert.deepEqual(fs.readdirSync(path.join(root,'dist')).sort(),['.nojekyll','index.html','version.json']);
  }finally{await new Promise(r=>server.close(r));}
});
test('standalone calibrates height, handles both Touch sticks and ray triggers, and exits',async()=>{
  const elements={'quest-vr':{},'quest-status':{}};
  const ctx=vm.createContext({console,AbortController,performance,URL,queueMicrotask,navigator:{userAgent:'Android OculusBrowser Quest 3S'},window:{isSecureContext:true},document:{getElementById:id=>elements[id],body:{classList:{add(){},remove(){}}}}});
  vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+fs.readFileSync(path.join(root,'walk-physics.js'),'utf8')+fs.readFileSync(path.join(root,'quest-vr.js'),'utf8')+';globalThis.api={Group:Ce,Vector3:q,createQuestVR,createWalkPhysics};',ctx);
  const T=ctx.api,camera=new T.Group(),scene=new T.Group(),controls={enabled:true},rays=[new T.Group(),new T.Group()];scene.add(camera);camera.clearViewOffset=()=>{};
  camera.getWorldDirection=function(out){return out.set(0,0,-1).applyQuaternion(this.getWorldQuaternion(this.quaternion.clone()));};
  const left={handedness:'left',gamepad:{axes:[0,0,0,-1],buttons:[]}},right={handedness:'right',gamepad:{axes:[0,0,0,0],buttons:[]}};
  let end,rate;const session={inputSources:[left,right],supportedFrameRates:[72,90],updateTargetFrameRate:async value=>{rate=value;},addEventListener(type,fn){if(type==='end')end=fn;},end:async()=>end()};ctx.navigator.xr={requestSession:async()=>session};
  const renderer={shadowMap:{enabled:false},info:{reset(){}},render(){},setAnimationLoop(fn){this.frame=fn;},xr:{isPresenting:true,setReferenceSpaceType(){},setFramebufferScaleFactor(){},getController:i=>rays[i],getCamera:()=>camera,updateCamera:c=>c.updateWorldMatrix(true,false),setSession:async()=>{},setFoveation(){}}};
  const physics=T.createWalkPhysics();physics.spawn={x:0,z:2};let triggerOrigin,triggerDirection,panelOptions;
  physics.interactRay=(o,d)=>{triggerOrigin=o.clone();triggerDirection=d.clone();return true;};
  const mode=T.createQuestVR({...T,renderer,scene,camera,controls,airLink:false,makeCurtain:()=>new T.Group(),prepare(){},restore(){},invalidate(){},getPhysics:()=>physics,getConfiguration:()=>({destinations:[]}),changeConfiguration(){},createPanel(options){panelOptions=options;return {visible:false,open(){},place(){},select:()=>false,update:()=>[],dispose(){}};}});
  await mode.enter();assert.equal(rate,72);assert.equal(renderer.xr.enabled,true);
  camera.position.y=1.1;renderer.frame(0);assert.ok(Math.abs(camera.getWorldPosition(new T.Vector3()).y-1.65)<1e-8);
  renderer.frame(50);assert.ok(camera.getWorldPosition(new T.Vector3()).z<2,'left stick moves');
  left.gamepad.axes[3]=0;right.gamepad.axes[2]=1;renderer.frame(100);assert.ok(Math.abs(camera.parent.rotation.y+Math.PI/6)<1e-8);
  renderer.frame(150);assert.ok(Math.abs(camera.parent.rotation.y+Math.PI/6)<1e-8,'holding stick does not spin');
  right.gamepad.axes[2]=0;renderer.frame(200);right.gamepad.axes[2]=1;renderer.frame(250);assert.ok(Math.abs(camera.parent.rotation.y+Math.PI/3)<1e-8);
  rays[1].position.set(.25,1.2,-.3);rays[1].rotation.y=.5;rays[1].dispatchEvent({type:'select'});
  assert.ok(triggerOrigin.distanceTo(rays[1].getWorldPosition(new T.Vector3()))<1e-8);
  assert.ok(triggerDirection.distanceTo(new T.Vector3(0,0,-1).transformDirection(rays[1].matrixWorld))<1e-8);
  await panelOptions.exitVR();assert.equal(mode.active,false);assert.equal(controls.enabled,true);assert.equal(renderer.frame,null);assert.equal(renderer.shadowMap.enabled,false);
});
