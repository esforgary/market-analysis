import type {Story} from './news';
import {allAssets} from './market-catalog.ts';

export type RadarKind='positive'|'mixed'|'risk'|'watch';
export type RadarItem={ticker:string;date:string;kind:RadarKind;verdict:string;reason:string;risks:string[];related:Story[];supporting:Story[];opposing:Story[];score:number};
export type Idea=Omit<RadarItem,'kind'|'related'|'verdict'>&{verdict:'Рассмотреть покупку'};
const catalog=new Set(allAssets.map(asset=>asset.ticker));
const kindOrder:Record<RadarKind,number>={positive:0,mixed:1,risk:2,watch:3};
const verdicts:Record<RadarKind,string>={positive:'Позитивный повод',mixed:'Смешанные сигналы',risk:'Есть риски',watch:'В поле зрения'};

function freshStories(news:Story[],asOf:string){
 const now=Date.parse(asOf),urls=new Set<string>(),titles=new Set<string>();
 if(!Number.isFinite(now))return [];
 return [...news].sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)).filter(story=>{
  const age=now-Date.parse(story.date);
  if(!Number.isFinite(age)||age<0||age>3*86400000)return false;
  let url:string;try{const parsed=new URL(story.url);if(!/^https?:$/.test(parsed.protocol))return false;parsed.hash='';for(const key of [...parsed.searchParams.keys()])if(/^(utm_|fbclid|gclid)/.test(key))parsed.searchParams.delete(key);url=parsed.href}catch{return false}
  const title=story.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(urls.has(url)||titles.has(title))return false;urls.add(url);titles.add(title);return true;
 });
}

// This is an evidence index, not a price model. Neutral and adverse stories stay visible.
export function marketRadar(news:Story[],asOf=new Date().toISOString()){
 const fresh=freshStories(news,asOf),tickers=[...new Set(fresh.flatMap(story=>story.assets))].filter(ticker=>catalog.has(ticker));
 const items:RadarItem[]=tickers.map(ticker=>{
  const related=fresh.filter(story=>story.assets.includes(ticker));
  const supporting=related.filter(story=>story.signal>0&&story.catalyst),opposing=related.filter(story=>story.signal<0);
  const kind:RadarKind=supporting.length?(opposing.length?'mixed':'positive'):(opposing.length?'risk':'watch');
  const publishers=new Set(related.map(story=>story.publisher||story.source)).size;
  return {ticker,date:asOf.slice(0,10),kind,verdict:verdicts[kind],
   reason:kind==='mixed'?'Есть позитивные и негативные сообщения. Сопоставьте их перед решением.':kind==='positive'?supporting[0].catalyst!:kind==='risk'?(opposing[0].concern||'В свежих публикациях отмечены риски для актива.'):'Есть свежие публикации об активе; однозначного сигнала для покупки нет.',
   risks:['Текущая оценка компании и цена входа не учитываются алгоритмом.','Новостной фактор может быть уже заложен в котировку.',...(related.some(story=>story.sourceKind==='Компания')?['Корпоративные сообщения отражают позицию компании и требуют независимой проверки.']:[]),...new Set(opposing.map(story=>story.concern||story.title))],
   related,supporting,opposing,
   // Cap volume so repeated announcements by one issuer cannot dominate the whole radar.
   score:publishers*3+Math.min(related.length,5)
  };
 });
 items.sort((a,b)=>kindOrder[a.kind]-kindOrder[b.kind]||b.score-a.score||(Date.parse(b.related[0].date)-Date.parse(a.related[0].date))||a.ticker.localeCompare(b.ticker));
 return {items,stats:{freshStories:fresh.length,coveredAssets:items.length,positiveCandidates:items.filter(item=>item.kind==='positive').length,totalAssets:allAssets.length}};
}

export function dailyIdeas(news:Story[],asOf=new Date().toISOString()):Idea[]{
 return marketRadar(news,asOf).items.filter(item=>item.kind==='positive').map(item=>({...item,verdict:'Рассмотреть покупку' as const}));
}
export function relevantNews(news:Story[],ticker:string){return news.filter(story=>story.assets.includes(ticker)).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0))}
