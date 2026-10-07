// Starts the simulated rhythm and saves stills so the sound-reactive columns can be checked.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const out = option('out', 'art/previews/motion/sound'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${option('port', 5174)}/?controls=1`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
await page.evaluate(() => window.__fimken.audio.demo());
for (const wait of [2500, 700, 700, 1500]) {
  await page.waitForTimeout(wait);
  const png = await page.evaluate(() => window.__fimken.canvas.toDataURL('image/png'));
  const name = `demo-${Date.now() % 100000}`; writeFileSync(`${out}/${name}.png`, Buffer.from(png.split(',')[1], 'base64')); console.log(name);
}
if (errors.length) console.error(errors);
await browser.close();
