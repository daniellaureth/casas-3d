const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../walk-camera.js'), 'utf8');

function setup(lock = 'success') {
  const events = {};
  const windowEvents = {};
  const vector = (x = 0, y = 0, z = 0) => ({ x, y, z,
    set(x, y, z) { Object.assign(this, {x, y, z}); },
    copy(other) { this.set(other.x, other.y, other.z); },
    clone() { return vector(this.x, this.y, this.z); }
  });
  const button = { setAttribute() {}, blur() {} };
  const settingsButton = { setAttribute() {}, blur() {} };
  const hint = { innerHTML: 'Original help' };
  const document = {
    getElementById: id => id === 'walk' ? button : id === 'walk-settings' ? settingsButton : null, querySelector: () => hint,
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    addEventListener: (name, handler) => events[name] = handler,
    exitPointerLock() { this.pointerLockElement = null; events.pointerlockchange(); }
  };
  const canvas = { requestPointerLock() {
    if (lock === 'reject') return Promise.reject(new Error('Denied'));
    document.pointerLockElement = canvas;
    events.pointerlockchange();
    return Promise.resolve();
  }};
  const camera = {position: vector(8, 6, 18), quaternion: vector(1, 2, 3), fov: 38,
    rotation: {set(x, y, z, order) {Object.assign(this, {x, y, z, order});}}};
  const controls = {target: vector(0, 1, 0), enabled: true};
  const context = vm.createContext({document, window: {addEventListener: (name, handler) => windowEvents[name] = handler}});
  const create = vm.runInContext(source + '\ncreateWalkCamera', context);
  const mode = create({camera, controls, canvas, stopTour() {}, finishHouse() {}, resize() {}, invalidate() {}, getPlan: () => ({d: 9})});
  const emit = (type, data = {}) => events[type]({preventDefault() {}, ...data});
  return {mode, camera, controls, canvas, document, hint, start: () => button.onclick(), emit, windowEvents};
}

test('activation captures mouse once; movement with no button changes the look', () => {
  const f = setup(); f.start();
  assert.equal(f.document.pointerLockElement, f.canvas);
  assert.equal(f.controls.enabled, false);
  f.emit('mousemove', {movementX: 90, movementY: 30, buttons: 0});
  assert.equal(f.camera.rotation.y, -0.18);
  assert.equal(f.camera.rotation.x, -0.06);
  f.emit('mousemove', {movementY: 100000});
  assert.ok(f.camera.rotation.x > -Math.PI / 2);
});

test('walking uses horizontal direction and normalized diagonal speed', () => {
  const f = setup(); f.start(); const before = f.camera.position.clone();
  f.emit('keydown', {code: 'KeyW'}); f.emit('keydown', {code: 'KeyD'});
  assert.equal(f.mode.update(0.1), true);
  assert.ok(Math.abs(Math.hypot(f.camera.position.x - before.x, f.camera.position.z - before.z) - 0.22) < 1e-10);
  assert.equal(f.camera.position.y, 1.65);
  f.emit('keyup', {code: 'KeyW'}); f.emit('keyup', {code: 'KeyD'});
  assert.equal(f.mode.update(0.1), false);
});

test('Escape restores camera, field of view and orbit controls', () => {
  const f = setup(); f.start(); f.emit('keydown', {code: 'Escape'});
  assert.equal(f.mode.active, false);
  assert.equal(f.document.pointerLockElement, null);
  assert.equal(f.camera.position.x, 8);
  assert.equal(f.camera.position.y, 6);
  assert.equal(f.camera.position.z, 18);
  assert.equal(f.camera.fov, 38);
  assert.equal(f.controls.enabled, true);
  assert.equal(f.hint.innerHTML, 'Original help');
});

test('focus loss pauses in settings and clears held keys', () => {
  const f = setup(); f.start(); f.emit('keydown', {code: 'KeyW'});
  f.windowEvents.blur(); assert.equal(f.mode.active, true); assert.equal(f.mode.settingsOpen, true);
  f.mode.showSettings(false); f.mode.update(0.1); assert.equal(f.mode.update(0.1), false);
  f.document.pointerLockElement = null; f.emit('pointerlockchange');
  assert.equal(f.mode.active, false);
});

test('options release the cursor and preserve position and look', () => {
  const f = setup(); f.start();
  f.emit('mousemove', {movementX:50,movementY:20});
  const before = JSON.stringify([f.camera.position.x,f.camera.position.y,f.camera.position.z,f.camera.rotation.x,f.camera.rotation.y]);
  f.emit('keydown', {code:'Tab'});
  assert.equal(f.mode.active, true); assert.equal(f.mode.settingsOpen, true);
  assert.equal(f.document.pointerLockElement, null);
  f.emit('mousemove', {target:f.canvas,movementX:200});
  f.emit('keydown', {code:'KeyW'}); f.mode.update(0.1);
  assert.equal(JSON.stringify([f.camera.position.x,f.camera.position.y,f.camera.position.z,f.camera.rotation.x,f.camera.rotation.y]), before);
  f.mode.showSettings(false); assert.equal(f.document.pointerLockElement,f.canvas);
});

test('denied capture still allows mouse look over canvas without clicking', async () => {
  const f = setup('reject'); f.start(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.mode.active, true);
  f.emit('mousemove', {target: f.canvas, movementX: 100, buttons: 0});
  assert.equal(f.camera.rotation.y, -0.2);
  f.emit('mousemove', {target: {}, movementX: 100});
  assert.equal(f.camera.rotation.y, -0.2);
  f.emit('keydown', {code: 'Escape'}); assert.equal(f.mode.active, false);
});

test('portable HTML embeds the current controller and parses as a module', () => {
  const html = fs.readFileSync(path.join(__dirname, '../Casas3D.html'), 'utf8');
  assert.ok(html.includes(source));
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  new vm.SourceTextModule(script);
});
