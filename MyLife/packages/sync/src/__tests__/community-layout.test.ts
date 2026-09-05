/**
 * cm_layout, the owner-signed composition document (composition plan 2.2).
 * Proves: create/verify round trip; owner binding (a member-signed event never
 * verifies); tombstone discipline (no payload rides a tombstone); blob gate
 * (namespace, cap, single token); row serde totality (malformed rows -> null);
 * resolve semantics (highest verified revision, deterministic ties, tombstone
 * resolves null); apply-time validator (forgery dies before INSERT, raw DELETE
 * rejected, unknown community fails closed); and the FROZEN fixture keeps
 * verifying so any change to the canonical bytes breaks loudly here.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createCommunity, upsertCommunity } from '../protocol/community';
import {
  COMMUNITY_LAYOUT_BLOB_MAX_CHARS,
  COMMUNITY_LAYOUT_TABLE,
  communityLayoutEventFromRow,
  communityLayoutEventToRow,
  createCommunityLayoutEvent,
  isValidCommunityLayoutBlob,
  resolveCommunityLayout,
  verifyCommunityLayoutEvent,
  type CommunityLayoutEvent,
} from '../protocol/community-layout';
import { isSignedRowTable, validateSignedInboundRow } from '../protocol/inbound-row-validators';
import layoutFixture from './fixtures/legacy-community-layout-event.json';

const BLOB = 'meerkat-layout:v1:eyJjYXBhYmlsaXRpZXMiOltdLCJjaGFubmVscyI6e30sImhvbWUiOltdLCJ0aWVycyI6W119:00000000';

describe('blob gate', () => {
  it('accepts a namespaced single-token blob and rejects everything else', () => {
    expect(isValidCommunityLayoutBlob(BLOB)).toBe(true);
    expect(isValidCommunityLayoutBlob('')).toBe(false);
    expect(isValidCommunityLayoutBlob('meerkat-theme:v1:abc:00000000')).toBe(false);
    expect(isValidCommunityLayoutBlob('meerkat-layout:v1:ab c:00000000')).toBe(false);
    expect(isValidCommunityLayoutBlob('meerkat-layout:v1:ab\nc:00000000')).toBe(false);
    expect(isValidCommunityLayoutBlob(`meerkat-layout:v1:${'a'.repeat(COMMUNITY_LAYOUT_BLOB_MAX_CHARS)}:0`)).toBe(false);
  });
});

describe('create + verify', () => {
  const owner = generateDeviceIdentity('Owner');

  it('round-trips an owner-signed event', () => {
    const event = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1, layoutBlob: BLOB });
    expect(verifyCommunityLayoutEvent(event, owner.publicKey)).toBe(true);
  });

  it('binds to the owner: another device id never verifies', () => {
    const event = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1, layoutBlob: BLOB });
    const stranger = generateDeviceIdentity('Stranger');
    expect(verifyCommunityLayoutEvent(event, stranger.publicKey)).toBe(false);
    // A stranger-signed event never verifies against the owner either.
    const forged = createCommunityLayoutEvent(stranger, { communityId: 'c1', revision: 2, layoutBlob: BLOB });
    expect(verifyCommunityLayoutEvent(forged, owner.publicKey)).toBe(false);
  });

  it('rejects tampering of every signed field', () => {
    const event = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1, layoutBlob: BLOB });
    const tampers: Array<Partial<CommunityLayoutEvent>> = [
      { revision: 2 },
      { layoutBlob: BLOB.replace('v1', 'v1') + 'x' },
      { updatedAt: '2030-01-01T00:00:00.000Z' },
      { tombstone: true, layoutBlob: null },
      { communityId: 'c2' },
    ];
    for (const patch of tampers) {
      expect(verifyCommunityLayoutEvent({ ...event, ...patch }, owner.publicKey)).toBe(false);
    }
  });

  it('requires a blob on a non-tombstone and forbids payload on a tombstone', () => {
    expect(() => createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1 })).toThrow(/layout blob/);
    const tomb = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 2, tombstone: true, layoutBlob: BLOB });
    expect(tomb.layoutBlob).toBeNull();
    expect(verifyCommunityLayoutEvent(tomb, owner.publicKey)).toBe(true);
    expect(verifyCommunityLayoutEvent({ ...tomb, layoutBlob: BLOB }, owner.publicKey)).toBe(false);
  });

  it('rejects an oversized or malformed blob at create', () => {
    expect(() => createCommunityLayoutEvent(owner, {
      communityId: 'c1', revision: 1, layoutBlob: 'not-a-layout-blob',
    })).toThrow(/malformed/);
  });
});

describe('row serde', () => {
  const owner = generateDeviceIdentity('Owner');

  it('round-trips through the synced row shape', () => {
    const event = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1, layoutBlob: BLOB });
    const row = communityLayoutEventToRow(event);
    expect(row.tombstone).toBe(0);
    expect(communityLayoutEventFromRow(row)).toEqual(event);
  });

  it('returns null on malformed rows (totality)', () => {
    const event = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1, layoutBlob: BLOB });
    const row = communityLayoutEventToRow(event);
    expect(communityLayoutEventFromRow({ ...row, revision: 'three' })).toBeNull();
    expect(communityLayoutEventFromRow({ ...row, tombstone: 'yes' })).toBeNull();
    expect(communityLayoutEventFromRow({ ...row, signature: null })).toBeNull();
    expect(communityLayoutEventFromRow({ ...row, layout_blob: 7 })).toBeNull();
  });
});

describe('resolve semantics', () => {
  const owner = generateDeviceIdentity('Owner');

  it('highest verified revision wins; forged events are ignored', () => {
    const r1 = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1, layoutBlob: BLOB });
    const r2 = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 2, layoutBlob: BLOB });
    const stranger = generateDeviceIdentity('Stranger');
    const forgedR9 = createCommunityLayoutEvent(stranger, { communityId: 'c1', revision: 9, layoutBlob: BLOB });
    expect(resolveCommunityLayout([r1, forgedR9, r2], owner.publicKey)?.revision).toBe(2);
  });

  it('a winning tombstone resolves to null (legacy rendering)', () => {
    const r1 = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 1, layoutBlob: BLOB });
    const tomb = createCommunityLayoutEvent(owner, { communityId: 'c1', revision: 2, tombstone: true });
    expect(resolveCommunityLayout([r1, tomb], owner.publicKey)).toBeNull();
  });

  it('resolves null when nothing verifies', () => {
    expect(resolveCommunityLayout([], owner.publicKey)).toBeNull();
  });
});

describe('apply-time validator (forgery dies before INSERT)', () => {
  let testDb: InMemoryTestDatabase | null = null;

  afterEach(() => {
    testDb?.close();
    testDb = null;
  });

  function setup() {
    testDb = createInMemoryTestDatabase();
    createSyncTables(testDb.adapter);
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, { name: 'Club', channels: [{ id: 'general', name: 'general' }] });
    upsertCommunity(testDb.adapter, signed, owner.publicKey);
    return { db: testDb.adapter, owner, communityId: signed.descriptor.communityId };
  }

  it('cm_layout is a registered signed-row table', () => {
    expect(isSignedRowTable(COMMUNITY_LAYOUT_TABLE)).toBe(true);
  });

  it('accepts a real owner-signed row', () => {
    const { db, owner, communityId } = setup();
    const event = createCommunityLayoutEvent(owner, { communityId, revision: 1, layoutBlob: BLOB });
    expect(validateSignedInboundRow(db, {
      table: COMMUNITY_LAYOUT_TABLE,
      rowId: event.id,
      operation: 'INSERT',
      data: communityLayoutEventToRow(event),
    })).toEqual({ ok: true });
  });

  it('rejects a member-forged layout before insert', () => {
    const { db, communityId } = setup();
    const hostile = generateDeviceIdentity('Hostile Member');
    const forged = createCommunityLayoutEvent(hostile, { communityId, revision: 5, layoutBlob: BLOB });
    expect(validateSignedInboundRow(db, {
      table: COMMUNITY_LAYOUT_TABLE,
      rowId: forged.id,
      operation: 'INSERT',
      data: communityLayoutEventToRow(forged),
    })).toEqual({ ok: false, reason: 'layout_signature_invalid' });
  });

  it('fails closed on an unknown community and a malformed row', () => {
    const { db, owner } = setup();
    const event = createCommunityLayoutEvent(owner, { communityId: 'not-held-here', revision: 1, layoutBlob: BLOB });
    expect(validateSignedInboundRow(db, {
      table: COMMUNITY_LAYOUT_TABLE,
      rowId: event.id,
      operation: 'INSERT',
      data: communityLayoutEventToRow(event),
    })).toEqual({ ok: false, reason: 'layout_community_unknown' });
    expect(validateSignedInboundRow(db, {
      table: COMMUNITY_LAYOUT_TABLE,
      rowId: 'x',
      operation: 'INSERT',
      data: { nonsense: true },
    })).toEqual({ ok: false, reason: 'layout_row_malformed' });
  });

  it('rejects raw DELETE (tombstone events only)', () => {
    const { db } = setup();
    expect(validateSignedInboundRow(db, {
      table: COMMUNITY_LAYOUT_TABLE,
      rowId: 'any',
      operation: 'DELETE',
      data: null,
    })).toEqual({ ok: false, reason: 'signed_row_delete_rejected' });
  });
});

describe('frozen fixture (canonical-bytes lock)', () => {
  // The fixture was generated 2026-08-28 and committed. If the canonical form
  // of the layout event EVER changes (field order, domain string, id
  // derivation), these signatures stop verifying and this test fails loudly:
  // that is the point. Never regenerate the fixture to make it pass; a
  // canonical change breaks every already-signed layout in the field.
  it('the frozen owner-signed event still verifies byte-for-byte', () => {
    const event = layoutFixture.event as CommunityLayoutEvent;
    expect(verifyCommunityLayoutEvent(event, layoutFixture.ownerDeviceId)).toBe(true);
    expect(verifyCommunityLayoutEvent({ ...event, revision: 99 }, layoutFixture.ownerDeviceId)).toBe(false);
  });

  it('the frozen tombstone still verifies and resolves to null', () => {
    const event = layoutFixture.event as CommunityLayoutEvent;
    const tombstone = layoutFixture.tombstone as CommunityLayoutEvent;
    expect(verifyCommunityLayoutEvent(tombstone, layoutFixture.ownerDeviceId)).toBe(true);
    expect(resolveCommunityLayout([event, tombstone], layoutFixture.ownerDeviceId)).toBeNull();
  });
});
