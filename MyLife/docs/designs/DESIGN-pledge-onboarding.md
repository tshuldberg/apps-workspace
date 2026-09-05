# Design Spec: Pledge Onboarding Screen & Privacy Dashboard

**Status:** Spec complete, ready for implementation
**Source:** P1-2b task, Anti-Enshittification Pledge (docs/business-plan/anti-enshittification-pledge.md)
**Design system:** Cool Obsidian (DESIGN.md)

---

## 1. Pledge Onboarding Screen

Shown once during the first-run onboarding flow. This is a promise TO the user, not a consent form FROM them. The tone is confident and direct: "Here is what we will never do."

### Screen: `PledgeOnboardingScreen`

**When shown:** After welcome screen, before module selection. Part of the `packages/onboarding` flow state machine.
**Platforms:** Mobile (Expo) and Web (Next.js)
**Scrollable:** Yes (ScrollView mobile, overflow-y web). Content fits most screens without scrolling but accommodates smaller devices.

### Layout (top to bottom)

#### 1.1 Shield Icon

- Centered shield icon or custom illustration
- Size: 64px
- Color: `colors.accent` (`#3B82F6`)
- Margin bottom: `spacing.md` (16px)
- Accessible label: "Privacy shield"

#### 1.2 Headline

```
Our Promise to You
```

- Typography: `heroTitle` (36px, weight 800)
- Color: `colors.text` (`#F0F0F5`)
- Text align: center
- Margin bottom: `spacing.xs` (4px)

#### 1.3 Subheadline

```
MyLife is built on seven commitments that protect your data,
your money, and your right to leave.
```

- Typography: `body` (16px/26px LH, weight 400)
- Color: `colors.textSecondary` (`rgba(240,240,245,0.65)`)
- Text align: center
- Max width: 360px (centered)
- Margin bottom: `spacing.lg` (24px)

#### 1.4 Commitment Rows (Glass Card)

Single glass card containing all seven commitment rows.

**Card:**
- Background: `glass.card` (`rgba(255,255,255,0.04)`)
- Border: 1px `glassBorder` (`rgba(255,255,255,0.10)`)
- Border radius: `borderRadius.xl` (16px)
- Padding: `spacing.md` (16px)
- Mobile: `expo-blur` BlurView. Web: `backdrop-filter: blur(40px) saturate(180%)`

**Each row:**
- Layout: horizontal, icon left + text right
- Icon: 24px, color `colors.success` (`#30D158`)
- Text: `body` (16px), color `colors.text`
- Row padding: `spacing.sm` (8px) vertical
- Separator: 1px `colors.border` between rows (not after last)

| # | Icon | Text |
|---|------|------|
| 1 | circle-slash (ad block) | No advertisements. Ever. |
| 2 | lock-closed | We will never sell your data. |
| 3 | shield-check | Free features stay free forever. |
| 4 | download | Export all your data, anytime. |
| 5 | trash-2 | Delete everything with one button. |
| 6 | sliders | Your content, your filters. |
| 7 | door-open | The exit door is always open. |

**Icon set:** @tabler/icons-react (web) / @tabler/icons-react-native or equivalent SF Symbols mapping (mobile). Prefer outline style for consistency with Cool Obsidian.

#### 1.5 Full Pledge Link

```
Read the full pledge
```

- Typography: `caption` (13px, weight 500)
- Color: `colors.accent` (`#3B82F6`)
- Tappable: opens `anti-enshittification-pledge.md` rendered as a scrollable modal or navigates to a pledge detail screen
- Margin top: `spacing.sm` (8px)
- Margin bottom: `spacing.lg` (24px)

#### 1.6 Continue Button

```
I Understand
```

- Style: Primary button
- Background: `colors.accent` (`#3B82F6`)
- Text: `colors.background` (`#0A0A0F`), 16px weight 600
- Border radius: `borderRadius.md` (8px)
- Width: 100%, max-width 360px, centered
- Height: 52px (touch target)
- Active state: `scale(0.97)` + opacity 0.85
- Margin bottom: `spacing.md` (16px)

**Important:** No checkbox. No "I agree." This is a promise FROM us, not a legal acknowledgment from the user. The button simply advances onboarding.

#### 1.7 Footer Note

```
You can review this pledge anytime in Settings > Privacy.
```

- Typography: `caption` (13px)
- Color: `colors.textTertiary` (`rgba(240,240,245,0.35)`)
- Text align: center

### Screen Background

- Background: `colors.background` (`#0A0A0F`)
- Safe area insets respected on mobile
- Content container padding: `spacing.xl` (32px) horizontal, `spacing.xxl` (48px) top

### Behavior

- Shown exactly once per install (tracked via `hub_preferences` key `pledge_acknowledged`)
- Pressing "I Understand" writes `setPreference(db, 'pledge_acknowledged', 'true')` and advances to the next onboarding step
- Pressing "Read the full pledge" opens a modal with the full pledge markdown rendered
- Back navigation: allowed (returns to welcome screen)
- No skip button. Every user sees this.

### Accessibility

- VoiceOver reads the shield icon, then headline, then each commitment row as a list
- Commitment rows use `accessibilityRole="list"` / `accessibilityRole="listitem"`
- Continue button: `accessibilityLabel="I understand the privacy pledge. Continue."`
- Minimum contrast: all text meets WCAG 2.1 AA against `#0A0A0F` background

---

## 2. Privacy Dashboard

A hub-level Settings screen showing real-time compliance status. Not a module. Lives under Settings > Privacy.

### Screen: `PrivacyDashboardScreen`

**Location:** `apps/mobile/app/(hub)/settings/privacy.tsx` and `apps/web/app/settings/privacy/page.tsx`
**Scrollable:** Yes
**Data source:** Reads from `ModuleRegistry` (enabled modules, storageType) and `hub_preferences`

### Layout (top to bottom)

#### 2.1 Header

```
Privacy Dashboard
```

- Typography: `heading` (24px, weight 700)
- Color: `colors.text`
- Margin bottom: `spacing.md` (16px)

#### 2.2 Compliance Status Card

A prominent glass card showing four real-time compliance indicators.

**Card:**
- Background: `glass.strong` (`rgba(255,255,255,0.08)`)
- Border: 1px `glassBorder`
- Border radius: `borderRadius.xl` (16px)
- Padding: `spacing.md` (16px)

**Each indicator row:**
- Layout: icon (left) + label (center, flex) + status badge (right)
- Icon: 20px, color matches status
- Label: `body` (16px), color `colors.text`
- Badge: pill shape (`borderRadius.pill`), small text
- Row gap: `spacing.sm` (8px) vertical
- Separator: 1px `colors.border` between rows

| Indicator | Icon | Status Logic | Green State | Concern State |
|-----------|------|-------------|-------------|---------------|
| Data stored locally | database | Check if all enabled modules are `sqlite` | "All Local" (green pill) | "N modules use cloud" (amber pill) |
| Analytics & telemetry | activity | Always true (hardcoded) | "None" (green pill) | N/A |
| Data export | download | Always true (feature exists) | "Available" (green pill) | N/A |
| Ads shown | circle-slash | Always true (hardcoded) | "None. Ever." (green pill) | N/A |

**Status pill colors:**
- Green: background `colors.success` at 15% opacity, text `colors.success` (`#30D158`)
- Amber (cloud modules active): background `#F59E0B` at 15% opacity, text `#F59E0B`
  - Amber is informational, not a warning. Cloud modules are expected for social features.

**Tapping the "N modules use cloud" pill:** Scrolls to the cloud module detail section below.

#### 2.3 Data Actions Card

**Card:** Standard glass card (`glass.card`)

Two action rows:

**Export All Data**
- Layout: icon (download, 20px) + label + chevron-right
- Label: `body`, "Export All Data"
- Sublabel: `caption`, `colors.textSecondary`, "CSV, JSON, and Markdown. Every module."
- Tap: navigates to export screen (existing or planned)
- Chevron: `colors.textTertiary`

**Delete All Data**
- Layout: icon (trash-2, 20px, `colors.danger`) + label + chevron-right
- Label: `body`, color `colors.danger`, "Delete All My Data"
- Sublabel: `caption`, `colors.textSecondary`, "Permanently removes everything. Cannot be undone."
- Tap: shows confirmation dialog (two-step: confirm + type "DELETE")
- Separator: 1px `colors.border` above this row

#### 2.4 Section Header: Per-Module Data Summary

```
What Each Module Stores
```

- Typography: `subheading` (18px, weight 600)
- Color: `colors.text`
- Margin top: `spacing.lg` (24px)
- Margin bottom: `spacing.sm` (8px)

#### 2.5 Module Data Cards (list)

One card per enabled module, sorted alphabetically. Shows what data the module stores and where.

**Card:** Standard glass card, collapsed by default (shows summary line), expandable on tap.

**Collapsed state:**
- Layout: module icon (emoji, 24px) + module name + storage badge (right)
- Module name: `body`, color `colors.text`
- Storage badge:
  - `sqlite`: green pill, "On Device"
  - `supabase`: amber pill, "Cloud"
  - `drizzle`: amber pill, "Cloud"
- Chevron-down indicator on right (rotates to chevron-up when expanded)

**Expanded state (below the collapsed header):**
- Table prefix shown: `caption`, `colors.textTertiary`, e.g. "Tables: bk_*"
- Data categories listed as bullet rows:
  - Each row: dot indicator + description
  - Typography: `caption` (13px), color `colors.textSecondary`
  - Example for Books: "Library and reading lists", "Ratings and reviews (private)", "Reading sessions and page progress", "Import history"
- For cloud modules, add a highlighted info row:
  - Background: `colors.glass` with 1px amber border
  - Icon: cloud, color `#F59E0B`
  - Text: describes what goes to the server vs what stays local
  - Example for Forums: "Posts and replies sync to the server for community visibility. Bookmarks and drafts stay on device."
  - Example for Surf: "Spot ratings sync for the community. Saved spots and session logs stay on device."
  - Example for Homes: "Property data syncs for multi-device access. Search history stays on device."

**Module data descriptions (source of truth for implementation):**

| Module | Storage | Data Categories |
|--------|---------|----------------|
| Books | sqlite | Library catalog, reading lists, ratings/reviews, reading sessions, import history |
| Budget | sqlite | Accounts, envelopes, transactions, recurring rules, debt payoff plans |
| Car | sqlite | Vehicles, service records, fuel logs, reminders |
| Closet | sqlite | Wardrobe items, outfits, categories |
| Cycle | sqlite | Period logs, symptoms, predictions |
| Fast | sqlite | Fasting sessions, streaks, settings |
| Flash | sqlite | Decks, cards, study sessions, performance stats |
| Forums | supabase | **Cloud:** posts, replies, votes, community memberships. **Local:** bookmarks, drafts, read state |
| Garden | sqlite | Plants, care journal, zones, seed inventory |
| Habits | sqlite | Habits, completions, streaks, timed sessions, measurements |
| Health | sqlite | Vitals, body measurements, health events |
| Homes | drizzle | **Cloud:** property listings, saved searches. **Local:** search history, preferences |
| Journal | sqlite | Journal entries, tags, moods |
| Mail | sqlite | Email summaries, labels, action items (local cache) |
| Market | supabase | **Cloud:** listings, conversations, reviews. **Local:** watchlist, drafts, saved searches |
| Meds | sqlite | Medications, doses, reminders, refills, interactions, mood/side-effect logs |
| Mood | sqlite | Mood entries, activities, notes |
| Notes | sqlite | Notes, folders, tags |
| Nutrition | sqlite | Food logs, meals, nutrient totals |
| Pets | sqlite | Pet profiles, vet visits, medications, weight logs |
| Recipes | sqlite | Recipes, collections, pantry, grocery lists, meal plans |
| RSVP | sqlite | Events, RSVPs, guest lists |
| Stars | sqlite | Ratings, reviews, lists |
| Subs | sqlite | Subscriptions, renewal dates, costs, categories |
| Surf | supabase | **Cloud:** spot ratings, session reports. **Local:** saved spots, session logs, forecast cache |
| Trails | sqlite | Hikes, trail logs, GPS tracks |
| Voice | sqlite | Voice memos, transcriptions, tags |
| Words | sqlite | Vocabulary, study sessions, progress |
| Workouts | sqlite | Exercises, workouts, body measurements, progress photos |

#### 2.6 Section Header: The Pledge

```
The Anti-Enshittification Pledge
```

- Typography: `subheading` (18px, weight 600)
- Color: `colors.text`
- Margin top: `spacing.lg` (24px)
- Margin bottom: `spacing.sm` (8px)

#### 2.7 Pledge Summary Card

**Card:** Glass card with a subtle accent-colored left border (4px, `colors.accent`)

Content:
```
MyLife is built on seven commitments that protect your data,
your money, and your right to leave.
```

- Typography: `body`, color `colors.text`
- Below: "Read the full pledge" link (`caption`, `colors.accent`), opens the full pledge viewer

#### 2.8 Pledge Version Footer

```
Pledge version 1.0 -- Any changes will be documented publicly.
```

- Typography: `caption` (13px)
- Color: `colors.textTertiary`
- Text align: center
- Margin top: `spacing.md`
- Margin bottom: `spacing.xxl` (48px) for scroll padding

---

## 3. Implementation Notes

### Data Sources

The Privacy Dashboard reads live data, not static content:

```typescript
// Compliance indicators
const enabledModules = registry.getEnabled(); // ModuleId[]
const cloudModules = enabledModules.filter(id => {
  const def = registry.get(id);
  return def?.storageType === 'supabase' || def?.storageType === 'drizzle';
});
const allLocal = cloudModules.length === 0;

// Per-module storage info
const moduleInfo = enabledModules.map(id => ({
  id,
  name: registry.get(id)!.name,
  icon: registry.get(id)!.icon,
  storageType: registry.get(id)!.storageType,
  tablePrefix: registry.get(id)!.tablePrefix,
}));
```

### Delete All Data Flow

1. User taps "Delete All My Data"
2. Confirmation modal: "This will permanently delete all data across all modules. This cannot be undone."
3. User types "DELETE" in a text input to confirm
4. App drops all module tables, clears hub tables, resets preferences
5. App restarts to fresh onboarding state

### File Structure

```
apps/mobile/app/(hub)/settings/privacy.tsx    # Mobile Privacy Dashboard
apps/web/app/settings/privacy/page.tsx         # Web Privacy Dashboard
packages/onboarding/src/screens/pledge.tsx     # Onboarding pledge screen (shared logic)
```

### Tokens Reference (Quick Lookup)

| Token | Value | Used For |
|-------|-------|----------|
| `colors.background` | `#0A0A0F` | Screen background |
| `colors.surface` | `#12121A` | Card interiors |
| `colors.text` | `#F0F0F5` | Primary text |
| `colors.textSecondary` | `rgba(240,240,245,0.65)` | Supporting text |
| `colors.textTertiary` | `rgba(240,240,245,0.35)` | Footer text, placeholders |
| `colors.accent` | `#3B82F6` | CTA button, links |
| `colors.success` | `#30D158` | Green compliance indicators |
| `colors.danger` | `#FF453A` | Delete button, destructive |
| `glass.card` | `rgba(255,255,255,0.04)` | Standard cards |
| `glass.strong` | `rgba(255,255,255,0.08)` | Compliance status card |
| `glassBorder` | `rgba(255,255,255,0.10)` | Card borders |
| `spacing.xs` | 4px | Tight gaps |
| `spacing.sm` | 8px | Row padding |
| `spacing.md` | 16px | Card padding, standard gaps |
| `spacing.lg` | 24px | Section spacing |
| `spacing.xl` | 32px | Screen horizontal padding |
| `spacing.xxl` | 48px | Top padding, scroll footer |
| `borderRadius.md` | 8px | Buttons |
| `borderRadius.xl` | 16px | Cards |
| `borderRadius.pill` | 999px | Status badges |
