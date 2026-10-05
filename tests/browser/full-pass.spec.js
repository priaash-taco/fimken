import {test,expect} from '@playwright/test';
test('automatic showcase, compact controls and upgraded effects',async({page})=>{
 test.setTimeout(100000);await page.setViewportSize({width:1280,height:960});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?controls=1');const c=page.locator('#battle');await expect(c).toHaveAttribute('data-ready','true',{timeout:40000});await expect(c).toHaveAttribute('data-auto','true');
 await page.evaluate(()=>{window.moves=new Set();new MutationObserver(()=>window.moves.add(document.querySelector('#battle').dataset.move)).observe(document.querySelector('#battle'),{attributes:true,attributeFilter:['data-move']});});
 await expect.poll(()=>page.evaluate(()=>window.moves.size),{timeout:28000,intervals:[200]}).toBeGreaterThanOrEqual(3);
 await page.getByRole('button',{name:'Power up',exact:true}).click();await expect(c).toHaveAttribute('data-auto','false');
 await expect.poll(async()=>Number(await c.getAttribute('data-move-time')),{timeout:9000,intervals:[50]}).toBeGreaterThan(2.3);
 await page.getByRole('button',{name:'Pause animation'}).click();await page.screenshot({path:'art/previews/full-pass-powerup.png'});
 await page.getByRole('button',{name:'Audio and display'}).click();await expect(page.getByText('Advanced',{exact:true})).toBeHidden();await expect(page.getByLabel('Render quality',{exact:true})).toBeVisible();
 await page.getByLabel('Inspect without effects').check();await page.getByRole('button',{name:'Close controls'}).click();await expect(c).toHaveAttribute('data-postprocessing','false');await page.screenshot({path:'art/previews/full-pass-neutral.png'});
 await page.getByRole('button',{name:'Audio and display'}).click();await page.getByLabel('Inspect without effects').uncheck();await page.getByRole('button',{name:'Close controls'}).click();
 await page.getByRole('button',{name:'Beam release',exact:true}).click();await expect(c).toHaveAttribute('data-beam-visible','true',{timeout:13000});await expect.poll(async()=>Number(await c.getAttribute('data-beam-radius')),{timeout:5000,intervals:[30]}).toBeGreaterThan(1.6);await page.getByRole('button',{name:'Pause animation'}).click();await page.screenshot({path:'art/previews/full-pass-beam.png'});
 await page.getByRole('button',{name:'Automatic training',exact:true}).click();await expect(c).toHaveAttribute('data-auto','true');await expect(page.getByRole('button',{name:'Automatic training',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});

test('beam visibly grows from a narrow release to the sustained blast',async({page})=>{
 test.setTimeout(45000);await page.goto('/?debug=1');const c=page.locator('#battle');await expect(c).toHaveAttribute('data-ready','true',{timeout:30000});
 await page.evaluate(()=>{window.beamSamples=[];new MutationObserver(()=>{const c=document.querySelector('#battle');if(c.dataset.beamVisible==='true')window.beamSamples.push({radius:Number(c.dataset.beamRadius),length:Number(c.dataset.beamLength)});}).observe(document.querySelector('#battle'),{attributes:true,attributeFilter:['data-beam-radius']});});
 await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('button',{name:'Beam release',exact:true}).click();
 await expect(c).toHaveAttribute('data-progress','1.000',{timeout:18000});const samples=await page.evaluate(()=>window.beamSamples);expect(samples.length).toBeGreaterThan(4);
 expect(Math.min(...samples.map(s=>s.radius))).toBeLessThan(.7);expect(Math.max(...samples.map(s=>s.radius))).toBeGreaterThan(1.65);
});
