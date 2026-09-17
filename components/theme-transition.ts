"use client";

import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import './theme-transition.css';

export type ThemeSetting='light'|'dark'|'system';
export type ResolvedTheme='light'|'dark';
type TransitionHandle={
 skipTransition:()=>void;
 ready:Promise<void>;
 finished:Promise<void>;
};
type TransitionDocument=Document&{
 startViewTransition?:(update:()=>void)=>TransitionHandle;
};
type ThemeController={
 request:(next:ResolvedTheme)=>void;
 cancel:()=>void;
 dispose:()=>void;
};
const preference=(value:string|null):ThemeSetting=>value==='light'||value==='system'?value:'dark';

/**
 * Owns theme persistence, initial hydration and OS preference changes.
 * Call cancelThemeTransition() before starting a separate navigation view transition.
 */
export function useThemeTransition({beforeTransition}:{beforeTransition?:()=>void}={}){
 const [theme,setTheme]=useState<ResolvedTheme>('dark');
 const [themeSetting,setThemeSetting]=useState<ThemeSetting>('dark');
 const controller=useRef<ThemeController|null>(null);
 const setting=useRef<ThemeSetting>('dark');
 const before=useRef(beforeTransition);
 before.current=beforeTransition;

 useLayoutEffect(()=>{
  const doc=document as TransitionDocument;
  const root=document.documentElement;
  const scheme=matchMedia('(prefers-color-scheme: dark)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let restored:ThemeSetting='dark';
  try{restored=preference(localStorage.getItem('meridian-theme'))}catch{}
  setting.current=restored;
  setThemeSetting(restored);
  let applied:ResolvedTheme=restored==='system'?(scheme.matches?'dark':'light'):restored;
  let desired=applied;
  let disposed=false;
  let busy=false;
  let generation=0;
  let transition:TransitionHandle|null=null;
  let veil:HTMLDivElement|null=null;
  let veilAnimation:Animation|null=null;

  function commit(next:ResolvedTheme,synchronous=true){
   root.dataset.theme=next;
   root.style.colorScheme=next;
   applied=next;
   if(synchronous)flushSync(()=>setTheme(next));else setTheme(next);
  }

  // Apply the saved preference before paint, without animating hydration or StrictMode remounts.
  root.dataset.themeInitializing='';
  commit(applied,false);
  void getComputedStyle(root).color;
  const initialFrame=requestAnimationFrame(()=>{delete root.dataset.themeInitializing});

  function clearVisuals(){
   transition=null;
   veilAnimation?.cancel();
   veilAnimation=null;
   veil?.remove();
   veil=null;
   delete root.dataset.themeTransition;
  }
  function finish(token:number){
   if(disposed||token!==generation)return;
   clearVisuals();
   busy=false;
   // Finish the current blend, then animate only the most recent requested theme.
   if(desired!==applied)start(desired);
  }
  function fadeFallback(next:ResolvedTheme,token:number){
   root.dataset.themeTransition='fallback';
   veil=document.createElement('div');
   veil.className='theme-transition-veil';
   veil.setAttribute('aria-hidden','true');
   veil.inert=true;
   const background=getComputedStyle(document.body).backgroundColor;
   veil.style.backgroundColor=background==='rgba(0, 0, 0, 0)'?(applied==='dark'?'#20252a':'#f5f7fb'):background;
   document.body.appendChild(veil);
   if(typeof veil.animate!=='function'){
    commit(next);
    finish(token);
    return;
   }
   veilAnimation=veil.animate([{opacity:0},{opacity:1}],{duration:140,easing:'ease-out',fill:'forwards'});
   void veilAnimation.finished.then(()=>{
    if(disposed||token!==generation||!veil)return;
    commit(next);
    veilAnimation=veil.animate([{opacity:1},{opacity:0}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
    return veilAnimation.finished;
   }).then(()=>finish(token),()=>finish(token));
  }
  function start(next:ResolvedTheme){
   if(disposed)return;
   if(reduced.matches||document.hidden){
    commit(next);
    return;
   }
   before.current?.();
   busy=true;
   const token=++generation;
   if(doc.startViewTransition){
    root.dataset.themeTransition='native';
    try{
     transition=doc.startViewTransition(()=>{
      if(!disposed&&token===generation)commit(next);
     });
     void transition.ready.catch(()=>{});
     void transition.finished.then(()=>finish(token),()=>finish(token));
     return;
    }catch{
     delete root.dataset.themeTransition;
    }
   }
   fadeFallback(next,token);
  }
  function cancel(commitPending=true){
   generation++;
   transition?.skipTransition();
   clearVisuals();
   busy=false;
   if(commitPending&&desired!==applied)commit(desired);
  }
  const instance:ThemeController={
   request(next){
    if(disposed)return;
    desired=next;
    if(!busy&&next!==applied)start(next);
   },
   cancel(){cancel()},
   dispose(){
    disposed=true;
    cancel(false);
    cancelAnimationFrame(initialFrame);
    delete root.dataset.themeInitializing;
   },
  };
  controller.current=instance;
  const onSchemeChange=()=>{
   if(setting.current==='system')instance.request(scheme.matches?'dark':'light');
  };
  const onReducedChange=()=>{if(reduced.matches)instance.cancel()};
  scheme.addEventListener('change',onSchemeChange);
  reduced.addEventListener('change',onReducedChange);
  return()=>{
   scheme.removeEventListener('change',onSchemeChange);
   reduced.removeEventListener('change',onReducedChange);
   instance.dispose();
   if(controller.current===instance)controller.current=null;
  };
 },[]);

 const chooseTheme=useCallback((value:string)=>{
  const next=preference(value);
  setting.current=next;
  setThemeSetting(next);
  try{localStorage.setItem('meridian-theme',next)}catch{}
  const resolved=next==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):next;
  controller.current?.request(resolved);
 },[]);
 const cancelThemeTransition=useCallback(()=>controller.current?.cancel(),[]);
 return {theme,themeSetting,chooseTheme,cancelThemeTransition};
}

