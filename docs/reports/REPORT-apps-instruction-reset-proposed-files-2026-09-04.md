# Proposed instruction replacements

These are the reviewed drafts for the highest-impact files. The approved reset has since been applied with the refinements described in [the results](REPORT-apps-instruction-reset-applied-2026-09-05.md). [The audit](REPORT-apps-instruction-reset-2026-09-04.md) and [original inventory](REPORT-apps-instruction-reset-inventory-2026-09-04.csv) record the proposal baseline. A replacement that references a newly proposed document must land together with that document; do not create broken pointers or discard security contracts.

## Apps/AGENTS.md

Proposed replacement for the current 139-line file:

```markdown
# Apps workspace

- Each project owns its code and git workflow. Keep changes within the requested project scope.
- Exclude `/Users/trey/Desktop/Apps/SH/shiphawk-dev` unless the user explicitly requests work there.
- Do not create staging/copy directories at Apps root. Use a temporary directory or a git worktree at `../Apps-wt-[name]`; new Apps directories must be real projects/groups.
- Preserve unrelated edits and sessions. Run only task-owned processes and stop only processes you started.
- AGENTS.md is the shared instruction source. CLAUDE.md imports it; do not duplicate shared rules. Add a child instruction file only for constraints unique to that subtree.
- Keep instruction files limited to durable constraints and non-obvious validation. Put setup, architecture explanations, and history in existing project docs.
- When executing a queued plan, follow `docs/guides/parallel-agent-orchestration.md`; do not apply plan-queue ceremony to unrelated tasks.
- For shared sweeping/holiday changes, check both `Parks/EasyStreet` and `Parks/easystreet-monorepo`.
- Use plain, concise writing without em dashes. For unfamiliar human procedures, give exact locations, control labels, actions, and a verifiable result.
```

## Apps/CLAUDE.md and the default project CLAUDE.md

```markdown
@AGENTS.md
```

For the two EasyStreet files that currently live at `.claude/CLAUDE.md`, prefer moving the import stub to the project root. If retaining the existing location, the import is `@../AGENTS.md`. Do not leave both a full legacy file and a new import stub loading overlapping rules.

## MyLife/AGENTS.md

Proposed replacement for 180 lines. The mesh documents named below already exist; the module-specific contract is drafted next.

```markdown
# MyLife

- Keep standalone app runtime code under its own `apps/<app>/` tree. Archived standalones are historical references, not active parity targets.
- Active standalone apps own their paired product behavior. Update both surfaces when the authorized change affects both; record a real parity gap instead of claiming completeness. BestChef's hub recipes surface is intentionally a scoped adapter. FlashCards permits a tracked follow-up backport; TrainWithRyan is independent and has no MyLife parity obligation.
- Module registration is defined by `packages/module-registry` and each module's `src/definition.ts`. Disabling a module must preserve its data. Preserve release visibility until an authorized release change.
- Keep private local data local by default. Preserve explicit opt-in sharing and documented server-backed product exceptions; do not introduce telemetry or widen data exposure silently.
- Use `packages/sync` for mesh behavior. Every synced entity needs a declared policy and maxScope; sensitive shared-workspace data requires fingerprint-verified pairing. See `docs/designs/mesh-sync-architecture.md` and `docs/designs/mesh-sync-module-policy-matrix.md` when changing this boundary.
- BestChef public flows use Supabase Auth, RLS, Storage, and Edge Functions. Do not make mesh transport launch-critical or treat the local cache as the public authoritative store. Preserve other apps' declared server-backed boundaries.
- Use shared UI tokens from `packages/ui/src/tokens`; keep server-side imports free of native/client-only barrels.
- Run `pnpm gate:function:changed` for function-logic changes, plus the applicable parity checks when changing paired surfaces or registration. Existing pre-commit checks remain authoritative.
- Do not enable, invoke, recommend, or depend on CodeRabbit for MyLife work.
- Treat `docs/business-plan/` as historical snapshots unless refreshed. Verify current claims against current source or evidence rather than repeating old counts, pricing, or readiness claims.
- Keep generated performance output out of tracked docs; use `artifacts/perf-audit` and the existing artifact gate.
```

## MyLife/modules/AGENTS.md

New shared file, replacing module-system duplication and much of the generic module boilerplate:

```markdown
# Hub modules

- Keep platform-independent domain logic here; mobile/web presentation belongs in the app surfaces.
- Preserve the ModuleDefinition contract, table-prefix isolation, syncPolicy, and registry/release-state wiring. Read current source for metadata instead of copying counts or schema versions into instructions.
- Enabling applies the required migrations; disabling preserves data. Do not rewrite shipped migrations.
- Read the module's definition, schema, and relevant tests before changing its storage or sync boundary. Privacy-sensitive data must retain its declared scope and conflict-resolution requirements.
- A standalone adapter is not proof of full product parity. Preserve explicit app-specific ownership and parity exceptions.
```

Most module CLAUDE.md files can then disappear. Keep a small scoped AGENTS.md plus import where the inventory identifies a real exception, especially MyNews and payments. Sleep/Travel release visibility, Nutrition's manual resolver, Sports' metadata coupling, and Manhattan's unsaved-discovery boundary must survive the consolidation.

## MyLife/apps/meerkat/AGENTS.md

The current 121-line file becomes a short contract plus on-demand reference. Before replacing it, preserve its detailed protocol/native-boundary requirements in the proposed `docs/meerkat-contracts.md` inside this app, and reconcile the worktree-only glossary/watchdog rules against the actual branch.

```markdown
# Meerkat app

- Use `@mylife/sync` for crypto and node behavior. Configure secure persistent secrets and the native PRNG before database/identity startup through the shared boot path; foreground and background use the same database contract.
- Keep native architecture and transport compatibility pinned to the validated app configuration. Expo Go or an unsupported transport must fail honestly; UI states require real connection/transfer evidence.
- Required encryption and signature verification fail closed. Never downgrade negotiation or accept invalid recipient/signature/key material to make a flow succeed.
- Keep verification accounts, public identity, private persona/device identity, and their key stores separated. Do not create joinable identifiers or leak account material into private mesh flows.
- Local settings, DM/intake bookkeeping, and declared device-local tables do not replicate. Preserve sync scopes, signed-byte compatibility, membership/key-epoch checks, and metadata privacy.
- Keep the public/private identity distinction in user copy. Follow the verified copy contract when present; do not weaken its regression checks.
- Protocol and native-boundary details: `docs/meerkat-contracts.md`. Preserve its constraints when editing the corresponding code.
- From the MyLife root, run the Meerkat app typecheck/tests and relevant sync/relay tests; run `pnpm check:meerkat-parity` for paired behavior. Native transport claims need native-device evidence, not only mocks or Expo Go.
```

## MyLife/packages/sync/AGENTS.md

Convert its Claude-only contract to shared instructions. Preserve the remaining detailed signed-descriptor/public-snapshot rules in the existing sync design documentation in the same change.

```markdown
# Sync substrate

- Keep the native-facing import surface free of Node-only module-load dependencies.
- Encryption-required flows fail closed. Verify signed frames, recipients, scope caps, and key epochs; never widen policy during transport negotiation.
- Sensitive shared workspaces require verified pairing. An open-join membership grant is not a grant to an epoch key.
- Preserve canonical signed bytes and backward compatibility, including owner descriptors and public snapshots. Verify public snapshots independently before trusting their content.
- Keep crypto, scope policy, and transport contracts in this package rather than parallel implementations in clients.
- Preserve the tweetnacl-util default-import/destructure interop where required by the native bundle.
- Run affected package tests and cross-client integration tests for protocol changes. Mock transport success alone does not establish interoperability.
```

## MyLife/packages/meerkat-relay/AGENTS.md

Its 319-line CLAUDE.md includes requirements for several distinct services. First preserve those service-specific contracts in a proposed `docs/service-contracts.md` in this package; the default instructions can be:

```markdown
# Meerkat services

- The slim relay stays stateless and separate from account/seeder/community deployables. It pairs opaque ephemeral tokens and forwards ciphertext verbatim; no parsing/logging envelopes, device identities, or plaintext. Keep its health response limited to `{ ok, connections }`.
- Rendezvous records remain bounded, rate-limited, TTL-limited, and consume-on-resolve. Hosted stores are tenant-isolated; operators do not hold decryption keys.
- Preserve the one-way wall between verification accounts and private personas/devices. Do not log joinable identifiers or blind credentials.
- Trust forwarded client identity only behind a configured trusted edge. Keep host control local-only and validate public reachability using actual off-host evidence.
- Preserve authorization, durable/idempotent quotas and leases, sealed-piece verification, and fail-closed moderation before public serving. Keep service-specific contracts in `docs/service-contracts.md`.
- Run the affected service tests. Verify the checkout's process watchdog/cleanup support before running suites that spawn real services; never clean up unrelated processes.
```

## FlashCards/AGENTS.md

```markdown
# NatalieLearnsChinese

- Product name is NatalieLearnsChinese; preserve the FlashCards checkout and technical identifiers. Requirements and release evidence live in `docs/natalie-beta.md`.
- Study paths stay offline. Bundle stroke data, hanzi-writer, and card storage; do not add network requirements.
- This is the canonical flash product. Track MyLife `modules/flash` backports as follow-up work when not part of the authorized task.
- Shipped migrations are append-only. Writing helpers inside caller-owned transactions must not open nested transactions.
- `assets/hanzi/hanzi.db` and `lib/hanzi-writer-source.ts` are generated: regenerate with `pnpm build:hanzi` only for hanzi dependency changes, then run `pnpm verify:hanzi`.
- Validate code changes with `pnpm typecheck`, `pnpm test`, and an iOS Expo export for bundle-affecting changes.
```

## TrainWithRyan/AGENTS.md

```markdown
# TrainWithRyan

- Independent single-trainer app for Ryan and his clients. No MyLife runtime references or parity obligation; DoWork is read-only reference material for this project's sessions.
- Preserve locked product decisions in `docs/plans/twr-build-plan.md`; consult the relevant section when changing that behavior.
- Video buckets stay private and reads use signed URLs. Enforce entitlement on the server through RLS/edge functions; client UI checks are not authorization.
- Never represent simulated listening, transport, or entitlement as live behavior.
- Use the applicable app/package and edge-function checks for the changed surface; keep meaningful durable decisions in PROJECT_LOG.md without requiring a second session diary.
```

## Arena/AGENTS.md

The Unreal command cookbook and version-specific migration explanations should move into existing setup/architecture docs before replacing the long CLAUDE.md.

```markdown
# Forest Rascals

- Product name is Forest Rascals. Named-character selection is the initial identity flow; preserve approved combat design in `docs/combat-rules.md` and the data/schema contracts.
- Keep multiplayer combat server-authoritative and follow the existing PlayerState ability-system ownership. Avoid expanding arena work into an MMO unless requested.
- Preserve the current production target of 15 characters, at least 15 active abilities each, and eight maps unless the user changes it.
- Meshy spending cap: 100 credits per character across all stages and retries.
- This Mac hosts many sessions. Run one task-owned heavy Blender/Unreal/build process at a time, close it after verification, and leave other sessions alone.
- Preserve UE compatibility gotchas documented in `docs/unreal-setup-and-tooling.md`, including safe gameplay-effect component construction. Keep binary asset handling compatible with Git LFS.
- Compile affected C++/asset changes with the current project's build path and report any unavailable validation precisely. Give concrete player verification steps for gameplay changes.
- Explain unfamiliar Unreal operations with exact editor locations and controls. Use capability milestones instead of time estimates unless the user asks for a schedule.
```

The last scheduling rule chooses the user-facing root Arena policy over the stricter nested `.claude/agents/AGENTS.md` prohibition. Retire that duplicate agent-guidelines file after resolving this preference in one place.

## receipts/AGENTS.md

```markdown
# Receeps

- Frontend changes use the existing Mantine/core wrappers, Tabler icons, Axios wrapper, dayjs, CSS variables, and Mantine dialogs. Preserve these seams instead of adding parallel UI/API utilities.
- Reuse UserBriefSerializer and `util/cache_utils.py`; invalidate the relevant caches after mutations. Preserve list/detail serializer organization and query-count behavior.
- Use `Count(..., distinct=True)` for the existing aggregate patterns and verify query-heavy changes do not introduce N+1 queries.
- Validate the changed backend with its Django tests; frontend changes use `npm run test:run` and `npm run build` from `frontend/`. Format touched files, not unrelated work.
- No direct pushes to main. Preserve the project's Conventional Commit and branch workflow.
- Planning queue is `docs/plans/running-sprint-list.md`; update it when adding or changing a sprint plan. Do not duplicate the queue in instructions.
- Architecture and project-specific pitfalls live in `.claude/docs/`; consult the relevant document for the code being changed.
```

Its CLAUDE.md becomes the import. Its separate Codex review prompt should reference the canonical rules plus review-specific behavior, rather than become a third synchronized copy.

## pixel-agent-hub/AGENTS.md

First move the useful upstream reference into a proposed `docs/upstream-reference.md`. Preserve licensing/attribution. The local adapter needs only a short project-root boundary:

```markdown
# Pixel Agent Hub

- The local Ghostty hub is in `ghostty-hub/`; follow its scoped instructions. Its vanilla Node/browser runtime is independent of the upstream extension and React build.
- Preserve bundled artwork attribution and licenses.
- Upstream code keeps core/server/webview/VS Code adapter layering and the AsyncAPI-generated protocol contract. Do not hand-edit generated message types.
- For upstream changes, consult `docs/upstream-reference.md` and run the relevant upstream validation. Local adapter-only work uses `npm run hub:test` and a browser smoke test.
```

## pixel-agent-hub/ghostty-hub/AGENTS.md

This file is already compact. A small trim retains the actual terminal-control boundaries:

```markdown
# Ghostty hub

- Keep this adapter independent of upstream runtime changes; use vanilla JS, Node built-ins, bundled assets, and no runtime dependency/build step.
- Bind to 127.0.0.1, validate Host/origin, and require the per-process API token. Pass AppleScript/shell arguments as data.
- Exclude terminals under `/Users/trey/Desktop/Apps/SH/shiphawk-dev` before reading screens or transcripts.
- Polling must not focus terminals or send input. On-demand screen capture preserves every pasteboard data type.
- Match sessions only through unique evidence, never list order. Show uncertain matches and activity honestly.
- Keep theme/style sources and asset attribution intact. Validate with `npm run hub:test`, JS syntax checks, and a browser smoke test; run upstream checks only when upstream code changes.
```

## Small files rather than empty files

For the remaining projects, the audit table and per-file inventory specify the retained content. A five-line file containing the real gotchas is preferable to an empty template. A module with no unique instructions needs neither a child AGENTS.md nor a CLAUDE.md stub. Keep detailed authorization, cryptographic, payment, and moderation contracts available at the narrowest appropriate scope before removing their old copies.
