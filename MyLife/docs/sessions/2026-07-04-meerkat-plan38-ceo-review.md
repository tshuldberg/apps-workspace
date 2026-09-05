# 2026-07-04: Meerkat Plan 38 founder CEO review (EXPANSION mode)

## What was done

Full interactive `/plan-ceo-review` of
`docs/plans/queue/38-meerkat-community-organization-theming-and-data-hub.md`
with the founder, in SCOPE EXPANSION mode, at the founder's request
("evaluate, improve, expand, ideate and review with me").

## Outcome

- Approach C locked: full Plan 38 scope + two platform seams (in-code channel
  kind view registry; in-code media-type registry map with unknown-type
  fallbacks). Explicitly NOT a plugin framework.
- 10 scope expansions proposed and ALL accepted by the founder, 0 deferred:
  community templates (6 presets), within-community logical dedup + all-local
  stats, smart collections, theme share/adopt, folder-convention + bounded NFO
  import, photo timeline + offline-tile map, pin-class taxonomy + pin policy +
  storage budget + LRU eviction, music queue + transport controls, in-app
  sealed epub/cbz reader, per-community notification identity.
- 8 + 10 binding decisions recorded (see the plan's "Review Amendments
  (2026-07-04, BINDING)" section): Library | Chat segments; owner-signed
  library config; theme = provider boundary over community subtrees with
  DM/tab-bar leakage tests; loopback range-server A/V playback (sub-phase 6a,
  token-in-URL, no plaintext at rest); pin-context migration for mk_pinned;
  sealing-key model as a Phase 0 BLOCKER; conditional channel-tuple canonical
  append + legacy-signature fixture; EXIF GPS strip-by-default per-contributor;
  BYO-key guided enrichment; personal_replica watch progress (own devices
  only); honest web container matrix; transport-reality copy rules.
- Phase resequencing accepted: personal "My Library" hub is the FIRST
  shippable milestone (Phases 3-6 built against the personal workspace);
  community-shared libraries + templates layer on in Phase 7.
- Estimate corrected 10-14 -> 15-20 CC days + founder-ops device-QA tail.

## Process

- 3 adversarial spec-review iterations on the CEO plan doc: 5/10 -> 7/10 ->
  9/10 PASS; 29 issues found and fixed (highlights: seeder count had no honest
  data source and was dropped; contentId/linkKey dedup semantics verified in
  sealed-share.ts; mk_pinned single-PK collision; tile packs specified).
- Outside-voice challenge (Opus, fresh context, read the code): 13 findings,
  8 folded, 1 partially corrected (manual sessions DO move blobs), 4 resolved
  by founder as cross-model tensions (resequence, BYO-key, personal_replica
  resume, keep map).
- codex exec was sandbox-denied; Opus subagent used as fallback outside voice.

## Files changed

- `docs/plans/queue/38-meerkat-community-organization-theming-and-data-hub.md`:
  Status Delta entry + BINDING "Review Amendments (2026-07-04)" section +
  GSTACK REVIEW REPORT.
- `~/.gstack/projects/MyLife/ceo-plans/2026-07-04-meerkat-plan38-community-theming-data-hub.md`
  (rev 4): full decision record.
- `/Users/trey/.claude/CLAUDE.md`: created with the founder's model-selection
  guidance for workflows/subagents (from screenshot; final bullet completed
  as "and return the output", founder to confirm remainder).
- Installed Claude Code plugin `codex@openai-codex` (marketplace
  `openai-codex`, user scope) at founder request; codex CLI 0.142.5 present.

## Remaining / next

1. `/plan-eng-review` on the amended Plan 38 (required gate). First agenda
   item: the D.3 sealing-key model blocker.
2. `/plan-design-review` for Phases 1, 2, 5, 7 per pipeline.
3. Plan 38 stays sequenced AFTER Plan 37 launch waves; W2 channel-creation
   fix still gates Phase 2.
4. No code was changed; review only.
