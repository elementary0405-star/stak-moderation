# STAK Moderation

STAK Moderation is the shared website for community access, staff applications, staff operations, Academy training and moderation records. It uses the existing Vinext/React and Cloudflare Workers/D1 stack.

## Website areas

- The public start page contains the STAK identity and one **Connect with Discord** action. OAuth routes verified community members and staff to their respective areas. Staff-role access takes priority.
- The Community Area has exactly two destinations: **Staff Application** and **Staff Guidelines**. Community Rules remain on Discord. The private Staff Handbook is not a public application prerequisite.
- Applications use the verified Discord identity, imported Tally questions, versioned guideline acknowledgement, a separate privacy acknowledgement and private management review. Recruitment stays closed until STAK publishes a complete privacy notice and configures Turnstile.
- The Staff Hub includes personal staff records, absences, announcements, a clickable staff directory, warning history, application review and Academy approvals.
- STAK Academy runs in the website. It contains General Staff Training (including ticket handling), Ingame Training, Staff Manager Training and Management Training. Lesson completion, submissions, feedback, approvals and repeat assignments are retained by Discord account and course version. Completion requires approval by a higher authorized role; no pass score, retry limit or course deadline is invented.
- Cases and sanctions are linked to player records by normalized Game Name + Player ID. Discord details are optional. A player record can exist without a case. Sanction lifts are stored as additional events.
- The website records announcements and queues an outbox event. Discord delivery is shown as pending until a bot integration reports actual delivery. The bot must poll the internal endpoints described below; this repository does not contain the active bot source.

## Local configuration

Copy `.dev.vars.example` to `.dev.vars` and supply the local Discord OAuth client ID/secret, bot token and (if enabling applications) Cloudflare Turnstile site/secret keys. Do not commit `.dev.vars` or real credentials. The local OAuth redirect must exactly match the URI registered with Discord, such as `http://localhost:3001/api/auth/discord/callback`.

Run the local site with `npm run dev:vinext` (port 3001). Existing login cannot work until Discord credentials, the registered redirect URI, a working D1 binding, and Discord role configuration are supplied.

The bot integration uses `Authorization: Bearer <DISCORD_BOT_TOKEN>`:

- `GET /api/internal/bot/announcements` claims one queued announcement. The bot should deliver it through Discord and report the outcome to the same route with `PATCH` (`outboxId`, `status`, and recipient delivery results).
- `GET /api/internal/bot/academy/eligibility?discordUserId=<id>` returns `ticketHandlingEnabled` only when the current General Staff Training version has been approved. Ticket handling is not enforced by this website alone; the bot must verify the member's current Discord role and check this endpoint before granting ticket actions. Managers can requeue a failed delivery from the announcements page.

## Data and deployment

- Apply the top-level files in `migrations/` in order to a local or staging database before exercising database-backed features. `schema.sql` is a reference schema snapshot.
- Migrations `0009_authenticated_application_and_onboarding.sql` and `0010_academy_records_and_delivery.sql` add account-bound acknowledgements, onboarding, the website Academy, sanction events and the bot outbox.
- No production database migration or deployment was performed while preparing this project. Review and back up the intended D1 database before any future production rollout.
- Recruitment remains closed by default. Before publishing a privacy notice or opening recruitment, STAK must supply accurate controller/contact details, purposes, lawful basis, processors, retention periods, rights and any transfer information. Technical placeholder checks do not constitute legal review.
- Website content and Discord moderation rules have distinct owners. Do not copy internal-only material into the public area or expose secrets in browser code.

## Verification

`npm run build:vinext` and `npx tsc --noEmit` are the current build/type checks. OAuth and Discord delivery still require configured credentials and a connected bot to verify end to end. Do not treat a successful local build as proof of production configuration.
