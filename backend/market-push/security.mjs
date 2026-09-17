import webpush from 'web-push';
export const SITE = 'https://esforgary.github.io/market-analysis/';
export const FEED_URL = SITE + 'data/market-alerts.json';
export const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
export function allowedOrigin(request,env){
 const origin=request.headers.get('Origin');
 return origin==='https://esforgary.github.io'||(env.ALLOW_LOCAL_DEV==='true'&&['http://localhost:5174','http://127.0.0.1:5174'].includes(origin));
}
export function validEndpoint(value){
 try{
  const u=new URL(value);
  if(typeof value!=='string'||value.length>2048||u.protocol!=='https:'||u.username||u.password||u.hash||u.port)return false;
  return (u.hostname==='fcm.googleapis.com'&&/^\/(?:fcm\/send|wp)\/[^/]+/.test(u.pathname))||
   (u.hostname==='updates.push.services.mozilla.com'&&/^\/wpush\/v[12]\//.test(u.pathname))||
   (/^(?:[a-z0-9-]+\.)*push\.apple\.com$/.test(u.hostname)&&u.pathname.length>1)||
   (/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname)&&u.pathname==='/w/');
 }catch{return false}
}
function decoded(value,size){if(typeof value!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(value))return null;try{const bytes=Buffer.from(value,'base64url');return bytes.length===size?bytes:null}catch{return null}}
export function validateSubscription(value,now=Date.now()){
 if(!value||!validEndpoint(value.endpoint))throw Object.assign(Error('Неподдерживаемый адрес push-сервиса'),{status:400});
 const key=decoded(value.keys?.p256dh,65),auth=decoded(value.keys?.auth,16);
 if(!key||key[0]!==4||!auth)throw Object.assign(Error('Некорректные ключи подписки'),{status:400});
 if(value.expirationTime!=null&&(!Number.isFinite(value.expirationTime)||value.expirationTime<=now))throw Object.assign(Error('Подписка истекла'),{status:400});
 return {endpoint:value.endpoint,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
function validSubject(value){if(/^mailto:[^\s@]+@[^\s@]+$/.test(value||''))return true;try{const url=new URL(value);return url.protocol==='https:'&&url.hostname!=='localhost'&&!url.username&&!url.password}catch{return false}}
export function configured(env){return !!(env.DB&&decoded(env.VAPID_PUBLIC_KEY,65)?.[0]===4&&decoded(env.VAPID_PRIVATE_KEY,32)&&typeof env.PAIRING_SECRET==='string'&&env.PAIRING_SECRET.length>=32&&validSubject(env.VAPID_SUBJECT))}
export async function payloadFor(alert){const digest=await sha256(alert.id);return {title:alert.title,body:alert.body,url:SITE+'?asset='+encodeURIComponent(alert.symbol),tag:'meridian-'+digest.slice(0,24),sourceUrl:alert.sourceUrl,assetId:alert.symbol,publishedAt:alert.publishedAt,eventId:digest}}
/** Encrypt/sign with maintained web-push; fetch refuses redirects, so the endpoint
 * allowlist remains true at the actual network boundary. No client-selected headers.
 */
export async function sendPush(env,subscription,payload,fetcher=fetch){
 validateSubscription(subscription);
 const serialized=JSON.stringify(payload);
 if(Buffer.byteLength(serialized)>3000)throw Error('Push payload exceeds limit');
 const request=webpush.generateRequestDetails(subscription,serialized,{TTL:1800,urgency:'normal',contentEncoding:'aes128gcm',vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
 const response=await fetcher(request.endpoint,{method:'POST',headers:request.headers,body:new Uint8Array(request.body),redirect:'error',signal:AbortSignal.timeout(8000)});
 await response.body?.cancel();
 return {status:response.status,accepted:response.ok,expired:response.status===404||response.status===410,retry:response.status===429||response.status>=500};
}
export async function limitedJson(request,maxBytes=6000){
 if(!/application\/json/i.test(request.headers.get('content-type')||''))throw Object.assign(Error('Ожидается JSON'),{status:415});
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('Пустой запрос'),{status:400});
 let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Object.assign(Error('Слишком большой запрос'),{status:413})}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw Object.assign(Error('Некорректный JSON'),{status:400})}
}
