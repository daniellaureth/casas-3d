// Reserve door swings and approach space before furnishing, including open passages.
function walkClearanceZones(room, openings) {
  const [name,x,z,width,depth]=room, zones=[],doorEntries=[];
  const inner={x:x+0.105,z:z+0.105,w:width-0.21,d:depth-0.21};
  function reserve(rect, extra={}) {
    const left=Math.max(inner.x,rect.x),front=Math.max(inner.z,rect.z);
    const right=Math.min(inner.x+inner.w,rect.x+rect.w),back=Math.min(inner.z+inner.d,rect.z+rect.d);
    if(right>left&&back>front) zones.push({x:left,z:front,w:right-left,d:back-front,door:true,...extra});
  }
  for(const opening of openings.filter(o=>o.names.includes(name))) {
    const alongX=opening.axis==='x';
    if(!opening.door) {
      const inset=0.16;
      const positive=alongX?Math.abs(opening.line-z)<0.02:Math.abs(opening.line-x)<0.02;
      zones.push(alongX?{x:opening.lo,z:positive?z+0.09:z+depth-0.09-inset,w:opening.hi-opening.lo,d:inset,door:false,sill:opening.sill??1.4}:{x:positive?x+0.09:x+width-0.09-inset,z:opening.lo,w:inset,d:opening.hi-opening.lo,door:false,sill:opening.sill??1.4});
      continue;
    }
    const positive=alongX?z+depth/2>=opening.line:x+width/2>=opening.line;
    const reach=Math.min(Math.min(width,depth)<1.8?0.72:0.82,(alongX?depth:width)-0.21);
    const normal=opening.line+(positive?1:-1)*(0.09+reach/2);
    reserve(alongX?{x:opening.lo-0.04,z:normal-reach/2,w:opening.hi-opening.lo+0.08,d:reach}:{x:normal-reach/2,z:opening.lo-0.04,w:reach,d:opening.hi-opening.lo+0.08});
    const mid=(opening.lo+opening.hi)/2;
    doorEntries.push({x:alongX?mid:opening.line+(positive?0.65:-0.65),z:alongX?opening.line+(positive?0.65:-0.65):mid,opening});
  }
  // Keep a continuous route from the suite entrance to its bathroom, around the
  // foot and side of the bed. A door-sized empty patch alone is not sufficient.
  if(name==='Suíte'&&doorEntries.length===2&&doorEntries.every(p=>p.opening.axis==='x')) {
    const exit=doorEntries.find(p=>p.opening.names.includes('Banheiro suíte'));
    const entry=doorEntries.find(p=>p!==exit);
    if(exit&&entry) {
      const elbow={x:exit.x,z:entry.z},half=0.26;
      for(const [a,b] of [[entry,elbow],[elbow,exit]])reserve({x:Math.min(a.x,b.x)-half,z:Math.min(a.z,b.z)-half,w:Math.abs(a.x-b.x)+half*2,d:Math.abs(a.z-b.z)+half*2},{circulation:true});
    }
  }
  return zones;
}

function addWalkPassages(walls,openings) {
  for(const wall of walls) if(wall.openPlan&&wall.b-wall.a>0.5) {
    const mid=(wall.a+wall.b)/2,half=Math.min(0.45,(wall.b-wall.a)/2);
    openings.push({axis:wall.axis,line:wall.line,lo:mid-half,hi:mid+half,door:true,portal:true,names:wall.names,outer:false,sill:0.4,height:2.1});
  }
}
