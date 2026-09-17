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
const destinations=[
 {view:'Новости',title:'Новости и события',description:'Контекст и первоисточники',icon:Newspaper,tone:'cyan'},
 {view:'Акции',title:'Компании мира',description:stockAssets.length+' акций · графики и события',icon:TrendingUp,tone:'amber'},
 {view:'Валюты',title:'Валютный рынок',description:'Курсы и история изменений',icon:Globe2,tone:'violet'},
 {view:'Источники',title:'Проверяйте источники',description:'Доступность и даты публикаций',icon:Radio,tone:'mint'},
];

export default function MarketHero({feeds,publishers,available,onNavigate}:MarketHeroProps){
 return <section className="market-hero market-intro" aria-label="Мировые рынки">
  <div className="hero-copy intro-copy">
   <div className="intro-eyebrow"><span/>ВАШ ВЗГЛЯД НА РЫНОК</div>
   <h1>Большой мир.<br/>Ясный <em>взгляд.</em></h1>
   <p>Новости, графики и курсы — чтобы видеть, что стоит за движением рынка.</p>
   <button className="hero-explore intro-explore" onClick={()=>onNavigate('Акции')}>Исследовать активы <ArrowUpRight size={18}/></button>
  </div>
  <div className="intro-console">
   <div className="intro-console-heading"><span>Обзор рынка</span><span className="intro-console-mark" aria-hidden="true"><i/><i/><i/></span></div>
   <div className="intro-recess">
    <nav className="intro-glass" aria-label="Быстрый доступ к рынкам">
     <span className="intro-edge-lights" aria-hidden="true"><i/><i/><i/><i/></span>
     <div className="intro-glass-heading"><span>Ваши инструменты</span><span>04</span></div>
     {destinations.map(({view,title,description,icon:Icon,tone})=><button key={view} className={'intro-destination intro-tone-'+tone} onClick={()=>onNavigate(view)}>
      <span className="intro-destination-icon"><Icon size={21}/></span>
      <span className="intro-destination-copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="intro-destination-arrow"><ArrowUpRight size={15}/></span>
     </button>)}
    </nav>
   </div>
  </div>
  <div className="intro-foot">
   <dl className="intro-coverage">
    <div><dt>новостных лент</dt><dd>{feeds??'—'}</dd></div>
    <div><dt>редакций и организаций</dt><dd>{publishers??'—'}</dd></div>
    <div><dt>ответили при сборе</dt><dd>{available??'—'}</dd></div>
   </dl>
   <span className="intro-foot-note"><Radio size={14}/>Данные из открытых источников</span>
  </div>
 </section>;
}
