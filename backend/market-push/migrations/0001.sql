CREATE TABLE IF NOT EXISTS devices (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, subscribed_at INTEGER,
 endpoint TEXT UNIQUE, p256dh TEXT, auth TEXT, last_alert_at INTEGER
);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, ticker TEXT NOT NULL, payload TEXT NOT NULL,
 observed_at INTEGER NOT NULL, published_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_created ON events(created_at);
CREATE TABLE IF NOT EXISTS deliveries (
 event_id TEXT NOT NULL, device_id TEXT NOT NULL, status TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(event_id, device_id)
);
CREATE INDEX IF NOT EXISTS deliveries_pending ON deliveries(status,next_attempt);
CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS locks (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL);
