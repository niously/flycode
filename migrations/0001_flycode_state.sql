-- Cloudflare D1 state store for Flycode.
-- The Worker stores one complete, versioned application state document.
CREATE TABLE IF NOT EXISTS flycode_state (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
