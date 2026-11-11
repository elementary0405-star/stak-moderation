PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE staff_users_new (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (
        role IN (
            'host',
            'administrator',
            'moderator'
        )
    ),
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
);

INSERT INTO staff_users_new (
    id,
    username,
    password_hash,
    role,
    is_active,
    must_change_password,
    created_at,
    updated_at,
    last_login_at
)
SELECT
    id,
    username,
    password_hash,
    'moderator',
    is_active,
    must_change_password,
    created_at,
    updated_at,
    last_login_at
FROM staff_users;

DROP TABLE staff_users;

ALTER TABLE staff_users_new RENAME TO staff_users;

COMMIT;

PRAGMA foreign_keys = ON;