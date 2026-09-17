import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMarketAlerts,validateAlertFeed} from '../lib/market-alerts.ts';
import {sources} from '../lib/news-sources.ts';
const now=Date.parse('2026-09-17T12:00:00Z'),iso=offset=>new Date(now-offset).toISOString();
const source=sources.find(s=>s.publisher==='AMD'&&s.kind==='Компания');
function story(overrides={}){return {title:'AMD declares quarterly cash dividend of $0.30 per share',summary:'The board of AMD declared a quarterly cash dividend of $0.30 per share.',source:'AMD',publisher:'AMD',sourceId:source.id,sourceKind:source.kind,url:'https://ir.amd.com/news-events/press-releases/detail/999/dividend',date:iso(60000),firstSeenAt:iso(30000),category:'Дивиденды',assets:['AMD'],signal:1,...overrides}}
function snapshot(news=[story()],overrides={}){return {fetchedAt:iso(10000),news,sourceHealth:[{id:source.id,status:'ok',checkedAt:iso(10000)}],...overrides}}
test('concrete current issuer event produces informational alert with canonical asset ID',()=>{
 const result=selectMarketAlerts(snapshot(),now);assert.equal(result.length,1);assert.equal(result[0].symbol,'NASDAQ:AMD');assert.match(result[0].title,/дивидендам/);assert.doesNotMatch(result[0].title,/купить|срочно/i);
 assert.equal(validateAlertFeed({version:1,fetchedAt:iso(10000),alerts:result},now).alerts.length,1);
});
test('sentiment, product publicity, plans, negation and numbers unrelated to event do not trigger',()=>{
 for(const title of ['AMD announces a new AI chip with 100 cores','AMD could raise dividend by 10%','AMD does not increase dividend by 10%','AMD reports record growth','AMD reports quarterly financial results','AMD plans to raise dividend by 10%']){
  assert.equal(selectMarketAlerts(snapshot([story({title,summary:title})]),now).length,0,title);
 }
});
test('secondary articles and unknown or unhealthy sources are not promoted to confirmed alerts',()=>{
 for(const override of [{sourceId:'missing'},{sourceId:sources.find(s=>s.kind==='Редакция').id},{url:'https://evil.example/press'}])assert.equal(selectMarketAlerts(snapshot([story(override)]),now).length,0);
 assert.equal(selectMarketAlerts(snapshot([story()],{sourceHealth:[{id:source.id,status:'error',checkedAt:iso(1000)}]}),now).length,0);
});
test('old, undated, future stories and stale snapshots cannot become urgent on cache recovery',()=>{
 for(const override of [{date:iso(4*3600000)},{firstSeenAt:''},{date:''},{date:iso(-1000)},{firstSeenAt:iso(-1000)}])assert.equal(selectMarketAlerts(snapshot([story(override)]),now).length,0);
 for(const fetchedAt of [iso(21*60000),iso(-1000),'invalid'])assert.equal(selectMarketAlerts(snapshot([story()],{fetchedAt}),now).length,0);
});
test('source issuer must match asset, multi-company claims remain unclassified',()=>{
 assert.equal(selectMarketAlerts(snapshot([story({title:'Microsoft declares quarterly dividend of $1 per share',summary:'Microsoft declares cash dividend of $1 per share.'})]),now).length,0);
 assert.equal(selectMarketAlerts(snapshot([story({title:'AMD and NVIDIA declare quarterly dividends of $1 per share'})]),now).length,0);
});
test('canonical article URL deduplicates tracking variants',()=>{
 const result=selectMarketAlerts(snapshot([story(),story({url:story().url+'?utm_source=rss#top'})]),now);assert.equal(result.length,1);
});
test('financial report requires concrete figures, dividend suspension does not invent a figure',()=>{
 assert.equal(selectMarketAlerts(snapshot([story({title:'AMD reports quarterly revenue of $10 billion',summary:'AMD reports quarterly revenue of $10 billion.'})]),now)[0].event,'earnings');
 assert.equal(selectMarketAlerts(snapshot([story({title:'AMD suspends dividend',summary:'The board of AMD suspends dividend.'})]),now)[0].event,'dividend-suspended');
});
test('compact snapshot validation rejects altered identity, foreign URL and future dates',()=>{
 const alert=selectMarketAlerts(snapshot(),now)[0];
 for(const change of [{symbol:'NYSE:AMD'},{sourceUrl:'https://evil.example/'},{publishedAt:iso(-1000)},{id:'forged'},{title:'bad\ntext'}])assert.throws(()=>validateAlertFeed({version:1,fetchedAt:iso(10000),alerts:[{...alert,...change}]},now));
 assert.throws(()=>validateAlertFeed({version:1,fetchedAt:iso(21*60000),alerts:[]},now));
});

test('headline issuer cannot inherit a different company event from the summary',()=>{
 const title='AMD introduces new server processors';
 for(const summary of ['Intel declares a cash dividend of $0.25 per share.','Intel updates its investors. The company declares a cash dividend of $0.25 per share.','AMD and Intel declare a cash dividend of $0.25 per share.']){
  assert.equal(selectMarketAlerts(snapshot([story({title,summary})]),now).length,0,summary);
 }
 assert.equal(selectMarketAlerts(snapshot([story({title,summary:'AMD declares a cash dividend of $0.25 per share.'})]),now)[0].ticker,'AMD');
});
test('issuer feed hint supports an implicit headline but does not override an explicit competitor',()=>{
 assert.equal(selectMarketAlerts(snapshot([story({title:'Declares a cash dividend of $0.25 per share',summary:'The board declares a cash dividend of $0.25 per share.'})]),now)[0].ticker,'AMD');
 assert.equal(selectMarketAlerts(snapshot([story({title:'Quarterly company update',summary:'Intel declares a cash dividend of $0.25 per share.'})]),now).length,0);
});
test('primary-source implicit sentences require uninterrupted explicit issuer context',()=>{
 const primary=sources.find(s=>s.kind==='Первичный источник');
 const primarySnapshot=summary=>snapshot([story({title:'AMD updates investors',summary,sourceId:primary.id,source:primary.publisher,publisher:primary.publisher,sourceKind:primary.kind,url:new URL('/press-release/test',primary.homepage).href})],{sourceHealth:[{id:primary.id,status:'ok',checkedAt:iso(10000)}]});
 assert.equal(selectMarketAlerts(primarySnapshot('The company declares a cash dividend of $0.25 per share.'),now)[0].ticker,'AMD');
 assert.equal(selectMarketAlerts(primarySnapshot('Other organizations issued statements. The company declares a cash dividend of $0.25 per share.'),now).length,0);
 assert.equal(selectMarketAlerts(primarySnapshot('Intel updates investors. The company declares a cash dividend of $0.25 per share.'),now).length,0);
});
