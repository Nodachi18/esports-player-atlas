-- Initial schema for Esports Player Atlas on Cloudflare D1.

CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  real_name TEXT NOT NULL DEFAULT '',
  game TEXT NOT NULL,
  faction TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ratings (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  panel TEXT NOT NULL CHECK (panel IN ('community', 'professional')),
  voter_hash TEXT NOT NULL,
  strategy INTEGER NOT NULL,
  tactics INTEGER NOT NULL,
  micro INTEGER NOT NULL,
  macro INTEGER NOT NULL,
  decisions INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  flagged INTEGER NOT NULL DEFAULT 0,
  -- Set once an admin flags/unflags manually; reviewed rows are excluded from auto-flagging.
  reviewed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (player_id, panel, voter_hash)
);

CREATE TABLE pro_invites (
  id INTEGER PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Precomputed aggregates per player and panel, refreshed whenever a rating changes.
-- Public read routes only touch this table, which keeps D1 rows-read low.
CREATE TABLE player_stats (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  panel TEXT NOT NULL CHECK (panel IN ('community', 'professional')),
  n INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, panel)
);

CREATE INDEX ratings_player_panel ON ratings(player_id, panel);
CREATE INDEX ratings_player_created ON ratings(player_id, created_at);
CREATE INDEX ratings_flagged ON ratings(flagged);
