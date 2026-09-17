import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {selectMarketAlerts} from '../../lib/market-alerts.ts';
const base=new URL('../../public/data/',import.meta.url);
const snapshot=JSON.parse(await readFile(new URL('news.json',base),'utf8'));
const alerts=selectMarketAlerts(snapshot).slice(0,200);
await mkdir(base,{recursive:true});
await writeFile(new URL('market-alerts.json',base),JSON.stringify({version:1,fetchedAt:snapshot.fetchedAt,alerts}));
console.log(`Market alerts: ${alerts.length} documented issuer events; source checked ${snapshot.fetchedAt}. No trading recommendations.`);
