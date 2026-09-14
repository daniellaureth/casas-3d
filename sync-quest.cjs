// Guarded, repeatable integration with the existing portable Three.js bundle.
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'Casas3D.html');let html=fs.readFileSync(file,'utf8');
function patch(from,to){if(html.includes(to))return;if(html.split(from).length!==2)throw Error('Quest integration point missing: '+from);html=html.replace(from,to);}
if(!html.includes('rel="icon"'))patch('<meta charset="UTF-8">','<meta charset="UTF-8"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Cpath fill=%27%23315c44%27 d=%27M4 30 32 6 60 30v28H38V38H26v20H4Z%27/%3E%3C/svg%3E">');
const begin='// BEGIN QUEST GRAPHICS',end='// END QUEST GRAPHICS';
const source=begin+'\n'+fs.readFileSync(path.join(__dirname,'quest-runtime.js'),'utf8')+'\n'+end+'\n';
if(html.includes(begin)){const start=html.indexOf(begin);html=html.slice(0,start)+source+html.slice(html.indexOf(end,start)+end.length+1);}
else patch('const vo=',source+'const vo=');
patch('n.wrapS=n.wrapT=Hn,n.anisotropy=8,','questLimitTexture(n),n.wrapS=n.wrapT=Hn,n.anisotropy=questProfile.anisotropy,');
patch('r.anisotropy=8,Pa.set(i,r)','r.anisotropy=questProfile.anisotropy,Pa.set(i,r)');
patch('ee.setPixelRatio(Math.min(devicePixelRatio,1.5));ee.shadowMap.enabled=!0;','ee.setPixelRatio(Math.min(devicePixelRatio,questProfile.pixelRatio));ee.shadowMap.enabled=questProfile.shadows;');
patch('new Hm({canvas:et("scene"),antialias:!0,powerPreference:"high-performance"})',
  'new Hm({canvas:et("scene"),context:questProfile.standalone?et("scene").getContext("webgl2",{xrCompatible:true,antialias:true,alpha:false,powerPreference:"high-performance"}):null,antialias:!0,powerPreference:"high-performance"})');
patch('o.shadow.mapSize.set(2048,2048)','o.shadow.mapSize.set(questProfile.shadowSize,questProfile.shadowSize)');
patch('new Xo(1,2);K.deleteAttribute','new Xo(1,questProfile.lightweight?1:2);K.deleteAttribute');
patch('for(let M=-12;M<13;M++){const O=new Zt(new ye(1.5,.01,.09),_e(13880241));O.position.set(M*4,.025,y(b.z0-4.2)),u.add(O)}',
  'if(questProfile.lightweight){const markings=new vu(new ye(1.5,.01,.09),_e(13880241),25),matrix=new $t;for(let M=-12;M<13;M++)markings.setMatrixAt(M+12,matrix.makeTranslation(M*4,.025,y(b.z0-4.2)));markings.instanceMatrix.needsUpdate=true;u.add(markings)}else for(let M=-12;M<13;M++){const O=new Zt(new ye(1.5,.01,.09),_e(13880241));O.position.set(M*4,.025,y(b.z0-4.2)),u.add(O)}');
patch('u.traverse(M=>{M.geometry?.dispose(),M.material?.dispose()})','u.traverse(M=>{if(M.isInstancedMesh)M.dispose();M.geometry?.dispose(),M.material?.dispose()})');
patch('const xd=Px(Tn,ee),Ti=new vx(ee);Ti.addPass','const xd=Px(Tn,ee),Ti=questProfile.lightweight?{setSize(){},render(){ee.render(Tn,Je)}}:new vx(ee);if(!questProfile.lightweight){Ti.addPass');
patch('Ti.addPass(new qx);','Ti.addPass(new qx);}');
// Bake opaque material color into vertices when batching the Quest house. Original
// materials remain private to the construction animation; doors stay articulated.
patch('a.map(u=>l[u]?.uuid),l.color?.getHex(),','a.map(u=>questProfile.lightweight?questTextureKey(l[u]):l[u]?.uuid),questProfile.lightweight?null:l.color?.getHex(),');
patch('e.set(c,{material:l,geometries:[]','e.set(c,{material:questProfile.lightweight?questBatchMaterial(l):l,geometries:[]');
patch('d.applyMatrix4(o.matrixWorld),e.get(c).geometries.push(d)','questProfile.lightweight&&questVertexColor(d,l),d.applyMatrix4(o.matrixWorld),e.get(c).geometries.push(d)');
patch('function Nm(i){i?.traverse(t=>t.geometry?.dispose())}', 'function Nm(i){i?.traverse(t=>{t.geometry?.dispose();if(t.material?.userData.questBatchOwned)t.material.dispose()})}');
patch('window.casaDebug=()=>({vr:', 'window.casaDebug=()=>({graphics:questProfile,shadows:ee.shadowMap.enabled,vr:');
fs.writeFileSync(file,html);
console.log('Quest graphics updated.');
