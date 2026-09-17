import assert from 'node:assert/strict';
import test from 'node:test';
import {securityWindow} from '../lib/security-window.ts';
const point=(date,close=100)=>({time:Date.parse(date)/1000,open:close,high:close+1,low:close-1,close,volume:10});
const snapshot=(series={})=>({symbol:'NASDAQ:AAPL',provider:'Yahoo Finance',providerSymbol:'AAPL',currency:'USD',exchangeTimezone:'America/New_York',fetchedAt:'2026-09-17T12:00:00Z',seriesFetchedAt:{intraday:'2026-09-17T11:00:00Z',hourly:'2026-09-17T10:00:00Z',daily:'2026-09-17T06:00:00Z',weekly:'2026-09-17T05:00:00Z'},series:{intraday:[],hourly:[],daily:[],weekly:[],...series}});
test('one trading hour is anchored to the latest actual trade, not fabricated weekend observations',()=>{
 const points=['2026-09-11T18:00Z','2026-09-11T18:55Z','2026-09-11T19:00Z','2026-09-11T20:00Z'].map(t=>point(t));
 const result=securityWindow(snapshot({intraday:points}),'1H');assert.deepEqual(result.points,points.slice(2));assert.equal(result.fetchedAt,'2026-09-17T11:00:00Z');
});
test('one day means the last trading session in the exchange timezone',()=>{
 const points=['2026-09-16T19:00Z','2026-09-17T13:30Z','2026-09-17T20:00Z'].map(t=>point(t));
 assert.deepEqual(securityWindow(snapshot({intraday:points}),'1D').points,points.slice(1));
});
test('five-day selection preserves five observed sessions despite weekends and holidays',()=>{
 const dates=['2026-09-04','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-14'];const points=dates.flatMap(date=>[point(date+'T14:00Z'),point(date+'T20:00Z')]);
 assert.equal(securityWindow(snapshot({intraday:points}),'5D').points.length,10);
});
test('intraday views never pretend daily closing prices are hourly quotes',()=>{
 const data=snapshot({daily:[point('2026-09-15'),point('2026-09-16')]});assert.equal(securityWindow(data,'1H').points.length,0);assert.equal(securityWindow(data,'1D').points.length,0);
});
test('year and all-history views choose real daily and weekly datasets with their own timestamps',()=>{
 const data=snapshot({daily:[point('2024-01-01'),point('2026-01-01'),point('2026-09-17')],weekly:[point('1985-01-01'),point('2026-09-14')]});
 const year=securityWindow(data,'1Y');assert.equal(year.series,'daily');assert.equal(year.points.length,2);assert.equal(year.fetchedAt,data.seriesFetchedAt.daily);
 const all=securityWindow(data,'ALL');assert.equal(all.series,'weekly');assert.equal(all.points[0].time,Date.parse('1985-01-01')/1000);
});
test('YTD excludes the prior year and missing datasets stay empty',()=>{
 const data=snapshot({daily:[point('2025-12-31T14:00Z'),point('2026-01-02T14:00Z'),point('2026-09-17T14:00Z')]});assert.equal(securityWindow(data,'YTD',Date.parse('2026-09-17T18:00:00Z')).points.length,2);assert.deepEqual(securityWindow(null,'1M').points,[]);
});


test('YTD is empty on January 1 before the first observation of the new year',()=>{
 const data=snapshot({daily:[point('2026-12-30T14:30Z'),point('2026-12-31T14:30Z')],weekly:[point('2026-12-21T05:00Z'),point('2026-12-28T05:00Z')]});
 assert.deepEqual(securityWindow(data,'YTD',Date.parse('2027-01-01T12:00:00Z')).points,[]);
 assert.equal(securityWindow(data,'1Y',Date.parse('2027-01-01T12:00:00Z')).points.length,2);
});
