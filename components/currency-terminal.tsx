"use client";
import {useEffect,useId,useMemo,useState} from 'react';
import {Area,ComposedChart,Line,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {ArrowDownRight,ArrowLeftRight,ArrowUpRight,ChartNoAxesCombined,Globe2,Search,Clock3,ExternalLink} from 'lucide-react';
import {majorCurrencies,currencyName} from '@/lib/market-catalog';
import {fx,validateRates,withinPeriod,pct,displayRate,type Rate} from '@/lib/market-data';
import {currencySource,formatRateDate,loadCurrencyPair} from '@/lib/currency-data';
import TradingChart from './trading-chart';
import CurrencyIcon from './currency-icon';
import {forecast} from '@/lib/forecast';
import './currency-terminal.css';

const periods = [
 {days:7,label:'1Н',name:'1 неделя',caption:'за неделю'},
 {days:30,label:'1М',name:'1 месяц',caption:'за месяц'},
 {days:90,label:'3М',name:'3 месяца',caption:'за 3 месяца'},
 {days:180,label:'6М',name:'6 месяцев',caption:'за 6 месяцев'},
 {days:365,label:'1Г',name:'1 год',caption:'за год'},
];
function marketDate(value:string,full=false){
 return formatRateDate(value,{day:'numeric',month:full?'long':'short',...(full?{year:'numeric' as const}:{})});
}
export default function CurrencyTerminal({theme,expanded=false,initialQuote='USD'}:{theme:'light'|'dark';expanded?:boolean;initialQuote?:string}){
 const [base,setBase]=useState('EUR'),[quote,setQuote]=useState(initialQuote),[rates,setRates]=useState<Rate[]>([]),[history,setHistory]=useState<Rate[]>([]),[period,setPeriod]=useState(30),[mode,setMode]=useState('history'),[search,setSearch]=useState(''),[listMode,setListMode]=useState('major'),[error,setError]=useState(''),[catalogError,setCatalogError]=useState(''),[busy,setBusy]=useState(true),[checked,setChecked]=useState('');
 const chartId=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const gradientId='fx-area-'+chartId,glowId='fx-glow-'+chartId;
 useEffect(()=>{
  const ctrl=new AbortController();let loading=false;
  const load=async()=>{
   if(loading||ctrl.signal.aborted)return;loading=true;setBusy(true);
   try{
    const result=await loadCurrencyPair(base,quote,ctrl.signal);
    if(ctrl.signal.aborted)return;
    setHistory(result.history);setChecked(new Date().toLocaleTimeString('ru-RU'));setError('');
   }catch(e){if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Ошибка загрузки')}
   finally{loading=false;if(!ctrl.signal.aborted)setBusy(false)}
  };
  setHistory([]);setError('');setChecked('');void load();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void load()},5000);
  return()=>{ctrl.abort();clearInterval(interval)};
 },[base,quote]);
 // The broad catalogue stays independent of the selected pair's named provider.
 useEffect(()=>{
  const ctrl=new AbortController();let loading=false;
  const load=async()=>{
   if(loading||ctrl.signal.aborted)return;loading=true;
   try{
    const latest=await fx('rates?base='+base,ctrl.signal);
    if(ctrl.signal.aborted)return;
    setRates(validateRates(latest));setCatalogError('');
   }catch{if(!ctrl.signal.aborted)setCatalogError('Не удалось обновить каталог. Повторим автоматически.')}
   finally{loading=false}
  };
  setRates([]);setCatalogError('');void load();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void load()},5000);
  return()=>{ctrl.abort();clearInterval(interval)};
 },[base]);
 const available=useMemo(()=>[...new Set([...majorCurrencies,...rates.map(r=>r.quote)])],[rates]);
 const activeHistory=useMemo(()=>history.filter(r=>r.base===base&&r.quote===quote),[history,base,quote]);
 const activeRates=useMemo(()=>rates.filter(r=>r.base===base),[rates,base]);
 const series=useMemo(()=>withinPeriod(activeHistory,period),[activeHistory,period]);
 const delta=pct(series),last=activeHistory.at(-1),falling=delta!==null&&delta<0;
 const source=currencySource(base,quote);
 const chartColor=falling?'#e32636':'#28e22f';
 const selectedPeriod=periods.find(item=>item.days===period)!;
 const predicted=forecast(activeHistory,quote);
 const filtered=(listMode==='major'&&!search?majorCurrencies:available).filter(c=>c!==base&&(c+' '+currencyName(c)).toLowerCase().includes(search.toLowerCase()));
 function selectPair(b:string,q:string){if(b===q){setBase(q);setQuote(base===q?'USD':base)}else{setBase(b);setQuote(q)}}
 return <>
  <section className="panel currency-terminal" data-trend={falling?'down':'up'}>
   <div className="panel-header currency-panel-header">
    <div><div className="kicker">ВАЛЮТНЫЙ РЫНОК</div><h2>Курс в деталях</h2></div>
    <div className="segmented fx-view-toggle" aria-label="Источник графика">
     <button type="button" aria-pressed={mode==='history'} onClick={()=>setMode('history')}>История курса</button>
     <button type="button" aria-pressed={mode==='exchange'} onClick={()=>setMode('exchange')}>Рыночный график <ArrowUpRight size={13}/></button>
    </div>
   </div>
   <div className="fx-pair-workbench">
    <div className="fx-pair-controls">
     <label className="fx-pair-select">
      <span className="fx-select-icon"><CurrencyIcon code={base}/></span>
      <span className="sr-only">Базовая валюта</span>
      <select aria-label="Базовая валюта" value={base} onChange={e=>selectPair(e.target.value,quote)}>{available.map(c=><option key={c} value={c}>{c}</option>)}</select>
     </label>
     <button type="button" className="fx-swap-button" aria-label="Поменять валюты местами" onClick={()=>{setBase(quote);setQuote(base)}}><ArrowLeftRight size={16}/></button>
     <label className="fx-pair-select">
      <span className="fx-select-icon"><CurrencyIcon code={quote}/></span>
      <span className="sr-only">Валюта котировки</span>
      <select aria-label="Валюта котировки" value={quote} onChange={e=>selectPair(base,e.target.value)}>{available.filter(c=>c!==base).map(c=><option key={c} value={c}>{c}</option>)}</select>
     </label>
    </div>
    {mode==='history'&&<div className="fx-period-tabs" aria-label="Период истории">{periods.map(item=><button type="button" key={item.days} title={item.name} aria-label={item.name} aria-pressed={period===item.days} onClick={()=>setPeriod(item.days)}>{item.label}</button>)}</div>}
   </div>
   <div className="currency-mode-view" key={mode}>
    {mode==='exchange'?<TradingChart symbol={'FX_IDC:'+base+quote} theme={theme}/>:<>
     <div className="fx-quote-header">
      <div className="fx-quote-main">
       <div className="fx-quote-label">1 {base}<span> / </span>{quote}</div>
       <div className="fx-quote-price">{last?displayRate(last.rate):'—'}<span>{quote}</span></div>
       <p className="fx-quote-context">{currencyName(base)} <span>→</span> {currencyName(quote)}</p>
      </div>
      <div className="fx-quote-side">
       {delta!==null&&<span className={'fx-quote-change '+(falling?'negative':'positive')}>
        {falling?<ArrowDownRight size={17} aria-hidden="true"/>:<ArrowUpRight size={17} aria-hidden="true"/>}
        {delta>0?'+':''}{delta.toFixed(2)}%
       </span>}
       <span className="fx-change-caption">{selectedPeriod.caption}</span>
       <span className="fx-observation-date">{last?formatRateDate(last.date,{day:'numeric',month:'short',year:'numeric'}):'Ожидание данных'}</span>
      </div>
     </div>
     {error&&<div className="inline-error" role="status">{error}. {activeHistory.length?'Показана последняя загруженная история.':''} Повторим автоматически.</div>}
     <div className="fx-chart" role="region" aria-label={'История курса '+base+' к '+quote+', '+selectedPeriod.name}>
      <div className="currency-chart-view" key={base+':'+quote+':'+period+':'+(series.length>1?'ready':'waiting')}>
       {series.length>1?<ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{top:18,right:5,bottom:5,left:2}} accessibilityLayer>
         <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stopColor={chartColor} stopOpacity={.2}/>
           <stop offset="55%" stopColor={chartColor} stopOpacity={.065}/>
           <stop offset="100%" stopColor={chartColor} stopOpacity={0}/>
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
           <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="glow"/>
           <feComponentTransfer in="glow" result="softGlow"><feFuncA type="linear" slope=".5"/></feComponentTransfer>
           <feMerge><feMergeNode in="softGlow"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
         </defs>
         <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="2 7"/>
         <XAxis dataKey="date" tickFormatter={d=>marketDate(String(d))} minTickGap={46} tickMargin={14} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false} height={38}/>
         <YAxis domain={['auto','auto']} tickFormatter={displayRate} width={74} tickMargin={12} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false} orientation="right" tickCount={5}/>
         <Tooltip cursor={{stroke:'var(--muted-foreground)',strokeDasharray:'3 5',strokeOpacity:.45}} isAnimationActive={false}
          content={({active,payload,label})=>{
           const value=Number(payload?.[0]?.value);
           if(!active||!payload?.length||!Number.isFinite(value)||!label)return null;
           return <div className="fx-rate-tooltip">
            <span>{marketDate(String(label),true)}</span>
            <strong><i style={{background:chartColor}}/>{displayRate(value)} <small>{quote}</small></strong>
            <p>за 1 {base}</p>
           </div>;
          }}/>
         <Area type="monotone" dataKey="rate" fill={'url(#'+gradientId+')'} stroke="none" activeDot={false} tooltipType="none" isAnimationActive={false}/>
         <Line type="monotone" dataKey="rate" name={base+'/'+quote} stroke={chartColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" filter={'url(#'+glowId+')'} dot={false} activeDot={{r:5,stroke:'var(--surface-2)',strokeWidth:2,fill:chartColor}} isAnimationActive={false}/>
        </ComposedChart>
       </ResponsiveContainer>:<div className="empty fx-chart-empty"><ChartNoAxesCombined size={30}/><h3>{busy?'Загружаем историю…':'История недоступна'}</h3><p>{busy?'Получаем данные источника.':'Выберите другую валютную пару. Запрос повторится автоматически.'}</p></div>}
      </div>
     </div>
     <div className="fx-source-footer">
      <div className="fx-source-main"><a href={source.url} title={source.description} target="_blank" rel="noopener noreferrer">{source.label} <ExternalLink size={11} aria-hidden="true"/></a><span><Clock3 size={11} aria-hidden="true"/> Дневные данные</span></div>
      <div className="fx-check-status"><span className={busy?'dot amber':'dot'} aria-hidden="true"/><span>{busy&&!checked?'Получаем данные':checked?'Проверено '+checked:'Ожидание проверки'}</span><span className="fx-check-interval"> · каждые 5 секунд</span></div>
     </div>
    </>}
   </div>
  </section>
  {expanded&&<>
   <section className="panel currency-list">
    <div className="panel-header"><div><h2>Валюты мира <span className="counter">{filtered.length}</span></h2><p>Дневные справочные курсы за 1 {base}</p></div><div className="segmented"><button type="button" aria-pressed={listMode==='major'} onClick={()=>setListMode('major')}>Основные</button><button type="button" aria-pressed={listMode==='all'} onClick={()=>setListMode('all')}>Все доступные</button></div></div>
    <label className="field-search"><Search size={18}/><input aria-label="Поиск валюты" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Код или название валюты…"/></label>
    {catalogError&&<p className="currency-catalog-note" role="status">{catalogError}</p>}
    <div className="currency-grid">{filtered.map(c=>{const selected=c===quote,r=selected?last:activeRates.find(r=>r.quote===c);return <button type="button" className={'currency-tile '+(selected?'selected':'')} key={c} onClick={()=>setQuote(c)} aria-pressed={selected}><span className="currency-monogram" style={{background:'transparent',borderRadius:0}}><CurrencyIcon code={c}/></span><span className="currency-identity"><b>{c}</b><small>{currencyName(c)}</small></span><span className="currency-value"><b>{r?displayRate(r.rate):'—'}</b><small>{r?marketDate(r.date):'Нет курса'}<span className="currency-rate-source">{selected&&source.id==='nbu'?'НБУ':'Сводный'}</span></small></span><ArrowUpRight size={15}/></button>})}</div>
    {!filtered.length&&<div className="empty">По этому запросу валюты не найдены.</div>}
    <p className="currency-catalog-note">Frankfurter · сводные курсы. Для выбранной пары с гривной — официальный курс НБУ, как на графике.</p>
   </section>
   <section className="panel forecast-panel"><div className="panel-header"><div><div className="kicker">СЦЕНАРИЙ · 22 ТОРГОВЫХ ДНЯ</div><h2>{quote} относительно {base}</h2></div><Globe2 size={22}/></div>{predicted?<div className="forecast-stats"><div><small>Историческая экстраполяция</small><strong className={predicted.mid>=0?'positive':'negative'}>{predicted.mid>=0?'+':''}{predicted.mid.toFixed(2)}%</strong></div><div><small>Расчётный диапазон</small><strong>{predicted.low.toFixed(2)}% … {predicted.high.toFixed(2)}%</strong></div></div>:<p className="muted">Недостаточно свежей истории: нужно 40 наблюдений, последнее не старше 7 дней.</p>}<p className="method-note">Экстраполяция последних 60 наблюдений, диапазон ±1,96 исторического стандартного отклонения. Не учитывает новостные шоки, не прошла проверку предсказательной точности и не является вероятностью прибыли.</p></section>
  </>}
 </>;
}

