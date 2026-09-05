import {
  createHostedAuthBearer,
  createHostedRelayAccess,
  withHostedRelayAccess,
  WebSocketRelayBackend,
  type DeviceIdentity,
  type HostedRelayAccess,
  type RelayBackend,
} from '@mylife/sync';

export function hostedRelayConfig(): { relayUrl: string; apiUrl: string } {
  const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as {
    hostedRelayUrl?: unknown; hostedApiUrl?: unknown;
  };
  return {
    relayUrl: typeof extra.hostedRelayUrl === 'string' ? extra.hostedRelayUrl.trim() : '',
    apiUrl: typeof extra.hostedApiUrl === 'string' ? extra.hostedApiUrl.trim() : '',
  };
}

let current: { key: string; access: HostedRelayAccess } | null = null;

export function hostedRelayAccess(identity: DeviceIdentity): HostedRelayAccess {
  const config = hostedRelayConfig();
  const key = JSON.stringify([identity.publicKey, identity.privateKeyRef, config]);
  if (current?.key !== key) {
    current = { key, access: createHostedRelayAccess({
      ...config,
      createAuthorization: () => createHostedAuthBearer(identity),
    }) };
  }
  return current.access;
}

export function createMeerkatRelayBackend(identity: DeviceIdentity): RelayBackend {
  return withHostedRelayAccess(new WebSocketRelayBackend(), hostedRelayAccess(identity));
}
