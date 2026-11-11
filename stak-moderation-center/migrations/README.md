# Active Cloudflare D1 migrations

The active migration folder is configured as `migrations_dir` in `wrangler.jsonc`. Apply migrations in order to the existing `stak-moderation-db` database.

- `0005_public_applications_and_policies.sql`: live Discord-role verification timestamp, public application visitor sessions, policy versions/acknowledgements, configurable application questions, applications, review notes and history. Seeds an unpublished policy draft and editable starter questions.
- `0006_case_counters.sql`: ensures the case number sequence table exists and seeds it from existing cases.

The old migration files are kept under `archive/legacy-migrations/` and must not be run blindly.
