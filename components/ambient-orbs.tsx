"use client";
import {useEffect,useRef} from 'react';
export default function AmbientOrbs(){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const elements=Array.from(root.current?.children||[]) as HTMLElement[];const reduced=matchMedia('(prefers-reduced-motion: reduce)');let animations:Animation[]=[];let disposed=false;let resizeTimer:ReturnType<typeof setTimeout>;
 const random=(min:number,max:number)=>min+Math.random()*(max-min);
 function stop(){for(const animation of animations){animation.onfinish=null;animation.cancel()}animations=[]}
 function start(){stop();if(disposed||reduced.matches)return;elements.forEach((element,index)=>{
 function cycle(){if(disposed||reduced.matches)return;const w=window.innerWidth,h=window.innerHeight,size=random(Math.min(100,w*.2),Math.min(310,w*.48));element.style.width=`${size}px`;element.style.height=`${size}px`;
 const x=random(-size*.4,w-size*.55),y=random(-size*.3,h-size*.55);const point=(dx:number,dy:number,scale:number)=>`translate3d(${Math.min(w-size*.2,Math.max(-size*.6,x+dx))}px,${Math.min(h-size*.2,Math.max(-size*.6,y+dy))}px,0) scale(${scale})`;
 const animation=element.animate([{transform:point(0,0,.8),opacity:0,easing:"ease-in-out",offset:0},{transform:point(random(-90,90),random(-80,80),random(.85,1.15)),opacity:.65,easing:"ease-in-out",offset:.24},{transform:point(random(-180,180),random(-130,130),random(.8,1.25)),opacity:.45,easing:"ease-in-out",offset:.68},{transform:point(random(-240,240),random(-170,170),.8),opacity:0,offset:1}],{duration:random(24000,44000),delay:random(200,1800)+index*500,easing:'cubic-bezier(.45,0,.55,1)',fill:'both'});
 animations[index]=animation;animation.onfinish=()=>{animation.onfinish=null;animation.cancel();cycle()};if(document.hidden)animation.pause();
 }cycle();});}
 function visibility(){animations.forEach(a=>document.hidden?a.pause():a.play())}
 function resize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(start,180)}
 start();reduced.addEventListener('change',start);window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);
 return()=>{disposed=true;clearTimeout(resizeTimer);stop();reduced.removeEventListener('change',start);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility)};
 },[]);
 return <div ref={root} className="ambient-orbs" aria-hidden="true"><span/><span/><span/></div>
}

