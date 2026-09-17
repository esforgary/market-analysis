import webpush from 'web-push';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const keys=webpush.generateVAPIDKeys();
const target=new URL('./secrets.local.json',import.meta.url);
await writeFile(target,JSON.stringify({VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,VAPID_SUBJECT:'https://github.com/esforgary/market-analysis',PAIRING_SECRET:randomBytes(32).toString('base64url')},null,2),{flag:'wx',mode:0o600});
console.log('Created backend/market-push/secrets.local.json (gitignored). No secrets printed. Keep this file private and backed up.');
