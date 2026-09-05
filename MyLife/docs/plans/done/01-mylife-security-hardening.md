# Plan: MyLife Security Hardening

<!-- superpowers:executing-plans -->

## Metadata

```yaml
project: MyLife (hub)
priority: 01
effort: M
dependencies: []
worktree: false
parallel_phases: false
created: 2026-03-08
executed: 2026-03-08
audit_ref: docs/reports/REPORT-production-readiness-audit-2026-03-08.md
findings: C1, H1, H2, H3, H4, M1
```

## Objective

Close the security gaps identified in the production readiness audit. The top priority is fixing the Stripe webhook signature verification stub (C1), the only true production blocker. Then add tool sandboxing deny lists, audit MySurf submodule history for leaked keys, sanitize API error messages, scope agent Bash permissions, and add dependency vulnerability scanning to CI.

## Scope

### Files Affected

- `packages/subscription/src/stripe.ts` -- Stripe webhook signature verification (C1)
- `packages/subscription/src/types.ts` -- StripeSDK type extension for constructWebhookEvent
- `.claude/settings.json` -- add `permissions.deny` section (H1)
- `.claude/agents/module-dev.md` -- scope Bash to `pnpm *`, `git *`, `tsc *` (H4)
- `.claude/agents/hub-shell-dev.md` -- scope Bash to `pnpm *`, `git *`, `tsc *` (H4)
- `apps/web/app/api/webhooks/billing/route.ts` -- sanitize error message (H3)
- `package.json` -- add `audit:deps` script (M1)

### Files NOT Affected

- Module business logic (`modules/*/`)
- Database schemas (`packages/db/`)
- UI components (`packages/ui/`)

## Phases

### Phase 1: Stripe Webhook Signature Verification (C1) -- DONE

- [x] Read `packages/subscription/src/stripe.ts` to understand current `handleStripeWebhook()` stub
- [x] Read `packages/subscription/src/types.ts` to check `StripeSDK` interface shape
- [x] Add `constructWebhookEvent` method to `StripeSDK` interface
- [x] Add `webhookSecret` parameter to `initStripe()` options and store it alongside `sdk`
- [x] Rewrite `handleStripeWebhook()` to verify signature via `stripeSDK.constructWebhookEvent()`
- [x] Remove the `_signature` unused parameter -- now `signature` is used
- [x] Update existing webhook test + add 3 new test cases (invalid sig, missing secret, malformed JSON)
- [x] All 38 subscription tests pass

### Phase 2: Tool Sandboxing Deny Lists (H1) -- DONE

- [x] Added `permissions.deny` section with 10 deny rules:
  - `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`
  - `sudo *`
  - `chmod 777 *`
  - `git push --force *` (but not `--force-with-lease`)
  - `Read(./.env)`, `Read(./.env.*)`, `Read(./secrets/*)`, `Read(./**/credentials*)`
- [x] Verified rules don't block legitimate dev commands

### Phase 3: Agent Bash Scoping (H4) -- DONE

- [x] Updated both `module-dev.md` and `hub-shell-dev.md` `allowed-tools` to scope Bash:
  - `Bash(pnpm *)`, `Bash(git *)`, `Bash(tsc *)`, `Bash(node *)`, `Bash(ls *)`, `Bash(cat *)`, `Bash(mkdir *)`

### Phase 4: MySurf Submodule Key Audit (H2) -- DONE (Clean)

- [x] Ran `git -C MySurf log --all --diff-filter=A -- '.env' '.env.local' '.env.production'` -- no results
- [x] Ran `git -C MySurf log --all -p -- '.env*'` -- no results
- [x] No leaked keys in MySurf git history
- [x] MySurf `.gitignore` already covers `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`

### Phase 5: API Error Sanitization (H3) -- DONE

- [x] Searched all `.ts`/`.tsx` for error messages exposing env var names
- [x] Fixed `apps/web/app/api/webhooks/billing/route.ts` -- was passing `err.message` (which includes env var name from `requireEnvVar()`) directly to API response. Changed to generic "Required secrets not configured."
- [x] All other API routes already use generic error messages in their catch blocks
- [x] `modules/nutrition/src/ai/photo-log.ts` uses user-facing guidance ("Set it in Settings > API Keys") -- appropriate, not leaking env var names
- [x] MySurf edge functions expose `ANTHROPIC_API_KEY` in error messages but those are in the standalone submodule (separate concern)

### Phase 6: Dependency Vulnerability Scanning (M1) -- DONE (Already in CI)

- [x] CI already has `audit` job running `pnpm audit --audit-level=high` (was added in security commit on main)
- [x] Added `audit:deps` script to root `package.json` for local convenience

## Acceptance Criteria

1. [x] `handleStripeWebhook()` uses the signature parameter for HMAC verification
2. [x] Tests prove forged webhook payloads are rejected (3 new test cases)
3. [x] `.claude/settings.json` has `permissions.deny` with 10 patterns
4. [x] Both agent definitions have scoped Bash permissions
5. [x] MySurf submodule git history audited -- clean, no leaked keys
6. [x] No hub API error messages expose env var names
7. [x] `pnpm audit:deps` script exists and CI already runs audit
8. [x] `pnpm test` passes for `packages/subscription/` (38/38)
9. [x] Pre-existing typecheck errors in `billing-config` unrelated to changes

## Constraints

- Do not modify module business logic or UI code
- Do not change the StripeSDK interface in ways that break existing callers of `initStripe()` or `purchaseViaStripe()`
- The webhook secret should come from an env var (`STRIPE_WEBHOOK_SECRET`), not be hardcoded
- Deny list rules must not block `pnpm install`, `pnpm test`, `git push` to feature branches, or `rm -rf node_modules`
- Keep the MySurf key audit read-only -- do not rewrite git history (that requires user decision)
