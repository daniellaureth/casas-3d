// Navigation is calculated before playback. The player remains a normal physics body.
function buildHouseTour({physics,plan,model,position,config=CASA_TOUR_CONFIG}) {
  const step=config.grid,margin=3,minX=Math.min(-plan.w/2-margin,position.x-1),minZ=Math.min(-plan.d/2-margin,position.z-1);
  const maxX=Math.max(plan.w/2+margin,position.x+1),maxZ=Math.max(plan.d/2+margin,position.z+1,physics.spawn.z+1);
  const width=Math.ceil((maxX-minX)/step)+1,height=Math.ceil((maxZ-minZ)/step)+1,count=width*height;
  const free=new Uint8Array(count),floors=new Float32Array(count),queue=new Int32Array(count),parent=new Int32Array(count);
  function coords(id){return {x:minX+(id%width)*step,z:minZ+Math.floor(id/width)*step};}
  for(let id=0;id<count;id++) {const x=minX+(id%width)*step,z=minZ+Math.floor(id/width)*step;floors[id]=physics.floorAt(x,z);free[id]=Number(!physics.blockedForTour(x,z));}
  function nearest(point,bounds,reachable){let best=-1,distance=Infinity;
    for(let id=0;id<count;id++){if(!free[id]||(reachable&&reachable[id]===-2))continue;const x=minX+(id%width)*step,z=minZ+Math.floor(id/width)*step;
      if(bounds&&(x<bounds.minX+physics.radius||x>bounds.maxX-physics.radius||z<bounds.minZ+physics.radius||z>bounds.maxZ-physics.radius))continue;
      const d=(x-point.x)**2+(z-point.z)**2;if(d<distance){distance=d;best=id;}}
    return best;
  }
  function flood(start){parent.fill(-2);if(start<0)return;let head=0,tail=1;queue[0]=start;parent[start]=-1;
    while(head<tail){const id=queue[head++],x=id%width,z=Math.floor(id/width);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        if((!dx&&!dz)||x+dx<0||x+dx>=width||z+dz<0||z+dz>=height)continue;
        const next=id+dz*width+dx;if(!free[next]||parent[next]!==-2||Math.abs(floors[next]-floors[id])>.205)continue;
        if(dx&&dz&&(!free[id+dx]||!free[id+dz*width]))continue;
        parent[next]=id;queue[tail++]=next;
      }
    }
  }
  function clear(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.04));let floor=physics.floorAt(a.x,a.z);
    for(let i=1;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,next=physics.floorAt(x,z);if(physics.blockedForTour(x,z)||Math.abs(next-floor)>.205)return false;floor=next;}return true;
  }
  function route(from,to){const start=nearest(from),finish=nearest(to);flood(start);if(finish<0||parent[finish]===-2)return null;
    const raw=[];for(let id=finish;id>=0;id=parent[id])raw.push(coords(id));raw.reverse();raw.unshift({x:from.x,z:from.z});
    const result=[raw[0]];let i=0;while(i<raw.length-1){let end=raw.length-1;while(end>i+1&&!clear(raw[i],raw[end]))end--;if(!clear(raw[i],raw[end]))return null;result.push(raw[end]);i=end;}return result;
  }
  const startId=nearest(position);flood(startId);const reachable=parent.slice(),points=[];
  for(const stop of config.stops){const override=config.models?.[model]?.[stop.id]||{},spec={...stop,...override};let target,bounds,name=spec.label;
    if(Number.isFinite(spec.x)&&Number.isFinite(spec.z))target=spec;
    else if(spec.kind==='entry')target=physics.spawn;
    else{const room=plan.rooms.find(r=>new RegExp(spec.room,'i').test(r[0]));if(!room)continue;
      const [label,x,z,w,d]=room;name||=label;target={x:x+w*(spec.u??.5)-plan.w/2,z:plan.d/2-z-d*(spec.v??.5)};
      bounds={minX:x-plan.w/2,maxX:x+w-plan.w/2,minZ:plan.d/2-z-d,maxZ:plan.d/2-z};}
    const id=nearest(target,bounds,reachable);if(id<0)continue;
    points.push({...coords(id),id:spec.id,label:name||spec.id,dwell:spec.dwell??config.dwell});
  }
  if(!points.length)throw Error('Não foi encontrado um percurso livre para esta planta.');
  const legs=points.slice(0,-1).map((p,i)=>route(p,points[i+1]));
  return {points,legs,route,clear,cells:count};
}

function createHouseTour({getPhysics,getPlan,getModel,config=CASA_TOUR_CONFIG,onChange=()=>{},plannerFactory=()=>null}) {
  const state={active:false,paused:false,label:'',phase:'idle',index:0,total:0,revision:0,fade:0,message:''};
  let navigation=null,physics=null,path=null,cursor=1,speed=0,hold=0,fadeTime=0,stalled=0,turnHandled=-1;
  const body={x:0,y:0,z:0};
  let planner=null,generation=0,requestId=0;
  function changed(){state.revision++;onChange(state);}
  function stop(message='Tour encerrado.'){generation++;requestId++;planner?.dispose();planner=null;state.active=false;state.paused=false;state.phase='idle';state.fade=0;state.message=message;speed=0;changed();}
  function setRoute(index,position,prepared){
    if(index>=navigation.points.length){stop('Tour concluído.');return;}
    state.index=Math.max(0,index);state.label=navigation.points[state.index].label;state.message='';
    path=prepared!==undefined?prepared:navigation.route(position,navigation.points[state.index]);cursor=1;turnHandled=-1;speed=0;stalled=0;state.fade=0;
    if(!path){state.paused=true;state.message='Percurso indisponível. Escolha outro ambiente ou encerre o tour.';}
    state.phase='moving';changed();
  }
  function start(position){generation++;requestId++;planner?.dispose();planner=null;physics=getPhysics();const token=generation;
    planner=plannerFactory();if(planner){
      state.active=true;state.paused=false;state.fade=0;state.phase='planning';state.label='Preparando tour…';state.message='O percurso está sendo calculado.';changed();
      const origin={x:position.x,z:position.z};planner.build({physics,plan:getPlan(),model:getModel(),position:origin,config}).then(result=>{
        if(!state.active||generation!==token)return;navigation=result;state.total=result.points.length;setRoute(result.index,origin,result.path);
      },error=>{if(generation!==token)return;state.paused=true;state.message=error.message;changed();});return state;
    }
    navigation=buildHouseTour({physics,plan:getPlan(),model:getModel(),position,config});
    let index=0;if(config.start!=='entry'){let d=Infinity;navigation.points.forEach((p,i)=>{const n=Math.hypot(p.x-position.x,p.z-position.z);if(n<d){d=n;index=i;}});}
    state.active=true;state.paused=false;state.total=navigation.points.length;setRoute(index,position);return state;
  }
  function action(type,position){
    if(type==='start')return start(position);if(type==='stop'){stop();return;}
    if(!state.active)return;
    if(type==='pause'){state.paused=true;speed=0;state.fade=0;changed();}
    if(type==='resume'){state.paused=false;changed();}
    if((type==='next'||type==='previous')&&navigation&&state.phase!=='planning'){
      const index=Math.max(0,Math.min(navigation.points.length-1,state.index+(type==='next'?1:-1)));state.paused=false;
      if(planner){const id=++requestId,token=generation;state.phase='planning';state.message='Preparando o próximo percurso…';state.fade=0;changed();
        const origin={x:position.x,z:position.z};planner.route(index,origin).then(path=>{if(state.active&&id===requestId&&generation===token)setRoute(index,origin,path);},error=>{if(id===requestId&&generation===token){state.paused=true;state.message=error.message;changed();}});
      }else setRoute(index,position);
    }
  }
  function update(position,delta){
    if(!state.active)return false;if(getPhysics()!==physics){stop('Planta alterada. Inicie um novo tour.');return false;}
    if(state.paused||state.phase==='planning')return true;const dt=Math.min(.05,delta),destination=navigation.points[state.index];
    if(state.phase==='dwell'){hold-=dt;if(hold<=0)setRoute(state.index+1,position,navigation.legs[state.index]);return true;}
    if(state.phase==='turn'){fadeTime+=dt;const duration=config.fadeSeconds*2;state.fade=Math.sin(Math.min(1,fadeTime/duration)*Math.PI);
      if(fadeTime>=duration){state.fade=0;state.phase='moving';}return true;}
    // Open only nearby leaves needed by the current path. Physics still blocks until open.
    const aim=path?.[cursor];if(!aim)return true;
    let waitingDoor=false;
    for(const door of physics.doors){const dx=door.hingeX+(door.axis==='x'?door.width/2:0)-position.x,dz=door.hingeZ-(door.axis==='z'?door.width/2:0)-position.z;
      if(Math.hypot(dx,dz)<1.9){const ax=aim.x-position.x,az=aim.z-position.z,len=ax*ax+az*az,t=Math.max(0,Math.min(1,(dx*ax+dz*az)/(len||1)));
        if(Math.hypot(dx-ax*t,dz-az*t)<door.width/2+.25){door.target=door.openAngle;
          if(Math.abs(door.angle-door.openAngle)>.025&&Math.hypot(door.hingeX-position.x,door.hingeZ-position.z)<door.width+physics.radius+.65)waitingDoor=true;}}}
    if(waitingDoor){speed=0;return true;}
    const dx=aim.x-position.x,dz=aim.z-position.z,distance=Math.hypot(dx,dz);
    if(distance<.000001){
      if(cursor>=path.length-1){state.phase='dwell';hold=destination.dwell;speed=0;changed();return true;}
      const before=path[cursor-1],after=path[cursor+1],ax=aim.x-before.x,az=aim.z-before.z,bx=after.x-aim.x,bz=after.z-aim.z;
      const sharp=(ax*bx+az*bz)/(Math.hypot(ax,az)*Math.hypot(bx,bz)||1)<.35;
      cursor++;if(sharp&&turnHandled!==cursor){turnHandled=cursor;state.phase='turn';fadeTime=0;speed=0;}return true;
    }
    const target=Math.min(config.speed,Math.sqrt(2*config.acceleration*distance));speed=Math.min(target,speed+config.acceleration*dt);
    body.x=position.x;body.y=position.y;body.z=position.z;const step=Math.min(distance,speed*dt);
    physics.move(body,dx/distance*step,dz/distance*step,dt);
    const moved=Math.hypot(body.x-position.x,body.z-position.z);position.x=body.x;position.y=body.y;position.z=body.z;
    stalled=moved<.00001?stalled+dt:0;
    if(stalled>4){state.paused=true;state.message='Passagem bloqueada. Abra espaço ou escolha outro ambiente.';speed=0;changed();}
    return true;
  }
  return {state,start,action,stop,update,get points(){return navigation?.points||[];}};
}
