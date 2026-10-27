/** Candidate 508: one normal specialized view and one thin 26-capital view. */
import {readFileSync,writeFileSync} from 'node:fs';
const root='/tmp/fino-ink-v3';
const current=JSON.parse(readFileSync(`${root}/validation-letters-epoch8-normal.json`));
const previous=JSON.parse(readFileSync(`${root}/validation-letters-epoch26-thin.json`));
const mixed=current.map((row,i)=>row.map((score,j)=>(score+previous[i][j])/2));
// Both slots represent the same two-model composition. Calibration must not
// invent a second width ensemble on top of this fixed two-view candidate.
for(const view of['normal','thin'])writeFileSync(`${root}/validation-letters-epoch508-${view}.json`,JSON.stringify(mixed));
