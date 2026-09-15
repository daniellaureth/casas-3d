const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),html=read('Casas3D.html');
const T=new Function(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+['walk-layout.js','walk-physics.js','tour-config.js','house-tour.js'].map(read).join('\n')+';return {xx,Box3:si,createWalkPhysics,createHousePhysics,buildHouseTour,createHouseTour,createTourCollision,config:CASA_TOUR_CONFIG};')();
test('canceling route preparation ignores late worker results and releases the planner',async()=>{
 let resolve,disposed=0;const physics={},tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>({}),getModel:()=> '50',plannerFactory:()=>({build:()=>new Promise(r=>resolve=r),dispose(){disposed++;}})});
 tour.start({x:0,z:0});assert.equal(tour.state.phase,'planning');tour.stop();resolve({points:[],legs:[]});await Promise.resolve();
 assert.equal(tour.state.active,false);assert.equal(tour.state.phase,'idle');assert.equal(disposed,1);
});
function fixture(model){const house=T.xx(model,{width:15,depth:30}),physics=T.createHousePhysics(house,{Box3:T.Box3}),position={...physics.spawn,y:physics.floorAt(physics.spawn.x,physics.spawn.z)+physics.eyeHeight};
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>house.userData.plan,getModel:()=>model,config:{...T.config,dwell:.05,stops:T.config.stops.map(s=>({...s,dwell:.05}))}});return {house,physics,position,tour};}

test('compact lots complete the outdoor orbit above lower roofs without applying the indoor height cap',()=>{
 for(const model of ['50','60','62','69']){
  const house=T.xx(model,{width:model==='62'?12.1:12,depth:21},{facade:0,high:true}),physics=T.createHousePhysics(house,{Box3:T.Box3});
  const position={...physics.spawn,y:physics.floorAt(physics.spawn.x,physics.spawn.z)+1.7};
  const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>house.userData.plan,getModel:()=>model});
  tour.start(position);let visitedOutside=false;
  const plan=house.userData.plan,site=physics.site;
  for(const stop of tour.points.filter(p=>['aerial-side','aerial-back'].includes(p.id))){
   const dx=stop.focus.x-stop.x,dy=stop.focus.y-stop.y,dz=stop.focus.z-stop.z,flat=Math.hypot(dx,dz),length=Math.hypot(flat,dy);
   assert.ok(stop.y>physics.roofTop+5,'overview rises above the roofs to reveal the entire lot');
   for(const x of [site.x0-plan.w/2,site.x1-plan.w/2])for(const z of [plan.d/2-site.z0,plan.d/2-site.z1]){
    const vx=x-stop.x,vy=.45-stop.y,vz=z-stop.z;
    const depth=(vx*dx+vy*dy+vz*dz)/length,right=(vx*-dz+vz*dx)/flat,up=(-vx*dx*dy+vy*flat*flat-vz*dz*dy)/(length*flat);
    assert.ok(depth>0&&Math.abs(Math.atan2(up,depth))<32.5*Math.PI/180&&Math.abs(Math.atan2(right,depth))<32.5*Math.PI/180,model+' lot corners fit a 65 degree view');
   }
  }
  for(let frame=0;frame<8000&&tour.state.active;frame++){
   tour.update(position,.05);physics.update(.05,null);
   assert.equal(tour.state.paused,false,model+' '+JSON.stringify(tour.state));
   assert.equal(tour.state.recoveries,0,model+' must keep a safe route');
   if(tour.state.kind==='aerial'&&position.y>T.config.exteriorHeight-.05){visitedOutside=true;assert.equal(tour.heightLimit(position),Infinity,'the external orbit remains outdoors');}
  }
  assert.ok(visitedOutside,model+' visits the lot');assert.equal(tour.state.active,false,model+' completes the return');
 }
});

test('69 m² starts near entrance obstacles instead of repeatedly reporting an unavailable route',()=>{
 const house=T.xx('69',{width:12,depth:21}),physics=T.createHousePhysics(house,{Box3:T.Box3});
 const position={x:physics.spawn.x+1,y:1.7,z:physics.spawn.z-1};
 assert.equal(physics.headBlocked(position.x,position.z,position.y),false);
 assert.equal(physics.blockedForTour(position.x,position.z,true,1.95),true,'head is clear but walking-body margin is blocked');
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>house.userData.plan,getModel:()=> '69'});
 tour.start(position);assert.equal(tour.state.paused,false,JSON.stringify(tour.state));
 for(let i=0;i<2000&&tour.state.index<2;i++){tour.update(position,.05);physics.update(.05,null);assert.equal(physics.headBlocked(position.x,position.z,position.y),false);assert.equal(tour.state.paused,false);}
 assert.ok(tour.state.index>=2,'automatically reaches the living room and continues to the kitchen');tour.stop();
});

test('street-side start crosses above the closed lot boundary and continues through rooms on every plan',()=>{
 for(const model of ['50','60','62','69']){
  const house=T.xx(model,{width:model==='62'?15:12,depth:21}),physics=T.createHousePhysics(house,{Box3:T.Box3}),plan=house.userData.plan,site=physics.site;
  const position={x:(site.x0+site.x1)/2-plan.w/2,z:plan.d/2-site.z0+3,y:1.7};
  const nav=T.buildHouseTour({physics,plan,model,position});
  for(const target of nav.points.slice(0,2)){
   const path=nav.route(position,target);assert.ok(path,model+' street → '+target.label);
   for(let i=1;i<path.length;i++)assert.ok(nav.flightClear(path[i-1],path[i]),model+' arrival crosses architecture');
   assert.ok(path.every(p=>p.y>=1.65),'arrival stays above ground; segment checks validate the actual boundary height');
  }
  const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>plan,getModel:()=>model});tour.start(position);
  assert.equal(tour.state.paused,false,model+' '+JSON.stringify(tour.state));
  let moved=0;
  for(let i=0;i<4000&&tour.state.index<2;i++){
   const previous={...position};tour.update(position,.05);physics.update(.05,null);
   const step=Math.hypot(position.x-previous.x,position.y-previous.y,position.z-previous.z);moved+=step;
   assert.ok(step<=.096,'continuous flight without teleportation');assert.equal(tour.state.fade,0);assert.equal(tour.state.paused,false);
   assert.equal(physics.headBlocked(position.x,position.z,position.y),false,model+' arrival hits wall');
  }
  assert.ok(tour.state.index>=2,model+' must visit entry and living room then continue to kitchen');assert.ok(moved>5);tour.stop();
 }
});

test('raised tracked eyes inside every house descend smoothly before doorways instead of routing through the roof',()=>{
 for(const model of ['50','60','62','69']){
  const f=fixture(model),nav=T.buildHouseTour({physics:f.physics,plan:f.house.userData.plan,model,position:f.position});
  for(const point of nav.points.filter(p=>p.roomName)){
   const from=[0,.1,-.1].map(dx=>({x:point.x+dx,z:point.z,y:f.physics.floorAt(point.x+dx,point.z)+2.3})).find(p=>nav.flightClear(p,p,.025));
   assert.ok(from,model+' '+point.label+' has a raised viewpoint clear of lintels');
   const path=nav.route(from,nav.points[0]);
   assert.ok(path,model+' '+point.label+' must connect a raised headset to the entrance');
   for(let i=1;i<path.length;i++)assert.ok(nav.flightClear(path[i-1],path[i],.025),model+' '+point.label+' crosses architecture');
  }
 }
});

test('Continue after a failed initial preparation recreates the planner and actually leaves the entrance',async()=>{
 const f=fixture('50');let attempts=0,disposed=0;
 const tour=T.createHouseTour({getPhysics:()=>f.physics,getPlan:()=>f.house.userData.plan,getModel:()=> '50',plannerFactory:()=>({
  build(data){if(++attempts===1)return Promise.reject(Error('Falha ao preparar o percurso.'));const nav=T.buildHouseTour(data),index=data.startIndex??0;return Promise.resolve({points:nav.points,legs:nav.legs,index,path:nav.route(data.position,nav.points[index])});},dispose(){disposed++;}
 })});
 tour.start(f.position);await new Promise(setImmediate);assert.equal(tour.state.paused,true);
 const before={...f.position};tour.action('resume',f.position);await new Promise(setImmediate);
 for(let i=0;i<900&&tour.state.index<1;i++){tour.update(f.position,.05);f.physics.update(.05,null);}
 assert.equal(attempts,2,'Continue must request a new route, not just clear the paused flag');assert.ok(disposed>=1,'failed planner is disposed');assert.equal(tour.state.paused,false);assert.ok(tour.state.index>=1,'tour must leave the entrance');assert.ok(Math.hypot(f.position.x-before.x,f.position.y-before.y,f.position.z-before.z)>.1);tour.stop();
});

test('Continue recalculates an unavailable route and retains its destination',()=>{
 const barrier={minX:-.1,maxX:.1,minZ:-20,maxZ:20,bottom:0,top:3};
 const physics=Object.assign(T.createWalkPhysics({boxes:[barrier]}),{spawn:{x:-1,z:0}}),position={x:-1,y:1.65,z:0};
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>({w:4,d:4,rooms:[['Sala',2,1,2,2]]}),getModel:()=> 'test',config:{...T.config,dwell:.01,stops:[{id:'entry',kind:'entry'},{id:'room',room:'Sala'}]}});
 tour.start(position);for(let i=0;i<1000&&!tour.state.paused;i++)tour.update(position,.05);assert.equal(tour.state.paused,true);assert.equal(tour.state.index,1);
 physics.boxes.length=0;tour.action('resume',position);let reached=false;
 for(let i=0;i<2000&&tour.state.active;i++){tour.update(position,.05);if(tour.state.index===1&&tour.state.phase==='dwell')reached=true;}
 assert.ok(reached,'Continue must recover the route and physically reach the selected room');assert.equal(tour.state.active,false);
});
test('all furnished plans visit every room and the actual lot, without visible wall crossings',()=>{
 for(const model of ['50','60','62','69'].filter(m=>!process.env.TOUR_MODEL||process.env.TOUR_MODEL===m)){
  const f=fixture(model),start=performance.now();f.tour.start(f.position);const prepareMs=performance.now()-start;
  assert.ok(f.tour.points.length>=5,model+' destinations '+f.tour.points.map(p=>p.label));let maxSpeed=0,iterations=0;
  const visited=new Set();let previousHeading=f.tour.state.heading;
  while(f.tour.state.active&&iterations++<14000){const x=f.position.x,y=f.position.y,z=f.position.z;f.tour.update(f.position,.05);f.physics.update(.05,null);
   if(f.tour.state.phase==='dwell'){
    visited.add(f.tour.state.index);const p=f.tour.points[f.tour.state.index];
    assert.ok(Math.abs(Math.atan2(Math.sin(f.tour.state.heading-p.heading),Math.cos(f.tour.state.heading-p.heading)))<1e-4,'subject is ahead at every stop');
   }
   if(f.tour.state.active&&f.tour.state.fade<1)assert.ok(Math.abs(Math.atan2(Math.sin(f.tour.state.heading-previousHeading),Math.cos(f.tour.state.heading-previousHeading)))<=T.config.turnSpeed*Math.PI/180*.05+1e-7,'visible yaw is slow');
   previousHeading=f.tour.state.heading;
   const moved=Math.hypot(f.position.x-x,f.position.y-y,f.position.z-z);
   if(f.tour.state.fade<1){maxSpeed=Math.max(maxSpeed,moved/.05);assert.equal(f.physics.headBlocked(f.position.x,f.position.z,f.position.y),false,model+' visible camera in a wall at '+JSON.stringify({state:f.tour.state,position:f.position}));}
   assert.equal(f.tour.state.fade,0,'continuous flight never blacks out');assert.ok(moved<=.096,'no jumps between viewpoints');
   assert.equal(f.tour.state.paused,false,model+' '+JSON.stringify(f.tour.state));}
  assert.equal(f.tour.state.active,false,model+' finishes');assert.ok(maxSpeed<=1.901);assert.ok(f.physics.doors.every(d=>Math.abs(d.target)<.01),'doors close after the tour');
  assert.equal(visited.size,f.tour.points.length,'every viewpoint was actually visited');
  for(const room of f.house.userData.plan.rooms.filter(r=>!/^Circulação$/.test(r[0]))){const stop=T.config.stops.find(s=>s.room&&new RegExp(s.room,'i').test(room[0]));assert.ok(stop,'configured '+room[0]);assert.ok(f.tour.points.some(p=>p.id===stop.id),'visited '+room[0]);}
  assert.equal(f.tour.points.filter(p=>p.kind==='aerial').length,3);
  assert.equal(f.physics.blocked(f.position.x,f.position.z),false,'safe walking position after landing');
  console.log(JSON.stringify({model,rooms:f.tour.points.map(p=>p.label),prepareMs,iterations,maxSpeed}));
 }
});

test('tour reports a disconnected room without a blackout, wall crossing or omitted destination',()=>{
 const boxes=[{minX:-.1,maxX:.1,minZ:-20,maxZ:20,bottom:0,top:3},{minX:1.4,maxX:1.6,minZ:-1,maxZ:1,bottom:0,top:1.2,kind:'furniture'}];
 const physics=Object.assign(T.createWalkPhysics({boxes}),{spawn:{x:-1,z:0}}),position={x:-1,y:1.65,z:0};
 const config={...T.config,dwell:0,stops:[{id:'entry',kind:'entry'},{id:'room',room:'Sala'}]};
 const plan={w:4,d:4,rooms:[['Sala',2,1,2,2]]};
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>plan,getModel:()=> 'test',config});tour.start(position);
 assert.equal(tour.points.length,2);assert.equal(physics.blocked(tour.points[1].x,tour.points[1].z),false,'destination itself is safe; the separating wall blocks its route');
 for(let i=0;i<3000&&tour.state.active;i++){tour.update(position,.05);if(tour.state.fade<1)assert.equal(physics.headBlocked(position.x,position.z,position.y),false);}
 assert.equal(tour.state.phase,'unavailable');assert.equal(tour.state.paused,true);assert.equal(tour.state.fade,0);assert.match(tour.state.message,/passagem livre/);tour.stop();assert.equal(physics.blocked(position.x,position.z),false,'cancel/end restores walking clearance');
});

test('canceling an aerial segment restores ground height and a clear walking position',()=>{
 const f=fixture('69');f.tour.start(f.position);
 for(let i=0;i<f.tour.points.findIndex(p=>p.kind==='aerial');i++)f.tour.action('next',f.position);
 for(let i=0;i<7000&&f.tour.state.phase!=='dwell';i++)f.tour.update(f.position,.05);
 assert.ok(f.position.y>=f.tour.points[f.tour.state.index].y-.01);f.tour.stop();
 assert.equal(f.position.y,f.physics.floorAt(f.position.x,f.position.z)+f.physics.eyeHeight);assert.equal(f.physics.blocked(f.position.x,f.position.z),false);
});

test('all facades and garage choices keep complete room itineraries on every plan',()=>{
 let cases=0;
 for(const model of ['50','60','62','69'])for(let facade=0;facade<5;facade++)for(const garage of [false,true])for(const high of [false,true]){
  const house=T.xx(model,{width:15,depth:30},{facade,garage,high}),physics=T.createHousePhysics(house,{Box3:T.Box3});
  const position={...physics.spawn,y:physics.floorAt(physics.spawn.x,physics.spawn.z)+physics.eyeHeight};
  // Serialize exactly as the worker does: enabled predicates and mesh callbacks
  // cannot be transferred, but lot bounds, altitude and furniture tags must survive.
  const clone=Object.assign(T.createWalkPhysics({boxes:physics.boxes.filter(b=>!b.enabled||b.enabled()).map(({enabled,...b})=>b),floors:physics.floors,doors:physics.doors.map(({apply,...d})=>({...d,angle:d.openAngle}))}),{spawn:physics.spawn,site:physics.site,tourAltitude:physics.tourAltitude,roofTop:physics.roofTop,flightBoxes:physics.flightBoxes});
  const collision=T.createTourCollision(clone);const nav=T.buildHouseTour({physics:clone,plan:house.userData.plan,model,position});
  const expected=T.config.stops.filter(s=>!s.room||house.userData.plan.rooms.some(r=>new RegExp(s.room,'i').test(r[0])));
  assert.equal(nav.points.length,expected.length,JSON.stringify({model,facade,garage,high}));
  const street={x:(physics.site.x0+physics.site.x1)/2-house.userData.plan.w/2,z:house.userData.plan.d/2-physics.site.z0+3,y:1.7};
  for(const target of nav.points.slice(0,2)){
   const arrival=nav.route(street,target);assert.ok(arrival,'street arrival '+JSON.stringify({model,facade,garage,high,target:target.id}));
   for(let i=1;i<arrival.length;i++)assert.ok(nav.flightClear(arrival[i-1],arrival[i]),'street flight clears walls and roofs');
  }
  for(let i=0;i<nav.legs.length;i++){
   const leg=nav.legs[i];assert.ok(leg,'continuous connection '+JSON.stringify({model,facade,garage,high,from:nav.points[i].id,to:nav.points[i+1].id}));
   for(let j=1;j<leg.length;j++){
    const a=leg[j-1],b=leg[j],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/.05);
    assert.ok(collision.clear(a,b,{doors:'ignore',padding:.06}),'camera volume clears furniture and architecture '+JSON.stringify({model,facade,garage,high,from:nav.points[i].id,to:nav.points[i+1].id}));
    if(nav.points[i].kind==='aerial'||nav.points[i+1].kind==='aerial')assert.ok(nav.flightClear(a,b),'outdoor flight clears roofs');
   }
  }
  for(const p of nav.points)assert.ok(collision.point(p,'ignore'),p.label+' is outside walls and furniture');
  for(const p of nav.points.filter(p=>p.kind==='aerial')){
   assert.ok(p.y>=4&&p.y<=Math.max(10,physics.site.z1-physics.site.z0),'overview height scales with the lot');
   const x=p.x+house.userData.plan.w/2,z=house.userData.plan.d/2-p.z;
   const setback=T.config.exteriorSetback;
   assert.ok(x>=physics.site.x0-setback&&x<=physics.site.x1+setback&&z>=physics.site.z0-setback&&z<=physics.site.z1+setback,'drone keeps a bounded setback to frame the lot');
  }
  for(const p of nav.points.filter(p=>p.roomName))assert.ok(p.y-clone.floorAt(p.x,p.z)<=1.75+1e-7,'indoor viewpoint is capped at 1.75 m');
  cases++;
 }
 console.log('Validated facade/garage/ceiling combinations:',cases);
});
test('pause, resume, next, previous, cancel and restart retain normal physics ownership',()=>{
 const f=fixture('50');f.tour.start(f.position);f.tour.action('pause',f.position);const before={...f.position};for(let i=0;i<20;i++)f.tour.update(f.position,.05);assert.deepEqual(f.position,before);
 f.tour.action('next',f.position);assert.equal(f.tour.state.index,1);f.tour.action('previous',f.position);assert.equal(f.tour.state.index,0);
 f.tour.action('pause',f.position);f.tour.action('resume',f.position);assert.equal(f.tour.state.paused,false);f.tour.stop();assert.equal(f.tour.update(f.position,.05),false);
 f.tour.start(f.position);assert.equal(f.tour.state.active,true);f.tour.stop();
});


test('continuous tour closes doors, visits every room once and never stops to present a corridor',()=>{
 for(const model of ['50','60','62','69']){
  const f=fixture(model),tour=T.createHouseTour({getPhysics:()=>f.physics,getPlan:()=>f.house.userData.plan,getModel:()=>model});
  const collision=T.createTourCollision(f.physics);tour.start(f.position);let steps=0,opened=0,closed=0,still=0,maxStill=0;
  const visited=new Set(),angles=f.physics.doors.map(()=>0),initialCounts=[f.physics.boxes.length,f.physics.doors.length];
  let previousYaw=tour.state.heading,previousYawVelocity=0,previousVelocity=null,turnFrames=0;
  while(tour.state.active&&steps++<8000){const before={...f.position};tour.update(f.position,.05);f.physics.update(.05,f.position);
   assert.equal(tour.state.paused,false,model+' '+JSON.stringify(tour.state));assert.notEqual(tour.state.phase,'dwell');assert.notEqual(tour.state.phase,'settle');
   assert.ok(collision.clear(before,f.position,{doors:'live',padding:.06}),model+' live camera segment stays clear');
   assert.equal(tour.state.fade,0);visited.add(tour.state.index);
   if(tour.state.active){
    const yawVelocity=Math.atan2(Math.sin(tour.state.heading-previousYaw),Math.cos(tour.state.heading-previousYaw))/.05;
    assert.ok(Math.abs(yawVelocity)<=T.config.turnSpeed*Math.PI/180+1e-7,'bounded gimbal speed');
    assert.ok(Math.abs(yawVelocity-previousYawVelocity)/.05<=T.config.turnAcceleration*Math.PI/180+1e-7,model+' no angular impulse, including room changes');
    previousYaw=tour.state.heading;previousYawVelocity=yawVelocity;
    const v={x:(f.position.x-before.x)/.05,y:(f.position.y-before.y)/.05,z:(f.position.z-before.z)/.05};v.speed=Math.hypot(v.x,v.y,v.z);
    if(previousVelocity&&v.speed>.5&&previousVelocity.speed>.5){const dot=(v.x*previousVelocity.x+v.y*previousVelocity.y+v.z*previousVelocity.z)/(v.speed*previousVelocity.speed);assert.ok(Math.acos(Math.max(-1,Math.min(1,dot)))<Math.PI/4,model+' no fast right-angle bounce');}
    previousVelocity=v;
    const horizontal=Math.hypot(v.x,v.z);
    if(horizontal>1e-5&&Number.isFinite(tour.heightLimit(before)))assert.ok((-Math.sin(tour.state.heading)*v.x-Math.cos(tour.state.heading)*v.z)/horizontal>=Math.cos(36*Math.PI/180),model+' always moves facing the actual path inside the house, including return');
    if(horizontal>1e-5&&tour.state.travelMode==='showcase'){
      const focus=tour.state.kind==='aerial'?tour.state.focus:tour.points.find(p=>p.kind==='aerial').focus,bearing=Math.atan2(f.position.x-focus.x,f.position.z-focus.z);
      assert.ok(Math.abs(Math.atan2(Math.sin(bearing-tour.state.heading),Math.cos(bearing-tour.state.heading)))<36*Math.PI/180,model+' external flight keeps the house within the forward view '+JSON.stringify({before,position:f.position,heading:tour.state.heading,bearing,state:tour.state}));
    }
    assert.ok(f.position.y<=tour.heightLimit(f.position)+1e-7,model+' indoor eye never exceeds 1.75 m above its floor');
    // A frame can reach a bend and engage the turn latch after its last forward
    // chord. Count the subsequent stationary rotation, not that partial frame.
    if(tour.state.turning&&Math.abs(yawVelocity)>.001&&horizontal<1e-5)turnFrames++;
   }
   still=!tour.state.turning&&Math.hypot(f.position.x-before.x,f.position.y-before.y,f.position.z-before.z)<1e-7?still+1:0;maxStill=Math.max(maxStill,still);
   f.physics.doors.forEach((d,i)=>{if(!angles[i]&&Math.abs(d.angle)>.01)opened++;if(angles[i]&&Math.abs(d.angle)<.01)closed++;angles[i]=Math.abs(d.angle)>.01;});
  }
  assert.equal(tour.state.active,false,model+' finishes');assert.equal(visited.size,tour.points.length);assert.ok(opened>0&&closed>0);assert.ok(maxStill<25,'door waits stay below 1.25 seconds');
  assert.equal(tour.points.filter(p=>/circula/i.test(p.label)).length,0);assert.equal(new Set(tour.points.map(p=>p.id)).size,tour.points.length);
  assert.deepEqual([f.physics.boxes.length,f.physics.doors.length],initialCounts);assert.ok(f.physics.doors.every(d=>d.target===0));
  assert.ok(turnFrames>0,model+' reversals are handled by a smooth turn instead of reversing the camera');
 }
});

test('invalid camera coordinates recover to the last safe tour position before moving again',()=>{
 const f=fixture('62');f.tour.start(f.position);for(let i=0;i<80;i++){f.tour.update(f.position,.05);f.physics.update(.05,f.position);}
 const safe={...f.tour.safePosition};f.position.y=-4;f.tour.update(f.position,.05);assert.deepEqual(f.position,safe);assert.equal(f.tour.state.recoveries,1);assert.equal(f.tour.state.fade,0);
 f.position.x=NaN;f.tour.update(f.position,.05);assert.ok(Object.values(f.position).every(Number.isFinite));assert.equal(f.tour.state.recoveries,2);f.tour.stop();
});

test('door hinge adjustment preserves the closed leaf and is stable across physics rebuilds',()=>{
 for(const model of ['50','60','62','69']){const house=T.xx(model,{width:15,depth:30}),p=T.createHousePhysics(house,{Box3:T.Box3});
  const before=p.doors.map(d=>({...p.doorBox(d,0),openAngle:d.openAngle}));const again=T.createHousePhysics(house,{Box3:T.Box3});
  assert.deepEqual(again.doors.map(d=>({...again.doorBox(d,0),openAngle:d.openAngle})),before);assert.deepEqual(again.floors,p.floors,'hinge fitting must not move the entrance floor on rebuild');
 }
});
