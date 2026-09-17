import assert from 'node:assert/strict';
import test from 'node:test';
import {createTradingScale} from '../lib/trading-scale.ts';

test('overnight and weekend timestamps occupy adjacent equally spaced trading slots',()=>{
 const bars=[{time:Date.parse('2026-09-11T19:55:00Z')/1000,close:100},{time:Date.parse('2026-09-14T13:30:00Z')/1000,close:104},{time:Date.parse('2026-09-14T13:35:00Z')/1000,close:102}];
 const original=structuredClone(bars),scale=createTradingScale(bars.length,16,300);
 assert.equal(scale.step,100);assert.deepEqual(bars.map((_,index)=>scale.xAt(index)),[66,166,266]);
 assert.deepEqual(bars,original);assert.ok(bars[1].time-bars[0].time>2*86400);
 for(let i=0;i<bars.length;i++)assert.equal(scale.indexAt(scale.xAt(i)),i);
});
test('pointer selection clamps to actual first and last bars with half-step edge padding',()=>{
 const scale=createTradingScale(4,20,200);
 assert.equal(scale.xAt(0),45);assert.equal(scale.xAt(3),195);
 assert.equal(scale.indexAt(-100),0);assert.equal(scale.indexAt(500),3);
 assert.equal(scale.indexAt(69.9),0);assert.equal(scale.indexAt(70),1);
 const bodyWidth=scale.step*.68;
 assert.ok(scale.xAt(0)-bodyWidth/2>20);assert.ok(scale.xAt(3)+bodyWidth/2<220);
});
test('one bar is centered and an empty or zero-width scale stays finite',()=>{
 assert.equal(createTradingScale(1,20,200).xAt(0),120);
 assert.equal(createTradingScale(1,20,200).indexAt(999),0);
 assert.equal(createTradingScale(0,20,200).xAt(0),120);
 assert.equal(createTradingScale(0,20,200).indexAt(200),0);
 assert.equal(createTradingScale(100,20,0).indexAt(20),0);
});
