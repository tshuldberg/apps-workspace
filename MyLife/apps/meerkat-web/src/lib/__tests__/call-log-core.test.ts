import { describe, expect, it } from 'vitest';
import type { CallState } from '@mylife/sync';
import { callLogSummary, foldCallLog, startCallFailureCopy, type CallLogRow } from '../call-log-core';

function state(phase: CallState['phase'], over: Partial<CallState> = {}): CallState {
  return {
    phase,
    media: over.media ?? 'voice',
    direction: over.direction ?? 'outgoing',
    callId: over.callId ?? 'call-1',
    remoteDeviceId: over.remoteDeviceId ?? 'peer',
    securityMode: over.securityMode ?? 'direct_e2e',
    iceState: over.iceState ?? 'new',
    localMicOn: over.localMicOn ?? true,
    localCamOn: over.localCamOn ?? false,
  };
}

const input = { callId: 'call-1', createdAtMs: 1000, direction: 'outgoing' as const };

function fold(phases: Array<[CallState['phase'], number]>): CallLogRow {
  let row: CallLogRow | undefined;
  for (const [phase, now] of phases) row = foldCallLog(input, state(phase), now, row);
  return row!;
}

describe('call log core - duration only after a real connection', () => {
  it('a completed call carries startedAt and a real duration', () => {
    const row = fold([['inviting', 1000], ['ringing', 1200], ['connected', 2000], ['ended', 5000]]);
    expect(row.connected).toBe(true);
    expect(row.startedAtMs).toBe(2000);
    expect(row.endedAtMs).toBe(5000);
    expect(row.durationMs).toBe(3000);
    expect(row.outcome).toBe('completed');
  });

  it('a declined ring never has a duration or a start time', () => {
    const row = fold([['inviting', 1000], ['ringing', 1200], ['declined', 1500]]);
    expect(row.connected).toBe(false);
    expect(row.startedAtMs).toBeNull();
    expect(row.durationMs).toBeNull();
    expect(row.outcome).toBe('declined');
  });

  it('a missed call has no duration', () => {
    const row = fold([['ringing', 1000], ['missed', 46_000]]);
    expect(row.durationMs).toBeNull();
    expect(row.outcome).toBe('missed');
  });

  it('a failed negotiation after connecting-but-not-connected has no duration', () => {
    const row = fold([['inviting', 1000], ['negotiating', 1500], ['failed', 2000]]);
    expect(row.connected).toBe(false);
    expect(row.durationMs).toBeNull();
    expect(row.outcome).toBe('failed');
  });

  it('a reconnect that later ends still measures from the first connect', () => {
    const row = fold([['connected', 2000], ['reconnecting', 4000], ['connected', 5000], ['ended', 8000]]);
    expect(row.startedAtMs).toBe(2000);
    expect(row.durationMs).toBe(6000);
  });

  it('the terminal outcome and start are monotonic (a later snapshot cannot rewrite them)', () => {
    const first = foldCallLog(input, state('connected'), 2000);
    const second = foldCallLog(input, state('ended'), 5000, first);
    const third = foldCallLog(input, state('connected'), 9000, second); // stray late snapshot
    expect(third.outcome).toBe('completed');
    expect(third.endedAtMs).toBe(5000);
    expect(third.durationMs).toBe(3000);
  });
});

describe('call log core - honest summaries', () => {
  it('formats a completed call with mm:ss', () => {
    const row = fold([['connected', 0], ['ended', 125_000]]);
    expect(callLogSummary(row)).toBe('Outgoing voice call, 2:05');
  });

  it('never claims a duration for a non-connected call', () => {
    expect(callLogSummary(fold([['ringing', 0], ['declined', 1]]))).toBe('Outgoing voice call, declined');
    expect(callLogSummary(fold([['ringing', 0], ['missed', 1]]))).toBe('Outgoing voice call, missed');
    expect(callLogSummary(fold([['inviting', 0], ['failed', 1]]))).toBe('Outgoing voice call, could not connect');
  });

  it('labels an in-progress call honestly', () => {
    expect(callLogSummary(fold([['ringing', 0]]))).toBe('Outgoing voice call, in progress');
  });
});

describe('startCallFailureCopy - every failed start renders honest copy', () => {
  it('maps every known reason on both surfaces', () => {
    expect(startCallFailureCopy('busy', 'app')).toBe('Another call is already in progress.');
    expect(startCallFailureCopy('no_relay', 'browser')).toBe('Calls need a connection server. Set one up in Settings.');
    expect(startCallFailureCopy('not_paired', 'app')).toBe('This person is not a trusted pairing on this device.');
    expect(startCallFailureCopy('signal_failed', 'browser')).toBe('The call invite could not be sent. Check your connection server.');
  });

  it('states the genuinely different missing capability per surface', () => {
    expect(startCallFailureCopy('no_media_backend', 'app')).toBe('Calls need the full app build.');
    expect(startCallFailureCopy('no_media_backend', 'browser')).toBe('Calls need a browser with camera and microphone support.');
  });

  it('an unknown reason still yields an honest failure line, never an empty string', () => {
    expect(startCallFailureCopy('unknown', 'app')).toBe('The call could not be started.');
    expect(startCallFailureCopy('', 'browser')).toBe('The call could not be started.');
  });
});
