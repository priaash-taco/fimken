import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {verifyReference,reserveSubmission,generationPayload} from '../scripts/meshy-hero.mjs';
const root=path.resolve(import.meta.dirname,'..');

test('generation uses the exact approved image for geometry and texture without restyling',async()=>{
 const plan=JSON.parse(await fs.readFile(path.join(root,'art/hero/meshy-hero-plan.json'),'utf8'));
 const {image,spec}=await verifyReference(root,plan);const payload=generationPayload(plan,image);
 assert.equal(spec.sha256,'5b8ca6c846c5952b28b3a7e292ed39b18a6c6a637315f601795dca4274294ed3');
 assert.equal(payload.image_url,payload.texture_image_url);assert.equal(payload.image_enhancement,false);
 assert.deepEqual(Buffer.from(payload.image_url.split(',')[1],'base64'),image);
 assert.equal(plan.maxSubmissions,1);assert.equal(plan.automaticRegeneration,false);
});
test('modified artwork is rejected and duplicate paid reservations cannot replace the first',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fimken-hero-'));
 try {
  await fs.writeFile(path.join(dir,'hero.png'),'changed');
  await fs.writeFile(path.join(dir,'reference.json'),JSON.stringify({reference:'hero.png',sha256:'wrong',redesignAllowed:false,proceduralCharacterAllowed:false}));
  await assert.rejects(verifyReference(dir,{referenceManifest:'reference.json'}),/Canonical reference changed/);
  const file=path.join(dir,'task.json');await reserveSubmission(file,{taskId:'first'});
  await assert.rejects(reserveSubmission(file,{taskId:'second'}),{code:'EEXIST'});
  assert.equal(JSON.parse(await fs.readFile(file,'utf8')).taskId,'first');
 } finally {
  const resolved=path.resolve(dir),temp=path.resolve(os.tmpdir());
  if(path.dirname(resolved)!==temp || !path.basename(resolved).startsWith('fimken-hero-')) throw new Error('Unexpected temporary test directory');
  await fs.rm(resolved,{recursive:true,force:true});
 }
});
