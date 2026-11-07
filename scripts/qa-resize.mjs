// Release QA 5: window resize (blank frames, governor recovery) and CPU starvation (4x throttle for 20 s).
//   node scripts/qa-resize.mjs [--out art/qa/resize.json]
import { writeFileSync } from 'node:fs';
import { launch, option } from './qa-lib.mjs';
const { browser, context, page, errors } = await launch({ query: 'blur=0' });
const sizes = [[1920, 1080], [1280, 720], [800, 600], [390, 844], [2560, 1440]], out = { sizes: [], throttle: null };
await page.evaluate(() => {
  const s = window.__fimken, probe = document.createElement('canvas'); probe.width = 96; probe.height = 54;
  const c = probe.getContext('2d', { willReadFrequently: true }), log = window.__qa = { frames: 0, blank: 0, minMean: 1e9, nan: 0, maxJump: 0, last: null, restart() { this.frames = this.blank = this.nan = 0; this.minMean = 1e9; this.maxJump = 0; this.last = null; } };
  s.practice('blast');
  const tick = () => {
    c.drawImage(s.canvas, 0, 0, 96, 54); const d = c.getImageData(0, 0, 96, 54).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    const mean = sum / (d.length / 4 * 3); log.frames++; log.minMean = Math.min(log.minMean, mean); if (mean < 2) log.blank++;
    const p = s.actor.root.position; if (![p.x, p.y, p.z].every(Number.isFinite)) log.nan++;
    if (log.last) log.maxJump = Math.max(log.maxJump, Math.hypot(p.x - log.last[0], p.y - log.last[1], p.z - log.last[2])); log.last = [p.x, p.y, p.z];
    if (s.director.progress >= 1) s.practice('blast');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500);
  await page.evaluate(() => window.__qa.restart());
  // Knock the governor down, then see how long it takes to get back to full resolution.
  await page.evaluate(() => { const p = window.__fimken.pipeline; p.adaptive = .5; p.resize(); });
  const t0 = Date.now(); let recovered = null, scale = null;
  while (Date.now() - t0 < 12000) { await page.waitForTimeout(250); scale = Number(await page.evaluate(() => window.__fimken.canvas.dataset.renderScale)); if (scale >= .995 && recovered == null) recovered = (Date.now() - t0) / 1000; }
  const r = await page.evaluate(() => { const s = window.__fimken, q = window.__qa; return { frames: q.frames, blank: q.blank, minMean: +q.minMean.toFixed(2), nan: q.nan, maxJump: +q.maxJump.toFixed(3), canvas: [s.canvas.width, s.canvas.height], client: [s.canvas.clientWidth, s.canvas.clientHeight],
    resolution: s.canvas.dataset.resolution, scale: s.canvas.dataset.renderScale, fps: s.performance.snapshot().fps, gpuMs: s.performance.stats.gpuMs }; });
  const row = { viewport: `${w}x${h}`, recoveredToScale1Seconds: recovered, finalScale: scale, ...r }; out.sizes.push(row); console.log(JSON.stringify(row));
}
// CPU starvation: 4x slowdown for 20 s with the demo rhythm driving automatic training.
await page.setViewportSize({ width: 1280, height: 720 });
await page.evaluate(() => { const s = window.__fimken; s.practice('freestyle'); s.audio.demo(); window.__qa.restart(); });
const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.waitForTimeout(20000);
const slow = await page.evaluate(() => { const q = window.__qa, s = window.__fimken; return { frames: q.frames, blank: q.blank, nan: q.nan, maxJump: +q.maxJump.toFixed(3), fps: s.performance.snapshot().fps, worstMs: s.performance.stats.worstMs, root: s.actor.root.position.toArray(), move: s.director.moveId }; });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await page.waitForTimeout(6000);
const after = await page.evaluate(() => { const q = window.__qa, s = window.__fimken; return { nan: q.nan, maxJump: +q.maxJump.toFixed(3), fps: s.performance.snapshot().fps, root: s.actor.root.position.toArray(), scale: s.canvas.dataset.renderScale }; });
out.throttle = { slow, after, blankTotal: await page.evaluate(() => window.__qa.blank) }; console.log(JSON.stringify(out.throttle));
out.errors = { page: errors.page, console: errors.console.slice(0, 10) };
writeFileSync(option('out', 'art/qa/resize.json'), JSON.stringify(out, null, 1));
await browser.close();
