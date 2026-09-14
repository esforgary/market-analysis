import {fetchNews} from '@/lib/news';
export const dynamic='force-dynamic';
let cache:{until:number;data:Awaited<ReturnType<typeof fetchNews>>}|null=null;
export async function GET(){if(cache&&Date.now()<cache.until)return Response.json(cache.data);const data=await fetchNews();cache={until:Date.now()+(data.errors.length?30000:300000),data};return Response.json(data,{headers:{'Cache-Control':'no-store'}})}
