import assert from 'node:assert/strict';
import test from 'node:test';
import {collectNews,parseFeed,sources} from '../lib/news.ts';
import {sourceErrorKind,sourceFailureSummary} from '../lib/source-health.ts';
const source={...sources[0],id:'source-one',url:'https://example.com/feed',publisher:'Example',name:'Example feed'};
const now=()=>new Date().toISOString();
const xml=(title='Qualcomm reports record revenue')=>`<rss><channel><item><title>${title}</title><link>https://example.com/story</link><pubDate>${now()}</pubDate></item></channel></rss>`;
test('403 is reported as refused access, never retried under another identity',async()=>{
 let calls=0;const result=await collectNews({},[source],async(url,options)=>{calls++;assert.match(options.headers['User-Agent'],/^MeridianMarketReader/);return new Response('Access denied',{status:403})});
 assert.equal(calls,1);assert.equal(result.snapshot.availableCount,0);assert.equal(result.snapshot.sourceHealth[0].errorKind,'blocked');assert.match(result.snapshot.errors[0],/Доступ к 1 лентам \(Example\) ограничен/);assert.doesNotMatch(result.snapshot.errors[0],/не ответили/);
});
test('a transient server error gets one bounded retry and a successful feed becomes available',async()=>{
 let calls=0;const result=await collectNews({},[source],async()=>++calls===1?new Response('Unavailable',{status:503}):new Response(xml()));
 assert.equal(calls,2);assert.equal(result.snapshot.availableCount,1);assert.equal(result.snapshot.errors.length,0);
});
test('conditional cached stories are reclassified and obsolete positive explanations are cleared',async()=>{
 const story={title:'Qualcomm announces event',source:'Example',publisher:'Example',url:'https://example.com/event',date:now(),summary:'Scheduled conference',category:'Акции',assets:[],signal:1,catalyst:'Old broad growth rule'};
 const old={url:source.url,etag:'etag',news:[story]};
 const result=await collectNews({[source.id]:old},[source],async(url,options)=>{assert.equal(options.headers['If-None-Match'],'etag');return new Response(null,{status:304})});
 const item=result.snapshot.news[0];assert.deepEqual(item.assets,['QCOM']);assert.equal(item.signal,0);assert.equal(item.catalyst,undefined);
});
test('validators from another feed URL are never sent to a replacement feed',async()=>{
 const old={url:'https://example.com/old-feed',etag:'old-etag',modified:'yesterday',news:[]};
 const result=await collectNews({[source.id]:old},[source],async(url,options)=>{assert.equal(options.headers['If-None-Match'],undefined);assert.equal(options.headers['If-Modified-Since'],undefined);return new Response(xml())});
 assert.equal(result.cache[source.id].url,source.url);
});
test('requests to different feeds on the same host cannot overlap',async()=>{
 let active=0,maxActive=0;
 const list=[source,{...source,id:'two',url:'https://example.com/second'}];
 const result=await collectNews({},list,async()=>{active++;maxActive=Math.max(active,maxActive);await new Promise(resolve=>setTimeout(resolve,10));active--;return new Response(xml())});
 assert.equal(maxActive,1);assert.equal(result.snapshot.availableCount,2);
});
test('feed entry cap selects newest dates even when the source publishes oldest-first',()=>{
 const body=Array.from({length:60},(_,i)=>`<item><title>Statement ${i}</title><link>https://example.com/${i}</link><pubDate>${new Date(Date.parse('2026-09-17')- (59-i)*86400000).toISOString()}</pubDate></item>`).join('');
 const items=parseFeed(`<rss>${body}</rss>`,source);
 assert.equal(items.length,50);assert.equal(items[0].title,'Statement 59');assert.equal(items.at(-1).title,'Statement 10');
});
test('source status distinguishes refusal, quota, missing feed and timeout, grouping shared publisher failures',()=>{
 assert.equal(sourceErrorKind('HTTP 403'),'blocked');assert.equal(sourceErrorKind('HTTP 429'),'rate-limit');assert.equal(sourceErrorKind('HTTP 404'),'not-found');assert.equal(sourceErrorKind('The operation was aborted due to timeout'),'timeout');
 const health=[{publisher:'BLS',status:'error',error:'HTTP 403'},{publisher:'BLS',status:'error',error:'HTTP 403'},{publisher:'FTC',status:'error',error:'HTTP 403'},{publisher:'Other',status:'ok'}];
 assert.match(sourceFailureSummary(health),/Доступны 1 из 4 лент/);assert.match(sourceFailureSummary(health),/\(BLS, FTC\)/);assert.equal(sourceFailureSummary([{publisher:'Test',status:'ok'}]),'');
});
