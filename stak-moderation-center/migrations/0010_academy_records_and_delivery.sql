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

