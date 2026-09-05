# Meerkat production review, 2026-09-04

## Scope and decision

User requested expansive adversarial code/history/product/competitor/launch assessment, HTML report with animated concepts, and archive of earlier readiness HTML.

Current report: [HTML](../reports/REPORT-meerkat-production-readiness-2026-09-04.html), [Markdown](../reports/REPORT-meerkat-production-readiness-2026-09-04.md). Verdict: NO-GO for general availability. Private pilot is conditional on web storage containment and core artifact/device checks. Full creator/public platform remains a separate completion program.

Reviewed tree `7a40639d1e364ee384f92f0debbd036d995e7b4c`, latest product change `a3152851`. Four-path history: 429 touching commits. Read-only code review; no application functions changed, no deployment or outreach, no commit/push.

## Findings and evidence

- New high: stale whole-database snapshots from two browser adapters overwrite one another. Deterministic production-adapter probe retained only writer B.
- New high: failed persistence immediately retries without bounds. Twenty injected failures produced 21 attempts in 3.11 ms. This is distinct from the fixed secret-vault persistence path.
- Store release-control gap: TestFlight skips production guard, even though store-distributed. Empty production configuration rejected with 15 errors; TestFlight returned ok/skipped.
- Live GitHub read: Actions disabled; latest listed release-verify cancelled August 1. Pilot relay health returned HTTP 200/ok. Neither establishes real two-user delivery.
- Existing product/evidence gaps: opt-in foreground/background delivery, friend-code publication and link handling, native/provider/recovery/billing evidence, local-at-rest claims, static TURN deployment credentials and stale permission copy.
- Updated root errors_log.md with the two new persistence defects and profile guard gap; no product remediation implied.

## Fresh verification

- sync 2,630 passed / 3 skipped; app 1,817 passed; web 1,230 passed; relay 1,653 passed / 189 skipped. Total 7,330 passed / 192 skipped.
- Typecheck and lint passed for all four packages.
- Meerkat parity and transport static negative controls passed.
- Web build passed; app index 760.70 kB, sync 647.21 kB, LiveKit 531.04 kB before gzip; build warned on large chunks.
- Browser E2E: 8 passed / 1 relay test skipped. Private-path entitlement endpoint is a fixture; no claim of real purchase validation.
- Existing feed benchmark: seven queries; medians 41.73 / 168.43 / 679.03 ms for 20 / 80 / 320 signed posts; 320-post p95 704.63 ms. Three warmups, nine repetitions, host sql.js-independent better-sqlite3 harness. Not a phone benchmark.
- Generated-artifact guard passed. Report source-link and archive checksum validation performed.
- Full `pnpm check:parity` passed. HTML checked in a headed Chromium window at 1512×982 and 390×844; no viewport overflow. All four mobile flows reached their final states, all four community views changed correctly, autoplay stopped at the final state, and reduced-motion computed animation was `none`. No JavaScript runtime error observed; an initial missing favicon request was removed with an inline data favicon. Report and archive source-link checks passed, and all 30 archive checksums match. Screenshots are under `output/playwright/meerkat-review-2026-09-04/` (local QA artifacts).

## Documentation changes

Created 6,700-word report and self-contained HTML with proposal-only animated invitation, delivery, recovery and profile/settings flows, plus four community home views. Actual Open Burrow colors and five-tab labels retained in concepts. Print and reduced-motion CSS included.

Moved 30 files from 17 earlier readiness/technical assessment families into docs/archives/meerkat-readiness-2026-09-04. Manifest records old path, new path and SHA-256; original bytes preserved. Archive README has an HTML twin. Archived originals may contain old relative links; manifest preserves their source context. Historical release ledgers and session records were not rewritten. Active clickable incoming links and current report indexes were updated. Existing design-only, user/marketing guides, legal sources, plans, pitches and unrelated research remain in place.

Updated apps/meerkat/AGENTS.md current-verdict pointer, app docs index, root docs index and report catalog. Existing unrelated dirty .claude settings, research docs and memory content preserved. A few active links in Plan 40 and the old screen walkthrough now point to archived evidence.

## Remaining validation

No physical iOS/Android QA, signed-build validation, payment transaction, provider matrix, new full advisory scan, production load/soak, external security certification or legal sign-off was performed. These are explicit report gates, not passed checks. Report prototypes are disconnected from application data.

## Reusable lesson

After fixing whole-state persistence in a secret vault, inspect every sibling durable store for stale-image overwrite and retry loops. A lock around an entire stale database image is insufficient unless writer ownership or semantic reconciliation is also enforced.

## Reproduce the database findings

1. From `/Users/trey/Desktop/Apps/MyLife`, save the following TypeScript as `/tmp/meerkat-database-probe.mts`.
2. Run `pnpm --filter @mylife/meerkat-relay exec tsx /tmp/meerkat-database-probe.mts`. It uses the installed sql.js and production adapter with in-memory bytes only. Expected on the reviewed code: writer B is the only reopened row; 21 immediate retry attempts. If dependencies are missing, use the repository's documented `pnpm install`, then repeat.
3. After a fix, the concurrency case must preserve both rows or explicitly refuse a second writer; failure injection must exhibit bounded retry and a recoverable failure state. Add real-browser IndexedDB tests before calling the defect resolved.

```typescript
import { createBrowserDatabaseAdapter } from '/Users/trey/Desktop/Apps/MyLife/apps/meerkat-web/src/lib/storage/browser-database-adapter.ts';
import { createRequire } from 'node:module';
const req=createRequire('/Users/trey/Desktop/Apps/MyLife/apps/meerkat-web/package.json');
const locateFile=(f:string)=>req.resolve('sql.js/dist/'+f);
let bytes:Uint8Array|null=null;
const store={async read(){return bytes},async write(b:Uint8Array){bytes=new Uint8Array(b)}};
const options={locateFile,bytesStore:store,persistDebounceMs:60000};
const seed=await createBrowserDatabaseAdapter(options);seed.execute('CREATE TABLE notes(id TEXT PRIMARY KEY, body TEXT)');await seed.flush();seed.close();
const a=await createBrowserDatabaseAdapter(options);const b=await createBrowserDatabaseAdapter(options);
a.execute('INSERT INTO notes VALUES (?,?)',['a','message from tab A']);await a.flush();
b.execute('INSERT INTO notes VALUES (?,?)',['b','message from tab B']);await b.flush();
const reopened=await createBrowserDatabaseAdapter(options);
console.log('TWO WRITERS REOPEN',JSON.stringify(reopened.query('SELECT * FROM notes')));
a.close();b.close();reopened.close();
let attempts=0;const failingStore={async read(){return null},async write(_b:Uint8Array){attempts++;if(attempts<21)throw new Error('synthetic quota failure')}};
const bad=await createBrowserDatabaseAdapter({locateFile,bytesStore:failingStore,persistDebounceMs:60000});
bad.execute('CREATE TABLE q(id TEXT)');const start=performance.now();await bad.flush();console.log('RETRY attempts',attempts,'elapsed ms',(performance.now()-start).toFixed(2));bad.close();
```
