import { describe, expect, it } from 'vitest';
import type { PairedDevice } from '@mylife/sync';
import { buildFriendRows } from '../friends-core';

function paired(fields: Partial<PairedDevice> & { deviceId: string }): PairedDevice {
  return {
    deviceId: fields.deviceId,
    displayName: fields.displayName ?? 'Friend',
    dhPublicKey: fields.dhPublicKey ?? `${fields.deviceId}-dh`,
    sharedSecretRef: fields.sharedSecretRef ?? `secret:${fields.deviceId}`,
    lastSeenAt: fields.lastSeenAt ?? null,
    lastSyncAt: fields.lastSyncAt ?? null,
    lastSyncModule: fields.lastSyncModule ?? null,
    bytesSent: fields.bytesSent ?? 0,
    bytesReceived: fields.bytesReceived ?? 0,
    isActive: fields.isActive ?? true,
    pairedAt: fields.pairedAt ?? '2026-06-24T12:00:00.000Z',
  };
}

describe('web friends-core Prompt 06 friend rows', () => {
  it('labels checked and unknown safety states (Plan 21 Phase 9: no DM dead-end fields)', () => {
    const rows = buildFriendRows(
      [paired({ deviceId: 'a'.repeat(64), displayName: 'Ana' }), paired({ deviceId: 'b'.repeat(64), displayName: 'Bo' })],
      {
        isPeerRevoked: () => false,
        isPeerSasVerified: (deviceId) => deviceId.startsWith('a'),
      },
    );

    expect(rows.map((row) => row.relationshipLabel)).toEqual(['Friend', 'Friend']);
    expect(rows.map((row) => row.safetyLabel)).toEqual(['Safety code checked', 'Check safety code']);
    // The DM dead-end fields are gone: the Message affordance opens a real thread now.
    expect(rows[0]).not.toHaveProperty('canMessage');
    expect(rows[0]).not.toHaveProperty('messageUnavailableReason');
  });

  it('keeps a blocked peer visible and excludes inactive non-blocked pairings', () => {
    const rows = buildFriendRows(
      [
        paired({ deviceId: 'c'.repeat(64), displayName: 'Blocked Bea', isActive: false }),
        paired({ deviceId: 'd'.repeat(64), displayName: 'Dormant Dan', isActive: false }),
      ],
      {
        isPeerRevoked: (deviceId) => deviceId.startsWith('c'),
        isPeerSasVerified: () => false,
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      displayName: 'Blocked Bea',
      relationshipLabel: 'Blocked',
      trustState: 'blocked',
      safetyLabel: 'Blocked',
    });
  });
});
