import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('record the normal-speed action showcase',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:1280,height:960});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug=1');const c=page.locator('#battle');await expect(c).toHaveAttribute('data-ready','true',{timeout:40000});
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('Cinematic camera').check();
 await page.evaluate(()=>{
   const stream=document.querySelector('#battle').captureStream(30),chunks=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:7000000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   window.previewRecording={recorder,stream,chunks};recorder.start();
 });
 const started=Date.now();
 await page.getByRole('button',{name:'Action sequence',exact:true}).click();
 await expect(c).toHaveAttribute('data-phase','kick',{timeout:15000});
 await expect(c).toHaveAttribute('data-beam-visible','true',{timeout:20000});
 await expect(c).toHaveAttribute('data-progress','1.000',{timeout:15000});
 expect(Date.now()-started).toBeLessThan(14500);
 const data=await page.evaluate(()=>new Promise(resolve=>{
   const {recorder,stream,chunks}=window.previewRecording;
   recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));delete window.previewRecording;};recorder.stop();
 }));
 fs.writeFileSync('art/previews/action-sequence.webm',Buffer.from(data,'base64'));expect(errors).toEqual([]);
});
