// Plays every move live and reports real penetration of the final skeleton into the torso:
// hand points, forearms, upper arms and elbows against the spine segment (hips to neck).
// Clearance is the distance to the spine line minus the torso radius (.19) minus the limb radius.
// Anything below -0.02 m means the limb is visibly inside the body.
//   node scripts/check-penetration.mjs [--port 5174] [--only id,id]
import { chromium } from '@playwright/test';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
await page.goto(`http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5174)}/?controls=1`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
const only = option('only', '');
const r = await page.evaluate(async only => {
  const s = window.__fimken, b = s.actor.rigControls.bones, V = b.hips.position.constructor;
  const P = k => b[k].getWorldPosition(new V());
  const dist = (p, a, c) => { const ac = c.clone().sub(a), t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ac) / Math.max(ac.dot(ac), 1e-9))); return p.distanceTo(a.clone().addScaledVector(ac, t)); };
  const segDist = (a0, a1, b0, b1) => { let best = 9; for (let i = 0; i <= 6; i++) { const p = a0.clone().lerp(a1, i / 6); best = Math.min(best, dist(p, b0, b1)); } return best; };
  const ids = only ? only.split(',') : s.moveIds(), out = {}; s.autoCamera = false;
  for (const id of ids) {
    s.practice(id); const worst = { hand: [9, 0], forearm: [9, 0], upper: [9, 0], elbow: [9, 0] }; const t0 = performance.now();
    await new Promise(done => { const tick = () => {
      const h = P('hips'), n = P('neck'), t = s.director.time;
      for (const side of ['left', 'right']) {
        const hand = P(side + 'Hand'), low = P(side + 'LowerArm'), up = P(side + 'UpperArm');
        const c = [['hand', dist(hand, h, n) - .19 - .06], ['forearm', segDist(low, hand, h, n) - .19 - .05], ['upper', segDist(up, low, h, n) - .19 - .06], ['elbow', dist(low, h, n) - .19 - .05]];
        for (const [k, v] of c) if (v < worst[k][0]) worst[k] = [v, t];
      }
      if (s.director.progress < 1 && performance.now() - t0 < 12000) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    out[id] = Object.fromEntries(Object.entries(worst).map(([k, [v, t]]) => [k, [+v.toFixed(3), +t.toFixed(2)]]));
  }
  return out;
}, only);
let bad = 0;
for (const [id, v] of Object.entries(r)) { const worst = Math.min(...Object.values(v).map(x => x[0])); if (worst < -.02) { bad++; console.log(id.padEnd(16), Object.entries(v).filter(([, x]) => x[0] < -.02).map(([k, x]) => `${k} ${x[0]} @${x[1]}s`).join('   ')); } }
console.log(bad ? `${bad} moves penetrate the torso` : 'no torso penetration');
await browser.close();
