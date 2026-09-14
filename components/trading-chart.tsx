"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChartNoAxesCombined,ExternalLink} from 'lucide-react';

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
 const src=useMemo(()=>{
  const config={autosize:true,width:'100%',height:'100%',symbol,interval,timezone:'Etc/UTC',theme,style:'1',locale:'ru',allow_symbol_change:false,hide_side_toolbar:false,hide_volume:false,withdateranges:true,support_host:'https://www.tradingview.com'};
  return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=ru#${encodeURIComponent(JSON.stringify(config))}`;
 },[symbol,theme,interval]);
 return <div className="trading-wrap">
  <div className="chart-controls"><span>Интервал свечи</span><div className="periods">{intervals.map(([value,label])=><button key={value} type="button" aria-pressed={interval===value} onClick={()=>setInterval(value)}>{label}</button>)}</div></div>
  <ChartViewport src={src} symbol={symbol} theme={theme}/>
  <div className="chart-attribution">
   <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer">Открыть {symbol} в TradingView <ExternalLink size={12} aria-hidden="true"/></a>
   <span>Период: день, 5 дней, месяц, 3/6 месяцев, YTD, год, 5 лет, всё время — внизу графика. Поток обновляется источником; возможна задержка биржи. Если данные не появились, откройте TradingView по ссылке.</span>
  </div>
 </div>
}

