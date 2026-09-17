import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {allAssets,assetId} from '../lib/market-catalog.ts';
import {yahooSymbol,securityFileName,parseYahooChart,validateSecuritySnapshot,securitySeriesKeys} from '../lib/security-data.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const output=resolve(root,args.output||'public/data/securities');
const cachePath=resolve(root,args.cache||'.securities-cache.json');
const requested=args.symbols?.split(',');
const assets=allAssets.filter(a=>!requested||requested.includes(assetId(a)));
if(requested&&assets.length!==new Set(requested).size)throw Error('Unknown requested security');
const definitions={intraday:{interval:'5m',range:'5d',ttl:15*60000},hourly:{interval:'60m',range:'1mo',ttl:15*60000},daily:{interval:'1d',range:'5y',ttl:6*3600000},weekly:{interval:'1wk',range:'max',ttl:6*3600000}};
let cache={};try{cache=JSON.parse(await readFile(cachePath,'utf8'))}catch{}
if(cache._version!==2){for(const old of Object.values(cache)){if(old?.series){old.series.weekly=[];if(old.seriesFetchedAt)delete old.seriesFetchedAt.weekly}}cache._version=2}
await mkdir(output,{recursive:true});
const started=Date.now(),manifest=[];
let index=0,nextRequestAt=0,blocked=false;
async function sourceRequest(symbol,key){
 if(blocked)throw Error('Источник ограничил запросы; следующие запросы отложены');
 const wait=Math.max(0,nextRequestAt-Date.now());nextRequestAt=Math.max(nextRequestAt,Date.now())+300;
 if(wait)await new Promise(r=>setTimeout(r,wait));
 if(blocked)throw Error('Источник ограничил запросы; следующие запросы отложены');
 const config=definitions[key],params=new URLSearchParams({interval:config.interval,range:config.range,includePrePost:'false',events:'div,splits'});
 if(key==='weekly'){params.delete('range');params.set('period1','0');params.set('period2',String(Math.floor(Date.now()/1000)))};
 const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?'+params;
 let response;
 for(let attempt=0;attempt<2;attempt++){
  if(blocked)throw Error('Источник ограничил запросы; следующие запросы отложены');
  try{response=await fetch(url,{signal:AbortSignal.timeout(20000)})}
  catch(e){if(attempt===0&&(e?.name==='TimeoutError'||e instanceof TypeError)){await new Promise(r=>setTimeout(r,1000));continue}throw e}
  if(response.status===401||response.status===403||response.status===429)blocked=true;
  if(attempt===0&&response.status>=500){await new Promise(r=>setTimeout(r,1000));continue}
  break;
 }
 if(!response?.ok)throw Error('Yahoo Finance: HTTP '+(response?.status||'network failure'));
 return parseYahooChart(await response.json(),symbol,Date.now(),config.interval);
}
async function collect(asset){
 const symbol=assetId(asset),providerSymbol=yahooSymbol(asset),errors=[];
 let previous;try{previous=validateSecuritySnapshot(cache[symbol],symbol)}catch{}
 const series={intraday:[],hourly:[],daily:[],weekly:[],...previous?.series},seriesFetchedAt={...previous?.seriesFetchedAt};
 let metadata=previous?{currency:previous.currency,exchangeTimezone:previous.exchangeTimezone,marketTime:previous.marketTime,marketPrice:previous.marketPrice,delayMinutes:previous.delayMinutes}:null;
 let fetchedAt=previous?.fetchedAt,updated=false;
 for(const key of securitySeriesKeys){
  if(series[key].length&&Date.now()-Date.parse(seriesFetchedAt[key]||'')<definitions[key].ttl)continue;
  try{const result=await sourceRequest(providerSymbol,key);series[key]=result.bars;seriesFetchedAt[key]=new Date().toISOString();fetchedAt=seriesFetchedAt[key];updated=true;if(!metadata||(result.meta.marketTime||0)>=(metadata.marketTime||0))metadata=result.meta}
  catch(e){errors.push(key+': '+(e instanceof Error?e.message:String(e)))}
 }
 if(metadata&&fetchedAt&&securitySeriesKeys.some(k=>series[k].length)){
  const snapshot=validateSecuritySnapshot({symbol,provider:'Yahoo Finance',providerSymbol,...metadata,fetchedAt,series,seriesFetchedAt,errors},symbol);
  cache[symbol]=snapshot;await writeFile(resolve(output,securityFileName(symbol)),JSON.stringify(snapshot));
  manifest.push({symbol,providerSymbol,fetchedAt,availableSeries:securitySeriesKeys.filter(k=>series[k].length),errors});
 }else manifest.push({symbol,providerSymbol,availableSeries:[],errors});
 console.log(symbol+': '+(updated?'updated':previous?'cached':'unavailable')+(errors.length?' ('+errors.length+' source errors)':''));
}
await Promise.all(Array.from({length:3},async()=>{while(index<assets.length){const asset=assets[index++];await collect(asset)}}));
manifest.sort((a,b)=>a.symbol.localeCompare(b.symbol));
await writeFile(cachePath,JSON.stringify(cache));
await writeFile(resolve(output,'manifest.json'),JSON.stringify({provider:'Yahoo Finance',checkedAt:new Date().toISOString(),sourceCount:assets.length,availableCount:manifest.filter(s=>s.availableSeries.length).length,collectionIntervalSeconds:900,assets:manifest},null,2));
console.log(JSON.stringify({seconds:(Date.now()-started)/1000,total:assets.length,available:manifest.filter(s=>s.availableSeries.length).length,errors:manifest.filter(s=>s.errors.length).length}));



const available=manifest.filter(s=>s.availableSeries.length).length;
const coverage=assets.length?available/assets.length:0;
const defaultAvailable=manifest.some(s=>s.symbol==='NASDAQ:AAPL'&&s.availableSeries.length);
if(coverage<.8||(!requested&&!defaultAvailable)){
 const unavailable=manifest.filter(s=>!s.availableSeries.length).map(s=>s.symbol);
 throw Error(`Security snapshot coverage ${available}/${assets.length} (${Math.round(coverage*100)}%). ${!requested&&!defaultAvailable?'Default instrument NASDAQ:AAPL is unavailable. ':''}Missing: ${unavailable.join(', ')}. Publication stopped; dated cache and manifest were preserved.`);
}
