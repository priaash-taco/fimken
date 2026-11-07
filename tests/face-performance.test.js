import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FacePerformance } from '../src/engine/face-performance.js';
const NAMES = ['focus', 'shout', 'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'browDownLeft', 'browInnerUp', 'eyeWideLeft', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight'];
function fakeHead() { const root = new THREE.Group(), m = new THREE.Mesh(new THREE.BufferGeometry()); m.morphTargetDictionary = Object.fromEntries(NAMES.map((n, i) => [n, i])); m.morphTargetInfluences = NAMES.map(() => 0); root.add(m); return { root, m }; }
const idle = { focus: .15, shout: 0, power: .22, fist: 0, hitStop: 0, tension: 0, beam: 0 };

test('the face blinks on its own, every few seconds, with both lids together and never during a hit-stop', () => {
  const { root, m } = fakeHead(), face = new FacePerformance(root, 3); let blinks = 0, open = true, maxL = 0;
  for (let t = 0; t < 30; t += 1 / 60) { face.update(1 / 60, idle, null, t); const b = m.morphTargetInfluences[2]; maxL = Math.max(maxL, b); assert.equal(m.morphTargetInfluences[3], b, 'both eyes blink together'); if (open && b > .5) { blinks++; open = false; } if (b < .05) open = true; }
  assert.ok(blinks >= 4 && blinks <= 16, `blinked ${blinks} times in 30 s`); assert.ok(maxL > .95, 'the lids close fully');
  const held = new FacePerformance(root, 3); let any = 0; for (let t = 0; t < 20; t += 1 / 60) { held.update(1 / 60, { ...idle, hitStop: 1 }, null, t); any = Math.max(any, m.morphTargetInfluences[2]); }
  assert.equal(any, 0, 'no blink while a hit is frozen');
});

test('focus narrows the eyes and lowers the brows, a shout opens the jaw, calm music brings a small smile, all within 0..1', () => {
  const { root, m } = fakeHead(), face = new FacePerformance(root, 1);
  for (let t = 0; t < 3; t += 1 / 60) face.update(1 / 60, { ...idle, focus: 1, tension: 1, power: 1 }, { rolling: .6 }, t);
  assert.ok(m.morphTargetInfluences[4] > .4 && m.morphTargetInfluences[5] > .4, 'squint and brow down under focus');
  for (let t = 0; t < 3; t += 1 / 60) face.update(1 / 60, { ...idle, shout: 1 }, { rolling: .6 }, t);
  assert.ok(m.morphTargetInfluences[8] > .8, 'jaw opens on a shout');
  for (let t = 0; t < 6; t += 1 / 60) face.update(1 / 60, idle, { rolling: .05 }, t);
  assert.ok(m.morphTargetInfluences[9] > .1 && m.morphTargetInfluences[10] > .1, 'smile when quiet and relaxed');
  for (const v of m.morphTargetInfluences) assert.ok(v >= 0 && v <= 1);
});
