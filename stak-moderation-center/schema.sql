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
  page_number INTEGER NOT NULL DEFAULT 1,
  depends_on_question_key TEXT,
  depends_on_value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_application_questions_active_order
ON application_questions(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_application_questions_page_order
ON application_questions(is_active, page_number, sort_order);

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

-- Central training register for role qualifications, courses and team events.
-- Scores and completions entered here are management records; this migration
-- does not create an automatic Moodle/Gnomio synchronization.

CREATE TABLE IF NOT EXISTS training_programs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  program_type TEXT NOT NULL DEFAULT 'qualification'
    CHECK (program_type IN ('qualification','course','event','other')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_training_programs_status_created
ON training_programs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS training_requirements (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('module','assessment','practical')),
  max_points REAL,
  passing_percentage REAL NOT NULL DEFAULT 60
    CHECK (passing_percentage >= 0 AND passing_percentage <= 100),
  is_required INTEGER NOT NULL DEFAULT 1
    CHECK (is_required IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE,
  CHECK (
    (item_type = 'assessment' AND max_points IS NOT NULL AND max_points > 0)
    OR (item_type != 'assessment' AND max_points IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_training_requirements_program_order
ON training_requirements(program_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  team_name TEXT,
  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled','in_progress','completed','on_hold')),
  notes TEXT,
  enrolled_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE,
  UNIQUE (program_id, discord_user_id)
);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_program
ON training_enrollments(program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_discord
ON training_enrollments(discord_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS training_progress (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  requirement_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','completed')),
  notes TEXT,
  completed_by_discord_id TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES training_enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_id) REFERENCES training_requirements(id) ON DELETE CASCADE,
  UNIQUE (enrollment_id, requirement_id)
);
CREATE INDEX IF NOT EXISTS idx_training_progress_enrollment
ON training_progress(enrollment_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS training_assessment_attempts (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  requirement_id TEXT NOT NULL,
  score REAL NOT NULL CHECK (score >= 0),
  max_points REAL NOT NULL CHECK (max_points > 0),
  passed INTEGER NOT NULL CHECK (passed IN (0,1)),
  notes TEXT,
  assessed_by_discord_id TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES training_enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_id) REFERENCES training_requirements(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_training_attempts_enrollment
ON training_assessment_attempts(enrollment_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_attempts_requirement
ON training_assessment_attempts(requirement_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS staff_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  acknowledgement_required INTEGER NOT NULL DEFAULT 0 CHECK (acknowledgement_required IN (0,1)),
  acknowledgement_due_at TEXT,
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (acknowledgement_required = 0 AND acknowledgement_due_at IS NULL)
    OR (acknowledgement_required = 1 AND acknowledgement_due_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_staff_announcements_created
ON staff_announcements(created_at DESC);

CREATE TABLE IF NOT EXISTS staff_announcement_acknowledgements (
  announcement_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, discord_user_id),
  FOREIGN KEY (announcement_id) REFERENCES staff_announcements(id) ON DELETE CASCADE
);


-- ============================================================
-- Retire only the four known starter rows; do not touch manager-created questions.
UPDATE application_questions
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE id IN ('stak-q-experience','stak-q-availability','stak-q-scenario-1','stak-q-scenario-2');

-- Full public question set reconciled from the 17-page Tally form. The identifying
-- fields (Discord username, Discord ID and preferred name) remain the fixed
-- application fields so they are stored in the dedicated searchable columns.
INSERT OR IGNORE INTO application_questions
(id, question_key, section_title, prompt, help_text, question_type, options_json,
 is_required, is_active, sort_order, page_number, depends_on_question_key, depends_on_value)
VALUES
('stak-tally-age','age','Persönliche Angaben','Wie alt bist du?','', 'text','[]',1,1,201,2,NULL,NULL),
('stak-tally-community-time','community_time','Persönliche Angaben','Seit wann bist du Teil der STAK-Community?','Zum Beispiel: Seit 2023.', 'text','[]',1,1,202,2,NULL,NULL),
('stak-tally-platform','primary_platform','Plattform und Aktivität','Auf welcher Plattform spielst bzw. moderierst du hauptsächlich?','', 'single_choice','["PC / Laptop","PlayStation","Xbox","Smartphone","Tablet","Sonstige"]',1,1,301,3,NULL,NULL),
('stak-tally-hours','daily_availability','Verfügbarkeit und Aktivität','Wie viel Zeit kannst du durchschnittlich täglich für STAK aufbringen?','', 'single_choice','["Unter 1 Stunde","1–2 Stunden","2–3 Stunden","3–5 Stunden","Mehr als 5 Stunden"]',1,1,401,4,NULL,NULL),
('stak-tally-days','available_days','Verfügbarkeit und Aktivität','An welchen Tagen bist du normalerweise verfügbar?','', 'multiple_choice','["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"]',1,1,402,4,NULL,NULL),
('stak-tally-time-of-day','available_times','Verfügbarkeit und Aktivität','Zu welchen Tageszeiten bist du normalerweise überwiegend verfügbar?','', 'multiple_choice','["Vormittags","Mittags","Nachmittags","Abends","Nachts"]',1,1,403,4,NULL,NULL),
('stak-tally-commitments','recurring_commitments','Verfügbarkeit und Aktivität','Gibt es regelmäßige Verpflichtungen oder Umstände, die deine Aktivität bei STAK beeinflussen können?','Falls ja, erläutere bitte kurz, zu welchen Zeiten oder in welchem Umfang dies normalerweise der Fall ist. Keine sensiblen Details notwendig.', 'textarea','[]',1,1,404,4,NULL,NULL),
('stak-tally-has-experience','has_staff_experience','Erfahrung und Qualifikationen','Hast du bereits Erfahrungen in einem Moderations-, Support-, Administrations- oder Leitungsteam gesammelt?','Vorherige Staff-Erfahrung ist kein zwingendes Kriterium.', 'single_choice','["Ja","Nein"]',1,1,501,5,NULL,NULL),
('stak-tally-previous-teams','previous_teams','Erfahrung und Qualifikationen','In welchen Teams, Projekten oder Communities warst du bisher tätig und welche Positionen hattest du dort?','Nenne Projekt/Server, Position und ca. Dauer.', 'textarea','[]',1,1,502,5,'has_staff_experience','Ja'),
('stak-tally-previous-duties','previous_duties','Erfahrung und Qualifikationen','Welche konkreten Aufgaben und Verantwortlichkeiten hast du dort übernommen?','', 'textarea','[]',1,1,503,5,'has_staff_experience','Ja'),
('stak-tally-transferable-experience','transferable_experience','Erfahrung und Qualifikationen','Welche Erfahrungen aus diesen Tätigkeiten könnten dir bei STAK helfen?','', 'textarea','[]',1,1,504,5,'has_staff_experience','Ja'),
('stak-tally-strengths','strengths','Erfahrung und Qualifikationen','Welche Fähigkeiten, Erfahrungen oder persönlichen Stärken bringst du für eine verantwortungsvolle Tätigkeit im STAK-Staff mit?','Vorherige Staff-Erfahrung ist kein zwingendes Kriterium. Entscheidend sind persönliche Reife, Verantwortungsbewusstsein, Kommunikationsfähigkeit und Lernbereitschaft.', 'textarea','[]',1,1,505,5,NULL,NULL),
('stak-tally-motivation','motivation','Motivation und Erwartungen','Warum möchtest du Teil des STAK-Staffs werden?','', 'textarea','[]',1,1,601,6,NULL,NULL),
('stak-tally-contribution','contribution','Motivation und Erwartungen','Welchen konkreten Beitrag möchtest du zur Community und zum Team leisten?','', 'textarea','[]',1,1,602,6,NULL,NULL),
('stak-tally-role-expectation','role_expectation','Motivation und Erwartungen','Was bedeutet eine Staff-Position für dich, und warum sollte eine solche Position deiner Meinung nach nicht ausschließlich aufgrund von Rechten oder einem höheren Rang angestrebt werden?','', 'textarea','[]',1,1,603,6,NULL,NULL),
('stak-tally-three-traits','three_traits','Persönlichkeit und Verantwortungsbewusstsein','Welche drei Eigenschaften beschreiben dich am besten? Begründe deine Auswahl.','', 'textarea','[]',1,1,701,7,NULL,NULL),
('stak-tally-weakness','weakness','Persönlichkeit und Verantwortungsbewusstsein','Welche persönliche Schwäche könnte dir in einer Staff-Position zum Problem werden und wie gehst du damit um?','', 'textarea','[]',1,1,702,7,NULL,NULL),
('stak-tally-criticism','handling_criticism','Persönlichkeit und Verantwortungsbewusstsein','Wie gehst du damit um, wenn deine eigene Entscheidung von einem Nutzer oder einem anderen Teammitglied kritisiert wird?','', 'textarea','[]',1,1,703,7,NULL,NULL),
('stak-tally-own-error','correcting_own_error','Persönlichkeit und Verantwortungsbewusstsein','Was tust du, wenn du im Nachhinein erkennst, dass eine eigene Entscheidung falsch oder auf unvollständigen Informationen basiert?','', 'textarea','[]',1,1,704,7,NULL,NULL),
('stak-tally-fairness','fairness','Regelverständnis und Fairness','Was bedeutet für dich neutrales, faires und objektives Verhalten gegenüber der Community?','Die folgenden Fragen dienen dazu, das Verständnis von Fairness, Neutralität, Verantwortung und professionellem Verhalten zu beurteilen. Entscheidend sind Qualität der Begründung, nachvollziehbares Vorgehen und sachliche Einschätzung.', 'textarea','[]',1,1,801,8,NULL,NULL),
('stak-tally-friend-violation','friend_violation','Regelverständnis und Fairness','Ein guter Freund von dir verstößt gegen eine Regel und du bist das einzige Staff-Mitglied, das den Vorfall bemerkt. Wie gehst du mit dieser Situation um?','Beschreibe dein konkretes Vorgehen und begründe deine Entscheidung.', 'textarea','[]',1,1,802,8,NULL,NULL),
('stak-tally-disagree-senior','disagree_with_senior','Regelverständnis und Fairness','Du bist mit der Entscheidung eines höhergestellten Teammitglieds nicht einverstanden. Wie gehst du damit um?','Beschreibe, wie du deine eigene Meinung sachlich einbringst und gleichzeitig professionell mit der Situation umgehst.', 'textarea','[]',1,1,803,8,NULL,NULL),
('stak-tally-scenario-disrespect','scenario_disrespect','Praxis- und Situationsbeurteilung','Szenario 1 – Wiederholt respektloser Nutzer','Ein Nutzer verhält sich wiederholt respektlos und provoziert andere Mitglieder. Mehrere Personen fordern das Staff-Mitglied auf, ihn sofort zu sanktionieren. Der Nutzer behauptet gleichzeitig, selbst provoziert worden zu sein. Beschreibe dein Vorgehen Schritt für Schritt. Welche Informationen würdest du zunächst prüfen? Wie würdest du zwischen den Aussagen der beteiligten Personen unterscheiden? Wie würdest du anschließend über eine angemessene Reaktion entscheiden? Begründe dein Vorgehen.', 'textarea','[]',1,1,901,9,NULL,NULL),
('stak-tally-scenario-error','scenario_own_error','Praxis- und Situationsbeurteilung','Szenario 2 – Eigene Fehlentscheidung','Du hast als Staff-Mitglied eine Entscheidung getroffen. Kurz darauf stellst du fest, dass du wichtige Informationen übersehen hast und deine Entscheidung möglicherweise falsch war. Wie gehst du mit der Situation um? Was würdest du gegenüber dem betroffenen Nutzer tun? Was würdest du intern gegenüber deinem Team tun?', 'textarea','[]',1,1,902,9,NULL,NULL),
('stak-tally-scenario-staff','scenario_staff_conduct','Praxis- und Situationsbeurteilung','Szenario 3 – Verhalten eines Teammitglieds','Du bemerkst, dass ein anderes Teammitglied einen Nutzer deiner Meinung nach unangemessen behandelt. Gleichzeitig bist du dir nicht sicher, ob du alle Hintergründe kennst. Wie gehst du vor? Wie stellst du sicher, dass du nicht vorschnell urteilst, aber einen möglicherweise problematischen Vorgang trotzdem angemessen behandelst?', 'textarea','[]',1,1,903,9,NULL,NULL),
('stak-tally-scenario-unsure','scenario_uncertainty','Praxis- und Situationsbeurteilung','Szenario 4 – Unsicherheit und Eskalation','Du bist dir bei einem Vorfall unsicher und weißt nicht genau, welche Regel anzuwenden ist oder welche Maßnahme angemessen wäre. Wie gehst du vor, bevor du eine Entscheidung triffst? Wann würdest du ein höhergestelltes Teammitglied hinzuziehen?', 'textarea','[]',1,1,904,9,NULL,NULL),
('stak-tally-scenario-conflict','scenario_staff_conflict','Praxis- und Situationsbeurteilung','Szenario 5 – Konflikt zwischen Staff-Mitgliedern','Zwei Staff-Mitglieder haben unterschiedliche Auffassungen über einen Vorfall. Wie gehst du vor, um den Konflikt sachlich zu lösen? Wie stellst du Zusammenarbeit sicher, ohne öffentlich zu eskalieren?', 'textarea','[]',1,1,905,9,NULL,NULL),
('stak-tally-scenario-pressure','scenario_community_pressure','Praxis- und Situationsbeurteilung','Szenario 6 – Druck aus der Community','Mehrere Community-Mitglieder üben Druck aus und fordern eine sofortige Sanktion gegen jemanden, während die Sachlage noch nicht eindeutig geklärt ist. Wie gehst du mit diesem Druck um? Wie bewahrst du Neutralität und triffst eine fundierte Entscheidung?', 'textarea','[]',1,1,906,9,NULL,NULL),
('stak-tally-angry-user','angry_user_response','Kommunikation unter Druck','Staff-Mitglieder müssen auch in angespannten Situationen sachlich und professionell kommunizieren können. Formuliere eine professionelle Antwort auf diese Nachricht: „Was ist das bitte für ein Müll? Ihr seid komplett unfähig. Ich wurde einfach bestraft, obwohl ich nichts gemacht habe. Entfernt die Strafe sofort, sonst bin ich weg.“','Die Antwort sollte ruhig, sachlich, respektvoll, deeskalierend und nachvollziehbar sein.', 'textarea','[]',1,1,1001,10,NULL,NULL),
('stak-tally-confidentiality','confidentiality','Vertraulichkeit und interne Informationen','Wie gehst du mit Informationen um, die du innerhalb des Staff-Teams erhältst und die nicht für die Öffentlichkeit bestimmt sind?','', 'textarea','[]',1,1,1101,11,NULL,NULL),
('stak-tally-friend-asks-info','friend_asks_internal_info','Vertraulichkeit und interne Informationen','Ein Freund oder Community-Mitglied fragt dich nach internen Informationen über eine Staff-Entscheidung, ein Ticket oder einen internen Vorgang. Wie gehst du damit um?','', 'textarea','[]',1,1,1102,11,NULL,NULL),
('stak-tally-permissions','permissions_responsibility','Umgang mit Berechtigungen','Was bedeutet für dich der verantwortungsvolle Umgang mit Staff- oder Verwaltungsberechtigungen?','', 'textarea','[]',1,1,1201,12,NULL,NULL),
('stak-tally-permissions-scope','permissions-scope','Umgang mit Berechtigungen','Du besitzt eine Berechtigung, mit der du etwas verändern könntest, bist dir aber nicht sicher, ob diese Änderung zu deinem Aufgabenbereich gehört. Wie gehst du vor?','', 'textarea','[]',1,1,1202,12,NULL,NULL),
('stak-tally-self-qualified','self_assessment','Persönliche Einschätzung','Was spricht aus deiner Sicht dafür, dass du eine verantwortungsvolle Position innerhalb des STAK-Staffs übernehmen kannst?','', 'textarea','[]',1,1,1301,13,NULL,NULL),
('stak-tally-growth','development_area','Persönliche Einschätzung','Was glaubst du, woran du als neues Staff-Mitglied zunächst arbeiten müsstest?','', 'textarea','[]',1,1,1302,13,NULL,NULL),
('stak-tally-anything-else','anything_else','Persönliche Einschätzung','Gibt es noch etwas, das wir über dich, deine Erfahrungen oder deine Bewerbung wissen sollten?','', 'textarea','[]',1,1,1303,13,NULL,NULL);
-- Retain the old form's agreement language and confirmations in the unpublished
-- draft. They remain hidden from applicants until an authorized owner publishes
-- a reviewed policy and privacy notice.
UPDATE policy_versions
SET policy_content = policy_content || char(10) || char(10) ||
  'STAK Staff- und Berechtigungsvereinbarung (Version 1.0)' || char(10) ||
  'Mit der Aufnahme in das STAK-Staff-Team können dir je nach Aufgabenbereich besondere Berechtigungen übertragen werden. Diese Berechtigungen werden ausschließlich zur Erfüllung deiner vorgesehenen Aufgaben innerhalb des STAK-Teams erteilt.' || char(10) ||
  'Die übertragenen Rechte dürfen nicht zu privaten Zwecken, zum persönlichen Vorteil, zur Durchsetzung eigener Interessen oder zum Nachteil anderer Mitglieder, des Teams oder des Servers genutzt werden. Insbesondere ist es untersagt, Berechtigungen eigenmächtig zu erweitern, weiterzugeben, auszunutzen oder Sicherheitsvorkehrungen zu umgehen. Ebenso sind unberechtigte Änderungen, Löschungen oder sonstige Eingriffe in wichtige Serverstrukturen untersagt.' || char(10) ||
  'Ein vorsätzlicher oder grob fahrlässiger Missbrauch von Staff- oder Verwaltungsberechtigungen kann zum sofortigen Entzug der entsprechenden Berechtigungen sowie zu weiteren internen Maßnahmen führen. STAK behält sich bei vorsätzlichem oder möglicherweise rechtswidrigem Verhalten außerdem vor, vorhandene Nachweise und relevante Informationen zu sichern und, soweit rechtlich zulässig und erforderlich, weitere rechtliche Schritte zu prüfen bzw. einzuleiten.'
WHERE id = 'stak-policy-draft-1' AND status = 'draft'
  AND instr(policy_content, 'STAK Staff- und Berechtigungsvereinbarung (Version 1.0)') = 0;

INSERT OR IGNORE INTO policy_acknowledgements
(id, policy_version_id, acknowledgement_key, label, explanation, sort_order, is_required, acknowledgement_type)
VALUES
('stak-tally-ack-authority','stak-policy-draft-1','staff_authority','Ich habe verstanden, dass mir übertragene Staff- und Verwaltungsberechtigungen ausschließlich für meinen vorgesehenen Aufgabenbereich zur Verfügung stehen und dass ein Missbrauch dieser Berechtigungen zu Konsequenzen bis hin zum Ausschluss aus dem STAK-Team sowie – soweit rechtlich zulässig und erforderlich – zu weiteren rechtlichen Schritten führen kann.','Ja, ich bestätige.',10,1,'policy'),
('stak-tally-ack-rules','stak-policy-draft-1','server_rules','Ich habe die STAK Serverregeln gelesen und verstanden.','Ja, ich bestätige.',11,1,'policy'),
('stak-tally-ack-handbook','stak-policy-draft-1','staff_handbook','Ich habe das STAK Staff-Handbuch gelesen und verstanden.','Ja, ich bestätige.',12,1,'policy'),
('stak-tally-ack-agreement','stak-policy-draft-1','staff_agreement','Ich habe diese Staff- und Berechtigungsvereinbarung vollständig gelesen und verstanden.','Ja, ich bestätige.',13,1,'policy'),
('stak-tally-ack-duties','stak-policy-draft-1','accept_duties','Ich akzeptiere die darin festgelegten Pflichten und Regeln.','Ja, ich bestätige.',14,1,'policy'),
('stak-tally-ack-no-misuse','stak-policy-draft-1','no_permission_misuse','Ich verpflichte mich, meine übertragenen Staff-Berechtigungen ausschließlich bestimmungsgemäß zu verwenden und nicht zu missbrauchen.','Ja, ich bestätige.',15,1,'policy'),
('stak-tally-ack-internal-measures','stak-policy-draft-1','internal_measures','Ich akzeptiere, dass Verstöße gegen interne Regelungen zum Entzug von Berechtigungen und zu weiteren internen Maßnahmen führen können.','Ja, ich bestätige.',16,1,'policy'),
('stak-tally-ack-accuracy','stak-policy-draft-1','application_accuracy','Ich bestätige die Richtigkeit meiner angegebenen Daten.','Ja, ich bestätige.',17,1,'policy');
-- END OF SCHEMA
-- ============================================================

-- Authenticated application and onboarding additions (migration 0009).
CREATE TABLE IF NOT EXISTS staff_guideline_acceptances (
  discord_user_id TEXT NOT NULL,
  policy_version_id TEXT NOT NULL,
  accepted_keys_json TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (discord_user_id, policy_version_id),
  FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_staff_guideline_acceptances_version
ON staff_guideline_acceptances(policy_version_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS privacy_notice_acknowledgements (
  discord_user_id TEXT NOT NULL,
  policy_version_id TEXT NOT NULL,
  notice_hash TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (discord_user_id, policy_version_id, notice_hash),
  FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_privacy_acknowledgements_version
ON privacy_notice_acknowledgements(policy_version_id, acknowledged_at DESC);

CREATE TABLE IF NOT EXISTS application_submission_rate_limits (
  discord_user_id TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  submission_count INTEGER NOT NULL DEFAULT 0 CHECK (submission_count >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  discord_user_id TEXT NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('community','staff')),
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed','skipped')),
  completed_at TEXT,
  skipped_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (discord_user_id, area, version),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND skipped_at IS NULL)
    OR (status = 'skipped' AND skipped_at IS NOT NULL AND completed_at IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_area_updated
ON user_onboarding_progress(area, updated_at DESC);

UPDATE policy_versions
SET version = '1.1-draft',
    title = 'Staff Guidelines and Application Agreement',
    introduction = 'Draft for STAK review. This version is based on the closing Staff Guidelines and application agreement sections of the legacy Tally form. It must be reviewed and published by STAK before applicants can acknowledge it.',
    policy_content = 'STAFF GUIDELINES AND APPLICATION AGREEMENT\n\n1. Applying to join the STAK team\nA role in the STAK staff team carries responsibility toward the community and the team. STAK expects reliability, sound judgement, professional conduct, discretion and respectful communication. An application is reviewed by the authorized team. Submitting one does not guarantee acceptance, and no review deadline is promised.\n\n2. Scope of a staff role\nStaff responsibilities and permissions depend on the duties assigned to each person. A title or access level does not authorize every action. Ask for guidance or escalate when a matter is outside your assigned responsibilities.\n\n3. Use of staff permissions\nAny Discord, website or game permissions granted after acceptance are for assigned STAK duties only. Do not use them for personal advantage, retaliation, intimidation, favoritism or private disputes. Do not share access, expand permissions yourself, bypass safeguards, or make unauthorized changes to server structures or records.\n\n4. Fair decisions and accurate records\nConsider relevant context and available evidence. Keep facts separate from assumptions, disclose conflicts of interest, and correct mistakes openly. Do not invent, alter or hide information to influence a decision. Escalate cases that are uncertain or outside your authority.\n\n5. Confidentiality and privacy\nStaff may handle reports, applications, personal data and internal discussions. Access and share that information only as needed for an assigned duty, and keep it in approved STAK channels. The internal Staff Handbook is provided for staff onboarding; it is not a public application document. STAK Community Rules remain available in Discord.\n\n6. Application answers and next steps\nProvide complete, truthful answers in your own words. STAK may contact you through Discord for follow-up information. If accepted, you will receive the internal staff onboarding and assigned training. Required training must be completed and approved before ticket handling is permitted.\n\n7. Review of concerns\nMisuse of permissions, dishonest records or confidentiality breaches may lead to an internal review and proportionate access or team measures based on the available facts and applicable rules. No automatic sanction or legal consequence is created by this draft.\n\n8. Current version\nOnly a version marked Published in the STAK portal is current. A published update may require a new acknowledgement before a further application can be submitted.',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'stak-policy-draft-1' AND status = 'draft';

UPDATE policy_acknowledgements
SET label = 'I have read and understood the current published Staff Guidelines and application agreement.',
    explanation = 'This acknowledgement applies to the version shown above. It is recorded with your Discord account and the time you confirm it.',
    is_required = 1,
    acknowledgement_type = 'policy'
WHERE policy_version_id = 'stak-policy-draft-1' AND acknowledgement_key = 'rules';
UPDATE policy_acknowledgements
SET label = 'I understand that staff permissions are limited to the STAK duties assigned to me and must not be shared or misused.',
    explanation = 'Permissions do not authorize personal use, retaliation, favoritism or actions outside your assigned responsibilities.',
    is_required = 1,
    acknowledgement_type = 'policy'
WHERE policy_version_id = 'stak-policy-draft-1' AND acknowledgement_key = 'authority';
UPDATE policy_acknowledgements
SET label = 'I understand the confidentiality and privacy responsibilities described in the Staff Guidelines.',
    explanation = 'Internal information and personal data must be accessed and shared only when necessary for an assigned STAK duty.',
    is_required = 1,
    acknowledgement_type = 'policy'
WHERE policy_version_id = 'stak-policy-draft-1' AND acknowledgement_key = 'confidentiality';
UPDATE policy_acknowledgements
SET label = 'I confirm that my application answers are truthful, complete and my own.',
    explanation = 'Submitting an application does not guarantee acceptance into the STAK team.',
    is_required = 1,
    acknowledgement_type = 'policy'
WHERE policy_version_id = 'stak-policy-draft-1' AND acknowledgement_key = 'accuracy';
UPDATE policy_acknowledgements
SET is_required = 0
WHERE policy_version_id = 'stak-policy-draft-1'
  AND acknowledgement_key IN (
    'staff_handbook', 'server_rules', 'staff_authority', 'staff_agreement', 'accept_duties',
    'no_permission_misuse', 'internal_measures', 'application_accuracy'
  );

-- Migration 0010_academy_records_and_delivery.sql
-- In-site STAK Academy, immutable review history, sanction events and bot outbox.
CREATE TABLE IF NOT EXISTS academy_assignments (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  course_key TEXT NOT NULL,
  course_version TEXT NOT NULL,
  role_at_assignment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','submitted','changes_requested','approved')),
  assigned_by_discord_id TEXT NOT NULL,
  supersedes_assignment_id TEXT,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_academy_assignments_member
ON academy_assignments(discord_user_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_assignments_review
ON academy_assignments(status, course_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS academy_lesson_completions (
  assignment_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id, lesson_id),
  FOREIGN KEY (assignment_id) REFERENCES academy_assignments(id)
);

CREATE TABLE IF NOT EXISTS academy_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  submission_number INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  practical_response TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','changes_requested','approved')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by_discord_id TEXT,
  reviewed_at TEXT,
  reviewer_notes TEXT,
  FOREIGN KEY (assignment_id) REFERENCES academy_assignments(id),
  UNIQUE (assignment_id, submission_number)
);
CREATE INDEX IF NOT EXISTS idx_academy_submissions_assignment
ON academy_submissions(assignment_id, submission_number DESC);

CREATE TABLE IF NOT EXISTS academy_history (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  actor_discord_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES academy_assignments(id)
);
CREATE INDEX IF NOT EXISTS idx_academy_history_assignment
ON academy_history(assignment_id, created_at DESC);

-- A lifted sanction is a separate event. Legacy lifted rows remain readable.
CREATE TABLE IF NOT EXISTS sanction_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('lifted','reinstated','corrected')),
  reason TEXT NOT NULL,
  actor_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (case_id) REFERENCES cases(id)
);
CREATE INDEX IF NOT EXISTS idx_sanction_events_case
ON sanction_events(case_id, created_at DESC);

-- Bot integration consumes a durable outbox; pending is not shown as delivered.
CREATE TABLE IF NOT EXISTS staff_announcement_outbox (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'staff_announcement_created',
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (announcement_id) REFERENCES staff_announcements(id)
);
CREATE INDEX IF NOT EXISTS idx_announcement_outbox_status
ON staff_announcement_outbox(status, created_at);

CREATE TABLE IF NOT EXISTS staff_announcement_delivery_receipts (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  recipient_discord_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','delivered','failed')),
  error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (announcement_id, recipient_discord_id),
  FOREIGN KEY (announcement_id) REFERENCES staff_announcements(id)
);
