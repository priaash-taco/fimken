// Shared helpers for the qa-*.mjs release checks.
import { chromium } from '@playwright/test';
export const args = process.argv.slice(2);
export const option = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
export const port = option('port', process.env.FIMKEN_PORT || 5313);
export const url = (query = '') => `http://127.0.0.1:${port}/${query ? '?' + query : ''}`;
export async function launch({ width = 1280, height = 720, query = '', discrete = true } = {}) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: discrete ? ['--force_high_performance_gpu'] : [] });
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = { page: [], console: [] };
  page.on('pageerror', e => errors.page.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()); });
  await page.goto(url(query));
  await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 120000 });
  return { browser, context, page, errors };
}
export const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
