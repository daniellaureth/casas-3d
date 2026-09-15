// World metres. Room names resolve separately for every plan.
// Override per house: models:{'69':{kitchen:{u:.5,v:.65,dwell:5}}}.
// Room u/v override the camera position; focusU/focusV set the subject (0..1).
// Exterior angles orbit the actual lot: 0=front, 90=right, 180=back.
const CASA_TOUR_CONFIG={speed:1.15,exteriorSpeed:1.9,acceleration:.9,dwell:0,grid:.10,cameraMargin:.14,
  eyeHeight:1.75,turnSpeed:24,turnAcceleration:18,turnResponse:1.35,aimSmoothing:.8,
  lookAhead:2.2,lateralAcceleration:.65,cornerRadius:.9,exteriorHeight:4.4,exteriorSetback:2.5,
  start:'entry',models:{},stops:[
    {id:'entry',label:'Entrada',kind:'entry',dwell:0},
    {id:'living',label:'Sala de estar',room:'^Sala',focusV:.3},
    {id:'kitchen',label:'Cozinha',room:'Cozinha',focusV:.75},
    {id:'service',room:'^Serviço$'},
    {id:'bed1',room:'^Quarto 1$'},
    {id:'bed2',room:'^Quarto 2$'},
    {id:'bed3',room:'^Quarto 3$'},
    {id:'suite',room:'^Suíte$'},
    {id:'bath',room:'^Banheiro$'},
    {id:'suite-bath',room:'^Banheiro suíte$'},
    {id:'aerial-front',label:'Fachada',kind:'aerial',angle:-25,dwell:0},
    {id:'aerial-side',label:'Lote visto de cima',kind:'aerial',angle:55,overview:true,dwell:0},
    {id:'aerial-back',label:'Quintal e fundos',kind:'aerial',angle:145,overview:true,dwell:0},
    {id:'outside',label:'Retorno à entrada',kind:'entry',walkingHeight:true,dwell:0}
  ]};
