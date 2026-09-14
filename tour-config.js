// World metres. Room names resolve separately for every plan.
// Override per house: models:{'69':{kitchen:{u:.5,v:.65,dwell:5}}}.
// Room u/v override the camera position; focusU/focusV set the subject (0..1).
// Exterior angles orbit the actual lot: 0=front, 90=right, 180=back.
const CASA_TOUR_CONFIG={speed:.8,acceleration:.5,dwell:5,grid:.10,
  eyeHeight:1.95,turnSpeed:18,turnAcceleration:14,cornerRadius:.55,exteriorHeight:3.8,
  start:'entry',models:{},stops:[
    {id:'entry',label:'Entrada',kind:'entry',dwell:2},
    {id:'living',label:'Sala de estar',room:'^Sala',focusV:.3},
    {id:'kitchen',label:'Cozinha',room:'Cozinha',focusV:.75},
    {id:'hall',room:'Circula|Corredor',dwell:2},
    {id:'bed1',room:'^Quarto 1$'},
    {id:'bed2',room:'^Quarto 2$'},
    {id:'bed3',room:'^Quarto 3$'},
    {id:'suite',room:'^Suíte$'},
    {id:'bath',room:'^Banheiro$'},
    {id:'suite-bath',room:'^Banheiro suíte$'},
    {id:'service',room:'^Serviço$'},
    {id:'aerial-front',label:'Fachada e terreno',kind:'aerial',angle:-20,dwell:6},
    {id:'aerial-side',label:'Espaço lateral e terreno',kind:'aerial',angle:85,dwell:6},
    {id:'aerial-back',label:'Quintal e fundos',kind:'aerial',angle:170,dwell:6},
    {id:'outside',label:'Retorno à entrada',kind:'entry',walkingHeight:true,dwell:2}
  ]};
