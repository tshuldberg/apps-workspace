/**
 * Plan 52 adversarial round 3: the two ways a person group could be forked
 * permanently, and the anti-equivocation ledger that closes both.
 *
 * Every test here is written so that it would PASS on the pre-fix code if the
 * ledger were the only thing removed, which is the point: each one asserts
 * that all the OTHER gates let the hostile document through, so a later
 * "simplification" that drops the ledger fails loudly instead of quietly
 * reopening the hole.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  assemblePersonGroupDoc,
  buildPersonGroupRevision,
  checkPersonAttestationLedger,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureSyncBootstrap,
  generatePersonGroupSecret,
  personGroupDocHash,
  personGroupProposalHash,
  signPersonCanonicalBytes,
  canonicalPersonGroupBytes,
  verifyUnsignedPersonGroupRevision,
  PERSON_GROUP_TABLE,
  type DeviceIdentity,
  type MailboxEnvelope,
  type PersonGroupDoc,
  type UnsignedPersonGroupDoc,
} from '@mylife/sync';
import { ensureSyncSchema } from '../(root)/data/sync-core';
import { ensureMeerkatTables, saveIdentityRow } from '../(root)/data/db';
import {
  buildPersonGroupMailboxHandlers,
  ensurePersonIdentityTables,
  proposePersonGroupRevision,
  readPersonAttestations,
  readPersonGroup,
  removeDevicesFromPerson,
  resetPersonGroup,
  cancelPersonProposal,
  listPendingPersonProposals,
  listInboundPersonApprovals,
  sweepStalePersonProposals,
  PERSON_PROPOSAL_TTL_MS,
  approveInboundPersonProposal,
  declineInboundPersonProposal,
  type PersonCeremonyDeps,
} from '../(root)/data/person-identity-core';

interface Device {
  test: InMemoryTestDatabase;
  db: InMemoryTestDatabase['adapter'];
  identity: DeviceIdentity;
}

const SHARED_SECRET = 'c'.repeat(64);

function makeDevice(name: string): Device {
  const test = createInMemoryTestDatabase();
  ensureMeerkatTables(test.adapter);
  ensureSyncSchema(test.adapter);
  ensurePersonIdentityTables(test.adapter);
  const boot = ensureSyncBootstrap(test.adapter, { deviceDisplayName: name });
  saveIdentityRow(test.adapter, {
    public_key: boot.identity.publicKey,
    dh_public_key: boot.identity.dhPublicKey,
    private_key_ref: boot.identity.privateKeyRef,
    display_name: name,
    created_at: '2026-07-29T12:00:00.000Z',
  });
  return { test, db: test.adapter, identity: boot.identity };
}

describe('person group fork resistance (round 3)', () => {
  let a: Device;
  let b: Device;
  let x: Device;
  /** token -> queued envelopes, so a park() has somewhere to go. */
  let parked: MailboxEnvelope[];

  function depsFor(self: Device, peers: Device[]): PersonCeremonyDeps {
    return {
      db: self.db,
      identity: self.identity,
      listOwnDeviceIds: () => peers.map((p) => p.identity.publicKey),
      listDmPeerIds: () => [],
      resolvePairedDevice: (deviceId) => {
        const peer = peers.find((p) => p.identity.publicKey === deviceId);
        return peer
          ? { dhPublicKey: peer.identity.dhPublicKey, sharedSecretHex: SHARED_SECRET }
          : null;
      },
      parkEnvelope: async (_token, envelope) => {
        parked.push(envelope);
        return true;
      },
    };
  }

  /** The personal_replica arrival of a committed doc, without the engine. */
  function replicateGroupRow(from: Device, to: Device): void {
    const row = from.db.query<Record<string, unknown>>(
      `SELECT * FROM ${PERSON_GROUP_TABLE}`,
    )[0];
    if (!row) throw new Error('source device holds no person group');
    to.db.execute(
      `INSERT OR REPLACE INTO ${PERSON_GROUP_TABLE}
         (id, group_id, revision, doc_json, secret_hex, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.group_id, row.revision, row.doc_json, row.secret_hex, row.updated_at],
    );
  }

  /** Build + self-sign a revision the way a hostile device would. */
  function forge(
    author: Device,
    previous: PersonGroupDoc,
    changes: { remove?: string[] },
    now: string,
  ): { doc: UnsignedPersonGroupDoc; signature: string } {
    const built = buildPersonGroupRevision({
      previous,
      secretHex: generatePersonGroupSecret(),
      remove: changes.remove ?? [],
      now,
    });
    if (!built.ok) throw new Error(`build failed: ${built.reason}`);
    return {
      doc: built.doc,
      signature: signPersonCanonicalBytes(author.identity, canonicalPersonGroupBytes(built.doc)),
    };
  }

  /**
   * Post a removal proposal to `to` and APPROVE it, which is what a user does.
   * Removals no longer co-sign silently (round-4 L2), so every test that needs
   * a sibling's attestation on a removal goes through this.
   */
  async function proposeAndApprove(
    to: Device,
    peers: Device[],
    from: Device,
    doc: UnsignedPersonGroupDoc,
    signature: string,
    now: string,
  ): Promise<boolean> {
    const deps = depsFor(to, peers);
    const handlers = buildPersonGroupMailboxHandlers(deps);
    await handlers.personGroupPropose!(from.identity.publicKey, {
      kind: 'person-group-propose',
      version: 1,
      doc,
      signatures: { [from.identity.publicKey]: signature },
    }, now);
    // Select by id, NOT by position: a test may have another request already
    // queued, and approving the wrong one would make the assertion meaningless.
    const wantedId = personGroupProposalHash(doc);
    const waiting = listInboundPersonApprovals(to.db, to.identity.publicKey);
    if (!waiting.some((w) => w.id === wantedId)) return false;
    return approveInboundPersonProposal(deps, wantedId);
  }

  beforeEach(async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    parked = [];
    a = makeDevice('Device A');
    b = makeDevice('Device B');
    x = makeDevice('Device X');
  });

  /**
   * Form the three-device group by hand: A assembles it and every device is
   * given the committed doc, which is what the personal_replica session does.
   */
  async function formThreeDeviceGroup(): Promise<PersonGroupDoc> {
    const secretHex = generatePersonGroupSecret();
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex,
      add: [
        { deviceId: a.identity.publicKey, label: 'Device A' },
        { deviceId: b.identity.publicKey, label: 'Device B' },
        { deviceId: x.identity.publicKey, label: 'Device X' },
      ],
      now: '2026-07-29T12:00:00.000Z',
    });
    if (!built.ok) throw new Error('genesis build failed');
    const bytes = canonicalPersonGroupBytes(built.doc);
    const assembled = assemblePersonGroupDoc(built.doc, {
      [a.identity.publicKey]: signPersonCanonicalBytes(a.identity, bytes),
      [b.identity.publicKey]: signPersonCanonicalBytes(b.identity, bytes),
      [x.identity.publicKey]: signPersonCanonicalBytes(x.identity, bytes),
    });
    for (const device of [a, b, x]) {
      device.db.execute(
        `INSERT OR REPLACE INTO ${PERSON_GROUP_TABLE}
           (id, group_id, revision, doc_json, secret_hex, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['self', assembled.groupId, assembled.revision, JSON.stringify(assembled),
          secretHex, assembled.updatedAt],
      );
    }
    return assembled;
  }

  it('HIGH-2: an expelled device cannot capture a sibling that has not yet received its removal', async () => {
    const genesis = await formThreeDeviceGroup();

    // A expels X. B co-signs through the real handler, which is what puts the
    // revision-2 entry in B's ledger.
    const removal = forge(a, genesis, { remove: [x.identity.publicKey] }, '2026-07-29T13:00:00.000Z');
    const bHandlers = buildPersonGroupMailboxHandlers(depsFor(b, [a, x]));
    const cosigned = await proposeAndApprove(
      b, [a, x], a, removal.doc, removal.signature, '2026-07-29T13:00:00.000Z',
    );
    expect(cosigned).toBe(true);
    expect(readPersonAttestations(b.db).map((e) => e.revision)).toContain(2);

    // B has NOT received the committed removal: its stored doc is still rev 1
    // and still lists X.
    expect(readPersonGroup(b.db, b.identity.publicKey)?.doc.revision).toBe(1);

    // X, expelled on A but still listed in B's stale doc, proposes a rival
    // revision 2 that drops A and keeps itself.
    const capture = forge(x, genesis, { remove: [a.identity.publicKey] }, '2026-07-29T14:00:00.000Z');

    // EVERY OTHER GATE PASSES. This is the assertion that keeps the test
    // honest: against B's stale state the capture doc is structurally valid,
    // correctly parented, and forgets no tombstone, so nothing but the ledger
    // is standing between X and B's signature.
    expect(verifyUnsignedPersonGroupRevision(capture.doc, {
      selfDeviceId: b.identity.publicKey,
      stored: genesis,
      now: Date.parse('2026-07-29T14:00:00.000Z'),
    })).toEqual({ ok: true });
    expect(capture.doc.parentHash).toBe(personGroupDocHash(genesis));
    expect(genesis.removed).toEqual([]);

    const captured = await bHandlers.personGroupPropose!(x.identity.publicKey, {
      kind: 'person-group-propose',
      version: 1,
      doc: capture.doc,
      signatures: { [x.identity.publicKey]: capture.signature },
    }, '2026-07-29T14:00:00.000Z');
    expect(captured).toBe(false);

    // B is unchanged: still on the genesis revision, still A's sibling.
    const stored = readPersonGroup(b.db, b.identity.publicKey);
    expect(stored?.doc.revision).toBe(1);
    expect(stored?.doc.devices.map((d) => d.deviceId)).toContain(a.identity.publicKey);
  });

  // Defense in depth, not a unique guarantee: once the removal has replicated,
  // the expelled device is out of `devices` too, so the pre-existing
  // current-member gate already refuses it. Verified by mutation: this one
  // still passes with BOTH new gates disabled. It is kept because the
  // `removed` check is the one that survives a future refactor of the member
  // gate, since the tombstone set is signed and the membership list is not
  // consulted the same way everywhere.
  it('an expelled device cannot propose once the removal has replicated', async () => {
    const genesis = await formThreeDeviceGroup();
    const removal = forge(a, genesis, { remove: [x.identity.publicKey] }, '2026-07-29T13:00:00.000Z');
    const bytes = canonicalPersonGroupBytes(removal.doc);
    const committed = assemblePersonGroupDoc(removal.doc, {
      [a.identity.publicKey]: removal.signature,
      [b.identity.publicKey]: signPersonCanonicalBytes(b.identity, bytes),
    });
    a.db.execute(
      `INSERT OR REPLACE INTO ${PERSON_GROUP_TABLE}
         (id, group_id, revision, doc_json, secret_hex, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ['self', committed.groupId, committed.revision, JSON.stringify(committed),
        generatePersonGroupSecret(), committed.updatedAt],
    );
    replicateGroupRow(a, b);
    expect(readPersonGroup(b.db, b.identity.publicKey)?.doc.removed)
      .toEqual([x.identity.publicKey]);

    // A device named in the SIGNED tombstone set may not propose at all, even
    // though its own-device link on B was never revoked (removeDmOwnDevice is
    // local to the device that performed the removal).
    const retry = forge(x, committed, {}, '2026-07-29T15:00:00.000Z');
    const bHandlers = buildPersonGroupMailboxHandlers(depsFor(b, [a, x]));
    expect(await bHandlers.personGroupPropose!(x.identity.publicKey, {
      kind: 'person-group-propose',
      version: 1,
      doc: retry.doc,
      signatures: { [x.identity.publicKey]: retry.signature },
    }, '2026-07-29T15:00:00.000Z')).toBe(false);
  });

  it('HIGH-1: a device that co-signed one revision refuses to author a rival at the same number', async () => {
    const genesis = await formThreeDeviceGroup();

    // B co-signs A's removal of X.
    const removal = forge(a, genesis, { remove: [x.identity.publicKey] }, '2026-07-29T13:00:00.000Z');
    expect(await proposeAndApprove(
      b, [a, x], a, removal.doc, removal.signature, '2026-07-29T13:00:00.000Z',
    )).toBe(true);

    // The user now removes a DIFFERENT device on B before A's change arrives.
    // Pre-fix this produced a second revision 2 on a divergent lineage, and the
    // two were irreconcilable forever. Now it refuses, so the group simply
    // stays where it is and the user can retry once the devices agree.
    const result = await removeDevicesFromPerson(depsFor(b, [a, x]), [a.identity.publicKey]);
    expect(result).toEqual({ ok: false, reason: 'conflicted' });
    expect(readPersonGroup(b.db, b.identity.publicKey)?.doc.revision).toBe(1);
  });

  it('HIGH-1: resetPersonGroup is a real way out of a group that can no longer agree', async () => {
    await formThreeDeviceGroup();
    const removal = forge(
      a,
      readPersonGroup(b.db, b.identity.publicKey)!.doc,
      { remove: [x.identity.publicKey] },
      '2026-07-29T13:00:00.000Z',
    );
    await proposeAndApprove(b, [a, x], a, removal.doc, removal.signature, '2026-07-29T13:00:00.000Z');
    expect(await removeDevicesFromPerson(depsFor(b, [a, x]), [a.identity.publicKey]))
      .toEqual({ ok: false, reason: 'conflicted' });

    resetPersonGroup(b.db);
    expect(readPersonGroup(b.db, b.identity.publicKey)).toBeNull();
    expect(readPersonAttestations(b.db)).toEqual([]);

    // A fresh genesis is possible again, which is the whole point.
    const rebuilt = await proposePersonGroupRevision(depsFor(b, []), {});
    expect(rebuilt.ok).toBe(true);
    expect(readPersonGroup(b.db, b.identity.publicKey)?.doc.revision).toBe(1);
  });

  it('L1: cancelling a PARKED proposal does not free its revision for a rival', async () => {
    // Round-4 L1. The author's signature ships inside every parked PROPOSE
    // payload, so a hostile sibling holds the exact bytes and can assemble that
    // revision itself. If cancelling handed the number back, this device could
    // commit a different revision 2 and the two lineages would fork forever.
    await formThreeDeviceGroup();
    const first = await removeDevicesFromPerson(depsFor(a, [b, x]), [x.identity.publicKey]);
    expect(first.ok && first.assembled).toBe(false);
    expect(parked.length).toBeGreaterThan(0);

    const pendingRow = listPendingPersonProposals(a.db)[0]!;
    cancelPersonProposal(a.db, pendingRow.id);
    expect(listPendingPersonProposals(a.db)).toHaveLength(0);

    // A DIFFERENT change at the same revision is refused, not silently forked.
    const rival = await removeDevicesFromPerson(depsFor(a, [b, x]), [b.identity.publicKey]);
    expect(rival).toEqual({ ok: false, reason: 'conflicted' });
    expect(readPersonGroup(a.db, a.identity.publicKey)?.doc.revision).toBe(1);
  });

  it('L1: cancel-then-retry with the SAME intent still works, by reviving the identical doc', async () => {
    await formThreeDeviceGroup();
    await removeDevicesFromPerson(depsFor(a, [b, x]), [x.identity.publicKey]);
    const original = listPendingPersonProposals(a.db)[0]!;
    cancelPersonProposal(a.db, original.id);

    const retry = await removeDevicesFromPerson(depsFor(a, [b, x]), [x.identity.publicKey]);
    expect(retry.ok).toBe(true);
    // The SAME proposal id, meaning the same signed bytes were re-parked rather
    // than a rival doc being built. That is what makes the retry safe.
    expect(retry.ok && retry.proposalId).toBe(original.id);
    const revived = listPendingPersonProposals(a.db);
    expect(revived).toHaveLength(1);
    expect(revived[0]!.doc_json).toBe(original.doc_json);
  });

  it('L2: a sibling does NOT silently co-sign a removal; it waits for the user', async () => {
    // Round-4 L2. Without consent, a compromised-but-still-linked device could
    // expel the owner's main device pre-emptively, and every sibling that
    // auto-signed it would then be unable to co-sign the owner's legitimate
    // counter-removal, because a device may not sign twice at one revision.
    const genesis = await formThreeDeviceGroup();
    const hostile = forge(x, genesis, { remove: [a.identity.publicKey] }, '2026-07-29T13:00:00.000Z');
    const bHandlers = buildPersonGroupMailboxHandlers(depsFor(b, [a, x]));

    const signed = await bHandlers.personGroupPropose!(x.identity.publicKey, {
      kind: 'person-group-propose',
      version: 1,
      doc: hostile.doc,
      signatures: { [x.identity.publicKey]: hostile.signature },
    }, '2026-07-29T13:00:00.000Z');

    // Nothing signed, nothing attested: the user has not been asked yet.
    expect(signed).toBe(false);
    expect(readPersonAttestations(b.db).some((e) => e.revision === 2)).toBe(false);

    // It is surfaced for a decision, naming exactly which device would go.
    const waiting = listInboundPersonApprovals(b.db, b.identity.publicKey);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.removes).toEqual([a.identity.publicKey]);
    expect(waiting[0]!.senderDeviceId).toBe(x.identity.publicKey);

    // Because B never attested revision 2, A's legitimate removal of X still
    // gets its co-signature. That is the race the consent step closes.
    // A's legitimate removal of X also asks first, as it must. What matters is
    // that it CAN still be approved: B never attested revision 2, so the
    // attacker did not burn it.
    const legit = forge(a, genesis, { remove: [x.identity.publicKey] }, '2026-07-29T13:30:00.000Z');
    expect(await proposeAndApprove(
      b, [a, x], a, legit.doc, legit.signature, '2026-07-29T13:30:00.000Z',
    )).toBe(true);
    expect(readPersonAttestations(b.db).some((e) => e.revision === 2)).toBe(true);
  });

  it('L2: declining a removal signs nothing and clears it', async () => {
    const genesis = await formThreeDeviceGroup();
    const hostile = forge(x, genesis, { remove: [a.identity.publicKey] }, '2026-07-29T13:00:00.000Z');
    const bHandlers = buildPersonGroupMailboxHandlers(depsFor(b, [a, x]));
    await bHandlers.personGroupPropose!(x.identity.publicKey, {
      kind: 'person-group-propose',
      version: 1,
      doc: hostile.doc,
      signatures: { [x.identity.publicKey]: hostile.signature },
    }, '2026-07-29T13:00:00.000Z');

    const waiting = listInboundPersonApprovals(b.db, b.identity.publicKey);
    declineInboundPersonProposal(b.db, waiting[0]!.id);
    expect(listInboundPersonApprovals(b.db, b.identity.publicKey)).toHaveLength(0);
    expect(readPersonAttestations(b.db).some((e) => e.revision === 2)).toBe(false);
    expect(readPersonGroup(b.db, b.identity.publicKey)?.doc.revision).toBe(1);
  });

  it('L2: approving a removal runs the same gates and DOES co-sign', async () => {
    const genesis = await formThreeDeviceGroup();
    const removal = forge(a, genesis, { remove: [x.identity.publicKey] }, '2026-07-29T13:00:00.000Z');
    const deps = depsFor(b, [a, x]);
    const bHandlers = buildPersonGroupMailboxHandlers(deps);
    await bHandlers.personGroupPropose!(a.identity.publicKey, {
      kind: 'person-group-propose',
      version: 1,
      doc: removal.doc,
      signatures: { [a.identity.publicKey]: removal.signature },
    }, '2026-07-29T13:00:00.000Z');

    const waiting = listInboundPersonApprovals(b.db, b.identity.publicKey);
    expect(waiting).toHaveLength(1);
    parked.length = 0;
    expect(await approveInboundPersonProposal(deps, waiting[0]!.id)).toBe(true);
    // An accept really was parked back, and the attestation is now recorded.
    expect(parked.length).toBe(1);
    expect(readPersonAttestations(b.db).some((e) => e.revision === 2)).toBe(true);
    expect(listInboundPersonApprovals(b.db, b.identity.publicKey)).toHaveLength(0);
  });

  it('L2: ADDING a device is still co-signed silently, with no prompt', async () => {
    // The friction is deliberately asymmetric: an add costs the user nothing.
    const secretHex = generatePersonGroupSecret();
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex,
      add: [
        { deviceId: a.identity.publicKey, label: 'Device A' },
        { deviceId: b.identity.publicKey, label: 'Device B' },
      ],
      now: '2026-07-29T12:00:00.000Z',
    });
    if (!built.ok) throw new Error('build failed');
    const signature = signPersonCanonicalBytes(a.identity, canonicalPersonGroupBytes(built.doc));
    const bHandlers = buildPersonGroupMailboxHandlers(depsFor(b, [a]));
    expect(await bHandlers.personGroupPropose!(a.identity.publicKey, {
      kind: 'person-group-propose',
      version: 1,
      doc: built.doc,
      signatures: { [a.identity.publicKey]: signature },
    }, '2026-07-29T12:00:00.000Z')).toBe(true);
    expect(listInboundPersonApprovals(b.db, b.identity.publicKey)).toHaveLength(0);
  });

  // Round-5 V2. The invariant is about the SHAPE, not the mechanism: whichever
  // way a proposal is abandoned, an identical retry must still work. Cancel
  // satisfied it; expiry did not, because the sweep deleted the only copy of
  // the bytes this device had signed while deliberately keeping the
  // attestation, leaving the revision spoken for by a document that existed
  // nowhere. Reachable with no user error and no adversary: link a device, do
  // not open the other one for a day.
  for (const abandon of ['cancelled', 'expired'] as const) {
    it(`V2: after a proposal is ${abandon}, an identical retry still succeeds`, async () => {
      await formThreeDeviceGroup();
      const first = await removeDevicesFromPerson(depsFor(a, [b, x]), [x.identity.publicKey]);
      expect(first.ok && first.assembled).toBe(false);
      const original = listPendingPersonProposals(a.db)[0]!;

      if (abandon === 'cancelled') {
        cancelPersonProposal(a.db, original.id);
      } else {
        expect(sweepStalePersonProposals(a.db, Date.now() + PERSON_PROPOSAL_TTL_MS + 1)).toBe(1);
      }
      expect(listPendingPersonProposals(a.db)).toHaveLength(0);

      const retry = await removeDevicesFromPerson(depsFor(a, [b, x]), [x.identity.publicKey]);
      expect(retry.ok).toBe(true);
      // The SAME bytes were re-parked, which is what makes the retry safe.
      expect(retry.ok && retry.proposalId).toBe(original.id);
      expect(listPendingPersonProposals(a.db)[0]!.doc_json).toBe(original.doc_json);
    });
  }

  it('MEDIUM-3: a removal still waiting on a co-signer does not revoke the link or rotate the key', async () => {
    const genesis = await formThreeDeviceGroup();
    const revoked: string[] = [];
    const deps: PersonCeremonyDeps = {
      ...depsFor(a, [b, x]),
      revokeOwnDeviceLink: (id) => { revoked.push(id); },
    };

    const result = await removeDevicesFromPerson(deps, [x.identity.publicKey]);
    expect(result.ok).toBe(true);
    // Three devices means the removal needs B's signature, so it is PENDING.
    expect(result.ok && result.assembled).toBe(false);
    // Nothing may have been revoked yet, and the stored group must still be the
    // one every device signed, under the unchanged secret.
    expect(revoked).toEqual([]);
    const stored = readPersonGroup(a.db, a.identity.publicKey);
    expect(stored?.doc.revision).toBe(genesis.revision);
    expect(stored?.doc.devices.map((d) => d.deviceId)).toContain(x.identity.publicKey);
    expect(stored?.doc.removed).toEqual([]);
  });

  it('MEDIUM-3: a removal that completes alone does revoke immediately', async () => {
    // Two devices: A can assemble the removal by itself, so the claim that the
    // device is gone and the key rotated is TRUE and must still be made.
    const secretHex = generatePersonGroupSecret();
    const built = buildPersonGroupRevision({
      previous: null,
      secretHex,
      add: [
        { deviceId: a.identity.publicKey, label: 'Device A' },
        { deviceId: x.identity.publicKey, label: 'Device X' },
      ],
      now: '2026-07-29T12:00:00.000Z',
    });
    if (!built.ok) throw new Error('build failed');
    const bytes = canonicalPersonGroupBytes(built.doc);
    const assembled = assemblePersonGroupDoc(built.doc, {
      [a.identity.publicKey]: signPersonCanonicalBytes(a.identity, bytes),
      [x.identity.publicKey]: signPersonCanonicalBytes(x.identity, bytes),
    });
    a.db.execute(
      `INSERT OR REPLACE INTO ${PERSON_GROUP_TABLE}
         (id, group_id, revision, doc_json, secret_hex, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ['self', assembled.groupId, 1, JSON.stringify(assembled), secretHex, assembled.updatedAt],
    );

    const revoked: string[] = [];
    const result = await removeDevicesFromPerson({
      ...depsFor(a, [x]),
      revokeOwnDeviceLink: (id) => { revoked.push(id); },
    }, [x.identity.publicKey]);

    expect(result.ok && result.assembled).toBe(true);
    expect(revoked).toEqual([x.identity.publicKey]);
    const stored = readPersonGroup(a.db, a.identity.publicKey);
    expect(stored?.doc.removed).toEqual([x.identity.publicKey]);
    expect(stored?.secretHex).not.toBe(secretHex);
  });
});

describe('checkPersonAttestationLedger', () => {
  const base = (revision: number, devices: string[], removed: string[] = []): UnsignedPersonGroupDoc => ({
    version: 1,
    secretCommitment: 'a'.repeat(32),
    groupId: 'b'.repeat(32),
    revision,
    devices: devices.map((deviceId) => ({ deviceId, label: 'D', addedAt: '2026-07-29T12:00:00.000Z' })),
    removed,
    parentHash: null,
    updatedAt: '2026-07-29T12:00:00.000Z',
  });

  const d1 = '1'.repeat(64);
  const d2 = '2'.repeat(64);

  it('allows a doc at a revision the device has never attested', () => {
    expect(checkPersonAttestationLedger([], base(1, [d1, d2]))).toEqual({ ok: true });
  });

  it('allows re-signing the SAME doc, so a retry or an announce re-sign still works', () => {
    const doc = base(2, [d1, d2]);
    const ledger = [{
      revision: 2,
      docHash: personGroupDocHash({ ...doc, signatures: {} }),
      removed: [],
    }];
    expect(checkPersonAttestationLedger(ledger, doc)).toEqual({ ok: true });
  });

  it('refuses a DIFFERENT doc at an already-attested revision', () => {
    const ledger = [{ revision: 2, docHash: 'f'.repeat(32), removed: [] }];
    expect(checkPersonAttestationLedger(ledger, base(2, [d1, d2])))
      .toEqual({ ok: false, reason: 'equivocation' });
  });

  it('does NOT block a deliberate re-add at a later revision', () => {
    // The tombstone rules in verifyUnsignedPersonGroupRevision govern re-adds.
    // The ledger must not second-guess them, or a device removed once could
    // never be relinked. Anti-equivocation is sufficient on its own: a
    // revision only commits when EVERY listed device signs it, so a device
    // that is still a member cannot be unaware of a committed removal without
    // having attested it.
    const ledger = [{ revision: 2, docHash: 'f'.repeat(32), removed: [d2] }];
    expect(checkPersonAttestationLedger(ledger, base(3, [d1, d2]))).toEqual({ ok: true });
  });

  it('an attestation is never given back, so a cancelled proposal keeps its revision', () => {
    // Round-4 L1: retraction was removed. A parked proposal put this device's
    // signature in a peer's hands, and Ed25519 is deterministic, so that peer
    // holds the identical bytes and can assemble that revision itself. Handing
    // the number back would let this device commit a rival and fork.
    const mine = base(2, [d1, d2]);
    const ledger = [{
      revision: 2,
      docHash: personGroupDocHash({ ...mine, signatures: {} }),
      removed: [],
    }];
    expect(checkPersonAttestationLedger(ledger, base(2, [d1])))
      .toEqual({ ok: false, reason: 'equivocation' });
    // The identical doc is still fine, which is what reviving a cancelled
    // proposal re-parks.
    expect(checkPersonAttestationLedger(ledger, mine)).toEqual({ ok: true });
  });
});
