// Raw Expo module contract fulfilled by MeerkatCallKitModule.swift and
// MeerkatTelecomModule.kt. The native package owns only the OS call surface.
// Identity verification, media, signaling, and call truth remain in the app and
// @mylife/sync.

export type NativeCallPlatform = 'ios' | 'android' | 'unknown';

export interface NativeCallCapability {
  platform: NativeCallPlatform;
  available: boolean;
  reason: string;
}

export type NativeCallEndReason =
  | 'failed'
  | 'remoteEnded'
  | 'unanswered'
  | 'answeredElsewhere'
  | 'declinedElsewhere'
  | 'localEnded'
  | 'rejected'
  | 'missed'
  | 'busy'
  | 'cancelled'
  | 'reset'
  | 'unknown';

export type NativeAudioRoute =
  | 'earpiece'
  | 'speaker'
  | 'bluetooth'
  | 'wiredHeadset'
  | 'streaming'
  | 'unknown';

export interface NativeAudioRouteDescriptor {
  id: string;
  type: NativeAudioRoute;
}

export interface NativeCallEventMap {
  incomingCallReported: {
    callUUID: string;
    hasVideo: boolean;
    malformed: boolean;
    duplicate: boolean;
  };
  callAnswered: {
    callId: string;
    platform: Exclude<NativeCallPlatform, 'unknown'>;
  };
  callEnded: {
    callId: string;
    platform: Exclude<NativeCallPlatform, 'unknown'>;
    reason: NativeCallEndReason;
  };
  muteChanged: {
    callId: string;
    muted: boolean;
    platform: Exclude<NativeCallPlatform, 'unknown'>;
  };
  audioSessionChanged: {
    callId?: string;
    active: boolean;
    platform: Exclude<NativeCallPlatform, 'unknown'>;
    route?: NativeAudioRoute;
  };
  voipTokenChanged: {
    token: string | null;
    invalidated: boolean;
  };
  telecomStateChanged: {
    callId?: string;
    platform: Exclude<NativeCallPlatform, 'unknown'>;
    state: string;
    audioRoute?: NativeAudioRoute;
    availableRoutes?: NativeAudioRouteDescriptor[];
  };
}

export type NativeCallEventName = keyof NativeCallEventMap;

export interface NativeSubscription {
  remove(): void;
}

export interface StartOutgoingCallInput {
  callUUID: string;
  hasVideo: boolean;
}

export interface UpdateCallInput {
  callUUID: string;
  hasVideo: boolean;
  /** Must originate from locally verified pairing data, never a push payload. */
  locallyVerifiedCallerName?: string;
}

export interface AddTelecomCallInput {
  callId: string;
  hasVideo: boolean;
}

export interface SetAudioRouteInput {
  callId: string;
  route: NativeAudioRoute;
  /** Disambiguates multiple endpoints of the same route type. */
  endpointId?: string;
}

/**
 * Unified raw surface. Platform-specific methods are optional because a linked
 * iOS module must not pretend to provide Core Telecom and vice versa.
 */
export interface RawNativeCallModule {
  isSupported(): Promise<NativeCallCapability>;

  registerVoipPushToken?(): Promise<void>;
  startOutgoingCall?(input: StartOutgoingCallInput): Promise<void>;
  reportOutgoingCallConnected?(input: { callUUID: string }): Promise<void>;
  reportCallEnded?(input: { callUUID: string; reason: NativeCallEndReason }): Promise<void>;
  updateCall?(input: UpdateCallInput): Promise<void>;

  registerPhoneAccount?(): Promise<void>;
  addIncomingCall?(input: AddTelecomCallInput): Promise<void>;
  addOutgoingCall?(input: AddTelecomCallInput): Promise<void>;
  answerCall?(input: { callId: string; hasVideo: boolean }): Promise<void>;
  setCallActive?(input: { callId: string; active: boolean }): Promise<void>;
  setMuted?(input: { callId: string; muted: boolean }): Promise<void>;
  disconnect?(input: { callId: string; reason: NativeCallEndReason }): Promise<void>;
  setAudioRoute?(input: SetAudioRouteInput): Promise<void>;

  addListener<K extends NativeCallEventName>(
    eventName: K,
    listener: (event: NativeCallEventMap[K]) => void,
  ): NativeSubscription;
}
