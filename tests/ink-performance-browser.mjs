import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const {version}=JSON.parse(readFileSync('package.json'));
const browser=await chromium.launch({headless:true,executablePath:process.env.FINO_CHROME_PATH});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/?test');
 await page.evaluate(async version=>{const r=await import(`./js/sudoku-recognition.js?v=${version}`);await r.loadSudokuRecognizer();},version);
 await context.setOffline(true);const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const result=await page.evaluate(async version=>{
  const r=await import(`./js/sudoku-recognition.js?v=${version}`),rows=[];
  for(let round=0;round<5;round++)for(const mode of['letters','numbers','symbols'])for(let value=1;value<=4;value++){
   const ink=r.sudokuReferenceInk(mode,value),start=performance.now(),answer=r.recognizeSudokuInk(ink,mode);rows.push({mode,value,recognized:answer.value,milliseconds:performance.now()-start});
  }
  return rows;
 },version);
 assert.ok(result.every(r=>r.value===r.recognized));
 const stats=mode=>{const a=result.filter(r=>r.mode===mode).map(r=>r.milliseconds).sort((a,b)=>a-b);return{samples:a.length,median:a[Math.floor(a.length/2)],p95:a[Math.ceil(a.length*.95)-1],maximum:a.at(-1)}};
 const report={version,offline:true,chromeCpuThrottle:4,modes:Object.fromEntries(['letters','numbers','symbols'].map(m=>[m,stats(m)]))};
 mkdirSync('test-artifacts/ink-models',{recursive:true});writeFileSync('test-artifacts/ink-models/performance-v156.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close()}
