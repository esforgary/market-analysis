"use client";
import type {ReactNode} from 'react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from './ui/select';
import './market-select.css';
export type MarketOption={value:string;label:string;description?:string;icon?:ReactNode};
export default function MarketSelect({value,onValueChange,options,label,kind='default'}:{value:string;onValueChange:(value:string)=>void;options:MarketOption[];label:string;kind?:'default'|'currency'}){
 const selected=options.find(option=>option.value===value);
 return <Select value={value} onValueChange={onValueChange}>
  <SelectTrigger className={'market-select-trigger '+(kind==='currency'?'market-currency-select':'')} aria-label={label}>
   {selected?.icon&&<span className="market-select-icon" aria-hidden="true">{selected.icon}</span>}
   <SelectValue>{selected?.label||value}</SelectValue>
  </SelectTrigger>
  <SelectContent className={'market-select-content '+(kind==='currency'?'market-currency-options':'')} position="popper" align="start" sideOffset={8} collisionPadding={12}>
   {options.map(option=><SelectItem className="market-select-option" key={option.value} value={option.value} textValue={option.label+(option.description?' '+option.description:'')}>
    {option.icon&&<span className="market-option-icon" aria-hidden="true">{option.icon}</span>}<span className="market-option-copy"><span>{option.label}</span>{option.description&&<small>{option.description}</small>}</span>
   </SelectItem>)}
  </SelectContent>
 </Select>;
}
