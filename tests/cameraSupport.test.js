import assert from 'node:assert/strict';
import test from 'node:test';
import { openCamera, supportsWorkerTracking } from '../src/cameraSupport.js';

function environment(t, navigator, window = {}) {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  t.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
}

test('USB cameras can open without a facing-mode constraint', async (t) => {
  const stream = {};
  let requested;
  environment(t, { mediaDevices: { getUserMedia: async (constraints) => { requested = constraints; return stream; } } });
  assert.equal(await openCamera(), stream);
  assert.equal(requested.audio, false);
  assert.equal(requested.video.facingMode, undefined);
  assert.equal(requested.video.frameRate.ideal, 30);
});

test('unsupported resolution constraints fall back to the camera defaults', async (t) => {
  const requests = [];
  const stream = {};
  environment(t, { mediaDevices: { getUserMedia: async (constraints) => {
    requests.push(constraints);
    if (requests.length === 1) throw Object.assign(new Error(), { name: 'OverconstrainedError' });
    return stream;
  } } });
  assert.equal(await openCamera(), stream);
  assert.deepEqual(requests[1], { audio: false, video: true });
});

test('permission denial is preserved without requesting the camera again', async (t) => {
  let calls = 0;
  const error = Object.assign(new Error('Denied'), { name: 'NotAllowedError' });
  environment(t, { mediaDevices: { getUserMedia: async () => { calls++; throw error; } } });
  await assert.rejects(openCamera(), (received) => received === error);
  assert.equal(calls, 1);
});

test('older Tizen can use its prefixed camera API', async (t) => {
  const stream = {};
  const navigator = { webkitGetUserMedia(constraints, resolve) {
    assert.equal(this, navigator);
    assert.deepEqual(constraints, { audio: false, video: true });
    resolve(stream);
  } };
  environment(t, navigator, { isSecureContext: false });
  assert.equal(await openCamera(), stream);
  assert.equal(supportsWorkerTracking(), false);
});

test('unavailable camera APIs produce a useful error', async (t) => {
  environment(t, {}, { isSecureContext: false });
  await assert.rejects(openCamera(), /HTTPS/);
});
