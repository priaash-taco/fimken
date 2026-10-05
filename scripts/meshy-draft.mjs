// One authorized image-to-3D draft only. No POST retries, rigging or animation calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stateDir=path.join(root,'.meshy');
const statePath=path.join(stateDir,'first-draft.json');
const command=process.argv[2]||'plan';
const config={ai_model:'meshy-6-lite',model_type:'standard',should_texture:true,texture_resolution:'2k',enable_pbr:true,should_remesh:true,target_polycount:30000,topology:'triangle',pose_mode:'a-pose'};
const plan={provider:'Meshy',endpoint:'/openapi/v1/image-to-3d',estimatedCredits:15,maxSubmissions:1,automaticRegeneration:false,reference:'output/imagegen/original-hero-concept.png',parameters:config,pricingChecked:'2026-10-04',pricingSource:'https://docs.meshy.ai/en/api/pricing'};
async function write(state) {await fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n');}
async function key() {
  if(process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY;
  const local=await fs.readFile(path.join(root,'.env.local'),'utf8').catch(()=>'');
  const line=local.split(/\r?\n/).find(line=>/^\s*MESHY_API_KEY\s*=/.test(line));
  const value=line?.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');
  if(!value) throw new Error('MESHY_API_KEY is not configured in .env.local. No request submitted.');
  return value;
}
async function api(endpoint,token,payload) {
  const response=await fetch('https://api.meshy.ai'+endpoint,{method:payload?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(120000),redirect:'error'});
  if(!response.ok) throw new Error(`Meshy HTTP ${response.status}. No automatic retry; inspect the saved draft state before any further action.`);
  return response.json();
}
try {
  if(command==='plan') {console.log(JSON.stringify(plan,null,2));process.exit(0);}
  if(command==='submit') {
    throw new Error('Meshy is on hold at the user’s request. No paid submission is enabled.');
    const token=await key();
    const source=await fs.readFile(path.join(root,plan.reference));
    await fs.mkdir(stateDir,{recursive:true});
    const state={...plan,status:'submission_pending',reservedCredits:15,createdAt:new Date().toISOString()};
    // Exclusive write prevents duplicate charge after interruptions or parallel invocation.
    await fs.writeFile(statePath,JSON.stringify(state,null,2)+'\n',{flag:'wx'});
    try {
      const task=await api(plan.endpoint,token,{...config,image_url:'data:image/png;base64,'+source.toString('base64')});
      if(typeof task.result!=='string' || !/^[a-zA-Z0-9-]+$/.test(task.result)) throw new Error('Unexpected task response. Do not submit again.');
      state.taskId=task.result;state.status='submitted';await write(state);
      console.log(JSON.stringify({status:state.status,taskId:state.taskId,reservedCredits:15}));
    } catch(error) {state.status='submission_uncertain';await write(state);throw error;}
  } else if(command==='status' || command==='download') {
    const state=JSON.parse(await fs.readFile(statePath,'utf8'));
    if(!state.taskId) throw new Error('No saved task ID. Do not resubmit; reconcile the first request in Meshy.');
    const task=await api(plan.endpoint+'/'+encodeURIComponent(state.taskId),await key());
    state.status=task.status;state.progress=task.progress;state.response=task;await write(state);
    console.log(JSON.stringify({status:task.status,progress:task.progress,consumedCredits:task.consumed_credits??null}));
    if(command==='download') {
      if(task.status!=='SUCCEEDED') throw new Error('First draft is not ready to download. No generation request made.');
      const asset=new URL(task.model_urls?.glb);
      if(asset.protocol!=='https:') throw new Error('Expected an HTTPS GLB download.');
      const response=await fetch(asset,{signal:AbortSignal.timeout(120000)});
      if(!response.ok) throw new Error(`Asset download HTTP ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.length<20 || bytes.readUInt32LE(0)!==0x46546c67) throw new Error('Downloaded asset is not a GLB.');
      const folder=path.join(root,'art/hero/meshy-draft');await fs.mkdir(folder,{recursive:true});
      await fs.writeFile(path.join(folder,'source.glb'),bytes);
      await fs.writeFile(path.join(folder,'provenance.json'),JSON.stringify({...plan,taskId:state.taskId,consumedCredits:task.consumed_credits??null,downloadedAt:new Date().toISOString()},null,2)+'\n');
      console.log('Saved art/hero/meshy-draft/source.glb. Review and rig locally; do not regenerate.');
    }
  } else throw new Error('Use plan, submit, status or download.');
} catch(error) { console.error(error.code==='EEXIST'?'The first draft was already reserved/submitted. Use status; a second paid generation is blocked.':error.message);process.exit(1); }
