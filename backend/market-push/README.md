# Meridian: private background Web Push

The website stays on GitHub Pages. This separate Cloudflare Worker stores device subscriptions in D1 and sends standards-based encrypted Web Push. It checks a small public `data/market-alerts.json` snapshot every five minutes. No laptop needs to stay on. GitHub Actions/RSS/push services may delay delivery; this is not a realtime trading feed.

Production Worker: `https://meridian-market-push.esforgary.workers.dev`. The D1 binding is configured for this deployment. Private VAPID keys and the pairing code are stored as Cloudflare secrets and in an ignored local backup; no account credential is checked in. Device permission and a real delivery test are still required on each phone/browser. Worker responses report `enabled:false` if required bindings/secrets are missing.

## What qualifies

`lib/market-alerts.ts` covers identities from the full asset catalogue. It requires a known official issuer/primary-source feed, a recent successful source check, an explicit asset match, a concrete event, and valid publication/first-observed times. Supported events: published financial results with figures, changed quantified guidance/dividends, dividend suspension and formal bankruptcy filing. Product launches, generic growth, forecasts, rumors, secondary reports, hypothetical/negated claims, and ambiguous multi-company headlines do not trigger. This deliberately misses some important stories. It classifies RSS text; it does not read or independently verify full articles and does not predict price or recommend a purchase.

Push title describes the event type. Body contains the actual headline (Russian translation when available) and publisher. The link opens that asset and retains the original article URL. The first successful cron run establishes a baseline without sending existing stories. New subscriptions never receive historical backlog. Snapshots older than 20 minutes and articles older than three hours are excluded. Exact events persist for 30 days. Each device has a limit of 8 accepted news pushes per rolling day, 3 per five minutes, and one per asset per four hours. Suppressed stories remain in the ordinary news feed. No quiet-hours inference is made; the owner can use OS Focus/notification settings.

## Frontend contract

Base URL is the deployed Worker URL, without trailing slash. All requests include `Origin: https://esforgary.github.io` (browser supplied). Development origins localhost/127.0.0.1:5174 are allowed only when `ALLOW_LOCAL_DEV=true`. CORS is not authentication.

- `GET /v1/config` → `{enabled,vapidPublicKey,scope:"catalog"}`. No credentials required.
- `POST /v1/pair`: `Authorization: Bearer <PAIRING_SECRET>`, JSON `{label?:string}` → HTTP 201 `{deviceId,deviceToken}`. This is an owner-entered code, never bundled with the public site. Discard the pairing code after use; retain the device token privately. It expires after one year. At most 10 devices.
- `PUT /v1/subscription`: device bearer token; JSON `{subscription:{endpoint,expirationTime?,keys:{p256dh,auth}}}` → `{subscribed:true,scope:"catalog"}`. Browser subscription uses `userVisibleOnly:true` and the VAPID public key.
- `DELETE /v1/subscription`: device bearer token → `{subscribed:false,scope:"catalog"}`; removes stored push keys and pending deliveries. The browser should also unsubscribe its PushSubscription.
- `DELETE /v1/device`: device bearer token → `{deleted:true}`; deletes the pairing entirely.
- `GET /v1/status`: device bearer token → `{subscribed,scope,lastCheckedAt,sourceFetchedAt,lastAlertAt,error}`. Poll no more than once a minute while the settings screen is visible.
- `POST /v1/test`: device bearer token, no body needed → `{sent:true}` only after the push service accepted it. One test per minute. Acceptance is not a delivery/display receipt.

Errors return `{error:string}`: 400 invalid input, 401 invalid/expired authorization, 403 origin, 409 subscription conflict/device cap, 410 expired push subscription, 413 oversized body, 415 non-JSON input, 429 throttled, 503 unconfigured, 502 push service rejected test. UI must not label a failed request as enabled.

Push payload:

```json
{"title":"AMD · Решение по дивидендам","body":"Actual source headline · AMD","url":"https://esforgary.github.io/market-analysis/?asset=NASDAQ%3AAMD","tag":"meridian-<event digest>","sourceUrl":"https://ir.amd.com/...","assetId":"NASDAQ:AMD","publishedAt":"ISO timestamp","eventId":"SHA-256"}
```

Service worker must call `showNotification()` for each received push and use `event.waitUntil()`. A notification click should focus/open only the fixed site origin/path, validating payload URLs. Use the supplied tag to collapse repeated delivery attempts. Use IndexedDB for background history; service workers have no localStorage. Do not cache the market JSON as fresh data when offline.

## Deployment after the owner creates/signs into Cloudflare

Run from repository root after the owner signs into the intended Cloudflare account. The CLI is already a root dependency.

```powershell
npm ci --prefix backend/market-push --ignore-scripts --no-audit --no-fund
node node_modules/wrangler/bin/wrangler.js login
node node_modules/wrangler/bin/wrangler.js d1 create meridian-market-push
```

Copy the returned database UUID into `backend/market-push/wrangler.jsonc` (`database_id`). Choose the intended account if login lists more than one; do not guess. Stay on the free plan unless the owner explicitly chooses otherwise.

```powershell
node node_modules/wrangler/bin/wrangler.js d1 migrations apply meridian-market-push --remote --config backend/market-push/wrangler.jsonc
node backend/market-push/generate-secrets.mjs
node node_modules/wrangler/bin/wrangler.js deploy --config backend/market-push/wrangler.jsonc
node node_modules/wrangler/bin/wrangler.js secret bulk backend/market-push/secrets.local.json --config backend/market-push/wrangler.jsonc
```

The generator exclusively creates an ignored local file and never prints keys. It refuses to overwrite an existing file: preserve the VAPID pair across deploys, or clients need to re-subscribe. Store the local file securely. Do not paste it in chat, commit it, put it in GitHub Pages, or expose it via the API. Only the public VAPID key goes to clients. Enter the pairing code on your own devices; never put it in a URL.

Put the actual deployed `https://...workers.dev` URL in public `push-config.json` as `apiBaseUrl`. GitHub API credentials/secrets, custom domain, paid Apple Developer membership, and a pricing-data key are unnecessary for this architecture. Workers/D1 have free quotas, including 10 ms Worker CPU and 50 D1 queries per invocation: collection runs in GitHub Actions, not the Worker. SQL insertion is bulk and sends are capped at five per invocation. Measure production CPU after deployment before promising it fits the account's free usage; this project never enables billing automatically.

## Tests before declaring delivery works

```powershell
node --experimental-strip-types --test tests/market-alerts.test.mjs
npm test --prefix backend/market-push
npm run check --prefix backend/market-push
```

Tests use in-memory SQLite with the actual migration, ephemeral test-only cryptographic keys, and intercepted outbound push requests. Dry-run bundles the Worker without deploying. They verify code/protocol behavior, not actual APNs/FCM delivery. On a real iPhone (iOS 16.4+) add the site to Home Screen, open that PWA, tap its enable button and grant permission. Pair it, send the explicit test, close the PWA, then test again from an authorized device/backend. Check the locked phone. Desktop browser/OS notification permission also must allow delivery.

Verify cron events, D1 `state` timestamps and the `deliveries` statuses. 404/410 removes dead subscriptions. 429/5xx gets up to three bounded attempts; ambiguous transport failure is marked `uncertain` and not retried, because a notification may already have arrived. Crashed `sending` rows likewise stay unresolved rather than flooding devices; investigate in D1. Source/parse failure records a health error and sends no invented alert. Endpoints and auth keys must not be printed into logs.

## Official references

- [WebKit: iPhone Home Screen Web Push, user gesture, no paid developer membership](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Push API and private subscription endpoints](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Cloudflare: Web Push with web-push and nodejs_compat](https://developers.cloudflare.com/agents/communication-channels/webhooks/push-notifications/)
- [Cloudflare: Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare: D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [GitHub: scheduled workflows can be delayed or disabled after inactivity](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
