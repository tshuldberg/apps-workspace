# Creator program — submit application via backend, not via mailto

## Problem Statement

### Who is affected?
Users applying to the creator program.

### What is the current experience?
`creator-program.tsx` line 30–53 builds a mailto URL and calls `Linking.openURL()`. The application body is composed client-side; nothing is recorded server-side. If the user has no mail client, an alert appears and the application is dropped. If the user opens mail and never sends, there is no application either.

### Pain point
Creator program applications can silently fail to reach the team. No tracking, no funnel data, no automatic vetting.

---

## Desired Outcome

The Apply button submits the form to a server endpoint. The endpoint stores the application, fires any required notifications, and returns a confirmation id. The user sees a success state and can check status later (F-028).

## Success Criteria

1. [ ] Apply hits a backend endpoint and returns a confirmation id.
2. [ ] Failed submissions show a retry-able error.
3. [ ] Success state shows the confirmation id and an estimated review window.
4. [ ] Duplicate applications from the same user are detected (idempotent).
5. [ ] User cannot reach a state where the app says "applied" but nothing was sent.

## Scope Boundaries

**In scope:** Endpoint + form submission.

**Not in scope:** Reviewer/admin dashboard.

## Business Case
- [x] **Must have**

## Technical Context
File: `app/(root)/creator-program.tsx` line 28–54.

## Status

Done in P13-D (SHA fe7110693, creator program backend application + status tracking).
