import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGLB, validateManifest } from './character-asset.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const arg=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const input=arg('--input'), spec=arg('--manifest');
if(!input || !spec) {console.error('Usage: node scripts/import-character.mjs --input character.glb --manifest character.json [--promote] [--check-only]');process.exit(1);}
try {
  const bytes=await fs.readFile(path.resolve(input));
  const {report}=inspectGLB(bytes);
  const manifest=JSON.parse((await fs.readFile(path.resolve(spec),'utf8')).replace(/^\uFEFF/,''));
  const promote=args.includes('--promote');
  let validationReport=report;
  if(manifest.animations) {
    if(manifest.animationRig!=='quaternius-humanoid' || !manifest.animations.startsWith('/animations/') || !manifest.animations.endsWith('.gltf')) throw new Error('External GLB animation libraries require a local humanoid glTF mapping.');
    const publicRoot=path.join(root,'public'),libraryPath=path.resolve(publicRoot,'.'+manifest.animations);
    if(!libraryPath.startsWith(publicRoot+path.sep)) throw new Error('Animation library must stay within public.');
    const library=JSON.parse(await fs.readFile(libraryPath,'utf8'));
    const names=(library.animations||[]).map(a=>a.name).filter(n=>n && n!=='A_TPose');
    if(!names.length) throw new Error('Animation library has no named clips.');
    validationReport={...report,animations:names};
    report.externalAnimationLibrary={url:manifest.animations,clips:names};
  }
  const errors=validateManifest(manifest,validationReport,promote);
  if(JSON.stringify(manifest.provenance).includes('REPLACE_WITH')) errors.push('Replace the source and license placeholders before import.');
  // A renamed copy of the rejected local mesh must not be mistaken for an external hero.
  for(const old of ['public/characters/goku-hero/goku-scene.glb','public/characters/goku.glb','public/characters/beerus.glb']) {
    const oldBytes=await fs.readFile(path.join(root,old)).catch(()=>null);
    if(oldBytes && inspectGLB(oldBytes).report.sha256===report.sha256) errors.push('Rejected procedural debug asset cannot become the external hero.');
  }
  if(errors.length) throw new Error(errors.join('\n'));
  if(args.includes('--check-only')) { console.log(JSON.stringify(report,null,2)); process.exit(0); }
  const folder=path.join(root,'public/characters/imported',manifest.id);
  await fs.mkdir(folder,{recursive:true});
  const filename=report.sha256.slice(0,16)+'.glb';
  await fs.writeFile(path.join(folder,filename),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST') throw e;});
  await fs.writeFile(path.join(folder,'inspection.json'),JSON.stringify(report,null,2)+'\n');
  const definition={...manifest,url:`/characters/imported/${manifest.id}/${filename}`,format:'gltf',status:promote?'ready':'candidate',sha256:report.sha256};
  const config=path.join(root,'src/engine/hero-asset.json');
  const previous=await fs.readFile(config,'utf8');
  await fs.mkdir(path.join(root,'art/hero/history'),{recursive:true});
  await fs.writeFile(path.join(root,'art/hero/history',`${Date.now()}.json`),previous,{flag:'wx'});
  await fs.writeFile(config,JSON.stringify(definition,null,2)+'\n');
  console.log(`${definition.status}: ${definition.url}\nInspect at /?character=candidate&inspection=1. Structural checks do not certify artwork quality.`);
} catch(error) {console.error(error.message);process.exit(1);}
