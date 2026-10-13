// Downloads the CMU BVH clips listed in scripts/convert-mocap.mjs into art/mocap/cmu (not committed).
// Source: https://github.com/Shriinivas/cmubvh. CMU places no restrictions on use of the data.
//   node scripts/fetch-mocap.mjs && node scripts/convert-mocap.mjs
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const SEQUENCES = { 12: 'Sequence-010-014', 16: 'Sequence-015-019', 42: 'Sequence-040-045', 76: 'Sequence-076-080', 85: 'Sequence-081-085', 118: 'Sequence-113-128', 127: 'Sequence-113-128', 135: 'Sequence-131-135', 144: 'Sequence-141-144' };
const ids = [...new Set([...readFileSync('scripts/convert-mocap.mjs', 'utf8').matchAll(/\['(\d+_\d+)', '(?:kick|punch|block|jump|flow)'/g)].map(m => m[1]))];
mkdirSync('art/mocap/cmu', { recursive: true });
for (const id of ids) {
  const file = `art/mocap/cmu/${id}.bvh`; if (existsSync(file)) continue;
  const subject = Number(id.split('_')[0]), sequence = SEQUENCES[subject]; if (!sequence) { console.log('no sequence for', id); continue; }
  const url = `https://github.com/Shriinivas/cmubvh/raw/main/${sequence}/${subject}/Data/${id}.zip`, zip = `art/mocap/cmu/${id}.zip`;
  const response = await fetch(url); if (!response.ok) { console.log(id, 'download failed', response.status); continue; }
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  execFileSync('tar', ['-xf', zip, '-C', 'art/mocap/cmu']); rmSync(zip); console.log('fetched', id);
}
console.log(ids.length, 'clips in the list');
