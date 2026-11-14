# Tally application form reconciliation

Source: <https://tally.so/r/XxXPxO>

The supplied Tally form was inspected from its rendered page data on 2026-11-13. Its 17 pages contain 161 form blocks. The active application question set imported into the database migration preserves the historical wording, choices, required settings, page flow and three conditional follow-up questions. Applicant name and Discord ID are supplied by the verified Discord session rather than trusted form fields.

## Important interpretation

- The old form asks applicants about their platform/device, with choices including PC/laptop, console, smartphone, tablet and other. This is a question about platform availability; the materials do **not** establish a hard PC/laptop eligibility requirement. The website does not reject applicants by device.
- The three questions about previous teams and duties appear only when the applicant answers yes to prior staff experience.
- The old form links to the Staff Handbook and asks for agreement-related confirmations. The attached handbook is marked internal. The website therefore uses a separate, published applicant-facing Staff Guidelines agreement. It does not publish the handbook or require applicants to acknowledge internal handbook or Discord community rules.
- Guideline acknowledgement is recorded against the authenticated Discord user, exact published version and timestamp. The privacy notice is a separate confirmation and stores its own version and time.

## Current operational state

- Recruitment is closed by default. It cannot be opened until an approved policy version, completed privacy notice and server-side Turnstile verification are configured.
- Management can review applications and status history. Applicants can see their own status/reference but not internal reviewer notes.
- The imported historical question set must still be reviewed by STAK for current relevance and wording before opening recruitment. Do not treat this reconciliation as a legal review or as permission to publish the old internal agreement.
