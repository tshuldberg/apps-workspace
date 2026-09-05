# BestChef S2: Provider Broker Scaffold + BYO Key Removal

Date: 2026-04-26

## Summary

Closed Slice S2 of the BestChef public-launch production plan
(BCSERVER-P0-05). The slice scaffolds the server provider broker that
will route Anthropic vision, USDA FDC nutrition, Open Food Facts, and
GS1 product-identity calls through Supabase Edge Functions, and removes
client-side BYO third-party API key entry from public-launch builds.

Public-launch builds now use a typed broker client that calls Supabase
Edge Functions via `supabase.functions.invoke`. The Edge Function
shells live under `supabase/functions/` and read provider credentials
from `Deno.env`. Internal-beta builds keep the BYO API key inputs
behind a `shouldAllowBestChefByoProviderKeys()` gate; public-launch
builds do not render those inputs.

The Edge Functions themselves are not deployed in this slice. They
have unit tests that mock upstream providers. Deployment with real
production credentials is a separate operations task documented below.

## Files Changed

### Module side

- `modules/bestchef/src/cloud/provider-broker.ts` (new) — typed broker
  client with `callVisionBroker`, `callNutritionBroker`,
  `callProductIdentityBroker`. All return a discriminated-union
  `BrokerResult<T>` with `errorKind: 'auth' | 'rate_limit' |
  'provider_outage' | 'invalid_input' | 'unknown'`. Routes through
  `supabase.functions.invoke`; no direct `fetch`.
- `modules/bestchef/src/cloud/__tests__/provider-broker.test.ts` (new)
  — 11 tests covering happy path, each error kind, redaction
  expectation propagation, and the no-`fetch` invariant.
- `modules/bestchef/src/pantry/food-recognition.ts` — added
  `identifyFoodViaBroker(supabase, ...)`. The legacy `identifyFood`
  (BYO key) stays for internal beta with an explicit comment marking
  it internal-beta only.
- `modules/bestchef/src/pantry/expiration.ts` — added
  `createBrokerExpirationOcrProvider(supabase)` factory that returns
  the existing `ExpirationOcrProvider` shape. BYO
  `createClaudeExpirationOcrProvider` retained for internal beta.
- `modules/bestchef/src/pantry/open-food-facts.ts` — added
  `createBrokerNutritionAdapter(supabase, source)` returning a
  `NutritionProviderAdapter` wired through the broker.
- `modules/bestchef/src/import/ai-recipe-extract.ts` — added
  `extractRecipeFromTextViaBroker`,
  `extractRecipeFromImageViaBroker`, and
  `createBrokerReceiptOcrProvider`. BYO callsites kept for internal
  beta with comments.
- `modules/bestchef/src/pantry/index.ts` and
  `modules/bestchef/src/import/index.ts` — re-export the new
  broker-aware functions.
- `modules/bestchef/src/index.ts` — re-export broker client + types,
  broker-aware factories.
- `modules/bestchef/vitest.config.ts` — `include` pattern now also
  picks up `../../supabase/functions/**/__tests__/**/*.test.ts` so the
  Edge Function tests run inside the bestchef package vitest.

### Edge Function side

- `supabase/functions/_shared/broker.ts` (new) — shared types
  (`BrokerEnvelope`, `BrokerErrorKind`), `envelopeOk` /
  `envelopeError` helpers, `createInMemoryRateLimiter`,
  `getUserIdFromAuth` (parses JWT `sub` without verifying the
  signature; gateway verifies in production), `redactPaymentText`,
  and `classifyUpstreamStatus`.
- `supabase/functions/bestchef-vision/index.ts` (new) —
  `handleVisionRequest` reads `ANTHROPIC_API_KEY` from `Deno.env`,
  forwards food/expiration/recipe/receipt prompts, redacts payment
  lines from receipt OCR responses, and translates upstream
  status codes into broker errors.
- `supabase/functions/bestchef-nutrition/index.ts` (new) —
  `handleNutritionRequest` routes to USDA FDC (paid key) or Open Food
  Facts (User-Agent only) and returns a normalized candidate list.
- `supabase/functions/bestchef-product-identity/index.ts` (new) —
  `handleProductIdentityRequest` resolves a barcode via OFF (keyless)
  or GS1 (paid). GS1 returns `not_configured` when credentials are
  absent without crashing.
- `supabase/functions/bestchef-vision/__tests__/index.test.ts`,
  `bestchef-nutrition/__tests__/index.test.ts`,
  `bestchef-product-identity/__tests__/index.test.ts` (new) — vitest
  unit tests with mocked `fetch` covering happy path, outage,
  redaction, rate-limit fail-closed, missing credentials, and auth
  rejection.
- `supabase/functions/tsconfig.json` (new) — minimal tsconfig so the
  TypeScript LSP can resolve imports without leaking these files into
  package builds.

### App side

- `apps/bestchef/app/(root)/data/launch-environment.ts` — added
  `getBestChefProviderBrokerPolicy`,
  `shouldUseBestChefProviderBroker`, and
  `shouldAllowBestChefByoProviderKeys`. Public-launch always uses
  the broker and disallows BYO keys. Internal beta defaults to
  allowing BYO and respects an explicit
  `EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS` override.
- `apps/bestchef/app/(root)/data/__tests__/launch-environment.test.ts`
  — extended with broker-policy coverage (public-launch forces broker,
  internal beta default + explicit overrides).
- `apps/bestchef/app/(root)/data/kitchen.ts` — `Create*Input` shapes
  now accept an optional `supabase` client. The receipt, food-photo,
  and expiration helpers prefer the broker path when `supabase` is
  provided and fall back to BYO only when explicitly allowed.
  `defaultNutritionProviders` returns broker-backed adapters when a
  `supabase` client is present.
- `apps/bestchef/app/(root)/kitchen-photo.tsx`,
  `expiration-photo.tsx`, `kitchen-receipt.tsx` — pull `supabase`
  from `useBestChefCloud()` and the BYO gate from
  `shouldAllowBestChefByoProviderKeys()`. BYO `TextInput`s render
  only in internal-beta builds, fronted by an "Internal beta only"
  badge. Public-launch builds route through the broker via
  `supabase`.
- `apps/bestchef/app/(root)/data/__tests__/no-provider-urls.test.ts`
  (new) — recursive scan asserts no `app/**.tsx` source file
  references `api.anthropic.com`, `api.openai.com`,
  `fdc.nal.usda.gov`, or `ANTHROPIC_API_KEY`.
- `apps/bestchef/app/(root)/data/__tests__/auth-links.function-gate.test.ts`
  — pre-existing flaky complexity-slope test; bumped sample sizes
  from `[2000, 4000, 8000]` to `[4000, 8000, 16000]` so per-sample
  medians clear the JIT/GC noise floor under concurrent vitest load
  (matches the 2026-04-26 cloud-submissions fix).

## Decisions

- **Broker as the single typed surface.** All four broker call sites
  (food, expiration, recipe, receipt) flow through one
  `callBroker<T>` that wraps `supabase.functions.invoke`. The
  discriminated-union result keeps every error path explicit. This
  avoids scattering retry/timeout/redaction logic across four module
  files.
- **Internal-beta BYO paths preserved.** Removing them entirely would
  break internal beta during the deployment gap. They are documented
  as "INTERNAL-BETA ONLY" and gated by
  `shouldAllowBestChefByoProviderKeys` in the app layer. Public
  launch builds set `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` (or
  `NODE_ENV=production`), which forces the broker path and hides
  every BYO `TextInput`.
- **Edge function handler split.** The Deno entry block is wrapped in
  `if (typeof Deno !== 'undefined' && Deno?.serve)` so vitest can
  import the handler as a pure function. All side-effecty deps
  (`env`, `fetch`, `now`, `rateLimit`) are passed as a `BrokerDeps`
  object, which is what the test stubs replace.
- **JWT validation is lightweight in scaffold.** The function only
  inspects the `sub` claim. Production deployments rely on the
  Supabase Edge Function gateway to verify the JWT before invocation
  (this is the standard Supabase model). The scaffold remains safe
  because no provider credentials are returned to the caller; the
  gateway-side verification is the production trust boundary.
- **Receipt redaction is server-side only.** The vision broker
  redacts payment lines from upstream Anthropic responses before
  returning them. This matches the existing
  `redactReceiptPaymentLines` posture in the module-side
  `receipt-import.ts` pipeline. The function does not log raw OCR.
- **No new migrations.** The slice does not require a broker-usage
  log table. Provider-usage logging belongs to a later observability
  slice (BCSERVER-P0-09).
- **Tests live next to functions, run via bestchef package.**
  `modules/bestchef/vitest.config.ts` was extended to include the
  function tests. This keeps `pnpm --filter @mylife/bestchef test`
  as the single entry point.

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck` — pass.
- `pnpm --filter @mylife/bestchef-app test` — 16 files / **106 tests
  pass** (was 103; +3 new broker policy + provider-URL scan tests).
- `pnpm --filter @mylife/bestchef-app test:uiux` — 24 tests pass.
- `pnpm --filter @mylife/bestchef typecheck` — pass.
- `pnpm --filter @mylife/bestchef test` — 53 files / **736 tests
  pass** (was 703; +33: 11 broker client + 22 Edge Function tests).
- `pnpm gate:function:changed` — pass (EXIT=0).
- `pnpm check:parity --quiet` — pass.
- `pnpm check:generated-artifacts` — pass.

## Open Items / Not in Scope This Slice

- **Production deployment.** The three Edge Functions are scaffold
  with tests; they are not yet deployed. Once the production Supabase
  project exists (BCSERVER-P0-02) and provider credentials are issued
  (BCSERVER-P0-05 external dependencies), an operator can run:

  ```bash
  supabase functions deploy bestchef-vision \
    --project-ref <prod-ref>
  supabase functions deploy bestchef-nutrition \
    --project-ref <prod-ref>
  supabase functions deploy bestchef-product-identity \
    --project-ref <prod-ref>

  supabase secrets set --project-ref <prod-ref> \
    ANTHROPIC_API_KEY=<...> \
    USDA_FDC_API_KEY=<...> \
    OPEN_FOOD_FACTS_USER_AGENT='BestChef/1.0 (production)' \
    GS1_CLIENT_ID=<...> \
    GS1_CLIENT_SECRET=<...> \
    GS1_ENDPOINT=<...>
  ```

- **Persistent rate limiter.** The current limiter is in-memory per
  function instance. Production should switch to a Postgres-backed
  rate-limit table or upstash so the limit holds across invocations.
- **Provider-usage logging.** Belongs to BCSERVER-P0-09 (observability).
- **Mission control evidence row.** The
  `bestchef-server-launch-mission-control.md` file is currently
  untracked (a parallel session created it). This session log is the
  primary evidence; an evidence row under BCSERVER-P0-05 should be
  folded in by whichever session next owns the mission control file.

## Next Slice Suggestion

S3 (media upload pipeline + Storage buckets) is the next-highest
leverage slice that does not need production credentials: signed
upload Edge Function, app upload queue, public-feed HTTPS gating, and
deletion propagation. After that, S4 (Apple Sign-In) once the Apple
Developer credentials exist.
