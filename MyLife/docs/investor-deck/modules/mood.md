# MyMood — Module Audit

**ID:** mood | **Prefix:** mo_ | **Tier:** free | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Know your mind. Calm your body.

## User Value
- 1-10 mood scale + Plutchik's 24 emotions + activity correlation + photo/voice attachments
- 5 guided breathing patterns (box, 4-7-8, relaxing, energizing, sleep)
- Step-based meditation timer with templates + 13-layer focus soundscape mixing
- SOS crisis flow (grounding + affirmations + emergency contacts)
- Virtual pet gamification (6 species, 6 evolution stages, happiness decay)

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Entry CRUD + emotion tags + activities + attachments | src/db/crud.ts | shipped |
| Daily averages + dashboard + top emotions | src/db/crud.ts | shipped |
| Year-in-Pixels color mapping | src/engine/streak.ts | shipped |
| Streak calculation | src/engine/streak.ts | shipped |
| Weekly report generation | src/engine/streak.ts | shipped |
| Pearson correlation (activity-mood) | src/engine/streak.ts | shipped |
| Breathing (5 patterns, cycle steps) | src/engine/breathing.ts | shipped |
| A/B lifestyle experiments + analysis + conclusion | src/engine/experiment.ts | shipped |
| Experiment templates (6 categories) | src/db (mo_experiment_templates) | shipped |
| PIN/biometric module lock + lockout | src/engine/lock.ts | shipped |
| 8 algorithmic insight detectors | src/engine/insight.ts | shipped |
| SOS crisis flow (grounding senses, affirmations) | src/engine/sos.ts | shipped |
| Emergency contacts | src/db (mo_emergency_contacts) | shipped |
| Photo/voice attachments | src/db (mo_attachments) | shipped |
| Self-care suggestions (26 catalog + cross-module from 9 modules) | src/engine/suggestions.ts | shipped |
| Meditation timer + templates | src/engine/meditation.ts | shipped |
| Virtual pet (feed, evolve, decay) | src/engine/pet.ts | shipped |
| Focus soundscape (13 sounds, layer mixing, presets) | src/engine/soundscape.ts | shipped |
| Focus sessions with pre/post mood | src/db (mo_focus_sessions) | shipped |

## Data Model
Prefix `mo_`, schema v3. V1 tables: mo_entries (1-10 CHECK), mo_activities, mo_emotion_tags (Plutchik + intensity 1-3), mo_entry_activities, mo_breathing_sessions, mo_settings. V2: mo_experiments, mo_experiment_templates, mo_module_lock. V3: mo_sos_sessions, mo_emergency_contacts, mo_attachments, mo_suggestion_history, mo_meditation_templates, mo_meditation_sessions, mo_pets, mo_pet_activities, mo_focus_sessions, mo_sound_presets.

## Screens / User Flows
Mobile tabs: Today, History, Insights, Settings. Stack screens: log-mood, day-detail, sos, meditation, meditation-session, pet, focus, focus-session. 27 mobile route files, 16 web route files.

## Distinctive / Moat-worthy
- A/B lifestyle experiments with Pearson analysis and conclusion generation is unique in the mood-tracking category
- Cross-module self-care suggestions draw from 9 other MyLife modules (meds, habits, journal, etc.)
- 245 passing tests across 9 files; all engines pure functions

## Gaps vs competitors
- No CBT thought records inside mood (lives in @mylife/journal — 15 distortions)
- No Finch-style social pet community
- No clinical assessment questionnaires (PHQ-9, GAD-7)

## Investor-facing hook
A free mood tracker that ships with A/B experiments, 8 AI-pattern detectors, a Signal-grade lock, and a virtual pet — zero competitors bundle that stack.
