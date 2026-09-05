# Plan 50: Yearn Boost Integrity (Self-Grant Revenue Leak Fix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Created:** 2026-07-11
**Owner:** Fable orchestrator (plan author + final reviewer)
**Branch:** `feature/yearn-boost-integrity` (worktree `/Users/trey/Desktop/Apps-wt-50-yearn-boost-integrity`)
**Source findings:** errors_log.md row 2026-07-11 "Yearn activate_boost self-grantable revenue leak (rev-yearn P2)"; plan 47 Phase 2 item 3 + Phase 5.

**Goal:** Close the Yearn boost self-grant revenue leak: any authenticated user can call `yearn.activate_boost(text)` directly (SECURITY DEFINER, granted to `authenticated`, zero receipt validation, replayable transaction ids) and grant themselves unlimited 7-day boosts.

**Architecture:** Kill the client-callable RPC entirely. Boost activation moves behind a new `yearn-activate-boost` Supabase Edge Function that validates the StoreKit transaction against the **App Store Server API** (signed ES256 JWT, GET `/inApps/v1/transactions/{transactionId}`, production-then-sandbox fallback), validates the decoded transaction claims (bundleId, productId, type, revocation), then grants via a new **service-role-only** `yearn.grant_boost(...)` RPC. A partial unique index on `original_transaction_id` makes each transaction redeemable at most once; same-user retries are idempotent, cross-user replay is rejected. The edge function **fails closed** (503 `boost_unavailable`) when Apple credentials are not configured, so boost stays fully disabled until validation is live. The app keeps boost UI hidden, and every failure path surfaces honest copy (never fake success).

**Tech Stack:** Postgres/plpgsql migration, Deno edge function (WebCrypto ES256, dependency-injected handler per `dowork-rc-webhook` pattern), supabase-js `functions.invoke` on the client, vitest.

**Non-goals:** No StoreKit purchase UI (boost stays hidden; the IAP library is not added in this plan). No RevenueCat. No changes to `discover_profiles` ranking. Hosted deploy + Apple credentials are founder ops, documented but not executed here.

---

## Context the engineer must know

- The repo pattern for edge functions is **dependency injection**: `handleXRequest(req, deps)` exported for vitest, with interfaces for external systems, and a Supabase REST store using service role headers. Read `supabase/functions/dowork-rc-webhook/index.ts` end to end first; copy its structure (declare-const-Deno guard, `jsonResponse`/`errorJson` helpers, `restJson` store, `Deno.serve` wiring at the bottom guarded by `typeof Deno !== 'undefined'`).
- User-facing functions rely on **gateway JWT verification** (`verify_jwt` defaults to true; do NOT add this function to the `verify_jwt = false` list in `supabase/config.toml`). Inside the function you may decode the bearer JWT payload without verifying the signature (the gateway already did) to get `sub` — the same pattern as `supabase/functions/mynews-report`.
- The Yearn supabase client is created with `db: { schema: 'yearn' }` (`apps/yearn/src/lib/supabase.ts`), so PostgREST calls from the edge function to yearn RPCs need the `Content-Profile: yearn` header.
- The `yearn` schema is exposed in `supabase/config.toml` (landed in plan 47 Phase 2).
- Existing migration being superseded: `supabase/migrations/20260525000012_yearn_boost.sql` (defines `yearn.boosts`, `has_active_boost`, the leaky `activate_boost`, boosted `discover_profiles`). We keep the table, predicate, and ranking; we only remove/replace the activation path.
- Migration numbering: new file MUST be `20260712000001_*` (verified free; must not collide with `20260525*` or `20260711*`).
- App tests run via `pnpm --filter @mylife/yearn-app test` (vitest, currently config-less defaults, 134 tests). Edge function tests are swept into a package's vitest `include` globs (see `modules/bestchef/vitest.config.ts`); yearn needs a new `apps/yearn/vitest.config.ts` to include its own function tests.
- No em dashes in any copy or docs.
- Commit style: Conventional Commits. Run commits with the repo's pre-commit function gate active; if the gate stashes fail in the shared tree, you are in the WRONG directory: all work happens in `/Users/trey/Desktop/Apps-wt-50-yearn-boost-integrity`.

---

## Task 1: Migration 20260712000001_yearn_boost_integrity.sql

**Files:**
- Create: `supabase/migrations/20260712000001_yearn_boost_integrity.sql`

- [ ] **Step 1.1: Write the migration** with exactly this content:

```sql
-- Yearn boost integrity: close the activate_boost self-grant revenue leak.
--
-- 20260525000012 shipped yearn.activate_boost(text) as SECURITY DEFINER and
-- granted it to authenticated. Any signed-in user could call it directly (no
-- purchase, no receipt) and self-grant a 7-day boost, and the same
-- original_transaction_id could be replayed forever (errors_log 2026-07-11,
-- rev-yearn P2; plan 47 phase 2 item 3).
--
-- This migration:
--   1. Drops the client-callable yearn.activate_boost(text) entirely. Boost
--      activation moves behind the yearn-activate-boost edge function, which
--      validates the transaction with the App Store Server API first.
--   2. Adds audit columns (transaction_id, product_id, environment).
--   3. Dedupes original_transaction_id and adds a partial unique index so a
--      validated transaction can be redeemed at most once.
--   4. Adds yearn.grant_boost(...), SECURITY DEFINER, executable ONLY by
--      service_role. Same-user retries are idempotent; cross-user replay of a
--      redeemed transaction raises.
--
-- Idempotent and safely re-runnable. Until the edge function is deployed with
-- Apple credentials, there is NO server-side path that activates a boost:
-- boost is fully disabled by this migration.

-- 1. Remove the client-trusted activation path.
drop function if exists yearn.activate_boost(text);

-- 2. Audit columns for validated purchases.
alter table yearn.boosts add column if not exists transaction_id text;
alter table yearn.boosts add column if not exists product_id text;
alter table yearn.boosts add column if not exists environment text;

-- 3. One redemption per original transaction. Dedupe first (keep the earliest
-- row per transaction id) so the index builds even if the client-trusted era
-- wrote duplicates.
delete from yearn.boosts b
where b.original_transaction_id is not null
  and b.id not in (
    select distinct on (original_transaction_id) id
    from yearn.boosts
    where original_transaction_id is not null
    order by original_transaction_id, created_at, id
  );

create unique index if not exists boosts_original_transaction_id_unique
  on yearn.boosts (original_transaction_id)
  where original_transaction_id is not null;

-- 4. Service-role-only grant path. The edge function calls this AFTER the
-- App Store Server API confirms the transaction. p_user_id comes from the
-- caller's gateway-verified JWT, never from the request body.
create or replace function yearn.grant_boost(
  p_user_id uuid,
  p_original_transaction_id text,
  p_transaction_id text,
  p_product_id text,
  p_environment text
)
returns table (expires_at timestamptz, duplicate boolean)
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_tx text := nullif(trim(p_original_transaction_id), '');
  v_expires timestamptz;
  v_existing yearn.boosts%rowtype;
begin
  if p_user_id is null then
    raise exception 'grant_boost: p_user_id is required';
  end if;
  if v_tx is null then
    raise exception 'grant_boost: p_original_transaction_id is required';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'grant_boost: unknown user';
  end if;

  insert into yearn.boosts
    (user_id, started_at, expires_at, original_transaction_id,
     transaction_id, product_id, environment)
  values
    (p_user_id, now(), now() + interval '7 days', v_tx,
     nullif(trim(p_transaction_id), ''), nullif(trim(p_product_id), ''),
     nullif(trim(p_environment), ''))
  on conflict (original_transaction_id) where original_transaction_id is not null
    do nothing
  returning yearn.boosts.expires_at into v_expires;

  if v_expires is not null then
    return query select v_expires, false;
    return;
  end if;

  select * into v_existing
  from yearn.boosts b
  where b.original_transaction_id = v_tx;

  if not found then
    raise exception 'grant_boost: conflict row vanished for transaction %', v_tx;
  end if;

  if v_existing.user_id <> p_user_id then
    raise exception 'grant_boost: transaction already redeemed by another account';
  end if;

  return query select v_existing.expires_at, true;
end;
$$;

revoke all on function yearn.grant_boost(uuid, text, text, text, text) from public;
revoke execute on function yearn.grant_boost(uuid, text, text, text, text)
  from anon, authenticated;
grant execute on function yearn.grant_boost(uuid, text, text, text, text)
  to service_role;
```

- [ ] **Step 1.2: Sanity checks.** Run: `ls supabase/migrations/ | grep 20260712` (expect only the new file). Run: `grep -rn "activate_boost" supabase/migrations/20260712000001_yearn_boost_integrity.sql` (expect only the drop + comments). Confirm no OTHER migration file was modified.

- [ ] **Step 1.3: Commit.**

```bash
git add supabase/migrations/20260712000001_yearn_boost_integrity.sql
git commit -m "fix(yearn): drop client-callable activate_boost, add unique tx index + service-role grant_boost"
```

---

## Task 2: Edge function `yearn-activate-boost` (TDD)

**Files:**
- Create: `supabase/functions/yearn-activate-boost/index.ts`
- Create: `supabase/functions/yearn-activate-boost/__tests__/index.test.ts`

The function is one file exporting testable pieces: `handleYearnActivateBoostRequest`, `createAppStoreJwt`, `decodeJwsPayload`, `validateAppStoreTransaction`, `createAppStoreClient`, `createSupabaseBoostStore`, plus the types. Follow `dowork-rc-webhook/index.ts` structure (Deno declare guard at top, serve wiring at bottom).

### Interfaces and handler contract

```ts
export interface AppStoreTransaction {
  bundleId: string | null;
  productId: string | null;
  transactionId: string | null;
  originalTransactionId: string | null;
  type: string | null;
  revocationDate: number | null;
  purchaseDate: number | null;
}

export type AppStoreLookup =
  | { ok: true; transaction: AppStoreTransaction; environment: 'Production' | 'Sandbox' }
  | { ok: false; reason: 'not_found' | 'unreachable' };

export interface AppStoreClient {
  getTransactionInfo(transactionId: string): Promise<AppStoreLookup>;
}

export type BoostGrantResult =
  | { ok: true; expiresAt: string; duplicate: boolean }
  | { ok: false; reason: 'transaction_already_used' };

export interface BoostStore {
  grantBoost(input: {
    userId: string;
    originalTransactionId: string;
    transactionId: string;
    productId: string;
    environment: string;
  }): Promise<BoostGrantResult>;
}

export interface ActivateBoostDeps {
  /** null when Apple credentials are not configured: the handler MUST fail closed. */
  appStore: AppStoreClient | null;
  store: BoostStore;
  expectedBundleId: string;   // 'com.mylife.yearn'
  expectedProductId: string;  // 'com.mylife.yearn.boost'
}
```

**Handler flow (`handleYearnActivateBoostRequest(req, deps)`), in order:**
1. Non-POST: 405 `{ error: 'method_not_allowed' }`.
2. Read `Authorization: Bearer <jwt>`; base64url-decode the payload segment and take `sub` (gateway already verified the signature; same as mynews functions). Missing/undecodable/blank sub: 401 `{ error: 'unauthorized' }`.
3. Parse JSON body; require non-empty string `transactionId` after trim. Otherwise 400 `{ error: 'invalid_input' }`.
4. If `deps.appStore === null`: 503 `{ error: 'boost_unavailable' }`. **Apple must never be consulted and no grant may happen.** This is the fail-closed gate that keeps boost disabled until validation is live.
5. `deps.appStore.getTransactionInfo(transactionId)`:
   - `{ ok: false, reason: 'not_found' }` -> 422 `{ error: 'purchase_invalid' }`
   - `{ ok: false, reason: 'unreachable' }` -> 502 `{ error: 'apple_unreachable' }`
6. `validateAppStoreTransaction(tx, requestedTransactionId, deps)` must ALL hold, else 422 `{ error: 'purchase_invalid' }`:
   - `tx.bundleId === deps.expectedBundleId`
   - `tx.productId === deps.expectedProductId`
   - `tx.type === 'Consumable'`
   - `tx.transactionId === requestedTransactionId` (string equality after trim)
   - `tx.revocationDate == null` (refunded/revoked purchases grant nothing)
   - `tx.originalTransactionId` is a non-empty string
7. `deps.store.grantBoost({ userId, originalTransactionId: tx.originalTransactionId, transactionId: tx.transactionId, productId: tx.productId, environment })`:
   - `{ ok: false, reason: 'transaction_already_used' }` -> 409 `{ error: 'transaction_already_used' }`
   - `{ ok: true, expiresAt, duplicate }` -> 200 `{ ok: true, expiresAt, duplicate }`
8. Any thrown error: 500 `{ error: 'internal' }` (wrap steps 5-7 in try/catch; log via `console.error`).

### Apple client implementation

`createAppStoreClient(env, fetchImpl, cryptoImpl = crypto)`: reads `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY` (PKCS8 PEM of the .p8), `YEARN_APPLE_BUNDLE_ID` (default `'com.mylife.yearn'`). If issuer/key/private key are not all present, return `null` (handler then fails closed).

- `createAppStoreJwt({ issuerId, keyId, privateKeyPem, bundleId, nowSeconds, cryptoImpl })`:
  - header `{ alg: 'ES256', kid: keyId, typ: 'JWT' }`
  - payload `{ iss: issuerId, iat: nowSeconds, exp: nowSeconds + 300, aud: 'appstoreconnect-v1', bid: bundleId }`
  - strip PEM armor, base64-decode, `cryptoImpl.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])`, sign `${header}.${payload}` with `{ name: 'ECDSA', hash: 'SHA-256' }`, base64url the raw signature. Base64url helpers must handle padding both ways.
- `getTransactionInfo(id)`:
  - GET `https://api.storekit.itunes.apple.com/inApps/v1/transactions/{encodeURIComponent(id)}` with `Authorization: Bearer <jwt>`.
  - 200: decode `signedTransactionInfo` JWS payload (`decodeJwsPayload`: split on '.', base64url-decode segment [1], JSON.parse) and map fields to `AppStoreTransaction` (numbers `revocationDate`/`purchaseDate` via a `numberOrNull` helper; everything else `stringOrNull`). Environment: `'Production'`.
  - 404 from production: retry `https://api.storekit-sandbox.itunes.apple.com` with a fresh request; 200 there maps with environment `'Sandbox'` (App Review purchases are sandbox; we record the environment in the ledger). 404 in both: `{ ok: false, reason: 'not_found' }`.
  - Any other status, or fetch throw: `{ ok: false, reason: 'unreachable' }`.

**Design note (reviewed decision):** we trust the decoded JWS payload because it arrives over TLS directly from Apple's App Store Server API in response to our authenticated request; full x5c certificate-chain verification is defense in depth that this plan intentionally omits. Do not add an x5c stub that pretends to verify. State this in a code comment on `decodeJwsPayload`.

### Store implementation

`createSupabaseBoostStore(env, fetchImpl)`: requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (throw if missing, same as `ensureServiceConfig` in dowork-rc-webhook). `grantBoost` POSTs to `${url}/rest/v1/rpc/grant_boost` with headers `apikey`, `Authorization: Bearer <serviceKey>`, `Content-Type: application/json`, **`Content-Profile: yearn`** and body `{ p_user_id, p_original_transaction_id, p_transaction_id, p_product_id, p_environment }`.
- 200: PostgREST returns the table as an array; take row 0 -> `{ ok: true, expiresAt: row.expires_at, duplicate: row.duplicate === true }`.
- Non-200: read the error body text; if it contains `already redeemed by another account`, return `{ ok: false, reason: 'transaction_already_used' }`; otherwise throw with status + body.

### Serve wiring (bottom of file, mirroring dowork-rc-webhook)

```ts
if (typeof Deno !== 'undefined' && Deno.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createSupabaseBoostStore(env, fetch);
  const appStore = createAppStoreClient(env, fetch);
  Deno.serve((req) =>
    handleYearnActivateBoostRequest(req, {
      appStore,
      store,
      expectedBundleId: env('YEARN_APPLE_BUNDLE_ID') ?? 'com.mylife.yearn',
      expectedProductId: env('YEARN_BOOST_PRODUCT_ID') ?? 'com.mylife.yearn.boost',
    }),
  );
}
```

- [ ] **Step 2.1: Write the failing tests first** in `__tests__/index.test.ts`. Build helpers: `jwtFor(sub)` (unsigned JWT, same as mynews-report test), `post(body, sub)` request builder, `fakeAppStore(result)` and an in-memory `BoostStore` that records calls and enforces the unique/cross-user semantics. Required test cases (names must communicate the scenario):
  1. **rejects non-POST** with 405.
  2. **401 when Authorization is missing or sub is blank.**
  3. **400 on missing/blank transactionId.**
  4. **fails closed when Apple is not configured:** deps.appStore null -> 503 `boost_unavailable`, store never called.
  5. **happy path:** valid Apple transaction -> 200 `{ ok: true, expiresAt, duplicate: false }`; store received userId from the JWT sub and originalTransactionId from Apple's payload (NOT from the request body).
  6. **same-user replay is idempotent:** second call with same transaction -> 200 with `duplicate: true`, exactly one boost row in the fake store.
  7. **cross-user replay rejected:** same transaction, different sub -> 409 `transaction_already_used`, no second row.
  8. **wrong bundleId -> 422; wrong productId -> 422; type != Consumable -> 422; revoked (revocationDate set) -> 422; transactionId mismatch (Apple returns a different id than requested) -> 422.** In every case the store is never called.
  9. **Apple not_found -> 422, unreachable -> 502**, store never called.
  10. **createAppStoreJwt** produces a JWT whose decoded header is `{ alg: 'ES256', kid, typ: 'JWT' }`, payload has `iss/iat/exp = iat+300/aud 'appstoreconnect-v1'/bid`, and whose signature verifies via `crypto.subtle.verify` against the public half of a P-256 keypair generated in the test (export the generated private key as pkcs8 PEM to feed in).
  11. **decodeJwsPayload** decodes a hand-built base64url JWS payload segment.
  12. **createAppStoreClient returns null** when any of the three Apple env vars is missing.
  13. **sandbox fallback:** fetch mock returns 404 for the production host then 200 (with a signed-transaction-info stub) for the sandbox host -> environment `'Sandbox'` reaches the store.
- [ ] **Step 2.2: Run the tests, confirm they fail** (module not found): `cd apps/yearn && npx vitest run ../../supabase/functions/yearn-activate-boost` (this works only after Task 3's vitest config; until then run from repo root: `npx vitest run supabase/functions/yearn-activate-boost --root .` or simply write index.ts next and rely on Step 3 to wire the suite; either way there must be a red run before green).
- [ ] **Step 2.3: Implement `index.ts`** per the contract above until all tests pass.
- [ ] **Step 2.4: Typecheck the functions tree:** `npx tsc --noEmit -p supabase/functions/tsconfig.json`. Expected: clean.
- [ ] **Step 2.5: Commit.**

```bash
git add supabase/functions/yearn-activate-boost
git commit -m "feat(yearn): App Store Server API validated boost activation edge function"
```

---

## Task 3: Yearn app vitest config (function tests swept into the suite)

**Files:**
- Create: `apps/yearn/vitest.config.ts`

- [ ] **Step 3.1: Record the baseline test count:** `pnpm --filter @mylife/yearn-app test 2>&1 | tail -3` (expect 134 passing today; write the number down).
- [ ] **Step 3.2: Create the config** (keep defaults otherwise; the current suite runs config-less):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'app/**/__tests__/**/*.test.ts',
      'app/**/__tests__/**/*.test.tsx',
      '../../supabase/functions/yearn-activate-boost/__tests__/**/*.test.ts',
    ],
  },
});
```

- [ ] **Step 3.3: Run the suite:** `pnpm --filter @mylife/yearn-app test`. Expected: every baseline test still collected (count >= baseline) PLUS the new edge-function tests, all green. If the collected count dropped below baseline, the include globs missed a location: find it (`git ls-files 'apps/yearn/**/*.test.*'`) and fix the globs.
- [ ] **Step 3.4: Commit.**

```bash
git add apps/yearn/vitest.config.ts
git commit -m "test(yearn): sweep yearn-activate-boost function tests into the app suite"
```

---

## Task 4: App side: repository via edge function, honest failure copy (TDD)

**Files:**
- Create: `apps/yearn/src/lib/yearnBoost.ts`
- Create: `apps/yearn/src/lib/__tests__/yearnBoost.test.ts`
- Modify: `apps/yearn/src/lib/yearnRepository.ts` (the `activateBoost` method, ~line 660)
- Modify: `apps/yearn/src/lib/discoverDeck.ts:111` (boost copy) and `apps/yearn/src/lib/__tests__/discoverDeck.test.ts:89`
- Modify: `apps/yearn/src/lib/__tests__/yearnRepository.test.ts` (activateBoost cases)

### 4a. `yearnBoost.ts`

```ts
import { z } from 'zod';

export type YearnBoostFailureCode =
  | 'unauthorized'
  | 'boost_unavailable'
  | 'purchase_invalid'
  | 'transaction_already_used'
  | 'apple_unreachable'
  | 'unknown';

const KNOWN_CODES: ReadonlySet<string> = new Set([
  'unauthorized',
  'boost_unavailable',
  'purchase_invalid',
  'transaction_already_used',
  'apple_unreachable',
]);

export class YearnBoostActivationError extends Error {
  constructor(
    readonly code: YearnBoostFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'YearnBoostActivationError';
  }
}

/**
 * Honest user-facing copy. Every string states plainly that no boost was
 * activated; none of them claim success or pretend a retry already happened.
 */
export function describeYearnBoostFailure(code: YearnBoostFailureCode): string {
  switch (code) {
    case 'boost_unavailable':
      return "Boost isn't available yet. No boost was activated and Apple was not asked to charge you through this app.";
    case 'purchase_invalid':
      return 'Apple could not verify this purchase, so no boost was activated.';
    case 'transaction_already_used':
      return 'This purchase was already used to activate a boost. It cannot be redeemed again.';
    case 'apple_unreachable':
      return "Apple's purchase verification is unreachable right now. No boost was activated. Please try again later.";
    case 'unauthorized':
      return 'You need to be signed in before a boost can be activated.';
    default:
      return 'Something went wrong while verifying the purchase. No boost was activated.';
  }
}

export function parseYearnBoostFailureCode(value: unknown): YearnBoostFailureCode {
  return typeof value === 'string' && KNOWN_CODES.has(value)
    ? (value as YearnBoostFailureCode)
    : 'unknown';
}

export const yearnBoostActivationSchema = z.object({
  ok: z.literal(true),
  expiresAt: z.string(),
  duplicate: z.boolean().optional(),
});

export interface YearnBoostActivation {
  expiresAt: string;
  duplicate: boolean;
}
```

### 4b. Repository change

Replace the current `activateBoost` (direct `rpc('activate_boost')`, which no longer exists server-side) with an edge-function call. supabase-js `functions.invoke` returns `{ data, error }`; when the function responds non-2xx the error is a `FunctionsHttpError` whose `context` is the `Response`. Map it via the body's `error` field.

```ts
async activateBoost(transactionId: string): Promise<YearnBoostActivation> {
  const trimmed = transactionId.trim();
  if (!trimmed) {
    throw new YearnBoostActivationError('purchase_invalid', describeYearnBoostFailure('purchase_invalid'));
  }
  const { data, error } = await this.client.functions.invoke('yearn-activate-boost', {
    body: { transactionId: trimmed },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    let code: YearnBoostFailureCode = 'unknown';
    if (context && typeof context.json === 'function') {
      const body = await context.json().catch(() => null);
      code = parseYearnBoostFailureCode((body as { error?: unknown } | null)?.error);
    }
    throw new YearnBoostActivationError(code, describeYearnBoostFailure(code));
  }
  const parsed = yearnBoostActivationSchema.parse(data);
  return { expiresAt: parsed.expiresAt, duplicate: parsed.duplicate ?? false };
}
```

Add the imports to `yearnRepository.ts`:

```ts
import {
  describeYearnBoostFailure,
  parseYearnBoostFailureCode,
  yearnBoostActivationSchema,
  YearnBoostActivationError,
  type YearnBoostActivation,
  type YearnBoostFailureCode,
} from './yearnBoost';
```

Check `cachedYearnRepository.ts` for an `activateBoost` passthrough and update its signature/return type to match if present.

### 4c. Honest deck copy

`discoverDeck.ts:111`: change `if (action === 'boost') return `Boost previewed for ${name}`;` to:

```ts
if (action === 'boost') return "Boost isn't available yet";
```

Update the expectation in `discoverDeck.test.ts:89` accordingly. (Boost UI stays removed from `DiscoverDeck.tsx`; this formatter is the only remaining surface and it must not claim a preview happened.)

- [ ] **Step 4.1: Write failing tests.** In `__tests__/yearnBoost.test.ts`: `describeYearnBoostFailure` returns non-empty honest copy for every code (assert each string contains no success language: expect them to match `/no boost was activated|cannot be redeemed|signed in|isn't available/i`); `parseYearnBoostFailureCode` maps each known code and falls back to `'unknown'`. In `yearnRepository.test.ts` (follow that file's existing stub-client pattern): activateBoost success parses `{ ok, expiresAt, duplicate }`; a FunctionsHttpError-shaped error with a JSON body `{ error: 'boost_unavailable' }` throws `YearnBoostActivationError` with code `boost_unavailable`; an error without context throws code `unknown`; empty transactionId throws `purchase_invalid` WITHOUT calling invoke; verify `client.rpc` is NOT called with `'activate_boost'` anywhere.
- [ ] **Step 4.2: Run, confirm red:** `pnpm --filter @mylife/yearn-app test`.
- [ ] **Step 4.3: Implement** 4a + 4b + 4c until green.
- [ ] **Step 4.4: Full checks:** `pnpm --filter @mylife/yearn-app typecheck && pnpm --filter @mylife/yearn-app test`. Then `git grep -n "activate_boost" -- apps/yearn` must return ZERO hits (the string survives only in supabase/migrations and the edge function comments).
- [ ] **Step 4.5: Commit.**

```bash
git add apps/yearn/src/lib/yearnBoost.ts apps/yearn/src/lib/__tests__/yearnBoost.test.ts \
  apps/yearn/src/lib/yearnRepository.ts apps/yearn/src/lib/cachedYearnRepository.ts \
  apps/yearn/src/lib/discoverDeck.ts apps/yearn/src/lib/__tests__/discoverDeck.test.ts \
  apps/yearn/src/lib/__tests__/yearnRepository.test.ts
git commit -m "fix(yearn): boost activation via validated edge function with honest failure copy"
```

---

## Task 5: Gates (run by the implementer, verified by the orchestrator)

- [ ] `pnpm --filter @mylife/yearn-app typecheck` clean.
- [ ] `pnpm --filter @mylife/yearn-app test` green, collected count >= 134 + new tests.
- [ ] `npx tsc --noEmit -p supabase/functions/tsconfig.json` clean.
- [ ] `pnpm gate:function:changed` green (function logic changed: repository, discoverDeck, edge function).
- [ ] Report the exact command outputs (tail) back to the orchestrator. Do NOT update memory.md, errors_log.md, plan 47, or Open Brain: the orchestrator owns ledgers.

---

## Founder ops (documented, not executed here)

Boost remains fully disabled until ALL of these are done by the founder:
1. Apply `20260712000001_yearn_boost_integrity.sql` to the hosted project (removes the leak server-side even before the edge function exists).
2. Create an App Store Connect **In-App Purchase key**, set edge function secrets: `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY`, optional `YEARN_APPLE_BUNDLE_ID` / `YEARN_BOOST_PRODUCT_ID`.
3. `supabase functions deploy yearn-activate-boost` (keep gateway `verify_jwt` ON: do not add it to the `verify_jwt = false` list).
4. Only then wire StoreKit purchase UI (separate plan; not in this branch).

## Acceptance criteria

- No client-executable path grants a boost: `activate_boost(text)` dropped; `grant_boost` executable by service_role only; the edge function 503s without Apple credentials.
- A transaction id can be redeemed at most once ever; same-user retry idempotent; cross-user replay 409.
- Validation is server-side against the App Store Server API; nothing client-supplied is trusted except the transactionId used as a lookup key, and the id Apple echoes back must match it.
- All failure paths in the app surface honest copy; no fake success anywhere.
- Migration number 20260712000001 collides with nothing.
- All Task 5 gates green on `feature/yearn-boost-integrity`.

## Follow-ups (future StoreKit purchase UI plan)

Out of scope for this branch; the adversarial review that confirmed the leak is closed flagged these for the plan that wires the actual StoreKit purchase UI:

1. **Bind redemption to Apple's `appAccountToken`, not first-come.** Today `grant_boost` binds a transaction to whichever account first redeems it. If a `transactionId` leaks (logs, screenshots, a support ticket), anyone who submits it first wins the boost, and the paying user is locked out with no boost to show for their purchase. StoreKit lets the app set `appAccountToken` to the purchasing user's id at purchase time; the App Store Server API echoes it back in the transaction payload. The edge function should verify `appAccountToken` matches the caller's `sub` before granting, closing the theft-of-boost / griefing window instead of trusting "first redeemer wins."
2. **Constrain or flag Sandbox-environment grants once real purchases exist.** The `environment` column currently accepts `'Sandbox'` unconditionally, because Apple's App Review process purchases through Sandbox and that path must keep working pre-launch. Once real (Production) purchases are live, decide whether Sandbox grants should be rejected outright, capped, or simply kept visibly flagged in the ledger so a stray Sandbox credential (or reviewer test account) can't mint indefinite free boosts against production data.
