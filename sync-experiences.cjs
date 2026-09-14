const fs=require('fs'),path=require('path'),file=path.join(__dirname,'Casas3D.html');let html=fs.readFileSync(file,'utf8');
function patch(a,b){if(html.includes(b))return;if(html.split(a).length!==2)throw Error('Missing experience hook: '+a);html=html.replace(a,b);}
patch('let walkPhysics=null','let houseTour=null;let walkPhysics=null');
patch('const e=walkMode?.active?walkMode.update(t):xe.update(t),n=', 'const e=(walkMode?.active?walkMode.update(t):xe.update(t))|updateDesktopExperience(t),n=');
patch('(n||e)&&Gn()}Gn();window.casaDebug', '(n||e||houseTour?.state.active&&!houseTour.state.paused)&&Gn()}Gn();window.casaDebug');
patch('window.casaDebug=()=>({graphics:', 'window.casaDebug=()=>({automaticTour:houseTour?.state,resources:{lights:Tn.children.filter(o=>o.isLight).length,geometries:ee.info.memory.geometries,textures:ee.info.memory.textures,programs:ee.info.programs.length},graphics:');
if(!html.includes('id="auto-tour"')){
  patch('<button id="quest-vr">','<button id="auto-tour" aria-pressed="false">Tour automático</button><button id="quest-vr">');
  patch('<div id="error" hidden>', '<div id="tour-fade" aria-hidden="true"></div><section id="tour-hud" hidden><strong>Tour da casa</strong><p id="tour-room"></p><div><button id="tour-pause">Pausar</button><button id="tour-resume">Continuar</button><button id="tour-next">Próximo ambiente</button><button id="tour-previous">Ambiente anterior</button><button id="tour-stop">Encerrar tour</button></div><small id="tour-notice"></small><small>P: pausar/continuar · Esc: encerrar</small></section><div id="error" hidden>');
  patch('.walking #quest-status{display:none}', '.walking #quest-status{display:none}\n#tour-hud{position:fixed;right:24px;bottom:115px;z-index:12;width:310px;max-width:calc(100vw - 48px);background:#fafaf2f5;color:#294436;border:1px solid #d5dfd0;padding:16px;border-radius:12px}#tour-hud[hidden],.in-vr #tour-hud{display:none}#tour-room{margin:8px 0;font-size:18px}#tour-hud div{display:flex;gap:6px;flex-wrap:wrap}#tour-hud small{display:block;margin-top:8px}#tour-fade{position:fixed;inset:0;background:black;opacity:0;pointer-events:none;z-index:10}.walking .views #auto-tour{display:block!important}.in-vr #tour-fade{display:none}\n');
}
fs.writeFileSync(file,html);console.log('Tour integration updated.');
