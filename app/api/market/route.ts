import {collectNews} from '@/lib/news';
import type {CollectorCache} from '@/lib/news';
export const dynamic='force-dynamic';
let cache:CollectorCache={};
let result:Awaited<ReturnType<typeof collectNews>>['snapshot']|null=null;
let until=0;
let pending:Promise<void>|null=null;
export async function GET(){
 if(Date.now()>=until){if(!pending)pending=collectNews(cache).then(next=>{cache=next.cache;result=next.snapshot;until=Date.now()+300000}).finally(()=>{pending=null});await pending}
 return Response.json(result,{headers:{'Cache-Control':'no-store'}})
}
