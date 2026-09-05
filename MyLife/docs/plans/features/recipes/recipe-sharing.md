# Feature Spec: Recipe Sharing

## Metadata
- **Module:** recipes
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [2] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Recipe sharing is how recipe apps grow organically. Users want to text a recipe to a friend, send it in a group chat, or post it on social media. Without sharing, recipes are trapped inside the app. Sharing also serves as an acquisition channel: recipients see "Shared from MyLife" branding and may download the app. The cross-module score (2) reflects potential integration with the RSVP module (sharing event menus) and the Forums module (posting recipes in communities).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AnyList | Yes | Free | Share via link (web preview), text message, email, social media |
| Forkee | Yes | Free | Social sharing, share to TikTok/Instagram, in-app recipe feed |
| Paprika | Partial | No | Export as text/email only, no shareable links or previews |
| Recipe One | No | N/A | No sharing |

### Target User
Home cooks who want to share recipes with family and friends. Primary channels: iMessage, WhatsApp, email. Secondary: social media (Instagram Stories, Facebook). The key insight is that sharing should be zero-friction (one tap) and the recipient should NOT need the app installed to view the recipe.

## Technical Context

### Where This Lives in MyLife

```
modules/recipes/src/
  share/
    recipe-share.ts                  -- NEW: generates shareable formats (text, HTML, JSON)
    recipe-share.test.ts             -- NEW: unit tests
  types.ts                           -- ADD ShareFormat, ShareableRecipe types
  index.ts                           -- ADD exports

apps/mobile/app/(recipes)/
  recipe-detail.tsx                  -- MODIFIED: enhance Share button in action bar
  components/ShareSheet.tsx          -- NEW: custom share options (text, image card, full recipe)

apps/web/app/recipes/
  [id]/page.tsx                      -- MODIFIED: add share button
  share/[token]/page.tsx             -- NEW: public shareable recipe page (no auth required)
```

### Wireframe Position

```
Hub Dashboard
  └── MyRecipes card
       └── Recipes tab
            └── Recipe Detail
                 └── Action bar
                      └── Share ← YOU ARE HERE
                           ├── Share as Text (plain text, all messaging apps)
                           ├── Share as Card (image with recipe summary)
                           ├── Share Link (opens in browser, no app needed)
                           └── Copy to Clipboard
```

### Data Model

```sql
-- New table: rc_share_tokens (V6 migration)
CREATE TABLE IF NOT EXISTS rc_share_tokens (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES rc_recipes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rc_share_tokens_token_idx ON rc_share_tokens(token);
CREATE INDEX IF NOT EXISTS rc_share_tokens_recipe_idx ON rc_share_tokens(recipe_id);
```

The share token system enables link-based sharing without requiring the recipient to have the app. A token maps to a recipe and resolves to a public web page.

### Dependencies
- **Internal:** `@mylife/recipes` (getRecipeById, getStructuredIngredients, getSteps, getTags, formatQuantity, formatDuration)
- **External:**
  - Mobile: expo-sharing (native share sheet), react-native-view-shot (recipe card image generation)
  - Web: Web Share API, navigator.clipboard
- **Cross-Module:** RSVP module (future: share event menus), Forums module (future: post recipes to communities)

## Functional Requirements

### User Stories
1. As a home cook, I want to share a recipe via iMessage so my friend can cook it tonight.
2. As a recipe creator, I want to share a beautiful recipe card image on Instagram Stories.
3. As a recipe sharer, I want the recipient to view my recipe in a browser without installing an app.
4. As a privacy-conscious user, I want to control which recipes I share and be able to revoke shared links.

### Behavior Specification

**Share as Text:**
1. User taps Share on recipe detail.
2. ShareSheet appears with options: "Share as Text", "Share as Card", "Share Link", "Copy to Clipboard."
3. User taps "Share as Text."
4. System generates a formatted plain text version of the recipe:
   ```
   Chicken Tikka Masala
   Prep: 20 min | Cook: 40 min | Serves: 4

   Ingredients:
   - 2 lbs chicken breast, cubed
   - 1 cup yogurt
   ...

   Steps:
   1. Marinate chicken in yogurt and spices for 30 minutes.
   2. ...

   Shared from MyLife
   ```
5. Native share sheet opens. User selects messaging app.

**Share as Card:**
1. User taps "Share as Card."
2. System renders a recipe card image (recipe title, photo if available, key stats, ingredient count).
3. Card is styled with MyLife branding (Cool Obsidian dark theme or clean white).
4. Native share sheet opens with the image.

**Share Link:**
1. User taps "Share Link."
2. System generates a unique share token and stores it in `rc_share_tokens`.
3. System constructs a share URL: `https://mylife.app/recipes/share/[token]` (or a placeholder URL pattern until the web app is deployed).
4. Native share sheet opens with the URL.
5. When the recipient opens the link, the web app renders a public recipe page (no auth required).
6. The public page shows: title, photo, metadata, ingredients, steps, and a "Get MyLife" CTA.

**Copy to Clipboard:**
1. User taps "Copy to Clipboard."
2. Same formatted text as "Share as Text" is copied to the clipboard.
3. Toast confirmation: "Recipe copied to clipboard."

### Edge Cases

- Recipe with no ingredients or steps: share text says "No ingredients listed" / "No steps listed."
- Recipe with image_uri: include in card image. If image_uri is a local file path, skip it in shared card.
- Very long recipe (30+ ingredients, 20+ steps): text format handles any length. Card image shows truncated ingredient count.
- Share token collision: use UUIDv4, collision is astronomically unlikely.
- Share link opened offline: show "You're offline. Connect to view this recipe."
- Share link with expired/revoked token: show "This shared recipe is no longer available."
- Share link token not found: show 404 "Recipe not found."
- User shares, then deletes the recipe: ON DELETE CASCADE removes the share token. Link returns 404.
- No network for Share Link generation: share link requires future web infrastructure. For now, generate token locally and include in text with a note that link sharing requires the web app.
- Module disabled: share button hidden (standard module lifecycle).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Share button appears in the recipe detail action bar.
- [ ] **AC-2:** Tapping Share shows a ShareSheet with Text, Card, Link, and Clipboard options.
- [ ] **AC-3:** "Share as Text" generates formatted plain text and opens the share sheet.
- [ ] **AC-4:** Shared text includes title, times, servings, ingredients, steps, and "Shared from MyLife."
- [ ] **AC-5:** "Share as Card" generates a styled image with recipe summary.
- [ ] **AC-6:** "Share Link" generates a unique share token and shareable URL.
- [ ] **AC-7:** "Copy to Clipboard" copies recipe text and shows a toast confirmation.
- [ ] **AC-8:** Public share page renders the recipe without requiring login.
- [ ] **AC-9:** Public share page includes a "Get MyLife" download CTA.
- [ ] **AC-10:** Share page shows 404 for invalid/expired tokens.
- [ ] **AC-11:** Share card image uses MyLife branding.

### Technical Criteria
- [ ] **TC-1:** `generateShareText(recipe, ingredients, steps)` returns a formatted string.
- [ ] **TC-2:** `generateShareToken(db, recipeId)` creates a unique token in rc_share_tokens.
- [ ] **TC-3:** Share tokens use UUIDv4 format.
- [ ] **TC-4:** Public share page queries recipe by token via `rc_share_tokens`.
- [ ] **TC-5:** `rc_share_tokens.view_count` increments when the share page is viewed.
- [ ] **TC-6:** V6 migration creates `rc_share_tokens` table with indexes.
- [ ] **TC-7:** Card image generation produces a PNG/JPEG under 2MB.

### Negative Criteria
- [ ] **NC-1:** Share must NOT expose the user's database or other recipes.
- [ ] **NC-2:** Share must NOT include any private notes in the shared output.
- [ ] **NC-3:** Share links must NOT require the recipient to have an account.
- [ ] **NC-4:** Sharing must NOT automatically post to social media (user always chooses destination).

## UI Specification

### Mobile (Expo)
- Share button: share icon (Feather `share-2`) in the recipe detail action bar.
- ShareSheet: bottom sheet with 4 options in a grid:
  - Text (message icon) | Card (image icon)
  - Link (link icon) | Clipboard (copy icon)
- Each option: 48x48 icon on glass card, label below, accent green border on tap.
- Toast: "Recipe copied to clipboard" - textSecondary on glass background, auto-dismisses 2s.
- Share card image: 1080x1350px (Instagram portrait), recipe photo (top 50%), title and stats overlay (bottom 50%), MyLife logo watermark.

### Web (Next.js)
- Share button: in action bar, uses Web Share API if available, fallback to copy-to-clipboard.
- Public share page (`/recipes/share/[token]`): clean, minimal layout.
  - White background with subtle gray border.
  - Recipe photo (if available), title, metadata, ingredients, steps.
  - "Get MyLife" CTA button at bottom linking to app store.
  - No sidebar, no navigation (standalone page).

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Default | Share button in action bar | Recipe detail loaded |
| Sheet Open | ShareSheet with 4 options | Share button tapped |
| Sharing | Native share sheet / clipboard toast | Option selected |
| Public Page | Recipe content + Get MyLife CTA | Share link opened |
| Error (404) | "Recipe not found" | Invalid share token |
| Offline | "Connect to view this recipe" | Share page opened offline |

## Test Requirements

### Unit Tests
- [ ] `generateShareText`: includes title, ingredients, steps in correct format
- [ ] `generateShareText`: omits empty sections gracefully
- [ ] `generateShareText`: includes "Shared from MyLife" footer
- [ ] `generateShareText`: formats quantities using formatQuantity
- [ ] `generateShareText`: formats times using formatDuration
- [ ] `generateShareToken`: creates a valid UUIDv4 token
- [ ] `generateShareToken`: stores token in rc_share_tokens with recipe_id
- [ ] `getRecipeByShareToken`: returns recipe for valid token
- [ ] `getRecipeByShareToken`: returns null for invalid token
- [ ] `getRecipeByShareToken`: increments view_count
- [ ] `generateShareText`: excludes recipe notes (private)

### Integration Tests
- [ ] Full flow: tap share -> select text -> share sheet opens with formatted recipe
- [ ] Link flow: generate token -> open URL -> recipe displays on public page
- [ ] Delete flow: delete recipe -> share link returns 404

### QA Verification Script

1. Open the app on iOS simulator.
2. Navigate to MyRecipes > open a recipe with ingredients and steps.
3. Verify: Share button appears in action bar -- corresponds to AC-1.
4. Tap Share.
5. Verify: ShareSheet appears with Text, Card, Link, Clipboard options -- corresponds to AC-2.
6. Tap "Share as Text."
7. Verify: Native share sheet opens with formatted recipe text -- corresponds to AC-3.
8. Verify: Text includes title, ingredients, steps, and "Shared from MyLife" -- corresponds to AC-4.
9. Cancel share sheet. Tap Share again.
10. Tap "Share as Card."
11. Verify: Share sheet opens with a styled recipe card image -- corresponds to AC-5.
12. Cancel. Tap Share > "Share Link."
13. Verify: Share sheet opens with a URL containing a token -- corresponds to AC-6.
14. Cancel. Tap Share > "Copy to Clipboard."
15. Verify: Toast shows "Recipe copied to clipboard" -- corresponds to AC-7.
16. Open the web app. Navigate to the share URL from step 12.
17. Verify: Public page shows the recipe without requiring login -- corresponds to AC-8.
18. Verify: "Get MyLife" CTA appears at the bottom -- corresponds to AC-9.
19. Navigate to a share URL with an invalid token.
20. Verify: 404 page appears -- corresponds to AC-10.
21. Verify: Card image has MyLife branding -- corresponds to AC-11.

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate share flow, verify all share options and public page

### Post-merge:
- [ ] `/parity-check` -- recipes module has archived standalone

## Handoff State

### Before This Work
- Recipe detail screens exist with action bars (edit, delete).
- No share functionality exists.
- No public recipe pages exist.
- `formatQuantity` and `formatDuration` exist for display formatting.

### After This Work
- `generateShareText(recipe, ingredients, steps)` produces formatted plain text.
- `generateShareToken(db, recipeId)` creates share tokens.
- `getRecipeByShareToken(db, token)` resolves tokens to recipes.
- ShareSheet component on mobile with 4 share options.
- Public share page on web.
- V6 migration adds `rc_share_tokens` table.
- `schemaVersion` bumped to 6 in definition.ts.

### Files Changed
- `modules/recipes/src/share/recipe-share.ts` -- NEW: share text + token generation
- `modules/recipes/src/share/recipe-share.test.ts` -- NEW: unit tests
- `modules/recipes/src/types.ts` -- ADD ShareFormat, ShareableRecipe types
- `modules/recipes/src/db/schema.ts` -- ADD rc_share_tokens table + indexes
- `modules/recipes/src/db/crud.ts` -- ADD getRecipeByShareToken, generateShareToken, incrementViewCount
- `modules/recipes/src/definition.ts` -- ADD V6 migration, bump schemaVersion to 6
- `modules/recipes/src/index.ts` -- ADD exports
- `apps/mobile/app/(recipes)/recipe-detail.tsx` -- MODIFIED: enhance share button
- `apps/mobile/app/(recipes)/components/ShareSheet.tsx` -- NEW: share options bottom sheet
- `apps/web/app/recipes/[id]/page.tsx` -- MODIFIED: add share button
- `apps/web/app/recipes/share/[token]/page.tsx` -- NEW: public share page

### Known Limitations
- Share Link requires a deployed web app. Until then, tokens are generated locally but the URL is a placeholder.
- No share analytics beyond view_count (no tracking of who shared or where).
- Share card image generation on web is not included in V1 (web uses text/link only).
- No revocation UI in V1 (tokens can only be invalidated by deleting the recipe).
- Private recipe notes are excluded from all shared formats.

### Context for Next Agent
- The V6 migration adds `rc_share_tokens`. Update the migrations array in `definition.ts` and bump `schemaVersion` to 6.
- `formatQuantity` in `utils.ts` converts decimals to fractions. Always use it for share text ingredient quantities.
- The public share page should NOT load the full app shell. It's a standalone page that queries the recipe by token.
- `react-native-view-shot` captures a React component as an image. Use it to render the share card component, then capture it as a PNG for sharing.
- The "Shared from MyLife" branding in share text is important for organic growth. Do not remove or make it optional.
