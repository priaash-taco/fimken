// Smoke check of the production build: serves dist/ with `vite preview`, loads it in a real
// browser, waits for the scene to be ready, fails on console errors and saves a screenshot.
//   node scripts/release-check.mjs [--port 5312]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const port = Number(opt('port', 5312)), out = 'art/previews/product';
if (!existsSync('dist/index.html')) { console.error('No dist/. Run npm run build first.'); process.exit(1); }
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
let log = ''; server.stdout.on('data', d => log += d); server.stderr.on('data', d => log += d);
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);
let failed = null, browser;
try {
  for (let i = 0; i < 60 && !/127[.]0[.]0[.]1/.test(log); i++) await new Promise(r => setTimeout(r, 250));
  if (!/127[.]0[.]0[.]1/.test(log)) throw new Error('vite preview did not start:\n' + log);
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('requestfailed', r => errors.push('request failed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}${process.env.BASE_PATH || "/"}`);
  await page.waitForSelector('#battle[data-ready="true"]', { timeout: 120000 });
  await page.waitForTimeout(4000); // let the lazy clip library arrive and a few frames render
  writeFileSync(`${out}/release.png`, await page.screenshot());
  if (errors.length) throw new Error('Errors while loading the built site:\n  ' + errors.join('\n  '));
  console.log(`release check ok: scene ready, no console errors, screenshot at ${out}/release.png`);
} catch (e) { failed = e; }
await browser?.close();
stop();
if (failed) { console.error(failed.message || failed); process.exit(1); }
