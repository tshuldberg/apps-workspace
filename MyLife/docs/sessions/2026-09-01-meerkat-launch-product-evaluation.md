# Meerkat Launch and Product Evaluation

Date: 2026-09-01

Branch: `docs/meerkat-launch-guides-2026-09-01` at `ee80cd7b`

## What

Evaluated the full Meerkat Git history and current code against three founder goals stated this session: App Store launch, Venmo/Signal-class QR add-friend, and de-techifying the app to replace TikTok, Facebook, Reddit, Reels, Slack, and Discord. Report: `docs/reports/REPORT-meerkat-launch-product-evaluation-2026-09-01.md` (HTML twin beside it, opened in the browser).

## Findings

- History: 422 Meerkat commits (Apr 10, Jun 76, Jul 260, Aug 65, Sep 8), one author, 21 plans done / 5 active / 15 queued. July was hardening, August was composition (plan 56). Every "make it easy" plan (16, 29, 31, 52, 53) shipped but the defaults still expose the manual Listen / Sync now model.
- Launch: no code blocker for the private tier. Remaining items are founder-ops (counsel, NCMEC, DMCA, Stripe, APNs, LiveKit, CI billing) plus R1/R2 from the technical review.
- QR add-friend exists (`QrCode.tsx`, `QrScanner.tsx`, `add-friend.tsx`) but: QR encodes the bare `MEER-` string, no `meerkat://friend` route or universal link (`app.json` has no `associatedDomains`), the code on Me is unpublished and the rendezvous record is one-time and TTL-bound, add requires a connection server, web cannot scan.
- Jargon audit (2,567 user-visible strings, 127 files): device 321, server 141, verif- 113, key 83, sync 81, sign- 68, identity 67, encrypt- 59, pair- 54.
- Platform replacement scores: Slack 7, Discord 6, Facebook 4, Reddit 4, TikTok/Reels 0 (no vertical video anywhere; `expo-video` used only by the library player). Cold start is unsolved: no starter communities.

## Recommendations

1. Founder: prove the build 17 purchase, engage counsel, start NCMEC, fix CI billing.
2. Agent wave: R1, R2, and the two provider catch blocks.
3. First post-launch update as one plan (suggested plan 59): standing friend code with auto-republish, QR as universal link with install-then-resume, one-tap add that opens the DM, automatic connections on by default, push default on once APNs exists, Me/Settings split, glossary pass with parity locks, three to five baked-in starter communities.
4. Then friends-only personal posts (community of one owner), then a separate Clips plan with an on-device ranker.

## Plan 59 authored

Founder chose "Author plan 59" and added "also include evaluating and adjusting the UI/UX to be more user friendly". Wrote `docs/plans/queue/59-meerkat-for-everyone.md` (+ HTML twin) and the kickoff prompt `docs/prompts/59-meerkat-for-everyone-kickoff.md`. Eight sections: S1 standing friend code (new non-consuming sealed `identity` lane on the relay; today's rendezvous is 10-minute TTL and consumed on first resolve at `hub.ts:208`), S2 friend links + universal links + AASA/assetlinks static routes + install-then-resume, S3 one-tap add ending in a DM with the safety check relocated, S4 defaults (auto connections on, background + push on where a gateway exists, Sync screen under Advanced), S5 UI/UX evaluation-then-adjustment pass with an 8-item rubric and named per-screen changes (Feed, Communities, Messages, Me, Settings split, onboarding, upgrade, web), S6 glossary table + `COPY_TWINS` parity lock + forbidden-word scan, S7 starter communities via open join grants, S8 stranger test + battery + docs. Clips stays a separate design-first plan.

## Files

- `docs/plans/queue/59-meerkat-for-everyone.md` (+ `.html`)
- `docs/prompts/59-meerkat-for-everyone-kickoff.md`
- `docs/reports/REPORT-meerkat-launch-product-evaluation-2026-09-01.md` (+ `.html`)
- `docs/reports/README.md`
- `memory.md`
- this log

## Verification

Docs only; no function logic changed, so `pnpm gate:function:changed` was not required. The jargon audit script lives in the session scratchpad (`jargon.py`) and its counts are recorded in the report.

## Remaining

Founder decision on the recommended order; whether to author plan 59 now.
