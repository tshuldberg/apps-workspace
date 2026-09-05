# MyMood -- UI/UX Design Prompts

**Tagline:** Know your mind. Calm your body.
**Icon:** 🎭 | **Accent:** #FB923C | **Tier:** Free
**Bottom Tabs:** Today | Insights | Breathe | Pet | Settings

---

## Prompt 1 of 3 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyMood
Accent color: #FB923C (warm orange)
Platform: iOS mobile (Expo/React Native)
Bottom tab bar: Today | Insights | Breathe | Pet | Settings

Design the following 12 screens:

1. TODAY (index.tsx)
- Header: "Today" with current date
- Average mood score card: large number (1-10) with corresponding emoji, "today's average" label, color indicator (red=low, yellow=mid, green=high)
- AI suggestion card: glass surface card with lightbulb icon, personalized suggestion text based on recent patterns (e.g. "You tend to feel better after exercise -- consider a walk today"), "Dismiss" and "Try It" buttons
- Virtual pet card: pet species illustration, pet name, mood state label (Happy/Content/Sad), happiness meter bar, "Visit Pet" tap target
- Today's logged activities list: chronological mood entries with time, score, and primary emotion for each
- "Log Mood" floating action button, accent-colored, prominent at bottom-right
- Empty state: "How are you feeling? Tap + to log your first mood"

2. LOG MOOD (log-mood.tsx)
- Header: "How are you feeling?"
- Score slider: horizontal 1-10 with large number display above thumb, emoji faces at intervals (1=very sad, 3=sad, 5=neutral, 7=happy, 10=elated), color gradient track (red to orange to green)
- Plutchik emotion wheel: circular wheel visualization with 8 axes (Joy-Sadness, Trust-Disgust, Fear-Anger, Surprise-Anticipation), 3 intensity levels per axis (mild/moderate/intense), 24 total emotion selections, multi-select enabled, selected emotions highlighted with accent glow
- Activity checklist: scrollable grid of activity chips -- Exercise, Social, Work, Sleep (good/bad), Food (healthy/unhealthy), Outdoors, Creative, Screen Time, Reading, Meditation, Commute, Shopping, Cleaning, Cooking
- Photo attachment: camera icon button, "Add Photo" label, thumbnail preview if attached
- Voice memo attachment: microphone icon button, "Record Memo" label, waveform preview if recorded, duration display
- "Save" button at bottom, accent-colored, full width

3. DAY DETAIL (day-detail.tsx)
- Header: selected date (e.g. "March 15, 2026")
- Day summary card: average mood score, number of entries, most frequent emotion
- Entry list: all mood entries for the day, each card showing:
  - Time (e.g. "9:30 AM")
  - Score with emoji
  - Emotion tags (colored chips)
  - Activities (icon list)
  - Note preview (truncated, tap to expand)
  - Photo thumbnail if attached
  - Voice memo play button if attached
- Tap entry to expand full detail
- "Add Entry" button at bottom

4. BREATHING (breathing.tsx)
- Header: "Breathe"
- 5 pattern cards in a scrollable vertical list:
  - Box Breathing: "4-4-4-4" timing label, "Balance & focus" subtitle, ~4 min
  - 4-7-8 Breathing: "4-7-8" timing label, "Deep relaxation" subtitle, ~5 min
  - Relaxing Breath: "Slow & steady" label, "Calm your nervous system" subtitle, ~6 min
  - Energizing Breath: "Quick rhythmic" label, "Wake up & energize" subtitle, ~3 min
  - Sleep Prep: "Progressively slower" label, "Prepare for sleep" subtitle, ~8 min
- Each card: pattern name, timing/description, duration estimate, accent-colored "Start" button
- Pre-session mood check: "How do you feel right now?" 1-10 slider (appears after tapping Start, before exercise begins)
- Active session view: large animated circle that expands (inhale) and contracts (exhale), phase label (Inhale / Hold / Exhale) with countdown seconds, cycle count
- Post-session mood check: same 1-10 slider, comparison display ("Before: 4 -> After: 7"), "Save & Close" button

5. MEDITATION (meditation.tsx)
- Header: "Meditate"
- Category tabs: Calm | Focus | Sleep | Gratitude | Body Scan
- Template cards per category (3-4 per category):
  - Template name
  - Duration options: 5 min / 10 min / 15 min / 20 min (selectable pills)
  - Brief description (1 line)
  - "Start" button
- Featured meditation card at top: highlighted template with illustration
- Session count: "You've meditated X times this month"
- Favorites section: bookmarked templates

6. MEDITATION SESSION (meditation-session.tsx)
- Minimalist full-screen session view
- Step progress indicator: horizontal dots or progress bar showing current step in guided sequence
- Instruction text: large, centered, readable text for current step (e.g. "Focus on your breath", "Notice any tension in your shoulders")
- Timer: elapsed / total time display at top
- Ambient sound option: speaker icon toggle, sound type selector (rain, bowls, silence)
- Pause / Resume button centered at bottom
- End Session button (small, muted)
- Completion screen: session duration, pre/post mood comparison, streak count, "Well done" message

7. FOCUS SOUNDS (focus.tsx)
- Header: "Focus Sounds"
- 3 category sections:
  - Nature (7 sounds): Rain, Ocean, Forest, Fire, Wind, Thunder, Birds -- each with nature-themed icon
  - White Noise (3 sounds): White Noise, Pink Noise, Brown Noise -- each with wave icon
  - Music (3 sounds): Coffee Shop, Lo-Fi, Piano -- each with music icon
- Each sound card: icon, name, play/pause toggle, individual volume slider
- "Mix Sounds" banner: "Layer multiple sounds together" prompt to focus session screen
- Currently playing indicator: sound name with animated equalizer bars

8. FOCUS SESSION (focus-session.tsx)
- Header: "Focus Session"
- Layer mixer: vertical list of active sound layers, each with:
  - Sound icon and name
  - Individual volume slider (0-100)
  - Remove (X) button
- "Add Sound" button to add more layers
- Master volume control at top
- Timer: optional countdown timer with duration picker (15 / 30 / 45 / 60 min / No Timer)
- Pre-session mood check (1-10)
- "Save as Preset" button: name input to save current mix
- Saved presets: horizontal scroll of preset cards with "Load" action
- Post-session mood check and comparison on timer end

9. VIRTUAL PET (pet.tsx)
- Header: pet name (editable with pencil icon)
- Large pet display: centered animated pet illustration, current species and evolution stage
- 6 species options (shown in settings/first setup): Cat, Dog, Bunny, Fox, Owl, Penguin
- 6 evolution stages: egg -> baby -> juvenile -> adult -> elder -> legendary (based on lifetime mood entries)
- Happiness meter: horizontal bar below pet, gradient from red (0%) to green (100%), decays over time without mood check-ins
- Cross-module feeding display: recent actions that fed the pet:
  - "Logged mood +5 happiness"
  - "Completed exercise +10 happiness"
  - "Meditated +8 happiness"
- Wardrobe section: scrollable grid of accessories (hats, glasses, scarves, bows, crowns), locked items show unlock requirement, equipped items shown on pet
- Pet mood state: text label below pet (Happy / Content / Sad / Sick) with matching pet expression
- Pet stats: age (days since creation), total feeds, evolution progress bar

10. SOS / PANIC (sos.tsx)
- Full-screen crisis support flow, red accent tones
- 4-step guided sequence with large "Next" buttons:
  - Step 1: "Let's breathe together" -- automatic box breathing animation (expanding/contracting circle), 4 cycles
  - Step 2: "5-4-3-2-1 Grounding" -- sensory grounding prompts (5 see, 4 hear, 3 touch, 2 smell, 1 taste), text inputs or just acknowledgment buttons
  - Step 3: "You are safe" -- positive affirmation display, rotating through 5 affirmations (e.g. "This feeling will pass", "You are stronger than you think")
  - Step 4: "How are you now?" -- exit mood check-in (1-10 slider), followed by crisis resource card
- Crisis hotlines always visible at bottom: 988 Suicide & Crisis Lifeline (tap to call), Crisis Text Line ("Text HOME to 741741"), "Call Emergency Contacts" button
- "I'm feeling better" exit button and "I need more help" button linking to resources
- Skip navigation: allow jumping to any step

11. EMERGENCY CONTACTS (emergency-contacts.tsx)
- Header: "SOS Contacts"
- Contact list: each row has:
  - Contact name
  - Phone number
  - Relationship label (Family / Friend / Therapist / Doctor / Other)
  - One-tap call button (green phone icon)
  - Edit / Delete options
- "Add Contact" button at top
- Add contact form: name input, phone input, relationship picker
- Instruction text: "These contacts are available from the SOS screen for quick access during difficult moments"
- Maximum 5 contacts suggestion

12. EXPERIMENTS (experiments.tsx)
- Header: "Experiments"
- Explanation banner: "Test how lifestyle changes affect your mood with A/B experiments"
- Active experiment card (if one is running):
  - Experiment name
  - Current phase badge: "Baseline" (blue) or "Intervention" (green)
  - Days remaining in current phase
  - Progress bar
  - Current correlation result (if enough data): Pearson r value
- Past experiments list: experiment name, conclusion ("Positive correlation" / "No effect" / "Negative correlation"), dates, tap for detail
- "New Experiment" button, accent-colored
- Empty state: "Design your first experiment to discover what affects your mood"
```

---

## Prompt 2 of 3 -- Mobile Screens 13-25

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyMood
Accent color: #FB923C (warm orange)
Platform: iOS mobile (Expo/React Native)
Bottom tab bar: Today | Insights | Breathe | Pet | Settings

Design the following 13 screens:

13. EXPERIMENT DESIGNER (experiment-designer.tsx)
- Header: "Design Experiment"
- Hypothesis text input: large text area, placeholder "e.g. Morning meditation improves my mood"
- Baseline duration picker: stepper (7-30 days), label "How many days to measure your normal mood?"
- Intervention description: text input, placeholder "e.g. Meditate for 10 minutes every morning"
- Intervention duration picker: stepper (7-30 days), label "How many days to try the intervention?"
- Tracked variable display: "Mood Score (1-10)" -- automatically tracked
- Summary card: visual timeline showing baseline period (blue bar) then intervention period (green bar) with day counts
- "Start Experiment" button, accent-colored
- Tips card: "For best results, keep everything else in your routine the same during the experiment"

14. EXPERIMENT RESULTS (experiment-results.tsx)
- Header: experiment name
- Two-period comparison chart: side-by-side bar or line chart showing baseline period mood scores vs intervention period mood scores
- Statistics card:
  - Baseline average: score with standard deviation
  - Intervention average: score with standard deviation
  - Difference: +/- value
  - Pearson r value: correlation coefficient
  - P-value: significance indicator (Significant / Not Significant at p < 0.05)
- Conclusion text: auto-generated (e.g. "Your mood was 1.3 points higher during meditation. This correlation is statistically significant.")
- Visual indicator: large thumbs up (positive), equals sign (no effect), or thumbs down (negative)
- "Share Results" button
- "Run Again" button to repeat the experiment

15. LOCK SCREEN (lock-screen.tsx)
- Full-screen lock overlay
- App icon and name at top
- PIN entry: 4 or 6 digit display dots, numeric keypad (0-9)
- Biometric button: Face ID or Touch ID icon below keypad, "Use Face ID" / "Use Touch ID" label
- Incorrect attempt feedback: shake animation, red flash on dots
- "Forgot PIN?" link at bottom
- Lockout state: "Too many attempts. Try again in X minutes" message

16. LOCK SETTINGS (lock-settings.tsx)
- Header: "Privacy Lock"
- Set / Change PIN section: "Set PIN" button (if not set), "Change PIN" button (if set), leads to PIN entry flow
- Biometric toggle: "Use Face ID" / "Use Touch ID" switch
- Auto-lock setting: "Lock app when" picker (Immediately / After 1 min / After 5 min / After 15 min)
- Lockout policy:
  - Max attempts before lockout: stepper (3-10)
  - Lockout duration: picker (1 min / 5 min / 15 min / 30 min)
- "Remove Lock" button (danger, with confirmation)

17. INSIGHTS (insights.tsx)
- Header: "Insights"
- 8 AI pattern detector cards in a scrollable list, each card showing:
  1. Day-of-Week Patterns: "Your happiest day is Saturday" with mini bar chart (Mon-Sun)
  2. Time-of-Day Patterns: "Mornings are your best time" with time distribution chart
  3. Activity Impact: "Exercise correlates with +1.5 mood points" with top 3 activities ranked
  4. Emotion Clusters: "Joy and Gratitude often appear together" with connection diagram
  5. Streak Detection: "You've logged mood 14 days straight!" with streak calendar
  6. Mood Trends: "Your mood has improved 12% this month" with trend line
  7. Volatility Index: "Your mood stability score: 7.2/10" with variance indicator
  8. Best/Worst Day ID: "Your best day this month: March 8 (9.2)" with highlight card
- Each card: insight title, finding text, mini visualization, "Explore" button for detail
- "Insights are generated from your data. More entries = better insights" footer text

18. INSIGHTS FEED (insights-feed.tsx)
- Header: "Insight Detail" (or specific insight name)
- Large chart for selected insight: full-width, interactive (tap data points for detail)
- Finding text: 2-3 sentence explanation of the pattern
- Suggested action card: glass surface, actionable recommendation (e.g. "Try scheduling social activities on Wednesdays -- your data shows they boost your mood")
- "Explore" related insights: linked cards to related patterns
- Data source display: "Based on X mood entries over Y days"
- Date range filter to adjust analysis window

19. YEAR IN PIXELS (year-pixels.tsx)
- Header: "Year in Pixels" with year selector
- Full-year calendar grid: 12 months x 31 days, each day is a small colored square (pixel)
- Color legend: gradient from red (1-2) through orange (3-4) to yellow (5-6) to light green (7-8) to bright green (9-10), grey for no data
- Monthly summary row below each month: average score, entry count
- Tap individual day to see day detail (score, emotions, note preview)
- Year summary stats at top: average mood, total entries, best month, streak count
- Scrollable if needed, landscape-optimized

20. WEEKLY REPORT (weekly-report.tsx)
- Header: "Weekly Report" with week date range
- Average score: large number with trend arrow compared to prior week
- Best day and worst day: date, score, primary emotion
- Most frequent emotions: top 5, ranked with frequency count and bar chart
- Activity correlations: top positive and negative activity correlations with mood
- Week-over-week comparison: side-by-side mini metrics (avg score, entry count, volatility)
- "Share Report" button
- Previous/Next week navigation arrows

21. TOP EMOTIONS (top-emotions.tsx)
- Header: "Top Emotions"
- Ranked emotion list: all logged emotions sorted by frequency
- Each row: emotion name, emoji, frequency count, percentage bar
- Activity correlation per emotion: expand row to see which activities most often accompany this emotion
- Emotion frequency chart: horizontal bar chart, color-coded by Plutchik category
- Date range filter: This Week / This Month / This Year / All Time
- Emotion wheel summary: Plutchik wheel with segment sizes reflecting frequency

22. HISTORY (history.tsx)
- Header: "History"
- Scrollable timeline of mood entries, newest first
- Each entry card: date, time, score with emoji, emotion tags (colored chips), note preview (truncated)
- Filter controls at top:
  - Date range picker (start/end)
  - Score range filter (min/max slider)
  - Emotion filter: multi-select emotion chips
- Search bar: full-text search across notes
- "Load More" pagination at bottom
- Entry count: "Showing X of Y entries"

23. SUGGESTIONS (suggestions.tsx)
- Header: "Self-Care Ideas"
- 5 category tabs: Physical | Social | Creative | Relaxation | Mindfulness
- 26-item catalog displayed as cards within each category (5-6 per category):
  - Card: activity name, description, estimated time, "Try It" button
- Data-driven suggestions section at top: "Recommended for You" -- 3 activities that correlate with your highest mood scores, highlighted with sparkle icon
- Each suggestion: icon, name, brief description, correlation indicator ("Users who do this rate 1.2 points higher")
- "Tried It" toggle per suggestion to track attempts

24. SETTINGS (settings.tsx)
- Header: "Settings"
- Notifications section:
  - Reminder times: list of set reminder times with add/remove, time pickers
  - "Remind me to log mood" master toggle
- Default activities: manage the activity checklist (add/remove/reorder items)
- Privacy controls:
  - App lock toggle (links to lock settings)
  - "Hide from app switcher" toggle
- Data section:
  - "Export Data" (CSV)
  - "Clear All Data" (danger, with confirmation)
- Pet settings: species change, name change
- About: version, privacy policy, support link

25. ONBOARDING (onboarding.tsx)
- Multi-step paginated flow with progress dots:
  - Step 1: Welcome -- "Know your mind. Calm your body." tagline, app icon, privacy promise card ("Your data stays on your device. No accounts. No tracking.")
  - Step 2: Choose your pet -- 6 species cards (Cat/Dog/Bunny/Fox/Owl/Penguin), pet name input, selected pet animates
  - Step 3: Set first reminder -- time picker, "When would you like to check in?", suggestion text "Most users log mood at morning and evening"
  - Step 4: First mood entry -- simplified mood log (just score slider + top 3 emotions), "This is what logging feels like!"
- "Get Started" final button
- "Skip" option on each step
```

---

## Prompt 3 of 3 -- Web Pages

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyMood
Accent color: #FB923C (warm orange)
Platform: Web (Next.js 15, desktop-optimized)
Layout: Persistent left sidebar with module navigation

Design the following 12 web pages:

W1. DASHBOARD (/mood)
- Left sidebar: module navigation with icons
- Main content: 2-column layout
  - Left column: today's mood summary (average score, entry count, AI suggestion card), quick "Log Mood" form (score slider + emotion selector inline)
  - Right column: pet card (species, happiness, recent feeds), weekly mood sparkline chart, recent entries feed
- Top bar: date display, "Log Mood" prominent button

W2. LOG MOOD (/mood/log)
- Centered wide form card
- Score slider: desktop-sized with hover tooltips on emoji faces
- Plutchik emotion wheel: interactive, clickable segments with hover labels (desktop-optimized, larger than mobile)
- Activity grid: 4-column chip grid for activities
- Photo upload: drag-and-drop zone
- Voice memo: record button with waveform
- "Save" button

W3. HISTORY (/mood/history)
- Full-width timeline view with sidebar filters
- Left sidebar: date range picker, score range slider, emotion multi-select, search bar
- Main area: scrollable entry cards, each expanded to show full detail (score, emotions, activities, notes, media)
- Sortable columns: date, score, dominant emotion
- Pagination controls at bottom

W4. INSIGHTS (/mood/insights)
- Dashboard grid layout: 8 insight cards in a 2x4 responsive grid
- Each card: insight title, key finding, mini chart, "Explore" link
- Click card to expand into full-width detail view with large interactive chart, explanation, suggested action
- Date range filter at top affecting all insights
- Export insights button

W5. BREATHING (/mood/breathe)
- Centered layout
- 5 breathing pattern cards in a row (desktop width allows horizontal)
- Selected pattern: large animated breathing circle (expanding/contracting) centered on page
- Pre/post mood tracking panels flanking the animation
- Session timer and cycle count
- Pattern description and instructions visible alongside animation

W6. MEDITATION (/mood/meditate)
- Two-panel layout:
  - Left panel: category sidebar (Calm / Focus / Sleep / Gratitude / Body Scan) with template list
  - Right panel: selected template detail with duration options, description, "Start Session" button
- Active session: full-screen focus mode with step instructions, timer, ambient sound controls
- Session history table below

W7. FOCUS SOUNDS (/mood/focus)
- Full-width sound mixer interface
- Sound grid: all 13 sounds displayed as cards with play toggle and volume slider per card
- Active mix panel: currently playing sounds with individual volume controls stacked vertically
- Timer controls: session duration picker
- Preset management: save/load preset buttons, preset list
- Pre/post mood tracking sidebar

W8. EXPERIMENTS (/mood/experiments)
- Two-panel layout:
  - Left panel: experiment list (active and past), "New Experiment" button
  - Right panel: selected experiment detail -- hypothesis, phases, timeline visualization, results chart
- New experiment form: modal or inline form with hypothesis, baseline/intervention duration pickers
- Results view: large comparison chart, statistics table, conclusion

W9. VIRTUAL PET (/mood/pet)
- Centered pet display, larger than mobile
- Side panels: left = pet stats (age, happiness, evolution stage), right = wardrobe grid
- Feeding history timeline below
- Species selector (during setup)
- Hover effects on wardrobe items to preview on pet

W10. SOS (/mood/sos)
- Centered crisis support flow, step-by-step (same 4 steps as mobile)
- Crisis hotlines prominently displayed in sidebar (always visible)
- Emergency contacts list with click-to-call (tel: links)
- Breathing animation large and centered
- Grounding exercise with text inputs

W11. YEAR IN PIXELS (/mood/year)
- Full-width year grid: takes advantage of desktop width for comfortable pixel display
- Interactive: hover pixel for tooltip (date, score, emotion), click for day detail panel
- Month labels, day-of-week headers
- Year selector at top
- Summary stats bar above grid
- Legend and filter controls

W12. SETTINGS (/mood/settings)
- Standard settings form, two-column layout on wide screens
- Left column: notifications, reminders, default activities
- Right column: privacy (lock settings), data management (export/clear), pet settings
- Save button
```
