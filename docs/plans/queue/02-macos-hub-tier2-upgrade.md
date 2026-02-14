# Plan: macos-hub CLAUDE.md Tier 2 Upgrade

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Metadata
- **Project:** macos-hub
- **Priority:** 2
- **Effort:** medium
- **Dependencies:** none
- **Worktree:** yes
- **Created:** 2026-02-13

## Objective
Upgrade macos-hub from Tier 1 to Tier 2 CLAUDE.md per workspace standards. Add Testing, Code Style, Environment Setup, Important Notes sections, and ensure change tracking is current.

## Scope
- **Files/dirs affected:** `macos-hub/CLAUDE.md`, `macos-hub/AGENTS.md`, `macos-hub/timeline.md`
- **Files NOT to touch:** Source code files, bridge implementations

## Phases

### Phase 1: Research current state
- [ ] Read the existing macos-hub/CLAUDE.md
- [ ] Read macos-hub/package.json for test/lint scripts
- [ ] Check if there are existing tests (search for test files, vitest/jest config)
- [ ] Check for linting config (.eslintrc, tsconfig strict settings)
- [ ] Review the project's git log for recent patterns
- **Acceptance:** Full understanding of current testing, linting, and dev setup documented

### Phase 2: Upgrade CLAUDE.md to Tier 2
- [ ] Add **Testing** section: document test framework (if any), test commands, testing conventions
- [ ] Add **Code Style** section: TypeScript strict mode, ES modules, bridge/tool patterns
- [ ] Add **Environment Setup** section: Node version, npm install, MCP config location, how to test locally
- [ ] Add **Important Notes** section: AppleScript security permissions, MCP stdio transport constraints
- [ ] Verify change tracking section references timeline.md
- **Acceptance:** CLAUDE.md contains all Tier 2 required sections

### Phase 3: Sync AGENTS.md
- [ ] Update macos-hub/AGENTS.md to reflect new CLAUDE.md sections
- [ ] Update root CLAUDE.md project entry if any key commands or architecture changed
- **Acceptance:** AGENTS.md and CLAUDE.md are in sync

## Acceptance Criteria
- [ ] macos-hub/CLAUDE.md has all Tier 2 sections: Overview, Stack, Key Commands, Architecture, Git Workflow, Testing, Code Style, Environment Setup, Important Notes
- [ ] AGENTS.md synced
- [ ] timeline.md updated with this session's work

## Constraints
- Do NOT modify any source code
- Do NOT add tests or linting if they don't already exist — just document what's there
- Follow workspace CLAUDE.md quality tier definitions
