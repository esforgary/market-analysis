import test from 'node:test';
import assert from 'node:assert/strict';
import {allAssets,assetId} from '../lib/market-catalog.ts';
import {yahooSymbol,securityFileName,validateOHLC,parseYahooChart,validateSecuritySnapshot,isSecuritySnapshotStale} from '../lib/security-data.ts';
const now=Date.parse('2026-09-17T12:00:00Z');
const time=1789565400;
const bar={time,open:330,high:335,low:329,close:332,volume:123};
const payload=()=>({chart:{error:null,result:[{meta:{symbol:'AAPL',currency:'USD',exchangeTimezoneName:'America/New_York',regularMarketTime:time,regularMarketPrice:332},timestamp:[time],indicators:{quote:[{open:[330],high:[335],low:[329],close:[332],volume:[123]}]}}]}});
const snapshot=()=>({symbol:'NASDAQ:AAPL',provider:'Yahoo Finance',providerSymbol:'AAPL',currency:'USD',exchangeTimezone:'America/New_York',fetchedAt:'2026-09-17T11:55:00Z',marketTime:time,marketPrice:332,series:{intraday:[bar],hourly:[],daily:[],weekly:[]},seriesFetchedAt:{intraday:'2026-09-17T11:55:00Z'}});

test('all catalog symbols map to unique safe filenames and Yahoo exchange identifiers',()=>{
 const mapped=allAssets.map(a=>yahooSymbol(a));
 assert.equal(new Set(mapped).size,allAssets.length);
 assert.equal(new Set(allAssets.map(a=>securityFileName(assetId(a)))).size,allAssets.length);
 assert.equal(securityFileName('NASDAQ:AAPL'),'NASDAQ_AAPL.json');
 for(const [id,expected] of [['NYSE:BRK.B','BRK-B'],['EURONEXT:ASML','ASML.AS'],['EURONEXT:MC','MC.PA'],['XETR:SAP','SAP.DE'],['HKEX:700','0700.HK'],['TSE:7203','7203.T'],['KRX:005930','005930.KS'],['TWSE:2330','2330.TW'],['OMXCOP:NOVO_B','NOVO-B.CO'],['LSE:AZN','AZN.L']])assert.equal(yahooSymbol(id),expected);
 assert.throws(()=>securityFileName('../data'),/Неизвестный/);
});

test('OHLC rejects malformed, impossible and future observations; sorts and deduplicates',()=>{
 const valid={...bar,time:time-300};
 const rows=validateOHLC([bar,{...bar,close:333},valid,{...bar,time:now/1000+1},{...bar,time:'2026-09-16'},{...bar,high:300},{...bar,low:-1},{...bar,close:NaN},{...bar,open:null}],now);
 assert.equal(rows.length,2);assert.equal(rows[0].time,time-300);assert.equal(rows[1].close,333);
 assert.deepEqual(validateOHLC([{...bar,volume:-1}],now),[{time,open:330,high:335,low:329,close:332}]);
});

test('Yahoo parser keeps OHLC and metadata and rejects another ticker',()=>{
 const parsed=parseYahooChart(payload(),'AAPL',now);
 assert.deepEqual(parsed.bars,[bar]);assert.equal(parsed.meta.marketPrice,332);assert.equal(parsed.meta.exchangeTimezone,'America/New_York');
 assert.throws(()=>parseYahooChart(payload(),'MSFT',now),/другой инструмент/);
 assert.throws(()=>parseYahooChart({chart:{error:{description:'No data found'}}},'AAPL',now),/No data/);
});

test('Yahoo parser rejects missing OHLC values and invalid timezones without inventing candles',()=>{
 const missing=payload();missing.chart.result[0].indicators.quote[0].close=[null];
 assert.throws(()=>parseYahooChart(missing,'AAPL',now),/нет допустимых/);
 const invalid=payload();invalid.chart.result[0].meta.exchangeTimezoneName='invalid/zone';
 assert.throws(()=>parseYahooChart(invalid,'AAPL',now),/часовой пояс/);
 const gbp=payload();gbp.chart.result[0].meta.currency='GBp';assert.equal(parseYahooChart(gbp,'AAPL',now).meta.currency,'GBp');
});

test('snapshot validates identity and age without upgrading stale cached timestamps',()=>{
 assert.equal(validateSecuritySnapshot(snapshot(),'NASDAQ:AAPL',now).fetchedAt,'2026-09-17T11:55:00Z');
 assert.throws(()=>validateSecuritySnapshot(snapshot(),'NASDAQ:MSFT',now),/другому/);
 assert.throws(()=>validateSecuritySnapshot({...snapshot(),fetchedAt:'2026-09-18T00:00:00Z'},'NASDAQ:AAPL',now),/метаданные/);
 assert.equal(isSecuritySnapshotStale(snapshot(),now),false);
 assert.equal(isSecuritySnapshotStale({...snapshot(),fetchedAt:'2026-09-16T12:00:00Z'},now),true);
 const missingDate=validateSecuritySnapshot({...snapshot(),seriesFetchedAt:{intraday:'bad'}},'NASDAQ:AAPL',now);assert.equal(missingDate.seriesFetchedAt.intraday,undefined);
});

test('Yahoo cannot silently replace weekly candles with aggregated months',()=>{
 const p=payload();p.chart.result[0].meta.dataGranularity='3mo';
 assert.throws(()=>parseYahooChart(p,'AAPL',now,'1wk'),/другой интервал/);
 p.chart.result[0].meta.dataGranularity='1wk';assert.equal(parseYahooChart(p,'AAPL',now,'1wk').bars.length,1);
 p.chart.result[0].meta.dataGranularity='1h';assert.equal(parseYahooChart(p,'AAPL',now,'60m').bars.length,1);
});

test('browser loader uses a Pages-safe URL and does not replace missing snapshots with data',async()=>{
 const {loadSecurityHistory}=await import('../lib/security-data.ts');
 const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
 globalThis.document={baseURI:'https://example.com/market-analysis/'};
 try{
  globalThis.fetch=async url=>{assert.equal(String(url),'https://example.com/market-analysis/data/securities/NASDAQ_AAPL.json');return Response.json({...snapshot(),fetchedAt:new Date().toISOString(),seriesFetchedAt:{}})};
  assert.equal((await loadSecurityHistory('NASDAQ:AAPL')).symbol,'NASDAQ:AAPL');
  globalThis.fetch=async()=>new Response('',{status:404});
  await assert.rejects(()=>loadSecurityHistory('NASDAQ:AAPL'),/ещё не загружена/);
 }finally{globalThis.fetch=originalFetch;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument}
});
