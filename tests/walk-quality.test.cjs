const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'Casas3D.html'),'utf8');
const context=vm.createContext({console,AbortController,performance,URL});
vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+['walk-layout.js','walk-physics.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')+';globalThis.api={xx,si,createHousePhysics};',context);

test('each furnished plan keeps essential furniture and connects all room entrances',()=>{
  for(const options of [{},{high:true,openingHigh:true,facade:4}]) {
  for(const model of ['50','60','62','69']) {
    const house=context.api.xx(model,{width:15,depth:30},options);
    const plan=house.userData.plan,p=context.api.createHousePhysics(house,{Box3:context.api.si});
    assert.deepEqual(Array.from(house.userData.layout.omitted.filter(item=>item.essential),i=>i.item),[],model+' essential furnishings');
    for(const d of p.doors){d.angle=d.target=d.openAngle;d.apply(d.angle);}
    const step=0.1, minX=-plan.w/2-0.2,minZ=-plan.d/2-0.5;
    const nx=Math.ceil((plan.w+0.5)/step),nz=Math.ceil((plan.d+1.5)/step);
    const cache=new Int8Array(nx*nz),visited=new Uint8Array(nx*nz);
    const point=id=>({x:minX+(id%nx)*step,z:minZ+Math.floor(id/nx)*step});
    const idAt=(x,z)=>Math.round((z-minZ)/step)*nx+Math.round((x-minX)/step);
    function clear(id){if(id<0||id>=cache.length)return false;if(cache[id])return cache[id]===1;const {x,z}=point(id);const ok=p.floorAt(x,z)>0.35&&!p.blocked(x,z);cache[id]=ok?1:-1;return ok;}
    const entry=p.doors.find(d=>d.outer&&d.names.some(n=>/^Sala/.test(n)));
    const start=idAt(entry.hingeX+entry.width/2,entry.hingeZ-0.4);
    assert.ok(clear(start),model+' entry approach free');
    const queue=[start];visited[start]=1;
    for(let q=0;q<queue.length;q++){
      const id=queue[q];
      for(const next of [id-1,id+1,id-nx,id+nx])if(next>=0&&next<cache.length&&!visited[next]&&clear(next)){visited[next]=1;queue.push(next);}
    }
    for(const [name,x,z,w,d] of plan.rooms){
      const count=queue.filter(id=>{const v=point(id),px=v.x+plan.w/2,pz=plan.d/2-v.z;return px>x+0.25&&px<x+w-0.25&&pz>z+0.25&&pz<z+d-0.25;}).length;
      assert.ok(count>=6,model+' reachable '+name+' ('+count+' grid points)');
    }
    for(const door of p.doors.filter(d=>!d.outer)) {
      const cx=door.axis==='x'?door.hingeX+door.width/2:door.hingeX;
      const cz=door.axis==='z'?door.hingeZ-door.width/2:door.hingeZ;
      for(const side of [-1,1]) {
        const tx=cx+(door.axis==='z'?side*0.4:0),tz=cz+(door.axis==='x'?side*0.4:0);
        const found=queue.some(id=>{const v=point(id);return Math.hypot(v.x-tx,v.z-tz)<0.22;});
        assert.ok(found,model+' clear approach '+door.names.join('/')+' side '+side);
      }
    }
  }
  }
});

test('walking uses the same lighting path when moving, idle, or editing',()=>{
  const start=html.indexOf('function zx(i){'),end=html.indexOf('Gn();window.casaDebug',start);
  assert.ok(start>=0&&end>start);
  const renders=[],scene={},overlay={},camera={};
  let moving=false;
  const frameContext=vm.createContext({
    Br:0,document:{hidden:false},questMode:null,Io:0,yi:false,fs:false,Xe:0,Vn:false,Un:1,Zn:true,hn:100,Be:100,De:null,
    dc(){},walkMode:{active:true,update:()=>moving},xe:{update:()=>false},Bx:true,Eo:'current',gs:'current',ue:{visible:false},bn:{visible:true},$i:true,
    Tn:scene,qs:overlay,Je:camera,
    ee:{shadowMap:{needsUpdate:false},info:{reset(){},render:{calls:1,triangles:1}},render(s){if(s===scene)renders.push('direct');}},
    Ti:{render(){renders.push('postprocessed');}},Sd:'',Hs:0,Md:{},Gn(){}
  });
  vm.runInContext(html.slice(start,end)+';globalThis.renderFrame=zx',frameContext);
  for(const state of [true,false,true,false,false]) {
    moving=state;frameContext.$i=true;frameContext.renderFrame(frameContext.Io+16);
  }
  assert.deepEqual(renders,['direct','direct','direct','direct','direct']);
  frameContext.walkMode.active=false;frameContext.$i=true;frameContext.renderFrame(frameContext.Io+16);
  assert.equal(renders.at(-1),'postprocessed','overview still gets its finishing effects');
});
