// Coordinates are world metres (x,z). Room patterns use the names in each floor plan.
// Optional models: { '50': { kitchen: {x:0,z:1,dwell:5} } } overrides any stop.
const CASA_TOUR_CONFIG={speed:.85,acceleration:.55,dwell:4,grid:.10,fadeSeconds:.35,
  start:'nearest',models:{},stops:[
    {id:'entry',label:'Entrada',kind:'entry'},
    {id:'living',label:'Sala de estar',room:'Sala',v:.3},
    {id:'kitchen',label:'Cozinha',room:'Cozinha',v:.75},
    {id:'hall',room:'Circula|Corredor'},
    {id:'bed1',room:'Quarto 1'},
    {id:'bed2',room:'Quarto 2'},
    {id:'bed3',room:'Quarto 3'},
    {id:'suite',room:'Suíte'},
    {id:'bath',room:'Banheiro'},
    {id:'suite-bath',room:'Banheiro suíte'},
    {id:'service',room:'^Serviço$'},
    {id:'outside',label:'Área externa',kind:'entry',dwell:5}
  ]};
