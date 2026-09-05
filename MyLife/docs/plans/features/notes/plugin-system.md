# Feature Spec: Plugin System

## Metadata
- **Module:** notes
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 0 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 6-8 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Obsidian's plugin ecosystem (1,600+ community plugins) is the feature that keeps its 1.5M MAU locked in. Users extend Obsidian with calendars, task managers, Kanban boards, graph enhancements, citation managers, and hundreds of niche tools. Building a plugin system for MyNotes does not mean replicating Obsidian's full ecosystem -- it means providing an extensibility framework so that power users and developers can add custom markdown renderers, toolbar buttons, and sidebar panels. This positions MyNotes as the "open" alternative to Notion (no plugins) and the "mobile-first" alternative to Obsidian (desktop-first plugin model). Even a minimal plugin API with 5-10 first-party plugins demonstrates the extensibility story.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Obsidian | Yes | Free | 1,600+ community plugins. JavaScript API. Plugins run in-process with full vault access. Community marketplace. |
| Notion | No | N/A | No plugin system. Integrations via API only. No client-side extensibility. |
| Evernote | No | N/A | No plugins. Legacy "Evernote Trunk" (discontinued). |
| Apple Notes | No | N/A | No extensibility. |

### Target User
Power users and developers who want to customize their note-taking experience. Plugin developers who want to build tools for the MyNotes ecosystem. Primary migration target: Obsidian plugin developers and users who rely on specific plugins but want better mobile support.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/plugins/                        -- NEW: plugin runtime and API
modules/notes/src/plugins/types.ts                -- Plugin, PluginManifest, PluginAPI types
modules/notes/src/plugins/runtime.ts              -- Plugin lifecycle (load, enable, disable, unload)
modules/notes/src/plugins/api.ts                  -- Plugin API surface (read/write notes, UI slots)
modules/notes/src/plugins/sandbox.ts              -- Security sandbox for plugin execution
modules/notes/src/plugins/registry.ts             -- Installed plugin registry
modules/notes/src/plugins/index.ts                -- Barrel export
modules/notes/src/plugins/__tests__/              -- Tests
modules/notes/src/db/plugins.ts                   -- NEW: plugin metadata CRUD
apps/mobile/app/(notes)/plugins.tsx               -- Mobile plugin manager screen
apps/web/app/notes/plugins/page.tsx               -- Web plugin manager
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Settings tab
            └── "Plugins" section ← YOU ARE HERE (manage plugins)
       └── Note Editor
            └── Plugin-contributed toolbar buttons, sidebar panels ← PLUGINS ADD HERE
```

### Data Model

Two new tables in migration V2:

```sql
CREATE TABLE IF NOT EXISTS nt_plugins (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '0.1.0',
  description TEXT DEFAULT '',
  author TEXT DEFAULT '',
  is_enabled INTEGER NOT NULL DEFAULT 0,
  is_built_in INTEGER NOT NULL DEFAULT 0,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nt_plugin_settings (
  plugin_id TEXT NOT NULL REFERENCES nt_plugins(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (plugin_id, key)
);

CREATE INDEX IF NOT EXISTS nt_plugins_enabled_idx ON nt_plugins(is_enabled);
```

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD, markdown engine, settings
- **External:** JavaScript sandbox environment (for security). Options: `quickjs-emscripten` (lightweight JS runtime), `SES` (Secure ECMAScript from Agoric), or iframe sandboxing (web only).
- **Cross-Module:** Plugin API could expose cross-module hooks (e.g., create a journal entry from a note plugin). Deferred for V1.

## Functional Requirements

### User Stories
1. As a power user, I want to install plugins that add custom features to MyNotes so that I can tailor the app to my workflow.
2. As a plugin developer, I want a documented API for reading/writing notes, adding toolbar buttons, and rendering custom markdown blocks.
3. As a privacy-conscious user, I want plugins sandboxed so that they cannot access data outside MyNotes or make unauthorized network requests.

### Behavior Specification

1. **Plugin Manager (Settings > Plugins):**
   a. List of installed plugins: name, version, description, enable/disable toggle.
   b. Built-in plugins section (shipped with the app, cannot be uninstalled).
   c. "Install Plugin" button: opens a file picker to load a plugin bundle (`.zip` or `.js`).
   d. Plugin detail view: description, permissions, settings, "Uninstall" button.

2. **Plugin Lifecycle:**
   a. Install: plugin bundle loaded, manifest parsed, stored in `nt_plugins`.
   b. Enable: plugin code loaded into sandbox, `onEnable()` hook called.
   c. Disable: `onDisable()` hook called, plugin UI removed, code unloaded.
   d. Uninstall: plugin disabled, then removed from `nt_plugins` and settings.

3. **Plugin API Surface (V1):**
   a. **Notes API:** `readNote(id)`, `listNotes(filter)`, `createNote(input)`, `updateNote(id, input)`, `searchNotes(query)`.
   b. **UI API:** `addToolbarButton(icon, label, callback)`, `addSidebarPanel(title, renderFn)`, `registerMarkdownRenderer(blockType, renderFn)`.
   c. **Settings API:** `getSetting(key)`, `setSetting(key, value)` -- scoped to plugin's own settings.
   d. **Events API:** `on('noteOpened', callback)`, `on('noteSaved', callback)`, `on('noteDeleted', callback)`.

4. **Security Sandbox:**
   a. Plugins run in a sandboxed JavaScript environment.
   b. No access to: file system, network, other modules, device APIs, or notes outside the Notes module.
   c. Plugins can only interact with notes through the Plugin API.
   d. Plugin permissions declared in manifest and shown to user on install.

5. **Built-in Plugins (5 first-party, shipped with app):**
   a. **Word Count** -- shows word/char/reading time in status bar (wraps existing engine).
   b. **Table of Contents** -- generates TOC sidebar from headings (wraps existing `extractHeadings`).
   c. **Outline** -- collapsible document outline in sidebar.
   d. **Random Note** -- toolbar button that opens a random note.
   e. **Focus Mode** -- hides all UI except the editor for distraction-free writing.

### Edge Cases

- **Malicious plugin:** Sandbox prevents access to file system, network, and other module data. Plugin can only use the declared API surface.
- **Plugin crash:** Caught by sandbox. Plugin disabled with error message. Other plugins unaffected.
- **Plugin conflicts:** Two plugins adding toolbar buttons with same icon. Both shown -- no conflict resolution needed.
- **Plugin data storage:** Plugins use `nt_plugin_settings` (key-value) for their own data. No direct SQLite access.
- **Plugin update:** New version installed over existing. Settings preserved. `onUpdate()` hook called.
- **No plugins enabled:** App works identically to pre-plugin state.
- **Plugin on mobile vs web:** Same API, but UI rendering may differ. Plugins should use the provided render functions, not direct DOM/React Native access.
- **Large plugin bundle:** Reject bundles over 5MB.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Plugin manager lists installed plugins with enable/disable toggles.
- [ ] **AC-2:** 5 built-in plugins available on first use.
- [ ] **AC-3:** "Install Plugin" loads a plugin from file picker.
- [ ] **AC-4:** Enabled plugins add toolbar buttons, sidebar panels, or custom renderers.
- [ ] **AC-5:** Disabling a plugin removes its UI contributions.
- [ ] **AC-6:** Plugin settings accessible from plugin detail view.
- [ ] **AC-7:** Uninstalling a plugin removes it and its settings.
- [ ] **AC-8:** Plugin permissions shown on install.

### Technical Criteria
- [ ] **TC-1:** Migration V2 creates nt_plugins and nt_plugin_settings tables.
- [ ] **TC-2:** Plugins execute in a sandboxed JavaScript environment.
- [ ] **TC-3:** Plugin API surface limited to declared functions (no raw DB access).
- [ ] **TC-4:** Plugin crash does not crash the host app.
- [ ] **TC-5:** Built-in plugins installed as is_built_in = 1 (cannot be uninstalled).
- [ ] **TC-6:** Plugin manifest declares required permissions.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Plugins must NEVER access the file system directly.
- [ ] **NC-2:** Plugins must NEVER make network requests.
- [ ] **NC-3:** Plugins must NEVER access data from other MyLife modules.
- [ ] **NC-4:** A crashing plugin must NEVER take down the host app or other plugins.
- [ ] **NC-5:** Plugin code must NEVER execute when the plugin is disabled.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Plugin list: glass cards per plugin, name (16px semibold), version (12px textSecondary), description (13px), enable/disable toggle
- Built-in badge: "Built-in" tag in `#64748B` on built-in plugins
- Plugin detail: full-screen card, description, author, version, permissions list, settings, uninstall button
- Install button: "Install Plugin" button at bottom of plugin list
- Module accent: `#64748B`

### Web (Next.js)

- Route: `/notes/plugins`
- Grid layout (2 columns) for plugin cards
- Same plugin detail view
- Drag-and-drop plugin installation

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Plugins | Only built-in plugins listed | Fresh install |
| Enabled | Plugin active, its UI contributions visible in editor | Plugin enabled |
| Disabled | Plugin listed but inactive, no UI contributions | Plugin disabled |
| Installing | Progress indicator while plugin bundle processes | User installing plugin |
| Error | "Plugin failed to load" with error details | Plugin crash or invalid bundle |
| Settings | Plugin-specific configuration form | User opens plugin settings |

## Test Requirements

### Unit Tests
- [ ] `loadPlugin`: valid manifest -> plugin loaded and registered
- [ ] `loadPlugin`: invalid manifest -> rejected with error
- [ ] `enablePlugin`: calls onEnable hook, registers UI slots
- [ ] `disablePlugin`: calls onDisable hook, removes UI slots
- [ ] `uninstallPlugin`: removes from registry and settings
- [ ] `pluginAPI.readNote`: returns note data through sandbox
- [ ] `pluginAPI.readNote`: invalid ID -> returns null (no crash)
- [ ] `pluginAPI.addToolbarButton`: registers button in toolbar slot
- [ ] `sandbox.execute`: malicious code -> caught, plugin disabled
- [ ] `sandbox.execute`: network access attempt -> blocked

### Integration Tests
- [ ] Full flow: install plugin -> enable -> toolbar button appears -> tap button -> action executes -> disable -> button removed
- [ ] Built-in flow: enable "Word Count" plugin -> open note -> word count visible in status bar

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Settings > Plugins
3. Verify: 5 built-in plugins listed (Word Count, TOC, Outline, Random Note, Focus Mode) -- corresponds to AC-1, AC-2
4. Enable "Word Count" plugin
5. Open a note
6. Verify: word count visible in status bar -- corresponds to AC-4
7. Disable "Word Count" plugin
8. Verify: word count no longer visible -- corresponds to AC-5
9. Navigate back to Plugins
10. Tap a plugin to view details
11. Verify: settings and permissions visible -- corresponds to AC-6, AC-8
12. Tap "Install Plugin" and select a test plugin bundle
13. Verify: plugin installed and listed -- corresponds to AC-3
14. Enable the test plugin, verify its features work
15. Tap "Uninstall"
16. Verify: plugin removed -- corresponds to AC-7
17. Open the app on web
18. Navigate to Notes > Plugins
19. Verify: same plugin management functionality

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to plugin manager, enable/disable plugins, verify UI contributions

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyNotes has no extensibility mechanism. All features are built-in. No way for users or developers to add custom functionality.

### After This Work
A plugin system with lifecycle management, sandboxed execution, and a defined API surface. 5 built-in plugins demonstrate the system. Custom plugins can be installed from file bundles. Plugin settings persisted per-plugin.

### Files Changed
- `modules/notes/src/db/schema.ts` -- CREATE tables for nt_plugins and nt_plugin_settings
- `modules/notes/src/definition.ts` -- add plugin tables to NOTES_MIGRATION_V2
- `modules/notes/src/plugins/types.ts` -- Plugin, PluginManifest, PluginAPI types
- `modules/notes/src/plugins/runtime.ts` -- loadPlugin, enablePlugin, disablePlugin, uninstallPlugin
- `modules/notes/src/plugins/api.ts` -- PluginAPI implementation (notes, UI, settings, events)
- `modules/notes/src/plugins/sandbox.ts` -- sandboxed JS execution
- `modules/notes/src/plugins/registry.ts` -- installed plugin state management
- `modules/notes/src/plugins/index.ts` -- barrel export
- `modules/notes/src/plugins/__tests__/runtime.test.ts` -- 10+ unit tests
- `modules/notes/src/db/plugins.ts` -- plugin CRUD
- `modules/notes/src/types.ts` -- add Plugin, PluginManifest Zod schemas
- `modules/notes/src/index.ts` -- re-export plugins module
- `apps/mobile/app/(notes)/plugins.tsx` -- plugin manager screen
- `apps/web/app/notes/plugins/page.tsx` -- web plugin manager

### Known Limitations
- No community plugin marketplace (plugins must be installed from local files).
- No plugin auto-update mechanism.
- No inter-plugin communication.
- Sandbox may limit some advanced use cases (no DOM access on mobile, no native module access).
- Plugin UI rendering is limited to the provided UI API slots (toolbar, sidebar, markdown renderers).
- No TypeScript support for plugin development (plain JavaScript only in V1).

### Context for Next Agent
- The sandbox is the most critical component. For mobile, consider `quickjs-emscripten` -- it provides a lightweight, sandboxed JavaScript runtime that works in React Native. For web, `iframe` sandboxing with `postMessage` communication is the standard approach.
- Plugin manifests should be JSON files declaring: `id`, `name`, `version`, `description`, `author`, `permissions` (array of: `notes:read`, `notes:write`, `ui:toolbar`, `ui:sidebar`, `settings:read`, `settings:write`).
- The Plugin API is a bridge object injected into the sandbox. It proxies calls to the real notes CRUD through a permission check.
- Built-in plugins should be JavaScript strings embedded in the app bundle, not separate files.
- V2 migration coordination: shares V2 with other features. Combine all into one V2 migration.
- Complexity is 0 (most complex tier). The sandbox implementation is the hardest part. Consider `/plan-eng-review` and `/office-hours` before building.
