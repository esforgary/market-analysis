"use client";
import type {Story} from '@/lib/news';
import SmoothDisclosure from '@/components/smooth-disclosure';
export default function StoryBrief({story}:{story:Story}){
 return <div className="story-brief"><p lang={story.ru?'ru':'en'}>{story.ru?.summary||story.summary}</p><div className="brief-caption">{story.ru?'Кратко по RSS · автоматический перевод на русский':story.translationStatus==='unconfigured'||!story.translationStatus?'Оригинал RSS · русский перевод не подключён':story.translationStatus==='failed'?'Перевод недоступен · показан оригинал':'Оригинал RSS · русская версия готовится'}{story.summaryKind==='Источник передал только заголовок'&&' · источник предоставил только заголовок'}</div>{story.firstSeenAt&&<div className="brief-seen">Найдено сервисом: {new Date(story.firstSeenAt).toLocaleString('ru-RU')}</div>}{story.ru&&<SmoothDisclosure label="Сверить с оригиналом"><strong lang="en">{story.title}</strong><p lang="en">{story.summary}</p></SmoothDisclosure>}<a className="brief-original" href={story.url} target="_blank" rel="noopener noreferrer">Полная статья в источнике ↗</a></div>
}
