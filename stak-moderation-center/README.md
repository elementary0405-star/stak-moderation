# STAK Moderation Center — integrated project package

This package updates the existing STAK Moderation Center project in place. It keeps the existing Next.js/Vinext/Cloudflare architecture and adds the public recruitment workflow, versioned policy acknowledgements, management-side application review, the STAK Academy entry point, and the security/database fixes documented below.

## What is included

- Public landing area with two distinct entry cards: **Staff Application** and **Guidelines & Acknowledgements**.
- Public guidelines page that only serves a published policy version.
- Required, individual policy acknowledgements stored against a browser session, the exact policy version and timestamp.
- Application page that stays locked until the currently published acknowledgements are complete and recruitment is opened by management.
- Server-side enforcement of the PC/laptop requirement. PlayStation, Xbox, smartphone, tablet and other device selections cannot be submitted.
- Configurable application questions, with question snapshots preserved on each submitted application.
- Management inbox for review, statuses, internal notes and an append-only status history.
- Management builders for application questions, policy wording and individual acknowledgement requirements.
- Policy versioning: an active published version remains active while a new draft is edited. Publishing a new version archives the former version and requires applicants to acknowledge the new version.
- Cloudflare Turnstile anti-bot validation. Public recruitment cannot be opened until both the public site key and server secret are configured and tokens can be validated server-side.
- Discord role revalidation at least once per 60 seconds, with access failing closed when Discord cannot be verified.
- STAK Academy page connected to a configurable Moodle/Gnomio course URL. Moodle remains the source of truth for course completion and grades.
- The full Staff Qualification master package and the technical baseline audit are included under `docs/` for reference.

## Important default state

The new public workflow is deliberately **not live by default**:

- `application_settings.recruitment_open` is seeded as `0` (closed).
- Policy version `1.0-draft` is seeded as a draft, not a published policy.
- The privacy notice contains explicit placeholders and cannot be published until STAK supplies and verifies the actual controller/contact details, purposes, legal bases, recipients/processors, retention periods and rights information.
- The initial questions are editable starter questions based on the requirements confirmed in chat. They are **not** claimed to be a complete transcription of the 17-page Tally form.

This avoids opening a live recruitment process with incomplete rules or invented legal statements.

## Install and verify on Windows

1. Make a backup of the current project folder and ensure your existing Cloudflare D1 database is backed up before changing the schema.
2. Use Node.js **22.23.0 or newer in the 22.x line** (or a supported newer major version). The supplied `cf` toolchain dependency declares this minimum.
3. In the project folder run:

   ```powershell
   npm ci
   ```

4. Check the unapplied D1 migrations:

   ```powershell
   npx wrangler d1 migrations list stak-moderation-db --remote
   ```

5. Apply the migrations and review the confirmation prompt carefully:

   ```powershell
   npx wrangler d1 migrations apply stak-moderation-db --remote
   ```

   The active migrations are only the top-level SQL files in `migrations/`. Wrangler prompts for confirmation and captures a backup after applying; keep your own backup as well. Older misplaced migration files are retained under `archive/legacy-migrations/` and must not be run blindly.

6. Configure the public, non-secret values in `wrangler.jsonc`:
   - `MOODLE_COURSE_URL`: the confirmed STAK Academy course URL.
   - `TURNSTILE_SITE_KEY`: Cloudflare Turnstile site key, or leave empty to leave Turnstile disabled.

7. Save `TURNSTILE_SECRET_KEY` as a Cloudflare Worker secret (never in source control), for example with `npx wrangler secret put TURNSTILE_SECRET_KEY`. Both the site key and secret are required before management can open public recruitment.

8. Ensure the existing Discord OAuth and bot secrets are configured in Cloudflare. In particular, `DISCORD_BOT_TOKEN` is required for periodic live role verification. Never put bot tokens or OAuth client secrets in `wrangler.jsonc`, `.dev.vars.example`, or committed files.

9. Run the existing project build:

   ```powershell
   npm run build:vinext
   ```

10. Review the build output and local behavior before deploying. Do not deploy if the build reports errors.

## First management setup after deployment

1. Sign in with an account that has Staff Manager access or higher.
2. Open **Team Hub → Staff Applications**.
3. Open **Policy Builder** and replace all draft policy/privacy text with the approved STAK documents. Add/remove/edit the individual acknowledgement checkboxes as needed.
4. Save the draft. The existing published policy, if any, remains active until a new draft is published.
5. Have the responsible STAK decision-makers review the policy and privacy notice. The publish endpoint blocks bracketed placeholders and draft language, but this technical check is not legal review.
6. Publish the policy version.
7. Open **Form Builder** and reconcile the starter questions against the actual 17-page Tally form. Use the question editor to add, edit, deactivate, reorder and mark fields as required/optional.
8. Test the full public flow in a fresh browser session: guidelines → each required acknowledgement → application → PC/laptop eligibility → submit → management inbox.
9. Only then switch **Public recruitment is open** on.

## Application and policy design notes

- Anonymous visitors receive a random, HttpOnly, SameSite=Lax browser cookie (with the `__Host-` prefix on HTTPS). Only a SHA-256 hash is stored in D1; the application feature does not persist an IP address. If Turnstile is enabled, its own processing must also be described in the privacy notice.
- The acceptance record stores the policy version, accepted acknowledgement keys and timestamp. A new policy version requires a new acknowledgement.
- Every application keeps a snapshot of the questions as they appeared when it was submitted, so later form edits do not rewrite historical submissions.
- Applications are restricted to Staff Manager and higher. Every read/write management route performs a server-side authorization check; hiding a link in the interface is not treated as a security boundary.
- Public submission checks same-origin request signals, uses a honeypot, prevents a second active application for the same browser session or supplied Discord ID, and requires Turnstile before recruitment can be opened.
- The primary device is checked on both client and server. Only `pc` and `laptop` are eligible.
- No email/Discord notification is sent by this package. Status history and notes are persisted in D1; outbound notification integration can be added after the workflow is verified.
- No automated retention/erasure schedule is activated. STAK must set retention rules and implement/operate the appropriate fulfilment process before publishing the privacy notice.

## Known items requiring follow-up before the platform is considered final

1. **Tally form:** the provided public URL exposes only page 1 of 17 to the available page reader. The complete original questions/logic have not been recovered. The admin Form Builder is usable, but its four seeded questions are a starter set, not a certified copy of Tally.
2. **Legal/privacy approval:** STAK must fill the privacy notice accurately and verify its legal position before publication. The starter policy is an operational draft, not legal advice.
3. **Moodle progress sync:** the Staff Training page links to the Gnomio course and correctly does not invent Moodle progress. A verified Moodle API/SSO integration is a separate follow-up.
4. **Build verification:** the project dependencies could not be installed in the build container during this preparation, so a full production build was not confirmed here. Run `npm ci` and `npm run build:vinext` locally before deployment.
5. **Existing platform areas:** this package retains existing systems and corrects the known warnings route path and Discord role verification. It does not claim that every existing placeholder/system has become a complete production feature; consult `docs/TECHNICAL_BASELINE_2026-11-10.md` for the initial audit.

## Official technical references used

- Next.js authentication and server-side authorization: <https://nextjs.org/docs/app/guides/authentication>
- Next.js Route Handlers: <https://nextjs.org/docs/app/getting-started/route-handlers>
- Cloudflare D1 migrations: <https://developers.cloudflare.com/d1/reference/migrations/>
- Cloudflare Wrangler D1 migration commands: <https://developers.cloudflare.com/workers/wrangler/commands/d1/>
- Cloudflare Turnstile setup and mandatory server-side validation: <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>
- OWASP CSRF prevention guidance: <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>

These references inform implementation patterns; they do not certify the deployment, data protection compliance or the suitability of STAK's legal texts.
