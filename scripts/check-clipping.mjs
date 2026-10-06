// Plays every move live (life layer on) and reports the closest approach of hand and finger
// bones to the other hand and to the torso bones. Wrist-to-wrist under 12 cm or hand-to-torso
// under 18 cm is worth looking at.
//   node scripts/check-clipping.mjs [--port 5174]
import { chromium } from '@playwright/test';
const args = process.argv.slice(2), option = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', args: ['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
await page.goto(`http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5173)}/?controls=1`);
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
const r = await page.evaluate(() => new Promise(async done => { const s = window.__fimken, b = s.actor.rigControls.bones;
  const pts = side => ['Hand', 'IndexDistal', 'PinkyDistal', 'ThumbDistal', 'IndexProximal'].map(k => b[side + k]).filter(Boolean).map(o => o.getWorldPosition(new o.position.constructor()));
  const torso = () => ['hips', 'spine', 'chest', 'neck'].map(k => b[k]).map(o => o.getWorldPosition(new o.position.constructor()));
  const ids = ['stance', 'relaxedIdle', 'alert', 'stretch', 'neckRoll', 'wristWarmup', 'bounce', 'combatIdle', 'stepForward', 'stepBack', 'shuffle', 'vanish', 'strikes', 'heavy', 'frontKick', 'backKick', 'highKick', 'heavyKick', 'spin', 'dash', 'flying', 'flip', 'flight', 'hover', 'airborne', 'airCombo', 'hardLanding', 'threePoint', 'reaction', 'reset', 'powerup', 'transformation', 'charge', 'blast'];
  const out = {}; s.autoCamera = false;
  for (const id of ids) { s.practice(id); let minHand = 9, minTorso = 9, tHand = 0, tTorso = 0; const t0 = performance.now();
    await new Promise(r => { const tick = () => { const L = pts('left'), R = pts('right'), T = torso();
      for (const a of L) for (const c of R) { const d = a.distanceTo(c); if (d < minHand) { minHand = d; tHand = s.director.time; } }
      for (const h of [...L, ...R]) for (const c of T) { const d = h.distanceTo(c); if (d < minTorso) { minTorso = d; tTorso = s.director.time; } }
      if (s.director.progress < 1 && performance.now() - t0 < 9000) requestAnimationFrame(tick); else r(); }; requestAnimationFrame(tick); });
    out[id] = { hand: +minHand.toFixed(3), atHand: +tHand.toFixed(2), torso: +minTorso.toFixed(3), atTorso: +tTorso.toFixed(2) }; }
  done(out); }));
let flagged = 0;
for (const [k, v] of Object.entries(r)) if (v.hand < .12 || v.torso < .18) { flagged++; console.log(k, JSON.stringify(v)); }
console.log(flagged ? `${flagged} moves flagged` : 'no close approaches');
await browser.close();
