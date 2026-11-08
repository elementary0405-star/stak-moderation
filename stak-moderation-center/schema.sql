PRAGMA foreign_keys = ON;

-- Teamkonten
CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (
        role IN (
            'owner',
            'co_owner',
            'management',
            'staff_manager',
            'moderator',
            'trade_moderator'
        )
    ),
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
);

-- Spielerprofile
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    discord_name TEXT,
    discord_id TEXT,
    internal_notes TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES staff_users(id)
);

-- Unterschiedliche Spieler-IDs und Namen pro Spiel
CREATE TABLE IF NOT EXISTS player_identities (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    game TEXT NOT NULL,
    game_player_id TEXT,
    game_player_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE (game, game_player_id)
);

-- Moderationsfälle
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    case_number INTEGER NOT NULL UNIQUE,
    player_id TEXT NOT NULL,
    game TEXT NOT NULL,
    sanction_type TEXT NOT NULL CHECK (
        sanction_type IN (
            'permanent_ban',
            'temporary_ban',
            'unban',
            'kick',
            'timeout',
            'warning',
            'project_exclusion',
            'other'
        )
    ),
    reason TEXT NOT NULL,
    internal_notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'expired', 'lifted', 'completed')
    ),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    expires_at TEXT,
    lifted_at TEXT,
    lifted_by TEXT,
    lift_reason TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (created_by) REFERENCES staff_users(id),
    FOREIGN KEY (lifted_by) REFERENCES staff_users(id)
);

-- Beweise und Anhänge zu Moderationsfällen
CREATE TABLE IF NOT EXISTS case_evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    file_name TEXT,
    file_key TEXT,
    evidence_url TEXT,
    description TEXT,
    uploaded_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id),
    FOREIGN KEY (uploaded_by) REFERENCES staff_users(id)
);

-- Änderungsprotokoll
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES staff_users(id)
);

-- Anmeldesitzungen
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    staff_user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
);

-- Indizes für schnelle Suche und Filter
CREATE INDEX IF NOT EXISTS idx_players_name
ON players(player_name);

CREATE INDEX IF NOT EXISTS idx_players_discord
ON players(discord_id);

CREATE INDEX IF NOT EXISTS idx_identities_game_id
ON player_identities(game, game_player_id);

CREATE INDEX IF NOT EXISTS idx_identities_player
ON player_identities(player_id);

CREATE INDEX IF NOT EXISTS idx_cases_player
ON cases(player_id);

CREATE INDEX IF NOT EXISTS idx_cases_game
ON cases(game);

CREATE INDEX IF NOT EXISTS idx_cases_status
ON cases(status);

CREATE INDEX IF NOT EXISTS idx_cases_type
ON cases(sanction_type);

CREATE INDEX IF NOT EXISTS idx_cases_created_by
ON cases(created_by);

CREATE INDEX IF NOT EXISTS idx_cases_created_at
ON cases(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_entity
ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions(staff_user_id);