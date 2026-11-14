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
