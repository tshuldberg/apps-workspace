# BestChef Plan 33 Session 3: Phase 1.3 Moderator Console + Phase 2.2 Edge Error Codes (2026-07-03)

## What was done

Built `apps/bestchef-console`, the internal trust-and-safety console from plan
33 Phase 1.3, as a separate minimal Next.js 15 app (`@mylife/bestchef-console`,
port 3105). One commit: `81189d94` (44 files, ~3.6k insertions, includes
lockfile reconciliation of pre-existing dowork importer drift).

Continuation of `docs/sessions/2026-07-03-bestchef-plan33-handoff.md`. No new
SQL: the console consumes what sessions 1-2 built (bc_moderation_queue,
bc_vote_proofs, bc_flags, bc_photo_reports, bc_appeals,
bc_apply_moderation_decision, bc_resolve_appeal, bc_job_health v2,
bc_action_controls/limits, bc_provider_controls).

## Founder decisions (recorded)

1. **Console auth:** Supabase magic-link/OTP login + email allowlist
   (`BESTCHEF_CONSOLE_MODERATOR_EMAILS`, fail closed). Per handoff "ask, do
   not invent".
2. **Login mode:** `shouldCreateUser: false`. The console never creates auth
   accounts; new moderators are pre-provisioned in the Supabase dashboard.

## Architecture

- Separate app so the service-role key can never meet a consumer bundle:
  zero `NEXT_PUBLIC_*`, all data via `lib/supabase-admin.ts` (`server-only`),
  server components + form-posting server actions only.
- Authorization runs 3x: middleware (with sb-cookie short-circuit so scanner
  floods never hit the Supabase auth API), `requireModerator()` in every page
  and every server action.
- `bc_is_admin()` accepts service_role, so the existing decision RPCs work
  unchanged; moderator attribution rides `metadata.console_moderator` on
  every decision (RPC actor_profile_id is null under service role).
- Surfaces: Overview (bc_job_health panel, true queue counts, ops levers),
  /proofs (evidence via signed URLs from the private bestchef-vote-proofs
  bucket, cross-user hash-reuse badges, approve/reject), /reports (flags +
  photo reports, one-click decisions, sibling bookkeeping), /appeals
  (DSA Art. 20, statement of reasons required, optional content reversal).
- Language filter column on queues is present but dormant until Phase 2.5
  UGC language tagging (per plan).

## Review (3 parallel agents: adversarial, security, testing+maintainability; Codex declined)

18 findings, 4 critical, ALL fixed in the same commit except one skipped:

- CRITICAL trust boundary (2x, multi-agent confirmed): actOnFlag and
  resolveAppeal took decision targets from hidden form fields. Fixed:
  targets always re-derived server-side (fetchFlagTarget/fetchAppealDecision).
- CRITICAL silent lever no-op: kill-switch/limit updates now assert exactly
  1 row changed (.select() + length check) instead of trusting error:null.
- CRITICAL appeal dead-end: reversal now runs BEFORE bc_resolve_appeal, so a
  failed reversal leaves the appeal open and retryable.
- CRITICAL evidence ambiguity: signing failure now renders "evidence
  unavailable (URL signing failed)" distinct from "no evidence file"
  (tri-state on mediaAssetId), plus server-side logging.
- Informational (all fixed): signOut scope 'local' (shared project; console
  sign-out must not revoke consumer sessions), login timing floor (1s) so
  latency does not leak allowlist membership, shouldCreateUser false, known
  error-code-only banners (sanitizeErrorCode), frame-ancestors 'none' +
  X-Frame-Options DENY, sibling flag resolution after content decisions,
  "showing oldest 50 of N" truncation banners with exact counts, middleware
  cookie short-circuit, pure-logic extraction to tested lib
  (assembleProofQueueItems, buildFlagLabels, unwrapRpcRow), status-list
  constants, actionRedirects dedup, env-name constants, tests now
  typechecked via tsconfig.vitest.json.
- Skipped (documented): supabase gen types codegen (requires tooling/env;
  the hand-written row shapes are now covered by mapper unit tests instead).

## Verification

- `pnpm --filter @mylife/bestchef-console test`: 46/46 (5 files).
- typecheck (app tsc + vitest tsconfig): green. lint: green.
- `pnpm --filter @mylife/bestchef-console build`: green (7 routes, all
  dynamic, middleware 81.6 kB).
- `pnpm gate:function:changed --staged` + `pnpm check:parity --quiet`: green
  (also enforced by the pre-commit hook on the commit).
- NOT run: live boot smoke test (command declined) and live Supabase
  end-to-end (needs env + a seeded queue; do at founder-ops deploy time).

## Traps for future sessions

1. TypeScript never-call control-flow analysis requires the ROOT identifier
   of a dotted call to have an explicit type annotation:
   `const respond: ActionRedirects = actionRedirects('/x')` then
   `respond.fail(...)`. Destructured `const { fail } = ...` does NOT narrow.
2. supabase-js cannot type-parse concatenated select strings; hand-written
   row interfaces + `as unknown as` casts are the pattern, with the mapping
   logic extracted to pure tested functions.
3. supabase-js `.update().eq()` returns error:null on zero matched rows;
   any single-row mutation that matters must `.select()` and assert length.
4. bc_resolve_appeal only acts on status='open' appeals; anything composing
   reversal + resolution must reverse first or a failure is terminal.
5. The console is intentionally English-only; never add console strings to
   the consumer 21-catalog corpus.

## Founder-ops to activate the console

Own private deploy target (never consumer routing), 5 BESTCHEF_CONSOLE_* env
vars (see .env.example), Supabase Auth redirect URL
`<origin>/auth/callback` (or use the 6-digit code path via {{ .Token }} in
the email template), moderator accounts pre-provisioned. Staging ref
`tcikvihyjetsfkjjpljv`, prod `zjxabnazbdocrqpyixgo` (prod still needs F1
migration push first).

## Phase 2.2: Edge functions speak machine error codes (same session, `a8594bcb`)

Audit result: all 7 functions already returned `{ ok:false, error:{ kind,
message } }` envelopes; the REAL gap was client-side. supabase-js surfaces
non-2xx bodies as FunctionsHttpError with a generic English message; the
machine kind lives behind `error.context` (a Response) and no client code
read it, so modules fell back to English literals in the UI (N15 class).

Built:
- Server: `_shared/media.ts` validation rejections carry `code` + `params`
  (file_too_large {maxBytes, byteSize, mediaKind}, unsupported_media_type
  {mimeType}); `jsonError` in media-upload + moderate_vote_proof accepts
  params; decision_failed carries its code as a param. Statuses and success
  shapes unchanged (TestFlight build 24 compat verified by review).
- Module: `cloud/edge-errors.ts` (context.clone().json() parser, status
  fallback, strict network heuristic) + `cloud/media-errors.ts` (typed
  failures: code, English natural i18n key message, retryable, params;
  render with t(message, params)). vote-proof.ts + submission-photo.ts
  return typed MediaUploadResult; provider-broker.ts prefers the body kind
  over status classification but keeps the generic message (body message is
  ops detail and can contain raw config exception text).
- App: reviewed-vote and submit route every upload failure through a
  retryable-vs-permanent gate: transient (network/outage/unknown) failures
  queue offline drafts, permanent rejections (too large, unsupported type,
  auth, profile_required, rate_limited) show localized copy and never queue
  a forever-retrying draft. The proof-bytes PUT leg was also typed (413 ->
  file_too_large).
- i18n: +10 keys x21 catalogs (872 total, 100% parity), including
  profile_required copy ('Create your BestChef profile before uploading.')
  because the server emits kind 'auth' for both 401 missing-JWT and 403
  profile-missing; telling a signed-in user to sign in was wrong.

Adversarial review (1 agent): 13 findings, 4 critical, all fixable ones
fixed in the same commit (retryable threading in submit, PUT leg raw
English + gate bypass, missing t() on retryable vote failures, broker
config-message leak; plus 413/415 gateway classification, TypeError
heuristic, Math.floor for MB display, storage-client 413 mapping,
clone()-path tests, client/server constant parity test). One INVESTIGATE
finding deferred with a plan note: `drainPendingProofs` is never called by
app code, so queued drafts do not auto-retry despite the vote-flow copy;
flagged in plan 33 Status Delta for Phase 3.3.

Verified: module 1168 + app 303 tests, 4 typechecks (module, bestchef-app,
mobile, web), full parity suite, function gate. NOT verified live: needs a
staging/prod redeploy of bestchef-media-upload + moderate_vote_proof
(founder-ops) for the new params to flow.

## Phase 2.3: Dish translation layer (same session, `eac5f25d`)

Migration 20260703000005: `bc_dish_translations` (unique dish+locale,
lowercase-only tags via check constraint, RLS approved-or-admin reads and
admin-only writes, `updated_by` editorial attribution) and the
`bc_search_dishes` RPC. The RPC is the new search path: fully
parameterized (the old module code interpolated the user query into a
PostgREST `.or(ilike)` filter string, which broke on commas and could not
match translations), LIKE-escaped, matching canonical fields + approved
translations + aliases. Locale semantics: exact tag beats the BARE base
language and sibling regions never cross (pt-br falls back to pt, never
pt-pt; zh-hans is never served zh-hant); untagged aliases match every
locale, tagged aliases only their exact-or-base locale and never the
canonical (no-locale) surface.

Module: searchDishes rides the RPC (locale option, explicit status:null
for unfiltered), Dish gains optional localizedName/localizedDescription,
dishDisplayName/dishDisplayDescription/localizeDish helpers exported.
App: I18nProvider sets the dish-catalog locale (setDishCatalogLocale);
cache entries are locale-keyed and in-flight responses never commit after
a language change. Hub (recipes) submit picker + dish browser pass
status:null so a proposer still finds their own pending dish (RLS scopes
visibility). Console: /dishes editorial page over a 20-locale registry
(21 catalogs minus en, canonical IS English) with upsert/delete + status.

Adversarial review: 8 findings, 3 critical, all fixable fixed in-commit:
(1) the RPC's 100-row limit clamp silently truncated the 200-dish catalog
loads on every surface (now 500, an abuse ceiling, with a pgTAP
non-truncation test); (2) sibling-region fallback bug in the lateral
join; (3) catalog cache could pin wrong-language names across a locale
change (locale-keyed entries + in-flight guard). Also: dead lower(name)
index dropped (pg_trgm gin noted for Phase 4 scale), tagged-alias
canonical-surface scoping + coverage, ActionRedirects annotations on the
new console actions. INVESTIGATE finding resolved by decision: hub
leaderboard/trending keep the new 'active' default (pending dishes should
never chart); only the search/browse surfaces restore unfiltered
semantics.

Verified: pgTAP 143 (18 for this layer) on live local Postgres via
supabase test db; module 1176 + app 303 + console 50 vitest; 5 typechecks
(module, bestchef-app, console, mobile, web); full parity suite; function
gate. The local DB was patched in place for the review fixes (create or
replace + drop index) since the migration was already recorded.

Trap for future sessions: vi.resetModules() in an earlier describe makes
later dynamic import('../client') calls resolve a DIFFERENT module
instance than the statically imported functions read; init/reset the
client via STATIC imports in new tests.

## Phase 2.5: UGC language tagging (same session, `21b98506`, closed 2026-07-04)

Migration 20260703000006: nullable lowercase `language` columns on
bc_submissions, bc_recipe_snapshots, and bc_comments (pre-2.5 rows and
build-24 clients stay untagged and appear only in unfiltered views), a
partial index for the feed filter path, and a BEFORE trigger that stamps
vote-proof moderation-queue metadata with the submission's language. The
trigger is the trick that activates the moderator console's dormant queue
language filter with zero console changes (the console already read
metadata.language). Requeue paths re-stamp (ON CONFLICT DO UPDATE lists
metadata, so the UPDATE OF metadata trigger re-fires); invalid metadata
uuids are exception-guarded.

Module: normalizeUgcLanguage (write junk -> null; read junk -> filter
skipped, raw text never reaches a query); publishRecipeToCloud,
ensureSubmissionAlias, addComment, and swapSubmission (carries the
replaced row's tag) tag rows; VoteFeedOptions.language and
LeaderboardSubmissionsOptions.language compose with the existing region
kind for per-market leaderboards.

App: data/app-language.ts holder (import-free on purpose: an
expo-localization import drags the react-native Flow barrel into node
test graphs); I18nProvider seeds it in the language state INITIALIZER
(synchronous, runs before any child renders - closes the cold-start
'en' mis-tag window) and pushes on change; alias bridge + comment
composer tag writes; Vote feed gains an All-languages/My-language pill;
leaderboard filter sheet gains a My-language toggle reading the REACTIVE
i18n language (a module-holder read would go stale on language switch).
+6 i18n keys x21 (878 total).

Adversarial review: 10 findings, 1 critical, all fixable fixed in-commit.
The critical: the language-toggle refetch could be silently swallowed by
fetchFeed's re-entrancy guard while a fetch was in flight, and an
in-flight append from the OLD filter could merge into the cleared feed.
Fixed with epoch tokens (every commit site checks the token) plus a
wait-out loop in the toggle effect. Also fixed: filtered-empty feeds now
show an honest 'No recipes in your language yet.' state with a one-tap
Show-all action instead of falling into the UNFILTERED local seed; junk
language input skips the filter instead of querying raw text;
swapSubmission no longer drops the tag; reactive language reads.
INVESTIGATE items recorded in the plan: deploy-ordering gate (migrations
20260703000002..6 must reach staging+prod before build 25 - new clients
write the column unconditionally, PGRST204 on unmigrated envs breaks all
publishes), NOT VALID constraint pattern for post-launch scale, and
authoring-time vs alias-time language persistence (Phase 3.3, needs an
rc_ local-schema column).

Verified: pgTAP 151 (8 new) on live local Postgres, module 1185 + app 303
vitest, typechecks, full parity, function gate.

## Next codeable work (per plan 33)

Phase 2.6 emoji maps (last Phase 2 item), then Phase 3 client
localization completion (3.2 hardcoded strings, 3.3 dates/times + the
drainPendingProofs sweep + rc_ authoring-language column, 3.5 CLDR
plurals, 3.6 RTL) and Phase 5.6 (F-008/F-010). Vendor-gated: 1.1/1.4
classifiers + text moderation (F3), 1.6 Sentry (P0-09).

## Phase 3.3 (2026-07-04, `291a1433` + `01f16535`)

Localized dates/relative time plus the offline vote-proof sweep, then the
authoring-language follow-up.

**Client localization:** new `utils/relative-time.ts` (relativeTimeParts:
negative values + unit for Intl.RelativeTimeFormat, isNow under a minute,
NaN guard, month clamp at 11 so 360-364 days never renders "this year").
NotificationRow + ProfileActivityPane render localized relative time via
formatRelativeTime; the Hermes fallback now emits compact "2h" style (RTF
presence on device unverified; fallback covers absence, verify in the next
dev-client build). 'now' key x21 (910 keys, 100% parity). App language
threaded into creator-program, my-reports, ChefAboutPane, challenge/[id],
recipe/[id] reviews date rendering. Print template en-US pin replaced by a
PrintOptions.locale option (ISO fallback). Postal copy de-US-ified: en
values speak "postal code", hi swaps the zip transliteration for PIN code;
settings input drops number-pad so UK/CA/NL alphanumeric codes work.

**Proof sweep (closes the 2.2 review flag):** `data/proof-sweep.ts` +
`usePendingProofSweep` mounted in the tabs layout; drains queued offline
vote-proof drafts on cloud-ready + app-foreground through the standard
intent/PUT/finalize path. App-id -> cloud-UUID resolution via new
`resolveCloudSubmissionForAppId` (permanent misses fail the draft;
transient alias-bridge failures stay queued). rate_limited/unauthenticated
are background-retryable on every leg (media + cast), unlike the
interactive flow. Shared expo-file-system reader (`utils/file-bytes.ts`);
only a verified-missing file permanently fails a draft.

**Local schema V30:** rc_local_vote_proofs gains media_asset_id (drain
persists after finalize, retries skip the upload leg - no orphaned assets
or double quota burn; cleared + re-uploaded if the server rejects the
stored asset) and verdict/rating/notes (reviewed-vote queues the full
review payload; drain threads it into the cast leg).

**Local schema V31 (`01f16535`):** rc_bestchef_submissions gains language;
addLocalSubmission stamps authoring-time UGC language and localAliasInput
prefers it over the current app language (closes the 2.5 alias-language
note). ChefTom seed rows stamp 'en'.

**Review:** three adversarial rounds (initial 8 findings incl. 3 P1:
unresolved app-ids retry-looping 7 days + blocking the queue, rate_limited
permanently killing drafts, Hermes RTF "-45 minute" fallback; verify round
found the cast-leg override gap; V31 round found the test-reset no-op and
the seed-language gap). All 11 fixable findings fixed in-commit. Known
limit surfaced: cross-version mesh changesets fail on schema-skewed peers
(pre-existing substrate behavior, mesh is not the BestChef launch path).

**Verified:** module 1197 + app 315 vitest, module/app/mobile/web
typechecks, full parity chain incl. raw-string gate. Local schema now v31
(CLAUDE.md stack line updated).

## Phase 3.5 (2026-07-04, `8ec3fa22`)

Full CLDR plural categories. `translatePluralized` selects catalog
variant keys ('<pluralKey>#zero|two|few|many') before the base plural:
real Arabic dual/paucal/accusative-many, Hebrew duals, and Polish
few/many declension across 9 plural pairs (3 pantry day strings, pantry
photo count, dishes, recipes, photos, upvotes, rank deltas). Bare-noun
duals use the plain plural because the digit renders outside tp
(review F1: 'שתי מנות' after a "2" doubled the numeral). Rank-delta and
upvote copy route through the engine via an optional tp param on both
notification-copy renderers; the pantry photo count left its manual
two-form branch.

@formatjs intl-pluralrules + intl-relativetimeformat polyfills (guarded
by shouldPolyfill, all 21 locales) load first in the root layout. Hermes
lacks both Intl APIs natively; without the polyfills Phase 3.3's
relative time and every 3.5 variant would have been inert on device
(review F2) while all tests passed on Node's full ICU.

Parity gate hardened (review F3): the key extractor now parses
double-quoted and \u-escaped keys and compares PARSED strings. Six keys
("Didn't like", 'Publishing…', the 3× reviewed-vote explainers, the
block confirmation, the not-following empty state) had been invisible to
the gate and untranslated in 20 catalogs; backfilled with real copy.
'1 photo'/'{count} photos' never existed in any catalog (pantry rendered
raw English). Catalogs now 964 keys x21 at 100%.

Review: 4 findings (dual doubling, Hermes polyfill gap, gate blindness,
pl zero-noun genitive), all fixed in-commit. Device verify remains for
the polyfill path (next dev-client build).

Verified: app 326 vitest (12 new), typecheck, full parity chain.

## Phase 3.6 (2026-07-04, `44a1c6ea`)

RTL pass. New `components/DirectionalIcons.tsx` (BackArrow, ForwardArrow,
BackChevron, ForwardChevron) mirrors directional lucide icons via
scaleX(-1) when I18nManager.isRTL; a scripted sweep moved all 41 files
with directional icons through the wrappers (review verified imports and
relative paths clean at every depth, no icon inside Text, no layout
impact). Numeric columns (chef stats bar counts, reviewed-vote char
count) use isRTL-conditional textAlign. Restart-flow Alert copy was
already localized in 3.2.

Review HIGH fixed: KitchenSliderShell gestures are physical PanResponder
dx while icons and flex order are logical, so under RTL every left/right
action fired opposite its arrow. Fix: directionFromGesture translates
physical to logical under RTL, transitionOffset flips the exit animation
back to physical, and a11y labels announce the localized PHYSICAL swipe
word via new direction_left/right/up/down keys x21 (catalogs 968 keys,
100%).

New gate `scripts/check-rtl-icons.mjs` blocks raw directional icon JSX
outside the wrapper and physical textAlign without an isRTL conditional;
wired as check:rtl-icons in the check:parity chain. The plan's
"Playwright snapshot" line is web tooling and does not apply to the Expo
app; the static gate + wrapper contract is the regression cover. Vote
deck is vertical-swipe only and media galleries have no prev/next
arrows, so no physical-direction indicators were wrongly mirrored.

Verified: app 326 vitest, typecheck, full parity chain incl. both gates.

## Phase 3.7 (2026-07-04, `81304541`) - Phase 3 engineering complete

Honest completeness. `scripts/gen-compliance-keys.mjs` extracts every
t()/tp() key from ReportMenu, my-reports, ChefModerationRow, and
LanguageOnboardingGate plus curated settings (deletion/legal) and
comments ('Report comment') entry points into the committed
`i18n/compliance-keys.ts` (70 keys, validated against EN and against
actual usage in source). `check:compliance-keys` (--check mode) runs in
the check:parity chain and in pre-commit when any safety file changes.
`LANGUAGE_COMPLIANCE_COMPLETENESS` marks a locale partial in the picker
and onboarding gate when ANY safety key is untranslated, with a localized
'Safety and legal notices may appear in English' sub-label; a guard test
pins all 21 locales at exactly 1.0.

The generator immediately exposed 16 hidden gaps, all backfilled with
real translations: 9 safety strings absent from EVERY catalog (age-gate
consent 'I agree', the zero-tolerance policy sentence, 'Community rules',
'Report unavailable' + retry copy, recovery strings) and 6 report
category/dialog keys shipping as English passthroughs in all 20 non-EN
catalogs (Harassment, Violence, Copyright, Other, Back, No). Catalogs now
978 keys x21 at 100%.

Adversarial review (extraction verified exact against an independent
parser; guard test verified meaningful): fixed the sub-label overflow
(third child of the space-between meta row collapsed the name column),
Hebrew consent wording ('בהמשך' read as 'later on'; now impersonal legal
phrasing), Arabic Harassment term (تحرش connotes sexual harassment;
now مضايقة), deterministic code-point sort (ICU collation drift vs the
byte-compare), curated-key usage validation (typo defense). Recorded
limits: the value-differs heuristic cannot judge translation QUALITY
(that is founder F5 vendor review), and scope is the designated files
plus curated extras.

Verified: app 328 vitest, typecheck, full parity chain (i18n parity,
raw-strings, rtl-icons, compliance-keys all green).

## Phase 5.6 (2026-07-04, `c11594e1`)

F-008 video comments + F-010 cloud bookmarks, both previously reopened
tickets, closed at full function.

**Cloud:** migration 20260704000001 creates bc_saved_submissions with
owner-only read RLS (saves are private library data, deliberately unlike
bc_submission_likes), insert gated on bc_profile_owned +
bc_submission_visible, the CHF-1 durable 'save' action quota (200/hr,
BEFORE INSERT trigger), and the DSAR bc_profile_owned_row_counts manifest
replaced to include the new table (review finding: GDPR inventory
undercount; physical deletion was already covered by CASCADE). 14 pgTAP
tests green on live local Postgres; migration mirrored verbatim on
schema.sql with schema.test.ts assertions. RIDES THE F1 DEPLOY GATE with
20260703000002..6.

**Module:** cloud/saved-submissions.ts (idempotent 23505 saves,
rate_limited normalization, list join via bc_public_profiles_v because
social_profiles RLS hides non-discoverable chefs - review finding);
social/saved-submissions-cache.ts + V32 local migration (schema v32):
optimistic mark/unmark, cloud reconcile preserving queued intent,
drainPendingSaves with retryable semantics and permanent-failure
rollback. video-feed.ts FeedVideo gains commentCount + chefProfileId.

**App:** data/saved-submissions.ts - toggleSaved resolves app-local ids
through the alias bridge and re-keys cache rows (review finding: a
bookmark tapped before cloud-id resolution was permanently dropped
offline and could wedge un-toggleable); sweep mirrors the proof-sweep
resolution pattern; sweep treats rate_limited as retryable (window),
inline toggle rolls it back (honest feedback). usePendingSaveSweep
mounted beside the proof sweep. Vote-tab saves migrated off the legacy
settings-blob onto the same engine (one-time queue migration - review
finding: two disjoint bookmark systems). New /saved screen (cloud list,
offline id fallback, unsave, pull-to-refresh) reachable from a profile
row. Feed: bookmark toggles with filled state, comment button routes to
/comments/[submissionId] with REAL counts, chef pill routes to
/chef/[id], share via the system sheet with a localized message (vote.tsx
share localized with the same key; deep links only for cloud uuids).
/soon deflections removed from the video feed.

9 new keys x21 (987 total). Verified: module 1213 + app 328 vitest,
pgTAP 165, all typechecks, full parity chain.

## Phase 5.5 (2026-07-04, `6a8485c8`)

Trophy moments. Submit-success gains the "You're now competing for the
Top 100 of {dishName}" pill and a Share-your-recipe action (system
sheet, localized 5.6 message key, deep link only for cloud uuids). The
first successful CookProof commit celebrates once via the reviewed-vote
toast with an rc_settings flag (fail-closed read; offline-queued first
proofs celebrate on their first online commit - known minor). Rank
changes celebrate in-app: components/home/RankMomentBanner renders the
newest unread rank_up/rank_milestone through renderNotificationCopy,
focus-refetches, opens the target on tap, marks read on dismiss.

Adversarial review caught a CRITICAL: the banner reintroduced the
HERO_GRADIENT object-cast pattern that crashed a real device
(errors_log 2026-05-04) - the regression test only covered VideoStep.
All 4 remaining casts fixed (3 were latent on the submit success sheet,
meaning the success sheet would have crashed on device) and the test now
scans the whole app tree. Review HIGH: buildTargetRoute mapped 4 of 5
notification target types to routes that do not exist (/profile/[id],
/submission/[id], /profile/badges, /leaderboard/challenges/[id]) and the
dynamic router.push evades the route contract test - remapped to
/chef/[id], /recipe/[id], /(tabs)/profile, /challenge/[id], which fixes
every notification bell deep link, not just the banner. MEDIUM: the
'counts 3x' celebration claim was only true for silver (weights are
1/3/5) - copy now tier-truthful. Toast gained a holdMs prop and the
auto-back timer clears on unmount.

5 keys x21 (992 total). Verified: module 1213 + app 328 vitest, all
typechecks, full parity chain.

## Phase 4.4 (2026-07-04, `f1682391`)

Durable submission media upload queue (BCSERVER-P0-04). Local schema V33
adds rc_media_upload_jobs; social/media-upload-queue.ts owns a claim-
based state machine (synchronous claims make concurrent drains mutually
exclusive under JS run-to-completion), throw-safe processing (a throw is
a retryable failure inside the attempt budget - review High: it
previously wedged jobs at queued with unbounded attempts and head-of-
line blocked everything), guarded terminal writes (a racing cancel beats
done - review: a cancelled publish could still publish), app-death
requeue with an in-process exclusion set, and settled-row pruning.

submission-photo.ts was split into createSubmissionMediaIntent /
finalizeSubmissionMedia primitives (uploadSubmissionPhoto delegates,
tests unchanged) with nullable content hashes: review P0 found the
base64 JS-loop file reader would jetsam-kill the app hashing a 150MB
video and crash-loop the foreground sweep forever. Photos hash via the
native fetch/arrayBuffer path; videos send null (server accepts).

App worker: compression ladder to the 12MiB server cap with
compressedUri persisted (retries skip recompression), PUT via
FileSystem.createUploadTask with integer-percent progress writes and a
500ms-gated cancel poll, per-leg statuses so stall recovery is real.
resolveSubmissionPhotoViaQueue is the single photo path for publish,
retry, and offline publish (review Medium-High: the legacy monolith and
the queue double-uploaded the same bytes and orphaned assets). Publish
UI: live progress bar + Cancel in the submit footer; 'Upload cancelled.'
copy; {maxMb} now interpolates (was rendering the raw placeholder).

Videos: enqueued keyed by the cloud submission id, uploaded in the
background by the sweep. Stated honestly everywhere: the asset lands in
bc_media_assets private/pending with a null remote_url; the video feed
filters it out until a server-side moderation+promotion step exists
(Phase 4.1, founder F4). The submit comment, commit message, and Status
Delta all carry this limit; no feed claim is made. Picker video cap
aligned to the 150MiB bucket cap (was 200MB: oversized clips published
'successfully' then failed silently in the background).

Review: 1 P0 + 3 High + 4 Medium + Lows; all fixable ones fixed
in-commit. Recorded follow-ups: server-side promotion step (F4), a
my-uploads surface for failed background jobs, server-side byte
sniffing for declared MIME, mounting the pending-submission sweeper.

Verified: module 1226 vitest (13 new), app 328, all typechecks, full
parity chain. 3 keys x21 (995 total).

## Post-4.4 sweep (2026-07-04, `7949c33b`, `f37b1ed1`, `8e1dc49a`)

Continuation: everything still codeable after the phases.

**Pending-submission sweeper mounted** (`7949c33b`): 
runPendingSubmissionSweep was exported but never called - queued offline
submissions only retried via the manual button. New
usePendingSubmissionSweep hook (foreground + cloud-ready) with payload
reconciliation: photos the media queue uploaded after enqueue are patched
into pending payloads via updatePendingSubmissionPhotoUrl, so replays
stop publishing photoless; the payload also stops storing file:// URIs.

**Video promotion pipeline** (`f37b1ed1`): console /media queue closes
the 4.4 open item without the F4 CDN. Pending submission videos with
10-minute signed previews; approve/reject with required statement of
reasons. Review HIGHs fixed pre-land: (1) moderator email was written
into world-readable bc_media_assets.metadata (attribution now lives only
in the bc_moderation_decisions row); (2) hand-rolled status updates
bypassed bc_apply_moderation_decision, leaving no audit row and (since
bc_appeals.decision_id is NOT NULL) making video rejections UNAPPEALABLE
- decisions now route through the RPC, approval then patches only the
365-day signed playback URL (attribution-free), with an
approved-but-unpromoted recovery path and a submission-status gate.
MEDIUM-HIGH: bestchef-media-finalize could be re-called by the submitter
after rejection to reset the asset to pending (decision laundering) -
now guarded moderation_status=eq.pending.

**TS-04 purge worker + wiring** (`8e1dc49a`): bestchef-media-purge
deletes storage objects for purgeable assets. Review HIGH fixed
pre-land: rejected media is appealable evidence (DSA Art. 20, six-month
complaint floor) - deletions purge immediately, rejections only after
183 days; the first cut would have destroyed appeal evidence within one
cron tick. Review MEDIUM fixed: the worker was dormant - migration
20260704000002 schedules it daily and folds it into bc_job_health
(schedule + purgeable backlog). Registered in config.toml + the deploy
script per OPS-04. 9 worker tests + 6 pgTAP.

**Phase 4.2 bucket audit** (same commit): 
docs/designs/bestchef-storage-buckets.md documents public-by-design for
the two public buckets, all seven private buckets (vote-proofs policy
file corrected per review), residual risks, and the F4 flip path. EXIF
stripping verified true for both avatar and submission photo paths.

Open items recorded in the plan: signed-URL re-sign job before the
mid-2027 expiry cohort; appeal reversals need the promotion step;
ops seeds media_purge_worker_secret per environment.

Verified: module 1237 vitest, console 50, pgTAP 171, parity chain.
