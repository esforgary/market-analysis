"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {BarChart3,ChartCandlestick,ChartNoAxesCombined,ExternalLink,Maximize2,Minimize2,SlidersHorizontal} from 'lucide-react';
import './trading-terminal.css';

const intervals=[['1','1 мин'],['5','5 мин'],['15','15 мин'],['30','30 мин'],['60','1 час'],['240','4 часа'],['D','День'],['W','Неделя'],['M','Месяц']];
type ChartLayer={src:string;symbol:string;loaded:boolean;revealed:boolean};

function ChartViewport({src,symbol,theme}:{src:string;symbol:string;theme:'light'|'dark'}){
 const [layers,setLayers]=useState<ChartLayer[]>([{src,symbol,loaded:false,revealed:false}]);
 const [slow,setSlow]=useState(false);
 const [failed,setFailed]=useState(false);
 const latestSrc=useRef(src);
 latestSrc.current=src;
 const currentLoaded=layers.some(layer=>layer.src===src&&layer.loaded);
 const currentRevealed=layers.some(layer=>layer.src===src&&layer.revealed);

 useEffect(()=>{
  setSlow(false);
  setFailed(false);
  setLayers(previous=>{
   if(previous.some(layer=>layer.src===src))return previous;
   // Retain the last loaded frame until the incoming frame completes its fade.
   const lastLoaded=previous.filter(layer=>layer.revealed).at(-1);
   return [...(lastLoaded?[lastLoaded]:[]),{src,symbol,loaded:false,revealed:false}];
  });
  const timer=setTimeout(()=>{
   if(src!==latestSrc.current)return;
   setSlow(true);
   // Some browsers delay cross-origin load indefinitely; never hide their frame indefinitely.
   setLayers(previous=>previous.map(layer=>layer.src===src?{...layer,revealed:true}:layer));
  },8000);
  return()=>clearTimeout(timer);
 },[src,symbol]);

 useEffect(()=>{
  if(!currentRevealed)return;
  const timer=setTimeout(()=>setLayers(previous=>previous.filter(layer=>layer.src===src)),650);
  return()=>clearTimeout(timer);
 },[currentRevealed,src]);

 const onFrameLoad=(loadedSrc:string)=>{
  if(loadedSrc!==latestSrc.current)return;
  // Cross-origin onLoad confirms the document loaded, not market-data availability.
  setLayers(previous=>previous.map(layer=>layer.src===loadedSrc?{...layer,loaded:true,revealed:true}:layer));
 };

 return <><div className="trading-chart-viewport" data-ready={currentRevealed} data-document-ready={currentLoaded} aria-busy={!currentRevealed} style={{colorScheme:theme}}>
  {layers.map(layer=><iframe
   key={layer.src}
   src={layer.src}
   title={`Биржевой график ${layer.symbol} — TradingView`}
   className="trading-chart trading-frame-layer"
   data-current={layer.src===src}
   data-loaded={layer.loaded}
   data-revealed={layer.revealed}
   data-exiting={layer.src!==src&&currentRevealed}
   onLoad={()=>onFrameLoad(layer.src)}
   onError={()=>{if(layer.src===latestSrc.current)setFailed(true)}}
   inert={layer.src!==src||!layer.revealed}
   aria-hidden={layer.src!==src||!layer.revealed}
   tabIndex={layer.src===src&&layer.revealed?0:-1}
   allowFullScreen
   referrerPolicy="origin"
  />)}
  <div className="trading-frame-placeholder" aria-hidden={currentRevealed}>
   <span className="trading-loading-icon"><ChartNoAxesCombined size={28} aria-hidden="true"/></span>
   <div role="status" aria-live="polite">
    <strong>{failed?'Виджет не загрузился':slow?'Источник отвечает дольше обычного':'Подключаем график'}</strong>
    <p>{failed||slow?'Доступность данных зависит от TradingView. График можно открыть по ссылке ниже.':`${symbol} · загружаем выбранный интервал`}</p>
   </div>
   <span className="trading-loading-line" aria-hidden="true"/>
  </div>
 </div><p className="trading-frame-note" data-visible={slow&&!currentLoaded} aria-hidden={!slow||currentLoaded} role="status">Загрузка TradingView ещё не подтверждена. Если данные не появились, откройте источник по ссылке ниже.</p></>
}

export default function TradingChart({symbol,theme}:{symbol:string;theme:'light'|'dark'}){
 const [interval,setInterval]=useState('D');
 const [chartStyle,setChartStyle]=useState<'candles'|'line'>('candles');
 const [volume,setVolume]=useState(false);
 const [toolsVisible,setToolsVisible]=useState(false);
 const [expanded,setExpanded]=useState(false);
 const [fullscreenAvailable,setFullscreenAvailable]=useState(false);
 const [fullscreenError,setFullscreenError]=useState('');
 const terminal=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  setFullscreenAvailable(!!document.fullscreenEnabled);
  const sync=()=>setExpanded(document.fullscreenElement===terminal.current);
  document.addEventListener('fullscreenchange',sync);
  return()=>document.removeEventListener('fullscreenchange',sync);
 },[]);
 async function toggleFullscreen(){
  setFullscreenError('');
  try{if(document.fullscreenElement===terminal.current)await document.exitFullscreen();else await terminal.current?.requestFullscreen()}
  catch{setFullscreenError('Полноэкранный режим недоступен в этом браузере.')}
 }
 const palette=theme==='dark'?{background:'#121817',grid:'#26312e',text:'#92a69d'}:{background:'#f7faf8',grid:'#e0e9e3',text:'#667c6e'};
 const src=useMemo(()=>{
  const config={autosize:true,width:'100%',height:'100%',symbol,interval,timezone:'Etc/UTC',theme,style:chartStyle==='candles'?'1':'2',locale:'ru',allow_symbol_change:false,hide_top_toolbar:!toolsVisible,hide_side_toolbar:!toolsVisible,hide_legend:true,hide_volume:!volume,withdateranges:true,backgroundColor:palette.background,gridColor:palette.grid,support_host:'https://www.tradingview.com'};
  // The embed reads chart overrides from its query settings, not the widget hash.
  const overrides={
   'paneProperties.backgroundType':'solid','paneProperties.background':palette.background,
   'paneProperties.vertGridProperties.color':palette.grid,'paneProperties.horzGridProperties.color':palette.grid,
   'scalesProperties.textColor':palette.text,'scalesProperties.lineColor':palette.grid,
   'mainSeriesProperties.candleStyle.upColor':'#28e22f','mainSeriesProperties.candleStyle.downColor':'#e32636',
   'mainSeriesProperties.candleStyle.borderUpColor':'#28e22f','mainSeriesProperties.candleStyle.borderDownColor':'#e32636',
   'mainSeriesProperties.candleStyle.wickUpColor':'#28e22f','mainSeriesProperties.candleStyle.wickDownColor':'#e32636',
   'mainSeriesProperties.lineStyle.color':'#28e22f','mainSeriesProperties.lineStyle.linewidth':3,'mainSeriesProperties.lineStyle.colorType':'solid',
  };
  return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=ru&overrides=${encodeURIComponent(JSON.stringify(overrides))}#${encodeURIComponent(JSON.stringify(config))}`;

 },[symbol,theme,interval,chartStyle,toolsVisible,volume,palette.background,palette.grid,palette.text]);
 return <div className="trading-wrap trading-terminal" ref={terminal} data-expanded={expanded}>
  <div className="trading-toolbar">
   <div className="trading-view-tabs" role="group" aria-label="Вид биржевого графика">
    <button type="button" aria-pressed={chartStyle==='candles'} onClick={()=>setChartStyle('candles')}><ChartCandlestick size={16}/>Свечи</button>
    <button type="button" aria-pressed={chartStyle==='line'} onClick={()=>setChartStyle('line')}><ChartNoAxesCombined size={16}/>Линия</button>
   </div>
   <div className="trading-tool-actions">
    <button type="button" aria-label="Объём торгов" title="Объём торгов" aria-pressed={volume} onClick={()=>setVolume(value=>!value)}><BarChart3 size={17}/><span>Объём</span></button>
    <button type="button" aria-label="Инструменты анализа" title="Показать инструменты TradingView" aria-pressed={toolsVisible} onClick={()=>setToolsVisible(value=>!value)}><SlidersHorizontal size={17}/><span>Инструменты</span></button>
    {fullscreenAvailable&&<button type="button" aria-label={expanded?'Свернуть график':'Развернуть график'} title={expanded?'Свернуть график · Esc':'Развернуть график'} aria-pressed={expanded} onClick={()=>void toggleFullscreen()}>{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>}
   </div>
  </div>
  <div className="chart-controls"><span>{chartStyle==='candles'?'Интервал свечи':'Интервал точки'}</span><div className="periods" role="group" aria-label="Интервал биржевого графика">{intervals.map(([value,label])=><button key={value} type="button" aria-pressed={interval===value} onClick={()=>setInterval(value)}>{label}</button>)}</div></div>
  {fullscreenError&&<p className="trading-fullscreen-error" role="status">{fullscreenError}</p>}
  <ChartViewport src={src} symbol={symbol} theme={theme}/>
  <div className="trading-status-bar">
   <a className="trading-source-mark" href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer">TradingView <ExternalLink size={12} aria-hidden="true"/></a>
   <span className="trading-source-detail">{symbol}<span aria-hidden="true"> · </span>UTC</span>
  </div>
  <div className="chart-attribution">
   <span>Масштабируйте график жестом или колёсиком. Диапазон дат — внизу графика. Котировки обновляет TradingView; возможна задержка биржи.</span>
  </div>
 </div>
}
