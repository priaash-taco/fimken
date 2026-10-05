// Deterministic full-effect stills for before/after comparison of rendering changes.
//   node scripts/render-snapshots.mjs --out art/previews/performance/before
//   node scripts/render-snapshots.mjs --out art/previews/performance/after --against art/previews/performance/before
// Poses are seeked on a paused timeline at full internal resolution, so differences come from the renderer alone.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const base = `http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5173)}/`, out = option('out', 'art/previews/performance/snapshot'), against = option('against', '');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: args.includes('--discrete') ? ['--force_high_performance_gpu'] : [] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.error('pageerror', e.message));
await page.goto(base);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
await page.evaluate(() => { window.__fimken.pipeline.comparing = true; });
const shots = [['powerup', 1.3], ['powerup', 3.5], ['transformation', 2.2], ['charge', 3.0], ['blast', 3.75], ['blast', 4.5], ['heavy', .93], ['hover', 2.2], ['stance', 1]];
const chosen = option('shots', '') ? option('shots', '').split(',').map(s => [s.split(':')[0], Number(s.split(':')[1])]) : shots;
for (const [id, time] of chosen) {
  const name = `${id}-${time.toFixed(2)}`;
  const png = await page.evaluate(async ({ id, time }) => {
    const s = window.__fimken, frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    s.reviewAction(time, id); s.cinematography.update(0, s.director, s.followPoint(), s.view, true); s.controls.update();
    s.world.update(10, s.director.power); // drifting dust and haze sit at one fixed moment
    // Two seeks let the paused effect springs settle on the pose before the frame is read.
    for (let i = 0; i < 4; i++) { await frame(); s.reviewAction(time, id); }
    return s.canvas.toDataURL('image/png');
  }, { id, time });
  writeFileSync(`${out}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  if (!against) { console.log(name); continue; }
  const reference = 'data:image/png;base64,' + readFileSync(`${against}/${name}.png`).toString('base64');
  console.log(name, JSON.stringify(await page.evaluate(async ({ a, b }) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); r(x.getImageData(0, 0, i.width, i.height).data); }; i.src = src; });
    const [p, q] = await Promise.all([load(a), load(b)]); let sum = 0, max = 0, over = 0;
    for (let i = 0; i < p.length; i += 4) { const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])); sum += d; if (d > max) max = d; if (d > 8) over++; }
    return { meanDifference: +(sum / (p.length / 4)).toFixed(3), maxDifference: max, pixelsOver8: +(over / (p.length / 4) * 100).toFixed(3) + '%' };
  }, { a: png, b: reference })));
}
await browser.close();
