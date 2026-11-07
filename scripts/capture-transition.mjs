// Frames around one automatic move-to-move transition: the last frame of the old move, then +3, +8 and +15 frames.
//   node scripts/capture-transition.mjs [--port 5174] [--out art/previews/transition]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const out = option('out', 'art/previews/transition'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${option('port', 5174)}/?controls=1`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
const r = await page.evaluate(() => new Promise(done => { const s = window.__fimken; s.practice('freestyle'); s.autoCamera = false; s.director.auto = true;
  let start = s.director.moveId, seen = 0, frames = [], last = null, after = -1, info = {};
  const tick = () => { const root = s.actor.root.position, V = s.camera.position.constructor, t = new V(root.x, root.y + 1, root.z); s.controls.target.copy(t); s.camera.position.set(t.x + 2.6, t.y + .2, t.z + 3.4); s.controls.update();
    const png = s.canvas.toDataURL('image/png');
    if (after < 0 && s.director.moveId !== start) { seen++; if (seen === 2) { after = 0; info = { from: start, to: s.director.moveId }; frames.push(['before', last]); } start = s.director.moveId; }
    if (after >= 0) { if ([3, 8, 15].includes(after)) frames.push(['after' + after, png]); if (after >= 15) return done({ frames, info }); after++; }
    last = png; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
for (const [name, png] of r.frames) writeFileSync(`${out}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
console.log(JSON.stringify(r.info), r.frames.map(f => f[0]).join(' '));
await browser.close();
