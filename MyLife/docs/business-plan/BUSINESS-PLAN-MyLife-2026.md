# MyLife Business Plan 2026 (March Snapshot)

**Prepared:** March 2026
**Status update:** 2026-04-23

> This document began as a March 2026 fundraising snapshot. It still contains useful product and market framing, but it is no longer the source of truth for live module counts, active roadmap sequencing, sync architecture, or current implementation status.
>
> Current source-of-truth docs:
> - `docs/plans/consolidation/README.md`
> - `docs/plans/consolidation/phase-review-report.md`
> - `docs/plans/queue/08-mesh-sync-mission-control.md`
> - `packages/module-registry/src/constants.ts`
> - `apps/mobile/app/_layout.tsx`
> - `apps/web/components/Providers.tsx`
>
> As of 2026-04-23, the registry defines 39 module IDs, mobile wires 38 full module definitions, web wires 29 full module definitions, expansion is paused in favor of the consolidation spine, and mesh sync is planned as a multi-workspace, LAN-first system layered onto `packages/sync/`.
>
> Unless a section below is explicitly refreshed, treat detailed market figures, module counts, packaging assumptions, and go-to-market claims as a March 2026 snapshot that should be revalidated before reuse.
>
> If you are about to use data or claims from this document in a current deliverable, stop and ask the user to verify that the specific figures or assumptions should still be used.

---

## I. Executive Summary

MyLife is a privacy-first personal life management hub built around a large module registry and a consolidation-first product strategy. The current plan is to finish the shared data layer, cross-module contracts, Today surface, goal-based onboarding, local-first AI, and manual-reversible automation before resuming breadth expansion.

**The problem:** The average consumer pays $800 or more annually for 10+ personal productivity apps, each collecting data, each storing information in its own silo, each requiring its own account. Privacy breaches are routine. Data portability is nonexistent.

**The solution:** One app shell, one local-first data model, and one place for cross-module workflows that separate personal tools rarely offer.

MyLife replaces dozens of standalone subscriptions with a unified hub where users enable only the modules they need. Core data stays local by default, module packaging is defined in the registry, and newer roadmap work is focused on making the hub feel like one product instead of a grid of loosely connected modules.

**Current state of the product:**

- 39 module IDs defined in the registry
- 38 full module definitions wired on mobile (all except `subs`)
- 29 full module definitions wired on web
- TypeScript-first monorepo across apps and shared packages
- Shared packages for module registry, database, onboarding, search, intelligence, and sync
- Consolidation Phase 0 and Phase 1 foundation shipped; the Today surface, onboarding, and cross-module readers remain the main near-term gaps
- Mesh sync strategy documented as a multi-workspace, LAN-first system built on `packages/sync/`

**The ask:** $750K seed investment to fund 18 months of runway, including founder compensation, one engineering hire, a viral go-to-market launch, and legal/compliance. This capital takes MyLife from a working product to a consumer brand.

**The market:** Over 2.17 billion people currently use apps in the 23 competitive spaces MyLife covers. Capturing just 1 in 500 users from each space yields 2.1 million unique users and $1.79M in net annual revenue. At $5/yr with near-zero marginal server costs, the path to profitability requires volume, not margin.

**Comparable outcomes:** Obsidian reached $25M ARR with no venture capital using a similar local-first, privacy-first model. Notion grew to $400M revenue. Truebill was acquired for $1.275B. The personal productivity space rewards products that earn user trust and loyalty.

---

## II. The Problem

### Subscription Fatigue Is Real

The average consumer maintains 6.7 paid app subscriptions. For someone who wants best-in-class tools across budgeting, fitness, meal tracking, journaling, meditation, reading, recipe management, and habit tracking, the annual cost easily reaches $400 to $2,400.

A representative stack of "best" apps:

| App | Annual Cost |
|-----|------------|
| YNAB (budgeting) | $109 |
| MyFitnessPal (nutrition) | $79.99 |
| Hevy (workouts) | $36 |
| Day One (journaling) | $34.99 |
| Zero (fasting) | $69.99 |
| Headspace (mental health) | $69.99 |
| Notion (notes) | $96 |
| Goodreads + StoryGraph (books) | $49.99 |
| AllTrails (outdoors) | $53.99 |
| Surfline (surf) | $119.99 |
| **Total** | **$819.93** |

And that is only 10 of the 29 categories MyLife covers.

### Data Is Scattered and Vulnerable

Personal data is spread across 10+ cloud services, each with its own privacy policy, each a potential breach target. Users have no way to correlate data across these silos. Your mood app does not know what medications you take. Your nutrition app does not know your fasting schedule. Your workout app does not know your sleep quality.

### Privacy Scandals Are Accelerating

The industry has demonstrated repeatedly that user trust is misplaced:

- **Flo Health (2021):** Shared intimate menstrual cycle data with Facebook and Google for advertising purposes, resulting in an FTC settlement. Post-Dobbs, cycle tracking privacy became a civil liberties issue.
- **MyFitnessPal (2018):** 150 million user accounts breached, including email addresses and hashed passwords. Under Armour sold the app to Francisco Partners shortly after.
- **Strava (2018):** Activity heatmaps inadvertently exposed the locations of military bases and secret CIA facilities worldwide.
- **BetterHelp (2023):** FTC ordered to pay $7.8 million for sharing mental health data with Facebook, Snapchat, Criteo, and Pinterest for advertising.
- **Goodreads:** Multiple email leaks and a persistent lack of investment in security by Amazon, despite holding reading habits data for 150 million users.

These are not hypothetical risks. They are documented failures by well-funded companies. Every cloud-synced personal app is a liability.

### The Core Tension

Users want powerful personal tools. They do not want to pay $800/yr for them. They do not want their data harvested. They do not want to manage 10+ accounts. No product on the market solves all three problems simultaneously.

MyLife does.

---

## III. The Solution

### One Hub, 29 Modules

MyLife is a single application containing 29 purpose-built modules spanning personal finance, health, fitness, productivity, creativity, and lifestyle. Users enable only the modules they want from a central dashboard. Disabled modules consume zero resources and their routes are removed from navigation.

### One Database, Your Device

All local modules store data in a single SQLite file on the user's device. Each module uses a unique table prefix (e.g., `bk_` for Books, `bg_` for Budget) to maintain clean separation within the shared database. There is no cloud account required for local modules. Data never leaves the device unless the user explicitly opts into cloud sync for the small number of modules that require it (forums, marketplace, surf forecasts).

### Cross-Module Intelligence

Because all data lives in one database, MyLife can surface correlations that siloed apps structurally cannot:

- **Mood + Meds:** Pearson correlation engine identifies how medication changes affect mood over time
- **Nutrition + Fasting:** Caloric intake automatically pauses during active fasting windows
- **Health + Cycle + Mood:** Menstrual phase tracking correlates with mood patterns and symptom severity
- **Budget + Subs:** Subscription catalog identifies recurring charges and total annual spend
- **Recipes + Garden + Nutrition:** Garden harvest feeds into recipe ingredients, which feed into nutritional tracking
- **Workouts + Nutrition + Fast:** Training load, caloric intake, and fasting windows visible in one view

This cross-module intelligence is not a future roadmap item. The data model and correlation engines are built today.

### Three Deployment Modes

1. **Cloud-hosted (default):** App Store download, local SQLite, optional cloud sync for select modules
2. **Self-hosted:** Users run their own Supabase instance for full data sovereignty over cloud modules
3. **Local-only:** Zero network connectivity required for 24 of 29 modules

### Design System: Cool Obsidian

MyLife uses a unified dark theme inspired by iOS glass morphism. The design system (Cool Obsidian) provides consistent tokens across all 29 modules: deep backgrounds (#0A0A0F), glass card surfaces with subtle blur effects, and accent colors unique to each module. The system is implemented via shared tokens in `packages/ui/` and renders natively on both Expo (BlurView) and web (backdrop-filter).

---

## IV. Product Deep Dive: Module by Module

Modules are ordered by total addressable market size, largest first.

---

### 1. Health (MyHealth)

| | |
|---|---|
| **Icon** | Heart |
| **Tier** | Premium |
| **Table Prefix** | `hl_` |
| **Category TAM** | $45B+ (mHealth) |
| **Completeness** | 75% |

**What it does today:**

MyHealth is the central health hub that absorbs and coordinates data from the Meds, Fast, and Cycle modules. It provides a secure document vault for storing medical records, vitals tracking across 10 measurement types, sleep logging with a weighted quality scoring algorithm (40% duration, 30% deep sleep, 20% REM, 10% awake time), an emergency ICE (In Case of Emergency) card with critical medical information, and cross-domain health goals that span multiple health dimensions.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Apple Health | Free | Built into iOS, deep hardware integration, no Android |
| Google Fit | Free | Built into Android, limited depth |
| Samsung Health | Free | Samsung devices only |
| Bearable | $34.99/yr | Symptom and trigger tracking |
| CareClinic | $9.99/mo ($119.88/yr) | Clinical-grade tracking with care team features |

**Current feature gaps vs. competitors:**

HealthKit/Google Fit integration for automatic data import, guided breathing exercises (beyond what exists in the Mood module), sleep stage analysis from wearable hardware, HRV (heart rate variability) tracking, readiness scoring, guided meditation content, smart alarm functionality, snore detection, and clinical records interop (FHIR/HL7).

**MyLife's advantage:**

Privacy is existential in health data. Every competitor either collects data for advertising (Google Fit), locks users into a hardware ecosystem (Apple Health, Samsung Health), or stores sensitive medical information on third-party servers. MyHealth keeps all data local. The cross-module architecture means health correlations (mood + meds + nutrition + sleep + cycle) happen on-device with zero cloud exposure. At $5/yr for the entire suite, the price point is a fraction of CareClinic alone.

---

### 2. Budget (MyBudget)

| | |
|---|---|
| **Icon** | Dollar |
| **Tier** | Premium |
| **Table Prefix** | `bg_` |
| **Category TAM** | $25.8B (personal finance apps) |
| **Completeness** | 95% |

**What it does today:**

MyBudget is a full YNAB-style envelope budgeting system backed by 29 SQLite tables. It includes a 215-entry subscription catalog for identifying recurring charges, Plaid bank sync for automatic transaction import, recurring transaction detection, payday detection, savings goals with progress tracking, debt payoff planning with both snowball and avalanche strategies, net worth calculation, multi-currency support, CSV export, transaction rules for auto-categorization, and configurable alerts.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| YNAB | $109/yr | Gold standard for envelope budgeting |
| Monarch Money | $99.99/yr | Modern UI, picked up Mint refugees |
| Rocket Money | $48-144/yr | Bill negotiation, subscription tracking |
| PocketGuard | $74.99/yr | Simplified budgeting |
| Copilot | $119.88/yr | AI-powered, Apple-only |

**Current feature gaps vs. competitors:**

Reports and charts dashboard for visual spending analysis, investment portfolio tracking, expense splitting for shared costs, receipt OCR for paper receipt capture, ML-powered auto-categorization, loan amortization planner, and bill negotiation services.

**MyLife's advantage:**

At 95% completeness, MyBudget is functionally competitive with YNAB at 1/22nd the price. Financial data is the single most sensitive category of personal information. Every competitor stores transaction data on their servers. MyBudget keeps it local. The Plaid integration runs through the user's own connection, and all processing happens on-device. Cross-module integration with Subs (subscription tracking) and Recipes (grocery spending) adds intelligence no standalone budgeting app can offer.

---

### 3. Notes (MyNotes)

| | |
|---|---|
| **Icon** | Pencil |
| **Tier** | Free |
| **Table Prefix** | `nt_` |
| **Category TAM** | $1.2-17B (note-taking and knowledge management) |
| **Completeness** | 90% |

**What it does today:**

MyNotes is a markdown-native note-taking system with wiki-style `[[backlinks]]` for building a personal knowledge graph, FTS5 full-text search for instant retrieval across all notes, folder hierarchy for organization, tag support, knowledge graph data model, pin and favorite functionality, and a template system.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Notion | $96/yr | Workspace-oriented, heavy feature set |
| Obsidian (with sync) | $48/yr | Markdown-native, plugin ecosystem |
| Evernote | $179.88/yr | Legacy player, declining |
| Apple Notes | Free | Basic, Apple ecosystem only |
| Google Keep | Free | Minimal, data harvested |

**Current feature gaps vs. competitors:**

Templates UI for browsing and applying templates, checklists and to-do integration, daily notes workflow, code block rendering, image attachments within notes, table support, AI-powered writing assistance, visual graph view for exploring the knowledge graph, web clipper for saving content from browsers, and OCR for searching within images.

**MyLife's advantage:**

MyNotes is free forever. That alone undercuts every paid competitor. The backlinks and knowledge graph architecture match Obsidian's core value proposition. Local-only storage means notes never transit through any server. The combination of free pricing, privacy, and Obsidian-class features creates a compelling entry point that draws users into the MyLife ecosystem.

---

### 4. Nutrition (MyNutrition)

| | |
|---|---|
| **Icon** | Apple |
| **Tier** | Premium |
| **Table Prefix** | `nu_` |
| **Category TAM** | $4.14B (nutrition tracking) |
| **Completeness** | 90% |

**What it does today:**

MyNutrition provides a comprehensive food tracking system backed by a database of 1,000+ foods sourced from USDA, Open Food Facts, and FatSecret APIs. It includes barcode scanning for packaged foods, AI-powered photo logging for identifying meals from pictures, meal composition tracking, macro and micronutrient tracking across 200+ nutrients, customizable daily goals, FTS full-text search across the food database, trend analysis over time, fasting module integration, and CSV data export.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| MyFitnessPal | $79.99/yr | 220M registered | Largest food database, aggressive paywall |
| Cronometer | $49.99/yr | Research-grade accuracy | Micronutrient focus |
| Lose It! | $39.99/yr | Simplified calorie counting | |
| MacroFactor | $71.88/yr | Algorithm-driven coaching | |

**Current feature gaps vs. competitors:**

AI photo logging currently requires a user-provided API key, restaurant menu integration for logging meals from chain restaurants, wearable device sync for automatic calorie burn adjustment, and integrated water tracking (currently handled separately).

**MyLife's advantage:**

MyFitnessPal was breached in 2018 (150M accounts) and has since implemented an aggressive paywall that locks basic features behind premium. Cronometer and MacroFactor charge $50-72/yr for nutrition tracking alone. MyNutrition provides 200+ nutrient tracking for $5/yr as part of the full suite. The fasting integration means MyNutrition automatically understands eating windows, something no standalone nutrition app can do. All food logging data stays local.

---

### 5. Workouts (MyWorkouts)

| | |
|---|---|
| **Icon** | Dumbbell |
| **Tier** | Premium |
| **Table Prefix** | `wk_` |
| **Category TAM** | $13.5B (fitness apps) |
| **Completeness** | 92% |

**What it does today:**

MyWorkouts is a full-featured strength training tracker with a library of 50+ exercises, a body map covering 14 muscle groups for visual tracking, a workout builder for creating custom routines, a session state machine supporting 13 distinct actions for precise workout flow control, 1RM (one-rep max) calculations using both Epley and Brzycki formulas, warmup weight calculator, plate loader calculator for efficient barbell setup, voice commands supporting 20 phrases for hands-free logging, multi-week training plans, body measurements tracking, and progress analytics.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Hevy | $36/yr | 9M athletes | Modern UI, strong social features |
| Strong | $29.99/yr | 3M users | Clean, focused strength tracker |
| JEFIT | $155.88/yr | 12M users | Extensive exercise database |
| Fitbod | $95.99/yr | 10M users | AI-generated workouts |
| Strava | $79.99/yr | 180M users | Primarily cardio/GPS |

**Current feature gaps vs. competitors:**

Dedicated rest timer between sets, previous performance display during active sets for quick reference, video exercise demonstrations, AI-powered workout generation, progressive overload automation, Apple Watch companion app, and GPS route recording for running/cycling workouts.

**MyLife's advantage:**

The voice command system (20 phrases for hands-free logging) is a genuine differentiator that most competitors lack or charge premium for. At 92% completeness, MyWorkouts matches the core feature set of Strong and Hevy while costing a fraction of even the cheapest competitor. The integration with Nutrition and Fast modules means users can see their training, eating, and recovery in one view. Strava exposed military base locations through its heatmaps. MyWorkouts keeps all location and workout data local.

---

### 6. Mood (MyMood)

| | |
|---|---|
| **Icon** | Smile |
| **Tier** | Free |
| **Table Prefix** | `mo_` |
| **Category TAM** | $10-17B (mental health apps) |
| **Completeness** | 90% |

**What it does today:**

MyMood provides granular mood tracking with a 1-10 scoring system, Plutchik emotion tagging across 24 distinct emotions at 3 intensity levels (72 possible emotional states), activity tracking with 15 default activities plus custom additions, a Pearson correlation engine that identifies statistical relationships between activities and mood, guided breathing exercises in 3 patterns, streak tracking for consistent logging, a Year-in-Pixels visualization for annual mood overview, and a real-time dashboard.

**Competitor landscape:**

| Competitor | Price | Users/Revenue | Notes |
|-----------|-------|--------------|-------|
| Daylio | $35.99/yr | 20M users | Simplified mood + activity tracking |
| Calm | $69.99/yr | $100M+ ARR | Meditation-focused, celebrity content |
| Headspace | $69.99/yr | $100M+ ARR | Meditation-focused, clinical studies |
| Bearable | $34.99/yr | Symptom-focused tracking | |
| Reflectly | $59.99/yr | AI journaling | |

**Current feature gaps vs. competitors:**

Virtual pet gamification system, self-care suggestion engine, guided meditation content library, focus music and ambient soundscapes, SOS/panic button for crisis moments, AI-generated insights from mood patterns, and automated weekly mood reports.

**MyLife's advantage:**

MyMood is free forever. Calm and Headspace each charge $70/yr and generate over $100M in annual revenue. Daylio charges $36/yr for basic mood tracking. MyMood provides a more granular emotion model (Plutchik's 24 emotions vs. Daylio's simplified scale) at zero cost. The Pearson correlation engine is a genuine analytical tool, not a marketing bullet point. The cross-module correlation with Meds (medication effects on mood), Cycle (hormonal mood patterns), and Health (sleep quality impact) creates clinical-grade self-insight that no standalone mental health app can provide. Mental health data is among the most sensitive personal information. BetterHelp was fined $7.8M for sharing it with advertisers. MyMood stores everything locally.

---

### 7. Journal (MyJournal)

| | |
|---|---|
| **Icon** | Book |
| **Tier** | Free |
| **Table Prefix** | `jn_` |
| **Category TAM** | Included in mental health ($10-17B) |
| **Completeness** | 95% |

**What it does today:**

MyJournal provides daily markdown journaling with mood tagging across 5 levels, custom tags for categorization, image attachments, streak tracking with a 1-day grace period to avoid punishing occasional misses, word counting, an on-this-day feature for revisiting past entries, daily writing prompts across 4 categories, support for multiple notebooks, and a statistics dashboard.

**Competitor landscape:**

| Competitor | Price | Revenue/Users | Notes |
|-----------|-------|--------------|-------|
| Day One | $34.99/yr | ~$6M ARR | Premium journaling, end-to-end encrypted |
| Daylio | $35.99/yr | 20M users | Micro-journaling with mood |
| Diarium | $5-10 one-time | Cross-platform | |
| Apple Journal | Free | iOS only, basic | |
| Reflection | Free tier | Minimalist | |

**Current feature gaps vs. competitors:**

Voice-to-text entry for spoken journals, automatic metadata capture (location, weather), AI-powered writing prompts, grid and mandala visualization layouts, vision board feature, and therapy-specific journal templates.

**MyLife's advantage:**

MyJournal is free forever and at 95% completeness rivals Day One's core feature set. Day One charges $35/yr and stores journals on their servers (encrypted, but still cloud-dependent). MyJournal keeps everything local. The integration with Mood provides automatic emotional context for every entry. The multiple notebooks feature supports separating personal, work, and gratitude journals without switching apps.

---

### 8. Cycle (MyCycle)

| | |
|---|---|
| **Icon** | Circle |
| **Tier** | Premium |
| **Table Prefix** | `cy_` |
| **Category TAM** | $2.49B (menstrual health) |
| **Completeness** | 90% |

**What it does today:**

MyCycle provides comprehensive cycle logging, daily symptom tracking across 13+ symptoms at 3 intensity levels, flow level logging, menstrual phase tracking, cycle analytics including average length and standard deviation, prediction using a weighted moving average of the last 6 cycles, fertile window estimation, late period detection, and intelligent gap filtering for handling missed log entries.

**Competitor landscape:**

| Competitor | Price | Users/Revenue | Notes |
|-----------|-------|--------------|-------|
| Flo | $49.99/yr | 440M registered, $275M revenue | Market leader, FTC privacy settlement |
| Clue | $39.99/yr | 10M+ users | Science-focused, European |
| Natural Cycles | $89.99/yr | FDA-cleared contraceptive | |
| Ovia | Free | Employer-sponsored, data concerns | |

**Current feature gaps vs. competitors:**

Basal body temperature tracking for fertility awareness methods, partner sync for shared cycle visibility, pregnancy mode with trimester tracking, and community forums for peer support.

**MyLife's advantage:**

This is the single most privacy-critical module in the entire suite. After the Dobbs decision in 2022, cycle tracking data became a potential legal liability. Flo Health was already caught sharing cycle data with Facebook and Google, resulting in an FTC settlement. Ovia is employer-sponsored, meaning employers have access to employees' reproductive health data. MyCycle stores all data exclusively on the user's device. It never touches a server. There is no account. There is no cloud sync. At $5/yr for the entire MyLife suite (vs. $50/yr for Flo alone), the economics are compelling. But for cycle tracking specifically, privacy is not a feature. It is a necessity.

---

### 9. Flash (MyFlash)

| | |
|---|---|
| **Icon** | Lightning |
| **Tier** | Premium |
| **Table Prefix** | `fl_` |
| **Category TAM** | $1.2-2.3B (flashcard and study apps) |
| **Completeness** | 88% |

**What it does today:**

MyFlash implements an FSRS-inspired spaced repetition algorithm for optimized long-term retention. It supports deck hierarchy for organizing cards by subject and topic, 3 card types (basic, reversed, and cloze deletion), a 4-grade review system, queue states for managing card lifecycle (new, learning, review, suspended, buried), leech detection for identifying cards that consistently fail review, configurable daily limits, streak tracking for study consistency, and deck export.

**Competitor landscape:**

| Competitor | Price | Users/Revenue | Notes |
|-----------|-------|--------------|-------|
| Quizlet | $35.99/yr | 300M registered, $96M revenue | Broad study tools, AI features |
| Anki | Free (desktop), $29.99 (iOS) | 86% of US med students | Open-source, powerful but dated UI |
| Brainscape | $79.99/yr | Adaptive learning | |
| StudyFetch | $228/yr | AI-powered study tools | |

**Current feature gaps vs. competitors:**

Rich media cards with audio and image support, image occlusion for studying diagrams, AI-powered card generation from notes or textbooks, match game study mode, and competitive study leagues.

**MyLife's advantage:**

Anki is the gold standard for spaced repetition but has a notoriously poor user experience and charges $29.99 for its iOS app alone. Quizlet generates $96M in revenue but has increasingly pushed users toward AI-powered features behind a paywall. MyFlash provides FSRS-grade spaced repetition with a modern UI at $5/yr for the full suite. The integration with Notes means users can potentially generate flashcards from their knowledge base, and the Words module provides dictionary lookups during study sessions.

---

### 10. Habits (MyHabits)

| | |
|---|---|
| **Icon** | Check |
| **Tier** | Premium |
| **Table Prefix** | `hb_` |
| **Category TAM** | $1.7-1.9B (habit tracking) |
| **Completeness** | 90% |

**What it does today:**

MyHabits supports 4 distinct habit types: standard (yes/no completion), timed (duration-based tracking), negative (tracking avoidance), and measurable (quantity-based tracking). It includes flexible frequency scheduling, configurable grace periods for maintaining streaks, timed session tracking, measurement logging, a GitHub-style heatmap visualization for viewing patterns over time, menstrual cycle integration for cycle-aware habit tracking and prediction, and CSV data export.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Streaks | $4.99 one-time | Apple Design Award, iOS only, limited to 24 habits |
| Habitica | $59.88/yr | RPG gamification |
| Habitify | $59.88/yr | Cross-platform, clean UI |
| Fabulous | $59.99/yr | Behavior science coaching |
| Loop Habit Tracker | Free | Open-source, Android only |

**Current feature gaps vs. competitors:**

RPG gamification elements (Habitica's core differentiator), built-in focus timer, HealthKit auto-tracking for activity-based habits, structured challenges and programs, achievement badge system, and location-based habit reminders.

**MyLife's advantage:**

The 4 habit types provide more structural flexibility than any competitor. The menstrual cycle integration (correlating habits with cycle phases) is unique in the market. At $5/yr for the suite, MyHabits undercuts every paid competitor by 6-12x. The cross-module integration with Mood (habit impact on emotional state), Workouts (exercise habits), and Fast (fasting streaks) creates a unified behavior tracking system.

---

### 11. Voice (MyVoice)

| | |
|---|---|
| **Icon** | Microphone |
| **Tier** | Free |
| **Table Prefix** | `vc_` |
| **Category TAM** | $1.6B (voice recording and transcription) |
| **Completeness** | 92% |

**What it does today:**

MyVoice provides on-device dictation and transcription with automatic language detection, confidence scoring for transcription accuracy, tagging for organization, favorites for quick access, keyword extraction from transcribed text, summarization of voice notes, and transcription statistics.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Otter.ai | $100/yr | 10M users | Meeting transcription, AI summaries |
| Notta | $100-180/yr | Multi-language | |
| Apple Voice Memos | Free | iOS only, no transcription | |
| Google Recorder | Free | Pixel only, on-device | |
| AudioNotes | Free tier | Basic recording | |

**Current feature gaps vs. competitors:**

Custom voice commands for hands-free control, speaker identification (diarization) for multi-person recordings, and simultaneous multi-language transcription.

**MyLife's advantage:**

MyVoice is free forever. Otter.ai and Notta charge $100-180/yr for transcription. MyVoice performs transcription on-device, meaning voice data never leaves the phone. For users who dictate personal thoughts, medical notes, or private conversations, this is a critical privacy guarantee. The integration with Journal (voice-to-journal entries) and Notes (voice-to-knowledge-base) extends the utility beyond standalone voice apps.

---

### 12. Pets (MyPets)

| | |
|---|---|
| **Icon** | Paw |
| **Tier** | Premium |
| **Table Prefix** | `pt_` |
| **Category TAM** | $1.5B (pet care apps) |
| **Completeness** | 70% |

**What it does today:**

MyPets supports pet profiles for 9 species, vaccination tracking with reminders, vet visit logging, medication scheduling, weight tracking over time, and expense analysis for understanding the true cost of pet ownership.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| 11pets | Free/premium | Comprehensive pet management |
| Pawp | $24/mo ($288/yr) | Telehealth for pets |
| PetDesk | Free | Vet appointment booking |
| FitBark | $69.95 (device) | Activity tracking, requires hardware |

**Current feature gaps vs. competitors:**

Feeding schedule and reminders, grooming log, exercise and walk logging, training progress tracking, pet sitter information card, breed-specific health alerts, and photo journal.

**MyLife's advantage:**

Pawp charges $288/yr for pet telehealth. FitBark requires a dedicated hardware device. MyPets provides core pet management at $5/yr as part of the suite. The integration with Budget (pet expenses tracked automatically), Meds (pet medication scheduling alongside human medications), and Health (pet vaccination records alongside human health records) creates a unified household health management system.

---

### 13. Homes (MyHomes)

| | |
|---|---|
| **Icon** | House |
| **Tier** | Premium |
| **Table Prefix** | `hm_` |
| **Category TAM** | $1.5B (home management and services) |
| **Completeness** | 60% |

**What it does today:**

MyHomes provides real estate portfolio management including property tracking and mortgage/rental analytics. It uses Drizzle ORM with tRPC for a type-safe cloud data layer, supporting multi-property management for homeowners, landlords, and real estate investors.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| HomeZada | $59-99/yr | Home inventory and maintenance |
| Centriq | $32/yr | Appliance manuals and maintenance |
| Thumbtack | Free | Contractor marketplace |
| Angi | Free | Home services marketplace |

**Current feature gaps vs. competitors:**

Maintenance schedule reminders, appliance manual storage, home inventory with replacement costs, document storage for deeds and warranties, and contractor contact management.

**MyLife's advantage:**

HomeZada charges up to $99/yr for home management. MyHomes includes portfolio-level real estate analytics that HomeZada lacks, oriented toward users who own multiple properties. At $5/yr for the full suite, the price point eliminates any hesitation. The Budget integration means mortgage payments, maintenance costs, and rental income flow directly into the financial picture.

---

### 14. Meds (MyMeds)

| | |
|---|---|
| **Icon** | Pill |
| **Tier** | Premium |
| **Table Prefix** | `md_` |
| **Category TAM** | $0.52B (medication management) |
| **Completeness** | 92% |

**What it does today:**

MyMeds is backed by 13+ database tables and provides full medication CRUD, dose logging with 4 states (taken, skipped, late, snoozed), smart reminders, adherence analytics, refill tracking with burn rate calculations to predict when refills are needed, a drug interaction database covering 200+ known interaction pairs, mood check-ins using the Plutchik emotion model, symptom logging, health measurements, a Pearson correlation engine for identifying medication effects, and markdown report generation formatted for doctor and therapy appointments.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Medisafe | $39.99/yr | 7M users | Market leader, recently paywalled |
| MyTherapy | Free | Basic medication reminders | |
| Pillo | Free | Simple pill tracking | |
| CareClinic | $119.88/yr | Clinical-grade tracking | |

**Current feature gaps vs. competitors:**

Blood pressure logging, blood glucose logging, insulin tracking, caregiver alerts for managing medications for dependents, CGM (continuous glucose monitor) integration, and a pain location body map.

**MyLife's advantage:**

Medisafe recently moved core features behind a $40/yr paywall, alienating users who relied on free medication reminders. CareClinic charges $120/yr. MyMeds provides a more comprehensive feature set than either (drug interactions, Pearson correlations, doctor-ready reports) at $5/yr for the entire suite. The drug interaction checking with 200+ pairs is a genuine safety feature. The mood correlation engine (tracking how medications affect emotional state over time) is clinically useful and unique among consumer medication apps. Medication data is deeply sensitive. MyMeds keeps it local.

---

### 15. Garden (MyGarden)

| | |
|---|---|
| **Icon** | Seedling |
| **Tier** | Premium |
| **Table Prefix** | `gd_` |
| **Category TAM** | $1.1B (gardening apps) |
| **Completeness** | 40% |

**What it does today:**

MyGarden provides plant tracking, watering schedules, harvest planning, and garden layout management for organizing planting beds and zones.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Planter | $49.99 lifetime | Garden planning with companion planting |
| Seed to Spoon | $46.99/yr | Region-specific growing guides |
| GrowVeg | $35 one-time | Garden planning software |
| PlantIn | $29.99/yr | AI plant identification |

**Current feature gaps vs. competitors:**

AI plant identification from photos, disease and pest diagnosis, companion planting guide, frost date alerts based on location, and propagation tracking.

**MyLife's advantage:**

The integration with Recipes (garden-to-table pipeline where harvested produce feeds directly into recipe ingredients) is a unique cross-module capability. At $5/yr for the suite, MyGarden is a fraction of the cost of Planter or Seed to Spoon.

---

### 16. Fast (MyFast)

| | |
|---|---|
| **Icon** | Timer |
| **Tier** | Free |
| **Table Prefix** | `ft_` |
| **Category TAM** | $0.43-1.2B (intermittent fasting) |
| **Completeness** | 95% |

**What it does today:**

MyFast is backed by 10 database tables and provides a fasting timer with 6 presets (covering popular protocols like 16:8, 18:6, 20:4, OMAD, and custom windows), 5 fasting zone indicators showing metabolic state progression, streak tracking for consistency, weight tracking, water logging during fasts, configurable goals, CSV data export, and home screen widgets for quick timer access.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Zero | $69.99/yr | 2.5M downloads | Market leader, content library |
| Fastic | $59.99-79.99/yr | 10M users | Social features, meal plans |
| Simple | $59.99/yr | AI coaching | |
| BodyFast | $39.99/yr | Intermittent fasting plans | |
| Life Fasting Tracker | Free | Basic timer | |

**Current feature gaps vs. competitors:**

Smart water intake reminders during fasting windows, Apple Watch quick-log for starting/stopping fasts from the wrist, HealthKit sync, and caffeine tracking during fasts.

**MyLife's advantage:**

MyFast is free forever. Zero charges $70/yr. Fastic charges up to $80/yr. MyFast at 95% completeness provides a more feature-complete fasting tracker than Life Fasting (the only other free option) while remaining permanently free. The integration with Nutrition (automatic eating window coordination), Health (fasting impact on vitals), and Mood (fasting impact on emotional state) creates a holistic fasting experience that no standalone app can match.

---

### 17. Books (MyBooks)

| | |
|---|---|
| **Icon** | Books |
| **Tier** | Premium |
| **Table Prefix** | `bk_` |
| **Category TAM** | 150M+ Goodreads users (market size defined by incumbent scale) |
| **Completeness** | 95% |

**What it does today:**

MyBooks is backed by 23+ database tables and provides multi-shelf organization, reading session tracking with time and page logging, half-star ratings for nuanced reviews, annual reading goals, year-in-review statistics, a built-in ePub and PDF reader, reading challenges, an encrypted journal for private book-related notes, Goodreads and StoryGraph import for migrating existing libraries, barcode scanning for adding physical books, and FTS5 full-text search across the entire library.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Goodreads | Free | 150M users | Amazon-owned, stagnant development |
| StoryGraph | $49.99/yr | 5M+ users | Modern alternative, strong recommendations |
| Bookly | $30/yr | Reading stats focus | |
| Literal | Free | Social reading platform | |

**Current feature gaps vs. competitors:**

Book recommendation engine, social feed for sharing reading activity, achievement and badge system, and book club features for group reading.

**MyLife's advantage:**

Goodreads has 150M users and has been widely criticized for stagnant development, poor UI, and multiple email leaks under Amazon's ownership. StoryGraph charges $50/yr. MyBooks provides a more feature-rich reading tracker than either (built-in ePub reader, encrypted journal, reading challenges) at $5/yr for the full suite. The import tools for Goodreads and StoryGraph make migration frictionless. The cross-module integration with Notes (book notes in the knowledge base) and Journal (reading reflections) enriches the reading experience beyond what any standalone app offers.

---

### 18. Recipes (MyRecipes)

| | |
|---|---|
| **Icon** | Chef |
| **Tier** | Premium |
| **Table Prefix** | `rc_` |
| **Category TAM** | Niche (recipe management) |
| **Completeness** | 92% |

**What it does today:**

MyRecipes is backed by 17+ database tables and provides full recipe CRUD, an ingredient parser with unit conversion (metric/imperial), recipe scaling for adjusting serving sizes, a cooking mode with step-by-step navigation and built-in timers, a meal planner for weekly/monthly planning, shopping lists generated from meal plans, a pantry tracker for managing available ingredients, garden-to-recipe linking (connecting garden harvests to recipe ingredients), event hosting integration for planning meals for gatherings, and allergy and dietary restriction detection.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Paprika | $4.99 one-time | Recipe manager, web import |
| AnyList | $11.99/yr | Grocery lists with recipe integration |
| Recipe One | Subscription | AI recipe features |
| Forkee | Free | Basic recipe saving |

**Current feature gaps vs. competitors:**

Video recipe import from YouTube and TikTok, paper recipe OCR for digitizing family recipes, and automatic nutritional information calculation per recipe.

**MyLife's advantage:**

At 92% completeness, MyRecipes is the most feature-rich module relative to its category. The garden-to-recipe pipeline (Garden module harvests flow into recipe ingredients) and the meal-to-nutrition pipeline (meal plans flow into the Nutrition module for automatic tracking) represent cross-module integrations that no standalone recipe app can replicate. The pantry tracker and shopping list generation create a complete kitchen management system.

---

### 19. Car (MyCar)

| | |
|---|---|
| **Icon** | Car |
| **Tier** | Premium |
| **Table Prefix** | `cr_` |
| **Category TAM** | $610M (vehicle management) |
| **Completeness** | 100% |

**What it does today:**

MyCar is a complete vehicle ownership companion: multi-vehicle tracking, service history, fuel economy analysis, maintenance cost analytics, scheduled maintenance reminders (by mileage or time), trip logging with IRS deduction estimates, GPS mileage tracking, insurance policy and document storage, registration and inspection tracking, tire wear monitoring with rotation scheduling, parking location saver with meter timer, VIN decoder with NHTSA recall alerts, OBD-II diagnostic code reading, cost-per-mile analysis, and fuel price trend tracking. All data local SQLite, no cloud required for core features.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| CARFAX Car Care | Free | Service history, limited tracking |
| Simply Auto | Free/premium | Comprehensive vehicle management |
| FIXD | $9.99/mo + device | OBD-II diagnostics |
| Drivvo | Free/premium | Fuel and expense tracking |

**Current feature gaps vs. competitors:**

None. MyCar has achieved full competitive feature parity across all analyzed competitors. Hardware-dependent features (OBD-II diagnostics, GPS tracking) and network-dependent features (VIN decoder, fuel prices) are built but classified as Phase 2 until real-device testing is complete.

**MyLife's advantage:**

FIXD charges $120/yr plus a hardware device. Simply Auto and Drivvo offer free tiers but with limited features. MyCar provides multi-vehicle management at $5/yr for the full suite. The Budget integration means all vehicle expenses (fuel, maintenance, insurance) automatically flow into the financial picture, providing true cost-of-ownership analysis that no standalone car app offers. Privacy advantage: all vehicle data, trip logs, location history, and documents stay on-device. No server ever sees your driving patterns.

---

### 20. RSVP (MyRSVP)

| | |
|---|---|
| **Icon** | Envelope |
| **Tier** | Premium |
| **Table Prefix** | `rv_` |
| **Category TAM** | Niche (event management) |
| **Completeness** | 85% |

**What it does today:**

MyRSVP is backed by 13 database tables and provides event creation, invite management with status tracking, RSVP collection and monitoring, polls for group decisions, announcements to event attendees, photo albums for event memories, check-in functionality for day-of attendance, waitlist management for capacity-limited events, and co-host support for shared event planning.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Partiful | Free | 500K MAU, 400% YoY growth | Hot startup, casual events |
| Evite | Free/premium | Legacy player, ad-supported | |
| RSVPify | $19/mo ($228/yr) | Professional events | |
| Invyt | Free | Basic invite management | |

**Current feature gaps vs. competitors:**

Calendar sync via iCal export/import, event templates for recurring event types, custom invitation design, expense splitting among attendees, and dietary preference collection for meal planning.

**MyLife's advantage:**

Partiful is growing 400% year-over-year and is free, making it the primary competitive concern. However, Partiful is cloud-only and collects user data. RSVPify charges $228/yr for professional features. MyRSVP provides professional-grade event management (waitlists, polls, co-hosting) at $5/yr. The Recipes integration (meal planning for events) and Budget integration (event expense tracking) add utility that standalone event apps lack.

---

### 21. Trails (MyTrails)

| | |
|---|---|
| **Icon** | Mountain |
| **Tier** | Premium |
| **Table Prefix** | `tr_` |
| **Category TAM** | AllTrails benchmarks at $71M ARR |
| **Completeness** | 50% |

**What it does today:**

MyTrails provides trail tracking, GPS route recording during hikes, elevation and distance analytics, and trail rating functionality.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| AllTrails | $26.99-53.99/yr | 20M+ users | Market leader, massive trail database |
| Gaia GPS | $39.99/yr | Backcountry focus, offline maps |
| Komoot | $29.99 one-time | 35M+ users, European-strong |

**Current feature gaps vs. competitors:**

Offline map downloads for areas without cell service, weather overlay on trail maps, wrong-turn alerts for safety, integration with a trail database (AllTrails has millions of user-contributed trails), and turn-by-turn navigation.

**MyLife's advantage:**

AllTrails monetizes at $71M ARR and Strava at even higher scale. MyTrails provides the core GPS recording and analytics at $5/yr. The privacy advantage is significant: Strava's heatmap debacle demonstrated the risk of cloud-stored location data. MyTrails keeps all GPS data local. The Workouts integration (outdoor activities tracked alongside gym sessions) and Health integration (hiking's impact on vitals) add context that standalone trail apps cannot provide.

---

### 22. Surf (MySurf)

| | |
|---|---|
| **Icon** | Wave |
| **Tier** | Premium |
| **Table Prefix** | `sf_` |
| **Category TAM** | $200-350M (niche surf forecasting) |
| **Completeness** | 88% |

**What it does today:**

MySurf covers 200+ California surf spots with hourly forecast caching, NOAA buoy data integration, tide data, AI-generated surf narratives for plain-English conditions summaries, configurable swell and wind alerts, community reviews and photos, GPS-based wave detection, coastal trail tracking, and a spot rating engine for finding the best conditions.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Surfline | $119.99/yr | Market leader, live cams, proprietary forecasts |
| Magic Seaweed | Free/premium | Acquired by Surfline |
| Windy | $19.99/yr | Wind and weather focused |

**Current feature gaps vs. competitors:**

Multi-region expansion beyond California, live camera feeds, and surf-specific social features.

**MyLife's advantage:**

Surfline charges $120/yr for surf forecasting alone. MySurf provides NOAA-grade forecast data with AI narratives for $5/yr as part of the full suite. The 200+ spot database for California is a strong launch market. Community reviews and GPS wave detection are features Surfline locks behind premium. The Trails integration (coastal hiking alongside surf sessions) and Workouts integration (surf sessions as exercise) add cross-sport value.

---

### 23. Closet (MyCloset)

| | |
|---|---|
| **Icon** | Shirt |
| **Tier** | Premium |
| **Table Prefix** | `cl_` |
| **Category TAM** | $132-242M (digital wardrobe) |
| **Completeness** | 40% |

**What it does today:**

MyCloset provides clothing inventory management, outfit creation from existing wardrobe items, and wear tracking to identify which items get used.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Indyx | Free | 4M users | AI-powered styling, growing fast |
| Clueless | $69/yr | AI outfit suggestions | |
| Stylebook | $5.99 one-time | iOS only, established | |
| Alta | Free/premium | Wardrobe management | |

**Current feature gaps vs. competitors:**

AI outfit suggestions based on weather and calendar, laundry tracking, seasonal wardrobe rotation, weather-aware daily recommendations, packing lists for travel, and cost-per-wear analysis.

**MyLife's advantage:**

At 40% completeness, MyCloset is early-stage but included in the suite at no additional cost. The Budget integration (clothing spending tracked automatically) and the wear tracking data (identifying underused items) provide financial intelligence that standalone wardrobe apps lack.

---

### 24. Words (MyWords)

| | |
|---|---|
| **Icon** | Dictionary |
| **Tier** | Premium |
| **Table Prefix** | `wd_` |
| **Category TAM** | Niche (dictionary/reference) |
| **Completeness** | 85% |

**What it does today:**

MyWords provides a multi-provider dictionary system supporting 270+ languages via Free Dictionary, Datamuse, and Wiktionary APIs. It delivers definitions, pronunciations, etymology, synonyms, antonyms, rhymes, and contextual suggestions. An LRU cache ensures fast repeat lookups.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Dictionary.com | Free | Ad-supported |
| Merriam-Webster | Free | Ad-supported |
| WordReference | Free | Translation-focused |

**Current feature gaps vs. competitors:**

Persistent saved words and vocabulary lists, offline dictionary fallback, and advanced search with filters.

**MyLife's advantage:**

Free dictionary apps are ad-supported and track usage data. MyWords provides an ad-free, privacy-respecting reference tool. The integration with Flash (vocabulary words automatically become flashcards for spaced repetition study) and Notes (word definitions linked to knowledge base entries) creates a learning pipeline that no standalone dictionary offers.

---

### 25. Stars (MyStars)

| | |
|---|---|
| **Icon** | Star |
| **Tier** | Premium |
| **Table Prefix** | `st_` |
| **Category TAM** | $1.1B (AR stargazing and astrology) |
| **Completeness** | 60% |

**What it does today:**

MyStars performs birth chart calculations, moon phase tracking, compatibility scoring between charts, tarot card of the day, and transit logging. All calculations run entirely on-device with no external API dependencies.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| SkySafari | $9.99-39.99 | Professional astronomy |
| Star Walk 2 | $2.99 | AR sky overlay |
| Night Sky | $39.99/yr | AR, Apple ecosystem |
| Stellarium | Free | Open-source planetarium |

**Current feature gaps vs. competitors:**

AR sky overlay for identifying celestial objects by pointing the phone, telescope control integration, friend compatibility matching, and a zodiac event calendar.

**MyLife's advantage:**

Night Sky charges $40/yr. MyStars provides birth chart calculations and astrology features at $5/yr for the suite. The fully on-device calculation approach means no birth data is sent to servers, which is relevant for users who consider astrological data personal. The Mood integration (moon phase correlation with emotional state) is a unique cross-module capability.

---

### 26. Mail (MyMail)

| | |
|---|---|
| **Icon** | Mailbox |
| **Tier** | Premium |
| **Table Prefix** | `ml_` |
| **Category TAM** | Mature market (email clients) |
| **Completeness** | 30% |

**What it does today:**

MyMail provides a self-hosted IMAP email client with message management and inbox analytics.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Gmail | Free | 1.8B users | Ad-supported, full data access |
| Outlook | Free/$6.99/mo | Enterprise standard | |
| Superhuman | $30/mo ($360/yr) | Premium productivity email | |
| Spark | $59.99/yr | Smart inbox features | |

**Current feature gaps vs. competitors:**

Full IMAP implementation, search, threading, filters, and push notifications. MyMail is the least complete module and requires significant development investment.

**MyLife's advantage:**

Email is the most surveilled communication channel. Gmail reads emails for ad targeting. Superhuman charges $360/yr for a privacy-oriented email experience. MyMail's self-hosted IMAP approach means email never passes through MyLife's servers. At 30% completeness, this is a long-term play, but the privacy value proposition for email is enormous.

---

### 27. Forums (MyForums)

| | |
|---|---|
| **Icon** | Speech Bubble |
| **Tier** | Free |
| **Table Prefix** | `fr_` |
| **Category TAM** | Discord benchmarks at $725M ARR |
| **Completeness** | 50% |

**What it does today:**

MyForums provides Reddit-style discussions backed by Supabase, including topic creation, nested commenting, voting, and moderation tools.

**Competitor landscape:**

| Competitor | Price | Users | Notes |
|-----------|-------|-------|-------|
| Discord | Free/$9.99/mo | 200M+ MAU | Real-time chat, voice, communities |
| Reddit | Free/$5.99/mo | 1.7B monthly visits | Link aggregation, deep communities |
| Lemmy | Free | Federated, open-source | |
| Discourse | $50/mo | Self-hosted forum software | |

**Current feature gaps vs. competitors:**

Real-time chat, voice channels, media sharing, and federation support.

**MyLife's advantage:**

MyForums is free forever and provides a community layer within the MyLife ecosystem. As the user base grows, forums enable organic module-specific communities (budgeting tips, recipe sharing, workout programs) that increase engagement and retention without any additional cost to users.

---

### 28. Market (MyMarket)

| | |
|---|---|
| **Icon** | Storefront |
| **Tier** | Free |
| **Table Prefix** | `mk_` |
| **Category TAM** | Niche (privacy-first marketplace) |
| **Completeness** | 40% |

**What it does today:**

MyMarket provides a privacy-first marketplace with 3 listing types, watchlist functionality, Signal-style encrypted messaging between buyers and sellers, PostGIS-powered location search, offline cache for browsing without connectivity, and a reviews system.

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Facebook Marketplace | Free | Requires Facebook account, data harvested |
| Craigslist | Free | No encryption, scam-heavy |
| OfferUp | Free | Identity verification, in-app payments |
| Mercari | 10% seller fee | Shipping marketplace |

**Current feature gaps vs. competitors:**

Cloud client functions, full UI screens, encryption implementation completion, and service discovery.

**MyLife's advantage:**

MyMarket is free forever. Facebook Marketplace requires a Facebook account and harvests data. Craigslist has no buyer/seller protection. MyMarket's encrypted messaging is a genuine differentiator for users who want to buy and sell locally without exposing personal information. At 40% completeness, this is a long-term module.

---

### 29. Subs (MySubs)

| | |
|---|---|
| **Icon** | Repeat |
| **Tier** | Premium |
| **Table Prefix** | `sb_` |
| **Category TAM** | Feature of budgeting (not standalone market) |
| **Completeness** | Being absorbed into Budget |

**Status: Merging into MyBudget**

Subscription tracking is being consolidated into the Budget module, which already includes a 215-entry subscription catalog, recurring transaction detection, and subscription cost tracking. Rather than maintaining a separate lightweight module, the subscription tracking capabilities are being absorbed into Budget's more comprehensive financial management system. This follows the same consolidation pattern used by Health (which absorbed Meds, Fast, and Cycle tracking).

**Competitor landscape:**

| Competitor | Price | Notes |
|-----------|-------|-------|
| Rocket Money | $48-144/yr | Bill negotiation, subscription detection |
| Bobby | $1.99 one-time | Simple subscription tracker |

**MyLife's advantage:**

MyBudget already provides subscription tracking as part of its envelope budgeting system. Rocket Money charges up to $144/yr and takes a percentage of negotiated savings. MyLife's integrated approach means subscription costs are visible within the full budget picture, not siloed in a separate app.

---

## V. Competitive Positioning

### "The Microsoft Office of Personal Apps"

Microsoft Office succeeded by bundling Word, Excel, PowerPoint, Outlook, and more into a single suite that replaced buying each application separately. MyLife applies the same strategy to personal consumer apps: one suite replaces dozens of subscriptions.

The analogy is precise. Office did not need to be the absolute best word processor or the absolute best spreadsheet. It needed to be good enough across every category and unbeatable on value. MyLife follows the same playbook: each module is 85-95% as capable as the category leader, but the suite costs $5/yr instead of $800+.

### Price Comparison: 10 Apps vs. MyLife

| Category | Best-in-Class App | Annual Cost | MyLife Module |
|----------|-------------------|-------------|---------------|
| Budgeting | YNAB | $109.00 | MyBudget |
| Nutrition | MyFitnessPal | $79.99 | MyNutrition |
| Workouts | Hevy | $36.00 | MyWorkouts |
| Journaling | Day One | $34.99 | MyJournal |
| Fasting | Zero | $69.99 | MyFast |
| Mental Health | Headspace | $69.99 | MyMood |
| Notes | Notion | $96.00 | MyNotes |
| Books | StoryGraph | $49.99 | MyBooks |
| Medication | Medisafe | $39.99 | MyMeds |
| Surf Forecasts | Surfline | $119.99 | MySurf |
| **Total** | | **$705.93** | **$5.00** |

MyLife delivers 141x the value per dollar.

### Privacy-First in a Post-Breach World

Every major personal data category has experienced a significant breach or privacy scandal in the last 5 years. MyLife's local-first architecture is a product choice with practical privacy benefits. Keeping most module data on-device reduces server-side breach exposure and limits how much personal data needs to be collected centrally.

This matters most for the most sensitive categories: cycle tracking (post-Dobbs legal exposure), mental health (BetterHelp FTC fine), medical records (HIPAA-adjacent sensitivity), and financial data (identity theft risk).

### Cross-Module Intelligence

Siloed apps cannot correlate data across categories. This is a structural limitation, not a feature gap. A standalone mood app will never know what medications the user takes. A standalone nutrition app will never know the user's fasting schedule. A standalone workout app will never know the user's sleep quality.

MyLife's single-database architecture enables correlations that are impossible in a multi-app world:

- Medication changes correlated with mood shifts over time (Pearson correlation engine)
- Fasting windows automatically coordinated with nutrition tracking
- Menstrual cycle phases correlated with mood, energy, and workout performance
- Sleep quality correlated with next-day mood and exercise capacity
- Pet medication schedules alongside human medication schedules
- Garden harvests flowing into recipe ingredients flowing into nutritional tracking

This cross-module intelligence becomes more valuable as users enable more modules. It is a compounding advantage that no competitor can replicate without building the same unified architecture.

---

## VI. Business Model

### Pricing Structure

| Tier | Price | Modules | Count |
|------|-------|---------|-------|
| Free Forever | $0 | Fast, Forums, Journal, Market, Mood, Notes, Voice | 7 |
| MyLife Pro | $5/yr | All 29 modules | 29 |

There is one subscription tier. $5 per year. It unlocks everything.

### Why $5/yr Works

**For users:** The price is low enough to be an impulse purchase. There is no mental friction. No "is this worth it?" deliberation. Five dollars is less than a coffee. The decision takes seconds.

**For the business:** The economics work because of the local-first architecture.

Traditional SaaS apps have significant per-user server costs: database hosting, compute, storage, bandwidth, CDN. Every user costs money every month. This forces high subscription prices to maintain margins.

MyLife inverts this model. Local modules run entirely on the user's device. The user's phone is the server. MyLife's marginal cost per user for 24 of 29 modules is effectively zero. The only cloud infrastructure costs come from the 5 modules that require network connectivity (Forums, Market, Surf, Homes, Workouts cloud sync), and even those are lightweight.

### App Store Economics

| | Year 1 | Year 2+ |
|--|--------|---------|
| Gross price | $5.00 | $5.00 |
| Apple/Google commission | 30% | 15% (small business program) |
| Commission amount | $1.50 | $0.75 |
| Net revenue per user | $3.50 | $4.25 |

Apple and Google both offer small business programs that reduce the commission to 15% after the first year or for developers earning under $1M annually.

### Acquisition Funnel

The 7 free modules serve as a zero-cost acquisition funnel:

1. **Fast** (95% complete, fasting timer) draws the intermittent fasting community
2. **Journal** (95% complete, daily journaling) draws the self-improvement community
3. **Mood** (90% complete, emotion tracking) draws the mental health community
4. **Notes** (90% complete, markdown knowledge base) draws the productivity community
5. **Voice** (92% complete, dictation) draws the voice-first workflow community
6. **Forums** (50% complete, community) builds network effects within MyLife
7. **Market** (40% complete, encrypted marketplace) builds transactional network effects

Users download the app for free, discover a genuinely useful tool, explore the module dashboard, see the premium modules, and convert at $5/yr. The conversion friction is minimal because the price is minimal.

---

## VI-B. Pricing Strategy Analysis

Investors will ask: "Why $5?" This section models four pricing strategies, evaluates each against user psychology, competitor positioning, and revenue projections, and explains why $5/yr flat was chosen as the deliberate market-disruption weapon.

All revenue projections use a base of 20% free-to-paid conversion and account for Apple/Google commission rates (30% Year 1, 15% Year 2+ via small business programs).

### Strategy A: $5/yr Flat (CHOSEN)

**The model:** One price. Everything included. No tiers, no upsells, no per-module pricing.

**Revenue per user:**

| | Year 1 | Year 2+ |
|--|--------|---------|
| Gross price | $5.00 | $5.00 |
| App Store commission | $1.50 (30%) | $0.75 (15%) |
| **Net revenue** | **$3.50** | **$4.25** |

**Projected revenue (paying users at 20% conversion):**

| Total Users | Paying Users | Year 1 Net ARR | Year 2+ Net ARR |
|-------------|-------------|----------------|-----------------|
| 100K | 20K | $70K | $85K |
| 500K | 100K | $350K | $425K |
| 1M | 200K | $700K | $850K |
| 2M | 400K | $1.40M | $1.70M |

**User psychology:** $5/yr is a vending machine purchase. It sits below the threshold where people evaluate whether they "need" the product. There is no internal debate. The mental model is "that costs nothing" rather than "is this worth it?" This triggers impulse conversion at a rate that higher prices cannot match.

**Competitor positioning:** Every competitor charges $30-120/yr per single category. MyLife replaces 10+ of them for $5. The comparison is so extreme that it reads as absurd, which makes it memorable and shareable. "Wait, everything for $5 a year?" is the sentence that does the marketing.

**Pros:**
- Maximum virality: the price itself is the marketing message
- Lowest conversion friction in the entire consumer app market
- Churn resistance: $5/yr is too small to trigger annual "should I cancel?" reviews

**Cons:**
- Revenue per user is low, requiring large-scale volume to reach meaningful ARR
- Some investors may perceive $5 as unsustainable or as signaling a low-quality product
- Leaves money on the table from users who would happily pay $20-50/yr

---

### Strategy B: $12-24/yr Flat

**The model:** Same as Strategy A but at 2-5x the price. Still dramatically cheaper than competitors (90%+ discount), but with higher per-user revenue.

**Revenue per user (modeled at $18/yr midpoint):**

| | Year 1 | Year 2+ |
|--|--------|---------|
| Gross price | $18.00 | $18.00 |
| App Store commission | $5.40 (30%) | $2.70 (15%) |
| **Net revenue** | **$12.60** | **$15.30** |

**Projected revenue (paying users at 20% conversion):**

| Total Users | Paying Users | Year 1 Net ARR | Year 2+ Net ARR |
|-------------|-------------|----------------|-----------------|
| 100K | 20K | $252K | $306K |
| 500K | 100K | $1.26M | $1.53M |
| 1M | 200K | $2.52M | $3.06M |
| 2M | 400K | $5.04M | $6.12M |

**User psychology:** $18/yr ($1.50/mo) is still cheap, but it crosses the "let me think about it" threshold. Users compare it against other subscriptions. The internal question shifts from "why not?" to "do I need this?" Conversion rates will be meaningfully lower, likely 12-15% vs. 20%+ at $5. The price is "reasonable" rather than "ridiculous," which means it generates consideration instead of impulse.

**Competitor positioning:** Still 85-90% cheaper than the combined competitor stack ($706/yr). However, the shock factor diminishes. "$18/yr for 29 apps" is compelling but not absurd. It does not break people's mental model the way $5 does. It is forgettable.

**Pros:**
- 3.6x more net revenue per paying user than $5/yr
- Perceived as more "credible" by investors comparing to typical SaaS metrics
- Reaches profitability with fewer users (break-even at ~20K paying users vs. ~35K)

**Cons:**
- Loses the "this can't be real" marketing hook that makes $5/yr viral
- Conversion rate drops significantly; the price now requires a value justification
- Positions MyLife as "cheap" rather than "absurdly generous," weakening the brand story

---

### Strategy C: Freemium + $3/yr Per Module Cluster

**The model:** 7 modules free (same as current). Premium modules grouped into clusters, each priced at $3/yr. Users buy only the clusters they want.

| Cluster | Modules | Price |
|---------|---------|-------|
| Free | Fast, Forums, Journal, Market, Mood, Notes, Voice | $0 |
| Health & Wellness | Cycle, Health, Meds, Nutrition | $3/yr |
| Fitness & Outdoors | Workouts, Surf, Trails | $3/yr |
| Finance & Home | Budget, Car, Homes, Subs | $3/yr |
| Productivity | Books, Flash, Habits, Words | $3/yr |
| Lifestyle | Closet, Garden, Pets, Recipes, RSVP, Stars, Mail | $3/yr |
| All Clusters Bundle | Everything | $12/yr |

**Revenue per user (assuming average user buys 2.3 clusters or the bundle):**

| | Year 1 | Year 2+ |
|--|--------|---------|
| Avg. gross price (2.3 clusters) | $6.90 | $6.90 |
| App Store commission | $2.07 (30%) | $1.04 (15%) |
| **Net revenue** | **$4.83** | **$5.87** |

**Projected revenue (paying users at 18% conversion, lower due to decision complexity):**

| Total Users | Paying Users | Year 1 Net ARR | Year 2+ Net ARR |
|-------------|-------------|----------------|-----------------|
| 100K | 18K | $87K | $106K |
| 500K | 90K | $435K | $528K |
| 1M | 180K | $869K | $1.06M |
| 2M | 360K | $1.74M | $2.11M |

**User psychology:** Choice creates friction. Users now face a multi-step decision: "Which clusters do I need? Will I use all 4 modules in Health & Wellness? Should I just buy the bundle?" Every additional decision point reduces conversion. The "paradox of choice" research (Iyengar & Lepper, 2000) demonstrates that more options decrease purchase likelihood and post-purchase satisfaction.

**Competitor positioning:** Per-cluster pricing makes MyLife look like every other "tier-based" SaaS product. The simplicity of "$5 for everything" disappears. Users must now compare individual clusters against individual competitors rather than the suite against the whole market.

**Pros:**
- Users who want only 1-2 clusters pay less, potentially increasing top-of-funnel conversion
- Higher ARPU from power users who buy 3+ clusters or the bundle
- Investors familiar with module-based pricing may find the model more conventional

**Cons:**
- Destroys the "one price, everything" simplicity that makes $5/yr viral
- Decision paralysis reduces conversion rates
- Operational complexity: customer support now handles "which cluster has X module?"
- Creates perverse incentive to keep modules in high-demand clusters rather than improving all modules equally

---

### Strategy D: $30 Lifetime OR $5/yr

**The model:** Two options side by side. $5/yr recurring subscription, or $30 one-time lifetime purchase. Users self-select based on time horizon and commitment level.

**Revenue per user (blended, assuming 35% choose lifetime, 65% choose annual):**

| | Year 1 | Year 2+ |
|--|--------|---------|
| Blended gross price | $13.75 | $3.25 (renewals only) |
| App Store commission | $4.13 (30%) | $0.49 (15%) |
| **Net revenue** | **$9.63** | **$2.77** |

**Projected revenue (paying users at 22% conversion, slightly higher due to lifetime option):**

| Total Users | Paying Users | Year 1 Net ARR | Year 2+ Net ARR |
|-------------|-------------|----------------|-----------------|
| 100K | 22K | $212K | $61K |
| 500K | 110K | $1.06M | $305K |
| 1M | 220K | $2.12M | $609K |
| 2M | 440K | $4.24M | $1.22M |

**User psychology:** The lifetime option captures high-intent users immediately. Early adopters and power users prefer to "own" rather than rent. The $30 price anchors the $5/yr as a bargain (anchoring effect). However, $30 triggers a real purchase decision: "Will I still use this in 2 years?" Lifetime buyers also remove themselves from the recurring revenue base, creating a Year 2+ cliff.

**Competitor positioning:** Several privacy-focused apps (Obsidian: one-time sync fee, Standard Notes: annual or one-time) have demonstrated that lifetime pricing attracts a passionate early-adopter segment. However, Obsidian later pivoted toward recurring revenue for its commercial tier.

**Pros:**
- Strong Year 1 revenue from lifetime buyers (cash flow front-loaded)
- Captures willingness-to-pay from users who value ownership
- $30 anchor makes $5/yr feel even cheaper by comparison

**Cons:**
- Year 2+ revenue drops sharply as lifetime buyers stop contributing
- Lifetime buyers who churn still cost support/infrastructure but generate zero future revenue
- Creates a two-class user base (lifetime vs. annual) that complicates business modeling
- Investors value ARR, not one-time revenue; lifetime purchases deflate the recurring metrics VCs care about

---

### Side-by-Side Comparison at 1M Users

| Metric | A: $5/yr | B: $18/yr | C: Clusters | D: $30+$5 |
|--------|----------|-----------|-------------|------------|
| Conversion rate | 20% | ~13% | ~18% | ~22% |
| Paying users | 200K | 130K | 180K | 220K |
| Year 1 Net ARR | $700K | $1.64M | $869K | $2.12M |
| Year 2+ Net ARR | $850K | $1.99M | $1.06M | $609K |
| Year 3+ trajectory | Steady growth | Steady growth | Moderate growth | Declining without new users |
| Viral coefficient | Very high | Moderate | Low | Moderate |
| Marketing message | "Everything, $5/yr" | "Everything, $1.50/mo" | "Pick what you need" | "Own it forever or $5/yr" |
| Simplicity | Maximum | High | Low | Medium |
| Investor narrative | Volume play | Balanced | Complex | Front-loaded |

### Why $5/yr Flat Was Chosen

The pricing decision is not a financial optimization. It is a market strategy.

**1. The price IS the product.**
At $5/yr, the price itself becomes the most viral feature. Every other strategy requires explaining features, privacy, or architecture. $5/yr requires explaining nothing. The disbelief is the marketing. "That can't be real" is the most powerful sentence in consumer marketing because it compels people to check.

**2. Volume beats margin at near-zero marginal cost.**
Traditional SaaS companies charge more because every user costs them money in server resources. MyLife's local-first architecture breaks this equation. The marginal cost of user #1,000,001 is effectively zero for 24 of 29 modules. When your cost curve is flat, maximizing volume is the mathematically correct strategy.

**3. Conversion friction is the bottleneck, not willingness-to-pay.**
The consumer app market has demonstrated repeatedly that most users never convert from free to paid. The primary lever is not extracting more dollars from converters -- it is converting more free users. At $5/yr, the conversion funnel has almost no friction. Moving to $18/yr would capture 3.6x more per converter but lose 30-40% of the conversions. The net effect is negative at scale.

**4. Churn math favors ultra-low pricing.**
At $5/yr, the annual "should I keep this?" moment barely registers. Users who forget about the app do not bother canceling. Users who use it occasionally still do not bother canceling. The psychological threshold for cancellation is far above $5. Estimated annual churn is 15-25% at $5/yr vs. 35-50% at $18/yr. Over a 5-year horizon, lower churn compounds into significantly higher cumulative revenue.

**5. The competitive moat is depth, not price.**
$5/yr gets users in the door. Cross-module intelligence, data portability, and the single-database architecture keep them. Once a user has 6 months of mood data correlated with medication changes, 2 years of budget history, and a personal recipe collection, the switching cost to go back to 10+ separate apps is enormous. The $5/yr price is the acquisition weapon. The product is the retention weapon.

**6. Investor framing: this is Dollar Shave Club, not a charity.**
Dollar Shave Club charged $1/mo for razors when Gillette charged $4/blade. Investors called it unsustainable. Unilever acquired it for $1 billion. The playbook is identical: use an aggressively low price to capture market share in a category dominated by incumbents who are structurally unable to match the price because of their cost structure. MyLife's local-first architecture is the structural advantage that makes $5/yr sustainable when no cloud-based competitor can follow.

---

## VII. Financial Model

### Market Capture Framing

Traditional projections estimate downloads from thin air. MyLife's projections are grounded in a concrete reality: over 2.17 billion people already use apps in the 23 competitive spaces MyLife covers. These are not hypothetical users. They are real people paying real money for tools MyLife replaces at a fraction of the cost.

The question is not "can we find users?" It is "what fraction of the existing market switches?"

### The Addressable User Pool

| # | Competitive Space | Total Users | Key Apps in Space |
|---|-------------------|------------|-------------------|
| 1 | Cycle Tracking | 453M | Flo, Clue, Natural Cycles |
| 2 | Notes/Knowledge | 352M | Evernote, Notion, Obsidian |
| 3 | Flashcards/Study | 310M | Quizlet, Anki, StudyFetch |
| 4 | Nutrition/Calories | 262M | MyFitnessPal, Lose It!, Cronometer |
| 5 | Workouts/Fitness | 214M | Strava, JEFIT, Fitbod, Hevy, Strong |
| 6 | Books/Reading | 155M | Goodreads, StoryGraph |
| 7 | Habit Tracking | 118M | Streaks, Habitica, Habitify, Fabulous |
| 8 | Trails/Hiking | 55M | Komoot, AllTrails |
| 9 | Mood/Mental Health | 50M | Daylio, Calm, Headspace |
| 10 | Journal/Diary | 25M | Day One, Diarium |
| 11 | Events/RSVP | 21M | Evite, Partiful |
| 12 | Stars/Astrology | 20M | Vito Technology, Co-Star |
| 13 | Budget/Finance | 15M | YNAB, Monarch, Rocket Money |
| 14 | Fasting | 15M | Fastic, Zero, Simple |
| 15 | Voice/Transcription | 12M | Otter.ai, Notta |
| 16 | Meds/Medication | 8M | Medisafe, CareClinic |
| 17 | Closet/Wardrobe | 5M | Indyx, Clueless, Stylebook |
| 18 | Car/Vehicle | 5M | CARFAX, Drivvo, FIXD |
| 19 | Recipes | 5M | Paprika, AnyList |
| 20 | Garden/Plants | 3M | PlantIn, Planter |
| 21 | Pets | 3M | 11pets, Pawp |
| 22 | Surf | 2M | Surfline, Windy |
| 23 | Homes/Property | 2M | HomeZada, Centriq |
| | **Total across all spaces** | **2.17B** | |

These numbers represent registered users of apps in each space. There is significant cross-space overlap (someone tracking workouts often also tracks nutrition). Adjusted for overlap, the unique individual pool is estimated at 500-800 million people worldwide.

### Why Users Switch

MyLife does not need to be better than every competitor. It needs to give users a reason to try it. Four reasons drive switching:

1. **Price:** $5/yr vs. $30-120/yr per app. For users in 3+ categories, the savings are $100-500/yr.
2. **Consolidation:** One app, one login, one database instead of 10+ accounts.
3. **Privacy:** Local-first, zero telemetry, encrypted where possible. Post-breach, post-Dobbs, this matters.
4. **Customization:** "We will build any feature you request." At $5/yr, user requests drive the roadmap.

### Revenue Projections (Market Capture Model)

The base case assumes MyLife captures 1 in 500 users from each competitive space by the end of Year 2. This is an extraordinarily small fraction: 0.2% of each space.

**1 in 500 capture per space:**

| # | Space | Total Users | 1/500 Capture |
|---|-------|------------|---------------|
| 1 | Cycle Tracking | 453M | 906,000 |
| 2 | Notes/Knowledge | 352M | 704,000 |
| 3 | Flashcards/Study | 310M | 620,000 |
| 4 | Nutrition/Calories | 262M | 524,000 |
| 5 | Workouts/Fitness | 214M | 428,000 |
| 6 | Books/Reading | 155M | 310,000 |
| 7 | Habit Tracking | 118M | 236,000 |
| 8 | Trails/Hiking | 55M | 110,000 |
| 9 | Mood/Mental Health | 50M | 100,000 |
| 10-23 | Remaining 14 spaces | 121M | 242,000 |
| | **Raw total** | | **4,180,000** |
| | **Overlap-adjusted (50%)** | | **2,090,000** |

At 20% paid conversion: **418,000 paying users** generating **$1.78M net ARR**.

### Three Scenarios by Capture Rate

**Conservative (1 in 1,000 per space):**

| Metric | Year 1 (35% of target) | Year 2 (100%) | Year 3 | Year 5 |
|--------|----------------------|---------------|--------|--------|
| Unique users | 368K | 1.05M | 1.6M | 2.5M |
| Paying users (20%) | 74K | 210K | 320K | 500K |
| Net ARR | $258K | $893K | $1.36M | $2.13M |

**Base case (1 in 500 per space):**

| Metric | Year 1 (35% of target) | Year 2 (100%) | Year 3 | Year 5 |
|--------|----------------------|---------------|--------|--------|
| Unique users | 735K | 2.1M | 3.5M | 5.5M |
| Paying users (20%) | 147K | 420K | 700K | 1.1M |
| Net ARR | $515K | $1.79M | $2.98M | $4.68M |

**Aggressive (1 in 250 per space):**

| Metric | Year 1 (35% of target) | Year 2 (100%) | Year 3 | Year 5 |
|--------|----------------------|---------------|--------|--------|
| Unique users | 1.47M | 4.2M | 7M | 11M |
| Paying users (20%) | 294K | 840K | 1.4M | 2.2M |
| Net ARR | $1.03M | $3.57M | $5.95M | $9.35M |

**Context:** A 1-in-500 capture rate is 0.2%. Dollar Shave Club's launch video captured roughly 1-in-200 of Gillette's customer base within its first year. MyLife's $5/yr price point is an even sharper value proposition than Dollar Shave Club's $1/month was against Gillette's $4/blade.

### Phased Capture Timeline (Base Case)

| Timeframe | % of 1/500 Target | Unique Users | Paying Users | Net ARR |
|-----------|-------------------|-------------|-------------|---------|
| Month 3 (launch) | 5% | 105K | 21K | $74K |
| Month 6 (viral push) | 15% | 315K | 63K | $220K |
| Month 12 (Year 1 end) | 35% | 735K | 147K | $515K |
| Month 18 | 60% | 1.26M | 252K | $1.07M |
| Month 24 (Year 2 end) | 100% | 2.1M | 420K | $1.79M |

### Break-Even Analysis

| Milestone | Paying Users Required | Capture Rate Equivalent |
|-----------|----------------------|------------------------|
| Founder salary ($150K) | ~35,000 | 1 in 3,000 per space |
| Founder + 1 engineer ($275K) | ~65,000 | 1 in 1,600 per space |
| Full Year 1 operation ($500K) | ~118,000 | 1 in 900 per space |
| Full Year 1 operation ($750K) | ~176,000 | 1 in 600 per space |

At the base case (1 in 500), Year 1 revenue of $515K covers the full $500K annual operating cost. The $750K investment provides an 18-month runway with comfortable cushion.

### Lifetime Value and Churn

At $5/yr, churn economics differ fundamentally from traditional SaaS:

- The price is low enough that most users will simply not bother canceling
- Auto-renewal at $5 does not trigger the "do I still use this?" evaluation that $10/mo subscriptions do
- Users who have data in multiple modules have high switching costs (their personal data lives in the app)
- Estimated annual churn: 15-25% (vs. 40-60% for higher-priced consumer subscriptions)
- Estimated LTV: $12-17 per paying user (3-4 year average retention)

### Cumulative P&L (Base Case, $750K Raise)

| | Year 1 | Year 2 | Year 3 | Year 5 |
|--|--------|--------|--------|--------|
| Annual net revenue | $515K | $1.79M | $2.98M | $4.68M |
| Annual costs | $500K | $650K | $850K | $1.2M |
| Annual profit/loss | +$15K | +$1.14M | +$2.13M | +$3.48M |
| Cumulative revenue | $515K | $2.30M | $5.28M | $14.64M |
| Cumulative costs | $500K | $1.15M | $2.0M | $3.6M |
| Cash position (incl. $750K raise) | +$765K | +$1.90M | +$4.03M | +$11.79M |

The business is operationally profitable from Year 1. The $750K investment is fully recovered within 18 months. By Year 5, the business has generated $11M+ in cumulative cash.

---

## VIII. Cost Structure

### Year 1 Costs (Detailed)

| Category | Amount | Notes |
|----------|--------|-------|
| Founder compensation | $150,000 | Below-market for senior full-stack engineer ($160-220K market rate) |
| Engineering hire (1 developer) | $125,000 | Senior TypeScript/React Native engineer |
| Marketing (viral launch) | $100,000 | Video production, social deployment, sustained content |
| Legal and compliance | $50,000 | GDPR audit, privacy policy, App Store legal, trademark |
| Design (UX audit + assets) | $25,000 | Professional UI/UX review, marketing assets, icon refinement |
| App Store fees | $124 | Apple ($99) + Google ($25), annual |
| Cloud hosting (Supabase) | $3,000 | Pro tier for cloud modules (forums, market, surf) |
| Infrastructure | $5,000 | Domain, email, CI/CD, monitoring, test devices |
| **Total Year 1** | **$458,124** |

### Year 2-3 Costs (Scaling)

| Category | Year 2 | Year 3 |
|----------|--------|--------|
| Founder compensation | $150K | $175K |
| Engineering (1-2 additional) | $125-250K | $200-350K |
| Marketing | $75-100K | $100-150K |
| Legal/compliance | $15K | $20K |
| Cloud hosting | $6-12K | $12-36K |
| Infrastructure | $5K | $8K |
| Customer support | $10-25K | $25-50K |
| **Total** | **$386-557K** | **$540-789K** |

### Cost Advantage: Local-First

The critical insight in this cost structure is what is absent: per-user server costs. Traditional SaaS companies spend 15-30% of revenue on cloud infrastructure that scales linearly with users. MyLife's local-first architecture means 24 of 29 modules generate zero server cost per user. The marginal cost of adding user #100,001 is effectively zero for most modules.

This means margins improve as the user base grows, rather than staying flat or declining.

---

## IX. Go-to-Market Strategy

### The Viral Launch Bomb

MyLife's go-to-market centers on a single high-impact launch moment designed to maximize simultaneous exposure across the United States, followed by sustained organic growth. The $5/yr price point is the marketing message. It is so inexpensive that it triggers disbelief, which triggers sharing.

### Phase 0: Polish (Months 1-4)

**Ship a polished first version before any marketing spend.**

The viral launch only works if the product delivers on the promise. Months 1-4 focus on completing the top 15 modules to 90%+ quality, professional UI/UX audit, App Store listing optimization, and TestFlight/closed beta with 500 users for feedback. No public marketing until the product is ready.

### Phase 1: The Video (Month 4-5)

**Produce one exceptional launch video in the style of Dollar Shave Club's original ad.**

Dollar Shave Club's first video cost $4,500 and generated 12,000 orders in 48 hours. The concept: a charismatic, slightly irreverent pitch that makes the value proposition instantly obvious and shareable.

**MyLife video concept:** Someone drowning in app notifications, watching subscription charges stack up on their credit card, accepting 15 privacy policies. Then the reveal: one app, everything they need, $5 a year, data never leaves your phone. Humorous, fast-paced, shareable.

| Component | Budget |
|-----------|--------|
| Script and concept | $5K |
| Director and crew (1-day shoot) | $15-20K |
| Talent | $5-10K |
| Post-production (editing, motion graphics, sound) | $8-10K |
| Music licensing | $2-3K |
| **Total** | **$35-48K** |

### Phase 2: The Simultaneous Launch (Month 5-6)

**Deploy the video across 50 US cities simultaneously.**

Create localized social media accounts across Instagram and TikTok, each geo-targeted to a major US city. Deploy the launch video from all accounts at once, creating the appearance of a nationwide grassroots movement rather than a single-source campaign.

| Component | Budget |
|-----------|--------|
| 50 Instagram accounts (city-localized, VPN-routed) | $3-5K |
| 50 TikTok accounts (city-localized, VPN-routed) | $3-5K |
| Residential VPN infrastructure (50 cities) | $3-5K |
| Content scheduling and deployment automation | $5-8K |
| City-specific caption and hashtag variations | $2-3K |
| **Total** | **$16-26K** |

**Target cities:** NYC, LA, SF, Chicago, Miami, Austin, Seattle, Denver, Portland, Nashville, Atlanta, Boston, DC, Philadelphia, Phoenix, San Diego, Dallas, Houston, Minneapolis, Detroit, Raleigh, Tampa, Orlando, Charlotte, Salt Lake City, Honolulu, Boulder, Madison, Ann Arbor, Asheville, Santa Cruz, Bend, Pittsburgh, New Orleans, Sacramento, San Jose, Oakland, Brooklyn, Jersey City, Tucson, Albuquerque, Louisville, Columbus, Indianapolis, Savannah, Charleston, Burlington, Chattanooga, Boise, Richmond.

Each account posts with localized hooks: "San Diego, stop paying $70/yr for Surfline." "Austin, why are you paying $109/yr for YNAB?" "NYC, your 8 app subscriptions cost more than your Netflix."

### Phase 3: Sustained Content (Months 6-12)

**Module-specific comparison content across all social channels.**

| Content Type | Frequency | Purpose |
|-------------|-----------|---------|
| Module vs. competitor reels | 3/week per account | "YNAB costs $109/yr. MyBudget does the same thing. $5/yr." |
| Privacy scare content | 2/week | "Your cycle app sold your data to Facebook. Ours can't." |
| Price reveal hooks | Daily | "Name an app. I'll show you how to replace it for $5/yr." |
| Feature walkthrough clips | 2/week | 30-second demos of individual modules |
| User testimonials | 1/week | Early adopters showing their setup |

### Phase 4: Community and SEO (Months 6-18)

**Organic community seeding and search engine marketing.**

- **Reddit:** r/privacy (1.9M), r/degoogle (300K+), r/selfhosted (400K+), r/intermittentfasting, r/budgeting, r/reading
- **Hacker News:** Privacy-first product launches consistently reach the front page
- **SEO content:** Landing pages targeting "YNAB alternative," "Mint replacement," "MyFitnessPal alternative," "Medisafe alternative," "Goodreads alternative"
- **Self-host community:** Release Docker configurations for Supabase-backed modules

### Phase 5: App Store Featuring (Month 12+)

**Push for Apple and Google editorial featuring.**

Apple features privacy-respecting apps prominently. MyLife's local-first architecture, glass morphism design system, and 29-module hub architecture are editorial-friendly narratives.

### Marketing Budget Summary

| Phase | Budget | Timeline |
|-------|--------|----------|
| Video production | $35-48K | Month 4-5 |
| Simultaneous city launch | $16-26K | Month 5-6 |
| Sustained content (6 months) | $25-40K | Month 6-12 |
| Contingency/boosted posts | $10-15K | As needed |
| **Total marketing spend** | **$86-129K** | |

This fits within the $100K marketing allocation, with the ability to scale up from the reserve if the launch video outperforms.

---

## X. Use of Funds

### Investment Ask: $750K Seed

| Category | % | Amount | Purpose |
|----------|---|--------|---------|
| Founder compensation (18 months) | 30% | $225,000 | Below-market salary for technical founder ($150K/yr vs. $160-220K market rate) |
| Engineering hire (18 months) | 25% | $187,000 | 1 senior full-stack TypeScript/React Native engineer |
| Marketing (viral launch) | 17% | $125,000 | Video production, 50-city social deployment, sustained content campaign |
| Legal and Compliance | 8% | $63,000 | GDPR compliance audit, privacy policy, App Store legal, trademark |
| Design | 5% | $38,000 | Professional UI/UX audit, marketing assets, App Store creative |
| Infrastructure | 5% | $37,000 | CI/CD, staging, monitoring, test devices, hosting |
| Reserve | 10% | $75,000 | Contingency, opportunity fund for scaling marketing if viral launch lands |

### 18-Month Milestone Timeline

| Month | Milestone |
|-------|-----------|
| 1-2 | Hire engineer, begin UI/UX audit, legal kickoff |
| 3-4 | Top 15 modules at 90%+ completion, TestFlight beta (500 users) |
| 5 | App Store + Play Store launch, video production complete |
| 6 | Viral launch bomb: simultaneous 50-city social deployment |
| 7-9 | Sustained content campaign, community seeding, first 100K users |
| 10-12 | Iterate on retention data, SEO content live, web platform GA |
| 13-15 | Push for App Store editorial featuring, reach 500K users |
| 16-18 | Approach 1/500 capture target, business operationally profitable |

### What the Funds Accelerate

**Without investment:**
- Module completion continues at current pace
- No marketing budget for launch
- Organic-only growth
- Timeline to 100K users: 24-36 months

**With $750K investment:**
- 2-person engineering team with professional design support
- Viral launch campaign reaching 50 US cities simultaneously
- Top 15 modules at 90%+ within 4 months
- App Store launch within 5 months
- 735K users within 12 months (base case)
- Operationally profitable from Year 1

**With $1M+ investment:**
- 3-person engineering team plus dedicated marketing hire
- Larger video production budget and paid social amplification
- All 29 modules to 85%+ within 6 months
- Accelerated path to 1/250 capture (aggressive scenario)
- Timeline to 1M users: 12 months

---

## XI. Risks and Mitigations

### Platform Risk

**Risk:** Apple or Google could reject the app, change App Store policies, or increase commission rates.

**Mitigation:** The self-host deployment mode makes MyLife functional without any app store. The web app (Next.js 15) is already live and provides full functionality for 19 modules. Progressive web app (PWA) deployment is a fallback that bypasses app stores entirely. The 15% small business commission rate is locked in for developers under $1M revenue.

### Pricing Sustainability

**Risk:** $5/yr may be too low to build a sustainable business.

**Mitigation:** Local-first architecture means near-zero marginal cost per user. The primary costs are fixed (engineering salaries) not variable (server costs). At 100K paying users, $5/yr generates $425K in net revenue, which covers a small engineering team. At 500K paying users, the business generates $2.1M, which is a healthy margin. If pricing needs to increase, even $10/yr is still 70x cheaper than the competing app stack.

### Feature Depth vs. Breadth

**Risk:** 29 modules might mean none of them are deep enough to compete with focused single-purpose apps.

**Mitigation:** The top 10 modules by completeness (Budget 95%, Books 95%, Fast 95%, Journal 95%, Workouts 92%, Voice 92%, Meds 92%, Recipes 92%, Nutrition 90%, Notes 90%) are already competitive with category leaders. The strategy is not to beat every competitor on every feature. It is to be 85-95% as good at 1/100th the combined price. Microsoft Office did not need to be better than WordPerfect at word processing. It needed to be good enough and bundled.

### Team Scale

**Risk:** The current team is small. Scaling development requires additional engineering talent.

**Mitigation:** This is the primary reason for seeking investment. The codebase is well-structured (TypeScript throughout, monorepo with clear module boundaries, 440+ tests, comprehensive documentation). Onboarding new engineers is straightforward. The modular architecture means engineers can work on individual modules without understanding the entire system.

### Market Education

**Risk:** Users may not understand the value proposition of a 29-module hub vs. individual apps they already know.

**Mitigation:** The 7 free modules eliminate the need for users to "get it" before trying the product. They download a free fasting timer or free journal, discover the hub, and organically explore premium modules. The $5/yr price point eliminates purchase friction. Users do not need to be convinced the hub is better than their existing apps. They need to be convinced $5 is worth trying.

### Competition from Platform Owners

**Risk:** Apple and Google could build more comprehensive built-in health/productivity suites.

**Mitigation:** Apple Health and Google Fit have existed for years without expanding into budgeting, recipes, books, or journaling. Platform owners focus on hardware-adjacent features (health sensors, camera, maps) not lifestyle management. Additionally, MyLife is cross-platform. Apple's solutions are iOS-only. Google's solutions require a Google account. MyLife works everywhere with no account required.

---

## XII. Exit Strategy and Comparable Outcomes

### Comparable Companies

| Company | Model | Revenue/Valuation | Relevance |
|---------|-------|-------------------|-----------|
| Obsidian | Local-first notes, privacy-focused, no VC | $25M ARR | Proved local-first + small team can build massive ARR without venture capital |
| Notion | Modular productivity workspace | $400M revenue, $10B valuation | Proved users will pay for an all-in-one productivity platform |
| Day One | Private journaling app | ~$6M ARR, acquired by Automattic | Proved privacy-focused single-module apps have acquisition value |
| Calm | Mental wellness app | $100M+ ARR, $2B valuation | Proved the mental health app category supports massive outcomes |
| Flo Health | Cycle tracking | $275M revenue, $1B+ valuation | Proved a single personal health module can reach unicorn status |
| Truebill (Rocket Money) | Subscription tracking + budgeting | Acquired for $1.275B by Rocket Companies | Proved personal finance apps command premium acquisition multiples |

### Potential Acquirers

- **Privacy-focused tech companies** seeking a consumer product suite (Proton, Mullvad ecosystem, etc.)
- **Health and wellness platforms** seeking to expand from single-category into multi-module (Garmin, Withings, Oura)
- **Financial services companies** seeking consumer engagement (similar to Rocket Companies acquiring Truebill)
- **Apple or Google** seeking to expand built-in app capabilities (low probability but massive outcome)
- **Private equity** seeking profitable consumer software with predictable revenue (similar to Francisco Partners acquiring MyFitnessPal for $345M)

### Paths to Return

1. **Profitable standalone business:** At $5/yr with near-zero marginal costs, MyLife becomes cashflow-positive at ~200K paying users. This is a sustainable lifestyle business or a foundation for continued growth.
2. **Strategic acquisition:** A company acquiring MyLife gets 29 integrated modules, a privacy-first architecture, and a user base that chose the product for trust. Comparable acquisitions range from $345M (MyFitnessPal) to $1.275B (Truebill).
3. **Growth equity / Series A:** If MyLife reaches 500K+ paying users and $2M+ ARR, the metrics support a growth round at significantly higher valuation.

The privacy-first, local-first model creates unusually loyal users. Products in this category (Obsidian, Signal, Proton) have retention rates and user advocacy that cloud-dependent products cannot match. This user quality makes the business attractive to acquirers regardless of revenue scale.

---

## XIII. Why Now

### Subscription Fatigue Has Reached a Breaking Point

Consumer spending on app subscriptions has grown every year for a decade. The backlash is now mainstream. "Subscription fatigue" is a recognized phenomenon covered by major publications. Users are actively seeking ways to reduce their app subscription burden. A product that replaces $800+/yr in subscriptions with $5/yr has immediate, visceral appeal.

### Privacy Awareness Is at an All-Time High

The regulatory environment (GDPR, CCPA, DMA) has made users aware of how their data is used. The post-Dobbs environment has made cycle tracking privacy a civil rights issue. High-profile breaches (MyFitnessPal 150M accounts, Strava military bases, BetterHelp FTC fine) have eroded trust in cloud-stored personal data. Users are actively seeking local-first, privacy-respecting alternatives.

### The Product Exists Today

This is not a pitch deck or a prototype. The product is built:

- 29 modules defined and integrated
- 440+ tests verify that the code works
- 28 of 29 modules are wired on mobile
- 19 modules wired on web
- The competitive moat is the integrated architecture, not any single module

A well-funded competitor could replicate any single module. They cannot easily replicate the integrated 29-module architecture with cross-module intelligence, local-first storage, and unified design system. The head start is real.

### Key Competitor Disruptions Create Market Openings

Several recent disruptions have displaced millions of users who are actively seeking alternatives:

- **Mint shutdown (March 2024):** Intuit shut down Mint, displacing millions of budget-tracking users. Credit Karma (the "replacement") is a financial product marketplace, not a budgeting tool. Millions of users are still looking for a Mint replacement.
- **Pocket shutdown (2024-2025):** Mozilla is winding down Pocket, displacing users who saved and organized web content.
- **Medisafe paywall (2024-2025):** Medisafe moved core medication reminder features behind a $40/yr paywall, frustrating millions of users who relied on the free tier for health-critical medication management.
- **MyFitnessPal aggressive paywall (ongoing):** Under Francisco Partners ownership, MyFitnessPal has progressively locked basic features behind its premium tier, pushing users to seek alternatives.

Each of these disruptions creates a cohort of displaced users actively searching for alternatives. MyLife can capture them with a superior product at a fraction of the cost.

### The Window Is Open

The combination of subscription fatigue, privacy awareness, and competitor disruptions creates a unique market window. A privacy-first, local-first, all-in-one personal app suite at $5/yr will face more competition as the market matures. The window is now.

---

## Appendix A: Technical Architecture Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Mobile | Expo (React Native) | iOS + Android from single codebase |
| Web | Next.js 15 (App Router) | Web application |
| Language | TypeScript (strict) | All apps and packages |
| Local Database | SQLite (expo-sqlite mobile, better-sqlite3 web) | Single-file local storage |
| Cloud Database | Supabase (PostgreSQL) | Forums, Market, Surf, Workouts sync |
| Cloud ORM | Drizzle + tRPC | Homes module type-safe data layer |
| Monorepo | Turborepo + pnpm | Build orchestration |
| Validation | Zod 3.24 | Runtime type validation |
| Testing | Vitest | 440+ automated tests |
| Design System | Cool Obsidian | Unified dark theme with glass morphism |
| Billing (mobile) | RevenueCat | In-app subscriptions |
| Billing (web) | Stripe | Web subscriptions |
| Bank Sync | Plaid | Budget module bank connections |

## Appendix B: Module Completeness Summary

| Module | Completeness | Tier | TAM |
|--------|-------------|------|-----|
| Budget | 95% | Premium | $25.8B |
| Books | 95% | Premium | 150M+ users |
| Fast | 95% | Free | $0.43-1.2B |
| Journal | 95% | Free | Included in mental health |
| Workouts | 92% | Premium | $13.5B |
| Voice | 92% | Free | $1.6B |
| Meds | 92% | Premium | $0.52B |
| Recipes | 92% | Premium | Niche |
| Notes | 90% | Free | $1.2-17B |
| Nutrition | 90% | Premium | $4.14B |
| Mood | 90% | Free | $10-17B |
| Cycle | 90% | Premium | $2.49B |
| Habits | 90% | Premium | $1.7-1.9B |
| Surf | 88% | Premium | $200-350M |
| Flash | 100% | Premium | $1.2-2.3B |
| RSVP | 85% | Premium | Niche |
| Words | 85% | Premium | Niche |
| Health | 75% | Premium | $45B+ |
| Pets | 70% | Premium | $1.5B |
| Car | 65% | Premium | $610M |
| Homes | 60% | Premium | $1.5B |
| Stars | 60% | Premium | $1.1B |
| Trails | 50% | Premium | AllTrails $71M ARR |
| Forums | 50% | Free | Discord $725M ARR |
| Closet | 40% | Premium | $132-242M |
| Garden | 40% | Premium | $1.1B |
| Market | 40% | Free | Niche |
| Mail | 30% | Premium | Mature |
| Subs | Merging into Budget | Premium | Feature of budgeting |

**Weighted average completeness (all modules):** 73%
**Weighted average completeness (top 15 modules):** 91%

---

---

## XIV. Strategic Review Addendum (March 22, 2026)

The following sections document decisions from a comprehensive CEO, Engineering, and Design review conducted on March 22, 2026. These decisions are now part of the product plan and should be reflected in all downstream materials.

### Launch Tier Strategy

Modules are classified into three tiers for App Store launch. This protects product quality and App Store reviews.

| Tier | Criteria | Modules | Count |
|------|----------|---------|-------|
| **Launch** | 85%+ complete, functional on mobile + web, all buttons work | Budget, Fast, Books, Journal, Workouts, Meds, Voice, Recipes, Nutrition, Mood, Notes, Habits, Cycle, Flash, Surf, RSVP, Words | 17 |
| **Beta** | 50-84% complete, core flows work, visible with "Beta" badge | Health, Pets, Car, Stars, Homes, Trails, Forums | 7 |
| **Hidden** | <50% complete, not visible in app until promoted | Closet, Garden, Market, Mail, Subs | 5 |

Marketing says "29 modules." Launch ships 17 fully functional + 7 visible beta. The 5 hidden modules are built post-launch. All 29 remain in the plan; none are cut.

### Cross-Module Intelligence Engine

The product's structural advantage over competitors is the cross-module intelligence that only a unified database makes possible. This is now being formalized as a first-class product feature.

**Architecture:**
- On-device statistical analytics as default (Pearson correlations, trend analysis, statistical summaries)
- Optional user-provided API key for LLM-powered insights (Claude/GPT), with explicit transparency: "This will send your data to [provider]"
- Two-tier permission model: per-module toggle (simple) + per-table granular (advanced, for power users)
- User controls exactly which modules the AI can see. Default: all OFF. User opts in.

**Privacy guarantee:** On-device analytics never send data anywhere. The AI sees ONLY what the user explicitly grants. Biometric data from verification is never collected -- we receive only a boolean from the OS.

### Biometric Human Verification

Social features (Forums posting, Market listings) require proof-of-humanity via device biometrics.

- **iOS:** Face ID / Touch ID via LAContext
- **Android:** BiometricPrompt (fingerprint/face)
- **Web:** Verify on mobile first, sync to web session. WebAuthn/Passkeys as alternative.
- **What we store:** Timestamp + method + device attestation token. NEVER biometric data.
- **What we receive:** A boolean from the OS Secure Enclave. Nothing else.

This prevents bot accounts while maintaining the privacy promise. Read-only browsing of Forums is allowed without verification.

### Anti-Enshittification Pledge

A legally binding (where possible) commitment that codifies the product philosophy:

1. We will never show advertisements.
2. We will never sell user data.
3. We will never lock previously-free features behind paywalls.
4. Users can export all their data at any time in standard formats.
5. Users can delete all their data via a single button in Settings.
6. Content filtering is the user's choice, not ours. During onboarding, users set their own preferences for content visibility, language, and filtering. We believe in free speech; users who want content filtering can enable it for themselves.
7. If we break these commitments, users can export their data and leave with zero friction.

This pledge is presented during onboarding as part of the privacy promise, not as a Terms of Service. It is written in human language, not legal language.

### Onboarding Flow

First-time users experience a guided flow:

1. **Welcome** -- clean dark splash, no login required, no account creation
2. **Privacy Promise** -- the Anti-Enshittification Pledge in plain language
3. **Content Preferences** -- user sets their own filters, language, free speech choices
4. **Module Selection** -- "What matters to you?" Visual grid; tap to enable
5. **Replace My Apps** -- "Currently using YNAB? Import your data." Per-competitor import
6. **AI Preferences** -- optional: enable cross-module intelligence, set module permissions
7. **Biometric Verification** -- optional: verify for social features
8. **Dashboard Reveal** -- personalized home screen with chosen modules

State is persisted so users can resume after force-quit. All steps except Step 1 are skippable.

### Unified Dashboard

The hub dashboard becomes the home screen -- a personalized view of the user's entire life:

1. **Greeting + life streak** ("Good morning, Trey. Day 14 of your streak.")
2. **4 primary module cards** (smart default by recency + drag-to-reorder)
3. **Quick action row** (Log Mood, Start Fast, etc. -- only for enabled modules)
4. **Weekly digest card** (opt-in summary of cross-module activity)
5. **"This Day Last Year"** (cross-module time capsule)
6. **Module grid** (remaining enabled modules, one tap to navigate)

### Design System Formalization

The Cool Obsidian design system is now documented in `DESIGN.md` at the repo root. Key decisions:

- **Web aesthetic reference:** Linear.app / Raycast / Arc (dark, dense, keyboard-first, command palette)
- **Mobile aesthetic reference:** Native iOS (Apple Health, Music, Wallet)
- **Navigation:** Persistent bottom tab bar (mobile), collapsible sidebar (web), Cmd+K command palette (web)
- **Motion:** 200ms ease-out micro-interactions. No bouncy animations. Respect `prefers-reduced-motion`.
- **Accessibility:** WCAG 2.1 AA contrast, 44px touch targets, keyboard-navigable, ARIA landmarks.

### Pricing Strategy Alternatives

$5/yr remains the default price -- it is the market disruption weapon. For investor due diligence, the following alternatives have been analyzed:

| Strategy | Price | Pros | Cons |
|----------|-------|------|------|
| **$5/yr flat (CHOSEN)** | $5/yr for all 29 modules | Maximum shock value. Impulse purchase. Eliminates deliberation. Massive word-of-mouth. | May signal "toy" to some users. Low per-user revenue. |
| $12-24/yr | $1-2/month equivalent | Still 90%+ cheaper than competitors. More "credible" price point. Higher per-user revenue. | Loses the "$5" headline shock. Slightly more purchase friction. |
| Module clusters | Free + $3/yr per category | Users pay only for what they use. Higher revenue from power users. | Complexity. Decision fatigue. Breaks the "one price for everything" simplicity. |
| Lifetime + annual | $30 lifetime OR $5/yr | Captures high-intent users upfront. Revenue front-loading. | Lifetime purchasers generate $0 after day 1. Forecasting complexity. |

The $5/yr flat model was chosen because the shock value IS the marketing. "29 modules for $5/yr" is a sentence that sells itself. Every alternative reduces the memetic power of that sentence. At 85% contribution margin (Year 2+), the math works at scale without needing higher per-user revenue.

### AI-Accelerated Development Model

A key enabler of the timeline is the use of AI coding agents (Claude Code) for feature development. With structured agent specs and acceptance criteria, features that would take a human team 3-5 days can be built in 30-60 minutes.

**Estimated timeline to full competitive parity (217 features):**
- Scoring all features: 2 hours
- Writing all specs: ~55 hours (parallelizable)
- Building all features: ~167 hours of CC time
- Human QA: ~500-900 hours (the bottleneck)
- Calendar time: ~10-12 weeks with parallel agents

This means full competitive parity across all 29 modules is achievable within the 18-month runway, even accounting for the QA bottleneck.

### Social Data Sharing Philosophy

Social features require data sharing, but the privacy promise constrains how:

1. All sharing is explicit opt-in. Users select WHICH data is shared.
2. All shared data is anonymized before transmission.
3. We will never sell shared data to third parties.
4. Users can delete all their shared data via a button in Settings.
5. Periodic reminders: "You're sharing X data with the community. Want to review?"

---

*MyLife: One app. One database. Zero telemetry. $5/yr.*

*Built with conviction that personal data belongs to the person.*
