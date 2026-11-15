CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  referrer TEXT,
  occurred_at TEXT NOT NULL,
  browser TEXT NOT NULL,
  device TEXT NOT NULL,
  screen TEXT NOT NULL,
  error_type TEXT NOT NULL DEFAULT 'http-404',
  email_status TEXT NOT NULL DEFAULT 'pending',
  wechat_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE rate_limits (
  signature TEXT PRIMARY KEY,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX rate_limits_bucket ON rate_limits (bucket);
