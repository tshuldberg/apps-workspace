import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  createDmMessage,
  generateDeviceIdentity,
  type PairedDevice,
} from '@mylife/sync';
import {
  ensureDmTables,
  mergeDmEvents,
  setDmDelivery,
  upsertDmConversation,
  upsertDmOwnDevice,
  upsertDmParticipant,
} from '../dm-core';
import {
  buildOwnDeviceLinkCandidates,
  readOwnDeviceLinkStatus,
  summarizeOwnDeviceLinkStatus,
} from '../dm-own-device-status';

const NOW = '2026-07-08T00:00:00.000Z';

function paired(fields: Partial<PairedDevice> & { deviceId: string }): PairedDevice {
  return {
    deviceId: fields.deviceId,
    displayName: fields.displayName ?? 'Second device',
    dhPublicKey: fields.dhPublicKey ?? `${fields.deviceId}-dh`,
    sharedSecretRef: fields.sharedSecretRef ?? `secret:${fields.deviceId}`,
    lastSeenAt: fields.lastSeenAt ?? null,
    lastSyncAt: fields.lastSyncAt ?? null,
    lastSyncModule: fields.lastSyncModule ?? null,
    bytesSent: fields.bytesSent ?? 0,
    bytesReceived: fields.bytesReceived ?? 0,
    isActive: fields.isActive ?? true,
    pairedAt: fields.pairedAt ?? NOW,
  };
}

describe('summarizeOwnDeviceLinkStatus (web)', () => {
  it('reports no linked own device as local only', () => {
    const status = summarizeOwnDeviceLinkStatus({
      linkedDeviceIds: [],
      mirroredMessageAuthorIds: [],
      signedReceiptDeviceIds: [],
    });

    expect(status.state).toBe('no_link');
    expect(status.pillLabel).toBe('Local only');
    expect(status.detail).toContain('Conversations stay on this device');
  });

  it('does not claim convergence for a link before rows and signed receipts arrive', () => {
    const status = summarizeOwnDeviceLinkStatus({
      linkedDeviceIds: ['laptop'],
      mirroredMessageAuthorIds: [],
      signedReceiptDeviceIds: [],
    });

    expect(status.state).toBe('linked_waiting');
    expect(status.tone).toBe('warning');
    expect(status.detail).toContain('has not received mirrored DM rows or signed receipts');
  });

  it('requires both mirrored rows and signed receipts before the proven state', () => {
    const rowsOnly = summarizeOwnDeviceLinkStatus({
      linkedDeviceIds: ['laptop'],
      mirroredMessageAuthorIds: ['laptop'],
      signedReceiptDeviceIds: [],
    });
    const proven = summarizeOwnDeviceLinkStatus({
      linkedDeviceIds: ['laptop'],
      mirroredMessageAuthorIds: ['laptop'],
      signedReceiptDeviceIds: ['laptop'],
    });

    expect(rowsOnly.state).toBe('mirrored_rows');
    expect(rowsOnly.detail).toContain('not fully proven');
    expect(proven.state).toBe('mirrored_rows_and_receipts');
    expect(proven.detail).toContain('real mailbox rows and signed receipts');
  });
});

describe('readOwnDeviceLinkStatus (web)', () => {
  it('counts only real linked own-device messages and signed receipt rows', () => {
    const db = createInMemoryTestDatabase();
    try {
      ensureDmTables(db.adapter);
      const phone = generateDeviceIdentity('Phone');
      const laptop = generateDeviceIdentity('Laptop');
      const friend = generateDeviceIdentity('Friend');
      const conversationId = 'dm:phone:friend';

      upsertDmConversation(db.adapter, {
        id: conversationId,
        kind: 'direct',
        title: null,
        group_workspace_id: null,
        admin_device_id: null,
        current_epoch: 0,
        descriptor_json: null,
        feed_opt_in: 0,
        archived: 0,
        muted: 0,
        created_at: NOW,
        updated_at: NOW,
      });
      for (const [device, isSelf] of [[phone, 1], [friend, 0], [laptop, 1]] as const) {
        upsertDmParticipant(db.adapter, {
          conversation_id: conversationId,
          device_id: device.publicKey,
          identity_anchor: isSelf ? phone.publicKey : device.publicKey,
          is_self: isSelf,
          role: 'member',
          dh_public_key: device.dhPublicKey,
          joined_at: NOW,
          removed_at: null,
        });
      }
      upsertDmOwnDevice(db.adapter, {
        device_id: laptop.publicKey,
        identity_anchor: phone.publicKey,
        dh_public_key: laptop.dhPublicKey,
        linked_at: NOW,
      });

      const phoneMessage = createDmMessage(phone, {
        conversationId,
        body: 'from phone',
        hlc: { wall: NOW, counter: 0 },
      });
      const mirroredFromLaptop = createDmMessage(laptop, {
        conversationId,
        body: 'from laptop',
        hlc: { wall: NOW, counter: 1 },
      });
      mergeDmEvents(db.adapter, conversationId, [phoneMessage, mirroredFromLaptop]);
      setDmDelivery(db.adapter, phoneMessage.id, laptop.publicKey, 'read', NOW, 'signed-receipt');

      const status = readOwnDeviceLinkStatus(db.adapter, phone.publicKey);
      expect(status.state).toBe('mirrored_rows_and_receipts');
      expect(status.linkedCount).toBe(1);
      expect(status.mirroredMessageCount).toBe(1);
      expect(status.signedReceiptCount).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe('buildOwnDeviceLinkCandidates (web)', () => {
  it('allows only active, safety-checked, unblocked, unlinked paired devices', () => {
    const linked = 'b'.repeat(64);
    const checked = 'c'.repeat(64);
    const unchecked = 'd'.repeat(64);
    const blocked = 'e'.repeat(64);
    const rows = buildOwnDeviceLinkCandidates(
      [
        paired({ deviceId: linked }),
        paired({ deviceId: checked }),
        paired({ deviceId: unchecked }),
        paired({ deviceId: blocked }),
      ],
      [{ device_id: linked, identity_anchor: 'a'.repeat(64), dh_public_key: 'dh-linked', linked_at: NOW }],
      {
        isPeerSasVerified: (id) => id === checked,
        isPeerRevoked: (id) => id === blocked,
        shortDeviceId: (id) => id.slice(0, 6),
      },
    );

    expect(rows.find((row) => row.deviceId === checked)?.canLink).toBe(true);
    expect(rows.find((row) => row.deviceId === linked)?.disabledReason).toBe('Already linked on this device.');
    expect(rows.find((row) => row.deviceId === unchecked)?.disabledReason).toContain('safety code');
    expect(rows.find((row) => row.deviceId === blocked)?.disabledReason).toBe('Blocked devices cannot be linked.');
  });
});
