// Plays moves mirrored and turned, as Auto may, and saves contact sheets to art/previews/motion/rehearse/.
//   node scripts/rehearse-variations.mjs   (dev server on 5174)
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const browser = await chromium.launch({ channel:'msedge', args:['--force_high_performance_gpu'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('http://127.0.0.1:5174/');
await page.waitForFunction(() => document.querySelector('#battle')?.dataset.ready === 'true' && window.__fimken, null, { timeout: 90000 });
mkdirSync('art/previews/motion/rehearse',{recursive:true});
const cases=[['strikes',{mirror:true,heading:.6},[.46,.85,1.27,1.7]],['heavy',{mirror:true,heading:-.7},[.6,.93,1.1]],['flying',{mirror:false,heading:.7},[.65,1.2,1.6]],['dash',{mirror:true,heading:-.9},[.26,.58,.8]],['flip',{mirror:true,heading:.8},[.4,.62,.86]],['spin',{heading:.6},[.5,1.05,1.6]],['reaction',{mirror:true,heading:.6},[.18,.36,.75]]];
for(const [id,variation,times] of cases){
  const sheet=await page.evaluate(async({id,variation,times})=>{const s=window.__fimken,raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    s.paused=true;s.pipeline.comparing=true;s.autoCamera=false;s.director.rehearse(id,variation);const c=document.createElement('canvas');c.width=times.length*426;c.height=240;const x=c.getContext('2d');
    for(let i=0;i<times.length;i++){s.director.seek(times[i]);s.time=times[i];s.vfx.reset();s.actor.showcasePose=s.director.pose;s.actor.update(0,s.time,'idle',s.music);s.cinematography.update(0,s.director,s.followPoint(),s.view,true);s.controls.update();await raf();x.drawImage(s.canvas,i*426,0,426,240);}
    return c.toDataURL('image/jpeg',.9);},{id,variation,times});
  writeFileSync(`art/previews/motion/rehearse/${id}.jpg`,Buffer.from(sheet.split(',')[1],'base64'));console.log(id);}
await browser.close();
