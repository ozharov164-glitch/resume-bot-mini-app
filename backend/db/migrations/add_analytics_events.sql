CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    telegram_id INTEGER NOT NULL,
    step INTEGER,
    metadata TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
