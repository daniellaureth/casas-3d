// Desktop visual QA of the actual VR panel. Does not emulate or enter a headset.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const root=path.join(__dirname,'..');
  const injection="\nwindow.questPanelPreview=(tab='frente')=>{\n if(!window.previewHands){\n  if(Br){cancelAnimationFrame(Br);Br=0;}xe.enabled=false;Tn.children.forEach(c=>c.visible=false);Tn.background=new Wt(0xe8edef);Tn.fog=null;\n  Je.position.set(0,.10,.5);Je.lookAt(0,.10,0);Je.fov=40;Je.clearViewOffset();Je.updateProjectionMatrix();\n  document.querySelectorAll('aside,header,.views,.timeline,.hint,#quest-status').forEach(e=>e.style.display='none');\n  Tn.add(new Lu(0xffffff,0x666666,2));const light=new Zc(0xffffff,2);light.position.set(-1,2,3);Tn.add(light);\n  const makeHand=function makeHand(T,{forward=false,left=false}={}) {\n  const hand=new T.Group();hand.joints={};hand.userData.handedness=left?'left':'right';\n  function joint(name,x,y,z=0,r=.008){const p=new T.Group();p.position.set(left?-x:x,y,z);p.jointRadius=r;hand.joints[name]=p;hand.add(p);}\n  joint('wrist',0,0);\n  ['thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip'].forEach((name,i)=>joint(name,-.021-i*.015,.025+i*.019,0,.01-i*.001));\n  ['index-finger','middle-finger','ring-finger','pinky-finger'].forEach((name,f)=>{\n    const x=[-.026,-.004,.019,.039][f],factor=[.96,1,.93,.76][f];\n    ['metacarpal','phalanx-proximal','phalanx-intermediate','phalanx-distal','tip'].forEach((part,i)=>joint(name+'-'+part,x,[.035,.08,.12,.145,.17][i]*factor,0,[.01,.009,.008,.007,.006][i]));\n  });\n  if(forward){hand.rotation.x=-Math.PI/2;hand.position.set(.15,1.35,-.4);}hand.updateMatrixWorld(true);return hand;\n};window.previewHands=[];\n  for(const left of [true,false]){const hand=makeHand({Group:Ce},{left});hand.position.x=left?-.1:.1;Tn.add(hand);const visual=createQuestHandVisual({hand,Group:Ce,Mesh:Zt,InstancedMesh:vu,BufferGeometry:je,BufferAttribute:me,SphereGeometry:_o,MeshStandardMaterial:Gr,Vector3:q});window.previewHands.push({hand,visual});}\n  ee.setAnimationLoop(()=>ee.render(Tn,Je));\n }\n for(const {hand,visual} of window.previewHands){hand.rotation.y=tab==='lado'?.7:0;visual.update();}\n return {hands:window.previewHands.length};\n};\n";
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
    for(const tab of ['frente','lado']){
      const result=await send('Runtime.evaluate',{expression:`window.questPanelPreview('${tab}')`,returnByValue:true});
      if(result.result?.exceptionDetails)throw Error(JSON.stringify(result.result.exceptionDetails));
      await delay(250);const shot=await send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(__dirname,'quest-hands-'+tab+'.png'),Buffer.from(shot.result.data,'base64'));console.log('Panel rendered:',tab);
    }
    await send('Browser.close');
  }finally{ws?.close();browser.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
