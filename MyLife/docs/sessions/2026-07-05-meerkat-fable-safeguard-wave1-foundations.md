# Meerkat Fable Safeguard Review + Wave 1 Foundations

Date: 2026-07-05

Branch: `feature/meerkat-launch-completion`

## Summary

Reviewed the Fable safeguard stop from the session scratchpad and generated an HTML feedback report outside the repo:

`/private/tmp/claude-501/-Users-trey-Desktop-Apps-MyLife-apps-meerkat/4db8ca97-3323-45cb-88f0-e5f6fbc6999c/scratchpad/fable-safeguard-feedback-report.html`

The safeguard was a false positive on authorized defensive work. The strongest trigger was dense remediation language that repeatedly described unsafe attachment rendering, key material exposure risk, unbounded node resource handling, and adversarial regression-test phrasing in one context window. The report reframes the same work in defect-first language and gives concise feedback text for the model vendor.

## Code Completed

- Fixed the web attachment preview risk by allowing inline render only for safe media/PDF MIME types, forcing download for scriptable or unknown types, and adding a CSP baseline to the web shell.
- Hardened community-node POST handling with per-route body caps, 413 responses, public register admission before body read, bounded unclaimed-community state, and state sweep/eviction.
- Built Plan 29 P0-P1: live-session rendezvous token derivation, auto-connect schema/query helpers, pure auto-connect planner, and `runAutoConnectJob`.
- Built Plan 27 P3: local join handoff over established local connection, plus mobile/web relay-queue refusal for local-only join requests.
- Started Plan 27 P4 foundation: `cm_policy_history` helpers on mobile, web policy-history copy/formatter twin, and a parity guard for policy copy.
- Built Plan 24 P0-P2 and pure P3 foundation: humanity credential protocol, service core, HTTP surface, verifier adapters, production-safety checks, and `checkHumanityGate`.

## Verified

- `pnpm --filter @mylife/sync test -- session-token auto-connect-plan auto-connect-schema auto-connect-job local-join-handoff humanity-credential humanity-gate`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/meerkat-relay test -- community-node-dos-hardening humanity-service humanity-verifiers`
- `pnpm --filter @mylife/meerkat-relay typecheck`
- `pnpm --filter @mylife/meerkat-web test -- attachment-open-safety web-csp policy-history`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-app test -- community-policy-history`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `node scripts/check-meerkat-parity.mjs`

## Remaining Work

- Plan 23 Wave 1 work is untouched in this commit.
- Plan 24 P3 route enforcement still needs node middleware and public-join/registerPublication enforcement calls.
- Plan 27 P4 still needs production gossip caller wiring, member notices, settings rows, and owner create/revise picker on both surfaces.
- Plan 29 Phases 2-6 remain: mobile/web wiring, honest UI, background graduation, opt-in signed presence, and hardening.
