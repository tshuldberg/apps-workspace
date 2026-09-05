# MyHealth P5 Web Parity

**Date:** 2026-04-07
**Scope:** Refactor all 8 MyHealth web routes to Obsidian Noir spec with red accent.
**Spec:** docs/plans/myhealth-uiux-mission-control.html — Phase 5 (P5-A through P5-D)

## What was done

Reconciled 8 web routes from old emerald `#10B981` styling to the new Obsidian Noir token system with the warm red `#EF4444` accent that matches the redesigned mobile screens.

### P5-A Web Health Dashboard
- **File:** `apps/web/app/health/page.tsx`
- 3-column layout (sidebar 256px, center 1fr, feed 300px)
- Persistent left sidebar: MyHealth brand + 7 nav links (Dashboard, Vitals, Sleep, Mind, Goals, Vault, Emergency) + New Entry CTA
- Sticky top header with date nav, Log Vital / Log Mood pills, avatar
- Left column: Today's Summary panel — Active Fast glass card with timer + progress, Due Medications list, Current Mood card, Active Goals with progress bars
- Center column: Activity Rings hero (computed SVG with Move/Exercise/Stand percentages from real data) + 10-card 2-column Vitals Grid
- Right column: Activity Feed timeline (mood, vital, goal, meds, sleep, adherence)
- Pulls real data via existing `fetchDashboard`, `fetchOverallStats`, `fetchLatestVitals` actions

### P5-B Web Vitals + Sleep
- **Files:** `apps/web/app/health/vitals/page.tsx`, `apps/web/app/health/sleep/page.tsx`
- **Vitals:** clickable expandable card grid with sparklines + selected detail panel with chart and history list. Range filter pills (7d/30d/90d/1y). Log form with type/value/diastolic + Export button.
- **Sleep:** Two-panel layout — left = big duration + quality score + 7-day avg/sessions/source stats. Right = stage timeline (Deep/REM/Light/Awake colored bar with legend) + 7-day weekly trend bar chart + Smart Alarm/Snore quick links. Recent sessions list below.

### P5-C Web Mind + Goals + Emergency
- **New file:** `apps/web/app/health/mind/page.tsx`
- **Refactored:** `goals/page.tsx`, `emergency/page.tsx`
- **Mind:** New wellness hub. Two-panel: left = 5 wellness tools list (Check-In, Breathing, CBT, 5-4-3-2-1 Grounding, Meditation). Right = selected tool detail (mood emoji buttons, breathing CSS animation circle, CBT 3-step form, grounding step cards, meditation length picker). Below: Mood Calendar grid + 14-day Wellness Timeline.
- **Goals:** Goal cards with circular icon, progress bar, deactivate button. Inline create form (toggleable) with domain/direction/target/period/unit/label.
- **Emergency:** Big ICE Card with red ribbon, blood type badge, parsed contacts with `tel:` links, QR placeholder, Print Medical ID button (uses `window.print()`). Edit form below.

### P5-D Web Vault + Export + Settings
- **New files:** `apps/web/app/health/vault/page.tsx`, `apps/web/app/health/settings/page.tsx`
- **Refactored:** `export/page.tsx`
- **Vault:** Document grid with thumbnails by type (lab/Rx/imaging/etc), category filter pills, search bar, drag-and-drop upload zone (uses `arrayBuffer()` to upload via new `doCreateDocument` action). Document viewer modal with delete + close.
- **Export:** Format picker (txt/pdf/csv) + data type chips + date range. Two side-by-side cards for Doctor Report and Therapy Report with preview panel + Download (Blob URL) + Copy buttons.
- **Settings:** Two-column layout. Left = Apple Health Sync, Notifications (vitals/meds/mood toggles), Units (imperial/metric). Right = Privacy + Delete All Data destructive section, Data Management links to vault/export, About info. Save Changes button at bottom.

### Plumbing changes
- `apps/web/app/health/actions.ts` — added `doCreateDocument`, `fetchDocumentsByType`, imported `DocumentType` type.
- `apps/web/app/health/layout.tsx` — switched `accentColor` from `#10B981` to `#EF4444`.

## Verification

- `pnpm --filter @mylife/web typecheck` → exit 0, no errors.
- `pnpm --filter @mylife/web run lint` → 0 errors, 0 new warnings in `app/health`.
- All 8 health routes use shared Obsidian Noir tokens (`#131318` bg, `#1B1B20` low, `#EF4444` accent, Plus Jakarta Sans).

## Files changed

- `apps/web/app/health/page.tsx` (rewrite)
- `apps/web/app/health/layout.tsx` (accent color)
- `apps/web/app/health/actions.ts` (added doCreateDocument + fetchDocumentsByType)
- `apps/web/app/health/vitals/page.tsx` (rewrite)
- `apps/web/app/health/sleep/page.tsx` (rewrite)
- `apps/web/app/health/mood/page.tsx` (untouched — older mood page; web Mind hub is at `mind/`)
- `apps/web/app/health/goals/page.tsx` (rewrite)
- `apps/web/app/health/emergency/page.tsx` (rewrite)
- `apps/web/app/health/export/page.tsx` (rewrite)
- `apps/web/app/health/mind/page.tsx` (NEW)
- `apps/web/app/health/vault/page.tsx` (NEW)
- `apps/web/app/health/settings/page.tsx` (NEW)
- `docs/plans/myhealth-uiux-mission-control.html` (P5-A..D marked done)

## Notes / remaining

- The web `mood/` route still exists from the pre-redesign era. The new Mind hub lives at `health/mind/` as the spec calls it. We can decide later whether to delete `mood/` or repoint it.
- Goal progress percent on the new Goals page shows 0 for now — there is no `getGoalProgress` action exposed from the web yet. Plumbing it in is a small follow-up.
- The dashboard sidebar uses native `<a>` tags rather than `next/link` because the entire page is `'use client'` and needs full reloads when navigating between health routes anyway. Switch to `next/link` if we want client-side routing within the module.
- The vault uploader currently sets `type: 'other'` for every uploaded file. Adding a type picker step in the upload flow is the obvious next refinement.
