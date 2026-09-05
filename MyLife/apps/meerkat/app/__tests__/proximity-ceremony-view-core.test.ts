/**
 * Plan 53 P2: the ceremony screen's pure view model.
 *
 * What matters here is not styling but the security and honesty copy rules:
 * confirm exists in exactly one phase (the SAS comparison can never be skipped
 * or automated), every terminal-without-commit state says nothing was saved
 * (AC-2), the nearby-takeover consequence is stated during active phases (plan
 * amendment), and no line ever says "tap" as a hardware mechanism.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncPrngFromGlobalCrypto,
  createSignedIdentityBundle,
  deriveSas,
  generateDeviceIdentity,
  type CeremonyFailure,
  type CeremonyPhase,
  type CeremonyState,
  type SignedIdentityBundle,
} from '@mylife/sync';
import {
  ceremonyModeFromParam,
  ceremonyScreenModel,
  inPersonWindowLine,
  ALREADY_PAIRED_LINE,
  IN_PERSON_ENTRY_HINT,
  IN_PERSON_ENTRY_TITLE,
  IN_PERSON_NEARBY_PAUSE_LINE,
  IN_PERSON_NEEDS_DEV_BUILD_LINE,
  IN_PERSON_NO_SERVER_LINE,
  IN_PERSON_PAIR_ENTRY_HINT,
  IN_PERSON_PAIR_ENTRY_TITLE,
  IN_PERSON_SAS_INSTRUCTION,
  type CeremonyMode,
} from '../(root)/data/proximity-ceremony-view-core';

const ALL_PHASES: CeremonyPhase[] = [
  'discovering', 'connected', 'awaiting_confirm', 'awaiting_peer',
  'committed', 'cancelled', 'expired', 'failed',
];
const ALL_FAILURES: CeremonyFailure[] = [
  'peer_bundle_rejected', 'peer_accept_rejected', 'self_pairing', 'transport_lost',
];

let peerBundle: SignedIdentityBundle;

beforeEach(() => {
  configureSyncPrngFromGlobalCrypto();
  peerBundle = createSignedIdentityBundle(generateDeviceIdentity('Nia'));
});

function stateAt(phase: CeremonyPhase, failure?: CeremonyFailure): CeremonyState {
  const withPeer = phase === 'awaiting_confirm' || phase === 'awaiting_peer' || phase === 'committed';
  return {
    phase,
    startedAt: 0,
    ephemeral: {
      ceremonyId: 'aa'.repeat(8),
      nonce: 'bb'.repeat(16),
      ephemeralPublicKey: 'cc'.repeat(32),
      ephemeralSecretKey: new Uint8Array(32),
    },
    ...(withPeer ? {
      peerBundle,
      transcriptHash: 'dd'.repeat(32),
      sas: deriveSas(new Uint8Array(32).fill(7)),
    } : {}),
    ...(failure ? { failure } : {}),
  };
}

describe('proximity ceremony view core (plan 53 P2)', () => {
  it('enables confirm in exactly one phase: awaiting_confirm, with the SAS on screen', () => {
    for (const phase of ALL_PHASES) {
      const model = ceremonyScreenModel(stateAt(phase), 'friend', undefined);
      expect(model.confirmEnabled, phase).toBe(phase === 'awaiting_confirm');
    }
    const confirming = ceremonyScreenModel(stateAt('awaiting_confirm'), 'friend', undefined);
    expect(confirming.sasEmoji).toHaveLength(5);
    expect(confirming.headline).toBe('Confirm Adding Nia');
    expect(confirming.detail).toBe(IN_PERSON_SAS_INSTRUCTION);
  });

  it('keeps the SAS visible and cancellable while waiting for the peer', () => {
    const model = ceremonyScreenModel(stateAt('awaiting_peer'), 'friend', undefined);
    expect(model.sasEmoji).toHaveLength(5);
    expect(model.cancelEnabled).toBe(true);
    expect(model.confirmEnabled).toBe(false);
    expect(model.headline).toContain('Nia');
  });

  it('every terminal state without a commit says nothing was saved (AC-2)', () => {
    const terminals: CeremonyState[] = [
      stateAt('cancelled'),
      stateAt('expired'),
      ...ALL_FAILURES.map((failure) => stateAt('failed', failure)),
    ];
    for (const state of terminals) {
      const model = ceremonyScreenModel(state, 'friend', undefined);
      expect(model.detail, state.failure ?? state.phase).toContain('Nothing was saved');
      expect(model.retryEnabled).toBe(true);
      expect(model.confirmEnabled).toBe(false);
      expect(model.sasEmoji).toBeNull();
    }
  });

  it('each failure reason gets its own honest copy', () => {
    const headlines = new Set(
      ALL_FAILURES.map((failure) => ceremonyScreenModel(stateAt('failed', failure), 'friend', undefined).headline),
    );
    expect(headlines.size).toBe(ALL_FAILURES.length);
    for (const failure of ALL_FAILURES) {
      expect(ceremonyScreenModel(stateAt('failed', failure), 'friend', undefined).tone).toBe('error');
    }
  });

  it('committed waits for the pairing write, then reports it per mode', () => {
    const pending = ceremonyScreenModel(stateAt('committed'), 'friend', undefined);
    expect(pending.busy).toBe(true);
    expect(pending.tone).toBe('normal');

    const friend = ceremonyScreenModel(stateAt('committed'), 'friend', null);
    expect(friend.tone).toBe('success');
    expect(friend.headline).toContain('Nia');
    expect(friend.showMessageButton).toBe(true);

    const device = ceremonyScreenModel(stateAt('committed'), 'device', null);
    expect(device.tone).toBe('success');
    expect(device.headline).toBe('Paired with Nia');
    expect(device.detail).toContain('pairing code');
    expect(device.showMessageButton).toBe(false);
  });

  it('treats "already paired" as the benign two-generals re-run, not an error', () => {
    const model = ceremonyScreenModel(stateAt('committed'), 'friend', ALREADY_PAIRED_LINE);
    expect(model.tone).toBe('success');
    expect(model.retryEnabled).toBe(false);
    expect(model.detail).toContain('Nia');
    expect(model.showMessageButton).toBe(true);
  });

  it('offers the DM action ONLY on a written friend pairing (P3)', () => {
    for (const mode of ['friend', 'device'] as CeremonyMode[]) {
      for (const phase of ALL_PHASES) {
        for (const commitError of [undefined, null, ALREADY_PAIRED_LINE, 'refused'] as const) {
          const model = ceremonyScreenModel(stateAt(phase), mode, commitError);
          const earned = phase === 'committed' && mode === 'friend'
            && (commitError === null || commitError === ALREADY_PAIRED_LINE);
          expect(model.showMessageButton, `${mode}/${phase}/${String(commitError)}`).toBe(earned);
        }
      }
    }
  });

  it('surfaces a refused pairing write verbatim as an error with retry', () => {
    const refusal = 'This identity failed signature verification. Do not pair: it may be a man-in-the-middle.';
    const model = ceremonyScreenModel(stateAt('committed'), 'friend', refusal);
    expect(model.tone).toBe('error');
    expect(model.detail).toBe(refusal);
    expect(model.retryEnabled).toBe(true);
  });

  it('shows the context lines during active phases and drops them at terminal ones', () => {
    for (const phase of ALL_PHASES) {
      const model = ceremonyScreenModel(stateAt(phase), 'friend', undefined);
      const active = phase === 'discovering' || phase === 'connected'
        || phase === 'awaiting_confirm' || phase === 'awaiting_peer';
      expect(model.showContextLines, phase).toBe(active);
    }
  });

  it('states the nearby-sync pause and the real 90 second window', () => {
    expect(IN_PERSON_NEARBY_PAUSE_LINE).toContain('nearby device sync is paused');
    expect(inPersonWindowLine()).toContain('90 seconds');
  });

  it('never says "tap" as a mechanism and never implies the emoji comparison is optional', () => {
    const allCopy: string[] = [
      IN_PERSON_ENTRY_TITLE, IN_PERSON_PAIR_ENTRY_TITLE,
      IN_PERSON_ENTRY_HINT, IN_PERSON_PAIR_ENTRY_HINT,
      IN_PERSON_NEEDS_DEV_BUILD_LINE, IN_PERSON_NEARBY_PAUSE_LINE,
      IN_PERSON_NO_SERVER_LINE, IN_PERSON_SAS_INSTRUCTION, inPersonWindowLine(),
    ];
    for (const mode of ['friend', 'device'] as CeremonyMode[]) {
      for (const phase of ALL_PHASES) {
        for (const commitError of [undefined, null, ALREADY_PAIRED_LINE, 'refused'] as const) {
          const model = ceremonyScreenModel(stateAt(phase), mode, commitError);
          allCopy.push(model.headline, model.detail);
        }
      }
      for (const failure of ALL_FAILURES) {
        const model = ceremonyScreenModel(stateAt('failed', failure), mode, undefined);
        allCopy.push(model.headline, model.detail);
      }
    }
    for (const line of allCopy) {
      expect(line, line).not.toMatch(/\btap\b/i);
      expect(line, line).not.toContain('—');
    }
    expect(IN_PERSON_SAS_INSTRUCTION).toContain('Confirm only if');
  });

  it('parses the route mode param, defaulting to friend', () => {
    expect(ceremonyModeFromParam('device')).toBe('device');
    expect(ceremonyModeFromParam('friend')).toBe('friend');
    expect(ceremonyModeFromParam(undefined)).toBe('friend');
    expect(ceremonyModeFromParam('garbage')).toBe('friend');
    expect(ceremonyModeFromParam(['device'])).toBe('friend');
  });
});
