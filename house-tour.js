// Shared by the planner and the live tour. Segment checks include the complete
// camera volume, height, furniture, roof and the current (or planned) door pose.
function createTourCollision(physics,margin=.14){
  const boxes=[...(physics.boxes||[]),...(physics.flightBoxes||[])],axes=['x','y','z'];
  const localA={x:0,y:0,z:0},localB={x:0,y:0,z:0},leaf={minX:0,maxX:0,minZ:-.035,maxZ:.035,bottom:0,top:0};
  const floorAt=physics.floorAt||(()=>0);
  function slab(a,b,box,pad=margin){
    let near=0,far=1;
    for(const axis of axes){
      const lo=(axis==='y'?box.bottom:box[axis==='x'?'minX':'minZ'])-pad;
      const hi=(axis==='y'?box.top:box[axis==='x'?'maxX':'maxZ'])+pad;
      const d=b[axis]-a[axis];
      if(Math.abs(d)<1e-10){if(a[axis]<lo||a[axis]>hi)return false;continue;}
      const u=(lo-a[axis])/d,v=(hi-a[axis])/d;near=Math.max(near,Math.min(u,v));far=Math.min(far,Math.max(u,v));if(near>far)return false;
    }
    return true;
  }
  function doorHits(a,b,door,angle,pad=margin){
    const sign=door.hingeDirection??1,c=Math.cos(angle),s=Math.sin(angle),ux=sign*(door.axis==='x'?c:-s),uz=sign*(door.axis==='x'?-s:-c);
    const cx=door.hingeX+ux*door.width/2,cz=door.hingeZ+uz*door.width/2,ax=a.x-cx,az=a.z-cz,bx=b.x-cx,bz=b.z-cz;
    localA.x=ax*ux+az*uz;localA.y=a.y;localA.z=-ax*uz+az*ux;
    localB.x=bx*ux+bz*uz;localB.y=b.y;localB.z=-bx*uz+bz*ux;
    leaf.minX=-door.width/2;leaf.maxX=door.width/2;leaf.bottom=door.bottom??0;leaf.top=door.top??2.3;
    return slab(localA,localB,leaf,pad);
  }

  function clear(a,b,{doors='open',padding=margin}={}){
    if(!a||!b)return false;for(const k of axes)if(!Number.isFinite(a[k])||!Number.isFinite(b[k]))return false;
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.12));
    for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+(b.y-a.y)*t;if(y<floorAt(x,z)+.65)return false;}
    for(const box of boxes)if((!box.enabled||box.enabled())&&slab(a,b,box,padding))return false;
    if(doors!=='ignore')for(const door of physics.doors||[])if(doorHits(a,b,door,doors==='live'?door.angle:door.openAngle,padding))return false;
    return true;
  }
  return {clear,doorHits,point:(p,doors='live')=>clear(p,p,{doors})};
}

// Routes are prepared once, off the render thread.
function buildHouseTour({physics,plan,model,position,config=CASA_TOUR_CONFIG}) {
  const eye=Math.min(config.eyeHeight??1.75,1.75);
  const step=config.grid,margin=4,minX=Math.min(-plan.w/2-margin,position.x-1),minZ=Math.min(-plan.d/2-margin,position.z-1);
  const maxX=Math.max(plan.w/2+margin,position.x+1),maxZ=Math.max(plan.d/2+margin,position.z+1,physics.spawn.z+1);
  const width=Math.ceil((maxX-minX)/step)+1,height=Math.ceil((maxZ-minZ)/step)+1,count=width*height;
  const free=new Uint8Array(count),queue=new Int32Array(count),parent=new Int32Array(count);
  const edgeKnown=new Uint16Array(count),edgeFree=new Uint16Array(count);
  let reachable=null;
  const collision=createTourCollision(physics,config.cameraMargin??.14);
  // In compact bathrooms a flying eye may pass above low fixtures, while the
  // actual camera volume still checks every fixture, mirror and glass panel.
  // Keeping a floor-sized avatar here would leave the eye in the door swing.
  const bathrooms=plan.rooms.filter(r=>/^Banheiro/i.test(r[0])).map(([,x,z,w,d])=>({minX:x-plan.w/2,maxX:x+w-plan.w/2,minZ:plan.d/2-z-d,maxZ:plan.d/2-z}));
  const bodyBoxes=physics.boxes.filter(b=>!(b.kind==='furniture'&&b.top<1.55&&bathrooms.some(r=>b.minX>=r.minX&&b.maxX<=r.maxX&&b.minZ>=r.minZ&&b.maxZ<=r.maxZ)));
  const walkSpace=createWalkPhysics({boxes:bodyBoxes,floors:physics.floors,radius:physics.radius,eyeHeight:physics.eyeHeight});
  let routeDoors=[];
  const occupied=(x,z)=>walkSpace.blockedForTour(x,z,false,eye)||routeDoors.some(d=>physics.hitsDoor(x,z,d,d.openAngle));
  function coords(id){const x=minX+(id%width)*step,z=minZ+Math.floor(id/width)*step;return {x,z,y:physics.floorAt(x,z)+eye};}
  for(let id=0;id<count;id++){const p=coords(id);free[id]=Number(!occupied(p.x,p.z)&&collision.point(p,'ignore'));}
  function nearest(point,bounds,disconnected=false){let best=-1,distance=Infinity;
    for(let id=0;id<count;id++){if(!free[id]||(reachable&&!reachable[id]&&!disconnected))continue;const x=minX+(id%width)*step,z=minZ+Math.floor(id/width)*step;
      if(bounds&&(x<bounds.minX+physics.radius||x>bounds.maxX-physics.radius||z<bounds.minZ+physics.radius||z>bounds.maxZ-physics.radius))continue;
      if(bounds&&physics.doors.some(d=>physics.hitsDoor(x,z,d,d.openAngle,.25)))continue;
      const d=(x-point.x)**2+(z-point.z)**2;if(d>=distance)continue;
      if(routeDoors.length&&occupied(x,z))continue;
      distance=d;best=id;}
    return best;
  }
  function flood(start){parent.fill(-2);if(start<0)return;let head=0,tail=1;queue[0]=start;parent[start]=-1;
    while(head<tail){const id=queue[head++],x=id%width,z=Math.floor(id/width);
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        if((!dx&&!dz)||x+dx<0||x+dx>=width||z+dz<0||z+dz>=height)continue;
        const next=id+dz*width+dx;if(!free[next]||parent[next]!==-2)continue;
        if(dx&&dz&&(!free[id+dx]||!free[id+dz*width]))continue;
        // A free cell on each side does not prove the edge is free. This matters
        // at thin furniture parts and door leaves in the 62 m² corridor.
        const bit=1<<((dz+1)*3+dx+1);
        if(!(edgeKnown[id]&bit)){edgeKnown[id]|=bit;
          if(!walkSpace.blockedForTour(minX+(x+dx*.5)*step,minZ+(z+dz*.5)*step,false,eye)&&collision.clear(coords(id),coords(next),{doors:'ignore'}))edgeFree[id]|=bit;}
        if(!(edgeFree[id]&bit))continue;
        if(routeDoors.some(d=>physics.hitsDoor(minX+(x+dx*.5)*step,minZ+(z+dz*.5)*step,d,d.openAngle)||physics.hitsDoor(minX+(x+dx)*step,minZ+(z+dz)*step,d,d.openAngle)))continue;
        parent[next]=id;queue[tail++]=next;
      }
    }
  }
  function clear(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.04));
    for(let i=0;i<=n;i++){const t=i/n;if(occupied(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}
    return collision.clear(a,b,{doors:'ignore'})&&!routeDoors.some(d=>collision.doorHits(a,b,d,d.openAngle));
  }
  flood(nearest(physics.spawn));reachable=new Uint8Array(count);
  for(let id=0;id<count;id++)reachable[id]=Number(parent[id]!==-2);
  // A rounded perimeter keeps the whole lot in view. An inscribed ellipse
  // cuts across the building's corners and turns the presentation into roofs.
  const site=physics.site||{x0:-3,x1:plan.w+3,z0:-4,z1:plan.d+4};
  const center={x:(site.x0+site.x1)/2-plan.w/2,z:plan.d/2-(site.z0+site.z1)/2};
  const altitude=config.exteriorHeight??4.4,setback=config.exteriorSetback??2.5;
  const overviewHeight=config.overviewHeight??Math.max(10,site.x1-site.x0,site.z1-site.z0);
  const radiusX=(site.x1-site.x0)/2+setback,radiusZ=(site.z1-site.z0)/2+setback,orbitPower=.55;
  const exteriorFocus={x:0,y:1.7,z:Math.max(-plan.d*.22,center.z*.35)};
  const lotFocus={x:center.x,y:.45,z:center.z};
  const signedPower=(v,p)=>Math.sign(v)*Math.abs(v)**p;
  function orbitPoint(angle,y=altitude){return {x:center.x+radiusX*signedPower(Math.sin(angle),orbitPower),y,z:center.z+radiusZ*signedPower(Math.cos(angle),orbitPower),view:exteriorFocus};}
  function orbitAngle(p){return Math.atan2(signedPower((p.x-center.x)/radiusX,1/orbitPower),signedPower((p.z-center.z)/radiusZ,1/orbitPower));}
  function aerial(p){
    // Street-level visitors are outside the closed lot, even at walking height.
    // Use the checked takeoff/landing connection rather than asking the ground
    // grid to find a nonexistent opening through the perimeter wall or gate.
    const siteX=p.x+plan.w/2,siteZ=plan.d/2-p.z;
    const outsideLot=siteX<site.x0||siteX>site.x1||siteZ<site.z0||siteZ>site.z1;
    // Standing up/recentring the headset indoors does not put the visitor above
    // the roof. Connect to the indoor route before attempting an exterior flight.
    const indoors=Math.abs(p.x)<plan.w/2+.4&&Math.abs(p.z)<plan.d/2+.4&&p.y<(physics.roofTop||4)+.1;
    return p.kind==='aerial'||outsideLot||(!indoors&&p.y>physics.floorAt(p.x,p.z)+eye+.25);
  }
  function viewHeading(p,focus){return Math.atan2(p.x-focus.x,p.z-focus.z);}
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const flightClear=(a,b,padding=.08)=>collision.clear(a,b,{doors:'ignore',padding});
  function gridRoute(from,to){
    // A tracked eye can be clear while its walking-body margin overlaps a wall
    // or cupboard. Join a reachable grid cell with a checked camera-sized lead-in;
    // repeating the same blocked walking start would otherwise fail forever.
    const raised=from.y>physics.floorAt(from.x,from.z)+eye+.2;
    if(raised||occupied(from.x,from.z)){
      const finish=nearest(to);flood(finish);const candidates=[];
      for(let id=0;id<count;id++){
        if(!free[id]||parent[id]===-2)continue;const p=coords(id),d=Math.hypot(p.x-from.x,p.z-from.z);
        if(d>2)continue;p.y=physics.floorAt(p.x,p.z)+eye;candidates.push({p,d});
      }
      candidates.sort((a,b)=>a.d-b.d);
      for(const {p} of candidates){
        if(!collision.clear(from,p,{padding:.06,doors:'ignore'}))continue;
        const n=Math.max(1,Math.ceil(distance(from,p)/.025));let clearDoors=true;
        for(let i=0;i<=n&&clearDoors;i++){
          const t=i/n,x=from.x+(p.x-from.x)*t,z=from.z+(p.z-from.z)*t,y=from.y+(p.y-from.y)*t;
          clearDoors=!routeDoors.some(d=>y>(d.bottom??0)&&y<(d.top??2.3)&&physics.hitsDoor(x,z,d,d.openAngle,.06));
        }
        if(!clearDoors)continue;const rest=gridRoute(p,to);
        if(rest)return [{...from},...rest];
      }
      return null;
    }
    const start=nearest(from),finish=nearest(to);flood(start);if(finish<0||parent[finish]===-2)return null;
    const raw=[];for(let id=finish;id>=0;id=parent[id])raw.push(coords(id));raw.reverse();raw.unshift({...from});
    const result=[raw[0]];let i=0;while(i<raw.length-1){let end=raw.length-1;while(end>i+1&&!clear(raw[i],raw[end]))end--;if(!clear(raw[i],raw[end]))return null;result.push(raw[end]);i=end;}
    let length=0;for(let j=1;j<result.length;j++)length+=Math.hypot(result[j].x-result[j-1].x,result[j].z-result[j-1].z);
    if(length<.0001)return [{...from},{...to}];
    // Keep sampled floor heights. A global interpolation can put the camera
    // into a lintel or furniture while crossing a step or a different room.
    result[result.length-1]={...to};
    for(let j=1;j<result.length;j++)if(!collision.clear(result[j-1],result[j],{padding:.06,doors:'ignore'}))return null;
    return result;
  }
  function groundRoute(from,to){
    // Doors are traversed sequentially. Holding every door on the itinerary
    // open at once can seal a corridor that is perfectly usable one door at a time.
    routeDoors=[];const base=gridRoute(from,to);if(!base)return null;
    const dense=[base[0]];
    for(let i=1;i<base.length;i++){const a=base[i-1],b=base[i],n=Math.max(1,Math.ceil(distance(a,b)/.12));
      for(let j=1;j<=n;j++){const t=j/n;dense.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}
    const crossings=[],seen=new Set();
    for(let i=1;i<dense.length;i++)for(const door of physics.doors)if(!seen.has(door)&&collision.doorHits(dense[i-1],dense[i],door,0)){seen.add(door);crossings.push({door,index:i});}
    const result=[{...from}];let anchor=from;
    for(let k=0;k<crossings.length;k++){
      const {door,index}=crossings[k],limit=Math.min(dense.length-1,(crossings[k+1]?.index??dense.length)-1);let segment=null;
      routeDoors=[door];
      for(let end=Math.min(index+5,limit);end<=limit&&end<=index+30;end++){
        const p=end===dense.length-1?to:dense[end];if(collision.doorHits(p,p,door,door.openAngle,.22))continue;
        if(end<limit&&Math.hypot(p.x-door.hingeX,p.z-door.hingeZ)<door.width+.3)continue;
        segment=gridRoute(anchor,p);if(segment)break;
      }
      if(!segment){routeDoors=[];return null;}
      result.push(...segment.slice(1));anchor=result[result.length-1];
    }
    routeDoors=[];const tail=gridRoute(anchor,to);if(!tail)return null;result.push(...tail.slice(1));return result;
  }
  // Round each bend locally. A global spline can bulge through the wall beside a
  // door; these short curves are accepted only after checking every chord.
  function smooth(raw,ground=false){
    if(!raw||raw.length<3)return raw;
    raw=raw.filter((p,i)=>!i||distance(p,raw[i-1])>1e-5);
    const result=[raw[0]],safe=ground?(a,b)=>clear(a,b)&&flightClear(a,b)&&!physics.doors.some(d=>collision.doorHits(a,b,d,0)&&collision.doorHits(a,b,d,d.openAngle)):flightClear;
    for(let i=1;i<raw.length-1;i++){
      const a=raw[i-1],b=raw[i],c=raw[i+1];
      let radius=Math.min(config.cornerRadius??.55,distance(a,b)*.4,distance(b,c)*.4),curve=null;
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
  function rawRoute(from,to){
    if(!aerial(from)&&!aerial(to)){
      // Reach the room's safe viewpoint without an artificial sideways detour
      // to an approach point followed by an immediate reversal.
      const first=groundRoute(from,to);if(!first)return null;
      const result=smooth(first,true);
      return result;
    }
    // Return around the building, not across its centre. Flying directly over
    // the subject puts the whole house below the headset's neutral field of
    // view and makes the gimbal spin as the centre passes underneath it.
    if(from.kind==='aerial'&&!aerial(to)){
      const front={...points.find(p=>p.kind==='aerial')};
      if(distance(from,front)>.1){const arc=rawRoute(from,front),landing=rawRoute(front,to);if(!arc||!landing)return null;return [...arc,...landing.slice(1)];}
    }
    if(from.kind==='aerial'&&to.kind==='aerial'){
      const angle=orbitAngle(from),end=orbitAngle(to);
      const sweep=Math.atan2(Math.sin(end-angle),Math.cos(end-angle)),n=Math.max(1,Math.ceil(Math.abs(sweep)/(Math.PI/60)));
      const arc=[{...from,view:to.focus||exteriorFocus}];for(let j=1;j<=n;j++)arc.push(orbitPoint(angle+sweep*j/n,from.y+(to.y-from.y)*j/n));arc[n]={...to,view:to.focus||exteriorFocus};
      if(arc.every((p,i)=>!i||flightClear(arc[i-1],p)))return arc;
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
    const air=flightClear(takeoff,outside)?[takeoff,{...outside,view:exteriorFocus}]:[takeoff,rise,over,{...outside,view:exteriorFocus}];
    for(let i=1;i<air.length;i++)if(!flightClear(air[i-1],air[i]))return null;
    const combined=[...smooth(ground,true).slice(0,-1),...smooth(air)];
    for(const p of combined)if(Math.abs(p.x)>plan.w/2+.1||p.z>plan.d/2+.2||p.z<-plan.d/2-.2)p.view=exteriorFocus;
    return aerial(to)?combined:combined.reverse();
  }
  function route(from,to){
    routeDoors=[];
    const path=rawRoute(from,to);return path&&path.every((p,i)=>!i||collision.clear(path[i-1],p,{doors:'ignore',padding:.06}))?path:null;
  }
  const points=[];
  for(const stop of config.stops){const spec={...stop,...config.models?.[model]?.[stop.id]};let target,bounds,focus,name=spec.label,roomName;
    if(spec.kind==='aerial'){
      const angle=(spec.angle??0)*Math.PI/180;
      const focus=spec.overview?lotFocus:exteriorFocus;
      target=orbitPoint(angle,spec.overview?overviewHeight:altitude);
      points.push({...target,kind:'aerial',id:spec.id,label:name,dwell:spec.dwell??config.dwell,focus,heading:viewHeading(target,focus)});continue;
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
        // Present from the arrival side of the room. Choosing the far corner
        // and then looking back made the old camera turn around in every room.
        const previous=points[points.length-1]||physics.spawn;
        let score=Infinity;
        for(let cell=0;cell<count;cell++){
          if(!free[cell]||!reachable[cell])continue;const p=coords(cell);
          if(p.x<zone.minX+.4||p.x>zone.maxX-.4||p.z<zone.minZ+.4||p.z>zone.maxZ-.4)continue;
          if(physics.doors.some(d=>physics.hitsDoor(p.x,p.z,d,d.openAngle,.27)))continue;
          const framing=Math.hypot(p.x-focus.x,p.z-focus.z);
          const value=Math.hypot(p.x-previous.x,p.z-previous.z)+Math.max(0,.85-framing)*3;
          if(value<score){score=value;target=p;}
        }
        target||=focus;
      }
    }
    // Every room gets a viewpoint. Report an unavailable connection rather than
    // teleporting through architecture or silently removing the destination.
    let id=nearest(target,bounds);if(id<0)id=nearest(target,bounds,true);if(id<0)throw Error('Não foi encontrado um ponto seguro em '+(name||spec.id)+'.');
    const point=coords(id),y=physics.floorAt(point.x,point.z)+(spec.walkingHeight?physics.eyeHeight:eye);
    focus||={x:physics.spawn.x,y,z:physics.spawn.z-3};
    let endpoint=point,approach=null;
    if(bounds&&config.roomRevealDetour===true){let best=.55;
      for(let cell=0;cell<count;cell++){if(!free[cell]||!reachable[cell])continue;const p=coords(cell),d=Math.hypot(p.x-point.x,p.z-point.z);
        if(d<.65||d>1.35||p.x<bounds.minX+.35||p.x>bounds.maxX-.35||p.z<bounds.minZ+.35||p.z>bounds.maxZ-.35)continue;
        if(physics.doors.some(door=>physics.hitsDoor(p.x,p.z,door,door.openAngle,.27)))continue;
        if(!clear(point,p))continue;
        const score=d-.15*Math.abs(Math.hypot(p.x-focus.x,p.z-focus.z)-1);
        if(score>best){best=score;endpoint=p;approach={...point,y};}
      }
    }
    points.push({...endpoint,y:physics.floorAt(endpoint.x,endpoint.z)+(spec.walkingHeight?physics.eyeHeight:eye),approach,bounds,id:spec.id,label:name||spec.id,dwell:spec.dwell??config.dwell,focus,heading:viewHeading(endpoint,focus),roomName});
  }
  if(!points.length)throw Error('Não foi encontrado um percurso para esta planta.');
  const legs=points.slice(0,-1).map((p,i)=>route(p,points[i+1]));
  return {points,legs,route,clear,flightClear,cells:count};
}

function createHouseTour({getPhysics,getPlan,getModel,config=CASA_TOUR_CONFIG,onChange=()=>{},plannerFactory=()=>null}) {
  const state={active:false,paused:false,label:'',phase:'idle',index:0,total:0,revision:0,fade:0,message:'',focus:null,heading:null,kind:'room',failure:null,recoveries:0,doorWait:false,turning:false};
  let navigation=null,physics=null,path=null,cursor=1,speed=0,hold=0,turnSpeed=0,remaining=[],speedLimits=[],houseFocus=null;
  let planner=null,generation=0,requestId=0,lastPosition=null,restartIndex=null;
  let collision=null,repairs=0;const lastSafe={x:0,y:0,z:0},candidate={x:0,y:0,z:0},probe={x:0,y:0,z:0};
  const lookAhead={x:0,y:0,z:0};let filteredHeading=0;
  function heightLimit(p){
    const plan=getPlan();if(!physics||p.y>(physics.roofTop||4)+.1)return Infinity;
    // A low roof can sit below the tallest facade. Above that roof the eye is
    // outdoors, even when its X/Z overlaps a room on a compact lot.
    if(p.y>physics.floorAt(p.x,p.z)+2.4)for(const roof of physics.flightBoxes||[]){
      if(roof.bottom>=2.4&&p.y>roof.top+.06&&p.x>=roof.minX&&p.x<=roof.maxX&&p.z>=roof.minZ&&p.z<=roof.maxZ)return Infinity;
    }
    for(const room of plan.rooms){const [,x,z,w,d]=room;
      if(p.x>=x-plan.w/2&&p.x<=x+w-plan.w/2&&p.z>=plan.d/2-z-d&&p.z<=plan.d/2-z)return physics.floorAt(p.x,p.z)+1.75;
    }
    return Infinity;
  }
  function remember(p){lastSafe.x=p.x;lastSafe.y=p.y;lastSafe.z=p.z;}
  function recover(position){
    position.x=lastSafe.x;position.y=lastSafe.y;position.z=lastSafe.z;state.recoveries++;speed=0;
    if(++repairs>2){state.paused=true;state.failure='route';state.phase='unavailable';state.message='Percurso bloqueado. Sua posição foi preservada. Use Continuar para recalcular.';changed();return;}
    start(position,state.heading??0,state.index,true);
  }
  function controlDoors(position){
    for(const door of physics.doors){let needed=false,travel=0,a=position;
      if(Math.hypot(position.x-door.hingeX,position.z-door.hingeZ)<door.width+2.2){
        for(let j=cursor;j<(path?.length??0)&&travel<1.65;j++){
          const p=path[j],length=Math.hypot(p.x-a.x,p.y-a.y,p.z-a.z),t=Math.min(1,(1.65-travel)/(length||1));
          probe.x=a.x+(p.x-a.x)*t;probe.y=a.y+(p.y-a.y)*t;probe.z=a.z+(p.z-a.z)*t;
          if(collision.doorHits(a,probe,door,0,.22)){needed=true;break;}travel+=length;a=p;
        }
      }
      // Keep the leaf open until the visitor is clear of its closing sweep.
      let sweeping=false;
      if(!needed&&Math.abs(door.angle)>.01)for(let angle=0;Math.abs(angle)<=Math.abs(door.angle);angle+=Math.sign(door.angle)*.08){if(collision.doorHits(position,position,door,angle,.23)){sweeping=true;break;}}
      door.target=needed||sweeping?door.openAngle:0;
    }
  }
  const radians=Math.PI/180,turnRate=(config.turnSpeed??18)*radians,turnAcceleration=(config.turnAcceleration??14)*radians;
  const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  function changed(){state.revision++;onChange(state);}
  function preparationFailed(error){state.failure='preparation';state.phase='error';state.paused=true;speed=0;state.message=(error?.message||'Não foi possível preparar o tour.')+' Toque em Continuar para tentar novamente.';changed();}
  function aimHeading(position,aim){return Math.hypot(aim.x-position.x,aim.z-position.z)>.15?Math.atan2(position.x-aim.x,position.z-aim.z):navigation.points[state.index].heading;}
  function turn(heading,dt){
    // A damped gimbal: remove target chatter before rotating the rig, then ease
    // angular speed to zero instead of snapping it to zero on target crossing.
    filteredHeading+=difference(heading,filteredHeading)*(1-Math.exp(-dt/(config.aimSmoothing??.8)));
    const angle=difference(filteredHeading,state.heading),target=Math.max(-turnRate,Math.min(turnRate,angle*(config.turnResponse??1.35)));
    turnSpeed+=Math.max(-turnAcceleration*dt,Math.min(turnAcceleration*dt,target-turnSpeed));
    state.heading+=turnSpeed*dt;return Math.abs(difference(heading,state.heading))<.0001&&Math.abs(turnSpeed)<.001;
  }
  function prepareSpeedLimits(destination){
    // Backward braking profile, computed once per leg. Sharp bends that cannot
    // be rounded safely are crossed slowly; wide curves retain cruising speed.
    speedLimits=new Float64Array(path.length);speedLimits.fill(config.exteriorSpeed??config.speed);
    const lateral=config.lateralAcceleration??.65;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],c=path[i+1]||(destination.dwell===0?navigation.legs[state.index]?.find(p=>Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z)>.02):null);
      if(!c)continue;
      const ax=b.x-a.x,ay=b.y-a.y,az=b.z-a.z,bx=c.x-b.x,by=c.y-b.y,bz=c.z-b.z,ab=Math.hypot(ax,ay,az),bc=Math.hypot(bx,by,bz);
      if(ab<1e-6||bc<1e-6)continue;
      const angle=Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by+az*bz)/(ab*bc))));
      if(angle>.001){const radius=Math.min(ab,bc)*.5/Math.max(.001,Math.sin(angle*.5));speedLimits[i]=Math.min(speedLimits[i],Math.sqrt(lateral*radius),angle>Math.PI*.75?.12:angle>.22?.28:Infinity);}
    }
    if(destination.dwell>0||state.index===state.total-1)speedLimits[path.length-1]=0;
    for(let i=path.length-2;i>=0;i--)speedLimits[i]=Math.min(speedLimits[i],Math.sqrt(speedLimits[i+1]**2+2*config.acceleration*(remaining[i]-remaining[i+1])));
  }
  function sampleAhead(position,metres){
    let a=position;
    for(let i=cursor;i<path.length;i++){
      const b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
      if(length>=metres){const t=metres/(length||1);lookAhead.x=a.x+(b.x-a.x)*t;lookAhead.y=a.y+(b.y-a.y)*t;lookAhead.z=a.z+(b.z-a.z)*t;return lookAhead;}
      metres-=length;a=b;
    }
    const next=navigation.points[state.index].dwell===0?navigation.legs[state.index]:null;
    if(next)for(let i=1;i<next.length;i++){
      const b=next[i],length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
      if(length>=metres){const t=metres/(length||1);lookAhead.x=a.x+(b.x-a.x)*t;lookAhead.y=a.y+(b.y-a.y)*t;lookAhead.z=a.z+(b.z-a.z)*t;return lookAhead;}
      metres-=length;a=b;
    }
    lookAhead.x=a.x;lookAhead.y=a.y;lookAhead.z=a.z;return lookAhead;
  }
  function restoreWalking(){
    if(!lastPosition||!physics?.blocked)return;const p=getPhysics(),x=lastPosition.x,z=lastPosition.z;let safe=!p.blocked(x,z)?{x,z}:null;
    for(let radius=.1;!safe&&radius<=4;radius+=.1)for(let i=0;i<48;i++){const angle=i*Math.PI/24,px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;if(!p.blocked(px,pz)){safe={x:px,z:pz};break;}}
    safe||=p.spawn;lastPosition.x=safe.x;lastPosition.z=safe.z;lastPosition.y=p.floorAt(safe.x,safe.z)+p.eyeHeight;
  }
  function stop(message='Tour encerrado.'){generation++;requestId++;planner?.dispose();planner=null;restoreWalking();for(const door of physics?.doors||[])door.target=0;state.active=false;state.paused=false;state.phase='idle';state.fade=0;state.focus=null;state.heading=null;state.failure=null;state.message=message;speed=0;changed();}
  function setRoute(index,position,prepared,continuous=false){
    if(index>=navigation.points.length){stop('Tour concluído.');return;}
    state.index=Math.max(0,index);restartIndex=state.index;state.failure=null;const destination=navigation.points[state.index];state.label=destination.label;state.focus=destination.focus||null;state.kind=destination.kind||'room';state.message='Assista sentado. O tour apresenta a casa à frente; olhe livremente para os lados.';
    houseFocus=destination.kind==='aerial'?destination.focus:navigation.points.find(p=>p.kind==='aerial')?.focus||destination.focus;
    path=prepared!==undefined?prepared:navigation.route(position,destination);cursor=1;if(!continuous)speed=0;state.fade=0;
    // Do not rotate the whole chair just to correct a few centimetres of grid
    // rounding at the entrance. Raise the eye vertically at its actual X/Z.
    if(path&&destination.kind!=='aerial'&&!destination.bounds&&Math.hypot(destination.x-position.x,destination.z-position.z)<.15)path=[{...position},{...position,y:destination.y}];
    if(path)path=path.map((p,i)=>i?{...p,y:Math.min(p.y,heightLimit(p))}:p);
    if(path&&!path.every((p,i)=>!i||collision.clear(path[i-1],p,{doors:'ignore',padding:.06})))path=null;
    if(path){
      remaining=new Float64Array(path.length);for(let i=path.length-2;i>=0;i--)remaining[i]=remaining[i+1]+Math.hypot(path[i+1].x-path[i].x,path[i+1].y-path[i].y,path[i+1].z-path[i].z);
      prepareSpeedLimits(destination);
      state.phase='moving';
    }else{state.phase='unavailable';state.failure='route';state.paused=true;state.message='Não há passagem livre até '+destination.label+'. Continuar recalcula o trajeto; você também pode encerrar.';}
    changed();
  }
  function start(position,heading=0,startIndex=null,repair=false){generation++;requestId++;planner?.dispose();planner=null;physics=getPhysics();collision=createTourCollision(physics,config.cameraMargin??.14);lastPosition=position;if(!repair){repairs=0;state.recoveries=0;remember(position);}for(const door of physics.doors||[])door.target=0;const token=generation;navigation=null;restartIndex=startIndex;state.total=0;state.index=startIndex??0;state.focus=null;state.heading=heading;state.failure=null;turnSpeed=0;
    filteredHeading=heading;state.turning=false;state.active=true;state.paused=false;state.fade=0;state.phase='planning';state.label='Preparando tour…';state.message='O percurso está sendo calculado.';changed();
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
    if(!collision.clear(position,position,{doors:'ignore',padding:.06})||Math.hypot(position.x-lastSafe.x,position.y-lastSafe.y,position.z-lastSafe.z)>.5){recover(position);return true;}
    if(state.paused||state.phase==='planning'||state.phase==='unavailable'||state.phase==='error')return true;const dt=Math.min(.05,delta),destination=navigation.points[state.index];
    controlDoors(position);state.doorWait=false;
    if(state.phase==='dwell'){hold-=dt;if(hold<=0)setRoute(state.index+1,position,navigation.legs[state.index],true);return true;}
    if(state.phase==='settle'){
      if(turn(destination.heading,dt)){state.phase='dwell';hold=destination.dwell;changed();}return true;
    }
    let aim=path?.[cursor];
    while(aim&&Math.hypot(aim.x-position.x,aim.y-position.y,aim.z-position.z)<.000001){cursor++;aim=path[cursor];}
    if(!aim){
      if(destination.dwell>0){speed=0;state.phase='settle';changed();}
      else {setRoute(state.index+1,position,navigation.legs[state.index],true);if(state.active)return update(position,delta);}
      return true;
    }
    const dx=aim.x-position.x,dy=aim.y-position.y,dz=aim.z-position.z,distance=Math.hypot(dx,dy,dz);
    const left=distance+remaining[cursor];
    // Indoors, travel facing forward. A room focus must never make the base
    // fly backwards. Anticipate only a small angle of the upcoming bend; turn
    // in place before reversals while keeping native head tracking independent.
    const look=sampleAhead(position,config.lookAhead??2.2);
    const horizontal=Math.hypot(dx,dz),bearing=horizontal>1e-6?Math.atan2(-dx,-dz):filteredHeading;
    const ahead=Math.hypot(look.x-position.x,look.z-position.z)>.45?aimHeading(position,look):bearing;
    const outdoors=!Number.isFinite(heightLimit(position));
    const frontal=!outdoors||Number.isFinite(heightLimit(aim));
    state.travelMode=frontal?'forward':'showcase';
    const heading=!frontal&&houseFocus?aimHeading(position,houseFocus):bearing+Math.max(-12*radians,Math.min(12*radians,difference(ahead,bearing)));
    turn(heading,dt);
    // Outside, backing away is allowed, but only with the house framed. Wait
    // for the pan at the exit instead of flying away looking at empty horizon.
    const facingError=!frontal?Math.abs(difference(heading,state.heading)):horizontal>1e-6?Math.abs(difference(bearing,state.heading)):0;
    if(facingError>35*radians)state.turning=true;
    else if(facingError<15*radians)state.turning=false;
    if(state.turning){speed=0;return true;}
    const plan=getPlan(),exterior=position.y>physics.floorAt(position.x,position.z)+2.3||(destination.kind==='aerial'&&(Math.abs(position.x)>plan.w/2+.5||Math.abs(position.z)>plan.d/2+.5));
    const cruise=exterior?(config.exteriorSpeed??config.speed):config.speed;
    const braking=destination.dwell>0||state.index===state.total-1?Math.sqrt(2*config.acceleration*left):cruise;
    const cornerSpeed=Math.sqrt(speedLimits[cursor]**2+2*config.acceleration*distance);
    const alignmentSpeed=cruise*Math.max(0,Math.min(1,(35*radians-facingError)/(20*radians)));
    const target=Math.min(cruise,braking,cornerSpeed,alignmentSpeed);speed+=Math.max(-config.acceleration*dt,Math.min(config.acceleration*dt,target-speed));
    // Camera flight, not a walking body. Architectural clearance is precomputed.
    let travel=speed*dt;
    while(travel>0&&cursor<path.length){
      const p=path[cursor],x=p.x-position.x,y=p.y-position.y,z=p.z-position.z,d=Math.hypot(x,y,z);
      // One update may cross multiple small chords: validate each direction,
      // including the first chord after a waypoint, before consuming distance.
      const endpointIndoors=Number.isFinite(heightLimit(p));
      if((!outdoors||endpointIndoors)&&Math.hypot(x,z)>1e-6&&Math.abs(difference(Math.atan2(-x,-z),state.heading))>35*radians){speed=0;state.turning=true;break;}
      const t=d?Math.min(1,travel/d):1;candidate.x=position.x+x*t;candidate.y=position.y+y*t;candidate.z=position.z+z*t;
      candidate.y=Math.min(candidate.y,heightLimit(candidate));
      if(!collision.clear(position,candidate,{doors:'ignore',padding:.06})){recover(position);return true;}
      if(physics.doors.some(door=>{
        if(collision.doorHits(position,candidate,door,door.angle,.14))return true;
        if(Math.abs(door.target-door.angle)<.01)return false;
        const n=Math.ceil(Math.abs(door.target-door.angle)/.08);
        for(let i=1;i<=n;i++)if(collision.doorHits(position,candidate,door,door.angle+(door.target-door.angle)*i/n,.23))return true;
        return false;
      })){speed=0;state.doorWait=true;return true;}
      position.x=candidate.x;position.y=candidate.y;position.z=candidate.z;remember(position);
      if(d<=travel){travel-=d;cursor++;}else travel=0;
    }
    return true;
  }
  return {state,start,action,stop,update,recover,heightLimit,validHead:(from,to)=>collision?.clear(from,to,{doors:'live',padding:.06})??true,get safePosition(){return lastSafe;},get points(){return navigation?.points||[];}};
}
