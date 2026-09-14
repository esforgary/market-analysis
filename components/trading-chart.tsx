"use client";
import {useEffect,useMemo,useState} from 'react';
const intervals=[['1','1 мин'],['5','5 мин'],['15','15 мин'],['30','30 мин'],['60','1 час'],['240','4 часа'],['D','День'],['W','Неделя'],['M','Месяц']];
export default function TradingChart({symbol,theme}:{symbol:string;theme:'light'|'dark'}){
 const [interval,setInterval]=useState('D'),[slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer)},[symbol,theme,interval]);
 const src=useMemo(()=>{const config={autosize:true,width:'100%',height:'100%',symbol,interval,timezone:'Etc/UTC',theme,style:'1',locale:'ru',allow_symbol_change:false,hide_side_toolbar:false,hide_volume:false,withdateranges:true,support_host:'https://www.tradingview.com'};return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=ru#${encodeURIComponent(JSON.stringify(config))}`},[symbol,theme,interval]);
 return <div className="trading-wrap"><div className="chart-controls"><span>Интервал свечи</span><div className="periods">{intervals.map(([value,label])=><button key={value} aria-pressed={interval===value} onClick={()=>setInterval(value)}>{label}</button>)}</div></div><iframe key={src} src={src} title={`Биржевой график ${symbol} — TradingView`} className="trading-chart" frameBorder="0" allowFullScreen referrerPolicy="origin"/>{slow&&<p className="panel-footnote">Если график не появился, источник недоступен в вашем браузере. Откройте его по ссылке ниже.</p>}<div className="chart-attribution"><a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer">Открыть {symbol} в TradingView ↗</a><span>Период: день, 5 дней, месяц, 3/6 месяцев, YTD, год, 5 лет, всё время — внизу графика. Поток обновляется источником; возможна задержка биржи.</span></div></div>
}

