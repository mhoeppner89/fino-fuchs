import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { rasterizeInk } from '../../js/ink-network.js';
import { matchInkTemplates } from '../../js/ink-templates.js';
import { letterInkFeatures } from '../../js/sudoku-recognition.js';
import * as previous from './v154-recognizer.js';

const folder=process.env.FINO_INK_DATA ?? '/tmp/fino-ink-data';
const name=process.argv.includes('--audit')?'letter-audit-v2':'letter-validation';
const thin=process.argv.includes('--thin');
const data=JSON.parse(readFileSync(`${folder}/${name}.json`));
await previous.loadSudokuRecognizer(async url=>{
  const bytes=readFileSync(`/tmp/fino-letter-v154/${basename(url.pathname)}`);
  return {ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
});
const images=new Float32Array(data.length*784), rows=[];
for(const [i,row] of data.entries()) {
  const points=row.strokes.flat(); const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const span=Math.max(1,right-left,bottom-top);
  const ink=row.strokes.map(stroke=>stroke.map(([x,y])=>({x:(150+(x-(left+right)/2)*120/span)/300,y:(100+(y-(top+bottom)/2)*120/span)/200})));
  const image=rasterizeInk(ink,thin?{thickness:1.2}:{});
  images.set(image,i*784);
  if(thin)continue;
  rows.push({id:row.id,value:row.value,sourceLabel:row.sourceLabel,previous:previous.recognizeSudokuInk(ink,'letters').value,
    template:matchInkTemplates(ink,'letters'),features:letterInkFeatures(ink,image)});
}
writeFileSync(`${folder}/${name}${thin?'-thin':''}-images.f32`,Buffer.from(images.buffer));
if(!thin)writeFileSync(`${folder}/${name}-inputs.json`,JSON.stringify(rows));
console.log('Prepared',data.length,name,thin?'thin images':'inputs and v1.3.54 baseline predictions');
