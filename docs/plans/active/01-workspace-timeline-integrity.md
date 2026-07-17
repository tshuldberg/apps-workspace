# Plan: Workspace Timeline Integrity Audit

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Metadata
- **Project:** workspace (cross-project)
- **Priority:** 1
- **Effort:** medium
- **Dependencies:** none
- **Worktree:** no
- **Created:** 2026-02-13

## Objective
Ensure every active project in /Apps has a timeline.md (or PROJECT_LOG.md) that accurately reflects its git history. Fix any stale, missing, or duplicated timelines.

## Scope
- **Files/dirs affected:** `*/timeline.md`, `*/PROJECT_LOG.md` across all projects
- **Files NOT to touch:** `SH/shiphawk-dev/`, any source code files

## Phases

### Phase 1: Audit existing timelines
- [ ] For each project with a CLAUDE.md, check if timeline.md or PROJECT_LOG.md exists
- [ ] For each existing timeline, compare the latest entry date against `git log --oneline -1` date
- [ ] Report findings: which timelines are current, stale (>7 days behind), or missing
- **Acceptance:** Audit table printed showing all projects and their timeline status

### Phase 2: Fix stale and missing timelines
- [ ] Rebuild `Parks/easystreet-monorepo/timeline.md` from its own commit graph (not a copy of native EasyStreet)
- [ ] Create timeline.md for any project that's missing one but has recent commits
- [ ] Backfill entries from git log for the last 30 days of activity per project
- **Acceptance:** Every active project has a timeline with entries matching its recent git history

### Phase 3: Add consistency check
- [ ] Create a lightweight script at `docs/plans/scripts/timeline-check.sh` that compares each project's latest timeline date vs latest commit date
- [ ] Run it and fix any remaining gaps
- **Acceptance:** Script runs clean with no stale timelines reported

## Acceptance Criteria
- [ ] Every project with commits in the last 30 days has a current timeline
- [ ] No duplicate timelines across repos
- [ ] Consistency check script exists and passes

## Constraints
- Do NOT modify source code, only documentation/timeline files
- Do NOT touch SH/shiphawk-dev
- Follow each project's existing timeline format (some use timeline.md, some use PROJECT_LOG.md)
