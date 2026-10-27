import { readFileSync, writeFileSync } from 'node:fs';
import { decideLetterInk } from '../../js/sudoku-recognition.js';

const root=process.env.FINO_INK_DATA ?? '/tmp/fino-ink-data';
const audit=process.argv.includes('--audit');
const ensemble=process.argv.includes('--ensemble');
const name=audit?'letter-audit-v2':'letter-validation';
const rows=JSON.parse(readFileSync(`${root}/${name}-inputs.json`));
const probabilities=JSON.parse(readFileSync(`${root}/${name}-probabilities.json`));
if(ensemble) {
  const thin=JSON.parse(readFileSync(`${root}/${name}-thin-probabilities.json`));
  probabilities.forEach((row,i)=>row.forEach((value,j)=>{row[j]=(value+thin[i][j])/2;}));
}
const scores=probabilities.map(p=>p.map((score,i)=>({label:String.fromCharCode(65+i),score})).sort((a,b)=>b.score-a.score));
function metrics(predictions) {
  let positive=0,correct=0,wrong=0,negative=0,rejected=0;
  for(const [i,row] of rows.entries()) {
    if(row.value) {positive++;if(predictions[i]===row.value)correct++;else if(predictions[i]!==null)wrong++;}
    else {negative++;if(predictions[i]===null)rejected++;}
  }
  return {positive,correct,wrong,negative,rejected,recall:correct/positive,specificity:rejected/negative};
}
const old=metrics(rows.map(r=>r.previous));
let policy;
if(audit) policy=JSON.parse(readFileSync(`${root}/letter-policy-v2${ensemble?'-ensemble':''}.json`)).policy;
else {
  let winner;
  for(const confidence of [.25,.35,.45,.55,.65,.75,.8,.85,.9,.95]) for(const margin of [0,.05,.1,.15,.2]) for(const templateConfidence of [.93,.95,.98,.99,.9995]) {
    const candidate={confidence,margin,templateConfidence};
    const result=metrics(rows.map((r,i)=>decideLetterInk(scores[i],r.template,r.features,candidate).value));
    if(result.specificity<Math.max(old.specificity,.991) || result.wrong>old.wrong)continue;
    if(!winner || result.correct>winner.metrics.correct || (result.correct===winner.metrics.correct && result.rejected>winner.metrics.rejected))winner={policy:candidate,metrics:result};
  }
  if(!winner)throw new Error('No candidate met validation rejection/error constraints.');
  policy=winner.policy;
}
const result=metrics(rows.map((r,i)=>decideLetterInk(scores[i],r.template,r.features,policy).value));
if(ensemble)policy.views=[1.2,1.8];
const report={policy,previous:old,candidate:result,samples:rows.length};
writeFileSync(`${root}/${audit?'letter-audit-v2-report':'letter-policy-v2'}${ensemble?'-ensemble':''}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!audit && (!ensemble || result.correct>JSON.parse(readFileSync(`${root}/letter-policy-v2.json`)).candidate.correct)){
  const path=`${root}/letters-v2-export/models.json`;const metadata=JSON.parse(readFileSync(path));
  metadata.policies.letters={...policy,validationRecall:result.recall,validationSpecificity:result.specificity,validationSamples:rows.length};
  writeFileSync(path,JSON.stringify(metadata)+'\n');
}
