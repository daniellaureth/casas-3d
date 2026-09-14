// EXPECTED_BYTES and APP_FILE are replaced with exact build values.
(async()=>{
 const loader=window.CasaLoading;let blobURL;
 try {
  loader.set(2,'Baixando sua casa…');
  const response=await fetch(APP_FILE);if(!response.ok)throw Error('House download: '+response.status);
  const chunks=[];let received=0;
  if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;loader.set(2+Math.min(1,received/EXPECTED_BYTES)*72,'Baixando sua casa…');}}
  else{chunks.push(await response.arrayBuffer());loader.set(74,'Preparando sua casa…');}
  if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  await loader.stage(75,'Iniciando a visita…');
  blobURL=URL.createObjectURL(new Blob(chunks,{type:'text/javascript'}));await import(blobURL);
 }catch(error){console.error('Casas 3D loading:',error);loader.fail();}
 finally{if(blobURL)URL.revokeObjectURL(blobURL);}
})();
