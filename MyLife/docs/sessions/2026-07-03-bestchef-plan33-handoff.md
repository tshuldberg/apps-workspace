# BestChef Plan 33 Handoff: Continue Launch Execution (written 2026-07-03, session 2 close)

You are continuing execution of the BestChef global-launch plan. Read this doc, then the
plan, then start building. Do not re-derive the review; it is done and verified.

## Authoritative documents (read in this order)

1. `docs/plans/queue/33-bestchef-global-launch-7-languages.md` - THE plan. Its
   "Status Delta (2026-07-03, session 2)" section is the ground truth for what is done.
2. `docs/reports/REPORT-bestchef-adversarial-production-review-2026-07-03.md` - the
   findings (N1-N17) the plan phases map to.
3. `docs/sessions/2026-07-03-bestchef-plan33-phase1-2-execution.md` - session 2 log
   (decisions, traps, verification detail).
4. `apps/bestchef/CLAUDE.md` - app conventions, EAS contract, launch-state honesty.

## Repo state

- **Branch:** `feature/meerkat-launch-finish` (SHARED with active Meerkat sessions;
  their uncommitted working-tree changes may be present. Stage ONLY BestChef-scoped
  paths: `apps/bestchef/`, `modules/bestchef/`, `supabase/`, `packages/ui` if touched,
  and docs. Never `git add -A`. CRITICAL: a parallel session may have files STAGED
  at any moment, and `git add <paths> && git commit` commits the whole index. Use
  pathspec commits instead: `git commit <your paths> -m ...` commits only those
  paths and leaves the rest of the index untouched. This bit session 2 once; fixed
  with `git reset --soft HEAD~1` + a pathspec re-commit.)
- **BestChef commits, session 2:** `50efdad8` (integrity floor SQL), `cfe042e9`
  (error codes localized), `d7e9b465` (block reconciliation), `7b426ee9`
  (legal + age gates + appeals), `4d7a623f` (notifications type+params),
  `2dfbe57a` (error states + clamp + contrast), `2eba2824` (docs). Session 1
  (Phase 0): `506422a7..2efa6581`. All unpushed; push only when the founder asks.
- **DONE:** Phases 0, 1.2, 1.5, 1.7, 2.1, and 5.1-partial/5.3/5.4-partial.
- **Migrations added:** `supabase/migrations/20260703000002_bestchef_integrity_floor.sql`,
  `...000003_bestchef_appeals.sql`, `...000004_bestchef_notifications_i18n.sql`.
  Applied to the LOCAL stack only. Prod/staging push is founder-ops (F1).
- **Suites at close:** pgTAP 125/125 (`supabase test db`), module 1150, app 303,
  @mylife/ui 29, all typechecks, i18n parity 21/21 catalogs at 825+ keys.

## Next work, in priority order

### 1. Phase 1.3: Moderator console (next codeable unit)

Build a SEPARATE minimal internal Next.js app (suggested: `apps/bestchef-console/`),
NOT a route group inside the consumer hub web app. Reason: it runs with the Supabase
service-role key server-side; it needs its own deploy target, env, and access gating
so that key can never leak into a consumer bundle. Server actions / route handlers
only; no service key in client components.

Everything it needs already exists server-side:

| Need | Exists |
|------|--------|
| Proof/report queues | `bc_moderation_queue` (kind, status, metadata incl. `cross_user_hash_reuse` flags), `bc_flags`, `bc_photo_reports` |
| Decisions | `bc_apply_vote_proof_decision(proof_id, decision, reason)`, `bc_apply_moderation_decision(...)` - service-role granted |
| Appeals queue | `bc_appeals` (status 'open'), resolve via `bc_resolve_appeal(appeal_id, 'upheld'|'overturned', reason)` - records statement of reasons; content reversal is a separate call to the decision RPCs (console composes both) |
| Evidence | existing signed-URL path for private media (see `bestchef-media-upload`/finalize patterns; vote proofs are private until approved) |
| Job health panel | `select bc_job_health()` v2 - reports config rows, cron jobs incl. `bestchef-prune-action-usage`, deletion backlog, action-quota engine state (limits rows + kill switch) |
| Ops levers | `bc_action_controls.kill_switch`, `bc_action_limits` caps, `bc_provider_controls` |

Plan requirements: queues filterable by language (UGC language tagging is Phase 2.5,
so language filter can land as a column that activates then), one-click decisions,
DSA statement-of-reasons fields (the `reason` args), appeals queue, job-health panel.
Auth gating for the console itself: founder decision needed (simplest honest v1:
Supabase auth allowlist by email + `bc_is_admin` JWT role; ask, do not invent).

### 2. Phase 2.2-2.6 (backend localization, remaining)

- 2.2 Edge functions return machine error codes + params (audit all 7).
- 2.3 `bc_dish_translations` + locale-tagged `bc_dish_aliases` search layer.
- 2.5 UGC `language` column on submissions/snapshots/comments + feed/leaderboard filter.
- 2.6 Emoji/visual keyword maps extend to translations/aliases.
- (2.1 and 2.4 are done: typed notifications; unicode slugs.)

### 3. Phase 3 (client localization completion) and remaining Phase 5

- 3.2 kill hardcoded strings (N15) + add a lint/grep gate for raw JSX literals.
- 3.3 dates/numbers/relative time to app language (two 'en-US' pins; wire the dead
  `formatRelativeTime`; `buildTimeAgo` in `modules/bestchef/src/cloud/notifications.ts`
  and `formatTimeAgo` in `cloud/activity.ts` are still English abbreviations).
- 3.5 CLDR plural engine (the rank-delta copy currently uses a crude two-form branch
  in `notification-copy.ts`, explicitly marked for replacement).
- 5.6 finish F-008 (video-feed comments) + F-010 (cloud bookmarks,
  `bc_saved_submissions`); remove `/soon`.
- 5.5 trophy moments; 5.7 IA cleanups (founder taste calls, surface with mocks).

### Vendor/founder-gated (do NOT build fake versions)

Classifiers + NCMEC (F3) - stubs still auto-approve, this blocks any public wave;
Sentry/observability (P0-09); CDN + video streaming (F4); translation review (F5);
store metadata (F6); prod dashboard verification + migration push (F1); legal page
hosting (F2, content is ready in `apps/bestchef/legal/`). If founder-ops are still
open, say so in outputs; never claim launch readiness.

## Conventions and gates (binding)

- **i18n:** natural-key catalogs at `apps/bestchef/app/(root)/i18n/catalogs/` (21
  locales). EVERY new user-facing string needs real translations in ALL 21 in the
  same commit; parity gate runs in pre-commit and `check:parity`. Registers: de=du,
  fr=tu, es=tu informal. Scratchpad insertion scripts from this session show the
  pattern (idempotent, append before file tail). Trap: `ko.ts` ends with `};` not
  `} as const;`.
- **SQL:** migrations in `supabase/migrations/` (shared dir; bestchef files carry the
  prefix). Mirror every migration verbatim onto the tail of
  `modules/bestchef/src/cloud/schema.sql` (append-ordered; later definitions
  supersede) and extend `modules/bestchef/src/cloud/__tests__/schema.test.ts` with
  textual assertions. Add pgTAP tests in `supabase/tests/` (rollback-wrapped,
  `set_config('request.jwt.claim...')` auth simulation).
- **Verify SQL for real:** Docker Desktop + `supabase migration up` + `supabase test db`
  (works locally, container `supabase_db_bestchef-staging`; no local psql binary, use
  `docker exec -i <db container> psql -U postgres -d postgres` to patch an
  already-recorded migration).
- **Gates per change:** `pnpm --filter @mylife/bestchef test`, `--filter
  @mylife/bestchef-app test`, both typechecks, parity script. Husky pre-commit runs
  the function gate + parity on staged files. Commit per logical unit, Conventional
  Commits `feat(bestchef): ...`.
- **Founder mandates:** no deferral/MVP framing (build full function); transport
  honesty (never fake capability); BestChef public flows are server-backed Supabase
  only (no mesh on launch-critical paths); no em dashes in any writing.

## Traps discovered this session (do not rediscover)

1. `create or replace view` cannot insert a column mid-list; drop + create.
2. plpgsql RETURNS TABLE output names collide with table columns inside UPDATE/WHERE
   (`status` ambiguity in bc_resolve_appeal); alias the target table.
3. Old TestFlight build 24 compat: enforcement went into TRIGGERS (not RPC swaps) on
   purpose; `bc_profile_activity_v` keeps legacy English title/subtitle columns
   (view-computed) until build 25 is the floor; new bc_notifications rows store empty
   title/body, so build 24 shows blank notification text (accepted pre-GA).
4. Comment composers previously downgraded failed cloud comments to local-only
   silently; that class is fixed, do not reintroduce fallback-on-rejection.
5. `vote.tsx` imports the global `router` from expo-router, not `useRouter`.
6. Natural-key i18n means a missing key silently renders English; the parity gate is
   the only guard. Never add a t() string without the 21-catalog batch.
7. The quota engine treats a MISSING bc_action_limits row as "no cap" (logged,
   allowed) by design; `bc_job_health()` exposes the enabled-row count. Kill switch
   intentionally does not block `bc_delete_vote`.
8. Blocks must stay indistinguishable from missing content ('submission_not_found',
   never 'blocked') on submission-scoped paths; the follow path throws 'blocked'.

## Session-close duties (same as always)

Update `memory.md` (Project State + Sessions row, keep under 80 lines), write a
session log in `docs/sessions/`, update the plan's Status Delta, capture to Open
Brain with context "personal, mylife" as you go, and append `errors_log.md` rows only
for qualifying errors. Stage BestChef paths only.
