-- Bind application acknowledgements to the authenticated Discord account.
-- Existing visitor-based acceptance and application records are retained.
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

-- Rework only the known unpublished draft. Published policy versions and their
-- historical acceptances are not changed. These statements preserve the Tally
-- agreement's substance while removing the internal-handbook acknowledgement
-- and all public Community Rules content.
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

-- Keep legacy rows for history, but never expose internal handbook or Discord
-- Community Rules confirmations as public website requirements.
UPDATE policy_acknowledgements
SET is_required = 0
WHERE policy_version_id = 'stak-policy-draft-1'
  AND acknowledgement_key IN (
    'staff_handbook', 'server_rules', 'staff_authority', 'staff_agreement', 'accept_duties',
    'no_permission_misuse', 'internal_measures', 'application_accuracy'
  );
