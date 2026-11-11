-- ============================================================
-- STAK MODERATION CENTER
-- Migration 0003: Discord Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS discord_sessions (
    id TEXT PRIMARY KEY,

    discord_user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    global_name TEXT,
    avatar TEXT,

    stak_role TEXT NOT NULL CHECK (
        stak_role IN (
            'owner',
            'co-owner',
            'management',
            'staff-manager',
            'moderator',
            'trail-moderator',
            'community-member'
        )
    ),

    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Find sessions belonging to a Discord account.
CREATE INDEX IF NOT EXISTS idx_discord_sessions_user
ON discord_sessions(discord_user_id);

-- Find and clean up expired sessions.
CREATE INDEX IF NOT EXISTS idx_discord_sessions_expiry
ON discord_sessions(expires_at);

-- ============================================================
-- END OF MIGRATION
-- ============================================================