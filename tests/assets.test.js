import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const id of ['goku', 'beerus']) test(`${id} ships an embedded, skinned model with all combat clips`, () => {
  const bytes = readFileSync(new URL(`../public/characters/${id}.glb`, import.meta.url));
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.ok(gltf.skins[0].joints.length >= 16);
  assert.ok(gltf.images.length >= 3);
  assert.ok(gltf.images.every(image => image.bufferView != null && !image.uri));
  for (const name of ['hover', 'charge', 'rush', 'clash', 'punch', 'kick', 'dodge', 'recover']) {
    const clip = gltf.animations.find(animation => animation.name === name);
    assert.ok(clip?.channels.length > 0, `${name} must animate the rig`);
  }
  if (id === 'goku') for (const name of ['move', 'powerup', 'blast']) assert.ok(gltf.animations.some(clip => clip.name === name));
  assert.ok(gltf.meshes.every(mesh => mesh.primitives.every(p => p.attributes.JOINTS_0 != null && p.attributes.WEIGHTS_0 != null)));
});
