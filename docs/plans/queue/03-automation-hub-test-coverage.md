# Plan: automation-hub Test Coverage Expansion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Metadata
- **Project:** automation-hub
- **Priority:** 3
- **Effort:** high
- **Dependencies:** none
- **Worktree:** yes
- **Created:** 2026-02-13

## Objective
Expand test coverage for automation-hub's adapter layer, job runners, and approval gate. The project has a vitest config and tests/ directory but coverage is incomplete.

## Scope
- **Files/dirs affected:** `automation-hub/tests/`, `automation-hub/vitest.config.ts`
- **Files NOT to touch:** Source code in `automation-hub/src/` (tests only, no implementation changes)

## Phases

### Phase 1: Audit existing coverage
- [ ] Run `npm test` to see current test results
- [ ] List all source files in src/ and check which have corresponding test files
- [ ] Identify untested adapters, jobs, and utilities
- [ ] Report coverage gaps
- **Acceptance:** Coverage gap report listing every untested module

### Phase 2: Test adapters
- [ ] Write tests for each adapter in `src/adapters/` that lacks tests
- [ ] Use the mock adapter as reference for test patterns
- [ ] Test the adapter factory and router
- **Acceptance:** All adapters have at least basic instantiation and method tests

### Phase 3: Test job runners
- [ ] Write tests for email-triage job
- [ ] Write tests for due-date-planner job
- [ ] Write tests for gantt-drift job
- [ ] Write tests for channel-consolidation job
- [ ] Use YAML job specs as test fixtures
- **Acceptance:** All 4 job runners have tests covering happy path

### Phase 4: Test approval gate
- [ ] Write tests for the approval gate logic
- [ ] Test the send-policy module
- [ ] Test edge cases: auto-approve, manual-approve, deny scenarios
- **Acceptance:** Approval gate fully tested

### Phase 5: Verify
- [ ] Run full test suite: `npm test`
- [ ] Verify no tests are skipped or failing
- **Acceptance:** All tests pass, zero skipped

## Acceptance Criteria
- [ ] `npm test` passes with all new tests
- [ ] Every adapter, job runner, and approval gate has at least one test file
- [ ] No source code was modified (tests only)
- [ ] automation-hub/timeline.md updated

## Constraints
- Do NOT modify source code — only add test files
- Follow existing test patterns from the tests/ directory
- Use vitest conventions (describe/it/expect)
