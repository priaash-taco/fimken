import {test,expect} from '@playwright/test';
test('neutral action sequence exposes the strikes, pivot kick and landing without effects',async({page})=>{
 test.setTimeout(100000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?inspection=1&debug=1');const c=page.locator('#battle');await expect(c).toHaveAttribute('data-ready','true',{timeout:40000});
 const open=()=>page.getByRole('button',{name:'Open settings'}).click();const close=()=>page.getByRole('button',{name:'Close settings'}).click();
 await open();await page.getByLabel('Cinematic camera').uncheck();await page.getByText('Advanced',{exact:true}).click();await page.getByLabel('Playback speed').selectOption('0.25');await page.getByRole('button',{name:'Action sequence',exact:true}).click();
 for(const [time,name]of [[1.13,'strike'],[3.03,'kick'],[4.18,'landing']]){
   await expect.poll(async()=>Number(await c.getAttribute('data-move-time')),{timeout:25000,intervals:[40]}).toBeGreaterThanOrEqual(time);
   await open();await page.getByRole('button',{name:'Pause animation'}).click();await close();
   await page.screenshot({path:`art/previews/action-neutral-${name}.png`});
   await expect(c).toHaveAttribute('data-postprocessing','false');await expect(c).toHaveAttribute('data-beam-visible','false');
   await open();await page.getByRole('button',{name:'Resume animation'}).click();await close();
 }
 await open();await page.getByLabel('Playback speed').selectOption('1');await close();
 await expect(c).toHaveAttribute('data-phase','blast',{timeout:12000});await expect(c).toHaveAttribute('data-beam-visible','false');
 await expect(c).toHaveAttribute('data-progress','1.000',{timeout:10000});await expect(c).toHaveAttribute('data-phase','idle');
 expect(errors).toEqual([]);
});

test('exact neutral pose review and normal-speed cinematic sequence keep the existing asset',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?inspection=1&debug=1');const c=page.locator('#battle');await expect(c).toHaveAttribute('data-ready','true',{timeout:40000});
 const open=()=>page.getByRole('button',{name:'Open settings'}).click();const close=()=>page.getByRole('button',{name:'Close settings'}).click();
 await open();await page.getByLabel('Cinematic camera').uncheck();await page.getByText('Advanced',{exact:true}).click();
 for(const [time,name]of [['1.13','strike'],['3.03','kick'],['4.18','landing']]){
   await page.getByLabel('Review action pose').fill(time);await close();await expect(c).toHaveAttribute('data-move-time',Number(time).toFixed(3));
   await page.screenshot({path:`art/previews/action-neutral-${name}.png`});await expect(c).toHaveAttribute('data-beam-visible','false');await open();
 }
 await page.getByLabel('Inspect without effects').uncheck();await page.getByLabel('Cinematic camera').check();
 await page.evaluate(()=>{window.actionPhases=[];new MutationObserver(()=>{window.actionPhases.push(document.querySelector('#battle').dataset.phase);}).observe(document.querySelector('#battle'),{attributes:true,attributeFilter:['data-phase']});});
 await page.getByRole('button',{name:'Action sequence',exact:true}).click();
 await expect(c).toHaveAttribute('data-phase','kick',{timeout:12000});
 await expect.poll(()=>page.evaluate(()=>window.actionPhases.includes('dash')),{timeout:8000,intervals:[50]}).toBe(true);
 await expect(c).toHaveAttribute('data-beam-visible','true',{timeout:12000});await page.screenshot({path:'art/previews/action-sequence-beam.png'});
 await expect(c).toHaveAttribute('data-progress','1.000',{timeout:12000});await expect(c).toHaveAttribute('data-characters','meshy-hero');
 expect(Number(await c.getAttribute('data-contacts'))).toBe(6);expect(Number(await c.getAttribute('data-impacts'))).toBe(1);
 await open();await page.getByLabel('Review action pose').fill('3.03');await close();await page.screenshot({path:'art/previews/action-sequence-kick.png'});
 expect(errors).toEqual([]);
});
