# MyNutrition Module + Apple Watch Companion -- Architecture Report

**Date:** 2026-03-06
**Scope:** Full implementation of `@mylife/nutrition` module (Phases 1-9) with Apple Watch integration for MyFast

---

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph HubShell["MyLife Hub Shell"]
        MobileApp["Expo Mobile App<br/>(apps/mobile)"]
        WebApp["Next.js 15 Web App<br/>(apps/web)"]
    end

    subgraph Packages["Shared Packages"]
        ModReg["@mylife/module-registry<br/>Module lifecycle, types, hooks"]
        DB["@mylife/db<br/>SQLite adapter, migrations"]
        UI["@mylife/ui<br/>Dark theme, components, tokens"]
    end

    subgraph NutritionModule["@mylife/nutrition (modules/nutrition/)"]
        Definition["ModuleDefinition<br/>id: 'nutrition' | prefix: 'nu_'"]
        Schema["SQLite Schema<br/>9 tables + FTS5"]
        CRUD["CRUD Layer<br/>foods, log, goals, settings"]
        Search["Search Engine<br/>FTS5 + unified API"]
        APIs["External APIs<br/>Open Food Facts, FatSecret"]
        AI["AI Photo Log<br/>Claude Vision API"]
        Stats["Stats Engine<br/>daily, weekly, monthly, micros"]
        Bridge["MyFast Bridge<br/>cross-module ft_ reads"]
        Export["CSV Export<br/>food log + summary"]
    end

    subgraph WatchApp["Apple Watch (SwiftUI)"]
        WatchMain["MyFastWatchApp<br/>3-tab: Timer, Water, Food"]
        FastState["FastState<br/>fasting timer + zones"]
        NutState["NutritionState<br/>calories, goal, favorites"]
        WCManager["WatchConnectivityManager<br/>WCSession delegate"]
        Complications["WidgetKit Complications<br/>4 widgets"]
    end

    subgraph WatchBridge["Watch Bridge Layer (TypeScript)"]
        BridgeTS["WatchBridge.ts<br/>send state, receive actions"]
        SyncHook["useWatchSync.ts<br/>React hook for bidirectional sync"]
    end

    MobileApp -->|registers| ModReg
    MobileApp -->|reads/writes| DB
    MobileApp -->|themed by| UI
    WebApp -->|registers| ModReg
    WebApp -->|reads/writes| DB
    WebApp -->|themed by| UI

    ModReg -->|loads| Definition
    DB -->|runs migrations| Schema
    Definition -->|declares| Schema

    MobileApp -->|renders screens| CRUD
    MobileApp -->|calls| Search
    MobileApp -->|calls| AI
    MobileApp -->|reads| Stats
    WebApp -->|server actions| CRUD
    WebApp -->|server actions| Search
    WebApp -->|reads| Stats

    Search -->|local first| CRUD
    Search -->|fallback| APIs
    APIs -->|caches results| CRUD
    AI -->|creates foods| CRUD
    Stats -->|aggregates| CRUD
    Bridge -->|reads ft_ tables| DB

    MobileApp -->|iOS only| BridgeTS
    BridgeTS -->|sendMessage / appContext| WCManager
    SyncHook -->|wraps| BridgeTS
    WCManager -->|updates| FastState
    WCManager -->|updates| NutState
    WCManager -->|sendAction| BridgeTS

    WatchMain --> FastState
    WatchMain --> NutState
    WatchMain --> WCManager
    Complications -->|reads UserDefaults| FastState
    Complications -->|reads UserDefaults| NutState
```

---

## 2. Module Package Architecture

```mermaid
graph LR
    subgraph Public["Public API (index.ts barrel)"]
        DEF["NUTRITION_MODULE"]
        TYPES["Types + Zod Schemas"]
        DB_OPS["CRUD Operations"]
        SEARCH_OPS["Search"]
        API_OPS["API Clients"]
        AI_OPS["AI Photo"]
        STATS_OPS["Stats Engine"]
        BRIDGE_OPS["Fast Bridge"]
        EXPORT_OPS["CSV Export"]
    end

    subgraph Internal["Internal Structure"]
        direction TB
        subgraph db["db/"]
            schema["schema.ts<br/>9 CREATE TABLE"]
            migrations["migrations.ts<br/>V2: seed data, V3: photo_log"]
            foods["foods.ts"]
            nutrients["nutrients.ts"]
            foodlog["food-log.ts"]
            goals["goals.ts"]
            settings["settings.ts"]
            barcode_cache["barcode-cache.ts"]
        end

        subgraph models["models/"]
            schemas["schemas.ts<br/>13 Zod schemas"]
        end

        subgraph search["search/"]
            foodsearch["food-search.ts<br/>FTS5 + LIKE fallback"]
        end

        subgraph api["api/"]
            off["open-food-facts.ts"]
            fs["fatsecret.ts"]
            rl["rate-limiter.ts"]
            unified["index.ts<br/>searchFoodUnified + lookupBarcode"]
        end

        subgraph ai["ai/"]
            prompts["prompts.ts"]
            photolog["photo-log.ts<br/>Claude Vision"]
        end

        subgraph stats["stats/"]
            daily["daily-summary.ts"]
            trends["trends.ts"]
            micros["micronutrients.ts"]
        end

        subgraph integration["integration/"]
            fastbridge["fast-bridge.ts<br/>reads ft_ tables"]
        end

        subgraph export_dir["export/"]
            csv["csv.ts"]
        end

        subgraph data["data/"]
            usda_nuts["usda-nutrients.ts<br/>84 nutrient defs"]
            usda_foods["usda-seed.ts<br/>~100 common foods"]
        end
    end

    DEF --- schema
    DEF --- migrations
    DB_OPS --- foods
    DB_OPS --- nutrients
    DB_OPS --- foodlog
    DB_OPS --- goals
    DB_OPS --- settings
    DB_OPS --- barcode_cache
    TYPES --- schemas
    SEARCH_OPS --- foodsearch
    API_OPS --- unified
    AI_OPS --- photolog
    STATS_OPS --- daily
    STATS_OPS --- trends
    STATS_OPS --- micros
    BRIDGE_OPS --- fastbridge
    EXPORT_OPS --- csv
```

---

## 3. Database Schema (9 tables + FTS5)

```mermaid
erDiagram
    nu_foods {
        TEXT id PK "UUID"
        TEXT name "NOT NULL"
        TEXT brand "nullable"
        TEXT barcode "nullable, UNIQUE"
        TEXT source "usda | open_food_facts | fatsecret | custom | ai_estimate"
        TEXT sourceId "nullable"
        REAL calories "NOT NULL"
        REAL proteinG "NOT NULL"
        REAL carbsG "NOT NULL"
        REAL fatG "NOT NULL"
        REAL fiberG "default 0"
        REAL sugarG "default 0"
        REAL sodiumMg "default 0"
        REAL servingSize "default 1"
        TEXT servingUnit "default 'serving'"
        TEXT createdAt "datetime"
        TEXT updatedAt "datetime"
    }

    nu_nutrients {
        TEXT id PK "UUID"
        TEXT name "UNIQUE, NOT NULL"
        TEXT unit "mg | mcg | g | IU"
        TEXT category "vitamin | mineral | amino_acid | fatty_acid | other"
        REAL rdaValue "nullable"
        TEXT rdaUnit "nullable"
    }

    nu_food_nutrients {
        TEXT id PK "UUID"
        TEXT foodId FK "-> nu_foods"
        TEXT nutrientId FK "-> nu_nutrients"
        REAL amount "NOT NULL"
    }

    nu_food_log {
        TEXT id PK "UUID"
        TEXT date "YYYY-MM-DD, NOT NULL"
        TEXT mealType "breakfast | lunch | dinner | snack"
        TEXT notes "nullable"
        TEXT createdAt "datetime"
    }

    nu_food_log_items {
        TEXT id PK "UUID"
        TEXT logId FK "-> nu_food_log"
        TEXT foodId FK "-> nu_foods"
        REAL servingCount "default 1"
        REAL calories "snapshot"
        REAL proteinG "snapshot"
        REAL carbsG "snapshot"
        REAL fatG "snapshot"
        TEXT createdAt "datetime"
    }

    nu_daily_goals {
        TEXT id PK "UUID"
        REAL calories "NOT NULL"
        REAL proteinG "NOT NULL"
        REAL carbsG "NOT NULL"
        REAL fatG "NOT NULL"
        TEXT effectiveFrom "YYYY-MM-DD"
        TEXT effectiveTo "nullable"
        TEXT createdAt "datetime"
    }

    nu_settings {
        TEXT key PK
        TEXT value "NOT NULL"
        TEXT updatedAt "datetime"
    }

    nu_barcode_cache {
        TEXT barcode PK
        TEXT responseJson "NOT NULL"
        TEXT source "open_food_facts | fatsecret"
        TEXT cachedAt "datetime"
        TEXT expiresAt "datetime"
    }

    nu_photo_log {
        TEXT id PK "UUID"
        TEXT imageUri "NOT NULL"
        TEXT analysisJson "nullable"
        INTEGER accepted "0 or 1"
        TEXT logItemId FK "nullable -> nu_food_log_items"
        TEXT createdAt "datetime"
    }

    nu_foods ||--o{ nu_food_nutrients : "has nutrients"
    nu_nutrients ||--o{ nu_food_nutrients : "measured in"
    nu_foods ||--o{ nu_food_log_items : "logged as"
    nu_food_log ||--o{ nu_food_log_items : "contains"
    nu_food_log_items ||--o| nu_photo_log : "sourced from"
```

### FTS5 Virtual Table

```sql
nu_foods_fts (name, brand, barcode)   -- content='nu_foods', content_rowid='rowid'
```

Kept in sync via `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE` triggers on `nu_foods`.

### Table Prefix Convention

All nutrition tables use the `nu_` prefix, following MyLife's single-SQLite-file architecture where each module owns a namespace (`bk_` books, `bg_` budget, `ft_` fast, `nu_` nutrition, etc.).

---

## 4. Cross-Module Integration: MyFast Bridge

```mermaid
sequenceDiagram
    participant UI as Nutrition UI
    participant Bridge as fast-bridge.ts
    participant DB as Shared SQLite
    participant FastMod as MyFast Module (ft_ tables)

    UI->>Bridge: isInEatingWindow(db)
    Bridge->>DB: SELECT * FROM ft_settings WHERE key='eating_window_start'
    DB-->>Bridge: {value: '12:00'}
    Bridge->>DB: SELECT * FROM ft_settings WHERE key='eating_window_end'
    DB-->>Bridge: {value: '20:00'}
    Bridge->>DB: SELECT * FROM ft_active_fast LIMIT 1
    DB-->>Bridge: {startedAt, targetHours, protocol}

    alt Tables exist and fast is active
        Bridge-->>UI: true/false (based on current time vs window)
    else ft_ tables don't exist (MyFast not enabled)
        Bridge-->>UI: null (graceful degradation)
    end

    Note over UI: Diary shows "Eating window open/closed" indicator<br/>only when MyFast module is also enabled
```

The nutrition module reads MyFast's `ft_settings` and `ft_active_fast` tables directly (read-only cross-module access). If the fast module isn't enabled, the bridge returns `null` and the UI hides the eating window indicator. This is a deliberate coupling point: nutrition is aware of fasting schedules to help users log food within their eating windows.

---

## 5. Food Search Pipeline

```mermaid
flowchart TD
    Query["User enters search query"]
    FTS["FTS5 Full-Text Search<br/>(nu_foods_fts)"]
    LIKE["LIKE Fallback Search<br/>(nu_foods WHERE name LIKE)"]
    OFF["Open Food Facts API<br/>(world.openfoodfacts.org)"]
    FS["FatSecret API<br/>(OAuth 2.0 client credentials)"]
    Cache["Cache to nu_foods<br/>(source: off/fatsecret)"]
    Merge["Merge + Deduplicate Results"]
    Result["Return to UI"]

    Query --> FTS
    FTS -->|results found| Merge
    FTS -->|no results| LIKE
    LIKE -->|results found| Merge
    LIKE -->|no results or < 5 results| OFF
    OFF -->|results| Cache
    OFF -->|still < threshold| FS
    FS -->|results| Cache
    Cache --> Merge
    Merge --> Result

    subgraph RateLimit["Rate Limiting"]
        RL["Token Bucket<br/>10 req/min per API"]
    end
    OFF -.->|throttled by| RL
    FS -.->|throttled by| RL
```

### Barcode Lookup Pipeline

```mermaid
flowchart LR
    Scan["Camera scans barcode"] --> BCache["Check nu_barcode_cache<br/>(30-day TTL)"]
    BCache -->|hit| Return["Return cached food"]
    BCache -->|miss| OFFB["Open Food Facts<br/>barcode lookup"]
    OFFB -->|found| SaveCache["Save to cache + nu_foods"]
    OFFB -->|not found| NotFound["Return {found: false}"]
    SaveCache --> Return
```

---

## 6. AI Photo Food Logging

```mermaid
sequenceDiagram
    participant User as User
    participant PhotoScreen as photo.tsx
    participant AI as ai/photo-log.ts
    participant Claude as Claude Vision API
    participant DB as SQLite

    User->>PhotoScreen: Capture/pick image
    PhotoScreen->>AI: analyzePhotoForFoods(apiKey, imageUri)
    AI->>AI: Read image as base64
    AI->>Claude: POST /v1/messages<br/>{model: claude-sonnet-4-5, image + prompt}
    Claude-->>AI: JSON array of AIFoodEstimate[]
    AI-->>PhotoScreen: {foods: [{name, calories, protein, carbs, fat, confidence}]}

    loop For each identified food
        PhotoScreen->>User: Show food card with confidence badge
        User->>PhotoScreen: Accept / Reject
    end

    User->>PhotoScreen: "Add 3 Items to Log"
    loop For each accepted food
        PhotoScreen->>DB: createFoodFromAIEstimate() -> nu_foods
        PhotoScreen->>DB: addFoodLogItem() -> nu_food_log_items
    end
```

The AI prompt instructs Claude to return structured JSON with food name, estimated serving size, macronutrients, and a confidence level (high/medium/low). Each estimate gets a colored confidence badge in the UI. Users review and accept/reject each item before it touches the database.

---

## 7. Apple Watch Architecture

```mermaid
graph TB
    subgraph Phone["iPhone (React Native)"]
        RNApp["Expo App"]
        WBridge["WatchBridge.ts<br/>sendFastStateToWatch()<br/>sendNutritionStateToWatch()"]
        SyncHook["useWatchSync hook<br/>watches state changes"]
        NutModule["@mylife/nutrition<br/>CRUD + stats"]
    end

    subgraph Watch["Apple Watch (SwiftUI)"]
        WApp["MyFastWatchApp<br/>TabView: Timer | Water | Food"]
        FS["FastState<br/>@Published timer fields"]
        NS["NutritionState<br/>@Published calorie fields"]
        WCM["WatchConnectivityManager<br/>WCSession delegate"]
        TV["TimerView<br/>fasting ring + controls"]
        WV["WaterLogView<br/>water gauge + button"]
        FV["FoodLogView<br/>calorie ring + favorites + voice"]
        COMP["Complications<br/>FastRing | Water | Elapsed | Calories"]
    end

    subgraph SharedStorage["Shared Storage"]
        UD["App Group UserDefaults<br/>group.com.mylife.app"]
    end

    RNApp --> SyncHook
    SyncHook --> WBridge
    NutModule -->|provides state| SyncHook

    WBridge -->|"sendMessage (reachable)"| WCM
    WBridge -->|"updateAppContext (background)"| WCM
    WCM -->|"handleIncomingContext()"| FS
    WCM -->|"handleIncomingContext()"| NS

    WCM -->|"sendAction('logFood')"| WBridge
    WCM -->|"sendAction('searchAndLogFood')"| WBridge

    FS --> TV
    FS --> COMP
    NS --> FV
    NS --> COMP

    FS -->|saveToDefaults| UD
    NS -->|saveToDefaults| UD
    COMP -->|reads| UD

    WApp --> TV
    WApp --> WV
    WApp -->|"if nutritionState.isEnabled"| FV
```

### Watch Communication Protocol

| Direction | Method | When Used |
|-----------|--------|-----------|
| Phone -> Watch | `sendMessage()` | Both devices active (immediate) |
| Phone -> Watch | `updateApplicationContext()` | Watch sleeping (queued) |
| Watch -> Phone | `sendMessage()` | Phone reachable (immediate) |
| Watch -> Phone | `transferUserInfo()` | Phone unreachable (queued) |

### Watch Actions (Watch -> Phone)

| Action | Payload | Handler |
|--------|---------|---------|
| `startFast` | `{protocol, targetHours}` | `onStartFast` callback |
| `stopFast` | `{}` | `onStopFast` callback |
| `logWater` | `{}` | `onLogWater` callback |
| `logFood` | `{foodId, servingCount}` | `onLogFood` callback |
| `searchAndLogFood` | `{query}` | `onSearchAndLogFood` callback |

### Watch State Payloads (Phone -> Watch)

**Fast State:** `isActive`, `startedAt` (unix), `targetHours`, `protocol`, `waterCount`, `waterGoal`, `streak`

**Nutrition State:** `nutritionEnabled`, `todayCalories`, `calorieGoal`, `recentFoods[]` (id, name, calories, servingUnit)

---

## 8. Hub Integration Points

```mermaid
flowchart TD
    subgraph Registry["Module Registry (packages/module-registry/)"]
        Types["types.ts<br/>ModuleId union includes 'nutrition'"]
        Constants["constants.ts<br/>MODULE_METADATA.nutrition entry"]
    end

    subgraph MobileShell["Mobile Shell (apps/mobile/)"]
        Layout["_layout.tsx<br/>safeRegister(NUTRITION_MODULE)<br/>Stack.Screen name='(nutrition)'"]
        DBProv["DatabaseProvider.tsx<br/>nutrition: NUTRITION_MODULE<br/>in migration map"]
        Screens["app/(nutrition)/<br/>9 screen files"]
    end

    subgraph WebShell["Web Shell (apps/web/)"]
        Sidebar["Sidebar.tsx<br/>nutrition: '/nutrition'"]
        WebDB["db.ts<br/>nutrition: NUTRITION_MODULE"]
        Modules["modules.ts<br/>'nutrition' in supported IDs"]
        Pages["app/nutrition/<br/>8 page files + actions.ts"]
    end

    subgraph UIPackage["UI Package (packages/ui/)"]
        Colors["colors.ts<br/>modules.nutrition: '#F97316'"]
    end

    subgraph CSSVars["CSS Variables"]
        GlobalCSS["globals.css<br/>--accent-nutrition: #F97316"]
    end

    subgraph NutPkg["@mylife/nutrition"]
        Def["NUTRITION_MODULE<br/>ModuleDefinition"]
        Migrations["3 Migrations<br/>V1: schema, V2: seed, V3: photo"]
    end

    NutPkg -->|imported by| Layout
    NutPkg -->|imported by| DBProv
    NutPkg -->|imported by| WebDB
    NutPkg -->|declared in| Types
    NutPkg -->|metadata in| Constants

    Layout -->|renders| Screens
    DBProv -->|runs| Migrations
    Sidebar -->|links to| Pages
    WebDB -->|runs| Migrations
    Colors -->|used by| Screens
    GlobalCSS -->|used by| Pages
```

### Module Lifecycle

1. **Registration:** Hub app imports `NUTRITION_MODULE` and calls `safeRegister()` at startup
2. **Enable:** User toggles nutrition ON in hub dashboard -> SQLite migrations run (V1: 9 tables, V2: seed 84 nutrients + ~100 foods + FTS triggers, V3: photo_log table)
3. **Active:** Navigation routes activate, dashboard card appears with salad emoji and `#F97316` accent
4. **Disable:** Routes removed, card hidden, **data preserved** (never deleted on disable)
5. **Re-enable:** Routes reactivate, existing data intact

---

## 9. Mobile Screen Map

```mermaid
flowchart TD
    subgraph HubNav["Hub Navigation"]
        Dashboard["Hub Dashboard<br/>Module cards grid"]
    end

    subgraph NutritionTabs["Nutrition Module (5 tabs)"]
        Diary["Diary (index.tsx)<br/>Date selector, macro bar,<br/>meal groups, FAB"]
        Search["Search (search.tsx)<br/>FTS + API search,<br/>add to meal"]
        Dash["Dashboard (dashboard.tsx)<br/>Macro rings, goal %,<br/>micronutrient bars"]
        Trends["Trends (trends.tsx)<br/>Weekly/monthly charts,<br/>calorie history"]
        Settings["Settings (settings.tsx)<br/>Goals, units, API key,<br/>CSV export"]
    end

    subgraph NutritionScreens["Hidden Screens"]
        FoodDetail["food/[id].tsx<br/>Nutrition label,<br/>serving picker, log button"]
        Scan["scan.tsx<br/>Camera barcode scanner,<br/>manual lookup"]
        Photo["photo.tsx<br/>Camera/library picker,<br/>AI analysis, accept/reject"]
    end

    Dashboard -->|tap nutrition card| Diary
    Diary -->|FAB +| Search
    Diary -->|tap food item| FoodDetail
    Search -->|tap result| FoodDetail
    Search -->|scan icon| Scan
    Search -->|camera icon| Photo
    Scan -->|barcode found| FoodDetail
    Photo -->|accept items| Diary
    FoodDetail -->|"Add to Log"| Diary
```

---

## 10. Web Page Map

```mermaid
flowchart TD
    subgraph HubNav["Hub Navigation"]
        HubDash["Hub Dashboard (/)"]
        SidebarNav["Sidebar<br/>nutrition: /nutrition"]
    end

    subgraph NutritionPages["Nutrition Pages"]
        DiaryPage["/nutrition<br/>page.tsx -- Food diary"]
        SearchPage["/nutrition/search<br/>Food search + log"]
        DashPage["/nutrition/dashboard<br/>Macro charts + goals"]
        TrendsPage["/nutrition/trends<br/>History + trends"]
        SettingsPage["/nutrition/settings<br/>Goals + export"]
        FoodPage["/nutrition/food/[id]<br/>Food nutrition label"]
    end

    subgraph ServerActions["actions.ts (40+ server actions)"]
        DiaryActions["getDiaryData, deleteFoodLogItem,<br/>createFoodLogEntry, addFoodLogItem"]
        SearchActions["searchFoods, searchFoodUnified,<br/>lookupBarcode"]
        StatsActions["getDailySummary, getWeeklyTrends,<br/>getMonthlyTrends, getMicronutrientSummary"]
        GoalActions["getActiveGoals, createDailyGoals,<br/>updateDailyGoals"]
        ExportActions["exportFoodLogCSV,<br/>exportNutritionSummaryCSV"]
    end

    HubDash -->|click card| DiaryPage
    SidebarNav -->|click icon| DiaryPage
    DiaryPage --> DiaryActions
    SearchPage --> SearchActions
    DashPage --> StatsActions
    TrendsPage --> StatsActions
    SettingsPage --> GoalActions
    SettingsPage --> ExportActions
    FoodPage --> SearchActions
```

---

## 11. Stats Engine

```mermaid
flowchart LR
    subgraph Input["Raw Data"]
        FoodLog["nu_food_log_items<br/>(per-item macros)"]
        Goals["nu_daily_goals<br/>(targets)"]
        Nutrients["nu_food_nutrients<br/>(84+ micronutrients)"]
    end

    subgraph DailyStats["Daily Summary"]
        DS["getDailySummary()<br/>total cal, P, C, F per day"]
        GP["getDailyGoalProgress()<br/>actual vs target %"]
        MB["getMealBreakdown()<br/>per-meal totals"]
    end

    subgraph TrendStats["Trend Analysis"]
        WT["getWeeklyTrends()<br/>7-day rolling averages"]
        MT["getMonthlyTrends()<br/>30-day rolling averages"]
        CH["getCalorieHistory()<br/>daily calorie array for charts"]
        MR["getMacroRatios()<br/>P:C:F percentage split"]
    end

    subgraph MicroStats["Micronutrient Analysis"]
        MS["getMicronutrientSummary()<br/>84 nutrients vs RDA"]
        MD["getMicronutrientDeficiencies()<br/>below-threshold alerts"]
        TS["getTopNutrientSources()<br/>best foods for each nutrient"]
    end

    FoodLog --> DS
    FoodLog --> WT
    FoodLog --> MT
    FoodLog --> CH
    FoodLog --> MR
    Goals --> GP
    FoodLog --> MB
    Nutrients --> MS
    Nutrients --> MD
    Nutrients --> TS
```

### Nutrient Status Classification

| Status | Condition | Dashboard Color |
|--------|-----------|----------------|
| `deficient` | < 50% RDA | Red `#EF4444` |
| `low` | 50-80% RDA | Amber `#EAB308` |
| `adequate` | 80-120% RDA | Green `#22C55E` |
| `high` | 120-200% RDA | Blue `#3B82F6` |
| `excessive` | > 200% RDA | Purple `#A855F7` |

---

## 12. Test Coverage

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `schema.test.ts` | 9 | All 9 tables created, indexes exist, FTS virtual table, triggers |
| `foods-crud.test.ts` | 15 | Food CRUD, barcode lookup, FTS search, settings CRUD, barcode cache |
| `food-log.test.ts` | 8 | Log entries, log items, daily totals aggregation, cascading deletes |
| `goals.test.ts` | 5 | Goal CRUD, date-range effective lookups, goal updates |
| `stats.test.ts` | 8 | Daily summary, goal progress, weekly/monthly trends, macro ratios |
| `fast-bridge.test.ts` | 4 | Eating window detection, graceful degradation when ft_ tables missing |
| `export.test.ts` | 6 | Food log CSV format, nutrition summary CSV, empty-state handling |
| `ai-photo.test.ts` | 7 | Prompt construction, response parsing, error handling, type guards |
| **Total** | **62** | Full coverage of business logic layer |

---

## 13. File Inventory

### New Files Created (55 files)

**Module package (`modules/nutrition/`)** -- 35 files:
```
package.json, tsconfig.json, vitest.config.ts
src/index.ts, src/types.ts, src/definition.ts
src/db/index.ts, src/db/schema.ts, src/db/migrations.ts
src/db/foods.ts, src/db/nutrients.ts, src/db/food-log.ts
src/db/goals.ts, src/db/settings.ts, src/db/barcode-cache.ts
src/models/index.ts, src/models/schemas.ts
src/search/index.ts, src/search/food-search.ts
src/api/index.ts, src/api/types.ts, src/api/rate-limiter.ts
src/api/open-food-facts.ts, src/api/fatsecret.ts
src/ai/index.ts, src/ai/types.ts, src/ai/prompts.ts, src/ai/photo-log.ts
src/stats/index.ts, src/stats/daily-summary.ts, src/stats/trends.ts, src/stats/micronutrients.ts
src/integration/index.ts, src/integration/fast-bridge.ts
src/export/index.ts, src/export/csv.ts
src/data/index.ts, src/data/usda-nutrients.ts, src/data/usda-seed.ts
src/__tests__/ (8 test files)
```

**Mobile screens (`apps/mobile/app/(nutrition)/`)** -- 9 files:
```
_layout.tsx, index.tsx, search.tsx, dashboard.tsx, trends.tsx
settings.tsx, food/[id].tsx, scan.tsx, photo.tsx
```

**Web pages (`apps/web/app/nutrition/`)** -- 8 files:
```
layout.tsx, page.tsx, actions.ts, search/page.tsx
dashboard/page.tsx, trends/page.tsx, settings/page.tsx, food/[id]/page.tsx
```

**Watch companion (`apps/mobile/watch/ios/`)** -- 2 new files:
```
NutritionState.swift, FoodLogView.swift
```

**Watch bridge** -- 1 new file:
```
apps/mobile/plugins/watch-plugin.js
```

### Existing Files Modified (14 files)

| File | Change |
|------|--------|
| `packages/module-registry/src/types.ts` | Added `'nutrition'` to ModuleId union + Zod enum |
| `packages/module-registry/src/constants.ts` | Added nutrition entry to MODULE_IDS + MODULE_METADATA |
| `packages/ui/src/tokens/colors.ts` | Added `nutrition: '#F97316'` to module colors |
| `apps/web/app/globals.css` | Added `--accent-nutrition: #F97316` CSS variable |
| `apps/mobile/app/_layout.tsx` | Import + safeRegister + Stack.Screen for nutrition |
| `apps/mobile/components/DatabaseProvider.tsx` | Import + migration map entry for nutrition |
| `apps/mobile/package.json` | Added `@mylife/nutrition` + `expo-image-picker` deps |
| `apps/web/components/Sidebar.tsx` | Added `nutrition: '/nutrition'` to MODULE_ROUTES |
| `apps/web/lib/modules.ts` | Added `'nutrition'` to WEB_SUPPORTED_MODULE_IDS |
| `apps/web/lib/db.ts` | Import + registration for nutrition module |
| `apps/web/package.json` | Added `@mylife/nutrition` dependency |
| `apps/mobile/watch/ios/MyFastWatchApp.swift` | Added NutritionState + conditional FoodLogView tab |
| `apps/mobile/watch/ios/WatchConnectivityManager.swift` | Added nutritionState ref + handleIncomingContext routing |
| `apps/mobile/watch/ios/ComplicationProvider.swift` | Added nutrition fields to entry + CalorieGaugeWidget |
| `apps/mobile/native/WatchBridge.ts` | Added WatchNutritionState + sendNutritionStateToWatch + food actions |
| `apps/mobile/hooks/useWatchSync.ts` | Added nutrition state sync + food log action handlers |

---

## 14. Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @mylife/nutrition typecheck` | Clean (0 errors) |
| `pnpm --filter @mylife/nutrition test` | 62/62 passed |
| `pnpm --filter @mylife/mobile typecheck` | 0 nutrition errors (3 pre-existing billing-config) |
| `pnpm --filter @mylife/web typecheck` | 0 nutrition errors (2 pre-existing billing-config) |
| `pnpm check:module-parity` | Passed (1 warning: meds design-only) |
| `pnpm check:parity` | Passed |
