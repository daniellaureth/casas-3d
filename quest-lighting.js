// Standalone VR uses baked diffuse vertex lighting. It needs no PBR environment
// sampling or dynamic light shader variants. Original geometry/materials are restored.
function createQuestLighting({scene,MeshBasicMaterial,BufferAttribute,Vector3,Matrix3,getEvening=()=>false}) {
  const entries=[],materials=new Map(),geometries=new Set();
  const normal=new Vector3(),sun=new Vector3(-.65,.68,.7).normalize(),fill=new Vector3(12,15,-8).normalize(),normalMatrix=new Matrix3();
  function restore(){
    for(const {mesh,geometry,material} of entries){mesh.geometry=geometry;mesh.material=material;}
    entries.length=0;for(const geometry of geometries)geometry.dispose();geometries.clear();
    for(const material of materials.values())material.dispose();materials.clear();
  }
  function apply(){
    restore();scene.updateMatrixWorld(true);const evening=getEvening(),channels=['r','g','b'];sun.set(-.65,evening?.25:.68,.7).normalize();
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh||Array.isArray(mesh.material)||!mesh.material.isMeshStandardMaterial||mesh.userData.questDynamic)return;
      const original=mesh.material,geometry=mesh.geometry,source=geometry.attributes.normal;
      if(!source)return;
      let material=materials.get(original);
      if(!material){
        material=new MeshBasicMaterial({color:0xffffff,map:original.map,alphaMap:original.alphaMap,
          transparent:original.transparent,opacity:original.opacity,alphaTest:original.alphaTest,
          side:original.side,depthTest:original.depthTest,depthWrite:original.depthWrite,
          vertexColors:true,toneMapped:original.toneMapped,fog:original.fog});
        material.name='Quest VR · '+original.name;materials.set(original,material);
      }
      const baked=geometry.clone(),colors=new Float32Array(source.count*3),oldColors=geometry.attributes.color;
      normalMatrix.getNormalMatrix(mesh.matrixWorld);
      for(let i=0;i<source.count;i++){
        normal.fromBufferAttribute(source,i).applyMatrix3(normalMatrix).normalize();
        // A diffuse minimum keeps interiors readable; directional light retains volume.
        const daylight=.36+.20*(normal.y*.5+.5)+.54*Math.max(0,normal.dot(sun))+.10*Math.max(0,normal.dot(fill));
        for(let axis=0;axis<3;axis++){
          const channel=channels[axis],vertex=original.vertexColors&&oldColors?oldColors.getComponent(i,axis):1,tint=evening?[1,.86,.70][axis]:1;
          colors[i*3+axis]=original.color[channel]*vertex*daylight*tint+(original.emissive?.[channel]||0)*(original.emissiveIntensity??1);
        }
      }
      baked.setAttribute('color',new BufferAttribute(colors,3));
      entries.push({mesh,geometry,material:original});geometries.add(baked);mesh.geometry=baked;mesh.material=material;
    });
  }
  return {apply,restore,get count(){return entries.length;}};
}
