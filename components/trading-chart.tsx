"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDownRight,ArrowUpRight,BarChart3,ChartCandlestick,ChartNoAxesCombined,ExternalLink,Maximize2,Minimize2} from 'lucide-react';
import SecurityPlot from './security-plot';
import {loadSecurityHistory,type SecuritySnapshot} from '@/lib/security-data';
import {securityPeriods,securityResolution,securityWindow,type SecurityPeriod} from '@/lib/security-window';
import './trading-terminal.css';
import './native-market-chart.css';

const formatPrice=(value:number)=>value.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:value<1?5:2});
function stamp(value:string|number,withDate=true){const date=new Date(typeof value==='number'?value*1000:value);return Number.isFinite(date.getTime())?date.toLocaleString('ru-RU',{timeZone:'UTC',...(withDate?{day:'2-digit',month:'short'}:{second:'2-digit'}),hour:'2-digit',minute:'2-digit'}):'—'}
export default function TradingChart({symbol,theme}:{symbol:string;theme:'light'|'dark'}){
 const [snapshot,setSnapshot]=useState<SecuritySnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[checked,setChecked]=useState('');
 const [period,setPeriod]=useState<SecurityPeriod>('1M'),[mode,setMode]=useState<'candles'|'line'>('line'),[volume,setVolume]=useState(false);
 const [expanded,setExpanded]=useState(false),[fullscreenAvailable,setFullscreenAvailable]=useState(false),[fullscreenError,setFullscreenError]=useState('');
 const terminal=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const ctrl=new AbortController();let pending=false;
  const update=async()=>{
   if(pending||ctrl.signal.aborted)return;pending=true;
   try{const next=await loadSecurityHistory(symbol,ctrl.signal);if(ctrl.signal.aborted)return;setSnapshot(previous=>previous?.symbol===next.symbol&&JSON.stringify(previous)===JSON.stringify(next)?previous:next);setChecked(new Date().toISOString());setError('')}
   catch(cause){if(!ctrl.signal.aborted)setError(cause instanceof Error?cause.message:'Не удалось загрузить котировки')}
   finally{pending=false;if(!ctrl.signal.aborted)setBusy(false)}
  };
  setSnapshot(null);setError('');setChecked('');setBusy(true);void update();
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void update()},5000);
  return()=>{ctrl.abort();clearInterval(timer)};
 },[symbol]);
 useEffect(()=>{setFullscreenAvailable(!!document.fullscreenEnabled);const sync=()=>setExpanded(document.fullscreenElement===terminal.current);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[]);
 async function toggleFullscreen(){setFullscreenError('');try{if(document.fullscreenElement===terminal.current)await document.exitFullscreen();else await terminal.current?.requestFullscreen()}catch{setFullscreenError('Полноэкранный режим недоступен в этом браузере.')}}
 const current=snapshot?.symbol===symbol?snapshot:null;
 const window=useMemo(()=>securityWindow(current,period),[current,period]);
 const points=window.points,last=points.at(-1),first=points[0],delta=last&&first?(last.close/first.close-1)*100:null,falling=delta!==null&&delta<0;
 const range=securityPeriods.find(item=>item.value===period)!;
 const sourceUrl=current?`https://finance.yahoo.com/quote/${encodeURIComponent(current.providerSymbol)}/history/`:undefined;
 const stale=!!window.fetchedAt&&Date.now()-Date.parse(window.fetchedAt)>(['daily','weekly'].includes(window.series)?8*3600000:45*60000);
 return <div className="trading-wrap trading-terminal native-market-chart" ref={terminal} data-expanded={expanded}>
  <div className="native-quote-header">
   <div><span className="native-chart-eyebrow">ДВИЖЕНИЕ ЦЕНЫ · {symbol}</span><div className="native-quote-value">{last?formatPrice(last.close):'—'}<span>{current?.currency==='GBp'?'пенсы GBP':current?.currency||''}</span></div><p className="native-observation">{last?`Бар от ${stamp(last.time)} UTC`:'Получаем историю торгов'}</p></div>
   {delta!==null&&<div className={'native-period-change '+(falling?'negative':'positive')}>{falling?<ArrowDownRight size={17}/>:<ArrowUpRight size={17}/>}<b>{delta>0?'+':''}{delta.toFixed(2)}%</b><span>за выбранный период</span></div>}
  </div>
  <div className="trading-toolbar">
   <div className="trading-view-tabs" role="group" aria-label="Вид биржевого графика"><button type="button" aria-pressed={mode==='line'} onClick={()=>setMode('line')}><ChartNoAxesCombined size={16}/>Линия</button><button type="button" aria-pressed={mode==='candles'} onClick={()=>setMode('candles')}><ChartCandlestick size={16}/>Свечи</button></div>
   <div className="trading-tool-actions"><button type="button" aria-label="Объём торгов" aria-pressed={volume} onClick={()=>setVolume(value=>!value)}><BarChart3 size={17}/><span>Объём</span></button>{fullscreenAvailable&&<button type="button" aria-label={expanded?'Свернуть график':'Развернуть график'} title={expanded?'Свернуть график · Esc':'Развернуть график'} aria-pressed={expanded} onClick={()=>void toggleFullscreen()}>{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>}</div>
  </div>
  <div className="native-periods" role="group" aria-label="Период биржевого графика">{securityPeriods.map(item=><button key={item.value} type="button" aria-label={item.name} aria-pressed={period===item.value} onClick={()=>setPeriod(item.value)}>{item.label}</button>)}</div>
  {fullscreenError&&<p className="native-chart-notice" role="status">{fullscreenError}</p>}
  {error&&<p className="native-chart-notice" role="status">{error}.{current?' Показан последний полученный снимок.':''} Повторим автоматически.</p>}
  <div className="native-plot-stage" aria-busy={busy}>
   {points.length>1&&current?<SecurityPlot points={points} mode={mode} volume={volume} currency={current.currency} theme={theme} ariaLabel={`${symbol}: ${range.name}`}/>:<div className="native-chart-empty"><ChartNoAxesCombined size={36}/><h3>{busy?'Загружаем котировки':current?'История за этот период недоступна':'Котировки временно недоступны'}</h3><p>{busy?'Получаем реальные данные источника.':current?'Выберите другой период. Недостающие котировки не дорисовываются.':'Источник пока не передал историю этого инструмента. Проверка повторяется автоматически.'}</p></div>}
  </div>
  <div className="native-data-footer"><div>{sourceUrl?<a href={sourceUrl} target="_blank" rel="noopener noreferrer">Yahoo Finance <ExternalLink size={12}/></a>:<span>Yahoo Finance</span>}<span>Данные: {securityResolution[window.series]}</span>{window.fetchedAt&&<span className={stale?'native-source-stale':''}>Снимок: {stamp(window.fetchedAt)} UTC{stale?' · устарел':''}</span>}</div><span>{checked?`Проверено ${stamp(checked,false)} UTC`:'Проверяем источник'} · каждые 5 с</span></div>
  <div className="native-chart-bottom"><p>Внутридневные снимки запрашиваются раз в 15 минут, длинная история — раз в 6 часов. Возможны задержки источника и публикации.</p><a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer">Расширенный анализ в TradingView <ExternalLink size={12}/></a></div>
 </div>
}
