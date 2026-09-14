import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {collectNews} from '../lib/news.ts';
import {enrichRussian} from './translate-news.mjs';
const target=new URL('../public/data/news.json',import.meta.url);
const cacheFile=new URL('../.news-cache.json',import.meta.url);
let previous={};try{previous=JSON.parse(await readFile(cacheFile,'utf8'))}catch{}
const {snapshot,cache}=await collectNews(previous);
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
if(!snapshot.news.length){try{const old=JSON.parse(await readFile(target,'utf8'));snapshot.news=old.news||[];snapshot.errors.push('Сохранён предыдущий снимок новостей: свежие данные не получены.')}catch{}}
try{await enrichRussian(snapshot)}catch(error){console.warn('Russian translation unavailable:',error.message)}
await writeFile(target,JSON.stringify(snapshot));
const observed=new Map(snapshot.news.filter(n=>n.firstSeenAt).map(n=>[n.url,n.firstSeenAt]));
for(const feed of Object.values(cache))for(const n of feed.news)if(observed.has(n.url))n.firstSeenAt=observed.get(n.url);
await writeFile(cacheFile,JSON.stringify(cache));
console.log(`News: ${snapshot.news.length} articles, ${snapshot.availableCount}/${snapshot.sourceCount} feeds responded, ${snapshot.publisherCount} publishers; checked ${snapshot.fetchedAt}`);
