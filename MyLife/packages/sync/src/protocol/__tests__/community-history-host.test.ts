/**
 * Sealed community-history host registry (Plan 43 WP-43D) unit tests. Proves on
 * real crypto values:
 *  - deriveCommunityHistoryRegistryId is deterministic, 64-hex, per-secret, and
 *    never leaks the secret or a community id (zero-knowledge against the relay).
 *  - seal/open round-trips; a wrong secret, tampered ciphertext, or garbage all
 *    read null (fail-closed, authenticated MAC boundary).
 *  - the record shape carries NO stable member/device identity (a keyset assertion
 *    so a future field that leaks identity trips the test).
 *  - verifyHistoryHostDescriptor accepts a consistent record and rejects a
 *    cross-community, future-revision, or unsupported-snapshot record.
 *  - freshness + TLS gates are honest and fail-closed.
 */

import { describe, it, expect } from 'vitest';
import naclUtil from 'tweetnacl-util';
import {
  HISTORY_HOST_SNAPSHOT_VERSION,
  deriveCommunityHistoryRegistryId,
  isHistoryHostRecordFresh,
  isHistoryHostUrlTls,
  openCommunityHistoryHost,
  sealCommunityHistoryHost,
  verifyHistoryHostDescriptor,
  type HistoryHostRecord,
} from '../community-history-host';
import { createCommunity } from '../community';
import { generateDeviceIdentity } from '../../identity/device-identity';
import type { SignedCommunityDescriptor } from '../community';

// genesisNonce-shaped secrets (bytesToHex of randomBytes(16) = 32 hex chars).
const SECRET_A = 'ab'.repeat(16);
const SECRET_B = 'cd'.repeat(16);
const NOW = '2026-07-11T00:00:00.000Z';
const LATER = '2026-07-12T00:00:00.000Z';

function makeRecord(over: Partial<HistoryHostRecord> = {}): HistoryHostRecord {
  return {
    communityId: 'community-aaaa0000',
    hostUrl: 'https://seed.example',
    descriptorRevision: 1,
    snapshotVersion: HISTORY_HOST_SNAPSHOT_VERSION,
    maxObjectBytes: 8 * 1024 * 1024,
    expiresAt: LATER,
    ...over,
  };
}

/** A real signed descriptor whose communityId + revision the record must match. */
function makeDescriptor(): SignedCommunityDescriptor {
  const owner = generateDeviceIdentity('Owner');
  return createCommunity(owner, { name: 'Test Community', now: NOW });
}

describe('deriveCommunityHistoryRegistryId', () => {
  it('is deterministic and shaped like a 64-hex registry id', () => {
    const a = deriveCommunityHistoryRegistryId(SECRET_A);
    expect(a).toBe(deriveCommunityHistoryRegistryId(SECRET_A));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs per community secret and never embeds the secret', () => {
    const a = deriveCommunityHistoryRegistryId(SECRET_A);
    expect(a).not.toBe(deriveCommunityHistoryRegistryId(SECRET_B));
    expect(a).not.toContain(SECRET_A);
  });
});

describe('sealCommunityHistoryHost / openCommunityHistoryHost', () => {
  it('round-trips: a descriptor-holder reads the record back', () => {
    const record = makeRecord();
    const sealed = sealCommunityHistoryHost(SECRET_A, record);
    expect(openCommunityHistoryHost(SECRET_A, sealed)).toEqual(record);
  });

  it('is opaque: a wrong community secret reads null (fail-closed)', () => {
    const sealed = sealCommunityHistoryHost(SECRET_A, makeRecord());
    expect(openCommunityHistoryHost(SECRET_B, sealed)).toBeNull();
  });

  it('tampered ciphertext reads null (authenticated MAC boundary)', () => {
    const sealed = sealCommunityHistoryHost(SECRET_A, makeRecord());
    const bytes = naclUtil.decodeBase64(sealed);
    bytes[bytes.length - 1] ^= 0xff; // flip a ciphertext byte
    const tampered = naclUtil.encodeBase64(bytes);
    expect(openCommunityHistoryHost(SECRET_A, tampered)).toBeNull();
  });

  it('garbage / short input reads null', () => {
    expect(openCommunityHistoryHost(SECRET_A, '')).toBeNull();
    expect(openCommunityHistoryHost(SECRET_A, 'not-base64-$$')).toBeNull();
    expect(openCommunityHistoryHost(SECRET_A, naclUtil.encodeBase64(new Uint8Array(4)))).toBeNull();
  });

  it('a non-http(s) url in a validly-sealed record reads null (fail-closed)', () => {
    // sealCommunityHistoryHost validates shape but not url scheme, so a file: url
    // seals; open must reject the non-http(s) scheme on the way back.
    const bad = makeRecord({ hostUrl: 'file:///etc/passwd' });
    const sealed = sealCommunityHistoryHost(SECRET_A, bad);
    expect(openCommunityHistoryHost(SECRET_A, sealed)).toBeNull();
  });

  it('rejects a malformed record at seal time (announce owns validity)', () => {
    expect(() => sealCommunityHistoryHost(SECRET_A, { communityId: 'x' } as HistoryHostRecord)).toThrow();
  });

  it('the record shape carries NO stable member or device identity', () => {
    // A defensive assertion: if a future field named like an identity is added to
    // HistoryHostRecord, this trips. The sealed+opened record's keys must be
    // exactly the serving-metadata set, none of which is a member/device id.
    const opened = openCommunityHistoryHost(SECRET_A, sealCommunityHistoryHost(SECRET_A, makeRecord()));
    expect(opened).not.toBeNull();
    const keys = Object.keys(opened!).sort();
    expect(keys).toEqual([
      'communityId',
      'descriptorRevision',
      'expiresAt',
      'hostUrl',
      'maxObjectBytes',
      'snapshotVersion',
    ]);
    // No key hints at a device/member/persona/subject identity.
    for (const k of keys) {
      expect(/device|member|persona|subject|deviceId|pubkey|publicKey/i.test(k)).toBe(false);
    }
  });
});

describe('verifyHistoryHostDescriptor', () => {
  it('accepts a record consistent with the descriptor', () => {
    const descriptor = makeDescriptor();
    const record = makeRecord({ communityId: descriptor.descriptor.communityId, descriptorRevision: 1 });
    expect(verifyHistoryHostDescriptor(record, descriptor)).toBe(true);
  });

  it('rejects a cross-community record', () => {
    const descriptor = makeDescriptor();
    const record = makeRecord({ communityId: 'community-other-9999' });
    expect(verifyHistoryHostDescriptor(record, descriptor)).toBe(false);
  });

  it('rejects a record claiming a NEWER revision than the descriptor', () => {
    const descriptor = makeDescriptor(); // revision 1
    const record = makeRecord({ communityId: descriptor.descriptor.communityId, descriptorRevision: 2 });
    expect(verifyHistoryHostDescriptor(record, descriptor)).toBe(false);
  });

  it('accepts an older/equal revision (a host may lag)', () => {
    const descriptor = makeDescriptor(); // revision 1
    const record = makeRecord({ communityId: descriptor.descriptor.communityId, descriptorRevision: 1 });
    expect(verifyHistoryHostDescriptor(record, descriptor)).toBe(true);
  });

  it('rejects an unsupported snapshot version', () => {
    const descriptor = makeDescriptor();
    const record = makeRecord({
      communityId: descriptor.descriptor.communityId,
      snapshotVersion: HISTORY_HOST_SNAPSHOT_VERSION + 1,
    });
    expect(verifyHistoryHostDescriptor(record, descriptor)).toBe(false);
  });
});

describe('isHistoryHostRecordFresh', () => {
  it('true before expiry, false at/after expiry (fail-closed)', () => {
    const record = makeRecord({ expiresAt: LATER });
    expect(isHistoryHostRecordFresh(record, NOW)).toBe(true);
    expect(isHistoryHostRecordFresh(record, LATER)).toBe(false);
    expect(isHistoryHostRecordFresh(record, '2026-07-13T00:00:00.000Z')).toBe(false);
  });

  it('false on an unparseable expiry or now', () => {
    expect(isHistoryHostRecordFresh(makeRecord({ expiresAt: 'nonsense' }), NOW)).toBe(false);
    expect(isHistoryHostRecordFresh(makeRecord(), 'nonsense')).toBe(false);
  });
});

describe('isHistoryHostUrlTls', () => {
  it('true only for an https url', () => {
    expect(isHistoryHostUrlTls(makeRecord({ hostUrl: 'https://seed.example' }))).toBe(true);
    expect(isHistoryHostUrlTls(makeRecord({ hostUrl: 'http://seed.example' }))).toBe(false);
  });
});
