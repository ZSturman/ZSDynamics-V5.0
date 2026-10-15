CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  received_at TEXT NOT NULL,
  email_sent_at TEXT,
  email_attempts INTEGER NOT NULL DEFAULT 0,
  email_next_attempt INTEGER NOT NULL DEFAULT 0,
  notion_page_id TEXT,
  notion_next_attempt INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX messages_pending ON messages(email_sent_at, email_next_attempt);
CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('Pending','Active','Unsubscribed')),
  generation INTEGER NOT NULL DEFAULT 1,
  requested_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  confirmation_sent_at TEXT,
  owner_notified_at TEXT,
  notion_page_id TEXT,
  notion_state TEXT,
  notion_next_attempt INTEGER NOT NULL DEFAULT 0,
  confirmation_attempts INTEGER NOT NULL DEFAULT 0,
  confirmation_next_attempt INTEGER NOT NULL DEFAULT 0,
  owner_attempts INTEGER NOT NULL DEFAULT 0,
  owner_next_attempt INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE intake_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO intake_state VALUES ('job_lock', '0');
CREATE TABLE articles_seen (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  published_at TEXT NOT NULL,
  discovered_at TEXT NOT NULL
);
CREATE TABLE article_deliveries (
  article_slug TEXT NOT NULL REFERENCES articles_seen(slug),
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL,
  sent_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(article_slug, subscriber_id)
);
