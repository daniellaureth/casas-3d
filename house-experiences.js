// Shared UI actions: the same tour engine drives desktop camera position or the XR rig.
houseTour=createHouseTour({getPhysics:()=>walkPhysics,getPlan:()=>ue.userData.plan,getModel:()=>et('model').value,plannerFactory:createTourPlanner,onChange:()=>{updateTourHUD();Gn();}});
function tourAction(action){
  if(questMode?.active)return questMode.tourAction(action);
  try{
    if(action==='start'&&!walkMode.active)walkMode.start({capture:false});
    houseTour.action(action,Je.position,walkMode.heading);if(houseTour.state.active)walkMode.releaseForTour(action==='start');
  }catch(error){et('tour-room').textContent=error.message;et('tour-hud').hidden=false;}
  updateTourHUD();Gn();
}
let tourHUDRevision=-1,tourFade=-1;
function updateTourHUD(){
  if(!houseTour)return;const state=houseTour.state;
  if(tourHUDRevision!==state.revision){tourHUDRevision=state.revision;et('tour-hud').hidden=!state.active;et('tour-room').textContent=(state.total?(state.index+1)+' / '+state.total+' · ':'')+state.label;
    et('tour-notice').textContent=state.message;et('tour-pause').disabled=state.paused;et('tour-resume').disabled=!state.paused;
    et('auto-tour').setAttribute('aria-pressed',String(state.active));}
  if(tourFade!==state.fade){tourFade=state.fade;et('tour-fade').style.opacity=String(state.fade);}
}
function updateDesktopExperience(){updateTourHUD();return false;}
et('auto-tour').onclick=()=>tourAction('start');
for(const action of ['pause','resume','next','previous','stop'])et('tour-'+action).onclick=()=>tourAction(action);
document.addEventListener('keydown',event=>{
  if(!houseTour.state.active||event.repeat||event.target?.matches?.('input,select,textarea'))return;
  if(event.code==='KeyP'){event.preventDefault();tourAction(houseTour.state.paused?'resume':'pause');}
  if(event.code==='Period')tourAction('next');if(event.code==='Comma')tourAction('previous');
});

et('tour-expand').onclick=()=>{const open=et('tour-hud').classList.toggle('expanded');et('tour-expand').setAttribute('aria-expanded',String(open));et('tour-expand').textContent=open?'Recolher':'Opções';};
