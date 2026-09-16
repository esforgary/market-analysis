"use client";

import {useEffect,useId,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,Clock3,Coins} from 'lucide-react';
import {displayRate,type Rate} from '@/lib/market-data';
import CurrencyIcon from './currency-icon';
import './floating-rates.css';

type FloatingRatesProps={
 rates:Rate[];
 onSelect:(quote:string)=>void;
 view:string;
};
const quotes=['USD','GBP','CHF','JPY'] as const;

export default function FloatingRates({rates,onSelect,view}:FloatingRatesProps){
 const [visibleView,setVisibleView]=useState<string|null>(null);
 const [wide,setWide]=useState(false);
 const [expanded,setExpanded]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const root=useRef<HTMLElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLDivElement>(null);
 const panelId=useId();
 const visible=visibleView===view;
 const panelOpen=wide?!collapsed:expanded;

 useEffect(()=>{
  let frame=0;
  let disposed=false;
  setVisibleView(null);
  const measure=()=>{
   frame=0;
   if(disposed)return;
   const strip=view==='Обзор рынка'?document.getElementById('overview-rates'):null;
   const show=window.scrollY>0&&(view==='Обзор рынка'?!!strip&&strip.getBoundingClientRect().bottom<=0:window.scrollY>320);
   const content=document.querySelector('main .content');
   const roomForRail=window.innerWidth>=1700&&!!content&&content.getBoundingClientRect().left>=208;
   setVisibleView(current=>current===(show?view:null)?current:(show?view:null));
   setWide(current=>current===roomForRail?current:roomForRail);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure)};
  schedule();
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  const content=document.querySelector('main .content');
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;
  if(content)observer?.observe(content);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule)};
 },[view]);

 function open(){
  if(wide)setCollapsed(false);else setExpanded(true);
  requestAnimationFrame(()=>{
   if(panel.current&&!panel.current.inert&&root.current&&!root.current.inert){
    panel.current.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
   }
  });
 }

 function close(restoreFocus=false){
  if(wide)setCollapsed(true);else setExpanded(false);
  if(restoreFocus)requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));
 }

 useEffect(()=>{
  if(!visible||!panelOpen)return;
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||event.defaultPrevented||document.querySelector('[role="dialog"],[role="alertdialog"]'))return;
   const restoreFocus=!!root.current?.contains(document.activeElement);
   event.preventDefault();
   if(wide)setCollapsed(true);else setExpanded(false);
   if(restoreFocus)requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));
  };
  const onPointerDown=(event:PointerEvent)=>{
   if(!wide&&event.target instanceof Node&&!root.current?.contains(event.target))setExpanded(false);
  };
  document.addEventListener('keydown',onKeyDown);
  document.addEventListener('pointerdown',onPointerDown);
  return()=>{document.removeEventListener('keydown',onKeyDown);document.removeEventListener('pointerdown',onPointerDown)};
 },[visible,panelOpen,wide]);

 return <aside ref={root} className={`floating-rates ${visible?'is-visible':''} ${wide?'is-wide':''}`} aria-label="Быстрый доступ к курсам валют" aria-hidden={!visible} inert={!visible}>
  <div ref={panel} id={panelId} className={`floating-rates-panel ${panelOpen?'is-open':''}`} aria-hidden={!panelOpen} inert={!panelOpen}>
   <div className="floating-rates-heading">
    <span><Coins size={15}/><b>Курсы валют</b></span>
    <button type="button" className="floating-rates-close" onClick={()=>close(true)} aria-label="Свернуть курсы валют" title="Свернуть"><ChevronDown size={16}/></button>
   </div>
   <div className="floating-rates-list">{quotes.map(quote=>{
    const rate=rates.find(item=>item.base==='EUR'&&item.quote===quote);
    return <button type="button" className="floating-rate-row" key={quote} onClick={()=>{if(!wide)setExpanded(false);onSelect(quote)}} aria-label={`Открыть график EUR / ${quote}`}>
     <span className="floating-rate-icon"><CurrencyIcon code={quote}/></span>
     <span className="floating-rate-pair">EUR <span>/</span> {quote}<ArrowUpRight size={11}/></span>
     <strong className="floating-rate-value">{rate?displayRate(rate.rate):'—'}</strong>
     <span className="floating-rate-date">{rate?<><time dateTime={rate.date}>{rate.date}</time><span>D1</span></>:'Ожидание источника'}</span>
    </button>;
   })}</div>
   <div className="floating-rates-note"><Clock3 size={12}/><span>Дневные курсы<small>Frankfurter · за 1 EUR</small></span></div>
  </div>
  <button ref={trigger} type="button" className={`floating-rates-trigger ${panelOpen?'is-concealed':''}`} onClick={open} aria-expanded={panelOpen} aria-controls={panelId} aria-hidden={panelOpen} inert={panelOpen}>
   <span className="floating-rates-trigger-icon"><Coins size={18}/></span><span>Курсы</span><ArrowUpRight size={13}/>
  </button>
 </aside>;
}
