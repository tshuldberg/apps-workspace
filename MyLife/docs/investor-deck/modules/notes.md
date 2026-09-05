# MyNotes — Module Audit

**ID:** notes | **Prefix:** nt_ | **Tier:** free | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Private knowledge engine with markdown, wiki linking, and intelligence

## User Value
- Markdown notes with [[wiki backlinks]], FTS5 full-text search, folders, tags, templates
- Infinite canvas/whiteboard with nodes, edges, groups, snap-to-grid, viewport culling
- Relational databases (Notion-style) with columns, rows, cells, views
- Web clipper + OCR-searchable image/file attachments
- On-device AI writing assistant + knowledge-graph intelligence (hubs, bridges, orphans)

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Note CRUD (pinned-first, favorites) | src/db/crud.ts | shipped |
| FTS5 search with snippet highlighting | src/db/crud.ts | shipped |
| Folder hierarchy (self-referencing, CASCADE) | src/db/crud.ts | shipped |
| Tag system + co-occurrence intelligence | src/engine/tag-intelligence.ts | shipped |
| Wiki [[backlinks]] auto-detection | src/engine/markdown.ts | shipped |
| Templates (8 built-in, variable expansion) | src/templates | shipped |
| Daily notes | src/daily | shipped |
| Canvas/whiteboard (6 node types, 5 shapes, 3 edge styles) | src/canvas, src/db/canvas.ts | shipped |
| Relational databases | src/db/databases.ts | shipped |
| Attachments with OCR search (nt_attachments_fts) | src/db/attachments.ts | shipped |
| AI history log | src/db/ai-history.ts | shipped |
| Plugins system | src/db/plugins.ts | shipped |
| Web clipper (HTML-to-markdown) | src/engine/web-clipper.ts | shipped |
| Local AI writing assistant (summarize, grammar, simplify) | src/ai/local-engine.ts | shipped |
| Knowledge discovery (staleness, similarity, gaps) | src/engine/knowledge-discovery.ts | shipped |
| Writing analytics (trends, velocity, streaks) | src/engine/writing-analytics.ts | shipped |
| Link intelligence (hubs, bridges, density) | src/engine/link-intelligence.ts | shipped |
| Tag intelligence (usage, co-occurrence, suggestions) | src/engine/tag-intelligence.ts | shipped |
| Graph analysis (filter, local, orphans, clusters) | src/engine/graph.ts | shipped |
| Checklist engine (toggle, indent, auto-sort checked) | src/engine/checklist.ts | shipped |
| GFM tables (parse, generate, alignment) | src/engine/table.ts | shipped |
| Code-block parsing + language resolution | src/engine/code-highlight.ts | shipped |

## Data Model
Prefix `nt_`, schema v4. 20+ tables including nt_notes (+ FTS5), nt_folders, nt_tags, nt_note_tags, nt_note_links, nt_templates, nt_settings, nt_attachments (+ FTS5 on OCR), nt_ai_history, nt_databases, nt_db_columns, nt_db_rows, nt_db_cells, nt_plugins, nt_plugin_settings, nt_canvases, nt_canvas_nodes, nt_canvas_edges. V4 adds hub_tag_id for shadow-write into hub_tags.

## Screens / User Flows
Mobile tabs: Notes, Folders, Canvas, Insights, Search, Settings. Stack screens: note-editor, note-preview, canvas-editor. 26 mobile route files, 15 web route files. FTS5 kept in sync via 3 SQLite triggers (INSERT/DELETE/UPDATE).

## Distinctive / Moat-worthy
- Obsidian-class knowledge graph (hubs + bridges + articulation-point detection) in a free-tier consumer app
- 286 passing tests across 8 files
- On-device AI (extractive summarization, grammar, simplification) — zero network dependency

## Gaps vs competitors
- No real-time collaboration (Notion/Craft hook)
- Local AI only; no LLM-grade rewriting/brainstorm
- Canvas export to Obsidian Canvas JSON would be straightforward but not verified shipped

## Investor-facing hook
A free Obsidian + Notion + Notability replacement with FTS5 + knowledge graph + OCR + canvas shipping inside a 30-module suite that Obsidian users would pay $8/mo to replicate.
