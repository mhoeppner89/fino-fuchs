import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {decideConditionedInk} from '../../js/sudoku-recognition.js';
const root='/tmp/fino-ink-v3',mode=process.argv[2],epoch=Number(process.argv[3]??0);
const rows=JSON.parse(readFileSync(`${root}/validation-${mode}-inputs.json`));
const normal=JSON.parse(readFileSync(`${root}/validation-${mode}-epoch${epoch}-normal.json`));
const thin=mode!=='symbols'?JSON.parse(readFileSync(`${root}/validation-${mode}-epoch${epoch}-thin.json`)):null;
const labels=mode==='letters'?['A','B','C','D','other']:mode==='numbers'?['1','2','3','4','other']:['circle','triangle','square','star','other'];
const thresholds=[.01,.02,.03,.05,.075,.1,.15,.2,.25,.3,.35,.4,.45,.5,.55,.6,.65,.7,.75,.8,.85,.9,.925,.95,.975,.99];
const positives=[1,2,3,4].map(value=>rows.map((row,i)=>row.value===value?i:-1).filter(i=>i>=0));
const nativePositives=positives.map(indexes=>indexes.filter(i=>rows[i].source==='UJI Pen Characters v2'));
const negatives=rows.map((row,i)=>row.value===null?i:-1).filter(i=>i>=0);
const knownPath=`${root}/known-${mode}-epoch${epoch}-normal.json`;
const knownRows=existsSync(knownPath)?JSON.parse(readFileSync(`${root}/known-${mode}-inputs.json`)):[];
const knownNormal=knownRows.length?JSON.parse(readFileSync(knownPath)):[];
const knownThin=knownRows.length&&thin?JSON.parse(readFileSync(`${root}/known-${mode}-epoch${epoch}-thin.json`)):null;
let winner;
for(const ensemble of thin?[false,true]:[false]){
 const scores=normal.map((p,i)=>p.map((score,j)=>({label:labels[j],score:ensemble?(score+thin[i][j])/2:score})).sort((a,b)=>b.score-a.score));
 const knownScores=knownNormal.map((p,i)=>p.map((score,j)=>({label:labels[j],score:ensemble?(score+knownThin[i][j])/2:score})).sort((a,b)=>b.score-a.score));
 for(const templateConfidence of [.95,.98,.9995])for(const maxGapFraction of mode==='symbols'?[.16,.18,.2]:[0]){
  const policy={conditionTargets:true,confidence:.1,margin:0,templateConfidence,maxGapFraction,thresholds:{}};
  if(ensemble)policy.views=[1.2,1.8];
  if(process.env.SUPPORTED_TEMPLATE){policy.supportedTemplateConfidence=Number(process.env.SUPPORTED_TEMPLATE);policy.templateSupport=Number(process.env.TEMPLATE_SUPPORT??.75);}
  for(let value=1;value<=4;value++){
   let choice,publicChoice;
   for(const threshold of thresholds){
    const candidate={...policy,thresholds:{[labels[value-1]]:threshold}};
    const accepted=i=>decideConditionedInk(mode,scores[i],rows[i].template,rows[i].features,candidate).value===value;
    const recall=positives[value-1].filter(accepted).length/positives[value-1].length;
    const nativeRecall=nativePositives[value-1].length?nativePositives[value-1].filter(accepted).length/nativePositives[value-1].length:1;
    if(recall>Number(process.env.MIN_RECALL??.965)&&nativeRecall>=.95){
     publicChoice={threshold,recall,nativeRecall};
     const knownOK=knownRows.every((row,i)=>{
      if(row.value!==value&&row.value!==null)return true;
      const result=decideConditionedInk(mode,knownScores[i],row.template,row.features,candidate).value;
      return row.value===value?result===value:result!==value;
     });
     if(knownOK)choice=publicChoice;
    }
   }
   policy.thresholds[labels[value-1]]=(choice??publicChoice)?.threshold??.01;
  }
  const prediction=rows.map((row,i)=>decideConditionedInk(mode,scores[i],row.template,row.features,policy).value);
  const recalls=positives.map((indexes,index)=>indexes.filter(i=>prediction[i]===index+1).length/indexes.length);
  const nativeRecalls=nativePositives.map((indexes,index)=>indexes.length?indexes.filter(i=>prediction[i]===index+1).length/indexes.length:1);
  const specificity=negatives.filter(i=>prediction[i]===null).length/negatives.length;
  const wrong=rows.filter((row,i)=>row.value&&prediction[i]!==null&&prediction[i]!==row.value).length;
  const minimum=Math.min(...recalls,specificity);
  const knownFailures=knownRows.filter((row,i)=>decideConditionedInk(mode,knownScores[i],row.template,row.features,policy).value!==row.value).map(row=>row.id);
  const passes=minimum>.95&&knownFailures.length===0;
  const candidate={mode,epoch,policy,recalls,nativeRecalls,specificity,wrong,minimum,passes,knownFailures,counts:positives.map(r=>r.length)};
  if(!winner || (passes&&!winner.passes) || (passes===winner.passes && (passes ? specificity>winner.specificity || (specificity===winner.specificity&&wrong<winner.wrong) : minimum>winner.minimum)))winner=candidate;
 }
}
writeFileSync(`${root}/${mode}-epoch${epoch}-policy${process.env.POLICY_TAG??''}.json`,JSON.stringify(winner,null,2)+'\n');
console.log(JSON.stringify(winner,null,2));
