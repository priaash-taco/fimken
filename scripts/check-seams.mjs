// Measures how smoothly automatic training flows from move to move, in pose space, without a browser.
// Runs the freestyle director at 60 fps with a steady music state and reports, for hands and feet:
//   seam jerk    mean velocity change per frame during the first 0.3 s after each move starts (m/s per frame)
//   body jerk    the same inside moves (the baseline a performer produces anyway)
//   worst seam   the largest single-frame velocity change at any transition
// Lower seam jerk relative to body jerk means transitions carry momentum instead of popping.
//   node scripts/check-seams.mjs [--seconds 240] [--seed 7]
import { FreestyleDirector } from '../src/engine/freestyle-director.js';
import { loadMocapLibrary } from '../src/engine/mocap-moves.js';
await loadMocapLibrary(); // the captured clips load lazily; without them the pool (and the seam numbers) differ
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const seconds = Number(option('seconds', 240)), seed = Number(option('seed', 7)), dt = 1 / 60;
const d = new FreestyleDirector(seed); d.practice('freestyle');
const limbs = ['left', 'right', 'leftFoot', 'rightFoot'];
let prev = null, prevVel = null, lastMove = d.moveId, prevMove = null, sinceStart = 9, seam = [], body = [], worst = 0, transitions = 0, offenders = [];
const music = { energy: .5, rolling: .3, beatStrength: 0, section: 'flow', bpm: 0, confidence: 0 };
for (let i = 0; i < seconds * 60; i++) {
  music.beat = i % 30 === 0; music.beatCount = Math.floor(i / 30);
  d.update(dt, music);
  if (d.moveId !== lastMove) { prevMove = lastMove; lastMove = d.moveId; sinceStart = 0; transitions++; } else sinceStart += dt;
  const p = d.pose, pos = limbs.map(l => p[l]);
  if (prev) {
    const vel = pos.map((v, k) => v.map((x, j) => (x - prev[k][j]) / dt));
    if (prevVel) { const jerk = Math.max(...vel.map((v, k) => Math.hypot(...v.map((x, j) => x - prevVel[k][j])))); (sinceStart < .3 ? seam : body).push(jerk); if (sinceStart < .3) { worst = Math.max(worst, jerk); offenders.push({ jerk: +jerk.toFixed(2), from: prevMove, to: d.moveId, t: +sinceStart.toFixed(3), limb: limbs[vel.findIndex((v, k) => Math.hypot(...v.map((x, j) => x - prevVel[k][j])) === jerk)] }); } }
    prevVel = vel;
  }
  prev = pos.map(v => v.slice());
}
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), p95 = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length * .95)] || 0;
console.log(`transitions ${transitions} over ${seconds}s`);
console.log(`seam jerk   mean ${mean(seam).toFixed(2)}  p95 ${p95(seam).toFixed(2)}  worst ${worst.toFixed(2)}  m/s per frame`);
console.log(`body jerk   mean ${mean(body).toFixed(2)}  p95 ${p95(body).toFixed(2)}`);
console.log(`ratio seam/body (mean) ${(mean(seam) / mean(body)).toFixed(2)}`);
if (args.includes('--top')) console.log('worst seams', JSON.stringify(offenders.sort((a, b) => b.jerk - a.jerk).slice(0, 6)));
