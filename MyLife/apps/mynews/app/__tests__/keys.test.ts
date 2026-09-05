// Keys and Recovery view-model (plan 48 WP6). The copy a journalist reads about
// their own signing custody is load-bearing: it is what tells them whether they
// can still publish and what to do if they cannot. These pin the posture logic
// and, in particular, that nothing here advertises the no-kit recovery path on a
// deployment that cannot deliver it.

import { describe, expect, it } from 'vitest';
import type { CustodyStatusView } from '@mylife/mynews';
import {
  CUSTODY_EXPLANATION,
  custodyErrorMessage,
  custodyPosture,
  noKitRecoveryCopy,
  postureCopy,
  toKeyRows,
} from '../(root)/lib/keys';

const PROFILE = '11111111-1111-4111-8111-111111111111';
const THIS_DEVICE = 'a'.repeat(64);
const OTHER_DEVICE = 'b'.repeat(64);
const RETIRED = 'c'.repeat(64);

function status(overrides?: Partial<CustodyStatusView>): CustodyStatusView {
  return {
    profileId: PROFILE,
    headPubkey: THIS_DEVICE,
    keys: [
      {
        id: 'key-1',
        seq: 1,
        pubkey: THIS_DEVICE,
        status: 'active',
        kind: 'primary',
        addedVia: 'initial',
        validFrom: '2026-07-01T00:00:00.000Z',
        revokedAt: null,
      },
    ],
    escrow: [],
    escrowAccess: [],
    notificationChannelConfirmed: false,
    recovery: null,
    recoveryFrozen: false,
    ...overrides,
  };
}

const kit = [{ version: 1, pubkey: THIS_DEVICE, createdAt: '2026-07-02T00:00:00.000Z' }];

describe('custodyPosture', () => {
  it('is healthy when this device holds an active key and a kit exists', () => {
    expect(custodyPosture(status({ escrow: kit }), THIS_DEVICE)).toBe('healthy');
  });

  it('warns about a missing kit even when signing works', () => {
    expect(custodyPosture(status(), THIS_DEVICE)).toBe('no-kit');
  });

  it('reports no-key when the account has no head at all', () => {
    expect(custodyPosture(status({ headPubkey: '', keys: [] }), THIS_DEVICE)).toBe('no-key');
  });

  it('reports signing-blocked when the active key is NOT this device', () => {
    expect(custodyPosture(status({ escrow: kit }), OTHER_DEVICE)).toBe('signing-blocked');
  });

  it('reports signing-blocked when this device key was retired', () => {
    const retired = status({
      escrow: kit,
      keys: [
        {
          id: 'key-old',
          seq: 1,
          pubkey: THIS_DEVICE,
          status: 'revoked',
          kind: 'primary',
          addedVia: 'initial',
          validFrom: '2026-07-01T00:00:00.000Z',
          revokedAt: '2026-07-05T00:00:00.000Z',
        },
        {
          id: 'key-new',
          seq: 2,
          pubkey: OTHER_DEVICE,
          status: 'active',
          kind: 'primary',
          addedVia: 'rotation',
          validFrom: '2026-07-05T00:00:00.000Z',
          revokedAt: null,
        },
      ],
      headPubkey: OTHER_DEVICE,
    });
    expect(custodyPosture(retired, THIS_DEVICE)).toBe('signing-blocked');
  });

  it('reports signing-blocked when this device has no key loaded', () => {
    expect(custodyPosture(status({ escrow: kit }), null)).toBe('signing-blocked');
  });

  it('a PENDING recovery outranks every other posture', () => {
    const pending = status({
      escrow: kit,
      recovery: {
        id: 'r1',
        status: 'pending',
        newPubkey: OTHER_DEVICE,
        requestedAt: '2026-07-10T00:00:00.000Z',
        unlocksAt: '2026-07-13T00:00:00.000Z',
        standing: 'open',
      },
    });
    expect(custodyPosture(pending, THIS_DEVICE)).toBe('recovery-pending');
  });

  it('a freeze outranks the healthy and no-kit states', () => {
    expect(custodyPosture(status({ escrow: kit, recoveryFrozen: true }), THIS_DEVICE)).toBe(
      'recovery-frozen',
    );
  });

  it('a COMPLETED recovery is not a pending posture', () => {
    const completed = status({
      escrow: kit,
      recovery: {
        id: 'r1',
        status: 'completed',
        newPubkey: THIS_DEVICE,
        requestedAt: '2026-07-01T00:00:00.000Z',
        unlocksAt: '2026-07-04T00:00:00.000Z',
        standing: 'open',
      },
    });
    expect(custodyPosture(completed, THIS_DEVICE)).toBe('healthy');
  });
});

describe('postureCopy', () => {
  it('gives every posture a tone and non-empty copy', () => {
    for (const posture of [
      'no-key',
      'healthy',
      'no-kit',
      'signing-blocked',
      'recovery-pending',
      'recovery-frozen',
    ] as const) {
      const copy = postureCopy(posture);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(['ok', 'warn', 'bad']).toContain(copy.tone);
    }
  });

  it('never tells a blocked or contested user that things are fine', () => {
    expect(postureCopy('signing-blocked').tone).toBe('bad');
    expect(postureCopy('recovery-pending').tone).toBe('bad');
    expect(postureCopy('healthy').tone).toBe('ok');
  });

  it('tells a kit-less user the actual consequence of losing the device', () => {
    expect(postureCopy('no-kit').body).toContain('lose it');
  });

  it('tells a contested user the kit path still works', () => {
    expect(postureCopy('recovery-frozen').body).toContain('recovery kit still works');
  });
});

describe('toKeyRows', () => {
  const twoDevices = status({
    keys: [
      {
        id: 'key-primary',
        seq: 1,
        pubkey: THIS_DEVICE,
        status: 'active',
        kind: 'primary',
        addedVia: 'initial',
        validFrom: '2026-07-01T00:00:00.000Z',
        revokedAt: null,
      },
      {
        id: 'key-device',
        seq: 2,
        pubkey: OTHER_DEVICE,
        status: 'active',
        kind: 'device',
        addedVia: 'device_approval',
        validFrom: '2026-07-02T00:00:00.000Z',
        revokedAt: null,
      },
      {
        id: 'key-retired',
        seq: 3,
        pubkey: RETIRED,
        status: 'revoked',
        kind: 'device',
        addedVia: 'device_approval',
        validFrom: '2026-07-03T00:00:00.000Z',
        revokedAt: '2026-07-04T00:00:00.000Z',
      },
    ],
  });

  it('marks the row this device holds', () => {
    const rows = toKeyRows(twoDevices, THIS_DEVICE);
    expect(rows[0]).toMatchObject({ isThisDevice: true, label: 'Primary key (this device)' });
    expect(rows[1]).toMatchObject({ isThisDevice: false, label: 'Device key' });
  });

  it('offers revoke ONLY for another active device key', () => {
    const rows = toKeyRows(twoDevices, THIS_DEVICE);
    // The primary is replaced by rotation, never bare-revoked: a bare revoke
    // would leave the account with no key.
    expect(rows.find((r) => r.id === 'key-primary')?.canRevoke).toBe(false);
    expect(rows.find((r) => r.id === 'key-device')?.canRevoke).toBe(true);
    expect(rows.find((r) => r.id === 'key-retired')?.canRevoke).toBe(false);
  });

  it('never offers to revoke the key this device is using', () => {
    const rows = toKeyRows(twoDevices, OTHER_DEVICE);
    expect(rows.find((r) => r.id === 'key-device')?.canRevoke).toBe(false);
  });

  it('describes how each key arrived, and marks retired ones as retired', () => {
    const rows = toKeyRows(twoDevices, THIS_DEVICE);
    expect(rows.find((r) => r.id === 'key-primary')?.detail).toBe('first key on this account');
    expect(rows.find((r) => r.id === 'key-device')?.detail).toBe(
      'approved by your primary key',
    );
    expect(rows.find((r) => r.id === 'key-retired')?.detail).toContain('retired');
    expect(rows.find((r) => r.id === 'key-retired')?.active).toBe(false);
  });

  it('names a recovery-restored key as such', () => {
    const restored = status({
      keys: [
        {
          id: 'k',
          seq: 1,
          pubkey: THIS_DEVICE,
          status: 'active',
          kind: 'primary',
          addedVia: 'recovery',
          validFrom: '2026-07-01T00:00:00.000Z',
          revokedAt: null,
        },
      ],
    });
    expect(toKeyRows(restored, THIS_DEVICE)[0]!.detail).toBe('restored via account recovery');
  });
});

describe('noKitRecoveryCopy', () => {
  it('is UNAVAILABLE with the real reason when no channel is confirmed', () => {
    // The honesty boundary: this path needs a deliverable notice with a cancel
    // link so a real owner can stop a stolen-session takeover. Nothing delivers
    // one, so the copy says so rather than offering a button that always refuses.
    const copy = noKitRecoveryCopy(status());
    expect(copy.available).toBe(false);
    expect(copy.body).toContain('unavailable on this MyNews server');
    expect(copy.body).toContain('none is configured');
    expect(copy.body).toContain('recovery kit');
  });

  it('is unavailable, and says why differently, when the account is frozen', () => {
    const copy = noKitRecoveryCopy(status({ notificationChannelConfirmed: true, recoveryFrozen: true }));
    expect(copy.available).toBe(false);
    expect(copy.body).toContain('frozen');
  });

  it('the freeze reason takes precedence over the channel reason', () => {
    const copy = noKitRecoveryCopy(status({ recoveryFrozen: true }));
    expect(copy.body).toContain('frozen');
  });

  it('is available only with a confirmed channel and no freeze', () => {
    const copy = noKitRecoveryCopy(status({ notificationChannelConfirmed: true }));
    expect(copy.available).toBe(true);
    expect(copy.body).toContain('cancel');
  });
});

describe('CUSTODY_EXPLANATION', () => {
  it('states the LIMIT as well as the guarantee', () => {
    const text = CUSTODY_EXPLANATION.join(' ');
    // A design that only advertises the upside teaches users to trust it further
    // than it goes.
    expect(text).toContain('cannot forge');
    expect(text).toContain('cannot recover your key for you');
    expect(text).toContain('never invalidates what it already signed');
  });
});

describe('custodyErrorMessage', () => {
  it('has honest, non-empty copy for every code', () => {
    const codes = [
      'not-signed-in',
      'no-profile',
      'no-active-key',
      'bad-signature',
      'bad-nonce',
      'rate-limited',
      'head-conflict',
      'pubkey-conflict',
      'same-key',
      'not-primary',
      'unknown-key',
      'not-your-key',
      'already-revoked',
      'use-rotation-for-primary',
      'revoke-precedence',
      'notification-channel-required',
      'recovery-frozen',
      'already-pending',
      'unknown-request',
      'not-pending',
      'still-locked',
      'pubkey-not-precommitted',
      'bad-cancel-token',
      'no-kit',
      'reauth-required',
      'validation',
      'network',
      'unknown',
    ] as const;
    for (const code of codes) {
      const message = custodyErrorMessage(code);
      expect(message.length).toBeGreaterThan(0);
      // Never claim a change happened when it did not.
      expect(message.toLowerCase()).not.toContain('succeeded');
    }
  });

  it('says nothing was changed on the failure modes that changed nothing', () => {
    expect(custodyErrorMessage('bad-signature')).toContain('nothing was changed');
    expect(custodyErrorMessage('network')).toContain('nothing was changed');
  });

  it('points a would-be primary revoker at rotation instead', () => {
    expect(custodyErrorMessage('use-rotation-for-primary')).toContain('rotate');
  });

  it('appends the server detail where it adds information', () => {
    expect(custodyErrorMessage('validation', 'nonce too short')).toContain('nonce too short');
    expect(custodyErrorMessage('unknown', 'boom')).toContain('boom');
  });
});
