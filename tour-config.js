// World metres. Room names resolve separately for every plan.
// Override per house: models:{'69':{kitchen:{u:.5,v:.65,dwell:5}}}.
// Aerial u/v are fractions of the actual lot (0..1); height clears every roof.
const CASA_TOUR_CONFIG={speed:.85,acceleration:.55,dwell:4,grid:.10,fadeSeconds:.45,
  start:'entry',models:{},stops:[
    {id:'entry',label:'Entrada',kind:'entry',dwell:2},
    {id:'living',label:'Sala de estar',room:'^Sala',v:.3},
    {id:'kitchen',label:'Cozinha',room:'Cozinha',v:.75},
    {id:'hall',room:'Circula|Corredor',dwell:2},
    {id:'bed1',room:'^Quarto 1$'},
    {id:'bed2',room:'^Quarto 2$'},
    {id:'bed3',room:'^Quarto 3$'},
    {id:'suite',room:'^Suíte$'},
    {id:'bath',room:'^Banheiro$'},
    {id:'suite-bath',room:'^Banheiro suíte$'},
    {id:'service',room:'^Serviço$'},
    {id:'aerial-front',label:'Vista aérea · fachada e terreno',kind:'aerial',u:.35,v:.10,dwell:5},
    {id:'aerial-side',label:'Vista aérea · espaço lateral',kind:'aerial',u:.86,v:.45,dwell:5},
    {id:'aerial-back',label:'Vista aérea · quintal e fundos',kind:'aerial',u:.65,v:.88,dwell:5},
    {id:'outside',label:'Retorno à entrada',kind:'entry',dwell:2}
  ]};
