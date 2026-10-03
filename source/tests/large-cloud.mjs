import{chromium,expect}from'@playwright/test';import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:760}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.evaluate(()=>{window.drawCounts=[];for(const name of['drawArrays','drawElements']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){window.drawCounts.push({name,count:name==='drawArrays'?args[2]:args[1]});if(window.drawCounts.length>500)window.drawCounts.shift();return original.apply(this,args);};}});
 await page.setContent(await readFile('web/index.html','utf8'));
 await page.setInputFiles('#file-input','../upload/421005_laser_scan.ply');await expect(page.locator('#vertex-count')).toHaveText('3,286,152',{timeout:120000});
 await expect(page.locator('#render-detail')).toHaveText('全量显示');
 await page.mouse.move(350,300);await page.mouse.down();await page.mouse.move(450,370,{steps:8});
 await expect(page.locator('#render-detail')).toContainText('200,000');await page.mouse.up();await expect(page.locator('#render-detail')).toHaveText('全量显示');
 const counts=await page.evaluate(()=>window.drawCounts);assert(counts.some(c=>c.name==='drawElements'&&c.count===200000));assert(counts.some(c=>c.name==='drawArrays'&&c.count===3286152));
 await page.click('#fit');await expect(page.locator('#render-detail')).toHaveText('全量显示');
 const parse=s=>s.split('\n').slice(0,2).map(line=>line.match(/-?\d+\.\d+/g).map(Number));
 const [p0,t0]=parse(await page.locator('#camera-values').textContent());const direction=t0.map((v,i)=>v-p0[i]);const initialDistance=Math.hypot(...direction);
 const box=await page.locator('#viewport').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 for(let i=0;i<30;i++)await page.mouse.wheel(0,-400);
 await expect.poll(()=>page.locator('#camera-values').textContent()).not.toBe(p0.join(','));
 const[p1,t1]=parse(await page.locator('#camera-values').textContent());const travel=p1.reduce((s,v,i)=>s+(v-p0[i])*direction[i]/initialDistance,0);assert(travel>initialDistance,`Camera must cross old pivot: ${travel} <= ${initialDistance}`);
 assert(Math.abs(Math.hypot(...t1.map((v,i)=>v-p1[i]))-initialDistance)<.02,'camera-target spacing preserved');
 await page.click('#fit');await page.selectOption('#resolution','1280');await page.click('#capture-top');await page.locator('#image-dialog').waitFor();await page.locator('#output-image').evaluate(img=>img.decode());assert.equal(await page.locator('#output-image').evaluate(img=>Math.max(img.naturalWidth,img.naturalHeight)),1280);
 const result={passed:true,points:3286152,interactive_points:200000,draw_reduction:3286152/200000,old_pivot_distance:initialDistance,forward_travel:travel,full_resolution_export:true,errors};assert.deepEqual(errors,[]);await writeFile('tests/output/large-cloud-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
