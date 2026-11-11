-- STAK public recruitment, policy acceptance and audit workflow.
-- Apply this migration to the existing D1 database before deploying the new code.
ALTER TABLE discord_sessions ADD COLUMN role_checked_at TEXT;


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
