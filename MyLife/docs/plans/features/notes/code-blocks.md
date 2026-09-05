# Feature Spec: Code Blocks

## Metadata
- **Module:** notes
- **Priority Score:** 35 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented, body stores markdown)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Code blocks with syntax highlighting are essential for technical users -- developers, data scientists, students in CS courses. Notion and Obsidian both support fenced code blocks with language-specific syntax highlighting and a copy button. MyNotes stores markdown that includes fenced code blocks (` ```language ... ``` `), and the existing markdown engine can parse them, but the preview does not apply syntax highlighting. Adding proper code block rendering with syntax highlighting, a copy button, and language labels makes MyNotes viable for technical note-taking. This is table stakes for the developer/technical writer persona.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notion | Yes | Free tier | Syntax highlighting for 50+ languages, copy button, wrap toggle, language selector. |
| Obsidian | Yes | Free | Prism.js syntax highlighting, live preview, line numbers, copy button. Plugin ecosystem extends with execution. |
| Evernote | Partial | Free tier | Basic code formatting (monospace block), no syntax highlighting. |
| Apple Notes | No | N/A | No code blocks. Monospace font only via formatting menu. |

### Target User
Developers, data scientists, CS students, technical writers, and DevOps engineers who keep code snippets, configuration files, API responses, and terminal commands in their notes. Primary migration target: Notion free-tier developers and Obsidian users who keep code documentation.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/engine/code-highlight.ts        -- NEW: syntax highlighting engine
modules/notes/src/engine/__tests__/code-highlight.test.ts -- Tests
apps/mobile/app/(notes)/components/CodeBlock.tsx   -- Mobile code block component
apps/web/app/notes/components/CodeBlock.tsx        -- Web code block component
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab -> Note Editor
            └── Markdown preview
                 └── Fenced code blocks ← YOU ARE HERE (syntax highlighted)
```

### Data Model

No new tables or columns needed. Code blocks are standard markdown stored in the `body` column:

````markdown
```javascript
const hello = "world";
console.log(hello);
```
````

The rendering layer handles syntax highlighting at display time.

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD, markdown engine
- **External:** A lightweight syntax highlighting library. Options: `highlight.js` (1MB, 190+ languages), `shiki` (tree-shakeable, VS Code themes), or `prism-react-renderer` (React-native friendly, ~50 languages). Recommend `prism-react-renderer` for mobile compatibility.
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a developer, I want code blocks in my notes to have syntax highlighting so that code is readable with proper color coding.
2. As a user sharing code snippets, I want a "Copy" button on code blocks so that I can copy code without selecting text manually.
3. As a technical writer, I want to specify the programming language for a code block so that the correct syntax highlighting is applied.

### Behavior Specification

1. User writes a fenced code block in the editor:
   ````
   ```python
   def hello():
       print("Hello, World!")
   ```
   ````
2. In preview mode (or the preview pane), the code block renders with:
   a. Language label in the top-right corner (e.g., "python").
   b. Syntax highlighting with the Cool Obsidian color scheme.
   c. "Copy" button in the top-right corner (next to language label).
   d. Monospace font (SF Mono on iOS, JetBrains Mono on Android/web, fallback to system monospace).
   e. Dark background (`#1A1A24`, surfaceElevated token) with subtle border.
   f. Optional line numbers (toggle in settings, default off).
3. User taps "Copy": entire code block content copied to clipboard. Brief toast "Copied!" shown.
4. Code blocks without a language tag render as plain monospace text (no highlighting).
5. Inline code (single backtick `code`) renders with monospace font and subtle background.
6. Formatting toolbar includes a "Code Block" button that inserts a fenced code block template.
7. Supported languages (initial set, ~30): javascript, typescript, python, ruby, go, rust, java, c, cpp, csharp, swift, kotlin, php, html, css, sql, bash, shell, json, yaml, toml, xml, markdown, diff, graphql, dockerfile, makefile, regex, plaintext, lua.

### Edge Cases

- **Unknown language tag:** Render as plain monospace (no highlighting). Language label still shown.
- **Empty code block:** Render empty block with language label (if present) and copy button (copies empty string).
- **Very long code block (1000+ lines):** Virtualize rendering. Show "Show all" toggle if over 50 lines (collapsed by default in preview, expanded in editor).
- **Nested code blocks:** Markdown spec handles this -- inner blocks are treated as content of the outer block.
- **Code block inside checklist or blockquote:** Renders correctly within the parent block element.
- **No language specified:** Render as monospace plaintext. No syntax highlighting. Language label shows "text".
- **Copy button feedback:** Brief highlight animation on the copy button, then "Copied!" text replaces the icon for 1.5 seconds.
- **Mobile code overflow:** Horizontal scroll within the code block (no word wrap for code).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Fenced code blocks render with syntax highlighting in preview mode.
- [ ] **AC-2:** Language label shown in the top-right of the code block.
- [ ] **AC-3:** "Copy" button copies the entire code block content to clipboard.
- [ ] **AC-4:** At least 30 programming languages supported for syntax highlighting.
- [ ] **AC-5:** Inline code (single backtick) renders with monospace font and subtle background.
- [ ] **AC-6:** Formatting toolbar includes a "Code Block" button.
- [ ] **AC-7:** Line numbers can be toggled in settings.
- [ ] **AC-8:** Code blocks without a language tag render as plain monospace.
- [ ] **AC-9:** Long code blocks (50+ lines) collapse with a "Show all" toggle.
- [ ] **AC-10:** Code blocks have horizontal scroll for long lines (no word wrap).

### Technical Criteria
- [ ] **TC-1:** Syntax highlighting library tree-shaken to include only supported languages.
- [ ] **TC-2:** Highlighting rendered client-side with no network dependency.
- [ ] **TC-3:** Code block rendering performs within 100ms for blocks under 200 lines.
- [ ] **TC-4:** Copy button uses platform clipboard API (`expo-clipboard` mobile, `navigator.clipboard` web).
- [ ] **TC-5:** Color theme matches Cool Obsidian tokens (dark background, muted syntax colors).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Code block rendering must NOT make network requests (all highlighting is local).
- [ ] **NC-2:** Copy must NOT include the language label or line numbers -- only the raw code content.
- [ ] **NC-3:** Syntax highlighting must NOT modify the stored markdown -- it is a render-time transformation only.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Code block container: `#1A1A24` (surfaceElevated) background, `rgba(255,255,255,0.06)` border, 8px border-radius, 16px padding
- Language label: 11px, `rgba(240,240,245,0.45)` (textSecondary), top-right, uppercase
- Copy button: clipboard icon, 16px, `rgba(240,240,245,0.45)`, top-right (next to language label)
- Font: SF Mono (iOS), JetBrains Mono (Android), 13px, line-height 1.5
- Syntax colors (Cool Obsidian theme): keywords `#C792EA`, strings `#C3E88D`, comments `#546E7A`, numbers `#F78C6C`, functions `#82AAFF`, types `#FFCB6B`, operators `#89DDFF`
- Inline code: `#1A1A24` background, `rgba(255,255,255,0.06)` border, 4px border-radius, 2px horizontal padding
- Horizontal scroll: code block scrolls horizontally, thin scrollbar
- Module accent: `#64748B`

### Web (Next.js)

- Same styling via CSS variables
- Hover effect on copy button
- Line numbers as left gutter (when enabled)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Highlighted | Syntax-colored code with language label and copy button | Fenced code block with known language |
| Plain | Monospace text, no colors, "text" label | Fenced code block without language or unknown language |
| Inline | Monospace text with subtle background | Single-backtick inline code |
| Collapsed | First 50 lines + "Show all (N lines)" button | Code block with 50+ lines |
| Copied | Copy button shows "Copied!" briefly | User taps copy button |
| Line Numbers | Numbers in left gutter | Line numbers enabled in settings |

## Test Requirements

### Unit Tests
- [ ] `highlightCode`: JavaScript code -> tokenized with correct token types
- [ ] `highlightCode`: unknown language -> returns plain text tokens
- [ ] `highlightCode`: empty string -> returns empty tokens
- [ ] `getSupportedLanguages`: returns array of 30+ language identifiers
- [ ] `isLanguageSupported`: "python" -> true, "brainfuck" -> false
- [ ] `normalizeLanguage`: "js" -> "javascript", "py" -> "python", "ts" -> "typescript"
- [ ] `extractCodeContent`: removes language label and metadata, returns raw code only
- [ ] `shouldCollapse`: 49 lines -> false, 50 lines -> true

### Integration Tests
- [ ] Full flow: write fenced code block with `python` tag -> preview shows syntax-highlighted code -> copy button copies raw code
- [ ] Inline flow: write `inline code` -> renders with monospace and background

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Notes tab
3. Create a new note
4. Type a fenced code block with ` ```javascript ` and some JS code
5. Switch to preview mode
6. Verify: code block has syntax highlighting with colored keywords -- corresponds to AC-1
7. Verify: "javascript" language label in top-right -- corresponds to AC-2
8. Tap the copy button
9. Verify: code copied to clipboard, "Copied!" feedback -- corresponds to AC-3
10. Create a code block without a language tag
11. Verify: renders as plain monospace -- corresponds to AC-8
12. Write inline code with single backticks
13. Verify: monospace font with subtle background -- corresponds to AC-5
14. Tap the code block toolbar button
15. Verify: fenced code block template inserted -- corresponds to AC-6
16. Create a code block with 60+ lines
17. Verify: collapses with "Show all" button -- corresponds to AC-9
18. Navigate to Settings, toggle line numbers
19. Verify: line numbers appear/disappear -- corresponds to AC-7
20. Open the app on web
21. Verify: same syntax highlighting with hover effects

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to note editor, create code block, verify highlighting and copy

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Fenced code blocks are stored in markdown and parsed by the engine, but the preview renders them as plain monospace text without syntax highlighting, language labels, or copy buttons. No code-specific UI exists.

### After This Work
Code blocks render with syntax highlighting for 30+ languages using a Cool Obsidian color theme. Language labels, copy buttons, optional line numbers, and collapsible long blocks. Inline code styled with monospace and subtle background. Formatting toolbar has a code block button.

### Files Changed
- `modules/notes/src/engine/code-highlight.ts` -- highlightCode, getSupportedLanguages, normalizeLanguage, isLanguageSupported
- `modules/notes/src/engine/__tests__/code-highlight.test.ts` -- 8+ unit tests
- `modules/notes/src/index.ts` -- re-export code-highlight functions
- `apps/mobile/app/(notes)/components/CodeBlock.tsx` -- syntax-highlighted code block component
- `apps/web/app/notes/components/CodeBlock.tsx` -- web code block component
- `packages/ui/src/tokens/code-theme.ts` -- Cool Obsidian syntax color palette

### Known Limitations
- No code execution (run code in note). This would require a sandboxed runtime.
- No code formatting (auto-indent, prettier). Users format manually.
- No code completion or IntelliSense. This is a note-taking app, not an IDE.
- Limited to ~30 languages initially. More can be added by extending the grammar list.
- No code block title/filename header (e.g., `index.js`). Language label only.

### Context for Next Agent
- Recommend `prism-react-renderer` for React Native compatibility. It works on both mobile (Expo) and web (Next.js).
- The syntax color theme should be defined as a separate token file in `packages/ui/src/tokens/code-theme.ts` so it can be shared across mobile and web.
- Language normalization: map common aliases (`js` -> `javascript`, `py` -> `python`, `ts` -> `typescript`, `rb` -> `ruby`, `sh` -> `bash`, `yml` -> `yaml`).
- The "Copy" button should extract raw code content only, stripping the language tag and any metadata.
- For collapsible blocks, use a simple height animation. The "Show all" button replaces the collapsed view with the full block.
- No new tables or migrations needed. This is purely a rendering feature.
