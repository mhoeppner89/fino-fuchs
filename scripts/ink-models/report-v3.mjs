import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const root='/tmp/fino-ink-v3';
const read=path=>JSON.parse(readFileSync(path));
const metadata=read('assets/ink-models/models.json'),weights=readFileSync('assets/ink-models/weights.bin');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fingerprint(folder,mode){
 const m=read(`${folder}/models.json`),w=readFileSync(`${folder}/weights.bin`);
 const names=[mode,...(mode==='letters'?['letterAux']:[])];
 const pieces=names.flatMap(name=>Object.values(m.models[name].weights).map(t=>w.subarray(t.offset*4,(t.offset+t.length)*4)));
 return{tensors:sha(Buffer.concat(pieces)),policy:sha(JSON.stringify(m.policies[mode]))};
}
function wilson(correct,total){
 const z=1.95996398454,p=correct/total,den=1+z*z/total,center=(p+z*z/(2*total))/den;
 const delta=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/den;return[center-delta,center+delta];
}
const paths={letters:`${root}/audit-letters-report.json`,numbers:`${root}/audit-numbers-final-report.json`,symbols:`${root}/audit-symbols-report.json`};
const frozen={letters:`${root}/frozen-letters`,numbers:`${root}/frozen-final`,symbols:`${root}/frozen-symbols`};
const groups={},targets=[];
for(const mode of['letters','numbers','symbols']){
 const r=read(paths[mode]);assert.deepEqual(fingerprint('assets/ink-models',mode),fingerprint(frozen[mode],mode),'Audit must match the shipped mode tensors and policy');
 groups[mode]={samples:r.size,artifact:fingerprint(frozen[mode],mode),sourceFileSha256:sha(readFileSync(`${root}/audit-${mode}${mode==='numbers'?'-final':''}.json`)),current:r.current,previousV155:r.previous,sources:r.sources};
 for(const row of r.current.targets){
  const label=metadata.models[mode].labels[row.value-1];assert.ok(row.accuracy>.95,`${label} must exceed 95%`);
  targets.push({mode,label,...row,wilson95: wilson(row.correct,row.total)});
 }
 assert.ok(r.current.other.accuracy>.95,`${mode}: unrelated rejection must exceed 95%`);
}
const report={version:'1.3.56',target:'Observed correct recognition exceeds 95% for each of the 12 Kidoku choices, with unrelated rejection above 95% in each mode.',metric:'Correct labeled value / all valid examples; rejected valid drawings count as errors.',totalFreshSamples:Object.values(groups).reduce((n,g)=>n+g.samples,0),bundle:{bytes:weights.length,sha256:sha(weights),architecture:metadata.architecture,policies:metadata.policies},targets,groups,nativeDigitDiagnostic:read(`${root}/audit-numbers-native-diagnostic-report.json`).current,protocol:{letters:'Frozen before first audit; fresh official EMNIST test IDs plus official UJI test writers.',symbols:'Frozen before first audit; 5000 new native Quick Draw drawings per shape plus 7200 unrelated drawings.',numbers:'Final confirmation IDs exclude the original 600-per-class corpus, the initial diagnostic audit and the first confirmation audit; cutoffs and checkpoints selected on development validation and known regressions.',nativeDigits:'Diagnostic after first audit use; not a fresh second writer sample.',baseline:'Preserved v1.3.55 weights, decision behavior and original templates; evaluated on the same fresh inputs.',development:'Earlier audits, native digit failures and hand-authored fixtures may inform fixes; no test trajectories are used to fit weights.'},limits:['These are public-data point estimates, not measured accuracy for children aged 5–8.','Three cursive native A forms remain rejected (37/40 in that source stratum); the combined A score includes them.','Letter B and D audit samples are small; confidence intervals are reported and do not establish a population accuracy above 95%.','EMNIST ink is reconstructed by skeletonization; Quick Draw recognition labels sometimes include unfinished drawings.']};
writeFileSync('scripts/ink-models/per-character-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.totalFreshSamples,targets:targets.map(r=>({label:r.label,correct:r.correct,total:r.total,accuracy:r.accuracy})),other:Object.fromEntries(Object.entries(groups).map(([m,g])=>[m,g.current.other.accuracy]))},null,2));
