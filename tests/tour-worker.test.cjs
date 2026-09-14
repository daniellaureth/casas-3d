const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(){
 const workers=[],timers=new Map();let timerId=0;
 class Worker{constructor(){workers.push(this);}postMessage(message){this.message=message;if(this.failPost)throw Error('Falha de envio');}terminate(){this.terminated=true;}}
 const ctx=vm.createContext({Worker,Blob:class{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},createWalkPhysics(){},buildHouseTour(){},
  setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}});
 const create=vm.runInContext(fs.readFileSync(path.join(__dirname,'../tour-worker.js'),'utf8')+';createTourPlanner',ctx),planner=create();
 const data={physics:{boxes:[],floors:[],doors:[],spawn:{x:0,z:0}},plan:{w:4,d:4,rooms:[]},position:{x:0,y:1.65,z:0},model:'50',config:{},startIndex:2};
 return {planner,data,worker:workers[0],timers};
}
test('planner requests terminate on timeout and clear their pending timers',async()=>{
 const f=fixture(),pending=f.planner.build(f.data);assert.equal(f.worker.message.data.startIndex,2);
 const rejected=assert.rejects(pending,/demorou demais/);[...f.timers.values()][0]();await rejected;f.planner.dispose();assert.equal(f.worker.terminated,true);
});
test('planner errors, completion and cancellation release requests without late callbacks',async()=>{
 const f=fixture();f.worker.failPost=true;await assert.rejects(f.planner.build(f.data),/Falha de envio/);assert.equal(f.timers.size,0);
 f.worker.failPost=false;const first=f.planner.build(f.data);let prevented=false;const failed=assert.rejects(first,/preparar/);f.worker.onerror({preventDefault(){prevented=true;}});await failed;assert.equal(prevented,true);assert.equal(f.timers.size,0);
 const second=f.planner.build(f.data);f.worker.onmessage({data:{id:f.worker.message.id,result:{index:2}}});assert.equal((await second).index,2);assert.equal(f.timers.size,0);
 const third=f.planner.build(f.data),canceled=assert.rejects(third,/encerrado/);f.planner.dispose();await canceled;assert.equal(f.timers.size,0);f.worker.onmessage({data:{id:f.worker.message.id,result:{index:2}}});
});
