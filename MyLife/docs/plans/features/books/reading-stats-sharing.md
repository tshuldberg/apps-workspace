# Feature Spec: Reading Stats Sharing

## Metadata
- **Module:** books
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 1.5-2 hours
- **Depends On:** BK-009 (Reading Statistics -- implemented), BK-010 (Year-in-Review -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Shareable reading stats cards are a viral growth mechanism. StoryGraph's year-in-review sharing drove massive social media engagement and was a key factor in their growth from 1M to 5M+ users. Goodreads' annual reading challenge generates millions of social shares. MyBooks already computes comprehensive stats (total books, pages, top authors, rating distribution, monthly breakdown) and year-in-review data but has no way for users to share them. Adding shareable image cards turns every reader into a marketing channel. The cards are generated entirely on-device -- no data leaves the phone.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| StoryGraph | Yes | Free | Year-in-review shareable images, mood-based stats cards. Viral on Twitter/Instagram. |
| Goodreads | Yes | Free | Annual Reading Challenge badge sharing. Limited customization. |
| Bookly | Yes | $30/yr | Reading stats screenshots with branding. Basic templates. |
| Literal | No | N/A | No stats sharing feature. |

### Target User
Active readers who have finished 5+ books and want to share their reading accomplishments on social media. These users are already sharing Goodreads challenge progress or StoryGraph year-in-review cards. Every shared card is free marketing for MyBooks.

## Technical Context

### Where This Lives in MyLife

```
modules/books/src/sharing/                      -- NEW: card rendering + types
modules/books/src/sharing/types.ts              -- CardTemplate, CardData, ShareCardConfig
modules/books/src/sharing/card-renderer.ts      -- On-device image generation logic
modules/books/src/sharing/templates.ts          -- 5 card template definitions
modules/books/src/sharing/index.ts              -- Barrel export
modules/books/src/sharing/__tests__/            -- Tests
apps/mobile/app/(books)/share-stats.tsx         -- Mobile share stats screen
apps/web/app/books/share-stats/page.tsx         -- Web share stats page
```

### Wireframe Position

```
Hub Dashboard
  └── MyBooks card
       └── Stats tab
            └── "Share Stats" button ← YOU ARE HERE
            └── Year-in-Review section
                 └── "Share" button ← ALSO HERE
```

### Data Model

No new tables required. Cards are rendered from computed data:
- `calculateReadingStats()` from `stats/stats.ts` -- total books, pages, top authors, rating distribution
- `generateYearInReview()` from `stats/year-review.ts` -- year-specific aggregations
- `calculateStreakData()` (from BK-030 if built, or computed from `bk_timed_sessions` / `bk_progress_updates`)

Image rendering:
- **Mobile:** `react-native-view-shot` to capture a React Native View as PNG
- **Web:** HTML Canvas API or `html2canvas` to render card to PNG

### Dependencies
- **Internal:** `@mylife/db`, books stats engine, year-in-review engine
- **External:** `react-native-view-shot` (mobile), `expo-sharing` (mobile share sheet), Web Share API (web)
- **Cross-Module:** none (books-internal feature)

## Functional Requirements

### User Stories
1. As a proud reader, I want to generate a beautiful image of my year-in-review stats so that I can share it on Instagram and Twitter.
2. As a reader completing a reading goal, I want to share my progress as a visually appealing card so that I can celebrate with friends.
3. As a privacy-conscious user, I want stats cards generated entirely on my device so that no reading data is sent to any server.

### Behavior Specification

1. User navigates to the Stats tab in MyBooks.
2. User taps "Share Stats" button (or "Share" button on Year-in-Review section).
3. Share Stats screen opens showing a card template selector (horizontal scroll of 5 card previews).
4. First card template is selected by default, showing a live preview populated with user's data.
5. User swipes to browse other card templates.
6. User taps "Customize" to toggle: display name visibility, card color theme (dark/accent/light).
7. User taps "Share" button.
8. System renders the current card as a 1080x1920px PNG image.
9. System share sheet opens with the rendered image.
10. User shares via their preferred app (iMessage, Instagram, Twitter, etc.).

### Edge Cases

- **No finished books:** All card templates disabled. Show "Finish your first book to unlock shareable stats."
- **Insufficient data for a specific template:** That template is disabled with tooltip "Need more data for this card" (e.g., Genre Pie requires 3+ genres).
- **Very long book titles:** Truncated with ellipsis to fit card layout (max 40 chars displayed).
- **No cover images available:** Placeholder covers with book initial letter in accent color.
- **Image generation fails:** Toast error "Could not generate image. Please try again."
- **Share sheet cancelled:** Return to preview screen, no action taken.
- **Large stats dataset:** Rendering should complete in under 2 seconds.
- **Module disabled after share screen opens:** Screen dismisses gracefully.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Share Stats" button appears on the Stats tab when the user has 1+ finished books.
- [ ] **AC-2:** Share Stats screen displays 5 card template previews in a horizontal scroll.
- [ ] **AC-3:** Selecting a template updates the live preview with the user's actual data.
- [ ] **AC-4:** "Customize" allows toggling display name and choosing color theme (dark/accent/light).
- [ ] **AC-5:** Tapping "Share" generates a 1080x1920px PNG and opens the system share sheet.
- [ ] **AC-6:** Year Summary card shows: total books, total pages, average rating, top 3 book covers/titles.
- [ ] **AC-7:** Monthly Chart card shows a bar chart of books per month with total at top.
- [ ] **AC-8:** Genre Breakdown card shows a donut chart with genre labels and percentages.
- [ ] **AC-9:** Top Authors card shows top 5 authors with book count.
- [ ] **AC-10:** Reading Streak card shows current and longest streak with a 7-day calendar visualization.
- [ ] **AC-11:** Cards include "MyBooks" branding watermark in bottom corner.
- [ ] **AC-12:** With 0 finished books, all templates are disabled with a prompt to read more.

### Technical Criteria
- [ ] **TC-1:** Image is rendered at exactly 1080x1920px (9:16 aspect ratio, optimized for social media stories).
- [ ] **TC-2:** Image rendering completes in under 2 seconds on a mid-range device.
- [ ] **TC-3:** Card data is computed from `calculateReadingStats()` and `generateYearInReview()` only. No new database queries.
- [ ] **TC-4:** Mobile uses `react-native-view-shot` for capture and `expo-sharing` for share sheet.
- [ ] **TC-5:** Web uses Canvas API or `html2canvas` for rendering and Web Share API (with download fallback).
- [ ] **TC-6:** Card color themes use Cool Obsidian tokens (dark), books accent `#C9894D` (accent), and inverted light theme.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** No user reading data must be transmitted to any server. Image is rendered entirely on-device.
- [ ] **NC-2:** Card images must NOT include the user's full reading history or private data beyond what is displayed.
- [ ] **NC-3:** Rendering must NOT block the UI thread. Use async rendering with a loading spinner.
- [ ] **NC-4:** Must NOT crash when stats data contains null/undefined values (graceful fallback to "N/A").

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Card preview area: centered, 270x480px preview (scaled down from 1080x1920)
- Template selector: horizontal scroll below preview, 60x107px thumbnails with selected border (`#C9894D`)
- "Customize" button: glass card style, secondary action
- "Share" button: full-width, accent color `#C9894D`, bottom of screen
- Card templates use gradient backgrounds:
  - Dark: `#0A0A0F` to `#1A1A24`
  - Accent: `#C9894D` to `#A06830`
  - Light: `#F0F0F5` to `#E0E0E8` with dark text

### Web (Next.js)

- Route: `/books/share-stats`
- Same card templates rendered via HTML/CSS
- "Download" button as fallback if Web Share API is unavailable
- Card preview at 540x960px (50% scale) with zoom-on-hover

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card preview with shimmer | Computing stats for templates |
| Empty | "Finish your first book to unlock shareable stats" + bookshelf illustration | 0 finished books |
| Error | Toast: "Could not generate image. Please try again." | Rendering exception |
| Success | Live card preview with "Share" button enabled | Stats computed, template populated |
| Partial | Some templates available, others disabled with tooltip | Limited data (e.g., only 2 genres) |

## Test Requirements

### Unit Tests
- [ ] `rendersYearSummaryCard`: given YearInReview data, produces card data with total books, pages, top 3
- [ ] `rendersMonthlyChart`: given 12 months of data, produces bar chart data with correct heights
- [ ] `rendersGenrePie`: given 5 genres, produces donut chart with correct percentages
- [ ] `rendersTopAuthors`: given 10 authors, produces top 5 list sorted by count
- [ ] `truncatesLongTitles`: title "The Hitchhiker's Guide to the Galaxy and Other Adventures" truncated to 40 chars + "..."
- [ ] `disablesCardWithInsufficientData`: 0 finished books returns all templates as disabled
- [ ] `disablesGenreCard`: fewer than 3 genres disables Genre Breakdown template
- [ ] `handlesNullRatings`: books with no ratings show "N/A" for average rating
- [ ] `cardDimensions`: output dimensions are exactly 1080x1920
- [ ] `colorThemeApplication`: dark/accent/light themes apply correct background and text colors

### Integration Tests
- [ ] Full flow: compute stats -> select template -> customize -> render image -> verify PNG blob has non-zero size
- [ ] Error flow: corrupted stats data -> graceful error toast -> user can retry

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyBooks > Stats tab
3. Verify: with 0 finished books, "Share Stats" button is hidden or disabled -- corresponds to AC-12
4. Finish 5 books with ratings, covering at least 3 genres
5. Navigate to Stats tab
6. Tap "Share Stats"
7. Verify: Share Stats screen opens with 5 card template previews -- corresponds to AC-2
8. Verify: first template (Year Summary) is selected with live preview -- corresponds to AC-3, AC-6
9. Swipe to Monthly Chart template
10. Verify: bar chart shows correct monthly breakdown -- corresponds to AC-7
11. Swipe to Genre Breakdown template
12. Verify: donut chart shows genre distribution -- corresponds to AC-8
13. Swipe to Top Authors template
14. Verify: top 5 authors listed with book counts -- corresponds to AC-9
15. Swipe to Reading Streak template
16. Verify: streak data displayed with calendar visualization -- corresponds to AC-10
17. Tap "Customize"
18. Toggle display name, select accent color theme
19. Verify: preview updates in real-time -- corresponds to AC-4
20. Tap "Share"
21. Verify: loading spinner appears briefly, then share sheet opens with an image -- corresponds to AC-5
22. Verify: image shows "MyBooks" branding -- corresponds to AC-11
23. Cancel share sheet
24. Open the app on web
25. Navigate to Books > Share Stats
26. Verify: same templates are available
27. Verify: "Download" button appears if Web Share API is unavailable

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /books/share-stats, click every button, verify all 5 states

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- verify hub module integrity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The books module has a complete stats engine (`calculateReadingStats`) and year-in-review engine (`generateYearInReview`). The SPEC-mybooks.md describes BK-027 with 5 card templates and share sheet integration. No sharing UI or image generation exists.

### After This Work
A `sharing/` directory exists with card template definitions, a renderer that produces 1080x1920 PNG images, and customization options. Mobile and web UIs allow browsing templates, customizing appearance, and sharing via system share sheet.

### Files Changed
- `modules/books/src/sharing/types.ts` -- CardTemplate, CardData, ShareCardConfig, ColorTheme types
- `modules/books/src/sharing/templates.ts` -- 5 template definitions (year summary, monthly chart, genre pie, top authors, streak)
- `modules/books/src/sharing/card-renderer.ts` -- renderCard function producing image data
- `modules/books/src/sharing/index.ts` -- barrel export
- `modules/books/src/sharing/__tests__/card-renderer.test.ts` -- 10+ unit tests
- `modules/books/src/index.ts` -- re-export sharing module
- `apps/mobile/app/(books)/share-stats.tsx` -- mobile share stats screen
- `apps/web/app/books/share-stats/page.tsx` -- web share stats page
- `package.json` -- add react-native-view-shot dependency (mobile)

### Known Limitations
- Card rendering quality depends on available cover images. Books without covers use placeholder graphics.
- Web Share API is not available in all browsers. Download fallback is provided.
- No video/animated card format. Static PNG only.
- Streak data may not be available if BK-030 (Reading Streak Tracking) is not yet built. In that case, the streak template computes streak data from raw `bk_timed_sessions` and `bk_progress_updates` timestamps directly.

### Context for Next Agent
- The stats engine at `modules/books/src/stats/stats.ts` exports `calculateReadingStats(sessions, reviews, books)` returning a `ReadingStats` object with all the data needed for card templates.
- Year-in-review at `modules/books/src/stats/year-review.ts` provides year-specific aggregations.
- For mobile image capture, `react-native-view-shot` wraps a View ref and captures to a temporary file URI. Use `expo-sharing` to open the share sheet.
- Card color themes should reference Cool Obsidian tokens from `packages/ui/src/tokens/`.
- Keep card rendering logic in `modules/books/src/sharing/` (not in app code) so both mobile and web can share template definitions.
