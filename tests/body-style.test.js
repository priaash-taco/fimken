import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BodyStyle } from '../src/engine/body-style.js';
const base = () => ({ twist: .2, lean: .1, bank: .05, crouch: .2, lift: 0, yaw: 0, hipYaw: 0, headYaw: 0, hipShift: [0, 0], left: [.3, 1.2, .4], right: [-.3, 1.0, .1], leftFoot: [0, 0, 0], rightFoot: [0, 0, 0], trails: [0, 0, 0], travel: [0, 0] });
const run = (style, pose, vel, frames = 60) => { let p; for (let i = 0; i < frames; i++) p = style.apply({ ...pose, hipShift: [...pose.hipShift] }, vel, 1 / 60); return p; };

test('exaggeration pushes torso and reaches away from neutral and does nothing at zero', () => {
  const off = new BodyStyle(); off.exaggeration = 0; const p0 = run(off, base(), {});
  assert.ok(Math.abs(p0.twist - .2) < 1e-9 && Math.abs(p0.lean - .1) < 1e-9 && Math.abs(p0.left[2] - .4) < 1e-9);
  const on = new BodyStyle(); on.exaggeration = 1; const p1 = run(on, base(), {});
  assert.ok(p1.twist > .25 && p1.lean > .12 && p1.crouch > .2, 'torso channels grow');
  assert.ok(p1.left[2] > .4 && Math.hypot(p1.left[0], p1.left[2]) > Math.hypot(.3, .4), 'the reach goes further out');
});

test('balance shifts the hips toward the planted foot when the other foot lifts and settles back when both are down', () => {
  const s = new BodyStyle(); s.exaggeration = 0;
  const lifted = base(); lifted.rightFoot = [0, .3, .2];
  const p = run(s, lifted, {}, 120);
  assert.ok(p.hipShift[0] > .01, 'hips move toward the left (planted) foot');
  const both = run(s, base(), {}, 240);
  assert.ok(Math.abs(both.hipShift[0]) < .01, 'two planted feet: the shift settles near the centre');
});

test('a turn is led by the hips and the gaze, and travel turns the head into the direction of motion', () => {
  const s = new BodyStyle(); s.exaggeration = 0;
  const turning = run(s, base(), { yaw: 2 }, 60);
  assert.ok(turning.hipYaw > .05 && turning.headYaw > .05, 'hips and head lead a left turn');
  assert.ok(turning.twist < .2, 'the torso trails the hips');
  const t = new BodyStyle(); t.exaggeration = 0;
  const moving = run(t, base(), { travel: [1.2, 0] }, 90);
  assert.ok(moving.headYaw > .1, 'the head looks into the direction of travel');
  const d = new BodyStyle(); d.enabled = false; const same = d.apply({ ...base() }, { yaw: 2 }, 1 / 60); assert.equal(same.hipYaw, 0);
});
