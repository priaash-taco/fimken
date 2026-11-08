// Ink lens probe: paints the shadow tone magenta and steps the lit/shadow threshold so the split can be placed by eye.
//   node scripts/probe-ink.mjs [--port 5174] [--move stance] [--cuts .3,.5,.7]
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const out = 'art/previews/lenses/ink/probe'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${option('port', 5174)}/?controls=1&lens=ink`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
await page.evaluate(move => { const s = window.__fimken; s.practice(move); s.autoCamera = true; }, option('move', 'stance'));
await page.waitForTimeout(1500);
for (const cut of option('cuts', '.3,.5,.7,.9,1.2').split(',').map(Number)) {
  await page.evaluate(cut => { const l = window.__fimken.lens; l.presets.ink.p.toonCut = cut; l.hero.lensShade.value.set(1, 0, 1); }, cut);
  await page.waitForTimeout(900);
  const png = await page.evaluate(() => window.__fimken.canvas.toDataURL('image/png'));
  writeFileSync(`${out}/cut-${cut}.png`, Buffer.from(png.split(',')[1], 'base64')); console.log('cut', cut);
}
await browser.close();
