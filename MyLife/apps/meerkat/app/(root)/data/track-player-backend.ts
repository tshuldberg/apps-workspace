// Plan 38 Phase 6 (MOBILE, amendment C.8): OS transport controls for the music
// queue via react-native-track-player. This is a NATIVE-module path exactly like
// data/lan-backend.ts: track-player is NOT a bundled dependency, so it exists
// only in a dev/EAS build that adds it. It is therefore lazy-required and returns
// null everywhere else (Expo Go, a build without it). When null, the music screen
// keeps working with IN-APP controls only -- it never fakes an OS integration, a
// lock-screen widget, or a "playing in the background" claim it cannot honor.
//
// The device-local music queue (music-queue-core.ts) stays the single source of
// truth; this backend is a best-effort MIRROR of that state onto the OS transport
// UI. The screen drives real playback through expo-video/loopback regardless.

/** One track handed to the OS transport UI (metadata only; the URL is the loopback URL). */
export interface TransportTrack {
  id: string;
  url: string;
  title: string;
  artist: string | null;
  durationMs: number | null;
}

/** The minimal transport-control surface the music screen uses. */
export interface TrackPlayerBackend {
  /** Idempotent player setup; resolves false if the native player refuses to init. */
  setup(): Promise<boolean>;
  /** Replace the OS transport queue metadata (no audio moves; expo-video owns audio). */
  setQueue(tracks: TransportTrack[], startIndex: number): Promise<void>;
  /** Reflect play/pause state onto the OS UI. */
  setPlaying(playing: boolean): Promise<void>;
  /** Register handlers for the OS transport buttons (next/prev/play/pause). */
  onRemoteCommand(handlers: RemoteCommandHandlers): void;
  /** Tear down the native player and clear the OS transport UI. */
  destroy(): Promise<void>;
}

export interface RemoteCommandHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

// The subset of the react-native-track-player module we touch, typed locally so
// we neither depend on its types nor on it being installed.
interface TrackPlayerModule {
  setupPlayer(options?: Record<string, unknown>): Promise<void>;
  reset(): Promise<void>;
  add(tracks: Array<Record<string, unknown>>): Promise<void>;
  skip(index: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  updateOptions(options: Record<string, unknown>): Promise<void>;
  addEventListener(event: string, handler: () => void): { remove: () => void };
  Event: Record<string, string>;
  Capability: Record<string, number>;
}

function loadModule(): TrackPlayerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-track-player') as { default?: TrackPlayerModule } & TrackPlayerModule;
    return (mod.default ?? mod) as TrackPlayerModule;
  } catch {
    return null;
  }
}

/**
 * Load the track-player transport backend, or null when the native module is
 * absent (Expo Go / a build without react-native-track-player). Mirrors
 * data/lan-backend.ts: a null return is the honest degraded path, never a crash.
 */
export function loadTrackPlayerBackend(): TrackPlayerBackend | null {
  const TP = loadModule();
  if (!TP) return null;

  const subscriptions: Array<{ remove: () => void }> = [];
  let ready = false;

  return {
    async setup() {
      if (ready) return true;
      try {
        await TP.setupPlayer();
        await TP.updateOptions({
          capabilities: [
            TP.Capability.Play, TP.Capability.Pause,
            TP.Capability.SkipToNext, TP.Capability.SkipToPrevious,
          ].filter((c) => c !== undefined),
        });
        ready = true;
        return true;
      } catch {
        return false;
      }
    },
    async setQueue(tracks, startIndex) {
      if (!ready) return;
      try {
        await TP.reset();
        await TP.add(tracks.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          artist: t.artist ?? undefined,
          duration: t.durationMs ? t.durationMs / 1000 : undefined,
        })));
        if (startIndex > 0) await TP.skip(startIndex);
      } catch {
        // Best-effort mirror; in-app playback is unaffected.
      }
    },
    async setPlaying(playing) {
      if (!ready) return;
      try { await (playing ? TP.play() : TP.pause()); } catch { /* ignore */ }
    },
    onRemoteCommand(handlers) {
      if (!TP.Event) return;
      const bind = (event: string | undefined, fn?: () => void): void => {
        if (!event || !fn) return;
        try { subscriptions.push(TP.addEventListener(event, fn)); } catch { /* ignore */ }
      };
      bind(TP.Event.RemotePlay, handlers.onPlay);
      bind(TP.Event.RemotePause, handlers.onPause);
      bind(TP.Event.RemoteNext, handlers.onNext);
      bind(TP.Event.RemotePrevious, handlers.onPrevious);
    },
    async destroy() {
      for (const sub of subscriptions.splice(0)) {
        try { sub.remove(); } catch { /* ignore */ }
      }
      if (!ready) return;
      ready = false;
      try { await TP.reset(); } catch { /* ignore */ }
    },
  };
}
