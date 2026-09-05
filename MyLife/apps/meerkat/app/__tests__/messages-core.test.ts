// Messages shell person-sheet model + honest Chats empty state (Plan 31 Phase 0,
// T0.3). Pure, Node-only: the model decides which person-sheet actions render for
// each trust state and keeps Message honestly disabled behind
// DM_MESSAGES_SURFACE_AVAILABLE. No fake chats, no schedule promise (NC-2).

import { describe, expect, it } from 'vitest';
import type { PairedDevice } from '@mylife/sync';
import { buildFriendRows } from '../(root)/data/friends-core';
import { DM_MESSAGES_SURFACE_AVAILABLE } from '../(root)/data/share-route';
import {
  buildPersonSheetModel,
  NO_PRIVATE_CHATS_EMPTY_STATE,
} from '../(root)/data/messages-core';

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

function rowFor(
  deviceId: string,
  opts: { checked?: boolean; blocked?: boolean } = {},
) {
  const [row] = buildFriendRows([paired({ deviceId })], {
    isPeerRevoked: () => opts.blocked ?? false,
    isPeerSasVerified: () => opts.checked ?? false,
  });
  if (!row) throw new Error('expected a friend row');
  return row;
}

describe('messages-core Chats empty state', () => {
  it('is honest, no schedule promise, no fake row, and never claims DMs are unavailable', () => {
    expect(NO_PRIVATE_CHATS_EMPTY_STATE).toBe(
      'No conversations yet. Add a friend, then tap New to start a private chat.',
    );
    expect(NO_PRIVATE_CHATS_EMPTY_STATE).not.toContain('not available');
  });
});

describe('messages-core person sheet model', () => {
  it('unknown peer offers mark-safety-checked and block, message enabled (Plan 21 live)', () => {
    const model = buildPersonSheetModel(rowFor('a'.repeat(64)));
    expect(model.trustState).toBe('unknown');
    expect(model.canMarkSafetyChecked).toBe(true);
    expect(model.canBlock).toBe(true);
    expect(model.messageEnabled).toBe(true);
    // The DM dead-end reason string is gone: Message opens a real thread now.
    expect(model).not.toHaveProperty('messageDisabledReason');
  });

  it('checked peer hides mark-safety-checked but still offers block', () => {
    const model = buildPersonSheetModel(rowFor('b'.repeat(64), { checked: true }));
    expect(model.trustState).toBe('checked');
    expect(model.canMarkSafetyChecked).toBe(false);
    expect(model.canBlock).toBe(true);
    expect(model.safetyLabel).toBe('Safety code checked');
  });

  it('blocked peer offers neither mark-checked nor block', () => {
    const model = buildPersonSheetModel(rowFor('c'.repeat(64), { blocked: true }));
    expect(model.trustState).toBe('blocked');
    expect(model.canMarkSafetyChecked).toBe(false);
    expect(model.canBlock).toBe(false);
    expect(model.safetyLabel).toBe('Blocked');
  });

  it('message enabled tracks the DM surface flag (now live)', () => {
    const model = buildPersonSheetModel(rowFor('d'.repeat(64)));
    expect(model.messageEnabled).toBe(DM_MESSAGES_SURFACE_AVAILABLE);
    expect(DM_MESSAGES_SURFACE_AVAILABLE).toBe(true);
  });
});
