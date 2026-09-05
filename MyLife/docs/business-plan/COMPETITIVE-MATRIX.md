# MyLife Competitive Feature Matrix

> Last updated: 2026-03-23 (code-verified audit: 97.1% parity, see REPORT-competitive-parity-audit-2026-03-23.md)
>
> This document consolidates all competitor data and feature gaps across MyLife's 29 modules into a single reference. The goal: reverse engineer every competitor from a user experience perspective. Anything a user can do in a competitor, we want that feature in our app.

---

## Table of Contents

1. [Budget (100%)](#1-budget-100)
2. [Nutrition (98%)](#2-nutrition-98)
3. [Health (99%)](#3-health-99)
4. [Workouts (99%)](#4-workouts-99)
5. [Mood (100%)](#5-mood-100)
6. [Notes (100%)](#6-notes-100)
7. [Flash (100%)](#7-flash-100)
8. [Cycle (99%)](#8-cycle-99)
9. [Habits (100%)](#9-habits-100)
10. [Books (100%)](#10-books-100)
11. [Journal (100%)](#11-journal-100)
12. [Meds (100%)](#12-meds-100)

13. [Fast (100%)](#13-fast-100)
14. [Voice (100%)](#14-voice-100)
15. [Recipes (100%)](#15-recipes-100)
16. [RSVP (100%)](#16-rsvp-100)
17. [Surf (97%)](#17-surf-97%)
18. [Trails (100%)](#18-trails-100)
19. [Car (100%)](#19-car-100)
20. [Homes (100%)](#20-homes-100)
21. [Pets (100%)](#21-pets-100)
22. [Words (100%)](#22-words-100)
23. [Stars (100%)](#23-stars-100)
24. [Closet (100%)](#24-closet-100)
25. [Garden (100%)](#25-garden-100)
26. [Forums (100%)](#26-forums-100)
27. [Market (90%)](#27-market-90)
28. [Mail (100%)](#28-mail-100)
29. [Subs (90%)](#29-subs-90)
30. [Summary](#summary)

---

## 1. Budget (95%)

### Features Built
- [x] Envelope budgeting (YNAB-style)
- [x] 29 database tables
- [x] Plaid bank sync
- [x] 215-entry subscription catalog
- [x] Recurring transaction detection
- [x] Payday detection
- [x] Savings goals
- [x] Debt payoff (snowball/avalanche)
- [x] Net worth tracking
- [x] Multi-currency support
- [x] CSV export
- [x] Transaction rules
- [x] Alerts
- [x] Category groups
- [x] Budget allocations
- [x] Transaction splits
- [x] Recurring templates
- [x] Payee cache
- [x] Notification log
- [x] Shared envelopes

### Features Needed (from competitors)
- [ ] Net worth tracking improvements (seen in: Monarch Money, YNAB) -- Priority: P0
- [ ] Reports/charts dashboard (seen in: YNAB, Monarch Money, Copilot) -- Priority: P1
- [ ] Investment tracking (seen in: Monarch Money, Copilot) -- Priority: P1
- [ ] Expense splitting (seen in: Rocket Money, PocketGuard) -- Priority: P1
- [ ] Receipt OCR (seen in: Copilot, PocketGuard) -- Priority: P1
- [ ] Multi-currency improvements (seen in: YNAB) -- Priority: P1
- [ ] ML auto-categorization (seen in: Monarch Money, Copilot, Rocket Money) -- Priority: P2
- [ ] Loan planner (seen in: YNAB) -- Priority: P2
- [ ] Age of money metric (seen in: YNAB) -- Priority: P2
- [ ] Subscription cancellation assist (seen in: Rocket Money) -- Priority: P2
- [ ] Family sharing (seen in: Monarch Money, YNAB) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| YNAB | $109/yr | Envelope budgeting pioneer, age of money metric, goal templates |
| Monarch Money | $99.99/yr | Investment tracking, collaborative budgeting, ML categorization |
| Rocket Money | $48-144/yr | Subscription cancellation concierge, bill negotiation |
| PocketGuard | $74.99/yr | "In My Pocket" remaining spending view, receipt scanning |
| Copilot | $119.88/yr | Premium UI, real-time sync, investment portfolio view |

---

## 2. Nutrition (98%)

### Features Built
- [x] 1000+ food database (USDA + Open Food Facts + FatSecret)
- [x] Barcode scanning
- [x] AI photo food logging
- [x] Meal composition (breakfast/lunch/dinner/snack)
- [x] Macro tracking (calories, protein, carbs, fat, fiber, sugar, sodium)
- [x] 200+ nutrient tracking
- [x] Daily goals
- [x] FTS search
- [x] Trend analysis (7/30 day)
- [x] Fasting integration
- [x] CSV export
- [x] API rate limiting
- [x] Restaurant menus (chain database + custom entries)
- [x] Wearable sync (energy balance + HealthKit adapter)
- [x] Water tracking (daily goals, containers, weekly totals)
- [x] Community/social (profiles, connections, feed, challenges, leaderboards)
- [x] Food diary notes (tags, prompts, FTS search)
- [x] Nutrition Correlation Engine (6 cross-module insight detectors)

### Features Beyond Competitors (Hub Advantage)
- [x] Cross-module fasting correlation (fast-break quality vs calorie adherence)
- [x] Cross-module meal timing vs energy (nutrition + mood data)
- [x] Cross-module gym-day calorie analysis (nutrition + workouts data)
- [x] Restaurant impact analysis (automatic calorie comparison)
- [x] Water-snacking correlation (hydration vs snack frequency)
- [x] Protein-workout adherence tracking

### Features Needed (from competitors)
- [ ] Wearable sync refinement (native HealthKit module wiring for production) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| MyFitnessPal | $79.99/yr | Largest food database (14M+ items), 220M registered users, $310M revenue |
| Cronometer | $49.99/yr | 82+ micronutrients, clinical-grade accuracy, gold standard data |
| Lose It! | $39.99/yr | AI photo recognition, restaurant menu integration, community challenges |
| MacroFactor | $71.88/yr | Algorithm-adjusted macros, expenditure estimation, coaching engine |

---

## 3. Health (99%)

### Features Built
- [x] Document vault
- [x] Vitals tracking (10 types: HR, RHR, HRV, O2, BP, temp, steps, active energy, RR, VO2)
- [x] Sleep logging with quality scoring
- [x] Emergency ICE card
- [x] Cross-domain health goals
- [x] Module absorption (meds/fast/cycle)
- [x] HealthKit integration (adapter, sync engine, background task, data mappers, permissions)
- [x] Breathing exercises (box, 4-7-8, relaxing, energizing, sleep patterns with mood tracking)
- [x] Wellness timeline (cross-module event feed with filtering and pagination)
- [x] Sleep stage analysis (breakdown, targets, efficiency, trends)
- [x] Heart rate during sleep (overnight curve, stage averages, HR dip calculation)
- [x] Blood oxygen tracking (SpO2 categorization, trend analysis, low alerts)
- [x] Readiness score (sleep + HRV + RHR + activity + strain composite with recommendations)
- [x] Guided meditation (8 types: body scan, loving kindness, mindful awareness, stress relief, sleep prep, focus, gratitude, custom timer)
- [x] Activity tracking (steps, active energy, move minutes with ring progress and streaks)
- [x] HRV tracking (baseline, percentile rank, categorization, trend analysis, insights)
- [x] Smart alarm (light sleep wake window, configurable days/sounds, success rate tracking)
- [x] Snore detection (session recording, event classification, score calculation, intensity tracking)
- [x] Sleep bank (cumulative debt/surplus, 7-day balance, 30-day trend)
- [x] Sleep aids (wind-down routines, ambient sounds, sleep hygiene tips, routine-sleep correlation)
- [x] CBT exercises (thought record, behavioral activation, cognitive restructuring, gratitude, worry time, values clarification)
- [x] SOS/panic (grounding exercises, crisis hotlines, mood tracking, session history)
- [x] Multi-app aggregation (CSV import, deduplication, conflict detection, import logging)
- [x] Body composition (weight, body fat, lean mass, BMI, waist/hip/chest, unit conversion)
- [x] Daily health score (cross-domain 0-100 composite from readiness, adherence, sleep, mood, activity, mindfulness)
- [x] Cross-domain correlation engine (Pearson correlation between any two health time series with significance testing)
- [x] Weekly health digest (cross-domain summary with highlights and concerns)
- [x] Comprehensive doctor report (extends meds report with vitals, sleep, activity, emergency info)

### Features Needed (from competitors)
No remaining feature gaps. All 18 competitor features have been implemented as engines with CRUD, types, and tests. HealthKit integration requires native wiring (Expo native module) for production use.

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Apple Health | Free | Native OS integration, HealthKit ecosystem, Sleep Focus mode |
| Google Fit | Free | Cross-platform, Google ecosystem, readiness score |
| Bearable | $34.99/yr | Symptom-factor correlation, multi-condition tracking |
| CareClinic | $9.99/mo | Clinical self-care plans, caregiver access, therapy tools |

---

## 4. Workouts (99%)

### Features Built
- [x] 50+ exercise library
- [x] Body map (14 muscle groups)
- [x] Workout builder
- [x] Session state machine (13 actions)
- [x] 1RM tracking (Epley/Brzycki)
- [x] Warmup calculator
- [x] Plate loader
- [x] Voice commands (20 phrases)
- [x] Multi-week plans
- [x] Body measurements
- [x] Progress analytics (streaks, volume, PRs, weekly summaries)
- [x] Superset support
- [x] Rest timer (engine REST state + REST_TIME_PRESETS + per-exercise restAfter)
- [x] Previous performance display (getPreviousPerformance query + ghost text data)
- [x] Video exercise demos (demo asset resolver + trainer video upload system)
- [x] AI workout generation (rule-based generator: goal/muscle/equipment/duration)
- [x] Progressive overload automation (trigger evaluation + weight/rep/set suggestions)
- [x] Muscle recovery heatmap (14 muscle groups, fatigue scoring, training suggestions)
- [x] GPS route recording (haversine, pace, elevation, calorie estimation, noise filtering)
- [x] Apple Watch app (sync protocol: phone-to-watch + watch-to-phone messages)
- [x] Plate calculator improvements (custom plate inventories, bar presets, unit conversion)
- [x] Progress photos (4 view types, local-only storage, comparison support)
- [x] Workout sharing (summary card builder with PRs, volume, muscle groups)
- [x] Social feed (privacy-first: granular sharing controls, feed pagination, enrichment)

### Features Beyond Competitors
- [x] Cross-module intelligence engine (6 insight detectors: mood-lift correlation, fasting performance, protein-recovery, consistency momentum, time-of-day performance, volume-mood feedback)
- [x] Privacy-first offline architecture (all data on device, zero cloud dependency for core features)
- [x] Cross-module data bridge (reads mood, nutrition, fasting tables with graceful degradation)

### Features Needed (from competitors)
None -- full competitive parity achieved plus hub-exclusive intelligence features.

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Strava | $79.99/yr | GPS activity tracking, 180M users, social feed, segments/leaderboards |
| JEFIT | $155.88/yr | 12M users, 1400+ exercises with animations, bodybuilding focus |
| Fitbod | $95.99/yr | 10M users, AI-generated workouts, muscle recovery tracking |
| Hevy | $36/yr | 9M athletes, clean UI, workout sharing, routine templates |
| Strong | $29.99/yr | 3M users, minimalist design, Apple Watch, plate calculator |

---

## 5. Mood (100%)

### Features Built
- [x] 1-10 mood scoring with labels
- [x] Plutchik emotion tagging (24 emotions, 8 axes, 3 intensity levels)
- [x] Activity tracking (15 default + custom)
- [x] Pearson r correlation engine with significance testing
- [x] Guided breathing (5 patterns: box, 4-7-8, relaxing, energizing, sleep with mood tracking)
- [x] Streak tracking
- [x] Year-in-Pixels visualization
- [x] Daily/weekly/monthly averaging
- [x] Dashboard
- [x] Top emotions analysis
- [x] Weekly reports
- [x] Custom experiments (A/B lifestyle testing with baseline/intervention phases, Pearson analysis)
- [x] Photo/voice attachments (photo + voice memo with thumbnails, file size, duration)
- [x] PIN/biometric lock (PIN 4-6 digit + biometric + combined, lockout with cooldown)
- [x] Virtual pet gamification (6 species, 6 evolution stages, happiness decay, cross-module feeding)
- [x] Self-care suggestions (26-item catalog across 5 categories, data-driven + cross-module + catalog sources)
- [x] Guided meditation (step-based timer engine, templates by category/difficulty, pre/post mood tracking)
- [x] Focus music/ambient sounds (13 sounds, 5 default presets, layered mixing, custom presets)
- [x] SOS/panic button (4-step flow: breathing, 5-4-3-2-1 grounding, affirmation, exit mood check)
- [x] AI mood insights (8 algorithmic detectors: day-of-week, time-of-day, activity impact, emotion cluster, streak impact, trend direction, volatility alert, best/worst day)

### Features Needed (from competitors)
None -- full competitive parity achieved.

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Calm | $69.99/yr | $100M+ ARR, meditation library, sleep stories, focus music |
| Headspace | $69.99/yr | Guided meditation courses, focus modes, SOS exercises |
| Daylio | $35.99/yr | 20M users, micro-diary, photo attachments, custom activities |
| Bearable | $34.99/yr | Multi-factor correlation, custom experiments, symptom tracking |
| Reflectly | $59.99/yr | AI-powered journaling prompts, mood insights, self-care tips |

---

## 6. Notes (100%)

### Features Built
- [x] Markdown editor
- [x] Wiki-style [[backlinks]]
- [x] FTS5 full-text search
- [x] Folder hierarchy with nesting
- [x] Tag system with co-occurrence analysis and suggestions
- [x] Knowledge graph (backlinks/outgoing links, hub/bridge/orphan detection)
- [x] Pin/favorite
- [x] Word/char counting
- [x] Templates with variable expansion and 8 built-in templates (seen in: Notion, Obsidian)
- [x] Settings
- [x] Checklists with toggle, indent/outdent, auto-sort, progress (seen in: Notion, Apple Notes, Evernote)
- [x] Daily notes with get-or-create and date browsing (seen in: Obsidian)
- [x] Code blocks with 30+ language support and aliases (seen in: Notion, Obsidian)
- [x] Image/file attachments with OCR text/status (seen in: Notion, Evernote, Apple Notes)
- [x] Table support with GFM parsing, alignment, row/column CRUD (seen in: Notion, Evernote)
- [x] AI writing assistant with on-device summarize/grammar/simplify (seen in: Notion)
- [x] Graph view with filtering, local graph, clustering, density stats (seen in: Obsidian)
- [x] Web clipper with HTML-to-markdown conversion (seen in: Evernote, Notion)
- [x] OCR in images with FTS5 search on OCR text (seen in: Evernote)
- [x] Plugin system with install/enable/disable/settings (seen in: Obsidian)
- [x] Relational databases with columns/rows/cells/views (seen in: Notion)
- [x] Canvas/whiteboard with 6 node types, 5 shapes, 3 edge styles, grouping (seen in: Obsidian, Notion)
- [x] Knowledge discovery engine: staleness scoring, content similarity, suggested links, knowledge gaps
- [x] Writing analytics engine: creation trends, word count distribution, writing velocity, streaks
- [x] Link intelligence engine: connection strength, hub detection, link density, bridge detection
- [x] Tag intelligence engine: usage analytics, co-occurrence, unused tags, tag suggestions

### Features Needed (from competitors)
- None -- all P0-P3 competitive features implemented

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Notion | $96/yr | 100M+ users, relational databases, team collaboration, AI assistant |
| Evernote | $179.88/yr | Web clipper, OCR in images, document scanning, legacy brand |
| Obsidian | $48/yr (sync) | 1.5M MAU, local-first, plugin ecosystem (1000+), graph view |
| Apple Notes | Free | Native iOS integration, Quick Notes, scanning, shared folders |

---

## 7. Flash (100%)

### Features Built
- [x] FSRS-inspired spaced repetition (4 ratings: again/hard/good/easy)
- [x] Deck hierarchy
- [x] 4 card types (basic, reversed, cloze, occlusion)
- [x] Queue states (new/learning/review/suspended/buried)
- [x] Leech detection
- [x] Daily limits (new/review/study target)
- [x] Streak tracking with milestone celebrations and badges (seen in: Quizlet)
- [x] Card browser with 6 sort options
- [x] Export with scheduling preservation
- [x] Ease factor clamping (1.3-3.2)
- [x] Rich media cards (audio/images) (seen in: Quizlet, Anki, Brainscape)
- [x] Daily reminders with configurable time (seen in: Quizlet, Brainscape)
- [x] Image occlusion with rect/ellipse shapes (seen in: Anki)
- [x] Custom card templates with built-in vocabulary template (seen in: Anki)
- [x] AI card generation from text (on-device + cloud) (seen in: StudyFetch, Quizlet)
- [x] Match game with star ratings and best times (seen in: Quizlet)
- [x] Multiple choice with distractor engine (seen in: Quizlet, Brainscape)
- [x] AI practice tests (MC, T/F, short answer, fill blank) (seen in: StudyFetch)
- [x] Competitive leagues with 5 tiers and XP system (seen in: Quizlet)
- [x] AI conversation practice (tutor, quiz, explain, debate) (seen in: StudyFetch)
- [x] Study analytics engine (retention rate, review forecast, accuracy trends, difficulty/maturity distribution)
- [x] Forgetting curve engine (personal retention curves, half-life estimates, retention prediction)
- [x] Study session detection and analytics (gap-based detection, duration estimates, optimal study time)
- [x] Cross-module study signals (vocabulary cards from books, study deck from notes, study readiness score)
- [x] Anki .apkg import parser (deck hierarchy, card types, scheduling state mapping)

### Features Needed (from competitors)

(none -- full competitive parity achieved)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Quizlet | $35.99/yr | 300M registered users, $96M revenue, AI study modes, match game |
| Anki | Free / $29.99 iOS | Open-source, unlimited customization, image occlusion, plugin ecosystem |
| Brainscape | $79.99/yr | Confidence-based repetition, class collaboration, rich media |
| StudyFetch | $228/yr | AI-powered study tools, practice tests, conversation practice |
| MintDeck | TBD | FSRS built-in, ad-free iOS, AI generation, Anki import |

---

## 8. Cycle (99%)

### Features Built
- [x] Cycle logging
- [x] Daily symptom tracking (13+ symptoms physical/mood, 3 intensities)
- [x] Flow level logging (light/medium/heavy/spotting)
- [x] Phase tracking (menstrual/follicular/ovulation/luteal)
- [x] Analytics (avg length, period length, shortest/longest, std dev)
- [x] Symptom frequency analysis
- [x] Weighted moving average prediction (last 6 cycles, recency bias)
- [x] Fertile window estimation
- [x] Current phase calculation
- [x] Late detection
- [x] Gap filtering (>90 days)
- [x] Temperature tracking with BBT coverline and shift detection (seen in: Natural Cycles, Clue, Flo)
- [x] Partner sync with granular privacy controls and share codes (seen in: Flo, Clue)
- [x] Pregnancy mode with week-by-week tracking, 4 due date methods, appointments (seen in: Flo, Ovia)
- [x] Symptom phase pattern analysis (which symptoms cluster in which phases)
- [x] Cycle length trend detection (lengthening/shortening/stable via linear regression)
- [x] Cycle regularity scoring and trend tracking
- [x] Human-readable insight generation (predictions, fertile windows, trends, patterns)
- [x] Cross-module phase signal for hub integration

### Features Needed (from competitors)
- [ ] Community forums (seen in: Flo) -- Priority: P2 (handled by Forums module)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Flo | $49.99/yr | 440M registered users, $275M revenue, AI health assistant, pregnancy mode |
| Clue | $39.99/yr | 10M+ users, science-backed predictions, partner sync |
| Natural Cycles | $89.99/yr | FDA-cleared contraception, temperature-based tracking |
| Ovia | Free | Pregnancy and fertility focus, week-by-week guides |

---

## 9. Habits (100%)

### Features Built
- [x] 4 habit types (standard, timed, negative, measurable)
- [x] Daily/weekly/monthly/specific-days frequency
- [x] Time-of-day targeting
- [x] Grace period support
- [x] Timed sessions
- [x] Numeric measurements
- [x] Streak calculation with grace + streak freeze/insurance
- [x] GitHub-style heatmap
- [x] Completion rates by day/time/month
- [x] CSV export
- [x] Sobriety clock with money saved, daily pledges, lifetime stats
- [x] Craving log with triggers, intensity tracking, coping strategies
- [x] Milestone celebrations (streak, completion, sobriety, money, custom)
- [x] RPG gamification (XP, levels, unlockable items)
- [x] Focus timer (Pomodoro with work/break/long-break phases)
- [x] HealthKit auto-tracking (steps, sleep, water, exercise)
- [x] Challenges/programs (8 built-in: meditation, C25K, morning routine, etc.)
- [x] Achievement badges (37 badges across 5 categories)
- [x] Pet/avatar collection (5 species, mood system, wardrobe)
- [x] Location-based reminders (geofence triggers)
- [x] Siri shortcuts (voice completion)
- [x] Time tracking with billable projects and CSV reports
- [x] Habit stacking (Atomic Habits methodology, chain sequencing)
- [x] Action items / sub-tasks (ordered checklists per habit)

### Features Needed (from competitors)
(none -- full competitive parity achieved)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Habitica | $59.88/yr | RPG gamification, pet collection, guild quests, social accountability |
| Fabulous | $59.99/yr | Science-based habit coaching, structured journey programs |
| Habitify | $59.88/yr | Multi-platform, focus timer, detailed analytics, Apple Watch |
| Streaks | $4.99 one-time | Apple Design Award, HealthKit integration, Siri shortcuts |
| Loop Habit Tracker | Free | Open-source, no ads, flexible scheduling, Android-only |

---

## 10. Books (100%)

### Features Built
- [x] 35+ database tables (6 migrations)
- [x] Multi-shelf organization (Want to Read, Currently Reading, Finished, custom)
- [x] Reading sessions with timer
- [x] Half-star ratings
- [x] Annual goals
- [x] Year-in-review stats
- [x] Built-in ePub/PDF reader
- [x] Reading challenges with multiplier bonuses
- [x] Encrypted journal with photos
- [x] Goodreads/StoryGraph CSV import
- [x] Barcode scanning
- [x] FTS5 search
- [x] Mood tagging
- [x] Content warnings
- [x] Series tracking
- [x] Share events
- [x] Book recommendations engine (author/genre affinity, on-device)
- [x] Social feed (opt-in, Supabase-backed, friend connections)
- [x] Reading stats sharing (5 card templates, local rendering)
- [x] Badge/achievement system (31 badges, 9 categories)
- [x] Book clubs (local + connected modes, reading pace tracking)
- [x] Community challenges (12 preset templates, custom creation)
- [x] Quote collection with FTS search
- [x] Personalized reading insights (speed patterns, peak hours, genre diversity)
- [x] Genre evolution timeline
- [x] "On This Day" reading history

### Features Needed (from competitors)
(none -- full competitive parity achieved)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Goodreads | Free | 150M users, Amazon-owned, massive book database, social reviews |
| StoryGraph | $49.99/yr | 5M+ users, mood-based recommendations, content warnings, stats |
| Bookly | $30/yr | Reading timer, streaks, statistics, reading speed tracking |
| Literal | Free | Clean design, social reading lists, book discussions |

---

## 11. Journal (100%)

### Features Built
- [x] Daily markdown journaling
- [x] Mood tagging (5 levels)
- [x] Custom tags with colors
- [x] Image URI attachments
- [x] Search across title/body
- [x] Streak tracking (current/longest, 1-day grace)
- [x] Word counting
- [x] On-this-day feature with smart nostalgia ranking
- [x] Daily prompts (reflection/gratitude/therapy/stoic)
- [x] Multiple notebooks
- [x] Dashboard with stats
- [x] Export bundle
- [x] Voice-to-text with recording management and transcription pipeline
- [x] Automatic metadata (location, weather, timezone)
- [x] AI-powered prompts with mood-aware theme selection
- [x] Grid/mandala layout with built-in templates
- [x] Vision board with image/text/quote/goal items
- [x] Affirmations with 8 categories and streak tracking
- [x] Stoic/philosophy quotes across 5 traditions
- [x] CBT thought records with 15 cognitive distortions and belief tracking
- [x] Therapy prep templates (pre/post session, crisis plan, progress check-in)
- [x] Book builder with page layout estimation and cover templates
- [x] Writing insights engine (word count trends, vocabulary richness, tag analysis)
- [x] Therapeutic progress engine (CBT completion rates, belief reduction, distortion ranking)
- [x] Journaling habit intelligence (consistency scoring, entry richness, best writing day/time)
- [x] Mood-writing correlation (tag-mood analysis, prompt category impact)
- [x] Writing challenge system (6 challenges: gratitude, CBT, stoic, photo, mood, explorer)

### Features Needed (from competitors)
- [ ] Printed books via print partner API (seen in: Day One) -- Priority: P3

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Day One | $34.99/yr | Auto-metadata (location, weather, music), printed books, E2E encryption |
| Daylio | $35.99/yr | Micro-diary format, mood + activity tracking, CBT templates |
| Diarium | $5-10 one-time | Multi-platform, calendar view, import from Day One |
| Apple Journal | Free | Native iOS, suggestions from photos/location/music, minimal design |
| Reflectly | $59.99/yr | AI-powered journaling prompts, mood insights, self-care tips |
| Grid Diary | $22.99/yr | Structured grid/mandala journaling prompts |
| Gratitude | $22.99/yr | Gratitude journaling, affirmations, vision boards |
| Stoic | $39.99/yr | Stoicism-based mental wellness, CBT tools |

---

## 12. Meds (100%)

### Features Built
- [x] 30+ database tables across 4 migration versions
- [x] Medication CRUD with dosage/frequency/prescriber/pharmacy
- [x] Extended model (pill count, decrement)
- [x] Dose logging (taken/skipped/late/snoozed)
- [x] Smart reminders
- [x] Adherence analytics (compliance rate, streaks, calendar, day-of-week patterns)
- [x] Refill tracking with burn rate
- [x] Drug interactions (200+ pairs, severity levels)
- [x] Mood check-ins (Plutchik)
- [x] Symptom logging
- [x] Health measurements (BP, blood sugar, weight, temp, custom)
- [x] Pearson correlation engine (mood-med, symptom-med, adherence-mood)
- [x] Markdown reports (doctor/therapy)
- [x] CSV export
- [x] Blood pressure logging with AHA classification (systolic/diastolic/pulse, arm, position, context)
- [x] Blood glucose logging (manual entry with meal context: fasting, before/after meal, bedtime)
- [x] Insulin tracking (type, units, dose category, injection site rotation, carbs covered)
- [x] BP trend visualization (trend data, period stats, trend direction, period comparison, weekly aggregation)
- [x] Caregiver alerts (alert config per medication, delay, delivery method, weekly summary)
- [x] CGM integration (HealthKit sync, trend arrows, time-in-range breakdown, AGP stats)
- [x] HbA1c calculator (estimated from glucose readings, confidence scoring, GMI calculation)
- [x] Pain location map (body zones, severity, pain type, duration, heatmap, medication correlation)
- [x] Weather correlation (barometric pressure, humidity, temperature vs symptoms, trigger profiles)
- [x] FODMAP tracking (food diary, FODMAP classification, trigger correlation, Bristol stool scale)
- [x] Medication insights engine (weekend/timing patterns, per-med adherence, refill alerts, symptom correlation)
- [x] Regimen summary engine (daily health briefing, vitals snapshot, alerts, wellness trend)
- [x] Wellness score engine (composite 0-100 score: adherence + vitals + mood + symptoms)

### Features Needed (from competitors)
- [x] Blood pressure logging improvements (seen in: CareClinic, Medisafe) -- BUILT: bp/engine.ts + db/bp.ts
- [x] Blood glucose logging (seen in: CareClinic, MySugr) -- BUILT: glucose/engine.ts + db/glucose.ts
- [x] Insulin tracking (seen in: MySugr, CareClinic) -- BUILT: insulin/engine.ts + db/insulin.ts
- [x] BP trend visualization (seen in: CareClinic) -- BUILT: bp/trends.ts
- [x] Caregiver alerts (seen in: Medisafe, CareClinic) -- BUILT: caregiver/engine.ts
- [x] CGM integration (seen in: MySugr) -- BUILT: cgm/engine.ts
- [x] HbA1c calculator (seen in: MySugr) -- BUILT: glucose/a1c.ts
- [x] Pain location map (seen in: CareClinic) -- BUILT: pain/engine.ts
- [x] Weather correlation (seen in: Bearable) -- BUILT: weather/engine.ts
- [x] FODMAP tracking (seen in: CareClinic) -- BUILT: fodmap/engine.ts

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Medisafe | $39.99/yr | 7M users, family/caregiver alerts, drug interaction checker |
| MyTherapy | Free | Medication reminders, health journal, symptom tracking |
| CareClinic | $119.88/yr | Comprehensive self-care tracking, caregiver access, clinical reports |

---

## 13. Fast (100%)

### Features Built
- [x] 14+ database tables
- [x] Fasting timer with 8 presets (16:8, 18:6, 5:2, 20:4, OMAD, 36h, 48h, 72h) + custom
- [x] 6 fasting zones (fed state to autophagy possible)
- [x] Eating window awareness (timer shows eating window countdown after completing a fast)
- [x] Streak tracking with grace period
- [x] Weight tracking with trends
- [x] Multi-beverage hydration tracking (12 types with hydration coefficients)
- [x] Caffeine tracking with half-life metabolization curves
- [x] Custom container presets for quick logging
- [x] Smart water reminders engine (personalized targets, configurable intervals)
- [x] Goals with progress tracking
- [x] CSV export
- [x] Notification config
- [x] Resilient timer state machine (survives app kills)
- [x] Fast quality score engine (composite 0-100 rating per fast)
- [x] Protocol progression engine (suggests next protocol after sustained adherence)
- [x] Week-in-review summary engine
- [x] HealthKit sync engine (weight import, activity context, fast export)
- [x] Apple Watch sync engine (state transfer, watch commands)

### Features Needed (from competitors)
- [ ] Apple Watch quick-log (seen in: Zero, Fastic) -- Priority: P1 (engine built, needs watchOS companion)
- [ ] HealthKit native integration (seen in: Zero, Simple) -- Priority: P1 (engine built, needs native wiring)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Fastic | $59.99-79.99/yr | 10M users, meal plans, recipe integration, step tracker |
| Zero | $69.99/yr | 2.5M downloads, fasting zones, journal, Apple Watch |
| Simple | $59.99/yr | AI nutrition coach, meal plans, water tracking |
| BodyFast | $39.99/yr | Intermittent fasting coach, weekly plans, community |

---

## 14. Voice (92%)

### Features Built
- [x] On-device dictation
- [x] Transcription with language detection and confidence scoring
- [x] Audio URI storage
- [x] Tagging
- [x] Favorites
- [x] Word counting
- [x] Reading time estimation (200 wpm)
- [x] Keyword extraction (frequency-based with stop words)
- [x] Text summarization
- [x] Transcription statistics
- [x] Duration formatting
- [x] Voice command support

### Features Needed (from competitors)
- [ ] Custom voice commands (seen in: Otter.ai) -- Priority: P1
- [ ] Speaker identification (seen in: Otter.ai, Notta) -- Priority: P1
- [ ] Multi-language simultaneous transcription (seen in: Notta) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Otter.ai | $100/yr | 10M users, meeting transcription, speaker identification, AI summary |
| Notta | $100-180/yr | Multi-language, real-time translation, team collaboration |
| Apple Voice Memos | Free | Native iOS, iCloud sync, trim/edit |
| Google Recorder | Free | On-device transcription, search within recordings |

---

## 15. Recipes (100%)

### Features Built
- [x] 17+ database tables (rc_ prefix only after V7)
- [x] Full recipe CRUD
- [x] Ingredient parser with unit conversion
- [x] Recipe scaling
- [x] Cooking mode with timers
- [x] Meal planner
- [x] Shopping lists with aisle grouping
- [x] Pantry tracker with barcode lookup
- [x] Cross-module garden orchestration (deep link to MyGarden)
- [x] Cross-module event orchestration (deep link to MyRSVP)
- [x] Allergy/dietary detection
- [x] URL recipe import (JSON-LD, Microdata, Meta fallback)
- [x] AI food recognition (Claude Vision)
- [x] 84+ nutrient tracking
- [x] Video recipe import (YouTube/TikTok/Instagram)
- [x] AI recipe extraction (paper/photo OCR via Claude Vision)
- [x] Nutritional info per recipe (auto-calculated from ingredients)
- [x] Print recipes (HTML template with print stylesheet)
- [x] Recipe sharing (token-based with expiry and view count)
- [x] Voice control in cooking mode (next/prev step, timers, ingredients)
- [x] Recipe collections
- [x] Pantry staples management

### Features Needed (from meal-planning competitors)
- [ ] Auto-generated meal plans based on preferences (seen in: Mealime, Eat This Much) -- Priority: P2
- [ ] Macro/calorie goal targeting in meal plans (seen in: Eat This Much) -- Priority: P2
- [ ] Ingredient substitution suggestions (seen in: Whisk/Samsung Food) -- Priority: P3

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Paprika | $4.99 one-time | Recipe OCR, web import, meal planning, grocery lists |
| AnyList | $11.99/yr | Shared grocery lists, recipe scaling, voice integration |
| Recipe One | Subscription | Video recipe import, visual meal planning |
| Forkee | Free | TikTok/YouTube recipe import, social sharing |
| Mealime | Free/Pro $5.99/mo | Auto-generated meal plans, dietary filters, step-by-step cooking |
| Whisk/Samsung Food | Free | AI recipe discovery, smart shopping lists, ingredient substitutions |
| Eat This Much | $5/mo | Calorie/macro-targeted meal plans, grocery lists, nutrition tracking |

---

## 16. RSVP (85%)

### Features Built
- [x] 13 database tables
- [x] Event creation
- [x] Invite management
- [x] RSVP tracking with plus-ones
- [x] Custom questions
- [x] Polls
- [x] Announcements
- [x] Photo albums
- [x] Check-in
- [x] Analytics
- [x] Waitlist
- [x] Co-host permissions

### Features Needed (from competitors)
- [ ] Calendar sync (iCal export) (seen in: Partiful, Evite, RSVPify) -- Priority: P0
- [ ] Event templates (seen in: Evite, RSVPify) -- Priority: P1
- [ ] Custom invitation designs (seen in: Evite, RSVPify) -- Priority: P1
- [ ] Expense splitting (seen in: Partiful) -- Priority: P1
- [ ] Recurring events (seen in: RSVPify) -- Priority: P1
- [ ] Map/directions (seen in: Partiful, Evite) -- Priority: P1
- [ ] Dietary preference collection (seen in: RSVPify) -- Priority: P1
- [ ] Guest messaging/chat (seen in: Partiful) -- Priority: P2
- [ ] Gift registry (seen in: Evite) -- Priority: P2
- [ ] Event recap/memories (seen in: Partiful) -- Priority: P2
- [ ] Seating arrangement tool (seen in: RSVPify) -- Priority: P3

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Partiful | Free | 500K MAU, social event discovery, expense splitting, messaging |
| Evite | Free/premium | Custom invitation designs, gift registry, ad-supported |
| RSVPify | $19/mo | Professional events, seating charts, dietary collection |
| Invyt | Free | Simple group planning, polls, task assignment |

---

## 17. Surf (97%)

### Identity: Anti-Enshittification Surf Intel

MySurf is positioned as the privacy-first, ad-free alternative to Surfline. Clean NOAA data, no tracking, opt-in social. High-frequency acquisition wedge for the MyLife hub.

### Features Built
- [x] 200+ spots across 5 regions (CA, Hawaii, East Coast N/S, Portugal)
- [x] Hourly forecast cache with swell components
- [x] NOAA buoy data with multi-zone station mappings
- [x] Tide data
- [x] AI-generated forecast narratives
- [x] Configurable multi-rule alerts with AND/OR logic
- [x] Community reviews/photos/guides
- [x] GPS wave detection
- [x] Coastal trail tracking with GPX export
- [x] Spot rating engine (swell/wind/tide/consistency weighted scoring)
- [x] Quick-glance Go/Maybe/No verdict scoring
- [x] Multi-region zones with bounding boxes and timezones
- [x] Opt-in social: profiles, follows, shared sessions, crews, comments, likes

### Features Intentionally Omitted
- ~~Cam feeds~~ -- requires expensive infrastructure and licensing; Surfline's content moat, not ours
- ~~Ensemble forecast models~~ -- multi-model comparison requires infrastructure we don't have; single NOAA source is sufficient for our target user
- ~~Editorial content~~ -- requires surf journalists and photographer partnerships; out of scope for privacy-first positioning

### Remaining Gaps
- [ ] NOAA/NDBC data pipeline migration to hub (currently standalone-only) -- Priority: P1
- [ ] Social opt-in onboarding UX (Feed tab prompt, profile creation flow) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Surfline | $119.99/yr | Live cam feeds, 16-day forecasts, global coverage, editorial content |
| Magic Seaweed | Free/premium | Acquired by Surfline (2023). Global spot database, swell charts |
| Windy | $19.99/yr | Advanced weather visualization, multi-model comparison |
| MySurf (MyLife) | Bundled | Privacy-first, ad-free, NOAA data, opt-in social, Go/Maybe/No scoring |

---

## 18. Trails (50%)

### Features Built
- [x] GPS trail recording
- [x] Elevation/distance analytics
- [x] Trail ratings

### Features Needed (from competitors)
- [ ] Offline map downloads (seen in: AllTrails, Gaia GPS, Komoot) -- Priority: P0
- [ ] Weather overlay (seen in: AllTrails, Gaia GPS) -- Priority: P1
- [ ] Wrong-turn alerts (seen in: AllTrails) -- Priority: P1
- [ ] Trail difficulty rating (seen in: AllTrails, Komoot) -- Priority: P1
- [ ] Route planning/builder (seen in: Komoot, Gaia GPS) -- Priority: P2
- [ ] Turn-by-turn navigation (seen in: Komoot) -- Priority: P2
- [ ] Trip itinerary (seen in: AllTrails) -- Priority: P2
- [ ] Packing templates (seen in: AllTrails) -- Priority: P2
- [ ] Segment tracking (seen in: Strava) -- Priority: P2
- [ ] Trail database integration (AllTrails-style) (seen in: AllTrails) -- Priority: P3
- [ ] Community reviews (seen in: AllTrails, Komoot) -- Priority: P3

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| AllTrails | $26.99-53.99/yr | 20M+ users, 400K+ trails, offline maps, wrong-turn alerts |
| Gaia GPS | $39.99/yr | Topo maps, offline downloads, backcountry focus |
| Komoot | $29.99 one-time | 35M+ users, turn-by-turn navigation, route planning, cycling focus |

---

## 19. Car (100%)

### Features Built
- [x] Multi-vehicle tracking
- [x] Service history
- [x] Fuel economy calculations
- [x] Maintenance cost analysis
- [x] Maintenance schedule reminders (seen in: CARFAX Car Care, Simply Auto)
- [x] Cost per mile/km (seen in: Simply Auto, Drivvo)
- [x] Trip log with purpose (seen in: Simply Auto, Drivvo)
- [x] Mileage tracking (GPS) (seen in: Simply Auto, FIXD)
- [x] Insurance document storage (seen in: CARFAX Car Care, Simply Auto)
- [x] Registration/inspection tracker (seen in: Simply Auto)
- [x] Tire tracking (seen in: Simply Auto)
- [x] Parking location saver (seen in: Simply Auto)
- [x] Fuel price comparison (seen in: GasBuddy)
- [x] VIN decoder (seen in: CARFAX Car Care)
- [x] OBD-II diagnostic reader (seen in: FIXD)

### Features Needed (from competitors)
(none remaining)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| CARFAX Car Care | Free | Service history tracking, recall alerts, VIN lookup |
| Simply Auto | Free/premium | Comprehensive vehicle management, trip log, fuel tracking |
| FIXD | $9.99/mo + device | OBD-II diagnostics, real-time engine monitoring, severity ratings |
| Drivvo | Free/premium | Fuel tracking, expense reports, multi-vehicle management |

---

## 20. Homes (60%)

### Features Built
- [x] Real estate portfolio management
- [x] Property tracking
- [x] Mortgage/rental analytics

### Features Needed (from competitors)
- [ ] Maintenance schedule reminders (seen in: HomeZada, Centriq) -- Priority: P0
- [ ] Appliance manuals (seen in: Centriq) -- Priority: P1
- [ ] Home inventory (seen in: HomeZada) -- Priority: P1
- [ ] Document storage (seen in: HomeZada) -- Priority: P1
- [ ] Contractor contacts (seen in: Thumbtack, Angi, HomeZada) -- Priority: P1
- [ ] Cost tracking (seen in: HomeZada) -- Priority: P1
- [ ] Renovation project planning (seen in: HomeZada) -- Priority: P2
- [ ] Insurance tracking (seen in: HomeZada) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| HomeZada | $59-99/yr | Home inventory, maintenance schedules, renovation tracking, insurance |
| Centriq | $32/yr | Appliance manual storage, maintenance reminders, how-to guides |
| Thumbtack | Free | Contractor marketplace, project cost estimates |
| Angi | Free | Service professional directory, reviews, booking |

---

## 21. Pets (70%)

### Features Built
- [x] Pet profiles (9 species)
- [x] Vaccination tracking
- [x] Vet visit logs
- [x] Medication scheduling
- [x] Weight tracking
- [x] Expense analysis

### Features Needed (from competitors)
- [ ] Feeding schedule/reminders (seen in: 11pets, PetDesk) -- Priority: P1
- [ ] Grooming log (seen in: 11pets) -- Priority: P1
- [ ] Exercise/walk log (seen in: FitBark, 11pets) -- Priority: P1
- [ ] Training progress (seen in: 11pets) -- Priority: P1
- [ ] Dog training lessons (seen in: Pupford) -- Priority: P1
- [ ] Expense tracking improvements (seen in: 11pets) -- Priority: P1
- [ ] Emergency vet info (seen in: PetDesk, Pawp) -- Priority: P1
- [ ] Pet insurance documents (seen in: Pawp) -- Priority: P2
- [ ] Multi-pet dashboard (seen in: 11pets, PetDesk) -- Priority: P2
- [ ] Pet sitter info card (seen in: 11pets) -- Priority: P2
- [ ] Breed-specific health alerts (seen in: FitBark) -- Priority: P2
- [ ] Photo journal (seen in: 11pets) -- Priority: P2
- [ ] Lost pet poster (seen in: PetDesk) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| 11pets | Free/premium | Comprehensive pet management, grooming, training, multi-pet |
| Pawp | $24/mo | 24/7 vet access, emergency fund, pet insurance management |
| PetDesk | Free | Vet appointment booking, reminders, pet records |
| FitBark | $69.95 device | Activity tracker wearable, breed health insights, GPS |

---

## 22. Words (85%)

### Features Built
- [x] Multi-provider dictionary lookup (270+ languages)
- [x] Definitions
- [x] Pronunciations
- [x] Etymology
- [x] Word forms
- [x] Synonyms
- [x] Antonyms
- [x] Rhymes
- [x] Contextual meaning suggestions
- [x] Word helper
- [x] Alphabetical browsing
- [x] LRU caching

### Features Needed (from competitors)
- [ ] Saved words persistence (seen in: Dictionary.com, Merriam-Webster) -- Priority: P1
- [ ] Offline fallback (seen in: Dictionary.com) -- Priority: P1
- [ ] Advanced search filters (seen in: WordReference) -- Priority: P2
- [ ] Flashcard integration (link to Flash module) (seen in: Dictionary.com) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Dictionary.com | Free | Word of the day, vocabulary quizzes, offline access |
| Merriam-Webster | Free | Authoritative definitions, word games, audio pronunciation |
| WordReference | Free | Forum discussions, bilingual dictionaries, conjugation tables |

---

## 23. Stars (60%)

### Features Built
- [x] Birth chart calculations
- [x] Moon phase tracking
- [x] Compatibility scoring
- [x] Tarot card of day
- [x] Transit logging (all on-device)

### Features Needed (from competitors)
- [ ] Friend compatibility (seen in: Co-Star, The Pattern) -- Priority: P1
- [ ] Transit tracking (seen in: Co-Star, TimePassages) -- Priority: P1
- [ ] Lunar cycle guide (seen in: Night Sky) -- Priority: P1
- [ ] Zodiac calendar (seen in: Co-Star) -- Priority: P1
- [ ] Solar return chart (seen in: TimePassages) -- Priority: P2
- [ ] Progressed chart (seen in: TimePassages) -- Priority: P2
- [ ] Astrology journal (seen in: Co-Star) -- Priority: P2
- [ ] Retrograde tracker (seen in: Co-Star, The Pattern) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| SkySafari | $9.99-39.99 | AR sky viewing, telescope control, deep sky database |
| Star Walk 2 | $2.99 | AR star identification, satellite tracking, sky events calendar |
| Night Sky | $39.99/yr | AR exploration, moon phase guide, Apple Watch |
| Stellarium | Free | Open-source planetarium, photorealistic sky rendering |

---

## 24. Closet (100%)

### Features Built
- [x] Clothing inventory
- [x] Outfit creation
- [x] Wear tracking
- [x] Laundry tracking (V2 schema: care instructions, auto-dirty, wears-since-wash, laundry events)
- [x] Seasonal rotation reminders (engine/seasonal.ts: season detection, rotation checks, hemisphere support)
- [x] Cost-per-wear calculation (engine/cpw.ts: leaderboard, by-category averages, median/summary stats)
- [x] Weather-aware recommendations (engine/weather.ts: 5-range temp scoring, season matching, layer labels)
- [x] Packing list generator (V2 schema + engine/packing.ts: season-aware suggestions from wardrobe)
- [x] AI outfit suggestions (engine/outfit-suggest.ts: color harmony, recency weighting, feedback learning)
- [x] Shopping wishlist (V3 schema + db/wishlist.ts: priority levels, purchase tracking, summary)
- [x] Capsule wardrobe builder (V3 schema + engine/capsule.ts: versatility scoring, gap analysis, combo estimation)
- [x] Color palette analysis (engine/color.ts: 80+ color names mapped, distribution, insights, harmony pairs)
- [x] Data export/import (engine/export.ts: full bundle serialization)
- [x] Donation candidate detection (configurable threshold, default 365 days)
- [x] Dashboard metrics (total items, outfits, wardrobe value, 30-day activity, donation count)

### Features Needed (from competitors)
(none -- all competitive features implemented)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Indyx | Free | 4M users, digital closet, laundry tracking, styling tips |
| Clueless | $69/yr | Weather-aware outfits, calendar integration, AI suggestions |
| Stylebook | $5.99 one-time | Cost-per-wear, packing lists, style statistics |
| Alta | Free/premium | AI outfit generation, background removal, virtual try-on |

---

## 25. Garden (40%)

### Features Built
- [x] Plant tracking
- [x] Watering schedules
- [x] Harvest planning
- [x] Garden layouts

### Features Needed (from competitors)
- [ ] AI plant identification (camera) (seen in: PlantIn, PictureThis) -- Priority: P1
- [ ] Disease/pest diagnosis (seen in: PlantIn, PictureThis) -- Priority: P1
- [ ] Light level estimation (seen in: PlantIn) -- Priority: P1
- [ ] Seasonal care (seen in: Planter, Seed to Spoon) -- Priority: P1
- [ ] Wish list (seen in: Planter) -- Priority: P1
- [ ] Room/zone organization (seen in: PlantIn) -- Priority: P1
- [ ] Harvest tracking improvements (seen in: Seed to Spoon) -- Priority: P2
- [ ] Garden layout planner (seen in: GrowVeg, Planter) -- Priority: P2
- [ ] Companion planting guide (seen in: Planter, Seed to Spoon) -- Priority: P2
- [ ] Frost date alerts (seen in: Seed to Spoon) -- Priority: P2
- [ ] Propagation tracking (seen in: Planta) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Planter | $49.99 lifetime | Companion planting guide, garden layout planner, seasonal calendar |
| Seed to Spoon | $46.99/yr | Growing guides, pest identification, frost date integration |
| GrowVeg | $35 one-time | Garden planning software, crop rotation, succession planting |
| PlantIn | $29.99/yr | AI plant identification, disease diagnosis, care reminders |

---

## 26. Forums (75%)

### Features Built
- [x] Reddit-style threaded discussions with nested replies
- [x] Community creation (public/restricted/private)
- [x] Thread creation with voting (up/down)
- [x] Moderation system (mod actions, reports, blocks, community rules, tags)
- [x] User profiles with badges and activity tracking
- [x] Direct messaging (conversations, participants, server-encrypted)
- [x] Media attachments (image upload, link previews, thumbnails)
- [x] Realtime engine (typing indicators, presence, channels)
- [x] Binary human verification (passkey/fingerprint/Face ID)
- [x] "Humans Only" community mode (device attestation required to participate)
- [x] Community health dashboard (% verified, response time, signal-to-noise)
- [x] Transparent mod log (browsable public tab in every community)
- [x] Cross-module content cards (inline book/recipe/workout previews)
- [x] Community templates (auto-seeded module communities with rules, tags, welcome posts)
- [x] SQLite cache (9 cache tables across 2 migrations)
- [x] Full-text search (tsvector: community display_name A + description B, thread title A + body B)

### Features Needed (from competitors)
- [ ] @mention autocomplete (seen in: Discord, Discourse) -- Priority: P1
- [ ] Markdown preview split pane (seen in: Discourse) -- Priority: P1
- [ ] Email notification digests (seen in: Discourse, Reddit) -- Priority: P2
- [ ] Crossposting to multiple communities (seen in: Reddit) -- Priority: P2
- [ ] Sticky megathreads with auto-rotation (seen in: Reddit) -- Priority: P2
- [ ] Content filtering/AutoMod (seen in: Reddit, Discourse) -- Priority: P2
- [ ] Image galleries with lightbox (seen in: Reddit, Discord) -- Priority: P2

### Intentionally Not Built (CEO Review GP-17-8a)
- Voice channels (Discord's moat, not our fight)
- ActivityPub federation (Lemmy's ideology, not our wedge)
- E2EE messaging (deferred to post-Beta)

### MyLife-Unique Differentiators
- Binary human verification (every poster is a verified human via device attestation)
- "Humans Only" community mode (guaranteed bot-free discussion)
- Cross-module content cards (no standalone forum can replicate)
- Community health dashboard (trust metrics replace engagement metrics)
- Subscription-funded (incentives aligned with users, not advertisers)

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Discord | Free / $9.99/mo | 200M+ MAU, voice/video channels, bots, server communities |
| Reddit | Free / $5.99/mo | Community subreddits, upvote system, vast user-generated content |
| Lemmy | Free | Open-source, federated, self-hosted, no tracking |

---

## 27. Market (90%)

### Features Built
- [x] Privacy-first marketplace architecture
- [x] 6 listing types (sell, trade, free, wanted, service_offer, service_request)
- [x] Watchlist with cloud sync
- [x] Signal-style E2E encryption (ECDH + HKDF + AES-256-GCM + safety numbers)
- [x] AES-GCM passphrase encryption for message envelopes
- [x] PostGIS location search (radius-based RPC)
- [x] SQLite offline cache (16 cache tables across 3 migrations)
- [x] Reviews and seller stats
- [x] RLS policies (anon read, auth write)
- [x] Cloud client functions (30+ Supabase query functions)
- [x] Encryption implementation (dual: AES-GCM passphrase + Signal-style ECDH)
- [x] Payment integration (Stripe Connect with escrow, fee splitting, webhooks)
- [x] Delivery tracking (6 carriers: USPS, UPS, FedEx, DHL, Amazon, other)
- [x] Service discovery (portfolio items, service areas, availability scheduling)
- [x] Seller verification (5 tiers: unverified/basic/verified/trusted/top_seller)
- [x] Dispute resolution (7-state machine, auto-timeout, refund calculation)
- [x] Offers system with counter-offers and expiration
- [x] Price history tracking
- [x] Saved searches with match notifications
- [x] Report and block system
- [x] Full-text search (tsvector weighted: title A, description B)

### Features Needed (from competitors)
- [ ] UI screens (seen in: all competitors) -- Priority: P0
- [ ] Cross-module listing integration (seen in: none, MyLife-unique) -- Priority: P1

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Facebook Marketplace | Free | Massive user base, social trust signals, local discovery |
| Craigslist | Free | No-frills classifieds, broad categories, local focus |
| OfferUp | Free | In-app messaging, TruYou verification, shipping option |
| Mercari | 10% seller fee | Buyer/seller protection, prepaid shipping labels, authentication |

---

## 28. Mail (30%)

### Features Built
- [x] Self-hosted IMAP email client framework
- [x] Message management
- [x] Inbox analytics

### Features Needed (from competitors)
- [ ] Full IMAP implementation (seen in: all competitors) -- Priority: P0
- [ ] Search (seen in: all competitors) -- Priority: P0
- [ ] Threading (seen in: Gmail, Outlook, Spark) -- Priority: P0
- [ ] Filters (seen in: Gmail, Outlook) -- Priority: P1
- [ ] Push notifications (seen in: all competitors) -- Priority: P1
- [ ] Multiple accounts (seen in: Spark, Outlook) -- Priority: P1
- [ ] Attachments (seen in: all competitors) -- Priority: P1
- [ ] Calendar integration (seen in: Gmail, Outlook) -- Priority: P2
- [ ] Contact sync (seen in: Gmail, Outlook) -- Priority: P2
- [ ] Encryption (seen in: ProtonMail, Superhuman) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Gmail | Free | 1.8B users, AI smart compose, search, Google ecosystem |
| Outlook | Free / $6.99/mo | Calendar integration, focused inbox, Microsoft ecosystem |
| Superhuman | $30/mo | Speed-optimized, keyboard shortcuts, read receipts, AI triage |
| Spark | $59.99/yr | Smart inbox, team collaboration, snooze, send later |

---

## 29. Subs (20%)

### Features Built
- [x] ModuleDefinition framework
- [x] Zod types

### Features Needed (from competitors)
- [ ] Database schema (seen in: all competitors) -- Priority: P0
- [ ] All CRUD functions (seen in: all competitors) -- Priority: P0
- [ ] UI (seen in: all competitors) -- Priority: P0
- [ ] Subscription detection (seen in: Rocket Money) -- Priority: P1
- [ ] Renewal calendar (seen in: Bobby) -- Priority: P1
- [ ] Cost analysis (seen in: Rocket Money, Bobby) -- Priority: P1
- [ ] Cancellation assist (seen in: Rocket Money) -- Priority: P2
- [ ] Price comparison (seen in: Rocket Money) -- Priority: P2

### Competitor Pricing

| Competitor | Price | Key Differentiator |
|---|---|---|
| Rocket Money | $48-144/yr | Subscription cancellation concierge, bill negotiation, bank sync |
| Bobby | $1.99 one-time | Simple subscription tracker, renewal calendar, cost overview |

---

## Summary

### Feature Totals (code-verified 2026-03-23)

| Category | Count |
|---|---|
| Features built across all 29 modules | 470 |
| Features remaining across all 29 modules | 14 |
| Total feature universe (built + needed) | 484 |
| Overall completion rate | 97.1% |

> **NOTE:** A code-verified audit on 2026-03-23 found that 203 features listed as "needed" above had been built but never checked off. The per-module checkboxes above still show the original state for traceability. See `docs/reports/REPORT-competitive-parity-audit-2026-03-23.md` for the full reconciliation.

### Remaining Gaps (14 total, 7 real)

| Module | Gap | Type | Status |
|---|---|---|---|
| Health | HealthKit native bridge | Infrastructure | All engines built, needs Expo native module for production |
| ~~Workouts~~ | ~~Video exercise demos~~ | ~~Content~~ | DONE: Demo asset resolver + trainer video upload system |
| ~~Cycle~~ | ~~Community forums~~ | ~~Cross-module~~ | Handled by Forums module (not a Cycle gap) |
| Fast | Multi-beverage types | Feature | DONE: 12 beverage types with hydration coefficients |
| Surf | Multi-region expansion | Data/Ops | Code supports it, needs spot data |
| Market | Payment processing | Infrastructure | Needs Stripe integration |
| Subs | Bank sync auto-detection | Infrastructure | Needs Plaid integration |

### Mobile UI Gap (critical path to launch)

8 modules have full business logic but only a single placeholder screen on mobile:

| Module | Functions | Mobile Screens | Priority |
|---|---|---|---|
| Trails | 100+ | 1 | P0 -- AllTrails competitor |
| RSVP | 100+ | 1 | P0 -- Partiful competitor |
| Homes | 90+ | 1 | P1 |
| Mail | 85+ | 1 | P1 |
| Garden | 80+ | 1 | P1 |
| Stars | 50+ | 1 | P1 |
| Voice | 50+ | 1 | P1 |
| Words | 30+ | 1 | P2 |

### Module Completeness Ranking (code-verified)

| Tier | Modules | Range |
|---|---|---|
| Complete (99-100%) | Budget, Mood, Notes, Flash, Habits, Books, Journal, Meds, Voice, Recipes, RSVP, Words, Trails, Car, Homes, Pets, Stars, Closet, Garden, Forums, Mail, Fast, Cycle, Workouts (99%) | 99-100% |
| Near-complete (98%) | Nutrition (98% -- wearable sync refinement pending) | 98% |
| Near-complete (95-99%) | Health (99%), Surf | 97-99% |
| Infrastructure-blocked (90%) | Market, Subs | 90% |

### Key Strategic Observations (updated 2026-03-23)

1. **Business logic is done.** 97.1% competitive parity across 60+ named competitors. The remaining 7 real gaps are infrastructure (HealthKit, Stripe, Plaid), content (videos), or data (surf regions).

2. **Mobile UI is the critical path.** 8 modules have full engines but only placeholder screens. Building out mobile UI for these modules is the #1 priority to convert "code-complete" into "user-complete."

3. **Polish stage confirmed.** The project has shifted from feature building to: (a) mobile UI completion for placeholder modules, (b) infrastructure integrations, (c) design review and visual polish, (d) launch readiness (backup, onboarding, App Store submission).

### Feature Execution Pipeline

All 217 features follow a systematic pipeline documented in `docs/designs/feature-execution-pipeline.md`:

```
Score (5-factor formula) -> Spec (agent template) -> Build (CC agent) -> QA (human) -> Ship
```

**Scoring framework:** `docs/designs/feature-scoring-framework.md`
**Agent spec template:** `docs/plans/templates/agent-feature-spec-template.md`
**Launch tiers:** `docs/designs/launch-module-tiers.md`

Features are scored into S/A/B/C/D tiers. S-Tier features are built first (Sprint 1, pre-launch). Full competitive parity across all 29 modules is estimated at ~10-12 weeks of calendar time with parallel AI agents.

### Feature Tracking

The living feature tracker is this document (COMPETITIVE-MATRIX.md). As features are built:
1. Move the feature from "Features Needed" to "Features Built" in the module section
2. Update the module completeness percentage in the section header
3. Update the Summary section totals
4. Update launch tier classification in `docs/designs/launch-module-tiers.md` if the module crosses a tier threshold

**Goal: 0 features remaining.** Every checkbox in this document represents a concrete user capability that a competitor has and we don't -- yet. This document is not complete until every "Features Needed" section is empty.

3. **Highest ROI P0 items**: HealthKit native wiring (Health -- engine built, needs Expo native module), offline maps (Trails), maintenance reminders (Homes), calendar sync (RSVP), UI screens + cross-module listing (Market -- backend 90% complete), and cloud functions + UI (Subs). (Note: Workouts rest timer and previous performance are DONE -- engine has REST state + getPreviousPerformance query.)

4. **Privacy advantage**: MyLife's zero-analytics, zero-telemetry stance is a genuine differentiator against nearly every competitor listed. This should be a core marketing pillar, especially against data-hungry competitors like MyFitnessPal (220M users), Flo (440M users), and Facebook Marketplace.

5. **Pricing opportunity**: Most competitors charge $30-120/yr for a single app. MyLife bundles 29 modules under one subscription, creating a compelling value proposition if the suite reaches 80%+ parity across all modules.

6. **Total addressable competitor revenue**: The competitors listed in this matrix represent over $1B in combined annual revenue, validating the market demand for each module category.
