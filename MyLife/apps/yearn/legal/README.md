# Yearn legal site

Static pages for the Yearn dating app. The shipped app links these EXACT paths,
so the host must serve clean URLs (no `.html`):

| App link | File |
|---|---|
| `https://yearn.app/terms` | `terms.html` (onboarding + You tab) |
| `https://yearn.app/privacy` | `privacy.html` (onboarding + You tab; App Store Connect Privacy Policy URL) |
| `https://yearn.app/guidelines` | `guidelines.html` (onboarding + You tab) |

Canonical URLs live in `src/lib/legalLinks.ts`. If the domain changes, update
that file and this table together.

## Deploy

Any static host works. Cloudflare Pages and Vercel serve `/terms` from
`terms.html` automatically (clean URLs on by default for Pages; for Vercel add
`"cleanUrls": true` in a `vercel.json`). Netlify needs "Pretty URLs" enabled.
Point the `yearn.app` apex + `www` at the host and enforce HTTPS.

## Before going live (founder review)

1. Read all three documents once; they were drafted 2026-07-11 to match the
   shipped app behavior (self-attested 18+ gate, E2EE intros/chat, private photo
   storage with signed URLs, coarse location only, in-app block/report, in-app
   account deletion, no analytics/tracking).
2. Governing law is drafted as California; confirm or change (`terms.html` §9).
3. Set the App Store Connect Privacy Policy URL to `https://yearn.app/privacy`
   and the age rating to 18+ before submission.
4. Confirm the `support@`, `safety@`, and `privacy@yearn.app` inboxes exist and
   are monitored; `guidelines.html` commits to acting on reports within 24h.
5. Have a lawyer review before public (non-TestFlight) launch.
