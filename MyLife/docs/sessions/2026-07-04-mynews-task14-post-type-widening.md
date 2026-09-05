# MyNews Task 14: ChannelPostType widening (2026-07-04)

## What was done

Picked up from `docs/sessions/2026-07-03-mynews-handoff.md`. Reconciled the handoff against the worktree's actual state first: plan 36 (Phase 2 editing desk) had already been executed and moved to done on 2026-07-04, main (with the Meerkat launch-finish landing) had been merged back into `feature/mynews-p0-scaffold` in `515f8794`, and the handoff's item 5 registration gap was closed during plan 36. That left exactly one unblocked codeable item from the handoff: plan 34 Task 14, previously gated on the Meerkat merge.

Executed Task 14 (`f98a4b0d`), the four pinned edit sites:

- `apps/meerkat-web/src/lib/meerkat-data.ts`: `ChannelPostType` union widened with `'article' | 'preprint'`; `postTypeForRoot` recognized-value condition accepts both (unknown values still fall back to `'discussion'`).
- `apps/meerkat/app/(root)/data/community-core.ts`: same two edits.

No DDL or sync-package changes, per the plan (`cm_posts.post_type` is `TEXT NOT NULL` with no CHECK).

## Why

MyNews articles and preprints will ride the Meerkat Posts substrate; the post-type unions on both Meerkat surfaces are the substrate seam plan 34 Section 2.2 pinned. The task was gated while `feature/meerkat-launch-finish` had those files dirty; that branch landed on main 2026-07-04 (`edd6b2e3`), unblocking it.

## Verification

- Baseline before editing (handoff Section 3 block): `@mylife/mynews` tests, `@mylife/mynews-app` tests, `mynews-web` tests + prod build, `check:mynews-parity` all exit 0.
- Task 14 pinned verify: `@mylife/meerkat-web` typecheck + 468 tests (incl. the 19-test `post-schema-v2-parity` guard that pins the two decls in sync), `@mylife/meerkat-app` typecheck + 699 tests, `@mylife/sync` 1562 tests. All green.
- Husky staged function gate on commit: both changed apps' typecheck + full suites + web barrel check, green.

## Files changed

- `apps/meerkat-web/src/lib/meerkat-data.ts`
- `apps/meerkat/app/(root)/data/community-core.ts`
- `docs/plans/done/34-mynews-p0-scaffold.md` (Status Delta: Task 14 ungated + executed; plan now fully executed)
- `memory.md`, this session log

## Remaining items (MyNews)

1. Push + PR of this branch's post-merge commits (the editing desk set + this commit) when the founder says so. Conflict watchpoints vs future branches unchanged from the handoff.
2. Founder-ops to go live: Supabase project, `db push` (now three nw_ migrations), deploy the three mynews functions, app/web env, enable anonymous sign-in + `mynews://auth-callback` redirect (plan 36 addition), live e2e, plus plan 34's longer founder-ops track.
3. Next code phase: author plan 37 for Phase 3 (trust spine per the build plan's phase ladder: publish/read P1, editing system P2, trust spine P3). Check `docs/plans/queue/` numbering at authoring time; carry plan 36's two-stage-review requirement and its recorded follow-ups (shared credibility vector for the four twins, `mynews-store.ts` three-way split when next touched, client shell-INSERT cleanup, `nw_is_newsroom_member` never under service role).

## Decisions

None new; executed the pinned plan verbatim. Multi-line fallback formatting in `postTypeForRoot` chosen over one line for readability; behavior identical and parity-guard green.
