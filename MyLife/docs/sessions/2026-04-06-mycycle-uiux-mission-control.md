# 2026-04-06 -- MyCycle UIUX Mission Control

## What

Built `docs/plans/mycycle-uiux-mission-control.html`, a 19-prompt execution plan covering the 12 design screens at `/Users/trey/Downloads/MyCycleUIUX/`. Continues the Obsidian Noir UIUX rebuild series (MyMood, MyHealth, MyRecipes, MyGarden already have mission controls).

## Why

12 design screens were delivered by the user in `/Users/trey/Downloads/MyCycleUIUX/`, each with `screen.png` and `code.html`, plus `obsidian_noir/DESIGN.md`. The current cycle module on mobile uses a flat Stack navigator and a simple insights.tsx card — both need a full rebuild to match the 5-tab phase-ring dashboard design.

## Plan Structure

- **P0 sequential (3 prompts):** tokens + typography, tab restructure (Stack to 5-tab navigator with new calendar.tsx and history.tsx placeholders), shared components (PhaseRing, PhaseBadge, PhaseLegend, GlassCard, LogTodayFAB, StatPill, SectionDivider).
- **P1 parallel (5 prompts):** 5 tab screens — Home (phase ring hero), Calendar (new), History (new), Insights (regularity hero + trend chart + nav tiles), Settings.
- **P2 parallel (4 prompts):** detail screens — Log Entry modal redesign, Predictions Detail, Symptom Analysis, Cycle Analytics.
- **P3 parallel (3 prompts):** specialized — BBT Tracking chart, Pregnancy Mode hero, Partner Sync privacy toggles.
- **P4 parallel (4 prompts):** web parity bundling 8+ routes across 4 prompts, plus 4 new routes (`/cycle/analytics`, `/cycle/predictions`, `/cycle/symptoms`, `/cycle/bbt`).

Total: 19 prompts. Max parallelism 12 in P1-3.

## Key Decisions

- **Dual accent strategy:** keep Obsidian Noir gold (#C9894D/#FFB877) for chrome and CTAs, layer 4 phase-semantic colors on top for data visualization (menstrual #EF4444, follicular #FBCFE8, ovulation #F472B6, luteal #FDA4AF). The current module uses a flat pink moduleAccent; P0-A exposes the phase palette via a new `modules/cycle/src/ui/tokens.ts`.
- **Biggest structural change is P0-B:** current mobile layout is a flat Stack. The plan converts it to a 5-tab Tabs navigator nested in a Stack, moving index/insights/settings into `(tabs)/` and creating placeholder calendar.tsx and history.tsx files.
- **Plus Jakarta Sans:** load at the `(cycle)/_layout.tsx` level using `@expo-google-fonts/plus-jakarta-sans`. Gate module render on fonts loaded.
- **No-line rule on tab bar:** explicitly set `borderTopWidth: 0` on `tabBarStyle` to fight React Navigation's default hairline border.
- **compare.tsx already exists:** P2-D should verify and either rename or replace with `cycle-analytics.tsx`.

## Files Created

- `docs/plans/mycycle-uiux-mission-control.html` (new mission control)
- `/Users/trey/.claude/projects/-Users-trey-Desktop-Apps-MyLife/memory/mycycle_uiux_mission_control.md` (memory file)

## Files Modified

- `/Users/trey/.claude/projects/-Users-trey-Desktop-Apps-MyLife/memory/MEMORY.md` (added mission control index entry)
- `memory.md` (added session row)

## Verification

- HTML file opens in browser (opened via `open file://...`)
- localStorage key is `mycycle-mission-control` (unique per module)
- State management, copy-to-clipboard, status cycling, and phase collapse all work identically to the myhealth mission control

## Remaining Items

- Plan not yet executed. All 19 prompts in pending state.
- When user is ready to start: run P0-A first (sequential), then P0-B, then P0-C, then fan out P1-3 in parallel, then P4 after mobile lands.
