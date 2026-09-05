import { describe, it, expect } from 'vitest';
import {
  negotiateTransportPreference,
  rankMutualTransportPreferences,
} from '../protocol/sync-session';
import type { TransportPreferenceEntry } from '../protocol/sync-session';
import {
  createSecurityOffer,
  negotiateSecurityAgreement,
} from '../protocol/security-negotiation';
import type { SyncSecurityPreference } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for creating a preference entry. */
function pref(layerId: number, rank: number, enabled = true): TransportPreferenceEntry {
  return { layerId, rank, enabled };
}

// Layer ID reference:
//   1 = LAN (Wi-Fi / Bonjour)
//   2 = Nearby (Apple Multipeer / Android Wi-Fi Direct)
//   3 = BLE (wake-up signals only)
//   4 = WebRTC
//   5 = Relay

// ---------------------------------------------------------------------------
// negotiateTransportPreference
// ---------------------------------------------------------------------------

describe('negotiateTransportPreference', () => {
  it('picks highest mutual match', () => {
    // Initiator prefers LAN > WebRTC > Relay (ranks 1, 2, 3).
    // Responder prefers WebRTC > LAN (ranks 1, 2).
    // Initiator walks its list top-to-bottom (lowest rank first):
    //   rank 1 = LAN (layerId 1) -- responder has LAN enabled -> match.
    const result = negotiateTransportPreference(
      [pref(1, 1), pref(4, 2), pref(5, 3)],
      [pref(4, 1), pref(1, 2)],
    );

    expect(result).toBe(1); // LAN
  });

  it('returns null when no mutual preference', () => {
    // Initiator has only relay, responder has only LAN.
    const result = negotiateTransportPreference(
      [pref(5, 1)],
      [pref(1, 1)],
    );

    expect(result).toBeNull();
  });

  it('skips disabled preferences', () => {
    // Initiator has LAN disabled, both have WebRTC enabled.
    const result = negotiateTransportPreference(
      [pref(1, 1, false), pref(4, 2)],
      [pref(1, 1), pref(4, 2)],
    );

    // LAN is skipped because the initiator disabled it.
    expect(result).toBe(4); // WebRTC
  });

  it('handles empty preference lists', () => {
    expect(negotiateTransportPreference([], [])).toBeNull();
    expect(negotiateTransportPreference([pref(1, 1)], [])).toBeNull();
    expect(negotiateTransportPreference([], [pref(1, 1)])).toBeNull();
  });

  it('respects rank order not array order', () => {
    // Initiator array has rank 2 before rank 1 in array order,
    // but the function sorts by rank so rank 1 (WebRTC) is checked first.
    const result = negotiateTransportPreference(
      [pref(1, 2), pref(4, 1)], // WebRTC rank 1, LAN rank 2
      [pref(1, 1), pref(4, 2)], // Responder has both
    );

    // WebRTC (layerId 4) has rank 1 for initiator, so it is checked first.
    expect(result).toBe(4); // WebRTC
  });

  it('two users with different orders negotiate correctly', () => {
    // Full ranked-choice scenario.
    // Initiator: LAN(1) > Nearby(2) > WebRTC(4) > Relay(5)
    // Responder: Relay(5) > WebRTC(4) > Nearby(2)
    // Initiator walks: LAN -- not in responder. Nearby -- in responder. Match.
    const result = negotiateTransportPreference(
      [pref(1, 1), pref(2, 2), pref(4, 3), pref(5, 4)],
      [pref(5, 1), pref(4, 2), pref(2, 3)],
    );

    expect(result).toBe(2); // Nearby
  });

  it('no mutual match falls through to null for default ladder', () => {
    // Completely disjoint preferences.
    // Initiator: BLE only. Responder: Relay only.
    const result = negotiateTransportPreference(
      [pref(3, 1)],
      [pref(5, 1)],
    );

    expect(result).toBeNull();
  });

  it('responder disabled preferences are excluded', () => {
    // Both have LAN and WebRTC, but responder disabled WebRTC.
    const result = negotiateTransportPreference(
      [pref(4, 1), pref(1, 2)],
      [pref(4, 1, false), pref(1, 2)],
    );

    // WebRTC is in responder's list but disabled, so it is excluded.
    // LAN is the first mutual enabled match.
    expect(result).toBe(1); // LAN
  });

  it('all preferences disabled returns null', () => {
    const result = negotiateTransportPreference(
      [pref(1, 1, false), pref(4, 2, false)],
      [pref(1, 1), pref(4, 2)],
    );

    expect(result).toBeNull();
  });

  it('duplicate layer IDs with different ranks picks lowest rank', () => {
    // Edge case: same layerId appears twice with different ranks.
    // Should pick the one with the lower rank.
    const result = negotiateTransportPreference(
      [pref(4, 3), pref(4, 1)],
      [pref(4, 1)],
    );

    expect(result).toBe(4); // WebRTC (rank 1 copy matches)
  });

  it('single layer on both sides matches', () => {
    const result = negotiateTransportPreference(
      [pref(2, 1)],
      [pref(2, 1)],
    );

    expect(result).toBe(2); // Nearby
  });
});

describe('rankMutualTransportPreferences', () => {
  it('returns all mutual enabled layers in initiator rank order', () => {
    const result = rankMutualTransportPreferences(
      [pref(4, 1), pref(1, 2), pref(5, 3)],
      [pref(1, 1), pref(5, 2), pref(4, 3)],
    );

    expect(result).toEqual([4, 1, 5]);
  });

  it('deduplicates repeated layers and skips disabled responder layers', () => {
    const result = rankMutualTransportPreferences(
      [pref(5, 1), pref(5, 2), pref(1, 3)],
      [pref(5, 1, false), pref(1, 2)],
    );

    expect(result).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// negotiateSecurityAgreement
// ---------------------------------------------------------------------------

function securityPref(
  encryptionMode: SyncSecurityPreference['encryptionMode'],
  disappearingMessagesEnabled = false,
  disappearAfterSeconds: number | null = null,
): SyncSecurityPreference {
  return {
    subjectType: 'direct',
    subjectId: 'peer1',
    encryptionMode,
    disappearingMessagesEnabled,
    disappearAfterSeconds,
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('negotiateSecurityAgreement', () => {
  it('confirms encryption when both sides allow it', () => {
    const result = negotiateSecurityAgreement(
      createSecurityOffer(securityPref('required')),
      createSecurityOffer(securityPref('opportunistic')),
    );

    expect(result).toMatchObject({
      canProceed: true,
      encryptionConfirmed: true,
      encryptionRequired: true,
    });
  });

  it('blocks when one side requires encryption and the other turns it off', () => {
    const result = negotiateSecurityAgreement(
      createSecurityOffer(securityPref('required')),
      createSecurityOffer(securityPref('off')),
    );

    expect(result.canProceed).toBe(false);
    expect(result.encryptionConfirmed).toBe(false);
    expect(result.reason).toBe('encryption_required_by_one_side');
  });

  it('blocks opportunistic connections without confirmed encryption', () => {
    const result = negotiateSecurityAgreement(
      createSecurityOffer(securityPref('opportunistic')),
      createSecurityOffer(securityPref('off')),
    );

    expect(result.canProceed).toBe(false);
    expect(result.encryptionConfirmed).toBe(false);
    expect(result.reason).toBe('encryption_required_by_one_side');
  });

  it('confirms disappearing messages only when both sides enable them', () => {
    const result = negotiateSecurityAgreement(
      createSecurityOffer(securityPref('required', true, 7 * 24 * 60 * 60)),
      createSecurityOffer(securityPref('required', true, 24 * 60 * 60)),
    );

    expect(result.disappearingMessagesConfirmed).toBe(true);
    expect(result.disappearAfterSeconds).toBe(24 * 60 * 60);
  });

  it('does not enable disappearing messages from one-sided preference', () => {
    const result = negotiateSecurityAgreement(
      createSecurityOffer(securityPref('required', true, 24 * 60 * 60)),
      createSecurityOffer(securityPref('required', false, null)),
    );

    expect(result.canProceed).toBe(true);
    expect(result.disappearingMessagesConfirmed).toBe(false);
    expect(result.disappearAfterSeconds).toBeNull();
  });

  it('does not confirm encryption when either side cannot encrypt payloads', () => {
    const local = createSecurityOffer(securityPref('required'), { canEncrypt: true });
    const remote = createSecurityOffer(securityPref('required'), { canEncrypt: false });

    const result = negotiateSecurityAgreement(local, remote);

    expect(result.canProceed).toBe(false);
    expect(result.encryptionConfirmed).toBe(false);
    expect(result.reason).toBe('encryption_required_by_one_side');
  });
});
