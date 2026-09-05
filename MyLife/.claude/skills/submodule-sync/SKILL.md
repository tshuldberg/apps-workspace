---
name: submodule-sync
description: >-
  Detects commit drift in MyLife's 12+ standalone submodules and updates
  parent git pointers. Compares each submodule's HEAD against the recorded
  pointer in the parent repo, reports drift, and updates stale pointers
  with validation. Use when asked to sync submodules, update submodule
  pointers, check for submodule drift, or after making standalone commits.
  Do NOT use for module migration (use migrate-module) or parity checking
  (use parity-check or parity-remediation).
allowed-tools: Read, Glob, Bash(git:*)
---

# Submodule Sync

You keep MyLife's 12+ standalone submodule pointers up to date with their
latest commits.

## Step 1: Inventory Submodules

```bash
git submodule status
```

Parse output. Each line shows: `[+/-/ ]<commit> <path> (<branch>)`
- `+` prefix = pointer is ahead/behind parent record (DRIFTED)
- `-` prefix = submodule not initialized
- ` ` prefix = clean (matches parent pointer)

## Step 2: Detect Drift

For each submodule, compare:
- **Recorded pointer**: what the parent repo expects (from `git submodule status`)
- **Actual HEAD**: `git -C <submodule-path> rev-parse HEAD`
- **Remote HEAD**: `git -C <submodule-path> log --oneline -1 origin/main`

Report for each:
```
<SubmoduleName>: [CLEAN | DRIFTED | BEHIND_REMOTE]
  Recorded: <commit-short>
  Actual:   <commit-short>
  Behind by: N commits
  Latest:   "<most recent commit message>"
```

## Step 3: Update Stale Pointers

For each drifted submodule (with user confirmation):
```bash
git add <submodule-path>
```

This stages the updated pointer. Do NOT commit automatically -- let the user
decide when to commit (per workspace conventions).

## Step 4: Validate

After updating:
```bash
git submodule status
```

Verify all previously-drifted submodules now show clean status.

If any submodule has uncommitted changes inside it, warn the user:
"<SubmoduleName> has uncommitted changes. Commit inside the submodule first."

## Known Submodules

MyBooks, MyBudget, MyCar, MyFast, MyHabits, MyHealth, MyHomes, MyRecipes,
MyRSVP, MySurf, MyVoice, MyWords, MyWorkouts (13 total as of 2026-03-05)

## Example

**User says:** "Sync all submodule pointers"

**Skill does:**
1. Runs `git submodule status`, finds MyBooks (+3 commits), MyFast (+1 commit) drifted
2. Reports: MyBooks behind by 3 commits (latest: "feat: add bookmark sync")
3. Stages updated pointers for both
4. Validates: all submodules clean

**Result:** 2 submodule pointers updated and staged. User can commit when ready.
