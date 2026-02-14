# Plan: system-monitor Report File Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Metadata
- **Project:** system-monitor
- **Priority:** 5
- **Effort:** low
- **Dependencies:** none
- **Worktree:** no
- **Created:** 2026-02-13

## Objective
Clean up system-monitor report files: consolidate duplicate reports, ensure report naming follows workspace conventions (REPORT-system-monitor-YYYY-MM-DD.md), and verify the daemon's report output path is consistent.

## Scope
- **Files/dirs affected:** `docs/reports/REPORT-system-monitor-*.md`, `system-monitor/config/monitor.json`
- **Files NOT to touch:** system-monitor source code, logs/

## Phases

### Phase 1: Audit existing reports
- [ ] List all system-monitor report files in docs/reports/
- [ ] Check for duplicate or near-duplicate reports (e.g., same date, different suffix)
- [ ] Verify naming convention compliance: `REPORT-system-monitor-YYYY-MM-DD.md`
- [ ] Check system-monitor/config/monitor.json for the configured report output path
- **Acceptance:** Audit listing showing all reports, duplicates flagged, naming issues noted

### Phase 2: Consolidate and rename
- [ ] Merge duplicate reports for the same date (keep the most complete version)
- [ ] Rename any non-compliant report files to follow the convention
- [ ] Verify the monitor config points to the correct report directory
- **Acceptance:** All reports follow naming convention, no duplicates

### Phase 3: Verify
- [ ] List final report files and confirm clean state
- [ ] Update system-monitor/timeline.md
- **Acceptance:** Clean, consistent report directory

## Acceptance Criteria
- [ ] All report files follow `REPORT-system-monitor-YYYY-MM-DD.md` naming
- [ ] No duplicate reports for the same date
- [ ] Monitor config report path is correct
- [ ] timeline.md updated

## Constraints
- Do NOT delete any report content — only merge duplicates and rename
- Do NOT modify system-monitor source code
- Follow workspace naming conventions from root CLAUDE.md
