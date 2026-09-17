"use client";

import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Radio, Sparkles} from 'lucide-react';
import {marketRadar, relevantNews} from '@/lib/ideas';
import {allAssets} from '@/lib/market-catalog';
import type {Story} from '@/lib/news';
import StoryBrief from '@/components/story-brief';
import AssetIcon from '@/components/asset-icon';
import './news-radar.css';

function plural(value: number, forms: [string, string, string]) {
  const last = value % 10, lastTwo = value % 100;
  return forms[last === 1 && lastTwo !== 11 ? 0 : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 1 : 2];
}
function storyDate(date: string) {
  return Number.isFinite(Date.parse(date))
    ? new Date(date).toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'})
    : 'Дата не указана';
}

export function IdeasBanner({news, onSelect}: {news: Story[]; onSelect: (ticker: string) => void}) {
  const {items: ideas, stats} = marketRadar(news);
  const [ticker, setTicker] = useState('');
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchStart = useRef<{x: number; y: number} | null>(null);
  const index = Math.max(0, ideas.findIndex(item => item.ticker === ticker));
  const active = ideas[index];
  const running = ideas.length > 1 && !paused && !hovered && !focused && !hidden && !reduced;
  const dotStart = Math.max(0, Math.min(index - 2, ideas.length - 5));
  const visibleDots = ideas.slice(dotStart, dotStart + 5);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    motion();
    visibility();
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const order = ideas.map(item => item.ticker).join(',');
  useEffect(() => {
    if (!running) return;
    const sequence = order.split(',');
    const timer = setTimeout(() => setTicker(sequence[(index + 1) % sequence.length]), 8000);
    return () => clearTimeout(timer);
  }, [running, order, index]);

  function step(direction: number) {
    if (ideas.length > 1) setTicker(ideas[(index + direction + ideas.length) % ideas.length].ticker);
  }

  return <section
    className="ideas-banner news-radar"
    aria-label="Активы в новостях"
    aria-roledescription="карусель"
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);}}
  >
    <div className="idea-ambient" aria-hidden="true"><span/><span/><span/></div>
    <div className="idea-top">
      <div className="idea-label"><Radio size={14}/><span>НОВОСТНОЙ РАДАР</span><span className="idea-date">{new Date().toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})}</span></div>
      <span className="idea-curated"><Sparkles size={13}/> Поводы, риски, контекст</span>
    </div>
    <div className="radar-coverage" aria-label="Охват новостного радара">
      <div className="radar-coverage-main">
        <span><b>{stats.coveredAssets} из {stats.totalAssets}</b> инструментов в новостях</span>
        <span><b>{stats.positiveCandidates}</b> с позитивным поводом</span>
      </div>
      <span className="radar-coverage-window">За 72 часа · {stats.freshStories} {plural(stats.freshStories, ['публикация', 'публикации', 'публикаций'])}</span>
    </div>
    {active ? <>
      <div
        className="idea-stage"
        onTouchStart={event => {touchStart.current = {x: event.touches[0].clientX, y: event.touches[0].clientY};}}
        onTouchEnd={event => {
          if (touchStart.current !== null) {
            const delta = event.changedTouches[0].clientX - touchStart.current.x;
            const vertical = event.changedTouches[0].clientY - touchStart.current.y;
            if (Math.abs(delta) > 55 && Math.abs(delta) > Math.abs(vertical)) step(delta < 0 ? 1 : -1);
          }
          touchStart.current = null;
        }}
        onTouchCancel={() => {touchStart.current = null;}}
      >
        {ideas.map((idea, slideIndex) => {
          const asset = allAssets.find(item => item.ticker === idea.ticker);
          const evidenceStory = idea.kind === 'positive' ? idea.supporting[0] || idea.related[0] : idea.kind === 'risk' ? idea.opposing[0] || idea.related[0] : idea.related[0];
          const evidenceLabel = idea.kind === 'positive' ? 'Публикация с позитивным фактором' : idea.kind === 'risk' ? 'Публикация о риске' : idea.kind === 'mixed' ? 'Последняя публикация; в новостях есть разные факторы' : 'Последняя публикация';
          return <article
            className={'idea-slide' + (slideIndex === index ? ' is-active' : '')}
            key={idea.ticker}
            aria-hidden={slideIndex !== index}
            inert={slideIndex !== index}
            aria-roledescription="слайд"
            aria-label={idea.ticker + ' · ' + (slideIndex + 1) + ' из ' + ideas.length}
          >
            <div className="idea-copy">
              <div className="idea-verdict radar-kind" data-kind={idea.kind}><span/>{idea.verdict}</div>
              <div className="idea-identity">
                <AssetIcon ticker={idea.ticker} name={asset?.name} className="idea-asset-icon"/>
                <div><h2>{asset?.name || idea.ticker}</h2><div className="idea-symbol">{idea.ticker}<span>·</span>{asset?.exchange || 'Мировой рынок'}</div></div>
              </div>
              <p className="idea-reason">{idea.reason}</p>
              <div className="idea-evidence"><span>{String(idea.related.length).padStart(2, '0')}</span> {plural(idea.related.length, ['публикация', 'публикации', 'публикаций'])} за последние 72 часа</div>
              {evidenceStory && <a className="radar-story" href={evidenceStory.url} target="_blank" rel="noopener noreferrer" aria-label={evidenceLabel + ': ' + (evidenceStory.ru?.title || evidenceStory.title)}>
                <span className="radar-story-heading" lang={evidenceStory.ru ? 'ru' : undefined}>{evidenceStory.ru?.title || evidenceStory.title}</span>
                <span className="radar-story-meta"><b>{evidenceStory.source}</b><span>·</span><time dateTime={evidenceStory.date || undefined}>{storyDate(evidenceStory.date)}</time><ArrowUpRight size={13}/></span>
              </a>}
              <button className="btn primary idea-cta" onClick={() => onSelect(idea.ticker)}>График и новости <ArrowUpRight size={18}/></button>
            </div>
            <div className="idea-art" aria-hidden="true">
              <div className="idea-orbit orbit-outer"/><div className="idea-orbit orbit-inner"/>
              <div className="idea-art-logo"><AssetIcon ticker={idea.ticker} name={asset?.name}/></div>
              <span className="idea-art-code">{idea.ticker}</span><span className="idea-art-caption">СОБЫТИЯ. КОНТЕКСТ. ВАШ ВЫБОР.</span>
            </div>
          </article>;
        })}
      </div>
      <div className="idea-bottom">
        <span className="idea-disclaimer">Позитивная новость — повод изучить актив.<br/>Цена входа и будущая доходность не оценены.</span>
        <div className="idea-navigation">
          <div className="idea-dots" aria-label="Выбор актива в радаре">{visibleDots.map(item => <button key={item.ticker} aria-label={'Актив ' + item.ticker} aria-pressed={item.ticker === active.ticker} onClick={() => setTicker(item.ticker)}><span/></button>)}</div>
          <span className="idea-count">{String(index + 1).padStart(2, '0')}<span> / {String(ideas.length).padStart(2, '0')}</span></span>
          {ideas.length > 1 && <>
            <button className="idea-control" aria-label="Предыдущий актив" onClick={() => step(-1)}><ChevronLeft size={17}/></button>
            <button className="idea-control" aria-label="Следующий актив" onClick={() => step(1)}><ChevronRight size={17}/></button>
            <button className="idea-control idea-pause" aria-label={paused ? 'Включить автоперелистывание' : 'Приостановить автоперелистывание'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button>
          </>}
        </div>
      </div>
    </> : <div className="idea-empty"><Sparkles size={28}/><h2>Пока нет свежих новостей об активах</h2><p>Радар показывает инструменты, которые прямо упоминаются в публикациях за последние 72 часа. Новые события появятся здесь автоматически.</p></div>}
  </section>;
}

export function AssetEvidence({ticker, news}: {ticker: string; news: Story[]}) {
  const related = relevantNews(news, ticker);
  const item = marketRadar(news).items.find(idea => idea.ticker === ticker);
  const headings = {
    positive: 'Позитивные факторы и ограничения',
    mixed: 'Поддержка и риски по активу',
    risk: 'Риски в свежих новостях',
    watch: 'Что обсуждают об активе',
  };
  return <section className="asset-evidence">
    <div className="kicker">НОВОСТНОЙ КОНТЕКСТ · {ticker}</div>
    <div className="evidence-heading"><h2>{item ? headings[item.kind] : 'Что известно об активе'}</h2>{item && <span className="radar-kind" data-kind={item.kind}><span/>{item.verdict}</span>}</div>
    <p>{item?.reason || 'За последние 72 часа в подключённых источниках нет новостей, прямо связанных с этим активом.'}</p>
    {item && <>
      <p className="evidence-age">Оценка по {item.related.length} {plural(item.related.length, ['публикации', 'публикациям', 'публикациям'])} за 72 часа. Ниже — связанные публикации из доступной истории.</p>
      {item.risks.length > 0 && <p className="method-note">{item.risks.join(' ')}</p>}
    </>}
    {related.length ? related.slice(0, 8).map(story => <article className="evidence-story" key={story.url}>
      <div className="news-meta"><b>{story.source}</b><time dateTime={story.date || undefined}>{Number.isFinite(Date.parse(story.date)) ? new Date(story.date).toLocaleDateString('ru-RU') : 'Дата не указана'}</time><span>{story.signal > 0 ? 'Позитивный фактор' : story.signal < 0 ? 'Риск' : 'Контекст'}</span></div>
      <h3>{story.ru?.title || story.title}</h3>
      <StoryBrief story={story}/>
      {(story.catalyst || story.concern) && <p>{story.concern || story.catalyst}</p>}
    </article>) : <p>В подключённых источниках пока нет публикаций, прямо связанных с {ticker}.</p>}
  </section>;
}
