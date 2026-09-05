// Honesty and contract tests for the import-safe native call bridge.

import { describe, expect, it, vi } from 'vitest';
import {
  ANDROID_CALL_NATIVE_MODULE_NAME,
  bridgeNativeCallModule,
  createNativeCallClient,
  IOS_CALL_NATIVE_MODULE_NAME,
  loadNativeCallModule,
  NativeCallClient,
  NativeCallCommandUnavailableError,
  NativeCallUnavailableError,
  probeNativeCallCapability,
} from '../index';
import { loadExpoNativeModule } from '../loader';
import type {
  NativeCallCapability,
  NativeCallEventMap,
  NativeCallEventName,
  NativeSubscription,
  RawNativeCallModule,
} from '../native-types';

const CALL_ID = '2b89b927-b3b4-47e7-a810-88e20e233cf7';

function makeRawModule(overrides: Partial<RawNativeCallModule> = {}) {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const raw: RawNativeCallModule = {
    isSupported: async () => ({ platform: 'ios', available: true, reason: 'available' }),
    addListener: ((eventName: string, listener: (event: unknown) => void) => {
      const eventListeners = listeners.get(eventName) ?? new Set();
      eventListeners.add(listener);
      listeners.set(eventName, eventListeners);
      return {
        remove() {
          eventListeners.delete(listener);
        },
      } satisfies NativeSubscription;
    }) as RawNativeCallModule['addListener'],
    ...overrides,
  };

  return {
    raw,
    emit(eventName: NativeCallEventName, event: NativeCallEventMap[NativeCallEventName]) {
      for (const listener of listeners.get(eventName) ?? []) listener(event);
    },
  };
}

describe('native module absence', () => {
  it('returns null when expo-modules-core cannot provide a linked module', () => {
    expect(loadExpoNativeModule('missing-native-call-module')).toBeNull();
    expect(loadNativeCallModule()).toBeNull();
  });

  it('rejects null and malformed raw modules at the bridge boundary', () => {
    expect(bridgeNativeCallModule(null)).toBeNull();
    expect(bridgeNativeCallModule({} as RawNativeCallModule)).toBeNull();
    expect(bridgeNativeCallModule({ isSupported: async () => ({}) } as RawNativeCallModule))
      .toBeNull();
  });

  it('exposes only the owned native module names', () => {
    expect(IOS_CALL_NATIVE_MODULE_NAME).toBe('MeerkatCallKit');
    expect(ANDROID_CALL_NATIVE_MODULE_NAME).toBe('MeerkatTelecom');
  });

  it('returns an inert removable event subscription when the module is absent', () => {
    const subscription = createNativeCallClient(null).on('callAnswered', () => {});
    expect(() => {
      subscription.remove();
      subscription.remove();
    }).not.toThrow();
  });
});

describe('capability honesty', () => {
  it('reports the exact unavailable capability when no module is linked', async () => {
    await expect(createNativeCallClient(null).getCapability()).resolves.toEqual({
      platform: 'unknown',
      available: false,
      reason: 'native-module-absent',
    });
    await expect(probeNativeCallCapability()).resolves.toEqual({
      platform: 'unknown',
      available: false,
      reason: 'native-module-absent',
    });
  });

  it('never accepts an unknown platform as available', async () => {
    const { raw } = makeRawModule({
      isSupported: async () => ({
        platform: 'unknown',
        available: true,
        reason: 'claimed-available',
      }),
    });
    await expect(bridgeNativeCallModule(raw)!.getCapability()).resolves.toEqual({
      platform: 'unknown',
      available: false,
      reason: 'claimed-available',
    });
  });

  it('never accepts an invalid platform or non-boolean availability', async () => {
    const { raw } = makeRawModule({
      isSupported: async () => ({
        platform: 'web',
        available: 1,
        reason: 'malformed',
      } as unknown as NativeCallCapability),
    });
    await expect(bridgeNativeCallModule(raw)!.getCapability()).resolves.toEqual({
      platform: 'unknown',
      available: false,
      reason: 'malformed',
    });
  });

  it('turns a throwing native capability probe into unavailable', async () => {
    const { raw } = makeRawModule({
      isSupported: async () => {
        throw new Error('native failure');
      },
    });
    await expect(bridgeNativeCallModule(raw)!.getCapability()).resolves.toEqual({
      platform: 'unknown',
      available: false,
      reason: 'capability-probe-failed',
    });
  });

  it('preserves a valid supported capability without upgrading it', async () => {
    const capability: NativeCallCapability = {
      platform: 'android',
      available: false,
      reason: 'telecom-feature-missing',
    };
    const { raw } = makeRawModule({ isSupported: async () => capability });
    await expect(bridgeNativeCallModule(raw)!.getCapability()).resolves.toEqual(capability);
  });
});

describe('event wrapper contract', () => {
  it('forwards every typed event unchanged and honors removal', () => {
    const harness = makeRawModule();
    const client = new NativeCallClient(bridgeNativeCallModule(harness.raw));
    const cases: Array<{
      name: NativeCallEventName;
      payload: NativeCallEventMap[NativeCallEventName];
    }> = [
      {
        name: 'incomingCallReported',
        payload: { callUUID: CALL_ID, hasVideo: true, malformed: false, duplicate: false },
      },
      { name: 'callAnswered', payload: { callId: CALL_ID, platform: 'ios' } },
      {
        name: 'callEnded',
        payload: { callId: CALL_ID, platform: 'android', reason: 'remoteEnded' },
      },
      { name: 'muteChanged', payload: { callId: CALL_ID, muted: true, platform: 'ios' } },
      {
        name: 'audioSessionChanged',
        payload: { callId: CALL_ID, active: true, platform: 'ios', route: 'speaker' },
      },
      { name: 'voipTokenChanged', payload: { token: 'aabb', invalidated: false } },
      {
        name: 'telecomStateChanged',
        payload: {
          callId: CALL_ID,
          platform: 'android',
          state: 'active',
          audioRoute: 'bluetooth',
          availableRoutes: [{ id: 'endpoint-1', type: 'bluetooth' }],
        },
      },
    ];

    for (const eventCase of cases) {
      const received: NativeCallEventMap[NativeCallEventName][] = [];
      const subscription = client.on(eventCase.name, (event) => received.push(event));
      harness.emit(eventCase.name, eventCase.payload);
      expect(received).toEqual([eventCase.payload]);
      subscription.remove();
      harness.emit(eventCase.name, eventCase.payload);
      expect(received).toEqual([eventCase.payload]);
    }
  });
});

const absentCommands: Array<[
  string,
  (client: NativeCallClient) => Promise<void>,
]> = [
  ['registerVoipPushToken', (client) => client.registerVoipPushToken()],
  ['startOutgoingCall', (client) => client.startOutgoingCall({ callUUID: CALL_ID, hasVideo: true })],
  ['reportOutgoingCallConnected', (client) => client.reportOutgoingCallConnected(CALL_ID)],
  ['reportCallEnded', (client) => client.reportCallEnded(CALL_ID, 'remoteEnded')],
  ['updateCall', (client) => client.updateCall({ callUUID: CALL_ID, hasVideo: false })],
  ['registerPhoneAccount', (client) => client.registerPhoneAccount()],
  ['addIncomingCall', (client) => client.addIncomingCall({ callId: CALL_ID, hasVideo: false })],
  ['addOutgoingCall', (client) => client.addOutgoingCall({ callId: CALL_ID, hasVideo: true })],
  ['answerCall', (client) => client.answerCall(CALL_ID, true)],
  ['setCallActive', (client) => client.setCallActive(CALL_ID, false)],
  ['setMuted', (client) => client.setMuted(CALL_ID, true)],
  ['disconnect', (client) => client.disconnect(CALL_ID, 'localEnded')],
  ['setAudioRoute', (client) => client.setAudioRoute({ callId: CALL_ID, route: 'speaker' })],
];

describe('command absence', () => {
  it.each(absentCommands)('%s rejects with the stable absent-module error', async (_, invoke) => {
    const operation = invoke(new NativeCallClient(null));
    await expect(operation).rejects.toBeInstanceOf(NativeCallUnavailableError);
    await expect(operation).rejects.toMatchObject({ code: 'ERR_NATIVE_CALL_UNAVAILABLE' });
  });

  it('rejects a platform-specific command missing from a linked module', async () => {
    const { raw } = makeRawModule();
    const client = new NativeCallClient(bridgeNativeCallModule(raw));
    const operation = client.registerPhoneAccount();
    await expect(operation).rejects.toBeInstanceOf(NativeCallCommandUnavailableError);
    await expect(operation).rejects.toMatchObject({
      code: 'ERR_NATIVE_CALL_COMMAND_UNAVAILABLE',
      command: 'registerPhoneAccount',
    });
  });
});

describe('command wrapper contract', () => {
  it('passes exact iOS command payloads to the raw module', async () => {
    const registerVoipPushToken = vi.fn(async () => {});
    const startOutgoingCall = vi.fn(async () => {});
    const reportOutgoingCallConnected = vi.fn(async () => {});
    const reportCallEnded = vi.fn(async () => {});
    const updateCall = vi.fn(async () => {});
    const { raw } = makeRawModule({
      registerVoipPushToken,
      startOutgoingCall,
      reportOutgoingCallConnected,
      reportCallEnded,
      updateCall,
    });
    const client = new NativeCallClient(bridgeNativeCallModule(raw));

    await client.registerVoipPushToken();
    await client.startOutgoingCall({ callUUID: CALL_ID, hasVideo: true });
    await client.reportOutgoingCallConnected(CALL_ID);
    await client.reportCallEnded(CALL_ID, 'remoteEnded');
    await client.updateCall({
      callUUID: CALL_ID,
      hasVideo: false,
      locallyVerifiedCallerName: 'Verified peer',
    });

    expect(registerVoipPushToken).toHaveBeenCalledOnce();
    expect(startOutgoingCall).toHaveBeenCalledWith({ callUUID: CALL_ID, hasVideo: true });
    expect(reportOutgoingCallConnected).toHaveBeenCalledWith({ callUUID: CALL_ID });
    expect(reportCallEnded).toHaveBeenCalledWith({
      callUUID: CALL_ID,
      reason: 'remoteEnded',
    });
    expect(updateCall).toHaveBeenCalledWith({
      callUUID: CALL_ID,
      hasVideo: false,
      locallyVerifiedCallerName: 'Verified peer',
    });
  });

  it('passes exact Android command payloads to the raw module', async () => {
    const registerPhoneAccount = vi.fn(async () => {});
    const addIncomingCall = vi.fn(async () => {});
    const addOutgoingCall = vi.fn(async () => {});
    const answerCall = vi.fn(async () => {});
    const setCallActive = vi.fn(async () => {});
    const setMuted = vi.fn(async () => {});
    const disconnect = vi.fn(async () => {});
    const setAudioRoute = vi.fn(async () => {});
    const { raw } = makeRawModule({
      registerPhoneAccount,
      addIncomingCall,
      addOutgoingCall,
      answerCall,
      setCallActive,
      setMuted,
      disconnect,
      setAudioRoute,
    });
    const client = new NativeCallClient(bridgeNativeCallModule(raw));

    await client.registerPhoneAccount();
    await client.addIncomingCall({ callId: CALL_ID, hasVideo: false });
    await client.addOutgoingCall({ callId: CALL_ID, hasVideo: true });
    await client.answerCall(CALL_ID, true);
    await client.setCallActive(CALL_ID, false);
    await client.setMuted(CALL_ID, true);
    await client.disconnect(CALL_ID, 'rejected');
    await client.setAudioRoute({ callId: CALL_ID, route: 'bluetooth', endpointId: 'endpoint-1' });

    expect(registerPhoneAccount).toHaveBeenCalledOnce();
    expect(addIncomingCall).toHaveBeenCalledWith({ callId: CALL_ID, hasVideo: false });
    expect(addOutgoingCall).toHaveBeenCalledWith({ callId: CALL_ID, hasVideo: true });
    expect(answerCall).toHaveBeenCalledWith({ callId: CALL_ID, hasVideo: true });
    expect(setCallActive).toHaveBeenCalledWith({ callId: CALL_ID, active: false });
    expect(setMuted).toHaveBeenCalledWith({ callId: CALL_ID, muted: true });
    expect(disconnect).toHaveBeenCalledWith({ callId: CALL_ID, reason: 'rejected' });
    expect(setAudioRoute).toHaveBeenCalledWith({
      callId: CALL_ID,
      route: 'bluetooth',
      endpointId: 'endpoint-1',
    });
  });
});
