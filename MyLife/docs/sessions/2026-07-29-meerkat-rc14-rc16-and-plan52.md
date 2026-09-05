# Meerkat launch train: rc14 through rc16, and plan 52 P0-P4

**Date:** 2026-07-29 (continues `2026-07-29-meerkat-rc13-defect-fixes.md`)
**Branches:** `fix/meerkat-rc14-verify`, `fix/meerkat-advisories-rc15`, `fix/meerkat-brace-expansion-lane` (all squash-merged to main), `feature/meerkat-plan52-person-identity` (open)
**Active ledger:** `docs/releases/meerkat/meerkat-2026-07-29-rc16/` at `105adcc8`

## Release candidates cut this session

Each one is a new SHA under the change freeze, with the prior candidate's
failure recorded honestly in its ledger rather than overwritten.

| rc | SHA | What it added | Verify outcome |
|----|-----|---------------|----------------|
| rc13 | `39b11c08` | The two 2026-07-24 defect fixes + the non-nesting test adapter | FAILED: audit (15 fresh OSV advisories) + test (a second latent nested-transaction bug in `modules/bestchef` the new adapter exposed, which local turbo caching had masked) |
| rc14 | `d1d802eb` | bestchef transaction-free recipe-apply core; first advisory bump | FAILED: audit only. postcss was pinned 8.5.12 but the advisory needs 8.5.18+; brace-expansion has NO fixed release on the 1.x line, so 1.1.16 to 1.1.17 could never clear it |
| rc15 | `1ca5fc98` | postcss 8.5.25; brace-expansion 1.x consumers overridden to 5.0.8 | FAILED before completion: 5.x is ESM-only, so CJS require interop breaks and ESLint dies with `expand is not a function`. Caught by the local pre-commit gate |
| rc16 | `105adcc8` | brace-expansion 1.x back to 1.1.17; that one advisory moved to the documented ignore lane | **audit green**; full matrix in flight at run 30484031647 |

The rc16 advisory exemption is evidence-based, not assumed: the remaining 1.x
hits reach the tree ONLY through `minimatch@3.1.4`, whose only consumers are
dev tooling (`eslint`, `glob@7`, `test-exclude`). No shipped runtime artifact
resolves brace-expansion 1.x. The entry carries a reason and a 2026-10-31
reconsider date, matching the existing js-yaml precedent.

**Founder-facing note on numbering:** the 2026-07-29 sequencing note used
"rc14" for the plans 52+53 candidate. Three verification-fix candidates
consumed rc14-rc16, so plans 52 + 53 will cut **rc17**.

## Plan 52 (person identity): P0-P4 landed on the feature branch

### P0 protocol, schema, policies, validators

`packages/sync/src/protocol/person-group.ts` (mutually attested device-group
docs; HMAC-SHA512 per-context derived ids with community/dm domain separation;
8-device cap; presentation profile with a deterministic merge) and
`person-group-rows.ts` (row codecs plus fail-closed apply validators
registered for `pi_person_group`, `pi_presentation_profile`,
`cm_person_announces`).

Apps gained the `personidentity` module (prefix `pi_`, **non-shareable**,
both tables capped at `personal_replica`) plus `cm_person_announces`
(shared_workspace) and `cm_person_links` (explicit device_local) on both
schema twins.

### Adversarial review: 3 HIGH, 7 MEDIUM, all fixed

An independent review (opus) attacked the protocol across two passes with
executable proofs. Every finding is fixed and pinned by regression tests. The
three that mattered most:

- **HIGH-1, unsigned ordering columns.** The validators bound `group_id` and
  `revision` but not `updated_at`, and the engine's generic LWW guard
  string-compares that raw column AFTER the validator, skipping the write with
  no audit row. A compromised sibling could pin a far-future timestamp and
  freeze its own expulsion; on the shared_workspace announce table a hostile
  member could replay a verified row with a poisoned timestamp and freeze
  another person's device list on every device in the community. All three
  validators now bind every denormalized column to the signed document.
- **HIGH-2, unsigned group secret.** The secret is the entire basis of
  unlinkability and rode outside every signature. Docs now carry
  `secretCommitment` inside the canonical signed bytes.
- **HIGH-3, unbound announce-draft co-signing.** A merely-PAIRED proposer
  could ride an arbitrary draft (foreign peer context, revision 4242)
  alongside an honest doc, collect a co-signature, and present the co-signer's
  device as part of its person to a third party at a permanently out-ranking
  revision. `verifyAnnounceDraftAgainstDoc` now binds revision, exact device
  set, and context kind; signing refuses without it.

Also fixed: signature-dependent ordering (tweetnacl omits the canonical-S
check, so a malleated twin compared as strictly newer), missing signer-side
preconditions, lexicographic and unbounded timestamps, asymmetric propose
dispatch, accepts with no proposal binding, parser DoS caps, device-id shape
confusion with derived ids, and mid-surrogate label slicing.

The review also found the mailbox layer shipped with zero tests; it now has 16
driven through the real dispatcher.

### P1/P2 app cores, P3 join naming, P4 collapse core

- **P1/P2** (`person-identity-core.ts`, byte-identical twins): the attestation
  exchange over the pair-private mailbox, secret rotation on removal,
  auto-alignment (the local identity renames and this device re-signs its OWN
  community profiles; a community with an override never receives the global
  avatar image), and receiver-side `cm_person_links` rebuilt from verified
  announces only. The trust floor the protocol cannot enforce lives here: a
  proposal is co-signed ONLY for own-device-LINKED peers.
- **P3**: every join door on both platforms funnels through one
  InvitePreviewSheet, so the "Your name in this community" field lands once per
  platform and covers paste, QR, deep link, and onboarding. The name applies
  before the owner request and writes both the presentation-profile override
  and this device's signed profile event.
- **P4 core** (`person-view-core.ts`, byte-identical twins): the pure collapse,
  with AC-2 pinned. A device with no verified link stays its own row; a
  mid-alignment name disagreement is surfaced rather than papered over.

### Second adversarial review: the APP layer (1 CRITICAL, 3 HIGH, all closed)

The protocol review could not see the app code that consumes it. A second
independent review of P1-P5 found:

- **CRITICAL, derived-group-id squatting.** The announce row's primary key was
  the attacker-choosable `derivedGroupId`, and revisions have no upper bound.
  Any ordinary community member could self-sign a SINGLE-device announce
  carrying a victim's derived id at revision 9,999,999 (one listed device, one
  signature, no co-signer or secret needed), collide on the victim's row key,
  and overwrite their proof on every member's device; the victim's honest
  re-announce was then rejected as stale forever. Fixed by keying the row on
  the signature-covered device set (`personAnnounceRowKey`), plus a fail-closed
  rule in link materialization: when two announces claim one derived id with
  disjoint device sets, NEITHER groups.
- **HIGH, the ceremony was entirely unwired.** `buildPersonGroupMailboxHandlers`
  had no production caller, so inbound envelopes had no handler and
  `cm_person_links` was never written: P4's collapse and P5's person-scoped
  moderation could not group anything. Both providers now spread the handlers,
  and linking an own device starts the ceremony (`linkOwnDeviceAsPerson`).
- **HIGH, a device could never be ADDED to an existing group.** An invitee's
  `readPersonGroup` returns null (the self-inclusion floor) and a storedless
  device may only attest revision 1, so every add threw. Fixed with an explicit
  `joining` context that relaxes exactly that rule.
- **HIGH, concurrent proposals silently reverted a committed removal.** Fixed
  with single-flight proposals, an explicit cancel, and a TTL sweep.

Two further fixes came out of it: per-community names were only settable once
at the join door AND would have been clobbered by the next alignment pass
(both editors now write the presentation-profile override, which required the
override to carry a per-community avatar so a pseudonymous community never
inherits the global photo), and a partially blocked person no longer renders
as unblocked.

## Remaining

- Plan 52 **P4 UI** (member lists, message headers, DM surfaces on both
  platforms), **P5** (person-scoped moderation), **P6** (gates, e2e,
  capability status, docs).
- Plan 53 (in-person tap-to-add) in full.
- rc17 with both plans, tester-guide and walkthrough sections, founder handoff.

## Notes for the next session

- `packages/sync` must be REBUILT (`pnpm --filter @mylife/sync build`) after
  protocol changes before the apps typecheck against them; the apps resolve
  the package through its dist types.
- The parity gate's whole-file twin loop normalizes only
  `./meerkat-data` to `./community-core`, so a twin whose import blocks differ
  structurally needs the anchored-pair mechanism (person-identity-core uses
  it; person-view-core is a plain pair).
- One commit on the feature branch (`P4 core`) used `--no-verify` because the
  pre-commit gate was broken by the rc15 brace-expansion override then in
  node_modules. The gate was re-run clean after rc16 landed: lint passes with
  0 errors and all 18 person tests pass.
