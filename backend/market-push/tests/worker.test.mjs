import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {createECDH,randomBytes} from 'node:crypto';
import {database} from './database.mjs';
import {handleRequest,runScheduled} from '../worker.mjs';
import {validEndpoint,validateSubscription,sendPush,sha256,FEED_URL} from '../security.mjs';
import {selectMarketAlerts} from '../../../lib/market-alerts.ts';
import {sources} from '../../../lib/news-sources.ts';
const now=Date.parse('2026-09-17T12:00:00Z');
const vapid=webpush.generateVAPIDKeys(); // Ephemeral test keys only; never written to files.
function environment(){return {DB:database(),VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,VAPID_SUBJECT:'mailto:test@example.com',PAIRING_SECRET:'test-only-pairing-code-32-characters',ALLOW_LOCAL_DEV:'false'}}
function request(path,method='GET',body,token){return new Request('https://example.workers.dev'+path,{method,headers:{Origin:'https://esforgary.github.io','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})})}
function subscription(){const key=createECDH('prime256v1');key.generateKeys();return {endpoint:'https://fcm.googleapis.com/fcm/send/test-token',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}}}
async function pair(env,time=now){const response=await handleRequest(request('/v1/pair','POST',{label:'Test'},env.PAIRING_SECRET),env,{now:time});assert.equal(response.status,201);return response.json()}
async function subscribe(env,time=now){const credentials=await pair(env,time),sub=subscription();const response=await handleRequest(request('/v1/subscription','PUT',{subscription:sub},credentials.deviceToken),env,{now:time});assert.equal(response.status,200);return credentials}
function feed(time,offset=1000){const source=sources.find(s=>s.publisher==='AMD'&&s.kind==='Компания');const iso=delta=>new Date(time-delta).toISOString();return {version:1,fetchedAt:iso(100),alerts:selectMarketAlerts({fetchedAt:iso(100),sourceHealth:[{id:source.id,status:'ok',checkedAt:iso(100)}],news:[{title:'AMD declares quarterly cash dividend of $0.30 per share',summary:'AMD declared a quarterly cash dividend of $0.30 per share.',sourceId:source.id,url:'https://ir.amd.com/news-events/press-releases/detail/'+offset+'/dividend',date:iso(offset),firstSeenAt:iso(1000),category:'Дивиденды'}]},time)}}
const fetchFeed=data=>async url=>{assert.equal(url,FEED_URL);return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})};
test('endpoint validation rejects SSRF, credentials, redirect hosts and invalid subscription keys',()=>{
 for(const endpoint of ['http://fcm.googleapis.com/fcm/send/a','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/fcm/send/a','https://user:pass@web.push.apple.com/x','https://fcm.googleapis.com:444/fcm/send/a','https://push.apple.com.evil.test/x'])assert.equal(validEndpoint(endpoint),false,endpoint);
 for(const endpoint of ['https://fcm.googleapis.com/fcm/send/abc','https://updates.push.services.mozilla.com/wpush/v2/abc','https://web.push.apple.com/abc','https://wns2-am3p.notify.windows.com/w/?token=abc'])assert.equal(validEndpoint(endpoint),true,endpoint);
 assert.throws(()=>validateSubscription({...subscription(),keys:{p256dh:'abc',auth:'abc'}}));
});
test('server fails closed without secrets; CORS only exact known origins',async()=>{
 let response=await handleRequest(request('/v1/config'),{});assert.equal((await response.json()).enabled,false);
 response=await handleRequest(new Request('https://example.test/v1/config',{headers:{Origin:'https://evil.example'}}),{});assert.equal(response.status,403);
});
test('pairing is authenticated/rate limited and only a hash of device token is stored',async()=>{
 const env=environment();const response=await handleRequest(request('/v1/pair','POST',{},'wrong'),env,{now});assert.equal(response.status,401);
 const credentials=await pair(env);const row=await env.DB.prepare('SELECT * FROM devices').first();assert.equal(row.token_hash,await sha256(credentials.deviceToken));assert.notEqual(row.token_hash,credentials.deviceToken);
 for(let i=0;i<3;i++)await handleRequest(request('/v1/pair','POST',{},'wrong'),env,{now});
 assert.equal((await handleRequest(request('/v1/pair','POST',{},'wrong'),env,{now})).status,429);env.DB.close();
});
test('subscription is private, bounded and removable; test 410 invalidates subscription',async()=>{
 const env=environment(),device=await subscribe(env);
 assert.equal((await handleRequest(request('/v1/status'),env,{now})).status,401);
 const result=await handleRequest(request('/v1/test','POST',null,device.deviceToken),env,{now,push:async()=>({expired:true,status:410})});assert.equal(result.status,410);
 const status=await handleRequest(request('/v1/status','GET',null,device.deviceToken),env,{now});assert.equal((await status.json()).subscribed,false);
 const deletion=await handleRequest(request('/v1/device','DELETE',null,device.deviceToken),env,{now});assert.equal(deletion.status,200);assert.equal(await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first().then(r=>r.n),0);env.DB.close();
});
test('cold start creates baseline without backlog; later event is delivered once across cron runs',async()=>{
 const env=environment();await subscribe(env,now-60000);let sent=0;const push=async(_env,_sub,payload)=>{sent++;assert.match(payload.url,/asset=NASDAQ%3AAMD/);return {accepted:true,status:201}};
 const first=await runScheduled(env,{now,fetcher:fetchFeed(feed(now,1000)),push});assert.equal(first.baseline,true);assert.equal(sent,0);
 const later=now+300000,updates=feed(later,2000);
 assert.equal((await runScheduled(env,{now:later,fetcher:fetchFeed(updates),push})).accepted,1);assert.equal(sent,1);
 assert.equal((await runScheduled(env,{now:later+1000,fetcher:fetchFeed(updates),push})).accepted,0);assert.equal(sent,1);env.DB.close();
});
test('stale feed, offline uncertainty and revoked endpoints never fabricate delivery success',async()=>{
 const env=environment();await subscribe(env,now-60000);await runScheduled(env,{now,fetcher:fetchFeed(feed(now))});
 const stale=await runScheduled(env,{now:now+3600000,fetcher:fetchFeed(feed(now)),push:async()=>assert.fail('must not send')});assert.ok(stale.error);
 const later=now+300000;await runScheduled(env,{now:later,fetcher:fetchFeed(feed(later,2000)),push:async()=>{throw Error('Timeout')}});
 assert.equal((await env.DB.prepare('SELECT status FROM deliveries').first()).status,'uncertain');
 await runScheduled(env,{now:later+1000,fetcher:fetchFeed(feed(later,2000)),push:async()=>assert.fail('ambiguous failure must not retry')});env.DB.close();
});
test('real encryption request uses VAPID, aes128gcm, bounded TTL and no redirects',async()=>{
 const env=environment(),sub=subscription();let called=false;
 const result=await sendPush(env,sub,{title:'Test',body:'Private message'},async(url,options)=>{called=true;assert.equal(url,sub.endpoint);assert.equal(options.redirect,'error');assert.equal(options.headers['Content-Encoding'],'aes128gcm');assert.match(options.headers.Authorization,/vapid/);assert.equal(String(options.headers.TTL),'1800');assert.ok(options.body.length>50);assert.equal(Buffer.from(options.body).includes(Buffer.from('Private message')),false);return new Response(null,{status:201})});
 assert.equal(result.accepted,true);assert.equal(called,true);env.DB.close();
});

test('expired device releases the old browser endpoint when owner pairs again',async()=>{
 const env=environment(),old=await subscribe(env,now-1000),row=await env.DB.prepare('SELECT * FROM devices').first();
 await env.DB.prepare('UPDATE devices SET expires_at=? WHERE id=?').bind(now-1,old.deviceId).run();
 const current=await pair(env,now),response=await handleRequest(request('/v1/subscription','PUT',{subscription:{endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}}},current.deviceToken),env,{now});
 assert.equal(response.status,200);assert.equal((await env.DB.prepare('SELECT endpoint FROM devices WHERE id=?').bind(old.deviceId).first()).endpoint,null);env.DB.close();
});

test('many simultaneous events stay below the Free D1 query cap and suppress repeat-asset noise',async()=>{
 const env=environment();await subscribe(env,now-60000);await runScheduled(env,{now,fetcher:fetchFeed(feed(now))});
 const later=now+300000,updates=feed(later,2000),base=updates.alerts[0];updates.alerts=Array.from({length:25},(_,i)=>{const sourceUrl=base.sourceUrl+'?release='+i;return {...base,sourceUrl,id:base.ticker+'|'+base.event+'|'+sourceUrl}});
 env.DB.resetCount();let calls=0;const result=await runScheduled(env,{now:later,fetcher:fetchFeed(updates),push:async()=>{calls++;return {accepted:true,status:201}}});
 assert.equal(result.error,undefined);assert.equal(calls,1);assert.ok(env.DB.queryCount<45,`D1 calls: ${env.DB.queryCount}`);
 assert.ok((await env.DB.prepare("SELECT COUNT(*) AS n FROM deliveries WHERE status='suppressed'").first()).n>0);env.DB.close();
});
test('a received retryable status is persisted and retried, unlike an uncertain network failure',async()=>{
 const env=environment();await subscribe(env,now-60000);await runScheduled(env,{now,fetcher:fetchFeed(feed(now))});
 const later=now+300000,updates=feed(later,2000);await runScheduled(env,{now:later,fetcher:fetchFeed(updates),push:async()=>({accepted:false,status:503,retry:true})});
 assert.equal((await env.DB.prepare('SELECT status FROM deliveries').first()).status,'retry');
 const result=await runScheduled(env,{now:later+600000,fetcher:fetchFeed({...updates,fetchedAt:new Date(later+600000).toISOString()}),push:async()=>({accepted:true,status:201})});assert.equal(result.accepted,1);env.DB.close();
});

test('retry expires once publication age exceeds three hours even when first observation remains recent',async()=>{
 const env=environment();await subscribe(env,now-4*3600000);await runScheduled(env,{now,fetcher:fetchFeed(feed(now))});
 const later=now+300000,updates=feed(later,179*60000);let calls=0;
 await runScheduled(env,{now:later,fetcher:fetchFeed(updates),push:async()=>{calls++;return {accepted:false,status:503,retry:true}}});
 assert.equal(calls,1);assert.equal((await env.DB.prepare('SELECT status FROM deliveries').first()).status,'retry');
 const retryTime=later+600000;
 const result=await runScheduled(env,{now:retryTime,fetcher:fetchFeed({...updates,fetchedAt:new Date(retryTime).toISOString()}),push:async()=>assert.fail('an article older than three hours must not be delivered on retry')});
 assert.equal(result.error,undefined);assert.equal(result.accepted,0);assert.equal((await env.DB.prepare('SELECT status FROM deliveries').first()).status,'expired');env.DB.close();
});

function failStatementOnce(db,match){
 const prepare=db.prepare.bind(db);let remaining=1;
 db.prepare=sql=>{
  const statement=prepare(sql);if(!match.test(sql))return statement;
  return {bind(...args){const bound=statement.bind(...args);return {...bound,async run(){if(remaining){remaining--;throw Error('Simulated transient SQL failure')}return bound.run()}}}};
 };
}
test('event and queue insert roll back together and a subsequent cron recovers delivery',async()=>{
 const env=environment();await subscribe(env,now-60000);await runScheduled(env,{now,fetcher:fetchFeed(feed(now))});
 const later=now+300000,updates=feed(later,2000);failStatementOnce(env.DB,/^INSERT OR IGNORE INTO deliveries/);
 const failed=await runScheduled(env,{now:later,fetcher:fetchFeed(updates),push:async()=>assert.fail('transaction failure must not send')});
 assert.match(failed.error,/transient/);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first()).n,1,'new event insert must also roll back');
 let sends=0;const recovered=await runScheduled(env,{now:later+1000,fetcher:fetchFeed(updates),push:async()=>{sends++;return {accepted:true,status:201}}});
 assert.equal(recovered.error,undefined);assert.equal(sends,1);assert.equal(recovered.accepted,1);env.DB.close();
});
test('baseline event insert and initialization state are atomic and never replay the baseline',async()=>{
 const env=environment();await subscribe(env,now-60000);failStatementOnce(env.DB,/^INSERT INTO state\(key,value\) VALUES\('initializedAt'/);
 const initialFeed=feed(now);const failed=await runScheduled(env,{now,fetcher:fetchFeed(initialFeed),push:async()=>assert.fail('baseline must not send')});
 assert.match(failed.error,/transient/);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first()).n,0);
 assert.equal(await env.DB.prepare("SELECT value FROM state WHERE key='initializedAt'").first(),null);
 const recovered=await runScheduled(env,{now:now+1000,fetcher:fetchFeed(initialFeed),push:async()=>assert.fail('recovered baseline must not send')});assert.equal(recovered.baseline,true);
 const replay=await runScheduled(env,{now:now+2000,fetcher:fetchFeed(initialFeed),push:async()=>assert.fail('later cron must not backfill baseline')});assert.equal(replay.accepted,0);env.DB.close();
});
