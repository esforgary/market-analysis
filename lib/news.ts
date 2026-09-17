import {contextExcerpt} from './news-summary.ts';
import {analyze} from './news-analysis.ts';
import {sourceErrorKind,sourceFailureSummary,type SourceErrorKind} from './source-health.ts';
export {analyze};
import {sources,type NewsSource} from './news-sources.ts';
export {sources};
export type Story={title:string;source:string;sourceId?:string;publisher?:string;sourceKind?:string;url:string;date:string;category:string;summary:string;signal:number;assets:string[];catalyst?:string;concern?:string;summaryKind?:string;firstSeenAt?:string;ru?:{title:string;summary:string;hash:string;model:string;translatedAt:string};translationStatus?:'ready'|'pending'|'failed'|'unconfigured'};
function clean(s:string){return s.replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(entity,value)=>{const n=value[0].toLowerCase()==='x'?parseInt(value.slice(1),16):Number(value);return n>0&&n<=0x10ffff?String.fromCodePoint(n):entity}).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&#(?:39|8217);/g,"'").replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
function tag(s:string,t:string){return clean(s.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${t}>`,'i'))?.[1]||'')}
export function parseFeed(xml:string,source:Pick<NewsSource,'name'|'category'> & Partial<NewsSource>):Story[]{
 const blocks=[...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
 return blocks.map(m=>{const body=m[2],title=tag(body,'title');const atomLinks=[...body.matchAll(/<link\b([^>]+)\/?\s*>/gi)].map(x=>({href:x[1].match(/href=["']([^"']+)["']/i)?.[1],rel:x[1].match(/rel=["']([^"']+)["']/i)?.[1]}));
 const rawUrl=tag(body,'link')||clean(atomLinks.find(x=>!x.rel||x.rel==='alternate')?.href||'');let url='';try{url=rawUrl?new URL(rawUrl,source.url).href:''}catch{};
 const date=tag(body,'pubDate')||tag(body,'published')||tag(body,'dc:date')||tag(body,'updated');
 const description=tag(body,'description')||tag(body,'summary');const analysis=analyze(title,source.category,{summary:description,source:source.name,publisher:source.publisher,sourceKind:source.kind});
 return{title,source:source.publisher||source.name,sourceId:source.id,publisher:source.publisher||source.name,sourceKind:source.kind,url,date:Number.isFinite(Date.parse(date))?new Date(date).toISOString():'',summary:description?contextExcerpt(description):title,summaryKind:description?'Кратко из RSS источника':'Источник передал только заголовок',...analysis};
 }).filter(n=>n.title&&/^https?:\/\//i.test(n.url)).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)).slice(0,50);
}
export type SourceHealth={id:string;name:string;publisher:string;url:string;homepage:string;kind:string;status:'ok'|'unchanged'|'error';checkedAt:string;lastSuccessAt?:string;latestArticleAt?:string;articles:number;error?:string;errorKind?:SourceErrorKind};
export type FeedCache={url?:string;etag?:string;modified?:string;lastSuccessAt?:string;news:Story[]};
export type CollectorCache=Record<string,FeedCache>;
export function deduplicate(news:Story[]){const urls=new Set<string>(),titles=new Set<string>();return news.filter(n=>{let url:string;try{const u=new URL(n.url);u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/.test(key))u.searchParams.delete(key);url=u.href}catch{return false}const title=n.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(urls.has(url)||titles.has(title))return false;urls.add(url);titles.add(title);return true})}
function reanalyze(news:Story[],source:NewsSource){return news.map(story=>({...story,catalyst:undefined,concern:undefined,...analyze(story.title,source.category,{summary:story.summary,source:source.name,publisher:source.publisher,sourceKind:source.kind})}))}
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function requestFeed(url:string,headers:Record<string,string>,fetcher:typeof fetch){
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetcher(url,{headers,signal:AbortSignal.timeout(12000)});
   if(attempt===0&&response.status>=500){await response.body?.cancel();await wait(200);continue}
   // A 403 is an explicit refusal. Do not retry it or change the collector identity.
   return response;
  }catch(error){if(attempt)throw error;await wait(200)}
 }
 throw Error('Ошибка соединения');
}
export async function collectNews(previous:CollectorCache={},sourceList:NewsSource[]=sources,fetcher:typeof fetch=fetch){
 const cache:CollectorCache={},health:SourceHealth[]=[];let cursor=0;
 // One request at a time per host, even when the catalog lists many feeds from one publisher.
 const groups=new Map<string,NewsSource[]>();for(const source of sourceList){const host=new URL(source.url).host;groups.set(host,[...(groups.get(host)||[]),source])}
 const queue=[...groups.values()];
 await Promise.all(Array.from({length:Math.min(8,queue.length)},async()=>{while(cursor<queue.length){
 const group=queue[cursor++];
 for(let index=0;index<group.length;index++){
 if(index)await wait(250);
 const source=group[index],old=previous[source.id],checkedAt=new Date().toISOString();
 const base={id:source.id,name:source.name,publisher:source.publisher,url:source.url,homepage:source.homepage,kind:source.kind,checkedAt};
 try{
  const headers:Record<string,string>={'User-Agent':'MeridianMarketReader/4.0 (+https://esforgary.github.io/market-analysis/)','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml'};
  if(old?.url===source.url){if(old.etag)headers['If-None-Match']=old.etag;if(old.modified)headers['If-Modified-Since']=old.modified}
  const response=await requestFeed(source.url,headers,fetcher);let entries:Story[];
  if(response.status===304&&old){entries=reanalyze(old.news,source).map(story=>({...story,firstSeenAt:story.firstSeenAt||checkedAt}));cache[source.id]={...old,url:source.url,news:entries,lastSuccessAt:checkedAt}}
  else{
   if(!response.ok)throw Error('HTTP '+response.status);
   const xml=await response.text();if(xml.length>4000000)throw Error('Слишком большой ответ');if(!/<(?:rss|feed|rdf:RDF)\b/i.test(xml))throw Error('Источник вернул не RSS/Atom');
   entries=parseFeed(xml,source).map(story=>({...story,firstSeenAt:old?.news.find(previous=>previous.url===story.url)?.firstSeenAt||checkedAt}));
   if(!entries.length)throw Error('В ленте нет распознаваемых публикаций');
   cache[source.id]={url:source.url,etag:response.headers.get('etag')||undefined,modified:response.headers.get('last-modified')||undefined,lastSuccessAt:checkedAt,news:entries};
  }
  const dates=entries.map(story=>story.date).filter(Boolean).sort();
  health.push({...base,status:response.status===304?'unchanged':'ok',lastSuccessAt:checkedAt,latestArticleAt:dates.at(-1),articles:entries.length});
 }catch(error){
  if(old)cache[source.id]={...old,news:reanalyze(old.news,source)};
  const message=error instanceof Error?error.message:'Ошибка источника';
  health.push({...base,status:'error',lastSuccessAt:old?.lastSuccessAt,latestArticleAt:old?.news.map(story=>story.date).filter(Boolean).sort().at(-1),articles:old?.news.length||0,error:message,errorKind:sourceErrorKind(message)});
 }
 }
 }}));
 const news=deduplicate(Object.values(cache).flatMap(item=>item.news)).filter(story=>!story.date||(Date.parse(story.date)>=Date.now()-30*86400000&&Date.parse(story.date)<=Date.now()+5*60000)).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
 health.sort((a,b)=>a.publisher.localeCompare(b.publisher)||a.name.localeCompare(b.name));
 const failed=health.filter(item=>item.status==='error').length,summary=sourceFailureSummary(health);
 return {cache,snapshot:{news,errors:summary?[summary]:[],fetchedAt:new Date().toISOString(),sourceHealth:health,sourceCount:sourceList.length,publisherCount:new Set(sourceList.map(source=>source.publisher)).size,availableCount:health.length-failed,collectionIntervalSeconds:300}};
}
export async function fetchNews(){return(await collectNews()).snapshot}
