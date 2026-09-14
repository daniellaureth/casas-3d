const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'Casas3D.html');let html=fs.readFileSync(file,'utf8');
function section(begin,end,source,anchor){const start=html.indexOf(begin);if(start>=0){const finish=html.indexOf(end,start);if(finish<0)throw Error('Loading boundary missing');html=html.slice(0,start)+source+html.slice(finish+end.length);}else html=html.replace(anchor,anchor+source);}
html=html.replace(/<!-- BEGIN CASA LOADING -->[\s\S]*?<!-- END CASA LOADING -->/,'');
section('<!-- BEGIN CASA LOADING -->','<!-- END CASA LOADING -->',fs.readFileSync(path.join(__dirname,'loading-screen.html'),'utf8').trim(),'<meta charset="UTF-8">');
section('<!-- BEGIN CASA LOADING BODY -->','<!-- END CASA LOADING BODY -->',fs.readFileSync(path.join(__dirname,'loading-body.html'),'utf8').trim(),'<body>');
function patch(from,to){if(html.includes(to))return;if(html.split(from).length!==2)throw Error('Loading integration missing: '+from);html=html.replace(from,to);}
patch('const et=i=>document.getElementById(i);await Bm();','const et=i=>document.getElementById(i);await window.CasaLoading?.stage(76,"Carregando texturas e acabamentos…");await Bm();await window.CasaLoading?.stage(88,"Preparando a casa em 3D…");');
patch('async function Bm(){const i=new Ju;','async function Bm(){const i=new Ju;let loaded=0;');
patch('gi[t]=n}catch{}}))','gi[t]=n}catch{}finally{window.CasaLoading?.set(76+(++loaded/Object.keys(Gm).length)*10,"Carregando texturas e acabamentos…")}}))');
patch('const xe=new zm(Je,ee.domElement);','await window.CasaLoading?.stage(94,"Montando os ambientes…");const xe=new zm(Je,ee.domElement);');
patch('ee.autoClear=!0,Hs++,Md=','ee.autoClear=!0,Hs++,globalThis.CasaLoading?.ready(),Md=');
fs.writeFileSync(file,html);console.log('Loading screen updated.');
