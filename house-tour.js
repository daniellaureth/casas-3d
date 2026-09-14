// Routes are prepared once, off the render thread. The tour ignores furniture
// and gravity; visible paths remain clear of walls and open door leaves.
function buildHouseTour({physics,plan,model,position,config=CASA_TOUR_CONFIG}) {
  const step=config.grid,margin=3,minX=Math.min(-plan.w/2-margin,position.x-1),minZ=Math.min(-plan.d/2-margin,position.z-1);
  const maxX=Math.max(plan.w/2+margin,position.x+1),maxZ=Math.max(plan.d/2+margin,position.z+1,physics.spawn.z+1);
  const width=Math.ceil((maxX-minX)/step)+1,height=Math.ceil((maxZ-minZ)/step)+1,count=width*height;
  const free=new Uint8Array(count),queue=new Int32Array(count),parent=new Int32Array(count);
  function coords(id){return {x:minX+(id%width)*step,z:minZ+Math.floor(id/width)*step};}
  for(let id=0;id<count;id++)free[id]=Number(!physics.blockedForTour(minX+(id%width)*step,minZ+Math.floor(id/width)*step,true));
  function nearest(point,bounds){let best=-1,distance=Infinity;
    for(let id=0;id<count;id++){if(!free[id])continue;const x=minX+(id%width)*step,z=minZ+Math.floor(id/width)*step;
      if(bounds&&(x<bounds.minX+physics.radius||x>bounds.maxX-physics.radius||z<bounds.minZ+physics.radius||z>bounds.maxZ-physics.radius))continue;
      const d=(x-point.x)**2+(z-point.z)**2;if(d<distance){distance=d;best=id;}}
    return best;
  }
  function flood(start){parent.fill(-2);if(start<0)return;let head=0,tail=1;queue[0]=start;parent[start]=-1;
    while(head<tail){const id=queue[head++],x=id%width,z=Math.floor(id/width);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        if((!dx&&!dz)||x+dx<0||x+dx>=width||z+dz<0||z+dz>=height)continue;
        const next=id+dz*width+dx;if(!free[next]||parent[next]!==-2)continue;
        if(dx&&dz&&(!free[id+dx]||!free[id+dz*width]))continue;
        parent[next]=id;queue[tail++]=next;
      }
    }
  }
  function clear(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.04));
    for(let i=0;i<=n;i++){const t=i/n;if(physics.blockedForTour(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,true))return false;}return true;
  }
  const altitude=physics.tourAltitude||7,eye=physics.eyeHeight;
  function aerial(p){return p.kind==='aerial'||p.y>=altitude-.05;}
  function route(from,to){
    // Change altitude under a fade, never by ascending through ceilings/roofs.
    if(aerial(from)||aerial(to))return aerial(from)&&aerial(to)?[{...from},{...to}]:null;
    const start=nearest(from),finish=nearest(to);flood(start);if(finish<0||parent[finish]===-2)return null;
    const raw=[];for(let id=finish;id>=0;id=parent[id])raw.push(coords(id));raw.reverse();raw.unshift({x:from.x,z:from.z});
    const result=[raw[0]];let i=0;while(i<raw.length-1){let end=raw.length-1;while(end>i+1&&!clear(raw[i],raw[end]))end--;if(!clear(raw[i],raw[end]))return null;result.push(raw[end]);i=end;}
    let length=0;for(let j=1;j<result.length;j++)length+=Math.hypot(result[j].x-result[j-1].x,result[j].z-result[j-1].z);
    let travelled=0;for(let j=0;j<result.length;j++){if(j)travelled+=Math.hypot(result[j].x-result[j-1].x,result[j].z-result[j-1].z);const t=length?travelled/length:1;result[j].y=(from.y??eye)+((to.y??eye)-(from.y??eye))*t;}
    return result;
  }
  const points=[];
  for(const stop of config.stops){const spec={...stop,...config.models?.[model]?.[stop.id]};let target,bounds,name=spec.label;
    if(spec.kind==='aerial'){
      const site=physics.site||{x0:-3,x1:plan.w+3,z0:-4,z1:plan.d+4};
      target={x:site.x0+(site.x1-site.x0)*(spec.u??.5)-plan.w/2,z:plan.d/2-site.z0-(site.z1-site.z0)*(spec.v??.5)};
      if(Number.isFinite(spec.x)&&Number.isFinite(spec.z))target=spec;
      points.push({...target,y:altitude,kind:'aerial',id:spec.id,label:name,dwell:spec.dwell??config.dwell,focus:{x:0,y:.5,z:0}});continue;
    }
    if(Number.isFinite(spec.x)&&Number.isFinite(spec.z))target=spec;
    else if(spec.kind==='entry')target=physics.spawn;
    else{const room=plan.rooms.find(r=>new RegExp(spec.room,'i').test(r[0]));if(!room)continue;
      const [label,x,z,w,d]=room;name||=label;target={x:x+w*(spec.u??.5)-plan.w/2,z:plan.d/2-z-d*(spec.v??.5)};
      bounds={minX:x-plan.w/2,maxX:x+w-plan.w/2,minZ:plan.d/2-z-d,maxZ:plan.d/2-z};}
    // Every room gets a viewpoint. Disconnected passages use a fade instead of
    // silently removing the room from the itinerary.
    const id=nearest(target,bounds);if(id<0)throw Error('Não foi encontrado um ponto seguro em '+(name||spec.id)+'.');
    const point=coords(id);points.push({...point,y:physics.floorAt(point.x,point.z)+eye,id:spec.id,label:name||spec.id,dwell:spec.dwell??config.dwell});
  }
  if(!points.length)throw Error('Não foi encontrado um percurso para esta planta.');
  const legs=points.slice(0,-1).map((p,i)=>route(p,points[i+1]));
  return {points,legs,route,clear,cells:count};
}

function createHouseTour({getPhysics,getPlan,getModel,config=CASA_TOUR_CONFIG,onChange=()=>{},plannerFactory=()=>null}) {
  const state={active:false,paused:false,label:'',phase:'idle',index:0,total:0,revision:0,fade:0,message:'',focus:null};
  let navigation=null,physics=null,path=null,cursor=1,speed=0,hold=0,fadeTime=0,transitioned=false;
  let planner=null,generation=0,requestId=0,lastPosition=null;
  function changed(){state.revision++;onChange(state);}
  function restoreWalking(){
    if(!lastPosition||!physics?.blocked)return;const p=getPhysics(),x=lastPosition.x,z=lastPosition.z;let safe=!p.blocked(x,z)?{x,z}:null;
    for(let radius=.1;!safe&&radius<=4;radius+=.1)for(let i=0;i<48;i++){const angle=i*Math.PI/24,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;if(!p.blocked(px,pz)){safe={x:px,z:pz};break;}}
    safe||=p.spawn;lastPosition.x=safe.x;lastPosition.z=safe.z;lastPosition.y=p.floorAt(safe.x,safe.z)+p.eyeHeight;
  }
  function stop(message='Tour encerrado.'){generation++;requestId++;planner?.dispose();planner=null;restoreWalking();state.active=false;state.paused=false;state.phase='idle';state.fade=0;state.focus=null;state.message=message;speed=0;changed();}
  function setRoute(index,position,prepared){
    if(index>=navigation.points.length){stop('Tour concluído.');return;}
    state.index=Math.max(0,index);const destination=navigation.points[state.index];state.label=destination.label;state.focus=destination.focus||null;state.message=destination.kind==='aerial'?'Olhe ao redor e para baixo para conhecer o terreno.':'';
    path=prepared!==undefined?prepared:navigation.route(position,destination);cursor=1;speed=0;state.fade=0;fadeTime=0;transitioned=false;
    state.phase=path?'moving':'transition';changed();
  }
  function start(position){generation++;requestId++;planner?.dispose();planner=null;physics=getPhysics();lastPosition=position;const token=generation;navigation=null;state.total=0;state.index=0;state.focus=null;
    planner=plannerFactory();if(planner){
      state.active=true;state.paused=false;state.fade=0;state.phase='planning';state.label='Preparando tour…';state.message='O percurso está sendo calculado.';changed();
      const origin={x:position.x,y:position.y,z:position.z};planner.build({physics,plan:getPlan(),model:getModel(),position:origin,config}).then(result=>{
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
        const origin={x:position.x,y:position.y,z:position.z};planner.route(index,origin).then(path=>{if(state.active&&id===requestId&&generation===token)setRoute(index,origin,path);},error=>{if(id===requestId&&generation===token){state.paused=true;state.message=error.message;changed();}});
      }else setRoute(index,position);
    }
  }
  function update(position,delta){
    if(!state.active)return false;lastPosition=position;if(getPhysics()!==physics){stop('Planta alterada. Inicie um novo tour.');return false;}
    if(state.paused||state.phase==='planning')return true;const dt=Math.min(.05,delta),destination=navigation.points[state.index];
    // Animate existing doors ahead of the visitor; furniture never halts playback.
    for(const door of physics.doors)if(Math.hypot(door.hingeX-position.x,door.hingeZ-position.z)<2.5||state.phase==='transition')door.target=door.openAngle;
    if(state.phase==='dwell'){hold-=dt;if(hold<=0)setRoute(state.index+1,position,navigation.legs[state.index]);return true;}
    if(state.phase==='transition'){
      fadeTime+=dt;const fade=config.fadeSeconds;
      if(fadeTime<fade)state.fade=fadeTime/fade;
      else if(fadeTime<fade+.35){state.fade=1;if(!transitioned){position.x=destination.x;position.y=destination.y;position.z=destination.z;transitioned=true;}}
      else state.fade=Math.max(0,1-(fadeTime-fade-.35)/fade);
      if(fadeTime>=fade*2+.35){state.fade=0;state.phase='dwell';hold=destination.dwell;changed();}return true;
    }
    if(state.phase==='turn'){fadeTime+=dt;state.fade=Math.sin(Math.min(1,fadeTime/(config.fadeSeconds*2))*Math.PI);if(fadeTime>=config.fadeSeconds*2){state.fade=0;state.phase='moving';}return true;}
    const aim=path?.[cursor];if(!aim){state.phase='dwell';hold=destination.dwell;changed();return true;}
    const dx=aim.x-position.x,dy=aim.y-position.y,dz=aim.z-position.z,distance=Math.hypot(dx,dy,dz);
    if(distance<.000001){
      if(cursor>=path.length-1){state.phase='dwell';hold=destination.dwell;speed=0;changed();return true;}
      const before=path[cursor-1],after=path[cursor+1],ax=aim.x-before.x,az=aim.z-before.z,bx=after.x-aim.x,bz=after.z-aim.z;
      const sharp=(ax*bx+az*bz)/(Math.hypot(ax,az)*Math.hypot(bx,bz)||1)<.35;
      cursor++;if(sharp){state.phase='turn';fadeTime=0;speed=0;}return true;
    }
    const target=Math.min(config.speed,Math.sqrt(2*config.acceleration*distance));speed=Math.min(target,speed+config.acceleration*dt);
    const step=Math.min(distance,speed*dt)/distance;
    // Camera flight, not a walking body. Architectural clearance is precomputed.
    position.x+=dx*step;position.y+=dy*step;position.z+=dz*step;return true;
  }
  return {state,start,action,stop,update,get points(){return navigation?.points||[];}};
}
