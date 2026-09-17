"use client";
import {useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import './security-plot.css';
import {createTradingScale} from '@/lib/trading-scale';

export type SecurityPoint={time:number;open:number;high:number;low:number;close:number;volume?:number};
export type SecurityBucket=SecurityPoint&{startTime:number;count:number};
export type SecurityPlotProps={points:SecurityPoint[];mode:'line'|'candles';volume:boolean;currency:string;theme:'light'|'dark';ariaLabel?:string};

/** Consecutive OHLC buckets preserve the first open, last close, all extremes and total volume. */
export function aggregateSecurityPoints(points:SecurityPoint[],maxPoints=300):SecurityBucket[]{
 const step=Math.max(1,Math.ceil(points.length/Math.max(1,Math.floor(maxPoints))));
 const result:SecurityBucket[]=[];
 for(let i=0;i<points.length;i+=step){
  const part=points.slice(i,i+step),first=part[0],last=part[part.length-1];
  result.push({time:last.time,startTime:first.time,count:part.length,open:first.open,close:last.close,high:Math.max(...part.map(p=>p.high)),low:Math.min(...part.map(p=>p.low)),volume:part.some(p=>Number.isFinite(p.volume))?part.reduce((sum,p)=>sum+(Number.isFinite(p.volume)?p.volume!:0),0):undefined});
 }
 return result;
}
function nearest(points:SecurityPoint[],time:number){
 let low=0,high=points.length-1;
 while(low<high){const mid=Math.floor((low+high)/2);if(points[mid].time<time)low=mid+1;else high=mid}
 if(low>0&&Math.abs(points[low-1].time-time)<Math.abs(points[low].time-time))return low-1;
 return low;
}
export default function SecurityPlot({points,mode,volume,currency,theme,ariaLabel='График цены актива'}:SecurityPlotProps){
 const container=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:900,height:390}),[focusTime,setFocusTime]=useState<number|null>(null);
 const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 useLayoutEffect(()=>{
  const node=container.current;if(!node)return;
  const measure=()=>{const r=node.getBoundingClientRect();const width=Math.max(240,Math.round(r.width)),height=Math.max(260,Math.round(r.height));setSize(old=>old.width===width&&old.height===height?old:{width,height})};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
 },[]);
 const clean=useMemo(()=>{
  const byTime=new Map<number,SecurityPoint>();
  for(const p of points)if([p.time,p.open,p.high,p.low,p.close].every(Number.isFinite))byTime.set(p.time,p);
  return [...byTime.values()].sort((a,b)=>a.time-b.time);
 },[points]);
 const maxCandles=Math.min(300,Math.max(50,Math.floor(size.width/4)));
 const data=useMemo(()=>mode==='candles'?aggregateSecurityPoints(clean,maxCandles):clean.map(p=>({...p,startTime:p.time,count:1})),[clean,mode,maxCandles]);
 const grouped=mode==='candles'&&data.some(p=>p.count>1);
 const width=size.width,height=size.height;
 const showVolume=volume&&data.some(p=>Number.isFinite(p.volume));
 const volumeHeight=showVolume?Math.max(40,Math.min(62,height*.15)):0;
 const left=16,right=width<500?77:86,top=25,bottom=60,plotWidth=Math.max(1,width-left-right),plotHeight=Math.max(90,height-top-bottom-volumeHeight-(showVolume?18:0));
 const volumeTop=top+plotHeight+18;
 const first=data[0],last=data[data.length-1];
 const low=data.length?Math.min(...data.map(p=>mode==='candles'?p.low:p.close)):0;
 const high=data.length?Math.max(...data.map(p=>mode==='candles'?p.high:p.close)):1;
 const spread=high-low||Math.max(Math.abs(high)*.02,.01),minimum=low-spread*.09,maximum=high+spread*.09;
 const scale=createTradingScale(data.length,left,plotWidth);
 const x=scale.xAt;
 const y=(price:number)=>top+(maximum-price)/(maximum-minimum)*plotHeight;
 const rising=!first||last.close>=first.close,color=rising?'#28e22f':'#e32636';
 const formatter=useMemo(()=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:Math.abs(high)<.1?6:Math.abs(high)<10?4:2}),[high]);
 const format=(price:number)=>formatter.format(price);
 const intraday=clean.length>1&&clean.slice(1).some((p,i)=>p.time-clean[i].time<86400);
 const date=(time:number,full=false)=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:full?'short':'short',...(full?{year:'numeric' as const}:{}),...(intraday?{hour:'2-digit' as const,minute:'2-digit' as const}:{}),timeZone:'UTC'}).format(new Date(time*1000));
 const line=data.map((p,i)=>(i?'L':'M')+x(i).toFixed(2)+' '+y(p.close).toFixed(2)).join(' ');
 const area=last&&first?line+' L'+x(data.length-1).toFixed(2)+' '+(top+plotHeight)+' L'+x(0).toFixed(2)+' '+(top+plotHeight)+' Z':'';
 const index=focusTime!==null&&data.length?nearest(data,focusTime):null;
 const selected=index===null?null:data[index],selectedX=index===null?0:x(index);
 const tooltipWidth=Math.min(238,width-24),tooltipLeft=Math.max(12,Math.min(width-tooltipWidth-12,selectedX>width*.54?selectedX-tooltipWidth-16:selectedX+16));
 const maxVolume=Math.max(1,...data.map(p=>p.volume||0));
 const candleWidth=Math.max(.7,Math.min(10,scale.step*.68));
 const coverage=first&&last?last.time-first.time:0;
 const axisDate=(time:number)=>new Intl.DateTimeFormat('ru-RU',{
  ...(coverage>366*86400?{month:'short' as const,year:'numeric' as const}:coverage<=86400&&intraday?{hour:'2-digit' as const,minute:'2-digit' as const}:{day:'numeric' as const,month:'short' as const}),timeZone:'UTC',
 }).format(new Date(time*1000));
 const ticks=Array.from({length:5},(_,i)=>maximum-(maximum-minimum)*i/4);
 const dateIndices=[...new Set(Array.from({length:width<500?3:5},(_,i)=>Math.round((data.length-1)*i/(width<500?2:4))))];
 function move(event:React.PointerEvent<SVGSVGElement>){
  if(!data.length)return;const rect=event.currentTarget.getBoundingClientRect();const local=(event.clientX-rect.left)*width/rect.width;
  setFocusTime(data[scale.indexAt(local)].time);
 }
 function key(event:React.KeyboardEvent<SVGSVGElement>){
  if(!data.length)return;
  if(event.key==='Escape'){setFocusTime(null);return}
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
  const current=index??data.length-1;
  const target=event.key==='Home'?0:event.key==='End'?data.length-1:Math.max(0,Math.min(data.length-1,current+(event.key==='ArrowLeft'?-1:1)));
  setFocusTime(data[target].time);
 }
 return <div ref={container} className="security-plot" data-theme={theme} data-mode={mode}>
  {!data.length?<div className="security-plot-empty"><span>Нет точек для выбранного периода</span><small>График появится после получения данных источника.</small></div>:<>
   <svg viewBox={'0 0 '+width+' '+height} width="100%" height="100%" role="img" tabIndex={0} aria-label={ariaLabel+(selected?'. '+date(selected.time,true)+': '+format(selected.close)+' '+currency:'')} aria-describedby={'security-instructions-'+id} onPointerMove={move} onPointerDown={move} onDragStart={event=>event.preventDefault()} onPointerLeave={()=>setFocusTime(null)} onPointerCancel={()=>setFocusTime(null)} onBlur={()=>setFocusTime(null)} onKeyDown={key}>
    <defs>
     <filter id={'security-glow-'+id} x="0" y="0" width={width} height={height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="wide"/><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="near"/><feMerge><feMergeNode in="wide"/><feMergeNode in="near"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
     <linearGradient id={'security-area-'+id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".19"/><stop offset=".7" stopColor={color} stopOpacity=".045"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient>
    </defs>
    <text className="security-axis-currency" x={width-right+14} y={12}>{currency}</text>
    {ticks.map((value,i)=><g key={i}><line className="security-grid-line" x1={left} x2={left+plotWidth} y1={y(value)} y2={y(value)}/><text className="security-axis-text" x={width-right+14} y={y(value)+3}>{format(value)}</text></g>)}
    {showVolume&&<g aria-hidden="true"><line className="security-volume-divider" x1={left} x2={left+plotWidth} y1={volumeTop-8} y2={volumeTop-8}/>{data.map((p,i)=><rect key={p.time} x={x(i)-candleWidth/2} y={volumeTop+volumeHeight-(p.volume||0)/maxVolume*volumeHeight} width={candleWidth} height={(p.volume||0)/maxVolume*volumeHeight} rx="1" fill={p.close>=p.open?'#28e22f':'#e32636'} opacity={index===i?.65:.23}/>)}<text className="security-axis-text" x={width-right+14} y={volumeTop+12}>Объём</text></g>}
    {mode==='line'?<g key="line" className="security-series" aria-hidden="true"><path d={area} fill={'url(#security-area-'+id+')'}/><path className="security-price-line" d={line} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" filter={'url(#security-glow-'+id+')'}/>{data.length===1&&<circle cx={x(0)} cy={y(first.close)} r="4" fill={color} filter={'url(#security-glow-'+id+')'}/>}</g>:<g key="candles" className="security-series" aria-hidden="true">{data.map((p,i)=>{const up=p.close>=p.open,paint=up?'#28e22f':'#e32636',bodyTop=y(Math.max(p.open,p.close)),bodyHeight=Math.max(1.5,Math.abs(y(p.open)-y(p.close)));return <g key={p.time}><line x1={x(i)} x2={x(i)} y1={y(p.high)} y2={y(p.low)} stroke={paint} strokeWidth="1.2"/><rect x={x(i)-candleWidth/2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={paint} rx=".6"/></g>})}</g>}
    {selected&&<g className="security-crosshair" aria-hidden="true"><line x1={selectedX} x2={selectedX} y1={top} y2={height-bottom}/><line x1={left} x2={left+plotWidth} y1={y(selected.close)} y2={y(selected.close)}/><circle cx={selectedX} cy={y(selected.close)} r="8" fill={color} opacity=".2"/><circle cx={selectedX} cy={y(selected.close)} r="4" fill={color} stroke="white" strokeWidth="1.5"/></g>}
    {dateIndices.map((i,j)=>data[i]&&<text key={i} className="security-axis-text" x={x(i)} y={height-36} textAnchor={j===0?'start':j===dateIndices.length-1?'end':'middle'}>{axisDate(data[i].time)}</text>)}
   </svg>
   {selected&&<div className="security-plot-tooltip" style={{left:tooltipLeft,top:15,width:tooltipWidth}}><div className="security-tooltip-date">{selected.count>1?date(selected.startTime,true)+' — '+date(selected.time,true):date(selected.time,true)} <span>UTC</span></div><strong style={{color}}>{format(selected.close)} <span>{currency}</span></strong><dl><div><dt>Открытие</dt><dd>{format(selected.open)}</dd></div><div><dt>Максимум</dt><dd>{format(selected.high)}</dd></div><div><dt>Минимум</dt><dd>{format(selected.low)}</dd></div><div><dt>Закрытие</dt><dd>{format(selected.close)}</dd></div>{selected.volume!==undefined&&<div><dt>Объём</dt><dd>{new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:2}).format(selected.volume)}</dd></div>}</dl>{selected.count>1&&<small>Объединено баров: {selected.count}</small>}</div>}
   <div className="security-scale-notes"><span>Торговая шкала · без пауз между сессиями</span>{grouped&&<span>Свечи сгруппированы: {data.length} из {clean.length} баров</span>}</div>
  </>}
  <span id={'security-instructions-'+id} className="security-plot-sr">Наведите указатель или коснитесь графика для значений. Стрелки влево и вправо выбирают точку; Home и End — начало и конец; Escape скрывает подсказку. Даты в UTC. Между фактическими барами равные интервалы; ночи и выходные не занимают ширину графика.</span>
 </div>;
}
