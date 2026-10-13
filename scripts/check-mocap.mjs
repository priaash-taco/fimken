// Measures two things per move while it plays live:
//   follow  how far the rig's hands and ankles are from the capture's targets (centimetres, RMS), for mocap moves
//   slide   how far a planted foot moves across the ground (centimetres per second), for any move
// A planted foot is an ankle within 3 cm of its resting height. Humans slide almost nothing there.
//   node scripts/check-mocap.mjs [--port 5174] [--ids id,id | --mocap | --compare]
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const targets = JSON.parse(readFileSync('art/mocap/targets.json', 'utf8'));
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
await page.goto(`http://127.0.0.1:${option('port', 5174)}/?controls=1`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
const all = await page.evaluate(() => window.__fimken.moveIds());
const compare = ['heavyKick', 'frontKick', 'highKick', 'backKick', 'jabCross', 'flurry', 'trainingCombo', 'strikes', 'heavy', 'barrage', 'shuffle', 'stepForward'];
const ids = option('ids', '') ? option('ids', '').split(',') : args.includes('--compare') ? [...all.filter(i => i.startsWith('mocap_')), ...compare] : all.filter(i => i.startsWith('mocap_'));
const result = await page.evaluate(async ({ ids, targets }) => {
  const s = window.__fimken, c = s.actor.rigControls, V = c.bones.hips.position.constructor, out = {}; s.autoCamera = false;
  const world = k => c.bones[k].getWorldPosition(new V()), local = k => s.actor.root.worldToLocal(world(k));
  for (const id of ids) {
    s.practice(id); const tgt = targets[id.replace(/^mocap_/, '')]; let prev = null, slide = 0, planted = 0, settledSlide = 0, settledPlanted = 0, maxSlide = 0, err = [], frames = 0, last = performance.now(), dtSum = 0;
    await new Promise(done => { const tick = () => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      const cur = { l: world('leftFoot'), r: world('rightFoot') };
      if (prev && dt > 0 && dt < .1) for (const side of ['l', 'r']) {
        const ground = s.actor.root.position.y + .148;
        if (cur[side].y < ground + .03 && prev[side].y < ground + .03) { const d = Math.hypot(cur[side].x - prev[side].x, cur[side].z - prev[side].z); slide += d; planted += dt; maxSlide = Math.max(maxSlide, d / dt); if (s.director.time > .6) { settledSlide += d; settledPlanted += dt; } }
      }
      prev = cur;
      if (tgt) { const k = Math.min(tgt.length - 1, Math.round(s.director.time * 30)), t = tgt[k];
        for (const [key, bone] of [['left', 'leftHand'], ['right', 'rightHand'], ['leftFoot', 'leftFoot'], ['rightFoot', 'rightFoot']]) { const p = local(bone), q = t[key]; err.push((p.x - q[0]) ** 2 + (p.y - q[1]) ** 2 + (p.z - q[2]) ** 2); } }
      frames++; if (s.director.progress < 1 && frames < 600) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    out[id] = { settledCmPerSec: settledPlanted > 0 ? +(settledSlide / settledPlanted * 100).toFixed(1) : 0, slideCmPerSec: planted > 0 ? +(slide / planted * 100).toFixed(1) : 0, maxSlideCmPerSec: +(maxSlide * 100).toFixed(0), plantedSec: +planted.toFixed(2), followCm: err.length ? +(Math.sqrt(err.reduce((a, b) => a + b, 0) / err.length) * 100).toFixed(1) : null };
  }
  return out;
}, { ids, targets });
const rows = Object.entries(result), mocap = rows.filter(([k]) => k.startsWith('mocap_')), hand = rows.filter(([k]) => !k.startsWith('mocap_'));
const mean = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
for (const [k, v] of rows) console.log(k.padEnd(18), 'slide', String(v.slideCmPerSec).padStart(6), 'cm/s  after blend', String(v.settledCmPerSec).padStart(5), '  worst', String(v.maxSlideCmPerSec).padStart(5), '  planted', v.plantedSec + 's', v.followCm != null ? `  follow ${v.followCm} cm` : '');
console.log('---');
if (mocap.length) console.log('mocap moves:   mean planted-foot slide', mean(mocap.map(([, v]) => v.slideCmPerSec)), 'cm/s (after blend', mean(mocap.map(([, v]) => v.settledCmPerSec)) + ')', 'cm/s;  mean follow error', mean(mocap.map(([, v]) => v.followCm)), 'cm');
if (hand.length) console.log('hand-keyed:    mean planted-foot slide', mean(hand.map(([, v]) => v.slideCmPerSec)), 'cm/s (after blend', mean(hand.map(([, v]) => v.settledCmPerSec)) + ')');
await browser.close();
