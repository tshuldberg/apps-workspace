# 2026-06-10: Mobile vitest hang root cause + fix (the 04-19 relic)

## Ask

Remove the long-standing mobile vitest hang ("the relic"): since 2026-04-19, eight test files were quarantined because they hung at collection under every pool, and any `pnpm gate:function:changed` run whose change set touched `apps/mobile` could hang or abort.

## Root cause (proven, not guessed)

**Vitest 3.2.x's mocker deadlocks itself on this suite.** The chain, with the instrument that proved each link:

1. Every `vi.mock(specifier, factory)` registration performs a worker to master `resolveId` RPC (vitest source: `VitestMocker.resolveMocks()` awaits `resolvePath` for every pending mock; `dependencyRequest` awaits `resolveMocks()` before EVERY import).
2. A contiguous block of those RPCs for **bare npm specifiers** (react-native, expo-*, react-native-*) never receives a response. Path-shaped ids (relative, absolute, workspace `@mylife/*`, alias-resolved) always get answers. Proven with a worker-side IPC tap (patched `process.send` / `process.on('message')` via fork `execArgv`): 22 resolveId requests sent, 7 answered, 15 unanswered, all unanswered ones bare specifiers.
3. The requests DO reach the master process: a master-side tap (preloaded `--require` wrapper around `child_process.fork`) logged the requests arriving with no responses going out.
4. vite is never entered for the dropped block: a `configureServer` wrapper around the live `environments.client.pluginContainer.resolveId` logged 55 enters / 55 exits, zero stuck, and none of the dropped ids' calls ever entered. The drop happens between message arrival and handler dispatch inside vitest's channel layer.
5. The deadlock then surfaces later: the first import after mock registration awaits `resolveMocks()` forever. Both processes idle in `kevent` (sampled stacks), zero CPU, no unclosed CJS requires (Module._load tap), exactly matching the 04-19 description "workers spawn, idle at 0% CPU, master deadlocks in uv_cond_wait".
6. Transport-agnostic: reproduces identically under `forks` and `threads` pools, and on vitest 3.2.4 and 3.2.6 (3.2.6 dropped the same 15). The deps optimizer was ruled out empirically (`optimizer=no`, `noDiscovery=true` in the resolver probe; vitest forces `noDiscovery` itself).
7. **Vitest 4 fixes it**: same repro completes instantly under 4.1.8 (its mocker rework no longer round-trips per mock id).

Falsified hypotheses along the way: lucide transform pipeline (the 04-19 partial fix was real but incomplete), vite deps-optimizer `scanProcessing` parking, circular imports in `modules/books/src/ui` (clean DAG), serialization failures (no master stderr output), pool-specific transport bugs (both pools fail).

## Fix

- **apps/mobile runs vitest `^4.1.8`** (only this package; the other 68 packages moved `^3.2.4` to `^3.2.6` as routine in-range maintenance and stay on 3.x). Decision made via explicit option review: mobile-only v4 beats repo-wide v4 (blast radius) and beats patching/containment (relic survives).
- The quarantine in `apps/mobile/vitest.config.ts` is lifted for 6 of the 8 files: `books/{add-book,search,settings}`, `hub/{dashboard,discover}`, `recipes/index` run again.
- `hub/settings` and `hub/settings/automations` stay excluded for a DIFFERENT, real reason: they share an import graph whose render grinds through a 6 GB heap and OOM-kills the fork even in isolation (verified: GC trace shows mark-compact at 5.9 GB with `--max-old-space-size=6144`; the file has never completed under v4 in any configuration). Same memory-pathology bucket as `words/index`. Under v3 these files hit the RPC deadlock first, which masked the balloon.

## Vitest 4 migration changes in apps/mobile

- `poolOptions.forks.{minForks,maxForks}` became top-level `maxWorkers: 2` (v4 removed `minWorkers`).
- `execArgv: ['--max-old-space-size=6144']`: forks are reused across files, jsdom heap accumulates, and `hub/settings` OOM'd a deep-into-suite worker at the default limit.
- v4's mocker statically validates every accessed export against the mock, which surfaced and forced these cleanups:
  - `vi.mock('lucide-react-native')` factory deleted; the `resolve.alias` stub is the single layer. The stub now enumerates the full app-wide union of named icon imports (117 names, parser snippet below) because v4's CJS interop snapshots export names statically and a Proxy without enumerable keys yields zero named exports.
  - `@mylife/ui` mocks stay FULLY SYNTHETIC everywhere. Spreading `importOriginal()` into the factory pulls the real barrel into the worker: measured 6 min at 92% CPU then fork OOM. Missing exports (`fontFamilies`, `OnboardingFlow`, `useThemeSurfaces`) were added to the synthetic factories instead (setup.tsx + local mocks in hub settings/discover tests).
  - `@mylife/books` mock in search.test spreads `vi.importActual('@mylife/books/ui')` (small, fast graph) for token values; logic fns stay mocked.
  - jest-dom matchers: the `@testing-library/jest-dom/vitest` auto-entry targets v3's expect and silently fails under v4 ("Invalid Chai property"); setup.tsx now calls `expect.extend(matchers)` explicitly, with a `Matchers<T>` type augmentation in `test/jest-dom.d.ts`.
  - RN mock additions: `Image: primitive('img')`, `StyleSheet.flatten`.
- Stale assertions re-synced to today's screens (these tests were frozen for 7 weeks): add-book (Curator redesign: inline search, `Title, author or ISBN` placeholder, `Add to Library` action, manual-entry form removed, Scan Cover nav), books settings (goal prompt + total-books stat removed; erase flow is `RESET MYBOOKS DATA` with `Reset` confirm), search (placeholder `Search your digital sanctuary...`), dashboard (module labels render twice, assert presence not uniqueness), recipes (`getRecipes` limit 5 became 6).
- One product accessibility fix that fell out: the search screen's add-to-shelf result button was icon-only with no accessible name; it now carries `accessibilityRole="button"` and `accessibilityLabel="Add to shelf"` (`app/(books)/search.tsx`).

## Lucide stub regeneration snippet

When a new icon import lands and a test fails with "No X export is defined", regenerate `ICON_NAMES` in `test/stubs/lucide-react-native.cjs`:

```js
// node, from apps/mobile
const fs=require('fs'),path=require('path');
const names=new Set();
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(/\.(tsx?|jsx?)$/.test(e.name)){
    const src=fs.readFileSync(p,'utf8');
    const re=/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]lucide-react-native['"]/g;let m;
    while((m=re.exec(src)))for(let part of m[1].split(',')){part=part.trim();if(!part)continue;
      const as=part.match(/^(\w+)\s+as\s+\w+$/);const n=as?as[1]:part.replace(/^type\s+/,'');
      if(/^[A-Z]/.test(n))names.add(n);}}}}
['app','components','lib'].forEach(r=>{try{walk(r)}catch{}});
console.log([...names].sort());
```

## Retained diagnostic tooling

`apps/mobile/vitest.debug.config.ts` (single-file include via `MOBILE_DEBUG_TEST`, fork load-logger via `MOBILE_LOADLOG_FILE`, resolver probe plugins) and `apps/mobile/test/debug/{loadlog.cjs,master-tap.cjs,repro.test.tsx,repro2.test.tsx,resolve-probe.mjs,resolve-probe2.mjs}`. These are excluded from tsc and from the vitest include globs; they exist because re-deriving them cost half a day. The debug config is listed in tsconfig `exclude`.

## Verification

- Repro (`repro2`: add-book's exact import + mock graph): hangs forever on 3.2.4 and 3.2.6, passes in seconds on 4.1.8.
- Six un-quarantined files: 10/10 tests pass (round-by-round triage from 9 failures to 0; hub/settings' 4 tests moved to the memory-bucket exclusion).
- Full mobile suite: **58/58 files, 185/185 tests, 12.39s, exit 0** (three runs to get here: run 1 exposed hub/settings OOM at default heap, run 2 proved 6 GB doesn't save it, run 3 green with it re-bucketed).
- `pnpm typecheck` (apps/mobile): green (test files are tsc-excluded by design; `vitest.debug.config.ts` added to the exclude list).
- dowork suite re-verified green on 3.2.6 (63/63) as the representative for the rest of the monorepo.
- Mobile gate leg (`run-function-quality-gate.mjs --dir apps/mobile`), the exact scenario that used to hang: **lint + typecheck + full suite, exit 0**. One more gate bug fell out and was fixed: the script passed v3-only `--pool-options.threads.maxThreads=2`, which vitest 4's CLI rejects (CACError); now `--maxWorkers=2` (valid on both majors).
- Repo-wide `pnpm gate:function:changed` currently halts BEFORE mobile at apps/bestchef typecheck (4 `StyleSheet.absoluteFill` type errors in the parallel BestChef session's uncommitted Wave 1 components); logged Unresolved in errors_log for that thread. Not related to this work.

## Known leftovers

- `words/index`, `books/home`, `hub/settings`, `hub/settings/automations` remain excluded: genuine memory/ESM pathologies, separately tracked tech debt, NOT the RPC relic.
- A dozen idle orphaned vitest processes from the diagnostic runs linger (kill/pkill denied by session policy); clean up manually or they die at reboot.
- vitest 4 for the rest of the monorepo is routine future maintenance, not urgency.
