// Product shell check: loading overlay and progress, first-run hint, automatic quality,
// phone layout (390x844), touch orbit and pinch, shortcuts dialog, accessibility basics.
//   node scripts/product-shell-check.mjs [--port 5311]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const base = `http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5311)}/`;
mkdirSync('art/previews/product', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const results = [], check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra); };

async function open(viewport, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  return { context, page, errors };
}

// Desktop: loading progress, hint, auto quality
{
  const { context, page, errors } = await open({ width: 1440, height: 900 });
  const samples = [];
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const poll = setInterval(() => page.evaluate(() => ({ v: document.querySelector('#loading-bar')?.getAttribute('aria-valuenow'), t: document.querySelector('#loading-text')?.textContent })).then(s => samples.push(s)).catch(() => {}), 120);
  await page.waitForSelector('#battle[data-ready="true"]', { timeout: 120000 });
  clearInterval(poll);
  const values = samples.map(s => Number(s.v)).filter(Number.isFinite);
  check('progress advances in steps', new Set(values).size > 2, `${[...new Set(values)].slice(0, 12).join(',')}`);
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 5000 });
  await page.waitForSelector('#first-run-hint:not([hidden])', { timeout: 5000 });
  check('first-run hint shown', true);
  await page.screenshot({ path: 'art/previews/product/desktop.png' });
  const caps = await page.evaluate(() => ({ note: document.querySelector('#quality-note')?.textContent, preset: document.querySelector('#quality').value, stored: localStorage.getItem('fimken.v1.settings') }));
  console.log('quality', caps);
  check('quality note present', Boolean(caps.note));
  check('quality not persisted before a change', !caps.stored || !JSON.parse(caps.stored).quality);
  await page.mouse.click(700, 500);
  check('hint dismissed on interaction', await page.locator('#first-run-hint').isHidden());
  await page.reload(); await page.waitForSelector('#battle[data-ready="true"]', { timeout: 120000 }); await page.waitForTimeout(1200);
  check('hint never shows again', await page.locator('#first-run-hint').isHidden());
  // user changes quality -> persisted
  await page.getByRole('button', { name: 'Audio and display' }).click();
  await page.getByLabel('Render quality', { exact: true }).selectOption('balanced');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fimken.v1.settings')).quality);
  check('chosen quality persisted', stored === 'balanced');
  await page.waitForTimeout(1500);
  check('governor data attributes alive', await page.evaluate(() => Boolean(document.querySelector('#battle').dataset.renderScale)));
  await page.screenshot({ path: 'art/previews/product/desktop-settings.png' });
  await page.keyboard.press('Escape');
  check('settings closes on Escape', await page.evaluate(() => !document.querySelector('#settings-modal').open));
  await page.keyboard.press('Shift+Slash');
  check('? opens shortcuts', await page.evaluate(() => document.querySelector('#help-modal').open));
  await page.screenshot({ path: 'art/previews/product/desktop-help.png' });
  await page.keyboard.press('Escape');
  check('help closes on Escape', await page.evaluate(() => !document.querySelector('#help-modal').open));
  // unnamed controls
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, input, select, a[href], summary')].filter(el => {
    if (el.type === 'hidden' || el.hidden || el.closest('[hidden]')) return false;
    const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.labels?.[0]?.textContent || el.textContent || el.getAttribute('title') || el.querySelector?.('img[alt]')?.alt;
    return !String(name || '').trim();
  }).map(el => el.id || el.outerHTML.slice(0, 80)));
  check('every control has a name', unnamed.length === 0, unnamed.join(' | '));
  check('no console errors (desktop)', errors.filter(e => !/clips.json|JSON module/.test(e)).length === 0, errors.join(' | '));
  await context.close();
}

// Phone: layout, targets, touch orbit and pinch
{
  const { context, page, errors } = await open({ width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#battle[data-ready="true"]', { timeout: 120000 });
  await page.waitForSelector('#first-run-hint:not([hidden])', { timeout: 5000 });
  await page.screenshot({ path: 'art/previews/product/phone.png' });
  const layout = await page.evaluate(() => {
    const r = s => document.querySelector(s)?.getBoundingClientRect();
    const a = r('.wordmark'), b = r('#sound-chip'), c = r('#help'), d = r('#settings');
    const hit = (p, q) => !(p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top);
    return { overflow: document.documentElement.scrollWidth > innerWidth, overlaps: [hit(a, b), hit(b, c), hit(a, c), hit(d, b), hit(d, c), hit(a, d)], chip: [b.width, b.height], preset: document.querySelector('#quality').value, cam: document.querySelector('#battle').dataset.renderScale };
  });
  check('no horizontal scroll', !layout.overflow);
  check('top bar elements do not overlap', layout.overlaps.every(v => !v), JSON.stringify(layout.overlaps));
  check('touch device starts on Performance', layout.preset === 'low', layout.preset);
  // orbit and pinch through CDP touch events
  const cdp = await context.newCDPSession(page);
  const cam = () => page.evaluate(() => { const c = window.__fimken.camera.position, t = window.__fimken.controls.target; return { az: Math.atan2(c.x - t.x, c.z - t.z), d: c.distanceTo(t) }; });
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  await page.evaluate(() => { window.__fimken.autoCamera = false; });
  const before = await cam();
  await touch('touchStart', [[120, 400]]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [[120 + i * 15, 400]]); await page.waitForTimeout(16); }
  await touch('touchEnd', []);
  await page.waitForTimeout(400);
  const afterOrbit = await cam();
  check('one-finger drag orbits', Math.abs(afterOrbit.az - before.az) > .05, `${before.az.toFixed(2)} -> ${afterOrbit.az.toFixed(2)}`);
  await touch('touchStart', [[150, 400], [250, 400]]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [[150 - i * 8, 400], [250 + i * 8, 400]]); await page.waitForTimeout(16); }
  await touch('touchEnd', []);
  await page.waitForTimeout(500);
  const afterPinch = await cam();
  check('pinch zooms', Math.abs(afterPinch.d - afterOrbit.d) > .05, `${afterOrbit.d.toFixed(2)} -> ${afterPinch.d.toFixed(2)}`);
  // settings panel
  await page.tap('#settings');
  await page.waitForSelector('#settings-modal[open]');
  await page.screenshot({ path: 'art/previews/product/phone-settings.png' });
  const panel = await page.evaluate(() => {
    const d = document.querySelector('#settings-modal');
    const small = [...d.querySelectorAll('button, select, summary, input[type=range], .toggle-row')].filter(el => el.offsetParent && !el.closest('[hidden]')).map(el => ({ id: el.id || el.className || el.tagName, h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) })).filter(x => x.h < 43 || x.w < 43);
    return { scrolls: d.scrollHeight > d.clientHeight, fits: d.getBoundingClientRect().bottom <= innerHeight, hOverflow: d.scrollWidth > d.clientWidth, small };
  });
  check('settings panel scrolls within the viewport', panel.fits && !panel.hOverflow, JSON.stringify({ scrolls: panel.scrolls, fits: panel.fits }));
  check('settings controls are 44px targets', panel.small.length === 0, JSON.stringify(panel.small));
  await page.tap('#close-settings');
  await page.tap('#help');
  await page.screenshot({ path: 'art/previews/product/phone-help.png' });
  check('no console errors (phone)', errors.filter(e => !/clips.json|JSON module/.test(e)).length === 0, errors.join(' | '));
  await context.close();
}

// Unsupported: no WebGL2
{
  const { context, page } = await open({ width: 1000, height: 700 });
  await page.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : get.call(this, type, ...rest); }; });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.fatal-page');
  check('missing WebGL2 shows the full-page message', await page.locator('#fatal-title').isVisible());
  await page.screenshot({ path: 'art/previews/product/unsupported.png' });
  await context.close();
}

// Load failure: GLB request fails
{
  const { context, page } = await open({ width: 1000, height: 700 });
  await page.route(/\.glb(\?|$)/, route => route.abort());
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#render-error:not([hidden])', { timeout: 60000 });
  check('failure shows the Something went wrong panel', (await page.locator('#render-error h2').textContent()) === 'Something went wrong');
  check('retry button present', await page.locator('#retry').isVisible());
  check('error text is in collapsed details', await page.evaluate(() => { const d = document.querySelector('#render-error details'); return !d.open && d.querySelector('pre').textContent.length > 0; }));
  await page.screenshot({ path: 'art/previews/product/failure.png' });
  await context.close();
}
await browser.close();
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
process.exit(results.every(Boolean) ? 0 : 1);
