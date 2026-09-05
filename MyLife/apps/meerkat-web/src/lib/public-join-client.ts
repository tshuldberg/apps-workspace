import { createMeerkatRelayBackend } from './hosted-relay';
// public-join-client.ts (Plan 19 P9 FF3-B, app half). Owns the effective-relay-gated
// PARK of a request-policy public-join envelope, matching the file-request / background-sync
// parkEnvelope pattern (SOURCE OF TRUTH: SyncProvider.parkEnvelopeOnRelay).
//
// HONESTY: queuePublicJoinRequest SEALS (ok:true) but does not SEND. A "sent" claim is only
// honest when a REAL relay park returned true. With DEFAULT_RELAY_URL '' (no configured relay)
// effectiveRelayUrl(db) returns '', the `.startsWith('ws')` guard short-circuits, the park
// returns false, and the request stays on the device ("Saved on this device. It will be sent
// when a connection server is available."). NOTHING leaves the device on the saved path.
//
// The sealed payload carries ONLY the joiner's signed identity bundle (its x25519 PUBLIC DH key
// bound to its device id); redeeming/approving still mints the epoch key solely through the
// owner-gated wrap rail, so this request confers ZERO read access on its own.

import type { DatabaseAdapter } from '@mylife/db';
import {
  encodeMailboxEnvelope,
  queuePublicJoinRequest,
  type DeviceIdentity,
  type MailboxEnvelope,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { ensureEffectiveRelayUrl } from './effective-relay';

/** The honest outcome of a request-policy public-join attempt. */
export type PublicJoinRequestOutcome =
  /** A real relay park succeeded: the sealed request is on its way to the owner. */
  | { kind: 'sent' }
  /** Sealed on the device but no connection server was available to park it. */
  | { kind: 'saved' }
  /** The descriptor did not yield a valid grant (fail-closed): nothing was sealed. */
  | { kind: 'invalid' };

/**
 * Park an already-sealed public-join envelope on its relay mailbox token (fresh backend per
 * park). Returns true ONLY on a real park, so a "sent" claim can never be faked.
 */
async function parkEnvelopeOnRelay(
  relayUrl: string,
  token: string,
  envelope: MailboxEnvelope,
  identity: DeviceIdentity,
): Promise<boolean> {
  if (!relayUrl.startsWith('ws')) return false;
  const backend = createMeerkatRelayBackend(identity);
  try {
    const session = await backend.connect(relayUrl, token);
    try {
      await session.send(encodeMailboxEnvelope(envelope));
      return true;
    } finally {
      await session.close();
    }
  } catch {
    return false;
  } finally {
    backend.destroy();
  }
}

/**
 * Seal a request-policy public-join request to the publication owner and best-effort park it.
 * The caller MUST pass a FRESHLY fetched + verified descriptor (the live trust anchor).
 * 'invalid' = queuePublicJoinRequest fail-closed (no valid grant / no owner DH key), nothing
 * sealed; 'sent' = a real relay park succeeded; 'saved' = sealed on device, no relay reached.
 */
export async function requestPublicJoin(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  signed: SignedPublicationDescriptor,
  humanityToken: string,
): Promise<PublicJoinRequestOutcome> {
  // AM1: a request-policy public join is a SHARED-network action, so it carries a
  // required humanity token. The engine fails closed on an empty one at the
  // owner's open, so the caller must obtain a token (VerifySheet) first.
  const queued = queuePublicJoinRequest(identity, signed, humanityToken);
  if (!queued.ok) return { kind: 'invalid' };
  const relayUrl = await ensureEffectiveRelayUrl(db);
  const parked = await parkEnvelopeOnRelay(relayUrl, queued.token, queued.envelope, identity);
  return parked ? { kind: 'sent' } : { kind: 'saved' };
}
