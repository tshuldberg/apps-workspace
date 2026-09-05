# Connection Method Wizard Plan + Test Strategy

Date: 2026-02-25
Status: Implemented in web/mobile self-host setup screens.

## Product Plan

### 1. Method Selection Layer
Users choose one of three internet reachability approaches:
1. Port Forwarding + Domain + TLS
2. Dynamic DNS + Port Forwarding
3. Outbound Tunnel

Each option includes:
- best-for guidance
- pros list
- cons list
- short architecture overview

### 2. Guided Step Navigator
After method selection, users get a step-by-step checklist with:
- step counter (`Step X of N`)
- previous/next navigation buttons
- one-click "Use Suggested URL" autofill for common endpoint pattern

### 3. Save + Verify Layer
Users then:
- save `self_host` mode and server URL
- run connection tests (URL, TLS, health, sync)
- view pass/fail results per check

## Data Flow Plan
1. Method selection persistence
- web: preference saved via server action (`self_host.connection_method`)
- mobile: preference saved directly in local SQLite preference table

2. Save mode flow
- writes `hub_mode` with `self_host` + URL
- increments aggregate event `mode_selected:self_host`

3. Connection test flow
- calls self-host test helper
- records `setup_completed:self_host` only when all checks pass

## Test Plan

### Web unit tests
File: `apps/web/app/__tests__/self-host-page.test.tsx`

Coverage:
1. Save button flow persists mode and URL.
2. Method card selection persists chosen method.
3. Pros/cons are rendered for method comparison.
4. Step navigation buttons move through guided checklist.
5. Suggested URL button autofills server URL input.
6. Connection test renders check results and statuses.
7. Successful test records setup-completed aggregate event.
8. Method card visual size guard (`min-height`) to avoid collapsed UI.

### Mobile unit tests
File: `apps/mobile/app/(hub)/__tests__/self-host.test.tsx`

Coverage:
1. Save button flow persists mode and URL.
2. Method selection writes preference key.
3. Pros/cons labels render in wizard.
4. Step navigation buttons move between checklist steps.
5. Suggested URL button fills input.
6. Connection test path runs and pass state renders.
7. Successful test records setup-completed aggregate event.
8. Back button navigation returns to settings.

## Acceptance Criteria
1. Users can compare methods by pros/cons in UI.
2. Users can navigate method walkthrough without leaving setup page.
3. Save and connection test continue to work after wizard integration.
4. Test suite verifies button behavior, navigation, sizing guardrails, and data flow outcomes.
