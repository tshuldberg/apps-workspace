# MyNotes - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Complete (CEO review GP-17-15a applied 2026-03-24)

## Current State
Full module with 3 schema versions (20+ tables), 200+ exports, 286 tests, and 4 intelligence engines. All P0-P3 competitive features implemented including databases, plugins, and canvas. Identity rewritten from "plain markdown notes" to "private knowledge engine with intelligence."

**Strategic Note:** MyNotes' primary job is suite retention -- keeping MyLife users from reaching for Apple Notes or Obsidian. The differentiator is suite integration + privacy/offline + cross-platform + intelligence engines, not competing directly with Notion's database system or Obsidian's plugin ecosystem.

## Competitors Analyzed

| Competitor | Pricing | Focus |
|-----------|---------|-------|
| Notion | $120/yr | All-in-one workspace with databases, docs, wikis, and project management |
| Evernote | $99-250/yr | Note capture, organization, and search with OCR and web clipping |
| Bear | $30/yr | Elegant markdown notes with tags and nested tags (Apple ecosystem) |
| Obsidian | Free (core), $50/yr (sync) | Local-first markdown with wiki linking, graph view, and 1600+ plugins |

## Feature Gaps (Full Build Required)

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Markdown note creation and editing | P0 | Bear, Obsidian | Medium | Rich markdown editor with live preview. Support headings, bold, italic, lists, links |
| Tag-based organization | P0 | Evernote, Bear, Obsidian | Low | Organize notes with tags and nested tags. Multi-tag filtering |
| Full-text search | P0 | All competitors | Medium | Fast FTS5 search across all notes, titles, and tags |
| Folder organization | P0 | Evernote, Obsidian | Low | Hierarchical folder structure alongside tag-based organization |
| Note pinning/favorites | P0 | Bear | Low | Quick access to frequently used notes at the top of the list |
| Wiki-style [[linking]] | P1 | Bear, Obsidian | Medium | Link between notes using double-bracket syntax. Auto-create notes from links |
| Backlinks panel | P1 | Obsidian | Medium | See all notes that link to the current note. Essential for knowledge graph navigation |
| Templates | P1 | Notion, Obsidian | Low | Reusable note templates (meeting notes, project plan, weekly review, etc.) |
| Checklists/todo items | P1 | Notion, Bear | Low | Checkable task lists within notes. Track completion state |
| Code blocks with syntax highlighting | P1 | Bear, Obsidian | Medium | Developer-friendly code formatting with language detection |
| Image/file attachments | P1 | All competitors | Medium | Embed images and files in notes. Store attachments locally |
| Note export (markdown, PDF) | P1 | Bear, Obsidian | Medium | Export individual notes or bulk export as markdown files or PDF |
| Graph view | P2 | Obsidian | High | Visual map of note connections based on wiki links. Interactive force-directed graph |
| Web clipper | P2 | Notion, Evernote | High | Save web pages as notes. Requires browser extension or share sheet integration |
| OCR search in images | P2 | Evernote, Bear | High | Search text within attached images. Requires on-device OCR |
| Daily notes | P2 | Obsidian | Low | Auto-create dated daily note from template. Good for daily logs and standup notes |
| Table support | P2 | Notion | Medium | Create and edit tables within notes. Markdown table syntax with visual editor |
| AI writing assistant | P2 | Notion, Evernote | High | Summarize, expand, improve text. On-device if possible to preserve privacy |
| Plugin system | P3 | Obsidian (1600+) | Very High | Extensible with community plugins. Massive scope, defer indefinitely |
| Relational databases | P3 | Notion | Very High | Structured data within notes. Core Notion differentiator, do not attempt |
| Canvas/whiteboard | P3 | Obsidian | Very High | Visual spatial note arrangement. High effort, niche usage |

## Recommended MVP Features

Minimal feature set to ship v1 of MyNotes:

1. **Markdown editor** - Rich markdown editing with live preview and keyboard shortcuts
2. **Folder + tag organization** - Hierarchical folders and flexible tags for dual organization
3. **Full-text search** - FTS5 search across note content, titles, and tags
4. **Wiki-style [[linking]]** - Double-bracket linking between notes with auto-creation
5. **Backlinks panel** - See all notes that reference the current note
6. **Note pinning** - Pin frequently accessed notes to the top
7. **Export** - Markdown and PDF export for individual notes or bulk

This MVP positions MyNotes as "Obsidian for mobile" - local-first markdown notes with linking and backlinks, but with a polished cross-platform UI.

## Full Feature Roadmap

1. **v1.0 (MVP)** - Markdown editor, folders, tags, search, wiki linking, backlinks, pinning, export
2. **v1.1** - Templates, checklists/todos, daily notes
3. **v1.2** - Code blocks with syntax highlighting, image/file attachments
4. **v1.3** - Table support, note sorting and filtering improvements
5. **v2.0** - Graph view (visual note connections), web clipper (share sheet)
6. **v2.1** - OCR search in images, AI writing assistant (on-device)
7. **v3.0** - Evaluate plugin system feasibility based on user demand

P3 features (plugin system, relational databases, canvas) are intentionally deferred. These are the core differentiators of Obsidian and Notion respectively, and attempting to replicate them would require years of development with uncertain payoff.

## Privacy Competitive Advantage

Note-taking apps contain some of the most sensitive personal and professional data: meeting notes, project plans, personal reflections, passwords (unfortunately), medical notes, legal documents, and more:

- **Notion** stores everything in the cloud. They have faced criticism for data handling practices and their privacy policy grants broad usage rights. Enterprise data, personal notes, and sensitive documents all live on Notion's servers.
- **Evernote** was acquired by Bending Spoons in 2022 and subsequently changed its privacy terms. The company laid off most staff and pivoted strategy, raising concerns about data stewardship. Evernote employees historically had access to user notes for "quality assurance."
- **Bear** uses iCloud sync, which provides Apple's standard encryption but locks users into the Apple ecosystem. No Android or Windows support.
- **Obsidian** is the privacy gold standard: local plain-text markdown files, no account required, no telemetry. Their paid Sync service is E2E encrypted. However, the mobile app experience is secondary to desktop.

MyNotes' positioning: **Obsidian's privacy model with true cross-platform support.** Local-first markdown stored in SQLite, no accounts, no cloud dependency, no telemetry. Works on iOS, Android, and web. For users who want Obsidian's privacy guarantees but need Android support or a mobile-first experience, MyNotes fills a genuine gap.

## Cross-Module Integration

| Module | Integration Point |
|--------|------------------|
| MyBooks | Reading notes linked to specific books. Create notes from book highlights and annotations |
| MyRecipes | Recipe notes with structured formatting. Link recipes to ingredient lists and cooking logs |
| MyJournal | Structured notes (MyNotes) vs freeform reflections (MyJournal). Different tools for different writing modes |
| MyFlash | Create flashcards directly from note content. Select text, generate cards with one action |
| MyHabits | Project notes for productivity tracking. Link notes to habit-related goals and reviews |
| MyMeds | Medical notes and appointment records. Link to medication logs for context |
