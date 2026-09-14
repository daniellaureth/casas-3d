// Real Chrome/WebGL production QA. UA emulation tests graphics selection, NOT Quest FPS.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {createServer}=require('../scripts/serve.cjs'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const source=process.argv.includes('--source'),server=createServer({source});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const published=process.argv.find(arg=>arg.startsWith('--url='))?.slice(6);
  const base=published||'http://127.0.0.1:'+server.address().port+'/casas-3d/';
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'casas-standalone-'));
  const browser=spawn(path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),['--app=about:blank','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1440,1000','--remote-debugging-port=0','--force_high_performance_gpu'],{stdio:'ignore'});
  let ws;const report=[];
  try{
    const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<60&&!fs.existsSync(portFile);i++)await delay(500);
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
    const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}
      if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
      if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry);
      if(m.method==='Network.responseReceived'&&m.params.response.status>=400)errors.push(m.params.response);
      if(m.method==='Network.loadingFailed'&&!m.params.canceled)errors.push(m.params);
      if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);
    };
    const send=(method,params={})=>new Promise((r,j)=>{const key=++id,t=setTimeout(()=>{pending.delete(key);j(Error('Timed out '+method));},30000);pending.set(key,m=>{clearTimeout(t);if(m.error)j(Error(JSON.stringify(m.error)));else r(m.result);});ws.send(JSON.stringify({id:key,method,params}));});
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
    const settled=async()=>{for(let i=0;i<120;i++){if(await evaluate('!!casaDebug().batch && !casaDebug().rendering'))return;await delay(100);}throw Error('Scene did not settle');};
    await send('Runtime.enable');await send('Log.enable');await send('Network.enable');
    for(const quest of [false,true]){
      errors.length=0;
      await send('Emulation.setUserAgentOverride',{userAgent:quest?'Mozilla/5.0 (Linux; Android 12; Quest 3S) AppleWebKit/537.36 OculusBrowser/40.0 Chrome/152.0.0.0 Safari/537.36':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36'});
      await send('Page.navigate',{url:base});
      let ready=false;for(let i=0;i<240;i++){if(await evaluate('document.readyState==="complete" && typeof casaDebug==="function"')){ready=true;break;}await delay(250);}assert.ok(ready,'loaded '+JSON.stringify({errors,loading:await evaluate('window.CasaLoading?.state')}));await delay(1800);
      const state=await evaluate('({debug:casaDebug(),secure:isSecureContext,xr:!!navigator.xr,vrButton:document.getElementById("quest-vr").textContent})');
      assert.equal(state.debug.graphics.lightweight,quest);assert.equal(state.debug.shadows,!quest);assert.ok(state.secure);assert.ok(state.xr);assert.match(state.vrButton,/Entrar.*VR/);
      for(const model of ['50','60','62','69']){
        await evaluate(`document.getElementById('model').value='${model}';document.getElementById('model').dispatchEvent(new Event('change'));`);await settled();
        const d=await evaluate('casaDebug()');assert.equal(d.model,model);assert.ok(d.frame.calls>0);report.push({source,url:base,quest,model,batch:d.batch,frame:d.frame,pixelRatio:d.pixelRatio});
      }
      // Exercise every existing facade and return to the default.
      for(let i=0;i<5;i++){await evaluate(`document.querySelectorAll('.facade-choice')[${i}].click()`);await delay(350);}
      await evaluate("document.querySelectorAll('.facade-choice')[0].click()");await settled();
      if(process.argv.includes('--experiences')){
        const click=id=>evaluate('document.getElementById('+JSON.stringify(id)+').click()');
        const waitFor=async expression=>{for(let i=0;i<600;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Timed out '+expression);};
        assert.equal(await evaluate('document.querySelectorAll("#day,#night").length'),0,'day/night removed');
        await click('auto-tour');await waitFor('casaDebug().automaticTour.phase!=="planning"');
        assert.equal(await evaluate('casaDebug().walking'),true,'tour starts from overview in first person');
        assert.equal(await evaluate('document.getElementById("tour-hud").hidden'),false);
        await click('tour-pause');const paused=await evaluate('casaDebug().camera');await delay(250);assert.deepEqual(await evaluate('casaDebug().camera'),paused);
        await click('tour-resume');assert.equal(await evaluate('casaDebug().automaticTour.paused'),false);
        const index=await evaluate('casaDebug().automaticTour.index');await click('tour-next');await waitFor('casaDebug().automaticTour.phase!=="planning"');assert.equal(await evaluate('casaDebug().automaticTour.index'),index+1);
        await click('tour-previous');await waitFor('casaDebug().automaticTour.phase!=="planning"');assert.equal(await evaluate('casaDebug().automaticTour.index'),index);
        const hud=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'standalone-tour-'+(quest?'quest':'desktop')+'.png'),Buffer.from(hud.data,'base64'));
        await click('tour-stop');assert.equal(await evaluate('casaDebug().automaticTour.active'),false);assert.equal(await evaluate('casaDebug().walking'),true,'normal first-person controls restored');
        await click('auto-tour');await waitFor('casaDebug().automaticTour.phase!=="planning"');
        await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{code:"Escape",key:"Escape"}))');assert.equal(await evaluate('casaDebug().automaticTour.active'),false);
        await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{code:"Escape",key:"Escape"}))');assert.equal(await evaluate('casaDebug().walking'),false);
        await settled();
        report.push({quest,experiences:'passed',resources:await evaluate('casaDebug().resources')});
      }
      const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,'standalone-'+(source?'source-':'production-')+(quest?'quest':'desktop')+'.png'),Buffer.from(shot.data,'base64'));
      assert.deepEqual(errors,[],'no console, network or WebGL errors');
    }
    fs.writeFileSync(path.join(__dirname,'standalone-'+(source?'source':'production')+'-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await send('Browser.close');
  }finally{ws?.close();browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
