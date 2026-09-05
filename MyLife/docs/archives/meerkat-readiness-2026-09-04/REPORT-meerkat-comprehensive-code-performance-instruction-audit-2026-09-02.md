---
header-includes: |
  <style>
    :root {
      color-scheme: light;
    }

    html,
    body {
      min-height: 100%;
      margin: 0;
      background: #ffffff;
    }

    body {
      box-sizing: border-box;
      width: 100%;
      max-width: none;
      min-height: 100vh;
      padding: clamp(20px, 3vw, 56px);
      color: #17201b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.55;
      hyphens: none;
    }

    #title-block-header {
      display: none;
    }

    h1,
    h2,
    h3,
    h4 {
      line-height: 1.15;
      text-wrap: balance;
    }

    table {
      display: table;
      width: 100%;
      overflow: visible;
    }

    th,
    td {
      padding: 0.55rem 0.7rem;
      vertical-align: top;
    }

    code {
      overflow-wrap: anywhere;
    }

    @media (max-width: 720px) {
      body {
        padding: 16px;
      }

      table {
        display: block;
        overflow-x: auto;
      }
    }

    @media print {
      body {
        padding: 0;
      }
    }
  </style>
---

# Meerkat Comprehensive Code, Performance, Security, and Instruction Audit

**Audit date:** 2026-09-02<br>
**Original code baseline:** `518bab5a` plus the non-product documentation changes listed in this report<br>
**Remediation implementation:** `a3152851`<br>
**Audited surfaces:** Meerkat Expo app, shared `@mylife/sync`, Meerkat relay, mobile/web parity locks, dependency graph, production bundles, root and app `AGENTS.md` / `CLAUDE.md` instruction chain<br>
**Original auditor mode:** Evidence-first, report-only.<br>
**Remediation update:** 2026-09-02. The primary local fixes and low-risk fixes were implemented and reverified after the original audit.

## Executive verdict

Meerkat has an unusually strong automated correctness and cryptographic-invariant baseline, but it is not optimization-complete or release-signoff-ready.

| Area | Verdict | Evidence |
|---|---|---|
| Functional correctness | Pass | 7,330 tests passed across mobile, web, sync, and relay; 192 provider/configuration-dependent tests were skipped |
| Type safety | Pass | Strict TypeScript check passed; no runtime explicit `any`, `@ts-ignore`, or `@ts-expect-error` found |
| Security invariants | Pass with one unpatched dependency exception | Transport negative controls, parity, account isolation, signature, fail-closed, and crypto suites passed; only two `image-size` advisories remain and npm has no fixed release |
| Runtime performance | Primary optimization passed on host | Feed path now uses 7 queries and takes 693.86 ms median at 320 posts, down from 1,286 queries and 1,995.45 ms |
| Bundle efficiency | Needs optimization | Android Hermes bytecode is 15.34 MB decimal; LiveKit, Lucide, RevenueCat mappings, and LiveKit React sources are 21.97% of source-map source bytes |
| Native dependency health | Pass | Expo Doctor now passes 17 of 17 checks after peer-context deduplication |
| Production integration evidence | Incomplete | 189 relay tests and 3 sync tests were skipped; live PostgreSQL, object-store, provider, and physical-device proof was not available |
| Instruction quality | Improved | Security and honesty boundaries remain; over-broad scope, parity, artifact, commit, team, design-doc, and human-instruction rules were narrowed |

**Release position:** do not treat this audit as a production sign-off. The primary local performance and native-dependency failures are fixed, but live provider and physical-device evidence, bundle work, schema cleanup, and the unpatched `image-size` advisories remain.

## Finding register

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | High | Feed read model performs query-amplified work and repeated cryptographic verification | Resolved in code; physical-device trace pending |
| F-02 | High | Production dependency graph contains 13 advisory records, including 8 high-severity records | Mitigated: 11 records removed; 2 `image-size` records have no fixed release |
| F-03 | High | Expo Doctor detects duplicate `expo@54.0.37` native installations with different peer identities | Resolved |
| F-04 | High assurance gap | Live relay, PostgreSQL, object-store, provider, and physical-device evidence was unavailable | Open |
| F-05 | Medium | Production bundle has large, concentrated dependency contributors and duplicate LiveKit formats | Open |
| F-06 | Medium | Idempotent schema DDL runs repeatedly in normal DM read/write paths | Open |
| F-07 | Medium | Mobile/web parity is enforced through 49 duplicated core pairs totaling 39,902 lines | Open |
| F-08 | Medium | Several files combine too many responsibilities and are costly to review safely | Open |
| F-09 | Medium | New Architecture documentation contradicts the actual SDK 54 configuration | Resolved |
| F-10 | Medium/Low | Nine lint warnings include two fragile dependency omissions and avoidable render churn | Resolved |
| F-11 | Low | Non-secret protocol identifiers and conflict nonces use `Math.random()` | Resolved |
| F-12 | Medium developer-experience issue | Workspace `pnpm audit`, `pnpm why`, and infinite-depth listing exhaust 4 to 8 GB heaps | Open |

No critical code defect was demonstrated by this audit.

## Remediation update

### Feed read model

The production implementation now loads post types in a bounded batch, loads community safety state once, verifies each channel event set once per feed evaluation, and reuses the resolved messages for unread, post, reaction, and file projections. It does not cache verification across calls, so changed signed bytes or safety state cannot reuse a stale acceptance.

The repeatable harness is `apps/meerkat/scripts/benchmark-feed-read-model.ts`. It uses real signed Meerkat events, the production functions, an in-memory `better-sqlite3` adapter, 3 warmups, and 9 measured runs.

| Posts, N | Before feed queries | After feed queries | Before median | After median | Before p95 | After p95 |
|---:|---:|---:|---:|---:|---:|---:|
| 20 | 86 | 7 | 122.92 ms | 43.30 ms | 124.09 ms | 43.61 ms |
| 80 | 326 | 7 | 492.46 ms | 172.52 ms | 497.53 ms | 175.66 ms |
| 320 | 1,286 | 7 | 1,995.45 ms | 693.86 ms | 2,022.05 ms | 701.25 ms |

At `N = 320`:

```text
Query reduction  = 1 - (7 / 1,286) = 99.4557%
Time saved       = 1,995.4499 - 693.8620 = 1,301.5879 ms
Speedup          = 1,995.4499 / 693.8620 = 2.8759x
Median reduction = 65.2278%
p95 reduction    = 65.3199%
```

Post-card reads fell from 321 to 2 at 320 posts, a 99.3769% reduction. Reaction reads fell from 641 to 2 at 320 active reactions, a 99.6880% reduction. Their latency remains dominated by required signature verification, which is intentionally preserved.

### Dependencies and Expo health

Compatible overrides moved the audited vulnerable packages to `nanoid 3.3.18`, `decode-uri-component 0.5.0`, `brace-expansion 1.1.18/5.0.9`, `js-yaml 4.3.2`, `browserslist 4.28.8`, `undici 6.28.0/7.29.0`, and `@xmldom/xmldom 0.8.15`. A fresh npm advisory query reports only the two `image-size` records from the original audit. `image-size 1.2.1` remains reachable through Expo tooling; both its installed version and npm's latest `2.0.2` remain vulnerable, so no safe package upgrade currently exists.

Pinning the SDK-compatible `react-native-webview 13.15.0` peer context removed the duplicate Expo installation from the Meerkat graph. Expo Doctor now passes all 17 checks.

### Low-risk cleanup and instruction quality

- All nine mobile warnings and three web warnings were fixed, including explicit membership and sync-engine hook dependencies. Both Meerkat surfaces now lint cleanly.
- Non-secret protocol IDs and canvas conflict nonces now use the configured `@mylife/sync` pseudorandom source. The bounded integer helper uses rejection sampling, avoiding modulo bias.
- Root `AGENTS.md` now scopes completeness, parity, session artifacts, report generation, commits, and human instructions to the work that actually needs them.
- Root `CLAUDE.md` now makes gates proportional, serializes overlapping agent work, limits design-doc ceremony to durable behavior changes, and makes Open Brain optional and non-blocking.
- Meerkat `AGENTS.md` now states the actual SDK 54 legacy-architecture pin and describes scheduled background sync as implemented but disabled pending release validation.

## F-01: feed read-model amplification

### Evidence

The benchmark exercised the real production functions against an in-memory `better-sqlite3` database populated with real signed Meerkat events. Each size used 3 warmups and 9 measured repetitions. The benchmark wrapper counted adapter queries and executions. Host: Apple M4 Pro, 14 logical cores, 48 GiB RAM, macOS 26.3, Node 22.22.0, pnpm 9.15.4.

| Posts, N | `listChannelPostCards` queries | Median | p95 | `evaluateLocalFeed` queries | Median | p95 | Batched prototype queries | Median | p95 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 21 | 40.98 ms | 41.18 ms | 86 | 122.92 ms | 124.09 ms | 3 | 40.73 ms | 41.68 ms |
| 80 | 81 | 163.09 ms | 164.24 ms | 326 | 492.46 ms | 497.53 ms | 3 | 162.82 ms | 165.51 ms |
| 320 | 321 | 658.75 ms | 665.97 ms | 1,286 | 1,995.45 ms | 2,022.05 ms | 3 | 666.20 ms | 676.61 ms |

Measured query equations on the post-only, no-reaction, empty-safety fixture:

```text
listChannelPostCards queries = N + 1
evaluateLocalFeed queries     = 4N + 6
batched prototype queries     = 3
```

At `N = 320`:

```text
Query reduction = 1 - (3 / 1,286) = 99.7667%
Time saved      = 1,995.4499 - 666.2029 = 1,329.2470 ms
Speedup         = 1,995.4499 / 666.2029 = 2.9953x
Median reduction = 66.614%
```

The measured scaling exponents, using `alpha = ln(t320 / t20) / ln(320 / 20)`, were 1.002 for post cards, 1.005 for the feed, and 1.008 for the batched prototype. All remain linear because every signed event is still verified. Batching removes the database multiplier, not the required cryptographic work.

Reaction aggregation separately measured:

| Active reactions, N | Queries | Median | p95 |
|---:|---:|---:|---:|
| 20 | 41 | 44.21 ms | 44.83 ms |
| 80 | 161 | 169.81 ms | 170.33 ms |
| 320 | 641 | 674.12 ms | 684.89 ms |

The reaction equation is `2N + 1`; the endpoint slope was approximately 2.10 ms per additional reaction. The two per-reaction safety queries are visible in `reactionHiddenBySafety`. Signature verification remains the larger irreducible cost unless verified immutable rows are cached safely.

### Root causes

- `listChannelPostCards` calls `postTypeForRoot` once per root, even though `cm_posts.id` is indexed as a primary key.
- `listChannelReactions` calls two safety lookups for each active reaction.
- `evaluateLocalFeed` loads and verifies channel messages, then invokes post-card, reaction, unread, mute, and safety helpers that repeat reads or verification.
- The functions are also maintained as mobile/web twins, so a fix must be applied twice or extracted.

### Required optimization

1. Load post metadata for all root IDs in one bounded `IN` query or join.
2. Load blocked-member and hidden-report sets once per community/channel evaluation.
3. Build one verified channel read model and pass it to feed, post-card, unread, and reaction projections.
4. Cache verification only by immutable signed-row identity plus signature/payload digest. Any row mutation, different signature, revocation-policy change, or safety-policy revision must invalidate or bypass the cache.
5. Preserve the current fail-closed behavior and byte-identical mobile/web semantics.

### Acceptance criteria

- Query count is constant in post/reaction count for one channel projection, with a target of no more than 8 adapter queries.
- The same `N = 320` harness reduces median feed time by at least 50% and p95 below 1 second on this host.
- A physical mid-range Android device trace proves that opening and scrolling the populated feed does not block the JavaScript thread for a visible interval.
- Adversarial tests prove that cached verification never accepts changed bytes, a changed signature, a revoked identity, or newly hidden content.

## F-02: dependency advisories

The normal workspace command `pnpm audit --prod --audit-level high` exhausted Node's default 4 GB heap and an 8 GB retry. To avoid reporting an unknown result, the audit created an isolated production deployment, enumerated physical package manifests, submitted 813 unique packages and 913 package versions to npm's bulk advisory endpoint, and traversed the pnpm lockfile to establish reachability from `apps/meerkat`.

| Package | Installed | Advisory records | Severity | Reachability | Bundled in native JS |
|---|---:|---:|---|---|---|
| `nanoid` | 3.3.16 | 1 | High | `expo-router` | Yes, non-secure build |
| `decode-uri-component` | 0.2.2 | 1 | Moderate | `expo-router > query-string` | Yes |
| `brace-expansion` | 1.1.17, 5.0.8 | 2 | High | React Native glob and Expo CLI minimatch | No |
| `js-yaml` | 4.3.0 | 1 | High | Expo CLI > xcpretty | No |
| `browserslist` | 4.28.1 | 2 | High | Expo metro config | No |
| `image-size` | 1.2.1 | 2 | High | Expo metro | No |
| `undici` | 6.27.0 | 3 | Moderate | Expo CLI | No |
| `@xmldom/xmldom` | 0.8.13 | 1 | Moderate | MapLibre > Expo config plugins > plist | No |

Totals: 13 advisory records across 8 package names, consisting of 8 high and 5 moderate records. No critical advisory was returned.

The runtime bundle contains only the two Expo Router transitives from this set. The other six package names are production-dependency reachable because Expo ships CLI/build dependencies, but they were absent from the generated native JavaScript source map. This lowers mobile runtime exploitability but does not make the build chain clean.

Relevant advisories: [nanoid GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [decode-uri-component GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [brace-expansion GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [js-yaml GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [Browserslist GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [Browserslist GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g), [image-size GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [image-size GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), and the three Undici records [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524), [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5), [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm).

**Remediation:** upgrade within the Expo-supported dependency matrix, then rerun Expo Doctor, the bulk scan, native exports, all test suites, and a clean native build. Do not force arbitrary transitive versions past Expo peer constraints.

## F-03: duplicate Expo native module

`pnpm dlx expo-doctor@latest . --verbose` passed 17 of 18 checks and failed the duplicate dependency check. It found two `expo@54.0.37` installations that resolve through different pnpm peer identities. The version is the same, but the physical installations are not the same target.

One path is the app's direct Expo installation. The other is reached through `@expo/metro-runtime@6.1.2`. Expo Doctor warns that native builds should contain only one installation of a native module.

**Impact:** clean native builds can behave differently from Metro export, and duplicate native module resolution can produce build failures or runtime registration problems.

**Remediation:** reproduce from a clean workspace install, inspect the two peer suffixes, align the root override and Expo/Router peer graph, deduplicate, rerun Expo Doctor, and prove clean iOS and Android builds. Do not delete the lockfile as a first response in this shared monorepo.

## F-04: production proof gap

The relay suite passed 1,653 tests but skipped 189. The sync suite passed 2,624 and skipped 3. The relay skips are primarily explicit live PostgreSQL, destructive migration, MinIO/S3, running-service authority, and optional LiveKit checks. They are correctly guarded rather than faked.

This audit did not have:

- A disposable `meerkat_ci` or `meerkat_test` PostgreSQL instance with destructive-test opt-in.
- A live MinIO/S3 test endpoint.
- Live hosted/account/public/community provider credentials.
- Two physical devices for LAN, Nearby, BLE wake, WebRTC, background scheduling, push wake, or keychain lifecycle proof.
- Store/provider and EAS release evidence.

The absence is an assurance gap, not a demonstrated code bug. It prevents a complete production claim.

## F-05: bundle and startup pressure

The audit generated fresh production exports rather than estimating from imports.

| Artifact | Android | iOS |
|---|---:|---:|
| Hermes bytecode | 15,338,903 B, 14.63 MiB | 15,341,985 B, 14.63 MiB |
| gzip level 9 | 6,083,091 B, 5.80 MiB | 6,089,904 B, 5.81 MiB |
| Brotli quality 5 | 5,308,996 B, 5.06 MiB | 5,319,725 B, 5.07 MiB |
| Modules | 4,199 | 4,203 |

The Android Brotli transfer is 65.39% smaller than uncompressed bytecode. One update to 10,000 devices would transfer approximately 49.44 GiB of bytecode before changed assets and protocol overhead. This is a capacity illustration, not a claim about current monthly active users.

The no-bytecode Android export produced 10,316,611 B of minified JavaScript and 2,316,645 B gzip, a 77.54% reduction. Its source map contained 4,208 sources and 18,275,362 source-content bytes.

| Source group | Source bytes | Modules | Share of mapped source bytes |
|---|---:|---:|---:|
| App code | 3,686,581 | 289 | 20.17% |
| Workspace packages | 2,858,783 | 284 | 15.64% |
| React Native | 2,320,683 | 417 | 12.70% |
| LiveKit client | 1,745,951 | 2 | 9.55% |
| Lucide React Native | 1,297,179 | 1,549 | 7.10% |
| React Native Reanimated | 894,006 | 288 | 4.89% |
| RevenueCat hybrid mappings | 720,569 | 1 | 3.94% |
| LiveKit React components | 251,294 | 6 | 1.37% |

LiveKit client, Lucide, RevenueCat mappings, and LiveKit React components together account for 21.97% of mapped source bytes. The source map contains both LiveKit's 1,204,871 B ESM build and 541,080 B UMD build. This is strong evidence of duplicate format inclusion, although source-content bytes are not identical to final minified byte contribution.

The app imports the Lucide barrel from 63 files, and the source map includes 1,549 Lucide modules. Lazy `require` seams for optional native functionality do not guarantee bundle splitting in a single native bundle.

Expo's official guidance recommends production bundle analysis with Expo Atlas and notes that bundle size affects load and evaluation time. It also documents native Hermes bytecode compression as the meaningful update-transfer measurement: [Expo bundle analysis](https://docs.expo.dev/guides/analyzing-bundles/), [Expo update bandwidth measurement](https://docs.expo.dev/eas-update/estimate-bandwidth/), and [Expo metrics reference](https://docs.expo.dev/eas/observe/reference/metrics/).

**Optimization experiments, in order:**

1. Resolve why both LiveKit ESM and UMD builds enter Metro. Acceptance: only one LiveKit client format remains and call tests still pass.
2. Replace broad Lucide barrel resolution with proven per-icon imports or a Metro/Babel transform. Acceptance: materially fewer than 1,549 Lucide modules with identical UI output.
3. Confirm whether RevenueCat hybrid mappings can be excluded from native production output without breaking purchases.
4. Record this export as a baseline and fail CI on unexplained platform bundle growth above an agreed percentage and absolute byte threshold.

## F-06: repeated schema work

`ensureFullMeerkatSchema` on a fresh in-memory database took 6.43 ms on the host and performed 32 queries plus 164 executions. Repeating it on an initialized database took 0.73 ms median and 0.98 ms p95, but still performed 32 queries plus 157 executions per call.

`ensureDmTables` performed 9 executions per call and took 0.0165 ms median on the host adapter. Production code has 12 call sites in `dm-provider-core.ts`, one in `dm-view-core.ts`, one restore call, and the intended schema-boot call.

The host timing is small and must not be extrapolated directly to `expo-sqlite` on a phone. The concern is synchronous bridge and JavaScript-thread work, repeated on paths whose boot invariant already promises schema readiness.

**Remediation:** keep schema creation and migration at the single boot boundary. If defensive calls must remain, guard them with a database-instance once flag and retain a separate explicit restore/migration path. Prove cold boot, hot navigation, background boot, and restored-database behavior.

## F-07: duplicated parity cores

`check-meerkat-parity.mjs` currently locks 49 mobile/web core pairs. Their physical size is:

```text
Mobile twin files: 778,464 bytes, 19,951 lines
Web twin files:    778,954 bytes, 19,951 lines
Total:           1,557,418 bytes, 39,902 lines
```

The lock is effective: the parity gate passed, and byte-equivalent security behavior is much safer than silent drift. The problem is the architecture required to satisfy it. Every shared fix is duplicated, reviewed twice, and tested against a custom normalizer. Several high-risk files, including feed, public publish, canvas, DM, presence, and library cores, are in this registry.

**Remediation:** incrementally extract platform-neutral cores into one shared workspace package while leaving database adapters and UI seams platform-local. Keep the parity gate until each pair is removed and both consumers pass the same contract suite. Do not weaken or delete the lock before extraction.

## F-08: responsibility concentration

The app contains 126,671 TypeScript/JavaScript lines. Largest files include:

| File | Lines |
|---|---:|
| `community-core.ts` | 4,294 |
| `SyncProvider.tsx` | 2,909 |
| channel screen | 2,087 |
| `public-publish.ts` | 1,557 |
| `library-store-core.ts` | 1,508 |
| DM thread screen | 1,409 |
| `person-identity-core.ts` | 1,401 |
| `canvas-core.ts` | 1,380 |
| `dm-provider-core.ts` | 1,324 |
| settings screen | 1,103 |

Line count alone is not a defect. Here it correlates with many security domains, schemas, network paths, UI state machines, and provider callbacks living in single review units. `SyncProvider.tsx` is also where a hook dependency warning can affect an engine reference.

**Remediation:** split by stable responsibility boundaries, not arbitrary line targets. Good seams are schema/migration, verified read model, signed write commands, transport orchestration, mailbox handlers, and provider-facing hooks. Preserve existing public barrels and tests during extraction.

## F-09: New Architecture contradiction

The app instruction says the New Architecture is on. `app.json` explicitly sets `newArchEnabled: false`, and `app-config.test.ts` locks that value. On Expo SDK 54 this means the legacy architecture is in use.

Expo states that SDK 54 is the last release that permits opt-out, the New Architecture is default for SDK 53/54 when not explicitly disabled, and SDK 55 or later requires it: [Expo New Architecture guide](https://docs.expo.dev/guides/new-architecture/).

**Impact:** agents can make incorrect compatibility assumptions, and the app cannot move to SDK 55 until its native modules work on the New Architecture.

**Remediation:** either correct the instruction to say legacy architecture is intentionally pinned, with owner and exit criteria, or run a dedicated native-module compatibility program and enable the architecture. Do not flip this setting without physical dev-build validation of all optional native transports, calls, storage destinations, camera, background tasks, and purchases.

## F-10: lint warnings

Lint passed with nine warnings:

- Two channel callbacks omit `bumpRevisionTick`. The function is itself stable through `useCallback([])`, so current behavior is safe, but the dependency suppression is unnecessary and fragile.
- Four layout-editor callbacks depend on a conditionally created `stack` array. When the fallback is `[]`, identities churn each render and recreate all callbacks.
- `CanvasHost` omits `community.descriptor.members` from a memo that derives `memberInfo.isMember`. The `revision` dependency may often refresh it, but the coupling is implicit.
- `SyncProvider` omits `engine` from `runForegroundDrain`, even though it calls `engine.recordChange`. Identity is also a dependency and normally co-varies with engine creation, but the correctness relies on that indirect coupling.
- `MessageBubble` declares an unused `OUTER_RADIUS`.

The Canvas and engine omissions are medium-risk maintainability warnings because stale security or membership state would be difficult to diagnose. The other warnings are low risk.

## F-11: non-secret randomness

Several local IDs and canvas conflict nonces use `Math.random()`. The code correctly labels them non-secret and signatures bind the events. There is no evidence that these values are authentication capabilities.

For the 2,000,000,000-value canvas nonce space, two concurrent choices collide with probability `1 / 2,000,000,000`, or `5e-10`. At 10,000 choices in one collision domain, the birthday approximation is `1 - exp(-n(n-1)/(2M))`, approximately 2.47%. Ten thousand same-version concurrent edits to one node are unrealistic, but the protocol should not present weak randomness as a UUID-like primitive.

**Remediation:** use the already configured cryptographic random source or `Crypto.randomUUID()` for identifiers and a cryptographic 32-bit or 64-bit integer for conflict nonces. Treat this as reliability and clarity work, not a discovered secret compromise.

## F-12: dependency-tool scalability

These commands exhausted Node heaps on the workspace graph:

- `pnpm audit --prod --audit-level high`: failed at the default heap and again with an 8 GB heap. The retry peaked at approximately 8.80 GB resident after 158 seconds.
- `pnpm list --depth Infinity --json`: exhausted the default heap.
- A package-specific `pnpm why --prod` request exhausted the default heap.

This makes the documented dependency workflow unreliable and helped hide the advisory result. The independent manifest and lockfile method completed in under one second.

**Remediation:** add a repository-owned, bounded dependency-audit command that traverses one importer and its workspace links without constructing the full recursive display tree. Keep official `pnpm audit` as a secondary signal until its workspace memory behavior is understood.

## Security and privacy review

### Positive evidence

- Secret-pattern scan found no tracked private keys, common live API key formats, or committed `.env` files.
- Runtime code contained no explicit `any`, TypeScript suppression, `eval`, `new Function`, or `dangerouslySetInnerHTML`.
- Android backup is disabled and the security plugin sets cleartext traffic off.
- iOS declares a no-tracking privacy manifest and explicit local-network purpose text.
- Link preview code documents and tests the server-side request-forgery boundary.
- Account isolation, transport negative controls, fail-closed table policies, signatures, pairing, sealed shares, and cryptographic session behavior are extensively tested.
- The complete app, sync, and relay automated runs left zero Meerkat service processes behind, validating the orphan watchdog on the tested path.

### Residual concerns

- User-provided remote-share and history-import helpers accept `http://` candidates while platform cleartext policy rejects general cleartext traffic. This may be intentional for local/self-host scenarios, but the product contract should name the allowed exception rather than relying on platform failure.
- There are 82 lint-disable comments. Most are justified lazy native-module `require` seams, but hook suppressions should be audited as a separate list because they can hide stale security state.
- ErrorBoundary and storage warnings do not log secrets in the inspected code, but component stacks and filesystem errors should still be treated as local diagnostic data only.

## Automated verification record

| Check | Result | Time | Peak RSS |
|---|---|---:|---:|
| App TypeScript | Pass | 3.39 s | 622,592,000 B |
| App ESLint | Pass with 9 warnings | 3.64 s | 689,586,176 B |
| App Vitest | 1,815 passed in 165 files | 8.97 s wall | 342,196,224 B |
| `@mylife/sync` Vitest | 2,624 passed, 3 skipped in 207 files | 37.41 s wall | 402,882,560 B |
| Meerkat relay Vitest | 1,653 passed, 189 skipped in 214 files | 17.04 s wall | 259,129,344 B |
| Meerkat parity | Pass | Not separately timed | Not sampled |
| Transport negative controls and self-test | Pass | Not separately timed | Not sampled |
| Expo production export, both platforms | Pass | 53.92 s including 22.3 s Watchman wait | 1,650,589,696 B |
| Android no-bytecode source-map export | Pass | 18.13 s | 1,076,297,728 B |
| Expo Doctor | 17/18, duplicate Expo failure | 5.05 s | Not sampled |
| Workspace `pnpm audit` | Failed twice by OOM | 75 s and 157.68 s | Up to 8,799,207,424 B RSS |
| Independent npm bulk advisory scan | Completed, findings open | Under 1 s | Not sampled |

Total executed test assertions: 6,092 passed, 192 skipped, 0 failed.

## Instruction audit: AGENTS.md and CLAUDE.md

### Measured instruction load

The effective Meerkat instruction family contains 442 lines and 5,958 words when root, app, and the three named path rules are counted. It uses 16 `Critical` labels. The app `AGENTS.md` alone is 2,585 words. The app `CLAUDE.md` is a clean one-line import wrapper and is not independently problematic.

Using the CLAUDE.md quality rubric against the effective imported instructions:

| Scope | Commands, 20 | Architecture, 20 | Patterns, 15 | Concision, 15 | Currency, 15 | Actionability, 15 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Root effective `CLAUDE.md` + imported `AGENTS.md` | 17 | 20 | 15 | 6 | 11 | 9 | 78/100 |
| App effective instructions | 15 | 20 | 15 | 8 | 10 | 14 | 82/100 |

The domain-specific architecture and safety content scores very well. The lost points come from operational overreach, repetition, temporal claims, contradictory state, and mandatory tooling side effects.

### Rules to preserve

These rules prevent real classes of failure and should remain prominent:

- Transport honesty and the prohibition on fabricated connectivity or delivery.
- The `effectiveRelayUrl` choke point and health-gated default relay.
- Sync scopes, maximum scopes, fail-closed missing entity policies, and apply-time verification.
- Account/Meerkat identity separation and the import-graph guard.
- MK-001 boot order for PRNG and keychain configuration.
- App isolation, archive boundaries, TypeScript strictness, no CodeRabbit, and non-destructive Git behavior.
- Report snapshot honesty and generated-artifact limits.

### Rules likely to create more issues than guidance

| Rule or pattern | Why it causes trouble | Recommended replacement principle |
|---|---|---|
| Root `Scope And Completeness`: no time, phase, or scope limits; everything ships together | Converts bounded work into an unbounded release, conflicts with safe incremental integration, and discourages explicit risk reduction | Never silently omit the complete product target. Execute only the user-authorized scope, and allow production-safe staged integration with explicit completion criteria |
| Apply paired hub/standalone changes in the same session | Can force unrelated repositories and surfaces into a focused fix, increases collision risk, and makes read-only tasks ambiguous | Require same-change parity only when shared behavior, schema, or copy actually changes; allow a tracked blocker when authority or isolation prevents the paired change |
| Commit completed work proactively | Mutates Git state without a per-task request and can mix with a dirty shared worktree | Commit only when the task or active branch explicitly authorizes it; stage only agent-owned files and never absorb pre-existing changes |
| Update memory, create a session log, update indexes, create an HTML twin, and open it after every task | Creates substantial documentation churn for trivial or read-only work; the current 79-line memory cap is already at its limit | Trigger the full artifact flow for material implementation, audit, decision, or release work; use a lighter breadcrumb for trivial tasks |
| Six mandatory fields for every human instruction and every chat next step | Makes simple developer commands verbose and conflicts with the separate concise-writing rule | Apply the six-field form to external GUI, credentials, legal, store, and founder-operation runbooks; use concise command, expected result, and failure note for developer steps |
| Claude startup must check external Open Brain before doing anything and immediately capture every deliverable | Can block local work on unavailable infrastructure, causes external state changes without task need, and creates privacy/availability coupling | Make external memory opt-in per workspace/session, never block local work, and capture only user-approved durable decisions |
| Create an Agent Team when overlapping tasks exist | Overlap is exactly where parallel edits are most likely to collide | Parallelize independent, file-disjoint work; serialize or explicitly partition overlapping work |
| After every code change run both full gate and review, plus broad UI state testing | Good for meaningful code changes but disproportionate for comments, generated types, configuration, or mechanical edits | Route by risk and affected surface; always run the function gate for function logic, but make review/browser matrices proportional and explicit |
| Every feature without a feature document must get a document before code | Forces speculative documentation for small bug fixes and can preserve an incorrect understanding before investigation | Require a design document for new behavior, cross-system changes, security boundaries, or ambiguous product decisions; allow tests and issue notes for narrow fixes |
| Many temporal Plan IDs and dated state claims in app instructions | Plan references age quickly and require readers to resolve historical context before acting | Keep current invariants in AGENTS; move history and rationale to linked design records |
| Saturating 16 rules with `Critical` | Weakens prioritization because unrelated artifact, memory, Git, scope, and security rules appear equally urgent | Reserve `Critical` for safety, privacy, destructive action, data integrity, and transport truth; label workflow rules as required or recommended |

### Direct contradictions and confusing state

1. App instructions say New Architecture is on; `app.json` and its test require `false`.
2. Root instructions prohibit deferred, phase, later, and out-of-scope framing; app instructions state background sync is pending and OS scheduling is deferred behind a flag.
3. Root instructions say concise output; the universal six-field instruction rule requires long explanations even for simple next steps.
4. Root instructions call `memory.md` a safety-net supplement, but also require a full session artifact after every task, which duplicates the report and Git history for review-only work.
5. The skills snapshot is dated 2026-02-24 while the live local skill tree contains additional review, benchmark, QA, parity, and function-gate tools. The file describes itself as a snapshot, but agents are told to use it as discovery guidance.
6. Root overview counts are explicitly dated 2026-07-09. They may be correct, but the current date is 2026-09-02 and the same file warns against stale current-looking counts elsewhere.

### Proposed structure

Use four short layers:

1. Root `AGENTS.md`: stable cross-agent invariants, source-of-truth paths, core commands, destructive-action and data rules.
2. Root `CLAUDE.md`: Claude-only tool routing, no product or architecture duplication.
3. App `AGENTS.md`: current Meerkat architecture and security contracts, written as present-tense invariants without plan chronology.
4. Design records: historical plan IDs, rationale, protocol detail, launch state, and operational runbooks.

A small precedence block should say: explicit user scope controls task breadth; safety and data-integrity invariants always apply; tool-specific workflows apply only when the tool exists; documentation and commit side effects require the task category that calls for them.

## Recommended remediation order

| Priority | Work | Proof required |
|---:|---|---|
| 1 | Resolve dependency advisories and duplicate Expo installation | Expo Doctor fully passes, zero patchable high advisories, clean iOS/Android native builds |
| 2 | Batch feed/post/reaction queries and add safe verification reuse | Constant query count, at least 50% median improvement, adversarial cache invalidation tests |
| 3 | Run live relay integration matrix | PostgreSQL, MinIO/S3, LiveKit, service authority, migration, and canary tests all executed rather than skipped |
| 4 | Measure on physical devices | Cold start, feed open/scroll, LAN, WebRTC, BLE wake, background scheduling, push wake, keychain relaunch |
| 5 | Remove repeated runtime DDL | Boot/restore/background tests plus query trace proving no route-level DDL |
| 6 | Reduce bundle concentrations | One LiveKit format, materially fewer Lucide modules, bundle regression baseline |
| 7 | Extract shared mobile/web cores | Shared package contract tests, parity maintained during migration |
| 8 | Simplify instruction hierarchy | Resolve contradictions, reduce `Critical` labels, preserve all security and honesty boundaries |

## Audit limitations

- Performance numbers are reproducible host-side measurements, not phone timings.
- The batched prototype used post-only data with no active reactions and empty safety sets. Its output matched that fixture, but it is not production code and does not prove all policies.
- Source-map source-content bytes show inclusion and concentration, not exact minified ownership.
- No user credentials, external provider mutations, deploys, App Store operations, or destructive live database tests were authorized or performed.
- The repository already contained unrelated uncommitted and untracked files. They were not modified by this audit.

## Conclusion

Meerkat's security posture is stronger than its optimization and release-hygiene posture. The key architectural boundaries are real, heavily tested, and generally fail closed. The most valuable next engineering move is not a broad rewrite. It is a measured read-model refactor that batches SQL and safely reuses cryptographic verification, followed immediately by dependency/native cleanup and live integration proof.

The instruction system should also be simplified. Preserve the transport, identity, sync-scope, key-durability, and privacy rules. Rewrite the rules that impose unbounded scope, mandatory external state, duplicated documentation, unsolicited commits, or universal heavyweight workflows. Those rules currently increase operational risk while making the genuinely critical rules harder to see.
