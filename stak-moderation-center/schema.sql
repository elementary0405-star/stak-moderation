-- ============================================================
-- STAK MODERATION CENTER
-- Complete Database Schema
-- Version: 1.0
-- Database: Cloudflare D1 / SQLite
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. LEGACY STAFF USERS
-- Retained for compatibility with the existing database model.
-- Discord OAuth sessions are stored separately.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,

    role TEXT NOT NULL CHECK (
        role IN (
            'host',
            'administrator',
            'moderator'
        )
    ),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
);

-- ============================================================
-- 2. DISCORD SESSIONS
-- Used by the current Discord OAuth authentication.
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

CREATE INDEX IF NOT EXISTS idx_discord_sessions_user
ON discord_sessions(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_discord_sessions_expiry
ON discord_sessions(expires_at);

-- ============================================================
-- 3. LEGACY SESSIONS
-- Retained for compatibility with the previous login system.
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,

    staff_user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (staff_user_id)
        REFERENCES staff_users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON sessions(staff_user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
ON sessions(expires_at);

-- ============================================================
-- 4. STAFF PROFILES
-- Central personal staff records.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_profiles (
    discord_user_id TEXT PRIMARY KEY,

    username TEXT NOT NULL,
    global_name TEXT,

    staff_status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            staff_status IN (
                'active',
                'on_leave',
                'inactive'
            )
        ),

    joined_at TEXT,
    internal_notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_status
ON staff_profiles(staff_status);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_username
ON staff_profiles(username);

-- ============================================================
-- 5. STAFF ABSENCES
-- Personal absence notifications and management records.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_absences (
    id TEXT PRIMARY KEY,

    discord_user_id TEXT NOT NULL,

    start_date TEXT NOT NULL,
    expected_return_date TEXT,

    reason TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (
            status IN (
                'submitted',
                'reviewed',
                'withdrawn',
                'completed'
            )
        ),

    management_note TEXT,
    reviewed_by_discord_id TEXT,
    reviewed_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (discord_user_id)
        REFERENCES staff_profiles(discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_absences_user
ON staff_absences(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_staff_absences_status
ON staff_absences(status);

CREATE INDEX IF NOT EXISTS idx_staff_absences_dates
ON staff_absences(start_date, expected_return_date);

-- ============================================================
-- 6. STAFF FEEDBACK
-- Confidential feedback submissions.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_feedback (
    id TEXT PRIMARY KEY,

    discord_user_id TEXT NOT NULL,

    category TEXT NOT NULL DEFAULT 'general'
        CHECK (
            category IN (
                'general',
                'suggestion',
                'concern',
                'procedure',
                'other'
            )
        ),

    subject TEXT NOT NULL,
    message TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'new'
        CHECK (
            status IN (
                'new',
                'under_review',
                'addressed',
                'archived'
            )
        ),

    owner_note TEXT,

    reviewed_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (discord_user_id)
        REFERENCES staff_profiles(discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_feedback_user
ON staff_feedback(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_staff_feedback_status
ON staff_feedback(status);

-- ============================================================
-- 7. STAFF WARNINGS
-- Internal staff disciplinary records.
-- Separate from player sanctions.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_warnings (
    id TEXT PRIMARY KEY,

    discord_user_id TEXT NOT NULL,

    warning_type TEXT NOT NULL DEFAULT 'warning'
        CHECK (
            warning_type IN (
                'notice',
                'warning',
                'final_warning'
            )
        ),

    reason TEXT NOT NULL,
    internal_notes TEXT,

    issued_by_discord_id TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'resolved',
                'revoked',
                'expired'
            )
        ),

    resolved_at TEXT,
    resolved_by_discord_id TEXT,
    resolution_reason TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (discord_user_id)
        REFERENCES staff_profiles(discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_warnings_user
ON staff_warnings(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_staff_warnings_status
ON staff_warnings(status);

-- ============================================================
-- 8. STAFF TICKETS
-- Internal staff support and management requests.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_tickets (
    id TEXT PRIMARY KEY,

    ticket_number TEXT NOT NULL UNIQUE,

    created_by_discord_id TEXT NOT NULL,
    assigned_to_discord_id TEXT,

    subject TEXT NOT NULL,
    description TEXT NOT NULL,

    category TEXT NOT NULL DEFAULT 'general',

    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (
            priority IN (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (
            status IN (
                'open',
                'in_progress',
                'waiting_for_response',
                'resolved',
                'closed'
            )
        ),

    closed_at TEXT,
    closed_by_discord_id TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by_discord_id)
        REFERENCES staff_profiles(discord_user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_tickets_creator
ON staff_tickets(created_by_discord_id);

CREATE INDEX IF NOT EXISTS idx_staff_tickets_assigned
ON staff_tickets(assigned_to_discord_id);

CREATE INDEX IF NOT EXISTS idx_staff_tickets_status
ON staff_tickets(status);

CREATE INDEX IF NOT EXISTS idx_staff_tickets_created
ON staff_tickets(created_at);

-- ============================================================
-- 9. STAFF TICKET MESSAGES
-- Conversation history belonging to internal tickets.
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_ticket_messages (
    id TEXT PRIMARY KEY,

    ticket_id TEXT NOT NULL,
    author_discord_id TEXT NOT NULL,

    message TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ticket_id)
        REFERENCES staff_tickets(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_ticket_messages_ticket
ON staff_ticket_messages(ticket_id);

-- ============================================================
-- 10. PLAYERS
-- Central player records.
-- ============================================================

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

    FOREIGN KEY (created_by)
        REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS idx_players_name
ON players(player_name);

CREATE INDEX IF NOT EXISTS idx_players_discord_name
ON players(discord_name);

CREATE INDEX IF NOT EXISTS idx_players_discord_id
ON players(discord_id);

-- ============================================================
-- 11. PLAYER IDENTITIES
-- Additional game-specific player identifiers.
-- ============================================================

CREATE TABLE IF NOT EXISTS player_identities (
    id TEXT PRIMARY KEY,

    player_id TEXT NOT NULL,

    game TEXT NOT NULL,
    game_player_id TEXT NOT NULL,
    game_player_name TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id)
        REFERENCES players(id)
        ON DELETE CASCADE,

    UNIQUE (game, game_player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_identities_player
ON player_identities(player_id);

CREATE INDEX IF NOT EXISTS idx_player_identities_game
ON player_identities(game, game_player_id);

-- ============================================================
-- 12. MODERATION CASES
-- Central incident and moderation records.
-- ============================================================

CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,

    case_number TEXT NOT NULL UNIQUE,

    player_id TEXT NOT NULL,

    game TEXT,

    sanction_type TEXT NOT NULL
        CHECK (
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
    notes TEXT,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'expired',
                'lifted',
                'completed'
            )
        ),

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

    FOREIGN KEY (player_id)
        REFERENCES players(id),

    FOREIGN KEY (created_by)
        REFERENCES staff_users(id),

    FOREIGN KEY (lifted_by)
        REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS idx_cases_case_number
ON cases(case_number);

CREATE INDEX IF NOT EXISTS idx_cases_player
ON cases(player_id);

CREATE INDEX IF NOT EXISTS idx_cases_status
ON cases(status);

CREATE INDEX IF NOT EXISTS idx_cases_sanction_type
ON cases(sanction_type);

CREATE INDEX IF NOT EXISTS idx_cases_created
ON cases(created_at);

CREATE INDEX IF NOT EXISTS idx_cases_expiry
ON cases(expires_at);

CREATE INDEX IF NOT EXISTS idx_cases_created_by_discord
ON cases(created_by_discord_id);

-- ============================================================
-- 13. CASE EVIDENCE
-- Screenshots, uploaded files and external evidence links.
-- ============================================================

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

    FOREIGN KEY (case_id)
        REFERENCES cases(id)
        ON DELETE CASCADE,

    FOREIGN KEY (uploaded_by)
        REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS idx_case_evidence_case
ON case_evidence(case_id);

CREATE INDEX IF NOT EXISTS idx_case_evidence_uploaded_by
ON case_evidence(uploaded_by_discord_id);

-- ============================================================
-- 14. AUDIT LOGS
-- Central record of administrative and moderation changes.
-- ============================================================

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

    FOREIGN KEY (actor_id)
        REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
ON audit_logs(actor_discord_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON audit_logs(action);

-- ============================================================
-- END OF SCHEMA
-- ============================================================