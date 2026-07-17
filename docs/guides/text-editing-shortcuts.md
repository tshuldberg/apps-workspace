# Text Editing Shortcuts: macOS + Claude Code

> Fast text editing in the terminal and Claude Code's input box.
> Covers navigation, selection, deletion, cut/copy/paste, and Claude Code-specific commands.

**Modifier Key Symbols:** `Cmd (⌘)` | `Option/Alt (⌥)` | `Shift (⇧)` | `Control (⌃)` | `Fn`

---

## Quick Reference: The Essentials

The shortcuts you'll use 90% of the time:

| Goal | Shortcut | Where It Works |
|------|----------|----------------|
| Delete whole word left | `⌥Delete` | Everywhere |
| Delete to start of line | `⌘Delete` | macOS text fields |
| Delete to end of line | `⌃K` | Terminal / Claude Code |
| Delete entire line | `⌃U` | Terminal / Claude Code |
| Jump to start of line | `⌘←` or `⌃A` | Everywhere / Terminal |
| Jump to end of line | `⌘→` or `⌃E` | Everywhere / Terminal |
| Jump one word left | `⌥←` or `⌥B`* | Everywhere / Terminal |
| Jump one word right | `⌥→` or `⌥F`* | Everywhere / Terminal |
| Select word left | `⇧⌥←` | Everywhere |
| Select word right | `⇧⌥→` | Everywhere |
| Select to start of line | `⇧⌘←` or `⇧⌃A` | Everywhere |
| Select to end of line | `⇧⌘→` or `⇧⌃E` | Everywhere |
| Paste killed text | `⌃Y` | Terminal / Claude Code |

*\*`⌥B`/`⌥F` require "Option as Meta" enabled in your terminal (see setup below).*

---

## Setup: Enable Option-Key Shortcuts in Terminal

By default, macOS terminals treat Option as a character modifier (typing special characters like `∫`, `ƒ`). To use `⌥B`, `⌥F`, `⌥P`, `⌥T` and other Alt-key shortcuts, you need to change this:

**iTerm2:** Settings → Profiles → Keys → Set Left Option key to **"Esc+"**

**Terminal.app:** Settings → Profiles → Keyboard → Check **"Use Option as Meta Key"**

**VS Code Terminal:** Settings → search `terminal.integrated.macOptionIsMeta` → set to **true**

**Ghostty / WezTerm / Kitty:** Usually works out of the box.

---

## 1. Cursor Navigation

### Character-Level

| Shortcut | Action |
|----------|--------|
| `←` / `→` | Move one character left / right |
| `⌃B` / `⌃F` | Move one character back / forward (emacs) |

### Word-Level

| Shortcut | Action |
|----------|--------|
| `⌥←` | Jump to start of previous word |
| `⌥→` | Jump to end of next word |
| `⌥B` | Jump back one word (emacs, needs Meta) |
| `⌥F` | Jump forward one word (emacs, needs Meta) |

### Line-Level

| Shortcut | Action |
|----------|--------|
| `⌘←` or `⌃A` | Jump to start of line |
| `⌘→` or `⌃E` | Jump to end of line |
| `↑` / `↓` | Move up / down one line (multiline input) |
| `⌃P` / `⌃N` | Move up / down one line (emacs) |

### Document-Level (macOS text fields)

| Shortcut | Action |
|----------|--------|
| `⌘↑` | Jump to start of document/input |
| `⌘↓` | Jump to end of document/input |

---

## 2. Text Selection

Add `⇧` (Shift) to any navigation shortcut to select text as you move:

### Character Selection

| Shortcut | Action |
|----------|--------|
| `⇧←` / `⇧→` | Select one character left / right |

### Word Selection

| Shortcut | Action |
|----------|--------|
| `⇧⌥←` | Select from cursor to start of previous word |
| `⇧⌥→` | Select from cursor to end of next word |
| Double-click | Select entire word |

### Line Selection

| Shortcut | Action |
|----------|--------|
| `⇧⌘←` | Select from cursor to start of line |
| `⇧⌘→` | Select from cursor to end of line |
| `⇧↑` / `⇧↓` | Extend selection one line up / down |

### Entire Input

| Shortcut | Action |
|----------|--------|
| `⌘A` | Select all text |
| `⇧⌘↑` | Select from cursor to start of input |
| `⇧⌘↓` | Select from cursor to end of input |

---

## 3. Deletion

### Character Deletion

| Shortcut | Action |
|----------|--------|
| `Delete` (Backspace) | Delete character left of cursor |
| `FnDelete` | Delete character right of cursor (forward delete) |
| `⌃D` | Delete character right of cursor (emacs) |
| `⌃H` | Delete character left of cursor (emacs) |

### Word Deletion

| Shortcut | Action |
|----------|--------|
| `⌥Delete` | Delete entire word left of cursor |
| `⌥FnDelete` | Delete entire word right of cursor |

### Line Deletion

| Shortcut | Action |
|----------|--------|
| `⌘Delete` | Delete from cursor to start of line (macOS text fields) |
| `⌃K` | Kill (cut) from cursor to end of line (terminal) |
| `⌃U` | Kill (cut) entire line (terminal) |

> **Kill ring:** Text deleted with `⌃K` or `⌃U` is stored in the kill ring. Paste it back with `⌃Y`. After pasting, press `⌥Y` to cycle through previously killed text.

---

## 4. Cut, Copy, Paste

### Standard (macOS)

| Shortcut | Action |
|----------|--------|
| `⌘X` | Cut selected text |
| `⌘C` | Copy selected text |
| `⌘V` | Paste from clipboard |
| `⌘Z` | Undo |
| `⇧⌘Z` | Redo |

### Terminal Kill Ring (readline/emacs)

| Shortcut | Action |
|----------|--------|
| `⌃K` | Kill (cut) to end of line → stored in kill ring |
| `⌃U` | Kill (cut) entire line → stored in kill ring |
| `⌃Y` | Yank (paste) from kill ring |
| `⌥Y` | Cycle through kill ring history (after `⌃Y`) |

### Transposition

| Shortcut | Action |
|----------|--------|
| `⌃T` | Swap the two characters around cursor |

---

## 5. Claude Code-Specific Shortcuts

### Core Controls

| Shortcut | Action |
|----------|--------|
| `Enter` | Submit message |
| `Escape` | Cancel current input |
| `⌃C` | Cancel generation / interrupt (hardcoded) |
| `⌃D` | Exit Claude Code session (hardcoded) |
| `⌃L` | Clear terminal screen |

### Multiline Input

| Shortcut | Action |
|----------|--------|
| `\` then `Enter` | New line (works in all terminals) |
| `⌥Enter` | New line (macOS default) |
| `⇧Enter` | New line (iTerm2, WezTerm, Ghostty, Kitty) |
| `⌃J` | New line (line feed character) |

### Navigation & Modes

| Shortcut | Action |
|----------|--------|
| `⌥P` | Switch model |
| `⌥T` | Toggle extended thinking |
| `⇧Tab` | Cycle permission mode (auto-accept / plan / normal) |
| `⌃R` | Reverse search through input history |
| `↑` / `↓` | Browse input history (when input is empty) |
| `⌃G` | Open input in external text editor |
| `⌃B` | Background running task (press twice if using tmux) |
| `⌃T` | Toggle task list |
| `⌃S` | Stash current prompt |
| `Esc` `Esc` | Rewind / summarize conversation |

### Quick Prefixes

| Prefix | Action | Example |
|--------|--------|---------|
| `!` | Run bash command | `! git status` |
| `/` | Run slash command | `/clear`, `/model`, `/vim` |
| `@` | File mention (autocomplete) | `@src/index.ts` |

### History Search Mode (`⌃R`)

| Shortcut | Action |
|----------|--------|
| `⌃R` | Next older match |
| `Tab` or `Esc` | Accept match, keep editing |
| `Enter` | Accept and execute |
| `⌃C` | Cancel search |

---

## 6. Vim Mode (Optional)

Enable with `/vim`. Adds modal editing on top of the standard shortcuts.

### Mode Switching

| Key | Action |
|-----|--------|
| `Esc` | Enter NORMAL mode |
| `i` / `I` | Insert before cursor / at line start |
| `a` / `A` | Insert after cursor / at line end |
| `o` / `O` | Open line below / above |

### Navigation (NORMAL mode)

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Left, down, up, right |
| `w` / `b` / `e` | Next word / previous word / end of word |
| `0` / `$` | Start / end of line |
| `^` | First non-blank character |
| `gg` / `G` | Start / end of input |
| `f{char}` / `F{char}` | Jump to next / previous character |
| `;` / `,` | Repeat / reverse last `f`/`F`/`t`/`T` |

### Editing (NORMAL mode)

| Key | Action |
|-----|--------|
| `x` | Delete character |
| `dd` / `D` | Delete line / delete to end of line |
| `dw` / `db` | Delete word forward / backward |
| `cc` / `C` | Change line / change to end of line |
| `cw` / `cb` | Change word forward / backward |
| `yy` / `yw` | Yank line / yank word |
| `p` / `P` | Paste after / before cursor |
| `.` | Repeat last change |

### Text Objects (with `d`, `c`, `y`)

| Key | Action |
|-----|--------|
| `iw` / `aw` | Inner / around word |
| `i"` / `a"` | Inner / around double quotes |
| `i(` / `a(` | Inner / around parentheses |
| `i{` / `a{` | Inner / around braces |

---

## 7. Common Workflows

### "I typed a long prompt and want to start over"
- `⌃U` — kills the entire line (and saves it to the kill ring)
- `⌘A` then `Delete` — select all, then delete

### "I want to fix a word in the middle of my prompt"
- `⌥←` / `⌥→` — jump word by word to the target
- `⇧⌥←` — select the word
- Type replacement text

### "I want to delete everything after my cursor"
- `⌃K` — kills to end of line

### "I want to move a sentence from one place to another"
- Select text with `⇧` + navigation shortcuts
- `⌘X` — cut
- Navigate to destination
- `⌘V` — paste

### "I pasted something and want to undo it"
- `⌘Z` — undo

### "I want to write a multi-line prompt"
- `⇧Enter` (iTerm2) or `⌥Enter` (macOS) or `\` + `Enter` (universal)

### "I want to reuse a prompt from earlier"
- `↑` — browse history, or
- `⌃R` — search history by keyword

---

## 8. Customizing Claude Code Keybindings

Edit `~/.claude/keybindings.json` or run `/keybindings` in Claude Code:

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+e": "chat:externalEditor",
        "ctrl+u": null
      }
    }
  ]
}
```

Set a binding to `null` to disable it. Changes are hot-reloaded (no restart needed).

**Reserved (cannot rebind):** `⌃C` (interrupt), `⌃D` (exit)

---

## Terminal Multiplexer Conflicts

| Shortcut | Conflict | Workaround |
|----------|----------|------------|
| `⌃B` | tmux prefix key | Press `⌃B` twice to send to Claude Code |
| `⌃A` | GNU screen prefix key | Use `⌘←` for start-of-line instead |
| `⌃S` | Terminal flow control (XOFF) | Run `stty -ixon` to disable, or use a different binding |

---

*See also: [Mac Keyboard Shortcuts](../../Mac-Keyboard-Shortcuts.md) | [Window Tiling Shortcuts](../../Mac-Window-Tiling-Shortcuts.md)*
