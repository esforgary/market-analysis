"use client";
import {useState} from 'react';
import MarketSelect from './market-select';
import type {SourceHealth} from '@/lib/news';
import {sourceErrorKind,sourceErrorLabel,sourceErrorExplanation,type SourceErrorKind} from '@/lib/source-health';
export default function SourcesPanel({health=[],checkedAt}:{health?:SourceHealth[];checkedAt?:string}){
 const [query,setQuery]=useState(''),[mode,setMode]=useState('all');
 const available=health.filter(source=>source.status!=='error').length,publishers=new Set(health.map(source=>source.publisher)).size;
 const failures=health.filter(source=>source.status==='error');
 const reasons=failures.reduce((groups,source)=>{const kind=source.errorKind||sourceErrorKind(source.error);const group=groups.get(kind)||{count:0,publishers:new Set<string>()};group.count++;group.publishers.add(source.publisher);groups.set(kind,group);return groups},new Map<SourceErrorKind,{count:number;publishers:Set<string>}>());
 const shown=health.filter(source=>(mode==='all'||(mode==='error'?source.status==='error':source.status!=='error'))&&`${source.name} ${source.publisher} ${source.kind}`.toLowerCase().includes(query.toLowerCase()));
 return <section className="panel sources-directory">
  <div className="panel-header"><div><div className="kicker">ПРОЗРАЧНОСТЬ ДАННЫХ</div><h2>Источники информации</h2></div></div>
  <div className="sources-summary"><div><strong>{health.length||'—'}</strong><span>подключённых лент</span></div><div><strong>{publishers||'—'}</strong><span>редакций и организаций</span></div><div><strong>{health.length?available:'—'}</strong><span>успешно проверены</span></div></div>
  {!!failures.length&&<div className="source-health-breakdown" aria-label="Причины недоступности источников">
   <h3>Доступны {available} из {health.length} лент</h3>
   {[...reasons].map(([kind,group])=><p key={kind}><b>{sourceErrorLabel(kind)} · {group.count}</b><span>{[...group.publishers].join(', ')}</span></p>)}
   <small>Несколько лент одной организации могут иметь общую причину сбоя. Недоступные ленты исключены из числа успешно проверенных.</small>
  </div>}
  <p className="method-note">Сбор запланирован каждые 5 минут, возможна задержка запуска GitHub. Страница проверяет опубликованный результат каждые 5 секунд. Это периодический опрос, не поток новостей в реальном времени. {checkedAt&&`Последний сбор: ${new Date(checkedAt).toLocaleString('ru-RU')}.`}</p>
  <p className="method-note">Первичные источники сообщают собственные данные; корпоративные ленты отражают позицию компании. Несколько лент одной редакции не считаются независимыми подтверждениями. Доступность RSS не означает, что исходная статья бесплатна.</p>
  <div className="filter-bar"><label className="field-search"><input aria-label="Поиск источника" placeholder="Редакция, организация или лента…" value={query} onChange={event=>setQuery(event.target.value)}/></label><MarketSelect label="Статус источника" value={mode} onValueChange={setMode} options={[{value:'all',label:'Все статусы'},{value:'ok',label:'Доступны'},{value:'error',label:'Недоступны'}]}/></div>
  <div className="source-directory-list">{shown.map(source=>{
   const kind=source.errorKind||sourceErrorKind(source.error);
   return <article key={source.id} className="source-entry"><div><b>{source.publisher}</b><span className={source.status==='error'?'negative':'positive'}>{source.status==='error'?sourceErrorLabel(kind):source.status==='unchanged'?'Без изменений':'Получено'}</span></div><p>{source.name}</p><small>{source.kind} · {source.articles} материалов в ленте</small><small>Проверка: {new Date(source.checkedAt).toLocaleString('ru-RU')}</small><small>Успешное получение: {source.lastSuccessAt?new Date(source.lastSuccessAt).toLocaleString('ru-RU'):'пока не было'}</small>{source.latestArticleAt&&Date.now()-Date.parse(source.latestArticleAt)>30*86400000&&<p className="muted">Новых публикаций за последние 30 дней нет.</p>}<small>Последняя публикация: {source.latestArticleAt?new Date(source.latestArticleAt).toLocaleString('ru-RU'):'дата не указана'}</small>{source.status==='error'&&<p className="source-error-detail"><b>{source.error}</b> · {sourceErrorExplanation(kind)}</p>}<a href={source.url} target="_blank" rel="noopener noreferrer">Открыть RSS / Atom ↗</a></article>
  })}</div>
  {!shown.length&&<div className="empty">{health.length?'Источников по этому фильтру нет.':'Статусы появятся после загрузки снимка.'}</div>}
 </section>
}
