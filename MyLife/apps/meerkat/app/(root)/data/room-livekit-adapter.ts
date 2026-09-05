// Plan 25 WP-25I: the LiveKit SDK bridge for community rooms.
//
// UNVERIFIED - pending dev build. Like the WebRTC/native transport backends, this file
// lazy-loads @livekit/react-native + livekit-client and returns null when they are absent
// (Expo Go / node / web), so the room screen stays honestly unavailable off a dev build.
// It translates REAL SDK callbacks into the pure room-view-core RoomEvent surface and adds
// no state of its own: phase/security/participants are derived by the core from these
// events only (NC-25.1 / NC-25.4), never fabricated here.

import type { RoomEvent, RoomParticipantSnapshot } from './room-view-core';

// --- Minimal SDK surface (only what this adapter uses); avoids a hard d.ts dependency. --

interface LkParticipant {
  identity: string;
  isMicrophoneEnabled?: boolean;
  isCameraEnabled?: boolean;
  isScreenShareEnabled?: boolean;
}

interface LkRoom {
  localParticipant: LkParticipant;
  remoteParticipants: Map<string, LkParticipant> | Record<string, LkParticipant>;
  connect(url: string, token: string, opts?: unknown): Promise<void>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
}

interface LkModule {
  Room: new (opts?: unknown) => LkRoom;
  RoomEvent: Record<string, string>;
  ConnectionState: Record<string, string>;
}

interface LkReactNative {
  registerGlobals?: () => void;
  AudioSession?: { startAudioSession(): Promise<void>; stopAudioSession(): Promise<void> };
}

function loadLiveKit(): { client: LkModule; rn: LkReactNative } | null {
  try {
    // Neither package is safe to evaluate without its native bridges.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native') as {
      NativeModules?: { WebRTCModule?: unknown; LivekitReactNativeModule?: unknown };
    };
    if (!NativeModules?.WebRTCModule || !NativeModules.LivekitReactNativeModule) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('@livekit/react-native') as LkReactNative;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require('livekit-client') as LkModule;
    if (!client?.Room) return null;
    rn.registerGlobals?.();
    return { client, rn };
  } catch {
    return null;
  }
}

function participantsOf(room: LkRoom): LkParticipant[] {
  const remotes = room.remoteParticipants;
  const list = remotes instanceof Map ? Array.from(remotes.values()) : Object.values(remotes ?? {});
  return [room.localParticipant, ...list];
}

function snapshot(room: LkRoom): RoomParticipantSnapshot[] {
  return participantsOf(room).map((p) => ({
    id: p.identity,
    isLocal: p.identity === room.localParticipant.identity,
    micOn: Boolean(p.isMicrophoneEnabled),
    camOn: Boolean(p.isCameraEnabled),
    screenOn: Boolean(p.isScreenShareEnabled),
  }));
}

/** Map the SDK ConnectionState string to the core's RoomConnectionState. */
function mapConnectionState(state: string): RoomEvent | null {
  switch (state) {
    case 'signalReconnecting':
    case 'reconnecting': return { type: 'connectionState', state: 'reconnecting' };
    case 'connected': return { type: 'connectionState', state: 'connected' };
    case 'connecting': return { type: 'connectionState', state: 'connecting' };
    case 'disconnected': return { type: 'connectionState', state: 'disconnected' };
    default: return null;
  }
}

export interface RoomLiveKitSession {
  disconnect(): Promise<void>;
  /** Best-effort local mic/cam/screen toggles; each returns the SDK promise. */
  setMic(enabled: boolean): Promise<void>;
  setCamera(enabled: boolean): Promise<void>;
  setScreenShare(enabled: boolean): Promise<void>;
}

export interface ConnectRoomInput {
  livekitWsUrl: string;
  token: string;
  onEvent: (event: RoomEvent) => void;
}

/** Returns null when the SDK is absent (the room stays honestly unavailable). */
export async function connectLiveKitRoom(input: ConnectRoomInput): Promise<RoomLiveKitSession | null> {
  const loaded = loadLiveKit();
  if (!loaded) return null;
  const { client, rn } = loaded;
  const room = new client.Room();
  let closed = false;
  let closing: Promise<void> | null = null;
  const subscriptions: Array<() => void> = [];
  const listen = (event: string, handler: (...args: unknown[]) => void) => {
    const guarded = (...args: unknown[]) => { if (!closed) handler(...args); };
    room.on(event, guarded);
    subscriptions.push(() => room.off?.(event, guarded));
  };
  const teardown = (): Promise<void> => {
    if (closing) return closing;
    closed = true;
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    closing = (async () => {
      try { await room.disconnect(); } catch { /* best effort */ }
      try { await rn.AudioSession?.stopAudioSession(); } catch { /* best effort */ }
    })();
    return closing;
  };


  const emitParticipants = () => input.onEvent({ type: 'participants', participants: snapshot(room) });

  const RE = client.RoomEvent;
  listen(RE.ConnectionStateChanged ?? 'connectionStateChanged', (state) => {
    const event = mapConnectionState(String(state));
    if (event) input.onEvent(event);
    if (event?.type === 'connectionState' && event.state === 'connected') emitParticipants();
  });
  listen(RE.ParticipantConnected ?? 'participantConnected', emitParticipants);
  listen(RE.ParticipantDisconnected ?? 'participantDisconnected', emitParticipants);
  listen(RE.TrackMuted ?? 'trackMuted', emitParticipants);
  listen(RE.TrackUnmuted ?? 'trackUnmuted', emitParticipants);
  listen(RE.LocalTrackPublished ?? 'localTrackPublished', emitParticipants);
  listen(RE.LocalTrackUnpublished ?? 'localTrackUnpublished', emitParticipants);
  listen(RE.ActiveSpeakersChanged ?? 'activeSpeakersChanged', (speakers) => {
    const ids = Array.isArray(speakers) ? speakers.map((s) => (s as LkParticipant).identity) : [];
    input.onEvent({ type: 'activeSpeakers', speakingIds: ids });
  });
  listen(RE.Disconnected ?? 'disconnected', () => {
    void teardown();
    input.onEvent({ type: 'left', reason: 'disconnected' });
  });

  try {
    await rn.AudioSession?.startAudioSession();
    await room.connect(input.livekitWsUrl, input.token);
  } catch {
    await teardown();
    input.onEvent({ type: 'failed', reason: 'connect_failed' });
    return null;
  }
  if (closed) return null;

  const setEnabled = async (kind: 'mic' | 'camera' | 'screen', enabled: boolean) => {
    if (closed) throw new Error('The room session has ended.');
    const lp = room.localParticipant as unknown as Record<string, (v: boolean) => Promise<void>>;
    const fn = kind === 'mic'
      ? lp.setMicrophoneEnabled
      : kind === 'camera'
        ? lp.setCameraEnabled
        : lp.setScreenShareEnabled;
    if (typeof fn !== 'function') throw new Error(`Room ${kind} control is unavailable.`);
    await fn.call(room.localParticipant, enabled);
    if (!closed) emitParticipants();
  };

  return {
    async disconnect() {
      const alreadyClosed = closed;
      await teardown();
      if (!alreadyClosed) input.onEvent({ type: 'left', reason: 'disconnected' });
    },
    setMic: (enabled) => setEnabled('mic', enabled),
    setCamera: (enabled) => setEnabled('camera', enabled),
    setScreenShare: (enabled) => setEnabled('screen', enabled),
  };
}
