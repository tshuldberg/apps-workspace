# DESIGN: BestChef

**Date:** 2026-04-22
**Status:** Decisions Locked / Pre-Implementation
**Authors:** Trey + Marlin (concept + decisions), Claude (analysis + architecture)
**Module:** `recipes` -> `bestchef` (rebranded)
**Accent:** #22C55E (culinary green)

---

## 1. Vision

BestChef is a competitive, social recipe platform. The core premise:

> We're trying to find the best recipe around the world for each dish. We don't care if it's a backyard burger if it's the best damn burger around.

**Product pillars:**
- **Crowdsourced excellence:** community votes surface the best recipe for every dish
- **Authenticity:** real photos only, no AI-generated images, no blogger fluff
- **Utility first:** nutrition facts, pantry matching, shopping lists, ingredient filtering, grocery delivery
- **Creator economy:** follow chefs, tip them, subscribe to their content, Instagram-style recipe grids
- **Data flywheel:** recipe dataset feeds health/nutrition/meal-planning across MyLife and standalone

**Business model:** $3 one-time app purchase + 5% platform fee on creator tips and subscriptions.

---

## 2. Current State Audit

### Already built in MyRecipes (carries forward)

| Feature | Implementation |
|---|---|
| Import from recipe sites | URL parser: JSON-LD, Microdata, Meta tag extraction |
| No blogger fluff | Parser strips to structured data only |
| Text scan on images | Photo OCR + Claude AI extraction |
| Nutrition facts per ingredient | Open Food Facts barcode lookup + `calculateRecipeNutrition()` |
| Calorie math | Ingredient-level nutrition aggregation with serving scaling |
| "What can I cook now" | Pantry inventory + `matchRecipesToPantry()` + `suggestRecipesForExpiringItems()` |
| Allergen/dietary filtering | Tag system + dietary filter chips |
| Shopping list from recipe | `addRecipeToShoppingList()`, auto-aggregation by aisle |
| Pantry staples | `rc_pantry_staples` table (16 defaults) |
| Video import | YouTube/TikTok/Instagram pipeline with metadata extraction |
| Recipe sharing | Share tokens, text/card/link/clipboard formats |
| Collections | Collection CRUD with cover photos |
| Meal planning | Weekly grid + cross-recipe shopping list generation |
| Barcode scanning | `getPantryItemByBarcode()` via Open Food Facts API |

### Already built in `@mylife/social` (infrastructure ready)

| Feature | Components |
|---|---|
| User profiles | `SocialProfile` (handle, display name, bio, avatar, follower counts) |
| Follow system | `Follow`, `useFollowers`, `useFollowing` |
| Activity feed | `ActivityType` includes `recipes_cooked`, `recipes_created` |
| Reactions | `Kudos` with emoji types (fire, clap, heart, muscle, mind_blown, wave) |
| Comments | `Comment`, `useComments` |
| Challenges | `Challenge`, `ChallengeGoal`, `useChallengeProgress` |
| Groups | `Group`, `GroupMember`, `useMyGroups` |
| Leaderboards | `LeaderboardConfig`, `LeaderboardEntry` (global, group, friends, challenge) |
| Share cards | `ShareCard`, `generateActivityCard` |
| Privacy | `PrivacySettings` with per-module opt-in |
| Friend links | `FriendLink` with secure code-based confirmation |

---

## 3. Locked Decisions

### Decision 1: Dish Taxonomy Seed Data -- EXHAUSTIVE RESEARCH + 300 CURATED

Research every named dish from every cuisine worldwide. An agent team member is dedicated to compiling the full global dish taxonomy while development proceeds with an initial curated set of 300 dishes. Community proposals allowed after launch with Community Notes-style moderation.

Taxonomy file: `docs/designs/bestchef-dish-taxonomy.md` (research in progress).

### Decision 2: Four-Tier Voting Model

Voters choose exactly one reaction per submission:

| Tier | Label | Numeric Value | Meaning |
|---|---|---|---|
| 0 | "Not for me" | 0 | Negative signal (not counted toward score, but tracked) |
| 1 | "I'd eat that" | 1 | Positive, baseline approval |
| 2 | "As good as Momma's" | 3 | Strong endorsement |
| 3 | "Best Chef" | 5 | Exceptional, top-tier |

**Scoring:** Weighted Wilson score interval using these values. A submission with 100x "Best Chef" votes ranks higher than one with 100x "I'd eat that." The "Not for me" tier provides signal without being destructive -- it's not a downvote, it's an opt-out that affects the denominator but not the numerator.

One vote per user per submission. Users can change their vote at any time.

### Decision 3: Three Submissions Per User Per Dish

Each user can submit up to 3 recipes per dish. Swaps allowed (remove one, add another). This lets users show range (e.g., three different burger approaches) without flooding the leaderboard.

### Decision 4: Photo Verification -- Hard Gate on Upload, Soft Gate on Ranking

- **Unverified users cannot attach images to submissions.** Photos require passing verification (EXIF check, AI detection heuristics, or community vouching).
- **Submissions without images cannot break the top 100 for a dish.** This incentivizes real photography without completely blocking text-only entries.
- Community Notes-style moderation for reporting suspicious photos.

### Decision 5: Dual Architecture -- Standalone App + Hub Module

BestChef must work as:
1. **Standalone iOS/Android app** (for App Store release and initial funding)
2. **MyLife hub module** (integrated into the consolidated app)

Both run the same core code. Architecture uses the existing MyLife standalone submodule pattern:
- Shared business logic lives in `modules/recipes/` (now `modules/bestchef/`)
- Standalone app wraps the module with its own Expo app shell
- Hub integration wires the module via `ModuleDefinition`
- Parity enforcement via `pnpm check:module-parity`

Chef profiles use `@mylife/social` SocialProfile as the base when running inside MyLife. In standalone mode, BestChef provides its own profile system backed by the same Supabase schema, ensuring data portability.

### Decision 6: Full Hybrid Comments

Both systems active:
- `@mylife/social` comment primitives for social feed integration
- `bc_comments` table in Supabase for recipe-native comments (tips, "I tried this", chef's notes)
- Comments sync bidirectionally: recipe comments appear in social feed, social comments appear on recipe detail
- Can reduce scope later if the hybrid adds unnecessary complexity

Additional comment types:
- "I tried this" (with optional photo proof)
- "Chef's Tip" (pinnable by recipe author)
- Helpful vote on comments

### Decision 7: Full Grocery Delivery Integration

Build the complete integration stack from day one:

- **Instacart:** Deep API integration (Retailer API for cart building + affiliate tracking)
- **Amazon Fresh:** Product search + cart link generation
- **Walmart Grocery:** Product matching + checkout link
- **DoorDash / Uber Eats:** For prepared ingredient kits (future)

Features:
- "Order Ingredients" button on every recipe detail page
- Provider selection in user settings (with zip code for availability)
- Ingredient-to-product mapping with user confirmation
- "Missing items only" toggle (subtracts pantry inventory)
- Smart substitution suggestions when exact matches unavailable
- Order tracking integration
- Referral revenue tracking per recipe and per chef (for creator revenue share)

### Decision 8: Shared Nutrition Engine Package

Create `packages/nutrition-engine/` consumed by both BestChef and MyHealth/MyNutrition:
- Recipe nutrition calculation (from ingredient data)
- Daily/weekly macro aggregation
- Meal plan optimization hints
- Dietary goal tracking
- Nutrient gap analysis

This package is standalone-compatible -- BestChef can ship independently without requiring the full MyLife hub.

### Decision 9: Tipping + Creator Subscriptions

**Revenue model for creators:**

| Stream | How it works | Platform cut | Commitment |
|---|---|---|---|
| Tips | Any user can tip any chef on a recipe | 5% | Committed to never raising above 5% |
| Subscriptions | Monthly subscription to a chef (unlocks blog posts, exclusive recipes, early access) | 5% | Committed to never raising above 5% |
| Affiliate share | When a chef's recipe drives a grocery order, chef gets a cut of the referral fee | Split varies by provider | N/A |

**Creator features unlocked by having subscribers:**
- Blog posts and longform content (not just recipes)
- Exclusive recipes (subscriber-only)
- Early access to new submissions
- Creator analytics dashboard (views, votes, follows, revenue)

**Transparency commitment:** Platform fee is 5% and we publicly commit to never raising it. This is a trust differentiator against platforms like Twitch/YouTube that change creator terms unpredictably.

**Payment infrastructure:** Route through MyPay module (Unit BaaS) for payouts, Stripe Connect for standalone mode.

### Decision 10: Required Location + Cultural Origin

**Three location/origin fields on every submission:**

| Field | Description | Required | Example |
|---|---|---|---|
| Chef location | Where the chef is cooking from (zip, city, or area) | Yes | "Los Angeles, CA" |
| Chef origin | Where the chef is from (nationality/cultural background) | Yes | "Osaka, Japan" |
| Cuisine origin | The cultural origin of the dish itself | Yes (from dish taxonomy) | "Japanese" |

This enables powerful queries: "Show me ramen recipes made by Japanese chefs in LA" or "Best tacos from people who grew up in Mexico City."

**Location resolution:** Chef location auto-resolves from zip/city to region and country code. Users enter it once in their profile; per-submission override available.

### Decision 11: BestChef Branding

Full rebrand from MyRecipes to BestChef:
- Module ID changes from `recipes` to `bestchef` (or stays `recipes` internally with `BestChef` as the display name -- TBD on registry impact)
- App name: BestChef
- Standalone app: BestChef (App Store listing)
- Hub module: BestChef (within MyLife)
- All user-facing strings, icons, and marketing use "BestChef"
- Table prefix stays `rc_` for local data (avoids migration), `bc_` for cloud data

### Decision 12: Standalone + Hub Module (Shared Codebase)

**Architecture for zero drift:**

```
Apps/
├── BestChef/                    # Standalone Expo app (submodule)
│   ├── app/                     # Expo Router routes
│   ├── package.json             # Depends on @mylife/bestchef, @mylife/social
│   └── ...
├── MyLife/
│   ├── modules/bestchef/        # Shared business logic (the source of truth)
│   │   ├── src/
│   │   │   ├── db/              # Local SQLite CRUD
│   │   │   ├── bestchef/        # Cloud layer (Supabase)
│   │   │   ├── parser/          # Import engines
│   │   │   ├── pantry/          # Pantry intelligence
│   │   │   ├── grocery/         # Shopping + delivery
│   │   │   └── ...
│   │   └── package.json
│   ├── apps/mobile/app/(bestchef)/  # Hub mobile routes
│   └── apps/web/app/bestchef/       # Hub web routes
```

- `modules/bestchef/` is the single source of truth for all business logic
- Standalone app imports from `@mylife/bestchef` as a package dependency
- Hub routes import from the same package
- Parity enforcement: `pnpm check:module-parity` catches drift
- Both targets share the same Supabase backend for cloud features

### Decision 13: Community Notes-Style Moderation

No manual review team. Community self-moderates using a system inspired by Twitter/X Community Notes:

**How it works:**
1. Any user can flag a submission (fake photo, inappropriate content, wrong dish category, duplicate)
2. Any user can write a "note" on a flagged item explaining why it should/shouldn't be removed
3. Notes are rated by other users for helpfulness
4. A note is shown publicly when it receives sufficient "helpful" ratings from users across different viewpoints (bridging algorithm)
5. If a critical note reaches consensus, the submission is automatically demoted or hidden

**What gets moderated:**
- Photo authenticity reports
- Dish taxonomy proposals (new dish names)
- Recipe attribution disputes
- Creator verification applications (initially community-reviewed with admin override)
- Comment moderation (flag -> note -> consensus)

**Moderation tables (Supabase):**
```sql
bc_flags (id, target_type, target_id, flagger_id, reason, status, created_at)
bc_notes (id, flag_id, author_id, body, helpful_count, unhelpful_count, status, created_at)
bc_note_ratings (note_id, rater_id, rating, created_at)  -- 'helpful' | 'unhelpful'
```

### Decision 14: Recipe Sharing is Legally Clear

Legal research agent is compiling a full report (see `docs/designs/bestchef-legal-research.md`).

**Key legal principles (preliminary):**
- Recipe ingredient lists are facts and are not copyrightable (US law)
- Recipe instructions may have thin copyright on creative expression, but the underlying method/process is not copyrightable
- Platforms hosting user-generated content are protected by Section 230 (CDA) and DMCA safe harbor
- Users' own photos of food they cooked are owned by the photographer
- Terms of Service must include: user represents they have the right to post, DMCA takedown process, content license grant

**Action items:**
- Draft Terms of Service with recipe-specific clauses
- Implement DMCA takedown process
- Add optional "source" field for attribution (URL or text credit)
- Consult attorney before launch for final review

### Decision 15: $3 One-Time Purchase + 5% Platform Fee

**Pricing model:**

| Revenue Stream | Amount | Notes |
|---|---|---|
| App purchase | $3 one-time | iOS + Android (standalone BestChef app) |
| MyLife hub access | Included in MyLife Pro subscription | BestChef module bundled with MyLife |
| Creator tips | 5% platform fee | Transparent, committed to never raising |
| Creator subscriptions | 5% platform fee | Monthly recurring, creator sets price |
| Grocery affiliate | 3-5% referral fee (from Instacart etc.) | Split between platform and creator |

**Why $3 one-time:**
- Low barrier to entry (impulse purchase territory)
- Filters out low-quality/bot accounts (real humans pay $3)
- No recurring subscription fatigue for basic users
- Premium creator features are funded by the 5% cut, not user subscriptions

---

## 4. Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    BestChef Platform                      │
├─────────────────────┬───────────────────────────────────┤
│   LOCAL (SQLite)    │         CLOUD (Supabase)           │
│                     │                                     │
│  rc_recipes         │  bc_dishes + bc_dish_aliases        │
│  rc_ingredients     │  bc_submissions + bc_votes          │
│  rc_steps           │  bc_rankings (materialized)         │
│  rc_tags            │  bc_recipe_snapshots                │
│  rc_pantry_items    │  bc_comments + bc_comment_helpful   │
│  rc_meal_plans      │  bc_flags + bc_notes + bc_ratings   │
│  rc_shopping_lists  │  bc_chef_badges + bc_badge_defs     │
│  rc_collections     │  bc_creator_apps                    │
│  rc_nutrition_data  │  bc_photo_reports                   │
│  rc_settings        │  bc_recipe_forks                    │
│                     │  bc_tips + bc_subscriptions          │
│                     │  bc_brand_mappings                   │
│                     │                                     │
│  "My Kitchen"       │  "BestChef Community"               │
│  (private, offline) │  (public, connected)                │
└─────────────────────┴───────────────────────────────────┘
            │                        │
            └──── Publish ───────────┘
            (local recipe -> cloud snapshot)
```

### Cloud Schema (Supabase)

```sql
-- Dish taxonomy
bc_dishes (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  native_name text,                    -- romanized original language name
  category text NOT NULL,              -- appetizer|soup|salad|main|side|dessert|bread|beverage|condiment|snack|breakfast
  cuisine text NOT NULL,               -- Japanese|Mexican|Italian|...
  region text,                         -- more specific than cuisine (Oaxacan, Sicilian, Kansai)
  description text,                    -- 1-line, max 100 chars
  photo_url text,
  alias_count integer DEFAULT 0,
  submission_count integer DEFAULT 0,
  status text DEFAULT 'active',        -- active|pending|merged|rejected
  proposed_by uuid REFERENCES social_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

bc_dish_aliases (
  id uuid PRIMARY KEY,
  dish_id uuid REFERENCES bc_dishes(id),
  alias text NOT NULL,
  locale text,                         -- 'en', 'ja', 'es', etc.
  UNIQUE(dish_id, alias)
);

-- Submissions and voting
bc_submissions (
  id uuid PRIMARY KEY,
  dish_id uuid REFERENCES bc_dishes(id),
  recipe_snapshot_id uuid REFERENCES bc_recipe_snapshots(id),
  profile_id uuid REFERENCES social_profiles(id),
  photo_url text,
  photo_verified boolean DEFAULT false,
  photo_verified_at timestamptz,
  verification_method text,            -- exif|ai_detection|community|manual
  chef_location text NOT NULL,         -- "Los Angeles, CA"
  chef_location_lat real,
  chef_location_lng real,
  chef_origin text NOT NULL,           -- "Osaka, Japan"
  country_code text,                   -- ISO 3166-1 alpha-2
  vote_score real DEFAULT 0,
  rank integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dish_id, recipe_snapshot_id)  -- one snapshot per dish
);

-- Constraint: max 3 submissions per user per dish
-- Enforced via trigger or application logic

bc_recipe_snapshots (
  id uuid PRIMARY KEY,
  original_local_recipe_id text,       -- rc_recipes.id from user's device (for re-publish tracking)
  profile_id uuid REFERENCES social_profiles(id),
  title text NOT NULL,
  description text,
  servings integer,
  prep_time_mins integer,
  cook_time_mins integer,
  total_time_mins integer,
  difficulty text,
  ingredients_json jsonb NOT NULL,
  steps_json jsonb NOT NULL,
  tags text[],
  nutrition_json jsonb,
  source_url text,                     -- attribution: where the recipe came from
  source_attribution text,             -- "Inspired by Kenji Lopez-Alt"
  created_at timestamptz DEFAULT now()
);

bc_votes (
  id uuid PRIMARY KEY,
  submission_id uuid REFERENCES bc_submissions(id),
  voter_profile_id uuid REFERENCES social_profiles(id),
  tier integer NOT NULL CHECK (tier BETWEEN 0 AND 3),
  -- 0: "Not for me", 1: "I'd eat that", 2: "As good as Momma's", 3: "Best Chef"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(submission_id, voter_profile_id)
);

bc_rankings (
  dish_id uuid REFERENCES bc_dishes(id),
  submission_id uuid REFERENCES bc_submissions(id),
  score real NOT NULL,                 -- Wilson score (weighted)
  rank integer NOT NULL,
  region text,                         -- null = global, otherwise regional
  country_code text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY(dish_id, submission_id, COALESCE(region, '__global__'))
);

-- Comments (hybrid: native + social bridge)
bc_comments (
  id uuid PRIMARY KEY,
  submission_id uuid REFERENCES bc_submissions(id),
  profile_id uuid REFERENCES social_profiles(id),
  social_activity_id uuid,             -- link to @mylife/social activity (nullable)
  body text NOT NULL CHECK (length(body) <= 2000),
  comment_type text DEFAULT 'comment', -- comment|tried_this|chefs_tip
  photo_url text,                      -- for "I tried this" proof photos
  is_pinned boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

bc_comment_helpful (
  comment_id uuid REFERENCES bc_comments(id),
  voter_profile_id uuid REFERENCES social_profiles(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY(comment_id, voter_profile_id)
);

-- Photo verification and moderation
bc_photo_reports (
  id uuid PRIMARY KEY,
  submission_id uuid REFERENCES bc_submissions(id),
  reporter_id uuid REFERENCES social_profiles(id),
  reason text NOT NULL,                -- ai_generated|stolen|inappropriate|wrong_dish|other
  status text DEFAULT 'open',          -- open|noted|resolved|dismissed
  created_at timestamptz DEFAULT now()
);

-- Community Notes moderation
bc_flags (
  id uuid PRIMARY KEY,
  target_type text NOT NULL,           -- submission|comment|dish_proposal|photo
  target_id uuid NOT NULL,
  flagger_id uuid REFERENCES social_profiles(id),
  reason text NOT NULL,
  status text DEFAULT 'open',          -- open|noted|actioned|dismissed
  created_at timestamptz DEFAULT now()
);

bc_notes (
  id uuid PRIMARY KEY,
  flag_id uuid REFERENCES bc_flags(id),
  author_id uuid REFERENCES social_profiles(id),
  body text NOT NULL CHECK (length(body) <= 1000),
  helpful_count integer DEFAULT 0,
  unhelpful_count integer DEFAULT 0,
  status text DEFAULT 'pending',       -- pending|shown|hidden
  created_at timestamptz DEFAULT now()
);

bc_note_ratings (
  note_id uuid REFERENCES bc_notes(id),
  rater_id uuid REFERENCES social_profiles(id),
  rating text NOT NULL CHECK (rating IN ('helpful', 'unhelpful')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY(note_id, rater_id)
);

-- Badges and achievements
bc_badge_definitions (
  id text PRIMARY KEY,                 -- 'first_recipe', 'rising_chef', 'crowd_favorite', etc.
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,                  -- emoji or icon reference
  criteria_json jsonb NOT NULL,        -- machine-readable criteria for auto-awarding
  tier text DEFAULT 'bronze',          -- bronze|silver|gold|platinum
  created_at timestamptz DEFAULT now()
);

bc_chef_badges (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES social_profiles(id),
  badge_id text REFERENCES bc_badge_definitions(id),
  earned_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, badge_id)
);

-- Creator program
bc_creator_applications (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES social_profiles(id),
  platform_links jsonb NOT NULL,       -- [{platform: 'instagram', url: '...', followers: 50000}]
  bio text,
  specialties text[],                  -- cuisine specialties
  status text DEFAULT 'pending',       -- pending|approved|rejected
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz DEFAULT now()
);

-- Tipping and subscriptions
bc_tips (
  id uuid PRIMARY KEY,
  tipper_id uuid REFERENCES social_profiles(id),
  chef_id uuid REFERENCES social_profiles(id),
  submission_id uuid REFERENCES bc_submissions(id),  -- nullable (can tip a chef, not just a recipe)
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  platform_fee_cents integer NOT NULL,  -- 5% of amount
  payment_intent_id text,               -- Stripe/MyPay reference
  status text DEFAULT 'pending',        -- pending|completed|failed|refunded
  created_at timestamptz DEFAULT now()
);

bc_subscriptions (
  id uuid PRIMARY KEY,
  subscriber_id uuid REFERENCES social_profiles(id),
  chef_id uuid REFERENCES social_profiles(id),
  tier_name text NOT NULL,              -- chef-defined tier name
  price_cents integer NOT NULL,         -- monthly price
  platform_fee_cents integer NOT NULL,  -- 5% of price
  status text DEFAULT 'active',         -- active|cancelled|past_due|expired
  current_period_start timestamptz,
  current_period_end timestamptz,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

bc_subscription_tiers (
  id uuid PRIMARY KEY,
  chef_id uuid REFERENCES social_profiles(id),
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  benefits jsonb,                       -- [{type: 'exclusive_recipes'}, {type: 'blog_access'}, {type: 'early_access'}]
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Creator content (blogs, exclusive recipes)
bc_posts (
  id uuid PRIMARY KEY,
  author_id uuid REFERENCES social_profiles(id),
  title text NOT NULL,
  body text NOT NULL,
  post_type text DEFAULT 'blog',       -- blog|exclusive_recipe|announcement
  visibility text DEFAULT 'public',    -- public|subscribers|tier_specific
  required_tier_id uuid REFERENCES bc_subscription_tiers(id),
  cover_image_url text,
  linked_submission_id uuid REFERENCES bc_submissions(id),
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recipe forks/remixes
bc_recipe_forks (
  id uuid PRIMARY KEY,
  source_snapshot_id uuid REFERENCES bc_recipe_snapshots(id),
  forked_by_profile_id uuid REFERENCES social_profiles(id),
  forked_snapshot_id uuid REFERENCES bc_recipe_snapshots(id),  -- the new version
  created_at timestamptz DEFAULT now()
);

-- Brand resolution
bc_brand_mappings (
  id uuid PRIMARY KEY,
  barcode text,
  brand_name text NOT NULL,
  generic_name text NOT NULL,
  category text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### Package Structure

```
modules/bestchef/                       # Rebranded from modules/recipes/
├── src/
│   ├── db/                             # Local SQLite CRUD (existing)
│   │   ├── crud.ts, schema.ts, types.ts
│   │   ├── collections.ts, nutrition.ts, pantry.ts
│   │   ├── meal-planner.ts, cooking.ts, shopping-lists.ts
│   ├── parser/                         # Import engines (existing)
│   ├── pantry/                         # Pantry intelligence (existing)
│   ├── grocery/                        # Shopping + merge + categorize (existing)
│   ├── scaling/, nutrition/, voice/, share/, print/  # (existing)
│   ├── import/                         # URL/photo/video import (existing)
│   ├── cloud/                          # NEW: BestChef cloud layer
│   │   ├── types.ts                    # All bc_ types and Zod schemas
│   │   ├── client.ts                   # Supabase client wrapper
│   │   ├── dish-taxonomy.ts            # Dish CRUD, alias resolution, fuzzy search
│   │   ├── submission.ts               # Publish: local recipe -> cloud snapshot
│   │   ├── voting-engine.ts            # 4-tier votes, weighted Wilson score
│   │   ├── ranking-engine.ts           # Rank materialization, regional splits
│   │   ├── photo-verification.ts       # EXIF, AI detection, community reports
│   │   ├── chef-profile.ts             # Recipe grid, stats, badges, signature dishes
│   │   ├── badge-engine.ts             # Badge criteria evaluation, auto-award
│   │   ├── remix.ts                    # Fork/remix with attribution + lineage
│   │   ├── comments.ts                 # Hybrid comment system (native + social bridge)
│   │   ├── moderation.ts              # Community Notes: flags, notes, ratings, consensus
│   │   ├── tips.ts                     # Tipping engine (Stripe/MyPay)
│   │   ├── subscriptions.ts            # Creator subscriptions + tier management
│   │   ├── posts.ts                    # Blog/exclusive content CRUD
│   │   ├── creator-program.ts          # Application, verification, analytics
│   │   └── grocery-delivery.ts         # Instacart/Amazon/Walmart deep integration
│   └── ui/                             # React Native components (existing + new)
├── __tests__/
└── package.json

packages/nutrition-engine/              # NEW: Shared nutrition package
├── src/
│   ├── calculator.ts                   # Recipe nutrition calculation
│   ├── aggregator.ts                   # Daily/weekly macro aggregation
│   ├── goals.ts                        # Dietary goal tracking
│   ├── gaps.ts                         # Nutrient gap analysis
│   ├── optimizer.ts                    # Meal plan optimization hints
│   └── types.ts
└── package.json

Apps/BestChef/                          # NEW: Standalone Expo app (submodule)
├── app/                                # Expo Router routes
├── components/                         # App-shell components
├── package.json                        # Depends on @mylife/bestchef
└── CLAUDE.md
```

### Sync Policy (Mesh Sync)

| Data | Scope | Notes |
|---|---|---|
| Local recipes | `personal_replica` | Syncs across user's devices |
| Published snapshots | `published_blob` | Read-only cloud copies |
| Votes, comments, rankings | Cloud-only (Supabase) | Not mesh-synced |
| Pantry, shopping lists | `device_local` or `personal_replica` | User preference |
| Chef profile | Cloud-only (Supabase) | Via `@mylife/social` |
| Tips, subscriptions | Cloud-only (Supabase) | Payment records |
| Meal plans | `personal_replica` | Syncs across devices |

---

## 5. Phasing

### Phase 0: Foundation + Rebrand (3-4 days)

- [ ] Rebrand module: `recipes` display name -> `BestChef`, update definition.ts
- [ ] Supabase project setup (or extend existing) with `bc_` schema
- [ ] Dish taxonomy engine + 300 seed dishes (from research agent output)
- [ ] `packages/nutrition-engine/` extraction from existing recipe nutrition code
- [ ] Standalone app scaffold (`Apps/BestChef/`) with submodule wiring
- [ ] "Publish to BestChef" flow (local recipe -> snapshot -> submission)

### Phase 1: Voting + Leaderboards (3-4 days)

- [ ] 4-tier voting engine (weighted Wilson score)
- [ ] Vote buttons UI (4-tier selector with labels)
- [ ] Per-dish leaderboard screen (mobile + web)
- [ ] Ranking materialization (Supabase edge function on vote trigger)
- [ ] Regional ranking splits (global, country, city)
- [ ] Dish browser/search screen
- [ ] Trending/new dish discovery feed

### Phase 2: Chef Profiles + Badges (2-3 days)

- [ ] Chef profile page (recipe grid, stats bar, follow button)
- [ ] Badge engine + 10 initial badge definitions
- [ ] Chef search/discover screen
- [ ] "My Chef Profile" editor
- [ ] Wire `@mylife/social` follow system
- [ ] Signature dishes computation (top 3 ranked)

### Phase 3: Photo Verification + Moderation (2-3 days)

- [ ] Photo verification engine (EXIF check + AI detection heuristics)
- [ ] Upload flow enforcement (unverified = no images)
- [ ] Top-100 gate (no images = can't break top 100)
- [ ] Community Notes moderation system (flags, notes, ratings, consensus algorithm)
- [ ] Photo report pipeline
- [ ] Verification badge on recipe cards

### Phase 4: Comments + Remix (2-3 days)

- [ ] Hybrid comment system (bc_comments + social bridge)
- [ ] "I tried this" comment type with photo
- [ ] "Chef's Tip" pinnable comments
- [ ] Helpful vote on comments
- [ ] Recipe fork/remix with attribution
- [ ] Recipe lineage display ("inspired by @chef_name")

### Phase 5: Creator Economy (3-4 days)

- [ ] Tipping engine (Stripe Connect for standalone, MyPay for hub)
- [ ] 5% platform fee calculation and tracking
- [ ] Creator subscription tiers (chef-defined pricing + benefits)
- [ ] Blog/post system for creators (public + subscriber-only)
- [ ] Creator application + verification flow
- [ ] Creator analytics dashboard (views, votes, revenue, followers)

### Phase 6: Grocery Delivery (3-4 days)

- [ ] Instacart Retailer API integration (product search, cart building)
- [ ] Amazon Fresh integration
- [ ] Walmart Grocery integration
- [ ] "Order Ingredients" button on recipe detail
- [ ] Ingredient-to-product mapping with confirmation UI
- [ ] "Missing items only" (subtract pantry)
- [ ] Affiliate/referral revenue tracking per recipe and per chef
- [ ] Brand-to-generic mapping engine enhancement

### Phase 7: Challenges + Health Bridge (2-3 days)

- [ ] Seasonal challenge templates (5 pre-built)
- [ ] Recipe-aware challenge goal tracking
- [ ] Challenge leaderboard integration
- [ ] `packages/nutrition-engine/` integration with MyHealth
- [ ] MyNutrition bridge (recipe suggestions from nutritional goals)
- [ ] Meal plan optimization hints

### Phase 8: Standalone App Polish + App Store (3-4 days)

- [ ] Standalone app shell polish (onboarding, app icon, splash)
- [ ] App Store assets (screenshots, description, keywords)
- [ ] Terms of Service + Privacy Policy (with recipe-specific clauses)
- [ ] DMCA takedown process implementation
- [ ] $3 IAP setup (RevenueCat for standalone)
- [ ] TestFlight beta
- [ ] App Store submission

**Total estimated: 23-32 days of development**

---

## 6. Revenue Model Summary

```
                    BestChef Revenue Streams
                    ========================

  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │  App Purchase │   │ Creator Fees │   │   Grocery    │
  │    $3 once    │   │   5% tips    │   │  Affiliate   │
  │               │   │   5% subs    │   │   3-5% ref   │
  └──────────────┘   └──────────────┘   └──────────────┘
         │                   │                   │
         │                   │                   │
         v                   v                   v
  ┌────────────────────────────────────────────────────┐
  │                BestChef Platform                    │
  │                                                    │
  │  Free in MyLife Pro  |  $3 standalone  |  5% fees  │
  └────────────────────────────────────────────────────┘
```

---

## 7. Competitive Landscape

| Platform | Weakness | BestChef Advantage |
|---|---|---|
| AllRecipes | Ad-heavy, SEO-bait, no social, no ranking | Clean UX, community-ranked, authenticity-first |
| Tasty/BuzzFeed | Entertainment over utility, editorial picks | Crowd-ranked quality, structured data |
| Yummly | Black-box recommendations, limited social | Transparent voting, open leaderboards |
| Paprika/Mela | Great local apps, zero social/competition | BestChef adds the social and competitive layer |
| Instagram/TikTok | Ephemeral content, not structured as recipes | Structured data: nutrition, scaling, shopping, delivery |
| Twitch/Patreon | Creator tools but no recipe-specific features | Purpose-built for food with recipe data, voting, verification |

**The moat:** Ranked recipe dataset across thousands of dishes, verified by community voting. This data powers meal planning, nutrition, and grocery commerce. More users -> more recipes -> better rankings -> more useful meal plans -> more grocery orders -> more revenue -> more creators -> more users.

---

## 8. Supporting Documents

| Document | Location | Status |
|---|---|---|
| Global dish taxonomy | `docs/designs/bestchef-dish-taxonomy.md` | Research in progress |
| Legal research (recipe copyright) | `docs/designs/bestchef-legal-research.md` | Research in progress |
| BestChef production launch plan | `docs/plans/features/recipes/bestchef-production-launch-mission-control.md` | Current canonical Markdown plan |
| Social package types | `packages/social/src/types.ts` | Existing |
| Existing recipe module | `modules/recipes/` | Existing (to be rebranded) |
