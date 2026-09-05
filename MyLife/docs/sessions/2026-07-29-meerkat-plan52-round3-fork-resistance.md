# Plan 52 completion and round-3 fork resistance

Date: 2026-07-29
Branch: `feature/meerkat-plan52-person-identity` (not yet merged to main; it also carries the plan 53 work that followed)
Commits: `a8181491` (P6), `59cfcf13` (round 3), `0242ed6f` + `38d27aa4` (round 4), `5163c238` (round 5)

## What this session did

Finished plan 52 P6 (capability entries, e2e coverage, tester guide) and then
acted on the third adversarial review, which found two ways to fork a person
group permanently. Both are fixed and pinned.

## P6: the last of the plan-52 scope

Added the two capability-status entries on both platforms and a launch-path e2e
proving the M-3 guarantee: a per-community name chosen at the join door stays
editable afterwards and the edit persists rather than being reverted by the
alignment pass.

The first version of that test passed vacuously through a fallback branch. It
was rewritten to fail if the editor is not actually exercised, which
immediately surfaced a real defect: saving a community profile shows no
confirmation at all, because the success notice is set on state the provider
refresh discards. The save itself works. The defect predates this branch (the
old save had the same shape) and is logged in `errors_log.md` as Unresolved.
The save copy is instead locked statically in `check-meerkat-parity` on both
surfaces, since an end-to-end test cannot observe a notice that does not
survive.

## Round 3: the two fork routes

The reviewer confirmed resurrection is closed, and that `parentHash` (not the
tombstone) is what rejects a strict-successor re-admit. It then found that the
mechanism closing resurrection introduces two new problems, both confirmed with
proofs.

**HIGH-2, the live security path.** `removeDmOwnDevice` is a local delete, and
`dm_own_devices` never replicates, so expelling a device revokes its link only
on the device that performed the removal. A sibling that co-signed the removal
but has not yet RECEIVED the committed document still holds the old one.
Against that stale view, the expelled device could propose a rival revision
that drops an honest sibling, and every other gate passed: it was still listed,
the parent matched, and the old document carried no tombstone to preserve. The
sibling would co-sign its own capture, permanently.

**HIGH-1, data integrity.** Two devices removing different siblings
concurrently produced two lineages that each correctly rejected the other. Even
a later document that forgot nothing was rejected as `wrong_parent` forever,
and a fresh `groupId` is rejected as a group mismatch, so there was no way back
at all.

### The fix: anti-equivocation

One rule closes both, because both depend on a sibling attesting twice: a
device must never sign two different documents at the same revision. Each
device keeps a device-local ledger (`mk_person_attestations`, never
replicated, since a sibling's ledger is not evidence about what this device
attested) and refuses to sign against it.

For HIGH-2 the captured sibling had already attested a different document at
that revision, so it refuses. For HIGH-1 neither rival document can collect a
full signature set, so nothing commits and the group stays where it was; the
stalled ceremony expires on the TTL sweep and the user retries. A stall is
recoverable, a fork is not.

### What was deliberately not done

The reviewer suggested requiring a dropped device to sign its own removal. That
was rejected: it would equally block removing a device that is lost, stolen, or
broken, which is the entire purpose of removal. What separates the attack from
a legitimate expulsion is that the signer is being asked to contradict itself,
not who is being dropped.

An additional "never re-list a device I attested as removed" rule was written,
then removed when an existing test caught that it forbids the deliberate re-add
`preservesRemovals` exists to permit. It is also unnecessary: a revision only
commits when every listed device signs it, so a device that is still a member
cannot be unaware of a committed removal without having attested it. The stale
window and the ledger entry always coincide.

### Retraction, and why it did not survive

An existing test caught that a cancelled proposal was burning its revision
number, permanently blocking "cancel the waiting confirmation, then link
again". Round 3 answered that by retracting the attestation for an abandoned
proposal. Round 4 showed that answer was unsound and it was removed; see the
Round 4 section below for what replaced it.

### Recovery

`resetPersonGroup` plus a "Start my device group over" control on both surfaces
is the escape hatch for any fork that still occurs. A design that can refuse
everything must also offer a way out, or the user's only remedy is reinstalling
the app. It is local only: the siblings keep their own group until each is
reset, which is the honest cost, since the alternative would be a resurrection
primitive.

## MEDIUM-3 and the smaller findings

Removal revoked the link and claimed a new key was generated while the ceremony
was still pending. With three or more devices a removal needs a co-signer, so
the device was still a full member under the unchanged secret, and the rotated
secret existed only inside the pending proposal. For a lost or stolen device
that is a materially false claim, and after 24 hours the TTL sweep would
silently discard the removal. Revocation is now gated on the removal actually
committing, and the pending case states plainly that the device is still yours
and the key has not changed.

Also fixed: the `pi_` sync policy now fails closed, so a table added later
without an explicit rule replicates nothing rather than inheriting
`personal_replica`; `applyDmPersonAnnounce` binds the `@dm` scope to dm-peer
contexts and drops contested ids like the community path does; and
`setCommunityProfile` routes through the presentation rail on both providers
instead of writing a profile event that alignment would revert.

## Verification

- sync 2,475, relay 1,587, app 1,454, web 1,038. Total 6,554 against the 6,404
  rc12 baseline.
- `check-meerkat-parity` green (1,152 checks), transport NC gate green,
  `gate:function:changed` green.
- Every new behavioural test was mutation-checked: all four fail with the
  ledger removed, and the HIGH-2 test additionally asserts that all the other
  gates DO pass, so a later simplification that drops the ledger fails loudly
  rather than quietly reopening the hole.
- One test was renamed after mutation testing showed it passed through a
  different, pre-existing gate than its name claimed.

## Round 4

A fourth review pass confirmed both round-3 departures were right, and found
two further things.

**L1, confirmed and fixed.** The retraction added in round 3 rested on a false
premise. Its comment claimed only the author holds an unassembled proposal, so
nobody else could assemble it. The first half is true; the second is not. The
author's signature ships inside every parked PROPOSE payload, and Ed25519 is
deterministic, so from the moment a proposal is parked a recipient holds the
identical bytes. A cancel that handed the revision number back therefore let
this device commit a rival, and a hostile sibling could assemble the original
using the author's own signature: a permanent fork, reachable by exactly the
adversary the ledger was built for.

Retraction is gone, including the protocol primitive so it cannot come back by
accident. A cancelled proposal is kept and its revision stays spoken for.
"Cancel, then link again" still works because a retry with the same intent
revives that row and re-parks the identical signed bytes rather than building a
rival. A retry with a different intent is honestly refused.

**L2, a consequence rather than a defect, closed by founder decision.** The
ledger changed conflict resolution from last-writer-wins to first-mover-wins,
which made expelling a compromised device a race the compromised device could
win pre-emptively: propose dropping the owner's main phone, let every sibling
co-sign silently, and the owner's counter-removal can no longer be co-signed.

The founder chose to close it rather than document it. Removals now require
approval on the co-signing device; adds stay silent, because an add costs the
user nothing and the proposer is already safety-code verified. Approval runs
the identical co-sign path, with every gate re-evaluated at approval time
rather than arrival time.

## Still open

- The `account.test.ts` intermittent failure remains Unresolved. It did not
  reproduce in this session's web runs.
- The missing save confirmation on the community profile editor.
- Plan 53, with AC-3 resolved as the founder's "fix the plumbing first": the
  native `advertise()` must mint a fresh `MCPeerID` per call from the
  caller-supplied ephemeral id, and Android must honour `serviceType`. Device
  evidence stays honestly open until TestFlight.
