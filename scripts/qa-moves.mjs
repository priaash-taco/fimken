// Release QA 2: every move under every lens, played once in real time to completion.
// Per frame: finite root transform and bone positions, no foot below the floor by more than 2 cm,
// hero inside the arena (|x|,|z| < 2 m), no root jump above 3 m in one frame, no page errors.
//   node scripts/qa-moves.mjs [--lenses classic,noir,volume,chroma] [--moves a,b] [--out art/qa/moves.json]
import { writeFileSync } from 'node:fs';
import { launch, option } from './qa-lib.mjs';
const lenses = option('lenses', 'classic,noir,volume,chroma').split(','), only = option('moves', '');
const { browser, page, errors } = await launch({ query: 'blur=0' });
const ids = (only ? only.split(',') : await page.evaluate(() => window.__fimken.moveIds()));
// Rest ankle height from the stance (root on the floor): the sole is at the floor when the ankle is at this height.
const rest = await page.evaluate(async () => {
  const s = window.__fimken; s.practice('stance'); await new Promise(r => setTimeout(r, 1500));
  const b = s.actor.rigControls.bones, p = new (s.actor.root.position.constructor)();
  return { left: b.leftFoot.getWorldPosition(p).y, right: b.rightFoot.getWorldPosition(p).y, rootY: s.actor.root.position.y };
});
console.log('rest ankle', JSON.stringify(rest), 'moves', ids.length);
const play = (id, restY) => page.evaluate(({ id, restY }) => new Promise(done => {
  const s = window.__fimken, b = s.actor.rigControls.bones, V = s.actor.root.position.constructor, v = new V();
  const result = { id, frames: 0, nan: 0, nanWhere: '', footMin: 1e9, outside: 0, maxAbs: 0, maxJump: 0, wall: 0, finished: false };
  let last = null; const t0 = performance.now(); s.practice(id);
  const tick = () => {
    result.frames++;
    const rp = s.actor.root.position, q = s.actor.root.quaternion;
    if (![rp.x, rp.y, rp.z, q.x, q.y, q.z, q.w].every(Number.isFinite)) { result.nan++; result.nanWhere ||= 'root'; }
    for (const [role, bone] of Object.entries(b)) {
      bone.getWorldPosition(v);
      if (!(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z))) { result.nan++; result.nanWhere ||= role; }
    }
    for (const side of ['left', 'right']) { b[side + 'Foot'].getWorldPosition(v); result.footMin = Math.min(result.footMin, v.y - restY[side]); }
    const ax = Math.max(Math.abs(rp.x), Math.abs(rp.z)); result.maxAbs = Math.max(result.maxAbs, ax); if (ax >= 2) result.outside++;
    if (last) result.maxJump = Math.max(result.maxJump, Math.hypot(rp.x - last[0], rp.y - last[1], rp.z - last[2])); last = [rp.x, rp.y, rp.z];
    result.wall = (performance.now() - t0) / 1000;
    if (s.director.moveId === id && s.director.time >= s.director.move.duration - 1e-6) { result.finished = true; result.duration = s.director.move.duration; return done(result); }
    if (result.wall > 90) return done(result);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), { id, restY });
const rows = [], failures = [];
for (const lens of lenses) {
  await page.evaluate(l => window.__fimken.setLens(l), lens); await page.waitForTimeout(800);
  for (const id of ids) {
    const before = errors.page.length;
    const r = await play(id, { left: rest.left, right: rest.right });
    r.lens = lens; r.pageErrors = errors.page.length - before; rows.push(r);
    const why = [];
    if (!r.finished) why.push('did not finish');
    if (r.pageErrors) why.push(`${r.pageErrors} page errors`);
    if (r.nan) why.push(`NaN in ${r.nanWhere}`);
    if (r.footMin < -.02) why.push(`foot ${(r.footMin * 100).toFixed(1)} cm below floor`);
    if (r.outside) why.push(`left arena (max ${r.maxAbs.toFixed(2)} m, ${r.outside} frames)`);
    if (r.maxJump > 3) why.push(`root jump ${r.maxJump.toFixed(2)} m`);
    if (why.length) { failures.push({ lens, id, why: why.join('; ') }); console.log('FAIL', lens, id, why.join('; ')); }
    else console.log('ok', lens, id, `${r.frames}f footMin ${(r.footMin * 100).toFixed(1)}cm max ${r.maxAbs.toFixed(2)}m`);
  }
}
console.log(JSON.stringify({ moves: ids.length, lenses, runs: rows.length, failures, totalErrors: errors.page.length, consoleErrors: errors.console.slice(0, 5) }, null, 1));
writeFileSync(option('out', 'art/qa/moves.json'), JSON.stringify({ rest, rows, failures, errors }, null, 1));
await browser.close();
process.exitCode = failures.length ? 1 : 0;
