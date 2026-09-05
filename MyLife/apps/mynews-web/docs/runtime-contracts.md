# mynews-web runtime contracts

Preserved from `MyLife/apps/mynews-web/CLAUDE.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## Environment (server-side only)

- `MYNEWS_SUPABASE_URL` -- Supabase project base (https required). Trimmed, trailing slash stripped.
- `MYNEWS_SUPABASE_ANON_KEY` -- anon key for PostgREST reads.
- `MYNEWS_PUBLIC_ORIGIN` -- absolute origin for RSS/sitemap/OG URLs. Defaults to `https://mynews.app` (placeholder, pending a domain decision).
- `MYNEWS_FUNCTIONS_URL` -- optional edge-functions origin override. Unset means the adapter default `${MYNEWS_SUPABASE_URL}/functions/v1`, which `resolveFunctionsUrl` models exactly.
- `MYNEWS_PAYMENTS_ENABLED` / `MYNEWS_PAYMENTS_PROVIDER` -- support-rail flags. Only `enabled = true` + `provider = stripe` + a configured cloud makes the `payments` capability true.
- `MYNEWS_LEGAL_EMAIL` / `MYNEWS_SAFETY_EMAIL` / `MYNEWS_DMCA_EMAIL` -- published contact channels. All three must be controlled, non-placeholder addresses before `emailContact` is true; unset falls back to the module's `@mynews.app` constants, which are deliberately classified as uncontrolled.
- `MYNEWS_WEB_REPORTING_ENABLED` -- web reporting flag (needs the cloud too). **Fail-closed: unset means the report card renders honest "use the app" copy instead of a form.** Set it to `true` to switch on the reader sign-in + report path.
- `MYNEWS_DMCA_RATE_SALT` -- signing salt for the DMCA IP rate key (`app/api/dmca/route.ts` fails closed without it).

When URL + anon key are missing/blank/non-https, `isCloudConfigured()` is false and every loader returns `unconfigured`. Never a placeholder, never a 500.

Plan 48 WP10 split what used to be one `null`. Loaders return a `LoadResult` (`lib/load-result.ts`) with four states, because "no such article" and "we could not read the article" need different answers: a 404 tells a crawler the URL is gone, and repeating it through an outage window is how a live article silently leaves the index.

| State | Cause | Pages | Route handlers |
|---|---|---|---|
| `ok` | read succeeded | render | 200 |
| `missing` | backend answered, no such row | `notFound()` | 200 |
| `unconfigured` | no cloud on this deployment | `notFound()` | 200 (valid + empty) |
| `outage` | unreachable, timed out, or errored | `<OutageNotice>` + `robots: noindex` | **503 + `Retry-After`** |

An App Router page cannot set an HTTP status (Next exposes `notFound()` and `redirect()` and nothing for 5xx), so a page-level outage carries its crawler contract through `outageMetadata()` instead: `noindex, nofollow` plus the `no-store` that dynamic pages already send. Do not "fix" this by calling `notFound()` on an outage. The routes that CAN set a status (`/feed.xml`, `/sitemap.xml`, `/api/*`) return a real 503.

Partial degradation is deliberate and differs per surface. On `/a/[slug]` a failed suggestions read omits the marginalia card (a confident "0 open suggestions" would be a false claim), while the article still renders. On `/a/[slug]/suggestions` the same failure IS the page, so it renders the outage notice.


## Capability-keyed copy (Critical)

The site must never publish a claim this deployment cannot back. `lib/capabilities.ts` maps the server env onto the module's `detectMyNewsCapabilities` (one source of the semantics: affirmative only, placeholders stay off) and `buildWebLegalContext` assembles the legal bundle PER REQUEST via `createLegalContent`.

- Never import the frozen `TERMS_OF_SERVICE` / `PRIVACY_POLICY` / `COMMUNITY_GUIDELINES` constants into a page. They represent an unconfigured build; use `readWebLegalContext().legal.*` so the document matches the deployment. `/legal`, `/legal/terms`, `/legal/privacy`, `/legal/guidelines`, and `/account/delete` are `force-dynamic` for this reason.
- The 2% platform-fee claim renders only when `capabilities.payments` is true, and the DSA/contact addresses only when `capabilities.emailContact` is true (otherwise the page says no channel is configured and points at the in-app report tool and the DMCA page).
- `subscriptions` is always false here: purchases happen in the app through the device store, and the website has no checkout.
- `test/product-copy.test.ts` scans `app/` and `lib/` (comments stripped, so JSX text is covered) and fails on staged-delivery markers (`Phase <digit>`, "coming soon") or a fee claim in a file that does not derive from the capability system. Fix the copy; do not add an exception.


## Data access (`lib/`)

- `lib/env.ts` -- pure `parseCloudEnv` + `readCloudEnv`/`isCloudConfigured`.
- `lib/capabilities.ts` -- `resolveFunctionsUrl`, `readLegalContacts`, `detectWebCapabilities`, `buildWebLegalContext` (pure, env passed in) and `readWebLegalContext()` (reads `process.env`). Imports runtime values only from `@mylife/mynews/cloud-fetch`.
- `lib/cloud.ts` -- `import 'server-only'`. `getPort()` (via `@mylife/mynews` `createMyNewsCloudAdapter`, with a bounded fetch injected) and React-`cache`d `loadArticle`/`loadJournalist`/`loadLatest`/`loadSuggestions`/`loadSuggestionEvents`/`loadEditorProfile`, each returning a `LoadResult`. Importing this from a client component now fails the build rather than relying on reviewer discipline (plan 48 WP10 added the `server-only` dependency; the previous "keep the discipline" note is superseded).
- `lib/latest-fetch.ts` -- `fetchLatest`, the direct site-wide PostgREST read. It lives outside `lib/cloud.ts` **specifically so a test can import it**: `server-only` throws outside a server bundle by design, so a module that carries it is untestable. Any new pure logic worth testing belongs here or in another plain module, not in the loader layer.
- `lib/load-result.ts` -- pure. The four-state `LoadResult`, `pageDisposition`, and `feedStatus`. See the table above.
- `lib/http.ts` -- pure. `createBoundedFetch(timeoutMs)` plus the three deadlines: `CLOUD_READ_TIMEOUT_MS` (4s, an SSR reader is waiting), `CLOUD_WRITE_TIMEOUT_MS` (10s, the caller submitted work they would rather not retype), `AUTH_TIMEOUT_MS` (8s). A caller signal is combined with the deadline, never replaced. **Every outbound fetch must go through it**: an unbounded read holds a render open long enough to exhaust server concurrency, which turns a degraded dependency into a full outage.
- `lib/reader-auth.ts` -- `import 'server-only'`. Cookie-session Supabase client and the memoized `readReaderSession()`. See "Reader sign-in".
- `lib/report-context.ts` -- `import 'server-only'`. The two per-request facts the report card needs (`signedIn`, `reportingEnabled`), so no page can render a report form on a deployment where reporting is off.
- `lib/otp-flow.ts` -- pure. The sign-in state machine (see below).
- `lib/next-path.ts` -- pure. `safeNextPath()`, the open-redirect guard for `?next=`.
- `lib/security-headers.ts` -- pure. `buildCsp()`, `staticSecurityHeaders()`, `createNonce()`. See "Security headers".
- `lib/editing.ts` -- pure editing-desk view builders: `buildImprovedBy` (revision changelog aggregation), `buildMarginalia` (open + cited-correction counts), `diffToBlocks` (del/add render blocks), `describeEvent` (thread lines), `buildEditorBreakdown` (credibility math through `@mylife/mynews/engines`, parity-tested against the module engine).
- `lib/queries.ts`, `lib/rss.ts`, `lib/sitemap-entries.ts`, `lib/format.ts`, `lib/origin.ts` -- pure, unit-testable helpers with no runtime package imports.


## Reader sign-in and web reporting (plan 48 WP10, finding C10)

Reporting needs an authenticated account: `mynews-report` runs with `verify_jwt` on and the WP1 intake RPC attributes each report to a profile, which is what the per-reporter throttle, the open-report dedupe, and severity escalation act on. The site had no way to produce a session, so the report form could only ever render "not signed in".

Readers now sign in with Supabase email OTP against the **same auth project the app uses**, so there is no second identity and no second account system.

- **Sign-in happens inside the report card**, not on a login page and not by sending the reader to the app. A reader who has picked a reason and typed two sentences of detail must not lose either to authenticate: the OTP posts with `fetch`, nothing navigates, the reason and detail stay in component state, and a successful verify submits the report immediately. Do not replace this with a redirect.
- `shouldCreateUser: false`. The website never creates accounts. A profile row comes from app onboarding, and an auth-only user minted here would authenticate and then fail with `no-profile`, which reads as a broken site rather than "sign up in the app".
- `/api/auth/otp` returns `{ ok: true }` whether or not the address exists, with a ~700ms latency floor, so neither the body nor the timing is an account-existence oracle. Real failures are logged server-side. Do not add a "no such user" response.
- `scope: 'local'` on sign-out. The project is shared with the app; signing out of the website must never revoke the reader's session on their phone.
- **The JWT never reaches JavaScript.** `/api/report` reads the token from the cookie session server-side, after `getUser()` has verified it, so an XSS foothold cannot exfiltrate it and the site does not trust a bearer the caller supplied.
- `readReaderSession()` short-circuits on a missing `sb-` cookie before touching the network, so anonymous readers pay nothing. It is `cache()`d because the layout and the page both ask.
- `middleware.ts` refreshes the session, and only for requests that carry an `sb-` cookie. Without it a Server Component cannot write a rotated cookie, so a signed-in reader would appear signed out mid-report the moment their token aged out.
- The **DMCA form stays anonymous** through the signed-IP BFF path in `app/api/dmca/route.ts`. Its rate identity is separate by design (a copyright claimant has no account). Do not route it through reader auth.
- `lib/otp-flow.ts` holds the whole flow as a pure reducer so the invariants are tested rather than clicked: no second request while one is in flight, no code submitted for an address it was not sent to, and no state that claims a session the server never granted.


## Security headers (plan 48 WP10)

- `next.config.ts` sets every path-independent header on `/:path*` from `staticSecurityHeaders()`: nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, a deny-everything `Permissions-Policy`, `X-Frame-Options: DENY`, COOP, CORP, DNS-prefetch off, and HSTS **in production only** (sending it from `next dev` would pin localhost to https for two years). Plus `poweredByHeader: false` and `outputFileTracingRoot` (without which Next infers a tracing root from the nearest lockfile, which in this checkout resolves to the home directory).
- `middleware.ts` sets the **only** `Content-Security-Policy` header, because it carries a per-response nonce. Two CSP headers are intersected by the browser rather than merged, so `next.config.ts` deliberately sets none. The nonce goes on both the request and the response: Next reads the request's CSP to stamp the nonce onto its script tags.
- **Every page is `force-dynamic`, and that is a CSP requirement, not a preference.** Next can only stamp the nonce while rendering; a prerendered route's scripts were emitted at build time without one, so under this CSP the browser blocks them and the page never hydrates. On `/legal/dmca` that would silently break the notice form. `app/not-found.tsx` uses `await connection()` because a route-segment config export is not honoured there. `test/shell.test.ts` enforces this for every page.
- `script-src` is nonce + `strict-dynamic`. `style-src` carries `unsafe-inline` and **no nonce**: React writes `style` attributes, and a nonce in `style-src` makes CSP3 browsers drop `unsafe-inline` and break every inline style.
- `test/security-headers.test.ts` pins the exact header set and CSP directives, so weakening the policy has to be a deliberate edit to that file.


## Cache and revalidation policy

- Every page: `force-dynamic`. Required by the CSP nonce (above), and independently correct: the report card reflects this reader's session, and revision histories and suggestion counts change whenever an editor's work is accepted. Next serves dynamic pages `no-store`, which is also what keeps an outage response out of a CDN.
- `/feed.xml`: `s-maxage=300, stale-while-revalidate=600` on success, `no-store` on a 503.
- `/sitemap.xml`: dynamic and uncached. A sitemap is a claim about which URLs exist; a cached one served during an outage would read as URLs having been withdrawn.
- `/api/*`: `no-store` throughout.


## Hard rules

- Do NOT import `@mylife/ui` here (react-native-web barrel hazard); this app is plain React + CSS.
- Data reads stay on the fetch-based PostgREST path. `@supabase/ssr` is present for the **auth session only**, server-side only, and only in `lib/reader-auth.ts` and `middleware.ts`; a `test/shell.test.ts` guard fails on any other importer and on a direct `@supabase/supabase-js` import anywhere.
- Every server-side fetch goes through `createBoundedFetch`.
- Honesty rule: 404 over placeholder content; nothing simulated as live; no fabricated feeds. An outage is never reported as a 404 or as an empty result.
- Accessibility: real `<a>`/`<button>`/`<label>` elements so the site works without JavaScript and tab order follows the document; a skip link is the first focusable element; one `:focus-visible` outline treatment for everything; font sizes in `rem` off a `100%` root so a raised browser default actually scales the text.
- Design: Obsidian Noir base, accent `#8BCFF0`, neutral chrome rule (the site's own voice never takes sides).


## Build note: import from `@mylife/mynews/cloud-fetch` and `@mylife/mynews/engines`

Runtime values in web server code must come from the `@mylife/mynews/cloud-fetch` subpath export (adapter, row mappers, and re-exported view-model types; the file has zero runtime imports) or the `@mylife/mynews/engines` subpath (pure diff/credibility/dupes engines + type-only model shapes). The package barrel re-exports the signing module, which imports `@mylife/sync`, whose Node/web entry re-exports React client hooks; pulling the barrel into a Server Component fails `next build`. Type-only barrel imports remain fine anywhere (erased before bundling). A shell test guards the engines subpath import graph.

### No reader-verification badge on the web article page yet (plan 48 WP6)

The reader-side authorship verifier ships in the module (`signing/reader-verify.ts`) and is rendered in the Expo app's revision history, but NOT on the web article page. That is a deliberate stop, not an oversight.

Verification needs Ed25519 signature checking, which reaches `@mylife/sync` and therefore the barrel, and the article page is a Server Component. The available workarounds are all worse than waiting: re-exporting the verifier through `engines` would drag `@mylife/sync` into the RSC-safe subpath and break the guard above for every consumer; a `'use client'` island would ship tweetnacl to every article reader for a badge; and doing the verification server-side would make the badge an assertion BY the server about itself, which is precisely the thing the verifier exists to avoid trusting.

So the web surface currently renders the revision history without a verification badge, and claims nothing about verification. Do NOT add a badge that is computed server-side or that reads a stored verdict: a badge whose trust root is the server is worse than no badge, because it looks like independent verification and is not. The honest fix is a small standalone verify bundle (Ed25519 verify plus the canonical byte builders, no `@mylife/sync`) that a client island can load; that is follow-up work, not a hack to bolt on here.
