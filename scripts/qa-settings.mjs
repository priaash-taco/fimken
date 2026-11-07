// Release QA 4: settings persistence, URL parameters and the Neutral view toggle.
//   node scripts/qa-settings.mjs [--out art/qa/settings.json]
import { writeFileSync } from 'node:fs';
import { launch, option, url } from './qa-lib.mjs';
const results = [], check = (name, ok, detail) => { results.push({ name, ok: Boolean(ok), detail }); console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); };
const state = page => page.evaluate(() => { const s = window.__fimken; return { lens: s.lens.name, lensAttr: s.canvas.dataset.lens, exaggeration: s.exaggeration, motionBlurOn: s.motionBlurOn, motionBlur: s.pipeline.motionBlur,
  quality: s.pipeline.quality, effects: s.effects, inspection: s.inspection, selectLens: document.querySelector('#lens').value, selectQuality: document.querySelector('#quality').value,
  sliderExaggeration: document.querySelector('#exaggeration').value, sliderEffects: document.querySelector('#effects').value, blurChecked: document.querySelector('#motion-blur').checked }; });

// 1. Persistence across a reload.
{
  const { browser, context, page, errors } = await launch({ query: 'controls=1' });
  await page.click('#settings'); await page.waitForSelector('#lens', { state: 'visible' });
  await page.selectOption('#lens', 'noir'); await page.selectOption('#quality', 'balanced');
  await page.setChecked('#motion-blur', false);
  await page.evaluate(() => { for (const [id, v] of [['exaggeration', 80], ['effects', 40]]) { const e = document.querySelector('#' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.waitForTimeout(500);
  const before = await state(page); console.log('before', JSON.stringify(before));
  await page.reload(); await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 120000 }); await page.waitForTimeout(1500);
  const after = await state(page); console.log('after', JSON.stringify(after));
  check('persist lens', after.lens === 'noir' && after.selectLens === 'noir', { lens: after.lens });
  check('persist quality', after.quality === 'balanced' && after.selectQuality === 'balanced', { quality: after.quality });
  check('persist exaggeration', Math.abs(after.exaggeration - .8) < 1e-6, { exaggeration: after.exaggeration });
  check('persist effects', Math.abs(after.effects - .4) < 1e-6, { effects: after.effects });
  check('persist motion blur', after.motionBlurOn === false && after.motionBlur === 0 && after.blurChecked === false, { on: after.motionBlurOn, strength: after.motionBlur });
  // 2. URL parameters while saved preferences exist: the URL should win.
  await page.goto(url('lens=classic&blur=1&exaggeration=0.2&controls=1')); await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 120000 }); await page.waitForTimeout(1500);
  const over = await state(page); console.log('url over saved', JSON.stringify(over));
  check('URL lens beats saved lens', over.lens === 'classic', { lens: over.lens, saved: 'noir' });
  check('URL exaggeration beats saved value', Math.abs(over.exaggeration - .2) < 1e-6, { exaggeration: over.exaggeration, saved: .8 });
  check('page errors', errors.page.length === 0, errors.page.slice(0, 3));
  await browser.close();
}
// 3. URL parameters on a clean profile.
{
  const { browser, page, errors } = await launch({ query: 'lens=noir&blur=0&exaggeration=0.8' });
  await page.waitForTimeout(2000);
  const s = await state(page); console.log('url clean', JSON.stringify(s));
  check('URL lens=noir', s.lens === 'noir' && s.lensAttr === 'noir', { lens: s.lens, attr: s.lensAttr });
  check('URL blur=0', s.motionBlurOn === false && s.motionBlur === 0 && s.blurChecked === false, { on: s.motionBlurOn, strength: s.motionBlur });
  check('URL exaggeration=0.8', Math.abs(s.exaggeration - .8) < 1e-6, { exaggeration: s.exaggeration });
  check('URL params page errors', errors.page.length === 0, errors.page.slice(0, 3));
  await browser.close();
}
// 4. Neutral view: effects off, then back on.
{
  const { browser, page, errors } = await launch({ query: 'controls=1&lens=chroma' });
  const probe = () => page.evaluate(() => { const s = window.__fimken; return { inspection: s.inspection, attr: s.canvas.dataset.inspection, motionBlur: s.pipeline.motionBlur, skyVisible: s.world.cosmos.root.visible, lensCur: s.lens.name,
    beamVisible: s.canvas.dataset.beamVisible, effectsDisabled: document.querySelector('#effects').disabled, beamRadius: Number(s.canvas.dataset.beamRadius), pillars: s.pillars.group?.visible ?? null, ambientParticles: s.world.particles?.visible ?? null }; });
  await page.waitForTimeout(1500);
  const on0 = await probe(); console.log('neutral before', JSON.stringify(on0));
  await page.click('#settings'); await page.waitForSelector('#asset-inspection', { state: 'visible' });
  await page.setChecked('#asset-inspection', true); await page.waitForTimeout(800);
  await page.evaluate(() => window.__fimken.practice('blast')); await page.waitForTimeout(4600);   // beam release at 3.62 s
  const off = await probe(); console.log('neutral on', JSON.stringify(off));
  check('Neutral: inspection flag', off.inspection && off.attr === 'true' && off.effectsDisabled);
  check('Neutral: sky hidden, motion blur 0', !off.skyVisible && off.motionBlur === 0, off);
  check('Neutral: no beam drawn', off.beamVisible === 'false' || off.beamRadius === 0, { beamVisible: off.beamVisible, beamRadius: off.beamRadius });
  await page.setChecked('#asset-inspection', false); await page.waitForTimeout(1000);
  await page.evaluate(() => window.__fimken.practice('blast')); await page.waitForTimeout(4600);
  const back = await probe(); console.log('neutral off', JSON.stringify(back));
  check('Neutral off: effects return', !back.inspection && back.skyVisible && back.motionBlur > 0 && !back.effectsDisabled && back.lensCur === 'chroma', back);
  check('Neutral off: beam fires again', back.beamVisible === 'true' || back.beamRadius > 0, { beamVisible: back.beamVisible, beamRadius: back.beamRadius });
  check('Neutral page errors', errors.page.length === 0, errors.page.slice(0, 3));
  await browser.close();
}
writeFileSync(option('out', 'art/qa/settings.json'), JSON.stringify(results, null, 1));
process.exitCode = results.every(r => r.ok) ? 0 : 1;
