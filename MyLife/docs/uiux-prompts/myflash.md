# MyFlash -- UI/UX Design Prompts

**Tagline:** Never forget what matters
**Icon:** 🧠 | **Accent:** #8B5CF6 | **Tier:** Premium
**Bottom Tabs (mobile):** Study | Decks | Browse | Stats | Settings
**Total Screens:** 14 mobile + 6 web = 20

---

## Prompt 1: Mobile Screens 1--12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyFlash
Accent color: #8B5CF6
Icon: 🧠
Bottom tabs: Study | Decks | Browse | Stats | Settings

Design 12 mobile screens for a spaced repetition flashcard app using the FSRS algorithm. Each screen should use the Cool Obsidian dark theme with glass morphism cards, #8B5CF6 accent color, and smooth rounded corners.

1. STUDY (study.tsx)
   - Session stats bar at top: cards reviewed / total remaining, accuracy percentage, session timer
   - Card display area (centered, large glass card):
     -- Front: question text, tap hint ("Tap to flip")
     -- Back: answer text, flip animation
   - Card type indicators: Basic, Reversed, Cloze (with blank highlighted), Image Occlusion (masked regions), Multiple Choice (radio options)
   - TTS pronunciation button (speaker icon, top right of card)
   - Undo last rating button (curved arrow, top left)
   - 4-grade review buttons at bottom (full width row):
     -- Again (red, #FF453A) with next interval label
     -- Hard (orange) with next interval label
     -- Good (green, #30D158) with next interval label
     -- Easy (blue, accent) with next interval label
   - Progress bar above buttons showing session completion
   - Empty state when no cards due: "All caught up!" with next review time

2. DECKS (decks.tsx)
   - Section header "My Decks" with "+" create button
   - Deck hierarchy tree (parent/child indentation)
   - Each deck card: deck name, color indicator
   - Per-deck stats badges: New (blue count), Learning (orange count), Review (green count), Suspended (gray count)
   - Total cards count per deck
   - Deck creation form (inline or modal): name, parent deck selector, color picker
   - Long-press for context menu: edit, delete, move, suspend all
   - "Study" button per deck

3. BROWSE (browser.tsx)
   - Search bar at top (full-text search across front + back)
   - Filter chips row: By Deck dropdown, By Tags multi-select, By Queue State (New/Learning/Review/Suspended/Buried)
   - Card list: front text preview (truncated), deck name badge, queue state badge, due date
   - Bulk selection mode: checkbox per card
   - Bulk actions toolbar: Bury, Suspend, Star, Delete, Move to Deck
   - Card preview on tap: shows front + back + stats

4. STATS (stats.tsx)
   - Study streak display: current streak (large number + flame icon), longest streak
   - Today's summary card: due cards remaining, cards reviewed today, accuracy today
   - Accuracy trend chart: 30-day line graph of daily accuracy percentage
   - Review heatmap: calendar grid (GitHub-style) showing review activity intensity
   - Difficulty distribution: bar chart of card ease factor buckets
   - Cards by state: pie chart (new/learning/review/suspended)
   - Study time trend: bar chart of daily minutes studied

5. SETTINGS (settings.tsx)
   - Study limits section:
     -- New cards per day (number input, default 20)
     -- Maximum reviews per day (number input, default 200)
   - Study targets: daily study time goal (minutes)
   - Notifications: study reminder toggle, reminder time picker
   - FSRS parameters section: learning steps, graduating interval, easy interval (advanced, collapsible)
   - Import/Export section: "Import .apkg" button, "Export All" button
   - Audio: auto-play TTS toggle, TTS voice selector
   - Display: card font size slider

6. CARD STATS (card-stats.tsx)
   - Card front/back preview at top
   - Review history timeline: chronological list of every review -- date, grade given (Again/Hard/Good/Easy), interval at time, response time
   - Retention rate: percentage (large number), trend arrow
   - Ease factor: current value, trend mini-chart over reviews
   - Interval history: line chart showing interval growth over time
   - Stability and difficulty values (FSRS metrics)
   - "Reset Card" button (resets to new state)

7. FORGETTING CURVE (forgetting-curve.tsx)
   - Personal retention curves: line graphs per ease bucket (Easy/Good/Hard)
   - X-axis: days since last review, Y-axis: predicted retention %
   - Half-life estimation per bucket: "Your Easy cards have a ~45 day half-life"
   - Predicted retention graph: overlay of actual review data points on theoretical curve
   - FSRS model accuracy indicator
   - Comparison to population average (optional)
   - Color-coded curves matching ease factor colors

8. SCHEDULE (schedule.tsx)
   - Due card forecast chart: bar graph showing cards due per day
   - Time range toggle: 7 days | 14 days | 30 days
   - Upcoming review load summary: "Tomorrow: 42 cards, Avg this week: 35/day"
   - Optimal study time suggestion: "Best reviewed at [time] based on past accuracy"
   - Backlog indicator: overdue cards count with catch-up estimate
   - Per-deck breakdown of upcoming load

9. SESSION ANALYTICS (session-analytics.tsx)
   - Session summary header: total cards, duration, overall accuracy %
   - Accuracy breakdown: pie chart (Again/Hard/Good/Easy distribution)
   - Lapse count (cards rated "Again")
   - Card-by-card breakdown list: card front preview, grade given, response time, new interval
   - Response time distribution chart
   - Comparison to average session stats
   - Session history list: past sessions with date, card count, accuracy

10. CROSS-MODULE SIGNALS (signals.tsx)
    - Section header "Learning Signals" with explanation text
    - Signal cards (glass surface):
      -- Retention Score (0-100): based on overall review accuracy, color-coded gauge
      -- Streak Score (0-100): based on study consistency, color-coded gauge
      -- Readiness Score (0-100): composite of retention + streak + due load, color-coded gauge
    - Last studied timestamp per deck
    - Signal sharing status: which modules are receiving these signals
    - "These scores are shared with other MyLife modules to personalize your experience"

11. IMPORT/EXPORT (import-export.tsx)
    - Import section:
      -- "Import Anki .apkg" button with file picker
      -- Import preview: deck count, card count, media file count detected
      -- Options: preserve deck hierarchy toggle, strip HTML toggle
      -- Import progress bar with status text
    - Export section:
      -- Deck selector (multi-select, or "Export All")
      -- Export format: .apkg
      -- "Export" button
      -- Last export date
    - Import history list: date, file name, cards imported, status

12. CARD TYPES REFERENCE (card-types.tsx)
    - Visual guide showing each card type with example:
      -- Basic: front text / back text
      -- Reversed: auto-generates reverse card
      -- Cloze: "The {{c1::capital}} of France is {{c2::Paris}}" with blanks highlighted in accent color
      -- Image Occlusion: image with masked rectangles, reveal on flip
      -- Multiple Choice: question + 4 answer options with radio buttons
      -- Match Game: pair matching interface preview
    - Each type shows: name, description, example, when to use
    - "Create Card" button per type linking to card creation
```

---

## Prompt 2: Mobile Screens 13--14 + Web Pages

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyFlash
Accent color: #8B5CF6
Icon: 🧠

Design 2 remaining mobile components and 6 web pages for a spaced repetition flashcard app. Use Cool Obsidian dark theme throughout.

MOBILE SCREENS:

13. JUMP BACK IN (card component -- appears on Study tab and Hub dashboard)
    - Glass card component (not a full screen)
    - Last studied deck name (bold)
    - Progress bar showing deck completion (cards reviewed / total)
    - Due cards count badge
    - Time since last study: "2 hours ago" / "Yesterday" / "3 days ago"
    - "Continue" button (accent colored, full width)
    - Tappable to jump directly into study session for that deck

14. MATCH GAME (mode -- accessible from Study tab or Deck context menu)
    - Game board: grid of face-down cards (4x4 or 6x6 depending on card count)
    - Cards flip on tap, match front to back
    - Timer running at top
    - Moves counter
    - Matched pairs fade or get a check mark
    - Star rating at end (1-3 stars based on moves + time)
    - Best time and best score display
    - "Play Again" and "Back to Study" buttons
    - Deck selector to choose which deck to play with

WEB PAGES:

15. STUDY (/flash)
    - Desktop study interface: large centered card with keyboard shortcuts hint (Space to flip, 1-4 to grade)
    - Card display with flip animation
    - Grade buttons below card: Again / Hard / Good / Easy with interval labels
    - Session stats sidebar: reviewed, remaining, accuracy, streak
    - Deck selector dropdown
    - TTS button
    - Undo button

16. DECKS (/flash/decks)
    - Deck management panel: tree view with drag-and-drop reordering
    - Deck stats table: name, new/learning/review/suspended counts, total cards, last studied
    - Create deck form (inline)
    - Click deck to see cards within
    - Bulk actions: merge decks, export, suspend

17. BROWSE (/flash/browse)
    - Card browser table: columns for front (truncated), back (truncated), deck, tags, state, due date, ease, interval
    - Advanced filter panel: deck, state, tags, date range, ease range
    - Card editor modal: edit front/back, tags, deck assignment
    - Bulk selection with toolbar
    - Card preview panel on row click

18. ANALYTICS (/flash/analytics)
    - Comprehensive analytics dashboard (multi-panel layout)
    - Study streak calendar heatmap
    - Accuracy trend chart (30/90/365 day views)
    - Forgetting curves visualization
    - Card state distribution
    - Review forecast (upcoming 30 days)
    - Session history table
    - Per-deck performance comparison

19. SETTINGS (/flash/settings)
    - All settings in organized sections with descriptions
    - FSRS parameter tuning panel
    - Study limits
    - Notification preferences
    - Display preferences (font size, card layout)
    - Keyboard shortcut reference

20. IMPORT/EXPORT (/flash/import)
    - Drag-and-drop import zone for .apkg files
    - Import progress with detailed log
    - Import history table
    - Export panel: deck selector, format options, download button
    - Batch operations for large imports
```
