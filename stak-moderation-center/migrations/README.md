# Active Cloudflare D1 migrations

Wrangler uses this top-level folder as `migrations_dir`. Apply migrations in numeric order to the intended database. Production migrations were not run as part of this work.

- `0005_public_applications_and_policies.sql`: public applications, policy versions/acknowledgements, question builder and review history.
- `0006_case_counters.sql`: atomic case-number sequence table, seeded from existing cases.
- `0007_training_progress.sql`: legacy general training register tables. Historical rows remain intact; mutation endpoints are retired. The public Academy now uses the in-site versioned workflow added in `0010`.
- `0008_announcements_and_tally_application.sql`: staff announcements and acknowledgements plus the imported Tally question flow.
- `0009_authenticated_application_and_onboarding.sql`: Discord-bound Staff Guidelines acknowledgement, separate privacy acknowledgement, application throttling and per-account/version introduction progress; updates only the known unpublished draft policy.
- `0010_academy_records_and_delivery.sql`: in-site Academy assignments, lesson progress, submission/review history, append-only sanction events, and announcement delivery outbox/receipts.

Files under `archive/legacy-migrations/` are preserved but are not part of Wrangler's configured migration directory. Do not run them blindly.
