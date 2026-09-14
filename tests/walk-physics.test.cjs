const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../walk-physics.js'),'utf8');
const create = vm.runInNewContext(source + '\ncreateWalkPhysics');
const wall = {minX:-2,maxX:2,minZ:-0.08,maxZ:0.08,bottom:0,top:3};
const makeDoor = () => ({axis:'x',hingeX:-0.375,hingeZ:0,width:0.75,angle:0,target:0,openAngle:Math.PI/2});

test('thin walls block fast motion and allow sliding along the wall', () => {
  const p = create({boxes:[wall]}), pos = {x:0,y:1.65,z:1};
  p.move(pos,0,-4,0.1); assert.ok(pos.z >= 0.28-0.001);
  p.move(pos,1,-1,0.1); assert.ok(pos.x > 0.9); assert.ok(pos.z >= 0.28-0.001);
});
test('closed door blocks passage; open door allows passage through the opening', () => {
  const d = makeDoor(), p=create({doors:[d]}), pos={x:0,y:1.65,z:1};
  p.move(pos,0,-2,0.1); assert.ok(pos.z>0.2);
  assert.equal(p.interact({x:0,y:1.65,z:1},{x:0,z:-1}),true);
  for(let i=0;i<20;i++)p.update(0.1,{x:0,y:1.65,z:1});
  assert.equal(d.angle,Math.PI/2);
  p.move(pos,0,-2,0.1); assert.ok(pos.z< -1);
});
test('closing door stops before intersecting the visitor', () => {
  const d=makeDoor(); d.angle=Math.PI/2; const p=create({doors:[d]});
  for(let i=0;i<20;i++)p.update(0.1,{x:0,y:1.65,z:0});
  assert.ok(d.angle>0); assert.equal(p.hitsDoor(0,0,d),false);
});
test('a wall between visitor and door prevents interacting through it', () => {
  const p=create({boxes:[{...wall,minZ:0.45,maxZ:0.55}],doors:[makeDoor()]});
  assert.equal(p.interact({x:0,y:1.65,z:1},{x:0,z:-1}),false);
});
test('steps raise eye level and gravity returns the visitor to the ground', () => {
  const p=create({floors:[{minX:-1,maxX:1,minZ:-1,maxZ:0,top:0.13}]}),pos={x:0,y:1.65,z:0.5};
  p.move(pos,0,-0.7,0.1); assert.ok(Math.abs(pos.y-1.78)<1e-9);
  p.move(pos,0,1,0.1); for(let i=0;i<10;i++)p.move(pos,0,0,0.1);
  assert.equal(pos.y,1.65);
});

test('furniture blocks walking without blacking out the tracked head',()=>{
  const furniture={...wall,kind:'furniture',top:2.4};
  const p=create({boxes:[furniture]});
  assert.equal(p.blocked(0,0),true);
  assert.equal(p.headBlocked(0,0,1.65),false);
  assert.equal(p.headPathBlocked({x:0,y:1.65,z:1},{x:0,y:1.65,z:-1}),false);
  const walls=create({boxes:[wall]});
  assert.equal(walls.blocked(0,.15),true);
  assert.equal(walls.headBlocked(0,.15,1.65),false,'standing near a wall is not head penetration');
  assert.equal(walls.headBlocked(0,0,1.65),true);
  assert.equal(walls.headPathBlocked({x:0,y:1.65,z:1},{x:0,y:1.65,z:-1}),true,'crossing a wall stays obscured');
});

test('all real house models have solid walls, working entrances and separate door render meshes', () => {
  const html=fs.readFileSync(path.join(__dirname,'../Casas3D.html'),'utf8');
  const context=vm.createContext({console,AbortController,performance,URL});
  vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+fs.readFileSync(path.join(__dirname,'../walk-layout.js'),'utf8')+source+';globalThis.api={xx,si,Wm,Nm,createHousePhysics};',context);
  const {xx,si,Wm,Nm,createHousePhysics}=context.api;
  for(const model of ['50','60','62','69']) {
    const house=xx(model,{width:15,depth:30});
    const p=createHousePhysics(house,{Box3:si});
    assert.ok(p.boxes.length>30,model+' colliders');
    assert.ok(p.boxes.some(b=>b.kind==='furniture'),model+' furniture identified for head tracking');
    assert.ok(p.doors.length>=3,model+' doors');
    const entry=p.doors.find(d=>d.outer && d.names.some(n=>/^Sala/.test(n)));
    assert.ok(entry,model+' entrance');
    assert.equal(p.blocked(p.spawn.x,p.spawn.z),false,model+' safe spawn');
    const pos={x:p.spawn.x,y:p.floorAt(p.spawn.x,p.spawn.z)+p.eyeHeight,z:p.spawn.z};
    for(let i=0;i<60;i++)p.move(pos,0,-0.04,0.02);
    assert.ok(pos.z>entry.hingeZ+0.20,model+' closed entrance blocks');
    const interact=p.interact(pos,{x:0,z:-1});
    assert.equal(interact,true,model+' reachable door');
    for(let i=0;i<80;i++)p.update(0.02,pos);
    for(let i=0;i<45;i++)p.move(pos,0,-0.04,0.02);
    assert.ok(pos.z<entry.hingeZ-0.20,model+' can enter after opening');
    const batch=Wm(house);
    assert.equal(batch.children.filter(c=>c.userData.walkDoor).length,p.doors.length);
    p.doors[0].apply(0.6);
    const originals=[];house.traverse(m=>{if(m.userData.walkDoor)originals.push(m)});
    assert.equal(originals[0].walkProxy.rotation.y,0.6);
    Nm(batch);
  }
});
