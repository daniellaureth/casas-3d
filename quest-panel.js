// A real scene panel: available to both stereo views and XR target rays.
function createQuestPanel({scene,camera,Group,Mesh,PlaneGeometry,CanvasTexture,MeshBasicMaterial,Vector3,getState,getTourState=()=>null,change,navigate,door,exitVR}) {
  const width=1.04,height=0.82,W=1040,H=820;
  const root=new Group(),dock=new Group();
  const canvas=document.createElement('canvas'),uiScale=2048/W;canvas.width=2048;canvas.height=Math.ceil(H*uiScale);
  const ctx=canvas.getContext('2d');ctx.scale(uiScale,uiScale);
  const texture=new CanvasTexture(canvas);texture.colorSpace='srgb';texture.generateMipmaps=false;texture.minFilter=1006;texture.anisotropy=4;
  const material=new MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const board=new Mesh(new PlaneGeometry(width,height),material);board.renderOrder=1000;root.add(board);scene.add(root);
  const chip=document.createElement('canvas');chip.width=2048;chip.height=640;
  const chipContext=chip.getContext('2d');chipContext.scale(2,2);chipContext.fillStyle='#264e3b';chipContext.fillRect(0,0,512,128);
  chipContext.fillStyle='#ffffff';chipContext.font='600 46px Arial';chipContext.textAlign='center';chipContext.fillText('Minha casa',256,82);
  const chipTexture=new CanvasTexture(chip);chipTexture.colorSpace='srgb';chipTexture.generateMipmaps=false;chipTexture.minFilter=1006;chipTexture.anisotropy=4;
  const chipMaterial=new MeshBasicMaterial({map:chipTexture,depthTest:false,depthWrite:false,toneMapped:false});
  const chipMesh=new Mesh(new PlaneGeometry(.28,.07),chipMaterial);chipMesh.renderOrder=1001;
  dock.add(chipMesh);dock.position.set(-.30,-.27,-.9);camera.add(dock);
  root.visible=false;
  let page='casa',buttons=[],hover='',message='',inputHint='Aponte e aperte o gatilho para escolher.',draft=null,disposed=false;
  let dockWidth=.28,dockHeight=.07,dockButtons=[],tourRevision=-1;
  const a=new Vector3(),b=new Vector3(),origin=new Vector3(),direction=new Vector3();
  function text(value,x,y,size=25,color='#263e33',align='left') {ctx.fillStyle=color;ctx.font=`${size>=28?'600':'400'} ${size}px Arial`;ctx.textAlign=align;ctx.fillText(value,x,y);}
  function rect(x,y,w,h,color) {ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,14);ctx.fill();}
  function item(id,label,x,y,w,h,action,selected=false,disabled=false) {
    rect(x,y,w,h,disabled?'#e4e7e2':hover===id?'#ccdfd0':selected?'#315c44':'#e9efe7');
    text(label,x+w/2,y+h/2+10,28,disabled?'#788177':selected&&hover!==id?'#ffffff':'#263e33','center');
    buttons.push({id,x,y,w,h,action,disabled});
  }
  function wrap(value,x,y,maxWidth,size=22) {
    ctx.font=`${size}px Arial`;let line='',row=y;
    for(const word of value.split(' ')){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){text(line,x,row,size);line=word;row+=28;}else line=next;}
    if(line)text(line,x,row,size);
  }
  function choose(key,value) {
    try {message=change(key,value)||'Escolha aplicada.';}catch(error){message=error.message||'Não foi possível aplicar essa escolha.';}
    draw();
  }
  function draw() {
    if(disposed)return;
    const s=getState();buttons=[];ctx.clearRect(0,0,W,H);rect(0,0,W,H,'#fafaf2');
    text('Escolha sua casa',35,57,36);text('Veja as mudanças durante a visita',35,92,22,'#637364');
    item('close','Fechar',840,25,165,64,close);
    if(exitVR)item('exit-vr','Sair do VR',635,25,190,64,exitVR);
    ['casa','terreno','passeio','visao','tour'].forEach((tab,i)=>item('tab-'+tab,{casa:'Casa',terreno:'Terreno',passeio:'Passeio',visao:'Visão',tour:'Tour'}[tab],35+i*196,113,184,56,()=>{page=tab;message='';draft=null;draw();},page===tab));
    if(page==='casa') {
      text('PLANTA',35,207,22);
      s.models.forEach((m,i)=>item('model-'+m.value,m.label,35+i*245,222,231,62,()=>choose('model',m.value),m.value===s.model));
      text(s.modelDescription,35,316,23,'#637364');
      text('FACHADA',35,355,22);
      s.facades.forEach((f,i)=>item('facade-'+i,f,35+(i%3)*326,372+Math.floor(i/3)*66,312,56,()=>choose('facade',i),i===s.facade));
      item('high','Sala alta: '+(s.high?'sim':'não'),35,523,475,64,()=>choose('high',!s.high),s.high);
      item('garage','Garagem: '+(s.garage?'sim':'não'),530,523,475,64,()=>choose('garage',!s.garage),s.garage);
      item('garage-1','1 vaga',530,600,228,58,()=>choose('garageSpaces',1),s.garageSpaces===1,!s.garage);
      item('garage-2','2 vagas',778,600,227,58,()=>choose('garageSpaces',2),s.garageSpaces===2,!s.garage||!s.twoSpaces);
      if(s.garage&&!s.twoSpaces)text('Duas vagas não cabem neste lote.',530,689,21,'#637364');
    } else if(page==='terreno') {
      text('TAMANHO DO TERRENO',35,210,22);
      [[12,21],[10,25],[11,28],[15,30]].forEach(([w,d],i)=>item('lot-'+i,`${w} × ${d} m`,35+i*245,232,231,67,()=>{draft=null;choose('lot',{width:w,depth:d});},s.width===w&&s.depth===d));
      draft ||= {width:s.width,depth:s.depth};
      text('Medidas personalizadas',35,353,30);
      [['width','Largura'],['depth','Profundidade']].forEach(([key,label],i)=>{
        const y=380+i*92;text(label,35,y+40,26);text(draft[key].toLocaleString('pt-BR')+' m',535,y+40,30,'#263e33','center');
        item('less-'+key,'−',335,y,92,62,()=>{draft[key]=Math.max(1,Math.round((draft[key]-1)*100)/100);draw();});
        item('more-'+key,'+',655,y,92,62,()=>{draft[key]=Math.min(key==='width'?40:60,Math.round((draft[key]+1)*100)/100);draw();});
      });
      item('apply-lot','Aplicar medidas',35,585,970,66,()=>choose('lot',{...draft}),true);
      text('O espaço mínimo para a casa é conferido antes de aplicar.',35,688,22,'#637364');
    } else if(page==='passeio') {
      item('furniture','Móveis: '+(s.furniture?'sim':'não'),35,195,312,60,()=>choose('furniture',!s.furniture),s.furniture);
      item('light',s.evening?'Entardecer: sim':'Entardecer: não',361,195,312,60,()=>choose('light',!s.evening),s.evening);
      item('boundary','Muros: '+(s.boundary?'sim':'não'),687,195,318,60,()=>choose('boundary',!s.boundary),s.boundary);
      text('IR PARA UM AMBIENTE',35,303,22);
      s.destinations.forEach((d,i)=>item('go-'+d.id,d.name,35+(i%3)*326,325+Math.floor(i/3)*66,312,56,()=>{message=navigate(d.id)||'';draw();}));
      const y=325+Math.ceil(s.destinations.length/3)*66+18;
      item('door','Abrir / fechar a porta à frente',35,y,970,58,()=>{message=door()?'Porta acionada.':'Olhe para uma porta próxima e tente novamente.';draw();});
    } else if(page==='tour') {
      const tour=s.tour||{};
      item('tour-start','Tour automático',35,195,970,68,()=>choose('tour','start'),!!tour.active);
      text('Tour sentado'+(tour.total?' · '+(tour.index+1)+' / '+tour.total:''),35,310,30);text(tour.active?tour.label:'Visão elevada · Cômodos, fachada e terreno.',35,352,26);
      item('tour-pause','Pausar',35,385,475,62,()=>choose('tour','pause'),false,!tour.active||tour.paused);
      item('tour-resume','Continuar',530,385,475,62,()=>choose('tour','resume'),false,!tour.active||!tour.paused);
      item('tour-next','Próximo ambiente',35,465,475,62,()=>choose('tour','next'),false,!tour.active);
      item('tour-previous','Ambiente anterior',530,465,475,62,()=>choose('tour','previous'),false,!tour.active);
      item('tour-stop','Encerrar tour',35,545,970,62,()=>choose('tour','stop'),false,!tour.active);
      wrap(tour.message||'Sente-se olhando à frente ao iniciar. O tour guia a visão; você pode olhar para os lados.',35,657,970,24);
    } else {
      text('SENSAÇÃO DE ESPAÇO',35,224,25);
      [[1,'Normal'],[1.4,'Ampla'],[2,'Muito ampla']].forEach(([value,label],i)=>item('amplitude-'+value,label,35+i*326,252,312,78,()=>choose('amplitude',value),s.amplitude===value));
      wrap('Amplia a percepção do espaço em relação ao visitante. As medidas da planta permanecem iguais.',35,391,940,27);
      wrap('É um ajuste visual. Para avaliar as dimensões reais da casa, escolha Normal.',35,495,940,26);
      wrap('Escolha a opção mais confortável para o seu passeio.',35,601,940,26);
    }
    item('tour-quick',s.tour?.active?'Controles do tour':'▶ Tour automático',35,710,475,62,()=>{
      if(s.tour?.active){page='tour';message='';draw();}else choose('tour','start');
    },true);
    wrap(message||'Suas escolhas permanecem ao continuar o passeio.',530,732,475,22);
    text(inputHint,35,792,21,'#637364');texture.needsUpdate=true;
  }
  function place(head,forward) {
    const length=Math.hypot(forward.x,forward.z)||1;
    root.scale.setScalar(1.08);
    root.position.set(head.x+forward.x/length*1.15,head.y-.10,head.z+forward.z/length*1.15);
    root.lookAt(head.x,root.position.y,head.z);root.updateMatrixWorld(true);
  }
  function open(head,forward) {root.visible=true;dock.visible=false;place(head,forward);draw();}
  function close() {root.visible=false;dock.visible=true;}
  function drawDock(s){
    const tour=s.tour;dockButtons=[];chipContext.fillStyle='#264e3b';chipContext.fillRect(0,0,1024,320);chipContext.fillStyle='#ffffff';chipContext.textAlign='center';
    if(tour?.active){
      dockWidth=.78;dockHeight=.24;dock.position.set(0,-.40,-1.1);chipContext.font='600 34px Arial';chipContext.fillText('Tour da casa'+(tour.total?' · '+(tour.index+1)+' / '+tour.total:''),360,58);chipContext.font='600 38px Arial';chipContext.fillText(tour.label+(tour.paused?' · Pausado':''),512,143);
      function button(id,label,x,y,w,h,action,disabled=false){chipContext.fillStyle=disabled?'#5f7766':'#eff3e8';chipContext.fillRect(x,y,w,h);chipContext.fillStyle='#264e3b';chipContext.font='600 30px Arial';chipContext.fillText(label,x+w/2,y+h/2+10);dockButtons.push({id,x,y,w,h,action,disabled});}
      button('dock-menu','Opções',820,15,184,60,()=>{camera.getWorldPosition(origin);camera.getWorldDirection(direction);open(origin,direction);});
      [['pause','Pausar'],['resume','Continuar'],['next','Próximo'],['previous','Anterior'],['stop','Encerrar']].forEach(([action,label],i)=>button('dock-tour-'+action,label,20+i*198,205,184,82,()=>{change('tour',action);drawDock(getState());},action==='pause'?tour.paused:action==='resume'?!tour.paused:false));
    }else{dockWidth=.28;dockHeight=.07;dock.position.set(-.30,-.27,-.9);chipContext.font='82px Arial';chipContext.fillText('Minha casa',512,205);}
    chipMesh.scale.set(dockWidth/.28,dockHeight/.07,1);chipTexture.needsUpdate=true;
  }
  function ensureReachable(head,forward){
    if(!root.visible)return;
    const distance=root.position.distanceTo(head);
    if(distance>1.7||distance<.6||Math.abs(root.position.y-head.y)>.7)place(head,forward);
  }
  function planeHit(object,origin,direction,w,h) {
    object.updateWorldMatrix(true,false);a.copy(origin);b.copy(origin).add(direction);object.worldToLocal(a);object.worldToLocal(b);b.sub(a);
    if(a.z<0||b.z>=-.00001)return null;
    const t=-a.z/b.z,x=a.x+t*b.x,y=a.y+t*b.y;
    if(t<0||t>4||Math.abs(x)>w/2||Math.abs(y)>h/2)return null;
    return {distance:t,x:(x/w+.5)*W,y:(.5-y/h)*H};
  }
  function hit(controller) {
    if(controller.visible===false)return null;
    controller.updateWorldMatrix(true,false);controller.getWorldPosition(origin);direction.set(0,0,-1).transformDirection(controller.matrixWorld);
    if(root.visible){const point=planeHit(root,origin,direction,width,height);if(point)return {...point,button:buttons.find(v=>point.x>=v.x&&point.x<=v.x+v.w&&point.y>=v.y&&point.y<=v.y+v.h)};}
    const point=dock.visible?planeHit(dock,origin,direction,dockWidth,dockHeight):null;
    if(point&&dockButtons.length){const x=point.x/W*1024,y=point.y/H*320;return {...point,button:dockButtons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)};}
    return point?{...point,button:{id:'dock',action:()=>{
      if(root.visible)close();else{camera.getWorldPosition(origin);camera.getWorldDirection(direction);open(origin,direction);}
    }}}:null;
  }
  function select(controller) {const target=hit(controller);if(!target)return false;if(target.button&&!target.button.disabled)target.button.action();return true;}
  function update(controllers,hint) {
    const revision=getTourState()?.revision??-1;if(revision!==tourRevision){tourRevision=revision;const state=getState();drawDock(state);if(root.visible)draw();}
    let next='';const hits=controllers.map(c=>{const h=hit(c);if(h?.button&&!h.button.disabled)next=h.button.id;return h;});
    if(next!==hover||inputHint!==hint){hover=next;inputHint=hint;if(root.visible)draw();}
    return hits;
  }
  drawDock(getState());
  return {root,dock,open,place,ensureReachable,select,hit,update,draw,get visible(){return root.visible;},get buttons(){return buttons;},
    close,dispose(){disposed=true;scene.remove(root);camera.remove(dock);board.geometry.dispose();chipMesh.geometry.dispose();material.dispose();chipMaterial.dispose();texture.dispose();chipTexture.dispose();}};
}

function questSafePosition(physics,point,bounds=null) {
  const valid=(x,z)=>!physics.blocked(x,z)&&(!bounds||(x>=bounds.minX+physics.radius&&x<=bounds.maxX-physics.radius&&z>=bounds.minZ+physics.radius&&z<=bounds.maxZ-physics.radius));
  if(valid(point.x,point.z))return {x:point.x,z:point.z};
  for(let radius=.1;radius<=4;radius+=.1)for(let i=0;i<48;i++){
    const angle=i*Math.PI/24,x=point.x+Math.cos(angle)*radius,z=point.z+Math.sin(angle)*radius;
    if(valid(x,z))return {x,z};
  }
  return !bounds&&valid(physics.spawn.x,physics.spawn.z)?{...physics.spawn}:null;
}
