import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const root='/tmp/fino-ink-v3',mode=process.argv[2],parts=Number(process.argv[3]??4),set=process.argv[4]?`-${process.argv[4]}`:'';
const reports=Array.from({length:parts},(_,i)=>JSON.parse(readFileSync(`${root}/audit-${mode}${set}-part${i}-report.json`)));
const answers=Array.from({length:parts},(_,i)=>JSON.parse(readFileSync(`${root}/audit-${mode}${set}-part${i}-answers.json`))).flat();
const expected=JSON.parse(readFileSync(`${root}/audit-${mode}${set}.json`));
assert.equal(answers.length,expected.length);assert.deepEqual(new Set(answers.map(r=>r.id)),new Set(expected.map(r=>r.id)));
assert.ok(reports.every(r=>r.weightsSha256===reports[0].weightsSha256));
function metric(rows,key){return{targets:[1,2,3,4].map(value=>{const a=rows.filter(r=>r.value===value),correct=a.filter(r=>r[key]===value).length;return{value,total:a.length,correct,accuracy:correct/a.length,wrong:a.filter(r=>r[key]!==null&&r[key]!==value).length}}),other:(()=>{const a=rows.filter(r=>r.value===null),rejected=a.filter(r=>r[key]===null).length;return{total:a.length,rejected,accuracy:rejected/a.length}})()}}
const report={mode,size:answers.length,weightsSha256:reports[0].weightsSha256,seconds:Math.max(...reports.map(r=>r.seconds)),current:metric(answers,'current'),previous:metric(answers,'previous'),sources:Object.fromEntries([...new Set(answers.map(r=>r.source))].map(source=>[source,{current:metric(answers.filter(r=>r.source===source),'current'),previous:metric(answers.filter(r=>r.source===source),'previous')}]))};
writeFileSync(`${root}/audit-${mode}${set}-answers.json`,JSON.stringify(answers));writeFileSync(`${root}/audit-${mode}${set}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.current,null,2));
