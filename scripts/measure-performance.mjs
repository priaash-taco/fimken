// Performance baseline for the showcase. Uses GPU timer queries for a per-pass breakdown,
// script timers for the per-system CPU cost, and the in-app monitor for real frame pacing.
//   node scripts/measure-performance.mjs [--port 5173] [--sizes 1920x1080,2560x1440] [--dpr 1] [--headed] [--discrete] [--quick] [--live] [--query perf=1] [--out file.json]
// Nothing is changed permanently: each switch is restored after its measurement.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const base = `http://127.0.0.1:${option('port', process.env.FIMKEN_PORT || 5173)}/`;
const sizes = option('sizes', '1920x1080,2560x1440').split(',').map(s => s.split('x').map(Number));
const quick = args.includes('--quick');
// --discrete asks Chromium for the high-performance adapter on dual-GPU laptops.
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: !args.includes('--headed'),
  args: args.includes('--discrete') ? ['--force_high_performance_gpu'] : [] });
const report = [];

// Installed once per page: sequential (never nested) timer queries around the shadow map,
// the main scene draw and every post-processing pass, plus script timers per system.
const install = () => {
  const PASSES = window.__passes = ['scene', 'bloom', 'finish (heat, grade, tone map, sRGB)', 'fxaa'];
  const s = window.__fimken, gl = s.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const P = window.__profile = { on: false, queries: [], cpu: {}, ext };
  const begin = () => { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); return q; };
  const end = (name, q) => { gl.endQuery(ext.TIME_ELAPSED_EXT); P.queries.push({ name, q }); };
  const shadows = s.renderer.shadowMap, renderShadows = shadows.render.bind(shadows);
  let sceneQuery = null;
  shadows.render = (lights, scene, camera) => {
    if (!P.on || scene !== s.scene || !ext) return renderShadows(lights, scene, camera);
    const q = begin(); renderShadows(lights, scene, camera); end('shadow map', q); sceneQuery = begin();
  };
  const after = s.scene.onAfterRender;
  s.scene.onAfterRender = (...a) => { after.apply(s.scene, a); if (sceneQuery) { end('scene', sceneQuery); sceneQuery = null; } };
  const names = PASSES; s.performance.gpuTiming = false;
  s.pipeline.composer.passes.forEach((pass, i) => {
    if (i === 0) return; const render = pass.render.bind(pass);
    pass.render = (...a) => { if (!P.on || !ext) return render(...a); const q = begin(); render(...a); end(names[i], q); };
  });
  const time = (object, method, name) => { const original = object[method].bind(object); object[method] = (...a) => { if (!P.on) return original(...a); const t = performance.now(), r = original(...a); (P.cpu[name] ||= []).push(performance.now() - t); return r; }; };
  time(s.director, 'update', 'choreography'); time(s.actor, 'update', 'character (clips + IK)'); time(s.vfx, 'update', 'effects'); time(s.pipeline, 'render', 'render submission');
  time(s.lighting, 'update', 'lighting'); time(s.world, 'update', 'environment'); time(s, 'frame', 'whole frame');
};
const sample = ({ setup, frames }) => new Promise(async done => {
  const s = window.__fimken, P = window.__profile, gl = s.renderer.getContext();
  const undo = new Function('s', setup || '')(s);
  const wait = n => new Promise(r => { const tick = () => (--n > 0 ? requestAnimationFrame(tick) : r()); requestAnimationFrame(tick); });
  await wait(4); P.queries = []; P.cpu = {}; s.performance.count = s.performance.index = 0; P.on = true; await wait(frames); P.on = false; await wait(6);
  const gpu = {}, median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  for (const { name, q } of P.queries) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) (gpu[name] ||= []).push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
  const round = v => +v.toFixed(2), gpuMs = Object.fromEntries(Object.entries(gpu).map(([k, v]) => [k, round(median(v))]));
  const pace = s.performance.snapshot();
  const result = { fps: round(pace.fps), frameMs: round(pace.frameMs), p95Ms: round(pace.p95Ms), worstMs: round(pace.worstMs), gpuTotalMs: round(Object.values(gpuMs).reduce((a, b) => a + b, 0)), gpuMs,
    cpuMs: Object.fromEntries(Object.entries(P.cpu).map(([k, v]) => [k, round(median(v))])), draws: pace.calls, triangles: pace.triangles, points: pace.points, buffer: pace.resolution, renderScale: pace.renderScale };
  if (typeof undo === 'function') undo();
  done(result);
});
const inventory = () => {
  const PASSES = window.__passes;
  const s = window.__fimken, gl = s.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info'), textures = new Map(), MB = 1048576;
  const add = (t, owner, slot) => { if (t?.isTexture && t.image?.width) textures.set(t.uuid, { owner, slot, size: `${t.image.width}×${t.image.height}`, megabytes: +(t.image.width * t.image.height * 4 * (t.generateMipmaps ? 4 / 3 : 1) / MB).toFixed(1) }); };
  s.scene.traverse(o => { for (const m of [o.material].flat().filter(Boolean)) { for (const [k, v] of Object.entries(m)) add(v, o.name || o.type, k); for (const [k, u] of Object.entries(m.uniforms || {})) add(u.value, o.name || o.type, k); } });
  add(s.scene.environment, 'Scene', 'environment');
  const [w, h] = [s.canvas.width, s.canvas.height], scale = Number(s.canvas.dataset.renderScale), shadow = s.lighting.key.shadow.mapSize.x;
  const targets = { [`canvas (${gl.getParameter(gl.SAMPLES) || 1} sample, RGBA8)`]: w * h * 4 * ((gl.getParameter(gl.SAMPLES) || 0) + 1) / MB, 'composer buffers (2 × RGBA16F)': w * h * scale * scale * 8 * 2 / MB, 'bloom chain (RGBA16F)': w * h * scale * scale * 8 * (1 + 2 * (1 / 4 + 1 / 16 + 1 / 64 + 1 / 256 + 1 / 1024)) / MB, [`shadow map ${shadow}² (depth)`]: shadow * shadow * 4 / MB };
  const list = [...textures.values()].sort((a, b) => b.megabytes - a.megabytes);
  return { gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown', devicePixelRatio, canvasBuffer: `${w}×${h}`, quality: s.pipeline.quality,
    passes: s.pipeline.composer.passes.map((p, i) => PASSES[i] + (p.enabled ? '' : ' (off)')),
    textureMegabytes: +list.reduce((a, t) => a + t.megabytes, 0).toFixed(0), largestTextures: list.slice(0, 6), renderTargetMegabytes: Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, +v.toFixed(0)])),
    particles: { 'aura sparks': s.vfx.sparks.geometry.drawRange.count, 'charge spiral': s.vfx.spiral.geometry.drawRange.count, 'ambient dust': Math.min(s.world.dust.geometry.drawRange.count, s.world.count), 'parallax stars': 360 },
    lights: s.scene.children.filter(o => o.isLight).map(l => l.type + (l.castShadow ? ' (shadow)' : '')), geometries: s.renderer.info.memory.geometries, programs: s.renderer.info.programs.length };
};

const hide = (expression, label) => [label, `const o=[${expression}].flat();const v=o.map(m=>m.visible);o.forEach(m=>m.visible=false);return()=>o.forEach((m,i)=>m.visible=v[i]);`];
const switches = [
  hide('s.actor.model', 'hero body hidden (ink kept)'), hide('s.actor.heroFinish.outlines', 'silhouette ink hidden'), hide('s.actor.root', 'whole hero hidden'),
  ['shadows off', 's.lighting.key.castShadow=false;return()=>{s.lighting.key.castShadow=true;};'],
  ['effects off', 'const e=s.effects;s.effects=0;return()=>{s.effects=e;};'],
  hide('s.world.floor', 'floor hidden'), hide('s.world.cosmos.root,s.world.haze,s.world.dust', 'sky, moon, sun, haze hidden'),
  ['quality balanced', "s.setQuality('balanced');return()=>s.setQuality('high');"], ['quality low', "s.setQuality('low');return()=>s.setQuality('high');"],
];

for (const [width, height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(option('dpr', 1)) });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto(base + '?controls=1' + (option('query', '') ? '&' + option('query', '') : ''));
  await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
  if (args.includes('--live')) {
    // Untouched page: automatic training with the resolution governor free to act.
    await page.waitForTimeout(16000);
    const live = await page.evaluate(() => { const s = window.__fimken, p = s.performance.snapshot(), gl = s.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info'); const r = v => v == null ? null : +v.toFixed(1);
      return { gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown', fps: r(p.fps), frameMs: r(p.frameMs), p95Ms: r(p.p95Ms), worstMs: r(p.worstMs), gpuMs: r(p.gpuMs), scriptMs: r(p.scriptMs), draws: p.calls, triangles: p.triangles, canvas: p.resolution, renderScale: p.renderScale }; });
    report.push({ viewport: `${width}×${height}`, live }); console.log(JSON.stringify({ viewport: `${width}×${height}`, live })); await page.close(); continue;
  }
  await page.evaluate(install);
  // Hold the internal resolution still while measuring so switches are comparable.
  await page.evaluate(() => { const s = window.__fimken; s.pipeline.comparing = true; s.practice('powerup'); s.autoCamera = true; });
  await page.waitForTimeout(4500);
  const entry = { viewport: `${width}×${height}`, inventory: await page.evaluate(inventory), scenarios: {}, switches: {} };
  const frames = quick ? 20 : 40;
  entry.scenarios['power-up hold (aura, heat, bloom)'] = await page.evaluate(sample, { frames });
  if (!quick) for (const [label, setup] of switches) entry.switches[label] = await page.evaluate(sample, { setup, frames: 24 });
  await page.evaluate(() => { const s = window.__fimken; s.reviewAction(4.4, 'blast'); s.cinematography.update(0, s.director, s.followPoint(), s.view, true); });
  entry.scenarios['beam sustained (paused at 4.4 s)'] = await page.evaluate(sample, { frames });
  await page.evaluate(() => { const s = window.__fimken; s.practice('stance'); });
  await page.waitForTimeout(1500);
  entry.scenarios['idle stance (no aura)'] = await page.evaluate(sample, { frames });
  await page.evaluate(() => { const s = window.__fimken; s.practice('freestyle'); });
  await page.waitForTimeout(500);
  entry.scenarios['auto training (moving)'] = await page.evaluate(sample, { frames: quick ? 40 : 90 });
  report.push(entry); console.log(JSON.stringify(entry, null, 1));
  await page.close();
}
if (option('out', '')) writeFileSync(option('out', ''), JSON.stringify(report, null, 1));
await browser.close();
