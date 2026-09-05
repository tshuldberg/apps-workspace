/**
 * Key custody flows (plan 48 WP6). The client half of
 * docs/designs/mynews-key-custody.md: each function orchestrates the same three
 * steps against the mynews-register-key edge function, so no screen has to know
 * the protocol.
 *
 *   1. Ask for a nonce. The server answers with the binding it will hold the
 *      proof to: the profile, the CURRENT chain head, and the nonce.
 *   2. Sign that binding. Authorization purposes are signed with the key allowed
 *      to authorize; possession purposes with the key being introduced.
 *   3. Send the action. The server re-derives the binding from its own state
 *      before verifying, so a client that signs anything else is refused.
 *
 * Everything routes through the port's existing `callFunction`, so no adapter
 * changes are needed and the in-memory port keeps working.
 *
 * Failure is always typed and never optimistic: a code the caller can render
 * plus the server's own detail string. No function here reports success it
 * cannot see in the envelope.
 */

import { signKeyCustody } from '../signing/sign';
import type { FunctionEnvelope, MyNewsCloudPort } from './cloud';

/** An author's own signing key material. Mirrors AuthorIdentity. */
export interface CustodySigner {
  pubkeyHex: string;
  privateKeyHex: string;
}

export type CustodyErrorCode =
  | 'not-signed-in'
  | 'no-profile'
  | 'no-active-key'
  | 'bad-signature'
  | 'bad-nonce'
  | 'rate-limited'
  | 'head-conflict'
  | 'pubkey-conflict'
  | 'same-key'
  | 'not-primary'
  | 'unknown-key'
  | 'not-your-key'
  | 'already-revoked'
  | 'use-rotation-for-primary'
  | 'revoke-precedence'
  | 'notification-channel-required'
  | 'recovery-frozen'
  | 'already-pending'
  | 'unknown-request'
  | 'not-pending'
  | 'still-locked'
  | 'pubkey-not-precommitted'
  | 'bad-cancel-token'
  | 'no-kit'
  | 'reauth-required'
  | 'validation'
  | 'network'
  | 'unknown';

const KNOWN_CODES = new Set<string>([
  'not-signed-in',
  'no-profile',
  'no-active-key',
  'bad-signature',
  'bad-nonce',
  'rate-limited',
  'head-conflict',
  'pubkey-conflict',
  'same-key',
  'not-primary',
  'unknown-key',
  'not-your-key',
  'already-revoked',
  'use-rotation-for-primary',
  'revoke-precedence',
  'notification-channel-required',
  'recovery-frozen',
  'already-pending',
  'unknown-request',
  'not-pending',
  'still-locked',
  'pubkey-not-precommitted',
  'bad-cancel-token',
  'no-kit',
  'reauth-required',
]);

export type CustodyFailure = { ok: false; code: CustodyErrorCode; detail?: string };

function toFailure(envelope: { error: string; detail?: string }): CustodyFailure {
  const code = envelope.error === 'bad-payload'
    ? 'validation'
    : KNOWN_CODES.has(envelope.error)
      ? (envelope.error as CustodyErrorCode)
      : 'unknown';
  return { ok: false, code, detail: envelope.detail ?? envelope.error };
}

async function call<T>(
  port: MyNewsCloudPort,
  body: Record<string, unknown>,
): Promise<FunctionEnvelope<T> | CustodyFailure> {
  try {
    return await port.callFunction<T>('mynews-register-key', body);
  } catch (error) {
    return { ok: false, code: 'network', detail: (error as Error).message };
  }
}

/* ------------------------------ status views ------------------------------ */

export interface CustodyKeyView {
  id: string;
  seq: number;
  pubkey: string;
  status: 'active' | 'revoked';
  kind: 'primary' | 'device';
  addedVia: 'initial' | 'rotation' | 'device_approval' | 'recovery' | 'backup_restore';
  validFrom: string;
  revokedAt: string | null;
}

export interface CustodyEscrowView {
  version: number;
  pubkey: string;
  createdAt: string;
}

export interface CustodyEscrowAccessView {
  action: 'put' | 'get' | 'get-denied';
  version: number | null;
  detail: string;
  createdAt: string;
}

export interface CustodyRecoveryView {
  id: string;
  status: 'pending' | 'cancelled' | 'completed' | 'frozen';
  newPubkey: string;
  requestedAt: string;
  unlocksAt: string;
  standing: 'open' | 'verified';
}

export interface CustodyStatusView {
  profileId: string;
  headPubkey: string;
  keys: CustodyKeyView[];
  escrow: CustodyEscrowView[];
  escrowAccess: CustodyEscrowAccessView[];
  /**
   * Whether recovery WITHOUT a kit is available at all. False on every current
   * deployment: MyNews ships no notification provider, and that path depends on
   * delivering a notice with a keyless cancel token. Surfaced so the UI can say
   * so plainly instead of offering a button that always refuses.
   */
  notificationChannelConfirmed: boolean;
  recovery: CustodyRecoveryView | null;
  recoveryFrozen: boolean;
}

export type CustodyStatusResult = ({ ok: true } & CustodyStatusView) | CustodyFailure;

export async function fetchCustodyStatus(port: MyNewsCloudPort): Promise<CustodyStatusResult> {
  const envelope = await call<CustodyStatusView>(port, { action: 'recovery-status' });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, ...envelope.data };
}

/**
 * Does this signer still hold an ACTIVE key on the chain? What the composer and
 * the review screens check before offering to sign, so the honest disabled state
 * shows up before a write is attempted rather than after it is refused.
 */
export function isSignerActive(status: CustodyStatusView, signerPubkey: string): boolean {
  return status.keys.some((k) => k.pubkey === signerPubkey && k.status === 'active');
}

/** Is a recovery waiting on this profile? Signing is paused while one is pending. */
export function hasPendingRecovery(status: CustodyStatusView): boolean {
  return status.recovery?.status === 'pending';
}

/* ------------------------------- nonce step ------------------------------- */

type NoncePurpose =
  | 'rotation'
  | 'device_approval'
  | 'revocation'
  | 'recovery_complete'
  | 'escrow_put';

interface NonceBinding {
  nonce: string;
  profileId: string;
  oldPubkey: string;
}

async function issueNonce(
  port: MyNewsCloudPort,
  purpose: NoncePurpose,
): Promise<NonceBinding | CustodyFailure> {
  const envelope = await call<NonceBinding & { purpose: string; expiresAt: string }>(port, {
    action: 'issue-nonce',
    purpose,
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  const { nonce, profileId, oldPubkey } = envelope.data;
  if (!nonce || !profileId || !oldPubkey) {
    return { ok: false, code: 'unknown', detail: 'the server returned an incomplete nonce' };
  }
  return { nonce, profileId, oldPubkey };
}

/* --------------------------------- actions -------------------------------- */

export type RotateResult =
  | { ok: true; keyId: string; pubkey: string; backupRestore: boolean }
  | CustodyFailure;

/**
 * Replace the profile's signing key. The OLD key authorizes the change and the
 * NEW key proves possession, so a user can never rotate onto a key nobody holds.
 */
export async function rotateSigningKey(input: {
  port: MyNewsCloudPort;
  userId: string;
  current: CustodySigner;
  next: CustodySigner;
}): Promise<RotateResult> {
  const binding = await issueNonce(input.port, 'rotation');
  if ('code' in binding) return binding;

  const common = {
    userId: input.userId,
    profileId: binding.profileId,
    oldPubkey: binding.oldPubkey,
    subject: input.next.pubkeyHex,
    nonce: binding.nonce,
  };
  const envelope = await call<{ keyId: string; pubkey: string; backupRestore: boolean }>(
    input.port,
    {
      action: 'rotate',
      nonce: binding.nonce,
      newPubkey: input.next.pubkeyHex,
      authorizationSignatureHex: signKeyCustody(
        { ...common, purpose: 'rotation' },
        input.current.privateKeyHex,
      ),
      possessionSignatureHex: signKeyCustody(
        { ...common, purpose: 'possession' },
        input.next.privateKeyHex,
      ),
    },
  );
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, ...envelope.data };
}

export type ApproveDeviceResult = { ok: true; keyId: string; pubkey: string } | CustodyFailure;

/** Add a second device's key as co-active, authorized by the primary. */
export async function approveDeviceKey(input: {
  port: MyNewsCloudPort;
  userId: string;
  primary: CustodySigner;
  device: CustodySigner;
}): Promise<ApproveDeviceResult> {
  const binding = await issueNonce(input.port, 'device_approval');
  if ('code' in binding) return binding;

  const common = {
    userId: input.userId,
    profileId: binding.profileId,
    oldPubkey: binding.oldPubkey,
    subject: input.device.pubkeyHex,
    nonce: binding.nonce,
  };
  const envelope = await call<{ keyId: string; pubkey: string }>(input.port, {
    action: 'approve-device',
    nonce: binding.nonce,
    devicePubkey: input.device.pubkeyHex,
    authorizationSignatureHex: signKeyCustody(
      { ...common, purpose: 'device-approval' },
      input.primary.privateKeyHex,
    ),
    possessionSignatureHex: signKeyCustody(
      { ...common, purpose: 'device-possession' },
      input.device.privateKeyHex,
    ),
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, ...envelope.data };
}

export type RevokeResult = { ok: true; keyId: string } | CustodyFailure;

/**
 * Revoke one device key. Needs a fresh session as well as the proof: the server
 * refuses with 'reauth-required' otherwise.
 */
export async function revokeDeviceKey(input: {
  port: MyNewsCloudPort;
  userId: string;
  actor: CustodySigner;
  targetKeyId: string;
}): Promise<RevokeResult> {
  const binding = await issueNonce(input.port, 'revocation');
  if ('code' in binding) return binding;

  const envelope = await call<{ keyId: string }>(input.port, {
    action: 'revoke',
    nonce: binding.nonce,
    targetKeyId: input.targetKeyId,
    authorizationSignatureHex: signKeyCustody(
      {
        purpose: 'revocation',
        userId: input.userId,
        profileId: binding.profileId,
        oldPubkey: binding.oldPubkey,
        subject: input.targetKeyId,
        nonce: binding.nonce,
      },
      input.actor.privateKeyHex,
    ),
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, ...envelope.data };
}

export type EscrowPutResult = { ok: true; version: number } | CustodyFailure;

/**
 * Store the recovery kit CIPHERTEXT on the server. The recovery code never
 * leaves the device, so the server holds nothing it can open. Needs a fresh
 * session: the server refuses with 'reauth-required' otherwise.
 */
export async function escrowRecoveryKit(input: {
  port: MyNewsCloudPort;
  userId: string;
  signer: CustodySigner;
  envelope: Record<string, unknown>;
}): Promise<EscrowPutResult> {
  const binding = await issueNonce(input.port, 'escrow_put');
  if ('code' in binding) return binding;

  const envelope = await call<{ version: number }>(input.port, {
    action: 'escrow-put',
    nonce: binding.nonce,
    pubkey: input.signer.pubkeyHex,
    envelope: input.envelope,
    authorizationSignatureHex: signKeyCustody(
      {
        purpose: 'escrow-put',
        userId: input.userId,
        profileId: binding.profileId,
        oldPubkey: binding.oldPubkey,
        subject: input.signer.pubkeyHex,
        nonce: binding.nonce,
      },
      input.signer.privateKeyHex,
    ),
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, ...envelope.data };
}

export type EscrowGetResult =
  | { ok: true; version: number; envelope: Record<string, unknown>; pubkey: string }
  | CustodyFailure;

/**
 * Fetch the escrowed kit ciphertext. Rate limited to 3 a day server-side, and
 * every read (allowed or denied) lands in the owner-visible access log.
 */
export async function fetchEscrowedKit(port: MyNewsCloudPort): Promise<EscrowGetResult> {
  const envelope = await call<{
    version: number;
    envelope: Record<string, unknown>;
    pubkey: string;
  }>(port, { action: 'escrow-get' });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, ...envelope.data };
}

export type RecoveryRequestResult =
  | { ok: true; requestId: string; unlocksAt: string; standing: 'open' | 'verified' }
  | CustodyFailure;

/**
 * Open a recovery WITHOUT a kit. Expect 'notification-channel-required' on every
 * current deployment: the path depends on delivering a notice carrying a keyless
 * cancel token, and MyNews ships no notification provider. Callers must render
 * that as unavailable, never retry it as a transient failure.
 */
export async function requestKeyRecovery(input: {
  port: MyNewsCloudPort;
  userId: string;
  profileId: string;
  currentHeadPubkey: string;
  next: CustodySigner;
}): Promise<RecoveryRequestResult> {
  const envelope = await call<{
    requestId: string;
    unlocksAt: string;
    standing: 'open' | 'verified';
  }>(input.port, {
    action: 'recovery-request',
    newPubkey: input.next.pubkeyHex,
    // No nonce exists before a request does, so the pre-commitment itself is the
    // replay bound: one pending request per profile, and completion re-proves
    // possession against a real nonce.
    possessionSignatureHex: signKeyCustody(
      {
        purpose: 'possession',
        userId: input.userId,
        profileId: input.profileId,
        oldPubkey: input.currentHeadPubkey,
        subject: input.next.pubkeyHex,
        nonce: '',
      },
      input.next.privateKeyHex,
    ),
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, ...envelope.data };
}

export type RecoveryCancelResult =
  | { ok: true; status: 'cancelled' | 'frozen' }
  | CustodyFailure;

/** Cancel with the keyless token from the notice. */
export async function cancelKeyRecoveryWithToken(input: {
  port: MyNewsCloudPort;
  requestId: string;
  cancelToken: string;
}): Promise<RecoveryCancelResult> {
  const envelope = await call<{ cancelled: boolean; status: 'cancelled' | 'frozen' }>(input.port, {
    action: 'recovery-cancel',
    requestId: input.requestId,
    cancelToken: input.cancelToken,
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, status: envelope.data.status };
}

/** Cancel from a device that still holds an active key. */
export async function cancelKeyRecoveryWithKey(input: {
  port: MyNewsCloudPort;
  userId: string;
  actor: CustodySigner;
  requestId: string;
}): Promise<RecoveryCancelResult> {
  const binding = await issueNonce(input.port, 'revocation');
  if ('code' in binding) return binding;

  const envelope = await call<{ cancelled: boolean; status: 'cancelled' | 'frozen' }>(input.port, {
    action: 'recovery-cancel',
    requestId: input.requestId,
    nonce: binding.nonce,
    authorizationSignatureHex: signKeyCustody(
      {
        purpose: 'revocation',
        userId: input.userId,
        profileId: binding.profileId,
        oldPubkey: binding.oldPubkey,
        subject: input.requestId,
        nonce: binding.nonce,
      },
      input.actor.privateKeyHex,
    ),
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, status: envelope.data.status };
}

export type RecoveryCompleteResult =
  | { ok: true; keyId: string; pubkey: string }
  | CustodyFailure;

/**
 * Finish a no-kit recovery after its lock elapses. Requires a fresh session AND
 * possession of exactly the key the request pre-committed to.
 */
export async function completeKeyRecovery(input: {
  port: MyNewsCloudPort;
  userId: string;
  requestId: string;
  next: CustodySigner;
}): Promise<RecoveryCompleteResult> {
  const binding = await issueNonce(input.port, 'recovery_complete');
  if ('code' in binding) return binding;

  const envelope = await call<{ keyId: string; pubkey: string; recovered: boolean }>(input.port, {
    action: 'recovery-complete',
    nonce: binding.nonce,
    requestId: input.requestId,
    newPubkey: input.next.pubkeyHex,
    possessionSignatureHex: signKeyCustody(
      {
        purpose: 'possession',
        userId: input.userId,
        profileId: binding.profileId,
        oldPubkey: binding.oldPubkey,
        subject: input.next.pubkeyHex,
        nonce: binding.nonce,
      },
      input.next.privateKeyHex,
    ),
  });
  if ('code' in envelope) return envelope;
  if (!envelope.ok) return toFailure(envelope);
  return { ok: true, keyId: envelope.data.keyId, pubkey: envelope.data.pubkey };
}
