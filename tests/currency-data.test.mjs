import assert from 'node:assert/strict';
import test from 'node:test';
import {currencySource,mergeLatestIntoHistory,loadCurrencyPair,formatRateDate} from '../lib/currency-data.ts';
const rate=(date,value=44.5,base='USD',quote='UAH')=>({date,rate:value,base,quote});

test('UAH policy pins NBU in both directions without restricting other currencies',()=>{
 assert.equal(currencySource('USD','UAH').provider,'nbu');
 assert.equal(currencySource('UAH','EUR').provider,'nbu');
 assert.equal(currencySource('usd','uah').provider,'nbu');
 assert.equal(currencySource('QAR','JPY').provider,null);
});

test('latest extends history only at its actual observation date and replaces the same date',()=>{
 const original=[rate('2026-09-11',44.5526),rate('2026-09-14',44.5483)];
 const merged=mergeLatestIntoHistory(original,rate('2026-09-15',44.618),'USD','UAH');
 assert.deepEqual(merged.map(r=>r.date),['2026-09-11','2026-09-14','2026-09-15']);
 assert.equal(merged.at(-1).rate,44.618);
 assert.equal(original.length,2);
 const replaced=mergeLatestIntoHistory(merged,rate('2026-09-15',44.62),'USD','UAH');
 assert.equal(replaced.length,3);
 assert.equal(replaced.at(-1).rate,44.62);
});

test('normalization sorts and deduplicates history, ignores other pairs and stale latest',()=>{
 const merged=mergeLatestIntoHistory([
  rate('2026-09-15',44.618),rate('2026-09-11',44.55),rate('2026-09-11',44.5526),
  rate('2026-09-16',.02,'UAH','USD'),rate('2026-09-16',-1),
 ],rate('2026-09-11',43),'USD','UAH');
 assert.deepEqual(merged,[rate('2026-09-11',44.5526),rate('2026-09-15',44.618)]);
});

test('pair loader uses matching provider/base/quote for latest and history',async()=>{
 const urls=[];
 const request=async(url)=>{urls.push(url);return url.includes('from=')?[rate('2026-09-11',44.5526)]:[rate('2026-09-15',44.618)]};
 const result=await loadCurrencyPair('USD','UAH',undefined,'2026-09-01',request);
 assert.equal(urls.length,2);
 for(const url of urls){const params=new URL(url,'https://example.com').searchParams;assert.equal(params.get('providers'),'nbu');assert.equal(params.get('base'),'USD');assert.equal(params.get('quotes'),'UAH')}
 assert.equal(result.source.id,'nbu');
 assert.equal(result.latest.rate,44.618);
 assert.equal(result.history.at(-1),result.latest);
});

test('reversed UAH pair is loaded as requested, not inferred from an unrelated base',async()=>{
 const urls=[];
 const request=async(url)=>{urls.push(url);return[rate('2026-09-15',1/44.618,'UAH','USD')]};
 const result=await loadCurrencyPair('UAH','USD',undefined,'2026-09-01',request);
 assert.ok(urls.every(url=>url.includes('base=UAH&quotes=USD')));
 assert.equal(result.latest.base,'UAH');
 assert.equal(result.latest.quote,'USD');
 assert.equal(result.latest.rate,1/44.618);
});

test('unsupported NBU pair fails without silently falling back to blended history',async()=>{
 const urls=[];
 await assert.rejects(()=>loadCurrencyPair('QAR','UAH',undefined,'2026-09-01',async(url)=>{urls.push(url);return[]}),/НБУ/);
 assert.ok(urls.every(url=>url.includes('providers=nbu')));
});

test('FX observation dates stay on the same UTC day and reject invalid calendar dates',()=>{
 assert.equal(formatRateDate('2026-09-12',{day:'2-digit',month:'2-digit',year:'numeric'}),'12.09.2026');
 assert.equal(formatRateDate('not-a-date'),'not-a-date');
});

test('invalid and future observations never displace an observed rate',()=>{
 const history=[rate('2026-09-11'),rate('2026-02-30'),rate('2026-13-01'),rate('2026-9-12'),rate('2026-09-12T00:00:00Z'),rate('2099-09-12'),rate('not-a-date')];
 assert.deepEqual(mergeLatestIntoHistory(history,rate('2099-09-13',999),'USD','UAH'),[rate('2026-09-11')]);
 assert.equal(formatRateDate('2026-02-30'),'2026-02-30');
 assert.equal(formatRateDate('2025-02-29'),'2025-02-29');
 assert.equal(formatRateDate('2024-02-29',{day:'2-digit',month:'2-digit',year:'numeric'}),'29.02.2024');
});

test('header uses the newest observed point even when latest endpoint lags history',async()=>{
 const result=await loadCurrencyPair('USD','UAH',undefined,'2026-09-01',async(url)=>url.includes('from=')?[rate('2026-09-14',44.5),rate('2026-09-15',44.618)]:[rate('2026-09-11',43),rate('2099-09-15',999)]);
 assert.equal(result.latest.date,'2026-09-15');
 assert.equal(result.latest.rate,44.618);
 assert.equal(result.history.length,2);
});

test('non-UAH pairs retain default blend with no forced provider',async()=>{
 const urls=[];
 const result=await loadCurrencyPair('eur','jpy',undefined,'2026-09-01',async(url)=>{urls.push(url);return[rate('2026-09-15',175,'EUR','JPY')]});
 assert.equal(result.source.id,'blend');
 assert.ok(urls.every(url=>!new URL(url,'https://example.com').searchParams.has('providers')));
 assert.equal(result.latest.rate,175);
});

test('pair loader rejects malformed responses and provider errors without retrying another source',async()=>{
 await assert.rejects(()=>loadCurrencyPair('USD','UAH',undefined,'2026-09-01',async()=>({rates:[]})),/Некорректный ответ/);
 const urls=[];
 await assert.rejects(()=>loadCurrencyPair('USD','UAH',undefined,'2026-09-01',async(url)=>{urls.push(url);throw Error('Provider unavailable')}),/Provider unavailable/);
 assert.equal(urls.length,2);
 assert.ok(urls.every(url=>url.includes('providers=nbu')));
 await assert.rejects(()=>loadCurrencyPair('USD','UAH',undefined,'2026-09-01',async()=>[rate('2026-09-15',1.1,'EUR','USD')]),/НБУ/);
});

test('invalid pair, invalid date and cancelled requests do not start network work',async()=>{
 let calls=0;
 const request=async()=>{calls++;return[]};
 await assert.rejects(()=>loadCurrencyPair('USD','USD',undefined,'2026-09-01',request),/валютная пара/);
 await assert.rejects(()=>loadCurrencyPair('US','UAH',undefined,'2026-09-01',request),/валютная пара/);
 await assert.rejects(()=>loadCurrencyPair('USD','UAH',undefined,'2026-02-30',request),/дата/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>loadCurrencyPair('USD','UAH',controller.signal,'2026-09-01',request),{name:'AbortError'});
 assert.equal(calls,0);
});
