import { readFileSync, writeFileSync } from 'node:fs';
import { loadSudokuRecognizer, recognizeSudokuInk } from '../../js/sudoku-recognition.js';

const root=process.env.FINO_INK_DATA ?? '/tmp/fino-ink-data';
const rows=JSON.parse(readFileSync(`${root}/letter-audit-v2.json`));
const baseline=JSON.parse(readFileSync(`${root}/letter-audit-v2-inputs.json`));
const previous=new Map(baseline.map(row=>[row.id,row.previous]));
await loadSudokuRecognizer(async url=>{
  const bytes=readFileSync(url);
  return {ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
});
const predictions=[];
for(const row of rows) {
  const points=row.strokes.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),span=Math.max(1,right-left,bottom-top);
  const ink=row.strokes.map(stroke=>stroke.map(([x,y])=>({x:(150+(x-(left+right)/2)*120/span)/300,y:(100+(y-(top+bottom)/2)*120/span)/200})));
  const start=performance.now();const result=recognizeSudokuInk(ink,'letters');
  predictions.push({id:row.id,value:row.value,previous:previous.get(row.id),current:result.value,reason:result.reason,milliseconds:performance.now()-start});
}
function metrics(key) {
  const positive=predictions.filter(row=>row.value),negative=predictions.filter(row=>!row.value);
  const correct=positive.filter(row=>row[key]===row.value).length;
  const wrong=positive.filter(row=>row[key]!==null && row[key]!==row.value).length;
  const rejected=negative.filter(row=>row[key]===null).length;
  return {positive:positive.length,correct,wrong,negative:negative.length,rejected,recall:correct/positive.length,specificity:rejected/negative.length};
}
const elapsed=predictions.map(r=>r.milliseconds).sort((a,b)=>a-b);
const metadata=JSON.parse(readFileSync('assets/ink-models/models.json'));
const report={samples:rows.length,weightsSha256:metadata.weightsSha256,policy:metadata.policies.letters,
  previous:metrics('previous'),current:metrics('current'),medianMilliseconds:elapsed[Math.floor(elapsed.length*.5)],p95Milliseconds:elapsed[Math.floor(elapsed.length*.95)]};
writeFileSync(`${root}/letter-audit-v2-results.json`,JSON.stringify(predictions));
writeFileSync(`${root}/letter-audit-v2-runtime-report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
