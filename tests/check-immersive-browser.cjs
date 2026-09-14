// Exercises the actual WebGLRenderer + WebXRManager in Chrome with synthetic XR poses.
// This covers stereo rendering and input plumbing, not device performance or runtime permissions.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert/strict'),{spawn}=require('child_process');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function installXR(){
  window.XRWebGLBinding=undefined;
  WebGL2RenderingContext.prototype.makeXRCompatible=async function(){};
  const matrix=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
  const projection=[1,0,0,0,0,1,0,0,0,0,-1.0004,-1,0,0,-.20004,0];
  class Session extends EventTarget {
    constructor(){super();this.inputSources=[];this.enabledFeatures=['local-floor'];this.renderState={};this.visibilityState='visible';this.environmentBlendMode='opaque';this.ended=false;}
    updateRenderState(state){Object.assign(this.renderState,state);}
    requestReferenceSpace(){return Promise.resolve({});}
    requestAnimationFrame(fn){return requestAnimationFrame(t=>{
      if(this.ended)return;const x=window.testHeadMotion?.004*Math.sin(t*.012):0,z=window.testHeadMotion?.003*Math.cos(t*.015):0;
      fn(t,window.lastXRFrame={session:this,getViewerPose:()=>({transform:{matrix:matrix(x,1.7,z)},views:['left','right'].map(eye=>({eye,projectionMatrix:projection,transform:{matrix:matrix(x+(eye==='left'?-.032:.032),1.7,z)}}))}),getPose:()=>({transform:{matrix:window.testRayMatrix||matrix(0,1.3,-.3)}})});
    });}
    cancelAnimationFrame(id){cancelAnimationFrame(id);}
    async end(){this.ended=true;this.dispatchEvent(new Event('end'));}
  }
  window.XRWebGLLayer=class {constructor(){this.framebuffer=null;this.framebufferWidth=1400;this.framebufferHeight=700;}getViewport(view){return {x:view.eye==='left'?0:700,y:0,width:700,height:700};}};
  Object.defineProperty(navigator,'xr',{value:{isSessionSupported:async()=>true,requestSession:async()=>window.testSession=new Session()}});
}
(async()=>{
 const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'Casas3D.html'),'utf8').replace('return createQuestPanel({...options','return window.testPanel=createQuestPanel({...options').replace('const failedSession=session;', 'console.error(error);const failedSession=session;').replace('// END NAVIGATION MODULES',`// END NAVIGATION MODULES
 window.holdXRCompile=()=>{const original=ee.compileAsync.bind(ee);ee.compileAsync=(...args)=>Promise.all([original(...args),new Promise(r=>setTimeout(r,1200))]);};
 window.pointXR=id=>{const b=window.testPanel.buttons.find(b=>b.id===id);const point=window.testPanel.root.localToWorld(new q(((b.x+b.w/2)/1040-.5)*1.04,(.5-(b.y+b.h/2)/820)*.82,0));Je.parent.worldToLocal(point);const origin=new q(0,1.3,-.3),rotation=new ii().setFromUnitVectors(new q(0,0,-1),point.sub(origin).normalize());window.testRayMatrix=new $t().compose(origin,rotation,new q(1,1,1)).toArray();};
 window.inspectXR=()=>({debug:casaDebug(),lights:Tn.children.filter(o=>o.isLight).map(o=>({type:o.type,visible:o.visible,intensity:o.intensity})),camera:Je.matrixWorld.toArray(),eyes:ee.xr.getCamera().cameras.map(c=>({world:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray()}))});`);
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html.replace('<head>',()=>'<head><script>('+installXR.toString()+')()</script>'));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'casas-xr-')),browser=spawn(path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),['--app=about:blank','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1440,950','--remote-debugging-port=0'],{stdio:'ignore'});let ws;
 try{
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<60&&!fs.existsSync(portFile);i++)await delay(250);
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0],pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params);};
  const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  await send('Runtime.enable');await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 12; Quest 3S) OculusBrowser/40.0 Chrome/152.0.0.0'});await send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installXR.toString()+')()'});
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
  for(let i=0;i<600;i++){if(await evaluate('window.CasaLoading?.state.done'))break;await delay(100);}
  assert.equal(await evaluate('window.CasaLoading?.state.done'),true,'application boot completed');
  console.log('Boot',JSON.stringify(await evaluate('window.CasaLoading?.state')),JSON.stringify(errors));
  await delay(600);await evaluate('holdXRCompile();document.getElementById("quest-vr").click()');
  let loadingSeen=false;for(let i=0;i<100;i++){const vr=await evaluate('casaDebug().vr');if(vr.loading===75){assert.equal(vr.panelOpen,false);const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'immersive-loading.png'),Buffer.from(shot.data,'base64'));loadingSeen=true;break;}await delay(25);}assert.ok(loadingSeen,'loading is actually drawn inside XR');
  for(let i=0;i<120;i++){if(await evaluate('casaDebug().vr.panelOpen'))break;await delay(50);}
  const state=await evaluate('inspectXR()');console.log(JSON.stringify(state),JSON.stringify(errors));
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'immersive-stereo.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);assert.equal(state.debug.vr.active,true);assert.ok(state.debug.vr.frames>10);assert.equal(state.eyes.length,2);
  await evaluate('testSession.inputSources=[{targetRaySpace:{},handedness:"right",targetRayMode:"tracked-pointer",profiles:["oculus-touch-v3"],gamepad:{axes:[0,0,0,0],buttons:[]}}];testSession.dispatchEvent(Object.assign(new Event("inputsourceschange"),{added:testSession.inputSources,removed:[]}));pointXR("facade-1")');await delay(100);
  await evaluate('testSession.dispatchEvent(Object.assign(new Event("select"),{inputSource:testSession.inputSources[0],frame:lastXRFrame}))');await delay(200);assert.notEqual(await evaluate('casaDebug().facade'),state.debug.facade);
  if(process.argv.includes('--experiences')){
    const click=async id=>{await evaluate('pointXR('+JSON.stringify(id)+')');await delay(40);await evaluate('testSession.dispatchEvent(Object.assign(new Event("select"),{inputSource:testSession.inputSources[0],frame:lastXRFrame}))');};
    const waitFor=async(expression,attempts=400)=>{for(let i=0;i<attempts;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate('casaDebug()')));};
    const menu=async()=>{await evaluate('testSession.inputSources[0].gamepad.buttons[5]={pressed:true}');await delay(50);await evaluate('testSession.inputSources[0].gamepad.buttons[5].pressed=false');await delay(50);};
    const before=await evaluate('casaDebug()');assert.equal(await evaluate('document.querySelectorAll("#day,#night").length'),0);
    await evaluate('window.testHeadMotion=true');await click('tour-quick');
    await waitFor('casaDebug().automaticTour.index>=2 && casaDebug().automaticTour.active',1400);
    assert.equal(await evaluate('casaDebug().automaticTour.paused'),false,'entrance and living room advance without clicking Next');
    console.log('Automatic VR arrival with head motion',JSON.stringify(await evaluate('casaDebug().automaticTour')));
    await menu();await click('tab-passeio');await evaluate('window.testHeadMotion=false');await delay(80);await click('go-entry');
    assert.equal(await evaluate('casaDebug().automaticTour.active'),false);
    await click('tour-quick');assert.equal(await evaluate('casaDebug().automaticTour.active'),true);
    await waitFor('casaDebug().automaticTour.phase!=="planning"');await menu();await click('tab-tour');await click('tour-pause');const paused=await evaluate('casaDebug().vr.head');await delay(250);assert.deepEqual(await evaluate('casaDebug().vr.head'),paused);
    await click('tour-resume');assert.equal(await evaluate('casaDebug().automaticTour.paused'),false);
    await click('tour-next');await waitFor('casaDebug().automaticTour.phase!=="planning"');assert.equal(await evaluate('casaDebug().automaticTour.index'),1);
    const origin=await evaluate('casaDebug().vr.head');await waitFor('Math.hypot(casaDebug().vr.head[0]-('+origin[0]+'),casaDebug().vr.head[2]-('+origin[2]+'))>.15');
    const tourShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'immersive-tour.png'),Buffer.from(tourShot.data,'base64'));
    await click('tour-previous');await waitFor('casaDebug().automaticTour.phase!=="planning"');assert.equal(await evaluate('casaDebug().automaticTour.index'),0);
    await click('tab-tour');await click('tour-stop');assert.equal(await evaluate('casaDebug().automaticTour.active'),false);
    await click('tour-start');await evaluate('testSession.end()');assert.equal(await evaluate('casaDebug().automaticTour.active'),false);
    await evaluate('document.getElementById("quest-vr").click()');await waitFor('casaDebug().vr.active&&casaDebug().vr.panelOpen');assert.equal(await evaluate('casaDebug().automaticTour.active'),false);
    console.log('VR experiences',JSON.stringify({before,after:await evaluate('casaDebug()')}));
  }
  if(!process.argv.includes('--experiences')){await evaluate('pointXR("close")');await delay(50);await evaluate('testSession.dispatchEvent(Object.assign(new Event("select"),{inputSource:testSession.inputSources[0],frame:lastXRFrame}))');assert.equal(await evaluate('casaDebug().vr.panelOpen'),false);}
  assert.deepEqual(errors,[]);await evaluate('testSession.end()');assert.equal(await evaluate('casaDebug().vr.active'),false);await send('Browser.close');
 }finally{ws?.close();browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
