# Meerkat review fleet, 2026-09-01 (re-dispatch kit)

Seven parallel Fable 5.1 read-only review agents were dispatched on 2026-09-01 and all died at spawn on the account session limit. Re-dispatch them (Agent tool, `subagent_type: general-purpose`, model inherited) after the limit resets. Each agent writes its report to a scratchpad file and returns it; the orchestrator verifies every finding against code before acting.

Common preamble for every agent:

```
You are a Fable 5.1 review agent. READ-ONLY: never edit files, never run git
commands that mutate state, never run full test suites or typechecks (the
orchestrator runs them), never drive a browser. You may run a targeted
single-file vitest run or a small PoC script in the scratchpad to confirm a
finding, and grep/read freely. Repo root: /Users/trey/Desktop/Apps/MyLife.
First read apps/meerkat/AGENTS.md fully. Skip findings already resolved in
docs/sessions/2026-08-24-meerkat-bug-audit.md and
docs/reports/REPORT-meerkat-fable-review-2026-09-01.md unless they regressed.
DELIVERABLE: findings most severe first, each with severity
CRITICAL/HIGH/MED/LOW, title, file:line, concrete failure or exploit scenario,
confidence CONFIRMED (traced or PoC) or PLAUSIBLE, recommended fix; then
invariants verified as holding with file:line; then coverage gaps. No em
dashes. Never report something you did not verify in code.
```

| Agent | Dimension | Scope |
|---|---|---|
| rv-goals | Product goals vs code; honesty-boundary copy; dead features; plan 51-58 coherence | apps/meerkat/AGENTS.md, docs index, investor pitch 2026-09-01, launch and user guides, plans 51-58, both app surfaces' UI copy |
| rv-sync-crypto | Crypto, protocol, transport adversarial review | packages/sync/src/{identity,encryption,secrets,share,signaling,protocol,transport,engine,node}, blind credential, friend codes, rendezvous, TOFU, LWW; app consumers sync-core, effective-relay, webrtc-sync-signaling, invite-envelope-core, humanity-core, app-unlock*, dm-core, person-identity-core, the four *-backend.ts |
| rv-relay | Server-side authn/authz, IDOR, rate limits, stores, secrets, two-identity wall, DoS | packages/meerkat-relay/src (all), bins, deploy/ compose, workflows |
| rv-mobile | Correctness, data loss, honesty, fail-open affordances, test quality, maintainability; the recursive-bug-hunt Learnings classes | apps/meerkat (providers, data cores, every screen, components, config, shims, tests) |
| rv-web | Web security (XSS, CSP, sandbox, vault, secure context), boot/unlock state machines, parity drift vs mobile | apps/meerkat-web (provider, data, schema, ui, index.html, vite config, e2e) |
| rv-process | Git history arc, churn, fix-of-fix chains, commit-claim audit, test quality sample, CI and gate coverage, dependency advisories, docs debt, architecture metrics | git log for the four packages, workflows, husky, parity and esm scripts, pnpm audit, AGENTS.md vs layout, errors_log Unresolved rows |
| rv-sync-data | Policy holes, changeset apply, CRDT/LWW, storage router, blob pipeline, expiry, migrations, barrel drift | packages/sync/src/{storage,db,crdt,changeset,expiry,blob,torrent,hooks,providers,node,types}, index.ts vs index.native.ts, app policy seams on both twins, relay community-node.ts |
