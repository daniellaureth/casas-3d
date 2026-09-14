const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../quest-vr.js'),'utf8');
function setup(xr, airLink = false) {
  const button={},status={}; let prepared=0,restored=0;
  class Vector {constructor(){this.x=this.y=this.z=0;}set(x,y,z){Object.assign(this,{x,y,z});return this;}copy(v){return this.set(v.x,v.y,v.z);}clone(){return new Vector().copy(this);}}
  class Group {constructor(){this.position=new Vector();this.quaternion=new Vector();this.rotation=new Vector();this.children=[];}add(obj){obj.parent?.remove(obj);this.children.push(obj);obj.parent=this;}remove(obj){this.children=this.children.filter(x=>x!==obj);if(obj)obj.parent=null;}addEventListener(){}removeEventListener(){}}
  const camera=new Group();camera.clearViewOffset=()=>{};camera.position.set(4,6,8);
  const scene=new Group(),controls={enabled:true};
  const renderer={shadowMap:{enabled:true},setAnimationLoop(fn){this.loop=fn;},xr:{setReferenceSpaceType(){},setFramebufferScaleFactor(){},getController(){return new Group();},async setSession(s){this.session=s;},setFoveation(){}}};
  const context=vm.createContext({navigator:{xr},window:{isSecureContext:true},document:{getElementById:id=>id==='quest-vr'?button:status,body:{classList:{add(){},remove(){}}}},queueMicrotask});
  const create=vm.runInContext(source+'\ncreateQuestVR',context);
  const mode=create({renderer,scene,camera,controls,Group,Vector3:Vector,airLink,makeCurtain:()=>new Group(),prepare(){prepared++;},restore(){restored++;},getPhysics:()=>({spawn:{x:1,z:2},floorAt:()=>0}),invalidate(){}});
  return {mode,camera,controls,renderer,status,button,get prepared(){return prepared;},get restored(){return restored;}};
}
test('unsupported browsers show connection guidance and keep desktop controls',async()=>{
  const f=setup(undefined);await f.mode.enter();assert.equal(f.mode.active,false);assert.equal(f.prepared,0);assert.match(f.status.textContent,/Quest/);assert.equal(f.controls.enabled,true);
});

test('Air Link detects a headset connected after opening and keeps entry available',async()=>{
  let connected=false;
  const f=setup({isSessionSupported:async type=>{assert.equal(type,'immersive-vr');return connected;}},true);
  await f.mode.checkConnection();assert.match(f.status.textContent,/Conecte o Air Link/);
  connected=true;await f.mode.checkConnection();assert.match(f.status.textContent,/Óculos detectados/);
  assert.equal(f.button.textContent,'Entrar na casa sem fio');assert.notEqual(f.button.disabled,true);
});

test('Air Link enters directly from click without awaiting discovery and restores wireless entry',async()=>{
  let end,requested=false;
  const session={addEventListener(type,fn){if(type==='end')end=fn;},async end(){end();}};
  const f=setup({isSessionSupported:()=>new Promise(()=>{}),requestSession(type){requested=true;return Promise.resolve(session);}},true);
  const entering=f.button.onclick();assert.equal(requested,true);
  await entering;assert.equal(f.mode.active,true);
  await f.mode.end();await Promise.resolve();assert.equal(f.button.textContent,'Entrar na casa sem fio');
});

test('Air Link connection failures offer wireless recovery and allow retry',async()=>{
  for(const errorName of ['NotSupportedError','NotAllowedError','SecurityError','InvalidStateError']) {
    const f=setup({requestSession:async()=>{const e=new Error();e.name=errorName;throw e;}},true);
    await f.mode.enter();assert.equal(f.prepared,0);assert.equal(f.button.disabled,false);assert.equal(f.controls.enabled,true);
    assert.doesNotMatch(f.status.textContent,/USB|HTTPS|cabo/);
    if(errorName==='NotSupportedError')assert.match(f.status.textContent,/Air Link/);
    if(errorName==='NotAllowedError')assert.match(f.status.textContent,/Permita/);
  }
});
test('rejected immersive sessions leave the desktop unchanged',async()=>{
  const f=setup({requestSession:async()=>{const e=new Error();e.name='NotSupportedError';throw e;}});
  await f.mode.enter();assert.equal(f.mode.active,false);assert.equal(f.prepared,0);assert.equal(f.camera.position.x,4);assert.equal(f.button.disabled,false);
});
test('VR session lifecycle restores camera and shadows on exit',async()=>{
  let end;
  const session={addEventListener(type,fn){if(type==='end')end=fn;},async end(){end();}};
  const f=setup({requestSession:async(type,options)=>{assert.equal(type,'immersive-vr');assert.ok(options.requiredFeatures.includes('local-floor'));assert.ok(options.optionalFeatures.includes('hand-tracking'));assert.ok(!options.requiredFeatures.includes('hand-tracking'));return session;}});
  await f.mode.enter();assert.equal(f.mode.active,true);assert.equal(f.controls.enabled,false);assert.equal(f.renderer.shadowMap.enabled,false);assert.equal(typeof f.renderer.loop,'function');
  await f.mode.end();await Promise.resolve();assert.equal(f.mode.active,false);assert.equal(f.controls.enabled,true);assert.equal(f.camera.position.x,4);assert.equal(f.camera.position.y,6);assert.equal(f.camera.position.z,8);assert.equal(f.renderer.shadowMap.enabled,true);assert.equal(f.restored,1);
});
