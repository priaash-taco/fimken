import {test,expect} from '@playwright/test';
test('supplied Meshy rig supports explicit neutral inspection, orbit, portrait and animation pause',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error' || m.text().includes('No target node found'))errors.push(m.text());});
 await page.goto('/?inspection=1&debug=1');const canvas=page.locator('#battle');
 await expect(canvas).toHaveAttribute('data-ready','true',{timeout:50000});
 await expect(canvas).toHaveAttribute('data-characters','meshy-hero');
 await expect(canvas).toHaveAttribute('data-postprocessing','false');
 await expect(canvas).toHaveAttribute('data-beam-visible','false');
 await page.screenshot({path:'art/previews/meshy-hero-neutral.png'});
 await page.getByRole('button',{name:'Open settings'}).click();
 await expect(page.getByRole('button',{name:'Pause animation'})).toBeVisible();
 await expect(page.getByLabel('Inspect without effects')).toBeChecked();
 await expect(page.getByRole('link',{name:'Inspect the external reference rig'})).toHaveCount(0);
 await page.getByLabel('Camera view').selectOption('portrait');
 await page.getByRole('button',{name:'Close settings'}).click();
 await page.screenshot({path:'art/previews/meshy-hero-face.png'});
 await page.getByRole('button',{name:'Open settings'}).click();
 await page.getByLabel('Camera view').selectOption('training');
 await page.getByRole('button',{name:'Close settings'}).click();
 await expect.poll(async()=>Number(await canvas.getAttribute('data-progress'))).toBeGreaterThan(.12);
 await page.getByRole('button',{name:'Open settings'}).click();
 await page.getByRole('button',{name:'Pause animation'}).click();
 await page.getByRole('button',{name:'Close settings'}).click();
 await page.screenshot({path:'art/previews/meshy-hero-motion-check.png'});
 await expect(canvas).toHaveAttribute('data-postprocessing','false');expect(errors).toEqual([]);
});


test('supplied rig plays a charge and release while neutral inspection keeps energy effects off',async({page})=>{
 test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error' || m.text().includes('No target node found'))errors.push(m.text());});
 await page.goto('/?inspection=1&debug=1');const canvas=page.locator('#battle');
 await expect(canvas).toHaveAttribute('data-ready','true',{timeout:40000});
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Beam release',exact:true}).click();
 await expect(canvas).toHaveAttribute('data-phase','charge',{timeout:12000});
 await expect.poll(async()=>Number(await canvas.getAttribute('data-progress'))).toBeGreaterThan(.25);
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Pause animation'}).click();await page.getByRole('button',{name:'Close settings'}).click();
 await page.screenshot({path:'art/previews/meshy-hero-charge-neutral.png'});
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Resume animation'}).click();await page.getByRole('button',{name:'Close settings'}).click();
 await expect(canvas).toHaveAttribute('data-phase','blast',{timeout:8000});
 await expect(canvas).toHaveAttribute('data-beam-visible','false');await expect(canvas).toHaveAttribute('data-postprocessing','false');
 expect(errors).toEqual([]);
});
