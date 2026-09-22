import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';
const output='test-artifacts/palette-connect-v150/browser';
mkdirSync(output,{recursive:true});
const report=[];
await Promise.all(Object.entries({chromium,webkit}).map(async ([engine,launcher])=>{
 const browser=await launcher.launch({headless:true});
 try {
  for(const viewport of [{width:1024,height:768},{width:844,height:390},{width:320,height:568},{width:568,height:320}]
    .filter(v=>!process.env.BROWSER_VIEWPORT || v.width===Number(process.env.BROWSER_VIEWPORT))){
   const page=await browser.newPage({viewport});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto('http://127.0.0.1:4173/testversion/?test');
   await page.locator('[data-category="shapes"]').click();
   await page.locator('#start-button').click();
   await page.waitForFunction(()=>window.__fuchsschrift?.board.task);
   const controls=await page.locator('.practice-header button:visible').evaluateAll(buttons=>buttons.map(b=>({id:b.id,r:b.getBoundingClientRect().toJSON()})));
   for(const {id,r} of controls)assert.ok(r.x>=0&&r.y>=0&&r.right<=viewport.width+1&&r.bottom<=viewport.height+1,`${engine} ${viewport.width} clipped ${id}`);
   await page.locator('#ink-button').click();
   const palette=await page.locator('#ink-palette').boundingBox();
   assert.ok(palette.x>=0&&palette.y>=0&&palette.x+palette.width<=viewport.width&&palette.y+palette.height<=viewport.height,`${engine}: palette outside ${viewport.width}`);
   await page.screenshot({path:`${output}/${engine}-${viewport.width}-palette.png`});
   await page.getByRole('button',{name:'Rot',exact:true}).click();
   assert.equal(await page.locator('#ink-palette').isVisible(),false);
   await page.evaluate(()=>window.__fuchsschrift.board.stopDemo());
   const canvas=await page.locator('#drawing-canvas').boundingBox();
   for(const [i,color]of ['#DE6352','#9A63BA'].entries()){
    if(i){await page.locator('#ink-button').click();await page.getByRole('button',{name:'Lila',exact:true}).click();}
    await page.mouse.move(canvas.x+canvas.width*.15,canvas.y+canvas.height*(.3+i*.4));
    await page.mouse.down();
    await page.mouse.move(canvas.x+canvas.width*.22,canvas.y+canvas.height*(.32+i*.4),{steps:5});
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.__fuchsschrift.board.getUserStrokeColors().at(-1)),color);
   }
   assert.deepEqual(await page.evaluate(()=>window.__fuchsschrift.board.getUserStrokeColors()),['#DE6352','#9A63BA']);
   await page.locator('#undo-button').click();
   assert.deepEqual(await page.evaluate(()=>window.__fuchsschrift.board.getUserStrokeColors()),['#DE6352']);
   await page.locator('#ink-button').click();
   await page.getByRole('button',{name:'Bunt: vorgegebene Farben',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.__fuchsschrift.board.inkColor),null);
   await page.goto('http://127.0.0.1:4173/testversion/?test');
   await page.locator('[data-category="connect"]').click();
   await page.locator('label:has(input[name="difficulty"][value="hard"])').click();
   await page.evaluate(()=>{Math.random=()=>.43;});
   await page.locator('#start-button').click();
   await page.waitForFunction(()=>window.__fuchsschrift?.board.task?.gameMode==='connect');
   await page.locator('#ink-button').click();await page.getByRole('button',{name:'Grün',exact:true}).click();
   await page.screenshot({path:`${output}/${engine}-${viewport.width}-connect.png`});
   const index=await page.evaluate(()=>window.__fuchsschrift.getState().index);
   const total=await page.evaluate(()=>window.__fuchsschrift.board.task.game.points.length-1);
   for(let stage=0;stage<total;stage++){
    if(stage===3){
     await page.locator('#show-button').click();
     await page.waitForFunction(()=>window.__fuchsschrift.board.gameHint?.progress>0.1);
     assert.ok(await page.evaluate(()=>window.__fuchsschrift.board.demoFoxPosition()));
    }
    const route=await page.evaluate(async()=>{
     const {connectHintRoute}=await import('./js/mini-games.js?v=1.3.50');
     const b=window.__fuchsschrift.board,r=b.canvas.getBoundingClientRect();
     b.stopDemo();
     const route=connectHintRoute(b.task.game,b.userStrokes,b.gameState.reachedIndex,b.width,b.height);
     return route?.map(p=>({x:r.x+p.x*r.width,y:r.y+p.y*r.height}));
    });
    assert.ok(route?.length,`${engine}/${viewport.width}/${stage}: missing route`);
    const offset={x:stage%2? -16:16,y:10};
    await page.mouse.move(route[0].x+offset.x,route[0].y+offset.y);
    await page.mouse.down();
    const start=await page.evaluate(()=>window.__fuchsschrift.board.activeStroke?.length);
    assert.equal(start,1,'pickup should not draw any jump');
    for(let i=1;i<route.length;i++){
     const a=route[i-1],b=route[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/8));
     await page.mouse.move(b.x+offset.x,b.y+offset.y,{steps});
    }
    await page.mouse.up();
    if(stage<total-1){
     assert.equal(await page.evaluate(()=>window.__fuchsschrift.board.gameState.reachedIndex),stage+1,`${engine}/${viewport.width}/${stage}`);
     assert.equal(await page.evaluate(()=>window.__fuchsschrift.board.strokeColors.at(-1)),'#58A765');
    }
   }
   await page.waitForFunction(i=>window.__fuchsschrift.getState().index>i,index);
   assert.equal(await page.evaluate(()=>window.__fuchsschrift.board.inkColor),'#58A765','colour survives task changes');
   assert.deepEqual(errors,[]);
   const result={engine,viewport,links:total,completed:true,palette:true,errors};report.push(result);console.log(JSON.stringify(result));
   await page.close();
  }
 }finally{await browser.close();}
}));
writeFileSync(`${output}/report-${process.env.BROWSER_VIEWPORT ?? 'all'}.json`,JSON.stringify(report,null,2));
