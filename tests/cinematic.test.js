import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioAnalyzer, MusicState } from '../src/engine/music-state.js';
import { SceneDirector } from '../src/engine/scene-director.js';
import { readFileSync } from 'node:fs';
import { resolveCharacter } from '../src/engine/assets.js';
import * as THREE from 'three';
import { AnimationDirector } from '../src/engine/animation-director.js';

test('a completed clamped action fades out fully when the next action starts', () => {
  const root = new THREE.Object3D();
  const clip = (name, value) => new THREE.AnimationClip(name, .1, [new THREE.NumberKeyframeTrack('.position[x]', [0, .1], [value, value])]);
  const director = new AnimationDirector(root, [clip('Idle', 0), clip('Power', 2)], { idle: 'Idle', powerup: 'Power' });
  director.play('powerup', .01); director.update(.3, { energy: 0 });
  assert.ok(root.position.x > 1.9); assert.equal(director.active.paused, true);
  director.play('idle', .1); director.update(.2, { energy: 0 });
  assert.ok(Math.abs(root.position.x) < .001, 'the old clamped clip must no longer affect the pose');
});

test('audio bands track physical frequencies across sample rates', () => {
  for (const rate of [44100, 48000]) {
    const bins = new Uint8Array(512);
    bins[Math.round(100 / (rate / 1024))] = 255;
    const result = new AudioAnalyzer().analyse(bins, rate);
    assert.ok(result.bass > .3);
    assert.equal(result.highs, 0);
  }
});
test('onsets estimate tempo; sustained sound and silence do not invent beats', () => {
  const music = new MusicState();
  for (let frame = 0; frame < 600; frame++) music.update(1 / 60, {
    bass: .6, mids: .2, highs: .1, energy: .4, flux: frame % 30 === 0 ? .15 : 0,
  }, true);
  assert.ok(Math.abs(music.bpm - 120) <= 1);
  const beats = music.beatCount;
  for (let frame = 0; frame < 240; frame++) music.update(1 / 60, { bass: .6, mids: .2, highs: .1, energy: .4, flux: 0 }, true);
  assert.equal(music.beatCount, beats); assert.equal(music.bpm, null);
  for (let frame = 0; frame < 600; frame++) music.update(1 / 60, { flux: 0 }, false);
  assert.equal(music.section, 'quiet'); assert.ok(music.energy < .001);
});
test('the 20-second scene resolves into a held opening, power event, flight and landing', () => {
  const director = new SceneDirector();
  const at = seconds => { director.time = seconds - .01; director.update(.01, {}, true); return director.state; };
  assert.equal(at(1), 'idle'); assert.equal(at(6), 'powerup'); assert.equal(at(8.2), 'blast');
  assert.equal(at(10), 'gesture'); assert.equal(at(14.5), 'jump'); assert.equal(at(17), 'float');
  assert.equal(at(19), 'land'); assert.equal(at(20.5), 'idle');
});
test('manual choreography finishes and live drops recover without a frozen attack pose', () => {
  const director = new SceneDirector();
  director.practice('blast');
  for (let i = 0; i < 700; i++) director.update(1 / 60, {}, true);
  assert.equal(director.manual, null);
  director.reset(); director.cutAge = 4;
  const music = { drop: true, bpm: 120, beatCount: 16, section: 'peak' };
  director.update(.01, music, false); assert.equal(director.state, 'blast');
  music.drop = false;
  for (let i = 0; i < 100; i++) director.update(1 / 60, music, false);
  assert.equal(director.state, 'recover');
});
test('the archived debug character retains its compatible embedded animations', () => {
  const CHARACTER = resolveCharacter('?character=debug-goku');
  const bytes = readFileSync(new URL(`../public${CHARACTER.url}`, import.meta.url));
  const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.equal(CHARACTER.id, 'goku');
  assert.ok(model.skins.length > 0); assert.ok(model.images.length >= 4);
  assert.ok(model.nodes.some(node => node.name === 'head'));
  for (const clip of Object.values(CHARACTER.clips)) assert.ok(model.animations.some(a => a.name === clip), clip);
  const textured = model.materials.filter(m => m.pbrMetallicRoughness?.baseColorTexture);
  assert.ok(textured.length >= 4, 'character materials must embed their generated colour artwork');
  assert.equal(CHARACTER.animations, undefined, 'the live actor must use its compatible embedded skeleton clips');
});


test('camera phase transitions are continuous, including field of view',async()=>{
 const {CinematicDirector}=await import('../src/engine/cinematic-director.js');const camera=new THREE.PerspectiveCamera(32,1,.1,100),controls={target:new THREE.Vector3()};const d=new CinematicDirector(camera,controls),origin=new THREE.Vector3();
 d.update(0,{shot:'chargeHero',revision:1,progress:.8},origin,'training',true);const before=camera.position.clone(),fov=camera.fov;
 d.update(1/60,{shot:'beamHero',revision:2,progress:0},origin);
 assert.ok(camera.position.distanceTo(before)<.3,'shot changes must not teleport the camera');assert.ok(Math.abs(camera.fov-fov)<.3);
 for(let i=0;i<240;i++)d.update(1/60,{shot:'beamHero',revision:2,progress:1},origin);
 assert.ok(camera.position.distanceTo(new THREE.Vector3(-3.4,1.4,3.8))<.01);
});
