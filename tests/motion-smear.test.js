import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MotionSmear } from '../src/engine/motion-smear.js';

function rig() {
  const root = new THREE.Group(), bones = {};
  const mk = (name, parent, y) => { const b = new THREE.Bone(); b.position.set(0, y, 0); parent.add(b); bones[name] = b; return b; };
  const upper = mk('leftUpperArm', root, 1.4), lower = mk('leftLowerArm', upper, .3), hand = mk('leftHand', lower, .3);
  root.updateMatrixWorld(true);
  const heroFinish = { smear: { count: { value: 0 }, pos: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3()) }, vel: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3()) } } };
  const actor = { root, model: root, rigControls: { bones }, heroFinish };
  const smear = new MotionSmear(actor); smear.enabled = true;
  return { root, bones, hand, actor, smear, heroFinish };
}
const step = (r, v, dt, pose) => { r.hand.position.y += v * dt; r.root.updateMatrixWorld(true); r.smear.update(dt, pose); r.root.updateMatrixWorld(true); };

test('velocity is tracked from bone motion', () => {
  const r = rig(); const dt = 1 / 60;
  for (let i = 0; i < 30; i++) step(r, 8, dt, { trails: [1, 0, 0] });
  assert.ok(Math.abs(r.smear.state[0].vel.length() - 8) < .3);
});

test('limb stretches above the threshold and decays back to 1', () => {
  const r = rig(); const dt = 1 / 60;
  for (let i = 0; i < 20; i++) step(r, 9, dt, { trails: [1, 0, 0], hitStop: 1 });
  assert.ok(r.bones.leftLowerArm.scale.y > 1.1);
  assert.ok(r.bones.leftUpperArm.scale.y > 1 && r.bones.leftUpperArm.scale.y < r.bones.leftLowerArm.scale.y);
  assert.ok(r.heroFinish.smear.count.value >= 1);
  for (let i = 0; i < 15; i++) step(r, 0, dt, {});
  assert.equal(r.bones.leftLowerArm.scale.y, 1);
  assert.equal(r.heroFinish.smear.count.value, 0);
});

test('slow motion never stretches and scale is always reset', () => {
  const r = rig(); const dt = 1 / 60;
  for (let i = 0; i < 30; i++) step(r, 1.5, dt, { trails: [1, 0, 0], hitStop: 1 });
  assert.equal(r.bones.leftLowerArm.scale.y, 1);
  r.bones.leftLowerArm.scale.set(1.3, 1.3, 1.3); r.smear.scaled.add(r.bones.leftLowerArm);
  step(r, 1.5, dt, {});
  assert.equal(r.bones.leftLowerArm.scale.y, 1);
});

test('mid-speed without a strike cue does not stretch, teleports and dt 0 are ignored, disabled stays flat', () => {
  const r = rig(); const dt = 1 / 60;
  for (let i = 0; i < 20; i++) step(r, 4.5, dt, {});
  assert.equal(r.bones.leftLowerArm.scale.y, 1);
  r.root.position.x += 5; r.root.updateMatrixWorld(true); r.smear.update(dt, { trails: [1, 0, 0] });
  assert.equal(r.bones.leftLowerArm.scale.y, 1);
  r.smear.update(0, {});
  assert.equal(r.bones.leftLowerArm.scale.y, 1);
  r.smear.enabled = false;
  for (let i = 0; i < 20; i++) step(r, 9, dt, { trails: [1, 0, 0] });
  assert.equal(r.bones.leftLowerArm.scale.y, 1);
});
