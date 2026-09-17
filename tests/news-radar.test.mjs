import test from 'node:test';
import assert from 'node:assert/strict';
import {marketRadar,dailyIdeas} from '../lib/ideas.ts';
import {allAssets} from '../lib/market-catalog.ts';
const now='2026-09-17T12:00:00.000Z';
const story=(ticker,signal=0,extra={})=>({title:`${ticker} statement`,source:'Example',publisher:'Example',url:`https://example.com/${ticker}`,date:'2026-09-17T10:00:00.000Z',category:'Акции',summary:'Context',assets:[ticker],signal,...(signal>0?{catalyst:'Financial improvement'}:{}),...(signal<0?{concern:'Risk'}:{}),...extra});
test('radar covers neutral, adverse, positive and mixed evidence without inventing buy ideas',()=>{
 const news=[story('AAPL'),story('NVDA',-1),story('MSFT',1),story('CRM',1),story('CRM',-1,{url:'https://example.com/crm-risk',title:'CRM risk'})];
 const radar=marketRadar(news,now);
 assert.deepEqual(Object.fromEntries(radar.items.map(item=>[item.ticker,item.kind])),{CRM:'mixed',AAPL:'watch',MSFT:'positive',NVDA:'risk'});
 assert.equal(radar.stats.positiveCandidates,1);assert.equal(radar.stats.coveredAssets,4);assert.equal(radar.stats.totalAssets,allAssets.length);
 assert.deepEqual(dailyIdeas(news,now).map(item=>item.ticker),['MSFT']);
});
test('radar does not cap coverage to five cards or create cards for unsupported catalog assets',()=>{
 const news=allAssets.slice(0,12).map(asset=>story(asset.ticker));
 const radar=marketRadar([...news,story('FAKE')],now);
 assert.equal(radar.items.length,12);assert.equal(radar.stats.positiveCandidates,0);
});
test('radar excludes stale, invalid and future news and deduplicates syndication and tracking URLs',()=>{
 const base=story('AAPL',1);
 const news=[base,{...base,url:base.url+'?utm_source=feed'},story('MSFT',1,{date:'2026-09-13'}),story('NVDA',1,{date:'2026-09-18'}),story('CRM',1,{date:''}),story('TSLA',1,{url:'javascript:alert(1)'})];
 const radar=marketRadar(news,now);assert.equal(radar.items.length,1);assert.equal(radar.items[0].supporting.length,1);assert.equal(radar.stats.freshStories,1);
 assert.equal(marketRadar(news,'invalid').items.length,0);
});
test('fresh coverage uses the article date, retains real sources and sorts related stories newest first',()=>{
 const news=[story('AAPL',0,{date:'2026-09-14T12:00:00.000Z'}),story('AAPL',0,{title:'Latest update',url:'https://example.com/latest',date:'2026-09-17T11:00:00.000Z',source:'Publisher two'})];
 const radar=marketRadar(news,now);assert.equal(radar.items[0].related.length,2);assert.equal(radar.items[0].related[0].source,'Publisher two');
 assert.equal(marketRadar(news,'2026-09-17T12:00:00.001Z').items[0].related.length,1);
});
