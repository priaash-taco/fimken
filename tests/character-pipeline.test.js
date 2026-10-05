import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectGLB, validateManifest } from '../scripts/character-asset.mjs';
import { CHARACTER, resolveCharacter } from '../src/engine/assets.js';
const seed=readFileSync(new URL('../public/characters/seed/seed.vrm',import.meta.url));
test('a pending production hero never silently falls back to procedural geometry',()=>{
 assert.equal(CHARACTER.id,'meshy-hero');assert.equal(CHARACTER.provenance.kind,'external');
 assert.equal(resolveCharacter('',{status:'pending'}).status,'reference');
 assert.equal(CHARACTER.defaultReview,true);
 assert.equal(resolveCharacter('?character=debug-goku').status,'debug');
 assert.equal(resolveCharacter('?character=reference').provenance.kind,'external');
 assert.throws(()=>resolveCharacter('',{status:'ready',url:'/bad.glb',provenance:{kind:'procedural'}}));
});
test('an actual external authored rig passes structural inspection with textures retained',()=>{
 const {report}=inspectGLB(seed);assert.deepEqual(report.errors,[]);
 assert.ok(report.skins>0);assert.ok(report.embeddedImages>=10);assert.ok(report.triangles>30000);
 const spec={id:'reference-seed',name:'Seed',height:2,facing:0,shading:'authored',provenance:{kind:'external',source:'official sample',license:'VRM Public License 1.0'},clips:{},bones:{}};
 assert.deepEqual(validateManifest(spec,report),[]);
 assert.ok(validateManifest(spec,report,true).some(s=>s.includes('idle')));
 assert.ok(validateManifest(spec,report,true).some(s=>s.includes('review')));
});
test('invalid containers, missing mappings and invented bone names are rejected',()=>{
 assert.throws(()=>inspectGLB(seed.subarray(0,100)));
 const {report}=inspectGLB(seed);
 assert.ok(validateManifest({id:'../escape',clips:{idle:'nonexistent'},bones:{head:'not-a-bone'}},report).length>=5);
});


test('the selected Meshy character is skinned and retains embedded source artwork',()=>{
 const {report}=inspectGLB(readFileSync(new URL('../public'+CHARACTER.url,import.meta.url)));
 assert.deepEqual(report.errors,[]);assert.equal(report.skins,1);
 assert.ok(report.bones.includes('head'));assert.ok(report.bones.includes('hand.R'));
 assert.equal(report.embeddedImages,3);assert.ok(report.triangles<200000);
});
