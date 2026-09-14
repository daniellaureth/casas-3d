const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
const html=fs.readFileSync(path.join(root,'Casas3D.html'));
const moduleMatch=html.toString().match(/<script type="module">([\s\S]*?)<\/script>/);
if(!moduleMatch)throw Error('Portable application module not found');
const app=Buffer.from(moduleMatch[1]),appHash=crypto.createHash('sha256').update(app).digest('hex'),appFile='casas-app.'+appHash.slice(0,12)+'.js';
const bootstrap=fs.readFileSync(path.join(__dirname,'loading-bootstrap.js'),'utf8').replaceAll('EXPECTED_BYTES',String(app.length)).replaceAll('APP_FILE',JSON.stringify('./'+appFile));
const shell=html.toString().replace(moduleMatch[0],()=>'<script>'+bootstrap+'</script>');
// Explicit allowlist: never copy browser profiles, private data or backups.
fs.mkdirSync(out,{recursive:true});
for(const name of fs.readdirSync(out))if(/^casas-app\.[0-9a-f]{12}\.js$/.test(name)&&name!==appFile)fs.unlinkSync(path.join(out,name));
fs.writeFileSync(path.join(out,appFile),app);
fs.writeFileSync(path.join(out,'index.html'),shell);
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'version.json'),JSON.stringify({version:require('../package.json').version,sha256:crypto.createHash('sha256').update(shell).digest('hex'),appFile,appSha256:appHash,appBytes:app.length},null,2)+'\n');
console.log('Produção: tela inicial '+(Buffer.byteLength(shell)/1024).toFixed(1)+' KiB + aplicativo '+(app.length/1024/1024).toFixed(2)+' MiB.');
