// Routes are prepared once, off the render thread. The tour ignores furniture
// and gravity; visible paths remain clear of walls and open door leaves.
function buildHouseTour({physics,plan,model,position,config=CASA_TOUR_CONFIG}) {
  const eye=Math.max(physics.eyeHeight,Math.min(config.eyeHeight??1.95,2));
  const step=config.grid,margin=4,minX=Math.min(-plan.w/2-margin,position.x-1),minZ=Math.min(-plan.d/2-margin,position.z-1);
  const maxX=Math.max(plan.w/2+margin,position.x+1),maxZ=Math.max(plan.d/2+margin,position.z+1,physics.spawn.z+1);
  const width=Math.ceil((maxX-minX)/step)+1,height=Math.ceil((maxZ-minZ)/step)+1,count=width*height;
  const free=new Uint8Array(count),queue=new Int32Array(count),parent=new Int32Array(count);
  function coords(id){return {x:minX+(id%width)*step,z:minZ+Math.floor(id/width)*step};}
  for(let id=0;id<count;id++)free[id]=Number(!physics.blockedForTour(minX+(id%width)*step,minZ+Math.floor(id/width)*step,true,eye));
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
    for(let i=0;i<=n;i++){const t=i/n;if(physics.blockedForTour(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,true,eye))return false;}return true;
  }
  // Fly outside the lot instead of directly above the house. The subject stays
  // near eye level, inside the seated viewer's forward hemisphere.
  const site=physics.site||{x0:-3,x1:plan.w+3,z0:-4,z1:plan.d+4};
  const center={x:(site.x0+site.x1)/2-plan.w/2,z:plan.d/2-(site.z0+site.z1)/2};
  const altitude=Math.max(config.exteriorHeight??3.8,Math.min(4.5,(physics.roofTop||4)*.8));
  const orbitRadius=Math.hypot(site.x1-site.x0,site.z1-site.z0)/2+3;
  const exteriorFocus={x:center.x,y:1.6,z:center.z};
  function aerial(p){return p.kind==='aerial'||p.y>physics.floorAt(p.x,p.z)+eye+.25;}
  function viewHeading(p,focus){return Math.atan2(p.x-focus.x,p.z-focus.z);}
  const flightBoxes=[...physics.boxes.filter(b=>b.kind!=='furniture'&&(!b.enabled||b.enabled())),...(physics.flightBoxes||[])];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  function flightClear(a,b){
    // Slab intersection against expanded architecture, including roof overhangs.
    const pad=.08;
    for(const box of flightBoxes){let lo=0,hi=1;
      for(const [axis,min,max] of [['x',box.minX-pad,box.maxX+pad],['y',box.bottom-pad,box.top+pad],['z',box.minZ-pad,box.maxZ+pad]]){
        const d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max){lo=2;break;}continue;}
        const t1=(min-a[axis])/d,t2=(max-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)break;
      }
      if(lo<=hi)return false;
    }
    return true;
  }
  function groundRoute(from,to){
    const start=nearest(from),finish=nearest(to);flood(start);if(finish<0||parent[finish]===-2)return null;
    const raw=[];for(let id=finish;id>=0;id=parent[id])raw.push(coords(id));raw.reverse();raw.unshift({x:from.x,z:from.z});
    const result=[raw[0]];let i=0;while(i<raw.length-1){let end=raw.length-1;while(end>i+1&&!clear(raw[i],raw[end]))end--;if(!clear(raw[i],raw[end]))return null;result.push(raw[end]);i=end;}
    let length=0;for(let j=1;j<result.length;j++)length+=Math.hypot(result[j].x-result[j-1].x,result[j].z-result[j-1].z);
    if(length<.0001)return [{...from},{...to}];
    let travelled=0;for(let j=0;j<result.length;j++){if(j)travelled+=Math.hypot(result[j].x-result[j-1].x,result[j].z-result[j-1].z);const t=length?travelled/length:1;result[j].y=(from.y??eye)+((to.y??eye)-(from.y??eye))*t;}
    return result;
  }
  // Round each bend locally. A global spline can bulge through the wall beside a
  // door; these short curves are accepted only after checking every chord.
  function smooth(raw,ground=false){
    if(!raw||raw.length<3)return raw;
    const result=[raw[0]],safe=ground?(a,b)=>clear(a,b)&&flightClear(a,b):flightClear;
    for(let i=1;i<raw.length-1;i++){
      const a=raw[i-1],b=raw[i],c=raw[i+1];let radius=Math.min(config.cornerRadius??.55,distance(a,b)*.4,distance(b,c)*.4),curve=null;
      while(radius>.015){
        const ab=radius/distance(a,b),bc=radius/distance(b,c);
        const enter={x:b.x+(a.x-b.x)*ab,y:b.y+(a.y-b.y)*ab,z:b.z+(a.z-b.z)*ab,view:b.view};
        const leave={x:b.x+(c.x-b.x)*bc,y:b.y+(c.y-b.y)*bc,z:b.z+(c.z-b.z)*bc,view:c.view};
        const candidate=[enter],n=Math.max(4,Math.ceil(radius/.035));let valid=safe(result[result.length-1],enter);
        for(let j=1;j<=n&&valid;j++){const t=j/n,u=1-t,p={x:u*u*enter.x+2*u*t*b.x+t*t*leave.x,y:u*u*enter.y+2*u*t*b.y+t*t*leave.y,z:u*u*enter.z+2*u*t*b.z+t*t*leave.z,view:b.view};valid=safe(candidate[candidate.length-1],p);candidate.push(p);}
        if(valid){curve=candidate;break;}radius*=.5;
      }
      if(curve)result.push(...curve);else result.push(b);
    }
    result.push(raw[raw.length-1]);return result;
  }
  let launch=null;
  const cruise=Math.max(altitude,(physics.roofTop||4)+.8);
  function launchPoint(){
    if(launch)return launch;
    flood(nearest(physics.spawn));const candidates=[];
    for(let id=0;id<count;id++){if(!free[id]||parent[id]===-2||id%3)continue;const p=coords(id);
      if(Math.abs(p.x)<plan.w/2+.4&&Math.abs(p.z)<plan.d/2+.4)continue;
      p.y=physics.floorAt(p.x,p.z)+eye;
      candidates.push({p,score:Math.hypot(p.x-physics.spawn.x,p.z-physics.spawn.z)});
    }
    candidates.sort((a,b)=>a.score-b.score);
    for(const {p} of candidates)if(flightClear(p,{...p,y:cruise})){launch=p;return p;}
    return null;
  }
  function route(from,to){
    if(!aerial(from)&&!aerial(to))return smooth(groundRoute(from,to),true);
    if(aerial(from)&&aerial(to)&&Math.abs(Math.hypot(from.x-center.x,from.z-center.z)-orbitRadius)<.1&&Math.abs(from.y-altitude)<.1){
      const angle=Math.atan2(from.x-center.x,from.z-center.z),end=Math.atan2(to.x-center.x,to.z-center.z);
      const sweep=Math.atan2(Math.sin(end-angle),Math.cos(end-angle)),n=Math.max(1,Math.ceil(Math.abs(sweep)/(Math.PI/60)));
      const arc=[{...from,view:exteriorFocus}];for(let j=1;j<=n;j++){const a=angle+sweep*j/n;arc.push({x:center.x+orbitRadius*Math.sin(a),y:altitude,z:center.z+orbitRadius*Math.cos(a),view:exteriorFocus});}arc[n]={...to,view:exteriorFocus};return arc;
    }
    if(aerial(from)&&aerial(to)){
      const flight=[from,{...from,y:cruise,view:exteriorFocus},{...to,y:cruise,view:exteriorFocus},{...to,view:exteriorFocus}];
      for(let i=1;i<flight.length;i++)if(!flightClear(flight[i-1],flight[i]))return null;
      return smooth(flight);
    }
    const takeoff=launchPoint();if(!takeoff)return null;
    const outside=aerial(to)?to:from,inside=aerial(to)?from:to;
    const ground=groundRoute(inside,takeoff);if(!ground)return null;
    const rise={...takeoff,y:cruise,view:exteriorFocus},over={x:outside.x,y:cruise,z:outside.z,view:exteriorFocus};
    const air=[takeoff,rise,over,{...outside,view:exteriorFocus}];
    for(let i=1;i<air.length;i++)if(!flightClear(air[i-1],air[i]))return null;
    const combined=[...smooth(ground,true).slice(0,-1),...smooth(air)];
    return aerial(to)?combined:combined.reverse();
  }
  const points=[];
  for(const stop of config.stops){const spec={...stop,...config.models?.[model]?.[stop.id]};let target,bounds,focus,name=spec.label,roomName;
    if(spec.kind==='aerial'){
      const angle=(spec.angle??0)*Math.PI/180;
      target={x:center.x+orbitRadius*Math.sin(angle),z:center.z+orbitRadius*Math.cos(angle)};
      points.push({...target,y:altitude,kind:'aerial',id:spec.id,label:name,dwell:spec.dwell??config.dwell,focus:exteriorFocus,heading:viewHeading(target,exteriorFocus)});continue;
    }
    if(Number.isFinite(spec.x)&&Number.isFinite(spec.z))target=spec;
    else if(spec.kind==='entry')target=physics.spawn;
    else{const room=plan.rooms.find(r=>new RegExp(spec.room,'i').test(r[0]));if(!room)continue;
      const [label,x,z,w,d]=room;name||=label;roomName=label;
      bounds={minX:x-plan.w/2,maxX:x+w-plan.w/2,minZ:plan.d/2-z-d,maxZ:plan.d/2-z};
      focus={x:x+w*(spec.focusU??.5)-plan.w/2,y:physics.floorAt(x+w/2-plan.w/2,plan.d/2-z-d/2)+eye-.2,z:plan.d/2-z-d*(spec.focusV??.5)};
      if(Number.isFinite(spec.u)||Number.isFinite(spec.v))target={x:x+w*(spec.u??.5)-plan.w/2,z:plan.d/2-z-d*(spec.v??.5)};
      else{
        const zone={...bounds};if(/Sala.*cozinha/i.test(label)){if(spec.id==='kitchen')zone.maxZ-=d*.5;else zone.minZ+=d*.5;}
        const insetX=Math.min(.5,(zone.maxX-zone.minX)*.3),insetZ=Math.min(.5,(zone.maxZ-zone.minZ)*.3);
        let score=-Infinity;
        for(const x of [zone.minX+insetX,zone.maxX-insetX])for(const z of [zone.minZ+insetZ,zone.maxZ-insetZ]){
          const id=nearest({x,z},zone);if(id<0)continue;const p=coords(id);
          let approach=4;for(const door of physics.doors)if(door.names?.includes(label))approach=Math.min(approach,Math.hypot(p.x-door.hingeX,p.z-door.hingeZ));
          const value=Math.hypot(p.x-focus.x,p.z-focus.z)-approach*.12;
          if(value>score){score=value;target=p;}
        }
        target||=focus;
      }
    }
    // Every room gets a viewpoint. Report an unavailable connection rather than
    // teleporting through architecture or silently removing the destination.
    const id=nearest(target,bounds);if(id<0)throw Error('Não foi encontrado um ponto seguro em '+(name||spec.id)+'.');
    const point=coords(id),y=physics.floorAt(point.x,point.z)+(spec.walkingHeight?physics.eyeHeight:eye);
    focus||={x:physics.spawn.x,y,z:physics.spawn.z-3};
    points.push({...point,y,id:spec.id,label:name||spec.id,dwell:spec.dwell??config.dwell,focus,heading:viewHeading(point,focus),roomName});
  }
  if(!points.length)throw Error('Não foi encontrado um percurso para esta planta.');
  const legs=points.slice(0,-1).map((p,i)=>route(p,points[i+1]));
  return {points,legs,route,clear,flightClear,cells:count};
}

function createHouseTour({getPhysics,getPlan,getModel,config=CASA_TOUR_CONFIG,onChange=()=>{},plannerFactory=()=>null}) {
  const state={active:false,paused:false,label:'',phase:'idle',index:0,total:0,revision:0,fade:0,message:'',focus:null,heading:null,kind:'room',failure:null};
  let navigation=null,physics=null,path=null,cursor=1,speed=0,hold=0,turnSpeed=0,remaining=[];
  let planner=null,generation=0,requestId=0,lastPosition=null,restartIndex=null;
  const radians=Math.PI/180,turnRate=(config.turnSpeed??18)*radians,turnAcceleration=(config.turnAcceleration??14)*radians;
  const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  function changed(){state.revision++;onChange(state);}
  function preparationFailed(error){state.failure='preparation';state.phase='error';state.paused=true;speed=0;state.message=(error?.message||'Não foi possível preparar o tour.')+' Toque em Continuar para tentar novamente.';changed();}
  function aimHeading(position,aim){return Math.hypot(aim.x-position.x,aim.z-position.z)>.15?Math.atan2(position.x-aim.x,position.z-aim.z):navigation.points[state.index].heading;}
  function turn(heading,dt){
    const angle=difference(heading,state.heading),target=Math.sign(angle)*Math.min(turnRate,Math.sqrt(2*turnAcceleration*Math.abs(angle)));
    turnSpeed+=Math.max(-turnAcceleration*dt,Math.min(turnAcceleration*dt,target-turnSpeed));
    const step=turnSpeed*dt;
    if(Math.sign(step)===Math.sign(angle)&&Math.abs(step)>=Math.abs(angle)){state.heading+=angle;turnSpeed=0;return true;}
    state.heading+=step;return Math.abs(angle)<.0001&&Math.abs(turnSpeed)<.001;
  }
  function restoreWalking(){
    if(!lastPosition||!physics?.blocked)return;const p=getPhysics(),x=lastPosition.x,z=lastPosition.z;let safe=!p.blocked(x,z)?{x,z}:null;
    for(let radius=.1;!safe&&radius<=4;radius+=.1)for(let i=0;i<48;i++){const angle=i*Math.PI/24,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;if(!p.blocked(px,pz)){safe={x:px,z:pz};break;}}
    safe||=p.spawn;lastPosition.x=safe.x;lastPosition.z=safe.z;lastPosition.y=p.floorAt(safe.x,safe.z)+p.eyeHeight;
  }
  function stop(message='Tour encerrado.'){generation++;requestId++;planner?.dispose();planner=null;restoreWalking();state.active=false;state.paused=false;state.phase='idle';state.fade=0;state.focus=null;state.heading=null;state.failure=null;state.message=message;speed=0;changed();}
  function setRoute(index,position,prepared){
    if(index>=navigation.points.length){stop('Tour concluído.');return;}
    state.index=Math.max(0,index);restartIndex=state.index;state.failure=null;const destination=navigation.points[state.index];state.label=destination.label;state.focus=destination.focus||null;state.kind=destination.kind||'room';state.message='Assista sentado. O tour apresenta a casa à frente; olhe livremente para os lados.';
    path=prepared!==undefined?prepared:navigation.route(position,destination);cursor=1;speed=0;state.fade=0;
    if(path){
      remaining=new Float64Array(path.length);for(let i=path.length-2;i>=0;i--)remaining[i]=remaining[i+1]+Math.hypot(path[i+1].x-path[i].x,path[i+1].y-path[i].y,path[i+1].z-path[i].z);
      state.phase='moving';
    }else{state.phase='unavailable';state.failure='route';state.paused=true;state.message='Não há passagem livre até '+destination.label+'. Continuar recalcula o trajeto; você também pode encerrar.';}
    changed();
  }
  function start(position,heading=0,startIndex=null){generation++;requestId++;planner?.dispose();planner=null;physics=getPhysics();lastPosition=position;const token=generation;navigation=null;restartIndex=startIndex;state.total=0;state.index=startIndex??0;state.focus=null;state.heading=heading;state.failure=null;turnSpeed=0;
    state.active=true;state.paused=false;state.fade=0;state.phase='planning';state.label='Preparando tour…';state.message='O percurso está sendo calculado.';changed();
    try{planner=plannerFactory();if(planner){
      const origin={x:position.x,y:position.y,z:position.z};planner.build({physics,plan:getPlan(),model:getModel(),position:origin,config,startIndex}).then(result=>{
        if(!state.active||generation!==token)return;navigation=result;state.total=result.points.length;setRoute(result.index,origin,result.path);
      }).catch(error=>{if(generation!==token)return;preparationFailed(error);});return state;
    }
    navigation=buildHouseTour({physics,plan:getPlan(),model:getModel(),position,config});
    let index=Number.isInteger(startIndex)?Math.min(startIndex,navigation.points.length-1):0;if(startIndex===null&&config.start!=='entry'){let d=Infinity;navigation.points.forEach((p,i)=>{const n=Math.hypot(p.x-position.x,p.z-position.z);if(n<d){d=n;index=i;}});}
    state.active=true;state.paused=false;state.total=navigation.points.length;setRoute(index,position);return state;
    }catch(error){preparationFailed(error);return state;}
  }
  function action(type,position,heading=0){
    if(type==='start')return start(position,heading);if(type==='stop'){stop();return;}
    if(!state.active)return;
    if(type==='pause'){state.paused=true;speed=0;turnSpeed=0;state.fade=0;changed();}
    if(type==='resume'){
      if(state.failure)return start(position,state.heading??heading,restartIndex);
      state.paused=false;changed();
    }
    if((type==='next'||type==='previous')&&navigation&&state.phase!=='planning'){
      const index=Math.max(0,Math.min(navigation.points.length-1,state.index+(type==='next'?1:-1)));restartIndex=index;state.paused=false;
      if(planner){const id=++requestId,token=generation;state.phase='planning';state.message='Preparando o próximo percurso…';state.fade=0;changed();
        const origin={x:position.x,y:position.y,z:position.z};try{planner.route(index,origin).then(path=>{if(state.active&&id===requestId&&generation===token)setRoute(index,origin,path);}).catch(error=>{if(id===requestId&&generation===token)preparationFailed(error);});}catch(error){preparationFailed(error);}
      }else setRoute(index,position);
    }
  }
  function update(position,delta){
    if(!state.active)return false;lastPosition=position;if(getPhysics()!==physics){stop('Planta alterada. Inicie um novo tour.');return false;}
    if(state.paused||state.phase==='planning'||state.phase==='unavailable'||state.phase==='error')return true;const dt=Math.min(.05,delta),destination=navigation.points[state.index];
    // Animate existing doors ahead of the visitor; furniture never halts playback.
    for(const door of physics.doors)if(Math.hypot(door.hingeX-position.x,door.hingeZ-position.z)<2.5)door.target=door.openAngle;
    if(state.phase==='dwell'){hold-=dt;if(hold<=0)setRoute(state.index+1,position,navigation.legs[state.index]);return true;}
    if(state.phase==='settle'){
      if(turn(destination.heading,dt)){state.phase='dwell';hold=destination.dwell;changed();}return true;
    }
    let aim=path?.[cursor];
    while(aim&&Math.hypot(aim.x-position.x,aim.y-position.y,aim.z-position.z)<.000001){cursor++;aim=path[cursor];}
    if(!aim){speed=0;state.phase='settle';changed();return true;}
    const dx=aim.x-position.x,dy=aim.y-position.y,dz=aim.z-position.z,distance=Math.hypot(dx,dy,dz);
    const left=distance+remaining[cursor];
    // Look a little ahead along the prepared curve, then frame the room itself
    // during the final approach. Head tracking remains independent of this yaw.
    let look=aim,lookDistance=distance,j=cursor;
    while(j<path.length-1&&lookDistance<1.1){lookDistance+=remaining[j]-remaining[j+1];look=path[++j];}
    let heading=aim.view?aimHeading(position,aim.view):aimHeading(position,look);
    const framing=Math.max(0,Math.min(1,1-left/2));heading+=difference(destination.heading,heading)*framing;
    const error=Math.abs(difference(heading,state.heading));turn(heading,dt);
    const braking=Math.sqrt(2*config.acceleration*left),cornerSpeed=Math.max(.28,config.speed*(1-error/Math.PI));
    const target=Math.min(config.speed,braking,cornerSpeed);speed+=Math.max(-config.acceleration*dt,Math.min(config.acceleration*dt,target-speed));
    // Camera flight, not a walking body. Architectural clearance is precomputed.
    let travel=speed*dt;
    while(travel>0&&cursor<path.length){
      const p=path[cursor],x=p.x-position.x,y=p.y-position.y,z=p.z-position.z,d=Math.hypot(x,y,z);
      if(d<=travel){position.x=p.x;position.y=p.y;position.z=p.z;travel-=d;cursor++;}
      else{const t=travel/d;position.x+=x*t;position.y+=y*t;position.z+=z*t;travel=0;}
    }
    return true;
  }
  return {state,start,action,stop,update,get points(){return navigation?.points||[];}};
}
