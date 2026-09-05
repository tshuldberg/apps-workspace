// Plan 38 Phase 6 (MOBILE, amendment C.8): the DEVICE-LOCAL music queue. This is
// a pure reducer over an in-memory queue -- it never touches the db, never
// replicates, and never leaks what you are playing (a queue is personal state,
// like resume position). The provider/screen holds the state and drives the
// player; OS transport controls (react-native-track-player) are a lazy,
// dev-build-only mirror of this same state (see track-player-backend.ts), so
// this reducer stays the single source of truth for what plays next.
//
// Node-only, no React and no expo, so the queue transitions are unit-tested
// without a render harness.

/** One queued track -- enough to feed the player and the OS transport controls. */
export interface QueueTrack {
  itemId: string;
  channelId: string;
  communityId: string;
  title: string;
  artist: string | null;
  durationMs: number | null;
}

/** The queue: an ordered track list and the index of the current track. */
export interface MusicQueueState {
  tracks: readonly QueueTrack[];
  /** Index of the current track, or -1 when the queue is empty. */
  index: number;
}

export const EMPTY_QUEUE: MusicQueueState = { tracks: [], index: -1 };

export type MusicQueueAction =
  /** Replace the queue and start at startIndex (clamped). */
  | { type: 'set'; tracks: readonly QueueTrack[]; startIndex?: number }
  /** Append a track to the end (starts the queue if it was empty). */
  | { type: 'enqueue'; track: QueueTrack }
  /** Jump to an explicit index (clamped; ignored when out of range on an empty queue). */
  | { type: 'jump'; index: number }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'clear' };

function clampIndex(length: number, index: number): number {
  if (length === 0) return -1;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

/** The pure queue transition. Never mutates the input state. */
export function musicQueueReducer(state: MusicQueueState, action: MusicQueueAction): MusicQueueState {
  switch (action.type) {
    case 'set': {
      const tracks = [...action.tracks];
      return { tracks, index: clampIndex(tracks.length, action.startIndex ?? 0) };
    }
    case 'enqueue': {
      const tracks = [...state.tracks, action.track];
      // Appending to an empty queue makes the new track current.
      return { tracks, index: state.index < 0 ? 0 : state.index };
    }
    case 'jump':
      return { ...state, index: clampIndex(state.tracks.length, action.index) };
    case 'next': {
      if (state.tracks.length === 0) return state;
      if (state.index >= state.tracks.length - 1) return state; // no wrap; honest end of queue
      return { ...state, index: state.index + 1 };
    }
    case 'previous': {
      if (state.tracks.length === 0) return state;
      if (state.index <= 0) return state;
      return { ...state, index: state.index - 1 };
    }
    case 'clear':
      return EMPTY_QUEUE;
    default:
      return state;
  }
}

/** The current track, or null when the queue is empty. */
export function currentTrack(state: MusicQueueState): QueueTrack | null {
  if (state.index < 0 || state.index >= state.tracks.length) return null;
  return state.tracks[state.index] ?? null;
}

/** True when a `next` would advance to a real track. */
export function hasNext(state: MusicQueueState): boolean {
  return state.tracks.length > 0 && state.index < state.tracks.length - 1;
}

/** True when a `previous` would move to a real track. */
export function hasPrevious(state: MusicQueueState): boolean {
  return state.tracks.length > 0 && state.index > 0;
}
