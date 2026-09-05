# 2026-07-10 — BestChef Adversarial Production-Readiness Audit

## What was done
Founder requested a full adversarial production-readiness audit of BestChef across the whole platform, with a git-history review, all claims confirmed in code, a 21-locale launch-full bar (7 targets: Chinese, English, Spanish, French, Japanese, Hindi, Korean), an HTML deliverable opened in Chrome, and a plan for any missing elements.

Ran a 55-agent adversarial workflow (~4.2M tokens): 12 dimension finders (backend security, trust-safety/legal, media pipeline, i18n value analysis, monetization, 15 client workflows, offline/local, ops/store, git history, prior-claim ledger, live gate/test runs, hub parity) over live code. Every critical/high finding was independently re-verified by a second opus refuter and a codex (gpt-5.5) refuter; mediums by opus; then a completeness critic. No fable agents per founder instruction. 0 of 26 re-verified findings were refuted (18 confirmed, 7 partial, 1 disputed with the framing corrected).

One safeguard trip mid-session (during report authoring); continued on Fable and skipped the tripped sub-task, keeping all security/T&S findings framed as defensive gap+remediation.

## Verdict
NO-GO for public GA and for the 21-language launch. GA (EN/US iOS) 4/10, 21-language 3/10. Confirms and refreshes the 2026-07-05 world-launch NO-GO; zero BestChef code commits since then, so every prior blocker remains live and several plan-33 "DONE" claims that imply otherwise are false. The failure is not engineering plumbing (substrate scored 8.5/10) but four themes: content honesty, trust-and-safety enforcement, legal compliance, money honesty.

## Key findings (12 critical)
Public submission-image bucket world-readable pre-moderation; submissions default `moderation_status='approved'` (unmoderated publish by direct insert); stub vote-proof classifiers auto-approve and the worker is never scheduled; no worker drains `kind='media_asset'` (submission/comment/post images unscreened); no child-safety hash-match/reporting pipeline; kitchen grocery-photo + receipt + expiration OCR + recipe-detail all fabricate sample data ungated in public builds; fabricated Stripe IDs with no processor and no creator-payout UI; anonymous sybil voting; `votes_received` challenges query nonexistent `vote_count`. Plus 18 high and 15 medium.

## What is solid (verified)
RLS on all 60 `bc_` tables (definer-only fail-closed control tables); durable server-side rate limits; correct JWT split; console service-role isolation + allowlist; contiguous v1..v33 migrations; 4/5 offline sweepers mounted; video playback works end-to-end; slugify + paste-import fixed; F-008/F-010 closed; real CLDR/RTL/notification i18n engines; all gates green and wired (328 app + 1,423 module tests).

## Localization
Presence parity genuinely 100% (21 catalogs at 994/994). Value completeness ~89-94%: every non-EN locale carries the same 52-string untranslated English batch; the parity gate is presence-only and blind to it. Zero real placeholder-token mismatches. All 7 targets present but none launch-full. Bengali/Tamil/Telugu absent (Indic expansion, not a defect).

## Files created
- `docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.md` (canonical)
- `docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.html` (twin, opened in Chrome)
- `docs/plans/queue/45-bestchef-production-readiness-remediation.md` (Tier 0-4 remediation)
- Reports index, memory.md, errors_log.md rows updated. No product code changed (audit-only per request).

## Remaining / next
Execute plan 45 Tier 0 (fabrication fixes C6-C9, moderation defaults C1-C2, media worker C4, classifiers+child-safety C3/C5/F3, sybil C11, legal H3-H5/F2, money decision C10, deletion H11-H12) before any public wave; kick off vendor procurement (F3 child-safety + classifiers, F5 translation) in week 1 as the long pole. Then Tier 1 (21-locale value gate + 52-string batch), Tier 2 (scale/ops), Tier 3 (hub parity/cleanup), Tier 4 (Indic expansion).
