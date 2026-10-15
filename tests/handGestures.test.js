import assert from 'node:assert/strict';
import test from 'node:test';
import { readHandGesture } from '../src/handGestures.js';

function hand(extendedFingers = [true, true, true, true], thumbOpen = true) {
  const points = [
    [0.5, 0.9], [0.4, 0.8], [0.28, 0.72], [0.18, 0.63], [0.09, 0.55],
    [0.4, 0.62], [0.38, 0.44], [0.36, 0.3], [0.34, 0.16],
    [0.51, 0.6], [0.51, 0.4], [0.51, 0.25], [0.51, 0.1],
    [0.61, 0.64], [0.64, 0.44], [0.66, 0.3], [0.68, 0.18],
    [0.7, 0.69], [0.75, 0.54], [0.78, 0.42], [0.81, 0.33],
  ].map(([x, y]) => ({ x, y, z: 0 }));
  [5, 9, 13, 17].forEach((base, finger) => {
    if (extendedFingers[finger]) return;
    const { x, y } = points[base];
    points[base + 1] = { x, y: y - 0.08, z: 0 };
    points[base + 2] = { x: x + 0.02, y: y + 0.02, z: 0 };
    points[base + 3] = { x, y: y + 0.09, z: 0 };
  });
  if (!thumbOpen) points[4] = { x: 0.48, y: 0.74, z: 0 };
  return points;
}

test('only the index finger controls a mirrored pointer; thumb may be relaxed', () => {
  for (const thumbOpen of [true, false]) {
    const result = readHandGesture(hand([true, false, false, false], thumbOpen));
    assert.equal(result.gesture, 'point');
    assert.ok(Math.abs(result.x - 0.66) < 1e-9);
    assert.equal(result.y, 0.16);
  }
});

test('an open palm recenters; a fist and two extended fingers stay idle', () => {
  assert.equal(readHandGesture(hand()).gesture, 'palm');
  assert.equal(readHandGesture(hand([true, true, true, true], false)).gesture, 'idle');
  assert.equal(readHandGesture(hand([false, false, false, false], false)).gesture, 'idle');
  assert.equal(readHandGesture(hand([true, true, false, false])).gesture, 'idle');
  assert.equal(readHandGesture(hand([false, true, false, false])).gesture, 'idle');
});

test('gesture recognition tolerates hand size, translation, rotation and mirroring', () => {
  for (const [fingers, expected] of [[[true, false, false, false], 'point'], [[true, true, true, true], 'palm']]) {
    for (const scale of [0.25, 0.7, 1]) {
      for (const angle of [-1.2, 0, 1.2]) {
        for (const mirror of [-1, 1]) {
          const transformed = hand(fingers).map(({ x, y }) => ({
            x: 0.5 + scale * ((x - 0.5) * Math.cos(angle) - (y - 0.5) * Math.sin(angle)) * mirror,
            y: 0.5 + scale * ((x - 0.5) * Math.sin(angle) + (y - 0.5) * Math.cos(angle)),
          }));
          assert.equal(readHandGesture(transformed, 1).gesture, expected);
        }
      }
    }
  }
});

test('camera aspect ratio does not distort gesture recognition', () => {
  for (const aspect of [0.75, 1, 4 / 3, 16 / 9]) {
    const points = hand().map(({ x, y }) => ({ x: x / aspect, y }));
    assert.equal(readHandGesture(points, aspect).gesture, 'palm');
  }
});

test('missing or collapsed landmarks never draw', () => {
  assert.equal(readHandGesture(null).gesture, 'none');
  assert.equal(readHandGesture([]).gesture, 'none');
  assert.equal(readHandGesture(Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))).gesture, 'idle');
});
