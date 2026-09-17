import {allAssets,assetId,type Asset} from './market-catalog.ts';
export type OHLC={time:number;open:number;high:number;low:number;close:number;volume?:number};
export type SecuritySeries='intraday'|'hourly'|'daily'|'weekly';
export type SecuritySnapshot={symbol:string;provider:'Yahoo Finance';providerSymbol:string;currency:string;exchangeTimezone:string;fetchedAt:string;marketTime?:number;marketPrice?:number;delayMinutes?:number;series:Record<SecuritySeries,OHLC[]>;seriesFetchedAt:Partial<Record<SecuritySeries,string>>;errors?:string[]};
export type SecurityMetadata=Pick<SecuritySnapshot,'currency'|'exchangeTimezone'|'marketTime'|'marketPrice'|'delayMinutes'>;
export const securitySeriesKeys:SecuritySeries[]=['intraday','hourly','daily','weekly'];
export function yahooSymbol(value:string|Asset):string{
 const asset=typeof value==='string'?allAssets.find(a=>assetId(a)===value):value;
 if(!asset)throw Error('Неизвестный инструмент');
 const suffix:Record<string,string>={XETR:'.DE',SIX:'.SW',OMXCOP:'.CO',LSE:'.L',TSE:'.T',KRX:'.KS',TWSE:'.TW',HKEX:'.HK',NSE:'.NS',TADAWUL:'.SR',ASX:'.AX',TSX:'.TO'};
 if(asset.exchange==='EURONEXT')return asset.ticker+(asset.ticker==='ASML'?'.AS':'.PA');
 const ticker=asset.exchange==='HKEX'?asset.ticker.padStart(4,'0'):asset.ticker.replace(/[._]/g,'-');
 return ticker+(suffix[asset.exchange]||'');
}
export function securityFileName(symbol:string){if(!allAssets.some(a=>assetId(a)===symbol))throw Error('Неизвестный инструмент');return symbol.replace(/[^A-Za-z0-9_.-]/g,'_')+'.json'}
function positive(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>0}
function timestamp(value:unknown,now:number):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=Math.floor(now/1000)}
function observedDate(value:unknown,now:number):value is string{return typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now&&Date.parse(value)>=0}
export function validateOHLC(value:unknown,now=Date.now()):OHLC[]{
 if(!Array.isArray(value))throw Error('Некорректная история котировок');
 const unique=new Map<number,OHLC>();
 for(const item of value){
  if(!item||typeof item!=='object')continue;
  const r=item as OHLC;
  if(!timestamp(r.time,now)||![r.open,r.high,r.low,r.close].every(positive)||r.low>r.high||r.open<r.low||r.open>r.high||r.close<r.low||r.close>r.high)continue;
  const row:OHLC={time:r.time,open:r.open,high:r.high,low:r.low,close:r.close};
  if(typeof r.volume==='number'&&Number.isFinite(r.volume)&&r.volume>=0)row.volume=r.volume;
  unique.set(row.time,row);
 }
 return [...unique.values()].sort((a,b)=>a.time-b.time);
}
export function parseYahooChart(payload:unknown,expectedSymbol:string,now=Date.now(),expectedInterval?:string):{bars:OHLC[];meta:SecurityMetadata}{
 const data=payload as {chart?:{error?:{description?:string}|null;result?:Array<{meta?:Record<string,unknown>;timestamp?:unknown[];indicators?:{quote?:Array<Record<string,unknown[]>>}}>}};
 if(data?.chart?.error)throw Error(data.chart.error.description||'Источник не предоставляет историю');
 const result=data?.chart?.result?.[0],meta=result?.meta;
 if(!meta||meta.symbol!==expectedSymbol)throw Error('Источник вернул другой инструмент');
 if(expectedInterval&&String(meta.dataGranularity).replace('1h','60m')!==expectedInterval)throw Error('Источник вернул другой интервал свечи: '+String(meta.dataGranularity));
 if(typeof meta.currency!=='string'||!/^[A-Za-z]{3,5}$/.test(meta.currency)||typeof meta.exchangeTimezoneName!=='string')throw Error('Источник не указал валюту или часовой пояс');
 try{new Intl.DateTimeFormat('en',{timeZone:meta.exchangeTimezoneName}).format()}catch{throw Error('Некорректный часовой пояс источника')}
 const q=result?.indicators?.quote?.[0];
 if(!Array.isArray(result?.timestamp)||!q)throw Error('Некорректный ответ источника котировок');
 const bars=validateOHLC(result.timestamp.map((time,i)=>({time,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]})),now);
 if(!bars.length)throw Error('В ответе нет допустимых котировок');
 const metadata:SecurityMetadata={currency:meta.currency,exchangeTimezone:meta.exchangeTimezoneName};
 if(timestamp(meta.regularMarketTime,now)){metadata.marketTime=meta.regularMarketTime;if(positive(meta.regularMarketPrice))metadata.marketPrice=meta.regularMarketPrice}
 if(typeof meta.exchangeDataDelayedBy==='number'&&Number.isFinite(meta.exchangeDataDelayedBy)&&meta.exchangeDataDelayedBy>=0)metadata.delayMinutes=meta.exchangeDataDelayedBy;
 return {bars,meta:metadata};
}
export function validateSecuritySnapshot(value:unknown,symbol:string,now=Date.now()):SecuritySnapshot{
 const s=value as SecuritySnapshot;
 if(!s||s.symbol!==symbol||s.provider!=='Yahoo Finance'||s.providerSymbol!==yahooSymbol(symbol))throw Error('Снимок относится к другому инструменту');
 if(!observedDate(s.fetchedAt,now)||typeof s.currency!=='string'||!/^[A-Za-z]{3,5}$/.test(s.currency)||typeof s.exchangeTimezone!=='string')throw Error('Некорректные метаданные снимка');
 try{new Intl.DateTimeFormat('en',{timeZone:s.exchangeTimezone}).format()}catch{throw Error('Некорректный часовой пояс снимка')}
 const series={} as Record<SecuritySeries,OHLC[]>;
 const seriesFetchedAt:Partial<Record<SecuritySeries,string>>={};
 for(const key of securitySeriesKeys){series[key]=validateOHLC(s.series?.[key]||[],now);if(observedDate(s.seriesFetchedAt?.[key],now))seriesFetchedAt[key]=s.seriesFetchedAt[key]}
 if(!securitySeriesKeys.some(k=>series[k].length))throw Error('Снимок не содержит котировок');
 const clean:SecuritySnapshot={symbol,provider:'Yahoo Finance',providerSymbol:s.providerSymbol,currency:s.currency,exchangeTimezone:s.exchangeTimezone,fetchedAt:s.fetchedAt,series,seriesFetchedAt};
 if(timestamp(s.marketTime,now)){clean.marketTime=s.marketTime;if(positive(s.marketPrice))clean.marketPrice=s.marketPrice}
 if(typeof s.delayMinutes==='number'&&Number.isFinite(s.delayMinutes)&&s.delayMinutes>=0)clean.delayMinutes=s.delayMinutes;
 if(Array.isArray(s.errors))clean.errors=s.errors.filter(e=>typeof e==='string').slice(0,10);
 return clean;
}
export function isSecuritySnapshotStale(snapshot:SecuritySnapshot,now=Date.now(),maxAgeMs=30*60000){const fetched=Date.parse(snapshot.fetchedAt);return !Number.isFinite(fetched)||fetched>now||now-fetched>maxAgeMs}
export async function loadSecurityHistory(symbol:string,signal?:AbortSignal):Promise<SecuritySnapshot>{
 const url=new URL('data/securities/'+securityFileName(symbol),document.baseURI);
 const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),cache:'no-cache'});
 if(!response.ok)throw Error(response.status===404?'История этого инструмента ещё не загружена':'Снимок котировок временно недоступен');
 return validateSecuritySnapshot(await response.json(),symbol);
}

