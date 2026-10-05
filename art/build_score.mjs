// Original, deterministic 20-second cue. No external samples or services.
import { mkdirSync, writeFileSync } from 'node:fs';
const rate = 32000, seconds = 20, count = rate * seconds;
const output = Buffer.alloc(44 + count * 4);
output.write('RIFF'); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8);
output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(2, 22);
output.writeUInt32LE(rate, 24); output.writeUInt32LE(rate * 4, 28); output.writeUInt16LE(4, 32); output.writeUInt16LE(16, 34);
output.write('data', 36); output.writeUInt32LE(count * 4, 40);
let random = 17;
const notes = [146.83, 220, 261.63, 329.63, 293.66, 220, 196, 164.81];
for (let i = 0; i < count; i++) {
  const t = i / rate, beat = t % .5, eighth = t % .25;
  const chord = Math.floor(t / 4) % 3, roots = [73.416, 65.406, 82.407];
  const fade = Math.min(1, t / 1.5, (seconds - t) / 1.3);
  const pad = [1, 1.5, 2, 2.375].reduce((sum, interval, index) => sum + Math.sin(t * roots[chord] * interval * Math.PI * 2 + Math.sin(t * .4 + index) * .15) * .024, 0);
  const rise = t >= 4 && t < 8 ? (t - 4) / 4 : 0;
  const drive = t >= 8 && t < 14 ? 1 : t >= 14 && t < 18.5 ? .55 : rise * .55;
  const kick = Math.sin(Math.PI * 2 * (42 * beat + 10 * (1 - Math.exp(-beat * 22)))) * Math.exp(-beat * 15) * .35 * drive;
  random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
  const noise = random / 4294967296 * 2 - 1;
  const hat = noise * Math.exp(-eighth * 95) * .035 * drive;
  const hitTime = t - 8;
  const impact = hitTime >= 0 ? (Math.sin(2 * Math.PI * 38 * hitTime) * .18 + noise * .025) * Math.exp(-hitTime * 2.8) : 0;
  const note = notes[Math.floor(t * 4) % notes.length];
  const chime = Math.sin(t * note * Math.PI * 2) * Math.exp(-eighth * 10) * (.024 + drive * .02);
  const whoosh = noise * (rise ** 3 * .04 + (t > 14 && t < 15 ? Math.sin((t - 14) * Math.PI) * .045 : 0));
  const value = (pad + kick + hat + impact + chime + whoosh) * fade;
  for (let side = 0; side < 2; side++) {
    const pan = chime * Math.sin(t * .6 + side * Math.PI) * .2;
    output.writeInt16LE(Math.round(Math.tanh((value + pan) * 1.2) * 26000), 44 + i * 4 + side * 2);
  }
}
mkdirSync('public/audio', { recursive: true });
writeFileSync('public/audio/first-light.wav', output);
console.log('First Light: 20 seconds, stereo PCM, 120 BPM.');
