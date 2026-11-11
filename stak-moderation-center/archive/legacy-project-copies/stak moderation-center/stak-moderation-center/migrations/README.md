# D1 migrations

Use a new/test database first. After configuring the `DB` binding in `wrangler.jsonc`, run:

```bash
npx wrangler d1 migrations apply stak-moderation-db --local
npx wrangler d1 migrations apply stak-moderation-db --remote
```

The remote command changes the selected Cloudflare D1 database. Confirm the database name and backup before running it. No migration is run automatically by this project.
