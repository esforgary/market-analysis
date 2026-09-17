"use client";
import {useCallback,useLayoutEffect,useRef} from 'react';
import type {LucideIcon} from 'lucide-react';
import './liquid-navigation.css';
type NavItem={name:string;icon:LucideIcon};
type Bounds={x:number;y:number;width:number;height:number};
export default function LiquidNavigation({items,active,savedCount,onNavigate}:{items:NavItem[];active:string;savedCount:number;onNavigate:(name:string)=>void}){
 const nav=useRef<HTMLElement>(null),indicator=useRef<HTMLSpanElement>(null),lens=useRef<HTMLSpanElement>(null);
 const previous=useRef<Bounds|null>(null),animation=useRef<Animation|null>(null),frame=useRef(0);
 const place=useCallback((animate:boolean)=>{
  const host=nav.current,node=indicator.current,glass=lens.current;if(!host||!node||!glass)return;
  const selected=host.querySelector<HTMLElement>('[aria-current="page"]');if(!selected||!selected.offsetWidth)return;
  const next={x:selected.offsetLeft,y:selected.offsetTop,width:selected.offsetWidth,height:selected.offsetHeight},old=previous.current;
  if(old&&Object.keys(next).every(key=>next[key as keyof Bounds]===old[key as keyof Bounds]))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(frame.current)cancelAnimationFrame(frame.current);
  if(!animate||!old||reduced)node.dataset.motion='off';else node.dataset.motion='on';
  node.style.width=next.width+'px';node.style.height=next.height+'px';node.style.transform='translate3d('+next.x+'px,'+next.y+'px,0)';node.dataset.ready='true';
  if(animate&&old&&!reduced){
   const current=getComputedStyle(glass).transform;animation.current?.cancel();
   const horizontal=Math.abs(next.x-old.x)>=Math.abs(next.y-old.y),distance=Math.hypot(next.x-old.x,next.y-old.y),stretch=1+Math.min(.18,distance/1800);
   animation.current=glass.animate([{transform:current==='none'?'scale(1)':current},{transform:horizontal?'scale('+stretch+',.93)':'scale(.96,'+stretch+')',offset:.24},{transform:horizontal?'scale(.985,1.02)':'scale(1.015,.985)',offset:.72},{transform:'scale(1)'}],{duration:540,easing:'cubic-bezier(.22,.8,.3,1)'});
  }else{animation.current?.cancel();animation.current=null}
  previous.current=next;
  frame.current=requestAnimationFrame(()=>{if(indicator.current)indicator.current.dataset.motion='on';frame.current=0});
 },[]);
 useLayoutEffect(()=>{
  let alive=true;place(false);const observer=new ResizeObserver(()=>place(false));
  if(nav.current){observer.observe(nav.current);nav.current.querySelectorAll('button').forEach(button=>observer.observe(button))}
  void document.fonts?.ready.then(()=>{if(alive)place(false)});
  const media=matchMedia('(prefers-reduced-motion: reduce)');const motion=()=>{animation.current?.cancel();place(false)};media.addEventListener('change',motion);
  return()=>{alive=false;observer.disconnect();media.removeEventListener('change',motion);animation.current?.cancel();cancelAnimationFrame(frame.current)};
 },[place]);
 useLayoutEffect(()=>place(true),[active,savedCount,place]);
 return <nav ref={nav} className="liquid-nav" aria-label="Разделы рынка">
  <span ref={indicator} className="liquid-nav-indicator" aria-hidden="true" data-ready="false" data-motion="off"><span ref={lens} className="liquid-nav-lens"/></span>
  {items.map(({name,icon:Icon})=><button key={name} type="button" className={'nav-item '+(active===name?'active':'')} onClick={()=>onNavigate(name)} aria-current={active===name?'page':undefined}><Icon size={19}/><span>{name}</span>{name==='Избранное'&&savedCount>0&&<b className="counter">{savedCount}</b>}{name==='Новости'&&<span className="nav-dot"/>}</button>)}
 </nav>;
}
