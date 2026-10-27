/** Audit the actual JavaScript runtime on reserved source-test drawings. */
import {readFileSync,writeFileSync} from 'node:fs';
import {basename} from 'node:path';
const root='/tmp/fino-ink-v3',mode=process.argv[2],folder=process.argv[3]??`${root}/export`;
const current=await import('../../js/sudoku-recognition.js?audit-current');
const previous=await import('./v155-recognizer.js');
const loader=folder=>async url=>{const bytes=readFileSync(`${folder}/${basename(url.pathname)}`);return{ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};
await current.loadSudokuRecognizer(loader(folder));
await previous.loadSudokuRecognizer(async url=>{const name=basename(url.pathname);const bytes=readFileSync(`${root}/v155-${name}`);return{ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}});
const parts=Number(process.env.AUDIT_PARTS??1),part=Number(process.env.AUDIT_PART??0);
const set=process.env.AUDIT_SET?`-${process.env.AUDIT_SET}`:'';
const suffix=(process.env.AUDIT_TAG?`-${process.env.AUDIT_TAG}`:set)+(parts>1?`-part${part}`:'');
const rows=JSON.parse(readFileSync(`${root}/audit-${mode}${set}.json`)).filter(row=>!process.env.AUDIT_SOURCE||row.source===process.env.AUDIT_SOURCE).filter((_,i)=>i%parts===part);const answers=[];const start=Date.now();
for(const [i,row]of rows.entries()){
 const points=row.strokes.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),span=Math.max(1,right-left,bottom-top);
 const ink=row.strokes.map(stroke=>stroke.map(([x,y])=>({x:(150+(x-(left+right)/2)*120/span)/300,y:(100+(y-(top+bottom)/2)*120/span)/200})));
 answers.push({id:row.id,source:row.source,sourceLabel:row.sourceLabel,writer:row.writer,value:row.value,current:current.recognizeSudokuInk(ink,mode).value,previous:previous.recognizeSudokuInk(ink,mode).value});
 if(i%1000===999)console.log(mode,i+1,Math.round((Date.now()-start)/1000)+'s');
}
function summarize(rows,key){
 const targets=[1,2,3,4].map(value=>{const chosen=rows.filter(r=>r.value===value);const correct=chosen.filter(r=>r[key]===value).length;return{value,total:chosen.length,correct,accuracy:correct/chosen.length,wrong:chosen.filter(r=>r[key]!==null&&r[key]!==value).length}});
 const other=rows.filter(r=>r.value===null),rejected=other.filter(r=>r[key]===null).length;
 return{targets,other:{total:other.length,rejected,accuracy:rejected/other.length}};
}
const report={mode,size:rows.length,weightsSha256:JSON.parse(readFileSync(`${folder}/models.json`)).weightsSha256,seconds:(Date.now()-start)/1000,current:summarize(answers,'current'),previous:summarize(answers,'previous'),sources:Object.fromEntries([...new Set(rows.map(r=>r.source))].map(source=>[source,{current:summarize(answers.filter(r=>r.source===source),'current'),previous:summarize(answers.filter(r=>r.source===source),'previous')}]))};
writeFileSync(`${root}/audit-${mode}${suffix}-answers.json`,JSON.stringify(answers));writeFileSync(`${root}/audit-${mode}${suffix}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
