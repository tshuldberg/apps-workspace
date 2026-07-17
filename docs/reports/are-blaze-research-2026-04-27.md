# App Research Report: are-blaze

**Generated:** 2026-04-27
**Project Path:** `/Users/trey/Superapp-Projects/are-blaze`
**Analyzed by:** `/research-app` skill

---

## Executive Summary

`are-blaze` is a compact native iOS SwiftUI prototype for BestChef. It presents a warm, social, leaderboard-first cooking product with Apple sign-in, Supabase read/realtime wiring, swipe voting, reviewed votes, recipe submission, chef profiles, notifications, and a kitchen pantry/grocery surface.

The app builds successfully for the iOS simulator and has strong interaction design, but it is prototype-grade. Most write flows are local-only or simulated, tokens are persisted in `UserDefaults`, media flows use mock assets, and there are no tests or project documentation beyond `project.yml`.

## Project Identity

| Field | Value |
|-------|-------|
| Name | are-blaze |
| Product Name | BestChef |
| Description | Native SwiftUI BestChef prototype focused on competitive recipe rankings, social cooking, and kitchen utility |
| Primary Language(s) | Swift |
| Framework(s) | SwiftUI, AuthenticationServices, URLSession, XcodeGen project.yml |
| Status | Active prototype |
| Git Repository | Yes |
| Total Commits | 14 |
| First Commit | 2026-04-27 11:12:01 -0700 |
| Last Activity | 2026-04-27 12:36:13 -0700 |

## Technology Stack

### Runtime And Languages

- Swift 5.0 application source.
- iOS app target with deployment target iOS 17.0.
- SwiftUI view layer throughout.
- No Swift Package dependencies.

### Frameworks And Libraries

| Framework | Purpose |
|-----------|---------|
| SwiftUI | Full UI and navigation layer |
| AuthenticationServices | Sign in with Apple |
| Foundation URLSession | Supabase Auth, PostgREST, and Realtime websocket calls |
| XcodeGen | Project generation via `project.yml` |

### Infrastructure

- Supabase URL and publishable anon key are embedded in `project.yml` and `Info.plist`.
- Raw PostgREST reads target `bc_submissions`, joined to `bc_dishes`, `bc_recipe_snapshots`, and `social_profiles`.
- Raw Phoenix websocket connection subscribes to `public.notifications` INSERT changes.
- No local database, persistence layer, offline cache, or durable draft store exists.

### Build And Test Tools

- Xcode project: `/Users/trey/Superapp-Projects/are-blaze/are-blaze.xcodeproj`
- Source of project config: `/Users/trey/Superapp-Projects/are-blaze/project.yml`
- Verification run: `xcodebuild -project /Users/trey/Superapp-Projects/are-blaze/are-blaze.xcodeproj -scheme are-blaze -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`
- Result: build succeeded.
- Test target: missing.

## Architecture

### Directory Structure

```text
/Users/trey/Superapp-Projects/are-blaze/
|-- project.yml
|-- are-blaze.xcodeproj/
`-- are-blaze/
    |-- App/
    |-- Auth/
    |-- Backend/
    |-- Chef/
    |-- Detail/
    |-- Home/
    |-- Kitchen/
    |-- Leaderboards/
    |-- Models/
    |-- Navigation/
    |-- Notifications/
    |-- Profile/
    |-- Search/
    |-- Submit/
    |-- Theme/
    `-- Vote/
```

### Design Patterns

- MVVM-lite: feature views hold UI state with `@State`, while shared app state lives in `ObservableObject` services such as `AuthService`, `RecipeRepository`, `KitchenStore`, and `NotificationsStore`.
- Feature folders: each major surface has its own directory, for example `Vote/`, `Kitchen/`, `Submit/`, and `Notifications/`.
- Environment injection: `BestChefApp` creates app-scoped objects and injects them through `.environmentObject`.
- Repository pattern: `RecipeRepository` owns remote recipe reads and maps Supabase rows into the local `Recipe` UI model.
- Design-token enum: `BCTheme` centralizes colors, gradients, typography, card style, and brand tone.

### Key Components

| Component | Location | Purpose | Size |
|-----------|----------|---------|------|
| App shell | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/App/BestChefApp.swift` | Root app, auth gate, environment objects, initial recipe load, realtime lifecycle | 53 lines |
| Navigation | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Navigation/RootTabView.swift` | Five-tab SwiftUI shell | 75 lines |
| Theme | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Theme/BCTheme.swift` | Warm BestChef visual system | 96 lines |
| Models and seed recipes | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Models/Models.swift` | Recipe model, leaderboard enum, sample recipe corpus | 209 lines |
| Auth | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Auth/` | Apple sign-in, Supabase token exchange, session store, sign-in UI | 3 files, 289 lines |
| Backend | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Backend/` | Supabase config, REST recipe fetch, realtime notifications | 4 files, 515 lines |
| Home | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Home/HomeView.swift` | Brand landing, hero champion, stats, trending, restaurants, submit CTA | 582 lines |
| Vote | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Vote/` | Swipe deck, voting actions, reviewed vote proof sheet | 3 files, 888 lines |
| Submit | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Submit/` | Five-step recipe submission wizard | 4 files, 1,236 lines |
| Kitchen | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Kitchen/` | Pantry, grocery list, recipe ingredient picker, receipt scan mock | 5 files, 1,252 lines |
| Detail and Chef | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Detail/`, `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Chef/` | Rich recipe and chef detail pages | 2 files, 1,332 lines |
| Search | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Search/SearchView.swift` | Discover, search, cuisine cards, recipe/chef result routing | 512 lines |
| Notifications | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Notifications/` | Seeded notification center with realtime insert merge | 2 files, 569 lines |

## Feature Inventory

### Auth And Session

| Feature | Description | Key Files | API Endpoints | Status |
|---------|-------------|-----------|---------------|--------|
| Sign in with Apple | Native Apple auth request and identity token callback | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Auth/AuthService.swift`, `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Auth/SignInView.swift` | Apple AuthenticationServices | Partial |
| Supabase GoTrue exchange | Exchanges Apple ID token for Supabase access and refresh tokens | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Auth/AuthService.swift` | `POST /auth/v1/token?grant_type=id_token` | Partial |
| Session persistence | Stores Supabase session | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Auth/AuthSession.swift` | None | Prototype, should use Keychain |
| Auth gate | Switches between sign-in and app tabs | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/App/BestChefApp.swift` | None | Complete for prototype |

### Social Recipe Discovery

| Feature | Description | Key Files | API Endpoints | Status |
|---------|-------------|-----------|---------------|--------|
| Home feed | Hero recipe, Top This Week, leaderboards, trending chips, restaurant spotlight, submit CTA | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Home/HomeView.swift` | Reads from `RecipeRepository` | Strong UI, partial data |
| Recipe repository | Loads approved remote submissions, maps rows into local UI model, falls back to seed recipes | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Backend/RecipeRepository.swift` | `GET /rest/v1/bc_submissions` with `bc_dishes`, `social_profiles`, `bc_recipe_snapshots` joins | Partial |
| Search and discover | Text search across recipes, chefs, cuisines, dishes, and regions | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Search/SearchView.swift` | None, in-memory data | Prototype |
| Recipe detail | Rich hero, story, mock ingredients, mock steps, video block, community verdict, grocery action | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Detail/RecipeDetailView.swift` | None | Prototype |
| Chef profile | Chef-specific recipes, stats, follow toggle, about, score chart | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Chef/ChefProfileView.swift` | None | Prototype |

### Leaderboards And Voting

| Feature | Description | Key Files | API Endpoints | Status |
|---------|-------------|-----------|---------------|--------|
| Leaderboards | All-time, by dish, by cuisine, by region, podium, ranked rows | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Leaderboards/LeaderboardsView.swift` | None, in-memory data | Strong UI, prototype data |
| Swipe voting | Swipe right/up/left/down and button actions for like, reviewed, pass, skip | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Vote/VoteView.swift`, `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Vote/SwipeCardView.swift` | None | Prototype |
| Reviewed Vote | Requires simulated photo proof, verdict, star rating, notes, and has 3x UI weighting | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Vote/ReviewedVoteSheet.swift` | None | Prototype |
| Vote footer in detail | Upvote/pass toggles and Reviewed Vote CTA | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Detail/RecipeDetailView.swift` | None | Prototype |

### Submission

| Feature | Description | Key Files | API Endpoints | Status |
|---------|-------------|-----------|---------------|--------|
| Multi-step submit wizard | Final photos, ingredient photo/list, process video, details, review | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Submit/SubmitRecipeView.swift`, `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Submit/SubmitSteps.swift` | None | Strong UI, local-only |
| Submission validation | Requires final photo, ingredient photo/list, 5 minutes of video for competition, title and dish | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Submit/SubmitDraft.swift` | None | Prototype |
| Media inputs | Simulated photo/video assets using emoji and gradients | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Submit/SubmitDraft.swift`, `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Submit/SubmitComponents.swift` | None | Mock |
| Publish | Delays 1.2 seconds and shows success sheet | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Submit/SubmitRecipeView.swift` | None | Mock |

### Kitchen

| Feature | Description | Key Files | API Endpoints | Status |
|---------|-------------|-----------|---------------|--------|
| Pantry inventory | Categories, quantities, expiration freshness, expiring strip, add/delete | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Kitchen/KitchenStore.swift`, `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Kitchen/PantrySection.swift` | None | Prototype |
| Grocery list | Grouped list, checked state, progress, clear checked, add/delete | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Kitchen/GrocerySection.swift` | None | Prototype |
| Add from recipe | Select recipe and add synthetic ingredients with multiplier | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Kitchen/KitchenSheets.swift`, `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Kitchen/KitchenStore.swift` | None | Prototype |
| Receipt scan | Simulated scan populates mock pantry items | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Kitchen/KitchenSheets.swift` | None | Mock |
| Add to grocery from recipe detail | Adds synthetic recipe ingredients and shows toast | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Detail/RecipeDetailView.swift` | None | Prototype |

### Notifications

| Feature | Description | Key Files | API Endpoints | Status |
|---------|-------------|-----------|---------------|--------|
| Notification center | Category filters, unread/read sections, mark all read, swipe actions, deep links | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Notifications/NotificationsView.swift` | None for local actions | Strong UI |
| Seeded notifications | Local notification model and sample rows | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Notifications/NotificationsStore.swift` | None | Prototype |
| Realtime notification inserts | Raw Phoenix websocket subscription to `public.notifications` INSERTs | `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Backend/RealtimeNotificationsService.swift` | `wss://<project>.supabase.co/realtime/v1/websocket` | Partial |

## Different Design Of BestChef

### What This Prototype Emphasizes

- Warm, appetizing brand system: terracotta, saffron, cream, and food-gradient cards in `/Users/trey/Superapp-Projects/are-blaze/are-blaze/Theme/BCTheme.swift`.
- A competition-first home screen: hero champion, Top This Week, Top 100, restaurant spotlight, and submit CTA.
- Swipe-native voting: the Vote tab is a Tinder-style deck with gestures for like, pass, reviewed vote, and skip.
- Reviewed votes as a product primitive: the UI repeatedly frames proof-backed votes as higher trust and higher weight.
- Native iOS polish: SwiftUI gestures, sheets, materials, form controls, navigation stacks, and compact tab architecture.

### How It Differs From The Active BestChef

The active BestChef in `/Users/trey/Desktop/Apps/MyLife/apps/bestchef` is an Expo/TypeScript standalone app backed by shared `@mylife/bestchef` business logic in `/Users/trey/Desktop/Apps/MyLife/modules/bestchef`. It is broader and more production-oriented: 105 app TypeScript files, 96 module source files, 71 test files across app and module, 19 SQLite migration versions, Supabase cloud schema/RLS/functions, media upload/finalize flows, vote proof drafts, kitchen OCR review flows, i18n, and launch tickets.

By contrast, `are-blaze` is smaller and more coherent as a native product concept: 31 Swift files and 8,565 Swift lines, no tests, no local persistence, limited cloud reads, and mock write flows. It is best treated as a design and interaction prototype, not as a replacement implementation.

### Concepts Worth Porting

| Concept | Why It Matters | Target In Active BestChef |
|---------|----------------|---------------------------|
| Swipe Vote tab | More visceral than the current list/button voting patterns | `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/submission/[id]/vote.tsx` or new feed/vote route |
| Reviewed Vote copy and hierarchy | Makes trust mechanics obvious to users | `modules/bestchef/src/social/vote-proof.ts`, vote proof UI, recipe detail |
| Podium leaderboard | Stronger emotional reward than ranked list only | `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/(tabs)/leaderboard.tsx` |
| Home champion card | Clearer first-screen product identity | `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/(tabs)/index.tsx` |
| Kitchen expiring strip | Good quick action for pantry urgency | `/Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/(tabs)/kitchen.tsx`, pantry routes |
| Recipe-to-grocery picker UX | The idea matches existing tickets and recent kitchen work | `apps/bestchef/Tickets/F-001-grocery-add-recipe-populates-ingredients.md`, `modules/bestchef/src/db/shopping-lists.ts` |
| Notification center information architecture | Useful for future social activity and moderation feedback | New notifications surface over existing cloud/social events |

### Concepts To Avoid Or Rework

- Do not port the raw Supabase client approach. Active BestChef already has `@supabase/supabase-js`, Edge Function brokers, RLS schema, typed cloud engines, and launch rules.
- Do not store tokens in `UserDefaults`. Active mobile code should continue using secure storage patterns.
- Do not copy the mock media model. Active BestChef already has photo/video picker utilities, media upload/finalize functions, and local vote proof drafts.
- Do not copy the synthetic ingredient model as data truth. Active BestChef has canonical food identity, receipt import lines, nutrition provenance, pantry batches, and shopping list tables.
- Do not move the active app toward local-only public social flows. MyLife rules require BestChef public launch to use server-backed Supabase identity, media, social, moderation, provider calls, account deletion, and recovery.

## Codebase Metrics

| Metric | Value |
|--------|-------|
| Total Size | 1.5M |
| Swift Source Files | 31 |
| Swift Lines | 8,565 |
| Test Files | 0 |
| Configuration Files | 6 counted outside `.git` and source assets |
| Documentation Files | 0 |
| Xcode Project | Present |
| Package Dependencies | 0 |

### File Type Distribution

| Extension | Count |
|-----------|-------|
| `.swift` | 31 |
| `.json` | 3 |
| `.yml` | 1 |
| `.plist` | 1 |
| `.entitlements` | 1 |
| `.storyboard` | 1 |
| `.pbxproj` | 1 |
| `.xcscheme` | 1 |
| `.xcworkspacedata` | 1 |
| `.resolved` | 1 |
| `.gitignore` | 1 |
| `.DS_Store` | 1 |

## Documentation Assessment

### Existing Documentation

| Document | Location | Quality |
|----------|----------|---------|
| `CLAUDE.md` | Missing | Missing |
| `.claude/CLAUDE.md` | Missing | Missing |
| `README.md` | Missing | Missing |
| `timeline.md` | Missing | Missing |
| `PROJECT_LOG.md` | Missing | Missing |
| `AGENTS.md` | Missing | Missing |
| `.claude/docs/` | Missing | Missing |
| `.claude/skills/SKILLS_REGISTRY.md` | Missing | Missing |
| `project.yml` | `/Users/trey/Superapp-Projects/are-blaze/project.yml` | Good project configuration, not product documentation |

### Quality Tier

| Tier | Assessment |
|------|------------|
| Tier 1 | Not met. No overview, commands, architecture, testing notes, or git workflow document. |
| Tier 2 | Not met. No environment setup, code style, or change tracking. |
| Tier 3 | Not met. No `.claude/docs`, skills, plugin inventory, or development tracking rules. |

## Dependencies

### Production Dependencies

None declared in `project.yml`. The app uses Apple system frameworks only.

### Dev Dependencies

None declared in `project.yml`. Xcode and XcodeGen are implied by the generated `.xcodeproj` and `project.yml`.

### Potential Concerns

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are embedded in `project.yml` and `Info.plist`. The anon key is publishable by design, but environment separation and key rotation should still be documented.
- Auth session tokens are stored in `UserDefaults`. The source comment correctly notes Keychain is required for production.
- No dependency on Supabase Swift SDK keeps footprint low, but raw REST and websocket code increases protocol maintenance risk.
- No test target means auth parsing, repository mapping, realtime decoding, vote flow state, and submission validation are unprotected.

## Cross-Project Relationships

- This project is outside the main `/Users/trey/Desktop/Apps/MyLife` monorepo and is not wired into the active BestChef app or module.
- The active BestChef standalone app is `/Users/trey/Desktop/Apps/MyLife/apps/bestchef`.
- The active shared business logic is `/Users/trey/Desktop/Apps/MyLife/modules/bestchef`.
- Active BestChef uses TypeScript, Expo Router, SQLite, Supabase cloud engines, Edge Functions, i18n, and a large test suite. `are-blaze` uses SwiftUI only and should be treated as a product/design reference.
- Naming overlap is strong: both products use `bc_` cloud concepts, submissions, dishes, profiles, vote scoring, media, pantry, grocery, and recipe detail. Schema compatibility is not guaranteed because `are-blaze` maps to simplified local Swift models.

## Recommendations

### Immediate

1. Create a short design extraction doc before changing active BestChef code. Capture the SwiftUI screens to port: swipe vote deck, reviewed vote sheet, podium leaderboard, hero champion, kitchen expiring strip, and notification center.
2. Do not migrate backend code from `are-blaze`. Use the active `@mylife/bestchef` cloud engines, vote proof system, RLS schema, Edge Functions, and local SQLite cache instead.
3. If this prototype will continue to live, add `README.md`, `CLAUDE.md`, and a test target. The app currently has no durable instructions or safety net.

### Short-Term

1. Port the Swipe Vote UX into active BestChef using the existing vote proof and media upload pipeline.
2. Refresh active BestChef leaderboard UX with the podium and category tabs while keeping the weighted Wilson score model from `/Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/cloud/voting-engine.ts`.
3. Lift the clearer Reviewed Vote language and proof hierarchy into the active vote proof UI. The active implementation is stronger technically, while the SwiftUI version is clearer emotionally.
4. Compare active kitchen tickets against `are-blaze` kitchen ideas. `F-001`, `F-002`, and pantry expiration UX already overlap.

### Long-Term

1. Decide whether BestChef should remain Expo-first for public launch or whether a native SwiftUI shell is strategically useful later. Current launch rules and shared module architecture favor Expo/TypeScript now.
2. Add a notification domain to active BestChef if social events and moderation feedback become launch-critical.
3. Consider a warm BestChef-specific theme variant. The active Obsidian Noir theme is production-consistent with MyLife, but the SwiftUI terracotta/saffron system is more food-native.

## Raw Data

### Recent Git Log

```text
b1a9eb8 All wiring is complete!
2186ee6 ## Summary - Live data wiring (round 2)
c28a37e Live data wiring foundation in place - the app builds and runs successfully.
6ecf932 Sign-in-with-Apple + Supabase backend is now wired up.
91a98ed Realtime Sync Layer Ready
95daff8 The Notifications screen opened beautifully...
b862282 Chef profile page is live. Here's what's new:
a0ebf31 Both tabs are live. Here's what's new:
dd82fec Recipe Detail screen is now live and wired up. Here's what's new:
b6a8560 Kitchen tab is live and looking great...
```

### Git Branches

```text
* main
```

### Build Verification

```text
xcodebuild -project /Users/trey/Superapp-Projects/are-blaze/are-blaze.xcodeproj -scheme are-blaze -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
Result: BUILD SUCCEEDED
```
