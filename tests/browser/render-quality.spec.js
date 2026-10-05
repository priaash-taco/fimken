import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('sharpness comparison keeps asset pose and camera, reports GPU sampling and restores cinematic settings',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?debug=1');const c=page.locator('#battle');await expect(c).toHaveAttribute('data-ready','true',{timeout:40000});
 const open=()=>page.getByRole('button',{name:'Open settings'}).click();const close=()=>page.getByRole('button',{name:'Close settings'}).click();
 await open();await page.getByLabel('Camera view',{exact:true}).selectOption('portrait');await page.getByRole('button',{name:'Energy charge',exact:true}).click();
 await expect(c).toHaveAttribute('data-progress','1.000',{timeout:20000});
 await open();await page.getByText('Quality / debug',{exact:true}).click();await page.getByRole('button',{name:'Cinematic',exact:true}).click();
 const readings=page.getByLabel('Renderer diagnostics');const read=async()=>JSON.parse(await readings.getAttribute('data-report'));
 await expect.poll(async()=>(await read()).mode).toBe('cinematic');const cinematic=await read();
 await close();await page.screenshot({path:'art/previews/quality-cinematic.png'});
 await open();await page.getByRole('button',{name:'Sharp / original',exact:true}).click();await expect.poll(async()=>(await read()).mode).toBe('sharp');const sharp=await read();
 expect(sharp.asset).toBe(cinematic.asset);for(const k of ['position','quaternion','target'])sharp.camera[k].forEach((v,i)=>expect(v).toBeCloseTo(cinematic.camera[k][i],9));expect(sharp.camera.fov).toBe(cinematic.camera.fov);expect(sharp.pose).toEqual(cinematic.pose);
 expect(sharp.treatment).toMatchObject({material:'authored',celStrength:0,outlineVisible:false,bloom:false,heatDistortion:false,postProcessing:false,aura:false,neutralLighting:true});
 expect(sharp.antialiasing).toMatchObject({sceneUsesDefaultFramebuffer:true,fxaa:false});
 expect(sharp.textures.length).toBe(3);
 for(const t of sharp.textures){expect(t.gpuSampling.anisotropy).toBe(sharp.gpu.maxAnisotropy);expect(t.compressed).toBe(false);expect(t.exceedsGpuTextureLimit).toBe(false);}
 expect(sharp.viewport.rendererPixelRatio).toBeGreaterThanOrEqual(cinematic.viewport.rendererPixelRatio);
 await close();await page.screenshot({path:'art/previews/quality-sharp.png'});
 await open();await page.getByRole('button',{name:'Cinematic',exact:true}).click();await expect.poll(async()=>(await read()).mode).toBe('cinematic');const restored=await read();
 for(const k of ['position','quaternion','target'])restored.camera[k].forEach((v,i)=>expect(v).toBeCloseTo(cinematic.camera[k][i],9));expect(restored.pose).toEqual(cinematic.pose);expect(restored.viewport).toEqual(cinematic.viewport);expect(restored.textures).toEqual(cinematic.textures);expect(restored.treatment).toEqual(cinematic.treatment);
 fs.writeFileSync('art/previews/render-quality-report.json',JSON.stringify({cinematic,sharp,restored},null,2));
 await page.getByRole('button',{name:'Finish comparison',exact:true}).click();await expect(c).toHaveAttribute('data-comparison','live');
 await expect(page.getByRole('button',{name:'Pause animation'})).toBeEnabled();
 expect(errors).toEqual([]);
});
