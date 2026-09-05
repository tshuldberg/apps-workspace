# Session: Context Budget Optimization

**Date:** 2026-04-06
**Goal:** Reduce context window usage at session start to prevent usage limit spikes

## Problem

New sessions were consuming ~130-160 KB of context before the user's first message:
- `memory.md`: 47 KB (153 lines, 50+ auto-logged duplicate rows, verbose session summaries)
- `TODOS.md`: 22 KB (read unconditionally every session)
- 3x CLAUDE.md files: ~37 KB (auto-loaded, non-reducible)
- Session-start protocol: 5 mandatory tool calls (MCP list, memory.md, get_briefing, TODOS.md, readiness report)
- Auto-memory MEMORY.md: 6 KB (57 lines, 30+ topic file index entries)

## Changes Made

### 1. Archived old sessions from memory.md
- Moved all sessions before 2026-04-06 to `docs/archives/memory-sessions-2026-03-29-to-04-05.md`
- Moved all 2026-04-06 UIUX sessions to `docs/archives/memory-sessions-2026-04-06-uiux.md`
- Replaced with single archive pointer rows
- **Result:** memory.md from 153 lines (47 KB) to 42 lines (~5 KB)

### 2. Purged auto-logged Stop hook duplicates
- Lines 103-153 had ~50 auto-logged rows, many duplicates (same commit logged 3-5 times)
- All removed via archival

### 3. Compressed session summaries
- Updated CLAUDE.md Session Memory protocol: summaries must be under 120 chars
- Added 80-line budget rule for memory.md
- Added auto-archive trigger when Sessions table exceeds ~15 active rows

### 4. Made TODOS.md read conditional
- Updated CLAUDE.md session-start protocol: TODOS.md only read when user asks "what's next" or references TODOs
- Removed from mandatory startup sequence
- **Saves:** ~22 KB per session start

### 5. Made session log files the verbose record
- Updated CLAUDE.md: session logs at `docs/sessions/` hold full details (decisions, files changed, verification)
- memory.md rows are one-liners with links to logs
- Historical logs only read on demand, not at startup

### 6. Consolidated auto-memory topic files
- Merged 10 MyBooks per-screen redesign files into single `mybooks_uiux_complete.md`
- Replaced 161-line `eas_build_history.md` with 15-line `eas_build_summary.md` (full version archived as `eas_build_history_full.md`)
- Split MEMORY.md index into "Active Knowledge" (loaded) vs "Historical" (on-demand) sections
- **Result:** MEMORY.md from 62 lines to ~50 lines, removed 10 files

## Files Changed

- `memory.md` -- rewrote (153 -> 42 lines)
- `CLAUDE.md` -- updated Session Memory and Session start sections
- `docs/archives/memory-sessions-2026-03-29-to-04-05.md` -- new archive
- `docs/archives/memory-sessions-2026-04-06-uiux.md` -- new archive
- `docs/sessions/2026-04-06-context-budget-optimization.md` -- this file
- `.claude/projects/.../memory/MEMORY.md` -- consolidated index
- `.claude/projects/.../memory/mybooks_uiux_complete.md` -- new consolidated file
- `.claude/projects/.../memory/eas_build_summary.md` -- new summary
- `.claude/projects/.../memory/eas_build_history_full.md` -- renamed from eas_build_history.md
- Removed 10 per-screen MyBooks memory files

## Context Budget After

| Source | Before | After |
|--------|--------|-------|
| memory.md | 47 KB | ~5 KB |
| TODOS.md | 22 KB (always) | 0 KB (on demand) |
| MEMORY.md | 6 KB | ~4 KB |
| Auto-memory files | ~1.2 KB (index only, but 30+ entries) | ~1 KB (20 entries, split active/historical) |
| Session-start protocol | 5 tool calls | 3 tool calls |
| **Total saved** | | **~60 KB per session start** |
