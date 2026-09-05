---
status: PROPOSAL
phase: 3
parent: docs/plans/consolidation/README.md
---

# Goal-Based Onboarding + Starter Kits

Finish the onboarding flow using the `packages/onboarding` state machine that already exists. Hard cap: 4 screens before first real action. Goal question narrows 30 modules to 5-7. Import, AI prefs, and biometric consent are post-first-value.

## Flow

```
┌─────────────┐     ┌────────────┐     ┌──────────┐     ┌─────────────┐
│ 1. Pledge   │ →   │ 2. Goal    │ →   │ 3. Kit   │ →   │ 4. First    │
│ (privacy    │     │ ("what     │     │ (preview │     │ action      │
│  commitment │     │  matters   │     │  enabled │     │ (log mood / │
│  + exit     │     │  to you?") │     │  modules,│     │  add book / │
│  door)      │     │            │     │  tweak)  │     │  expense)   │
└─────────────┘     └────────────┘     └──────────┘     └─────────────┘
                                                               │
                                       ┌───────────────────────┤
                                       ▼                       ▼
                                  ┌─────────────┐      ┌──────────────┐
                                  │ Post-first- │      │ Today surface│
                                  │ value       │      │ (immediate)  │
                                  │ "Want to…?" │      │              │
                                  │  - Import?  │      └──────────────┘
                                  │  - Enable AI│
                                  │  - Verify   │
                                  │    biometric│
                                  └─────────────┘
```

## Screen 1 — Pledge

Renders the 7-commitment pledge from `docs/designs/DESIGN-pledge-onboarding.md`. Replaces the current placeholder:

- No ads, ever.
- No data sale, ever.
- Free features stay free.
- Export everything, anytime.
- Delete everything, anytime.
- Content filters are your choice.
- Exit door is always open.

User taps "I accept" (primary) or "Read full pledge" (secondary, opens full legal text). Declining blocks account creation (same as current behavior).

Route:

- Mobile: `apps/mobile/app/(onboarding)/pledge.tsx`
- Web: `apps/web/app/onboarding/pledge/page.tsx`

## Screen 2 — Goal question

Single question: **What matters to you?** Multi-select (1-3 allowed):

| Icon | Goal | Cluster |
|------|------|---------|
| 💪 | Body & energy | Body |
| 🧠 | Mind & reflection | Mind |
| 🏡 | Home & things | Home |
| 💰 | Money & spending | Money |
| 👥 | People & events | Social |
| 🌲 | Outdoors & nature | Outdoor |
| 📚 | Learning & reading | Knowledge |

Stores selection in `hub_onboarding.primary_clusters` (JSON array). Drives:

- Starter kit preview (next screen)
- Today surface ranking (`+15` to matching modules)
- AI agent default module scope

## Screen 3 — Starter kit preview

Shows the kit that matches the selected cluster(s) with an editable module list. User can add or remove any module before continuing.

| Cluster | Kit name | Pre-enabled modules |
|---------|----------|---------------------|
| Body | Body Kit | health, workouts, nutrition, fast, mood, cycle, meds |
| Mind | Mind Kit | journal, notes, mood, voice, books, flash, words |
| Home | Home Kit | homes, car, garden, pets, closet |
| Money | Money Kit | budget, subs, market |
| Social | Social Kit | rsvp, forums, presence, mail |
| Outdoor | Outdoor Kit | trails, surf, stars, garden |
| Knowledge | Reader Kit | books, words, flash, notes, journal |

Multi-cluster users get the union of kits (dedupe). If selection is empty, show "Everything Lite" (5 free modules: fast, journal, mood, notes, voice).

"Continue" enables the selected modules via `hub_enabled_modules` and triggers per-module schema migrations. Progress indicator shows "Preparing your apps…" during migration. Typical duration under 2s for ≤10 modules.

## Screen 4 — First real action

Deep-link straight into the first module's "add" route based on primary cluster:

| Primary cluster | First-action route |
|-----------------|---------------------|
| Body | `/mood/log` (Daylio-style 2-tap mood + activity) |
| Mind | `/journal/new` (one-prompt entry, voice or text) |
| Home | `/homes` (add first property or skip) |
| Money | `/budget/expense/new` (amount + payee) |
| Social | `/rsvp/events` (import calendar or skip) |
| Outdoor | `/trails` (pick a saved trail or skip) |
| Knowledge | `/books/search` (add a currently-reading book) |

After completion (or skip), user lands on Today surface. Any subsequent optional screens are shown via a dismissible banner on Today:

- "Import from Goodreads / YNAB / Habitify / Cronometer / Day One?"
- "Turn on AI assist for [module]?" (per-module, default off)
- "Verify biometric for social features?" (only if Forums / Market enabled)

None of these block first-value.

## State machine wiring

Use existing `packages/onboarding/src/state-machine.ts`. Adjust states:

```
START
  → PLEDGE
  → GOAL_SELECTION           (new)
  → KIT_PREVIEW              (new, replaces MODULE_SELECTION)
  → APPLY_KIT                (new, performs migrations)
  → FIRST_ACTION             (new, deep-link into chosen module)
  → DASHBOARD_REVEAL
  ↓ (optional, post-first-value)
  → IMPORT_PROMPT
  → AI_PREFS
  → BIO_VERIFY
```

The old `CONTENT_PREFS` and `HEALTH_CONSENT` steps collapse into:

- Content filtering moves to Settings > Content (default: show all)
- Health consent moves to a per-module prompt when user first enables health
- Explicit privacy consent is implied by Pledge acceptance + per-module `hub_ai_permissions`

## Import wizard (post-first-value)

The existing adapters in `packages/onboarding/src/import/` (Goodreads, Day One, YNAB, MyFitnessPal) get a unified entry page:

- Mobile: `apps/mobile/app/(hub)/import.tsx`
- Web: `apps/web/app/import/page.tsx`

Each adapter shows estimated row count and target module. User picks files and confirms. Import runs in the background with progress + cancel.

New adapters to add in follow-up (not blocking):

- Habitify → MyHabits (already scoped in feature plans)
- Quizlet → MyFlash (already scoped)
- Strava → MyWorkouts / MyTrails
- Cronometer → MyNutrition (supersedes MyFitnessPal path)
- Apple Health → MyHealth (HealthKit permission prompt on iOS)

## AI preferences (post-first-value)

Banner on Today surface: "Turn on AI assist?" → dismissable settings screen:

- Master toggle (default OFF)
- Per-module grid (default OFF per module)
- Provider picker: local (default) / cloud BYOK
- If cloud: key entry for Claude / OpenAI / Gemini (one at a time, biometric-gated on mobile)

## Biometric verification (only for Forums / Market)

Banner appears only if user enabled Forums or Market in the kit. Uses existing `hub_human_verification` infrastructure. Tappable from the Today banner; blocks write actions in Forums/Market until completed.

## Acceptance

- Onboarding completes in ≤ 4 screens for 80% of users
- Time to first real action ≤ 90 seconds (measured from first tap after Pledge accept)
- Starter kit application is atomic (rollback on failure)
- `hub_onboarding.primary_clusters` written before DASHBOARD_REVEAL
- Import / AI / biometric flows reachable from Today banner, dismissible, persist dismissal
- `pnpm test` green including new state-machine tests
- `/qa` skill pass on onboarding flow
- Drop-off measurement hooks in place (instrument each state transition)
