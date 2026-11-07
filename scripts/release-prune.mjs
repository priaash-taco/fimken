// Prunes dist/ after `vite build` so only deployable assets ship: the one hero GLB named in
// src/engine/hero-asset.json, no raw Meshy source, debug characters, studies or concept art.
//   node scripts/release-prune.mjs [--dist dist] [--limit-mb 60]
import { readdirSync, statSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf('--' + n); return i < 0 ? f : args[i + 1]; };
const dist = opt('dist', 'dist'), limit = Number(opt('limit-mb', 60)) * 1024 * 1024;
if (!existsSync(dist)) { console.error(`No ${dist}/ folder. Run vite build first.`); process.exit(1); }
const hero = JSON.parse(readFileSync('src/engine/hero-asset.json', 'utf8'));
const keepHero = hero.url.replace(/^\//, '');
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const rel = f => relative(dist, f).split(sep).join('/');
// Rules: a path is removed when any rule returns true.
const drop = [
  p => p.startsWith('studies/'),
  p => p.startsWith('characters/') && p !== keepHero,
  p => p.startsWith('logos/ChatGPT'),
  p => /^Meshy_AI_.*\.glb$/.test(p.split('/').pop()),
];
let removed = 0, removedBytes = 0;
for (const f of walk(dist)) {
  const p = rel(f);
  if (drop.some(rule => rule(p))) { removedBytes += statSync(f).size; removed++; rmSync(f); }
}
// Remove folders left empty.
const prune = d => { for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) prune(join(d, e.name)); if (d !== dist && !readdirSync(d).length) rmSync(d, { recursive: true }); };
prune(dist);
if (!existsSync(join(dist, keepHero))) { console.error(`Hero asset ${keepHero} is missing from ${dist}/`); process.exit(1); }

const mb = n => (n / 1048576).toFixed(2).padStart(7) + ' MB';
const files = walk(dist).map(f => ({ p: rel(f), size: statSync(f).size }));
const groups = new Map();
for (const { p, size } of files) { const k = p.includes('/') ? p.split('/')[0] + '/' : '(root)'; groups.set(k, (groups.get(k) || 0) + size); }
const total = files.reduce((s, f) => s + f.size, 0);
console.log(`Pruned ${removed} files (${mb(removedBytes).trim()}). Kept:`);
for (const [k, v] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`  ${mb(v)}  ${k}`);
console.log('Largest files:');
for (const f of files.sort((a, b) => b.size - a.size).slice(0, 8)) console.log(`  ${mb(f.size)}  ${f.p}`);
console.log(`  ${mb(total)}  TOTAL (${files.length} files)`);
if (total > limit) { console.error(`dist is over the ${limit / 1048576} MB budget`); process.exit(1); }
