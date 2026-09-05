# BestChef Plan 33 Execution, Session 2: Trust/Safety Floor + Backend i18n (2026-07-03)

Same-day continuation of the adversarial-review session. Six work units executed in
priority order from `docs/plans/queue/33-bestchef-global-launch-7-languages.md`, all
committed on `feature/meerkat-launch-finish` (BestChef-scoped paths only; Meerkat
working-tree changes untouched).

## Commits

| Commit | Unit |
|--------|------|
| `50efdad8` | Integrity floor SQL: durable quotas, global proof dedup, server-side blocks (Phase 1.2a + 1.5 SQL) |
| `cfe042e9` | New error codes surfaced + localized, comment composers stop silently downgrading cloud rejections (Phase 1.2b) |
| `d7e9b465` | Block-store reconciliation, cloud wins / local mirrors (Phase 1.5 app half) |
| (legal/age/appeals) | Legal corpus + per-country age gates + DSA Art. 20 appeals (Phase 1.7) |
| (notifications) | Backend notifications become kind+params, no stored English (Phase 2.1) |
| `2dfbe57a` | Error states, cold-start CTAs, Dynamic Type clamp, AA contrast (Phase 5.1 partial/5.3/5.4 partial) |

## What was built

### Integrity floor (N3 + N13)
- `bc_proof_hash_ledger`: per-user GLOBAL proof-of-cook dedup keyed
  (profile_id, content_hash). Survives vote deletion by design, so
  delete+recast churn never frees a hash. Backfilled from existing proofs.
- Cross-user hash reuse (vote rings) merges `cross_user_hash_reuse` metadata
  into the proof's moderation-queue row (allowed but human-reviewed).
- `bc_delete_vote` v3: durable daily throttle (bc_action_limits `vote_delete`,
  5/day) + stamps `bc_action_usage` with submission context, powering a 24h
  recast cooldown in `bc_cast_vote` v4 (`recast_cooldown` error code).
- `bc_consume_action_quota(profile, action, context)`: CHF-1-pattern engine
  (bc_action_limits caps + bc_action_controls kill switch + bc_action_usage
  ledger + pg_cron prune job + bc_job_health v2 reporting). Enforced inside
  bc_cast_vote and via BEFORE INSERT triggers on bc_comments (integrity gate:
  approved submission + block check + parent-same-submission + quota),
  bc_flags, bc_photo_reports, bc_submission_likes, bc_comment_helpful,
  social_follows (block check + quota; suite-shared table, admin/server
  bypass), plus a 429 in the media-upload edge function. Trigger approach
  chosen over RPC swaps so existing TestFlight build 24 clients keep working
  under the new enforcement.
- Server-side blocks: `bc_blocked_between()` (security definer, not
  client-callable) wired into `bc_submission_visible`, the bc_submissions +
  bc_comments read policies, the vote path, comment path, and follow path.
  Blocks are indistinguishable from missing content by design.
- App: `rate_limited`/`recast_cooldown`/`vote_delete_rate_limited` mapped to
  typed, non-retryable, localized results; both comment composers now surface
  cloud rejections instead of silently writing a local-only comment; block
  state reconciles cloud-wins on ChefModerationRow mount.

### Legal corpus + age gates + appeals (P0-08, Phase 1.7)
- `apps/bestchef/legal/`: terms.md, privacy.md, guidelines.md,
  data-deletion.md, support.md + README. Grounded in shipped behavior; only
  `[OPERATOR LEGAL NAME]` and `[GOVERNING LAW / VENUE]` are placeholders
  (attorney decisions). Founder F2 hosts at the LEGAL_URLS destinations.
- `minimumAgeForRegion()` in `modules/bestchef/src/social/age-gate.ts`
  (GDPR Art. 8 table: 16 DE/IE/NL/HU/LT/LU/SK/HR/PL/RO, 15 FR/CZ/GR,
  14 IT/ES/AT/BG/CY, floor 13), wired into LanguageOnboardingGate via device
  region; confirmed threshold audited to rc_settings; copy parameterized.
- DSA Art. 20 appeals: `bc_appeals` (one per decision, RLS own-read),
  `bc_submit_appeal` (ownership-checked, deduped, quota 'appeal' 10/day),
  `bc_resolve_appeal` (service-role, statement of reasons). My Reports gains
  a "Decisions about your content" section with reasons, Appeal action
  (Alert.prompt, iOS-first), and appeal status.

### Backend notification i18n (N1, Phase 2.1 - load-bearing ordering)
- `bc_notifications.params jsonb`; all 6 `bc_notify_*` fanout RPCs write
  kind + structured params + actor_name column, title/body empty. Existing
  rows backfilled best-effort; legacy copy kept as explicit render fallback.
- `bc_profile_activity_v` exposes params per branch; legacy English columns
  stay (computed only) until build 25 is the floor.
- `app/(root)/i18n/notification-copy.ts`: renderNotificationCopy /
  renderActivityCopy / tierLabel; wired into NotificationRow +
  ProfileActivityPane; dates format client-side in the app language.

### Design floor (N7/N9/N10, Phase 5 partial)
- Dishes + Vote feed: distinct error+retry states (never catch-to-empty);
  loadDishCatalog now reports `error` separately from genuine emptiness.
- Cold start: empty Vote feed and leaderboard invite the first submission.
- `@mylife/ui` Text: `maxFontSizeMultiplier` default 1.4 (suite-wide).
- Saffron surfaces: ink #33200F verified 5.1:1 / 7.8:1 (white was 3.0/2.0).

## i18n
+75 keys across ALL 21 catalogs this session (integrity errors 18, age gate 3
parameterized + 3 retired, appeals 11, notifications/activity 23, error
states 5, plus previously-missing delete-dialog keys). Parity 100% enforced.

## Verification
- Live local Postgres (Docker + supabase CLI): migrations 20260703000002/3/4
  applied; `supabase test db` 125/125 pgTAP (54 new across
  bc_integrity_floor, bc_appeals, bc_notifications_i18n).
- Module suite 1150 passed; app suite 303 passed; @mylife/ui 29 passed;
  typechecks green; i18n parity gate green on every commit (pre-commit).

## Decisions
- Trigger-based enforcement instead of RPC swaps for comments/flags/likes/
  follows: covers every write path including shipped TestFlight clients.
- Kill switch does NOT block bc_delete_vote (users can always remove their
  own content); delete throttle checked manually so usage stamps only on
  real deletions.
- bc_appeals resolution records outcomes only; content reversal stays with
  the existing decision RPCs (console composes both).
- Activity view keeps legacy English columns temporarily (view-computed,
  nothing stored); notifications table stores zero new English.
- Age table ships the full documented GDPR Art. 8 set, re-verified per
  market wave (waves gate on evidence).

## pgTAP note (local)
The pgTAP fixture in bc_appeals.sql initially failed 3 tests due to a plpgsql
ambiguity (`status` output column vs table column in UPDATE ... WHERE) - fixed
with a table alias in the migration itself; the local db was patched via
docker exec psql since the migration was already recorded as applied.

## Remaining (next session)
1. **Phase 1.3 moderator console** - next codeable unit. Recommend a separate
   internal Next.js app (service-role isolation; NOT inside the consumer hub
   web app): report/proof/appeal queues by language, evidence via signed
   URLs, decisions via existing RPCs, DSA statement-of-reasons, job-health
   panel (bc_job_health v2 already reports quota-engine state).
2. Phase 2.2-2.6 (edge error codes, dish translations, UGC language tags,
   emoji maps).
3. Phase 3 client localization completion; Phases 4-6 per plan.
4. Vendor-gated: classifiers/NCMEC (F3), Sentry (P0-09), CDN/streaming (F4).
5. Founder-ops F1-F9 unchanged; prod push of migrations 20260703000002-4
   happens with F1 dashboard verification.
