import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Director } from '../src/director.js';

test('solo practice completes every action without an audio source', () => {
  const director = new Director();
  const bins = new Uint8Array(512);
  const states = new Set();
  for (let frame = 0; frame < 1500; frame++) {
    states.add(director.update(1 / 60, bins, .65, false));
  }
  for (const action of ['move', 'punch', 'kick', 'dodge', 'powerup', 'charge', 'blast', 'recover']) assert.ok(states.has(action), action);
  assert.equal(director.energy, 0);
});

test('manual energy practice completes and resumes the selected martial routine', () => {
  const director = new Director();
  director.mode = 'melee';
  director.practice('blast');
  const states = new Set();
  for (let frame = 0; frame < 1600; frame++) states.add(director.update(1 / 60, new Uint8Array(512), .65, false));
  assert.ok(states.has('charge') && states.has('blast') && states.has('punch'));
  assert.equal(director.sequence, null);
  const martial = new Set();
  for (let frame = 0; frame < 1000; frame++) martial.add(director.update(1 / 60, new Uint8Array(512), .65, false));
  assert.ok(!martial.has('blast') && !martial.has('powerup'));
});

test('steady sound does not become a new beat every frame', () => {
  const director = new Director();
  const bins = new Uint8Array(512).fill(150);
  for (let frame = 0; frame < 600; frame++) director.update(1 / 60, bins, .65, true);
  assert.ok(director.beats <= 3);
});

test('paused choreography holds its pose while sound analysis continues', () => {
  const director = new Director();
  director.state = 'charge';
  director.elapsed = 1;
  director.enabled = false;
  const bins = new Uint8Array(512).fill(160);
  for (let frame = 0; frame < 300; frame++) director.update(1 / 60, bins, .65, true);
  assert.equal(director.state, 'charge');
  assert.equal(director.elapsed, 1);
  assert.ok(director.energy > .1);
});
