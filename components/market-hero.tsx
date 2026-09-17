"use client";
import {ArrowUpRight,Globe2,Newspaper,Radio,TrendingUp} from 'lucide-react';
import {stockAssets} from '@/lib/market-catalog';
import './market-hero.css';

type MarketHeroProps={
 feeds?:number;
 publishers?:number;
 available?:number;
 onNavigate:(view:string)=>void;
};

export default function MarketHero({feeds,publishers,available,onNavigate}:MarketHeroProps){
 return <section className="market-hero market-intro" aria-label="Мировые рынки">
  <div className="hero-copy intro-copy">
   <div className="intro-eyebrow"><span/>ВАШ ВЗГЛЯД НА РЫНОК</div>
   <h1>Большой мир.<br/>Ясный <em>взгляд.</em></h1>
   <p>Новости, графики и курсы — чтобы видеть, что стоит за движением рынка.</p>
   <button className="hero-explore intro-explore" onClick={()=>onNavigate('Акции')}>Исследовать активы <ArrowUpRight size={18}/></button>
  </div>
  <div className="intro-console">
   <button className="intro-feature" onClick={()=>onNavigate('Новости')}>
    <span className="intro-feature-label"><Newspaper size={16}/>НОВОСТИ И СОБЫТИЯ</span>
    <span className="intro-feature-arrow"><ArrowUpRight size={21}/></span>
    <strong>Что движет рынком</strong>
    <span className="intro-feature-description">Контекст, который помогает увидеть больше.</span>
   </button>
   <div className="intro-routes">
    <button className="intro-route" onClick={()=>onNavigate('Акции')}>
     <span className="intro-route-icon"><TrendingUp size={20}/></span>
     <span className="intro-route-copy"><strong>Компании мира</strong><small>{stockAssets.length} акций · графики и события</small></span>
     <ArrowUpRight className="intro-route-arrow" size={16}/>
    </button>
    <button className="intro-route" onClick={()=>onNavigate('Валюты')}>
     <span className="intro-route-icon"><Globe2 size={20}/></span>
     <span className="intro-route-copy"><strong>Валютный рынок</strong><small>Курсы и история изменений</small></span>
     <ArrowUpRight className="intro-route-arrow" size={16}/>
    </button>
   </div>
  </div>
  <div className="intro-foot">
   <dl className="intro-coverage">
    <div><dt>новостных лент</dt><dd>{feeds??'—'}</dd></div>
    <div><dt>редакций и организаций</dt><dd>{publishers??'—'}</dd></div>
    <div><dt>ответили при сборе</dt><dd>{available??'—'}</dd></div>
   </dl>
   <button className="intro-sources" onClick={()=>onNavigate('Источники')}><Radio size={15}/><span>Проверить источники</span><ArrowUpRight size={15}/></button>
  </div>
 </section>;
}
