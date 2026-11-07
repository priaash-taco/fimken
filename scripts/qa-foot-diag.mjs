// Diagnostic for QA 2: where does a sinking ankle come from? Prints the time series of one move.
//   node scripts/qa-foot-diag.mjs --move mocap_135_11_1
import { launch, option } from './qa-lib.mjs';
const { browser, page } = await launch({ query: 'blur=0' });
const id = option('move', 'mocap_135_11_1');
const off = option('off', '');
const r = await page.evaluate(({ id, off }) => new Promise(done => {
  const s = window.__fimken, b = s.actor.rigControls.bones, V = s.actor.root.position.constructor, v = new V();
  if (off.includes('smear')) s.actor.smear.enabled = false; if (off.includes('springs')) s.actor.jointSprings.apply = () => {}; if (off.includes('style')) s.actor.style.apply = p => p;
  if (off.includes('exag')) s.exaggeration = 0; if (off.includes('balance')) { const a = s.actor.style.apply.bind(s.actor.style); s.actor.style.apply = (p, v, d) => { const o = a(p, v, d); o.hipShift = [0, 0]; return o; }; }
  if (off.includes('lead')) { const a = s.actor.style.apply.bind(s.actor.style); s.actor.style.apply = (p, v, d) => { const o = a(p, v, d); o.hipYaw = 0; return o; }; }
  if (off.includes('life')) s.actor.life.apply = p => p; if (off.includes('sec')) s.actor.secondary.update = () => {};
  s.practice('stance'); setTimeout(() => {
    const rest = b.leftFoot.getWorldPosition(v).y, rows = []; s.practice(id); let n = 0;
    const tick = () => {
      const dp = s.director.pose, lp = s.actor.livePose || {}; n++;
      if (n % Number(window.__step || 4) === 0 || (s.director.time > 1.36 && s.director.time < 1.48)) rows.push([+s.director.time.toFixed(2), ...['left', 'right'].map(side => +(b[side + 'Foot'].getWorldPosition(v).y - rest).toFixed(3)), +(dp.leftFoot?.[1] ?? 0).toFixed(3), +(dp.rightFoot?.[1] ?? 0).toFixed(3), +(lp.crouch ?? 0).toFixed(2), +(s.actor.root.scale.y).toFixed(3), +s.actor.root.position.y.toFixed(3), s.actor.rigControls.hoverWeight ?? null]);
      if (s.director.time >= s.director.move.duration - 1e-6) return done(rows); requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  }, 1500);
}), { id, off });
console.log('t, ankleL, ankleR, poseL.y, poseR.y, crouch, rootScaleY, rootY'); for (const row of r) console.log(row.join('\t')); await browser.close();
