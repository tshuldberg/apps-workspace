/**
 * File request / grant mailbox (Files & Sharing Phase 3), unit layer.
 *
 * The new FILE_REQUEST and FILE_GRANT kinds ride the EXACT pair-private mailbox
 * path: sealed to the recipient's DH key, signed by the sender, addressed by a
 * pair-private token. The relay sees only ciphertext. These tests mirror
 * mailbox.test.ts / channel-mailbox.test.ts:
 *   - round-trip both kinds;
 *   - fail-closed on tamper / wrong recipient / forged signature / wrong kind;
 *   - buildFileGrant re-verifies the owner's local bytes before sealing
 *     (decline when drifted/absent, never seal garbage);
 *   - applyFileGrant reassembles + re-verifies against the requester's OWN
 *     signed-event hash and writes verify-then-pin (and rejects swapped bytes,
 *     incomplete blocks, and a wrong-slot grant without writing).
 */

import { describe, expect, it, vi } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { blobContentHash } from '../protocol/blob-transfer';
import {
  applyFileGrant,
  buildFileDecline,
  buildFileGrant,
  fileRequestId,
  openFileGrantMailbox,
  openFileRequestMailbox,
  sealFileGrantMailbox,
  sealFileRequestMailbox,
  type FileRequestFields,
} from '../protocol/file-request-mailbox';

const SECRET = 'ab'.repeat(32);
const MODULE_ID = 'community';

function fileBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function fieldsFor(bytes: Uint8Array, requester: ReturnType<typeof generateDeviceIdentity>): FileRequestFields {
  const blobHash = blobContentHash(bytes);
  const base = {
    communityId: 'c1',
    channelId: 'general',
    messageId: 'msg_1',
    attachmentId: 'att_1',
    blobHash,
  };
  return { ...base, requestId: fileRequestId(base, requester.publicKey) };
}

describe('fileRequestId (stable per logical request)', () => {
  it('is stable for the same inputs and differs per requester / blob', () => {
    const requester = generateDeviceIdentity('Phone');
    const other = generateDeviceIdentity('Tablet');
    const base = { communityId: 'c1', channelId: 'general', messageId: 'm', attachmentId: 'a', blobHash: 'ab'.repeat(64) };
    expect(fileRequestId(base, requester.publicKey)).toBe(fileRequestId(base, requester.publicKey));
    expect(fileRequestId(base, requester.publicKey)).not.toBe(fileRequestId(base, other.publicKey));
    expect(fileRequestId(base, requester.publicKey))
      .not.toBe(fileRequestId({ ...base, blobHash: 'cd'.repeat(64) }, requester.publicKey));
  });
});

describe('FILE_REQUEST round-trip + fail-closed', () => {
  it('round-trips request fields to the addressed owner with sender authenticated', () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const fields = fieldsFor(fileBytes('hello'), requester);

    const sealed = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: SECRET,
      fields,
    });
    expect(sealed.token).toMatch(/^[0-9a-f]{64}$/);

    const opened = openFileRequestMailbox(owner, sealed.envelope);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.senderDeviceId).toBe(requester.publicKey);
      expect(opened.payload.blobHash).toBe(fields.blobHash);
      expect(opened.payload.requestId).toBe(fields.requestId);
    }
  });

  it('the relay sees no identities or file metadata on the wire', () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const fields = fieldsFor(fileBytes('secret'), requester);
    const sealed = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: SECRET,
      fields,
    });
    const wire = JSON.stringify(sealed.envelope);
    expect(wire.includes(requester.publicKey)).toBe(false);
    expect(wire.includes(owner.publicKey)).toBe(false);
    expect(wire.includes(fields.blobHash)).toBe(false);
    expect(wire.includes('meerkat.file-request-v1')).toBe(false);
  });

  it('fail-closed: tampered ciphertext -> decrypt_failed', () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const sealed = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: SECRET,
      fields: fieldsFor(fileBytes('x'), requester),
    });
    const tail = sealed.envelope.sealedHex.slice(-2) === '00' ? 'ff' : '00';
    const tampered = { ...sealed.envelope, sealedHex: sealed.envelope.sealedHex.slice(0, -2) + tail };
    const result = openFileRequestMailbox(owner, tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('decrypt_failed');
  });

  it('fail-closed: wrong recipient -> decrypt_failed (cannot reach the box)', () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const snoop = generateDeviceIdentity('Relay Operator');
    const sealed = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: SECRET,
      fields: fieldsFor(fileBytes('x'), requester),
    });
    const result = openFileRequestMailbox(snoop, sealed.envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('decrypt_failed');
  });

  it('fail-closed: swapped signature -> invalid_signature', () => {
    const requester = generateDeviceIdentity('Phone');
    const evil = generateDeviceIdentity('Evil');
    const owner = generateDeviceIdentity('Desktop');
    const honest = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: SECRET,
      fields: fieldsFor(fileBytes('x'), requester),
    });
    const evilEnvelope = sealFileRequestMailbox({
      sender: evil,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: SECRET,
      fields: fieldsFor(fileBytes('y'), evil),
    });
    const swapped = { ...honest.envelope, signature: evilEnvelope.envelope.signature };
    const result = openFileRequestMailbox(owner, swapped);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_signature');
  });

  it('fail-closed: a grant envelope opened as a request -> invalid_payload (wrong kind)', () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const fields = fieldsFor(fileBytes('x'), requester);
    const grant = sealFileGrantMailbox({
      sender: owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      payload: { kind: 'meerkat.file-grant-v1', version: 1, ...fields, decision: 'decline', reason: 'declined' },
    });
    const result = openFileRequestMailbox(requester, grant.envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_payload');
  });
});

describe('buildFileGrant (owner SEND-side verify-before-trust)', () => {
  it('seals an approve grant after re-verifying local bytes match the requested hash', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const bytes = fileBytes('the real file '.repeat(2000)); // multi-block
    const fields = fieldsFor(bytes, requester);

    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      request: fields,
      moduleId: MODULE_ID,
      getBlobBytes: (hash) => (hash === fields.blobHash ? bytes : null),
      mimeType: 'text/plain',
    });

    expect(grant.payload.decision).toBe('approve');
    const opened = openFileGrantMailbox(requester, grant.envelope);
    expect(opened.ok).toBe(true);
    if (opened.ok && opened.payload.decision === 'approve') {
      expect(opened.payload.blocks.length).toBeGreaterThan(1);
      expect(opened.payload.blocks.every((b) => b.hash === fields.blobHash)).toBe(true);
    }
  });

  it('declines (owner_no_longer_has_file) when the owner no longer holds the bytes', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const fields = fieldsFor(fileBytes('gone'), requester);

    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      request: fields,
      moduleId: MODULE_ID,
      getBlobBytes: () => null,
    });
    expect(grant.payload.decision).toBe('decline');
    if (grant.payload.decision === 'decline') {
      expect(grant.payload.reason).toBe('owner_no_longer_has_file');
    }
  });

  it('NEVER seals garbage: if local bytes drifted from the requested hash, it declines', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const fields = fieldsFor(fileBytes('original'), requester);

    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      request: fields,
      moduleId: MODULE_ID,
      // The owner's local bytes for this hash now hash to something else.
      getBlobBytes: () => fileBytes('TAMPERED'),
    });
    expect(grant.payload.decision).toBe('decline');
    if (grant.payload.decision === 'decline') {
      expect(grant.payload.reason).toBe('owner_no_longer_has_file');
    }
  });
});

describe('applyFileGrant (requester RECEIVE-side verify-then-pin)', () => {
  it('writes the bytes exactly once after re-verifying against the requester own signed hash', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const bytes = fileBytes('restore me');
    const fields = fieldsFor(bytes, requester);

    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      request: fields,
      moduleId: MODULE_ID,
      getBlobBytes: () => bytes,
      mimeType: 'text/plain',
    });

    const putBlob = vi.fn();
    const result = await applyFileGrant({
      recipient: requester,
      envelope: grant.envelope,
      expectedBlobHash: fields.blobHash,
      putBlob,
      moduleId: MODULE_ID,
    });

    expect(result.ok).toBe(true);
    expect(result.restored).toBe(true);
    expect(putBlob).toHaveBeenCalledTimes(1);
    const [hashArg, bytesArg] = putBlob.mock.calls[0]!;
    expect(hashArg).toBe(fields.blobHash);
    expect(blobContentHash(bytesArg as Uint8Array)).toBe(fields.blobHash);
  });

  it('a decline grant returns restored:false with the reason and never calls putBlob', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const fields = fieldsFor(fileBytes('x'), requester);

    const grant = buildFileDecline(
      {
        owner,
        recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
        pairSharedSecretHex: SECRET,
        request: fields,
      },
      'declined',
    );

    const putBlob = vi.fn();
    const result = await applyFileGrant({
      recipient: requester,
      envelope: grant.envelope,
      expectedBlobHash: fields.blobHash,
      putBlob,
      moduleId: MODULE_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.restored).toBe(false);
    if (result.ok && !result.restored) expect(result.reason).toBe('declined');
    expect(putBlob).not.toHaveBeenCalled();
  });

  it('ADVERSARIAL: a malicious owner returning different bytes is rejected, putBlob NOT called', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const realBytes = fileBytes('what the requester signed');
    const fields = fieldsFor(realBytes, requester);

    // The owner approves but ships ATTACKER bytes whose hash differs. The owner
    // forges the grant header to claim the requested blobHash (the wire claim),
    // but the reassembled bytes will not match the requester's own signed hash.
    const attackerBytes = fileBytes('attacker chosen content');
    const grant = sealFileGrantMailbox({
      sender: owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      payload: {
        kind: 'meerkat.file-grant-v1',
        version: 1,
        ...fields,
        decision: 'approve',
        // Blocks claim the requested hash but carry attacker bytes.
        blocks: [
          {
            hash: fields.blobHash,
            moduleId: MODULE_ID,
            index: 0,
            total: 1,
            totalBytes: attackerBytes.length,
            mimeType: 'text/plain',
            dataHex: Buffer.from(attackerBytes).toString('hex'),
          },
        ],
      },
    });

    const putBlob = vi.fn();
    const result = await applyFileGrant({
      recipient: requester,
      envelope: grant.envelope,
      expectedBlobHash: fields.blobHash, // the requester's OWN signed hash
      putBlob,
      moduleId: MODULE_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('hash_mismatch');
    expect(putBlob).not.toHaveBeenCalled();
  });

  it('a grant for a DIFFERENT slot than expected is rejected without writing', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const bytes = fileBytes('slot a');
    const fields = fieldsFor(bytes, requester);

    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      request: fields,
      moduleId: MODULE_ID,
      getBlobBytes: () => bytes,
    });

    const putBlob = vi.fn();
    const result = await applyFileGrant({
      recipient: requester,
      envelope: grant.envelope,
      expectedBlobHash: blobContentHash(fileBytes('a completely different file')),
      putBlob,
      moduleId: MODULE_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expected_mismatch');
    expect(putBlob).not.toHaveBeenCalled();
  });

  it('PARTIAL delivery: a grant missing a block writes nothing and is re-tryable', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const bytes = fileBytes('multi block file '.repeat(3000)); // > 1 block
    const fields = fieldsFor(bytes, requester);

    const full = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      request: fields,
      moduleId: MODULE_ID,
      getBlobBytes: () => bytes,
    });
    expect(full.payload.decision).toBe('approve');
    if (full.payload.decision !== 'approve') return;
    expect(full.payload.blocks.length).toBeGreaterThan(1);

    // Drop the last block (simulate a TTL-expired partial delivery).
    const partial = sealFileGrantMailbox({
      sender: owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      payload: { ...full.payload, blocks: full.payload.blocks.slice(0, -1) },
    });

    const putBlob = vi.fn();
    const result = await applyFileGrant({
      recipient: requester,
      envelope: partial.envelope,
      expectedBlobHash: fields.blobHash,
      putBlob,
      moduleId: MODULE_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('incomplete');
    expect(putBlob).not.toHaveBeenCalled();
  });

  it('a put() that throws surfaces put_failed, never a false restored', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const bytes = fileBytes('disk full path');
    const fields = fieldsFor(bytes, requester);

    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: SECRET,
      request: fields,
      moduleId: MODULE_ID,
      getBlobBytes: () => bytes,
    });

    const result = await applyFileGrant({
      recipient: requester,
      envelope: grant.envelope,
      expectedBlobHash: fields.blobHash,
      putBlob: () => { throw new Error('disk full'); },
      moduleId: MODULE_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('put_failed');
  });
});
