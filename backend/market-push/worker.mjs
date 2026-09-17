import {validateAlertFeed,ALERT_MAX_AGE_MS} from '../../lib/market-alerts.ts';
import {SITE,FEED_URL,sha256,allowedOrigin,configured,validateSubscription,limitedJson,payloadFor,sendPush} from './security.mjs';
const DAY=86400000;
const failure=(message,status=400)=>Object.assign(Error(message),{status});
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const first=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const all=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
const getState=async(db,key)=>(await first(db,'SELECT value FROM state WHERE key=?',key))?.value||null;
const putState=(db,key,value)=>run(db,'INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,String(value));
async function rate(db,key,limit,windowMs,now){
 const bucket=Math.floor(now/windowMs),id=key+':'+bucket;
 const result=await first(db,'INSERT INTO limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',id,now+windowMs);
 if(result.count>limit)throw failure('Слишком много запросов. Попробуйте позже.',429);
}
async function authenticate(request,env,now){
 const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)?.[1];
 if(!token)throw failure('Сначала подключите устройство',401);
 const device=await first(env.DB,'SELECT * FROM devices WHERE token_hash=? AND expires_at>?',await sha256(token),now);
 if(!device)throw failure('Устройство не подключено или доступ истёк',401);
 return device;
}
function json(data,status=200,origin=null){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin}:{})}})}
export async function handleRequest(request,env,{now=Date.now(),push=sendPush}={}){
 const origin=request.headers.get('Origin');
 if(!allowedOrigin(request,env))return json({error:'Origin не разрешён'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
 try{
  const path=new URL(request.url).pathname;
  if(path==='/v1/config'&&request.method==='GET')return json({enabled:configured(env),vapidPublicKey:configured(env)?env.VAPID_PUBLIC_KEY:null,scope:'catalog'},200,origin);
  if(!configured(env))throw failure('Сервер уведомлений ещё не настроен',503);
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  await rate(env.DB,'api:'+await sha256(ip),60,60000,now);
  if(path==='/v1/pair'&&request.method==='POST'){
   await rate(env.DB,'pair:'+await sha256(ip),5,60000,now);
   await rate(env.DB,'pair:global',30,3600000,now);
   const supplied=request.headers.get('Authorization')?.slice(0,250)||'';
   if(await sha256(supplied)!==await sha256('Bearer '+env.PAIRING_SECRET))throw failure('Неверный код подключения',401);
   const input=await limitedJson(request),label=typeof input.label==='string'?input.label.replace(/[\u0000-\u001f]/g,'').trim().slice(0,60):'Моё устройство';
   const deviceId=crypto.randomUUID(),deviceToken=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
   // INSERT...SELECT makes the personal-device cap atomic across concurrent pairing.
   const result=await run(env.DB,'INSERT INTO devices(id,token_hash,label,created_at,expires_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM devices WHERE expires_at>?)<10',deviceId,await sha256(deviceToken),label||'Моё устройство',now,now+365*DAY,now);
   if(!result.meta.changes)throw failure('Лимит: 10 устройств. Удалите старое подключение.',409);
   return json({deviceId,deviceToken},201,origin);
  }
  const device=await authenticate(request,env,now);
  await rate(env.DB,'device:'+device.id,60,60000,now);
  if(path==='/v1/subscription'&&request.method==='PUT'){
   const input=await limitedJson(request),subscription=validateSubscription(input.subscription,now);
   await run(env.DB,'UPDATE devices SET endpoint=NULL,p256dh=NULL,auth=NULL,subscribed_at=NULL WHERE endpoint=? AND expires_at<=?',subscription.endpoint,now);
   const occupied=await first(env.DB,'SELECT id FROM devices WHERE endpoint=? AND id<>?',subscription.endpoint,device.id);
   if(occupied)throw failure('Подписка уже принадлежит другому подключению',409);
   await run(env.DB,'UPDATE devices SET endpoint=?,p256dh=?,auth=?,subscribed_at=CASE WHEN endpoint=? THEN subscribed_at ELSE ? END WHERE id=?',subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth,subscription.endpoint,now,device.id);
   return json({subscribed:true,scope:'catalog'},200,origin);
  }
  if(path==='/v1/subscription'&&request.method==='DELETE'){
   await env.DB.batch([env.DB.prepare('UPDATE devices SET endpoint=NULL,p256dh=NULL,auth=NULL,subscribed_at=NULL WHERE id=?').bind(device.id),env.DB.prepare('DELETE FROM deliveries WHERE device_id=?').bind(device.id)]);
   return json({subscribed:false,scope:'catalog'},200,origin);
  }
  if(path==='/v1/device'&&request.method==='DELETE'){
   await env.DB.batch([env.DB.prepare('DELETE FROM deliveries WHERE device_id=?').bind(device.id),env.DB.prepare('DELETE FROM devices WHERE id=?').bind(device.id)]);
   return json({deleted:true},200,origin);
  }
  if(path==='/v1/status'&&request.method==='GET')return json({subscribed:!!device.endpoint,scope:'catalog',lastCheckedAt:await getState(env.DB,'lastCheckedAt'),sourceFetchedAt:await getState(env.DB,'sourceFetchedAt'),lastAlertAt:device.last_alert_at?new Date(device.last_alert_at).toISOString():null,error:await getState(env.DB,'lastError')},200,origin);
  if(path==='/v1/test'&&request.method==='POST'){
   await rate(env.DB,'test:'+device.id,1,60000,now);
   if(!device.endpoint)throw failure('Сначала разрешите и сохраните подписку',409);
   const response=await push(env,{endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},{title:'Meridian · проверка уведомлений',body:'Это тест доставки. Важные события по всему каталогу будут приходить сюда.',url:SITE,tag:'meridian-test',sourceUrl:SITE,assetId:null,publishedAt:new Date(now).toISOString(),eventId:'test'});
   if(response.expired){await run(env.DB,'UPDATE devices SET endpoint=NULL,p256dh=NULL,auth=NULL,subscribed_at=NULL WHERE id=?',device.id);throw failure('Подписка истекла. Подключите уведомления снова.',410)}
   if(!response.accepted)throw failure('Push-сервис не принял уведомление (HTTP '+response.status+')',502);
   return json({sent:true},200,origin);
  }
  throw failure('Неизвестный маршрут',404);
 }catch(error){return json({error:error.status?error.message:'Ошибка сервера уведомлений'},error.status||500,origin)}
}
export async function runScheduled(env,{now=Date.now(),fetcher=fetch,push=sendPush}={}){
 if(!configured(env))return {configured:false};
 const owner=crypto.randomUUID();
 const lock=await first(env.DB,"INSERT INTO locks(key,owner,expires_at) VALUES('cron',?,?) ON CONFLICT(key) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE locks.expires_at<? RETURNING owner",owner,now+240000,now);
 if(lock?.owner!==owner)return {locked:true};
 let accepted=0;
 try{
  await putState(env.DB,'lastCheckedAt',new Date(now).toISOString());
  const response=await fetcher(FEED_URL,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-cache'});
  if(!response.ok)throw Error('Снимок событий: HTTP '+response.status);
  const feed=validateAlertFeed(await limitedJson(response,512000),now);
  await putState(env.DB,'sourceFetchedAt',feed.fetchedAt);
  const initialized=await getState(env.DB,'initializedAt');
  const rows=[];
  for(const alert of feed.alerts){const payload=await payloadFor(alert);rows.push({id:payload.eventId,ticker:alert.ticker,payload:JSON.stringify(payload),observed:Date.parse(alert.observedAt),published:Date.parse(alert.publishedAt)})}
  // Bulk JSON inserts keep D1 calls bounded even when many headlines arrive at once.
  // Queries on Workers Free are limited to 50 per invocation.
  const insertEvents=env.DB.prepare("INSERT OR IGNORE INTO events(id,ticker,payload,observed_at,published_at,created_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.ticker'),json_extract(value,'$.payload'),json_extract(value,'$.observed'),json_extract(value,'$.published'),? FROM json_each(?)").bind(now,JSON.stringify(rows));
  // Event persistence and delivery enqueueing must commit together. On a transient
  // queue failure D1 rolls back both, so the next cron can safely try the feed again.
  if(initialized){
   const enqueue=env.DB.prepare("INSERT OR IGNORE INTO deliveries(event_id,device_id,status,next_attempt,updated_at) SELECT e.id,v.id,'pending',?,? FROM events e CROSS JOIN devices v WHERE e.id IN (SELECT value FROM json_each(?)) AND e.created_at>? AND e.observed_at>=v.subscribed_at AND e.published_at>=v.subscribed_at AND v.endpoint IS NOT NULL AND v.expires_at>?").bind(now,now,JSON.stringify(rows.map(row=>row.id)),Date.parse(initialized),now);
   await env.DB.batch([insertEvents,enqueue]);
  }else{
   // A later cron must never backfill the first observed batch of historical events.
   const baseline=env.DB.prepare("INSERT INTO state(key,value) VALUES('initializedAt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(new Date(now).toISOString());
   await env.DB.batch([insertEvents,baseline]);
  }
  // Five sends per invocation bound both cryptographic work and D1 queries.
  const pending=await all(env.DB,"SELECT d.*,e.ticker,e.payload,e.created_at,e.observed_at,e.published_at,v.endpoint,v.p256dh,v.auth FROM deliveries d JOIN events e ON e.id=d.event_id JOIN devices v ON v.id=d.device_id WHERE d.status IN ('pending','retry') AND d.next_attempt<=? AND v.endpoint IS NOT NULL AND v.expires_at>? ORDER BY e.created_at LIMIT 5",now,now);
  for(const item of pending){
   if(now-item.observed_at>ALERT_MAX_AGE_MS||now-item.published_at>ALERT_MAX_AGE_MS){await run(env.DB,"UPDATE deliveries SET status='expired',updated_at=? WHERE event_id=? AND device_id=?",now,item.event_id,item.device_id);continue}
   const counts=await first(env.DB,"SELECT COUNT(*) AS day, SUM(CASE WHEN d.updated_at>? THEN 1 ELSE 0 END) AS recent, SUM(CASE WHEN e.ticker=? AND d.updated_at>? THEN 1 ELSE 0 END) AS sameAsset FROM deliveries d JOIN events e ON e.id=d.event_id WHERE d.device_id=? AND d.status='sent' AND d.updated_at>?",now-300000,item.ticker,now-4*3600000,item.device_id,now-DAY);
   if(counts.day>=8||counts.recent>=3||counts.sameAsset>=1){await run(env.DB,"UPDATE deliveries SET status='suppressed',updated_at=? WHERE event_id=? AND device_id=?",now,item.event_id,item.device_id);continue}
   await run(env.DB,"UPDATE deliveries SET status='sending',attempts=attempts+1,updated_at=? WHERE event_id=? AND device_id=?",now,item.event_id,item.device_id);
   let result;try{result=await push(env,{endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},JSON.parse(item.payload))}catch{
    // A timeout may follow successful delivery. Don't send a duplicate on uncertainty.
    await run(env.DB,"UPDATE deliveries SET status='uncertain',updated_at=? WHERE event_id=? AND device_id=?",now,item.event_id,item.device_id);continue;
   }
   if(result.expired)await run(env.DB,'UPDATE devices SET endpoint=NULL,p256dh=NULL,auth=NULL,subscribed_at=NULL WHERE id=?',item.device_id);
   const status=result.accepted?'sent':result.expired?'expired':result.retry&&item.attempts<2?'retry':'failed';
   await run(env.DB,'UPDATE deliveries SET status=?,next_attempt=?,updated_at=? WHERE event_id=? AND device_id=?',status,now+(item.attempts+1)*600000,now,item.event_id,item.device_id);
   if(result.accepted){accepted++;await run(env.DB,'UPDATE devices SET last_alert_at=? WHERE id=?',now,item.device_id)}
  }
  await putState(env.DB,'lastError','');
  await env.DB.batch([
   env.DB.prepare('DELETE FROM deliveries WHERE event_id IN (SELECT id FROM events WHERE created_at<?) OR device_id IN (SELECT id FROM devices WHERE expires_at<?)').bind(now-30*DAY,now),
   env.DB.prepare('DELETE FROM events WHERE created_at<?').bind(now-30*DAY),
   env.DB.prepare('DELETE FROM devices WHERE expires_at<?').bind(now),
   env.DB.prepare('DELETE FROM limits WHERE expires_at<?').bind(now),
  ]);
  return {accepted,baseline:!initialized,candidates:feed.alerts.length};
 }catch(error){await putState(env.DB,'lastError',String(error.message).slice(0,200));return {error:String(error.message).slice(0,200)}}
 finally{await run(env.DB,"DELETE FROM locks WHERE key='cron' AND owner=?",owner)}
}
export default {fetch:handleRequest,async scheduled(_controller,env,ctx){ctx.waitUntil(runScheduled(env))}};
