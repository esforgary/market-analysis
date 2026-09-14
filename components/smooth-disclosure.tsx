"use client";

import {useId,useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';

export default function SmoothDisclosure({label,children}:{label:string;children:ReactNode}){
 const [open,setOpen]=useState(false);
 const contentId=useId();
 return <div className="smooth-disclosure" data-open={open}>
  <button type="button" className="smooth-disclosure-trigger" aria-expanded={open} aria-controls={contentId} onClick={()=>setOpen(value=>!value)}>
   <span>{label}</span><ChevronDown size={14} aria-hidden="true"/>
  </button>
  <div id={contentId} className="smooth-disclosure-grid" inert={!open} aria-hidden={!open}>
   <div className="smooth-disclosure-clip"><div className="smooth-disclosure-body">{children}</div></div>
  </div>
 </div>
}
