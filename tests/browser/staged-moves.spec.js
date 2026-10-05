import {test,expect} from '@playwright/test';
test('all staged actions can be triggered and reviewed without effects',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width:1280,height:960});await page.goto('/?inspection=1');const c=page.locator('#battle');await expect(c).toHaveAttribute('data-ready','true',{timeout:40000});
 await page.getByRole('button',{name:'Energy charge',exact:true}).click();await expect(c).toHaveAttribute('data-progress','1.000',{timeout:12000});await page.screenshot({path:'art/previews/staged-charge-neutral.png'});
 for(const [id,time] of [['dash',.4],['strikes',1.2],['heavy',.7],['flying',1.0],['spin',.8],['hover',2],['airborne',1.5],['reaction',.25],['transformation',2.8]]){
  await page.getByLabel('Movement sequence',{exact:true}).selectOption(id);await expect(c).toHaveAttribute('data-move',id);
  await expect.poll(async()=>Number(await c.getAttribute('data-move-time')),{timeout:10000,intervals:[20]}).toBeGreaterThanOrEqual(time);
  await page.screenshot({path:`art/previews/staged-${id}-neutral.png`});
  await expect(c).toHaveAttribute('data-progress','1.000',{timeout:12000});await expect(c).toHaveAttribute('data-postprocessing','false');await expect(c).toHaveAttribute('data-beam-visible','false');
 }
 expect(errors).toEqual([]);
});
