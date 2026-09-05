# BestChef Server Launch Session Prompt

Use this prompt to start the next work session.

```text
We are in /Users/trey/Desktop/Apps/MyLife/apps/bestchef. Continue BestChef production launch readiness with a server-first launch architecture.

Critical launch decision:
- For public launch, BestChef will not use local-only device communication as the launch-critical path.
- Do not rely on LAN peer sync, nearby peer transport, BLE, WebRTC, mesh relay, or device-to-device local communication for public identity, account restore, social posting, comments, votes, media delivery, moderation, provider calls, recovery, or deletion.
- Use standard server setup: Supabase Auth, Postgres/RLS, Storage, Edge Functions, and server-side jobs.
- Local SQLite remains an offline draft/cache/optimistic UI layer only.
- Do not remove the MyLife mesh substrate globally. Scope this rule to BestChef public launch readiness.

Before editing:
1. Read AGENTS.md and CLAUDE.md.
2. Review .claude/settings.local.json.
3. Review .claude/skills-available.md and .claude/plugins.md.
4. Read docs/plans/features/recipes/bestchef-server-launch-mission-control.md.
5. Read docs/plans/features/recipes/bestchef-production-launch-mission-control.md.
6. Read docs/runbooks/bestchef-account-lifecycle-runbook.md and docs/runbooks/bestchef-public-data-policy-runbook.md.
7. Read memory.md enough to understand the latest BestChef state.
8. Check git status. The worktree may already be dirty from prior sessions. Do not revert unrelated user or prior-session changes.

Current baseline:
- Internal beta is allowed with caveats.
- Public beta and GA are blocked.
- P0-01 identity foundation exists: account lifecycle SQL, cloud helpers, settings account UI, cloud-aware delete-account local wipe, and support runbook.
- P0-02 has a demo cloud alias guard and public data policy runbook.
- Kitchen Intelligence Phase 9 screenshot evidence is done.
- BestChef app/module tests, typechecks, UIUX guard, parity, and changed-function gate passed in the 2026-04-26 identity-foundation session.
- Known unrelated merge blocker: pnpm check:generated-artifacts fails because docs/investor-deck/MyLife-Two-Pager.pdf is 3.41 MB, above the 2 MB policy limit. It is logged in errors_log.md.

Primary objective:
Start resolving the remaining public launch blockers from docs/plans/features/recipes/bestchef-server-launch-mission-control.md, beginning with BCSERVER-P0-00, BCSERVER-P0-02, and BCSERVER-P0-01.

Work in this order unless codebase inspection shows a hard dependency:
1. BCSERVER-P0-00: Audit launch-critical BestChef flows and document server source-of-truth boundaries. Confirm no public launch path depends on local-only device communication.
2. BCSERVER-P0-02: Inventory staging and production Supabase setup. Capture what is configured, what is missing, and what can be implemented locally without dashboard credentials.
3. BCSERVER-P0-01: Implement or complete native deep-link handling, auth session handling, account linking/recovery states, and tests that are possible without external credentials.
4. BCSERVER-P0-03: Start the service-role account deletion worker if the auth/env foundation is clear. Keep service-role secrets server-only.
5. If blocked by external credentials, move to the next implementable P0 server task, likely media storage schema/function scaffolding or provider broker scaffolding.

Implementation constraints:
- TypeScript-first. New runtime code should be .ts/.tsx unless tooling requires otherwise.
- Durable business logic belongs in modules/bestchef. Expo Router screens/providers stay in apps/bestchef.
- Supabase schema changes go in supabase/migrations and must be mirrored in modules/bestchef/src/cloud/schema.sql when relevant.
- RLS must remain strict. Public read access should only expose approved public data.
- Service-role operations must never run in the Expo app or client bundle.
- Expo public env vars may contain only public Supabase URL and anon key, never service-role secrets.
- Public launch builds must not expose BYO provider key UI unless explicitly hidden behind an internal beta flag.
- Public launch rows must not contain file:// media URIs.
- Keep AGENTS.md and CLAUDE.md synchronized if any persistent rule changes.
- Update memory.md and a docs/sessions/YYYY-MM-DD-bestchef-*.md session log before finishing.
- Update errors_log.md only for real build, test, typecheck, parity, deploy, runtime, or hook failures.

Concrete places to inspect first:
- apps/bestchef/app/(root)/providers/BestChefCloudProvider.tsx
- apps/bestchef/app/(root)/(tabs)/settings.tsx
- apps/bestchef/app/(root)/data/account.ts
- apps/bestchef/app/(root)/data/cloud-submissions.ts
- apps/bestchef/app/(root)/data/public-data-policy.ts
- modules/bestchef/src/cloud/account-lifecycle.ts
- modules/bestchef/src/cloud/schema.sql
- modules/bestchef/src/cloud/submission-alias.ts
- supabase/migrations/20260426000007_bestchef_account_lifecycle.sql
- supabase/config.toml
- apps/bestchef/app.json
- apps/bestchef/package.json

Expected deliverables for the next session:
- A focused implementation slice that advances at least one P0 server-launch workstream.
- Updated mission-control statuses and evidence bullets in docs/plans/features/recipes/bestchef-server-launch-mission-control.md.
- If auth is touched, a clear staging/prod configuration checklist and local tests for deep-link/session behavior.
- If Supabase schema/functions are touched, new migrations, schema mirror updates, and tests.
- If only docs/config are changed, state that no function logic changed and why the function gate was skipped.
- If function logic changes, scaffold focused function-gate tests where appropriate and run pnpm gate:function:changed before finalizing.
- A concise session log and memory.md update.

Verification expectations:
- For BestChef app changes:
  pnpm --filter @mylife/bestchef-app typecheck
  pnpm --filter @mylife/bestchef-app test
  pnpm --filter @mylife/bestchef-app test:uiux
- For BestChef module/cloud changes:
  pnpm --filter @mylife/bestchef typecheck
  pnpm --filter @mylife/bestchef test
- For source function logic changes:
  pnpm gate:function:changed
- For parity-sensitive changes:
  pnpm check:parity --quiet
- For merge readiness:
  pnpm check:generated-artifacts
  Note the known investor PDF blocker if it still fails and do not misattribute it to BestChef.

Definition of done:
- The work advances the server-backed public launch path.
- The launch plan remains honest: internal beta can continue, but public beta/GA stay blocked until all P0 launch gates close.
- Any external blockers are listed with exact owner, credential, dashboard, or approval required.
- The final response summarizes completed work, verification, and remaining launch blockers without overstating readiness.
```
