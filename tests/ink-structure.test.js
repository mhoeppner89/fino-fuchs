import test from 'node:test';
import assert from 'node:assert/strict';
import {inkHullCorners, outlineGapFraction} from '../js/sudoku-recognition.js';

const ink = points => [points.map(([x,y]) => ({x:x/300,y:y/200}))];

test('a contour can close across its starting segment after a small overshoot', () => {
  const triangle=ink([[60,160],[150,20],[240,160],[65,160],[50,160]]);
  assert.equal(outlineGapFraction(triangle),0);
  const missingSide=ink([[60,160],[150,20],[240,160]]);
  assert.ok(outlineGapFraction(missingSide)>.2);
});

test('star tips are independent of pen direction and dense samples on straight edges', () => {
  const scribble=ink([[30,20],[270,160],[60,60],[240,20],[60,180]]);
  assert.equal(inkHullCorners(scribble),4);
  const dense=scribble.map(stroke=>stroke.flatMap((p,i)=>{
    const next=stroke[i+1];if(!next)return[p];
    return Array.from({length:73},(_,k)=>({x:p.x+(next.x-p.x)*k/73,y:p.y+(next.y-p.y)*k/73}));
  }));
  assert.equal(inkHullCorners(dense),4);
  assert.equal(inkHullCorners(dense.toReversed().map(s=>s.toReversed())),4);
  const star=ink([[150,20],[194,160],[36,74],[264,74],[106,160],[150,20]]);
  assert.equal(inkHullCorners(star),5);
});
