import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRegions, SecondaryMotion, stepSpring } from '../src/engine/secondary-motion.js';

function fakeMesh() {
  // Four vertices: two on bone A (one low, one high), one on bone B, one split 50/50 between A and B.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, .1, 0, 0, .9, 0, 0, .5, 0, 0, .5, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, .5, .5, 0, 0], 4));
  return { geometry };
}

const rules = [
  { name: 'low', bones: ['a'], test: (p, b, w) => w < .6 ? 0 : 1 - p.y },
  { name: 'other', bones: ['b'], test: () => .5 },
];

test('buildRegions assigns ids and soft weights by rule', () => {
  const mesh = fakeMesh();
  const { ids, weights } = buildRegions(mesh, ['a', 'b'], rules);
  assert.deepEqual(Array.from(ids).slice(0, 3), [0, 0, 1]);
  assert.ok(Math.abs(weights[0] - .9) < 1e-6 && Math.abs(weights[1] - .1) < 1e-6);
  assert.equal(weights[2], .5);
  assert.equal(weights[3], 0, 'a split vertex that fails the listed-weight test is not in the region');
  assert.ok(mesh.geometry.attributes.regionId && mesh.geometry.attributes.regionWeight);
});

test('region spring trails acceleration and settles', () => {
  const s = { x: new THREE.Vector3(), v: new THREE.Vector3() };
  const target = new THREE.Vector3(-.05, 0, 0);
  let peak = 0;
  for (let i = 0; i < 30; i++) { stepSpring(s, target, 12, .4, 1 / 60); peak = Math.min(peak, s.x.x); }
  assert.ok(peak < -.02, 'moves opposite the push');
  for (let i = 0; i < 600; i++) stepSpring(s, new THREE.Vector3(), 12, .4, 1 / 60);
  assert.ok(s.x.length() < 1e-3 && s.v.length() < 1e-2, 'settles back to rest');
});

test('SecondaryMotion trails a moving anchor and passes dt=0 through', () => {
  const root = new THREE.Group(); const hips = new THREE.Object3D(); root.add(hips);
  const motion = new SecondaryMotion(root, [{ name: 'sash', bones: ['hips'], test: () => 1, anchor: 'hips', w: 13, z: .3, max: .04, kv: .01, ka: .001, sag: 0, wind: 0 }]);
  motion.reduced = 1;
  motion.update(1 / 60, { hips }, null);
  for (let i = 0; i < 20; i++) { hips.position.x += .1 / 60 * 6; root.updateMatrixWorld(true); motion.update(1 / 60, { hips }, null); }
  const moved = motion.offsets[0].x;
  assert.ok(moved < -.005 && moved >= -.0461, 'trails opposite the motion, within the cap: ' + moved);
  motion.update(0, { hips }, null);
  assert.equal(motion.offsets[0].x, moved);
});
