const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
const html=fs.readFileSync(path.join(root,'Casas3D.html'));
// Explicit allowlist: never copy browser profiles, private data or backups.
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'version.json'),JSON.stringify({version:require('../package.json').version,sha256:crypto.createHash('sha256').update(html).digest('hex')},null,2)+'\n');
console.log('Produção: dist/index.html ('+(html.length/1024/1024).toFixed(2)+' MiB), sem dependências externas.');
