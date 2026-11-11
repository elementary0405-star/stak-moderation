# Scope summary

This reconstructed portal centralises staff administration and moderation records on the website. The Discord bot is expected to remain focused on Discord-native member/community functions and direct Discord actions.

## Included modules

- Workspace overview
- Personal Team Hub
- Staff Records and status
- Absences
- Warnings and resolution history
- Staff tickets
- Feedback submission and Owner-only inbox
- Central player records and identities
- Cases with case number, action type, reason, duration/status and history
- Ban/sanction overview and lifting flow
- Evidence links
- Staff resource pages

## Excluded modules

- Bewerbung / application intake and processing
- Ausbildung / online staff qualification

## Open integration items

- Confirm Discord application values, role IDs and production redirect URL.
- Confirm whether staff ticket conversations are expected to sync with Discord tickets.
- Confirm the approved handbook/community rules text.
- Decide whether evidence files should use Cloudflare R2 rather than external HTTPS links.
- Review all permissions against the final STAK role matrix.
- Merge/compare this reconstructed baseline with the actual existing repository before production use.
