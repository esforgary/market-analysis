import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fetchNews} from '../lib/news.ts';
const target=new URL('../public/data/news.json',import.meta.url);
const data=await fetchNews();
if(!data.news.length){try{const previous=JSON.parse(await readFile(target,'utf8'));if(previous.news?.length){previous.errors=[...data.errors,'Сохранён предыдущий снимок: обновление источников не удалось.'];await writeFile(target,JSON.stringify(previous));console.warn('Keeping previous news snapshot');process.exit(0)}}catch{} }
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await writeFile(target,JSON.stringify(data));
console.log(`News snapshot: ${data.news.length} stories, ${data.errors.length} errors, ${data.fetchedAt}`);
