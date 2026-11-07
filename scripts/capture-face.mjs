// Face close-ups with one blendshape at a time (or the live face layer), for reviewing expressions in the real renderer.
//   node scripts/capture-face.mjs [--port 5174] [--keys Basis,eyeBlinkLeft+eyeBlinkRight,jawOpen,...] [--out art/previews/face]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const out = option('out', 'art/previews/face'); mkdirSync(out, { recursive: true });
const keys = option('keys', 'Basis,eyeBlinkLeft+eyeBlinkRight,browDownLeft+browDownRight+eyeSquintLeft+eyeSquintRight,browInnerUp+eyeWideLeft+eyeWideRight,jawOpen,mouthSmileLeft+mouthSmileRight,cheekPuffLeft+cheekPuffRight,live').split(',');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${option('port', 5174)}/?controls=1&blur=0`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
const names = await page.evaluate(() => { const s = window.__fimken; s.practice('relaxedIdle'); s.autoCamera = false; s.paused = false; return [...(s.actor.face?.available || [])]; });
console.log('morph targets', names.length, names.join(' '));
for (const combo of keys) {
  const png = await page.evaluate(({ combo }) => new Promise(done => { const s = window.__fimken, V = s.camera.position.constructor; let n = 0;
    const tick = () => { const head = s.actor.anchor('head', new V()); s.controls.target.copy(head); s.camera.position.set(head.x + .18, head.y + .04, head.z + .62); s.controls.update();
      if (combo !== 'live') { s.actor.face.enabledOverride = true; for (const o of s.actor.face.targets) { for (const [k, i] of Object.entries(o.morphTargetDictionary)) o.morphTargetInfluences[i] = combo.split('+').includes(k) ? 1 : 0; } }
      if (++n >= 12) done(s.canvas.toDataURL('image/png')); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), { combo });
  writeFileSync(`${out}/${combo.replace(/\+/g, '_')}.png`, Buffer.from(png.split(',')[1], 'base64')); console.log(combo);
}
if (errors.length) console.log('errors', errors.slice(0, 3));
await browser.close();
