---
name: MyBooks Quotes System Redesign
description: P2-D quotes collection and add quote screens redesigned to Obsidian Noir UIUX spec
type: project
---

MyBooks Quotes System (P2-D) redesigned on 2026-04-06.

**What changed:**
- `apps/mobile/app/(books)/quotes.tsx` - full redesign: display title, glass search bar, QuoteCard components from @mylife/books/ui, Curation Stats card with monthly stats, FAB, pull-to-refresh
- `apps/mobile/app/(books)/quotes/new.tsx` - full redesign: "Capture Wisdom" flow with GlassCard quote input, favorite heart toggle, source book picker with cover/dropdown, page location field, collection tags with chip UI, GradientButton submit

**Key decisions:**
- QuoteCard `source` prop = author name (bold primary line), `author` prop = book title uppercase (secondary line) - naming quirk but matches visual design
- Tags stored in existing `note` field as comma-separated values to avoid schema migration
- Monthly curation stats computed from quotes created_at timestamps
- Auto-selects currently reading book in add quote form

**Why:** Part of the MyBooks Obsidian Noir UIUX reconciliation sprint, matching design mockups from docs/uiux-prompts/.

**How to apply:** When touching quotes screens, maintain Jakarta Sans typography, BOOKS_SURFACES token usage, and the QuoteCard source/author mapping convention.
