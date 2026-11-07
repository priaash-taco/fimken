import test from 'node:test';
import assert from 'node:assert/strict';
// Release QA: a planted foot never sinks below its standing height, even when the leg keep-out pushes it
// while the other leg kicks past it, or when a captured clip carries a negative foot offset.
test('planted ankles stay at or above the floor under a kick and under negative foot offsets', async () => {
  const THREE = await import('three'); const { HeroRigControls } = await import('../src/engine/hero-rig-controls.js');
  const fs = await import('node:fs'); const definition = JSON.parse(fs.readFileSync('src/engine/hero-asset.json', 'utf8')); const bytes = fs.readFileSync('public' + definition.url);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const nodes = gltf.nodes.map(n => { const b = new THREE.Bone(); b.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) b.position.fromArray(n.translation); if (n.rotation) b.quaternion.fromArray(n.rotation); if (n.scale) b.scale.fromArray(n.scale); return b; });
  gltf.nodes.forEach((n, i) => n.children?.forEach(c => nodes[i].add(nodes[c])));
  const model = new THREE.Group(); gltf.scenes[gltf.scene || 0].nodes.forEach(i => model.add(nodes[i])); model.scale.setScalar(2 / 2.3);
  const root = new THREE.Group(); root.add(model); const rig = new HeroRigControls({ root, model, definition });
  const { SHOWCASE_MOVES, samplePose } = await import('../src/engine/showcase-director.js');
  const base = { ...samplePose(SHOWCASE_MOVES.strikes.keys, 0), hitStop: 0, lift: 0, flip: 0 };
  const ankle = side => rig.bones[side + 'Foot'].getWorldPosition(new THREE.Vector3()).y;
  rig.apply({ ...base, leftFoot: [0, 0, 0], rightFoot: [0, 0, 0] }, 1, {});
  const rest = ankle('left');
  const sunk = { ...base, leftFoot: [0, -.06, 0], rightFoot: [0, -.04, 0] };
  rig.apply(sunk, 1, {});
  assert.ok(ankle('left') > rest - .006 && ankle('right') > rest - .006, `negative foot offsets are clamped: ${(ankle('left') - rest).toFixed(3)} ${(ankle('right') - rest).toFixed(3)}`);
  // Right leg kicks across the left (planted) leg: the keep-out pushes the planted foot, but not into the floor.
  const kick = { ...base, rightFoot: [-.25, .75, .3], leftFoot: [0, 0, 0], trails: [0, 0, 1], crouch: .09 };
  rig.apply(kick, 1, {});
  assert.ok(ankle('left') > rest - .006, `planted ankle stays above the floor during a cross kick: ${(ankle('left') - rest).toFixed(3)}`);
});
