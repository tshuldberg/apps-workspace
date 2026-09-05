/**
 * Lightweight one-shot share session protocol.
 *
 * Unlike full workspace sync (continuous, bidirectional, all entities in scope),
 * a share session transfers a single entity from one peer to another. It is
 * triggered by user action and can target a peer not in any shared workspace.
 *
 * Protocol flow:
 *   1. Sender sends SYNC_OFFER with a ShareOffer preview
 *   2. Receiver replies SYNC_ACCEPT to accept the share
 *   3. Sender sends SYNC_DATA with the full entity payload
 *   4. Receiver replies SYNC_ACK confirming delivery
 *   5. Sender closes the connection
 */

import type { TransportConnection, ShareRequest, ShareOffer, SyncMessage } from '../types';
import {
  encodeMessage,
  decodeMessage,
  createSimpleMessage,
} from './message-codec';
import {
  createSecureJsonMessage,
  parseSecureJsonPayload,
  type SessionPayloadSecurity,
} from './payload-security';

/** Maximum time to wait for each protocol step (ms). */
const SHARE_STEP_TIMEOUT_MS = 15_000;

export interface ShareSessionOptions {
  connection: TransportConnection;
  identity: { publicKey: string; displayName: string };
  share: ShareRequest;
  payloadSecurity: SessionPayloadSecurity;
}

export interface ShareSessionResult {
  delivered: boolean;
  error?: string;
}

/**
 * Wait for the next decoded SyncMessage from a connection with a timeout.
 */
function waitForMessage(
  connection: TransportConnection,
  timeoutMs: number,
): Promise<SyncMessage | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    connection.onData((data: Uint8Array) => {
      clearTimeout(timer);
      resolve(decodeMessage(data));
    });
  });
}

/**
 * Run a share session as the sender (initiator).
 *
 * Sends a single entity to a connected peer using the 5-step protocol.
 */
export async function runShareSession(
  options: ShareSessionOptions,
): Promise<ShareSessionResult> {
  const { connection, identity, share } = options;
  if (!options.payloadSecurity.enabled) {
    return { delivered: false, error: 'Encrypted share channel unavailable' };
  }

  try {
    // Step 1: Send SHARE_OFFER with preview
    const offer: ShareOffer = {
      shareId: share.id,
      fromDeviceId: identity.publicKey,
      fromDisplayName: identity.displayName,
      moduleId: share.moduleId,
      tableName: share.tableName,
      rowId: share.rowId,
      previewJson: share.dataJson.slice(0, 500),
    };

    const offerMsg = createSecureJsonMessage(
      'SYNC_OFFER',
      identity.publicKey,
      '',
      offer,
      options.payloadSecurity,
    );
    await connection.send(encodeMessage(offerMsg));

    // Step 2: Wait for SYNC_ACCEPT (peer accepted the share)
    const acceptMsg = await waitForMessage(connection, SHARE_STEP_TIMEOUT_MS);
    if (!acceptMsg) {
      return { delivered: false, error: 'Timeout waiting for SYNC_ACCEPT' };
    }
    if (acceptMsg.type !== 'SYNC_ACCEPT') {
      return { delivered: false, error: `Expected SYNC_ACCEPT, got ${acceptMsg.type}` };
    }
    const acceptPayload = parseSecureJsonPayload<{ shareId: string }>(
      acceptMsg,
      options.payloadSecurity,
    );
    if (!acceptPayload || acceptPayload.shareId !== share.id) {
      return { delivered: false, error: 'SYNC_ACCEPT share ID mismatch' };
    }

    // Step 3: Send full entity data via SYNC_DATA
    const dataPayload = {
      shareId: share.id,
      moduleId: share.moduleId,
      tableName: share.tableName,
      rowId: share.rowId,
      dataJson: share.dataJson,
    };
    const dataMsg = createSecureJsonMessage(
      'SYNC_DATA',
      identity.publicKey,
      '',
      dataPayload,
      options.payloadSecurity,
    );
    await connection.send(encodeMessage(dataMsg));

    // Step 4: Wait for SYNC_ACK (delivery confirmed)
    const ackMsg = await waitForMessage(connection, SHARE_STEP_TIMEOUT_MS);
    if (!ackMsg) {
      return { delivered: false, error: 'Timeout waiting for SYNC_ACK' };
    }
    if (ackMsg.type !== 'SYNC_ACK') {
      return { delivered: false, error: `Expected SYNC_ACK, got ${ackMsg.type}` };
    }

    // Verify ACK references the correct share
    const ackPayload = parseSecureJsonPayload<{ shareId: string }>(
      ackMsg,
      options.payloadSecurity,
    );
    if (ackPayload && ackPayload.shareId !== share.id) {
      return { delivered: false, error: 'SYNC_ACK share ID mismatch' };
    }

    // Step 5: Send BYE and close
    const byeMsg = createSimpleMessage('BYE', identity.publicKey, '');
    await connection.send(encodeMessage(byeMsg));

    return { delivered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown share session error';
    return { delivered: false, error: message };
  }
}

/**
 * Handle an incoming share session as the receiver (responder).
 *
 * Receives a single entity from a connected peer. Returns the received
 * share data on success, or null if the session failed.
 */
export async function handleIncomingShare(
  connection: TransportConnection,
  identity: { publicKey: string },
  offerMsg: SyncMessage,
  payloadSecurity: SessionPayloadSecurity,
): Promise<{ offer: ShareOffer; dataJson: string } | null> {
  if (!payloadSecurity.enabled) return null;

  const offer = parseSecureJsonPayload<ShareOffer>(offerMsg, payloadSecurity);
  if (!offer) return null;

  try {
    // Send SYNC_ACCEPT
    const acceptMsg = createSecureJsonMessage(
      'SYNC_ACCEPT',
      identity.publicKey,
      '',
      { shareId: offer.shareId },
      payloadSecurity,
    );
    await connection.send(encodeMessage(acceptMsg));

    // Wait for SYNC_DATA with full entity
    const dataMsg = await waitForMessage(connection, SHARE_STEP_TIMEOUT_MS);
    if (!dataMsg || dataMsg.type !== 'SYNC_DATA') return null;

    const dataPayload = parseSecureJsonPayload<{
      shareId: string;
      moduleId: string;
      tableName: string;
      rowId: string;
      dataJson: string;
    }>(dataMsg, payloadSecurity);
    if (!dataPayload || dataPayload.shareId !== offer.shareId) return null;

    // Send SYNC_ACK
    const ackMsg = createSecureJsonMessage(
      'SYNC_ACK',
      identity.publicKey,
      '',
      { shareId: offer.shareId },
      payloadSecurity,
    );
    await connection.send(encodeMessage(ackMsg));

    // Wait for BYE (non-blocking, best effort)
    await waitForMessage(connection, 5_000);

    return { offer, dataJson: dataPayload.dataJson };
  } catch {
    return null;
  }
}
