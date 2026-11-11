-- ============================================================
-- STAK MODERATION CENTER
-- Migration 0004: Case Number Sequences
-- ============================================================

CREATE TABLE IF NOT EXISTS case_counters (
    year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
        CHECK (last_number >= 0)
);

-- Preserve existing case numbers when migrating an existing DB.
INSERT OR IGNORE INTO case_counters (year, last_number)
SELECT
    CAST(substr(case_number, 6, 4) AS INTEGER),
    MAX(CAST(substr(case_number, 11) AS INTEGER))
FROM cases
WHERE case_number GLOB 'STAK-[0-9][0-9][0-9][0-9]-[0-9]*'
GROUP BY CAST(substr(case_number, 6, 4) AS INTEGER);

-- ============================================================
-- END OF MIGRATION
-- ============================================================