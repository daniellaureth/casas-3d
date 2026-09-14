// This is rendered in both XR eyes, independently of the house and its lighting.
function createQuestLoading({Scene,Group,Mesh,PlaneGeometry,CanvasTexture,MeshBasicMaterial,Vector3,exitVR}) {
  const scene=new Scene(),root=new Group();scene.add(root);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=640;
  const ctx=canvas.getContext('2d'),texture=new CanvasTexture(canvas);texture.colorSpace='srgb';texture.generateMipmaps=false;
  const backdrop=new Mesh(new PlaneGeometry(200,200),new MeshBasicMaterial({color:0xf7f6ef,depthTest:false,depthWrite:false,toneMapped:false}));backdrop.position.z=-2;root.add(backdrop);
  const board=new Mesh(new PlaneGeometry(1.12,.70),new MeshBasicMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));board.position.z=-1.15;board.renderOrder=1;root.add(board);
  const origin=new Vector3(),end=new Vector3();let percent=0;
  function set(value,label){
    percent=value;ctx.fillStyle='#f7f6ef';ctx.fillRect(0,0,1024,640);ctx.textAlign='center';
    ctx.fillStyle='#315c44';ctx.font='24px Arial';ctx.fillText('CASAS 3D',512,100);
    ctx.font='48px Arial';ctx.fillText('Preparando seu passeio VR',512,200);
    ctx.font='30px Arial';ctx.fillText(label,512,274);
    ctx.fillStyle='#dce5d9';ctx.fillRect(112,335,800,16);ctx.fillStyle='#41684e';ctx.fillRect(112,335,800*percent/100,16);
    ctx.font='42px Arial';ctx.fillText(Math.round(percent)+'%',512,418);
    ctx.fillStyle='#e2e9df';ctx.fillRect(312,495,400,80);ctx.fillStyle='#294436';ctx.font='30px Arial';ctx.fillText('Sair do VR',512,547);texture.needsUpdate=true;
  }
  function update(camera){camera.getWorldPosition(root.position);camera.getWorldQuaternion(root.quaternion);root.updateMatrixWorld(true);}
  function select(controller){
    if(controller.visible===false)return false;controller.updateWorldMatrix(true,false);
    controller.getWorldPosition(origin);end.set(0,0,-1).transformDirection(controller.matrixWorld).add(origin);
    root.worldToLocal(origin);root.worldToLocal(end);end.sub(origin);if(end.z>=-.00001)return false;
    const t=(-1.15-origin.z)/end.z,x=(origin.x+t*end.x)/1.12+.5,y=.5-(origin.y+t*end.y)/.70;
    if(t>=0&&x>=312/1024&&x<=712/1024&&y>=495/640&&y<=575/640){void exitVR();return true;}return false;
  }
  set(10,'Conectando aos óculos…');
  return {scene,set,update,select,get percent(){return percent;},dispose(){for(const mesh of [board,backdrop]){mesh.geometry.dispose();mesh.material.dispose();}texture.dispose();}};
}
