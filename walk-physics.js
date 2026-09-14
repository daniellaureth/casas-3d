// Metric, kinematic character: a circular body, solid walls and hinged doors.
// Substeps prevent crossing thin walls, including when the frame rate drops.
function createWalkPhysics({ boxes = [], floors = [], doors = [], radius = 0.20, eyeHeight = 1.65, onChange = () => {} } = {}) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let verticalSpeed = 0;
  function floorAt(x, z) {
    let height = 0;
    for (const f of floors) if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) height = Math.max(height, f.top);
    return height;
  }
  function overlaps(x, z, box, padding = radius) {
    if (box.enabled && !box.enabled()) return false;
    const dx = x - clamp(x, box.minX, box.maxX), dz = z - clamp(z, box.minZ, box.maxZ);
    return dx * dx + dz * dz < padding * padding - 1e-9;
  }
  function doorBox(door, angle = door.angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const ux = door.axis === 'x' ? c : -s, uz = door.axis === 'x' ? -s : -c;
    return { ux, uz, cx: door.hingeX + ux * door.width / 2, cz: door.hingeZ + uz * door.width / 2 };
  }
  function hitsDoor(x, z, door, angle = door.angle, padding = radius) {
    const b = doorBox(door, angle), dx = x - b.cx, dz = z - b.cz;
    const along = dx * b.ux + dz * b.uz, across = -dx * b.uz + dz * b.ux;
    const a = along - clamp(along, -door.width / 2, door.width / 2);
    const n = across - clamp(across, -0.035, 0.035);
    return a * a + n * n < padding * padding;
  }
  function blocked(x, z, feet = floorAt(x, z)) {
    return boxes.some(b => b.top > feet + 0.20 && b.bottom < feet + eyeHeight + 0.1 && overlaps(x, z, b)) || doors.some(d => hitsDoor(x, z, d));
  }
  function blockedForTour(x,z,ignoreFurniture=false,tourEyeHeight=eyeHeight){const feet=floorAt(x,z);
    // Low furniture does not obstruct a flying viewpoint. Keep tall cupboards
    // out of the lens so the tour never places the camera inside their surfaces.
    return boxes.some(b=>(!ignoreFurniture||b.kind!=='furniture'||b.top>feet+tourEyeHeight-.1)&&b.top>feet+.20&&b.bottom<feet+tourEyeHeight+.1&&overlaps(x,z,b))||doors.some(d=>hitsDoor(x,z,d,d.openAngle));
  }
  function headBlocked(x,z,y=floorAt(x,z)+eyeHeight) {
    const padding=.025;
    return boxes.some(b=>b.kind!=='furniture'&&b.top>y-padding&&b.bottom<y+padding&&overlaps(x,z,b,padding)) ||
      doors.some(d=>y>(d.bottom??0)&&y<(d.top??2.3)&&hitsDoor(x,z,d,d.angle,padding));
  }
  function headPathBlocked(from,to) {
    const count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.025));
    for(let i=1;i<=count;i++){const t=i/count;if(headBlocked(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,to.y))return true;}
    return false;
  }
  function move(position, dx, dz, delta) {
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.4)));
    const stepX = dx / count, stepZ = dz / count;
    let feet = position.y - eyeHeight;
    for (let i = 0; i < count; i++) {
      for (const [axis, step] of [['x', stepX], ['z', stepZ]]) {
        if (!step) continue;
        const x = position.x + (axis === 'x' ? step : 0), z = position.z + (axis === 'z' ? step : 0);
        const floor = floorAt(x, z);
        if (floor > feet + 0.205 || blocked(x, z, Math.max(feet, floor))) continue;
        position[axis] += step;
        if (floor > feet) { feet = floor; position.y = feet + eyeHeight; verticalSpeed = 0; }
      }
    }
    const floor = floorAt(position.x, position.z);
    if (feet > floor + 0.001) {
      verticalSpeed -= 9.81 * Math.min(delta, 0.1);
      position.y = Math.max(floor + eyeHeight, position.y + verticalSpeed * Math.min(delta, 0.1));
    } else { position.y = floor + eyeHeight; verticalSpeed = 0; }
    return position;
  }
  function nearestDoor(position, direction) {
    let nearest = null, distance = 1.8;
    for (const door of doors) {
      const b = doorBox(door), dx = b.cx - position.x, dz = b.cz - position.z, d = Math.hypot(dx, dz);
      if (d >= distance || (direction && d > 0.25 && (dx * direction.x + dz * direction.z) / d < 0.35)) continue;
      // Interactions cannot pass through a wall or a different closed door.
      let obscured = false;
      for (let t = 0.1; t < 0.95; t += 0.1) {
        const x = position.x + dx * t, z = position.z + dz * t;
        if (boxes.some(box => box.top > position.y - 0.5 && box.bottom < position.y && overlaps(x, z, box, 0.01)) || doors.some(other => other !== door && hitsDoor(x, z, other, other.angle, 0.01))) { obscured = true; break; }
      }
      if (!obscured) { nearest = door; distance = d; }
    }
    return nearest;
  }
  function interact(position, direction) {
    const door = nearestDoor(position, direction);
    if (!door) return false;
    door.target = Math.abs(door.target) > 0.1 ? 0 : door.openAngle;
    onChange();
    return true;
  }
  // Exact ray/box slab intersection, including the current rotation of each leaf.
  function rayBox(origin,direction,min,max,limit) {
    let near=0,far=limit;
    for(const axis of ['x','y','z']) {
      if(Math.abs(direction[axis])<1e-8) {if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;continue;}
      let a=(min[axis]-origin[axis])/direction[axis],b=(max[axis]-origin[axis])/direction[axis];
      if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);
      if(near>far)return null;
    }
    return near;
  }
  function raycastDoor(origin,direction,maxDistance=2.5) {
    const length=Math.hypot(direction.x,direction.y,direction.z);
    if(!length)return null;
    const ray={x:direction.x/length,y:direction.y/length,z:direction.z/length};
    let limit=maxDistance,hit=null;
    for(const box of boxes) {
      if(box.enabled&&!box.enabled())continue;
      const distance=rayBox(origin,ray,{x:box.minX,y:box.bottom,z:box.minZ},{x:box.maxX,y:box.top,z:box.maxZ},limit);
      if(distance!==null)limit=distance;
    }
    for(const door of doors) {
      const b=doorBox(door),dx=origin.x-b.cx,dz=origin.z-b.cz;
      const local={x:dx*b.ux+dz*b.uz,y:origin.y,z:-dx*b.uz+dz*b.ux};
      const vector={x:ray.x*b.ux+ray.z*b.uz,y:ray.y,z:-ray.x*b.uz+ray.z*b.ux};
      const distance=rayBox(local,vector,{x:-door.width/2,y:door.bottom??0,z:-.035},{x:door.width/2,y:door.top??2.3,z:.035},limit);
      if(distance!==null&&distance<limit){limit=distance;hit={door,distance};}
    }
    return hit;
  }
  function interactRay(origin,direction) {
    const hit=raycastDoor(origin,direction);if(!hit)return false;
    hit.door.target=Math.abs(hit.door.target)>.1?0:hit.door.openAngle;onChange();return true;
  }
  function update(delta, position) {
    let moving = false;
    for (const door of doors) {
      const gap = door.target - door.angle;
      if (Math.abs(gap) < 0.0001) continue;
      const next = door.angle + Math.sign(gap) * Math.min(Math.abs(gap), delta * 2.2);
      // Check the swept leaf, not just its endpoint: a door must not push through the visitor.
      const samples = Math.max(1, Math.ceil(Math.abs(next - door.angle) / 0.025));
      let obstructed = false;
      for (let i = 1; i <= samples; i++) {
        const angle = door.angle + (next - door.angle) * i / samples;
        if (position && hitsDoor(position.x, position.z, door, angle, radius + 0.002)) { obstructed = true; break; }
      }
      if (obstructed) continue;
      door.angle = next;
      door.apply?.(next);
      moving = true;
    }
    if (moving) onChange();
    return moving;
  }
  return { boxes, floors, doors, radius, eyeHeight, floorAt, blocked, blockedForTour, headBlocked, headPathBlocked, move, nearestDoor, interact, raycastDoor, interactRay, update, hitsDoor, doorBox };
}

function attachWalkDoorPart(leaf, part) {
  if (leaf && part) { leaf.updateMatrixWorld(true); part.updateMatrixWorld(true); leaf.attach(part); }
  return part;
}

function createHousePhysics(house, { Box3, onChange, boundaryVisible = () => true, furnitureVisible = () => true }) {
  const boxes = [], floors = [], doors = [], flightBoxes=[], plan = house.userData.plan;
  house.updateMatrixWorld(true);
  for (const [, x, z, w, d] of plan.rooms) floors.push({minX:x-plan.w/2,maxX:x+w-plan.w/2,minZ:plan.d/2-z-d,maxZ:plan.d/2-z,top:0.4025});
  house.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (let parent = mesh.parent; parent && parent !== house; parent = parent.parent) if (parent.userData.walkDoor) return;
    if (mesh.userData.walkDoor) {
      const info = mesh.userData.walkDoor, width = info.hi - info.lo;
      // Place the origin on the hinge; the mesh and its handle stay in place when closed.
      if (!mesh.userData.hingeReady) {
        const offsetX = info.axis === 'x' ? width / 2 : 0, offsetZ = info.axis === 'z' ? -width / 2 : 0;
        mesh.geometry.translate(offsetX, 0, offsetZ);
        for (const child of mesh.children) { child.position.x += offsetX; child.position.z += offsetZ; }
        mesh.position.x -= offsetX; mesh.position.z -= offsetZ;
        mesh.userData.hingeReady = true;
      }
      // Bedroom and bathroom doors open into those rooms, not across narrow halls.
      const swingName = info.names.find(name => /Banheiro/.test(name)) || info.names.find(name => /Quarto|Suíte/.test(name)) || info.names.find(name => !/Circulação/.test(name)) || info.names[0];
      const room = plan.rooms.find(r => r[0] === swingName);
      const insidePositive = info.axis === 'x' ? room[2] >= info.line - 0.01 : room[1] >= info.line - 0.01;
      const openAngle = (info.axis === 'x' ? insidePositive : !insidePositive) ? Math.PI / 2 : -Math.PI / 2;
      mesh.geometry.computeBoundingBox();
      const door = {axis:info.axis,width,hingeX:mesh.position.x,hingeZ:mesh.position.z,bottom:mesh.position.y+mesh.geometry.boundingBox.min.y,top:mesh.position.y+mesh.geometry.boundingBox.max.y,angle:0,target:0,openAngle,names:info.names,outer:info.outer,
        apply(angle) { mesh.rotation.y = angle; if (mesh.walkProxy) mesh.walkProxy.rotation.y = angle; }};
      mesh.rotation.y = 0;
      doors.push(door);
      if (info.outer && info.axis === 'x') floors.push({minX:mesh.position.x,maxX:mesh.position.x+width,minZ:mesh.position.z-0.1,maxZ:mesh.position.z+0.28,top:0.4025});
      return;
    }
    let group = mesh;
    while (group.parent && group.parent !== house) group = group.parent;
    const index = house.userData.groups.indexOf(group);
    if (![6, 7, 8].includes(index)) return;
    mesh.geometry.computeBoundingBox();
    const bound = new Box3().copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    const b = {minX:bound.min.x,maxX:bound.max.x,minZ:bound.min.z,maxZ:bound.max.z,bottom:bound.min.y,top:bound.max.y};
    // Roofs/ceilings are flight obstacles only; normal walking stays unchanged.
    if(index===6||(index===7&&b.bottom>=2.4))flightBoxes.push(b);
    if(index===6)return;
    if (b.top <= 0.43 && b.top > 0.05 && b.maxX - b.minX > 0.3 && b.maxZ - b.minZ > 0.25) floors.push(b);
    // Include furniture, glass, walls, columns and closed site gates, but not ceilings or labels.
    if (b.top > 0.5 && b.bottom < 2.4 && b.maxX - b.minX > 0.008 && b.maxZ - b.minZ > 0.008) {
      if (mesh.userData.siteWall) b.enabled = boundaryVisible;
      else {
        for (let parent=mesh;parent&&parent!==house;parent=parent.parent) if (parent.userData.furniture) {b.enabled=furnitureVisible;b.kind='furniture';break;}
      }
      boxes.push(b);
    }
  });
  const physics = createWalkPhysics({boxes, floors, doors, onChange});
  physics.flightBoxes=flightBoxes;
  const entry = doors.find(d => d.outer && d.names.some(name => /^Sala/.test(name)));
  physics.spawn = entry ? {x:entry.hingeX + entry.width / 2, z:entry.hingeZ + 2.4} : {x:0,z:plan.d/2+2.4};
  physics.site=house.userData.site;
  physics.roofTop=new Box3().setFromObject(house).max.y;
  // Aerial tour segments stay above every roof and pergola.
  physics.tourAltitude=Math.max(physics.roofTop+1.5,(physics.site?.depth||0)*.7,(physics.site?.width||0)*.7);
  return physics;
}
