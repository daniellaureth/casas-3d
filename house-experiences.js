// Shared UI actions: the same tour engine drives desktop camera position or the XR rig.
houseTour=createHouseTour({getPhysics:()=>walkPhysics,getPlan:()=>ue.userData.plan,getModel:()=>et('model').value,plannerFactory:createTourPlanner,onChange:()=>{updateTourHUD();Gn();}});
dayNight=createDayNight({scene:Tn,renderer:ee,atmosphere:xd,getHouse:()=>ue,getBatch:()=>bn,Vector3:q,Color:Wt,BufferAttribute:me,invalidate:Gn});
function setHouseNight(night){dayNight.setNight(night);et('day').setAttribute('aria-pressed',String(!night));et('night').setAttribute('aria-pressed',String(night));Gn();}
function tourAction(action){
  if(questMode?.active)return questMode.tourAction(action);
  try{
    if(action==='start'&&!walkMode.active)walkMode.start({capture:false});
    houseTour.action(action,Je.position);if(houseTour.state.active)walkMode.releaseForTour();
  }catch(error){et('tour-room').textContent=error.message;et('tour-hud').hidden=false;}
  updateTourHUD();Gn();
}
let tourHUDRevision=-1,tourFade=-1;
function updateTourHUD(){
  if(!houseTour)return;const state=houseTour.state;
  if(tourHUDRevision!==state.revision){tourHUDRevision=state.revision;et('tour-hud').hidden=!state.active;et('tour-room').textContent=state.label;
    et('tour-notice').textContent=state.message;et('tour-pause').disabled=state.paused;et('tour-resume').disabled=!state.paused;
    et('auto-tour').setAttribute('aria-pressed',String(state.active));}
  if(tourFade!==state.fade){tourFade=state.fade;et('tour-fade').style.opacity=String(state.fade);}
}
function updateDesktopExperience(delta){const changed=dayNight?.update(delta)||false;updateTourHUD();return changed;}
et('auto-tour').onclick=()=>tourAction('start');
for(const action of ['pause','resume','next','previous','stop'])et('tour-'+action).onclick=()=>tourAction(action);
et('day').onclick=()=>setHouseNight(false);et('night').onclick=()=>setHouseNight(true);
const originalEvening=et('light').onclick;et('light').onclick=event=>{originalEvening(event);dayNight.atmosphereChanged();};
document.addEventListener('keydown',event=>{
  if(!houseTour.state.active||event.repeat||event.target?.matches?.('input,select,textarea'))return;
  if(event.code==='KeyP'){event.preventDefault();tourAction(houseTour.state.paused?'resume':'pause');}
  if(event.code==='Period')tourAction('next');if(event.code==='Comma')tourAction('previous');
});
