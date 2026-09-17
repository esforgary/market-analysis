import {fx,validateRates,type Rate} from './market-data.ts';

export type CurrencySource={
 id:'nbu'|'blend';
 provider:'nbu'|null;
 label:string;
 description:string;
 url:string;
};
const NBU:CurrencySource={
 id:'nbu',provider:'nbu',label:'НБУ · официальный курс',
 description:'Официальные дневные данные НБУ через Frankfurter. Обратная пара пересчитывается.',
 url:'https://bank.gov.ua/en/markets/exchangerates',
};
const BLEND:CurrencySource={
 id:'blend',provider:null,label:'Frankfurter · сводный курс',
 description:'Сводный дневной справочный курс из нескольких источников, а не цена сделки.',
 url:'https://frankfurter.dev/',
};

/** UAH uses one named authority in both directions; all other pairs retain broad blended coverage. */
export function currencySource(base:string,quote:string):CurrencySource{
 return base.toUpperCase()==='UAH'||quote.toUpperCase()==='UAH'?NBU:BLEND;
}

function isCalendarDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

function observedRates(payload:unknown,today:string){
 return validateRates(payload).filter(rate=>isCalendarDate(rate.date)&&rate.date<=today);
}

function isPair(rate:Rate,base:string,quote:string){
 return rate.base===base&&rate.quote===quote;
}

/** Both inputs must come from the same source policy. Do not carry a quote into unobserved dates. */
export function mergeLatestIntoHistory(history:Rate[],latest:Rate|null,base:string,quote:string):Rate[]{
 const pairBase=base.toUpperCase(),pairQuote=quote.toUpperCase();
 const today=new Date().toISOString().slice(0,10);
 const byDate=new Map<string,Rate>();
 for(const rate of observedRates(history,today)){
  if(isPair(rate,pairBase,pairQuote))byDate.set(rate.date,rate);
 }
 const sorted=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
 const newestDate=sorted.at(-1)?.date;
 if(latest&&observedRates([latest],today).length&&isPair(latest,pairBase,pairQuote)&&(!newestDate||latest.date>=newestDate)){
  byDate.set(latest.date,latest);
 }
 return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function defaultFrom(){
 const date=new Date();
 date.setUTCFullYear(date.getUTCFullYear()-1);
 return date.toISOString().slice(0,10);
}

/** Fetches latest and history with identical base/quote/provider parameters. No silent provider fallback. */
export async function loadCurrencyPair(
 base:string,quote:string,signal?:AbortSignal,from=defaultFrom(),request:typeof fx=fx,
):Promise<{history:Rate[];latest:Rate|null;source:CurrencySource}>{
 const pairBase=base.toUpperCase(),pairQuote=quote.toUpperCase();
 if(!/^[A-Z]{3}$/.test(pairBase)||!/^[A-Z]{3}$/.test(pairQuote)||pairBase===pairQuote)throw Error('Некорректная валютная пара');
 if(!isCalendarDate(from)||from>new Date().toISOString().slice(0,10))throw Error('Некорректная дата начала истории');
 signal?.throwIfAborted();
 const source=currencySource(pairBase,pairQuote);
 const params=new URLSearchParams({base:pairBase,quotes:pairQuote});
 if(source.provider)params.set('providers',source.provider);
 const latestQuery='rates?'+params.toString();
 params.set('from',from);
 const [latestPayload,historyPayload]=await Promise.all([
  request(latestQuery,signal),request('rates?'+params.toString(),signal),
 ]);
 signal?.throwIfAborted();
 const latest=observedRates(latestPayload,new Date().toISOString().slice(0,10)).filter(rate=>isPair(rate,pairBase,pairQuote)).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||null;
 const history=mergeLatestIntoHistory(validateRates(historyPayload),latest,pairBase,pairQuote);
 if(!history.length)throw Error(source.id==='nbu'?'НБУ не предоставляет данные для этой валютной пары':'Источник не предоставляет данные для этой валютной пары');
 return {history,latest:history.at(-1)||null,source};
}

/** API dates represent calendar observations, so local time zones must not move the label by a day. */
export function formatRateDate(value:string,options:Intl.DateTimeFormatOptions={day:'numeric',month:'short'}){
 if(!isCalendarDate(value))return value;
 const date=new Date(value+'T00:00:00.000Z');
 return new Intl.DateTimeFormat('ru-RU',{...options,timeZone:'UTC'}).format(date);
}
