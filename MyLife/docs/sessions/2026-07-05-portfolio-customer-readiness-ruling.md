# Session Log: Portfolio Customer-Readiness Ruling (2026-07-05)

## What was done

Founder asked for a full adversarial evaluation of every module and application in MyLife, with a final GO/NO-GO decision per product plus gaps and resolution paths. Executed as 8 parallel read-only audit agents (one per product/cluster), each verifying claims against code at HEAD `fbef9997` on `feature/meerkat-launch-completion` (apps audited are tree-equivalent to main). Final rulings made by the lead session as the adversarial decider.

Deliverables:
- `docs/reports/REPORT-mylife-portfolio-readiness-2026-07-05.md` + `.html` twin (opened in browser)
- This session log
- memory.md row + errors_log rows for new CRITs

## Final rulings

0 of 8 products GO. All NO-GO, ranked by distance to GO: DoWork (~1-2 wk), Manhattan (~1 wk ops + device QA, code itself is GO), MyNews (~1 wk ops to read-mostly beta), Hub mobile (~2-3 wk), Meerkat (~2-4 wk), Hub web (shape decision then 1-8 wk), BestChef (~3+ mo, vendor critical path), Yearn (~7-9+ wk, hard stop on safety).

## Agent evidence (condensed, file:line anchors)

### Meerkat (NO-GO)
- Cannot build: Metro export fails on dynamic `require(name)` at `apps/meerkat/app/(root)/data/ble-backend.ts:99` and `nearby-backend.ts:66` (errors_log row 13 Unresolved). No icon/splash assets; `apps/meerkat/assets` does not exist.
- Cannot connect: `DEFAULT_RELAY_URL` resolves '' (`sync-core.ts:119-131`, `app.config.ts:153`); no relay/community-node/directory/TURN deployed (runbook confirms; CI down on GH billing).
- Cannot pay: no IAP SDK in either surface; `MEERKAT_HOSTED_MONTHLY_PRODUCT` catalog-only (`packages/billing-config/src/index.ts:144-178`); hosted entitlements fail closed (`hosted-boundaries.ts:30-32,92`); no Stripe on web; meerkat-web has no deploy target.
- Legal: no privacy/ToS/support/delete-my-data (Plan 23 Ph3 unbuilt). Moderation un-hide bug (errors_log row 12, `community-safety.ts:244-281`). Export-compliance mismatch: `ITSAppUsesNonExemptEncryption:false` on an E2EE app.
- Real EAS projectId exists (`app.json:98`). Onboarding works offline ("Just look around", `onboarding-core.ts:18-23`).

### BestChef (NO-GO, confirming same-day world-launch audit)
All 5 CRITs re-verified live at HEAD (= audit commit, zero code changes since):
1. `kitchen-photo.tsx:42,107` -> `kitchen.ts:1492-1494`: SAMPLE_GROCERY_PHOTO_JSON short-circuits recognition in public builds (fake "Organic Milk"/"Bananas").
2. `recipe/[id].tsx:382-389`: Pad Thai fallback on empty ingredients, ungated by `shouldShowDemoContent()`.
3. No IAP/Stripe SDK anywhere; `tips.ts:84` / `subscriptions.ts:166` fabricate `pi_`/`sub_` ids via Date.now(); zero UI callers.
4. `20260428000016_storage_policies.sql:65-67` public pre-moderation bucket read; no CSAM/NCMEC (grep empty); no GDPR export.
5. `scripts/check-i18n-parity.mjs:44` key-only diff; `ja.ts` contains byte-identical English values.
Road-to-GO: immediate codeable (CRIT-1/2 + value-identity gate, hours) then Tier 0 (~6-8 wk, vendor) / Tier 1 (~6-8 wk) / Tier 2 (~3-5 wk). Binding deploy gate: migrations 20260703000002..6 + 20260704000001..2 before build 25.

### DoWork (NO-GO)
- C1 CONFIRMED on main + launch branch + checkout: engine boots idle (`modules/workouts/src/workout/engine.ts:44`), only START transitions idle->playing (`:62-65`), COMPLETE_SET requires playing (`:132`); `apps/dowork/app/(root)/session.tsx:240` never dispatches START (repo-wide grep zero); Mark Complete disabled outside playing (`session.tsx:874`). Fix ~15-30 min.
- C2 STALE/CLOSED: `git rev-list origin/main..origin/feature/dowork-trainer-launch` = 0; merged via `d8070864` 2026-07-04.
- Build gate: `check-build-env.mjs` (eas-build-pre-install) fails production builds without RC keys; RC products not created (F3). `eas.json` ascAppId `REPLACE_WITH_ASC_APP_ID` (F2). Legal drafted `apps/dowork/legal/`, unhosted, hardcoded dowork.app URLs (F5).
- HIGH honesty findings for triage: Home fake volume (reps*10), streak math on gaps, body-map exerciseId-as-muscleGroup, generator ignores equipment, superset setGroupId, 500MiB/500MB copy gap.

### Manhattan (NO-GO to submit; code GO)
- No `extra.eas.projectId` (`app.json:96-98`); eas.json has real ascAppId 6763167108 + appleId; no Android submit block; only a local `expo export` from 06-08 exists.
- Paywall fails closed by construction: test mode requires `__DEV__` (`launch-environment.ts:96-102`); `check-build-env.mjs:33-53` hard-fails misconfigured production builds; UnlockGate honest-disabled without RC.
- Data honest without ops: NYC Open Data live keyless (`sources/nyc-open-data.ts:98-117`); SeatGeek absent -> `[]` (`seatgeek.ts:121`); gap adapters render dimmed "coming" chips, never fake events.
- 258 statically counted test cases; native seams (notifications, device-calendar, RC adapter, share) untested and never device-run.
- Blockers: EAS init, RC products `mylife_manhattan_unlock`, legal/data-safety, first-ever device QA. SeatGeek proxy undeployed (optional at launch).

### Yearn (NO-GO hard)
- Backend real (`kclsicgiutrtymjtuizq` hardcoded, `launchEnvironment.ts:32`), E2EE chat real (tweetnacl, `messages_ciphertext`).
- CRIT: no CSAM/NCMEC anywhere; no yearn-* edge functions at all; photos stored/served unscanned (18 U.S.C. 2258A exposure).
- CRIT: reports table has no moderation queue/admin/SLA; report/block UI only pre-match (`DiscoverDeck.tsx:427-881`), chat surface has only archive (`YearnSocialSurfaces.tsx:347-478`).
- HIGH: no realtime/no polling (fetch once on thread open, `:327`); expo-location dep with zero imports vs "nearby people" permission copy (rejection risk); no EAS projectId, no submit block, no ASC, no push.

### MyNews (NO-GO operational)
- Correction: editing desk migration + all 3 edge functions (publish 178 / review 276 / suggest 215 lines) committed on main, not on a worktree.
- Entirely env-gated, honest empty states, no hardcoded project: no Supabase provisioned so every surface dormant (`launch-environment.ts:3-7`).
- No web deploy config; no EAS projectId (ASC submit block exists but shares ascAppId 6763167108 with Manhattan: anomaly, at least one wrong).
- No moderation/takedown/DMCA anywhere; trust-spine plan not authored. Gates public UGC, not the read-mostly beta.

### MyLife Hub mobile (NO-GO)
- Real EAS projectId `f959f4b7`, ASC 6761207231, bundle `com.mytoolbox.mylife`.
- CRIT: `packages/entitlements/src/test-mode.ts` `_testMode = true` hardcoded; `gates.ts:29` short-circuits unlocked; `react-native-purchases` not a dependency; `createPaymentService` built with no SDK/key (`_layout.tsx:210-218`).
- HIGH: no store assets/metadata; unresolved `ModuleHeader.tsx(40,23) TS7053` typecheck error (errors_log 07-03).
- No analytics SDK (privacy claim holds). Health permission strings name wrong apps (cosmetic).

### MyLife Hub web (NO-GO as hosted)
- No deploy config anywhere for the hub (only meerkat-relay has render.yaml); single-file better-sqlite3 at cwd (`lib/db.ts:66-70`); dev DB committed (`apps/web/mylife-hub.db*`); no multi-tenancy in local/self-host modes.
- Stripe not a dependency; `purchaseViaStripe` -> `getSDK()` throws "Stripe not initialized" (`packages/subscription/src/stripe.ts:24-26`).
- Ahead on legal: /legal/privacy + /legal/terms, account deletion, per-module export routes. Hidden modules correctly filtered from Discover by release state.

### Module fleet (41 IDs)
- Release states (41 IDs total): GA {budget, habits, health, meds, recipes}; beta 13 {books, classes, cycle, forums, garden, market, mood, nutrition, presence, stars, trails, travel, workouts}; hidden 23. Web override (`apps/web/lib/modules.ts:56`) promotes dining, manhattan, rsvp, sleep, sports.
- CRIT: forums + market user-visible with undeployed backends (schemas only at `modules/{forums,market}/src/cloud/schema.sql`, absent from supabase/migrations; seed migration self-skips).
- HIGH: health GA `add-med.tsx:8` "Coming soon" reachable from `vitals.tsx:136,146`; presence screen-time bridge stub (`(presence)/(tabs)/index.tsx:283-285`) though focus-session core is real; voice hollow (zero audio-capture references, "dictation" is a TextInput modal), correctly hidden.
- MED: 15 committed `" 2.tsx"` dup route files (notes 8, books 5, journal 1, flash 1); surf/homes definition-vs-registry storageType drift; sports live-scores feed unverified on web.
- payments/MyPay verified sealed: in HIDDEN_MODULE_IDS, excluded from web override, dual-control `modules/payments/src/launch/` intact.
- Hub `recipes` ModuleId defined in `modules/bestchef/src/definition.ts:467` (sqlite `rc_`, requiresNetwork false); its social/cloud screens tie into the BestChef backend, hence SHIP-with-caution.

## Systemic findings
S1 revenue impossible portfolio-wide (test-mode hardcode + no payment SDKs; only DoWork/Manhattan have real billing paths). S2 legal corpus debt everywhere. S3 one shared T&S hole (CSAM/NCMEC/moderation) across BestChef/Yearn/Meerkat-public/MyNews; procure one vendor. S4 distribution debt (only BestChef ever built; shared ascAppId anomaly Manhattan=MyNews=6763167108). S5 honesty held except BestChef sample-data leaks; recommend repo-wide gate: no SAMPLE_* reachable when demo policy off. S6 same-day docs already stale twice (DoWork C2 merged; MyNews on main); decide from code.

## Verification
Read-only session: no code changed, no gates required (no function logic modified). Report .html twin created and opened per Report Artifacts rule.

## Remaining items / follow-ups
- Founder decisions: Meerkat paid-vs-free execution, Hub web product shape, Yearn invest-vs-park, DoWork revenue split (F4).
- Fix queue seeded from this report (DoWork START first).
- Resolve the Manhattan/MyNews shared ascAppId before any submission.
