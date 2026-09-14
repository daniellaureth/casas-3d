const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),VM=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'Casas3D.html'),'utf8'),ctx=VM.createContext({console,AbortController,performance,URL});
VM.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+fs.readFileSync(path.join(root,'quest-hand-walk.js'),'utf8')+fs.readFileSync(path.join(root,'walk-physics.js'),'utf8')+';globalThis.api={Group:Ce,Vector3:q,createQuestHandWalk,createWalkPhysics};',ctx);
const T=ctx.api,makeHand=require('./hand-fixture.cjs');
function fixture(){const hand=makeHand(T,{forward:true}),walk=T.createQuestHandWalk(T),head=new T.Vector3(0,1.65,0);return {hand,walk,head,tick:extra=>walk.update({hands:[hand],head,delta:.05,...extra})};}
test('pointing walks continuously along the hand after a deliberate hold, not instantly',()=>{
  const f=fixture();for(let i=0;i<5;i++)assert.equal(f.tick().active,false);
  let move;for(let i=0;i<10;i++)move=f.tick();assert.ok(move.active);assert.ok(move.z<-.9);assert.ok(Math.abs(move.x)<.01);
  const p=T.createWalkPhysics({boxes:[{minX:-1,maxX:1,minZ:-.8,maxZ:-.7,bottom:0,top:3}]});
  const body={x:0,y:1.65,z:0};for(let i=0;i<100;i++)p.move(body,move.x*.05,move.z*.05,.05);assert.ok(body.z>-.51,'hand movement obeys collision');
});
test('pinching, tracking loss, UI targeting and retracting the hand stop immediately',()=>{
  for(const action of ['pinch','lost','ui','retract','curl']) {
    const f=fixture();for(let i=0;i<15;i++)f.tick();assert.equal(f.walk.active,true);
    if(action==='pinch')f.hand.joints['thumb-tip'].position.copy(f.hand.joints['index-finger-tip'].position);
    if(action==='lost')f.hand.visible=false;if(action==='retract')f.hand.position.z=-.1;
    if(action==='curl')f.hand.joints['index-finger-tip'].position.copy(f.hand.joints['index-finger-phalanx-proximal'].position);
    const motion=f.tick({blocked:action==='ui'});assert.equal(motion.active,false,action);assert.equal(motion.z,0,action);
  }
});
test('vertical pointing does not walk and visual amplitude does not change the gesture reach',()=>{
  const f=fixture();f.hand.rotation.x=0;for(let i=0;i<15;i++)assert.equal(f.tick().active,false);
  f.hand.rotation.x=-Math.PI/2;const rig=new T.Group();rig.scale.setScalar(.5);rig.add(f.hand);f.head.multiplyScalar(.5);
  let motion;for(let i=0;i<15;i++)motion=f.tick({scale:.5});assert.equal(motion.active,true);
});
