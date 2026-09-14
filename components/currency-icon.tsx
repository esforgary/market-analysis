"use client";
import {useId} from 'react';

const symbols:Record<string,string>={
 USD:'$',EUR:'€',GBP:'£',JPY:'¥',CNY:'¥',CHF:'Fr',CAD:'C$',AUD:'A$',NZD:'NZ$',
 HKD:'HK$',SGD:'S$',KRW:'₩',INR:'₹',TWD:'NT$',BRL:'R$',MXN:'MX$',ZAR:'R',
 SEK:'kr',NOK:'kr',DKK:'kr',PLN:'zł',CZK:'Kč',HUF:'Ft',TRY:'₺',ILS:'₪',
 RUB:'₽',BYN:'Br',KZT:'₸',UAH:'₴',GEL:'₾',AMD:'֏',THB:'฿',IDR:'Rp',
 MYR:'RM',PHP:'₱',VND:'₫',EGP:'E£',
};
export default function CurrencyIcon({code}:{code:string}){
 const gradientId=`currency-${useId().replace(/:/g,'')}`;
 const symbol=symbols[code]||code;
 return <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true" focusable="false">
  <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stopColor="#25d5c5"/><stop offset=".5" stopColor="#6883e8"/><stop offset="1" stopColor="#a557ed"/>
  </linearGradient></defs>
  <circle cx="20" cy="20" r="19" fill={`url(#${gradientId})`} fillOpacity=".12"/>
  <circle cx="20" cy="20" r="18.5" fill="none" stroke={`url(#${gradientId})`} strokeOpacity=".45"/>
  <path d="M8.5 15.5a12.5 12.5 0 0 1 12-8M31.5 24.5a12.5 12.5 0 0 1-12 8" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.3" strokeLinecap="round"/>
  <text x="20" y="20.5" dominantBaseline="central" textAnchor="middle" fill="currentColor" fontFamily="Inter, Segoe UI, Arial, sans-serif" fontWeight="600" fontSize={symbol.length>2?11:symbol.length>1?14:22}>{symbol}</text>
 </svg>;
}
