// Close-up stills of a move at given times, for judging how the skin deforms at joints.
//   node scripts/capture-closeup.mjs --shots mocap_135_07_0:0.77:upper,mocap_135_07_0:0.77:legs --out art/previews/deform
// View is upper (chest and arms), legs (hips down) or full, from the front-left, with the cinematic camera off.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const out = option('out', 'art/previews/deform'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${option('port', 5174)}/?controls=1${option('lens', '') ? '&lens=' + option('lens', '') : ''}`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
for (const shot of option('shots', '').split(',').filter(Boolean)) {
  const [id, at, view = 'upper'] = shot.split(':'), time = Number(at), angle = Number(option('angle', 35));
  const png = await page.evaluate(({ id, time, view, angle }) => new Promise(done => { const s = window.__fimken; s.practice(id); s.autoCamera = false;
    const tick = () => { const root = s.actor.root.position, a = angle * Math.PI / 180, V = s.camera.position.constructor;
      const target = view === 'legs' ? new V(root.x, root.y + .7, root.z) : view === 'full' ? new V(root.x, root.y + 1, root.z) : new V(root.x, root.y + 1.25, root.z), dist = view === 'full' ? 4.2 : view === 'legs' ? 2.6 : 2.3;
      s.controls.target.copy(target); s.camera.position.set(target.x + Math.sin(a) * dist, target.y + .15, target.z + Math.cos(a) * dist); s.controls.update();
      if (s.director.moveId === id && s.director.time >= time) done(s.canvas.toDataURL('image/png')); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), { id, time, view, angle });
  const name = `${id}-${time.toFixed(2)}-${view}`; writeFileSync(`${out}/${name}.png`, Buffer.from(png.split(',')[1], 'base64')); console.log(name);
}
await browser.close();
