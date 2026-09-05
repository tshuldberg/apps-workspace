# Meerkat Hosted Access Merge

Date: 2026-06-22

## Summary

Committed and merged the Meerkat hosted-access work onto current `origin/main`, then fixed the final merge-time validation failures before landing.

## What Changed

- Added hosted entitlement token helpers for Meerkat hosted relay and community-node access.
- Wired Meerkat web hosted relay payment checks and hosted API token retrieval.
- Added hosted API support in `@mylife/meerkat-relay`.
- Kept the slim self-host relay image workspace-dependency-free by lazy-loading the hosted entitlement verifier only when hosted entitlement mode is explicitly required.
- Added entitlement coverage for malformed tokens, revoked signatures, async revocation, and the server entrypoint.
- Mitigated the follow-up main CI OSV audit failure by moving the root `undici@6.23.0` override from `6.24.0` to `6.27.0`.
- Updated `errors_log.md` to mark stale Meerkat app/parity and relay failures resolved.

## Validation

- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/entitlements test`
- `pnpm --filter @mylife/meerkat-relay typecheck`
- `pnpm --filter @mylife/meerkat-relay test`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/sync test`
- `pnpm --filter @mylife/web test -- lib/billing/__tests__/entitlement-issuer.test.ts`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed --base origin/main`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`
- `git diff --check`
- `pnpm audit --audit-level=high`
- `pnpm install --lockfile-only --frozen-lockfile`
- OSV API query for `undici@6.27.0`
- GitHub audit rerun `27991923741`

## Notes

- Untracked scratch artifacts under `.agents/`, `.playwright-mcp/`, and root screenshots were left uncommitted.
- Open Brain was present in Claude MCP configuration but pending approval, so no Open Brain capture was available from this Codex session.
