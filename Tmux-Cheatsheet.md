# tmux Cheatsheet

All commands use the **prefix** `Ctrl+B` first, then the key.

---

## Sessions

| Command | Action |
|---------|--------|
| `tmux` | Start a new session |
| `tmux new -s name` | Start a named session |
| `tmux ls` | List all sessions |
| `tmux attach` | Attach to last session |
| `tmux attach -t name` | Attach to a named session |
| `tmux kill-session -t name` | Kill a named session |
| Prefix then `d` | Detach from current session |
| Prefix then `s` | List and switch sessions |
| Prefix then `$` | Rename current session |

---

## Panes (Splits)

| Shortcut | Action |
|----------|--------|
| Prefix then `%` | Split vertically (side by side) |
| Prefix then `"` | Split horizontally (top/bottom) |
| Prefix then Arrow Keys | Move between panes |
| Prefix then `x` | Close current pane |
| Prefix then `z` | Toggle pane zoom (fullscreen) |
| Prefix then `q` | Show pane numbers (press number to jump) |
| Prefix then `{` | Swap pane left |
| Prefix then `}` | Swap pane right |
| Prefix then `o` | Cycle to next pane |
| Prefix then Space | Cycle through pane layouts |
| Prefix, hold Arrow Key | Resize pane in that direction |
| Prefix then `!` | Convert pane to its own window |

---

## Windows (Tabs)

| Shortcut | Action |
|----------|--------|
| Prefix then `c` | Create new window |
| Prefix then `n` | Next window |
| Prefix then `p` | Previous window |
| Prefix then `0`–`9` | Jump to window by number |
| Prefix then `,` | Rename current window |
| Prefix then `&` | Close current window (with confirmation) |
| Prefix then `w` | List all windows (interactive picker) |
| Prefix then `l` | Toggle to last active window |

---

## Copy Mode (Scrolling & Selection)

| Shortcut | Action |
|----------|--------|
| Prefix then `[` | Enter copy/scroll mode |
| `q` or Esc | Exit copy mode |
| Arrow Keys / PgUp / PgDn | Scroll through output |
| Space | Start selection |
| Enter | Copy selection and exit copy mode |
| Prefix then `]` | Paste copied text |
| `/` | Search forward (in copy mode) |
| `?` | Search backward (in copy mode) |
| `n` / `N` | Next / previous search match |

---

## Misc

| Shortcut | Action |
|----------|--------|
| Prefix then `t` | Show a clock |
| Prefix then `:` | Open tmux command prompt |
| Prefix then `?` | List all key bindings |
| `tmux source ~/.tmux.conf` | Reload config file |

---

## Common Workflows

**Split into 3 panes (one top, two bottom):**
```
Prefix "    → split top/bottom
Prefix %    → split bottom pane left/right
```

**Detach and come back later:**
```
Prefix d         → detach (session keeps running)
tmux attach      → reattach later
```

**Named sessions for projects:**
```
tmux new -s project1
tmux new -s project2
tmux attach -t project1
```
