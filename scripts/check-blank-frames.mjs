// Guards the whole-scene flashing regression. Plays the beam release with effects on,
// reads the canvas after every rendered frame and also samples the composited page,
// while forcing internal-resolution changes far more often than the governor would.
//   node scripts/check-blank-frames.mjs [--port 5173] [--discrete] [--seconds 9]
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const seconds = Number(option('seconds', 9));
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: args.includes('--discrete') ? ['--force_high_performance_gpu'] : [] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5173)}/`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
await page.evaluate(() => {
  const s = window.__fimken, probe = document.createElement('canvas'); probe.width = 96; probe.height = 54;
  const context = probe.getContext('2d', { willReadFrequently: true }), log = window.__frames = { means: [], scales: new Set(), resizes: 0 };
  s.practice('blast'); let frame = 0;
  const tick = () => {
    // Runs after the scene's own frame callback: this is the image handed to the compositor.
    context.drawImage(s.canvas, 0, 0, 96, 54); const d = context.getImageData(0, 0, 96, 54).data; let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    log.means.push(sum / (d.length / 4 * 3)); log.scales.add(s.canvas.dataset.renderScale);
    if (++frame % 20 === 0) { s.pipeline.adaptive = [1, .8, .6, .5][(frame / 20) % 4]; s.pipeline.resize(); log.resizes++; }
    if (s.director.progress >= 1) s.practice('blast');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
// Composited output: a blank presentation compresses to almost nothing.
const sizes = []; const started = Date.now();
while (Date.now() - started < seconds * 1000) sizes.push((await page.screenshot({ type: 'jpeg', quality: 60 })).length);
const frames = await page.evaluate(() => ({ means: window.__frames.means, scales: [...window.__frames.scales], resizes: window.__frames.resizes }));
// Timeline sweep: an invalid shader value at one instant is smeared over the frame by bloom,
// so every move is also stepped through at fixed times and full internal resolution.
const sweep = await page.evaluate(async () => {
  const s = window.__fimken, probe = document.createElement('canvas'); probe.width = 48; probe.height = 27;
  const c = probe.getContext('2d', { willReadFrequently: true }), black = []; let count = 0; s.pipeline.comparing = true; s.pipeline.adaptive = 1; s.pipeline.resize();
  for (const id of s.moveIds()) {
    s.reviewAction(0, id); const duration = s.director.move.duration;
    for (let t = 0; t <= duration + 1e-6; t += .05) {
      s.reviewAction(+t.toFixed(2), id); s.cinematography.update(0, s.director, s.followPoint(), s.view, true);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      c.drawImage(s.canvas, 0, 0, 48, 27); const d = c.getImageData(0, 0, 48, 27).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      count++; if (sum / (d.length / 4 * 3) < 2) black.push(`${id}@${t.toFixed(2)}`);
    }
  }
  return { count, black };
});
const sorted = [...sizes].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
const report = { canvasFrames: frames.means.length, blankCanvasFrames: frames.means.filter(m => m < 2).length, minimumMeanRGB: +Math.min(...frames.means).toFixed(2),
  seekedFrames: sweep.count, blankSeekedFrames: sweep.black, internalResizes: frames.resizes, renderScalesSeen: frames.scales, pageCaptures: sizes.length, blankPageCaptures: sizes.filter(n => n < median * .25).length, smallestCaptureVsMedian: +(sorted[0] / median).toFixed(2), errors };
console.log(JSON.stringify(report, null, 1));
if (option('out', '')) writeFileSync(option('out', ''), JSON.stringify(report, null, 1));
await browser.close();
process.exitCode = report.blankCanvasFrames || report.blankPageCaptures || sweep.black.length || errors.length ? 1 : 0;
