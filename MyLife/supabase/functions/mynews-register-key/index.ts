// MyNews register-key: proof-of-possession for the profile's Ed25519 key, plus
// the whole key custody surface added by plan 48 WP6.
//
// ---------------------------------------------------------------- initial bind
// The client-write guard trigger (migration 20260705000003) forbids an
// authenticated/anon session from setting a non-empty nw_profiles.pubkey_ed25519,
// so the only path to a real signing key is this function. verify_jwt is ON;
// the caller's Supabase uid comes from the JWT sub. The registrant must present
// an Ed25519 signature over canonicalKeyPossessionBytes(sub, pubkey): binding
// the uid makes the proof non-transferable (a squatter cannot replay a victim's
// signature without the victim's private key AND a session for the victim's uid).
// On success the key is bound to the caller's own profile under the service role.
//
// A body with no `action` takes exactly that path, byte-for-byte as before, so
// existing clients keep working.
//
// -------------------------------------------------------------- custody actions
// Everything else is a custody transition. The shape is the same every time:
//
//   1. issue-nonce mints a single-use, 5-minute nonce bound server-side to
//      (uid, profile, CURRENT head pubkey, purpose) and tells the client what
//      the binding is, so it can build the canonical bytes.
//   2. The client signs those bytes. Authorization purposes are signed by the
//      key that is allowed to authorize (the old head, or the primary);
//      possession purposes are signed by the key being introduced.
//   3. This function RE-DERIVES the binding from server state rather than
//      trusting the body, verifies the signatures against it, and calls the RPC.
//      Re-deriving is load-bearing: if the signed bytes came from the request
//      body, a client could sign a proof over a profile and head of its own
//      choosing and still have the RPC act on the real ones.
//   4. The RPC consumes the nonce and re-asserts the head inside the
//      transaction, so a concurrent rotation loses instead of forking the chain.
//
// Step-up re-authentication is required for the actions where a merely-open
// session must not be enough: revoke, escrow-put, and recovery-complete. The
// design is explicit that completion checks freshness at COMPLETION time, not
// only at request time, so a captured idle session cannot ripen into a key.
//
// ------------------------------------------------ no-kit recovery, fail closed
// Recovery WITHOUT a kit depends on delivering a notice that carries a keyless
// cancel token, because that notice is the only thing that lets a real owner
// stop a stolen-session takeover they can see happening. MyNews ships no
// notification provider, so nw_key_recovery_request refuses with
// 'notification-channel-required' and this function returns that state verbatim
// for the app to render as unavailable. Nothing here sends, queues, schedules,
// or claims to send a notification, and the raw cancel token is never returned
// in the response: handing it to whoever holds the session would defeat the one
// thing it defends against.

import { jsonError, jsonOk, parseJwtSub, serveEnvelope } from '../_shared/mynews-http.ts';
import { annotateRequestLog } from '../_shared/mynews-observability.ts';
import {
  canonicalKeyCustodyBytes,
  canonicalKeyPossessionBytes,
  verifyEd25519,
  type WireKeyCustodyPurpose,
} from '../_shared/mynews-signing.ts';
import { hasFreshSession } from '../_shared/mynews-key-verify.ts';
import {
  createPostgrestMyNewsStore,
  type KeyCustodyOutcome,
  type KeyCustodyStatus,
  type KeyNoncePurpose,
  type MyNewsStore,
} from '../_shared/mynews-store.ts';

export interface RegisterKeyDeps {
  store: MyNewsStore;
  verify?: typeof verifyEd25519;
  now?: () => number;
  /**
   * CSPRNG seam for nonces and cancel tokens. Injectable for tests ONLY; the
   * default is the platform CSPRNG and there is deliberately no weaker fallback.
   */
  randomBytes?: (byteCount: number) => Uint8Array;
  /** sha-256 hex seam, matching the cancel-token hash the RPC stores. */
  sha256Hex?: (text: string) => Promise<string>;
}

const PUBKEY_HEX = /^[0-9a-f]{64}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CustodyAction =
  | 'issue-nonce'
  | 'rotate'
  | 'approve-device'
  | 'revoke'
  | 'escrow-put'
  | 'escrow-get'
  | 'recovery-request'
  | 'recovery-cancel'
  | 'recovery-complete'
  | 'recovery-status';

const ACTIONS = new Set<CustodyAction>([
  'issue-nonce',
  'rotate',
  'approve-device',
  'revoke',
  'escrow-put',
  'escrow-get',
  'recovery-request',
  'recovery-cancel',
  'recovery-complete',
  'recovery-status',
]);

/** Actions that require a fresh session on top of the possession proof. */
const STEP_UP_ACTIONS = new Set<CustodyAction>([
  'revoke',
  'escrow-put',
  'recovery-complete',
]);

const NONCE_PURPOSES = new Set<KeyNoncePurpose>([
  'rotation',
  'device_approval',
  'revocation',
  'recovery_complete',
  'escrow_put',
]);

/**
 * HTTP status per custody outcome. Grouped by what the caller should do:
 * 4xx-with-a-fix for payload and proof problems, 409 for state conflicts the
 * caller can retry after refetching, 429 for rate limits.
 */
const OUTCOME_STATUS: Record<KeyCustodyOutcome, number> = {
  ok: 200,
  'bad-payload': 400,
  'bad-nonce': 403,
  'no-profile': 409,
  'no-active-key': 409,
  'rate-limited': 429,
  'head-conflict': 409,
  'pubkey-conflict': 409,
  'same-key': 400,
  'not-primary': 403,
  'unknown-key': 404,
  'not-your-key': 403,
  'already-revoked': 409,
  'use-rotation-for-primary': 400,
  'revoke-precedence': 403,
  'notification-channel-required': 503,
  'recovery-frozen': 409,
  'already-pending': 409,
  'unknown-request': 404,
  'not-pending': 409,
  'still-locked': 409,
  'pubkey-not-precommitted': 403,
  'bad-cancel-token': 403,
  'no-kit': 404,
};

/** Plain-language detail for the outcomes whose code alone is not self-explaining. */
const OUTCOME_DETAIL: Partial<Record<KeyCustodyOutcome, string>> = {
  'no-active-key': 'this profile has no signing key to transition from',
  'head-conflict':
    'your signing key changed while this request was in flight; start over from a fresh nonce',
  'pubkey-conflict': 'that key is already active on an account',
  'same-key': 'the new key must differ from the current one',
  'not-primary': 'only your primary key can approve a device',
  'use-rotation-for-primary':
    'replacing your primary key is a rotation, which revokes and replaces it in one step',
  'revoke-precedence': 'an older device key cannot be revoked by a newer one',
  'notification-channel-required':
    'recovery without a recovery kit needs a confirmed notification channel, and this MyNews deployment has no notification channel configured, so that path is unavailable. Use your recovery kit, or another device that still holds an active key.',
  'recovery-frozen':
    'two recovery attempts were cancelled in the last 90 days, so recovery without a kit is frozen for this account. Your recovery kit still works, and so does any device that still holds an active key.',
  'still-locked': 'this recovery is still inside its waiting period',
  'pubkey-not-precommitted':
    'this recovery was opened for a different key than the one presented',
  'no-kit': 'no recovery kit is escrowed for this account',
};

function platformRandomBytes(byteCount: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('mynews register-key: no platform CSPRNG is available');
  }
  return cryptoApi.getRandomValues(new Uint8Array(byteCount));
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

async function platformSha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(new Uint8Array(digest));
}

/** 32 random bytes as hex: the nonce shape the nonce table's CHECK requires. */
function mintNonce(deps: RegisterKeyDeps): string {
  const bytes = (deps.randomBytes ?? platformRandomBytes)(32);
  if (bytes.length !== 32) {
    throw new Error('mynews register-key: CSPRNG returned the wrong width');
  }
  return toHex(bytes);
}

function outcomeError(outcome: KeyCustodyOutcome): Response {
  return jsonError(outcome, OUTCOME_STATUS[outcome] ?? 400, OUTCOME_DETAIL[outcome]);
}

/* ------------------------------- legacy bind ------------------------------ */

interface BindBody {
  pubkey: string;
  signatureHex: string;
}

function parseBindBody(raw: unknown): BindBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.pubkey !== 'string' || typeof b.signatureHex !== 'string') return null;
  if (!PUBKEY_HEX.test(b.pubkey)) return null;
  return { pubkey: b.pubkey, signatureHex: b.signatureHex };
}

async function handleInitialBind(
  userId: string,
  raw: unknown,
  deps: RegisterKeyDeps,
): Promise<Response> {
  const verify = deps.verify ?? verifyEd25519;
  const body = parseBindBody(raw);
  if (!body) return jsonError('bad-payload', 400);

  // The proof is over the CALLER's own uid; a signature made for a different uid
  // (a stolen/relayed victim proof) fails here, which is the anti-squatting bar.
  const validSig = await verify(
    body.pubkey,
    canonicalKeyPossessionBytes({ userId, pubkey: body.pubkey }),
    body.signatureHex,
  );
  if (!validSig) return jsonError('bad-signature', 403);

  const result = await deps.store.setProfilePubkey(userId, body.pubkey);
  if (result === 'no-profile') return jsonError('no-profile', 409);
  if (result === 'pubkey-conflict') return jsonError('pubkey-conflict', 409);
  if (result === 'already-set') return jsonError('already-set', 409);
  return jsonOk({ pubkey: body.pubkey });
}

/* ------------------------------ custody actions --------------------------- */

interface CustodyBody {
  action: CustodyAction;
  purpose?: KeyNoncePurpose;
  nonce?: string;
  newPubkey?: string;
  devicePubkey?: string;
  targetKeyId?: string;
  requestId?: string;
  cancelToken?: string;
  /** Signed by the key ALLOWED to authorize the transition. */
  authorizationSignatureHex?: string;
  /** Signed by the key being INTRODUCED, proving possession. */
  possessionSignatureHex?: string;
  envelope?: Record<string, unknown>;
  pubkey?: string;
}

function parseCustodyBody(raw: unknown): CustodyBody | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.action !== 'string' || !ACTIONS.has(b.action as CustodyAction)) return null;

  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const body: CustodyBody = {
    action: b.action as CustodyAction,
    purpose: NONCE_PURPOSES.has(b.purpose as KeyNoncePurpose)
      ? (b.purpose as KeyNoncePurpose)
      : undefined,
    nonce: str(b.nonce),
    newPubkey: str(b.newPubkey),
    devicePubkey: str(b.devicePubkey),
    targetKeyId: str(b.targetKeyId),
    requestId: str(b.requestId),
    cancelToken: str(b.cancelToken),
    authorizationSignatureHex: str(b.authorizationSignatureHex),
    possessionSignatureHex: str(b.possessionSignatureHex),
    pubkey: str(b.pubkey),
  };
  if (b.envelope !== undefined) {
    if (typeof b.envelope !== 'object' || b.envelope === null || Array.isArray(b.envelope)) {
      return null;
    }
    body.envelope = b.envelope as Record<string, unknown>;
  }
  return body;
}

/**
 * Server-derived binding for the canonical proof bytes. Never taken from the
 * request body: see the header note on why re-deriving is load-bearing.
 */
interface CustodyBinding {
  profileId: string;
  headPubkey: string;
  status: KeyCustodyStatus;
}

async function readBinding(
  store: MyNewsStore,
  userId: string,
): Promise<CustodyBinding | KeyCustodyOutcome> {
  const status = await store.getKeyCustodyStatus(userId);
  if (status.outcome !== 'ok' || !status.profileId) return status.outcome;
  const headPubkey = status.headPubkey ?? '';
  if (headPubkey === '') return 'no-active-key';
  return { profileId: status.profileId, headPubkey, status };
}

/** Verify one custody proof against a named signer. */
async function verifyCustodyProof(
  deps: RegisterKeyDeps,
  input: {
    purpose: WireKeyCustodyPurpose;
    userId: string;
    binding: CustodyBinding;
    subject: string;
    nonce: string;
    signerPubkey: string;
    signatureHex: string;
  },
): Promise<boolean> {
  const verify = deps.verify ?? verifyEd25519;
  return verify(
    input.signerPubkey,
    canonicalKeyCustodyBytes({
      purpose: input.purpose,
      userId: input.userId,
      profileId: input.binding.profileId,
      oldPubkey: input.binding.headPubkey,
      subject: input.subject,
      nonce: input.nonce,
    }),
    input.signatureHex,
  );
}

async function handleIssueNonce(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (!body.purpose) return jsonError('bad-payload', 400, 'unknown nonce purpose');
  const issued = await deps.store.issueKeyNonce({
    userId,
    nonce: mintNonce(deps),
    purpose: body.purpose,
  });
  if (issued.outcome !== 'ok') return outcomeError(issued.outcome);
  return jsonOk({
    nonce: issued.nonce,
    profileId: issued.profileId,
    // The binding the client must sign over. Echoed so the client never has to
    // guess it, and so a client that signs over anything else fails verification.
    oldPubkey: issued.oldPubkey,
    purpose: issued.purpose,
    expiresAt: issued.expiresAt,
  });
}

async function handleRotate(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (
    !body.nonce ||
    !HEX64.test(body.nonce) ||
    !body.newPubkey ||
    !PUBKEY_HEX.test(body.newPubkey) ||
    !body.authorizationSignatureHex ||
    !body.possessionSignatureHex
  ) {
    return jsonError('bad-payload', 400, 'rotation needs a nonce, a new key, and both proofs');
  }

  const binding = await readBinding(deps.store, userId);
  if (typeof binding === 'string') return outcomeError(binding);

  // The OLD key authorizes replacing itself.
  const authorized = await verifyCustodyProof(deps, {
    purpose: 'rotation',
    userId,
    binding,
    subject: body.newPubkey,
    nonce: body.nonce,
    signerPubkey: binding.headPubkey,
    signatureHex: body.authorizationSignatureHex,
  });
  if (!authorized) return jsonError('bad-signature', 403, 'the old key did not authorize this');

  // The NEW key proves it exists and is held by the caller. Without this a user
  // could rotate to a key nobody holds and permanently lose their byline.
  const possessed = await verifyCustodyProof(deps, {
    purpose: 'possession',
    userId,
    binding,
    subject: body.newPubkey,
    nonce: body.nonce,
    signerPubkey: body.newPubkey,
    signatureHex: body.possessionSignatureHex,
  });
  if (!possessed) return jsonError('bad-signature', 403, 'the new key did not prove possession');

  const result = await deps.store.rotateProfileKey({
    userId,
    nonce: body.nonce,
    newPubkey: body.newPubkey,
    addedVia: 'rotation',
    proof: {
      purpose: 'rotation',
      oldPubkey: binding.headPubkey,
      newPubkey: body.newPubkey,
      authorizationSignatureHex: body.authorizationSignatureHex,
      possessionSignatureHex: body.possessionSignatureHex,
    },
  });
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({
    keyId: result.keyId,
    previousKeyId: result.previousKeyId,
    pubkey: body.newPubkey,
    // True when this bind followed an escrow read inside 24h, which is published
    // as a public 'key restored from encrypted backup' event.
    backupRestore: result.backupRestore === true,
  });
}

async function handleApproveDevice(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (
    !body.nonce ||
    !HEX64.test(body.nonce) ||
    !body.devicePubkey ||
    !PUBKEY_HEX.test(body.devicePubkey) ||
    !body.authorizationSignatureHex ||
    !body.possessionSignatureHex
  ) {
    return jsonError(
      'bad-payload',
      400,
      'device approval needs a nonce, a device key, and both proofs',
    );
  }

  const binding = await readBinding(deps.store, userId);
  if (typeof binding === 'string') return outcomeError(binding);

  const authorized = await verifyCustodyProof(deps, {
    purpose: 'device-approval',
    userId,
    binding,
    subject: body.devicePubkey,
    nonce: body.nonce,
    signerPubkey: binding.headPubkey,
    signatureHex: body.authorizationSignatureHex,
  });
  if (!authorized) {
    return jsonError('bad-signature', 403, 'your primary key did not authorize this device');
  }

  const possessed = await verifyCustodyProof(deps, {
    purpose: 'device-possession',
    userId,
    binding,
    subject: body.devicePubkey,
    nonce: body.nonce,
    signerPubkey: body.devicePubkey,
    signatureHex: body.possessionSignatureHex,
  });
  if (!possessed) {
    return jsonError('bad-signature', 403, 'the device key did not prove possession');
  }

  const result = await deps.store.approveDeviceKey({
    userId,
    nonce: body.nonce,
    devicePubkey: body.devicePubkey,
    proof: {
      purpose: 'device-approval',
      approvedBy: binding.headPubkey,
      devicePubkey: body.devicePubkey,
      authorizationSignatureHex: body.authorizationSignatureHex,
      possessionSignatureHex: body.possessionSignatureHex,
    },
  });
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({ keyId: result.keyId, pubkey: body.devicePubkey });
}

async function handleRevoke(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (
    !body.nonce ||
    !HEX64.test(body.nonce) ||
    !body.targetKeyId ||
    !UUID_RE.test(body.targetKeyId) ||
    !body.authorizationSignatureHex
  ) {
    return jsonError('bad-payload', 400, 'revocation needs a nonce, a key id, and a proof');
  }

  const binding = await readBinding(deps.store, userId);
  if (typeof binding === 'string') return outcomeError(binding);

  // The revoke proof's subject is the target CHAIN ROW ID, not a pubkey: it is
  // the thing being revoked, and binding it stops a proof collected to revoke
  // one device from being spent on another.
  const authorized = await verifyCustodyProof(deps, {
    purpose: 'revocation',
    userId,
    binding,
    subject: body.targetKeyId,
    nonce: body.nonce,
    signerPubkey: binding.headPubkey,
    signatureHex: body.authorizationSignatureHex,
  });
  if (!authorized) return jsonError('bad-signature', 403, 'no active key authorized this revoke');

  const result = await deps.store.revokeProfileKey({
    userId,
    nonce: body.nonce,
    targetKeyId: body.targetKeyId,
  });
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({ keyId: result.keyId, revoked: true });
}

async function handleEscrowPut(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (
    !body.nonce ||
    !HEX64.test(body.nonce) ||
    !body.pubkey ||
    !PUBKEY_HEX.test(body.pubkey) ||
    !body.envelope ||
    !body.authorizationSignatureHex
  ) {
    return jsonError('bad-payload', 400, 'escrow needs a nonce, an envelope, a key, and a proof');
  }
  // Shape check only. The server MUST NOT be able to open this, so it never
  // looks at the ciphertext beyond confirming the envelope is a v1 kit for the
  // key it claims.
  if (body.envelope.v !== 1) {
    return jsonError('bad-payload', 400, 'unsupported recovery kit version');
  }
  if (body.envelope.pubkey !== body.pubkey) {
    return jsonError('bad-payload', 400, 'envelope key does not match the declared key');
  }

  const binding = await readBinding(deps.store, userId);
  if (typeof binding === 'string') return outcomeError(binding);

  const authorized = await verifyCustodyProof(deps, {
    purpose: 'escrow-put',
    userId,
    binding,
    subject: body.pubkey,
    nonce: body.nonce,
    signerPubkey: binding.headPubkey,
    signatureHex: body.authorizationSignatureHex,
  });
  if (!authorized) return jsonError('bad-signature', 403, 'no active key authorized this escrow');

  const result = await deps.store.escrowPutKit({
    userId,
    nonce: body.nonce,
    envelope: body.envelope,
    pubkey: body.pubkey,
  });
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({ version: result.version });
}

async function handleEscrowGet(userId: string, deps: RegisterKeyDeps): Promise<Response> {
  const result = await deps.store.escrowGetKit(userId);
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({
    version: result.version,
    envelope: result.envelope,
    pubkey: result.pubkey,
  });
}

async function handleRecoveryRequest(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (!body.newPubkey || !PUBKEY_HEX.test(body.newPubkey)) {
    return jsonError('bad-payload', 400, 'recovery needs the new key to pre-commit to');
  }
  if (!body.possessionSignatureHex) {
    return jsonError('bad-payload', 400, 'recovery needs a possession proof for the new key');
  }

  // Possession of the PRE-COMMITTED key is proved at request time as well as at
  // completion. Without it an attacker could open a lock on a key nobody holds
  // and burn the owner's cancel budget for free.
  const binding = await deps.store.getKeyCustodyStatus(userId);
  if (binding.outcome !== 'ok' || !binding.profileId) return outcomeError(binding.outcome);
  const headPubkey = binding.headPubkey ?? '';
  if (headPubkey === '') return outcomeError('no-active-key');

  const verify = deps.verify ?? verifyEd25519;
  const possessed = await verify(
    body.newPubkey,
    canonicalKeyCustodyBytes({
      purpose: 'possession',
      userId,
      profileId: binding.profileId,
      oldPubkey: headPubkey,
      subject: body.newPubkey,
      // No nonce is available before a request exists, so the pre-commitment
      // itself is the replay bound: the RPC allows one pending request per
      // profile, and completion re-proves possession against a real nonce.
      nonce: '',
    }),
    body.possessionSignatureHex,
  );
  if (!possessed) {
    return jsonError('bad-signature', 403, 'the new key did not prove possession');
  }

  // The cancel token exists so the legitimate owner can stop a recovery they did
  // not start. It is minted here, hashed, and DROPPED: only the hash is stored,
  // and the raw token is never returned in this response, because the response
  // goes to whoever holds the session, which is exactly the attacker the token
  // defends against. Delivery belongs to the notification channel, and the RPC
  // refuses before this point when no channel is confirmed.
  const token = toHex((deps.randomBytes ?? platformRandomBytes)(32));
  const cancelTokenHash = await (deps.sha256Hex ?? platformSha256Hex)(token);

  const result = await deps.store.requestKeyRecovery({
    userId,
    newPubkey: body.newPubkey,
    cancelTokenHash,
  });
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({
    requestId: result.requestId,
    unlocksAt: result.unlocksAt,
    standing: result.standing,
    // Honest statement of what has to happen next, and of what this function did
    // NOT do: it did not send anything.
    cancelTokenDelivery: 'notification-channel',
  });
}

async function handleRecoveryCancel(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (!body.requestId || !UUID_RE.test(body.requestId)) {
    return jsonError('bad-payload', 400, 'cancelling needs the recovery request id');
  }

  // Path 1: the keyless token from the notice. Hashed here; the raw token never
  // reaches the database, so a database read cannot produce a valid cancel.
  if (body.cancelToken) {
    const cancelTokenHash = await (deps.sha256Hex ?? platformSha256Hex)(body.cancelToken);
    const result = await deps.store.cancelKeyRecovery({
      requestId: body.requestId,
      cancelTokenHash,
    });
    if (result.outcome !== 'ok') return outcomeError(result.outcome);
    return jsonOk({ cancelled: true, status: result.status });
  }

  // Path 2: a signature from a key that is still active on the chain. This is
  // the "I still have my other device, stop this" path.
  if (!body.nonce || !HEX64.test(body.nonce) || !body.authorizationSignatureHex) {
    return jsonError(
      'bad-payload',
      400,
      'cancelling needs either the cancel token or an active-key proof',
    );
  }
  const binding = await readBinding(deps.store, userId);
  if (typeof binding === 'string') return outcomeError(binding);

  const authorized = await verifyCustodyProof(deps, {
    purpose: 'revocation',
    userId,
    binding,
    subject: body.requestId,
    nonce: body.nonce,
    signerPubkey: binding.headPubkey,
    signatureHex: body.authorizationSignatureHex,
  });
  if (!authorized) return jsonError('bad-signature', 403, 'no active key authorized this cancel');

  const result = await deps.store.cancelKeyRecovery({
    requestId: body.requestId,
    userId,
    nonce: body.nonce,
  });
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({ cancelled: true, status: result.status });
}

async function handleRecoveryComplete(
  userId: string,
  body: CustodyBody,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (
    !body.nonce ||
    !HEX64.test(body.nonce) ||
    !body.requestId ||
    !UUID_RE.test(body.requestId) ||
    !body.newPubkey ||
    !PUBKEY_HEX.test(body.newPubkey) ||
    !body.possessionSignatureHex
  ) {
    return jsonError(
      'bad-payload',
      400,
      'completing recovery needs a nonce, the request id, the pre-committed key, and a possession proof',
    );
  }

  const binding = await readBinding(deps.store, userId);
  if (typeof binding === 'string') return outcomeError(binding);

  // Possession of the pre-committed key, re-proved at completion time against a
  // fresh nonce. The old key is NOT asked to authorize: the whole point of this
  // path is that the old key is gone.
  const possessed = await verifyCustodyProof(deps, {
    purpose: 'possession',
    userId,
    binding,
    subject: body.newPubkey,
    nonce: body.nonce,
    signerPubkey: body.newPubkey,
    signatureHex: body.possessionSignatureHex,
  });
  if (!possessed) return jsonError('bad-signature', 403, 'the new key did not prove possession');

  const result = await deps.store.completeKeyRecovery({
    userId,
    nonce: body.nonce,
    requestId: body.requestId,
    newPubkey: body.newPubkey,
    proof: {
      purpose: 'recovery',
      requestId: body.requestId,
      newPubkey: body.newPubkey,
      possessionSignatureHex: body.possessionSignatureHex,
    },
  });
  if (result.outcome !== 'ok') return outcomeError(result.outcome);
  return jsonOk({ keyId: result.keyId, pubkey: body.newPubkey, recovered: true });
}

async function handleRecoveryStatus(userId: string, deps: RegisterKeyDeps): Promise<Response> {
  const status = await deps.store.getKeyCustodyStatus(userId);
  if (status.outcome !== 'ok') return outcomeError(status.outcome);
  return jsonOk({
    profileId: status.profileId,
    headPubkey: status.headPubkey,
    keys: status.keys ?? [],
    escrow: status.escrow ?? [],
    escrowAccess: status.escrowAccess ?? [],
    // False on every current deployment. The app renders the no-kit path as
    // unavailable rather than offering a button that always refuses.
    notificationChannelConfirmed: status.notificationChannelConfirmed === true,
    recovery: status.recovery ?? null,
    recoveryFrozen: status.recoveryFrozen === true,
  });
}

/* --------------------------------- router --------------------------------- */

export async function handleRegisterKeyRequest(
  req: Request,
  deps: RegisterKeyDeps,
): Promise<Response> {
  if (req.method !== 'POST') return jsonError('bad-payload', 405, 'POST only');

  const userId = parseJwtSub(req);
  if (!userId) return jsonError('not-signed-in', 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError('bad-payload', 400);
  }

  // No action means the P1 initial-bind body. Unchanged.
  const hasAction =
    typeof raw === 'object' && raw !== null && 'action' in (raw as Record<string, unknown>);
  if (!hasAction) {
    annotateRequestLog(req, { action: 'initial_bind' });
    return handleInitialBind(userId, raw, deps);
  }

  const body = parseCustodyBody(raw);
  if (!body) return jsonError('bad-payload', 400, 'unknown action');

  // Only a parsed, whitelisted action reaches the log line.
  annotateRequestLog(req, { action: body.action });

  // Step-up gate, before any work. Revoking a key, writing an escrow row, and
  // finishing a recovery all change who can author under this byline, so a
  // long-idle session is not enough on its own.
  if (STEP_UP_ACTIONS.has(body.action)) {
    if (!hasFreshSession(req, deps.now?.() ?? Date.now())) {
      return jsonError('reauth-required', 401, 'sign in again, then retry this key action');
    }
  }

  switch (body.action) {
    case 'issue-nonce':
      return handleIssueNonce(userId, body, deps);
    case 'rotate':
      return handleRotate(userId, body, deps);
    case 'approve-device':
      return handleApproveDevice(userId, body, deps);
    case 'revoke':
      return handleRevoke(userId, body, deps);
    case 'escrow-put':
      return handleEscrowPut(userId, body, deps);
    case 'escrow-get':
      return handleEscrowGet(userId, deps);
    case 'recovery-request':
      return handleRecoveryRequest(userId, body, deps);
    case 'recovery-cancel':
      return handleRecoveryCancel(userId, body, deps);
    case 'recovery-complete':
      return handleRecoveryComplete(userId, body, deps);
    case 'recovery-status':
      return handleRecoveryStatus(userId, deps);
    default:
      return jsonError('bad-payload', 400, 'unknown action');
  }
}

declare const Deno:
  | { serve: (h: (req: Request) => Promise<Response>) => void; env: { get(k: string): string | undefined } }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const store = createPostgrestMyNewsStore(env, fetch);
  Deno.serve(
    serveEnvelope((req) => handleRegisterKeyRequest(req, { store }), {
      fn: 'mynews-register-key',
      action: 'register_key',
    }),
  );
}
