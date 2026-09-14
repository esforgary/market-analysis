import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {collectNews} from '../lib/news.ts';
const target=new URL('../public/data/news.json',import.meta.url);
const cacheFile=new URL('../.news-cache.json',import.meta.url);
let previous={};try{previous=JSON.parse(await readFile(cacheFile,'utf8'))}catch{}
const {snapshot,cache}=await collectNews(previous);
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
if(!snapshot.news.length){try{const old=JSON.parse(await readFile(target,'utf8'));snapshot.news=old.news||[];snapshot.errors.push('Сохранён предыдущий снимок новостей: свежие данные не получены.')}catch{}}
await writeFile(target,JSON.stringify(snapshot));
await writeFile(cacheFile,JSON.stringify(cache));
console.log(`News: ${snapshot.news.length} articles, ${snapshot.availableCount}/${snapshot.sourceCount} feeds responded, ${snapshot.publisherCount} publishers; checked ${snapshot.fetchedAt}`);
