import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHOWCASE_MOVES } from '../src/engine/showcase-director.js';
const data = JSON.parse(readFileSync(new URL('../src/engine/mocap/clips.json', import.meta.url), 'utf8'));
const finite = v => (Array.isArray(v) ? v.every(finite) : Number.isFinite(v));
test('converted capture clips are well formed and registered as moves', () => {
  assert.ok(data.clips.length >= 20, 'a useful library of clips');
  for (const clip of data.clips) {
    assert.ok(clip.keys.length >= 30, `${clip.id} has enough frames`);
    for (let i = 1; i < clip.keys.length; i++) assert.ok(clip.keys[i].at > clip.keys[i - 1].at, `${clip.id} key times increase`);
    for (const key of clip.keys) for (const [name, value] of Object.entries(key)) assert.ok(finite(value), `${clip.id} ${name} is finite`);
    for (const cue of clip.cues) assert.ok(cue.at >= 0 && cue.at <= clip.duration, `${clip.id} cue is inside the clip`);
    assert.ok(SHOWCASE_MOVES['mocap_' + clip.id], `${clip.id} is registered`);
  }
});
test('captured poses stay inside what the rig can reach', () => {
  for (const clip of data.clips) for (const key of clip.keys) {
    for (const hand of [key.left, key.right]) assert.ok(hand[1] > .3 && hand[1] < 2.1 && Math.hypot(hand[0], hand[2]) < 1.1, `${clip.id} hand target is reachable`);
    assert.ok(key.crouch > -.15 && key.crouch < .6, `${clip.id} crouch is sane`);
    assert.ok(Math.abs(key.lean) < 1.3 && Math.abs(key.twist) < 1.3, `${clip.id} torso angles are sane`);
  }
});
