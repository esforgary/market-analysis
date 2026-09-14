import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
export const MODEL='DeepL API';
export const REVISION='deepl-rss-ru-v1';
export function translationHash(story){return createHash('sha256').update(JSON.stringify([MODEL,REVISION,story.title,story.summary])).digest('hex')}
function numbers(text){return [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map(m=>m[0].replaceAll(',','.')).sort().join('|')}
export function validTranslation(original,translated){return typeof translated==='string'&&translated.trim().length>0&&/[А-Яа-яЁё]/.test(translated)&&numbers(original)===numbers(translated)}
export async function enrichRussian(snapshot,{maxItems=Number(process.env.TRANSLATION_MAX_ITEMS||40),budgetMs=Number(process.env.TRANSLATION_BUDGET_MS||90000)}={}){
 const cacheFile=new URL('../.translation-cache.json',import.meta.url);let cache={};const seen=new Map();try{cache=JSON.parse(await readFile(cacheFile,'utf8'))}catch{}
 try{const seed=JSON.parse(await readFile(new URL('../public/data/news.json',import.meta.url),'utf8'));for(const n of seed.news||[]){if(n.firstSeenAt)seen.set(n.url,n.firstSeenAt);if(n.ru?.hash===translationHash(n))cache[n.ru.hash]=n.ru}}catch{}
 // Reuse translations from the last deployment, including those produced after the hourly cache was saved.
 try{const response=await fetch('https://esforgary.github.io/market-analysis/data/news.json',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});if(response.ok){const previous=await response.json();for(const n of previous.news||[]){if(n.firstSeenAt&&Number.isFinite(Date.parse(n.firstSeenAt)))seen.set(n.url,n.firstSeenAt);if(n.ru?.hash===translationHash(n))cache[n.ru.hash]=n.ru}}}catch{}
 for(const n of snapshot.news){if(seen.has(n.url))n.firstSeenAt=seen.get(n.url);const hash=translationHash(n);if(n.ru?.hash===hash)cache[hash]=n.ru;if(cache[hash]){n.ru=cache[hash];n.translationStatus='ready'}else{delete n.ru;n.translationStatus='pending'}}
 const apiKey=process.env.DEEPL_AUTH_KEY?.trim();if(!apiKey){for(const n of snapshot.news)if(!n.ru)n.translationStatus='unconfigured';snapshot.translation={provider:'DeepL API',configured:false,ready:snapshot.news.filter(n=>n.ru).length,total:snapshot.news.length};return}
 const pending=snapshot.news.filter(n=>!n.ru).slice(0,maxItems);if(!pending.length)return;
 let done=0;const start=Date.now();
 try{
 for(const story of pending){if(Date.now()-start>=budgetMs)break;
 try{const texts=story.summary===story.title?[story.title]:[story.title,story.summary];const translated=await translateTexts(texts,apiKey,story.summary);
 if(!texts.every((text,i)=>validTranslation(text,translated[i])))throw Error('Translation changed a number or returned invalid text');
 story.ru={title:translated[0],summary:translated[1]||translated[0],hash:translationHash(story),model:MODEL,translatedAt:new Date().toISOString()};cache[story.ru.hash]=story.ru;story.translationStatus='ready';done++;
 }catch(error){story.translationStatus='failed';if([401,403,429,456].includes(error.status))break}
 if(done>0&&done%5===0){await writeFile(cacheFile,JSON.stringify(cache));console.log('Russian briefs prepared:',done)}
 }
 }finally{const hashes=new Set(snapshot.news.map(translationHash));cache=Object.fromEntries(Object.entries(cache).filter(([hash])=>hashes.has(hash)));await writeFile(cacheFile,JSON.stringify(cache));snapshot.translation={provider:'DeepL API / автоматический перевод RSS',ready:snapshot.news.filter(n=>n.ru).length,total:snapshot.news.length,pending:snapshot.news.filter(n=>n.translationStatus==='pending').length,failed:snapshot.news.filter(n=>n.translationStatus==='failed').length};console.log('Russian briefs:',JSON.stringify(snapshot.translation))}
}

export async function translateTexts(texts,key,context='',fetcher=fetch){
 const host=key.endsWith(':fx')?'api-free.deepl.com':'api.deepl.com';const response=await fetcher('https://'+host+'/v2/translate',{method:'POST',headers:{Authorization:'DeepL-Auth-Key '+key,'Content-Type':'application/json'},body:JSON.stringify({text:texts,source_lang:'EN',target_lang:'RU',context,preserve_formatting:true}),signal:AbortSignal.timeout(15000)});if(!response.ok){const error=new Error('Translation HTTP '+response.status);error.status=response.status;throw error}const body=await response.json();if(!Array.isArray(body.translations)||body.translations.length!==texts.length)throw Error('Invalid translation response');return body.translations.map(part=>typeof part.text==='string'?part.text.trim():'');
}
