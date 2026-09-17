import assert from 'node:assert/strict';import test from 'node:test';import vm from 'node:vm';import fs from 'node:fs';
const code=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const scope='https://esforgary.github.io/market-analysis/';
function worker(windows=[]){
 const handlers={},notifications=[],opened=[],waits=[];
 const self={registration:{scope,showNotification:async(...args)=>{notifications.push(args)}},clients:{claim:async()=>{},matchAll:async()=>windows,openWindow:async(url)=>{opened.push(url);return null}},skipWaiting:()=>{},addEventListener:(name,fn)=>{handlers[name]=fn}};
 vm.runInNewContext(code,{self,URL});
 return {notifications,opened,async push(data){waits.length=0;handlers.push({data,waitUntil:promise=>waits.push(promise)});await Promise.all(waits)},async click(url){let closed=false;waits.length=0;handlers.notificationclick({notification:{data:{url},close(){closed=true}},waitUntil:promise=>waits.push(promise)});await Promise.all(waits);return closed}};
}
test('malformed push never displays a notification',async()=>{
 const sw=worker();
 for(const value of [null,{json(){throw Error('Invalid JSON')}},{json:()=>null},{json:()=>({title:'Title'})},{json:()=>({title:42,body:'Body'})}])await sw.push(value);
 assert.equal(sw.notifications.length,0);
});
test('valid push caps text, uses scoped icons and preserves an app deep link',async()=>{
 const sw=worker();await sw.push({json:()=>({title:'a'.repeat(150),body:'b'.repeat(500),tag:'c'.repeat(150),url:scope+'?asset=NASDAQ%3AAAPL'})});
 const [title,options]=sw.notifications[0];assert.equal(title.length,100);assert.equal(options.body.length,350);assert.equal(options.tag.length,100);assert.equal(options.data.url,scope+'?asset=NASDAQ%3AAAPL');assert.equal(options.icon,scope+'icons/icon-192.png');
});
test('push and notification clicks reject external, javascript and sibling-app URLs',async()=>{
 for(const url of ['https://evil.example/','//evil.example/market-analysis/','javascript:alert(1)','https://esforgary.github.io/other-app/?asset=X']){
  const sw=worker();await sw.push({json:()=>({title:'Market',body:'Update',url})});assert.equal(sw.notifications[0][1].data.url,scope);assert.equal(await sw.click(url),true);assert.deepEqual(sw.opened,[scope]);
 }
});
test('click reuses and focuses only an existing app window',async()=>{
 const actions=[];const original={url:scope+'?asset=NASDAQ%3AMSFT',navigate:async url=>{actions.push(['navigate',url]);return{focus:async()=>{actions.push(['focus'])}}},focus:async()=>actions.push(['old-focus'])};
 const sw=worker([{url:'https://esforgary.github.io/other-app/',navigate(){throw Error('Must not navigate a sibling app')}},original]);
 await sw.click(scope+'?asset=NASDAQ%3AAAPL');assert.deepEqual(actions,[['navigate',scope+'?asset=NASDAQ%3AAAPL'],['focus']]);assert.deepEqual(sw.opened,[]);
});
test('null navigation result still focuses the reusable window',async()=>{
 let focused=false;const sw=worker([{url:scope,navigate:async()=>null,focus:async()=>{focused=true}}]);await sw.click(scope);assert.equal(focused,true);assert.deepEqual(sw.opened,[]);
});
test('credential-bearing URLs are rejected even when origin matches',async()=>{
 const sw=worker();const url='https://user:password@esforgary.github.io/market-analysis/?asset=AAPL';
 await sw.push({json:()=>({title:'Market',body:'Update',url})});assert.equal(sw.notifications[0][1].data.url,scope);
});
