// Desktop visual QA of the actual VR panel. Does not emulate or enter a headset.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const root=path.join(__dirname,'..');
  const injection=`
  window.questPanelPreview=(tab='casa')=>{
    if(!window.previewPanel){
      if(Br){cancelAnimationFrame(Br);Br=0;}xe.enabled=false;Je.position.set(0,1.65,0);Je.rotation.set(0,0,0);Je.fov=65;Je.clearViewOffset();Je.updateProjectionMatrix();
      document.querySelectorAll('aside,header,.views,.timeline,.hint,#quest-status').forEach(e=>e.style.display='none');
      window.previewPanel=createQuestPanel({scene:Tn,camera:Je,Group:Ce,Mesh:Zt,PlaneGeometry:Ns,CanvasTexture:rd,MeshBasicMaterial:Gr,Vector3:q,getState:()=>({...questConfiguration(),amplitude:1}),change:questChangeConfiguration,navigate:()=>'',door:()=>false,exitVR:()=>{}});
      window.previewPanel.open(new q(0,1.65,0),new q(0,0,-1));
      ee.setAnimationLoop(()=>ee.render(Tn,Je));
    }
    window.previewPanel.buttons.find(b=>b.id==='tab-'+tab).action();
    return {model:et('model').value,buttons:window.previewPanel.buttons.map(b=>b.id)};
  };
  `;
  const html=fs.readFileSync(path.join(root,'Casas3D.html'),'utf8').replace('// END NAVIGATION MODULES',injection+'\n// END NAVIGATION MODULES');
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/';
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'casas-panel-preview-'));
  const browser=spawn(path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),['--app='+url,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1440,1000','--remote-debugging-port=0','--force_high_performance_gpu'],{stdio:'ignore'});
  let ws;
  try{
    const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<60&&!fs.existsSync(portFile);i++)await delay(500);
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
    const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    const page=pages.find(p=>p.type==='page'&&p.url===url);ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
    const send=(method,params={})=>new Promise(resolve=>{pending.set(++id,resolve);ws.send(JSON.stringify({id,method,params}));});
    for(let i=0;i<60;i++){const state=await send('Runtime.evaluate',{expression:'typeof window.questPanelPreview',returnByValue:true});if(state.result?.result?.value==='function')break;await delay(500);}
    for(const tab of ['casa','terreno','passeio','visao']){
      const result=await send('Runtime.evaluate',{expression:`window.questPanelPreview('${tab}')`,returnByValue:true});
      if(result.result?.exceptionDetails)throw Error(JSON.stringify(result.result.exceptionDetails));
      await delay(250);const shot=await send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(__dirname,'quest-panel-'+tab+'.png'),Buffer.from(shot.result.data,'base64'));console.log('Panel rendered:',tab);
    }
    await send('Browser.close');
  }finally{ws?.close();browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
