# 2026-07-05 Meerkat Investor Report Diff Review (Fable vs GPT)

## What was done
Reviewed and diagnosed `REPORT-meerkat-investor-technical-review-2026-07-04-fable.html` vs `-2026-07-05-gpt.html`, then verified both against git history and the codebase.

## Provenance (git-verified)
- Both were authored the same evening against the same tree: GPT explicitly bases on `aaa8bace` (2026-07-04 22:05); GPT report committed `4261165c` (22:19), Fable report committed `ec1f1d6f` (00:01 on 07-05).
- Both are now 27 commits behind HEAD `15dd851e`. All 27 are Plan 38 (data hub, libraries, retheming, playback) which neither report covers.

## The material difference: what $4.99 is
- Fable: $4.99/month hosted subscription as the launch SKU ("Launch price: $4.99/mo" hero chip, 50 GB bundled in), citing `MEERKAT_HOSTED_MONTHLY_PRODUCT` (`packages/billing-config/src/index.ts:136-140`, verified real: price 4.99, type monthly, 3 entitlements).
- GPT: $4.99 one-time app unlock + separate hosted-storage subscriptions; flags monetization as "decision-gated: resolve one-time versus subscription copy."
- Ground truth: Plan 22 (`docs/plans/queue/22-meerkat-monetization-and-billing.md`) is titled "$4.99 one-time app + freemium server-space billing," documents the three contradictory meanings of $4.99 in the codebase, and resolves them as: $4.99 = one-time `meerkat_app_unlock`; the hosted monthly SKU gets REPRICED off cost-plus and is "no longer $4.99." `docs/plans/meerkat-launch-orchestration.md:16` also states "$4.99 one-time app."
- Verdict: GPT matches the founder-locked model. Fable anchored on the stale billing-config SKU that Plan 22 explicitly marks for repricing; Fable Sections 5-6 and the hero chip need correction before investor use (or a founder decision to change the model, which would contradict Plan 22).

## Other accuracy findings
- Fable test counts 1,559/698/465/325 = 3,047: verified against `docs/sessions/2026-07-04-meerkat-ux-parity-close.md`. Accurate at review date; stale now (Plan 38 close records sync 1692/relay 347/mobile 953/web 643+).
- Fable legacy storage SKUs (1 GB free / 5 GB $2.99 / 25 GB $5.99): verified in billing-config.
- Fable "remaining work is operational, not inventive": overstated and internally inconsistent with its own roadmap row; at review time Plan 37 codeable work remained (Plan 23 Wave 1, Plan 24 P3 route enforcement, Plan 27 P4/P5, Plan 29 P2-P6) and calls (Plan 25) were unbuilt. GPT's remaining-work list matches Plan 37/memory almost verbatim.
- GPT counts at `aaa8bace`: claimed 808 tracked / 306 test files / ~92.5k TS lines; actual 836 / 317 / 187k raw (117k non-test). Directionally right, small undercounts; the line figure only plausible as a cloc-style code-line count.
- Storage-ladder recommendations differ by fill-rate assumption, not math error: Fable prices 2 TB at $10.99 assuming 30% fill (~$9.20 cost); GPT prices $14.99 using R2 full-fill ($30.72). Both arithmetics check out; founder judgment call.

## Verification
Doc/analysis-only session; no function logic changed, function gate skipped per rule.
