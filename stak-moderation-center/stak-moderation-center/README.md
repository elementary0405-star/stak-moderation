# STAK Moderation Center — standalone starter project

This ZIP is a **best-effort reconstruction from the project details available in the conversation**, not a verified export of the user's current local repository. It provides a coherent application structure and baseline flows for the website. Because the original repository archive was not supplied, existing files, database contents, production secrets, exact Discord role IDs and any unshared UI decisions could not be merged or verified.

## Included

- Discord OAuth2 sign-in and STAK guild-membership verification
- Role-based page/API access (Owner, Co-Owner, Management, Staff Manager, Moderator, Trail Moderator, Community Member)
- Overview dashboard and Team Hub
- Staff records, absence management, warnings/history, staff tickets and feedback
- Owner-only Feedback Inbox
- Player Records, case list, Case ID detail page, sanctions list and link-based evidence
- Handbook, Ticket Guide and Community Guidelines starter pages
- D1 schema migration and audit log
- Cloudflare/Vinext project configuration

**Excluded:** application handling (Bewerbung) and staff training (Ausbildung), as requested.

## Important limitations to review before production

1. The Case ID detail page and Sanction Records page have been rebuilt as valid, separate `page.tsx` route modules. This addresses the reported `.tsx`/page-structure problem in this reconstructed version, but the exact original compiler/runtime error could not be diagnosed without the original repository and error output.
2. Evidence is stored as HTTPS links only. Binary file upload and R2 storage are not implemented.
3. The starter Handbook and Community Guidelines are not the official approved STAK policy text. Replace them with the current authoritative text before relying on them.
4. There is no application system, training course, bot command integration, or automated Discord role management in this ZIP.
5. The original Cloudflare D1 database ID and KV namespace ID are not embedded. Configure your own values and review the migration before applying it.
6. No production deployment or live database migration has been run.

## Setup

1. Install Node.js (current LTS) and npm.
2. Run `npm install` in this folder.
3. Copy `.dev.vars.example` to `.dev.vars` and fill in Discord OAuth credentials, Bot Token, Guild ID, role IDs and a random `SESSION_SECRET` (at least 32 characters).
4. In the Discord Developer Portal, add the exact value of `DISCORD_REDIRECT_URI` as an OAuth2 redirect URI. Enable the required bot access to read guild members.
5. Configure a Cloudflare D1 database named `stak-moderation-db` and a KV namespace. Put their IDs in `wrangler.jsonc`.
6. Review `migrations/0001_initial_schema.sql`, then apply it to a **new/test D1 database first**.
7. Run `npm run dev` and open `http://localhost:3001` (the local session cookie expires after one hour).
8. Run `npm run typecheck` and `npm run build` before deployment.

## Discord role configuration

Set the IDs of your STAK roles in `.dev.vars`/Cloudflare Worker secrets. The highest role wins in this order: Owner → Co-Owner → Management → Staff Manager → Moderator → Trail Moderator. A verified guild member without one of those configured roles receives Community Member access.

## Routes

- `/` — Overview
- `/team-hub` — Team Hub
- `/staff/records` — Staff Records
- `/staff/absences` — Absence Management
- `/staff/warnings` — Warnings & History
- `/staff/tickets` — Staff Tickets
- `/feedback` — Feedback Box
- `/feedback/inbox` — Owner-only Feedback Inbox
- `/case/records/player-records` — Player Records
- `/case/records/cases` — Moderation Cases
- `/case/records/cases/[caseId]` — Case detail
- `/case/records/sanctions` — Ban & Sanction Records
- `/resources/handbook` — Handbook starter
- `/resources/ticket-guide` — Ticket Guide starter
- `/guidelines` — Community Guidelines starter

## API notes

All write routes validate input and require role-based access. Changes to staff and moderation records are appended to `audit_logs`. The route handlers use Cloudflare's `cloudflare:workers` D1 binding and therefore require the configured Cloudflare/Vinext runtime.
