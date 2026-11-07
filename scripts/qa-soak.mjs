// Release QA 1: soak test. Automatic training with the demo rhythm; samples resource counters every 10 s.
//   node scripts/qa-soak.mjs [--minutes 10] [--interval 10] [--out art/qa/soak.json] [--no-discrete]
import { writeFileSync } from 'node:fs';
import { launch, option, args, pct } from './qa-lib.mjs';
const minutes = Number(option('minutes', 10)), interval = Number(option('interval', 10));
const { browser, page, errors } = await launch({ discrete: !args.includes('--no-discrete') });
await page.evaluate(() => { const s = window.__fimken; s.practice('freestyle'); s.audio.demo(); });
const samples = [], started = Date.now();
const read = () => page.evaluate(() => {
  const s = window.__fimken, i = s.renderer.info;
  return { fps: s.performance.snapshot().fps, frameMs: s.performance.stats.frameMs, p95Ms: s.performance.stats.p95Ms, worstMs: s.performance.stats.worstMs, gpuMs: s.performance.stats.gpuMs, origin: performance.timeOrigin, heap: performance.memory?.usedJSHeapSize ?? null,
    geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs.length, children: s.scene.children.length,
    objects: (() => { let n = 0; s.scene.traverse(() => n++); return n; })(), move: s.director.moveId, scale: s.canvas.dataset.renderScale };
});
while (Date.now() - started < minutes * 60000) {
  await page.waitForTimeout(interval * 1000);
  const r = await read(); r.t = Math.round((Date.now() - started) / 1000); samples.push(r);
  console.log(JSON.stringify(r));
}
// Growth: least-squares slope per minute over the second half (first half is warm-up: shader compiles, caches).
const slope = key => { const h = samples.slice(Math.floor(samples.length / 2)).filter(x => x[key] != null); if (h.length < 3) return 0;
  const n = h.length, mx = h.reduce((a, x) => a + x.t, 0) / n, my = h.reduce((a, x) => a + x[key], 0) / n;
  return h.reduce((a, x) => a + (x.t - mx) * (x[key] - my), 0) / h.reduce((a, x) => a + (x.t - mx) ** 2, 0) * 60; };
const fps = samples.map(x => x.fps).sort((a, b) => a - b);
const report = { minutes, samples: samples.length, fps: { min: fps[0], p05: pct(fps, .05), median: pct(fps, .5), max: fps.at(-1) },
  slopePerMinuteSecondHalf: Object.fromEntries(['heap', 'geometries', 'textures', 'programs', 'children', 'objects'].map(k => [k, +slope(k).toFixed(2)])),
  first: samples[0], last: samples.at(-1), moves: [...new Set(samples.map(x => x.move))].length, reloads: new Set(samples.map(x => x.origin)).size - 1, pageErrors: errors.page.length, consoleErrors: errors.console.length,
  errorSamples: [...errors.page, ...errors.console].slice(0, 5) };
console.log(JSON.stringify(report, null, 1));
writeFileSync(option('out', 'art/qa/soak.json'), JSON.stringify({ report, samples }, null, 1));
await browser.close();
