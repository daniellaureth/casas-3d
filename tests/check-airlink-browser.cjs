// Manual hardware check: node tests/check-airlink-browser.cjs <local house URL>
// Uses a real desktop Chrome/OpenXR session, without headset emulation.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  let server;
  let address=process.argv[2];
  if(address==='--local'){
    server=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'../Iniciar-Casas3D.ps1'),'-NoBrowser','-AirLink'],{windowsHide:true});
    address=await new Promise((resolve,reject)=>{
      let output='';server.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/http:\/\/127\.0\.0\.1:\d+\/\?connection=airlink/);if(m)resolve(m[0]);});
      server.on('error',reject);server.on('exit',code=>reject(Error('Local server exited '+code)));
    });
  }
  const url=new URL(address);
  if(url.hostname!=='127.0.0.1')throw Error('Only the local house server is accepted');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'casas-quest-check-'));
  const browser=spawn(path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),[
    '--app='+url.href,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check',
    '--window-size=1440,900','--force-webxr-runtime=openxr','--force_high_performance_gpu','--remote-debugging-port=0'
  ],{stdio:['ignore','ignore','pipe']});
  browser.stderr.on('data',data=>{const message=data.toString();if(/DevTools|ERROR/.test(message))console.log(message.trim());});
  browser.on('exit',code=>console.log('Browser exit',code));
  browser.on('error',e=>{console.error(e.message);process.exitCode=1;});
  let ws;
  try {
    const portFile=path.join(profile,'DevToolsActivePort');
    for(let i=0;i<60&&!fs.existsSync(portFile);i++)await sleep(500);
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
    let page;
    for(let i=0;i<30&&!page;i++){
      let pages;
      try {pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();}
      catch(error){if(i===29)throw error;await sleep(500);continue;}
      page=pages.find(p=>p.type==='page'&&p.url===url.href);
      if(!page)await sleep(500);
    }
    if(!page)throw Error('House page not found');
    ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
    let id=0,closed=false;const pending=new Map();
    ws.onclose=()=>{closed=true;for(const resolve of pending.values())resolve({error:{message:'Test window closed'}});pending.clear();};
    ws.onmessage=event=>{
      const message=JSON.parse(event.data);
      if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}
      if(message.method==='Runtime.exceptionThrown')console.log('PAGE ERROR',JSON.stringify(message.params.exceptionDetails));
    };
    const send=(method,params={})=>closed?Promise.resolve({error:{message:'Test window closed'}}):new Promise(resolve=>{pending.set(++id,resolve);ws.send(JSON.stringify({id,method,params}));});
    await send('Runtime.enable');
    let previous,entered=false;
    for(let i=0;!closed&&i<(process.argv.includes('--wait')?Infinity:24);i++){
      const r=await send('Runtime.evaluate',{expression:`(async()=>({ready:document.readyState,secure:isSecureContext,webxr:!!navigator.xr,supported:navigator.xr?await navigator.xr.isSessionSupported('immersive-vr'):false,status:document.getElementById('quest-status')?.textContent,button:document.getElementById('quest-vr')?.textContent,canvas:!!document.querySelector('canvas'),inVR:document.body.classList.contains('in-vr'),vr:window.casaDebug?.().vr}))()`,awaitPromise:true,returnByValue:true});
      if(closed)break;
      const current=JSON.stringify(r.result||r);
      if(current!==previous){console.log(current);previous=current;}
      if(process.argv.includes('--enter')&&!entered&&r.result?.result?.value?.ready==='complete'&&r.result?.result?.value?.button==='Entrar na casa sem fio'){
        entered=true;
        await send('Page.bringToFront');
        await send('Runtime.evaluate',{expression:`document.getElementById('quest-vr').click()`,userGesture:true});
      }
      await sleep(2500);
    }
    if(!closed){const shot=await send('Page.captureScreenshot',{format:'png'});
      if(shot.result?.data)fs.writeFileSync(path.join(__dirname,'airlink-browser.png'),Buffer.from(shot.result.data,'base64'));
      await send('Browser.close');}
  } finally {ws?.close();browser.kill();server?.kill();}
})().catch(e=>{console.error(e.message,e.cause?.message||'');process.exitCode=1;});
