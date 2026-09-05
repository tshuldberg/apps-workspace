# MyLife Competitor Data Export Analysis

> Generated: 2026-03-27
> Purpose: Map which competitor apps allow data export and which lock users in, to prioritize screenshot import adapters and traditional file import adapters for the Universal Data Importer.
> Companion to: Design doc at ~/.gstack/projects/mylife/trey-main-design-20260326-screenshot-import.md

---

## Budget Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **YNAB** | Yes | CSV (zip with 2 CSVs) | Full budget categories + all transaction history | Easy -- web app, "Export Budget" from dropdown | Web-only (not available on mobile); comma-decimal currencies export as TSV |
| **Monarch Money** | Yes | CSV | All transactions across all accounts; balance history per account | Easy -- Settings > Data > Download | 10K transaction limit per download; recommend 5K or fewer to avoid errors |
| **Rocket Money** | Yes | CSV | Transaction history | Easy -- CSV button on mobile, Export on web; emailed as download link | Emailed rather than direct download; may require waiting |
| **Copilot** | Yes | CSV | Date, name, amount, pending/posted status, category, parent category, excluded flag, transaction type, account, notes, recurring associations | Easy -- tap share button, or use web app filters to export specific subsets | iOS/web only; no Android |
| **PocketGuard** | Yes | CSV | All transaction history across linked accounts | Moderate -- emailed as download link; link valid only 24 hours | Email-based delivery with 24-hour link expiry |
| **Mint (legacy)** | Partial | CSV | Transaction history (if exported before shutdown) | Impossible now -- export window closed with Intuit shutdown | Data was migrated to Credit Karma which does not offer export. Users who missed the export window are largely locked out |

## Cycle Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Flo** | Yes | JSON | All tracked cycle data, symptoms, logs | High -- must contact support via in-app chat to request export; no self-serve | Requires manual support request; no self-serve button. Anonymous Mode users cannot export at all without disabling it first |
| **Natural Cycles** | Yes | CSV + PDF | Daily entries (temperatures, period data) in CSV; Cycle Insights Report in PDF | Easy -- enter email at naturalcycles.com/downloadData; CSVs emailed within 24 hours | Two separate emails; may land in spam; PDF report covers only last 6 cycles |
| **Clue** | Yes | JSON | All tracked data + app settings | Moderate -- Settings > Request data; password shown on screen; emailed zip link expires in 72 hours | JSON only (not CSV); requires third-party converter for spreadsheet use; link expires in 72 hours |
| **Ovia** | Yes | CSV | All tracked cycle, fertility, and pregnancy data | Easy -- More > Data Use & Privacy > Export my data; emailed to account email | CSV via email; straightforward self-serve |

## Nutrition Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **MyFitnessPal** | Partial | CSV (Premium) / PDF (Free) | Premium: 3 CSVs (meal nutrition, progress history, exercise history). Free: printable PDF report | Moderate -- website only, not mobile app. Premium required for CSV | Free users limited to PDF. CSV requires paid subscription. No mobile export |
| **Cronometer** | Yes | CSV | Servings, exercises, biometrics, notes; customizable date range | Easy -- Profile > gear icon > Export Data > choose date range + data type | Available to all users (free and paid) |
| **Lose It!** | Partial | CSV | Daily/weekly log summaries, weight, food calories, exercise calories, BMI | High -- web-only; can only download one week at a time | One-week-at-a-time limit makes bulk export extremely tedious |
| **MacroFactor** | Yes | CSV | Two modes: Granular (selectable data types) and Quick (progress, expenditure, weight trend, calories, macros, targets) | Easy -- More > Data Management > Data Export | Self-serve in-app; customizable time frame; comprehensive data |

## Notes Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Notion** | Yes | Markdown + CSV, HTML, PDF (Business/Enterprise) | Full workspace: pages as Markdown, databases as CSV, uploaded files | Easy -- Settings > Export all workspace content; emailed zip link (expires 7 days) | PDF export requires Business/Enterprise plan. Large workspaces can take hours |
| **Evernote** | Yes | ENEX (XML), HTML | Complete notes with attachments, tags, recognition info | Moderate -- desktop app only; right-click > Export | 100 notes at a time max. Desktop-only |
| **Obsidian** | Yes (native) | Markdown (local files) | Everything -- notes are plain Markdown files on disk | None -- files already on your filesystem | Best data portability of any notes app |
| **Bear** | Yes | Markdown, HTML, PDF, DOCX, RTF, JPG, Textbundle | Notes with attachments | Easy -- File > Export Notes; select format | Free and Pro versions both support export |
| **Apple Notes** | Partial | PDF (individual), Markdown (individual) | Individual note content | High -- no bulk export; one note at a time | No native bulk export. Requires third-party "Exporter" app for bulk |

## Habits Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Habitica** | Partial | CSV (habits), JSON/XML (full user data) | Habit History CSV: task name, ID, type, date, value. User Data: full account | Moderate -- website only | Historical data is averaged/sampled for older periods |
| **Habitify** | Yes | CSV, SQLite backup | Habit logs, completion history | Easy -- export from settings | Available to users; ongoing requests for additional formats |
| **Streaks** | Yes | CSV | Task completion history with timezone info; task notes (v11.2+) | Easy -- Export Data screen in settings | iCloud sync only (no cross-platform) |

## Workouts Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Strava** | Yes | GPX (bulk), GPX/TCX/FIT (individual) | GPS tracks, routes, time data | Moderate -- Settings > My Account > Download all activities; emailed zip in 2-4 hours | Bulk export loses activity names, power data, device info, laps |
| **Fitbod** | Yes | CSV | Full workout history (exercises, sets, reps, weights) | Easy -- Settings > Export Workout Data | Straightforward self-serve |
| **Hevy** | Yes | CSV | Workout title, start/end time, description, exercise title, superset ID, notes, set details | Easy -- Profile > Settings > Export & Import Data | Also exports measurements data separately |
| **Strong** | Yes | CSV | Date, workout name, duration, exercise name, set order, weight, reps, distance, seconds, notes | Easy -- in-app export | Exported files cannot be re-imported back into Strong |
| **JEFIT** | Partial | CSV, .bak (SQLite) | Workout logs, exercises | Moderate -- web: Settings > Data Controls > Export Data | .bak file requires decryption tools |

## Flash (Flashcards) Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Quizlet** | Partial | Plain text (copy/paste) | Terms and definitions only (text) | Moderate -- website only; copy to clipboard | Only your own sets. No image export. No file download |
| **Anki** | Yes | .apkg, .colpkg, plain text (TSV) | Complete decks with scheduling, media, tags | Easy -- File > Export | Best flashcard portability. Open format |
| **Brainscape** | Partial | CSV/spreadsheet | Flashcard content (terms/definitions) | Moderate -- Pro users only | Pro subscription required |

## Mood Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Calm** | No (self-serve) | N/A | Personal data via GDPR/privacy request | High -- must email support@calm.com | No in-app export. No meditation history export |
| **Headspace** | No (self-serve) | N/A | Personal info via GDPR request | High -- email help@headspace.com; up to 30 days response time | No self-serve export. 30-day wait |
| **Daylio** | Yes | CSV, PDF | All mood entries, activities, notes | Easy -- More > Export Entries > CSV | Available on both iOS and Android |
| **Bearable** | Yes | CSV | All tracked symptoms, mood, medications, activities | Easy -- More tab > My Data > Export my data | Available to free and paid users |

## Journal Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Day One** | Yes | JSON, PDF, Markdown/Plain Text | All entries with optional media | Easy -- Mac: File > Export; Web: Journal Settings > Export | JSON for re-import; PDF for reading; Markdown on Mac only |

## Books Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Goodreads** | Yes | CSV | Title, author, ISBN13, rating, avg rating, publisher, year published, date read, date added, bookshelves, review, private notes | Easy -- My Books > Import and export > Export Library | Desktop website only. Exports entire library only |
| **StoryGraph** | Partial | Limited export | Some book data; Reading Journal NOT included | Moderate -- Manage Account > export | Reading Journal excluded. No CSV |
| **BookBuddy** | Yes | CSV, PDF, HTML | Full library with book details | Easy -- export from within app | Supports import from Goodreads, LibraryThing |

## Meds Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Medisafe** | Yes | CSV, PDF | Medication schedule, adherence history | Easy -- Manage tab > Report > choose timeframe > Send | Also available via web Patient Portal |
| **MyTherapy** | Partial | PDF only | Health diary summary | Moderate -- in-app PDF export | No CSV export (users have requested since 2017) |

## Fast (Fasting) Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Zero** | Yes | JSON (zip) | Full account data history | Easy -- Me tab > Download My Data | JSON format (not CSV); requires password to open zip |
| **Fastic** | No | N/A | Unknown | High -- no documented self-serve export | Must contact support |
| **LIFE Fasting** | Yes | JSON | All fasting data | Moderate -- export through app | JSON files can be opened in Excel/Sheets |

## Recipes Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Paprika** | Yes | HTML, .paprikarecipes | Full recipes with metadata | Easy -- export from within app | HTML is portable with schema metadata |
| **Yummly** | No | N/A | N/A | Impossible | No bulk export. Chrome extension workaround exists but is fragile |
| **Mealime** | No | N/A | N/A | Impossible | No documented export feature |

## Trails Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **AllTrails** | Yes | GPX, KML, KMZ, TCX, FIT, CSV, GeoJSON | Route data in numerous formats | Easy -- trail page > 3 dots > Export route file | Website only for downloads. Extensive format support |
| **Komoot** | Partial | GPX | Route and activity data | Moderate -- Profile > Export to GPS Device | Must unlock the starting region. No bulk download |

## RSVP/Events Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Partiful** | Yes | CSV | Guest list with RSVP status, questionnaire responses | Easy -- Guest List > "EXPORT CSV" button | Names are often first-name only |
| **Evite** | Yes | CSV/Excel | Guest list with RSVP status | Easy -- Manage Event > download icon | Past events kept only ~2 years |

## Stars/Astrology Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Co-Star** | No | N/A | N/A | Impossible | No documented export. Birth chart inputs are trivially re-enterable |
| **The Pattern** | No | N/A | N/A | Impossible | No documented export |
| **Sanctuary** | No | N/A | N/A | Impossible | No documented export |

## Surf Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Surfline** | Partial | Strava export only | Individual sessions from Watch App only | High -- only to Strava | No CSV. No forecast data export |

## Car Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Jerry** | No | N/A | N/A | Impossible | No documented data export |
| **Drivvo** | Yes (Pro) | CSV/Excel | Fuel logs, services, expenses | Moderate -- Pro subscription required | Premium-only feature |
| **Fuelly** | Yes | CSV | All fuel-up records | Easy -- web or app export | Straightforward |

## Closet Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Whering** | No | N/A | N/A | Impossible | Officially confirmed: "not possible to export" |
| **Acloset** | No | N/A | N/A | Impossible | No documented export |

## Pets Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **PetDesk** | No | N/A | N/A | Unknown | Vet-facing platform; pet owners may need vet records directly |
| **11pets** | Yes | Exportable file | All pet health records and care history | Easy -- Menu > Profile > Export your data | Simple self-serve export |

## Garden Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **PictureThis** | No | N/A | N/A | Impossible | No documented export |
| **Planta** | No | N/A | N/A | Impossible | No documented export |
| **Greg** | No | N/A | N/A | Impossible | No documented export |

## Words (Language Learning) Module

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Duolingo** | Partial | CSV (data package) | Account data package (may take days). Vocabulary requires third-party Chrome extensions | High -- Settings > Data Package > wait days | Vocabulary not directly exportable |
| **Memrise** | Partial | TSV/CSV (via extensions) | Course word lists; personal data via Download Personal Data button | High -- requires Chrome extension for course data | No native course word export |

## Password Managers (Future Module)

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **1Password** | Yes | .1pux (full), CSV (limited) | .1pux: all item types. CSV: Login and Password items only | Easy -- File > Export (desktop only) | Desktop only. CSV exports only Login/Password items |
| **LastPass** | Yes | CSV | Passwords, secure notes, form fills | Easy -- browser extension or website | CSV is unencrypted plaintext |
| **Bitwarden** | Yes | JSON, CSV, JSON (encrypted), ZIP (with attachments) | All vault items; encrypted option available | Easy -- multiple platforms | Best export options. Encrypted export available |
| **Dashlane** | Yes | CSV (zip of multiple CSVs) | Credentials, IDs, payment info, personal info, Secure Notes | Easy -- Settings > Export data | Cannot export passkeys or 2FA tokens |

## Tasks (Future Module)

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Todoist** | Partial | CSV (per project) | Active tasks per project | Moderate -- web only; per-project; no completed tasks in CSV | No completed tasks. One project at a time |
| **Things 3** | Partial | SQLite database, PDF | SQLite: all to-do data. PDF: printable lists | High -- SQLite requires navigating Library folder | No CSV export. Requires technical skill |
| **TickTick** | Yes | CSV | All tasks | Moderate -- web version only | Web-only export. Straightforward |

## Sleep (Future Module)

| Competitor | Export? | Format | Data Included | Friction | Notable Limitations |
|---|---|---|---|---|---|
| **Sleep Cycle** | Yes | CSV | Full sleep database history | Easy -- Profile > More > Account/Database > Export | Available on both iOS and Android |
| **AutoSleep** | Yes | CSV | Bedtime, wake time, deep sleep, HRV, blood oxygen, respiration rate, notes | Easy -- History > set date range > Export | Detailed sleep stage data |
| **Pillow** | Partial | CSV (Premium), TXT (free) | Sleep quality %, stages, sounds, wake-up mood | Moderate -- Settings > Data & Services | CSV requires Premium subscription |

---

## Data Hostage Apps

These are the worst offenders -- MyLife's strongest acquisition targets for screenshot import.

### Tier 1: Complete Data Hostages (No Export At All)
1. **Co-Star, The Pattern, Sanctuary** (Astrology) -- Zero export
2. **Whering, Acloset** (Closet) -- Officially confirmed: no export
3. **PictureThis, Planta, Greg** (Garden) -- All three major plant apps: zero export
4. **Yummly** (Recipes) -- No bulk export (fragile Chrome extension workaround)
5. **Mealime** (Recipes) -- No export at all
6. **Jerry** (Car) -- No data export
7. **Fastic** (Fasting) -- No documented export
8. **Calm, Headspace** (Meditation/Mood) -- No self-serve; must email support; 30-day wait for Headspace

### Tier 2: Hostile Export (Exists But Painful)
1. **Flo** (Cycle) -- Must contact support; no self-serve button
2. **Apple Notes** -- No bulk export; one note at a time
3. **Lose It!** (Nutrition) -- One week at a time; web only
4. **Duolingo** (Language) -- Data package takes days; vocabulary requires browser extension
5. **MyTherapy** (Meds) -- PDF only; CSV requested since 2017, still unavailable
6. **Surfline** (Surf) -- Only exports to Strava; only Watch App sessions
7. **StoryGraph** (Books) -- Reading Journal excluded from export
8. **Quizlet** (Flashcards) -- Copy/paste text only; no file download
9. **Things 3** (Tasks) -- SQLite requires navigating macOS Library folders

### Tier 3: Paywalled Export
1. **MyFitnessPal** (Nutrition) -- CSV requires Premium subscription
2. **Drivvo** (Car) -- CSV requires Pro subscription
3. **Pillow** (Sleep) -- CSV requires Premium subscription
4. **Brainscape** (Flashcards) -- Export requires Pro subscription

---

## Screenshot Import Priority

Ranked by benefit of screenshot-based import (competitors make traditional export hard/impossible).

### Priority 1 (Critical -- No Export Path Exists)
1. **Garden apps** (PictureThis, Planta, Greg) -- Plant collections and care schedules
2. **Closet apps** (Whering, Acloset) -- Wardrobe items with category/color tags
3. **Astrology apps** (Co-Star, The Pattern, Sanctuary) -- Birth charts, readings
4. **Recipe apps** (Yummly, Mealime) -- Ingredients and instructions

### Priority 2 (High -- Export Exists But Is Painful)
5. **Cycle trackers** (Flo) -- Calendar views showing period dates and symptoms
6. **Notes** (Apple Notes) -- Individual note screenshots bypassing one-at-a-time limitation
7. **Nutrition** (MyFitnessPal free tier, Lose It!) -- Food diary screenshots
8. **Language learning** (Duolingo, Memrise) -- Vocabulary list screenshots
9. **Medication** (MyTherapy) -- Medication schedule screenshots
10. **Surf** (Surfline) -- Session summary screenshots

### Priority 3 (Medium -- Nice to Have)
11. **Mood/Meditation** (Calm, Headspace) -- Streak/stats screenshots
12. **Tasks** (Things 3) -- Task list screenshots for non-technical users
13. **Fasting** (Fastic) -- Timer/history screenshots
14. **Books** (StoryGraph) -- Reading list screenshots for excluded journal data

### Priority 4 (Low -- Good Export Already Exists)
15. Apps with easy CSV/JSON export (YNAB, Cronometer, Fitbod, Hevy, Strong, Daylio, Bearable, Sleep Cycle, etc.) -- Traditional file import is better here

---

## Key Takeaways for MyLife Strategy

1. **Garden and Closet are wide open.** All major apps have zero data export. Screenshot import is the only onboarding path.
2. **Astrology apps are data black holes.** Zero export across the board.
3. **Nutrition has a paywall opportunity.** MFP gates CSV behind Premium. MyLife can market free, unlimited data export.
4. **Cycle tracking export is needlessly hostile.** Flo requires contacting support. "Your body, your data" is a powerful message.
5. **Password managers have the best export ecosystem.** All four major players offer self-serve CSV/JSON. MyLife should match Bitwarden's export options.
6. **Screenshot import is most valuable for garden, closet, astrology, and recipes** -- categories where competitors offer zero traditional export.
