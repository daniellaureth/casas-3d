const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),html=read('Casas3D.html'),ctx=vm.createContext({console,AbortController,performance,URL});
vm.runInContext(html.slice(html.indexOf('// BEGIN QUEST GRAPHICS'),html.indexOf('let walkPhysics=null'))+read('day-night.js')+';globalThis.T={createDayNight,Group:Ce,Color:Wt,Vector3:q,Mesh:Zt,Material:Gr,Geometry:ye,BufferAttribute:me,HemisphereLight:Lu,DirectionalLight:Zc};',ctx);
test('day/night interpolates for 1.8 seconds, reuses lights/materials and returns exactly to day',()=>{
 const T=ctx.T,scene=new T.Group(),ambient=new T.HemisphereLight(0xffffff,0x888888,.65),sun=new T.DirectionalLight(0xffffff,3.6),fill=new T.DirectionalLight(0xffffff,.35);
 scene.add(ambient,sun,fill);scene.environmentIntensity=.32;scene.fog={color:new T.Color(0xcccccc)};
 const mesh=new T.Mesh(new T.Geometry(1,1,1),new T.Material({color:0xffffff}));mesh.position.y=1;scene.add(mesh);
 const house={userData:{plan:{w:4,d:4,rooms:[['Sala',0,0,4,4]]}}},uniform={value:0},material=mesh.material,geometry=mesh.geometry;
 const mode=T.createDayNight({...T,scene,renderer:{},atmosphere:{ambient,sun,fill},getHouse:()=>house,getBatch:()=>null,invalidate(){},uniform});mode.refresh();
 assert.ok(mesh.geometry.attributes.casaNightGlow.array.some(v=>v>0));const attribute=mesh.geometry.attributes.casaNightGlow;
 for(let cycle=0;cycle<3;cycle++){
  mode.setNight(true);mode.update(.1);assert.ok(mode.mix>0&&mode.mix<.02);
  for(let i=0;i<8;i++)mode.update(.1);assert.ok(mode.mix>.4&&mode.mix<.6);
  for(let i=0;i<10;i++)mode.update(.1);assert.equal(mode.mix,1);assert.equal(fill.intensity,0);assert.equal(scene.children.length,4);
  assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(mesh.geometry.attributes.casaNightGlow,attribute);
  mode.setNight(false);for(let i=0;i<19;i++)mode.update(.1);assert.equal(mode.mix,0);assert.equal(sun.intensity,3.6);assert.equal(scene.environmentIntensity,.32);
 }
});
