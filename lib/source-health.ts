export type SourceErrorKind='blocked'|'rate-limit'|'not-found'|'server'|'timeout'|'invalid-feed'|'network';
export function sourceErrorKind(error=''):SourceErrorKind{
 if(/HTTP (?:401|403)\b/.test(error))return 'blocked';
 if(/HTTP 429\b/.test(error))return 'rate-limit';
 if(/HTTP (?:404|410)\b/.test(error))return 'not-found';
 if(/HTTP 5\d\d\b/.test(error))return 'server';
 if(/timeout|timed out|aborted|превышено время/i.test(error))return 'timeout';
 if(/RSS|Atom|публикаци|большой ответ/i.test(error))return 'invalid-feed';
 return 'network';
}
export function sourceErrorLabel(kind:SourceErrorKind){return {'blocked':'Доступ ограничен','rate-limit':'Лимит запросов','not-found':'Лента не найдена','server':'Ошибка сервера','timeout':'Истекло время ожидания','invalid-feed':'Некорректная лента','network':'Ошибка соединения'}[kind]}
export function sourceErrorExplanation(kind:SourceErrorKind){return {'blocked':'Источник отклонил автоматический запрос. Эта лента не считается доступной; прежние публикации, если они есть, сохраняются с исходными датами.','rate-limit':'Источник ограничил частоту запросов. Повторная проверка запланирована при следующем сборе.','not-found':'Адрес ленты недоступен. Требуется проверить официальный каталог RSS.','server':'Сервер источника вернул ошибку. После одной повторной попытки сборщик сохранил прежние публикации.','timeout':'Источник не ответил за отведённое время. Прежние публикации сохранены.','invalid-feed':'Ответ не удалось прочитать как новостную ленту.','network':'Не удалось установить соединение с источником. Проверим при следующем сборе.'}[kind]}
export type HealthStatus={publisher:string;status:string;error?:string;errorKind?:SourceErrorKind};
export function sourceFailureSummary(health:HealthStatus[]){
 const failed=health.filter(source=>source.status==='error');if(!failed.length)return '';
 const blocked=failed.filter(source=>(source.errorKind||sourceErrorKind(source.error))==='blocked');
 const other=failed.length-blocked.length;
 const publishers=[...new Set(blocked.map(source=>source.publisher))];
 return [`Доступны ${health.length-failed.length} из ${health.length} лент.`,blocked.length?`Доступ к ${blocked.length} лентам (${publishers.join(', ')}) ограничен источниками.`:'',other?`Ошибки получения ещё у ${other} лент.`:'','Причины — в разделе «Источники».'].filter(Boolean).join(' ');
}
