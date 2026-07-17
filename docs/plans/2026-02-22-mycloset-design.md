# MyCloset — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyCloset** — Your wardrobe. Not their shopping profile.

A privacy-first wardrobe manager and outfit planner that keeps all your clothing photos on your device. Photograph and catalog every item you own with on-device background removal, build outfits with a visual drag-and-drop builder, track what you wear on a calendar, get weather-aware suggestions, and see wardrobe analytics (cost per wear, most/least worn, category breakdown). No accounts, no cloud uploads, no body measurements sent to servers, no shopping habit profiling.

MyCloset is the anti-Cladwell/Whering wardrobe app for people who want to organize their clothes without uploading photos of everything they own to a company's servers. Cladwell tracks your outfit choices to train AI styling algorithms. Whering monetizes through affiliate shopping links. Acloset builds social feeds of your outfits. MyCloset keeps everything local and costs $4.99 once.

---

## Problem Statement

Wardrobe management apps have a uniquely invasive privacy problem:

1. **These apps photograph everything you own.** Users catalog their entire wardrobe — every shirt, pair of shoes, jacket, and accessory. Combined with outfit tracking, apps build a complete profile of your clothing, style preferences, economic status, and daily habits. This is extraordinarily personal data.
2. **Cladwell profiles your daily outfit choices.** Now at $7.99/month subscription, Cladwell's AI analyzes what you wear, when, and in what combinations to build a behavioral model. Over 1M downloads, yet the app pushes users toward "capsule wardrobe" purchases through partner retailers.
3. **Whering monetizes through affiliate shopping.** Despite 4M users and a sustainability narrative, Whering's business model is a curated marketplace of "sustainable" brands — recommending purchases based on wardrobe gaps it identifies in your closet. Your wardrobe data drives product recommendations.
4. **Acloset builds a social feed of your outfits.** Your outfit photos become content on a public-facing social media-like feed. The app also runs a secondhand marketplace where your clothing data drives listing suggestions. 4M+ users, many unaware their outfit photos populate a social feed.
5. **Stylebook is excellent but iOS-only.** At $4.99 one-time, Stylebook proves the paid wardrobe app model works. 280K+ monthly downloads after 15 years. But it's iPhone/iPad only — no Android, no web. The UI is aging despite the Stylebook 10 update.
6. **Body measurement data is gold for advertisers.** Apps that collect body measurements, clothing sizes, and fit preferences (like Indyx's styling service) create advertising profiles worth far more than the subscription fee. Fashion retailers pay premium CPMs for audiences segmented by body type, size, and style preference.
7. **45% of potential users hesitate due to privacy concerns.** Research shows nearly half of interested users avoid wardrobe apps specifically because of data security worries. A privacy-first app captures this entire abandoned segment.

MyCloset fills the gap: a modern cross-platform wardrobe manager with on-device photo processing, outfit planning, and wardrobe analytics — with zero cloud uploads and zero profiling.

---

## Target User Persona

### Primary: "The Capsule Curator" (Maya, 24-35)

- **Demographics:** Fashion-conscious woman interested in sustainable/intentional dressing. Owns 80-150 clothing items. Spends 10+ minutes daily deciding what to wear.
- **Behavior:** Follows r/capsulewardrobe and r/femalefashionadvice. Has tried Cladwell or Whering but was uncomfortable with cloud uploads. Takes outfit photos for personal tracking. Interested in cost-per-wear metrics and reducing impulse purchases.
- **Pain point:** "I want to see everything I own in one place and track what I actually wear, but I don't want to upload photos of my entire wardrobe to some company's cloud."
- **Motivation:** Wardrobe visibility, outfit planning, reducing decision fatigue, cost-per-wear tracking. Wants to buy less and wear more of what she has.
- **Willingness to pay:** $5 is trivial compared to the cost of clothes she never wears. Already pays for apps that help her be more intentional.

### Secondary: "The Outfit Planner" (Jordan, 22-30)

- **Demographics:** Young professional who needs to look put-together for work and social events. Owns 100-200 items across work, casual, and going-out categories.
- **Behavior:** Lays out outfits the night before. Screenshots outfit ideas from Instagram. Has a "go-to outfits" mental list but forgets combinations. Checks weather before getting dressed.
- **Pain point:** "I wear the same 20% of my closet because I can't remember what goes with what. And I know there are great combos in there I've never tried."
- **Motivation:** Outfit discovery from existing wardrobe, weather-based suggestions, reducing "I have nothing to wear" moments despite a full closet.

### Tertiary: "The Minimalist" (Sam, 28-45)

- **Demographics:** Minimalism-oriented person actively downsizing their wardrobe. Follows r/minimalism. Interested in Project 333 or similar capsule challenges.
- **Behavior:** Tracks wear counts to identify items to donate. Wants a visual inventory of everything they own. Values knowing the exact size and composition of their wardrobe.
- **Pain point:** "I need data to make decisions about what to keep and what to get rid of. Which items do I actually wear?"
- **Motivation:** Wardrobe analytics, wear tracking, cost-per-wear calculations, identifying items to donate or sell.

---

## Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|
| **Cladwell** | Free / $7.99/mo / $49/mo (stylist) | 1M+ downloads | ~$7K/mo (est. App Store) | Cloud-based; outfit data feeds AI model; profiles daily wear patterns | Subscription fatigue; AI outfit suggestions are generic; pushes "capsule wardrobe" purchases |
| **Stylebook** | $4.99 (one-time) | 280K+ downloads/mo | ~$1.4M/mo (est. gross, one-time purchases) | On-device storage; no cloud requirement; respects privacy | iOS-only; 15-year-old architecture; no Android or web; aging despite v10 update |
| **Acloset** | Free / freemium | 4M+ users | Undisclosed (marketplace commissions) | Cloud-based; photos uploaded; outfit social feed is public; secondhand marketplace | AI outfit suggestions are poor; social feed exposes wardrobe to strangers; marketplace pressure |
| **Whering** | Free (marketplace-funded) | 4M users | Undisclosed (raised ~$32K seed; marketplace commissions) | Cloud-based; wardrobe data drives shopping recommendations; sustainability branding | Marketplace is the product — your wardrobe data identifies "gaps" to sell you clothes; early-stage business model |
| **Indyx** | Free / $9/mo ($60/yr) | ~35K downloads/mo | ~$15K/mo (est.) | Cloud-based; photos uploaded; offers human styling services ($60+) | Premium analytics locked behind subscription; styling service creates data exposure; small user base |
| **GetWardrobe** | Free / premium tier | Undisclosed | Undisclosed | Cloud-based; AI outfit generation requires photo uploads; 100-item limit on free tier | Cloud-only model; limited free tier; AI outfit suggestions are inconsistent; smaller player |
| **Smart Closet** | Free (ad-supported) | 1M+ downloads | Undisclosed (ads + affiliate) | Ad-supported; shopping links integrated; data shared with ad networks | Ads interrupt the experience; shopping recommendations based on wardrobe analysis; privacy policy is broad |

### Opportunity

Stylebook proved the market for a premium one-time-purchase wardrobe app — $4.99, iOS-only, 280K downloads per month after 15 years. But Stylebook has no Android presence and its architecture is aging. Meanwhile, Cladwell, Whering, and Acloset have proven massive user interest (4M+ users each) but they all monetize through the user's wardrobe data — feeding shopping recommendations, social feeds, or behavioral AI models.

The opportunity is:
- **Cross-platform** (Expo) — the first serious wardrobe app on both iOS and Android with a modern codebase
- **On-device photo processing** — background removal via iOS Vision / Android ML Kit, never uploaded
- **One-time purchase** — $4.99 like Stylebook, not $7.99/month like Cladwell
- **No marketplace, no social feed, no affiliate links** — the app is a tool, not a shopping funnel
- **Wardrobe analytics that serve the user** — cost-per-wear, category breakdown, wear frequency — designed to help you buy less, not more
- **Capture the 45% who hesitate** — nearly half of potential wardrobe app users avoid them due to privacy concerns. MyCloset is built specifically for them.

---

## Key Features (MVP)

### 1. Wardrobe Catalog

- Add clothing items by taking a photo or selecting from camera roll
- **On-device background removal** automatically isolates the garment from the background (iOS Vision framework / Android ML Kit Subject Segmentation)
- Manual crop/adjust if auto-removal isn't perfect
- Categorize by type: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Activewear, Swimwear, Sleepwear, Formalwear, Custom
- Tag with attributes: Color (primary + secondary), Pattern (solid, striped, floral, plaid, etc.), Season (spring, summer, fall, winter, all-season), Occasion (work, casual, formal, active, going-out), Brand, Size
- Add purchase info: price, date acquired, store/source
- Favorite items for quick access
- Bulk import mode: rapid-fire photo capture for initial wardrobe setup (take photos of many items quickly, tag later)

### 2. Outfit Builder

- Visual outfit composer: select items from wardrobe to create outfit combinations
- Layered preview: items stack visually (top over bottom, shoes below, accessories around)
- Save outfits with name, occasion tags, and season tags
- Browse saved outfits in a visual grid
- "Surprise me" random outfit generator from compatible items
- Outfit templates: "Work outfit" (top + bottom + shoes), "Full look" (top + bottom + shoes + outerwear + accessory)

### 3. Outfit Calendar (Wear Tracking)

- Calendar view showing what you wore each day
- Log today's outfit by selecting a saved outfit or picking individual items
- View wear history for any item (date list + total count)
- "Last worn" badge on each item in the wardrobe grid
- Streak tracking: "You've logged 14 days in a row" (gentle encouragement, not gamification)

### 4. Weather Integration

- Show local weather on the outfit planning screen
- Temperature-based filtering: "Show me items suitable for 45F/7C"
- Season tags auto-filter based on current weather
- Weather data fetched via IP-based geolocation (no GPS permissions needed — uses wttr.in or Open-Meteo free API with IP approximation)
- Weather fetched once per day, cached locally
- Privacy note: IP-based weather lookup reveals approximate city location (same as any website visit). No GPS coordinates sent. No location history stored.

### 5. Wardrobe Analytics

- **Cost per wear:** Purchase price / number of times worn. Updated automatically as wear logs accumulate.
- **Wear frequency:** Items ranked by times worn (most to least). Highlights "never worn" items.
- **Category breakdown:** Pie chart of wardrobe by type (tops: 35%, bottoms: 20%, etc.)
- **Season distribution:** How balanced is your wardrobe across seasons?
- **Color palette:** Visual grid of your wardrobe's dominant colors
- **Wardrobe value:** Total estimated value based on purchase prices entered
- **"Closet insights":** Simple text summaries — "Your most-worn item is the Navy Blazer (47 wears). Your least-worn category is Formalwear (2 items, 0 wears in 6 months)."
- **Donation candidates:** Items worn 0 times in 6+ months, ranked by value (helps identify what to let go)

### 6. Search and Filter

- Full-text search across item names, brands, tags
- Filter by: type, color, pattern, season, occasion, brand
- Multi-filter with AND logic
- Sort by: recently added, most worn, least worn, cost per wear, price
- Quick access views: "Favorites," "Never Worn," "Recently Added"

### 7. Import/Export

- Export wardrobe as JSON (full backup including photo file paths)
- Import from JSON backup (restore on new device)
- Share individual outfit as a composed image card (for texting to a friend)
- Export wardrobe summary as text (item count, category breakdown, total value)

---

## Technical Architecture

### Stack

- **Mobile:** Expo (React Native) — iOS + Android from single codebase
- **Web:** Next.js 15 — Desktop wardrobe browsing and outfit planning
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Background Removal:** iOS Vision framework (VNGenerateForegroundInstanceMaskRequest, iOS 17+) via native module, Android ML Kit Subject Segmentation via native module. Fallback: manual crop tool for older devices.
- **Image handling:** `expo-image-picker` + `expo-file-system` for wardrobe photos
- **Weather:** Open-Meteo free API (no key required, IP-based location) or wttr.in
- **Payments:** RevenueCat (App Store / Play Store IAP), Lemon Squeezy (direct)

### On-Device Background Removal

Background removal is the core technical differentiator. Every wardrobe app uploads photos to cloud servers for processing. MyCloset does it entirely on-device.

**iOS (Vision Framework — iOS 17+):**
```swift
// Native module exposed to React Native via expo-modules
import Vision

func removeBackground(imageData: Data) async throws -> Data {
    guard let cgImage = UIImage(data: imageData)?.cgImage else {
        throw BackgroundRemovalError.invalidImage
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage)
    try handler.perform([request])

    guard let result = request.results?.first else {
        throw BackgroundRemovalError.noResults
    }

    // Generate mask for all foreground instances
    let mask = try result.generateScaledMaskForImage(
        forInstances: result.allInstances,
        from: handler
    )

    // Apply mask to original image, output PNG with transparent background
    let maskedImage = applyMask(mask, to: cgImage)
    return maskedImage.pngData()
}
```

**Android (ML Kit Subject Segmentation):**
```kotlin
// Native module exposed to React Native via expo-modules
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions

fun removeBackground(bitmap: Bitmap): Bitmap {
    val options = SubjectSegmenterOptions.Builder()
        .enableForegroundBitmap()
        .build()
    val segmenter = SubjectSegmentation.getClient(options)
    val inputImage = InputImage.fromBitmap(bitmap, 0)

    val result = segmenter.process(inputImage).await()
    return result.foregroundBitmap  // PNG with transparent background
}
```

**Fallback (iOS <17, older Android):**
Manual crop tool using `expo-image-manipulator` — user traces around the garment with a finger. Not as magical but functional. Could also use a bundled ONNX model (U2Net lightweight, ~4MB) via `onnxruntime-react-native` for older devices.

**React Native bridge:**
```typescript
// packages/shared/src/background-removal/index.ts
import { NativeModules, Platform } from 'react-native';

export async function removeBackground(imageUri: string): Promise<string> {
    if (Platform.OS === 'ios' && Platform.Version >= 17) {
        return NativeModules.BackgroundRemoval.process(imageUri);
    } else if (Platform.OS === 'android') {
        return NativeModules.BackgroundRemoval.process(imageUri);
    } else {
        // Fallback: return original image, show manual crop tool
        return imageUri;
    }
}
```

### Monorepo Structure

```
MyCloset/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   │   ├── (tabs)/        # Tab navigation
│   │   │   │   ├── index.tsx          # Wardrobe catalog (home)
│   │   │   │   ├── outfits.tsx        # Outfit grid
│   │   │   │   ├── calendar.tsx       # Wear calendar
│   │   │   │   └── analytics.tsx      # Wardrobe stats
│   │   │   ├── item/[id].tsx          # Item detail view
│   │   │   ├── item/add.tsx           # Add item (camera + tag)
│   │   │   ├── outfit/[id].tsx        # Outfit detail view
│   │   │   ├── outfit/builder.tsx     # Outfit builder (drag-and-drop)
│   │   │   └── settings.tsx           # App settings
│   │   ├── modules/           # Expo native modules
│   │   │   ├── background-removal/    # iOS Vision + Android ML Kit bridge
│   │   │   └── package.json
│   │   ├── components/        # Mobile-specific components
│   │   ├── hooks/             # Mobile-specific hooks
│   │   └── assets/            # Icons, images, fonts
│   └── web/                   # Next.js 15 — Web/desktop
│       ├── app/
│       └── components/
├── packages/
│   ├── shared/                # Shared business logic
│   │   ├── src/
│   │   │   ├── db/            # Database layer (SQLite operations)
│   │   │   ├── models/        # TypeScript types and Zod schemas
│   │   │   ├── analytics/     # Wardrobe analytics engine
│   │   │   │   ├── cost-per-wear.ts   # CPW calculations
│   │   │   │   ├── wear-frequency.ts  # Item/category frequency stats
│   │   │   │   ├── category-breakdown.ts  # Pie chart data
│   │   │   │   ├── color-palette.ts   # Dominant color extraction
│   │   │   │   └── insights.ts        # Text summary generator
│   │   │   ├── weather/       # Weather integration
│   │   │   │   ├── client.ts          # Open-Meteo API client
│   │   │   │   ├── suggest.ts         # Temperature-to-season mapping
│   │   │   │   └── cache.ts           # Daily weather cache
│   │   │   ├── outfit/        # Outfit logic
│   │   │   │   ├── generator.ts       # Random outfit generator
│   │   │   │   └── templates.ts       # Outfit template definitions
│   │   │   └── utils/         # Date helpers, color utilities
│   │   └── package.json
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── tokens/        # Design tokens
│   │   │   ├── components/    # Cross-platform UI primitives
│   │   │   └── icons/         # Icon set
│   │   └── package.json
│   ├── eslint-config/
│   └── typescript-config/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── CLAUDE.md
├── timeline.md
└── README.md
```

### Data Model (SQLite Schema)

```sql
-- Items — individual clothing pieces
CREATE TABLE items (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,  -- "Navy Blazer", "White Linen Shirt"
    type            TEXT NOT NULL CHECK (type IN (
        'tops', 'bottoms', 'dresses', 'outerwear', 'shoes',
        'accessories', 'activewear', 'swimwear', 'sleepwear',
        'formalwear', 'custom'
    )),
    subtype         TEXT,  -- "t-shirt", "blouse", "jeans", "sneakers", etc.
    brand           TEXT,
    size            TEXT,  -- free-form: "M", "32x30", "9.5", "One Size"
    color_primary   TEXT,  -- hex value: "#1B2A4A"
    color_secondary TEXT,  -- hex value (optional)
    color_name      TEXT,  -- human-readable: "Navy", "White"
    pattern         TEXT CHECK (pattern IN (
        'solid', 'striped', 'plaid', 'floral', 'polka_dot',
        'geometric', 'abstract', 'animal_print', 'camo', 'other'
    )) DEFAULT 'solid',
    season          TEXT CHECK (season IN (
        'spring', 'summer', 'fall', 'winter', 'all_season'
    )) DEFAULT 'all_season',
    occasion        TEXT CHECK (occasion IN (
        'work', 'casual', 'formal', 'active', 'going_out', 'any'
    )) DEFAULT 'any',
    purchase_price  REAL,  -- in user's currency
    purchase_date   TEXT,  -- ISO date
    purchase_source TEXT,  -- "Nordstrom", "thrifted", "gift"
    photo_path      TEXT,  -- local file path to original photo
    photo_removed_bg_path TEXT,  -- local file path to background-removed photo
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,  -- personal notes ("runs small", "dry clean only")
    wear_count      INTEGER NOT NULL DEFAULT 0,  -- denormalized for quick access
    last_worn_at    TEXT,  -- ISO date, denormalized
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outfits — saved outfit combinations
CREATE TABLE outfits (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,  -- "Monday Work Look", "Date Night"
    occasion        TEXT CHECK (occasion IN (
        'work', 'casual', 'formal', 'active', 'going_out', 'any'
    )) DEFAULT 'any',
    season          TEXT CHECK (season IN (
        'spring', 'summer', 'fall', 'winter', 'all_season'
    )) DEFAULT 'all_season',
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outfit Items — junction table linking outfits to items
CREATE TABLE outfit_items (
    outfit_id       TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
    item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    layer_order     INTEGER NOT NULL DEFAULT 0,  -- stacking order for visual preview
    position_x      REAL DEFAULT 0.5,  -- normalized position (0-1) in outfit preview
    position_y      REAL DEFAULT 0.5,  -- normalized position (0-1) in outfit preview
    scale           REAL DEFAULT 1.0,  -- visual scale in outfit preview
    PRIMARY KEY (outfit_id, item_id)
);

-- Wear Log — daily wear tracking
CREATE TABLE wear_logs (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    date            TEXT NOT NULL,  -- ISO date (one entry per day)
    outfit_id       TEXT REFERENCES outfits(id) ON DELETE SET NULL,  -- optional saved outfit
    notes           TEXT,  -- "Job interview", "Rainy day"
    weather_temp_f  INTEGER,  -- temperature at time of logging (cached)
    weather_desc    TEXT,  -- "Sunny", "Rainy", etc.
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(date)  -- one outfit per day
);

-- Wear Log Items — which items were worn on a given day
CREATE TABLE wear_log_items (
    wear_log_id     TEXT NOT NULL REFERENCES wear_logs(id) ON DELETE CASCADE,
    item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY (wear_log_id, item_id)
);

-- Categories — custom user-defined subcategories
CREATE TABLE categories (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    parent_type     TEXT NOT NULL,  -- links to items.type ("tops", "bottoms", etc.)
    name            TEXT NOT NULL,  -- "T-Shirts", "Blazers", "Jeans", "Sneakers"
    sort_order      INTEGER NOT NULL DEFAULT 0,
    UNIQUE(parent_type, name)
);

-- Tags — flexible tagging system for items
CREATE TABLE tags (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL UNIQUE,
    color           TEXT  -- hex color for visual distinction
);

-- Item-Tag junction
CREATE TABLE item_tags (
    item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id          TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- Photos — multiple photos per item (original + processed)
CREATE TABLE photos (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,  -- local file path
    type            TEXT NOT NULL CHECK (type IN ('original', 'removed_bg', 'detail')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Weather Cache — daily weather data
CREATE TABLE weather_cache (
    date            TEXT PRIMARY KEY,  -- ISO date
    temp_high_f     INTEGER,
    temp_low_f      INTEGER,
    condition       TEXT,  -- "sunny", "cloudy", "rainy", "snowy"
    humidity        INTEGER,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User Preferences
CREATE TABLE preferences (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- Seed default categories
INSERT INTO categories (id, parent_type, name, sort_order) VALUES
    ('cat-tops-tshirt', 'tops', 'T-Shirts', 1),
    ('cat-tops-blouse', 'tops', 'Blouses', 2),
    ('cat-tops-button', 'tops', 'Button-Downs', 3),
    ('cat-tops-sweater', 'tops', 'Sweaters', 4),
    ('cat-tops-hoodie', 'tops', 'Hoodies', 5),
    ('cat-tops-tank', 'tops', 'Tank Tops', 6),
    ('cat-bottoms-jeans', 'bottoms', 'Jeans', 1),
    ('cat-bottoms-pants', 'bottoms', 'Pants', 2),
    ('cat-bottoms-shorts', 'bottoms', 'Shorts', 3),
    ('cat-bottoms-skirts', 'bottoms', 'Skirts', 4),
    ('cat-bottoms-leggings', 'bottoms', 'Leggings', 5),
    ('cat-dresses-casual', 'dresses', 'Casual Dresses', 1),
    ('cat-dresses-formal', 'dresses', 'Formal Dresses', 2),
    ('cat-dresses-work', 'dresses', 'Work Dresses', 3),
    ('cat-outerwear-jacket', 'outerwear', 'Jackets', 1),
    ('cat-outerwear-coat', 'outerwear', 'Coats', 2),
    ('cat-outerwear-blazer', 'outerwear', 'Blazers', 3),
    ('cat-outerwear-vest', 'outerwear', 'Vests', 4),
    ('cat-shoes-sneakers', 'shoes', 'Sneakers', 1),
    ('cat-shoes-boots', 'shoes', 'Boots', 2),
    ('cat-shoes-heels', 'shoes', 'Heels', 3),
    ('cat-shoes-flats', 'shoes', 'Flats', 4),
    ('cat-shoes-sandals', 'shoes', 'Sandals', 5),
    ('cat-shoes-loafers', 'shoes', 'Loafers', 6),
    ('cat-acc-jewelry', 'accessories', 'Jewelry', 1),
    ('cat-acc-bags', 'accessories', 'Bags', 2),
    ('cat-acc-belts', 'accessories', 'Belts', 3),
    ('cat-acc-scarves', 'accessories', 'Scarves', 4),
    ('cat-acc-hats', 'accessories', 'Hats', 5),
    ('cat-acc-watches', 'accessories', 'Watches', 6),
    ('cat-acc-sunglasses', 'accessories', 'Sunglasses', 7);

-- Indexes
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_season ON items(season);
CREATE INDEX idx_items_occasion ON items(occasion);
CREATE INDEX idx_items_favorite ON items(is_favorite) WHERE is_favorite = 1;
CREATE INDEX idx_items_wear_count ON items(wear_count);
CREATE INDEX idx_items_last_worn ON items(last_worn_at);
CREATE INDEX idx_items_color ON items(color_primary);
CREATE INDEX idx_items_brand ON items(brand);
CREATE INDEX idx_items_created ON items(created_at);
CREATE INDEX idx_outfit_items_outfit ON outfit_items(outfit_id);
CREATE INDEX idx_outfit_items_item ON outfit_items(item_id);
CREATE INDEX idx_outfits_occasion ON outfits(occasion);
CREATE INDEX idx_outfits_season ON outfits(season);
CREATE INDEX idx_outfits_favorite ON outfits(is_favorite) WHERE is_favorite = 1;
CREATE INDEX idx_wear_logs_date ON wear_logs(date);
CREATE INDEX idx_wear_log_items_log ON wear_log_items(wear_log_id);
CREATE INDEX idx_wear_log_items_item ON wear_log_items(item_id);
CREATE INDEX idx_photos_item ON photos(item_id);
CREATE INDEX idx_item_tags_item ON item_tags(item_id);
CREATE INDEX idx_item_tags_tag ON item_tags(tag_id);
CREATE INDEX idx_categories_parent ON categories(parent_type);
```

### Analytics Engine

The analytics engine in `packages/shared/src/analytics/` computes wardrobe insights from SQLite data:

```typescript
// Cost per wear calculation
interface CostPerWear {
    itemId: string;
    itemName: string;
    purchasePrice: number;
    wearCount: number;
    costPerWear: number;  // price / wearCount (Infinity if never worn)
    daysOwned: number;
    wearsPerMonth: number;
}

function calculateCostPerWear(items: Item[]): CostPerWear[] {
    return items
        .filter(item => item.purchasePrice != null)
        .map(item => {
            const daysOwned = daysBetween(item.createdAt, new Date());
            const monthsOwned = Math.max(1, daysOwned / 30);
            return {
                itemId: item.id,
                itemName: item.name,
                purchasePrice: item.purchasePrice!,
                wearCount: item.wearCount,
                costPerWear: item.wearCount > 0
                    ? item.purchasePrice! / item.wearCount
                    : Infinity,
                daysOwned,
                wearsPerMonth: item.wearCount / monthsOwned,
            };
        })
        .sort((a, b) => a.costPerWear - b.costPerWear);
}

// Wardrobe summary
interface WardrobeSummary {
    totalItems: number;
    totalValue: number;
    categoryBreakdown: { type: string; count: number; percentage: number }[];
    seasonBreakdown: { season: string; count: number; percentage: number }[];
    colorPalette: { color: string; count: number }[];
    mostWorn: { itemId: string; itemName: string; wearCount: number }[];
    neverWorn: { itemId: string; itemName: string; daysOwned: number }[];
    donationCandidates: { itemId: string; itemName: string; lastWorn: string | null; value: number }[];
}
```

### Weather Integration

```typescript
// packages/shared/src/weather/client.ts
// Uses Open-Meteo — free, no API key, no signup, no tracking
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

async function fetchWeather(): Promise<DailyWeather> {
    // Step 1: Get approximate location from IP (no GPS needed)
    // ip-api.com returns city-level coords from IP — same privacy
    // level as visiting any website
    const geo = await fetch('http://ip-api.com/json/?fields=lat,lon');
    const { lat, lon } = await geo.json();

    // Step 2: Fetch weather for approximate location
    const weather = await fetch(
        `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
        `&temperature_unit=fahrenheit&timezone=auto`
    );
    const data = await weather.json();

    return {
        date: new Date().toISOString().split('T')[0],
        tempHighF: Math.round(data.daily.temperature_2m_max[0]),
        tempLowF: Math.round(data.daily.temperature_2m_min[0]),
        condition: weatherCodeToCondition(data.daily.weathercode[0]),
    };
}

// Cache weather daily — one fetch per day, stored in SQLite
async function getWeather(db: Database): Promise<DailyWeather> {
    const today = new Date().toISOString().split('T')[0];
    const cached = db.getWeatherCache(today);
    if (cached) return cached;

    const weather = await fetchWeather();
    db.setWeatherCache(weather);
    return weather;
}

// Temperature-to-season mapping for outfit suggestions
function suggestSeason(tempF: number): string[] {
    if (tempF >= 80) return ['summer'];
    if (tempF >= 65) return ['spring', 'summer'];
    if (tempF >= 50) return ['spring', 'fall'];
    if (tempF >= 35) return ['fall', 'winter'];
    return ['winter'];
}
```

### Privacy Architecture

- **Photos never leave the device.** All wardrobe photos stored in app sandbox. Background removal happens on-device via iOS Vision / Android ML Kit. No photo upload, no cloud processing.
- **One daily weather fetch.** IP-based geolocation gives city-level coordinates (same as any website visit). No GPS permissions requested. Weather data cached locally.
- **No analytics.** No Firebase, no Mixpanel, no crash reporting, no event tracking.
- **No account.** No email, no sign-up, no social login. Works immediately on launch.
- **No shopping recommendations.** The app identifies wardrobe gaps (e.g., "you have 15 tops but only 2 bottoms") but never suggests specific products or links to retailers.
- **No social features.** No outfit sharing feed, no community, no followers. Outfit sharing is explicit: user creates an image card and sends it manually via Messages/email.
- **SQLite on-device.** All data in app sandbox. No iCloud, no cloud backup, no sync.
- **Export is explicit.** JSON backup and outfit sharing are user-initiated actions.
- **No body measurements.** The app never asks for height, weight, body type, or clothing size preferences beyond what the user voluntarily tags per item.

---

## UI/UX Direction

### Design Language

- **Dark mode native** — Deep charcoal (#0F0F14) background, fashion-forward feel
- **Editorial aesthetic:** Clean, monochrome base with controlled accent colors — feels like a high-end fashion magazine's digital edition
- **Accent palette:**
    - Warm ivory (#F5F0EB) — primary text, card backgrounds, garment preview backgrounds
    - Muted gold (#C4A265) — favorites, premium actions, highlights
    - Soft sage (#8FA68C) — season indicators, wear tracking, positive stats
    - Dusty rose (#C4878E) — alerts, donation candidates, low-wear warnings
    - Cool slate (#6B7280) — secondary text, borders, inactive states
- **Typography:** Inter for UI text; DM Serif Display for item names and outfit titles (editorial feel)
- **Item cards:** Clean cutout photos on neutral backgrounds, minimal chrome, brand and category as subtle metadata below
- **Outfit previews:** Layered garment photos on a transparent grid — looks like a fashion mood board
- **No shield icons.** Privacy communicated through behavior, empty states, and copy. No "your data is safe" badges.

### Screen Flow

#### 1. Wardrobe Catalog (Home Tab)

Grid of clothing items with category filter chips.

```
+-------------------------------------+
| MyCloset               [+] [Camera] |
|-------------------------------------|
| [All] [Tops] [Bottoms] [Shoes] ... |
|                                     |
| 127 items                  [Grid/List]|
|                                     |
| +----------+ +----------+          |
| | [cutout] | | [cutout] |          |
| |          | |          |          |
| | Navy     | | White    |          |
| | Blazer   | | Linen    |          |
| | 47 wears | | 12 wears |          |
| +----------+ +----------+          |
| +----------+ +----------+          |
| | [cutout] | | [cutout] |          |
| |          | |          |          |
| | Black    | | Worn     |          |
| | Jeans    | | Sneakers |          |
| | 62 wears | | 89 wears |          |
| +----------+ +----------+          |
|                                     |
|-------------------------------------|
| [Wardrobe] [Outfits] [Cal] [Stats] |
+-------------------------------------+
```

- 2 or 3 column grid of cutout photos (background-removed)
- Category filter chips at top: All, Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories
- Wear count badge on each item
- Long-press for context menu: Favorite, Add to Outfit, Log Wear, Edit, Delete
- Sort toggle: Recently Added, Most Worn, Least Worn, Cost Per Wear
- Grid/List view toggle
- "+" button for manual add, Camera button for quick photo capture
- Empty state: "Photograph your first item" with camera CTA and tips for getting clean photos

#### 2. Add Item Flow

```
+-------------------------------------+
| Add Item                     Cancel |
|-------------------------------------|
|                                     |
| +-------------------------------+   |
| |                               |   |
| |     [Camera viewfinder]       |   |
| |                               |   |
| |  Lay item flat on a plain     |   |
| |  surface for best results     |   |
| |                               |   |
| +-------------------------------+   |
|                                     |
| [Take Photo]  [Choose from Photos]  |
|                                     |
+-------------------------------------+

         After photo taken:

+-------------------------------------+
| Add Item                     Cancel |
|-------------------------------------|
| +-------------------------------+   |
| | [Background removed preview]  |   |
| |                               |   |
| | [Retake]  [Manual Crop]  [OK] |   |
| +-------------------------------+   |
|                                     |
| Name: [Navy Blazer            ]     |
| Type: [Outerwear v]                 |
| Brand: [J.Crew               ]     |
| Color: [Navy] (auto-detected)      |
| Season: [All-Season v]             |
| Occasion: [Work v]                 |
|                                     |
| PURCHASE INFO (optional)            |
| Price: [$189.00]                    |
| Date:  [2024-03-15]                |
| Source: [Nordstrom]                 |
|                                     |
|         [Save Item]                 |
+-------------------------------------+
```

- Camera opens with tips overlay: "Lay item flat on a plain surface"
- After capture, background removal runs immediately (1-3 seconds)
- Preview shows cutout with checkerboard transparency background
- Auto-detected color swatch shown (from dominant color analysis)
- Minimal required fields: photo + name + type. Everything else optional.
- "Bulk Add" mode: quick-fire camera captures, items saved with photo only — user tags them later in batches

#### 3. Outfit Builder

```
+-------------------------------------+
| Build Outfit                  Done  |
|-------------------------------------|
|                                     |
| +---------------------------------+ |
| |                                 | |
| |    [Composed outfit preview]    | |
| |                                 | |
| |   +--------+                    | |
| |   |[blazer]|   +-------+       | |
| |   +--------+   |[shirt]|       | |
| |       +--------+-------+       | |
| |       | [jeans]        |       | |
| |       +----------------+       | |
| |          +--------+            | |
| |          |[shoes] |            | |
| |          +--------+            | |
| |                                 | |
| +---------------------------------+ |
|                                     |
| ADD FROM WARDROBE:                  |
| [Tops] [Bottoms] [Shoes] [More]    |
|                                     |
| +----+ +----+ +----+ +----+        |
| |item| |item| |item| |item|        |
| +----+ +----+ +----+ +----+        |
|                                     |
| Name: [Monday Work Look      ]     |
| [Work v]  [Fall v]                  |
|                                     |
|       [Save Outfit]                 |
+-------------------------------------+
```

- Top half: visual outfit composition area (items draggable/scalable)
- Bottom half: wardrobe browser filtered by category
- Tap an item in the browser to add it to the composition area
- Pinch-to-scale and drag-to-position in the composition area
- Name the outfit and tag with occasion + season
- "Surprise Me" button: randomly selects compatible items based on color harmony and occasion matching

#### 4. Outfit Calendar (Tab)

```
+-------------------------------------+
| February 2026               Today   |
|-------------------------------------|
| Mo Tu We Th Fr Sa Su               |
| -- -- -- -- -- 01 02               |
| 03 04 05 06 07 08 09               |
| 10 11 12 13 14 15 16               |
| 17 18 19 20 21 [22] 23             |
| 24 25 26 27 28                      |
|-------------------------------------|
|                                     |
| Today — Saturday, Feb 22           |
| 48F, Partly Cloudy                  |
|                                     |
| No outfit logged yet                |
|                                     |
| [Log Today's Outfit]                |
|                                     |
| RECENT                              |
| Feb 21: Navy Blazer + White Shirt  |
| Feb 20: Casual Friday Look         |
| Feb 19: All Black Outfit           |
|                                     |
|-------------------------------------|
| [Wardrobe] [Outfits] [Cal] [Stats] |
+-------------------------------------+
```

- Month calendar view with tiny outfit thumbnails in each logged day
- Tap a day to see what was worn (or log an outfit)
- Weather shown for today — helps with outfit planning
- "Log Today's Outfit" opens picker: choose a saved outfit or select individual items
- Wear streak shown: "14 day streak" (non-judgmental — just tracking)
- Scroll through past months

#### 5. Wardrobe Analytics (Tab)

```
+-------------------------------------+
| Wardrobe Stats                      |
|-------------------------------------|
|                                     |
| YOUR WARDROBE                       |
| 127 items | $4,230 total value      |
|                                     |
| CATEGORY BREAKDOWN                  |
| +-------------------------------+   |
| | [Pie chart: Tops 35%,        |   |
| |  Bottoms 20%, Shoes 15%,     |   |
| |  Outerwear 12%, Dresses 8%,  |   |
| |  Accessories 10%]            |   |
| +-------------------------------+   |
|                                     |
| COLOR PALETTE                       |
| [##] [##] [##] [##] [##] [##]     |
| Navy Black White Gray Beige Blue    |
|                                     |
| BEST COST PER WEAR                  |
| 1. Black Jeans — $0.48/wear        |
| 2. White T-Shirt — $0.52/wear      |
| 3. Navy Blazer — $4.02/wear        |
|                                     |
| DONATION CANDIDATES                 |
| 3 items not worn in 6+ months       |
| [View Items >]                      |
|                                     |
| INSIGHTS                            |
| "Your most-worn item is Black       |
|  Jeans (62 wears). You own 15       |
|  tops but only 6 bottoms — your    |
|  wardrobe leans top-heavy."         |
|                                     |
|-------------------------------------|
| [Wardrobe] [Outfits] [Cal] [Stats] |
+-------------------------------------+
```

- Summary cards at top: total items, total value, average cost per wear
- Pie chart for category breakdown (interactive — tap a slice to see items)
- Color palette strip: horizontal row of color swatches representing wardrobe
- Cost-per-wear leaderboard: top 5 best-value items
- Donation candidates: items not worn in 6+ months
- Text insights: auto-generated observations about wardrobe composition

### Onboarding Flow (First Launch)

1. **Welcome** — "Your wardrobe, your device. No uploads, no accounts, no shopping profiles." CTA: "Get Started"
2. **How it works** — Three-panel swipe: (1) "Photograph your clothes" with camera icon, (2) "We remove the background on your device" with before/after, (3) "Track, plan, analyze — all offline." CTA: "Add Your First Item"
3. **First item** — Camera opens with overlay tips: "Lay an item flat on a plain surface for the cleanest cutout." User photographs one item, sees background removal in action, tags it minimally.
4. **Done** — "Your first item is cataloged. It never leaves this device." Points to bulk add, outfit builder, and calendar as next steps.

Total onboarding: under 90 seconds including photographing one item.

---

## Monetization

### Pricing Model

**One-time purchase: $4.99**

No subscriptions. No ads. No in-app purchases. No affiliate links. No marketplace. Pay once, use forever.

### Revenue Projections (Conservative)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Downloads (free trial) | 80,000 | 200,000 | 400,000 |
| Conversion rate | 12% | 15% | 17% |
| Paid users | 9,600 | 30,000 | 68,000 |
| Revenue (after 30% App Store cut) | $33,600 | $105,000 | $237,930 |
| Cumulative paid users | 9,600 | 39,600 | 107,600 |

### Purchase Structure

- **Free trial:** Full functionality for 21 days. After trial, limited to 20 items and no analytics tab. Existing items remain accessible (read-only for items beyond the limit). This preserves data and creates natural conversion pressure when the wardrobe exceeds 20 items.
- **App Store / Play Store IAP:** $4.99 via RevenueCat
- **Direct purchase:** $4.99 via Lemon Squeezy (web version)

### Why $4.99 Works

1. **Stylebook proved the price point.** $4.99 one-time, 280K downloads per month, 15 years running. The market accepts this price for a wardrobe app.
2. **Less than a single clothing item.** Users routinely spend $30-100+ on clothing. A $4.99 tool that helps them wear what they already own is obvious value.
3. **Undercuts Cladwell's subscription.** Cladwell charges $7.99/month ($96/year). MyCloset costs $4.99 total — forever. The value comparison is devastating.
4. **Zero recurring costs.** No servers (one daily weather API call costs nothing). Pure margin after the App Store cut.
5. **Captures privacy-conscious segment.** The 45% who hesitate to use wardrobe apps due to privacy concerns don't have a good alternative. They'll pay $4.99 for the first wardrobe app that keeps photos on-device.

---

## Marketing Angle

### Core Message

**"Your wardrobe. Not their shopping profile."**

Secondary messages:
- "Wardrobe apps photograph everything you own. MyCloset keeps those photos on your device."
- "The closet app that doesn't try to sell you more clothes."
- "127 items in your closet. 0 uploaded to the cloud."

### The Privacy Angle

Wardrobe apps collect some of the most intimate personal data imaginable:
- **Photos of every clothing item you own** — revealing your economic status, style preferences, body size, brand affiliations
- **Outfit combinations** — revealing your daily routine, where you go, how you present yourself
- **Wear frequency** — revealing what you value, what you're insecure about, what events you attend
- **Purchase prices** — revealing your spending capacity and shopping habits

This data is gold for fashion retailers, advertisers, and data brokers. Cladwell uses it to train AI. Whering uses it to drive marketplace sales. Acloset turns it into a public social feed.

MyCloset's angle: "We process your clothing photos on your device and never see them. Your wardrobe is your business."

This isn't paranoia — the data wardrobe apps collect is genuinely more revealing than what most people realize. The privacy angle is both principled and sharply differentiated.

### Launch Channels

#### Reddit (Primary — organic)
- **r/capsulewardrobe** (200K+) — "I built a wardrobe app that does background removal on-device — your photos never leave your phone" (demo with before/after cutout screenshots)
- **r/femalefashionadvice** (2M+) — "I built a closet app with cost-per-wear tracking and outfit planning" (analytics screenshots)
- **r/minimalism** (1M+) — "I built a wardrobe tracker that helps you identify what to keep and what to donate"
- **r/privacy** (1.8M) — "A wardrobe app that doesn't upload your clothing photos to the cloud"
- **r/sustainablefashion** (100K+) — "Track your wardrobe to buy less and wear more"

#### Fashion/Lifestyle Creator Outreach
- Contact mid-tier lifestyle creators (10K-100K followers) who post capsule wardrobe content
- Demo video showing the on-device background removal and outfit builder
- Angle: "Show your audience a closet app that respects their privacy"

#### Content Marketing
- Blog post: "Why Your Wardrobe App Shouldn't Photograph Your Life for Advertisers"
- Blog post: "How On-Device Background Removal Works (And Why It Matters)"
- Blog post: "Stylebook Alternatives 2026: Cross-Platform Wardrobe Apps"
- Blog post: "The True Cost Per Wear: How to Track What You Actually Wear"

#### Product Hunt
- Category: Productivity, Fashion & Style
- Tagline: "Your wardrobe. Not their shopping profile."
- Demo video: 30-second screen recording of photographing an item -> background removal -> outfit builder -> analytics

#### App Store Optimization
- Keywords: wardrobe, closet, outfit planner, capsule wardrobe, closet organizer, outfit tracker, cost per wear, wardrobe manager, closet app, outfit app
- Subtitle: "Organize, Plan, Track — All On-Device"
- Screenshots: background removal demo, outfit builder, calendar, analytics dashboard, wardrobe grid

#### TikTok Organic
- "Watch me catalog my entire wardrobe in 20 minutes" (bulk add mode demo)
- "My wardrobe app told me I've worn these jeans 62 times" (cost-per-wear reveal)
- "POV: Your closet app doesn't upload your photos to the cloud" (privacy angle)

---

## MVP Timeline

### Pre-Development (Week 0)
- Finalize design tokens and component library spec
- Set up Turborepo monorepo with pnpm
- Configure shared TypeScript, ESLint, Prettier configs
- Create SQLite schema with seed data (default categories)
- Research iOS Vision and Android ML Kit Subject Segmentation APIs
- Build proof-of-concept background removal on both platforms
- Test background removal quality with 20+ garment types (shirts, pants, shoes, etc.)

### Phase 1: Foundation (Weeks 1-2)
- Implement SQLite database layer with all tables
- Build item CRUD operations in `packages/shared`
- Create Expo native module for iOS Vision background removal
- Create Expo native module for Android ML Kit background removal
- Build background removal bridge (`packages/shared/src/background-removal/`)
- Create design token system and base UI components in `packages/ui`
- Build color detection from garment photos (dominant color extraction)
- Unit tests for database operations and color detection

### Phase 2: Wardrobe Catalog UI (Weeks 3-4)
- Build Wardrobe Catalog tab (grid of cutout photos)
- Build Add Item flow: camera capture -> background removal -> tagging form
- Build Item Detail view with photo, metadata, wear history
- Implement favorites toggle
- Build category filter chips and sort options
- Build bulk add mode (rapid capture, tag later)
- Implement item edit and delete
- Wire all views to SQLite database
- Build settings screen (preferences, export/import)

### Phase 3: Outfit Builder (Weeks 5-6)
- Build Outfits tab (visual outfit grid)
- Build Outfit Builder screen with composition area
- Implement drag-and-drop/tap-to-add for outfit composition
- Implement pinch-to-scale and position in composition area
- Build outfit preview renderer (layered garment images)
- Implement "Surprise Me" random outfit generator
- Build outfit templates (Work, Casual, Formal, Active)
- Build outfit detail view with item list and metadata
- Implement outfit CRUD operations

### Phase 4: Calendar & Weather (Weeks 7-8)
- Build Calendar tab with month view
- Implement wear logging: select outfit or individual items for a day
- Build wear log detail view
- Integrate Open-Meteo weather API with IP-based location
- Implement weather caching in SQLite
- Show weather on calendar and outfit planning screens
- Build temperature-based season filtering for outfit suggestions
- Update item wear_count and last_worn_at denormalized fields via triggers
- Unit tests for weather client and wear tracking

### Phase 5: Analytics & Polish (Weeks 9-10)
- Build Analytics tab with summary cards
- Implement cost-per-wear calculator
- Build category breakdown pie chart
- Build color palette visualization
- Build wear frequency rankings (most/least worn)
- Implement donation candidate identification
- Build text insight generator
- Build search with full-text and multi-filter
- Implement JSON export/import (full backup/restore)
- Implement outfit sharing (composed image card)
- Build onboarding flow (4-step wizard)
- Polish animations, haptics, and transitions
- Performance optimization: wardrobe grid scroll with 300+ items
- Accessibility audit (VoiceOver support)

### Phase 6: Launch Prep (Weeks 11-12)
- App Store and Play Store screenshots and metadata
- Write store descriptions and keywords
- Set up RevenueCat for IAP (iOS + Android)
- Set up Lemon Squeezy for direct sales
- Build simple marketing landing page
- Record 30-second demo video (photograph -> cutout -> outfit -> analytics)
- Beta test with 30+ users (mix of capsule wardrobe enthusiasts and general users)
- Fix bugs from beta feedback
- Test on 10+ device models (iOS and Android)
- Submit to App Store and Play Store review

### Phase 7: Launch (Week 13)
- App Store + Play Store release
- Product Hunt launch
- Reddit posts (r/capsulewardrobe, r/femalefashionadvice, r/minimalism, r/privacy)
- Creator outreach (10 initial contacts)
- Begin content marketing cadence
- TikTok demo videos

### Post-MVP Roadmap (Not in scope for MVP)
- iPad-optimized layout (2-column wardrobe view)
- Mac App Store release
- Packing list builder (select items for a trip, check off as you pack)
- Style statistics over time (how your wardrobe composition changes month-to-month)
- Laundry tracking (mark items as "in the wash" so they're excluded from outfit suggestions)
- Virtual try-on (overlay garments on a silhouette — on-device, no body photos uploaded)
- Import from other apps (Stylebook export, Cladwell export if available)
- QR code sharing (scan to import a single outfit between MyCloset users)
- Widget showing today's weather + outfit suggestion
- Dark/light theme toggle (MVP is dark-only)
- Localization (10+ languages)
- Seasonal rotation reminders ("Time to swap your winter wardrobe in?")
- Outfit rating system (rate outfits after wearing to improve "Surprise Me" suggestions)

---

## Acceptance Criteria

### Functional Requirements

1. **Item cataloging:** User can photograph a clothing item, background is automatically removed on-device (iOS 17+ Vision / Android ML Kit), and the cutout is saved locally. User can name, categorize, tag, and add purchase info. All data persisted in SQLite.
2. **Background removal quality:** On-device background removal produces a clean cutout for at least 80% of garment types (laid flat on a plain surface). Manual crop fallback available for difficult items.
3. **Wardrobe grid:** Home tab displays all items as cutout photos in a scrollable grid. Category filter chips filter in <50ms. Sort by wear count, cost per wear, recency in <100ms for 300 items.
4. **Outfit builder:** User can compose outfits by selecting items from the wardrobe. Items appear in a visual composition area. User can position and scale items. Outfits saved with name, occasion, and season tags.
5. **Wear tracking:** User can log which items/outfit they wore on any day. Wear count auto-increments. Calendar view shows outfit history. Item detail view shows complete wear history with dates.
6. **Weather integration:** App fetches weather once daily via IP-based geolocation. Temperature and condition shown on calendar and outfit planning screens. Season-appropriate items highlighted based on current temperature.
7. **Wardrobe analytics:** Cost-per-wear calculated for all items with purchase prices. Category breakdown shown as pie chart. Color palette visualized. Most/least worn items ranked. Donation candidates identified (0 wears in 6+ months). Text insights generated.
8. **Search and filter:** Full-text search across item names, brands, and tags returns results in <100ms for 300 items. Multi-filter by type, color, season, occasion with AND logic.
9. **Favorites:** User can star/unstar items and outfits. Favorites filter shows only starred items.
10. **Export/Import:** User can export all wardrobe data as JSON and import from a JSON backup. Individual outfits can be shared as composed image cards.

### Non-Functional Requirements

11. **Privacy:** App makes no network requests except for the daily weather fetch (IP-based, no GPS). No analytics, no telemetry, no crash reporting. All photos stored locally. Background removal runs on-device. Verified by proxy monitoring.
12. **Performance:** Wardrobe grid scrolls at 60fps with 300+ items and cutout photos. Background removal completes in <3 seconds on iPhone 15 / Pixel 8. Analytics calculations for 300 items complete in <500ms.
13. **Offline:** All wardrobe browsing, outfit building, calendar, analytics, and search work with no network connection. Only weather requires connectivity (gracefully degrades to last cached value).
14. **Storage efficiency:** Background-removed photos compressed to ~50-100KB each as PNG. A 200-item wardrobe uses <50MB of storage total.
15. **Data integrity:** No data loss during item editing, photo processing, or app crashes. SQLite WAL mode for concurrent read/write safety.
16. **Platform:** Runs on iOS 16+ (background removal requires iOS 17+; older devices get manual crop) and Android 13+.

### Launch Requirements

17. **App Store + Play Store approval:** Passes Apple and Google review on first submission.
18. **Payment flow:** RevenueCat IAP works end-to-end on both platforms (purchase, restore, free trial).
19. **Background removal tested:** At least 10 garment types tested on 5+ device models per platform. 80%+ success rate for clean cutouts on plain backgrounds.
20. **Onboarding:** New user can photograph and catalog their first item in under 90 seconds from first launch.
21. **Beta validation:** At least 25 beta testers have used the app for 1+ week, cataloging 20+ items each, with no data loss.
22. **Cross-platform parity:** iOS and Android apps have identical feature sets (aside from platform-specific background removal implementations).
