// Plan 25 WP-25I: the pure community-room view model (mobile + web share this logic).
//
// It maps an abstracted stream of LiveKit room events into a RoomViewState the screen
// renders. It touches no SDK and no IO, exactly like the transport backends abstract the
// WebRTC surface, so it is unit-testable and the honesty invariants are enforced here:
//
//   - NC-25.1: phase becomes 'joined' ONLY on a real backend Connected event. Receiving a
//     token, authorizing, or connecting never sets joined; a fabricated participant list
//     never sets joined. There is no timer and no optimistic transition.
//   - NC-25.4 / NC-25.10: the security badge reads 'end_to_end' ONLY when a real E2EE
//     event confirms every current participant has E2EE active. Any participant without it
//     (or the absence of a confirming event) keeps the room at 'room_server'. A client can
//     never inherit an E2EE badge it has not locally confirmed for the whole room.
//   - Participant mic/cam/screen/speaking/hand come from real events only, never guessed.

import type { RoomPermission } from '@mylife/sync';

export type RoomPhase =
  | 'idle'
  | 'authorizing'
  | 'connecting'
  | 'joined'
  | 'reconnecting'
  | 'left'
  | 'failed';

export type RoomSecurityMode = 'end_to_end' | 'room_server';

export type RoomConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface RoomParticipantView {
  /** The ephemeral LiveKit identity, never a Meerkat device/persona id. */
  id: string;
  isLocal: boolean;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  speaking: boolean;
  handRaised: boolean;
  /** Whether THIS participant has E2EE active, as reported by a real E2EE event. */
  e2eeActive: boolean;
}

export interface RoomViewState {
  phase: RoomPhase;
  securityMode: RoomSecurityMode;
  participants: RoomParticipantView[];
  localParticipantId: string | null;
  localPermissions: RoomPermission[];
  /** A stable, honest end reason/label when phase is 'failed' or 'left'. */
  endReason: string | null;
}

/** The abstracted event surface the SDK adapter feeds in. No SDK types leak into the core. */
export type RoomEvent =
  | { type: 'authorizing' }
  | { type: 'connecting'; localParticipantId: string; localPermissions: RoomPermission[] }
  | { type: 'connectionState'; state: RoomConnectionState }
  | { type: 'participants'; participants: RoomParticipantSnapshot[] }
  | { type: 'activeSpeakers'; speakingIds: string[] }
  | { type: 'handRaise'; participantId: string; raised: boolean }
  | { type: 'e2ee'; allParticipantsEncrypted: boolean; perParticipant?: Record<string, boolean> }
  | { type: 'left'; reason?: string }
  | { type: 'failed'; reason: string };

export interface RoomParticipantSnapshot {
  id: string;
  isLocal: boolean;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  handRaised?: boolean;
}

export function initialRoomViewState(): RoomViewState {
  return {
    phase: 'idle',
    securityMode: 'room_server',
    participants: [],
    localParticipantId: null,
    localPermissions: [],
    endReason: null,
  };
}

const TERMINAL: ReadonlySet<RoomPhase> = new Set<RoomPhase>(['left', 'failed']);

function mergeParticipants(
  prev: RoomParticipantView[],
  snapshots: RoomParticipantSnapshot[],
): RoomParticipantView[] {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  return snapshots.map((s) => {
    const existing = prevById.get(s.id);
    return {
      id: s.id,
      isLocal: s.isLocal,
      micOn: s.micOn,
      camOn: s.camOn,
      screenOn: s.screenOn,
      handRaised: s.handRaised ?? existing?.handRaised ?? false,
      // speaking + e2ee ride their own events; preserve until the next one arrives.
      speaking: existing?.speaking ?? false,
      e2eeActive: existing?.e2eeActive ?? false,
    };
  });
}

/** Room-wide E2EE is claimed only when a real event confirms every participant has it. */
function deriveSecurityMode(participants: RoomParticipantView[]): RoomSecurityMode {
  if (participants.length === 0) return 'room_server';
  return participants.every((p) => p.e2eeActive) ? 'end_to_end' : 'room_server';
}

export function reduceRoomView(state: RoomViewState, event: RoomEvent): RoomViewState {
  if (TERMINAL.has(state.phase)) return state;

  switch (event.type) {
    case 'authorizing':
      return { ...state, phase: 'authorizing', endReason: null };

    case 'connecting':
      return {
        ...state,
        phase: 'connecting',
        localParticipantId: event.localParticipantId,
        localPermissions: [...event.localPermissions],
      };

    case 'connectionState': {
      // NC-25.1: 'joined' is reachable ONLY from a real Connected backend event.
      if (event.state === 'connected') return { ...state, phase: 'joined' };
      if (event.state === 'reconnecting') {
        return state.phase === 'joined' || state.phase === 'reconnecting'
          ? { ...state, phase: 'reconnecting' }
          : state;
      }
      if (event.state === 'disconnected') {
        return { ...state, phase: 'left', endReason: state.endReason ?? 'disconnected' };
      }
      // 'connecting' never promotes to joined and never demotes a live room.
      return state.phase === 'idle' || state.phase === 'authorizing'
        ? { ...state, phase: 'connecting' }
        : state;
    }

    case 'participants': {
      const participants = mergeParticipants(state.participants, event.participants);
      return { ...state, participants, securityMode: deriveSecurityMode(participants) };
    }

    case 'activeSpeakers': {
      const speaking = new Set(event.speakingIds);
      const participants = state.participants.map((p) => ({ ...p, speaking: speaking.has(p.id) }));
      return { ...state, participants };
    }

    case 'handRaise': {
      const participants = state.participants.map((p) =>
        p.id === event.participantId ? { ...p, handRaised: event.raised } : p,
      );
      return { ...state, participants };
    }

    case 'e2ee': {
      const per = event.perParticipant;
      const participants = state.participants.map((p) => ({
        ...p,
        e2eeActive: per ? Boolean(per[p.id]) : event.allParticipantsEncrypted,
      }));
      // Never trust the aggregate flag over per-participant truth: recompute from members.
      return { ...state, participants, securityMode: deriveSecurityMode(participants) };
    }

    case 'left':
      return { ...state, phase: 'left', endReason: event.reason ?? 'left' };

    case 'failed':
      return { ...state, phase: 'failed', endReason: event.reason };

    default:
      return state;
  }
}

/** Honest one-line security copy for the room banner. */
export function roomSecurityCopy(mode: RoomSecurityMode): string {
  return mode === 'end_to_end'
    ? 'End-to-end encrypted'
    : 'Encrypted to the room server, not end-to-end';
}

/** Whether the local participant may show a given publish control, from granted permissions. */
export function canUseControl(
  permissions: readonly RoomPermission[],
  control: 'mic' | 'camera' | 'screen',
): boolean {
  if (control === 'mic') return permissions.includes('publish_audio');
  if (control === 'camera') return permissions.includes('publish_video');
  return permissions.includes('publish_screen');
}
