# Meridian — мировой рыночный терминал

## Локальная работа

Node.js 24. `npm ci`, затем `npm run dev` (серверная версия) или `npm run dev:pages` (статическая версия).

## Что работает

- Светлая, тёмная и системная тема. Настройка и избранное сохраняются только в браузере.
- 77 акций США, Европы, Азии и других регионов; 12 облигационных и дивидендных ETF. Каталог — навигационная подборка, не рейтинг популярности или рекомендация. Поиск, фильтры, страницы, избранное.
- 40 основных мировых валют и остальные валюты, доступные в ответе Frankfurter. Выбор базы/котировки, инверсия пары, интерактивная история с подсказками. При смене пары предыдущая загрузка отменяется.
- TradingView Advanced Chart для акций и валют, переключение инструментов, периодов, свечей и индикаторов средствами виджета. Доступность и задержка зависят от рынка и лицензии источника. Виджет не отдаёт цены модели анализа приложения.
- Новости ФРС, ЕЦБ и TechCrunch с датой снимка, датами публикаций и ошибками источников. Автообновление серверных новостей каждые 5 минут, только при видимой вкладке; можно выключить.
- FX проверяется каждую минуту, но источник предоставляет ДНЕВНЫЕ, не тиковые курсы. Частота проверки не равна частоте новых данных.
- Мобильное меню, адаптивные таблицы/карточки, графики и темы.

## GitHub Pages — постоянный доступ без ПК

Да. Отдельная статическая сборка не требует Node.js на хостинге. Не загружайте `dist/server` на Pages.

1. Создайте свой репозиторий GitHub и загрузите исходники в `main` или `master`.
2. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Откройте **Actions → Deploy Meridian to GitHub Pages → Run workflow** (или отправьте коммит).
4. Адрес сайта появится в результате deploy. Приложение работает на корневом домене и подкаталоге репозитория: пути относительные.

Команда `npm run build:pages` создаёт `dist-pages/`. Workflow `.github/workflows/pages.yml` запускается после push, вручную и каждые 3 часа. GitHub может задерживать расписание; в неактивных публичных репозиториях расписания могут отключаться. Дата снимка всегда видна в приложении.

В Pages:
- Валюты напрямую загружаются браузером из публичного Frankfurter API (CORS); графики — из TradingView.
- Новости обновляет GitHub Actions, сохраняет в `public/data/news.json` и публикует новую сборку. Кнопка обновления в браузере перечитывает этот снимок и не запускает Actions.
- Серверные API, секреты и Node.js на Pages не нужны. Пользовательские API-ключи не вставляйте в frontend.

## Серверная версия

`npm run build` создаёт Cloudflare Worker-совместимый `dist/`. `/api/market` загружает новости, кэшируя 5 минут (30 секунд при ошибке). Валюты и TradingView загружаются браузером. Публикация на другом хостинге не требует запуска ПК.

## Проверки

`npm run test:market` — расчёты, каталог и безопасный разбор RSS. `npx tsc --noEmit` — типы. `npm run build` и `npm run build:pages` — обе сборки.

## Ограничения

Новостная тональность — простой анализ слов, не причинная модель. Валютный сценарий — экстраполяция логарифмических доходностей, не валидированная прогнозная вероятность. Дивидендный календарь и персональные рекомендации не реализованы. Встроенные биржевые графики могут иметь задержку, требовать доступности стороннего источника или не поддерживать конкретную биржу. Никаких вымышленных котировок приложение не показывает.

## Automatic updates and news ideas
The visible app checks available data every 5 seconds, without manual refresh controls. Frankfurter publishes daily reference rates; five-second polling does not make them tick data. TradingView maintains its own quote stream with exchange-specific availability and delays. Candle resolution controls are above the chart; historical range controls are inside TradingView.

The homepage rotates evidence-based news ideas every 8 seconds. The heuristic uses positive catalysts and subtracts negative articles from the last 72 hours. It is recalculated from available news, suppresses stale/future evidence and may return no picks. It does not evaluate entry prices or guarantee returns. Asset pages show associated RSS excerpts, positive/negative context and original article links.

GitHub Actions rebuilds news every three hours (scheduled runs may be delayed by GitHub). The browser checks the published snapshot every five seconds; this is not live RSS delivery. Enable GitHub Pages with source GitHub Actions in repository Settings → Pages. The hosted site works without a running PC.
