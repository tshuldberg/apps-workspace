# DoWork P5 + P6 orchestration runbook

This document is the **handoff-ready execution plan** for the orchestrator + agent team that will finish the DoWork extraction. It assumes the reader has not seen the prior session.

Status of prior phases: P0-P4 + P7 + P9 landed 2026-04-28. See `apps/dowork/Tickets/launch-plan.md` for the rollup. The base app boots, the 5 tabs render real data, the parity script is green, the 12-test smoke suite is green.

What's left: **P5** = port 36 stack screens + 3 shared kits, **P6** = wire cloud-backed data helpers for Batch H social features.

---

## 1. Operating model

### Recommended team shape

- **1 orchestrator** (this Claude session) — owns batch sequencing, merge gates, status updates, conflict resolution. Does not touch screen code.
- **1-3 `module-dev` sub-agents** working in parallel on independent batches. Each agent gets a single batch prompt and a worktree.
- **1 `parity-checker` sub-agent** invoked at each gate (read-only, cheap).
- Optional: **1 `code-reviewer` sub-agent** before merging large batches.

### Worktree model

Use `cmux` (or `git worktree add ../Apps-wt-dowork-p5-batch-X`) so concurrent agents don't stomp each other. Each batch gets its own worktree → its own commit → orchestrator merges in dependency order.

### Concurrency rules

- **Independent batches** can run in parallel: A, B, C, D, E, F, G are fully independent of each other (they share no source files).
- **Foundation kits land first**, in serial: `phase2-kit.tsx` and `phase3-kit.tsx` are dependencies of multiple batches.
- **Batch H is gated** on P6 cloud helpers; treat them as one combined unit.

---

## 2. Foundation pre-work (Batch 0 — must land first, ~1.5h)

These three files block multiple batches. Land them before any parallelization.

### 2.1 Copy shared helpers

Copy verbatim, then run the import-rewrite rules in §3.

| Source (apps/mobile) | Target (apps/dowork) | Used by batches |
|---|---|---|
| `lib/workouts/settings.ts` | `lib/workouts/settings.ts` | A (exercises, warmup), C (plate-loader) |
| `lib/workouts/social.ts` | `lib/workouts/social.ts` | H (social, social-feed, social-kit) |
| `lib/workouts/phase3.ts` | `lib/workouts/phase3.ts` | A (exercises) |
| `lib/uuid.ts` | `lib/uuid.ts` | C (calculator), E (overload) |

These helpers import only from `@mylife/workouts` plus relative siblings — no `@mylife/mood`, `@mylife/fast`, etc. Confirmed clean via `grep '@mylife/(mood|nutrition|fast|habits|sleep|cycle)' apps/mobile/app/(workouts) apps/mobile/lib/workouts` → 0 hits in screens, 0 hits in helpers.

### 2.2 Port the three screen kits

These are reusable component libraries that screens import (`SocialAvatar`, `WorkoutPhaseHeader`, `ExerciseArtwork`, `StickyActionBar`, `WorkoutRouteHeader`, `avatarLabel`, `formatVolumeLabel`, etc.).

| Source | Target | Used by |
|---|---|---|
| `apps/mobile/app/(workouts)/phase2-kit.tsx` | `apps/dowork/app/(root)/phase2-kit.tsx` | builder, session, history, timer, superset, share-workout, social, social-feed |
| `apps/mobile/app/(workouts)/phase3-kit.tsx` | `apps/dowork/app/(root)/phase3-kit.tsx` | exercises, exercise/[id], program/[id], program/create |
| `apps/mobile/app/(workouts)/social-kit.tsx` | `apps/dowork/app/(root)/social-kit.tsx` | social, social-feed |

**Important:** these are screen kits, not navigable routes. Place them at `apps/dowork/app/(root)/<name>.tsx` (sibling of `(tabs)/`). Do NOT register them as `Stack.Screen` entries in `(root)/_layout.tsx` — Expo Router will try to route them and fail. Check `apps/mobile/app/(workouts)/_layout.tsx` confirms the hub also doesn't register them as stack screens.

### 2.3 Verification gate (Batch 0 done)

```bash
pnpm --filter @mylife/dowork-app typecheck   # green
pnpm --filter @mylife/dowork-app test        # 12+ tests pass
pnpm check:dowork-parity                     # green (after extending the parity script — see §4.6)
```

---

## 3. Cross-cutting adaptation rules (apply to every screen)

These rules are **required** edits when copying any source from `apps/mobile/app/(workouts)/` to `apps/dowork/app/(root)/`. Apply them mechanically, then handle screen-specific gotchas in §4.

### 3.1 Import path rewrites (find → replace)

| Find (regex) | Replace |
|---|---|
| `from '\.\./\.\./components/DatabaseProvider'` | `from '../providers/DatabaseProvider'` |
| `from '\.\./\.\./components/ModuleLayoutWrapper'` | (delete the import — see §3.2) |
| `from '\.\./\.\./components/ModuleErrorBoundary'` | (delete — handled by app/_layout's ErrorBoundary) |
| `from '\.\./\.\./components/ModuleLockGuard'` | (delete — DoWork has no lock guard) |
| `from '\.\./\.\./lib/workouts/(settings\|social\|phase3)'` | `from '../../lib/workouts/$1'` |
| `from '\.\./\.\./lib/uuid'` | `from '../../lib/uuid'` |
| `from '\./phase2-kit'` | unchanged (already sibling in `(root)/`) |
| `from '\./phase3-kit'` | unchanged |
| `from '\./social-kit'` | unchanged |
| `from '\.\./phase3-kit'` | unchanged (program/* subfolder still resolves up) |

### 3.2 Hub component substitutions

`ModuleLayoutWrapper`, `ModuleLockGuard`, `ModuleErrorBoundary` only appear in `apps/mobile/app/(workouts)/_layout.tsx` and `(tabs)/_layout.tsx` — confirmed via `grep -r ModuleLayoutWrapper apps/mobile/app/(workouts) | wc -l` = 9 hits across 2 files only. **No screen body uses them.** So screens require no substitution — only the layouts (already ported in P0-P4) drop them.

### 3.3 Brand token rule

DoWork uses iron orange `#FF6B00`, not the workouts module's warm `#C9894D`/`#FFB877`. The `WK_*` tokens are still imported (typography, glass, category colors), but the **accent** color must be DoWork's:

| Find | Replace |
|---|---|
| Direct usage of `WK_ACCENT` for primary CTAs / progress / highlights | `useAppThemeColors().accent` (or `DW_ACCENT` for static stylesheets) |
| `WK_ACCENT_LIGHT` for hover/active states | `DW_ACCENT_LIGHT` |
| `WK_ACCENT_DARK` for pressed states | `DW_ACCENT_DARK` |

**Don't blanket-replace.** Many screens use `WK_ACCENT` semantically through `getWorkoutCategoryColor()` — keep those. Only swap when the token is rendered as a brand surface (FAB background, primary button fill, hero gradient, tab indicator).

Add at the top of any screen that renders branded surfaces:

```tsx
import { DW_ACCENT, DW_ACCENT_LIGHT, DW_ACCENT_DARK, DW_ON_ACCENT } from '../theme/tokens';
```

### 3.4 Cross-module insight strip (Batch G only)

The hub `insights.tsx` calls `detectMoodLiftCorrelation`, `detectFastingPerformance`, `detectProteinRecovery` from `@mylife/workouts`. These detectors guard for missing tables internally (the `intelligence/data-bridge.ts` module checks for `mo_*`, `nu_*`, `ft_*` table existence and returns empty arrays if absent), so they would fail-soft in DoWork — but rendering empty insights is bad UX.

In DoWork's `insights.tsx`, **remove these three detector calls** and the UI sections that consume their results. Keep:
- `detectConsistencyMomentum`
- `detectTimeOfDayPerformance`
- `detectVolumeMoodFeedback` (the "Volume → mood" detector still works because it correlates volume with workout-internal RPE/notes, not external mood data)

If `generateWorkoutInsights()` is called as a single entry point, replace the call with a manual orchestration of the 3 kept detectors.

### 3.5 Stack screen registration

After porting any screen, **add it to `apps/dowork/app/(root)/_layout.tsx`** so Expo Router can navigate to it. The current registration only declares `(tabs)` and `auth-callback`.

For each ported route, append to the Stack inside `_layout.tsx`:

```tsx
<Stack.Screen name="builder" />
<Stack.Screen name="session" />
<Stack.Screen name="exercise/[id]" />
{/* ...etc */}
```

For modal/full-screen presentations (e.g., `submission/[id]/vote` in BestChef, or `gps.tsx` in DoWork), use:

```tsx
<Stack.Screen name="gps" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
```

### 3.6 Common gotchas hit during P0-P4 (don't waste agent time on these)

- **`StatCard` prop is `suffix`, not `unit`.** Type errors point right at it.
- **`WorkoutSession` has no `durationSeconds` field.** Compute from `Date.parse(completedAt) - Date.parse(startedAt)`.
- **`getCurrentPlanPosition(plan, startDate: string)`** takes the subscription's `startedAt` string, not the position object.
- **`getTodaysWorkout(plan, startDate: string)`** returns `{ workoutId, restDay, notes }`, not a `WorkoutDefinition`. Look up the workout via `workoutMap[todays.workoutId]`.
- **`WorkoutPlan.title`**, not `name`.
- **`progress.ts` engine functions take snake_case `ProgressSession`,** not the camelCase `WorkoutSession` returned by `getWorkoutSessions`. For DoWork v1, compute streak/volume/history inline from camelCase (see `apps/dowork/app/(root)/(tabs)/progress.tsx` for the pattern). Do NOT introduce a row-format adapter unless explicitly approved — that's a P5 polish item.
- **`StreakInfo` is `{ current, longest, lastWorkoutDate }`,** not `{ currentStreak, longestStreak }`.
- **`VolumeStats` has no `totalVolume` field;** it has `totalSessions`, `totalExercises`, `totalSets`, `totalReps`, `totalDurationMinutes`, `byMuscleGroup`.
- **LSP diagnostics from the editor are unreliable in this app** because they don't pick up `customConditions: ["react-native"]` and `moduleSuffixes: [".native", ""]`. **Trust `pnpm --filter @mylife/dowork-app typecheck`,** not the editor.

---

## 4. Per-batch briefs

Each brief below is **ready to paste** into a sub-agent prompt. Include the cross-cutting rules from §3 by reference.

### 4.1 Batch A — Workout flow (8 screens)

**Goal:** complete workout authoring + execution flow lives end-to-end in DoWork.

**Source files:**
- `apps/mobile/app/(workouts)/builder.tsx`
- `apps/mobile/app/(workouts)/session.tsx`
- `apps/mobile/app/(workouts)/exercises.tsx`
- `apps/mobile/app/(workouts)/exercise/[id].tsx`
- `apps/mobile/app/(workouts)/save-workout.tsx`
- `apps/mobile/app/(workouts)/superset.tsx`
- `apps/mobile/app/(workouts)/timer.tsx`
- `apps/mobile/app/(workouts)/warmup.tsx`

**Target files:** same basenames under `apps/dowork/app/(root)/`. The `exercise/[id].tsx` keeps its dynamic-segment subfolder.

**Dependencies:**
- Batch 0 must be merged (phase2-kit, phase3-kit, settings.ts, phase3.ts).

**Stack registration to add to `apps/dowork/app/(root)/_layout.tsx`:**

```tsx
<Stack.Screen name="builder" />
<Stack.Screen name="session" />
<Stack.Screen name="exercises" />
<Stack.Screen name="exercise/[id]" />
<Stack.Screen name="save-workout" />
<Stack.Screen name="superset" />
<Stack.Screen name="timer" />
<Stack.Screen name="warmup" />
```

**Per-screen notes:**
- `session.tsx` is the largest (~600+ lines). Voice command handling stays — `parseVoiceCommand` from `@mylife/workouts` is local-only.
- `timer.tsx` uses `expo-haptics`. Already in DoWork's package.json.
- `warmup.tsx` reads `getWorkoutPhaseOneSettings` from `lib/workouts/settings.ts` — covered by Batch 0.
- `exercises.tsx` reads `lib/workouts/settings.ts` and `lib/workouts/phase3.ts` — covered by Batch 0.
- After porting, the home FAB on `(tabs)/index.tsx` should be redirected from `/(root)/(tabs)/workouts` to `/(root)/builder` for the canonical "start a new workout" flow. Currently it routes to the workouts tab as a placeholder.

**Verification:**
```bash
pnpm --filter @mylife/dowork-app typecheck
pnpm --filter @mylife/dowork-app test
pnpm gate:function:changed --staged
pnpm check:dowork-parity
```

### 4.2 Batch B — Programs / plans (6 screens)

**Source files:**
- `apps/mobile/app/(workouts)/programs.tsx`
- `apps/mobile/app/(workouts)/program/[id].tsx`
- `apps/mobile/app/(workouts)/program/create.tsx`
- `apps/mobile/app/(workouts)/program/new.tsx`
- `apps/mobile/app/(workouts)/plans.tsx`
- `apps/mobile/app/(workouts)/onboarding.tsx`

**Stack registration:**
```tsx
<Stack.Screen name="programs" />
<Stack.Screen name="program/[id]" />
<Stack.Screen name="program/create" />
<Stack.Screen name="program/new" />
<Stack.Screen name="plans" />
<Stack.Screen name="onboarding" />
```

**Per-screen notes:**
- `program/create.tsx` and `program/[id].tsx` import `phase3-kit` via `'../phase3-kit'`. After porting they import the same way (the file is sibling to `program/`).
- `onboarding.tsx` may have a first-run gate — if it reads from `hub_settings` or similar, swap to a DoWork-local `dw_settings` key (or skip the hub-shared persistence and use `expo-secure-store` directly).
- Workouts tab settings tab redirect after onboarding completion: route to `/(root)/(tabs)`.

**Independent of Batches A, C-G.** Can run in parallel with them.

### 4.3 Batch C — Tools / calculators (4 screens)

**Source files:**
- `apps/mobile/app/(workouts)/one-rm.tsx`
- `apps/mobile/app/(workouts)/plate-loader.tsx`
- `apps/mobile/app/(workouts)/calculator.tsx`
- `apps/mobile/app/(workouts)/main-exercises.tsx`

**Stack registration:**
```tsx
<Stack.Screen name="one-rm" />
<Stack.Screen name="plate-loader" />
<Stack.Screen name="calculator" />
<Stack.Screen name="main-exercises" />
```

**Per-screen notes:**
- All four are pure-compute screens that read from the workouts module's calculator helpers (`calculate1RM`, `calculateWarmupSets`, `calculatePlates`, `calculatePersonalRecords`).
- `plate-loader.tsx` imports `getWorkoutPhaseOneSettings` from `lib/workouts/settings.ts` — covered by Batch 0.
- `calculator.tsx` and `main-exercises.tsx` use `lib/uuid.ts` — covered by Batch 0.
- These have no cross-screen dependencies. Smallest batch — give to the slowest agent or use as a warmup.

### 4.4 Batch D — Tracking / analytics (5 screens)

**Source files:**
- `apps/mobile/app/(workouts)/history.tsx`
- `apps/mobile/app/(workouts)/photos.tsx`
- `apps/mobile/app/(workouts)/measurements.tsx`
- `apps/mobile/app/(workouts)/recordings.tsx`
- `apps/mobile/app/(workouts)/monthly-report.tsx`

**Stack registration:** standard pattern.

**Per-screen notes:**
- `history.tsx` imports `phase2-kit` — covered by Batch 0.
- `photos.tsx` uses `expo-image-picker` and `expo-image-manipulator`. Already in DoWork's package.json.
- `recordings.tsx` reads from `wk_form_recordings`. Local-only, no cloud changes needed.
- `monthly-report.tsx` may consume `progress.ts` engine — if so, apply the camelCase inline pattern (see §3.6).

### 4.5 Batch E — AI / recovery (5 screens)

**Source files:**
- `apps/mobile/app/(workouts)/ai-workout.tsx`
- `apps/mobile/app/(workouts)/generate.tsx`
- `apps/mobile/app/(workouts)/recovery.tsx`
- `apps/mobile/app/(workouts)/body-map.tsx`
- `apps/mobile/app/(workouts)/overload.tsx`

**Stack registration:** standard.

**Per-screen notes:**
- `generateLocalWorkout` from `@mylife/workouts/ai/generator` is rule-based, no API calls. Local-only.
- `body-map.tsx` uses `react-native-svg` (already in DoWork) and the body-highlighter slug mapping from `@mylife/workouts`.
- `recovery.tsx` calls `buildRecoveryMap` + `getBestToTrain` — local-only.
- `overload.tsx` uses `lib/uuid.ts` — covered by Batch 0.
- `ai-workout.tsx` and `generate.tsx` likely overlap; verify they're not duplicates after porting.

### 4.6 Batch F — GPS / Watch (2 screens)

**Source files:**
- `apps/mobile/app/(workouts)/gps.tsx`
- `apps/mobile/app/(workouts)/watch.tsx`

**Stack registration:**
```tsx
<Stack.Screen name="gps" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
<Stack.Screen name="watch" />
```

**Per-screen notes:**
- `gps.tsx` uses `expo-location`. Already in DoWork's package.json + iOS NSLocationWhenInUseUsageDescription declared.
- `watch.tsx` references `buildWatchWorkoutSummary` / `isValidWatchMessage`. The actual Apple Watch sync requires a companion watch app (out of scope for v1) — keep the screen as a placeholder that explains the watch surface lands later.
- `gps.tsx` mid-run pace + elevation calc uses `@mylife/workouts/gps/metrics` helpers — purely functional, no porting.

### 4.7 Batch G — Insights (1 screen, stripped)

**Source file:**
- `apps/mobile/app/(workouts)/insights.tsx`

**Stack registration:**
```tsx
<Stack.Screen name="insights" />
```

**Strip (per §3.4):**
- Remove `detectMoodLiftCorrelation`, `detectFastingPerformance`, `detectProteinRecovery` calls.
- Remove the UI cards that consume those detectors.
- Keep `detectConsistencyMomentum`, `detectTimeOfDayPerformance`, `detectVolumeMoodFeedback`.
- If `generateWorkoutInsights` is the entry point, replace with a manual call list of the 3 kept detectors.

**Smallest batch but most subtle.** Recommend doing this last, after Batches A-F are merged and you have full app context.

### 4.8 Batch H — Social / Share (5 screens, cloud-backed)

**Source files:**
- `apps/mobile/app/(workouts)/social.tsx`
- `apps/mobile/app/(workouts)/social-feed.tsx`
- `apps/mobile/app/(workouts)/share.tsx`
- `apps/mobile/app/(workouts)/share-workout.tsx`
- `apps/mobile/app/(workouts)/upload-video.tsx`

**Stack registration:** standard.

**GATED ON P6.** Do not start this batch until P6 cloud helpers (§5) are merged. Otherwise the agent will end up writing cloud helper stubs inline that need to be ripped out.

**Per-screen notes:**
- The hub `social.tsx` and `social-feed.tsx` consume `lib/workouts/social.ts` (covered by Batch 0). That helper currently has placeholder demo data; in DoWork the demo data is replaced with cloud reads (P6 helpers).
- `share-workout.tsx` builds a `WorkoutSummaryCard` via `buildWorkoutSummary` from `@mylife/workouts/sharing` — local. The share *upload* is what's cloud-backed (P6).
- `upload-video.tsx` is the trainer-video uploader. Wire to `dowork-upload-finalize` edge function via P6 helpers.
- `share.tsx` is a deep-link / URL share preview. Mostly local.

---

## 5. P6 — Cloud-backed data helpers (~4h, blocks Batch H)

P6 creates the data-layer functions that Batch H screens call. Mirror the BestChef pattern at `apps/bestchef/app/(root)/data/cloud-*.ts` for shape.

### 5.1 Files to create

All under `apps/dowork/app/(root)/data/`:

| File | Purpose | Mirror from BestChef |
|---|---|---|
| `cloud-shares.ts` | `uploadWorkoutShare`, `listPublicShares`, `listFollowingShares`, `listMyShares`, `deleteShare`, `hideShare` | `apps/bestchef/.../data/cloud-submissions.ts` (pattern + offline queueing) |
| `cloud-likes.ts` | `likeShare`, `unlikeShare`, `getLikeCounts`, `getMyLikedShareIds` | `apps/bestchef/.../data/feed-likes.ts` (optimistic + queue) |
| `cloud-comments.ts` | `postComment`, `listComments`, `deleteComment`, `editComment` | `apps/bestchef/.../data/cloud-comments.ts` |
| `cloud-trainer-videos.ts` | `uploadTrainerVideo`, `listTrainerVideosForExercise`, `deleteTrainerVideo`, `setPrimaryTrainerVideo` | (no direct BestChef analog — design fresh against `dw_trainer_videos` schema) |
| `public-render-policy.ts` | `shouldShowDemoContent`, `shouldUseDemoFixturesInDev` — fail-closed in public builds | `apps/bestchef/.../data/public-render-policy.ts` (port verbatim, swap `BESTCHEF` env names for `DOWORK`) |

### 5.2 Required function signatures (Batch H expects these exact shapes)

```ts
// cloud-shares.ts
export interface CloudShareInput {
  title: string;
  summary?: string;
  durationSeconds: number;
  totalVolumeKg: number;
  exerciseCount: number;
  category?: string;
  heroImageUrl?: string;
  privacy: 'public' | 'followers' | 'private';
}

export interface CloudShareRow {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  durationSeconds: number;
  totalVolumeKg: number;
  exerciseCount: number;
  category: string | null;
  heroImageUrl: string | null;
  privacy: 'public' | 'followers' | 'private';
  createdAt: string;
  likeCount: number;
  commentCount: number;
  myLikedFlag: boolean;
}

export async function uploadWorkoutShare(
  supabase: SupabaseClient,
  input: CloudShareInput,
): Promise<{ ok: true; share: CloudShareRow } | { ok: false; error: string }>;

export async function listPublicShares(
  supabase: SupabaseClient,
  options: { limit?: number; cursor?: string },
): Promise<{ ok: true; shares: CloudShareRow[]; nextCursor: string | null } | { ok: false; error: string }>;

// ...etc
```

Use the same Result-type pattern (`{ ok: true, ... } | { ok: false, error: string }`) consistently — it's the BestChef convention.

### 5.3 Offline queueing pattern

BestChef writes failed cloud calls to a local `rc_pending_*` SQLite table for sweeper retry (see `apps/bestchef/.../components/ReportMenu.tsx` for the canonical pattern). DoWork should follow the same pattern for the most critical mutations:

- Failed `uploadWorkoutShare` → enqueue in `dw_pending_shares` (add table to a new `dw_v2` migration if required, or reuse `wk_*` SQLite local prefix to avoid migrating the cloud schema)
- Failed `likeShare` → enqueue in a local table or in-memory queue
- Failed `postComment` → enqueue

Sweep on app focus + cloud-recovered events.

### 5.4 Public-render policy

Port `apps/bestchef/.../data/public-render-policy.ts` verbatim, swap `BESTCHEF` env names to `DOWORK`:

- `EXPO_PUBLIC_USE_DEMO_FIXTURES` (shared name OK) gates `shouldUseDemoFixturesInDev()`
- Public-launch builds (`isDoWorkPublicLaunchBuild()` — already exists in `data/launch-environment.ts`) force-disable demo content unless an explicit approved seed-content flag is set

This protects the social feed from leaking demo workouts to real users.

### 5.5 Tests

For each cloud helper, scaffold a contract + function-gate test:

```bash
pnpm scaffold:function-test --file apps/dowork/app/\(root\)/data/cloud-shares.ts --function uploadWorkoutShare
```

Mock the Supabase client. Tests should cover:
- happy path
- error handling
- offline queue enqueue + sweep
- privacy gating (private shares not visible to non-owner)

### 5.6 Verification

```bash
pnpm --filter @mylife/dowork-app typecheck
pnpm --filter @mylife/dowork-app test
pnpm gate:function --file apps/dowork/app/\(root\)/data/cloud-shares.ts
pnpm gate:function --file apps/dowork/app/\(root\)/data/cloud-likes.ts
pnpm gate:function --file apps/dowork/app/\(root\)/data/cloud-comments.ts
pnpm gate:function --file apps/dowork/app/\(root\)/data/cloud-trainer-videos.ts
```

### 5.7 Real Supabase project still required

The cloud helpers will compile and pass mocked tests without a Supabase project, but real e2e verification requires:

1. The Supabase staging project provisioned per `docs/runbooks/dowork-supabase-setup.md`
2. The 4 migrations applied
3. The 2 edge functions deployed (with real implementations replacing the 501-stub)
4. EAS env vars set

This is the user-side blocker. The orchestrator should flag it but not gate code merges on it — code merges on tests, prod readiness gates on the runbook checklist.

---

## 6. Update the parity script

Each batch should extend `scripts/check-dowork-parity.mjs` to add the newly-required files. The current parity script only checks P0-P4 + P3 cloud foundation files.

After Batch A merges, append to the `requiredFiles` array:

```js
// Batch A
'apps/dowork/app/(root)/builder.tsx',
'apps/dowork/app/(root)/session.tsx',
// ...etc
```

The parity script is a full-file include list, not a glob — adding entries makes the regression check explicit.

For Batch H + P6:

```js
// P6 cloud helpers
'apps/dowork/app/(root)/data/cloud-shares.ts',
'apps/dowork/app/(root)/data/cloud-likes.ts',
'apps/dowork/app/(root)/data/cloud-comments.ts',
'apps/dowork/app/(root)/data/cloud-trainer-videos.ts',
'apps/dowork/app/(root)/data/public-render-policy.ts',

// Batch H screens
'apps/dowork/app/(root)/social.tsx',
// ...etc
```

---

## 7. Recommended sequencing

```
Day 1 (foundation, serial):
  - Batch 0: copy helpers + 3 kits (1.5h)
  - Verify pnpm typecheck/test/parity green

Day 2 (parallel, 3 agents):
  - Agent 1: Batch A (workout flow)
  - Agent 2: Batch B (programs)
  - Agent 3: Batch C (tools)
  - Orchestrator merges in arrival order, updates parity script
  - End-of-day verify: full app boots in dev, all routes navigable

Day 3 (parallel, 2-3 agents):
  - Agent 1: Batch D (tracking)
  - Agent 2: Batch E (AI/recovery)
  - Agent 3 (optional): Batch F (GPS/Watch)
  - Orchestrator: write Batch G stripped insights solo (smallest, subtle)

Day 4 (P6 + Batch H, serial):
  - Solo: P6 cloud helpers (4h)
  - Solo or single agent: Batch H social screens (~3h)
  - Full app verification, EAS dev build smoke

Day 5 (P8 polish + launch readiness):
  - User-side: EAS init, App Store Connect, Play Console
  - Code-side: port BestChef plugins (withSecurityHardening, withDataProtection)
  - Real Supabase project apply migrations + deploy functions
  - Internal-distribution build + on-device QA
```

Total: ~5 working days with 3-agent parallelism on screen porting days.

---

## 8. Merge gates

Every batch merge must pass:

```bash
pnpm install                                  # any new deps?
pnpm --filter @mylife/dowork-app typecheck    # green
pnpm --filter @mylife/dowork-app test         # green
pnpm gate:function:changed --staged           # green
pnpm check:dowork-parity                      # green (after parity script update)
pnpm check:parity                              # green (no hub regression)
```

The orchestrator runs these locally before accepting an agent's PR. Don't merge on the agent's word — verify.

---

## 9. Rollback strategy

If a batch breaks the app:

- `git revert` the batch commit (each batch should be a single squashed commit)
- Update parity script to remove the rolled-back files from `requiredFiles`
- Re-queue the batch with a fresh agent + a note about the failure mode

If a batch partially works (e.g., 6 of 8 screens pass typecheck):

- Land the working screens
- Spin off the failing screens as a follow-up ticket in `apps/dowork/Tickets/`
- Don't block forward progress on the rest of P5

---

## 10. Open questions / escalations

If an agent hits any of these, escalate to the orchestrator (or user) — don't make a unilateral call:

- **Hub-only feature in a screen** that has no DoWork analog (e.g., suite-subscription gating, hub dashboard breadcrumbs). Default: strip.
- **Cross-module data dependency** (e.g., a screen reads from `mo_*` mood tables). Default: strip the cross-module read; render workout-internal data only.
- **A WK_* token semantics conflict** (e.g., a screen uses `WK_ACCENT` for both a category color AND a brand surface). Default: keep `WK_*` for category, swap to DoWork tokens for brand surfaces.
- **A screen depends on a screen kit not yet ported** (shouldn't happen if Batch 0 is done first, but if it does, escalate).
- **A screen uses `progress.ts` engine functions** (snake_case path). Default: rewrite inline with camelCase math (see §3.6).
- **Real Supabase migrations need updates** (e.g., a screen needs a column not in the 4 existing migrations). Escalate — schema changes go through a fresh migration file.

---

## Glossary

- **Hub:** the consolidated MyLife app at `apps/mobile` + `apps/web`. Loads all 30+ modules through `ModuleRegistryProvider`.
- **Standalone:** a per-module Expo app like BestChef or DoWork that ships independently. Imports a single module's package as its only product domain.
- **Module:** a workspace package under `modules/<id>/` exposing a `ModuleDefinition` + business logic + UI components.
- **Batch:** a single agent-sized PR unit of P5 (8 batches total).
- **Cross-module insight:** a `@mylife/workouts/intelligence/` detector that reads `mo_*`, `nu_*`, or `ft_*` tables. Stripped from DoWork.
- **Phase kit / screen kit:** shared component file (`phase2-kit`, `phase3-kit`, `social-kit`) that exports reusable view fragments. Lives at the app root, not under `(tabs)/`.
- **Parity script:** `scripts/check-dowork-parity.mjs` — the always-run regression gate. Extend it as files are ported.
