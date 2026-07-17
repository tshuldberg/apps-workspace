Original prompt: Review the code in this folder. Test heavily against interactions. Spend a lot of time planning and reviewing the code before making change suggestions and implementing those changes. We have many interactions that aren't working right like entering new zones and some spaces aren't accessible that shoul dbe

## 2026-02-13
- Initialized progress tracking for interaction-focused review/fix cycle.
- Baseline unit tests run: 101 pass, 3 fail (all in catch-rate probabilistic tests; overworld not covered).
- Next: map overworld movement/transition architecture and run Playwright interaction sweeps.
- Added deterministic debug instrumentation in `src/main.ts`:
  - `window.render_game_to_text` state payload
  - `window.advanceTime(ms)` fixed-timestep hook
  - debug start helpers and `?debugStart=1&map=...&x=...&y=...` query bootstrap
- No gameplay rules changed yet; this is to enable repeatable interaction sweeps.
- Added `src/overworld/connections.ts` with robust `resolveConnectionLanding(...)` logic:
  - normalizes direction aliases (`north/south/east/west`)
  - applies offset along the correct axis for east/west transitions
  - chooses nearest passable tile along the target entry edge to avoid blocked/OOB landings
- Updated `src/scenes/overworld.ts` to use the connection landing resolver for map-edge transitions.
- Added regression test file `tests/map-connections.test.ts` to validate map connection targets and landing validity across all passable boundary exits.
- Patched route map seams where connections existed but target edges were fully blocked:
  - `src/data/maps/route-3.ts`
  - `src/data/maps/route-4.ts`
  - `src/data/maps/routes-5-to-10.ts`
  - `src/data/maps/routes-11-to-15.ts`
  - `src/data/maps/routes-22-to-25.ts`
- Ran full Playwright interaction sweep for 12 edge-transition scenarios with screenshot/state verification under `output/interaction-scenarios/`.
  - All scenario states ended in expected target maps with `transition: none`.
- Unit tests:
  - New map connection tests pass.
  - Full suite still has pre-existing failures in `tests/catch.test.ts` (3 probabilistic catch-rate assertions).

TODO / Next Suggestions:
- Investigate and stabilize catch-rate probabilistic tests in `tests/catch.test.ts` (likely RNG determinism/statistical threshold issue).
- Expand interaction sweeps to include warp-door transitions and ledge-jump edge cases using same Playwright harness.
