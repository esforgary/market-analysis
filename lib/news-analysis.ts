import {allAssets} from './market-catalog.ts';

export type AnalysisContext={summary?:string;source?:string;publisher?:string;sourceKind?:string;sourceId?:string};
export type NewsAnalysis={signal:number;assets:string[];category:string;catalyst?:string;concern?:string};

/**
 * Transparent rules, not a valuation or a price forecast. Coverage is limited to
 * the catalogue and RSS text supplied by a source; the full article is not read.
 * A name in a headline takes priority over secondary names in its summary.
 * Multi-company stories retain their links but get no shared directional signal.
 */
const aliases:Record<string,string[]>={
 AAPL:['Apple Inc','Apple','iPhone','iPad','MacBook'],MSFT:['Microsoft'],NVDA:['Nvidia'],GOOGL:['Alphabet','Google'],AMZN:['Amazon','Amazon Web Services','AWS'],META:['Meta Platforms','Meta','Facebook','Instagram'],TSLA:['Tesla'],AVGO:['Broadcom'],AMD:['Advanced Micro Devices','AMD'],INTC:['Intel'],QCOM:['Qualcomm'],ORCL:['Oracle Corporation','Oracle'],CRM:['Salesforce'],ADBE:['Adobe'],NFLX:['Netflix'],PLTR:['Palantir'],
 JPM:['JPMorgan','JP Morgan','J.P. Morgan'],BAC:['Bank of America'],GS:['Goldman Sachs'],V:['Visa Inc','Visa'],MA:['Mastercard','Master card'],'BRK.B':['Berkshire Hathaway'],WMT:['Walmart','Wal-Mart'],COST:['Costco'],KO:['Coca-Cola','Coca Cola'],PEP:['PepsiCo'],PG:['Procter & Gamble','Procter and Gamble'],MCD:["McDonald's",'McDonalds'],NKE:['Nike'],DIS:['Disney'],JNJ:['Johnson & Johnson','Johnson and Johnson'],LLY:['Eli Lilly'],UNH:['UnitedHealth','UnitedHealth Group'],PFE:['Pfizer'],ABBV:['AbbVie'],XOM:['Exxon','ExxonMobil','Exxon Mobil'],CVX:['Chevron'],CAT:['Caterpillar Inc','Caterpillar'],BA:['Boeing'],GE:['GE Aerospace','General Electric'],
 ASML:['ASML'],SAP:['SAP SE','SAP'],SIE:['Siemens'],ALV:['Allianz'],MC:['LVMH','Louis Vuitton Moet Hennessy'],OR:["L'Oreal",'LOréal'],AIR:['Airbus'],TTE:['TotalEnergies','Total Energies'],NESN:['Nestlé','Nestle'],ROP:['Roche'],NOVN:['Novartis'],NOVO_B:['Novo Nordisk'],AZN:['AstraZeneca'],SHEL:['Shell plc','Royal Dutch Shell','Shell'],HSBA:['HSBC'],ULVR:['Unilever'],
 '7203':['Toyota'],'6758':['Sony'],'9984':['SoftBank','Soft Bank'],'7974':['Nintendo'],'005930':['Samsung'],'2330':['TSMC','Taiwan Semiconductor'],'700':['Tencent'],'9988':['Alibaba'],'1810':['Xiaomi'],'1211':['BYD'],RELIANCE:['Reliance Industries'],TCS:['Tata Consultancy Services'],HDFCBANK:['HDFC Bank'],'2222':['Saudi Aramco','Aramco'],BHP:['BHP Group','BHP'],CBA:['Commonwealth Bank','Commonwealth Bank of Australia'],RY:['Royal Bank of Canada'],SHOP:['Shopify'],VALE:['Vale SA','Vale S.A.','Vale'],PBR:['Petrobras'],MELI:['MercadoLibre','Mercado Libre'],
};
const ambiguous=new Set(['apple','visa','oracle','shell','caterpillar','sap','meta','vale']);
const nonCompany:Record<string,RegExp>={
 visa:/\b(?:(?:tourist|student|travel|immigration|work) visa|visa (?:applications?|requirements?|restrictions?|rules|waiver|program|processing|free))\b/i,
 shell:/\b(?:shell (?:commands?|scripts?|scripting|terminal|prompt|fish)|(?:unix|linux|bash|command) shell)\b/i,
 apple:/\bapple (?:harvest|orchard|cider|fruit|crop|juice|pie)\b/i,
 caterpillar:/\bcaterpillar (?:larvae|butterfly|insect)\b/i,
 oracle:/\boracle (?:of delphi|cards?|prophecy)\b/i,
};
const companyContext=/\b(?:company|corporation|business|shares?|stocks?|earnings|revenue|profit|dividends?|investors?|quarter|financial|outlook|guidance|ceo|cfo|bank|payments?|software|cloud|ai|iphones?|macbooks?|platform|semiconductor|oil|gas|mining|equipment|launch(?:es|ed)?|unveils?|reports?|announces?)\b/i;
function normalize(text:string){return text.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[’‘']/g,'').replace(/&/g,' and ').replace(/[‐‑–—-]/g,' ').replace(/\s+/g,' ').trim().toLowerCase()}
function escape(text:string){return text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function boundary(text:string){return new RegExp('(?:^|[^\\p{L}\\p{N}_])'+escape(normalize(text))+'(?=$|[^\\p{L}\\p{N}_])','u')}
const matchers=allAssets.map(asset=>{
 const ticker=escape(asset.ticker.toLowerCase());
 return {
  asset,
  names:[...new Set([asset.name.replace(/ ADR$/,''),...(aliases[asset.ticker]||[])])].map(name=>({name:normalize(name),rule:boundary(name)})),
  explicitTicker:new RegExp('(?:\\$|\\b(?:nasdaq|nyse|nysearca|xetr|euronext|six|omxcop|lse|tse|krx|twse|hkex|nse|tadawul|asx|tsx)\\s*:\\s*|\\bticker\\s*:?\\s*|\\()'+ticker+'(?=$|[^a-z0-9_.])','i'),
  tickerContext:new RegExp('(?:^|[^a-z0-9_])'+ticker+'\\s+(?:stock|shares|etf|fund)\\b','i'),
 };
});
function identify(text:string,trustedPublisher=false){
 const normalized=normalize(text),hasContext=trustedPublisher||companyContext.test(normalized);
 return matchers.filter(({names,explicitTicker,tickerContext})=>explicitTicker.test(text)||tickerContext.test(text)||names.some(({name,rule})=>rule.test(normalized)&&(!ambiguous.has(name)||(hasContext&&!nonCompany[name]?.test(normalized))))).map(({asset})=>asset.ticker);
}
function sentences(text:string){return text.split(/(?<=[.!?])\s+(?=[A-ZА-Я“"])/u).map(s=>s.trim()).filter(Boolean)}
const positiveRules:[RegExp,string][]=[
 [/\b(?:earnings|profits?|revenue|sales|net income)\b.{0,55}\b(?:beat(?:s)?|grew|grow(?:s|th)?|rose|rise[sn]?|jump(?:s|ed)?|surg(?:es|ed)|increas(?:es|ed)|record|higher)\b/i,'В RSS сообщается об улучшении финансовых результатов. Устойчивость результата и оценку актива нужно проверить.'],
 [/\b(?:beat(?:s)?|exceed(?:s|ed)?)\b.{0,55}\b(?:earnings|revenue|profit|sales|estimates|expectations)\b/i,'В RSS сообщается о результатах выше ожиданий. Это новостной фактор, а не прогноз цены.'],
 [/\b(?:record|higher|rising|increased)\s+(?:quarterly\s+|annual\s+)?(?:revenue|earnings|profit|sales|net income)\b/i,'Источник сообщает о росте или рекордном финансовом показателе. Сопоставьте его с ожиданиями рынка.'],
 [/\b(?:raise[sd]?|boost[sd]?|increase[sd]?)\b.{0,50}\b(?:forecast|guidance|dividend|outlook)\b/i,'Источник сообщает о повышении прогноза или дивиденда. Проверьте условия и устойчивость выплат.'],
 [/\b(?:wins?|won|secures?|secured|signs?|signed|lands?|landed)\b.{0,60}\b(?:contract|deal|partnership|order)\b/i,'Источник сообщает о контракте или соглашении. Его размер и влияние на прибыль ещё нужно оценить.'],
 [/\b(?:launch(?:es|ed|ing)?|unveil(?:s|ed)?|introduc(?:es|ed|ing)|rolls? out)\b.{0,80}\b(?:product|platform|software|chip|processor|gpu|service|vehicle|drug|ai tools?|cloud|iphone|galaxy)\b/i,'Источник сообщает о новом продукте. Коммерческий спрос и вклад в прибыль пока не подтверждены.'],
 [/\b(?:expands?|expanded|increases?|increased)\b.{0,40}\b(?:production|manufacturing|capacity)\b/i,'Источник сообщает о расширении производства. Будущий спрос, затраты и рентабельность требуют проверки.'],
 [/\b(?:receives?|received|wins?|won|secures?|secured)\b.{0,40}\b(?:fda|regulatory)\s+approval\b/i,'Источник сообщает о регуляторном разрешении. Оно само по себе не подтверждает будущие продажи.'],
 [/(?:^|[^\p{L}])(?:прибыль|выручка|продажи)(?![\p{L}]).{0,45}(?:выросл|рост|увеличил|превысил)/iu,'В RSS сообщается об улучшении финансовых результатов. Устойчивость результата и оценку актива нужно проверить.'],
];
const negativeRules=[
 /\b(?:earnings|profits?|revenue|sales|fees|margins?|deliveries|shares?|stocks?)\b.{0,60}\b(?:fell|falls?|declin(?:e[sd]?|ing)|drop(?:s|ped)?|slid(?:e[sd]?)?|tumbl(?:e[sd]?)|down|slow(?:s|ed|ing)?|plung(?:e[sd]?)|slump(?:s|ed)?)\b/i,
 /\b(?:decline|drop|fall|slide|slump)\s+in\s+(?:earnings|profits?|revenue|sales|fees|demand)\b/i,
 /\b(?:cuts?|cut|lowers?|lowered|slashes?|slashed|reduces?|reduced)\b.{0,40}\b(?:forecast|guidance|outlook|dividend)\b/i,
 /\b(?:miss(?:es|ed)?)\b.{0,40}\b(?:estimates|expectations|forecast|target)\b/i,
 /\b(?:reports?|reported|posts?|posted|suffers?|suffered)\b.{0,30}\b(?:loss|losses)\b/i,
 /\b(?:lawsuit|fraud|recall(?:s|ed)?|antitrust (?:lawsuit|probe|investigation|charges|case)|layoffs?|data breach|regulatory probe|criminal investigation)\b/i,
 /\bwarns?\b.{0,60}\b(?:demand|profit|revenue|slowdown|earnings|tariffs|loss|shortfall)\b/i,
 /(?:снижен[\p{L}]*|сократил[\p{L}]*|упал[\p{L}]*)\s+(?:прибыл[\p{L}]*|выручк[\p{L}]*|прогноз[\p{L}]*|дивиденд[\p{L}]*)/iu,
 /(?:прибыль|выручка|продажи).{0,35}(?:снизил[\p{L}]*|упал[\p{L}]*|сократил[\p{L}]*)/iu,
];
const hypothetical=/\b(?:could|may|might|would|will|hopes?|seeks?|plans?|aims?|expected to|potential|how to|ways to|tips to|your sales|your profit|drive sales)\b/i;
const historicalBackground=/^(?:since\b|(?:one|two|three|\d+) (?:years?|months?) ago\b|last year\b|in (?:19|20)\d{2}\b|previously\b|unveiled at\b)/i;
const projected=/\b(?:forecasts?|expects?|expected|predicts?|projects?|anticipates?)\b/i;
const continuation=/^(?:the company|it\b|its\b|we\b|our\b|revenue\b|earnings\b|profit\b|sales\b|net income\b|however\b|but\b|yet\b)/i;
const negated=/\b(?:not|no|never|fails? to|failed to|without)\b/i;
const resolvedRisk=/\b(?:dismiss(?:es|ed)?|drops?|dropped|ends?|ended|cleared|denies|denied|settles?|settled|no evidence|avoids?|avoided)\b.{0,35}\b(?:lawsuit|fraud|recall|antitrust|probe|investigation)\b/i;

export function analyze(title:string,category:string,context:AnalysisContext|string={}):NewsAnalysis{
 const ctx=typeof context==='string'?{summary:context}:context;
 const titleAssets=identify(title);
 const lead=sentences(ctx.summary||'').slice(0,2).join(' ');
 const summaryAssets=identify(lead);
 const publisherAssets=/^(?:Компания|Company)$/i.test(ctx.sourceKind||'')?identify(ctx.publisher||ctx.source||'',true):[];
 // A feed's publisher only supplies an issuer hint, never a positive signal.
 const assets=titleAssets.length?titleAssets:summaryAssets.length?summaryAssets:publisherAssets;
 const headline=normalize(title);
 if(/\bdividends?\b|дивиденд/i.test(headline))category='Дивиденды';
 if(/\b(?:currency|currencies|exchange rates?|dollar|euro)\b|валютн|курс (?:доллара|евро)/i.test(headline))category='Валюты';
 if(!assets.length)return {signal:0,assets,category};
 if(assets.length>1)return {signal:0,assets,category};
 const ticker=assets[0];
 const scoped=[title];
 let issuerContext=titleAssets.includes(ticker)||publisherAssets.includes(ticker);
 for(const sentence of sentences(ctx.summary||'').slice(0,5)){
  const mentions=identify(sentence);
  if(mentions.some(item=>item!==ticker)){issuerContext=false;continue}
  if(mentions.includes(ticker)){issuerContext=true;scoped.push(sentence)}
  else if(issuerContext&&continuation.test(sentence))scoped.push(sentence);
  else issuerContext=false;
 }
 const text=scoped.map(normalize);
 const risk=text.find(sentence=>!resolvedRisk.test(sentence)&&negativeRules.some(rule=>rule.test(sentence)));
 if(risk)return {signal:-1,assets,category,concern:'В RSS есть негативный фактор. Он может перевесить позитивные сообщения; проверьте полный материал.'};
 for(const sentence of text){
  if(hypothetical.test(sentence)||negated.test(sentence)||historicalBackground.test(sentence))continue;
  if(projected.test(sentence)&&!positiveRules[3][0].test(sentence))continue;
  const catalyst=positiveRules.find(([rule])=>rule.test(sentence))?.[1];
  if(catalyst)return {signal:1,assets,category,catalyst};
 }
 return {signal:0,assets,category};
}
