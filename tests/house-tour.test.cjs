const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),html=read('Casas3D.html');
const context=vm.createContext({console,AbortController,performance,URL});
vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+['walk-layout.js','walk-physics.js','tour-config.js','house-tour.js'].map(read).join('\n')+';globalThis.T={xx,Box3:si,createHousePhysics,buildHouseTour,createHouseTour,config:CASA_TOUR_CONFIG};',context);
const T=context.T;
test('canceling route preparation ignores late worker results and releases the planner',async()=>{
 let resolve,disposed=0;const physics={},tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>({}),getModel:()=> '50',plannerFactory:()=>({build:()=>new Promise(r=>resolve=r),dispose(){disposed++;}})});
 tour.start({x:0,z:0});assert.equal(tour.state.phase,'planning');tour.stop();resolve({points:[],legs:[]});await Promise.resolve();
 assert.equal(tour.state.active,false);assert.equal(tour.state.phase,'idle');assert.equal(disposed,1);
});
function fixture(model){const house=T.xx(model,{width:15,depth:30}),physics=T.createHousePhysics(house,{Box3:T.Box3}),position={...physics.spawn,y:physics.floorAt(physics.spawn.x,physics.spawn.z)+physics.eyeHeight};
 const tour=T.createHouseTour({getPhysics:()=>physics,getPlan:()=>house.userData.plan,getModel:()=>model,config:{...T.config,dwell:.05,stops:T.config.stops.map(s=>({...s,dwell:.05}))}});return {house,physics,position,tour};}
test('all furnished plans complete a collision-safe automatic route and open required doors',()=>{
 for(const model of ['50','60','62','69'].filter(m=>!process.env.TOUR_MODEL||process.env.TOUR_MODEL===m)){
  const f=fixture(model),start=performance.now();f.tour.start(f.position);const prepareMs=performance.now()-start;
  assert.ok(f.tour.points.length>=5,model+' destinations '+f.tour.points.map(p=>p.label));let maxSpeed=0,iterations=0;
  while(f.tour.state.active&&iterations++<14000){const x=f.position.x,z=f.position.z;f.tour.update(f.position,.05);f.physics.update(.05,f.position);maxSpeed=Math.max(maxSpeed,Math.hypot(f.position.x-x,f.position.z-z)/.05);
   assert.equal(f.physics.blocked(f.position.x,f.position.z),false,model+' body collision');assert.equal(f.tour.state.paused,false,model+' '+JSON.stringify({state:f.tour.state,position:f.position,doors:f.physics.doors.map(d=>({x:d.hingeX,z:d.hingeZ,angle:d.angle,target:d.target,open:d.openAngle})),openBlocked:f.physics.blockedForTour(f.position.x,f.position.z)}));}
  assert.equal(f.tour.state.active,false,model+' finishes');assert.ok(maxSpeed<=.851);assert.ok(f.physics.doors.some(d=>Math.abs(d.angle)>.1));
  console.log(JSON.stringify({model,rooms:f.tour.points.map(p=>p.label),prepareMs,iterations,maxSpeed}));
 }
});
test('pause, resume, next, previous, cancel and restart retain normal physics ownership',()=>{
 const f=fixture('50');f.tour.start(f.position);f.tour.action('pause',f.position);const before={...f.position};for(let i=0;i<20;i++)f.tour.update(f.position,.05);assert.deepEqual(f.position,before);
 f.tour.action('next',f.position);assert.equal(f.tour.state.index,1);f.tour.action('previous',f.position);assert.equal(f.tour.state.index,0);
 f.tour.action('pause',f.position);f.tour.action('resume',f.position);assert.equal(f.tour.state.paused,false);f.tour.stop();assert.equal(f.tour.update(f.position,.05),false);
 f.tour.start(f.position);assert.equal(f.tour.state.active,true);f.tour.stop();
});
