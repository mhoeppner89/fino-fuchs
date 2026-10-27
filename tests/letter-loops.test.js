import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './load-ink-models.mjs';
import {recognizeSudokuInk} from '../js/sudoku-recognition.js';

test('recognisable B/D loops with serifs are accepted independently of pen segmentation',()=>{
  const {cases}=JSON.parse(readFileSync(new URL('./fixtures/letter-loop-regressions.json',import.meta.url)));
  assert.equal(cases.length,8);
  for(const row of cases){
    const ink=row.strokes.map(stroke=>stroke.map(([x,y])=>({x:(90+x*1.2)/300,y:(40+y*1.2)/200})));
    const fragments=ink.flatMap(stroke=>stroke.slice(1).map((p,i)=>[stroke[i],p]));
    for(const drawing of [ink,ink.toReversed().map(stroke=>stroke.toReversed()),fragments,fragments.toReversed()]){
      assert.equal(recognizeSudokuInk(drawing,'letters').value,row.value,`EMNIST ${row.id}`);
    }
  }
});
