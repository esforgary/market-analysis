import assert from 'node:assert/strict';
import test from 'node:test';
import {analyze} from '../lib/news-analysis.ts';
import {allAssets} from '../lib/market-catalog.ts';

const read=(title,context)=>analyze(title,'Экономика',context);
test('every catalogue company and ETF is recognized by its name in a financial headline',()=>{
 for(const asset of allAssets){
  const result=read(`${asset.name} reports annual results`);
  assert.ok(result.assets.includes(asset.ticker),`${asset.ticker}: ${asset.name}`);
 }
});
test('explicit exchange symbols cover every asset including numeric and punctuation tickers',()=>{
 for(const asset of allAssets){
  assert.deepEqual(read(`${asset.exchange}:${asset.ticker} reports results`).assets,[asset.ticker],asset.ticker);
 }
});
test('common aliases, accents, apostrophes and product names preserve ticker identity',()=>{
 for(const [name,ticker] of [['J.P. Morgan','JPM'],["McDonald's",'MCD'],['L’Oreal','OR'],['Procter and Gamble','PG'],['ExxonMobil','XOM'],['Softbank','9984'],['Taiwan Semiconductor','2330'],['Aramco','2222'],['Qualcomm','QCOM'],['iPhone','AAPL'],['Royal Bank of Canada','RY']]){
  assert.deepEqual(read(`${name} announces financial results`).assets,[ticker],name);
 }
});
test('bare ambiguous tickers and ordinary words are not linked to companies',()=>{
 for(const title of ['V shaped recovery in MA','Sap flows through trees','A shell script improves software builds','Student visa rules change','Apple harvest rises in local orchards','The caterpillar becomes a butterfly','Metabolic therapy expands','Oracle of Delphi predicts sales','A new shopping tool']){
  assert.deepEqual(read(title).assets,[],title);
 }
 assert.deepEqual(read('NYSE:V beats earnings estimates').assets,['V']);
 assert.deepEqual(read('$MA raises dividend').assets,['MA']);
 assert.deepEqual(read('SAP SE reports earnings').assets,['SAP']);
});
test('full company boundaries avoid substrings and near names',()=>{
 assert.deepEqual(read('Alphabetical entries and intellection research'),{signal:0,assets:[],category:'Экономика'});
 assert.deepEqual(read('Airbus supplier visits Alibaba headquarters').assets,['AIR','9988']);
});
test('summary identifies an issuer when the headline omits it',()=>{
 const result=read('Quarterly results exceed expectations',{summary:'Qualcomm reports revenue growth of 12%. Its profit also rose.'});
 assert.deepEqual(result.assets,['QCOM']);assert.equal(result.signal,1);assert.ok(result.catalyst);
});
test('headline issuer takes priority over incidental companies in summary',()=>{
 const result=read('Microsoft schedules annual shareholder meeting',{summary:'Microsoft will host the event. Amazon reports record revenue.'});
 assert.deepEqual(result.assets,['MSFT']);assert.equal(result.signal,0);
});
test('financial positive patterns handle either earnings-beat order and raised outlook',()=>{
 for(const title of ['NVIDIA earnings beat expectations','NVIDIA beats Wall Street earnings estimates','Microsoft raises full-year guidance','Qualcomm reports record revenue','Boeing secures a new contract','Oracle launches a new cloud platform']){
  assert.equal(read(title).signal,1,title);
 }
});
test('growth mentions, forecasts and promotional advice do not create buy signals',()=>{
 for(const title of ['NVIDIA growth','NVIDIA hosts earnings call','NVIDIA could beat earnings estimates','NVIDIA expects revenue growth','NVIDIA forecasts revenue growth','Will NVIDIA raise its dividend?','Google helps boost your holiday sales','Microsoft does not raise its guidance','Microsoft expands a podcast series']){
  assert.equal(read(title).signal,0,title);
 }
});
test('negative financial news overrides positive parts without leaving a catalyst',()=>{
 const result=read('NVIDIA beats earnings estimates but cuts guidance');
 assert.equal(result.signal,-1);assert.ok(result.concern);assert.equal(result.catalyst,undefined);
 assert.equal(read('Apple revenue rose',{summary:'Apple reports a data breach.'}).signal,-1);
 assert.equal(read('Apple revenue rose',{summary:'Amazon reports a data breach.'}).signal,1);
});
test('multi-company stories are linked but do not give all issuers the same directional signal',()=>{
 const result=read('Apple beats earnings estimates while Microsoft misses estimates');
 assert.deepEqual(result.assets,['AAPL','MSFT']);assert.equal(result.signal,0);assert.equal(result.catalyst,undefined);
});
test('corporate publisher hints link unbranded titles without themselves generating positive signals',()=>{
 const company={publisher:'Google',sourceKind:'Компания'};
 assert.deepEqual(read('Three new ways to organize your profile',company).assets,['GOOGL']);
 assert.equal(read('Three new ways to organize your profile',company).signal,0);
 assert.deepEqual(read('Revenue grew by 20%',{publisher:'Google',sourceKind:'Редакция'}).assets,[]);
 assert.equal(read('Revenue grew by 20%',company).signal,1);
});
test('a resolved lawsuit is not treated as an active negative financial event',()=>{
 assert.equal(read('Google settles antitrust lawsuit').signal,0);
 assert.equal(read('Google faces antitrust lawsuit').signal,-1);
});
test('categories come from the headline while unlinked macro growth stays neutral',()=>{
 assert.equal(read('Microsoft raises dividend').category,'Дивиденды');
 const macro=read('Dollar rises as euro falls');assert.equal(macro.category,'Валюты');assert.equal(macro.signal,0);
});
test('a historical product launch in the summary does not become a new catalyst',()=>{
 const result=read('Salesforce marks its anniversary',{summary:'One year ago, Salesforce launched a new cloud platform.'});
 assert.deepEqual(result.assets,['CRM']);assert.equal(result.signal,0);
 assert.equal(read('Samsung discusses product design',{summary:'Since introducing the first Galaxy Fold in 2019, Samsung has refined the device.'}).signal,0);
});
test('an unrelated unlisted company in summary does not inherit the headline issuer',()=>{
 const result=read('Microsoft hosts a conference',{summary:'Microsoft welcomed guests. Small Example Company reports record revenue.'});
 assert.deepEqual(result.assets,['MSFT']);assert.equal(result.signal,0);
});
test('discussion of an antitrust waiver is not treated as an antitrust case against an issuer',()=>{
 assert.equal(read("Nvidia's CEO criticizes a proposal for an antitrust waiver").signal,0);
 assert.equal(read('Nvidia faces an antitrust investigation').signal,-1);
});
test('financial direction in a Russian RSS headline works with Latin issuer names',()=>{
 assert.equal(read('Microsoft: выручка выросла на 20%').signal,1);
 assert.equal(read('Microsoft: выручка снизилась на 20%').signal,-1);
});
test('investment banking fee declines and share slides count as financial negatives',()=>{
 const bank=read('Bank of America expects third-quarter investment banking fees to fall more than 10%; shares slide');
 assert.deepEqual(bank.assets,['BAC']);assert.equal(bank.signal,-1);assert.ok(bank.concern);
 assert.equal(read('Bank of America expects investment banking fees to fall 10%').signal,-1);
 assert.equal(read('Bank of America shares slide 3%').signal,-1);
});
test('a market slide is negative when the RSS identifies one specific catalogue issuer',()=>{
 const title='AI-linked stocks slide after tech bosses call for slowdown in reckless development';
 const result=read(title,{summary:'Advanced Micro Devices (AMD) shares slid 4%.'});
 assert.deepEqual(result.assets,['AMD']);assert.equal(result.signal,-1);
 assert.equal(read('AMD shares tumbled after the announcement').signal,-1);
 // A shared Story.signal cannot assign separate directions to several issuers.
 const mixed=read(title,{summary:'Nvidia shares fell 3.3% while Advanced Micro Devices (AMD) slid 4%.'});
 assert.deepEqual(mixed.assets,['NVDA','AMD']);assert.equal(mixed.signal,0);
});
test('Meta One launch belongs to Meta and only yields the cautious product-launch rationale',()=>{
 const result=read('Introducing Meta One: A Subscription Service With More Features and AI to Create, Connect, and Stand Out',{summary:"We're introducing Meta One, a new subscription service on Facebook, Instagram, WhatsApp, and Meta AI.",publisher:'Meta',sourceKind:'Компания'});
 assert.deepEqual(result.assets,['META']);assert.equal(result.signal,1);
 assert.match(result.catalyst,/Коммерческий спрос и вклад в прибыль пока не подтверждены/);
});
