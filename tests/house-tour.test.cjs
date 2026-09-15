const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),html=read('Casas3D.html');
const T=new Function(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+['walk-layout.js','walk-physics.js','tour-config.js','house-tour.js'].map(read).join('\n')+';return {xx,Box3:si,createWalkPhysics,createHousePhysics,buildHouseTour,createHouseTour,config:CASA_TOUR_CONFIG};')();
test('canceling route preparation ignores late worker results and releases the planner',async()=>{
 let resolve,disposed=0;const physics={},tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>({}),getModel:()=> '50',plannerFactory:()=>({build:()=>new Promise(r=>resolve=r),dispose(){disposed++;}})});
 tour.start({x:0,z:0});assert.equal(tour.state.phase,'planning');tour.stop();resolve({points:[],legs:[]});await Promise.resolve();
 assert.equal(tour.state.active,false);assert.equal(tour.state.phase,'idle');assert.equal(disposed,1);
});
function fixture(model){const house=T.xx(model,{width:15,depth:30}),physics=T.createHousePhysics(house,{Box3:T.Box3}),position={...physics.spawn,y:physics.floorAt(physics.spawn.x,physics.spawn.z)+physics.eyeHeight};
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>house.userData.plan,getModel:()=>model,config:{...T.config,dwell:.05,stops:T.config.stops.map(s=>({...s,dwell:.05}))}});return {house,physics,position,tour};}

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
   assert.ok(Math.max(...path.map(p=>p.y))>physics.roofTop,'arrival flies above closed boundaries');
  }
  const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>plan,getModel:()=>model});tour.start(position);
  assert.equal(tour.state.paused,false,model+' '+JSON.stringify(tour.state));
  let moved=0;
  for(let i=0;i<4000&&tour.state.index<2;i++){
   const previous={...position};tour.update(position,.05);physics.update(.05,null);
   const step=Math.hypot(position.x-previous.x,position.y-previous.y,position.z-previous.z);moved+=step;
   assert.ok(step<=.041,'continuous flight without teleportation');assert.equal(tour.state.fade,0);assert.equal(tour.state.paused,false);
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
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>({w:4,d:4,rooms:[['Sala',2,1,2,2]]}),getModel:()=> 'test',config:{...T.config,dwell:0,stops:[{id:'entry',kind:'entry'},{id:'room',room:'Sala'}]}});
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
   assert.equal(f.tour.state.fade,0,'continuous flight never blacks out');assert.ok(moved<=.041,'no jumps between viewpoints');
   assert.equal(f.tour.state.paused,false,model+' '+JSON.stringify(f.tour.state));}
  assert.equal(f.tour.state.active,false,model+' finishes');assert.ok(maxSpeed<=.851);assert.ok(f.physics.doors.some(d=>Math.abs(d.angle)>.1));
  assert.equal(visited.size,f.tour.points.length,'every viewpoint was actually visited');
  for(const room of f.house.userData.plan.rooms){const stop=T.config.stops.find(s=>s.room&&new RegExp(s.room,'i').test(room[0]));assert.ok(stop,'configured '+room[0]);assert.ok(f.tour.points.some(p=>p.id===stop.id),'visited '+room[0]);}
  assert.equal(f.tour.points.filter(p=>p.kind==='aerial').length,3);
  assert.equal(f.physics.blocked(f.position.x,f.position.z),false,'safe walking position after landing');
  console.log(JSON.stringify({model,rooms:f.tour.points.map(p=>p.label),prepareMs,iterations,maxSpeed}));
 }
});

test('tour reports a disconnected room without a blackout, wall crossing or omitted destination',()=>{
 const boxes=[{minX:-.1,maxX:.1,minZ:-20,maxZ:20,bottom:0,top:3},{minX:.4,maxX:1.6,minZ:-1,maxZ:1,bottom:0,top:1.2,kind:'furniture'}];
 const physics=Object.assign(T.createWalkPhysics({boxes}),{spawn:{x:-1,z:0}}),position={x:-1,y:1.65,z:0};
 const config={...T.config,dwell:0,stops:[{id:'entry',kind:'entry'},{id:'room',room:'Sala'}]};
 const plan={w:4,d:4,rooms:[['Sala',2,1,2,2]]};
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>plan,getModel:()=> 'test',config});tour.start(position);
 assert.equal(tour.points.length,2);assert.equal(physics.blocked(tour.points[1].x,tour.points[1].z),true,'target would block a walking body');
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
  const nav=T.buildHouseTour({physics:clone,plan:house.userData.plan,model,position});
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
    for(let s=0;s<=steps;s++){const t=steps?s/steps:0;assert.equal(clone.headBlocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,a.y+(b.y-a.y)*t),false,'flight crosses wall '+JSON.stringify({model,facade,garage,high,from:nav.points[i].id,to:nav.points[i+1].id,a,b}));}
    if(nav.points[i].kind==='aerial'||nav.points[i+1].kind==='aerial')assert.ok(nav.flightClear(a,b),'outdoor flight clears roofs');
   }
  }
  for(const p of nav.points)assert.equal(clone.headBlocked(p.x,p.z,p.y),false,p.label+' is outside walls');
  for(const p of nav.points.filter(p=>p.kind==='aerial')){
   assert.ok(p.y>=3.8&&p.y<=4.5,'elevated oblique exterior view');
   const x=p.x+house.userData.plan.w/2,z=house.userData.plan.d/2-p.z;
   assert.ok(x<physics.site.x0||x>physics.site.x1||z<physics.site.z0||z>physics.site.z1,'orbit remains outside lot walls and roofs');
   assert.ok(Math.atan2(p.y-p.focus.y,Math.hypot(p.x-p.focus.x,p.z-p.focus.z))<Math.PI/9,'no steep downward gaze required');
  }
  for(const p of nav.points.filter(p=>p.roomName))assert.ok(p.y-clone.floorAt(p.x,p.z)>=1.94,'higher interior viewpoint');
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
