export type Rate={date:string;base:string;quote:string;rate:number};
export type Currency={iso_code:string;name:string};
export function validateRates(value:unknown):Rate[]{if(!Array.isArray(value))throw Error('Некорректный ответ источника');return value.filter((r):r is Rate=>!!r&&typeof r.date==='string'&&typeof r.quote==='string'&&typeof r.base==='string'&&typeof r.rate==='number'&&Number.isFinite(r.rate)&&r.rate>0)}
export async function fx(url:string,signal?:AbortSignal){const res=await fetch(`https://api.frankfurter.dev/v2/${url}`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});if(!res.ok)throw Error('Источник курсов недоступен для этой пары');return res.json()}
export function withinPeriod(history:Rate[],days:number){if(!history.length)return[];const end=Date.parse(history.at(-1)!.date);return history.filter(r=>Date.parse(r.date)>=end-days*86400000)}
export function pct(history:Rate[]){return history.length>1?(history.at(-1)!.rate/history[0].rate-1)*100:null}
export function displayRate(value:number){return value.toLocaleString('ru-RU',{maximumFractionDigits:value<.1?6:4})}
export function isStatic(){return typeof window!=='undefined'&&!!(window as Window&{__MERIDIAN_STATIC__?:boolean}).__MERIDIAN_STATIC__}

