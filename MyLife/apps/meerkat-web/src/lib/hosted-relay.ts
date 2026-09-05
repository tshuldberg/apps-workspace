import {
  createHostedAuthBearer,
  createHostedRelayAccess,
  withHostedRelayAccess,
  WebSocketRelayBackend,
  type DeviceIdentity,
  type HostedRelayAccess,
  type RelayBackend,
} from '@mylife/sync';
import { HOSTED_RELAY_URL, HOSTED_API_URL } from './hosted-access';

export function hostedRelayConfig(): { relayUrl: string; apiUrl: string } {
  return { relayUrl: HOSTED_RELAY_URL, apiUrl: HOSTED_API_URL };
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
