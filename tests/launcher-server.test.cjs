const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');

test('portable server delivers the entire house and handles fragmented browser requests',
  {skip:process.platform!=='win32',timeout:20000},async()=>{
  const root=path.join(__dirname,'..');
  const server=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'Iniciar-Casas3D.ps1'),'-NoBrowser'],{windowsHide:true});
  try {
    const address=await new Promise((resolve,reject)=>{
      let output='';
      server.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match)resolve(match[0]);});
      server.on('error',reject);server.on('exit',code=>reject(Error('Server exited '+code)));
    });
    const expected=fs.readFileSync(path.join(root,'Casas3D.html'));
    const response=await fetch(address+'?connection=airlink',{signal:AbortSignal.timeout(6000)});
    assert.equal(response.status,200);
    assert.equal(Number(response.headers.get('content-length')),expected.length);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected);
    const bytes=await new Promise((resolve,reject)=>{
      const chunks=[];
      const socket=net.connect(Number(new URL(address).port),'127.0.0.1',()=>{
        socket.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n');
        setTimeout(()=>socket.write('Connection: close\r\n\r\n'),50);
      });
      socket.setTimeout(6000,()=>socket.destroy(Error('Incomplete HTTP response')));
      socket.on('data',chunk=>chunks.push(chunk));socket.on('error',reject);
      socket.on('end',()=>resolve(Buffer.concat(chunks)));
    });
    const boundary=bytes.indexOf('\r\n\r\n');
    assert.ok(boundary>0);assert.deepEqual(bytes.subarray(boundary+4),expected);
    const missing=await fetch(address+'missing',{signal:AbortSignal.timeout(3000)});
    assert.equal(missing.status,204);
  } finally {server.kill();}
});
