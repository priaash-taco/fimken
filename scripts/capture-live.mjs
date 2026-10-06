// Live stills: plays a move in real time and saves the frame once the timeline reaches each
// requested time, so scene states, flashes and ground marks (which only run while playing)
// are captured as they really look.
//   node scripts/capture-live.mjs --port 5174 --shots powerup:3.5,blast:3.8,blast:4.7 --out art/previews/motion/live
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const out = option('out', 'art/previews/motion/live'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5173)}/?controls=1`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
let current = null;
for (const shot of option('shots', 'stance:1,powerup:3.5,charge:3,blast:3.75,blast:4.7,hardLanding:1.3').split(',')) {
  const [id, at] = shot.split(':'); const time = Number(at);
  const png = await page.evaluate(({ id, time, restart }) => new Promise(done => { const s = window.__fimken; if (restart) { s.practice(id); s.autoCamera = true; }
    const tick = () => { if (s.director.moveId === id && s.director.time >= time) done({ png: s.canvas.toDataURL('image/png'), state: s.mood.state, at: s.director.time }); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), { id, time, restart: current !== id });
  current = id; const name = `${id}-${time.toFixed(2)}`; writeFileSync(`${out}/${name}.png`, Buffer.from(png.png.split(',')[1], 'base64')); console.log(name, png.state, png.at.toFixed(2));
}
if (errors.length) console.error(errors);
await browser.close();
