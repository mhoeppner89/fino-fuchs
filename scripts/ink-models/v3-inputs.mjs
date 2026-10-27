import {readFileSync,writeFileSync} from 'node:fs';
import {rasterizeInk} from '../../js/ink-network.js';
import {matchInkTemplates} from '../../js/ink-templates.js';
import {letterInkFeatures,outlineGapFraction,inkHullCorners} from '../../js/sudoku-recognition.js';

const root='/tmp/fino-ink-v3';const mode=process.argv[2];const split=process.argv[3]??'validation';
const data=JSON.parse(readFileSync(`${root}/${split}-${mode}.json`));
const refresh=process.argv.includes('--features-only');
const cached=refresh?JSON.parse(readFileSync(`${root}/${split}-${mode}-inputs.json`)):null;
const normal=new Float32Array(data.length*784),thin=mode!=='symbols'?new Float32Array(data.length*784):null,rows=[];
for(const [i,row] of data.entries()) {
 const points=row.strokes.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),span=Math.max(1,right-left,bottom-top);
 const ink=row.strokes.map(stroke=>stroke.map(([x,y])=>({x:(150+(x-(left+right)/2)*120/span)/300,y:(100+(y-(top+bottom)/2)*120/span)/200})));
 const image=rasterizeInk(ink);if(!refresh)normal.set(image,i*784);
 if(thin&&!refresh)thin.set(rasterizeInk(ink,{thickness:1.2}),i*784);
 const features=mode==='letters'?letterInkFeatures(ink,image):{gapFraction:mode==='symbols'?outlineGapFraction(ink,image):0,starGapFraction:mode==='symbols'?outlineGapFraction(ink,image,false):0,hullCorners:mode==='symbols'?inkHullCorners(ink):0};
 rows.push({id:row.id,source:row.source,sourceLabel:row.sourceLabel??row.label,writer:row.writer,value:row.value,template:refresh?cached[i].template:matchInkTemplates(ink,mode),features});
}
if(!refresh)writeFileSync(`${root}/${split}-${mode}-normal.f32`,Buffer.from(normal.buffer));
if(thin&&!refresh)writeFileSync(`${root}/${split}-${mode}-thin.f32`,Buffer.from(thin.buffer));
writeFileSync(`${root}/${split}-${mode}-inputs.json`,JSON.stringify(rows));
console.log('Prepared',mode,split,rows.length);
