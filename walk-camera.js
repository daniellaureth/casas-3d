// Included inline in Casas3D.html so the portable application works offline.
function createWalkCamera({ camera, controls, canvas, stopTour, finishHouse, resize, invalidate, getPlan, getPhysics = () => null }) {
  const button = document.getElementById('walk');
  const settingsButton = document.getElementById('walk-settings');
  const hint = document.querySelector('.hint');
  const keys = new Set();
  const walkingKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
  let active = false, saved = null, yaw = 0, pitch = 0, changed = false;
  let requestId = 0;
  let settingsOpen = false;

  function captureMouse() {
    const id = ++requestId;
    try {
      if (!canvas.requestPointerLock) { fallback(id); return; }
      const request = canvas.requestPointerLock();
      request?.then(() => {
        if ((!active || settingsOpen) && document.pointerLockElement === canvas) document.exitPointerLock();
      }).catch(() => fallback(id));
    } catch { fallback(id); }
  }

  function showSettings(open) {
    if (!active) return;
    settingsOpen = open;
    keys.clear();
    document.body.classList.toggle('walk-settings-open', open);
    settingsButton?.setAttribute('aria-pressed', String(open));
    if (settingsButton) settingsButton.textContent = open ? 'Voltar ao passeio (Tab)' : 'Opções da casa (Tab)';
    if (open) {
      requestId++;
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    } else { settingsButton?.blur(); captureMouse(); }
    invalidate();
  }

  function look() {
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    changed = true;
    invalidate();
  }

  function stop() {
    if (!active) return;
    active = false;
    settingsOpen = false;
    requestId++;
    keys.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    camera.position.copy(saved.position);
    camera.quaternion.copy(saved.quaternion);
    camera.fov = saved.fov;
    controls.target.copy(saved.target);
    controls.enabled = saved.enabled;
    document.body.classList.remove('walking');
    document.body.classList.remove('walk-settings-open');
    button.setAttribute('aria-pressed', 'false');
    button.textContent = '🚶 Passeio em primeira pessoa';
    hint.innerHTML = saved.hint;
    if (settingsButton) { settingsButton.textContent = 'Opções da casa (Tab)'; settingsButton.setAttribute('aria-pressed', 'false'); }
    resize();
    invalidate();
  }

  function fallback(id) {
    if (!active || id !== requestId) return;
    hint.textContent = 'Mova o mouse sobre a casa para olhar · WASD ou setas para andar · Esc para sair';
  }

  function start() {
    stopTour();
    saved = {
      position: camera.position.clone(), quaternion: camera.quaternion.clone(),
      target: controls.target.clone(), fov: camera.fov, enabled: controls.enabled,
      hint: hint.innerHTML
    };
    finishHouse();
    active = true;
    controls.enabled = false;
    keys.clear();
    yaw = pitch = 0;
    const physics = getPhysics();
    const spawn = physics?.spawn || {x:0,z:getPlan().d / 2 + 1.5};
    camera.position.set(spawn.x, (physics?.floorAt(spawn.x, spawn.z) || 0) + 1.65, spawn.z);
    camera.fov = 65;
    document.body.classList.add('walking');
    button.setAttribute('aria-pressed', 'true');
    button.textContent = 'Sair do passeio (Esc)';
    hint.textContent = 'Mouse para olhar · WASD ou setas para andar · E para abrir/fechar portas · Esc para sair';
    button.blur();
    resize();
    look();
    // Request during the activation click: no extra click or held button is needed.
    captureMouse();
  }

  button.onclick = () => active ? stop() : start();
  if (settingsButton) settingsButton.onclick = () => showSettings(!settingsOpen);
  document.addEventListener('mousemove', event => {
    if (!active || settingsOpen || (document.pointerLockElement !== canvas && event.target !== canvas)) return;
    yaw -= (event.movementX || 0) * 0.002;
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch - (event.movementY || 0) * 0.002));
    look();
  });
  document.addEventListener('keydown', event => {
    if (!active) return;
    const editing = event.target?.matches?.('input, select, textarea, [contenteditable="true"]');
    if (event.code === 'Tab' && !editing) { event.preventDefault(); if (!event.repeat) showSettings(!settingsOpen); return; }
    if (event.code === 'Escape') { event.preventDefault(); stop(); return; }
    if (settingsOpen || editing) return;
    if (event.code === 'KeyE') {
      event.preventDefault();
      if (!event.repeat) getPhysics()?.interact(camera.position, {x:-Math.sin(yaw),z:-Math.cos(yaw)});
      invalidate();
      return;
    }
    if (!walkingKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
    invalidate();
  });
  document.addEventListener('keyup', event => {
    if (keys.delete(event.code)) invalidate();
  });
  document.addEventListener('pointerlockchange', () => {
    if (active && !settingsOpen && document.pointerLockElement !== canvas) stop();
    else if (!active && document.pointerLockElement === canvas) document.exitPointerLock();
  });
  document.addEventListener('pointerlockerror', () => fallback(requestId));
  window.addEventListener('blur', () => showSettings(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) showSettings(true); });

  return {
    get active() { return active; },
    get settingsOpen() { return settingsOpen; },
    showSettings,
    stop,
    refreshHouse() {
      if (!active) return;
      const physics = getPhysics();
      if (!physics) return;
      // Preserve viewpoint exactly when the replacement plan leaves enough space.
      if (physics.blocked(camera.position.x, camera.position.z)) {
        let safe = null;
        for (let distance = 0.1; distance <= 3 && !safe; distance += 0.1) {
          for (let i = 0; i < 32; i++) {
            const angle = i * Math.PI / 16, x = camera.position.x + Math.cos(angle) * distance, z = camera.position.z + Math.sin(angle) * distance;
            if (!physics.blocked(x, z)) { safe = {x,z}; break; }
          }
        }
        safe ||= physics.spawn;
        camera.position.x = safe.x; camera.position.z = safe.z;
        const message = document.getElementById('walk-message');
        if (message) message.textContent = 'Posição ajustada para não ficar dentro de uma parede ou móvel da nova planta.';
      }
      camera.position.y = physics.floorAt(camera.position.x, camera.position.z) + physics.eyeHeight;
      look();
    },
    update(delta) {
      if (!active) return false;
      if (settingsOpen) {
        hint.textContent = 'Edite a casa no painel · Voltar ao passeio para continuar · Esc para sair';
        const result = changed; changed = false; return result;
      }
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const length = Math.hypot(forward, right);
      const previousY = camera.position.y;
      let dx = 0, dz = 0;
      if (length) {
        const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.5 : 2.2;
        const step = speed * Math.min(delta, 0.1) / length;
        dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * step;
        dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * step;
        changed = true;
      }
      const physics = getPhysics();
      if (physics) {
        physics.move(camera.position, dx, dz, delta);
        changed = physics.update(delta, camera.position) || changed || camera.position.y !== previousY;
        const door = physics.nearestDoor(camera.position, {x:-Math.sin(yaw),z:-Math.cos(yaw)});
        hint.textContent = door ? `E para ${Math.abs(door.target) > 0.1 ? 'fechar' : 'abrir'} a porta · Tab para opções · Esc para sair` : 'Mouse para olhar · WASD para andar · E para portas · Tab para opções da casa · Esc para sair';
      } else { camera.position.x += dx; camera.position.z += dz; }
      const result = changed;
      changed = false;
      return result;
    }
  };
}
