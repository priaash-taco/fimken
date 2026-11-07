import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShowcaseDirector, SHOWCASE_MOVES, inertial, BLEND_TIME } from '../src/engine/showcase-director.js';
import { FreestyleDirector } from '../src/engine/freestyle-director.js';

test('inertial curve starts at the offset with the carried velocity, decays to zero and never reverses sign', () => {
  const c = inertial(.5, 3, .35);
  assert.ok(Math.abs(c(0) - .5) < 1e-9);
  assert.ok((c(.01) - c(0)) / .01 > 2, 'initial slope follows the carried velocity');
  assert.equal(c(.35), 0); assert.equal(c(1), 0);
  for (let t = 0; t <= .35; t += .005) assert.ok(c(t) >= -1e-6, 'offset never crosses zero and comes back');
  const away = inertial(.3, -4, .35); for (let t = 0; t <= .35; t += .005) assert.ok(away(t) >= -1e-6 && away(t) <= .3 + 1e-6);
  assert.equal(inertial(0, 0, .35)(.1), 0);
});

test('a switch carries momentum: the hand keeps travelling before settling into the new move', () => {
  const d = new ShowcaseDirector(); d.practice('strikes'); for (let t = 0; t < .42; t += 1 / 60) d.update(1 / 60);
  const before = structuredClone(d.pose), forward = d.poseVel.left[2] > 2;
  assert.ok(forward, 'the jab is still moving forward at this time');
  d.practice('relaxedIdle'); assert.deepEqual(d.pose, before, 'no pop at the switch');
  const z = []; for (let i = 0; i < 8; i++) { d.update(1 / 60); z.push(d.pose.left[2]); }
  assert.ok(z[1] > before.left[2] && z[2] > z[1], 'the hand continues forward for a few frames');
  for (let t = 0; t < BLEND_TIME * 2; t += 1 / 60) d.update(1 / 60);
  const settled = d.pose.left[2]; d.update(1 / 60); assert.ok(Math.abs(d.pose.left[2] - settled) < .05, 'then it is on the new move');
});

test('motion matching enters a captured clip at the closest matching frame and never cuts a strike', () => {
  const d = new FreestyleDirector(3); d.practice('freestyle');
  for (let i = 0; i < 30 * 60; i++) d.update(1 / 60, { energy: .5, rolling: .3, beatStrength: 0, beat: i % 30 === 0, beatCount: Math.floor(i / 30), section: 'flow' });
  const ids = ['mocap_135_07_0', 'mocap_135_09_0', 'mocap_144_13_0'];
  for (const id of ids) {
    const entries = d.entries(id); assert.ok(entries.length >= 1 && entries[0] === 0);
    const firstCue = Math.min(...SHOWCASE_MOVES[id].cues.map(c => c.at));
    for (const at of entries) assert.ok(at <= firstCue - .4 + 1e-9, 'entries stay well before the first strike');
    const pick = d.match([id]); assert.equal(pick.id, id); assert.ok(pick.cost >= 0);
  }
  const t0 = d.cost('mocap_135_07_0', 0, false), t1 = d.cost('mocap_135_07_0', d.entries('mocap_135_07_0').at(-1), false);
  assert.ok(Number.isFinite(t0) && Number.isFinite(t1));
});
