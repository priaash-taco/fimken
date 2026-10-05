import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatPhysics } from '../src/physics.js';

test('solo physics applies recoil and resets to the centre without a second body', () => {
  const world = new CombatPhysics(true);
  assert.equal(world.bodies.length, 1);
  world.bodies[0].impulse(-2, .3, -2);
  world.update(.1);
  assert.ok(world.bodies[0].position.x < 0);
  assert.equal(world.contacts, 0);
  world.reset();
  assert.deepEqual(world.bodies[0].position, { x: 0, y: 0, z: 0 });
  assert.deepEqual(world.bodies[0].velocity, { x: 0, y: 0, z: 0 });
});

test('fixed steps produce the same motion at 30 and 120 Hz', () => {
  const simulate = rate => {
    const world = new CombatPhysics();
    world.bodies[0].target.x = -1;
    world.bodies[0].impulse(3, 1, .2);
    for (let i = 0; i < rate * 3; i++) world.update(1 / rate);
    return world.bodies[0].position;
  };
  const a = simulate(30), b = simulate(120);
  for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(a[axis] - b[axis]) < 1e-8);
});

test('collisions separate bodies, reverse approach and emit an impact', () => {
  const world = new CombatPhysics();
  const [a, b] = world.bodies;
  a.position.x = a.target.x = -.5;
  b.position.x = b.target.x = .5;
  a.velocity.x = 4; b.velocity.x = -4;
  let impact;
  world.oncontact = event => { impact = event; };
  world.step(1 / 120);
  assert.ok(b.position.x - a.position.x >= a.radius + b.radius - 1e-8);
  assert.ok(a.velocity.x < 0 && b.velocity.x > 0);
  assert.ok(Math.abs(a.velocity.x + b.velocity.x) < 1e-8);
  assert.ok(impact.strength > 0);
});

test('pause holds state and large frame gaps remain bounded', () => {
  const world = new CombatPhysics();
  world.enabled = false;
  world.bodies[0].impulse(200);
  world.update(5);
  assert.equal(world.bodies[0].position.x, -3.35);
  world.enabled = true;
  world.update(5);
  assert.ok(Math.abs(world.bodies[0].position.x) <= 7);
  assert.ok(world.time <= .101);
});
