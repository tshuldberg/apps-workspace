/**
 * HELLO + auth exchange over an encrypted transport connection.
 *
 * Implements the handshake protocol from Spec Section 4.3:
 *   Device A -> HELLO(deviceId, nonce)
 *   Device B -> HELLO_ACK(deviceId, nonce)
 *   Device A -> AUTH_CHALLENGE(signed nonce)
 *   Device B -> AUTH_RESPONSE(signed nonce)
 *   Both verify signatures -> authenticated session
 */

import type { TransportConnection } from '../types';
import type { DeviceIdentity, PairedDevice } from '../types';
import { extractSigningPrivateKeyHex, signMessage, verifySignature } from '../identity/device-identity';
import { hexToBytes, bytesToHex } from '../encryption/keys';
import { encodeMessage, decodeMessage } from './message-codec';
import {
  createSecureJsonMessage,
  createSessionPayloadSecurity,
  parseSecureJsonPayload,
  resolvePayloadEncryptionKey,
  type SessionPayloadSecurity,
} from './payload-security';

interface HandshakeResult {
  success: boolean;
  remoteDeviceId: string;
  error?: string;
}

interface HelloPayload {
  deviceId: string;
  nonce: string;
}

function createHandshakePayloadSecurity(
  identity: DeviceIdentity,
  pairedDevices: PairedDevice[],
  remoteDeviceId: string,
): SessionPayloadSecurity {
  const key = resolvePayloadEncryptionKey({
    pairedDevices,
    localDeviceId: identity.publicKey,
    remoteDeviceId,
    subjectType: 'direct',
    subjectId: remoteDeviceId,
  });
  return createSessionPayloadSecurity(key, key !== null);
}

/**
 * Perform the handshake as the initiator (the device that opened the connection).
 */
export async function initiatorHandshake(
  connection: TransportConnection,
  identity: DeviceIdentity,
  pairedDevices: PairedDevice[],
  _enabledModules: string[],
): Promise<HandshakeResult> {
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const payloadSecurity = createHandshakePayloadSecurity(
    identity,
    pairedDevices,
    connection.remoteDeviceId,
  );
  if (!payloadSecurity.enabled) {
    return {
      success: false,
      remoteDeviceId: connection.remoteDeviceId,
      error: 'Encrypted handshake channel unavailable',
    };
  }

  // Step 1: Send HELLO
  const helloPayload: HelloPayload = {
    deviceId: identity.publicKey,
    nonce,
  };
  const helloMsg = createSecureJsonMessage(
    'HELLO',
    identity.publicKey,
    nonce,
    helloPayload,
    payloadSecurity,
  );
  await connection.send(encodeMessage(helloMsg));

  // Step 2: Wait for HELLO_ACK
  const ackData = await waitForData(connection, 10_000);
  if (!ackData) return { success: false, remoteDeviceId: '', error: 'Timeout waiting for HELLO_ACK' };

  const ackMsg = decodeMessage(ackData);
  if (!ackMsg || ackMsg.type !== 'HELLO_ACK') {
    return { success: false, remoteDeviceId: '', error: 'Expected HELLO_ACK' };
  }

  const ackPayload = parseSecureJsonPayload<HelloPayload>(ackMsg, payloadSecurity);
  if (!ackPayload) return { success: false, remoteDeviceId: '', error: 'Invalid HELLO_ACK payload' };

  // Verify the responder is a paired device
  const paired = pairedDevices.find((d) => d.deviceId === ackPayload.deviceId && d.isActive);
  if (!paired) {
    return { success: false, remoteDeviceId: ackPayload.deviceId, error: 'Unknown or revoked device' };
  }

  // Step 3: Send AUTH_CHALLENGE (sign responder's nonce)
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  const responderNonceBytes = hexToBytes(ackPayload.nonce);
  const signature = signMessage(privateKeyHex, responderNonceBytes);
  const challengeMsg = createSecureJsonMessage(
    'AUTH_CHALLENGE',
    identity.publicKey,
    nonce,
    { signature: bytesToHex(signature) },
    payloadSecurity,
  );
  await connection.send(encodeMessage(challengeMsg));

  // Step 4: Wait for AUTH_RESPONSE
  const authData = await waitForData(connection, 10_000);
  if (!authData) return { success: false, remoteDeviceId: ackPayload.deviceId, error: 'Timeout waiting for AUTH_RESPONSE' };

  const authMsg = decodeMessage(authData);
  if (!authMsg || authMsg.type !== 'AUTH_RESPONSE') {
    return { success: false, remoteDeviceId: ackPayload.deviceId, error: 'Expected AUTH_RESPONSE' };
  }

  const authPayload = parseSecureJsonPayload<{ signature: string }>(authMsg, payloadSecurity);
  if (!authPayload) return { success: false, remoteDeviceId: ackPayload.deviceId, error: 'Invalid AUTH_RESPONSE payload' };

  // Verify responder signed our nonce
  const ourNonceBytes = hexToBytes(nonce);
  const remoteSig = hexToBytes(authPayload.signature);
  const valid = verifySignature(ackPayload.deviceId, ourNonceBytes, remoteSig);
  if (!valid) {
    return { success: false, remoteDeviceId: ackPayload.deviceId, error: 'Invalid signature in AUTH_RESPONSE' };
  }

  return { success: true, remoteDeviceId: ackPayload.deviceId };
}

/**
 * Perform the handshake as the responder (the device that received the connection).
 */
export async function responderHandshake(
  connection: TransportConnection,
  identity: DeviceIdentity,
  pairedDevices: PairedDevice[],
  _enabledModules: string[],
): Promise<HandshakeResult> {
  // Step 1: Wait for HELLO
  const helloData = await waitForData(connection, 10_000);
  if (!helloData) return { success: false, remoteDeviceId: '', error: 'Timeout waiting for HELLO' };

  const helloMsg = decodeMessage(helloData);
  if (!helloMsg || helloMsg.type !== 'HELLO') {
    return { success: false, remoteDeviceId: '', error: 'Expected HELLO' };
  }

  // Verify the initiator is a paired device
  const paired = pairedDevices.find((d) => d.deviceId === helloMsg.deviceId && d.isActive);
  if (!paired) {
    return { success: false, remoteDeviceId: helloMsg.deviceId, error: 'Unknown or revoked device' };
  }
  const payloadSecurity = createHandshakePayloadSecurity(identity, pairedDevices, helloMsg.deviceId);
  if (!payloadSecurity.enabled) {
    return {
      success: false,
      remoteDeviceId: helloMsg.deviceId,
      error: 'Encrypted handshake channel unavailable',
    };
  }

  const helloPayload = parseSecureJsonPayload<HelloPayload>(helloMsg, payloadSecurity);
  if (!helloPayload) return { success: false, remoteDeviceId: helloMsg.deviceId, error: 'Invalid HELLO payload' };

  // Step 2: Send HELLO_ACK
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const ackPayload: HelloPayload = {
    deviceId: identity.publicKey,
    nonce,
  };
  const ackMsg = createSecureJsonMessage(
    'HELLO_ACK',
    identity.publicKey,
    nonce,
    ackPayload,
    payloadSecurity,
  );
  await connection.send(encodeMessage(ackMsg));

  // Step 3: Wait for AUTH_CHALLENGE
  const challengeData = await waitForData(connection, 10_000);
  if (!challengeData) return { success: false, remoteDeviceId: helloPayload.deviceId, error: 'Timeout waiting for AUTH_CHALLENGE' };

  const challengeMsg = decodeMessage(challengeData);
  if (!challengeMsg || challengeMsg.type !== 'AUTH_CHALLENGE') {
    return { success: false, remoteDeviceId: helloPayload.deviceId, error: 'Expected AUTH_CHALLENGE' };
  }

  const challengePayload = parseSecureJsonPayload<{ signature: string }>(
    challengeMsg,
    payloadSecurity,
  );
  if (!challengePayload) return { success: false, remoteDeviceId: helloPayload.deviceId, error: 'Invalid AUTH_CHALLENGE payload' };

  // Verify initiator signed our nonce
  const ourNonceBytes = hexToBytes(nonce);
  const remoteSig = hexToBytes(challengePayload.signature);
  const valid = verifySignature(helloPayload.deviceId, ourNonceBytes, remoteSig);
  if (!valid) {
    return { success: false, remoteDeviceId: helloPayload.deviceId, error: 'Invalid signature in AUTH_CHALLENGE' };
  }

  // Step 4: Send AUTH_RESPONSE (sign initiator's nonce)
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  const initiatorNonceBytes = hexToBytes(helloPayload.nonce);
  const signature = signMessage(privateKeyHex, initiatorNonceBytes);
  const authMsg = createSecureJsonMessage(
    'AUTH_RESPONSE',
    identity.publicKey,
    nonce,
    { signature: bytesToHex(signature) },
    payloadSecurity,
  );
  await connection.send(encodeMessage(authMsg));

  return { success: true, remoteDeviceId: helloPayload.deviceId };
}

/**
 * Wait for data from a connection with a timeout.
 */
function waitForData(connection: TransportConnection, timeoutMs: number): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    connection.onData((data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}
