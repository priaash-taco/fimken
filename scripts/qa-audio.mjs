// Release QA 3: audio paths. Drives the in-app demo rhythm and the bundled First Light score (through the UI)
// for 60 s each and counts music-state events and effect responses.
// Microphone and PC-audio capture need a real device and a permission gesture, so they are not testable headless.
//   node scripts/qa-audio.mjs [--seconds 60] [--out art/qa/audio.json]
import { writeFileSync } from 'node:fs';
import { launch, option } from './qa-lib.mjs';
const seconds = Number(option('seconds', 60));
const { browser, page, errors } = await launch({ query: 'controls=1' });
const monitor = (seconds) => page.evaluate(sec => new Promise(done => {
  const s = window.__fimken, m = s.music, d = s.canvas.dataset, r = { frames: 0, beats: 0, bassHits: 0, drops: 0, crescendos: 0, sustained: 0, bpmSeen: new Set(), sections: {}, moves: new Set(),
    maxEnergy: 0, maxBeatCount: 0, contacts0: Number(d.contacts || 0), impacts0: Number(d.impacts || 0), beamFrames: 0, maxPulse: 0, mode: s.audio.mode, firstBeatAt: null };
  const t0 = performance.now(); let sustainedPrev = false;
  const tick = () => {
    r.frames++; const t = (performance.now() - t0) / 1000;
    if (m.beat) { r.beats++; r.firstBeatAt ??= +t.toFixed(2); } if (m.bassHit) r.bassHits++; if (m.drop) r.drops++; if (m.crescendo) r.crescendos++;
    if (m.sustained && !sustainedPrev) r.sustained++; sustainedPrev = m.sustained;
    if (m.bpm) r.bpmSeen.add(m.bpm); r.sections[m.section] = (r.sections[m.section] || 0) + 1; r.moves.add(s.director.moveId);
    r.maxEnergy = Math.max(r.maxEnergy, m.energy || 0); r.maxBeatCount = Math.max(r.maxBeatCount, m.beatCount || 0);
    if (s.director.signals?.beam > .1) r.beamFrames++; r.maxPulse = Math.max(r.maxPulse, s.director.pulse || 0);
    if (t < sec) requestAnimationFrame(tick);
    else done({ ...r, bpmSeen: [...r.bpmSeen], moves: [...r.moves], contacts: Number(d.contacts || 0) - r.contacts0, impactsAttr: Number(d.impacts || 0) - r.impacts0, finalMode: s.audio.mode, section: d.section });
  };
  requestAnimationFrame(tick);
}), seconds);
const out = {};
// 1. In-app demo rhythm.
await page.evaluate(() => { const s = window.__fimken; s.practice('freestyle'); s.audio.demo(); });
out.demo = await monitor(seconds); console.log('demo', JSON.stringify(out.demo));
// 2. Bundled First Light score through the real button.
await page.evaluate(() => window.__fimken.audio.stop());
// The Demo and First Light buttons sit in the advanced section, which the compact production UI hides: click through the DOM.
out.scoreButtonVisibleInUI = await page.evaluate(() => { const b = document.querySelector('#score'); return Boolean(b.offsetParent); });
await page.evaluate(() => document.querySelector('#score').click());
await page.waitForFunction(() => window.__fimken.audio.mode === 'file', null, { timeout: 30000 }).catch(() => {});
out.scoreModeAfterClick = await page.evaluate(() => window.__fimken.audio.mode);
out.scoreStatus = await page.evaluate(() => document.querySelector('#source-status')?.textContent);
out.score = await monitor(seconds); console.log('score', JSON.stringify(out.score));
out.errors = { page: errors.page, console: errors.console.slice(0, 10) };
writeFileSync(option('out', 'art/qa/audio.json'), JSON.stringify(out, null, 1));
await browser.close();
