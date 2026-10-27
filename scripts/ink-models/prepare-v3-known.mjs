/** Existing hand-authored regressions are development data, never held-out data. */
import {readFileSync,writeFileSync} from 'node:fs';
import {sudokuReferenceInk} from '../../js/sudoku-recognition.js';
const {cases}=JSON.parse(readFileSync('tests/fixtures/kidoku-freehand.json'));
const variants=[{}, {angle:17},{angle:-17},{shear:.28},{shear:-.28},{width:.7},{width:1.3},{wobble:1.6}];
for(const mode of ['numbers','symbols']){
 const rows=[];
 for(const row of cases.filter(r=>r.mode===mode))for(const [k,v]of variants.entries()){
  if(row.value===null&&k>4)continue;
  const a=(v.angle??0)*Math.PI/180;
  const strokes=row.strokes.map((s,j)=>s.map(([x,y],i)=>{
   const dx=(x-50)*1.2*(v.width??1),dy=(y-50)*1.2,rx=dx*Math.cos(a)-dy*Math.sin(a),ry=dx*Math.sin(a)+dy*Math.cos(a);
   return[150+rx+(v.shear??0)*ry+Math.sin(i*1.4+j)*(v.wobble??0),100+ry+Math.cos(i*1.7+j)*(v.wobble??0)];
  }));rows.push({id:`${row.id}-${k}`,mode,value:row.value,source:'hand-authored development regressions',strokes});
 }
 rows.push({id:'scribble',mode,value:null,source:'hand-authored development regressions',strokes:[[[30,20],[270,160],[60,60],[240,20],[60,180]]]});
 for(let value=1;value<=4;value++)rows.push({id:`reference-${value}`,mode,value,source:'app reference',strokes:sudokuReferenceInk(mode,value).map(s=>s.map(p=>[p.x*300,p.y*200]))});
 writeFileSync(`/tmp/fino-ink-v3/known-${mode}.json`,JSON.stringify(rows));
}
