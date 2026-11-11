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
-- PUBLIC APPLICATIONS / VERSIONED POLICIES / APPLICATION AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS application_settings (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  recruitment_open INTEGER NOT NULL DEFAULT 0 CHECK (recruitment_open IN (0,1)),
  updated_by_discord_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO application_settings (id, recruitment_open) VALUES ('primary', 0);

CREATE TABLE IF NOT EXISTS application_visitors (
  visitor_key_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_submission_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_application_visitors_expiry ON application_visitors(expires_at);

CREATE TABLE IF NOT EXISTS policy_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  introduction TEXT NOT NULL,
  policy_content TEXT NOT NULL,
  privacy_notice TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by_discord_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_one_published
ON policy_versions(status) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS policy_acknowledgements (
  id TEXT PRIMARY KEY,
  policy_version_id TEXT NOT NULL,
  acknowledgement_key TEXT NOT NULL,
  label TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0,1)),
  acknowledgement_type TEXT NOT NULL DEFAULT 'policy' CHECK (acknowledgement_type IN ('policy','privacy_notice')),
  FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id) ON DELETE CASCADE,
  UNIQUE (policy_version_id, acknowledgement_key)
);
CREATE INDEX IF NOT EXISTS idx_policy_acknowledgements_order
ON policy_acknowledgements(policy_version_id, sort_order);

CREATE TABLE IF NOT EXISTS policy_acceptances (
  visitor_key_hash TEXT NOT NULL,
  policy_version_id TEXT NOT NULL,
  accepted_items_json TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (visitor_key_hash, policy_version_id),
  FOREIGN KEY (visitor_key_hash) REFERENCES application_visitors(visitor_key_hash) ON DELETE CASCADE,
  FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
);

CREATE TABLE IF NOT EXISTS application_questions (
  id TEXT PRIMARY KEY,
  question_key TEXT NOT NULL UNIQUE,
  section_title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  help_text TEXT NOT NULL DEFAULT '',
  question_type TEXT NOT NULL CHECK (question_type IN ('text','textarea','single_choice','multiple_choice','yes_no')),
  options_json TEXT NOT NULL DEFAULT '[]',
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_application_questions_active_order
ON application_questions(is_active, sort_order);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  visitor_key_hash TEXT NOT NULL,
  policy_version_id TEXT NOT NULL,
  policy_accepted_at TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  discord_username TEXT NOT NULL,
  discord_user_id TEXT,
  primary_device TEXT NOT NULL CHECK (primary_device IN ('pc','laptop','playstation','xbox','smartphone','tablet','other')),
  answers_json TEXT NOT NULL,
  questions_snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','interview','accepted','rejected','withdrawn')),
  assigned_to_discord_id TEXT,
  reviewed_at TEXT,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visitor_key_hash) REFERENCES application_visitors(visitor_key_hash),
  FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_applications_status_submitted
ON applications(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_discord_user
ON applications(discord_user_id);

CREATE TABLE IF NOT EXISTS application_notes (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  author_discord_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_application_notes_application
ON application_notes(application_id, created_at);

CREATE TABLE IF NOT EXISTS application_status_history (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_discord_id TEXT NOT NULL,
  explanation TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_application_history_application
ON application_status_history(application_id, created_at);

-- The first policy remains a draft until STAK completes and approves its legal/privacy details.
INSERT OR IGNORE INTO policy_versions (
  id, version, title, introduction, policy_content, privacy_notice, status
) VALUES (
  'stak-policy-draft-1',
  '1.0-draft',
  'STAK Staff Standards and Application Rules',
  'This document sets out the standards expected from applicants and accepted STAK staff members. It must be reviewed and approved by STAK before publication.',
  'STAK STAFF STANDARDS\n\n1. Scope and responsibilities\nStaff members must follow the current STAK rules, assigned procedures and instructions relevant to their role. A role title does not grant permission to perform every moderation or management action.\n\n2. Use of permissions\nUse Discord, portal and moderation permissions only for legitimate STAK duties and within the permissions actually assigned to you. Never use access to retaliate, intimidate, obtain personal advantage, expose private information, alter records without authority or interfere with another staff member’s work. Do not investigate or decide a case in which you are personally involved.\n\n3. Fair handling and records\nReview the available context before acting. Separate facts from assumptions, request missing information where appropriate, document relevant actions and escalate matters outside your authority. Never fabricate, edit or delete evidence to influence an outcome.\n\n4. Confidentiality and personal data\nAccess internal discussions, reports, applications and personal data only when necessary for an assigned task. Do not copy, publish, export or disclose confidential material outside approved STAK channels. Report suspected account compromise, accidental disclosure or improper access promptly through the designated management route.\n\n5. Communication and conflicts\nKeep staff decisions in the appropriate channels. Do not promise outcomes you cannot authorize. Raise conflicts of interest and step aside where impartial handling cannot be maintained. Concerns about a staff member must use an independent reporting route and must not be handled solely by the person concerned.\n\n6. Cooperation with reviews\nSTAK may review activity and records within its systems for legitimate moderation, safety, security and administrative purposes, subject to applicable law and the published privacy information. Staff members must cooperate with appropriate internal reviews and must not obstruct or manipulate them.\n\n7. Breaches and possible measures\nMisuse of permissions, confidentiality breaches, dishonest records or repeated failure to follow approved procedures may lead to access restrictions, removal from duties, internal review or removal from the team. Any action must be proportionate, based on the available facts and consistent with applicable law and platform rules.\n\n8. Legal and platform boundaries\nNothing in these rules removes rights or obligations that cannot legally be waived. STAK may preserve relevant records, report credible threats or suspected unlawful conduct to the appropriate platform or competent authority where justified and lawful. No blanket consent to unrestricted disclosure or arbitrary legal action is given by accepting these rules.\n\n9. Keeping the rules current\nThe current published version and any role-specific procedures apply. Material changes must be communicated to affected staff and may require renewed acknowledgement.',
  'PRIVACY NOTICE — DRAFT; NOT READY FOR PUBLICATION\n\nController: [Full legal name / organisation responsible for STAK]\nContact: [Privacy contact email and postal contact]\nPurpose: [Specific purposes for processing application and staff data]\nLegal basis: [Applicable GDPR Article 6 legal basis for each purpose]\nData collected: [Exact application fields, Discord identifiers, submitted answers and review notes]\nRecipients/processors: [Discord, hosting/database providers, Moodle/Gnomio if applicable, and other recipients]\nRetention: [Defined retention periods for unsuccessful applications, successful staff records and audit logs]\nRights: [How applicants exercise access, rectification, erasure, restriction, objection and complaint rights]\nInternational transfers: [Relevant transfer information and safeguards, if any]\n\nReplace every bracketed item with verified information before publication. Do not treat this notice as legal approval.',
  'draft'
);

INSERT OR IGNORE INTO policy_acknowledgements
(id, policy_version_id, acknowledgement_key, label, explanation, sort_order, is_required, acknowledgement_type)
VALUES
('stak-ack-rules','stak-policy-draft-1','rules','I have read and agree to follow the published STAK staff standards.','This includes the standards that apply to my assigned role.',1,1,'policy'),
('stak-ack-authority','stak-policy-draft-1','authority','I understand that I may only use permissions for authorized STAK duties.','I will not misuse access, act outside my assigned authority or interfere with records.',2,1,'policy'),
('stak-ack-confidentiality','stak-policy-draft-1','confidentiality','I understand my confidentiality and personal-data responsibilities.','I will access and share internal information only when necessary and authorized.',3,1,'policy'),
('stak-ack-honesty','stak-policy-draft-1','accuracy','I confirm that my application answers are truthful and my own.','I understand that material misrepresentation may affect the application decision.',4,1,'policy'),
('stak-ack-privacy','stak-policy-draft-1','privacy_notice','I acknowledge that I have read the privacy notice.','This is an acknowledgement of the notice, not a blanket consent to unrelated data processing.',5,1,'privacy_notice');

-- Starter questions are deliberately marked as configurable examples, not a verified copy of the 17-page Tally form.
INSERT OR IGNORE INTO application_questions
(id, question_key, section_title, prompt, help_text, question_type, options_json, is_required, is_active, sort_order)
VALUES
('stak-q-experience','relevant_experience','Experience and availability','Describe any relevant experience with moderation, support or community work.','If you do not have previous experience, state that clearly. Prior experience is not assumed.', 'textarea','[]',0,1,10),
('stak-q-availability','availability','Experience and availability','What days and time windows can you realistically support STAK?','Include recurring commitments or limits that may affect availability.', 'textarea','[]',1,1,20),
('stak-q-scenario-1','public_challenge','Practical judgement','A member publicly challenges a moderation decision and demands an immediate reversal. What would you do next, and what information would you check?','Describe the steps you would take rather than only stating a general principle.', 'textarea','[]',1,1,30),
('stak-q-scenario-2','staff_permission','Practical judgement','You notice a staff member handling a case outside their assigned permissions. How would you handle the situation?','Explain how you would preserve the matter for appropriate review without escalating the conflict.', 'textarea','[]',1,1,40);

-- ============================================================
-- CASE COUNTERS
-- ============================================================
-- Ensure the case sequence table exists in the active D1 migration path.
CREATE TABLE IF NOT EXISTS case_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);
INSERT OR IGNORE INTO case_counters (year, last_number)
SELECT
  CAST(substr(case_number, 6, 4) AS INTEGER),
  MAX(CAST(substr(case_number, 11) AS INTEGER))
FROM cases
WHERE case_number GLOB 'STAK-[0-9][0-9][0-9][0-9]-[0-9]*'
GROUP BY CAST(substr(case_number, 6, 4) AS INTEGER);

-- ============================================================
-- END OF SCHEMA
-- ============================================================