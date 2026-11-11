PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT,
  stak_role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  discord_user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  staff_status TEXT NOT NULL DEFAULT 'active' CHECK (staff_status IN ('active','on_leave','inactive')),
  joined_at TEXT,
  internal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_warnings (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  warning_type TEXT NOT NULL DEFAULT 'warning' CHECK (warning_type IN ('notice','warning','final_warning')),
  reason TEXT NOT NULL,
  internal_notes TEXT,
  issued_by_discord_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','revoked','expired')),
  resolved_at TEXT,
  resolved_by_discord_id TEXT,
  resolution_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (discord_user_id) REFERENCES staff_profiles(discord_user_id)
);

CREATE TABLE IF NOT EXISTS staff_absences (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','completed')),
  reviewed_by_discord_id TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (discord_user_id) REFERENCES staff_profiles(discord_user_id)
);

CREATE TABLE IF NOT EXISTS staff_tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_by_discord_id TEXT NOT NULL,
  assigned_to_discord_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  staff_only_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  created_by_discord_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','resolved','archived')),
  owner_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  discord_name TEXT,
  discord_id TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_by_discord_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES staff_users(id)
);
CREATE INDEX IF NOT EXISTS idx_players_player_name ON players(player_name);
CREATE INDEX IF NOT EXISTS idx_players_discord_name ON players(discord_name);
CREATE INDEX IF NOT EXISTS idx_players_discord_id ON players(discord_id);

CREATE TABLE IF NOT EXISTS player_identities (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  game TEXT NOT NULL,
  game_player_id TEXT NOT NULL,
  game_player_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (game, game_player_id)
);
CREATE INDEX IF NOT EXISTS idx_player_identities_player ON player_identities(player_id);
CREATE INDEX IF NOT EXISTS idx_player_identities_game_id ON player_identities(game, game_player_id);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL,
  game TEXT,
  sanction_type TEXT NOT NULL CHECK (sanction_type IN ('permanent_ban','temporary_ban','unban','kick','timeout','warning','project_exclusion','other')),
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','lifted','completed')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INTEGER,
  expires_at TEXT,
  lifted_at TEXT,
  lifted_by TEXT,
  lifted_by_discord_id TEXT,
  lifted_reason TEXT,
  created_by TEXT,
  created_by_discord_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (created_by) REFERENCES staff_users(id),
  FOREIGN KEY (lifted_by) REFERENCES staff_users(id)
);
CREATE INDEX IF NOT EXISTS idx_cases_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_player ON cases(player_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(sanction_type);
CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_expiry ON cases(expires_at);
CREATE INDEX IF NOT EXISTS idx_cases_creator_discord ON cases(created_by_discord_id);

CREATE TABLE IF NOT EXISTS case_evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  file_name TEXT,
  file_key TEXT,
  evidence_url TEXT,
  description TEXT,
  uploaded_by TEXT,
  uploaded_by_discord_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES staff_users(id)
);
CREATE INDEX IF NOT EXISTS idx_case_evidence_case ON case_evidence(case_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_discord_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES staff_users(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
