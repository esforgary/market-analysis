import { allAssets } from './market-catalog.ts';
import { sources } from './news-sources.ts';
import { analyze } from './news-analysis.ts';
import type { Story } from './news.ts';

export const ALERT_MAX_AGE_MS = 3 * 60 * 60 * 1000;
export const SNAPSHOT_MAX_AGE_MS = 20 * 60 * 1000;
export type MarketAlert = {id:string;ticker:string;symbol:string;event:string;title:string;body:string;source:string;sourceUrl:string;publishedAt:string;observedAt:string};
type Snapshot = { fetchedAt?:string; news?:Story[]; sourceHealth?:{id:string;status:string;checkedAt:string}[] };
const catalogue = new Map(allAssets.map(asset => [asset.ticker, asset]));
const registry = new Map(sources.map(source => [source.id, source]));
const primaryHosts=new Map<string,Set<string>>();
for(const source of sources.filter(s=>['Компания','Первичный источник'].includes(s.kind))){const hosts=primaryHosts.get(source.publisher)||new Set<string>();hosts.add(new URL(source.url).hostname);hosts.add(new URL(source.homepage).hostname);primaryHosts.set(source.publisher,hosts)}
const hypothetical = /\b(?:could|may|might|would|expected to|rumou?r|reportedly|plans? to|seeks? to|consider(?:s|ing)|according to sources|not|never|no longer)\b|(?:может|возможно|слух|планирует|не будет)/i;
const quantified = /(?:[$€£¥]\s*\d|\b(?:USD|EUR|GBP|JPY|CHF|CNY)\s*\d|\d[\d.,]*\s*(?:%|billion|million|per share|dollars?|млрд|млн))/i;
const events = [
 {key:'dividend',label:'Решение по дивидендам',rule:/\b(?:declares?|declared|increases?|increased|raises?|raised|reduces?|reduced|cuts?|cut)\b.{0,100}\b(?:cash\s+)?dividends?\b/i,number:true},
 {key:'dividend-suspended',label:'Приостановка дивидендов',rule:/\b(?:suspends?|suspended|cancels?|cancelled|eliminates?|eliminated)\b.{0,50}\bdividends?\b/i,number:false},
 {key:'earnings',label:'Опубликованы финансовые результаты',rule:/\b(?:reports?|reported|announces?|announced|releases?|released)\b.{0,90}\b(?:quarter(?:ly)?|full.year|annual|financial results|earnings)\b/i,number:true},
 {key:'guidance',label:'Изменён финансовый прогноз',rule:/\b(?:raises?|raised|increases?|increased|lowers?|lowered|cuts?|cut|reduces?|reduced)\b.{0,60}\b(?:guidance|full.year (?:forecast|outlook)|revenue forecast|profit forecast)\b/i,number:true},
 {key:'bankruptcy',label:'Заявление о банкротстве',rule:/\b(?:files?|filed)\b.{0,60}\b(?:bankruptcy|chapter 11)\b/i,number:false},
];
function canonicalUrl(value:string){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/.test(key))u.searchParams.delete(key);return u}catch{return null}}
function clean(text:string,max:number){return text.replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
export function snapshotIsFresh(snapshot:Snapshot,now=Date.now()){
 const time=Date.parse(snapshot?.fetchedAt||'');return Number.isFinite(time)&&time<=now&&now-time<=SNAPSHOT_MAX_AGE_MS;
}
/** Notifications report a documented event, never a forecast or an instruction to trade.
 * Only current official issuer/regulator feeds with concrete events qualify. A
 * positive sentiment, secondary article, product launch or generic growth does not.
 */
export function selectMarketAlerts(snapshot:Snapshot,now=Date.now()):MarketAlert[]{
 if(!snapshotIsFresh(snapshot,now)||!Array.isArray(snapshot.news))return [];
 const healthy=new Set((snapshot.sourceHealth||[]).filter(s=>['ok','unchanged'].includes(s.status)&&Number.isFinite(Date.parse(s.checkedAt))&&Date.parse(s.checkedAt)<=now&&now-Date.parse(s.checkedAt)<=SNAPSHOT_MAX_AGE_MS).map(s=>s.id));
 const result:MarketAlert[]=[],seen=new Set<string>();
 for(const story of snapshot.news.slice(0,6000)){
  if(!story||typeof story.title!=='string'||typeof story.summary!=='string')continue;
  const source=registry.get(story.sourceId||'');
  if(!source||!healthy.has(source.id)||!['Компания','Первичный источник'].includes(source.kind))continue;
  const published=Date.parse(story.date),observed=Date.parse(story.firstSeenAt||'');
  if(!Number.isFinite(published)||!Number.isFinite(observed)||published>now||observed>now||now-published>ALERT_MAX_AGE_MS||now-observed>ALERT_MAX_AGE_MS)continue;
  const url=canonicalUrl(story.url);if(!url)continue;
  const trustedHosts=[new URL(source.homepage).hostname,new URL(source.url).hostname];
  if(!trustedHosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host.replace(/^www\./,''))))continue;
  const inferred=analyze(story.title,story.category,{summary:story.summary,publisher:source.publisher,sourceKind:source.kind});
  if(inferred.assets.length!==1)continue;
  const asset=catalogue.get(inferred.assets[0]);if(!asset)continue;
  // A company publisher can supply implicit issuer context, but cannot override
  // a different company explicitly named in a sentence.
  if(source.kind==='Компания'){
   const issuer=analyze(source.publisher+' reports financial results','',{publisher:source.publisher,sourceKind:'Компания'}).assets;
   if(issuer.length!==1||issuer[0]!==asset.ticker)continue;
  }
  const sentences=[story.title,...story.summary.split(/(?<=[.!?])\s+(?=[A-ZА-Я])/u)].map(s=>clean(s,1500));
  let issuerContext=source.kind==='Компания';
  const scoped=sentences.filter((sentence,index)=>{
   // No publisher/summary hint: the actor must be identified in this sentence.
   const mentioned=analyze(sentence,story.category).assets;
   if(mentioned.length){issuerContext=mentioned.length===1&&mentioned[0]===asset.ticker;return issuerContext}
   const continuation=/^(?:the company\b|the board\b|board of directors\b|it\b|its\b|we\b|our\b)/i.test(sentence);
   const belongs=issuerContext&&((index===0&&source.kind==='Компания')||continuation);
   if(!belongs)issuerContext=false;
   return belongs;
  });
  // Keep the concrete figure and event together, inside the selected issuer's scope.
  const matched=events.find(event=>scoped.some(sentence=>!hypothetical.test(sentence)&&event.rule.test(sentence)&&(!event.number||quantified.test(sentence))));
  if(!matched)continue;
  const id=asset.ticker+'|'+matched.key+'|'+url.href;if(seen.has(id))continue;seen.add(id);
  result.push({id,ticker:asset.ticker,symbol:asset.exchange+':'+asset.ticker,event:matched.key,title:asset.ticker+' · '+matched.label,body:clean((story.ru?.title||story.title)+' · '+source.publisher,350),source:source.publisher,sourceUrl:url.href,publishedAt:new Date(published).toISOString(),observedAt:new Date(observed).toISOString()});
 }
 return result.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}

/** Revalidate the small, public build artifact before the server queues anything. */
export function validateAlertFeed(value:unknown,now=Date.now()):{fetchedAt:string;alerts:MarketAlert[]}{
 if(!value||typeof value!=='object')throw Error('Некорректный снимок событий');
 const feed=value as {version?:number;fetchedAt?:string;alerts?:unknown[]};
 if(feed.version!==1||!snapshotIsFresh(feed,now)||!Array.isArray(feed.alerts)||feed.alerts.length>200)throw Error('Снимок событий устарел или имеет неверный формат');
 const alerts:MarketAlert[]=[],seen=new Set<string>();
 for(const entry of feed.alerts){
  if(!entry||typeof entry!=='object')throw Error('Некорректное событие');
  const a=entry as MarketAlert,asset=catalogue.get(a.ticker),url=typeof a.sourceUrl==='string'?canonicalUrl(a.sourceUrl):null;
  if(!asset||a.symbol!==asset.exchange+':'+asset.ticker||!events.some(event=>event.key===a.event)||!url)throw Error('Неизвестный актив или источник');
  const primary=[...(primaryHosts.get(a.source)||[])].some(host=>url.hostname===host||url.hostname.endsWith('.'+host.replace(/^www\./,'')));
  if(!primary||a.id!==a.ticker+'|'+a.event+'|'+url.href)throw Error('Источник события не подтверждён');
  if(typeof a.title!=='string'||a.title.length>160||typeof a.body!=='string'||a.body.length>500||/[\u0000-\u001f]/.test(a.title+a.body))throw Error('Некорректный текст события');
  const published=Date.parse(a.publishedAt),observed=Date.parse(a.observedAt);
  if(!Number.isFinite(published)||!Number.isFinite(observed)||published>now||observed>now)throw Error('Некорректная дата события');
  if(now-published>ALERT_MAX_AGE_MS||now-observed>ALERT_MAX_AGE_MS)continue;
  if(!seen.has(a.id)){seen.add(a.id);alerts.push(a)}
 }
 return {fetchedAt:feed.fetchedAt!,alerts};
}
