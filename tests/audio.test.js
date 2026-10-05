import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';

class Track extends EventTarget {
  readyState = 'live';
  stop() { this.readyState = 'ended'; }
  end() { this.stop(); this.dispatchEvent(new Event('ended')); }
}
function stream(audio = true) {
  const sound = new Track();
  const video = new Track();
  return {
    getTracks: () => audio ? [sound, video] : [video],
    getAudioTracks: () => audio ? [sound] : [],
    sound, video,
  };
}
class Context {
  async resume() {}
  createAnalyser() { return { getByteFrequencyData: bins => bins.fill(100) }; }
  createMediaStreamSource() {
    return { connected: false, connect() { this.connected = true; }, disconnect() { this.connected = false; } };
  }
}
globalThis.AudioContext = Context;
function devices(value) { Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: value }, configurable: true }); }

test('microphone analysis and stop release every track without speaker output', async () => {
  const input = stream();
  let options;
  devices({ getUserMedia: async value => { options = value; return input; } });
  const audio = new AudioEngine();
  await audio.connect('mic');
  assert.equal(audio.mode, 'mic');
  assert.equal(options.audio.echoCancellation, false);
  assert.equal(audio.spectrum()[0], 100);
  const source = audio.source;
  audio.stop();
  assert.equal(source.connected, false);
  assert.ok(input.getTracks().every(track => track.readyState === 'ended'));
  assert.equal(audio.spectrum()[0], 0);
});

test('capture without audio rejects and releases video', async () => {
  const input = stream(false);
  devices({ getDisplayMedia: async () => input });
  const audio = new AudioEngine();
  await assert.rejects(audio.connect('pc'), /No audio was shared/);
  assert.equal(input.video.readyState, 'ended');
  assert.equal(audio.mode, 'idle');
});

test('late permission result cannot override a cancelled request or demo', async () => {
  const input = stream();
  let resolve;
  devices({ getUserMedia: () => new Promise(done => { resolve = done; }) });
  const audio = new AudioEngine();
  const connecting = audio.connect('mic');
  audio.demo();
  resolve(input);
  await connecting;
  assert.equal(audio.mode, 'demo');
  assert.ok(input.getTracks().every(track => track.readyState === 'ended'));
});

test('browser stop-sharing ends the entire session', async () => {
  const input = stream();
  devices({ getDisplayMedia: async () => input });
  const audio = new AudioEngine();
  await audio.connect('tab');
  input.video.end();
  assert.equal(audio.mode, 'idle');
  assert.equal(input.sound.readyState, 'ended');
});

test('switching input releases the previous stream', async () => {
  const mic = stream();
  const tab = stream();
  devices({ getUserMedia: async () => mic, getDisplayMedia: async () => tab });
  const audio = new AudioEngine();
  await audio.connect('mic');
  await audio.connect('tab');
  assert.equal(audio.mode, 'tab');
  assert.ok(mic.getTracks().every(track => track.readyState === 'ended'));
  assert.equal(tab.sound.readyState, 'live');
  audio.stop();
});

test('permission denial is recoverable', async () => {
  devices({ getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
  const audio = new AudioEngine();
  await assert.rejects(audio.connect('mic'), { name: 'NotAllowedError' });
  audio.demo();
  assert.equal(audio.mode, 'demo');
  assert.ok(audio.spectrum().some(value => value > 0));
});

test('switching local music to microphone disconnects speaker routing', async () => {
  const audio = new AudioEngine();
  const analyser = { connected: false, connect() { this.connected = true; }, disconnect() { this.connected = false; } };
  const playback = { connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; } };
  audio.context = {
    resume: async () => {}, destination: {}, decodeAudioData: async () => ({}),
    createBufferSource: () => playback,
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
  };
  audio.analyser = analyser;
  await audio.file({ name: 'music.wav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) });
  assert.equal(analyser.connected, true);
  devices({ getUserMedia: async () => stream() });
  await audio.connect('mic');
  assert.equal(playback.stopped, true);
  assert.equal(analyser.connected, false);
  assert.equal(audio.mode, 'mic');
  audio.stop();
});

test('a cancelled local decode cannot replace the active demo', async () => {
  const audio = new AudioEngine();
  let decode;
  const decoding = new Promise(resolve => { decode = resolve; });
  let started = false;
  audio.context = {
    resume: async () => {}, decodeAudioData: () => decoding,
    createBufferSource: () => { started = true; throw new Error('Must not create playback'); },
  };
  audio.analyser = {};
  const request = audio.file({ name: 'music.wav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) });
  audio.demo();
  decode({});
  await request;
  assert.equal(audio.mode, 'demo');
  assert.equal(started, false);
});
