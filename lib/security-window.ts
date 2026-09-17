import type {OHLC,SecuritySeries,SecuritySnapshot} from './security-data';
export type SecurityPeriod='1H'|'1D'|'5D'|'1M'|'3M'|'6M'|'YTD'|'1Y'|'5Y'|'ALL';
export const securityPeriods:{value:SecurityPeriod;label:string;name:string}[]=[{value:'1H',label:'1Ч',name:'Последний торговый час'},{value:'1D',label:'1Д',name:'Последняя торговая сессия'},{value:'5D',label:'5Д',name:'Пять торговых дней'},{value:'1M',label:'1М',name:'Один месяц'},{value:'3M',label:'3М',name:'Три месяца'},{value:'6M',label:'6М',name:'Шесть месяцев'},{value:'YTD',label:'YTD',name:'С начала года'},{value:'1Y',label:'1Г',name:'Один год'},{value:'5Y',label:'5Л',name:'Пять лет'},{value:'ALL',label:'Все',name:'Вся доступная история'}];
export const securityResolution:Record<SecuritySeries,string>={intraday:'5 минут',hourly:'1 час',daily:'1 день',weekly:'1 неделя'};
const preferences:Record<SecurityPeriod,SecuritySeries[]>={'1H':['intraday'],'1D':['intraday','hourly'],'5D':['intraday','hourly'],'1M':['hourly','daily'],'3M':['daily','weekly'],'6M':['daily','weekly'],YTD:['daily','weekly'],'1Y':['daily','weekly'],'5Y':['daily','weekly'],ALL:['weekly','daily']};
function filterPeriod(points:OHLC[],period:SecurityPeriod,timezone:string,now:number){
 if(!points.length)return [];
 const end=points.at(-1)!.time;
 if(period==='ALL')return points;
 if(period==='1D'||period==='5D'){
  const count=period==='1D'?1:5,formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  const keys=points.map(point=>formatter.format(point.time*1000)),days=new Set([...new Set(keys)].slice(-count));
  return points.filter((point,index)=>days.has(keys[index]));
 }
 const days:Partial<Record<SecurityPeriod,number>>={'1M':30,'3M':90,'6M':180,'1Y':365,'5Y':365.25*5};
 const from=period==='1H'?end-3600:period==='YTD'?Date.UTC(new Date(now).getUTCFullYear(),0,1)/1000:end-(days[period]||0)*86400;
 return points.filter(point=>point.time>=from);
}
export function securityWindow(snapshot:SecuritySnapshot|null,period:SecurityPeriod,now=Date.now()){
 if(!snapshot)return {points:[] as OHLC[],series:preferences[period][0],fetchedAt:undefined as string|undefined};
 for(const series of preferences[period]){const points=filterPeriod(snapshot.series[series]||[],period,snapshot.exchangeTimezone,now);if(points.length>1)return {points,series,fetchedAt:snapshot.seriesFetchedAt[series]}}
 return {points:[] as OHLC[],series:preferences[period][0],fetchedAt:undefined as string|undefined};
}

