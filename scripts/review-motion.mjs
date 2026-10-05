// Motion review contact sheets. Poses each move at exact timeline positions through
// the development scene handle, so frames are deterministic rather than screenshot-timed.
//   node scripts/review-motion.mjs [--moves dash,spin] [--view front|side|quarter|shot] [--fx] [--frames 16] [--at 1.2,1.4]
// Requires the dev server (default port 5173; --port or FIMKEN_PORT overrides). Output: art/previews/motion/.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const fx = args.includes('--fx');
const view = option('view', fx ? 'shot' : 'quarter');
const frames = Number(option('frames', 16));
const at = option('at', '') ? option('at', '').split(',').map(Number) : null;
const all = ['powerup', 'charge', 'blast', 'dash', 'strikes', 'heavy', 'flying', 'spin', 'flip', 'flight', 'bounce', 'combatIdle', 'stepForward', 'stepBack', 'shuffle', 'vanish', 'frontKick', 'backKick', 'highKick', 'heavyKick', 'airCombo', 'hardLanding', 'threePoint', 'reset', 'hover', 'airborne', 'reaction', 'transformation'];
const moves = option('moves', '') ? option('moves', '').split(',') : all;
const out = option('out', 'art/previews/motion');
const base = `http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5173)}/`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + (fx ? '' : '?inspection=1'));
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 60000 });

for (const id of moves) {
  const sheet = await page.evaluate(async ({ id, view, frames, at, fx }) => {
    const scene = window.__fimken, canvas = document.querySelector('#battle');
    const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    scene.reviewAction(0, id);
    const move = scene.director.move, times = at || Array.from({ length: frames }, (_, i) => move.duration * i / (frames - 1));
    const cols = Math.min(8, times.length), rows = Math.ceil(times.length / cols), w = 240, h = 300, label = 18;
    const sheet = document.createElement('canvas'); sheet.width = cols * w; sheet.height = rows * (h + label);
    const c = sheet.getContext('2d'); c.fillStyle = '#15141c'; c.fillRect(0, 0, sheet.width, sheet.height); c.font = '11px sans-serif';
    const cameras = { front: [[0, 1.05, 5.8], [0, 1.0, .25]], side: [[5.8, 1.05, .3], [0, 1.0, .3]], quarter: [[3.7, 1.45, 4.4], [0, 1.0, .25]], hands: [[1.5, 1.45, 2.5], [0, 1.15, .25]] };
    scene.autoCamera = false; scene.pipeline.comparing = true; // hold internal resolution for consistent sheets
    for (let i = 0; i < times.length; i++) {
      scene.reviewAction(times[i], id);
      if (cameras[view]) {
        scene.camera.fov = 30; scene.camera.updateProjectionMatrix();
        scene.camera.position.fromArray(cameras[view][0]); scene.controls.target.fromArray(cameras[view][1]);
      } else scene.cinematography.update(0, scene.director, scene.followPoint(), scene.view, true);
      scene.controls.update();
      await nextFrame();
      const x = (i % cols) * w, y = Math.floor(i / cols) * (h + label);
      c.drawImage(canvas, x, y, w, h);
      c.fillStyle = '#15141c'; c.fillRect(x, y + h, w, label);
      c.fillStyle = '#e8e4f4'; c.fillText(`${times[i].toFixed(2)}s  ${scene.director.stage}`.slice(0, 44), x + 4, y + h + 13);
    }
    return sheet.toDataURL('image/jpeg', .9);
  }, { id, view, frames, at, fx });
  const file = `${out}/${id}-${view}${fx ? '-fx' : ''}.jpg`;
  writeFileSync(file, Buffer.from(sheet.split(',')[1], 'base64'));
  console.log(file);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
await browser.close();
