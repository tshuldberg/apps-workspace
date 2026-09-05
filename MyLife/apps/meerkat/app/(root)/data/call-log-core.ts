// Plan 25 WP-25G: the pure call-history model for the direct-call surface.
//
// Maps a stream of CallState snapshots (from the WP-25D CallSession) into an honest
// call_log row. It is pure so it is unit-tested; the screen layer persists the returned
// row into the device-local call_ tables (outside MEERKAT_SYNC_PREFIXES, so a call history
// NEVER replicates, NC-25.7).
//
// Honesty rules encoded here:
//   - A row's startedAt / duration is set ONLY once the call actually reached 'connected'.
//     A call that rang and was declined/missed/cancelled has no duration.
//   - The terminal outcome is the real terminal phase, never an optimistic label.

import type { CallState } from '@mylife/sync';

export type CallLogOutcome =
  | 'completed'
  | 'missed'
  | 'declined'
  | 'busy'
  | 'failed'
  | 'cancelled';

export interface CallLogRow {
  id: string;
  kind: 'voice' | 'video';
  scope: 'direct';
  peerDeviceId: string;
  direction: 'incoming' | 'outgoing';
  outcome: CallLogOutcome | null;
  connected: boolean;
  startedAtMs: number | null;
  endedAtMs: number | null;
  durationMs: number | null;
  createdAtMs: number;
}

const TERMINAL_TO_OUTCOME: Record<string, CallLogOutcome> = {
  ended: 'completed',
  missed: 'missed',
  declined: 'declined',
  busy: 'busy',
  failed: 'failed',
  cancelled: 'cancelled',
};

export interface CallLogAccumulatorInput {
  callId: string;
  createdAtMs: number;
  direction: 'incoming' | 'outgoing';
}

/**
 * Fold successive CallState snapshots into the current honest CallLogRow. Call it on every
 * state change; the last return value before teardown is the row to persist. Passing the
 * previous row makes it idempotent and monotonic (connected never un-sets).
 */
export function foldCallLog(
  input: CallLogAccumulatorInput,
  state: CallState,
  nowMs: number,
  prev?: CallLogRow,
): CallLogRow {
  const connected = (prev?.connected ?? false) || state.phase === 'connected' || state.phase === 'reconnecting';
  const startedAtMs = prev?.startedAtMs ?? (state.phase === 'connected' ? nowMs : null);

  const isTerminal = state.phase in TERMINAL_TO_OUTCOME;
  const endedAtMs = prev?.endedAtMs ?? (isTerminal ? nowMs : null);
  const outcome = prev?.outcome ?? (isTerminal ? TERMINAL_TO_OUTCOME[state.phase] : null);

  // Duration exists only when the call connected AND has ended; never for a ring-only call.
  const durationMs = connected && startedAtMs !== null && endedAtMs !== null
    ? Math.max(0, endedAtMs - startedAtMs)
    : null;

  return {
    id: input.callId,
    kind: state.media,
    scope: 'direct',
    peerDeviceId: state.remoteDeviceId,
    direction: input.direction,
    outcome,
    connected,
    startedAtMs,
    endedAtMs,
    durationMs,
    createdAtMs: prev?.createdAtMs ?? input.createdAtMs,
  };
}

/** Honest, human one-liner for a history row. Never claims a duration a call did not have. */
export function callLogSummary(row: CallLogRow): string {
  const dir = row.direction === 'incoming' ? 'Incoming' : 'Outgoing';
  const kind = row.kind === 'video' ? 'video' : 'voice';
  if (row.outcome === 'completed' && row.durationMs !== null) {
    const totalSeconds = Math.round(row.durationMs / 1000);
    const mm = Math.floor(totalSeconds / 60);
    const ss = totalSeconds % 60;
    return `${dir} ${kind} call, ${mm}:${ss.toString().padStart(2, '0')}`;
  }
  const label: Record<CallLogOutcome, string> = {
    completed: 'ended before connecting',
    missed: 'missed',
    declined: 'declined',
    busy: 'busy',
    failed: 'could not connect',
    cancelled: 'cancelled',
  };
  const suffix = row.outcome ? label[row.outcome] : 'in progress';
  return `${dir} ${kind} call, ${suffix}`;
}

/**
 * Honest copy for a startCall result-union failure. Every surface that places a
 * call renders THIS map instead of silently dropping the failed result; the
 * 'no_media_backend' line differs per surface because the missing capability is
 * genuinely different (a native build vs browser media support).
 */
export function startCallFailureCopy(reason: string, surface: 'app' | 'browser'): string {
  switch (reason) {
    case 'busy':
      return 'Another call is already in progress.';
    case 'no_media_backend':
      return surface === 'app'
        ? 'Calls need the full app build.'
        : 'Calls need a browser with camera and microphone support.';
    case 'no_relay':
      return 'Calls need a connection server. Set one up in Settings.';
    case 'not_paired':
      return 'This person is not a trusted pairing on this device.';
    case 'signal_failed':
      return 'The call invite could not be sent. Check your connection server.';
    default:
      return 'The call could not be started.';
  }
}
