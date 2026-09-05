# Feature Spec: MyNews Phase 1, Publish + Read

> MyNews launch plan 35, Phase 1 of 8. The publishing spine and the reading loop: authors sign article revisions with device keys, a verify-then-insert edge function makes the server canonical but unable to forge, and both surfaces get the reader (Today feed, article page with revision history, journalist page) plus the composer. Suggestion submission and author review land server-side here too (their full desk UI is Phase 2). Founder mandate: build order only, no scope cuts.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. This plan pins contracts verbatim and specifies tasks at file level; tests are TDD-first per task.

**Goal:** A journalist can draft, sign, and publish an article; anyone can read it on iOS and web with its public revision history; suggestions can be submitted and author-accepted end to end at the API layer, all against a real (founder-provisioned) Supabase project, with every code path unit-verified before that project exists.

**Architecture:** Client-side Ed25519 signing (reused from `@mylife/sync`, tweetnacl) over deterministic canonical bytes; `mynews-publish`/`mynews-suggest`/`mynews-review` edge functions follow the BestChef dependency-injected handler pattern (unit-tested with fakes, no live project needed); the module exposes a narrow `MyNewsCloudPort` with an in-memory test adapter and a thin supabase adapter; apps consume it through an env-gated `MyNewsCloudProvider` (Manhattan P5 precedent) with honest not-configured states.

**Tech Stack:** @mylife/sync signing, @supabase/supabase-js (Expo app only), WebCrypto Ed25519 (Deno edge verify), Next.js 15 SSR + fetch-based PostgREST reads (no supabase-js on web), Vitest.

## Metadata

- **Surfaces:** `modules/mynews`, `supabase/functions/mynews-{publish,suggest,review}`, `apps/mynews`, `apps/mynews-web`, `scripts/check-mynews-parity.mjs`
- **Priority Score:** 44 / 50 (critical path of the program)
- **Depends On (hard):** plan 34 (done, this branch)
- **Depends On (soft):** live Supabase project for e2e (founder-ops; every path here is unit-verified without it)
- **Blocks:** Phase 2 editing desk UI, Phase 3 trust spine, Phase 4 payments
- **Honesty boundary:** publish controls render disabled with plain copy until `EXPO_PUBLIC_MYNEWS_SUPABASE_URL`/`_ANON_KEY`/`_FUNCTIONS_URL` (app) or `MYNEWS_SUPABASE_URL`/`MYNEWS_SUPABASE_ANON_KEY` (web, server-side) are configured AND reachable. Web routes 404 rather than render placeholder articles. No fabricated feeds.

---

## Pinned contracts (all tasks build against these)

### C1. Canonical bytes (signature payloads)

Deterministic JSON **arrays** (never objects: key order is unspecified), UTF-8 encoded. Domain strings are version-suffixed and unique per event kind.

```ts
export const REVISION_SIGNING_DOMAIN = 'mylife-mynews-article-rev-v1';
export const SUGGESTION_SIGNING_DOMAIN = 'mylife-mynews-suggestion-v1';

// Revision: [domain, articleId, rev, headline, dek ?? '', bodyMd,
//            changelogTriples, createdAt, signerPubkey]
// where changelogTriples = [[suggestionId, editorKey, type], ...] in array order.
export function canonicalRevisionBytes(rev: SignableRevision): Uint8Array;

// Suggestion: [domain, articleId, baseRev, type, diffJson, citations, rationale, editorPubkey]
// where diffJson = JSON.stringify of the StructuredDiff (its own field order is
// fixed by construction in engines/diff.ts) and citations is the string array.
export function canonicalSuggestionBytes(s: SignableSuggestion): Uint8Array;
```

A **shared vector fixture** `modules/mynews/src/signing/__fixtures__/signing-vectors.json` (committed, generated once by a module test helper, asserted stable by both the module suite and the edge-function suites) pins: input objects, canonical bytes as hex, a fixed test keypair (test-only, generated for the fixture), and valid signatures. The edge functions reimplement canonicalization in Deno-compatible TS; the fixture is the twin-parity guard (same pattern as the repo's web/native byte-parity tests).

### C2. Function envelopes

Reuse `supabase/functions/_shared/broker.ts` `envelopeOk`/`envelopeError`. Request bodies:

```ts
// POST mynews-publish
{ article: { id, slug, kind, authorPubkey }, revision: { articleId, rev, headline,
  dek?, bodyMd, changelog, createdAt, signerPubkey }, signatureHex }
// -> ok: { articleId, rev, slug } | error codes: 'bad-signature' | 'rev-conflict'
//    | 'bad-payload' | 'author-mismatch' | 'screen-hold'

// POST mynews-suggest
{ suggestion: { id, articleId, baseRev, type, diff, citations, rationale,
  editorPubkey, createdAt }, signatureHex }
// -> ok: { suggestionId } | 'bad-signature' | 'bad-payload' | 'citation-floor'
//    | 'cap-exceeded' | 'unknown-article'

// POST mynews-review  (author JWT required)
{ suggestionId, decision: 'accept' | 'reject' | 'partial',
  revision?: { ...same as publish revision... }, signatureHex? }
// accept/partial REQUIRE a new author-signed revision; the server never
// composes article text. -> ok: { suggestionId, decision, rev? }
//    | 'bad-signature' | 'not-author' | 'not-open' | 'bad-payload'
```

### C3. `MyNewsCloudPort` (module data layer)

```ts
export interface MyNewsCloudPort {
  getFeed(input: { followedPubkeys: string[]; beforePublishedAt?: string; limit?: number }): Promise<FeedItem[]>;
  getArticleBySlug(slug: string): Promise<ArticleView | null>;
  getJournalistByHandle(handle: string): Promise<JournalistView | null>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  callFunction<T>(name: 'mynews-publish' | 'mynews-suggest' | 'mynews-review', body: unknown): Promise<FunctionEnvelope<T>>;
}
```

Adapters: `InMemoryCloudAdapter` (tests; also backs deterministic UI states), `SupabaseCloudAdapter` (thin supabase-js mapping, Expo app), `postgrestFetchAdapter` (fetch-based read-only adapter for the web app's server components; no supabase-js dependency).

### C4. Identity custody (app side)

`ensureAuthorIdentity(store: SecureKVPort)`: loads or generates a device Ed25519 identity via `@mylife/sync` `generateDeviceIdentity`, persists private key ref in expo-secure-store, returns `{ pubkeyHex, sign(bytes) }`. One identity per device in P1 (multi-profile custody is a later phase; same boundary Meerkat uses).

---

## Tasks

### Task 1: signing module (`modules/mynews/src/signing/`)
- Create `signing/canonical.ts` (C1 builders + types), `signing/sign.ts` (`signRevision`, `signSuggestion`, `verifyRevisionSignature`, `verifySuggestionSignature` wrapping `@mylife/sync` `signMessage`/`verifySignature`), `signing/__fixtures__/signing-vectors.json`, tests.
- Add `@mylife/sync` to module devDependencies + peerDependencies.
- TDD: determinism (same input, same bytes), field-order independence proven by object-literal reordering, domain separation (revision bytes never verify as suggestion), tamper detection, fixture stability (regenerating vectors equals committed file).
- Commit: `feat(mynews): deterministic signing contract with shared vector fixture`.

### Task 2: drafts CRUD (`modules/mynews/src/data/drafts.ts`)
- Functions over the `@mylife/db` `DatabaseAdapter`: `listDrafts`, `getDraft`, `upsertDraft`, `deleteDraft`, `draftToSignableRevision(draft, articleId, rev, changelog, createdAt, signerPubkey)`.
- Tests run against a ~20-line better-sqlite3 `DatabaseAdapter` test shim + the plan-34 schema DDL.
- Commit: `feat(mynews): local drafts CRUD over the shared DatabaseAdapter`.

### Task 3: cloud port + adapters (`modules/mynews/src/data/cloud.ts`, `cloud-supabase.ts`, `cloud-postgrest.ts`)
- C3 port + view models (`FeedItem`, `ArticleView` incl. `revisionSummaries`, `JournalistView`, `SearchResult`, `FunctionEnvelope`).
- `InMemoryCloudAdapter` with seedable state.
- `SupabaseCloudAdapter(client, functionsUrl, fetchImpl)`: PostgREST query mapping; `callFunction` posts with the session bearer.
- `postgrestFetchAdapter(baseUrl, anonKey, fetchImpl)`: read-only (`getFeed` by pubkeys, `getArticleBySlug`, `getJournalistByHandle`, `search`), used by web server components; `callFunction` throws (web mutations come later with web auth).
- Tests: in-memory adapter contract suite + supabase/postgrest adapters against a recorded-fetch fake (assert exact URLs, headers, and row mapping).
- Commit: `feat(mynews): cloud port with in-memory, supabase, and postgrest-fetch adapters`.

### Task 4: publish orchestrator (`modules/mynews/src/data/publish.ts`)
- `publishDraft({ draft, identity, port, slugify, now })`: validate via Zod, build revision 1 (or head+1 for corrections), canonicalize, sign, envelope to `mynews-publish`, map error codes to typed results. Never mutates local state on failure.
- `slugify` (unicode-aware, lowercase, dash, 3-120 chars, deterministic suffix on collision input).
- TDD incl. the honest-failure paths (`rev-conflict`, `bad-signature` from a hostile port).
- Commit: `feat(mynews): client publish orchestrator (validate, sign, envelope, typed errors)`.

### Task 5: edge functions (`supabase/functions/mynews-publish|suggest|review/`)
- Each `index.ts` exports `handleX(req, deps)` with `deps = { env, store, verifyEd25519, now }` per the `bestchef-vision` pattern; Deno `serve` wiring at the bottom; canonicalization twin in `supabase/functions/_shared/mynews-signing.ts`.
- `store` is a narrow interface (`getArticleHead`, `insertArticleWithRevision`, `insertSuggestion`, `getSuggestion`, `getOpenSuggestionCount`, `recordDecision`, `insertCredibilityRow`); production adapter uses the service-role client; tests use an in-memory store.
- publish: payload Zod-parse, slug/id sanity, signature verify against `revision.signerPubkey`, `authorPubkey === signerPubkey`, rev must equal head+1 (or 1 with article insert), text publishes immediately (pre-publication screen holds media only, per plan 34 SQL), transactional insert.
- suggest: signature verify, citation floor (server twin of the SQL CHECK), open-cap via `openSuggestionCap` logic twin (level data from store), insert.
- review: JWT sub must map to the article author's profile (store lookup); accept/partial verifies the NEW author-signed revision (C1) then transactionally: revision insert + head bump + suggestion status + `nw_suggestion_events` + `nw_credibility_ledger` row (base points by type; diversity/standing from store aggregates).
- `modules/mynews/vitest.config.ts` gains `'../../supabase/functions/mynews-*/__tests__/**/*.test.ts'` in `include` (bestchef precedent). Vector-fixture parity test asserts `_shared/mynews-signing.ts` bytes === module fixture bytes.
- Commit per function.

### Task 6: Expo surfaces (`apps/mynews`)
- `app/(root)/data/launch-environment.ts` (`getMyNewsCloudConfig()`: EXPO_PUBLIC_MYNEWS_SUPABASE_URL, _SUPABASE_ANON_KEY, _FUNCTIONS_URL, ok/err result), `providers/MyNewsCloudProvider.tsx` (Manhattan shape: `isConfigured`, `port`), `providers/IdentityProvider.tsx` (C4 over expo-secure-store), `DatabaseProvider` (expo-sqlite + module migration V1).
- Screens: Today = real feed when configured (follows from `nw_follows`, chronological, pull-to-refresh) with the existing honest empty state when not; `article/[slug].tsx` reader (headline, byline chip, body as paragraph blocks, revision-history section, suggest-edit entry stub pointing at Phase 2); `journalist/[handle].tsx`; `compose.tsx` (draft editor over Task 2 CRUD, autosave, Publish button running Task 4, disabled + plain copy when unconfigured); Desk tab now lists local drafts.
- New deps: `@mylife/sync`, `@supabase/supabase-js` (installed by the lead before UI work).
- Tests: launch-environment parsing, provider gating (configured vs not), draft-screen data hooks against the in-memory port. UI smoke via typecheck + vitest logic tests (device QA is founder-ops).
- Commit: `feat(mynews): reader + composer on Expo behind the env-gated cloud provider`.

### Task 7: web surfaces (`apps/mynews-web`)
- `lib/cloud.ts` (server-only `getPort()` from `MYNEWS_SUPABASE_URL` + `MYNEWS_SUPABASE_ANON_KEY` via `postgrestFetchAdapter`; null when unconfigured), `/a/[slug]` SSR article page (generateMetadata OG tags, revision history, editor credits from changelog; `notFound()` when unconfigured or missing), `/j/[handle]` journalist page, `app/feed.xml/route.ts` RSS (latest 50 published), `app/sitemap.ts`.
- Home page gains latest-articles list when configured, keeps the honest line when not.
- Tests: RSS XML shape from the in-memory port, cloud lib env parsing, shell invariants extended.
- Commit: `feat(mynews): SSR article/journalist pages, RSS, sitemap on the public site`.

### Task 8: parity + gates close-out
- `scripts/check-mynews-parity.mjs`: add signing/, data/ files, the three functions, and the twin-signing file to the checklist.
- Full gates: module tests (now including function suites), app + web typechecks, web build, `check:parity`, `gate:function:changed`, `check:generated-artifacts`.
- Status Delta on this plan; move to `done/` when Tasks 1-8 are green; memory.md + errors_log + session log + Open Brain.

## Status Delta (2026-07-03, execution session)

Tasks 1-8 EXECUTED and green on `feature/mynews-p1` work within the `feature/mynews-p0-scaffold` branch (same worktree, commits following `589596f1`). Deviations, all verified:

1. **One fetch adapter instead of three (C3 simplification).** All P1 reads are public-anon PostgREST and function calls are plain POSTs, so `createMyNewsCloudAdapter` (pure fetch, injectable token provider) serves both surfaces; `SupabaseCloudAdapter` was never needed and supabase-js stayed out of the module AND both apps entirely. Auth sessions arrive with the review desk (Phase 2).
2. **RSC-safe subpath export.** The web build exposed that the module barrel transitively imports `@mylife/sync`'s React hooks, which breaks Next server components. Fix: `@mylife/mynews/cloud-fetch` subpath export (zero runtime imports, re-exports the view-model types); web server code imports only that. The web agent's interim webpack alias was removed. No `@mylife/sync` changes (no blast radius on Meerkat).
3. **Error codes extended:** functions return `no-profile` when a signer pubkey has no registered profile (publish/suggest), beyond the C2 list.
4. **`nw_editor_aggregates` P1 floor:** level caps served as 5/8 (reader/contributor) until the trust-spine phase materializes full editor stats; the throttle twin (`effectiveCap`) matches the module engine exactly and is parity-tested.
5. **Expo app carries no supabase-js and no @mylife/auth usage in P1** (signature-based publishing needs no session); identity custody is SecureStore-persisted key material per C4.

Verification at close: module suite 92 (incl. 22 edge-function tests, canonical-bytes twin parity, credibility twin parity, fixture-signature verification via WebCrypto against tweetnacl signatures); Expo app typecheck 0 + 37 tests; web typecheck 0 + 24 tests + production build 0 with runtime-verified honesty paths (unconfigured = 404/valid-empty-RSS, unreachable = 404 not 500); extended `check:mynews-parity`, full `check:parity`, `gate:function:changed`, `check:generated-artifacts` all exit 0. Remaining founder-ops: live Supabase project (`db push` both migrations, deploy 3 functions), then live e2e; plus everything from plan 34's list.

## Self-Review

- Contracts C1-C4 cover every cross-boundary surface; tasks reference them instead of restating.
- The author-signature invariant (server never composes text) is enforced in Task 5 review and stated in C2.
- Web keeps zero supabase-js and zero @mylife/ui (both documented hazards).
- Live-project e2e is explicitly founder-ops; nothing here fakes it.
