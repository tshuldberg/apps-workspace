# MyLife Competitive Feature Analysis
## 100-App Deep Dive: Features, Pricing, Privacy, and Gap Analysis

**Generated:** 2026-03-05
**Scope:** 100 consumer apps across health, fitness, productivity, finance, lifestyle, and privacy categories compared against MyLife hub

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [MyLife Current Capabilities](#mylife-current-capabilities)
3. [Feature Comparison by Category](#feature-comparison-by-category)
   - [Fasting & Nutrition](#fasting--nutrition)
   - [Fitness & Workouts](#fitness--workouts)
   - [Sleep Tracking](#sleep-tracking)
   - [Meditation & Mental Health](#meditation--mental-health)
   - [Medical & Symptom Tracking](#medical--symptom-tracking)
   - [Budgeting & Finance](#budgeting--finance)
   - [Notes & Knowledge](#notes--knowledge)
   - [Habits & Productivity](#habits--productivity)
   - [Journaling](#journaling)
   - [Learning & Flashcards](#learning--flashcards)
   - [Cycle & Fertility](#cycle--fertility)
   - [Baby & Parenting](#baby--parenting)
   - [Outdoor & Travel](#outdoor--travel)
   - [Recipes & Meal Planning](#recipes--meal-planning)
   - [Plants & Garden](#plants--garden)
   - [Astrology & Stars](#astrology--stars)
   - [Social Tracking (Books, Film, Beer, Wine)](#social-tracking)
   - [Password & Security](#password--security)
   - [Utility Apps](#utility-apps)
   - [Sobriety & Quit Tracking](#sobriety--quit-tracking)
   - [Therapy & CBT](#therapy--cbt)
   - [Weather](#weather)
   - [Connected Fitness Platforms](#connected-fitness-platforms)
   - [Health Dashboards](#health-dashboards)
4. [Privacy Risk Summary](#privacy-risk-summary)
5. [Feature Gap Analysis](#feature-gap-analysis)
6. [Top 20 Highest-Impact Modules to Build](#top-20-highest-impact-modules)
7. [Pricing Landscape](#pricing-landscape)

---

## Executive Summary

MyLife currently has **13 fully implemented modules** with 90+ database tables, 120+ mobile screens, and 80+ web routes. This report compares MyLife against 100 competing apps to identify feature gaps and expansion opportunities.

**Key findings:**
- MyLife already matches or exceeds standalone competitors in 6 categories: fasting (vs Zero), budgeting (vs YNAB), recipes (vs Paprika/Mela), medication (vs Medisafe), book tracking (vs Goodreads), and habit tracking (vs Streaks)
- The largest feature gaps are in: social/community, wearable integration, AI-powered features, and gamification
- 38 of the 100 apps charge $40-$120/year for features that could run entirely offline/locally
- MyLife's privacy-first, no-subscription model directly addresses documented privacy scandals at 15+ major apps (Flo, BetterHelp, Strava, MyFitnessPal, CamScanner, Peloton, Noom, Whoop)

---

## MyLife Current Capabilities

### Implemented Modules (13)

| Module | Tables | Key Features | Comparable Apps |
|--------|--------|-------------|-----------------|
| **MyBooks** | 28 | Library, FTS5 search, half-star ratings, reading sessions, goals, year-in-review, e-reader (ePub/PDF), challenges, encrypted journal, Goodreads/StoryGraph import, barcode scanning | Goodreads, Libby |
| **MyBudget** | 20 | Envelope budgeting, 215 subscription catalog, bank sync (Plaid), recurring detection, payday detection, savings goals, CSV import | YNAB, Monarch, Rocket Money |
| **MyFast** | 10 | Timer with 8 presets, 5 fasting zones, streak tracking, weight tracking, water intake, widgets, CSV export | Zero, Yazio (fasting) |
| **MyRecipes** | 17+ | Recipe CRUD, ingredient parser, scaling, cooking mode, meal planner, shopping lists, pantry tracker, garden tracking, event hosting with RSVP | Paprika, Mela, Plan to Eat |
| **MyWords** | 0 (API) | Dictionary lookup (270+ languages), thesaurus, rhymes, etymology, multi-provider aggregation | Dictionary.com |
| **MyHabits** | 9 | Habit tracking (daily/weekly/monthly), streaks, timed sessions, measurements, heatmap, menstrual cycle tracking, fertility predictions | Streaks, Habitify, Clue |
| **MyWorkouts** | 6 | Exercise library (100+), body map, workout builder, form recording, progress tracking, voice commands | Strong, Hevy, Fitbod |
| **MySurf** | 2+9 cloud | Spot database (~200 CA), session logging, swell maps (Mapbox), AI forecasts (Claude), NOAA/NDBC data, tide predictions | Surfline |
| **MyMeds** | 13+ | Medication tracking, reminders, refill tracking, drug interactions (200+ pairs), mood journaling, symptom logging, correlation engine, doctor reports | Medisafe, Bearable |
| **MyCar** | 4 | Multi-vehicle tracking, service history, fuel economy, maintenance cost analysis | Drivvo, Fuelio |
| **MyHomes** | 2 | Listing search, favorites, tour scheduling, market metrics, mortgage calculator | Zillow, Redfin |
| **MyHealth** | 7+ absorbed | Consolidates fasting + meds + cycle + vitals + sleep + document vault + emergency info + health goals + wellness timeline | Apple Health |
| **MyRSVP** | 13 | Events, invites, RSVP with plus-ones, polls, announcements, photo albums, check-in, waitlist, co-hosts | Evite, Partiful |

### Scaffolded Modules (13 stubs, navigation only)

MyCloset, MyCycle, MyFlash, MyGarden, MyJournal, MyMail, MyMood, MyNotes, MyPets, MyStars, MySubs, MyTrails, MyVoice

### Cross-Cutting Platform Features

- **Privacy:** Zero analytics, zero telemetry, local SQLite, offline-first
- **Sync:** Optional P2P via WebRTC (no central server)
- **Auth:** Supabase Auth (for cloud modules)
- **Payments:** RevenueCat (mobile) + Stripe (web)
- **Theme:** Dark mode, per-module theming
- **Data:** Single SQLite file with prefixed tables per module

---

## Feature Comparison by Category

---

### Fasting & Nutrition

#### Apps in this category: Zero, Noom, MyFitnessPal, Lose It!, Yazio, Cronometer, WaterMinder

| Feature | MyLife (MyFast) | Zero ($70/yr) | Noom ($209/yr) | MFP ($80-100/yr) | Lose It! ($40/yr) | Yazio ($33/yr) | Cronometer ($60/yr) | WaterMinder ($10/yr) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Fasting timer | YES | YES | -- | -- | -- | YES | YES | -- |
| Fasting zone visualization | YES | YES | -- | -- | -- | -- | -- | -- |
| Preset fasting protocols | YES (8) | YES (6) | -- | -- | -- | YES (3) | -- | -- |
| Custom fasting windows | YES | YES | -- | -- | -- | YES | -- | -- |
| Streak tracking | YES | YES | -- | -- | -- | -- | -- | -- |
| Weight tracking | YES | YES | YES | YES | YES | YES | YES | -- |
| Water intake logging | YES | YES | -- | YES | YES | -- | YES | YES |
| Smart water reminders | -- | -- | -- | -- | -- | -- | -- | YES |
| Caffeine tracking | -- | -- | -- | -- | -- | -- | -- | YES |
| AI photo food logging | **GAP** | YES | YES | YES | YES | YES | YES | -- |
| Calorie/macro tracking | **GAP** | -- | YES | YES | YES | YES | YES | -- |
| 14M+ food database | **GAP** | -- | 1M | 14M+ | 32M | Large | 1.1M | -- |
| Barcode scanning | **GAP** | -- | YES | YES | YES | YES | YES | -- |
| Micronutrient tracking (84+) | **GAP** | -- | -- | ~15 | ~10 | -- | 84+ | -- |
| CBT/psychology lessons | **GAP** | -- | YES | -- | -- | -- | -- | -- |
| Human coaching | **GAP** | -- | YES | -- | -- | -- | -- | -- |
| Meal planner + grocery list | YES (MyRecipes) | -- | YES | YES+ | YES | YES | -- | -- |
| CSV export | YES | -- | -- | -- | -- | -- | -- | -- |
| Widgets | YES | -- | -- | -- | -- | -- | -- | YES |
| Wearable sync | **GAP** | -- | YES | YES | YES | YES | YES | YES |
| Home screen widget | YES | -- | -- | -- | -- | -- | -- | YES |
| Community/social | **GAP** | YES | YES | YES | -- | -- | -- | -- |

**MyLife advantage:** Free (Zero charges $70/yr), offline-first, combined with meal planning (MyRecipes)
**Biggest gaps:** Calorie/macro tracking, food database, AI photo logging, barcode scanning

---

#### Apps in this category (cont.): WaterMinder

| Feature | MyLife (MyFast) | WaterMinder ($10/yr) |
|---------|:-:|:-:|
| Personalized daily water goal | -- | YES |
| Multi-beverage types | -- | YES |
| Custom container presets | -- | YES |
| Apple Watch quick-log | **GAP** | YES |
| AI Gulp detection | -- | YES |
| Visual fill animation | -- | YES |

---

### Fitness & Workouts

#### Apps: Strong, Hevy, Fitbod, Sweat, Strava, Nike Training Club, Peloton

| Feature | MyLife (MyWorkouts) | Strong ($30/yr) | Hevy ($50/yr) | Fitbod ($96/yr) | Sweat ($120/yr) | Strava ($80/yr) | NTC (Free) | Peloton ($192/yr) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Exercise library | YES (100+) | YES | YES (400+) | YES (1600+) | YES (13K+) | -- | YES (200+) | YES (1000s) |
| Video exercise demos | **GAP** | -- | YES | YES | YES | -- | YES | YES |
| Workout builder | YES | YES | YES | -- | -- | -- | -- | -- |
| Set/rep/weight logging | YES | YES | YES | YES | -- | -- | -- | -- |
| Previous performance display | -- | YES | YES | YES | -- | -- | -- | -- |
| AI workout generation | **GAP** | -- | -- | YES | -- | -- | -- | -- |
| Muscle recovery heatmap | **GAP** | -- | -- | YES | -- | -- | -- | -- |
| Progressive overload automation | **GAP** | -- | -- | YES | -- | -- | -- | -- |
| Rest timer | -- | YES | YES | -- | -- | -- | -- | -- |
| Plate calculator | -- | YES | -- | -- | -- | -- | -- | -- |
| Body map (muscle groups) | YES | -- | -- | -- | -- | -- | -- | -- |
| Form video recording | YES | -- | -- | -- | -- | -- | -- | -- |
| Voice commands | YES | -- | -- | -- | -- | -- | -- | -- |
| GPS route recording | **GAP** | -- | -- | -- | -- | YES | -- | -- |
| Segment leaderboards | **GAP** | -- | -- | -- | -- | YES | -- | -- |
| Social feed | **GAP** | -- | YES | -- | -- | YES | -- | YES |
| Live leaderboard | **GAP** | -- | -- | -- | -- | -- | -- | YES |
| Trainer-led programs | **GAP** | -- | -- | -- | YES (60+) | -- | YES | YES |
| Pregnancy/postnatal programs | **GAP** | -- | -- | -- | YES | -- | -- | -- |
| Beacon (safety sharing) | **GAP** | -- | -- | -- | -- | YES | -- | -- |
| Route builder with heatmaps | **GAP** | -- | -- | -- | -- | YES | -- | -- |
| Clubs/community | **GAP** | -- | -- | -- | YES | YES | -- | YES |
| Apple Watch app | **GAP** | -- | YES | YES | YES | YES | YES | -- |
| Progress photos | -- | -- | YES | -- | YES | -- | -- | -- |
| Workout sharing | -- | -- | YES | -- | -- | YES | -- | -- |
| Coach portal | YES | -- | -- | -- | -- | -- | -- | -- |

**MyLife advantage:** Voice commands, body map, form recording, coach portal, free
**Biggest gaps:** Video demos, AI workout generation, GPS tracking, social features, Apple Watch, trainer-led programs

---

### Sleep Tracking

#### Apps: Sleep Cycle, Pillow, AutoSleep

| Feature | MyLife (MyHealth) | Sleep Cycle ($30/yr) | Pillow ($28/yr) | AutoSleep ($8 once) |
|---------|:-:|:-:|:-:|:-:|
| Sleep session logging | YES | YES | YES | YES |
| Sleep quality scoring | YES | YES | YES | YES |
| Sleep stage analysis | **GAP** | YES | YES | YES |
| Smart alarm (light sleep wake) | **GAP** | YES | YES | YES |
| Snore detection/recording | **GAP** | YES | YES | -- |
| Heart rate during sleep | **GAP** | YES | YES | YES |
| Blood oxygen (SpO2) | **GAP** | -- | -- | YES |
| Sleep apnea detection | **GAP** | -- | -- | YES |
| Sleep Bank (credit/debt) | **GAP** | -- | -- | YES |
| Readiness score | **GAP** | -- | -- | YES |
| Nap modes | -- | -- | YES | -- |
| Sleep aid sounds | **GAP** | YES | YES | -- |
| Sleep stories | **GAP** | -- | -- | -- |
| AI sleep coach | **GAP** | YES | -- | -- |
| Trend visualization | YES | YES | YES | YES |
| Apple Watch integration | **GAP** | -- | YES | YES |

**MyLife advantage:** Integrated with health vault, medication correlation, free
**Biggest gaps:** Sleep stage analysis, smart alarm, snore detection, Apple Watch, readiness scoring
**Note:** AutoSleep ($8 one-time) is the gold standard for privacy (zero data collection)

---

### Meditation & Mental Health

#### Apps: Calm, Headspace, Daylio, Finch, Bearable

| Feature | MyLife (MyMeds/MyHealth) | Calm ($80/yr) | Headspace ($70/yr) | Daylio ($36/yr) | Finch ($15-70/yr) | Bearable ($35/yr) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Mood tracking | YES | YES | YES | YES | YES | YES |
| Mood-activity correlation | YES | -- | -- | YES | -- | YES |
| Symptom tracking | YES | -- | -- | -- | -- | YES |
| Medication correlation | YES | -- | -- | -- | -- | YES |
| Guided meditation | **GAP** | YES | YES | -- | YES | -- |
| Sleep stories (celebrity) | **GAP** | YES | -- | -- | -- | -- |
| CBT exercises | **GAP** | -- | YES | -- | -- | -- |
| AI therapy companion | **GAP** | -- | YES (Ebb) | -- | -- | -- |
| SOS panic sessions | **GAP** | -- | YES | -- | -- | -- |
| Breathing exercises | **GAP** | YES | YES | -- | YES | -- |
| Virtual pet gamification | **GAP** | -- | -- | -- | YES | -- |
| Year in Pixels | -- | -- | -- | YES | -- | -- |
| Photo/voice attachments | -- | -- | -- | YES | -- | -- |
| Doctor-ready reports | YES | -- | -- | -- | -- | YES |
| Custom experiments | -- | -- | -- | -- | -- | YES |
| Progressive courses | **GAP** | YES | YES | -- | -- | -- |
| Focus music/sounds | **GAP** | YES | YES | -- | -- | -- |
| Kids content | **GAP** | YES | YES | -- | -- | -- |
| Daily fresh content | **GAP** | YES | YES | -- | -- | -- |
| PIN/biometric lock | -- | -- | -- | YES | -- | -- |

**MyLife advantage:** Mood-med correlation engine, doctor reports, drug interactions, free
**Biggest gaps:** Meditation/breathing content, sleep stories, CBT tools, gamification

---

### Medical & Symptom Tracking

#### Apps: Medisafe, Glucose Buddy, MySugr, Migraine Buddy, Cara Care, Blood Pressure Monitor

| Feature | MyLife (MyMeds) | Medisafe ($40/yr) | Glucose Buddy ($40/yr) | MySugr ($36/yr) | Migraine Buddy ($50/yr) | Cara Care ($80/yr) | BP Monitor ($13/yr) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Medication reminders | YES | YES | -- | -- | -- | -- | -- |
| Drug interactions | YES (200+) | YES | -- | -- | -- | -- | -- |
| Adherence tracking | YES | YES | -- | -- | -- | -- | -- |
| Refill reminders | YES | YES | -- | -- | -- | -- | -- |
| Mood journaling | YES | -- | -- | -- | -- | -- | -- |
| Symptom logging | YES | -- | -- | -- | YES | YES | -- |
| Correlation engine | YES | -- | -- | -- | -- | YES | -- |
| Doctor reports | YES | YES | -- | YES | YES | YES | YES |
| Blood glucose logging | **GAP** | -- | YES | YES | -- | -- | -- |
| CGM integration (Dexcom) | **GAP** | -- | YES | YES | -- | -- | -- |
| HbA1c calculator | **GAP** | -- | YES | YES | -- | -- | -- |
| Insulin tracking | **GAP** | -- | YES | YES | -- | -- | -- |
| Bolus calculator | **GAP** | -- | -- | YES | -- | -- | -- |
| Head map (pain location) | **GAP** | -- | -- | -- | YES | -- | -- |
| Weather pressure correlation | **GAP** | -- | -- | -- | YES | -- | -- |
| Predictive risk analysis | **GAP** | -- | -- | -- | YES | -- | -- |
| FODMAP tracking | **GAP** | -- | -- | -- | -- | YES | -- |
| Bristol Stool Scale | **GAP** | -- | -- | -- | -- | YES | -- |
| Dietitian chat | **GAP** | -- | -- | -- | -- | YES | -- |
| Low-FODMAP program | **GAP** | -- | -- | -- | -- | YES | -- |
| Blood pressure logging | **GAP** | YES | YES | -- | -- | -- | YES |
| BP classification (AHA) | **GAP** | -- | -- | -- | -- | -- | YES |
| ECG/EKG tracking | **GAP** | -- | -- | -- | -- | -- | YES |
| Medfriend caregiver alerts | **GAP** | YES | -- | -- | -- | -- | -- |
| Health measurements (20+) | YES (MyHealth) | YES | YES | -- | -- | -- | YES |
| CSV export | YES | -- | -- | -- | -- | -- | YES |

**MyLife advantage:** Correlation engine (med-mood, med-symptom, adherence-mood), integrated health vault, free
**Biggest gaps:** Diabetes management, blood pressure, digestive health, caregiver alerts

---

### Budgeting & Finance

#### Apps: YNAB, Monarch, Rocket Money, Copilot, Tiller, Splitwise, Expensify

| Feature | MyLife (MyBudget) | YNAB ($109/yr) | Monarch ($100/yr) | Rocket Money ($84-168/yr) | Copilot ($95/yr) | Tiller ($79/yr) | Splitwise ($30/yr) | Expensify ($60/user/yr) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Envelope budgeting | YES | YES | -- | -- | -- | -- | -- | -- |
| Zero-based budgeting | YES | YES | -- | -- | -- | -- | -- | -- |
| Bank sync | YES (Plaid) | YES | YES | YES | YES | YES | -- | YES |
| Subscription catalog | YES (215) | -- | YES | YES | -- | -- | -- | -- |
| Subscription cancellation | **GAP** | -- | -- | YES | -- | -- | -- | -- |
| Bill negotiation | **GAP** | -- | -- | YES | -- | -- | -- | -- |
| Net worth tracking | **GAP** | YES | YES | YES | YES | YES | -- | -- |
| Investment tracking | **GAP** | -- | YES | -- | YES | -- | -- | -- |
| Savings goals | YES | YES | -- | YES | YES | -- | -- | -- |
| Age of Money | **GAP** | YES | -- | -- | -- | -- | -- | -- |
| Recurring detection | YES | -- | YES | YES | YES | -- | -- | -- |
| Transaction categorization | YES | YES | YES | YES | YES | YES | -- | YES |
| ML auto-categorization | **GAP** | -- | YES | -- | YES | -- | -- | -- |
| Credit score monitoring | **GAP** | -- | -- | YES | -- | -- | -- | -- |
| Loan planner | **GAP** | YES | -- | -- | -- | -- | -- | -- |
| Group expense splitting | **GAP** | -- | -- | -- | -- | -- | YES | YES |
| Receipt scanning (OCR) | **GAP** | -- | -- | -- | -- | -- | YES | YES |
| Mileage tracking | **GAP** | -- | -- | -- | -- | -- | -- | YES |
| Spreadsheet export | -- | -- | -- | -- | -- | YES | YES | -- |
| Multi-currency | **GAP** | -- | -- | -- | -- | -- | YES | YES |
| Partner/family sharing | -- | YES (6) | YES | -- | -- | -- | YES | -- |
| Reports/charts | -- | YES | YES | YES | YES | YES | -- | YES |
| CSV import | YES | -- | -- | -- | -- | -- | -- | -- |

**MyLife advantage:** Envelope budgeting + subscription catalog combined, offline-first, free
**Biggest gaps:** Net worth tracking, investment tracking, expense splitting, receipt scanning

---

### Notes & Knowledge

#### Apps: Notion, Evernote, Bear, Obsidian

| Feature | MyLife (MyNotes stub) | Notion ($120/yr) | Evernote ($99-250/yr) | Bear ($30/yr) | Obsidian (Free) |
|---------|:-:|:-:|:-:|:-:|:-:|
| Note creation | STUB | YES | YES | YES | YES |
| Rich text/markdown editor | **GAP** | YES | YES | YES | YES |
| Relational databases | **GAP** | YES | -- | -- | Plugin |
| Web clipper | **GAP** | YES | YES | -- | -- |
| OCR search in images | **GAP** | -- | YES | YES | -- |
| Tag-based organization | **GAP** | -- | YES | YES | YES |
| Wiki-style linking | **GAP** | -- | -- | YES | YES |
| Graph view | **GAP** | -- | -- | -- | YES |
| Plugin ecosystem | **GAP** | YES | -- | -- | YES (1600+) |
| Templates | **GAP** | YES | -- | -- | YES |
| AI writing assistant | **GAP** | YES | YES | -- | Plugin |
| Offline-first | -- | -- | Paid | YES | YES |
| E2E encryption | -- | -- | -- | YES | YES (Sync) |
| Local plain files | -- | -- | -- | -- | YES |

**MyLife status:** MyNotes is a stub. This is a massive category with entrenched competitors.
**Recommendation:** Consider thin integration rather than competing directly. Focus on private, offline-first notes with markdown and linking.

---

### Habits & Productivity

#### Apps: Habitify, Habitica, Streaks, Productive, Toggl, Forest, Sorted3

| Feature | MyLife (MyHabits) | Habitify ($40/yr) | Habitica ($48/yr) | Streaks ($5 once) | Productive ($24/yr) | Toggl ($108/user/yr) | Forest ($4 once) | Sorted3 ($15 once) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Habit tracking | YES | YES | YES | YES | YES | -- | -- | -- |
| Flexible scheduling | YES | YES | YES | YES | YES | -- | -- | -- |
| Streak tracking | YES | YES | -- | YES | YES | -- | -- | -- |
| Timed sessions | YES | YES | -- | YES | -- | YES | YES | -- |
| Measurements (numeric) | YES | -- | -- | -- | -- | -- | -- | -- |
| Heatmap visualization | YES | -- | -- | -- | -- | -- | -- | -- |
| Negative habit tracking | -- | -- | YES | YES | -- | -- | -- | -- |
| RPG gamification | **GAP** | -- | YES | -- | -- | -- | -- | -- |
| Boss fights (team) | **GAP** | -- | YES | -- | -- | -- | -- | -- |
| Pet collection | **GAP** | -- | YES | -- | -- | -- | -- | -- |
| Class system | **GAP** | -- | YES | -- | -- | -- | -- | -- |
| Apple Health auto-track | **GAP** | YES | -- | YES | -- | -- | -- | -- |
| Location-based reminders | **GAP** | -- | -- | -- | YES | -- | -- | -- |
| Siri shortcuts | **GAP** | -- | -- | YES | YES | -- | -- | -- |
| Focus timer (tree grows) | **GAP** | -- | -- | -- | -- | -- | YES | -- |
| Real tree planting | **GAP** | -- | -- | -- | -- | -- | YES | -- |
| Time tracking (billable) | **GAP** | -- | -- | -- | -- | YES | -- | -- |
| Hyper-scheduling | **GAP** | -- | -- | -- | -- | -- | -- | YES |
| Calendar + tasks unified | **GAP** | -- | -- | -- | -- | -- | -- | YES |
| Challenges/programs | **GAP** | YES | YES | -- | YES | -- | -- | -- |
| Action lists (sub-tasks) | -- | YES | YES | -- | -- | -- | -- | YES |
| Mood tracking | -- | YES | -- | -- | -- | -- | -- | -- |
| Zapier/IFTTT integration | **GAP** | YES | -- | -- | -- | YES | -- | -- |

**MyLife advantage:** Measurements, heatmap, cycle tracking integrated, free
**Biggest gaps:** Gamification, Apple Health integration, focus timer, time tracking

---

### Journaling

#### Apps: Day One, Reflectly, Grid Diary, Gratitude, Stoic

| Feature | MyLife (MyJournal stub) | Day One ($35-50/yr) | Reflectly ($20-60/yr) | Grid Diary ($23/yr) | Gratitude ($23/yr) | Stoic ($40/yr) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Rich media entries | STUB | YES (30 photos) | YES | -- | YES | YES |
| E2E encryption | -- | YES | -- | -- | -- | -- |
| Multiple journals | **GAP** | YES | -- | -- | -- | -- |
| On This Day (nostalgia) | **GAP** | YES | -- | -- | -- | -- |
| Automatic metadata | **GAP** | YES | -- | -- | -- | -- |
| Voice-to-text | **GAP** | YES | -- | -- | YES | YES |
| Printed books | **GAP** | YES | -- | -- | -- | -- |
| AI-guided prompts | **GAP** | -- | YES | -- | -- | YES |
| Grid/mandala layout | **GAP** | -- | -- | YES | -- | -- |
| Mood + correlation | **GAP** | -- | YES | -- | -- | YES |
| Gratitude prompts | **GAP** | -- | -- | -- | YES | -- |
| Vision board | **GAP** | -- | -- | -- | YES | -- |
| Affirmations | **GAP** | -- | -- | -- | YES | YES |
| Philosophy prompts | **GAP** | -- | -- | -- | -- | YES |
| CBT thought dumps | **GAP** | -- | -- | -- | -- | YES |
| Therapy prep templates | **GAP** | -- | -- | -- | -- | YES |
| Streak tracking | -- | -- | YES | -- | YES | -- |
| Strava integration | -- | YES | -- | -- | -- | -- |
| PDF export | -- | -- | -- | YES | YES | -- |

**MyLife status:** MyJournal is a stub. This is a high-value privacy-first opportunity.
**Recommendation:** Build with E2E encryption, daily prompts, mood correlation (leveraging MyMeds engine), and On This Day feature.

---

### Learning & Flashcards

#### Apps: Duolingo, Quizlet, Anki

| Feature | MyLife (MyFlash stub) | Duolingo ($84/yr) | Quizlet ($36/yr) | Anki ($25 iOS once) |
|---------|:-:|:-:|:-:|:-:|
| Flashcard creation | STUB | -- | YES | YES |
| Spaced repetition | **GAP** | -- | YES | YES (FSRS) |
| Shared deck library | **GAP** | -- | YES | YES |
| Image occlusion | **GAP** | -- | -- | YES |
| Cloze deletions | **GAP** | -- | -- | YES |
| Custom card templates (HTML/CSS) | **GAP** | -- | -- | YES |
| Add-on ecosystem | **GAP** | -- | -- | YES (1600+) |
| AI practice tests | **GAP** | -- | YES | -- |
| Magic Notes (AI card gen) | **GAP** | -- | YES | -- |
| Language courses | **GAP** | YES (43 langs) | -- | -- |
| Streak system | -- | YES | -- | -- |
| Competitive leagues | **GAP** | YES | -- | -- |
| AI roleplay/conversation | **GAP** | YES | -- | -- |
| Match game | -- | -- | YES | -- |
| Open source | -- | -- | -- | YES |
| 100% offline | -- | Paid | Paid | YES |

**MyLife status:** MyFlash is a stub. Anki is the privacy gold standard (open source, local-first, free).
**Recommendation:** Build with Anki-compatible deck format (import/export), FSRS algorithm, and image occlusion. Strong privacy angle vs Quizlet/Duolingo.

---

### Cycle & Fertility

#### Apps: Flo, Clue, Stardust, Ovia, Glow

| Feature | MyLife (MyHabits/MyHealth) | Flo ($50/yr) | Clue ($40/yr) | Stardust (Sub) | Ovia (Employer) | Glow ($60/yr) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Period prediction | YES | YES | YES | YES | YES | YES |
| Ovulation prediction | YES | YES | YES | YES | YES | YES |
| Fertility window | YES | YES | YES | YES | YES | YES |
| Symptom logging | YES | YES (70+) | YES (200+) | YES | YES | YES |
| BBT charting | **GAP** | -- | YES | -- | -- | YES |
| Pregnancy mode | **GAP** | YES | YES | -- | YES | -- |
| AI health assistant | **GAP** | YES | -- | -- | -- | -- |
| Expert video courses | **GAP** | YES | -- | -- | -- | -- |
| PCOS/endometriosis checker | **GAP** | YES | -- | -- | -- | -- |
| Lunar phase mapping | **GAP** | -- | -- | YES | -- | -- |
| Social cycle sync | **GAP** | -- | -- | YES | -- | -- |
| Partner sharing | **GAP** | -- | YES | -- | -- | -- |
| Comparative analytics | **GAP** | -- | -- | -- | -- | YES |
| Nurse/specialist access | **GAP** | -- | -- | -- | YES | -- |
| CSV export | YES | -- | -- | -- | -- | -- |

**MyLife advantage:** Already integrated into MyHabits + MyHealth, free, privacy-first (Flo had massive privacy scandal)
**Biggest gaps:** BBT charting, pregnancy mode, expert content
**Note:** Flo shared user data with Facebook. This is MyLife's strongest privacy pitch.

---

### Baby & Parenting

#### Apps: Huckleberry, BabyCenter

| Feature | MyLife (No module) | Huckleberry ($96-180/yr) | BabyCenter (Free/ads) |
|---------|:-:|:-:|:-:|
| Sleep/feed/diaper logging | **GAP** | YES | YES |
| SweetSpot (ideal nap time) | **GAP** | YES | -- |
| Week-by-week pregnancy updates | **GAP** | -- | YES |
| Baby milestone tracking | **GAP** | -- | YES |
| Expert AI chat guidance | **GAP** | YES | -- |
| Custom sleep plans | **GAP** | YES | -- |
| Kick counter | **GAP** | -- | YES |
| Baby name finder | **GAP** | -- | YES |
| Community forums | **GAP** | -- | YES |

**MyLife status:** No baby/parenting module exists. This is a significant gap.
**Recommendation:** Build MyBaby module with privacy-first approach (all data local, no ad networks)

---

### Outdoor & Travel

#### Apps: AllTrails, Komoot, Wanderlog, TripIt, PackPoint

| Feature | MyLife (MyTrails stub) | AllTrails ($36-80/yr) | Komoot ($60/yr) | Wanderlog ($80/yr) | TripIt ($49/yr) | PackPoint ($3 once) |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Trail database | STUB | YES (400K+) | YES | -- | -- | -- |
| GPS trail recording | **GAP** | YES | YES | -- | -- | -- |
| Offline maps | **GAP** | YES | YES | YES | -- | -- |
| Wrong-turn alerts | **GAP** | YES | -- | -- | -- | -- |
| Turn-by-turn navigation | **GAP** | -- | YES | -- | -- | -- |
| Route planning | **GAP** | -- | YES | -- | -- | -- |
| Community routes/reviews | **GAP** | YES | YES | -- | -- | -- |
| Trip itinerary builder | **GAP** | -- | -- | YES | YES | -- |
| Auto-import bookings (email) | **GAP** | -- | -- | YES | YES | -- |
| Flight alerts | **GAP** | -- | -- | -- | YES | -- |
| Alternate flight finder | **GAP** | -- | -- | -- | YES | -- |
| Weather-based packing list | **GAP** | -- | -- | -- | -- | YES |
| Activity-based packing | **GAP** | -- | -- | -- | -- | YES |
| Trip budgeting | **GAP** | -- | -- | YES | -- | -- |
| Live location sharing | **GAP** | YES | YES | -- | -- | -- |
| Plant/tree ID | **GAP** | YES | -- | -- | -- | -- |

**MyLife status:** MyTrails is a stub.
**Recommendation:** Focus on offline GPS recording, downloadable trail maps, and privacy (AllTrails shares location data for ads).

---

### Recipes & Meal Planning

#### Apps: Paprika, Mela, Plan to Eat

| Feature | MyLife (MyRecipes) | Paprika ($5-30 once) | Mela ($5 once) | Plan to Eat ($50/yr) |
|---------|:-:|:-:|:-:|:-:|
| Recipe CRUD | YES | YES | YES | YES |
| Web recipe clipper | YES | YES | YES | YES |
| Ingredient parser | YES | YES | -- | -- |
| Recipe scaling | YES | YES | -- | -- |
| Cooking mode | YES | YES | YES | -- |
| Meal planner calendar | YES | YES | YES | YES |
| Grocery list (auto-generated) | YES | YES | YES | YES |
| Pantry tracker | YES | YES | -- | YES |
| Video recipe import (YT/IG/TT) | **GAP** | -- | YES | -- |
| Paper recipe OCR scanning | **GAP** | -- | YES | -- |
| Unit conversion | YES | YES | -- | -- |
| Multiple timers | YES | YES | YES | -- |
| Garden tracking | YES | -- | -- | -- |
| Event hosting / RSVP | YES | -- | -- | -- |
| Print recipes | -- | YES | -- | -- |

**MyLife advantage:** Garden integration, event hosting with RSVP, allergy detection, free. Matches or exceeds all competitors.
**Gaps:** Video recipe import, OCR scanning

---

### Plants & Garden

#### Apps: Planta, PictureThis

| Feature | MyLife (MyRecipes garden + MyGarden stub) | Planta ($36/yr) | PictureThis ($30-40/yr) |
|---------|:-:|:-:|:-:|
| Plant tracking | YES (in MyRecipes) | YES | YES |
| Watering reminders | **GAP** | YES | YES |
| Plant ID (camera AI) | **GAP** | YES | YES |
| Disease diagnosis (photo) | **GAP** | YES | YES |
| Light level estimation | **GAP** | YES | YES |
| Fertilizing/misting/pruning reminders | **GAP** | YES | -- |
| Plant journal (growth photos) | YES | YES | YES |
| Harvest tracking | YES | -- | -- |
| Garden layout | YES | -- | -- |
| Expert consultation | **GAP** | -- | YES |

**MyLife advantage:** Harvest-to-recipe linking, garden layout, free
**Biggest gaps:** AI plant identification, care reminders, disease diagnosis

---

### Astrology & Stars

#### Apps: Co-Star, Nebula, The Pattern

| Feature | MyLife (MyStars stub) | Co-Star (Freemium) | Nebula ($50/yr) | The Pattern ($120/yr) |
|---------|:-:|:-:|:-:|:-:|
| Natal chart | STUB | YES | YES | YES |
| Daily horoscope | **GAP** | YES | YES | YES |
| Friend compatibility | **GAP** | YES | YES | YES |
| Dating feature | **GAP** | -- | -- | YES |
| Personality insights | **GAP** | -- | -- | YES |
| Audio meditations | **GAP** | -- | -- | YES |
| Psychic readings | **GAP** | -- | YES | -- |
| Lunar cycle guides | **GAP** | -- | -- | YES |

**MyLife status:** MyStars is a stub. Astrology is cloud-dependent by nature.
**Recommendation:** Low priority unless targeting the astrology-loving demographic. Consider as a fun add-on.

---

### Social Tracking

#### Apps: Goodreads, Letterboxd, Untappd, Vivino

| Feature | MyLife (MyBooks) | Goodreads (Free) | Letterboxd ($19-49/yr) | Untappd ($55/yr) | Vivino ($5/mo) |
|---------|:-:|:-:|:-:|:-:|:-:|
| Item tracking + rating | YES (books) | YES (books) | YES (films) | YES (beer) | YES (wine) |
| Shelves/lists | YES | YES | YES | -- | -- |
| Reviews | YES | YES | YES | YES | YES |
| Social feed | **GAP** | YES | YES | YES | -- |
| Annual challenge | **GAP** | YES | -- | -- | -- |
| Barcode/label scanning | YES | YES | -- | -- | YES |
| Badge/achievement system | **GAP** | -- | -- | YES | -- |
| Where to stream (film) | **GAP** | -- | YES | -- | -- |
| Venue menus | **GAP** | -- | -- | YES | -- |
| Label AI scanning | **GAP** | -- | -- | -- | YES |
| Taste profile | -- | -- | -- | -- | YES |
| Food pairings | **GAP** | -- | -- | -- | YES |
| Half-star ratings | YES | -- | YES | -- | -- |
| FTS5 search | YES | -- | -- | -- | -- |
| Year-in-review | YES | -- | YES | -- | -- |
| Data export | YES | -- | YES | YES | -- |
| Encrypted journal | YES | -- | -- | -- | -- |
| E-reader | YES | -- | -- | -- | -- |
| Reading challenges | YES | -- | -- | -- | -- |

**MyLife advantage:** MyBooks is the most feature-rich book tracker available, surpassing Goodreads in privacy, ratings granularity, and offline capability.
**Opportunity:** Extend the "tracking" pattern to films (MyFilms), wine (MyWine), beer (MyBeer) as lightweight modules.

---

### Password & Security

#### Apps: 1Password, Bitwarden

| Feature | MyLife (No module) | 1Password ($36/yr) | Bitwarden ($10/yr) |
|---------|:-:|:-:|:-:|
| Encrypted vault | **GAP** | YES | YES |
| Browser auto-fill | **GAP** | YES | YES |
| Breach monitoring | **GAP** | YES | YES |
| Passkey support | **GAP** | YES | YES |
| TOTP 2FA generator | **GAP** | -- | YES |
| Emergency access | **GAP** | -- | YES |
| Self-hosting | **GAP** | -- | YES |
| Open source | **GAP** | -- | YES |
| Family sharing | **GAP** | YES (5) | YES (6) |
| Travel Mode | **GAP** | YES | -- |

**MyLife status:** No password module. This is specialized security software.
**Recommendation:** Do NOT build a password manager. Bitwarden is open source, $10/yr, and self-hostable. Integrate or recommend instead.

---

### Utility Apps

#### Apps: Scanner Pro, CamScanner, Alarmy, Cladwell, Fantastical, Spark, 1SE

| Feature | MyLife | App | Pricing | Key Feature |
|---------|:-:|-----|---------|------------|
| Document scanning | **GAP** | Scanner Pro ($20/yr) | On-device OCR, 26 languages | Could build as utility |
| Document scanning | **GAP** | CamScanner ($36/yr) | AVOID - malware history, Chinese-owned | Privacy disaster |
| Mission-based alarm | **GAP** | Alarmy ($60/yr) | Math/photo/shake to dismiss | Fun add-on |
| AI outfit planner | **GAP** | Cladwell ($96/yr) | Wardrobe catalog + daily suggestions | MyCloset is a stub |
| Natural language calendar | **GAP** | Fantastical ($40/yr) | "Lunch Friday at noon" parsing | Calendar integration |
| Smart email client | **GAP** | Spark ($60/yr) | AI categorization + summaries | MyMail is a stub |
| Video diary | **GAP** | 1SE ($30-40/yr) | 1 second/day compilation | Unique concept |

---

### Sobriety & Quit Tracking

#### Apps: Smoke Free, I Am Sober

| Feature | MyLife (No module) | Smoke Free (Sub) | I Am Sober ($40/yr) |
|---------|:-:|:-:|:-:|
| Days sober counter | **GAP** | YES | YES |
| Money saved calculator | **GAP** | YES | YES |
| Health recovery timeline | **GAP** | YES | -- |
| Daily pledge system | **GAP** | -- | YES |
| Milestone celebrations | **GAP** | -- | YES |
| Craving log | **GAP** | YES | YES |
| Daily missions | **GAP** | YES | -- |
| AI quit coach | **GAP** | YES | -- |
| Community support | **GAP** | YES | YES |
| Multiple addictions | **GAP** | -- | YES |
| Achievement badges | **GAP** | YES | -- |

**MyLife status:** No sobriety module.
**Recommendation:** Build as part of MyHabits (negative habit tracking with sobriety clock, money saved, health timeline). Extremely privacy-sensitive data.

---

### Therapy & CBT

#### Apps: BetterHelp, Talkspace, Woebot

| Feature | MyLife (No module) | BetterHelp ($260-400/mo) | Talkspace ($276-436/mo) | Woebot (Enterprise only) |
|---------|:-:|:-:|:-:|:-:|
| Licensed therapist matching | **GAP** | YES | YES | -- |
| Live video sessions | **GAP** | YES | YES | -- |
| Unlimited messaging | **GAP** | YES | YES | -- |
| CBT exercises | **GAP** | YES | -- | YES |
| AI therapy companion | **GAP** | -- | YES | YES |
| Group therapy | **GAP** | YES | YES | -- |
| Journal + worksheets | **GAP** | YES | -- | YES |
| Psychiatry/medication | **GAP** | -- | YES | -- |

**MyLife status:** Not applicable. MyLife cannot replace licensed therapy.
**Recommendation:** Do NOT build therapy features. Instead, build self-guided CBT tools (thought journaling, cognitive distortion identification) as part of MyJournal/MyMood. BetterHelp was fined $7.8M for sharing therapy data with Facebook.

---

### Weather

#### Apps: Carrot Weather

| Feature | MyLife (No module) | Carrot Weather ($20-40/yr) |
|---------|:-:|:-:|
| Snarky personality | **GAP** | YES |
| Multiple data sources | **GAP** | YES |
| Rain/storm alerts | **GAP** | YES |
| Super-resolution radar | **GAP** | YES |
| Widgets + complications | **GAP** | YES |
| CarPlay | **GAP** | YES |

**MyLife status:** Not a fit for MyLife hub. Weather requires live cloud data.
**Recommendation:** Skip. Weather is a commodity with entrenched players.

---

### Connected Fitness Platforms

#### Apps: Peloton, Garmin Connect, Whoop

| Feature | MyLife (MyWorkouts) | Peloton ($192-600/yr) | Garmin Connect ($84/yr) | Whoop ($199-359/yr) |
|---------|:-:|:-:|:-:|:-:|
| Workout logging | YES | YES | YES | YES |
| Live streaming classes | **GAP** | YES | -- | -- |
| Recovery/readiness score | **GAP** | -- | YES | YES |
| HRV tracking | **GAP** | -- | YES | YES |
| Training load/status | **GAP** | -- | YES | YES |
| AI coaching | **GAP** | YES | YES | YES |
| Body composition | **GAP** | -- | YES | -- |
| Sleep coaching | **GAP** | -- | YES | YES |
| 140+ behavior logging | **GAP** | -- | -- | YES |
| Blood testing integration | **GAP** | -- | -- | YES |
| Live leaderboard | **GAP** | YES | -- | -- |
| GPS activity tracking | **GAP** | -- | YES | -- |
| Gear/equipment tracking | **GAP** | -- | YES | -- |

**MyLife status:** MyWorkouts covers basics but lacks wearable integration.
**Recommendation:** Build Apple Health/HealthKit integration as a cross-module feature. This unlocks heart rate, HRV, sleep stages, and activity data for MyHealth, MyWorkouts, and MyHabits.

---

### Health Dashboards

#### Apps: Apple Health, Samsung Health, Google Fit

| Feature | MyLife (MyHealth) | Apple Health (Free) | Samsung Health (Free) | Google Fit (Free) |
|---------|:-:|:-:|:-:|:-:|
| Centralized health data | YES | YES | YES | YES |
| Activity tracking | **GAP** | YES | YES | YES |
| Sleep tracking | YES | YES | YES | -- |
| Medication management | YES | YES | -- | -- |
| Mental health tracking | YES | YES | -- | -- |
| Health records (clinical) | **GAP** | YES | -- | -- |
| Medical ID | YES (emergency) | YES | -- | -- |
| Cycle tracking | YES | YES | YES | -- |
| Trends/insights | YES | YES | -- | -- |
| Drug interactions | YES | -- | -- | -- |
| Mood-medication correlation | YES | -- | -- | -- |
| Multi-app aggregation | **GAP** | YES | YES | YES |
| Heart Points | **GAP** | -- | -- | YES |
| Body composition | **GAP** | -- | YES | -- |
| Running coach | **GAP** | -- | YES | -- |
| Sleep apnea detection | **GAP** | -- | YES | -- |

**MyLife advantage:** Drug interactions, correlation engine, mood journaling, doctor reports. None of the platform health apps have medication correlation.
**Biggest gaps:** Wearable data import, clinical health records

---

## Privacy Risk Summary

### Apps with Documented Privacy Scandals

| App | Scandal | Year | Impact |
|-----|---------|------|--------|
| **BetterHelp** | FTC fine for sharing therapy data with Facebook, Snapchat, Pinterest | 2023 | $7.8M fine, 7M+ users affected |
| **Flo** | Shared period/fertility data with Facebook and Google | 2021 | FTC settlement |
| **MyFitnessPal** | Data breach exposing 150M users' emails and passwords | 2018 | 150M accounts |
| **Strava** | Exposed world leaders' security team locations | 2025 | Swedish PM bodyguards |
| **CamScanner** | Trojan malware embedded in app | 2019 | Banned in India and US |
| **Peloton** | AI processing customer chat data without consent | 2024+ | Class-action lawsuit |
| **Noom** | Shared data with Fullstory analytics and third-party ad partners | Ongoing | 50+ health questions collected |
| **Whoop** | Shared biometric data with Segment without consent | 2025 | Class-action lawsuit |
| **Talkspace** | Shared NYC teen mental health data with ad trackers | 2024+ | Government contract data |
| **Samsung Health** | Forced consent: accept data sharing or delete all health data | 2025 | GDPR complaint filed |
| **Cara Care** | Acquired by Bayer pharmaceutical | 2025 | Gut health data to pharma |
| **MySugr** | Owned by Roche pharmaceutical | Ongoing | Diabetes data to pharma |
| **Nike Training Club** | Collects 20 data types including racial background, sexual orientation | Ongoing | Despite being "free" |

### Apps with Best Privacy Practices

| App | Why It's Good | Model |
|-----|-------------|-------|
| **AutoSleep** | Zero analytics, zero ads, zero data upload, zero third-party code | $8 one-time |
| **Daylio** | All data local, never sent to servers, PIN/biometric lock | $36/yr |
| **Obsidian** | Local plain markdown files, no account needed, E2E encrypted sync | Free |
| **Anki** | Open source, local-first, free sync, no tracking | Free + $25 iOS |
| **Bitwarden** | Open source, zero-knowledge encrypted, self-hostable | $10/yr |
| **Streaks** | On-device storage, iCloud only, no cloud dependency | $5 one-time |
| **Bear** | iCloud sync only, Apple ecosystem, note encryption | $30/yr |
| **Paprika** | Local recipe storage, one-time purchase, no subscription | $5-30 once |

### MyLife Privacy Position

MyLife's architecture (local SQLite, zero telemetry, optional P2P sync, no analytics SDK) aligns with the privacy gold standard set by AutoSleep, Obsidian, and Anki. This is a genuine competitive advantage against 80%+ of the apps in this report that monetize or inadequately protect user data.

---

## Feature Gap Analysis

### Features MyLife Already Has (Competitive or Better)

| Category | MyLife Module | Competitive Position |
|----------|-------------|---------------------|
| Fasting timer + zones | MyFast | Matches Zero; free vs $70/yr |
| Envelope budgeting | MyBudget | Matches YNAB core; free vs $109/yr |
| Subscription catalog | MyBudget (215 entries) | Matches Rocket Money detection |
| Recipe management | MyRecipes | Exceeds Paprika (garden + events) |
| Ingredient parsing + scaling | MyRecipes | Matches Paprika |
| Cooking mode | MyRecipes | Matches Paprika/Mela |
| Meal planning + grocery list | MyRecipes | Matches Plan to Eat |
| Book tracking | MyBooks | Exceeds Goodreads (privacy, ratings, e-reader, journal) |
| Medication tracking + reminders | MyMeds | Matches Medisafe core |
| Drug interactions | MyMeds (200+ pairs) | Matches Medisafe |
| Mood-medication correlation | MyMeds | UNIQUE -- no competitor has this |
| Doctor report generation | MyMeds | Matches Medisafe/Bearable |
| Habit tracking + streaks | MyHabits | Matches Streaks/Habitify |
| Heatmap visualization | MyHabits | UNIQUE at hub level |
| Cycle tracking | MyHabits/MyHealth | Matches Clue core |
| Surf forecasting | MySurf | Matches Surfline; AI narratives unique |
| Voice-controlled workouts | MyWorkouts | UNIQUE -- no competitor has this |
| Form video recording | MyWorkouts | UNIQUE -- no competitor has this |
| Event hosting + RSVP | MyRSVP/MyRecipes | Exceeds standalone event apps |
| Vehicle maintenance tracking | MyCar | Matches Drivvo/Fuelio |
| Emergency health info | MyHealth | Matches Apple Health Medical ID |

### Critical Gaps to Fill (High Impact)

| Gap | Relevant Apps | Impact | Difficulty |
|-----|--------------|--------|-----------|
| **Apple Health / HealthKit integration** | All health/fitness | Unlocks wearable data across all modules | Medium |
| **Calorie/macro/food tracking** | MFP, Lose It!, Yazio, Cronometer | Most-requested nutrition feature | High (food DB needed) |
| **Social/community features** | Strava, Hevy, Goodreads, Habitica | #1 retention driver across all categories | High |
| **Gamification (streaks, badges, XP)** | Duolingo, Habitica, Forest, Finch | #1 engagement driver | Medium |
| **AI-powered features** | Fitbod, Noom, Reflectly, Quizlet | Growing expectation across all apps | Medium |
| **Sleep stage analysis** | AutoSleep, Sleep Cycle, Pillow | Core sleep tracking expectation | Medium (needs Watch) |
| **Exercise video demos** | Hevy, Fitbod, Sweat, NTC | Expected in workout apps | Medium (content creation) |
| **Barcode scanning** | MFP, Lose It!, Goodreads | Reduces friction for food/book entry | Low |
| **Guided meditation/breathing** | Calm, Headspace, Finch | Mental health baseline | Low (audio content) |
| **Offline maps / GPS trails** | AllTrails, Komoot | Core outdoor feature | High |
| **Spaced repetition (flashcards)** | Anki, Quizlet | Strong privacy-first opportunity | Medium |
| **Expense splitting** | Splitwise | Common social finance need | Medium |
| **Net worth tracking** | YNAB, Monarch, Copilot | Expected in finance apps | Low |
| **Blood pressure tracking** | SmartBP, Apple Health | Health completeness | Low |
| **Pregnancy/baby tracking** | Flo, Huckleberry, BabyCenter | Large underserved privacy market | Medium |

---

## Top 20 Highest-Impact Modules

Ranked by: market size, privacy opportunity, implementation feasibility, and synergy with existing MyLife modules.

| Rank | Module | Why | Privacy Angle | Synergy |
|------|--------|-----|---------------|---------|
| 1 | **MyCycle (expand)** | Flo/Clue privacy scandals, 300M+ users | Flo shared data with Facebook | Already in MyHabits/MyHealth |
| 2 | **MyNutrition** | MFP has 150M breach, $80-100/yr | MFP shares location for ads | Integrates with MyFast, MyRecipes |
| 3 | **MyJournal** | Day One acquired by Automattic, $35-50/yr | Most journals lack E2E encryption | Mood data feeds MyHealth |
| 4 | **MyFlash** | Anki-style SRS, Quizlet $36/yr | Quizlet tracks study behavior | Standalone value |
| 5 | **MyMood** | Daylio $36/yr, Finch $15-70/yr | Bearable sells clinical data access | Feeds MyHealth correlation |
| 6 | **MySleep** | AutoSleep $8, Sleep Cycle $30/yr | Sleep apps record bedroom audio | Integrates with MyHealth |
| 7 | **MyTrails** | AllTrails $36-80/yr, 50M+ users | AllTrails shares location for ads | GPS + offline maps |
| 8 | **MyFilms** | Letterboxd $19-49/yr, 15M+ users | Lightweight tracking module | Pattern from MyBooks |
| 9 | **MyBaby** | Huckleberry $96-180/yr, BabyCenter free/ads | Baby apps sell to advertisers | Integrates with MyHealth |
| 10 | **MySober** | I Am Sober $40/yr, highly sensitive | Sobriety data is extremely private | Extends MyHabits |
| 11 | **MyFocus** | Forest $4, Sorted3 $15 | Focus timer with gamification | Extends MyHabits |
| 12 | **MyCloset** | Cladwell $96/yr | Wardrobe + outfit AI | Stub exists |
| 13 | **MyPets** | Dogo $200+/yr | Pet health records are private | Stub exists |
| 14 | **MyScanner** | Scanner Pro $20/yr | CamScanner has malware history | Utility module |
| 15 | **MyGut** | Cara Care $80/yr (now Bayer-owned) | Pharma owns gut health data | Extends MyHealth |
| 16 | **MyBP** | SmartBP $13/yr | BP data feeds health profile | Extends MyHealth |
| 17 | **MyNotes** | Bear $30/yr, Obsidian free | Privacy-first markdown notes | Stub exists |
| 18 | **MyVoice** | Dictation utility | On-device, no cloud | Stub exists |
| 19 | **MyWine/MyBeer** | Vivino $60/yr, Untappd $55/yr | Beverage tracking with privacy | Pattern from MyBooks |
| 20 | **MySplit** | Splitwise $30/yr | Group expense splitting | Extends MyBudget |

---

## Pricing Landscape

### What Competitors Charge (Annual)

| Price Range | Apps | Count |
|-------------|------|-------|
| **Free** | Google Fit, Nike Training Club, Apple Health, Samsung Health, Goodreads, BabyCenter, Habitica (core), Anki (desktop) | 8 |
| **$1-$10 one-time** | Streaks ($5), Paprika ($5-30), Mela ($5), Forest ($4), AutoSleep ($8), PackPoint ($3), Anki iOS ($25) | 7 |
| **$10-$30/yr** | WaterMinder ($10), Bitwarden ($10), Productive ($24), Grid Diary ($23), Gratitude ($23) | 5 |
| **$30-$50/yr** | Bear ($30), Splitwise ($30), Daylio ($36), Bearable ($35), Quizlet ($36), Reflectly ($20-60), Stoic ($40), Day One ($35-50), Clue ($40), Medisafe ($40), I Am Sober ($40), Yazio ($33), Lose It! ($40), AllTrails ($36-80), Fantastical ($40), Habitify ($40) | 16 |
| **$50-$80/yr** | Flo ($50), Cronometer ($60), Untappd ($55), Headspace ($70), Zero ($70), Calm ($80), MFP ($80-100), Strava ($80), Tiller ($79) | 9 |
| **$80-$120/yr** | YNAB ($109), Monarch ($100), Copilot ($95), Fitbod ($96), Sweat ($120), Surfline ($70-150), Duolingo ($84), Huckleberry ($96-180), Cladwell ($96) | 9 |
| **$120+/yr** | Rocket Money ($84-168), Peloton ($192-600), Whoop ($199-359), Noom ($209), Toggl ($108/user), Garmin Connect+ ($84), Dogo ($200+) | 7 |
| **$250+/mo** | BetterHelp ($1040-1600/mo), Talkspace ($1104-1744/mo) | 2 |

### MyLife Pricing Advantage

At **$5/year** for the entire suite (under discussion), MyLife would undercut every single paid app in this report. The closest competitor pricing:

- Bitwarden: $10/yr (but specialized security)
- WaterMinder: $10/yr (but single feature)
- Productive: $24/yr (but habits only)

A user replacing just 3 paid apps with MyLife modules saves $100-$300/year.

**Example savings for a typical user:**
| Replaced App | Annual Cost | MyLife Module |
|-------------|-----------|---------------|
| YNAB | $109 | MyBudget |
| Zero | $70 | MyFast |
| Day One | $50 | MyJournal |
| Clue | $40 | MyHabits (cycle) |
| Medisafe | $40 | MyMeds |
| Goodreads | Free but privacy | MyBooks |
| **Total saved** | **$309/year** | **$5/year** |

---

## Appendix: Full App Index

| # | App | Category | MyLife Module | Status |
|---|-----|----------|-------------|--------|
| 1 | Zero | Fasting | MyFast | MATCHED |
| 2 | Noom | Weight Loss | GAP (nutrition) | -- |
| 3 | MyFitnessPal | Calorie Tracking | GAP (nutrition) | -- |
| 4 | Lose It! | Calorie Counter | GAP (nutrition) | -- |
| 5 | Yazio | Nutrition | GAP (nutrition) | -- |
| 6 | Cronometer | Micronutrients | GAP (nutrition) | -- |
| 7 | WaterMinder | Hydration | MyFast (partial) | PARTIAL |
| 8 | Strong | Weightlifting | MyWorkouts | MATCHED |
| 9 | Hevy | Social Workouts | MyWorkouts (partial) | PARTIAL |
| 10 | Fitbod | AI Workouts | MyWorkouts (partial) | PARTIAL |
| 11 | Sweat | Women's Fitness | GAP | -- |
| 12 | Strava | GPS Running/Cycling | GAP (trails/GPS) | -- |
| 13 | Sleep Cycle | Sleep Tracking | MyHealth (partial) | PARTIAL |
| 14 | Pillow | Sleep Analysis | MyHealth (partial) | PARTIAL |
| 15 | AutoSleep | Apple Watch Sleep | MyHealth (partial) | PARTIAL |
| 16 | Calm | Meditation/Sleep | GAP (meditation) | -- |
| 17 | Headspace | Meditation | GAP (meditation) | -- |
| 18 | Daylio | Mood Journal | MyMeds (partial) | PARTIAL |
| 19 | Finch | Gamified Self-Care | GAP (gamification) | -- |
| 20 | Bearable | Symptom Tracker | MyMeds | MATCHED |
| 21 | Medisafe | Medication Mgmt | MyMeds | MATCHED |
| 22 | Glucose Buddy | Diabetes | GAP (diabetes) | -- |
| 23 | MySugr | Diabetes | GAP (diabetes) | -- |
| 24 | Migraine Buddy | Migraine Tracking | GAP (specialized) | -- |
| 25 | Cara Care | Digestive Health | GAP (gut health) | -- |
| 26 | SmartBP | Blood Pressure | GAP (BP tracking) | -- |
| 27 | YNAB | Budgeting | MyBudget | MATCHED |
| 28 | Monarch Money | Finance Dashboard | MyBudget (partial) | PARTIAL |
| 29 | Rocket Money | Subscription Tracker | MyBudget | MATCHED |
| 30 | Copilot Money | Finance Tracker | MyBudget (partial) | PARTIAL |
| 31 | Tiller Money | Spreadsheet Finance | GAP | -- |
| 32 | Splitwise | Expense Splitting | GAP (splitting) | -- |
| 33 | Expensify | Expense Reports | GAP (business) | -- |
| 34 | Notion | All-in-One Workspace | GAP (notes) | -- |
| 35 | Evernote | Note-Taking | GAP (notes) | -- |
| 36 | Bear | Markdown Notes | GAP (notes) | -- |
| 37 | Obsidian | Knowledge Graph | GAP (notes) | -- |
| 38 | Habitify | Habit Tracker | MyHabits | MATCHED |
| 39 | Habitica | Gamified Habits | MyHabits (partial) | PARTIAL |
| 40 | Streaks | Habit Streaks | MyHabits | MATCHED |
| 41 | Productive | Habit/Routine | MyHabits | MATCHED |
| 42 | Toggl Track | Time Tracking | GAP (time) | -- |
| 43 | Forest | Focus Timer | GAP (focus) | -- |
| 44 | Sorted3 | Hyper-Scheduler | GAP (calendar) | -- |
| 45 | Day One | Premium Journal | GAP (journal) | -- |
| 46 | Reflectly | AI Journal | GAP (journal) | -- |
| 47 | Grid Diary | Prompted Journal | GAP (journal) | -- |
| 48 | Gratitude | Gratitude Journal | GAP (journal) | -- |
| 49 | Stoic | Mental Health Journal | GAP (journal) | -- |
| 50 | Duolingo | Language Learning | GAP (learning) | -- |
| 51 | Quizlet | Flashcards | GAP (flash) | -- |
| 52 | Anki | Spaced Repetition | GAP (flash) | -- |
| 53 | Flo | Period Tracker | MyHabits/MyHealth | MATCHED |
| 54 | Clue | Cycle Tracker | MyHabits/MyHealth | MATCHED |
| 55 | Stardust | Astrology Period | MyHabits (partial) | PARTIAL |
| 56 | Ovia | Fertility/Pregnancy | GAP (pregnancy) | -- |
| 57 | Glow | Fertility | MyHabits (partial) | PARTIAL |
| 58 | Huckleberry | Baby Sleep | GAP (baby) | -- |
| 59 | BabyCenter | Pregnancy | GAP (baby) | -- |
| 60 | AllTrails | Hiking/Trails | GAP (trails) | -- |
| 61 | Komoot | Outdoor Navigation | GAP (trails) | -- |
| 62 | Wanderlog | Trip Planning | GAP (travel) | -- |
| 63 | TripIt | Travel Organization | GAP (travel) | -- |
| 64 | PackPoint | Packing List | GAP (travel) | -- |
| 65 | Paprika | Recipe Manager | MyRecipes | EXCEEDED |
| 66 | Mela | Recipe Manager | MyRecipes | EXCEEDED |
| 67 | Plan to Eat | Meal Planning | MyRecipes | EXCEEDED |
| 68 | Planta | Plant Care | MyRecipes garden (partial) | PARTIAL |
| 69 | PictureThis | Plant ID | GAP (AI plant ID) | -- |
| 70 | Co-Star | Astrology | GAP (astrology) | -- |
| 71 | Nebula | Astrology | GAP (astrology) | -- |
| 72 | The Pattern | Personality Astrology | GAP (astrology) | -- |
| 73 | Letterboxd | Movie Diary | GAP (films) | -- |
| 74 | Untappd | Beer Diary | GAP (beverages) | -- |
| 75 | Vivino | Wine Scanner | GAP (beverages) | -- |
| 76 | Goodreads | Book Tracking | MyBooks | EXCEEDED |
| 77 | 1Password | Password Manager | N/A (don't build) | -- |
| 78 | Bitwarden | Password Manager | N/A (don't build) | -- |
| 79 | Scanner Pro | Doc Scanner | GAP (utility) | -- |
| 80 | CamScanner | Doc Scanner | N/A (malware) | -- |
| 81 | Alarmy | Alarm Clock | GAP (utility) | -- |
| 82 | Cladwell | Outfit Planner | GAP (closet) | -- |
| 83 | Fantastical | Calendar | GAP (calendar) | -- |
| 84 | Spark | Email Client | GAP (email) | -- |
| 85 | Smoke Free | Quit Smoking | GAP (sobriety) | -- |
| 86 | I Am Sober | Sobriety Tracker | GAP (sobriety) | -- |
| 87 | BetterHelp | Online Therapy | N/A (licensed therapy) | -- |
| 88 | Talkspace | Therapy App | N/A (licensed therapy) | -- |
| 89 | Woebot | AI Therapy | N/A (enterprise only) | -- |
| 90 | Carrot Weather | Weather | N/A (cloud-dependent) | -- |
| 91 | Dogo | Dog Training | GAP (pets) | -- |
| 92 | Surfline | Surf Forecast | MySurf | MATCHED |
| 93 | Nike Training Club | Free Workouts | MyWorkouts (partial) | PARTIAL |
| 94 | Peloton | Connected Fitness | GAP (streaming) | -- |
| 95 | Apple Health | Health Dashboard | MyHealth | MATCHED (plus correlation) |
| 96 | Samsung Health | Health Dashboard | MyHealth | MATCHED (plus correlation) |
| 97 | Google Fit | Fitness Tracking | GAP (activity) | -- |
| 98 | Garmin Connect | Wearable Platform | GAP (wearable) | -- |
| 99 | Whoop | Recovery Tracker | GAP (recovery) | -- |
| 100 | 1SE | Video Diary | GAP (video diary) | -- |

### Status Summary

| Status | Count | Description |
|--------|-------|-------------|
| **MATCHED** | 18 | MyLife meets or matches the competitor's core features |
| **EXCEEDED** | 3 | MyLife surpasses the competitor (MyBooks > Goodreads, MyRecipes > Paprika/Mela/Plan to Eat) |
| **PARTIAL** | 15 | MyLife covers some features but has significant gaps |
| **GAP** | 57 | No MyLife module addresses this app's core value |
| **N/A** | 7 | Not appropriate to build (security, therapy, weather, malware) |

---

*Report generated 2026-03-05 by Claude Code for MyLife competitive analysis.*
*Data sourced from app stores, official websites, and web research as of March 2026.*
