/**
 * Relay peer connection (MK-008): adapt a RelaySession into the
 * TransportConnection the sync session protocol speaks.
 *
 * Two devices that join a relay on the same ephemeral token get a duplex
 * ciphertext pipe; this wraps one end of it so runInitiatorSession /
 * runResponderSession (and the engines) can run a full handshake + sync over
 * it. The caller supplies the expected remote device id -- the handshake then
 * authenticates it for real (Ed25519 challenge/response), so a wrong or
 * malicious peer on the token fails the session rather than impersonating.
 *
 * RN-safe: no Node-only imports; the backend is injected.
 */

import type { TransportConnection } from '../types';
import type { RelayBackend, RelayConnectOptions, RelaySession } from './relay-transport';

let relayPeerCounter = 0;

export interface ConnectRelayPeerOptions {
  backend: RelayBackend;
  /** Relay WebSocket URL, e.g. ws://host:8787 */
  url: string;
  /** Shared ephemeral rendezvous token (>= 16 chars at the relay). */
  token: string;
  /** Device id (Ed25519 pubkey hex) we expect on the other end. */
  remoteDeviceId: string;
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string;
}

/**
 * Join the relay and return a TransportConnection to the peer on the token.
 */
export async function connectRelayPeer(
  options: ConnectRelayPeerOptions,
): Promise<TransportConnection> {
  const connectOptions: RelayConnectOptions = {
    entitlementToken: options.entitlementToken,
  };
  const session: RelaySession = await options.backend.connect(options.url, options.token, connectOptions);
  return {
    id: `relay-peer-${++relayPeerCounter}-${Date.now().toString(36)}`,
    remoteDeviceId: options.remoteDeviceId,
    transport: 'wan_relay',
    send: (data) => session.send(data),
    onData: (handler) => session.onMessage(handler),
    close: () => session.close(),
  };
}
