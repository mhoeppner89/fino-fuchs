import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import './load-ink-models.mjs';
import { recognizeSudokuInk } from '../js/sudoku-recognition.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const { cases } = JSON.parse(readFileSync(new URL('./fixtures/ink-public-audit.json', import.meta.url)));
const loopCases = JSON.parse(readFileSync(new URL('./fixtures/letter-loop-regressions.json',import.meta.url))).cases;
const inkFor = row => row.strokes.map(stroke => stroke.map(([x,y]) => ({x:(90+x*1.2)/300,y:(40+y*1.2)/200})));
const samples = {};
for (const mode of ['numbers','letters','symbols']) {
  samples[mode] = cases.filter(row => row.mode===mode && row.value && row.previousValue===null)
    .sort((a,b) => a.strokes.flat().length-b.strokes.flat().length)
    .find(row => { const result=recognizeSudokuInk(inkFor(row), mode); return result.value===row.value && result.recognizer==='public-data-cnn'; });
  assert.ok(samples[mode], `${mode}: a public example rescued by the learned model exists`);
}
const browser = await chromium.launch({headless:true, executablePath:process.env.FINO_CHROME_PATH});
const output='test-artifacts/ink-models/browser';
mkdirSync(output,{recursive:true});
const report=[];
const origin=process.env.FINO_TEST_URL ?? 'http://127.0.0.1:4173';

async function start(page, mode, value) {
  await page.locator('[data-category="sudoku"]').click();
  await page.locator(`label:has(input[name="sudoku-symbols"][value="${mode}"])`).click();
  await page.locator('label:has(input[name="difficulty"][value="hard"])').click();
  await page.locator('#start-button').click();
  await page.waitForFunction(() => window.__fuchsschrift?.sudoku.snapshot());
  const index=await page.evaluate(value => {
    const g=window.__fuchsschrift.sudoku;
    return g.puzzle.solution.findIndex((v,i)=>v===value && !g.puzzle.givens[i]);
  },value);
  if(index>=0) await page.locator(`[data-sudoku-cell="${index}"]`).click();
  return index;
}

async function draw(page,row) {
  const data=await page.evaluate(()=>{
    const g=window.__fuchsschrift.sudoku;g.resize();const rect=g.canvas.getBoundingClientRect();
    return {x:rect.x,y:rect.y,t:g.transform};
  });
  const client=p=>({x:data.x+data.t.x+p.x*300*data.t.scale,y:data.y+data.t.y+p.y*200*data.t.scale});
  for(const stroke of inkFor(row)) {
    const first=client(stroke[0]);await page.mouse.move(first.x,first.y);await page.mouse.down();
    for(const p of stroke.slice(1)){const next=client(p);await page.mouse.move(next.x,next.y);}
    await page.mouse.up();
  }
}

try {
  for(const [directory,mode,loopCase] of [['','numbers'],['','letters'],['/testversion','symbols'],['','letters',true]]) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();const errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith(origin+'/'))external.push(r.url());});
    const row=loopCase?loopCases.find(row=>row.value===4):samples[mode];let index=-1;
    for(let attempt=0;attempt<10 && index<0;attempt++) {
      await page.goto(`${origin}${directory}/?test`);
      await page.evaluate(()=>navigator.serviceWorker.ready);
      await page.waitForFunction(()=>navigator.serviceWorker.controller, null, {timeout:15000});
      await page.reload();
      await context.setOffline(true);await page.reload();
      index=await start(page,mode,row.value);
      if(index<0)await context.setOffline(false);
    }
    assert.ok(index>=0);
    await draw(page,row);
    const recognition=await page.evaluate(async ({mode,version})=>{
      const {recognizeSudokuInk}=await import(`./js/sudoku-recognition.js?v=${version}`);
      const g=window.__fuchsschrift.sudoku;const start=performance.now();
      const result=recognizeSudokuInk(g.drafts[g.selected],mode);
      return {...result,milliseconds:performance.now()-start};
    },{mode,version});
    assert.equal(recognition.value,row.value);
    assert.equal(recognition.recognizer,'public-data-cnn');
    await page.locator('.sudoku-submit').click();
    assert.equal((await page.evaluate(()=>window.__fuchsschrift.sudoku.snapshot())).values[index],row.value);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    const key=`${directory?'testversion-':''}${mode}${loopCase?'-serif-loop':''}`;
    await page.screenshot({path:`${output}/${key}-offline-public-ink.png`});
    report.push({directory:directory||'/',mode,sourceId:row.id,offline:true,recognition,errors,external});
    await context.close();
  }

  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/assets/ink-models/weights.bin?*',route=>route.abort());
  let index=-1;
  for(let attempt=0;attempt<10 && index<0;attempt++) {
    await page.goto(`${origin}/?test`);index=await start(page,'numbers',samples.numbers.value);
  }
  assert.ok(index>=0);
  await page.waitForFunction(()=>window.__fuchsschrift.sudoku.recognitionFailed);
  await draw(page,samples.numbers);
  assert.equal((await page.evaluate(()=>window.__fuchsschrift.sudoku.snapshot())).values[index],0);
  await page.unroute('**/assets/ink-models/weights.bin?*');
  await page.locator('.sudoku-submit').click();
  await page.waitForFunction(async version => (await import(`./js/sudoku-recognition.js?v=${version}`)).sudokuRecognizerReady(),version);
  assert.equal((await page.evaluate(()=>window.__fuchsschrift.sudoku.snapshot())).values[index],0,'retrying a model load never submits stale ink');
  await page.locator('.sudoku-submit').click();
  assert.equal((await page.evaluate(()=>window.__fuchsschrift.sudoku.snapshot())).values[index],samples.numbers.value);
  report.push({loadingFailureRetry:true,staleSubmissionPrevented:true});
  await context.close();
} finally {
  await browser.close();writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));
}
console.log('PASS: real public ink uses the CNN offline in all modes; no external requests; failed model loads retry safely');
