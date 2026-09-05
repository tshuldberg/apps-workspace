// @mylife/meerkat-call-native
//
// Import-safe bridge for Meerkat's owned OS call surfaces. Native absence is a
// normal state in Expo Go and Node: loadNativeCallModule() returns null, the
// capability probe reports unavailable, event registration is inert, and every
// command rejects with one stable typed error. Nothing here fabricates a ring,
// answer, connection, route, mute, or ended state.

import { loadExpoNativeModule } from './loader';
import type {
  AddTelecomCallInput,
  NativeCallCapability,
  NativeCallEndReason,
  NativeCallEventMap,
  NativeCallEventName,
  NativeSubscription,
  RawNativeCallModule,
  SetAudioRouteInput,
  StartOutgoingCallInput,
  UpdateCallInput,
} from './native-types';

export type {
  AddTelecomCallInput,
  NativeAudioRoute,
  NativeAudioRouteDescriptor,
  NativeCallCapability,
  NativeCallEndReason,
  NativeCallEventMap,
  NativeCallEventName,
  NativeCallPlatform,
  NativeSubscription,
  SetAudioRouteInput,
  StartOutgoingCallInput,
  UpdateCallInput,
} from './native-types';

export const IOS_CALL_NATIVE_MODULE_NAME = 'MeerkatCallKit';
export const ANDROID_CALL_NATIVE_MODULE_NAME = 'MeerkatTelecom';

export class NativeCallUnavailableError extends Error {
  readonly code = 'ERR_NATIVE_CALL_UNAVAILABLE';

  constructor() {
    super('The owned Meerkat native call module is not linked into this build.');
    this.name = 'NativeCallUnavailableError';
  }
}

export class NativeCallCommandUnavailableError extends Error {
  readonly code = 'ERR_NATIVE_CALL_COMMAND_UNAVAILABLE';
  readonly command: string;

  constructor(command: string) {
    super(`The linked native call module does not provide ${command}.`);
    this.name = 'NativeCallCommandUnavailableError';
    this.command = command;
  }
}

/** App-facing linked module contract after the raw Expo surface is validated. */
export interface NativeCallModule {
  getCapability(): Promise<NativeCallCapability>;
  addListener<K extends NativeCallEventName>(
    eventName: K,
    listener: (event: NativeCallEventMap[K]) => void,
  ): NativeSubscription;

  registerVoipPushToken(): Promise<void>;
  startOutgoingCall(input: StartOutgoingCallInput): Promise<void>;
  reportOutgoingCallConnected(callUUID: string): Promise<void>;
  reportCallEnded(callUUID: string, reason: NativeCallEndReason): Promise<void>;
  updateCall(input: UpdateCallInput): Promise<void>;

  registerPhoneAccount(): Promise<void>;
  addIncomingCall(input: AddTelecomCallInput): Promise<void>;
  addOutgoingCall(input: AddTelecomCallInput): Promise<void>;
  answerCall(callId: string, hasVideo: boolean): Promise<void>;
  setCallActive(callId: string, active: boolean): Promise<void>;
  setMuted(callId: string, muted: boolean): Promise<void>;
  disconnect(callId: string, reason: NativeCallEndReason): Promise<void>;
  setAudioRoute(input: SetAudioRouteInput): Promise<void>;
}

function unavailableCapability(reason: string): NativeCallCapability {
  return { platform: 'unknown', available: false, reason };
}

/** Prevent a malformed native response from turning into an optimistic capability. */
function normalizeCapability(value: NativeCallCapability): NativeCallCapability {
  const knownPlatform = value?.platform === 'ios' || value?.platform === 'android';
  const reason = typeof value?.reason === 'string' && value.reason.length > 0
    ? value.reason
    : 'native-capability-reason-missing';
  if (!knownPlatform) return unavailableCapability(reason);
  return {
    platform: value.platform,
    available: value.available === true,
    reason,
  };
}

class CallBridge implements NativeCallModule {
  constructor(private readonly raw: RawNativeCallModule) {}

  async getCapability(): Promise<NativeCallCapability> {
    try {
      return normalizeCapability(await this.raw.isSupported());
    } catch {
      return unavailableCapability('capability-probe-failed');
    }
  }

  addListener<K extends NativeCallEventName>(
    eventName: K,
    listener: (event: NativeCallEventMap[K]) => void,
  ): NativeSubscription {
    return this.raw.addListener(eventName, listener);
  }

  async registerVoipPushToken(): Promise<void> {
    const command = this.raw.registerVoipPushToken;
    if (!command) throw new NativeCallCommandUnavailableError('registerVoipPushToken');
    await command.call(this.raw);
  }

  async startOutgoingCall(input: StartOutgoingCallInput): Promise<void> {
    const command = this.raw.startOutgoingCall;
    if (!command) throw new NativeCallCommandUnavailableError('startOutgoingCall');
    await command.call(this.raw, input);
  }

  async reportOutgoingCallConnected(callUUID: string): Promise<void> {
    const command = this.raw.reportOutgoingCallConnected;
    if (!command) throw new NativeCallCommandUnavailableError('reportOutgoingCallConnected');
    await command.call(this.raw, { callUUID });
  }

  async reportCallEnded(callUUID: string, reason: NativeCallEndReason): Promise<void> {
    const command = this.raw.reportCallEnded;
    if (!command) throw new NativeCallCommandUnavailableError('reportCallEnded');
    await command.call(this.raw, { callUUID, reason });
  }

  async updateCall(input: UpdateCallInput): Promise<void> {
    const command = this.raw.updateCall;
    if (!command) throw new NativeCallCommandUnavailableError('updateCall');
    await command.call(this.raw, input);
  }

  async registerPhoneAccount(): Promise<void> {
    const command = this.raw.registerPhoneAccount;
    if (!command) throw new NativeCallCommandUnavailableError('registerPhoneAccount');
    await command.call(this.raw);
  }

  async addIncomingCall(input: AddTelecomCallInput): Promise<void> {
    const command = this.raw.addIncomingCall;
    if (!command) throw new NativeCallCommandUnavailableError('addIncomingCall');
    await command.call(this.raw, input);
  }

  async addOutgoingCall(input: AddTelecomCallInput): Promise<void> {
    const command = this.raw.addOutgoingCall;
    if (!command) throw new NativeCallCommandUnavailableError('addOutgoingCall');
    await command.call(this.raw, input);
  }

  async answerCall(callId: string, hasVideo: boolean): Promise<void> {
    const command = this.raw.answerCall;
    if (!command) throw new NativeCallCommandUnavailableError('answerCall');
    await command.call(this.raw, { callId, hasVideo });
  }

  async setCallActive(callId: string, active: boolean): Promise<void> {
    const command = this.raw.setCallActive;
    if (!command) throw new NativeCallCommandUnavailableError('setCallActive');
    await command.call(this.raw, { callId, active });
  }

  async setMuted(callId: string, muted: boolean): Promise<void> {
    const command = this.raw.setMuted;
    if (!command) throw new NativeCallCommandUnavailableError('setMuted');
    await command.call(this.raw, { callId, muted });
  }

  async disconnect(callId: string, reason: NativeCallEndReason): Promise<void> {
    const command = this.raw.disconnect;
    if (!command) throw new NativeCallCommandUnavailableError('disconnect');
    await command.call(this.raw, { callId, reason });
  }

  async setAudioRoute(input: SetAudioRouteInput): Promise<void> {
    const command = this.raw.setAudioRoute;
    if (!command) throw new NativeCallCommandUnavailableError('setAudioRoute');
    await command.call(this.raw, input);
  }
}

/** Validate and wrap a raw native module. Exported as the pure TypeScript test seam. */
export function bridgeNativeCallModule(raw: RawNativeCallModule | null): NativeCallModule | null {
  if (!raw || typeof raw.isSupported !== 'function' || typeof raw.addListener !== 'function') {
    return null;
  }
  return new CallBridge(raw);
}

/**
 * Load the one platform module compiled into this binary. Returns null in Expo
 * Go, Node, or any build where neither owned native module is linked.
 */
export function loadNativeCallModule(): NativeCallModule | null {
  const ios = loadExpoNativeModule<RawNativeCallModule>(IOS_CALL_NATIVE_MODULE_NAME);
  if (ios) return bridgeNativeCallModule(ios);
  return bridgeNativeCallModule(
    loadExpoNativeModule<RawNativeCallModule>(ANDROID_CALL_NATIVE_MODULE_NAME),
  );
}

const EMPTY_SUBSCRIPTION: NativeSubscription = { remove() {} };

/**
 * Import-safe facade for application code. It preserves a useful unavailable
 * capability in Expo Go while making every attempted command fail explicitly.
 */
export class NativeCallClient {
  constructor(private readonly nativeModule: NativeCallModule | null) {}

  async getCapability(): Promise<NativeCallCapability> {
    if (!this.nativeModule) return unavailableCapability('native-module-absent');
    return this.nativeModule.getCapability();
  }

  on<K extends NativeCallEventName>(
    eventName: K,
    listener: (event: NativeCallEventMap[K]) => void,
  ): NativeSubscription {
    if (!this.nativeModule) return EMPTY_SUBSCRIPTION;
    return this.nativeModule.addListener(eventName, listener);
  }

  private requireModule(): NativeCallModule {
    if (!this.nativeModule) throw new NativeCallUnavailableError();
    return this.nativeModule;
  }

  async registerVoipPushToken(): Promise<void> {
    await this.requireModule().registerVoipPushToken();
  }

  async startOutgoingCall(input: StartOutgoingCallInput): Promise<void> {
    await this.requireModule().startOutgoingCall(input);
  }

  async reportOutgoingCallConnected(callUUID: string): Promise<void> {
    await this.requireModule().reportOutgoingCallConnected(callUUID);
  }

  async reportCallEnded(callUUID: string, reason: NativeCallEndReason): Promise<void> {
    await this.requireModule().reportCallEnded(callUUID, reason);
  }

  async updateCall(input: UpdateCallInput): Promise<void> {
    await this.requireModule().updateCall(input);
  }

  async registerPhoneAccount(): Promise<void> {
    await this.requireModule().registerPhoneAccount();
  }

  async addIncomingCall(input: AddTelecomCallInput): Promise<void> {
    await this.requireModule().addIncomingCall(input);
  }

  async addOutgoingCall(input: AddTelecomCallInput): Promise<void> {
    await this.requireModule().addOutgoingCall(input);
  }

  async answerCall(callId: string, hasVideo: boolean): Promise<void> {
    await this.requireModule().answerCall(callId, hasVideo);
  }

  async setCallActive(callId: string, active: boolean): Promise<void> {
    await this.requireModule().setCallActive(callId, active);
  }

  async setMuted(callId: string, muted: boolean): Promise<void> {
    await this.requireModule().setMuted(callId, muted);
  }

  async disconnect(callId: string, reason: NativeCallEndReason): Promise<void> {
    await this.requireModule().disconnect(callId, reason);
  }

  async setAudioRoute(input: SetAudioRouteInput): Promise<void> {
    await this.requireModule().setAudioRoute(input);
  }
}

export function createNativeCallClient(
  nativeModule: NativeCallModule | null = loadNativeCallModule(),
): NativeCallClient {
  return new NativeCallClient(nativeModule);
}

/** Capability-only convenience probe that never throws or overclaims. */
export async function probeNativeCallCapability(): Promise<NativeCallCapability> {
  return createNativeCallClient().getCapability();
}
