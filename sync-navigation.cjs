// Rebuild the portable inline navigation scripts from their readable sources.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'Casas3D.html');
let html = fs.readFileSync(file, 'utf8');
function replaceOnce(from, to) {
  if (html.split(from).length !== 2) throw new Error('Expected one integration point: ' + from);
  html = html.replace(from, to);
}
if (!html.includes('function fx(i,t){return walkClearanceZones(i,t)}')) {
  const first=html.indexOf('function fx(i,t){'),last=html.indexOf('const kl=',first);
  if(first<0||last<first)throw new Error('Missing furniture clearance integration');
  html=html.slice(0,first)+'function fx(i,t){return walkClearanceZones(i,t)}'+html.slice(last);
  replaceOnce('const T=lx(s,a[8]),y=mx(s,a[8],h);', 'addWalkPassages(x,h);const T=lx(s,a[8]),y=mx(s,a[8],h);');
  replaceOnce('!x.some(M=>M&&Ki(w.body,M.body))', '!x.some(M=>M&&(Ki(w.body,M.body)||w.access&&Ki(w.access,M.body)||M.access&&Ki(w.body,M.access)))');
  replaceOnce('const r=e||!!De||hn!==Be||Xe!==Number(Vn)||Un!==Number(Zn);', 'const r=!!walkMode?.active||e||!!De||hn!==Be||Xe!==Number(Vn)||Un!==Number(Zn);');
}
if (html.includes('const v=i.w!==6.6,H=i.w===8.4')) {
  replaceOnce('const v=i.w!==6.6,H=i.w===8.4','const v=i.w===7,H=i.w===8.4');
  replaceOnce('(w.cz-A.cz)*A.front[0])<.22','(w.cz-A.cz)*A.front[0])<.55');
  replaceOnce('f[j].find(w=>b(j,w)&&!x.some(M=>M&&(Ki(w.body,M.body)||w.access&&Ki(w.access,M.body)||M.access&&Ki(w.body,M.access))))', 'f[j].find(w=>b(j,w)&&!x.some(M=>M&&Ki(w.body,M.body)))');
}
if (!html.includes('/* keep the entrance lounge clear */')) {
  replaceOnce('const B=j.g.name;if(B.startsWith("Cozinha")', 'const B=j.g.name;/* keep the entrance lounge clear */if(/Sala/.test(r)&&/^(Planta|Mesa de centro)/.test(B)&&U.z<o+Math.min(2.8,c))continue;if(B.startsWith("Cozinha")');
}
if (html.includes('m?f<3.4?.9:1.35:1')) {
  replaceOnce('m?f<3.4?.9:1.35:1','m?f<3.4||i.w===9.5?.9:1.35:1');
}
if (!html.includes('let walkPhysics=null')) {
  replaceOnce('let walkMode=null;', 'let walkPhysics=null;let questMode=null;let walkMode=null;');
  replaceOnce('for(const w of x){let Bt=', 'for(const w of x){let walkDoorLeaf=null;let Bt=');
  replaceOnce('At?o.wood:o.glass);tt&&!At', 'At?o.wood:o.glass);if(tt&&At){walkDoorLeaf=tt;tt.userData.walkDoor={axis:M,line:O,lo:gt+.025,hi:it-.025,names:I,outer:R};}tt&&!At');
  replaceOnce('U(7,it-.15,it-.125,1.24,.25,.13,o.metal),B', 'attachWalkDoorPart(walkDoorLeaf,U(7,it-.15,it-.125,1.24,.25,.13,o.metal)),B');
  replaceOnce('U(7,gt+.05,it-.05,.57+tt*.29,.012,.075,6768686);', 'attachWalkDoorPart(walkDoorLeaf,U(7,gt+.05,it-.05,.57+tt*.29,.012,.075,6768686));');
  replaceOnce('i.traverseVisible(o=>{if(!o.isMesh||Array.isArray(o.material))return;', 'i.traverseVisible(o=>{if(!o.isMesh||Array.isArray(o.material))return;for(let p=o.parent;p&&p!==i;p=p.parent)if(p.userData.walkDoor)return;if(o.userData.walkDoor){const copy=o.clone(true);copy.traverse(p=>{if(p.geometry)p.geometry=p.geometry.clone()});o.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);o.walkProxy=copy;t.add(copy);return;}');
  replaceOnce('i||As(),dc(hn)}function lc', 'i||As(),walkPhysics=createHousePhysics(ue,{Box3:si,onChange(){ee.shadowMap.needsUpdate=true;Gn()},boundaryVisible:()=>et("boundary").checked}),dc(hn)}function lc');
}
const oldStart = html.indexOf('// Included inline in Casas3D.html');
if (!html.includes('furnitureVisible:()=>Zn')) {
  replaceOnce('boundaryVisible:()=>et("boundary").checked}', 'boundaryVisible:()=>et("boundary").checked,furnitureVisible:()=>Zn}');
  replaceOnce('</style>', '\n.walking #steps{display:none}.walking.walk-settings-open .views #furniture,.walking.walk-settings-open .views #light,.walking.walk-settings-open .views #house-dimensions{display:block!important}\n</style>');
}
if (!html.includes('id="quest-vr"') && fs.existsSync(path.join(__dirname, 'quest-vr.js'))) {
  replaceOnce('<button id="walk-settings"', '<button id="quest-vr">Entrar em VR · Quest</button><button id="walk-settings"');
  replaceOnce('<div class="hint">', '<p id="quest-status" role="status"></p><div class="hint">');
  replaceOnce('function Gn(){$i=!0,', 'function Gn(){if(questMode?.active)return;$i=!0,');
  replaceOnce('function zx(i){if(Br=0,document.hidden)return;', 'function zx(i){if(Br=0,document.hidden||questMode?.active)return;');
  replaceOnce('</style>', '\n#quest-status{position:absolute;right:24px;top:150px;max-width:360px;background:#faf9f2f5;padding:12px;border-radius:8px;font-size:12px;z-index:4}#quest-status:empty{display:none}.in-vr aside,.in-vr header,.in-vr .timeline,.in-vr .hint{display:none}.walking #quest-status{display:none}\n</style>');
}
if (!html.includes('id="walk-settings"')) {
  replaceOnce('<button id="walk"', '<button id="walk-settings" aria-pressed="false">Opções da casa (Tab)</button><button id="walk"');
  replaceOnce('<p id="configuration-error" role="alert"></p>', '<p id="configuration-error" role="alert"></p><p id="walk-message" role="status"></p>');
  replaceOnce('function As(i=!1){walkMode?.stop();', 'function As(i=!1){if(walkMode?.active)return;');
  replaceOnce('function ke(){walkMode?.stop();', 'function ke(){if(!walkMode?.settingsOpen)walkMode?.stop();');
  replaceOnce('boundaryVisible:()=>et("boundary").checked}),dc(hn)}function lc', 'boundaryVisible:()=>et("boundary").checked}),walkMode?.refreshHouse(),dc(hn)}function lc');
  replaceOnce('</style>', '\n#walk-settings{display:none}.walking #walk-settings{display:block!important}.walking.walk-settings-open aside{display:block;bottom:85px;max-height:calc(100vh - 120px)}#walk-message{font-size:11px;line-height:1.4;color:#53664a}.walking.walk-settings-open .hint{max-width:calc(100% - 32px)}\n</style>');
}
const parts = ['walk-layout.js', 'walk-physics.js', 'walk-camera.js','tour-config.js','house-tour.js','tour-worker.js','day-night.js'];
if (!html.includes('if(walkMode?.active||questMode?.active)return;')) {
  replaceOnce('function As(i=!1){if(walkMode?.active)return;', 'function As(i=!1){if(walkMode?.active||questMode?.active)return;');
  replaceOnce('function lc(){ee.setSize', 'function lc(){if(questMode?.active)return;ee.setSize');
}
parts.push('quest-panel.js','quest-hands.js','quest-hand-walk.js','quest-lighting.js','quest-loading.js');
if(!html.includes('vr:questMode?.diagnostics'))replaceOnce('window.casaDebug=()=>({walking:', 'window.casaDebug=()=>({vr:questMode?.diagnostics,walking:');
const start = html.indexOf('// BEGIN NAVIGATION MODULES');
const end = html.indexOf('</script>', start >= 0 ? start : oldStart);
if (end < 0 || (start < 0 && oldStart < 0)) throw new Error('Missing inline navigation boundary');
if (fs.existsSync(path.join(__dirname, 'quest-vr.js'))) parts.push('quest-vr.js');
const setup = `walkMode=createWalkCamera({camera:Je,controls:xe,canvas:ee.domElement,stopTour:ke,finishHouse(){ji(100);hn=100;Vn=false;Xe=0;et("xray").setAttribute("aria-pressed","false");De=null;Bn=null;dc(100);},resize:lc,invalidate:Gn,getPlan:()=>ue.userData.plan,getPhysics:()=>walkPhysics,getTour:()=>houseTour});`;
const questSetup = fs.existsSync(path.join(__dirname, 'quest-setup.js')) ? fs.readFileSync(path.join(__dirname, 'quest-setup.js'), 'utf8') : '';
html = html.slice(0, start >= 0 ? start : oldStart) + '// BEGIN NAVIGATION MODULES\n' + parts.map(p => fs.readFileSync(path.join(__dirname, p), 'utf8')).join('\n') + '\n' + setup + '\n' + questSetup + '\n'+fs.readFileSync(path.join(__dirname,'house-experiences.js'),'utf8')+'\n// END NAVIGATION MODULES\n' + html.slice(end);
fs.writeFileSync(file, html);
console.log('Portable navigation updated.');
