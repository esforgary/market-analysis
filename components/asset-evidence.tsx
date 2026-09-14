"use client";
import {useEffect,useState} from 'react';
import {dailyIdeas,relevantNews} from '@/lib/ideas';
import type {Story} from '@/lib/news';
import StoryBrief from '@/components/story-brief';
export function IdeasBanner({news,onSelect}:{news:Story[];onSelect:(ticker:string)=>void}){
 const [index,setIndex]=useState(0);
 useEffect(()=>{const id=setInterval(()=>setIndex(i=>i+1),8000);return()=>clearInterval(id)},[]);
 const ideas=dailyIdeas(news),idea=ideas[index%Math.max(1,ideas.length)];
 return <section className="ideas-banner" aria-label="Идеи дня"><div className="kicker">НОВОСТНОЙ РАДАР · {new Date().toLocaleDateString('ru-RU')}</div>{idea?<><div className="idea-content"><div><span>{idea.verdict}</span><h2>{idea.ticker}</h2><p>{idea.reason}</p><small>{idea.supporting.length} публикаций · последние 72 часа</small></div><button className="btn primary" onClick={()=>onSelect(idea.ticker)}>График и аргументы ↗</button></div><div className="idea-bottom"><span>Новостной сигнал, не гарантия доходности. Цена входа не оценена.</span><div>{ideas.map((item,i)=><button key={item.ticker} aria-label={`Идея ${item.ticker}`} aria-pressed={index%ideas.length===i} onClick={()=>setIndex(i)}>{i+1}</button>)}</div></div></>:<><h2>Ждём подтверждённых поводов</h2><p>В свежих новостях пока недостаточно оснований для идеи покупки. Подборка появится автоматически.</p></>}</section>
}
export function AssetEvidence({ticker,news}:{ticker:string;news:Story[]}){
 const related=relevantNews(news,ticker),idea=dailyIdeas(news).find(i=>i.ticker===ticker);
 return <section className="asset-evidence"><div className="kicker">КОНТЕКСТ ПОКУПКИ · {ticker}</div><h2>{idea?'Почему стоит рассмотреть актив':'Что известно об активе'}</h2><p>{idea?.reason||'Свежего положительного сигнала недостаточно для рекомендации покупки.'}</p>{idea&&<p className="method-note">{idea.risks.join(' ')}</p>}{related.length?related.slice(0,8).map(n=><article className="evidence-story" key={n.url}><div className="news-meta"><b>{n.source}</b><time>{new Date(n.date).toLocaleDateString('ru-RU')}</time><span>{n.signal>0?'Позитивный фактор':n.signal<0?'Риск':'Контекст'}</span></div><h3>{n.ru?.title||n.title}</h3><StoryBrief story={n}/>{(n.catalyst||n.concern)&&<p>{n.concern||n.catalyst}</p>}</article>):<p>В подключённых источниках пока нет публикаций, прямо связанных с {ticker}.</p>}</section>
}
