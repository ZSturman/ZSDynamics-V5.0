-- First-party anonymous session stream for portfolio analytics.
-- No IP addresses, user-agent strings, visitor ids or free text are stored.
-- Rows are deleted after SESSION_RETENTION_DAYS (default 30) by the hourly cron.

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id TEXT PRIMARY KEY,               -- random, rotates after 30 min inactivity
  started_at INTEGER NOT NULL,               -- ms, server-corrected
  last_seen_at INTEGER NOT NULL,
  received_events INTEGER NOT NULL DEFAULT 0,
  batches INTEGER NOT NULL DEFAULT 0,
  device_category TEXT,                      -- mobile | tablet | desktop
  browser_family TEXT,                       -- Chrome | Safari | Firefox | Edge | ...
  os_family TEXT,                            -- macOS | iOS | Windows | Android | Linux | ...
  network_class TEXT,                        -- datacenter | consumer_or_unknown
  network_org TEXT,                          -- hosting organisation name, datacenter only
  country TEXT,                              -- two-letter country from Cloudflare
  ua_automation TEXT,                        -- matched automation token, if the UA declares one
  qa_run TEXT,                               -- controlled QA run id, if any
  default_automation_viewport INTEGER NOT NULL DEFAULT 0,
  no_window_chrome INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions(started_at);

CREATE TABLE IF NOT EXISTS analytics_events (
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,                    -- <tab>-<seq>; duplicates are ignored
  tab_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  ts INTEGER NOT NULL,                       -- client time corrected by the batch clock offset
  client_ts INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  name TEXT NOT NULL,
  props TEXT NOT NULL,                       -- allow-listed JSON (lib/analytics-taxonomy.mjs)
  PRIMARY KEY (session_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_received ON analytics_events(received_at);

CREATE TABLE IF NOT EXISTS analytics_daily_counters (
  day TEXT PRIMARY KEY,                      -- UTC yyyy-mm-dd
  events INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  last_batch TEXT
);

CREATE TABLE IF NOT EXISTS analytics_reports (
  report_date TEXT PRIMARY KEY,              -- reporting-day yyyy-mm-dd
  html TEXT NOT NULL,                        -- full detailed report linked from the email
  created_at INTEGER NOT NULL
);
