# Performance Baseline

Baseline established on 2026-04-04 (America/Los_Angeles) with supporting artifacts under `artifacts/perf-audit/`.

## Summary

| Metric | Target | Current baseline | Status | Notes |
|--------|--------|------------------|--------|-------|
| Cold start (iOS reference device) | `< 3s` | Not captured in this session | Blocked | Local simulator build failed before launch timing because `apps/mobile/ios/Pods/Target Support Files/Pods-MyLife/Pods-MyLife.debug.xcconfig` is missing. |
| Lighthouse performance | `>= 90` | `67` | Provisional fail | Measured against the homepage on a plain `next dev` server because the production web build is currently blocked by unrelated route and package issues. |
| Largest Contentful Paint | `< 2.5s` | `3.09s` | Provisional fail | Same provisional homepage audit as Lighthouse. |
| DB insert | `< 100ms` | `0.019ms avg`, `0.029ms p95` | Pass | File-backed SQLite with WAL enabled, 5,000 seeded rows, 1,000 measured iterations. |
| DB query | `< 100ms` | `0.017ms avg`, `0.019ms p95` | Pass | Indexed category lookup returning up to 20 rows. |
| DB update | `< 100ms` | `0.013ms avg`, `0.016ms p95` | Pass | Single-row update by primary key. |
| DB delete | `< 100ms` | `0.015ms avg`, `0.025ms p95` | Pass | Single-row delete by primary key. |
| Initial JS bundle size | `< 500KB gzipped` | Not captured in production build | Blocked | The production web build is currently blocked. The dev-homepage script transfer observed during Lighthouse was `7.35MB`, which is not a valid production bundle proxy. |

## Measurement Environment

- DB benchmark host: `darwin 25.3.0`, `arm64`, Node `v22.22.0`
- DB benchmark database: temporary file-backed SQLite database, WAL enabled, `2,174,976` bytes after setup
- Web audit URL: `http://localhost:3005`
- Web audit mode: `pnpm exec next dev --port 3005`
- Lighthouse command:

```bash
npx -y lighthouse http://localhost:3005 \
  --only-categories=performance \
  --chrome-flags='--headless=new --no-sandbox' \
  --quiet \
  --output=json \
  --output-path=artifacts/perf-audit/lighthouse-home-dev.json
```

- iOS build attempt:

```bash
xcodebuild \
  -workspace apps/mobile/ios/MyLife.xcworkspace \
  -scheme MyLife \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16e' \
  -derivedDataPath /tmp/mylife-ios-build \
  build
```

## Artifacts

- DB benchmark JSON: `artifacts/perf-audit/benchmark-db-baseline.json`
- Lighthouse JSON: `artifacts/perf-audit/lighthouse-home-dev.json`

## Commands

```bash
pnpm benchmark:db -- --output artifacts/perf-audit/benchmark-db-baseline.json
pnpm exec next dev --port 3005
```

## Open Blockers

1. The production web build does not currently complete. During this session it surfaced:
   - broken standalone passthrough routes under `apps/web/app/surf/**` and `apps/web/app/recipes/**`
   - server-side imports pulling client auth barrel exports into the web server graph
   - `packages/sync` WebAssembly and Node `fs` bundling issues on the web settings/data-sync route
2. The iOS workspace is missing CocoaPods-generated base config files, so local simulator launch timing could not be recorded.

## Next Measurement Pass

1. Restore a clean production web build, then rerun Lighthouse against `next build && next start`.
2. Capture initial JS bundle size from the production build output, not from dev-server network traces.
3. Reinstall CocoaPods for `apps/mobile/ios`, launch the app on a reference simulator/device, and record cold-start timing.
