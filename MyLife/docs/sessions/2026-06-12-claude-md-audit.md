# 2026-06-12: CLAUDE.md audit + refresh (MyLife + contained apps)

## What was done

Full audit of instruction files (claude-md-improver skill), then applied the approved "everything" scope.

### Audit findings (scores)
- Root CLAUDE.md 72/B-: six classes of stale facts (39 vs 40 module IDs, three contradictory wiring counts, 5 vs 9 free-tier modules, LAN-first vs relay-first mesh default, 4 of 7 apps and 8 of 28 packages in the architecture tree, missing parity scripts).
- Root AGENTS.md 56/C: documented the WRONG design system (Cool Obsidian #0A0A0F vs the real Obsidian Noir #131318), same mesh staleness, no companion-relationship statement.
- apps/meerkat 90/A- (gold standard; pair byte-identical), apps/dowork 75/B (stub annotations stale post-P8, 8 em dashes), apps/bestchef 60/C (pre-(root) architecture tree contradicted by its own F-044 section; entire cloud layer undocumented).
- Missing entirely: apps/manhattan, apps/yearn, packages/sync, packages/meerkat-relay, modules/{manhattan,nutrition,payments,presence,subs}.

### Fixes applied
- Root CLAUDE.md (11 edits): counts replaced with source-of-truth pointers + check commands, relay-first mesh default (MK-014), plan 14 pointer, syncPolicy bullet present-tense, registry-drift warning from the atlas audit (constants.ts vs definition.ts vs _layout.tsx; mobile layouts are UI ground truth), apps/packages tree trued (7 apps, 28 packages incl. sync/meerkat-relay/intelligence/restaurant-saas), Key Commands + parity rule gained check:meerkat-parity / check:module-layouts / check:standalone / test:parity-matrix, team compositions condensed.
- Root AGENTS.md (6 edits): condensed-companion note (CLAUDE.md wins on conflict), Obsidian Noir tokens, relay-first, plan 14, parity commands.
- apps/bestchef/CLAUDE.md rewritten: real (root) tree, Cloud Layer section (6 bestchef-* edge functions, CHF-1 quotas, pg_net jobs, i18n parity script gotcha), Launch State honesty, filter-scoped commands.
- apps/dowork/CLAUDE.md: de-stubbed the two live edge functions (460/219 lines), Roadmap State section (P7/P8 done, P9 trainer platform next per the 2026-06-09 report), 8 em dashes removed.
- apps/meerkat pair: added relay-side test command (kept byte-identical).
- NEW apps/manhattan/CLAUDE.md (full doc: non-obvious rules incl. device-local discovery cache, proxy-first SeatGeek, per-platform RC keys, launch state).
- NEW apps/yearn/CLAUDE.md (honest pointer doc: source lives on feature/bestchef-launch-hardening; this checkout holds build artifacts only; security invariants F1-F9).
- NEW module docs via module-claude-md-generator: manhattan, nutrition, payments, presence, subs (real table lists, syncPolicy, engine inventories, test-coverage gaps; presence corrected to 7 package-root test files + simulated-flows caution).
- NEW packages/sync/CLAUDE.md (layering rules, RN-safe export split, MK-002 invariants, tweetnacl-util interop gotcha, e2e-proof norm) and packages/meerkat-relay/CLAUDE.md (zero-knowledge invariants, components, CLIs, illustrative-pricing honesty flag).
- Workspace /Apps/CLAUDE.md MyLife row: 29 -> 40 modules + standalone apps named.

## Verification
- All edited/created files: 0 em dashes, no placeholders, meerkat pair diff clean.
- Function gate: skipped, docs only (no function logic changed).

## Remaining suggestions (not applied)
- Deeper root CLAUDE.md trim (gstack routing block, MDD handbook) deferred; they are load-bearing gate text.
- Registry reconciliation pass (constants.ts vs definition.ts vs layouts) still recommended; now documented as a known-drift warning in CLAUDE.md.
- Module CLAUDE.md coverage now 40/40; consider wiring doc freshness into check:parity later.
