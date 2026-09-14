const CASA_NIGHT_UNIFORM={value:0};
function casaInteriorAt(x,y,z,plan){
  if(!plan||y<.2||y>(plan.high?4.1:3.1))return false;
  for(const room of plan.rooms)if(x>=room[1]-plan.w/2-.10&&x<=room[1]+room[3]-plan.w/2+.10&&z>=plan.d/2-room[2]-room[4]-.10&&z<=plan.d/2-room[2]+.10)return true;
  return false;
}
function installCasaNightShader(material,uniform,baked=false){
  const old=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){old.call(this,shader,renderer);shader.uniforms.casaNight=uniform;
    if(baked){
      shader.vertexShader='attribute vec3 casaNightColor;\nuniform float casaNight;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nvColor.xyz = mix(vColor.xyz, casaNightColor, casaNight);');
    }else{
      shader.vertexShader='attribute vec3 casaNightGlow;\nvarying vec3 vCasaNightGlow;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCasaNightGlow = casaNightGlow;');
      shader.fragmentShader='uniform float casaNight;\nvarying vec3 vCasaNightGlow;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vCasaNightGlow * casaNight;');
    }
  };
  material.customProgramCacheKey=()=>oldKey+'|casa-night-'+Number(baked);material.needsUpdate=true;
}
function createDayNight({scene,renderer,atmosphere,getHouse,getBatch,Vector3,Color,BufferAttribute,invalidate,uniform=CASA_NIGHT_UNIFORM}) {
  let target=0,from=0,elapsed=2,lastHouse=null,lastBatch=null,base=null;
  const world=new Vector3(),nightSun=new Color(0x718bc8),nightSky=new Color(0x18243d),warm=new Color(0xffd7a0),ground=new Color(0x151c32);
  const geometries=new WeakSet(),materials=new WeakSet();let prepared=0;
  const sky=atmosphere.sky;
  if(sky){sky.material.uniforms.casaNight=uniform;sky.material.fragmentShader='uniform float casaNight;\n'+sky.material.fragmentShader;
    sky.material.fragmentShader=sky.material.fragmentShader.replace('#include <tonemapping_fragment>','gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.003,0.006,0.018), casaNight);\n#include <tonemapping_fragment>');sky.material.needsUpdate=true;}
  function captureDay(){base={sun:atmosphere.sun.intensity,ambient:atmosphere.ambient.intensity,fill:atmosphere.fill.intensity,
    sunColor:atmosphere.sun.color.clone(),ambientColor:atmosphere.ambient.color.clone(),groundColor:atmosphere.ambient.groundColor.clone(),fog:scene.fog?.color.clone(),environment:scene.environmentIntensity};}
  captureDay();
  function refresh(){
    lastHouse=getHouse();lastBatch=getBatch();const plan=lastHouse?.userData.plan;scene.updateMatrixWorld(true);
    scene.traverse(mesh=>{
      const material=mesh.material,geometry=mesh.geometry;if(!mesh.isMesh||!material?.isMeshStandardMaterial||mesh.userData.questDynamic)return;
      if(!geometries.has(geometry)&&geometry.attributes.position){
        const positions=geometry.attributes.position,glow=new Float32Array(positions.count*3);
        for(let i=0;i<positions.count;i++){
          world.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
          if(casaInteriorAt(world.x,world.y,world.z,plan)){
            const strength=material.transparent?.48:.20;glow[i*3]=strength;glow[i*3+1]=strength*.67;glow[i*3+2]=strength*.32;
          }
        }
        geometry.setAttribute('casaNightGlow',new BufferAttribute(glow,3));geometries.add(geometry);prepared++;
      }
      if(!materials.has(material)){installCasaNightShader(material,uniform);materials.add(material);}
    });
  }
  function apply(){const t=uniform.value;
    atmosphere.sun.intensity=base.sun+( .07-base.sun)*t;atmosphere.sun.color.copy(base.sunColor).lerp(nightSun,t);
    atmosphere.ambient.intensity=base.ambient+(.30-base.ambient)*t;atmosphere.ambient.color.copy(base.ambientColor).lerp(warm,t);atmosphere.ambient.groundColor.copy(base.groundColor).lerp(ground,t);
    atmosphere.fill.intensity=base.fill*(1-t);scene.environmentIntensity=base.environment+(.025-base.environment)*t;
    if(scene.fog&&base.fog)scene.fog.color.copy(base.fog).lerp(nightSky,t);
  }
  function setNight(night){from=uniform.value;target=night?1:0;elapsed=0;invalidate();}
  function update(delta){
    if(lastHouse!==getHouse()||lastBatch!==getBatch())refresh();
    if(elapsed>=1.8)return false;elapsed=Math.min(1.8,elapsed+Math.min(delta,.1));const t=elapsed/1.8,ease=t*t*(3-2*t);
    uniform.value=from+(target-from)*ease;apply();return true;
  }
  function atmosphereChanged(){captureDay();base.environment=.32;apply();invalidate();}
  return {setNight,update,refresh,atmosphereChanged,get active(){return elapsed<1.8;},get night(){return target===1;},get mix(){return uniform.value;},get prepared(){return prepared;}};
}
