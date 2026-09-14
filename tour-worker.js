// A browser Worker keeps path planning off the XR/render thread. No server or dependency.
function createTourPlanner(){
  if(typeof Worker==='undefined')return null;
  const source=createWalkPhysics.toString()+'\n'+buildHouseTour.toString()+`\nlet navigation;
    onmessage=event=>{const {id,type,data}=event.data;try{
      let result;if(type==='build'){
        const physics=createWalkPhysics(data.physics);physics.spawn=data.spawn;
        navigation=buildHouseTour({...data,physics});let index=0,distance=Infinity;
        if(data.config.start!=='entry')navigation.points.forEach((p,i)=>{const d=Math.hypot(p.x-data.position.x,p.z-data.position.z);if(d<distance){distance=d;index=i;}});
        result={points:navigation.points,legs:navigation.legs,index,path:navigation.route(data.position,navigation.points[index])};
      }else result=navigation.route(data.position,navigation.points[data.index]);
      postMessage({id,result});
    }catch(error){postMessage({id,error:error.message});}};`;
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url),requests=new Map();let id=0;
  worker.onmessage=event=>{const pending=requests.get(event.data.id);if(!pending)return;requests.delete(event.data.id);event.data.error?pending.reject(Error(event.data.error)):pending.resolve(event.data.result);};
  worker.onerror=()=>{for(const pending of requests.values())pending.reject(Error('Não foi possível preparar o tour.'));requests.clear();};
  function request(type,data){return new Promise((resolve,reject)=>{requests.set(++id,{resolve,reject});worker.postMessage({id,type,data});});}
  return {
    build({physics,plan,model,position,config}){return request('build',{plan:{w:plan.w,d:plan.d,rooms:plan.rooms},model,position:{x:position.x,z:position.z},config,spawn:physics.spawn,
      physics:{boxes:physics.boxes.filter(b=>!b.enabled||b.enabled()).map(({enabled,...box})=>box),floors:physics.floors,doors:physics.doors.map(({apply,...door})=>door),radius:physics.radius,eyeHeight:physics.eyeHeight}});},
    route(index,position){return request('route',{index,position:{x:position.x,z:position.z}});},
    dispose(){worker.terminate();URL.revokeObjectURL(url);for(const pending of requests.values())pending.reject(Error('Tour encerrado.'));requests.clear();}
  };
}
