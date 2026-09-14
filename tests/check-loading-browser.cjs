const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {createServer}=require('../scripts/serve.cjs'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port+'/casas-3d/',profile=fs.mkdtempSync(path.join(os.tmpdir(),'casas-loading-'));
 const browser=spawn(path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),['--app=about:blank','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1280,900','--remote-debugging-port=0','--force_high_performance_gpu'],{stdio:'ignore'});let ws;
 try {
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<60&&!fs.existsSync(portFile);i++)await delay(500);
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0],pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const send=(method,params={})=>new Promise(r=>{pending.set(++id,r);ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result?.value;
  await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:150000,uploadThroughput:150000});
  await send('Page.navigate',{url});const progress=[];let captured=false,finished=false;
  for(let i=0;i<160;i++) {
   const state=await evaluate('window.CasaLoading?.state');
   if(state){assert.equal(state.failed,false);progress.push(state.percent);
    if(state.percent>8&&state.percent<70&&!captured){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'loading-progress.png'),Buffer.from(shot.data,'base64'));captured=true;}
    if(state.done){assert.equal(await evaluate('casaDebug().renderedFrames>0'),true);finished=true;break;}
   }await delay(150);
  }
  assert.ok(captured,'progress is visible while bytes download');assert.ok(finished,'only completes after rendering');
  assert.ok(progress.every((value,i)=>i===0||value>=progress[i-1]),'progress never moves backward');
  await delay(650);assert.equal(await evaluate('document.getElementById("casa-loading").hidden'),true);
  // A failed app download shows a retry action, never a false 100%.
  await send('Network.setBlockedURLs',{urls:['*casas-app.*.js']});await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<50;i++){if(await evaluate('window.CasaLoading?.state.failed && document.readyState!=="loading" && document.getElementById("casa-load-retry")?.hidden===false'))break;await delay(100);}
  const failedState=await evaluate('({state:window.CasaLoading?.state,retryHidden:document.getElementById("casa-load-retry")?.hidden,url:location.href})');
  assert.ok(failedState?.state?.failed && failedState.state.percent<100 && failedState.retryHidden===false,JSON.stringify(failedState));
  console.log('Loading verified: download progress, first frame, automatic dismissal and retry on failure.');await send('Browser.close');
 }finally{ws?.close();browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
