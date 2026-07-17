# MyNotes — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## 1. Overview

**MyNotes** — Notes that are just files. No lock-in, no cloud, no accounts.

A local-first Markdown notes app for iOS, Android, Mac, and web. Write in Markdown with live preview, organize with folders and tags, link notes with [[wikilinks]], and search everything instantly — all stored as plain .md files on your device's filesystem. Your notes are never locked in a proprietary database. Part of the My* app family.

### Primary Differentiator

> "Your notes are just files. Plain Markdown, on your device, forever."

Obsidian stores notes as Markdown files but charges $48/year for sync and locks advanced features behind paid plans. Notion stores everything in a proprietary cloud database — if Notion shuts down, your notes are gone. Bear uses a proprietary format and only works on Apple devices. MyNotes stores notes as standard .md files in the device's filesystem. You can open them in any text editor, sync them with any file sync service, and they'll outlive every app on this list.

---

## 2. Problem Statement

Note-taking apps have evolved from simple text tools into complex platforms that create vendor lock-in:

1. **Proprietary formats** — Notion, Bear, Apple Notes, Google Keep, and Evernote all use proprietary storage formats. Exporting data is possible but lossy — formatting, links, and structure break.
2. **Cloud dependency** — Notion is entirely cloud-based. If their servers go down, you can't access your notes. Apple Notes requires iCloud. Google Keep requires a Google account. Your notes are hostage to service availability.
3. **Subscription fatigue** — Obsidian charges $48/year for sync (a feature the filesystem already provides). Notion charges $96/year for team features most individuals don't need. Evernote charges $130/year and has been declining for years.
4. **Platform lock-in** — Bear is Apple-only. Apple Notes is Apple-only. Google Keep has no desktop app. None offer true cross-platform with an open format.
5. **Complexity creep** — Notion, Obsidian, and Logseq have become so feature-rich that new users face a steep learning curve. A significant user segment wants simple Markdown notes with good search, not a knowledge management system.

MyNotes solves these by storing notes as plain .md files, working across all platforms, charging once, and keeping the interface focused on writing.

---

## 3. Target User Persona

### Primary: "The Markdown Minimalist"

- **Age:** 25-45
- **Archetype:** Developer, writer, or knowledge worker who writes in Markdown already. Uses VS Code, Obsidian, or plain text files for notes. Values simplicity and portability over features.
- **Pain:** Obsidian is great but the sync is $48/year for something iCloud/Dropbox already does. Notion is overkill for personal notes. Apple Notes doesn't support Markdown.
- **Motivation:** Wants a clean, fast Markdown editor with search and wikilinks. Wants notes stored as real files they can access from Finder/Files.
- **Willingness to pay:** $5-15 one-time. Will not pay for sync when file sync already exists.

### Secondary: "The Notion Refugee"

- **Age:** 22-40
- **Archetype:** Was a Notion power user but grew tired of the complexity, the loading times, and the dependence on cloud availability. Wants to simplify.
- **Pain:** Exported Notion data is a mess of nested folders and broken links. Wants a fresh start with a simpler tool that still supports linking and organization.
- **Motivation:** Clean slate. Simple folders, Markdown files, good search. No databases, no templates marketplace, no AI features.

### Anti-Persona: "The Knowledge Graph Power User"

- **MyNotes is NOT a Zettelkasten platform.** Users who want graph views, backlink analysis, daily notes workflows, and plugin ecosystems should use Obsidian. MyNotes is a notes app, not a knowledge management system.

---

## 4. Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|--------------|
| **Obsidian** | Free (core), $48/yr sync, $50/yr publish | 4M+ users | ~$30M ARR | Local .md files (good!), but sync uses their servers. Telemetry opt-out available. | Sync is expensive for what it does. Plugin ecosystem creates complexity. Not truly cross-platform on mobile (Electron feel). |
| **Notion** | Free (limited), $96/yr personal, $120/yr team | 100M+ users | ~$1B ARR | **Cloud-only.** All data on Notion servers. No local-first option. Analytics SDKs. | No offline. Slow loading. Proprietary format. If Notion dies, your data is trapped. |
| **Bear** | Free (basic), $30/yr | 2M+ users | ~$15M ARR | Local storage, iCloud sync (Apple ecosystem). | **Apple-only.** Proprietary format (exports to MD but not native). Subscription for basic features (themes, tags). |
| **Apple Notes** | Free | 100M+ (bundled) | — | iCloud sync, E2E encryption available. | No Markdown. Apple-only. No export to standard formats. |
| **Logseq** | Free (open-source) | 1M+ users | Funded | Local .md/.org files. Open-source. | Outliner-first UX is polarizing. Performance issues with large graphs. Steep learning curve. |
| **Joplin** | Free (open-source), $29-58/yr sync | 1M+ users | — | E2E encryption, local DB + sync. | Proprietary DB format (not plain files). UX is dated. |
| **MyNotes** | **$4.99 one-time** | — | — | **Plain .md files. Zero cloud. Zero accounts. Zero proprietary format.** | New entrant. No graph view (intentional). No plugin ecosystem. |

### Opportunity

The note-taking market is massive ($1B+ annually) but fragmented. Obsidian proved that Markdown-first, local-first note-taking has a large audience — but their sync pricing ($48/year) is a recurring pain point. The "plain files" angle differentiates from both proprietary-format apps (Notion, Bear) and local-but-database apps (Joplin). Users who want simplicity and portability have no great option at a one-time price point.

---

## 5. Key Features (MVP)

### P0 — Must Have (Launch)

- [ ] **Markdown Editor** — Full Markdown support with syntax highlighting in the editor
- [ ] **Live Preview** — Split-pane or toggle between edit and rendered preview
- [ ] **Folder Organization** — Nested folders mirroring filesystem directories
- [ ] **Full-Text Search** — Instant search across all notes (title and content)
- [ ] **Tags** — Inline tags via #hashtag syntax, tag browser/filter
- [ ] **Note Linking** — [[wikilink]] syntax for linking between notes. Tap to navigate.
- [ ] **Quick Capture** — Widget and share extension for capturing text/URLs into a note fast
- [ ] **Dark Mode** — Default, matching My* brand
- [ ] **Export** — Notes are already .md files. "Export" just means accessing them in the filesystem or sharing via share sheet.

### P1 — Should Have (v1.1)

- [ ] iCloud Drive sync (notes are just files — iCloud syncs them automatically)
- [ ] Pin notes to top
- [ ] Note templates (daily note, meeting note, etc.)
- [ ] Keyboard shortcuts (desktop/web)
- [ ] Markdown table support
- [ ] Code block syntax highlighting
- [ ] Image embed (copy/paste and drag-drop, stored alongside the .md file)

### P2 — Nice to Have (v2.0)

- [ ] Backlinks panel ("Notes that link to this note")
- [ ] PDF export (rendered Markdown)
- [ ] Drag-and-drop folder reorganization
- [ ] Note versioning (local git-like history)
- [ ] Custom CSS themes
- [ ] Vim keybindings option
- [ ] Mermaid diagram rendering
- [ ] Math (KaTeX/LaTeX) rendering

---

## 6. Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Database:** SQLite for search index and metadata; actual notes stored as .md files on filesystem
- **Editor:** CodeMirror 6 (web/desktop) / custom React Native TextInput with Markdown highlighting (mobile)
- **Markdown Parsing:** unified/remark/rehype ecosystem (AST-based Markdown processing)
- **Search:** SQLite FTS5 (full-text search) — index rebuilt from filesystem on launch
- **File System (Mobile):** expo-file-system for reading/writing .md files
- **File System (Web/Mac):** File System Access API (Chrome) / Node.js fs (Electron/desktop)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Payments:** RevenueCat (App Store IAP) + Lemon Squeezy (direct sales)
- **License:** FSL -> Apache 2.0 after 2 years

### Monorepo Structure

```
MyNotes/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   ├── components/        # Mobile-specific components
│   │   │   ├── editor/        # Mobile Markdown editor
│   │   │   └── viewer/        # Mobile Markdown renderer
│   │   ├── hooks/             # Mobile-specific hooks
│   │   └── assets/            # Icons, images, fonts
│   ├── web/                   # Next.js 15 — Web + Mac
│   │   ├── app/               # App Router
│   │   ├── components/        # Web-specific components
│   │   │   ├── editor/        # CodeMirror 6 Markdown editor
│   │   │   └── viewer/        # Rendered Markdown preview
│   │   └── public/            # Static assets
│   └── mac/                   # Mac App Store (Electron wrapper or Catalyst)
├── packages/
│   ├── shared/                # Types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/         # Note, Folder, Tag, SearchResult types
│   │   │   ├── models/        # Note operations, folder tree, tag parser
│   │   │   ├── markdown/      # Markdown parser, wikilink resolver, frontmatter
│   │   │   ├── utils/         # Slug generation, path helpers, date formatters
│   │   │   └── constants/     # Default templates, Markdown shortcuts
│   │   └── package.json
│   ├── ui/                    # Shared component library
│   │   ├── src/
│   │   │   ├── sidebar/       # FolderTree, NoteList, TagBrowser, SearchBar
│   │   │   ├── editor/        # ToolBar, FormatButton, LinkInsert
│   │   │   ├── viewer/        # RenderedMarkdown, CodeBlock, WikiLink
│   │   │   ├── cards/         # NoteCard, FolderCard, SearchResultCard
│   │   │   └── layout/        # SplitPane, TabBar, Header, Modal
│   │   └── package.json
│   ├── search/                # Search index engine
│   │   ├── src/
│   │   │   ├── indexer.ts     # Build FTS5 index from .md files
│   │   │   ├── query.ts       # Full-text search queries
│   │   │   ├── watcher.ts     # Filesystem watcher for index updates
│   │   │   └── types.ts
│   │   └── package.json
│   └── fs/                    # Filesystem abstraction layer
│       ├── src/
│       │   ├── mobile.ts      # expo-file-system implementation
│       │   ├── web.ts         # File System Access API implementation
│       │   ├── node.ts        # Node.js fs implementation (desktop)
│       │   └── interface.ts   # Common FileSystem interface
│       └── package.json
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── CLAUDE.md
├── README.md
└── timeline.md
```

### Data Model

MyNotes has a split data architecture:

1. **Notes are plain .md files** — stored in the device's filesystem (Documents/MyNotes/ on mobile, user-chosen directory on desktop/web)
2. **SQLite is the index** — stores metadata, search index, and tag associations for fast queries. The SQLite database is derived from the filesystem and can be fully rebuilt at any time.

#### Filesystem Layout

```
MyNotes/                          # Root notes directory
├── Inbox/                        # Quick capture landing zone
│   └── 2026-02-22-quick-note.md
├── Personal/
│   ├── journal/
│   │   ├── 2026-02-22.md
│   │   └── 2026-02-21.md
│   └── recipes/
│       ├── sourdough-bread.md
│       └── pasta-sauce.md
├── Work/
│   ├── meeting-notes/
│   │   └── 2026-02-22-standup.md
│   └── project-ideas.md
└── .mynotes/                     # Hidden metadata directory
    ├── index.db                  # SQLite search index + metadata
    └── config.json               # User preferences
```

#### Note File Format

```markdown
---
title: Sourdough Bread Recipe
created: 2026-02-22T10:30:00
modified: 2026-02-22T14:15:00
tags: [cooking, bread, fermentation]
pinned: false
---

# Sourdough Bread Recipe

This is my go-to recipe for a basic sourdough loaf.

## Ingredients

- 500g bread flour
- 350g water
- 100g active starter
- 10g salt

## Method

See [[fermentation-notes]] for starter maintenance.

#cooking #bread
```

Notes use YAML frontmatter for metadata. Tags can be specified in frontmatter and/or inline as #hashtags. Both sources are merged.

#### SQLite Schema (Search Index + Metadata)

```sql
-- Note metadata (derived from filesystem + frontmatter)
CREATE TABLE notes (
    id TEXT PRIMARY KEY,                           -- UUID
    title TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,                -- Relative path from notes root
    folder_path TEXT NOT NULL,                      -- Parent directory path
    content_hash TEXT NOT NULL,                     -- SHA-256 of file content (change detection)
    word_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,                       -- From frontmatter or file creation time
    modified_at TEXT NOT NULL,                      -- From frontmatter or file modification time
    is_pinned INTEGER DEFAULT 0,
    indexed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_notes_folder ON notes(folder_path);
CREATE INDEX idx_notes_modified ON notes(modified_at DESC);
CREATE INDEX idx_notes_pinned ON notes(is_pinned DESC, modified_at DESC);

-- Full-text search index
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title,
    body,
    content='notes',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- Tags
CREATE TABLE tags (
    id TEXT PRIMARY KEY,                            -- UUID
    name TEXT NOT NULL UNIQUE,                      -- Tag name (without #)
    note_count INTEGER DEFAULT 0,                   -- Cached count
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_tags_name ON tags(name);

-- Note-tag associations
CREATE TABLE note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_tag ON note_tags(tag_id);

-- Wikilink associations (for backlinks)
CREATE TABLE note_links (
    source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    target_title TEXT NOT NULL,                     -- The [[title]] text (may not resolve)
    is_resolved INTEGER DEFAULT 0,                 -- Whether target exists
    PRIMARY KEY (source_note_id, target_title)
);

CREATE INDEX idx_note_links_target ON note_links(target_note_id);

-- Folders (derived from filesystem)
CREATE TABLE folders (
    id TEXT PRIMARY KEY,                            -- UUID
    path TEXT NOT NULL UNIQUE,                      -- Relative directory path
    name TEXT NOT NULL,                              -- Directory name
    parent_path TEXT,                                -- Parent directory path
    note_count INTEGER DEFAULT 0,                   -- Cached count
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_folders_parent ON folders(parent_path);

-- User preferences
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Privacy Architecture

- **Notes are plain files** — Standard .md files in the filesystem. No proprietary database, no binary format. Open them in VS Code, Finder, any text editor.
- **Zero network calls** — The app makes no HTTP requests. Search index is local SQLite. No cloud features.
- **No accounts** — No sign-up, no login, no user IDs. The app works immediately on first launch.
- **No telemetry** — No analytics SDKs, no crash reporting services, no event tracking.
- **Sync is filesystem-level** — iCloud Drive, Dropbox, Google Drive, Syncthing — any file sync service works because notes are just files. MyNotes doesn't implement its own sync protocol.
- **Permissions are minimal** — File system access (to read/write notes). Notifications (for reminders, optional). No camera, no location, no contacts, no microphone.
- **Index is disposable** — The SQLite database can be deleted and rebuilt from the .md files at any time. The files are the source of truth, not the database.

### Markdown Processing Pipeline

```typescript
// packages/shared/src/markdown/pipeline.ts

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeHighlight from 'rehype-highlight'

// Custom plugins
import remarkWikilinks from './plugins/remark-wikilinks'
import remarkHashtags from './plugins/remark-hashtags'

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)                    // Tables, strikethrough, autolinks, task lists
  .use(remarkWikilinks, {            // [[wikilink]] -> clickable links
    resolveLink: (title: string) => resolveNoteByTitle(title)
  })
  .use(remarkHashtags)               // #tag -> clickable tag links
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeHighlight)              // Code block syntax highlighting
  .use(rehypeStringify)
```

### Filesystem Abstraction

```typescript
// packages/fs/src/interface.ts

interface FileSystem {
  // Notes root directory
  getNotesRoot(): Promise<string>
  setNotesRoot(path: string): Promise<void>

  // File operations
  readFile(relativePath: string): Promise<string>
  writeFile(relativePath: string, content: string): Promise<void>
  deleteFile(relativePath: string): Promise<void>
  moveFile(from: string, to: string): Promise<void>
  fileExists(relativePath: string): Promise<boolean>
  getFileInfo(relativePath: string): Promise<FileInfo>

  // Directory operations
  listDirectory(relativePath: string): Promise<DirectoryEntry[]>
  createDirectory(relativePath: string): Promise<void>
  deleteDirectory(relativePath: string): Promise<void>

  // Watch for changes (rebuild index on external edits)
  watchDirectory(
    relativePath: string,
    callback: (event: FSEvent) => void
  ): () => void

  // Bulk operations
  listAllNotes(): Promise<string[]>  // All .md files recursively
}

interface FileInfo {
  name: string
  path: string
  size: number
  createdAt: Date
  modifiedAt: Date
  isDirectory: boolean
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}
```

Three implementations:
- **`mobile.ts`** — Uses expo-file-system. Notes stored in `Documents/MyNotes/`.
- **`web.ts`** — Uses File System Access API (showDirectoryPicker). User grants access to a folder.
- **`node.ts`** — Uses Node.js `fs` module. For desktop (Electron/Tauri) and build tooling.

---

## 7. UI/UX Direction

### Design Language

- **Theme:** Dark mode default (matching My* brand)
- **Palette:** Dark background (#0D0D0D), warm surface (#1A1A1A), amber accent (#F59E0B) for active elements, teal (#14B8A6) for links/wikilinks, soft white (#E5E5E5) for editor text
- **Typography:** JetBrains Mono for the editor (monospace), Inter for UI chrome (sans-serif). Editor text should feel like a code editor — developers are the primary audience.
- **Iconography:** Minimal, outlined. File/folder icons use a clean document metaphor.
- **Animations:** Subtle. Sidebar collapse/expand. Smooth scrolling. No flashy transitions — the editor should feel instant and responsive.
- **Philosophy:** The editor is the app. Everything else (sidebar, toolbar, preview) serves the editor. Minimal chrome. Maximum writing space.

### Navigation

**Mobile (Bottom Tabs):**

| Tab | Label | Screen |
|-----|-------|--------|
| Notes | Notes | Folder browser + note list |
| Search | Search | Full-text search |
| Quick | Quick | Quick capture (new note with one tap) |
| Tags | Tags | Tag browser |
| Settings | Settings | Preferences, about |

**Desktop/Web (Sidebar):**

- **Left Sidebar:** Folder tree (collapsible), tag list, pinned notes, search bar
- **Center:** Editor (Markdown source with syntax highlighting)
- **Right Panel (toggle):** Live preview, backlinks, or outline (table of contents)
- **Top Bar:** Note title, folder breadcrumb, toolbar (bold, italic, link, image, code, list, heading)

### Screen Flows

#### 7.1 Notes Screen (Mobile)

- **Folder Browser:** Nested folder list. Tap folder to expand/collapse. Tap note to open.
- **Note List:** Within a folder, notes sorted by modified date (most recent first). Each row shows title, first line preview, modified date, tag pills.
- **Swipe Actions:** Swipe left to delete (with confirmation). Swipe right to pin.
- **Sort:** By modified date (default), created date, title (alphabetical)
- **New Note:** Floating + button. Creates note in current folder.
- **Move Note:** Long press to move to another folder

#### 7.2 Editor Screen (Mobile)

- **Toolbar:** Floating toolbar above keyboard with Markdown shortcuts: H1, H2, Bold, Italic, Link, Image, Code, List, Checkbox, Blockquote
- **Editor:** Full-screen text input with Markdown syntax highlighting (headings are larger, bold is bold, code is monospace, links are teal)
- **Preview Toggle:** Tap eye icon to switch to rendered preview
- **[[Wikilink]] Autocomplete:** Typing `[[` triggers a dropdown of note titles to link to
- **#tag Autocomplete:** Typing `#` triggers a dropdown of existing tags
- **Back Button:** Auto-saves on navigation

#### 7.3 Editor Screen (Desktop/Web)

- **Split Pane:** Editor on left, live preview on right (resizable). Can toggle to editor-only or preview-only.
- **CodeMirror 6:** Full-featured Markdown editor with syntax highlighting, line numbers (optional), bracket matching, and keyboard shortcuts
- **Command Palette:** Cmd+P to open any note by title (fuzzy search)
- **Quick Switch:** Cmd+K to search and navigate to any note
- **Vim Mode:** Optional vim keybindings (settings toggle)
- **Outline Panel:** Table of contents generated from headings, click to jump
- **Backlinks Panel:** Notes that link to the current note via [[wikilinks]]

#### 7.4 Search Screen

- **Search Bar:** Auto-focus on tab switch. Results update as you type.
- **Results:** Ranked by relevance (FTS5 ranking). Shows title, matched content snippet with highlights, folder path, modified date.
- **Filters:** By folder, by tag, by date range
- **Scope:** Search title only, content only, or both (default: both)

#### 7.5 Tags Screen (Mobile)

- **Tag Cloud/List:** All tags sorted by frequency or alphabetically
- **Tag Detail:** Tap a tag to see all notes with that tag
- **Tag Count Badge:** Number of notes per tag

#### 7.6 Quick Capture

- **Widget (iOS/Android):** Home screen widget with text input. Tap to write, saves to Inbox folder.
- **Share Extension:** Share text/URLs from other apps directly into a new note.
- **Quick Entry:** Opens a minimal editor pre-targeted at Inbox/. Title auto-generated from date+time.

#### 7.7 Settings Screen

- **Notes Directory:** View/change where notes are stored on filesystem
- **Editor:** Font size, line height, monospace/sans-serif toggle, vim mode, spell check
- **Display:** Theme (dark/light/system), sidebar width
- **Sync:** iCloud Drive toggle (future — just enables storing notes in iCloud Drive directory)
- **About:** Version, licenses, privacy policy, My* family links
- **Source Code:** Link to GitHub repository
- **Rebuild Index:** Force-rebuild SQLite index from filesystem

---

## 8. Monetization

### Pricing Model

- **Price:** $4.99 one-time (USD)
- **No subscription.** Sync is handled by the filesystem, not our servers.
- **No ads.** A notes app with ads would be unusable.
- **No in-app purchases beyond the initial unlock.**

### Why $4.99

Notes apps have higher perceived value and longer retention than mood trackers or plant apps. Users who adopt a notes app tend to use it for years. $4.99 is still 90% cheaper than one year of Obsidian Sync, 95% cheaper than Notion, and 75% cheaper than Bear.

### Revenue Channels

| Channel | Platform | Provider | Cut |
|---------|----------|----------|-----|
| iOS App Store | iPhone, iPad, Mac (Catalyst) | Apple IAP via RevenueCat | 70/30 then 85/15 |
| Google Play Store | Android | Google IAP via RevenueCat | 70/30 then 85/15 |
| Mac App Store | macOS native | Apple IAP via RevenueCat | 70/30 |
| Direct sales | Web, GitHub | Lemon Squeezy | 95/5 |

### Revenue Projections (Conservative)

| Scenario | Downloads/mo | Conversion | Revenue/mo |
|----------|-------------|-----------|-----------|
| Baseline (Month 1-3) | 10,000 | 5% | $5,000 |
| Growing (Month 4-8) | 30,000 | 8% | $24,000 |
| Established (Month 9-12) | 60,000 | 10% | $60,000 |

Notes apps have the highest search volume of any productivity category. "Markdown notes app", "note-taking app", and "Obsidian alternative" are high-intent searches with significant volume.

### Why One-Time Works

- **Zero server costs** — No sync servers, no cloud storage, no API endpoints
- **Filesystem does sync** — iCloud Drive, Dropbox, Google Drive all sync files for free. We don't need to build (or pay for) our own sync.
- **Notes are long-lived** — Users who adopt a notes system stick with it for years. Word-of-mouth compounds.
- **Open format is marketing** — "Your notes are just files" is a differentiator that generates organic discussion in developer and productivity communities.

---

## 9. Marketing Angle

### Positioning

**Tagline:** "Notes that are just files. No lock-in, no cloud, no accounts."

**Elevator pitch:** MyNotes is a Markdown notes app that stores your notes as plain .md files. Folders, tags, wikilinks, full-text search, live preview — all running locally on your device. $4.99 once, open format, sync with any file sync service you already use.

### Launch Strategy

1. **Reddit (organic):** Post in r/ObsidianMD (200K), r/notetaking (150K), r/productivity (2.5M), r/PKMS (80K), r/selfhosted (500K). Lead with the portability angle: "I built a notes app where your notes are just .md files in your filesystem."
2. **Hacker News:** Developer-focused launch post. Emphasize open format, local-first architecture, no telemetry. HN audience values these properties.
3. **Developer communities:** Dev.to, Lobsters, developer newsletters. Markdown is the developer's native format.
4. **Obsidian community:** Not adversarial — position as "Obsidian Lite" for people who want simplicity without the plugin ecosystem. "Love Obsidian's format? We use the same plain .md files."
5. **Privacy communities:** r/privacy, r/degoogle, r/PrivacyGuides. Cross-promote with other My* apps.
6. **Product Hunt launch:** "Open-format notes" category.
7. **Content marketing:** "I exported my Notion data. Here's what I found." / "What happens to your notes when the app dies?" / "The case for boring notes apps."

### Key Messages

- "Open them in VS Code. Open them in Finder. They're just files."
- "$4.99 once. Not $48/year for sync. Not $96/year for Notion."
- "Your notes will outlive every app on this list."
- "Sync with iCloud, Dropbox, or Syncthing. We don't care — they're your files."
- "[[Wikilinks]], #tags, full-text search. No plugin required."

---

## 10. MVP Timeline (Week-by-Week)

### Phase 1: Foundation (Weeks 1-2)

- [ ] Monorepo scaffold (Turborepo + pnpm + Expo + Next.js)
- [ ] Filesystem abstraction layer (mobile/web/node implementations)
- [ ] SQLite schema for search index and metadata
- [ ] Core types and shared business logic package
- [ ] Design tokens and UI component library foundation
- [ ] Navigation shell (mobile tabs + desktop sidebar)

### Phase 2: Editor and Filesystem (Weeks 3-4)

- [ ] Markdown editor (mobile): custom TextInput with syntax highlighting
- [ ] Markdown editor (web/desktop): CodeMirror 6 with Markdown extensions
- [ ] Live preview rendering (remark/rehype pipeline)
- [ ] File read/write operations (create, edit, save notes as .md files)
- [ ] Frontmatter parsing and generation
- [ ] Auto-save on blur/navigation

### Phase 3: Organization (Weeks 5-6)

- [ ] Folder browser (mobile + desktop sidebar)
- [ ] Create/rename/delete/move folders
- [ ] Note list within folders (sort by modified/created/title)
- [ ] Pin notes to top
- [ ] Tag parsing (frontmatter + inline #hashtags)
- [ ] Tag browser screen
- [ ] Move notes between folders

### Phase 4: Search and Linking (Weeks 7-8)

- [ ] SQLite FTS5 index builder (scan all .md files)
- [ ] Full-text search with ranked results and highlighted snippets
- [ ] [[Wikilink]] parsing and rendering
- [ ] Wikilink autocomplete in editor
- [ ] Note-to-note navigation via wikilinks
- [ ] Backlinks panel (v1: desktop only)
- [ ] Filesystem watcher for external edits (re-index on change)

### Phase 5: Quick Capture and Polish (Weeks 9-10)

- [ ] Quick capture widget (iOS + Android home screen)
- [ ] Share extension (receive text/URLs from other apps)
- [ ] Toolbar with Markdown formatting shortcuts
- [ ] Command palette (desktop: Cmd+P)
- [ ] Settings screen (editor, display, notes directory)
- [ ] Onboarding flow (set notes directory, intro to Markdown)
- [ ] Empty states
- [ ] Performance optimization (large note collections: 1000+ notes)

### Phase 6: Launch Prep (Weeks 11-12)

- [ ] App Store / Play Store listing preparation
- [ ] RevenueCat integration (one-time IAP)
- [ ] Lemon Squeezy integration (direct sales)
- [ ] Privacy policy and terms
- [ ] Beta testing (TestFlight + Google Play internal)
- [ ] Web app deployment (Next.js on Vercel)
- [ ] Marketing materials and launch posts
- [ ] App icon, splash screen, store screenshots
- [ ] Rebuild-index command and error recovery

---

## 11. Acceptance Criteria

The MVP is complete when:

1. **Markdown Editor** — User can create and edit notes in Markdown with syntax highlighting. Editor supports headings, bold, italic, links, images, code blocks, lists, and blockquotes.
2. **Live Preview** — User can toggle between editor and rendered Markdown preview (mobile) or view side-by-side (desktop).
3. **Plain .md Files** — Notes are stored as .md files in the device's filesystem. User can navigate to the notes directory and open files in any text editor.
4. **Folder Organization** — User can create nested folders, move notes between folders, and browse notes by folder.
5. **Full-Text Search** — User can search across all notes (title and content) with instant results and highlighted matches.
6. **Tags** — User can add tags via frontmatter or inline #hashtags. Tags are browsable and filterable.
7. **Wikilinks** — User can link between notes using [[title]] syntax. Links are clickable and navigate to the target note.
8. **Quick Capture** — Home screen widget and share extension allow creating notes without opening the full app.
9. **Privacy** — Zero network requests. No analytics SDKs. No account creation. App works fully offline.
10. **Cross-Platform** — Runs on iOS, Android, and web. Notes created on one platform are valid .md files accessible on any other.
11. **Payment** — One-time purchase of $4.99 via App Store IAP and direct sales.
12. **Performance** — App launches in <2s. Search returns results in <200ms with 1000+ notes. Editor is responsive (no lag on typing) with notes up to 50,000 words.

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| File System Access API limited on mobile browsers | Web app can't access local files on iOS Safari | Use progressive enhancement: full filesystem access on desktop Chrome/Firefox, read-only on mobile web, full access on native mobile apps. |
| Expo file system limitations on Android | Notes directory may not be user-accessible on Android | Use Android's scoped storage with SAF (Storage Access Framework). Allow user to choose directory. Fallback to app-internal storage with manual export. |
| iCloud Drive sync conflicts when editing same note on two devices | Data loss from conflicting edits | Implement conflict detection: compare content_hash before write. On conflict, keep both versions as `note.md` and `note.conflict.md`. Let user resolve manually. |
| CodeMirror 6 performance on very large notes (100K+ words) | Editor becomes unresponsive | Implement virtual scrolling for large documents. Set soft limit with user warning. Most notes are under 5000 words. |
| Obsidian has massive plugin ecosystem — users expect feature parity | Negative reviews comparing to Obsidian | Clear positioning: MyNotes is Obsidian Lite. Simpler, cheaper, cross-platform. Not trying to replace Obsidian for power users. |
| Low discoverability vs established players (Notion, Bear, Obsidian) | Slow adoption | Developer communities are the beachhead. "Plain .md files" messaging is inherently shareable and generates organic discussion. |

---

## 13. Design Tokens (Dark Theme)

```typescript
const theme = {
  colors: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    text: '#E5E5E5',                  // Slightly softer than pure white for long reading
    textSecondary: '#999999',
    textTertiary: '#666666',
    accent: '#F59E0B',                // Amber — primary brand color
    accentSecondary: '#14B8A6',       // Teal — links and wikilinks
    wikilink: '#14B8A6',             // Teal — [[wikilinks]]
    tag: '#F59E0B',                   // Amber — #tags
    heading: '#FFFFFF',               // Headings are brighter than body text
    codeBackground: '#161616',        // Slightly darker for code blocks
    codeText: '#E5C07B',             // Warm gold for code
    selection: 'rgba(245, 158, 11, 0.2)', // Amber selection highlight
    cursor: '#F59E0B',
    sidebarBackground: '#111111',
    sidebarActive: '#1A1A1A',
    sidebarHover: '#181818',
    tabActive: '#FFFFFF',
    tabInactive: '#666666',
    border: '#2A2A2A',
    searchHighlight: 'rgba(245, 158, 11, 0.3)',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 4, md: 8, lg: 12 },
  typography: {
    editor: {
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 15,
      lineHeight: 1.7,
    },
    editorH1: { fontSize: 28, fontWeight: '700', fontFamily: 'Inter' },
    editorH2: { fontSize: 22, fontWeight: '600', fontFamily: 'Inter' },
    editorH3: { fontSize: 18, fontWeight: '600', fontFamily: 'Inter' },
    preview: {
      fontFamily: "'Inter', -apple-system, sans-serif",
      fontSize: 16,
      lineHeight: 1.75,
    },
    noteTitle: { fontSize: 18, fontWeight: '600', fontFamily: 'Inter' },
    notePreview: { fontSize: 13, fontWeight: '400', color: '#999999' },
    sidebarItem: { fontSize: 14, fontWeight: '400' },
    sidebarHeader: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    searchResult: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400', color: '#666666' },
    button: { fontSize: 14, fontWeight: '600' },
  }
}
```

---

## 14. Technical Decisions and Rationale

### Why Plain .md Files Instead of SQLite-Only

| Consideration | Plain Files | SQLite-Only |
|---------------|------------|-------------|
| Portability | Open any note in any editor | Locked to our app |
| Sync | Any file sync service works | Need custom sync protocol |
| Backup | Copy a folder | Export from database |
| Longevity | Files outlive apps | Database requires our app to read |
| External editing | Users can edit in VS Code, then see changes in MyNotes | Not possible |
| Performance at scale | Slower search (mitigated by FTS5 index) | Faster queries |
| Conflict resolution | File-level conflicts (simple) | Row-level conflicts (complex) |

We choose plain files and accept the performance tradeoff, mitigated by the SQLite FTS5 index.

### Why CodeMirror 6 (Web) + Custom TextInput (Mobile)

- CodeMirror 6 is the gold standard for browser-based code editors. It supports Markdown syntax highlighting, extensions, and accessibility out of the box. Used by Obsidian's web clipper and many other Markdown editors.
- On mobile, CodeMirror's touch support is mediocre. A custom React Native TextInput with Markdown regex highlighting provides a better native feel.
- The rendering pipeline (remark/rehype) is shared across both platforms.

### Why FTS5 Instead of a Search Library

- FTS5 is built into SQLite — zero additional dependencies
- Porter stemming handles word variations ("running" matches "run")
- Ranking is built-in (BM25 algorithm)
- Scales to 100K+ documents without issue
- Index rebuild from filesystem is fast (under 5 seconds for 1000 notes)
