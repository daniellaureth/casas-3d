// Graphics policy only. WebXR support is always checked through navigator.xr.
function createQuestProfile(userAgent = '', search = '') {
  const standalone = /OculusBrowser|Quest/i.test(userAgent) && /Android/i.test(userAgent);
  const lightweight = standalone || /(?:^|[?&])quality=quest(?:&|$)/.test(search);
  return Object.freeze({standalone, lightweight, name:lightweight?'quest':'desktop',
    pixelRatio:lightweight?1:1.5, anisotropy:lightweight?2:8,
    maxTextureSize:lightweight?512:Infinity, shadowSize:lightweight?512:2048,
    shadows:!lightweight, framebufferScale:.8, targetFrameRate:72});
}
const questProfile = createQuestProfile(globalThis.navigator?.userAgent, globalThis.location?.search);
function questLimitTexture(texture) {
  texture.anisotropy=questProfile.anisotropy;
  const source=texture.image, limit=questProfile.maxTextureSize;
  if(source && Math.max(source.width,source.height)>limit) {
    const factor=limit/Math.max(source.width,source.height),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(source.width*factor));canvas.height=Math.max(1,Math.round(source.height*factor));
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    texture.image=canvas;texture.needsUpdate=true;
  }
  return texture;
}
// Texture clones with identical UV transforms can share one draw call.
function questTextureKey(texture) {
  return texture && [texture.source.uuid,texture.mapping,texture.wrapS,texture.wrapT,
    texture.repeat.toArray(),texture.offset.toArray(),texture.center.toArray(),texture.rotation,
    texture.colorSpace,texture.channel,texture.flipY,texture.minFilter,texture.magFilter,texture.anisotropy];
}
function questBatchMaterial(original) {
  const material=original.clone();
  material.color.set(0xffffff);material.vertexColors=true;
  material.userData={questBatchOwned:true};
  return material;
}
function questVertexColor(geometry,material) {
  const count=geometry.attributes.position.count,existing=geometry.attributes.color;
  const values=new Float32Array(count*3),color=material.color;
  for(let i=0;i<count;i++) {
    values[i*3]=color.r*(material.vertexColors&&existing?existing.getX(i):1);
    values[i*3+1]=color.g*(material.vertexColors&&existing?existing.getY(i):1);
    values[i*3+2]=color.b*(material.vertexColors&&existing?existing.getZ(i):1);
  }
  geometry.setAttribute('color',new me(values,3));
}
