const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
function createServer({source=false,prefix='/casas-3d/'}={}) {
  const root=path.join(__dirname,'..');
  return http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const files=new Map([[prefix,source?'Casas3D.html':'dist/index.html'],[prefix+'index.html',source?'Casas3D.html':'dist/index.html'],[prefix+'version.json','dist/version.json']]);
    if(!source)for(const name of fs.readdirSync(path.join(root,'dist')))if(/^casas-app\.[0-9a-f]{12}\.js$/.test(name))files.set(prefix+name,'dist/'+name);
    if(url.pathname==='/'||url.pathname===prefix.slice(0,-1)){res.writeHead(302,{Location:prefix});res.end();return;}
    const file=files.get(url.pathname);
    if(!file||!fs.existsSync(path.join(root,file))){res.writeHead(404);res.end('Arquivo não encontrado');return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.json')?'application/json':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(fs.readFileSync(path.join(root,file)));
  });
}
if(require.main===module){const server=createServer({source:process.argv.includes('--source')});server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('http://localhost:'+server.address().port+'/casas-3d/'));}
module.exports={createServer};
