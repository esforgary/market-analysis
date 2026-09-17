"use client";
import {ArrowUpRight,Clock3,Radio} from 'lucide-react';
import './source-overview.css';

type SourceOverviewProps={feeds?:number;publishers?:number;available?:number;updatedAt?:string;onOpen:()=>void};
export default function SourceOverview({feeds,publishers,available,updatedAt,onOpen}:SourceOverviewProps){
 const updated=updatedAt&&Number.isFinite(Date.parse(updatedAt))?new Date(updatedAt):null;
 return <section className="source-overview" aria-label="Сеть источников">
  <button className="source-overview-card" onClick={onOpen} aria-label="Открыть источники и статусы лент">
   <span className="source-overview-icon"><Radio size={23} aria-hidden="true"/></span>
   <span className="source-overview-main"><span className="source-overview-label">Сеть источников</span><span className="source-overview-counts"><span><b>{feeds??'—'}</b> лент</span><span><b>{publishers??'—'}</b> организаций</span></span></span>
   <span className="source-overview-health"><strong>{available??'—'}<span> / {feeds??'—'}</span></strong><small>ответили при сборе</small></span>
   <span className="source-overview-action">Статусы <ArrowUpRight size={18} aria-hidden="true"/></span>
  </button>
  <div className="source-overview-time"><span><Clock3 size={12} aria-hidden="true"/>{updated?<span>Новости обновлены <time dateTime={updated.toISOString()}>{updated.toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></span>:'Ожидаем обновление новостей'}</span><span>Сбор каждые 5 минут</span></div>
 </section>;
}
