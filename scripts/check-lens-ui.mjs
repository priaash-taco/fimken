// Drives the Rendering lens dropdown like a user: Current is the default, each option switches live
// with the animation still running, and switching back restores the original look.
//   node scripts/check-lens-ui.mjs [--port 5174]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const out = 'art/previews/lenses/ui'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${option('port', 5174)}/`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
await page.evaluate(() => document.querySelector('#settings-modal').showModal()); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/settings-dropdown.png` });
const report = { default: await page.$eval('#lens', s => s.value), options: await page.$$eval('#lens option', o => o.map(x => x.value + ':' + x.textContent)) };
const shot = async name => { const png = await page.evaluate(() => window.__fimken.canvas.toDataURL('image/png')); writeFileSync(`${out}/${name}.png`, Buffer.from(png.split(',')[1], 'base64')); };
const state = () => page.evaluate(() => ({ lens: window.__fimken.lens.name, committed: document.querySelector('#battle').dataset.lens, move: window.__fimken.director.moveId, t: +window.__fimken.director.time.toFixed(2) }));
await page.evaluate(() => window.__fimken.practice('powerup')); await page.waitForTimeout(1500);
report.start = await state(); await shot('0-classic');
for (const name of ['noir', 'volume', 'chroma', 'classic']) {
  await page.selectOption('#lens', name); await page.waitForTimeout(220); await shot(`${name}-mid-fade`);
  await page.waitForTimeout(1400); report[name] = await state(); await shot(`${name}`);
}
report.errors = errors; console.log(JSON.stringify(report, null, 1));
await browser.close();
