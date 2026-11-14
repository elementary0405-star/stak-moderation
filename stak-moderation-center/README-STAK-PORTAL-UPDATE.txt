STAK MODERATION — CURRENT PORTAL IMPLEMENTATION

ACTIVE PROJECT
C:\Users\hagen\Documents\GitHub\stak-moderation\stak-moderation-center

This is the active project. Archive and copied project folders are preserved as reference and are not part of the active application.

CURRENT WEBSITE
- The public homepage is intentionally minimal: STAK identity, one Connect with Discord action and a short security note.
- OAuth sends recognized staff to /staff-area and community members to /community-area. Staff take priority. A server member without a recognized role receives a clear access notice.
- The Community Area links only to Staff Application and Staff Guidelines. Community rules stay on Discord; internal staff material is not publicly exposed.
- Applications are tied to the verified Discord account. The original Tally questions were imported; no PC/laptop exclusion is applied. Recruitment stays closed until approved policy/privacy and Turnstile configuration are complete.
- STAK Academy is in-site, with General Staff, Ingame, Staff Manager and Management courses, persistent lesson/submission history and higher-role approval.
- Staff directory entries open manager-only staff records. Player records use normalized Game Name + Player ID, may exist without a case, and retain sanction lift events separately.
- Staff announcements enter a delivery outbox. They are shown as pending until the bot reports actual Discord delivery.

LOCAL START AND CONFIGURATION
The project uses Node.js, Vinext/Vite and Cloudflare Workers/D1. Run `npm run dev:vinext` from the active project to use http://localhost:3001.
Copy `.dev.vars.example` to `.dev.vars`, then enter local OAuth, bot and (if needed) Turnstile values. The Discord OAuth redirect URI must exactly match the registered callback. No secrets belong in source control.

DATABASE AND DEPLOYMENT
Additive migrations are in the active `migrations/` folder. Migrations 0009 and 0010 add account-bound onboarding, Academy workflow, sanction history and announcement outbox. No production migration or deployment was performed. Review and back up the intended D1 database before any future production change.

VERIFICATION COMPLETED
- `npm run build:vinext` — passed.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed with line-ending conversion warnings only.

OAuth login, Discord announcements delivery and bot-side ticket gating still require configured credentials and the bot to consume the protected integration endpoints. The eligibility API is present, but the bot itself has not been changed in this website task.
