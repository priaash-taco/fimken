// Canonical hero only: one paid generation, no POST retries or regeneration.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectGLB } from './character-asset.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const statePath=path.join(root,'.meshy/canonical-hero.json');
const planPath=path.join(root,'art/hero/meshy-hero-plan.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJSON=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const writeJSON=async(file,value,options={})=>fs.writeFile(file,JSON.stringify(value,null,2)+'\n',options);
export async function verifyReference(base,plan) {
  const spec=await readJSON(path.join(base,plan.referenceManifest));
  const image=await fs.readFile(path.join(base,spec.reference));
  if(sha(image)!==spec.sha256) throw new Error('Canonical reference changed. Submission blocked; restore the approved PNG.');
  if(spec.redesignAllowed!==false || spec.proceduralCharacterAllowed!==false) throw new Error('Canonical design constraints are missing.');
  return {spec,image};
}
export async function reserveSubmission(file,state) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  await writeJSON(file,state,{flag:'wx'});
}
async function getKey() {
  const local=await fs.readFile(path.join(root,'.env.local'),'utf8').catch(()=>'');
  const line=local.split(/\r?\n/).find(s=>/^\s*MESHY_API_KEY\s*=/.test(s));
  const value=(process.env.MESHY_API_KEY || line?.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2') || '').trim();
  if(!value) throw new Error('MESHY_API_KEY is missing. Add it to the local .env.local file. No request submitted.');
  return value;
}
async function api(endpoint,token,payload) {
  const response=await fetch('https://api.meshy.ai'+endpoint,{method:payload?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(120000),redirect:'error'});
  if(!response.ok) throw new Error(`Meshy HTTP ${response.status}. No automatic retry. If a submission was reserved, reconcile that task before further spending.`);
  return response.json();
}
export function generationPayload(plan,image) {
  const uri='data:image/png;base64,'+image.toString('base64');
  return {...plan.parameters,image_url:uri,texture_image_url:uri};
}
async function downloadGLB(url,destination) {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:' || parsed.username || parsed.password) throw new Error('Expected an HTTPS model download URL.');
  const response=await fetch(parsed,{signal:AbortSignal.timeout(120000),redirect:'error'});
  if(!response.ok) throw new Error(`GLB download HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const {report}=inspectGLB(bytes); // static mesh is expected to report missing skin before local rigging
  await fs.writeFile(destination,bytes);
  await writeJSON(destination+'.inspection.json',report);
  return report;
}
export async function main(command) {
  const plan=await readJSON(planPath);
  const {spec,image}=await verifyReference(root,plan);
  if(command==='plan') {console.log(JSON.stringify({...plan,referenceSHA256:spec.sha256},null,2));return;}
  if(command==='check') {await getKey();console.log('Canonical hash verified. Meshy key configured. No network request made.');return;}
  if(command==='submit') {
    const existing=await readJSON(path.join(root,'art/hero/generation-status.json'));
    if(existing.mesh==='user_supplied_and_imported') throw new Error('The user supplied the model and it is already imported. No further generation is needed.');
    const token=await getKey();
    const state={status:'submission_pending',referenceSHA256:spec.sha256,plan,planSHA256:sha(JSON.stringify(plan)),reservedCredits:plan.estimatedCredits,createdAt:new Date().toISOString()};
    await reserveSubmission(statePath,state);
    try {
      const task=await api(plan.endpoint,token,generationPayload(plan,image));
      if(typeof task.result!=='string' || !/^[a-zA-Z0-9-]+$/.test(task.result)) throw new Error('Unexpected task response. Reconcile in Meshy; do not resubmit.');
      state.taskId=task.result;state.status='submitted';await writeJSON(statePath,state);
      console.log(JSON.stringify({status:state.status,taskId:state.taskId,reservedCredits:state.reservedCredits}));
    } catch(error) {state.status='submission_uncertain';await writeJSON(statePath,state);throw error;}
    return;
  }
  if(!['status','download'].includes(command)) throw new Error('Use plan, check, submit, status or download.');
  const state=await readJSON(statePath);
  if(!state.taskId || !/^[a-zA-Z0-9-]+$/.test(state.taskId)) throw new Error('No saved task ID. Reconcile the first submission; do not resubmit.');
  if(state.referenceSHA256!==spec.sha256 || state.planSHA256!==sha(JSON.stringify(plan))) throw new Error('Task reference or plan mismatch. Restore the submitted plan before resuming.');
  const task=await api(plan.endpoint+'/'+encodeURIComponent(state.taskId),await getKey());
  state.status=task.status;state.progress=task.progress;state.response=task;await writeJSON(statePath,state);
  console.log(JSON.stringify({status:task.status,progress:task.progress,consumedCredits:task.consumed_credits??null}));
  if(command!=='download') return;
  if(task.status!=='SUCCEEDED') throw new Error('The model is not ready to download. No new generation request made.');
  const folder=path.join(root,'art/hero/meshy-canonical');await fs.mkdir(folder,{recursive:true});
  const report=await downloadGLB(task.model_urls?.glb,path.join(folder,'source.glb'));
  if(task.model_urls?.pre_remeshed_glb) await downloadGLB(task.model_urls.pre_remeshed_glb,path.join(folder,'detailed-source.glb'));
  await writeJSON(path.join(folder,'provenance.json'),{provider:'Meshy',taskId:state.taskId,referenceSHA256:spec.sha256,plan,consumedCredits:task.consumed_credits??null,sourceSHA256:report.sha256,downloadedAt:new Date().toISOString(),license:'Verify account-specific Meshy output terms before runtime promotion.',neutralReviewPassed:false});
  console.log('Saved art/hero/meshy-canonical/source.glb and detailed source when available. Next: local rigging, deformation review and neutral candidate import.');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main(process.argv[2]||'plan').catch(error=>{console.error(error.code==='EEXIST'?'A canonical hero submission is already reserved. Use status; a second paid generation is blocked.':error.message);process.exitCode=1;});
}
