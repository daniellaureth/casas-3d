// WebXR uses the same house geometry, doors and collision world as the desktop tour.
function createQuestVR({ renderer, scene, camera, controls, Group, Vector3, makeCurtain, prepare, prepareScene,lighting,createLoading,getTour=()=>null,restore, getPhysics, invalidate, createPanel,createHand,createPointer,getConfiguration,changeConfiguration,airLink = /[?&]connection=airlink(?:&|$)/.test(window.location?.search || '') }) {
  const button = document.getElementById('quest-vr');
  const status = document.getElementById('quest-status');
  const entryLabel = airLink ? 'Entrar na casa sem fio' : 'Entrar em VR · Quest';
  let active = false, pending = false, session = null, rig = null, saved = null;
  let lastTime = null, lastSafeHead = null, snapReady = true, curtain = null;
  const head = new Vector3(), direction = new Vector3();
  // The tour follows a stable virtual body. Tracked head motion must not move
  // the route's arrival target or be canceled by translating the rig backwards.
  const tourBody={x:0,y:0,z:0};let tourOwner=null,seatedHeadYaw=0,tourTilt=0,tourTiltSpeed=0,tourBaseHeading=null;
  const turnPivot=new Vector3(),turnAfter=new Vector3(),seatedEye=new Vector3();
  function calibrateSeatedTour(){
    tourBaseHeading=null;
    camera.getWorldDirection(direction);
    // Capture the seated forward direction once. Never chase sideways head turns.
    seatedHeadYaw=Math.atan2(-direction.x,-direction.z)-rig.rotation.y;
    camera.getWorldPosition(seatedEye);rig.worldToLocal(seatedEye);
  }
  function levelTourBase(){
    if(Math.abs(tourTilt)<1e-9&&!tourTiltSpeed)return;
    camera.getWorldPosition(turnPivot);camera.getWorldDirection(direction);
    const worldYaw=Math.atan2(-direction.x,-direction.z);
    turnAfter.set(0,0,-1).applyQuaternion(camera.quaternion);
    rig.rotation.set(0,worldYaw-Math.atan2(-turnAfter.x,-turnAfter.z),0,'YXZ');
    rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);camera.getWorldPosition(turnAfter);
    rig.position.add(turnPivot.sub(turnAfter));tourTilt=0;tourTiltSpeed=0;
    rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
  }
  function guideTourHeading(tour,delta){
    if(!tour?.state.active||!Number.isFinite(tour.state.heading)){levelTourBase();return;}
    const oldTilt=tourTilt,dt=Math.min(.05,delta),floor=getPhysics().floorAt(tourBody.x,tourBody.z);
    const indoors=Number.isFinite(tour.heightLimit?.(tourBody));
    if(indoors){tourTilt=0;tourTiltSpeed=0;}
    else if(!tour.state.paused){
      const focus=tour.state.focus,blend=Math.max(0,Math.min(1,(tourBody.y-floor-2.5)/5.5));
      const wanted=focus?Math.max(-1.25,Math.min(0,Math.atan2(focus.y-tourBody.y,Math.hypot(focus.x-tourBody.x,focus.z-tourBody.z))))*blend*blend*(3-2*blend):0;
      const target=Math.max(-.21,Math.min(.21,(wanted-tourTilt)*1.5));
      tourTiltSpeed+=Math.max(-.17*dt,Math.min(.17*dt,target-tourTiltSpeed));
      tourTilt+=tourTiltSpeed*dt;
    }
    const changed=!Number.isFinite(tourBaseHeading)||Math.abs(tour.state.heading-tourBaseHeading)>=1e-8||Math.abs(oldTilt-tourTilt)>1e-8,scale=rig.scale.x;
    tourBaseHeading=tour.state.heading;
    // Anchor the neutral seated eye to the route, not the current sideways look.
    // Turning around different live head poses would accumulate position drift.
    // Tilt the presentation base, never the native tracked camera. Calibrated
    // forward stays correct even when the visitor started facing sideways.
    rig.rotation.set(tourTilt,tour.state.heading,0,'YXZ');rig.rotateY(-seatedHeadYaw);
    turnAfter.copy(seatedEye).multiplyScalar(scale).applyQuaternion(rig.quaternion);
    rig.position.set(tourBody.x-turnAfter.x,tourBody.y-turnAfter.y,tourBody.z-turnAfter.z);
    rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
    camera.getWorldPosition(turnAfter);
    const ceiling=tour.heightLimit?.(turnAfter)??Infinity;
    if(turnAfter.y>ceiling){
      const excess=turnAfter.y-ceiling;turnAfter.y=ceiling;rig.position.y-=excess;
      // Respect the indoor eye-height cap even if the seated visitor lifts their
      // head. Retain native orientation and never lower a leaned eye into a mesh.
      if(tour.validHead&&!tour.validHead(tourBody,turnAfter)){
        rig.position.x+=tourBody.x-turnAfter.x;rig.position.y+=tourBody.y-turnAfter.y;rig.position.z+=tourBody.z-turnAfter.z;
      }
      rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
    }
    if(changed&&panel?.visible){camera.getWorldPosition(turnPivot);camera.getWorldDirection(turnAfter);panel.place?.(turnPivot,turnAfter);}
  }
  const rayOrigin=new Vector3(),rayDirection=new Vector3();
  const rayControllers = [];
  const handVisuals=[],pointers=[];
  let panel=null,openPanelNextFrame=false,menuPressed=false,floorLevel=0,amplitude=1;
  let exitHeldSince=null,exitTimer=null,ending=false,frameError=null,frames=0,lastRenderedAt=0;
  const handWalk=typeof createQuestHandWalk==='function'?createQuestHandWalk({Vector3}):null;
  let handPauseUntil=0;
  let currentFoveation=1,recoveryFade=0;
  let measuredSeconds=0,measuredFrames=0;
  let loading=null,loadPhase=null,compileReady=false,loadStarted=0,readyAt=0;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFramebufferScaleFactor(0.8);

  async function checkConnection() {
    if (!airLink || active || pending) return;
    button.textContent = entryLabel;
    if (!navigator.xr || !window.isSecureContext) {
      status.textContent = 'Feche esta janela e use o atalho Abrir Meta Quest sem fio no notebook.';
      return;
    }
    if (!navigator.xr.isSessionSupported) return;
    try {
      const available = await navigator.xr.isSessionSupported('immersive-vr');
      if (active || pending) return;
      status.textContent = available
        ? 'Óculos detectados. Clique em Entrar na casa sem fio e permita a entrada em VR.'
        : 'Conecte o Air Link nos óculos e volte a esta janela na área de trabalho do notebook. Depois clique em Entrar na casa sem fio.';
    } catch {
      if (!active && !pending) status.textContent = 'Não foi possível verificar os óculos. Conecte o Air Link e clique em Entrar na casa sem fio para tentar.';
    }
  }

  function finish() {
    if (!saved) return;
    active = false;
    if(getTour()?.state.active)getTour().stop();
    tourOwner=null;
    pending = false;
    renderer.setAnimationLoop(null);
    handWalk?.reset();
    if(exitTimer!==null)globalThis.clearInterval?.(exitTimer);exitTimer=null;exitHeldSince=null;ending=false;
    window.removeEventListener?.('error',onSessionError);
    window.removeEventListener?.('unhandledrejection',onSessionError);
    loading?.dispose();loading=null;loadPhase=null;lighting?.restore();
    panel?.dispose();panel=null;
    for(const item of handVisuals){item.visual.dispose();rig.remove(item.hand);}handVisuals.length=0;
    for(const pointer of pointers)pointer?.dispose();pointers.length=0;
    for (const controller of rayControllers) { controller.removeEventListener('select', interact);controller.removeEventListener('selectstart',beginInteraction);controller.removeEventListener('selectend',endInteraction); rig.remove(controller); }
    rayControllers.length = 0;
    camera.remove(curtain);
    curtain?.geometry?.dispose(); curtain?.material?.dispose();
    rig.remove(camera); scene.remove(rig);
    if (saved.parent) saved.parent.add(camera);
    camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion);
    if(saved.scale)camera.scale.copy(saved.scale);
    if(saved.fov!==undefined)camera.fov=saved.fov;if(saved.zoom!==undefined)camera.zoom=saved.zoom;
    camera.updateProjectionMatrix?.();
    controls.enabled = saved.enabled;
    renderer.shadowMap.enabled = saved.shadows;
    renderer.shadowMap.needsUpdate = true;
    saved = null; session = null; rig = null; curtain = null; lastSafeHead = null;tourOwner=null;tourTilt=0;tourTiltSpeed=0;
    document.body.classList.remove('in-vr');
    button.textContent = entryLabel;
    button.disabled = false;
    status.textContent = 'Sessão VR encerrada.';
    // Let the XR manager finish its own session-end listeners before resizing.
    queueMicrotask(() => { restore(); invalidate(); });
  }

  function doorInteraction() {
    if (!active || curtain?.visible) return false;
    const xrCamera = renderer.xr.getCamera();
    xrCamera.getWorldPosition(head); xrCamera.getWorldDirection(direction);
    return getPhysics().interact(head, direction);
  }
  function beginInteraction(event){if(active&&!loading&&event?.target)panel?.beginSelect?.(event.target);}
  function endInteraction(event){if(event?.target)panel?.endSelect?.(event.target);}
  function interact(event) {
    if(!active)return;
    if(loading){loading.select(event.target);return;}
    handWalk?.reset();handPauseUntil=(globalThis.performance?.now?.()||0)+600;
    // Recovery and exit must remain usable even when the head touches a wall.
    if(event?.target&&panel?.select(event.target))return;
    if(curtain?.visible)return;
    if(event?.target&&getPhysics().interactRay) {
      event.target.updateWorldMatrix(true,false);
      rayOrigin.setFromMatrixPosition(event.target.matrixWorld);
      rayDirection.set(0,0,-1).transformDirection(event.target.matrixWorld);
      getPhysics().interactRay(rayOrigin,rayDirection);
    } else doorInteraction();
  }
  async function exitVR() {
    if(!session||ending)return;
    ending=true;
    try {await session.end();}
    catch(error){ending=false;status.textContent='Não foi possível encerrar. Abra o menu Meta para sair da experiência.';}
  }
  function checkExit(now) {
    if(!active||ending)return ending;
    const held=Array.from(session.inputSources).some(input=>!input.hand&&input.gamepad?.buttons?.[5]?.pressed);
    if(!held){exitHeldSince=null;return false;}
    if(exitHeldSince===null)exitHeldSince=now;
    if(now-exitHeldSince>=1500){void exitVR();return true;}
    return false;
  }
  function recover(error) {
    if(!active||ending)return;
    frameError=error?.message||String(error);console.error('Casas 3D VR:',error);
    void exitVR().then(()=>{status.textContent='O passeio foi interrompido. Recarregue a página e entre novamente em VR.';});
  }
  function onSessionError(event) {recover(event.error||event.reason||event.message||'Erro na sessão VR');}
  function monitorSession() {
    const now=performance.now();if(checkExit(now)||!active)return;
    // The Meta menu and removing the headset intentionally suspend XR frames.
    if(session.visibilityState&&session.visibilityState!=='visible'){lastRenderedAt=now;if(loading)loadStarted=now;return;}
    if(loading&&now-loadStarted>30000){recover(new Error('A preparação do passeio demorou demais.'));return;}
    if(now-lastRenderedAt>20000)recover(new Error(frames===0?'A imagem VR não iniciou.':'A imagem VR parou de atualizar.'));
  }
  function putVisitorAt(point) {
    const physics=getPhysics();camera.getWorldPosition(head);
    rig.position.x+=point.x-head.x;rig.position.z+=point.z-head.z;
    const floor=physics.floorAt(point.x,point.z);rig.position.y+=floor-floorLevel;floorLevel=floor;
    lastSafeHead={x:point.x,y:floor+physics.eyeHeight,z:point.z};
    rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
    camera.getWorldPosition(head);camera.getWorldDirection(direction);panel?.place(head,direction);
  }
  function tourCommand(action){
    if(loading)return 'Aguarde o carregamento do VR.';
    if(action==='start')levelTourBase();
    camera.getWorldPosition(head);const tour=getTour();
    if(action==='start'||tourOwner!==tour){tourBody.x=head.x;tourBody.y=head.y;tourBody.z=head.z;tourOwner=tour;calibrateSeatedTour();}
    const beforeX=tourBody.x,beforeY=tourBody.y,beforeZ=tourBody.z;
    try{
      tour?.action(action,tourBody,rig.rotation.y+seatedHeadYaw);
      if(action==='stop'){
        if(Math.hypot(tourBody.x-beforeX,tourBody.y-beforeY,tourBody.z-beforeZ)>.05)recoveryFade=1;
        rig.position.x+=tourBody.x-beforeX;rig.position.y+=tourBody.y-beforeY;rig.position.z+=tourBody.z-beforeZ;
        floorLevel=tourBody.y-getPhysics().eyeHeight;levelTourBase();
        rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);camera.getWorldPosition(head);
        lastSafeHead={x:head.x,y:head.y,z:head.z};
      }
      if(action==='start')panel?.close();return tour?.state.message||'Tour atualizado.';
    }catch(error){return error.message;}
  }
  function applyConfiguration(key,value) {
    if(key==='tour')return tourCommand(value);
    if(key==='amplitude') {
      amplitude=[1,1.4,2].includes(value)?value:1;
      camera.getWorldPosition(head);const before=head.clone();
      rig.scale.setScalar(1/amplitude);rig.updateMatrixWorld(true);camera.getWorldPosition(head);
      rig.position.x+=before.x-head.x;rig.position.y+=before.y-head.y;rig.position.z+=before.z-head.z;
      rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
      if(getTour()?.state.active&&tourOwner){seatedEye.set(tourBody.x,tourBody.y,tourBody.z);rig.worldToLocal(seatedEye);}
      return amplitude===1?'Escala visual normal.':'Sensação de espaço ampliada. As medidas do projeto não mudaram.';
    }
    if(getTour()?.state.active)getTour().stop('Casa alterada. Inicie novamente para recalcular o tour.');
    camera.getWorldPosition(head);const previous={x:head.x,z:head.z};
    lighting?.restore();let message;
    try{message=changeConfiguration(key,value);}finally{lighting?.apply();}
    const safe=questSafePosition(getPhysics(),previous);
    if(safe){putVisitorAt(safe);if(Math.hypot(safe.x-previous.x,safe.z-previous.z)>.02)return 'Escolha aplicada. Sua posição foi ajustada para um espaço livre.';}
    return message;
  }
  function navigate(id) {
    if(getTour()?.state.active)getTour().stop();
    const destination=getConfiguration().destinations.find(d=>d.id===id);
    if(!destination)return 'Ambiente indisponível.';
    const safe=questSafePosition(getPhysics(),destination,destination.bounds);
    if(!safe)return 'Não há espaço livre suficiente nesse ambiente.';
    putVisitorAt(safe);return 'Você está em '+destination.name+'.';
  }

  function frame(time,xrFrame) {
    if (!active || !renderer.xr.isPresenting) return;
    if(checkExit(time))return;
    if(session.visibilityState&&session.visibilityState!=='visible'){lastTime=null;handWalk?.reset();return;}
    // A session may deliver frames before tracking is ready. Never calibrate from
    // the desktop/empty XR camera: that shifts the visitor into walls when tracking starts.
    if(xrFrame&&renderer.xr.getReferenceSpace) {
      const reference=renderer.xr.getReferenceSpace();
      if(!reference||!xrFrame.getViewerPose(reference)){lastTime=null;handWalk?.reset();return;}
    }
    if(!loading&&lastTime!==null&&time>lastTime&&time-lastTime<250){measuredSeconds+=(time-lastTime)/1000;measuredFrames++;}
    const delta = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    rig.updateMatrixWorld(true);
    renderer.xr.updateCamera(camera);
    const xrCamera = renderer.xr.getCamera(), physics = getPhysics();
    xrCamera.getWorldPosition(head); xrCamera.getWorldDirection(direction);
    if (!lastSafeHead) {
      const spawn = physics.spawn;
      rig.position.x += spawn.x-head.x; rig.position.z += spawn.z-head.z;
      head.x=spawn.x; head.z=spawn.z;
      if(typeof questProfile!=='undefined'&&questProfile.lightweight) {
        // Calibrate once, also for a seated client; subsequent head motion stays native.
        const eye=floorLevel+physics.eyeHeight;rig.position.y+=eye-head.y;head.y=eye;
      }
    }
    const floor = physics.floorAt(head.x, head.z);
    // Physical room movement cannot be stopped by software. Hide the scene while
    // the tracked head crosses a wall; only returning to the clear side restores it.
    if (!lastSafeHead) lastSafeHead = {x:head.x,y:floor+physics.eyeHeight,z:head.z};
    if(loading){
      rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);loading.update(camera);
      if(loadPhase==='first')loadPhase='prepare';
      else if(loadPhase==='prepare'){prepareScene?.();lighting?.apply();loading.set(55,'Preparando a casa e a iluminação…');loadPhase='compile';}
      else if(loadPhase==='compile'){
        loading.set(75,'Preparando a imagem dos dois olhos…');loadPhase='compiling';const currentSession=session;
        Promise.resolve(renderer.compileAsync?.(scene,camera)).then(()=>{if(active&&session===currentSession)compileReady=true;},error=>{if(active&&session===currentSession)recover(error);});
      }else if(loadPhase==='compiling'&&compileReady){loading.set(90,'Conferindo a primeira imagem…');loadPhase='warm';}
      else if(loadPhase==='warm'){renderer.render(scene,camera);loading.set(100,'Tudo pronto. Boa visita!');readyAt=time;loadPhase='ready';}
      renderer.render(loading.scene,camera);frames++;lastRenderedAt=performance.now();
      if(loadPhase==='ready'&&time-readyAt>=400){loading.dispose();loading=null;loadPhase=null;openPanelNextFrame=!!panel;lastTime=null;}
      return;
    }
    curtain.visible = physics.headPathBlocked?.(lastSafeHead,head) ?? false;
    if(openPanelNextFrame){openPanelNextFrame=false;panel?.open(head,direction);}
    let forward = 0, right = 0, turn = 0;
    let menuDown=false;
    for (const input of session.inputSources) {
      if (!input.gamepad) continue;
      if(!input.hand&&input.gamepad.buttons?.[5]?.pressed)menuDown=true;
      const axes = input.gamepad.axes;
      if (input.handedness === 'left') { right = axes[2] ?? axes[0] ?? 0; forward = -(axes[3] ?? axes[1] ?? 0); }
      if (input.handedness === 'right') turn = axes[2] ?? axes[0] ?? 0;
    }
    if(menuDown&&!menuPressed&&panel){if(panel.visible)panel.close();else panel.open(head,direction);}menuPressed=menuDown;
    const tour=getTour();
    const automatic=!!tour?.state.active;
    if(!automatic){if(tourOwner)levelTourBase();tourOwner=null;}
    else if(tourOwner!==tour){tourBody.x=head.x;tourBody.y=head.y;tourBody.z=head.z;tourOwner=tour;calibrateSeatedTour();}
    if(automatic&&(curtain.visible||(tour.validHead&&!tour.validHead(lastSafeHead,head)))){
      // Recover before rendering, rather than trapping the tour behind a black curtain.
      if(!tour.validHead?.(tourBody,tourBody))tour.recover?.(tourBody);
      rig.position.x+=tourBody.x-head.x;rig.position.y+=tourBody.y-head.y;rig.position.z+=tourBody.z-head.z;
      rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);camera.getWorldPosition(head);
      camera.getWorldPosition(seatedEye);rig.worldToLocal(seatedEye);
      lastSafeHead={x:head.x,y:head.y,z:head.z};floorLevel=tourBody.y-physics.eyeHeight;curtain.visible=false;
    }
    if(panel?.visible||tour?.state.active)forward=right=turn=0;
    rig.updateMatrixWorld(true);
    const trackedHands=handVisuals.filter(item=>item.visual.update()).map(item=>item.hand);
    const handMotion=handWalk?.update({hands:trackedHands,head,delta,scale:rig.scale.x,
      blocked:!!tour?.state.active||!!panel?.visible||curtain.visible||time<handPauseUntil||Math.abs(forward)>.18||Math.abs(right)>.18||
        !Array.from(session.inputSources).some(input=>input.hand)||rayControllers.some(controller=>!!panel?.hit?.(controller))})||{x:0,z:0};
    if (!curtain.visible) {
      const length = Math.hypot(direction.x,direction.z) || 1;
      const fx = direction.x/length, fz = direction.z/length;
      if (Math.abs(forward)<0.18) forward=0;
      if (Math.abs(right)<0.18) right=0;
      const inputLength = Math.max(1,Math.hypot(forward,right)), step=1.5*delta/inputLength;
      const body = automatic?tourBody:{x:head.x,y:floorLevel+physics.eyeHeight,z:head.z};
      const fromX=body.x,fromZ=body.z;
      if(automatic)tour.update(body,delta);else physics.move(body,(fx*forward-fz*right)*step+handMotion.x*delta,(fz*forward+fx*right)*step+handMotion.z*delta,delta);
      const moveX=body.x-fromX,moveZ=body.z-fromZ;
      rig.position.x += moveX; rig.position.z += moveZ;
      const nextFloor=body.y-physics.eyeHeight,moveY=nextFloor-floorLevel;rig.position.y+=moveY;floorLevel=nextFloor;
      if(automatic)guideTourHeading(tour,delta);
      if (Math.abs(turn)<0.25) snapReady=true;
      if (Math.abs(turn)>0.65 && snapReady) {
        snapReady=false;
        rig.updateMatrixWorld(true);
        const before=camera.getWorldPosition(new Vector3());
        rig.rotation.y-=Math.sign(turn)*Math.PI/6;
        rig.updateMatrixWorld(true);
        const after=camera.getWorldPosition(new Vector3());
        rig.position.x+=before.x-after.x; rig.position.z+=before.z-after.z;
      }
      if(automatic){camera.getWorldPosition(turnAfter);lastSafeHead={x:turnAfter.x,y:turnAfter.y,z:turnAfter.z};}
      else lastSafeHead={x:body.x,y:body.y,z:body.z};
      physics.update(delta,automatic?tourBody:lastSafeHead);
    }
    rig.updateMatrixWorld(true);
    const visibleHands=trackedHands.length>0;
    const hint=curtain.visible?'Próximo de uma parede. Volte um passo ou segure B/Y para sair.':visibleHands?'Para andar: feche o painel e aponte a mão à frente. Pinça: escolher.':'Gatilho: escolher · B/Y: painel · Segure B/Y por 1,5 s: sair';
    panel?.ensureReachable?.(head,direction);
    const hits=panel?.update(rayControllers,hint)||[];
    const foveation=panel?.visible?0:automatic ? .5 : 1;
    if(foveation!==currentFoveation){renderer.xr.setFoveation(foveation);currentFoveation=foveation;}
    pointers.forEach((pointer,i)=>{
      const controller=rayControllers[i];rayOrigin.setFromMatrixPosition(controller.matrixWorld);
      rayDirection.set(0,0,-1).transformDirection(controller.matrixWorld);
      const hit=hits[i]||(!panel?.visible&&physics.raycastDoor?.(rayOrigin,rayDirection));
      pointer?.update(hit,amplitude);
    });
    const fade=Math.max(tour?.state.fade||0,recoveryFade);recoveryFade=Math.max(0,recoveryFade-delta/.35);
    if(curtain.material)curtain.material.opacity=curtain.visible?1:fade;curtain.visible=curtain.visible||fade>0;
    renderer.info.reset();
    renderer.render(scene,camera);
    frames++;
    lastRenderedAt=performance.now();
  }
  function safeFrame(time,xrFrame) {
    try {frame(time,xrFrame);}
    catch(error) {
      // A frame failure must return to the browser instead of trapping a black session.
      recover(error);
    }
  }

  async function enter() {
    if (pending) return;
    if (active) { await exitVR(); return; }
    if (!navigator.xr || !window.isSecureContext) {
      status.textContent = airLink
        ? 'Feche esta janela e use o atalho Abrir Meta Quest sem fio no notebook, com o Air Link conectado nos óculos.'
        : 'Abra o link HTTPS publicado diretamente no Meta Quest Browser dos óculos e toque em Entrar em VR.';
      return;
    }
    pending=true; button.disabled=true;
    if (airLink) {
      button.textContent='Aguardando os óculos…';
      status.textContent='Permita a entrada em VR no navegador, se solicitado. Mantenha os óculos em uso e o Air Link conectado.';
    }
    try {
      // Must be called directly from the user's click, before asynchronous setup.
      session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['bounded-floor','hand-tracking','layers']});
      if (airLink) status.textContent='Preparando a casa para os óculos…';
      prepare();
      saved={parent:camera.parent,position:camera.position.clone(),quaternion:camera.quaternion.clone(),scale:camera.scale?.clone(),fov:camera.fov,zoom:camera.zoom,enabled:controls.enabled,shadows:renderer.shadowMap.enabled};
      controls.enabled=false;
      rig=new Group(); scene.add(rig); rig.add(camera);
      const p=getPhysics(), spawn=p.spawn;
      rig.position.set(spawn.x,p.floorAt(spawn.x,spawn.z),spawn.z);
      floorLevel=p.floorAt(spawn.x,spawn.z);amplitude=1;menuPressed=false;exitHeldSince=null;ending=false;frameError=null;frames=0;recoveryFade=0;
      handWalk?.reset();handPauseUntil=0;measuredSeconds=0;measuredFrames=0;
      camera.position.set(0,0,0); camera.rotation.set(0,0,0); camera.clearViewOffset();
      curtain=makeCurtain(); curtain.visible=false; camera.add(curtain);
      renderer.shadowMap.enabled=false;
      for(let i=0;i<2;i++) {
        const controller=renderer.xr.getController(i);rig.add(controller);controller.addEventListener('selectstart',beginInteraction);controller.addEventListener('select',interact);controller.addEventListener('selectend',endInteraction);rayControllers.push(controller);
        pointers.push(createPointer?.(controller));
        if(createHand&&renderer.xr.getHand){const hand=renderer.xr.getHand(i);rig.add(hand);handVisuals.push({hand,visual:createHand(hand)});}
      }
      panel=createPanel?.({scene,camera,getState:()=>({...getConfiguration(),amplitude}),getTourState:()=>getTour()?.state,change:applyConfiguration,navigate,door:doorInteraction,exitVR});
      loading=createLoading?.({exitVR})||null;loadPhase=loading?'first':null;compileReady=false;loadStarted=performance.now();
      if(!loading){prepareScene?.();lighting?.apply();}
      openPanelNextFrame=!loading&&!!panel;
      session.addEventListener('end',finish,{once:true});
      lastTime=null; lastSafeHead=null; active=true;
      lastRenderedAt=performance.now();
      window.addEventListener?.('error',onSessionError);
      window.addEventListener?.('unhandledrejection',onSessionError);
      document.body.classList.add('in-vr');
      exitTimer=globalThis.setInterval?.(monitorSession,100)??null;
      if (airLink) status.textContent='Conectando a imagem da casa aos óculos…';
      await renderer.xr.setSession(session);
      renderer.xr.setFoveation(1);currentFoveation=1;
      if(!active)return;
      renderer.setAnimationLoop(safeFrame);
      // Optional refresh-rate negotiation must never hold the first rendered frame.
      if(typeof questProfile!=='undefined'&&questProfile.lightweight&&session.supportedFrameRates?.includes(72)) {
        try {void session.updateTargetFrameRate(72).catch(()=>{});}catch{}
      }
      pending=false; button.disabled=false; button.textContent='Sair do VR';
      status.textContent='Minha casa: opções dentro dos óculos · Gatilho ou pinça: escolher · B/Y: painel · Analógicos: andar e girar';
    } catch(error) {
      const failedSession=session;
      if (saved) finish();
      if (failedSession) { try { await failedSession.end(); } catch {} }
      session=null; active=false; pending=false; button.disabled=false;
      button.textContent=entryLabel;
      if (airLink) {
        status.textContent = error.name === 'NotSupportedError'
          ? 'Os óculos ainda não estão disponíveis para a casa. Conecte o Air Link; se já estiver conectado, feche esta janela e abra novamente Abrir Meta Quest sem fio. Confira também OpenXR em Configurações > Geral no aplicativo Meta Horizon Link.'
          : error.name === 'NotAllowedError' || error.name === 'SecurityError'
            ? 'Permita a entrada em realidade virtual no navegador e clique novamente em Entrar na casa sem fio.'
            : 'Não foi possível entrar na casa. Encerre outro aplicativo VR que esteja aberto e tente novamente com o Air Link conectado.';
      } else {
        status.textContent=error.name==='NotSupportedError' ? 'VR indisponível neste navegador. Abra este mesmo link HTTPS no Meta Quest Browser dos óculos.' : 'Não foi possível iniciar o VR. Permita a sessão imersiva no Meta Quest Browser e tente novamente.';
      }
      invalidate();
    }
  }
  button.onclick=enter;
  if (airLink) {
    button.textContent=entryLabel;
    status.textContent='Conecte o Air Link nos óculos e clique em Entrar na casa sem fio nesta janela do notebook.';
    navigator.xr?.addEventListener?.('devicechange',checkConnection);
    window.addEventListener?.('focus',checkConnection);
    checkConnection();
  }
  return {get active(){return active;},get diagnostics(){return {active,amplitude,frames,fps:measuredSeconds?measuredFrames/measuredSeconds:null,drawCalls:renderer.info?.render?.calls??null,frameError,loading:loading?.percent??null,loadPhase,lightingMeshes:lighting?.count??0,visibility:session?.visibilityState??null,handWalking:!!handWalk?.active,wallProtection:!!curtain?.visible,head:[head.x,head.y,head.z],panelOpen:!!panel?.visible,handFeature:session?.enabledFeatures?.includes('hand-tracking')??null,handInputs:Array.from(session?.inputSources||[]).filter(input=>input.hand).length};},enter,checkConnection,tourAction:tourCommand,end:exitVR};
}
