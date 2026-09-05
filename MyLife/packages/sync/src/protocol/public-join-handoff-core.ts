/**
 * Owner-side PUBLIC-JOIN approve mechanism (Plan 19 FF3 close-out, ENGINE half).
 *
 * A request-policy public community BROADCASTS its join grant (unlike an
 * individually issued invite), so the owner-side path must NEVER auto-approve on
 * drain. The mailbox dispatcher only RECORDS a verified public-join request into
 * the app's review queue (the `publicJoinRequest` handler). The epoch key is handed
 * off ONLY when the owner makes an explicit APPROVE decision, which calls the
 * function below (a separate app review-queue UI is the caller).
 *
 * approvePublicJoinRequest reuses the EXACT invite-path grant rail
 * (grantMembershipAndParkKey -> commitMemberAdd -> wrap-to-DH -> park a JOIN_GRANT):
 * it adds NO new key mechanism. It differs from the invite path ONLY in its
 * authorization gate. Instead of re-verifying a SignedCommunityInvite, it binds the
 * request to:
 *   a. the owner's OWN current stored community descriptor (communityRole 'owner'),
 *      never a request-supplied one; and
 *   b. the owner's OWN current publication descriptor (the app passes it in; the
 *      engine never reads app tables). Because it is the owner's OWN store row, the
 *      check is revision-AGNOSTIC (verifyPublicationOwnerSignature: verify the owner
 *      signature over the current descriptor at ANY revision, mirroring
 *      verifyOwnerTakedown -- NOT the genesis-only verifyPublication). The descriptor
 *      must be owner-signed, name THIS owner + THIS community + the request's
 *      publication, still be ACTIVE, and its CURRENT publicJoin.grantId must equal the
 *      request's grantId, so a rotated/revoked grant is rejected fail-closed (a revoked
 *      grant can never be approved, and approve survives owner revisions).
 * The joiner's DH key used for the epoch-key wrap comes SOLELY from the verified
 * identity bundle inside the request, never an unverified field.
 *
 * Fail-closed: returns a discriminated result and NEVER throws. No member row is
 * written and no grant is parked unless every gate passes.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import { communityRole, getCommunity, type SignedCommunityDescriptor } from './community';
import { verifyPublicationOwnerSignature, type SignedPublicationDescriptor } from './publication';
import { verifySignedIdentityBundle } from './identity-bundle';
import type { RecordKeyWrapChange } from './group-keys';
import { grantMembershipAndParkKey, type ProcessJoinRequestDeps } from './join-handoff-core';
import type { PublicJoinRequestPayload } from './public-join';
import type { MailboxEnvelope } from './mailbox';

export interface ApprovePublicJoinRequestDeps {
  db: DatabaseAdapter;
  /** This device's identity (the would-be publication + community owner). */
  owner: DeviceIdentity;
  /**
   * Park an already-sealed JOIN_GRANT envelope on a mailbox token (relay store-and-
   * forward). Injected so this file stays testable. A grant is parked ONLY when this
   * returns true; the approve succeeds only when the grant really parked.
   */
  parkEnvelope: (token: string, envelope: MailboxEnvelope) => boolean | Promise<boolean>;
  /**
   * Replication seam: pass `engine.recordChange` so the new-epoch wraps minted by
   * commitMemberAdd replicate to ALREADY-paired members over the engine. Omit for
   * local-only / unit use.
   */
  recordChange?: RecordKeyWrapChange;
  /** Clock for the sealed grant timestamp + revision (test injection). */
  now?: () => string;
  /** The envelope sender device id from the verified request (openPublicJoinRequest). */
  senderDeviceId: string;
  /** The verified joiner-signed public-join request payload (openPublicJoinRequest). */
  payload: PublicJoinRequestPayload;
  /**
   * The owner's OWN current signed publication descriptor. The app reads it from
   * cm_publications and passes it in; the engine never touches app tables. It is
   * re-verified owner-signed here, and the request's grantId must equal its current
   * publicJoin.grantId.
   */
  publication: SignedPublicationDescriptor;
}

export type ApprovePublicJoinResult =
  | { ok: true; communityId: string }
  | {
      ok: false;
      reason:
        | 'not_owner'
        | 'publication_invalid'
        | 'community_mismatch'
        | 'grant_stale'
        | 'bundle_invalid'
        | 'not_parked';
    };

/**
 * Approve a recorded public-join request: add the joiner to the community + hand off
 * the epoch key through the shared owner-gated wrap rail. Explicit owner action only
 * (the dispatcher never calls this). Fail-closed; never throws.
 */
export async function approvePublicJoinRequest(
  deps: ApprovePublicJoinRequestDeps,
): Promise<ApprovePublicJoinResult> {
  const { db, owner, senderDeviceId, payload, publication } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());
  const communityId = payload.communityId;

  // a. The caller must OWN this community, bound to the owner's OWN stored
  //    descriptor (never a request-supplied one).
  const stored = getCommunity(db, communityId);
  if (!stored) return { ok: false, reason: 'not_owner' };
  if (communityRole(stored.descriptor, owner.publicKey) !== 'owner') {
    return { ok: false, reason: 'not_owner' };
  }
  const prevSigned: SignedCommunityDescriptor = {
    descriptor: stored.descriptor,
    signature: stored.signature,
  };

  // b. The owner's OWN current publication descriptor is the trust anchor. Because it
  //    comes from the owner's OWN store (the app passes the current cm_publications
  //    row), the check is revision-AGNOSTIC: verify the owner Ed25519 signature over
  //    the current descriptor (any revision), NOT the revision chain / genesis id.
  //    verifyPublication is genesis-only (revision >= 2 -> 'invalid'), which would
  //    break approve the moment the owner revises (rotate grant, edit hosts, add
  //    rights) AND would leak the ORIGINAL grantId past the staleness check if the app
  //    dodged by passing the genesis. verifyPublicationOwnerSignature mirrors
  //    verifyOwnerTakedown: owner-signature is the sole anchor here.
  if (!verifyPublicationOwnerSignature(publication)) return { ok: false, reason: 'publication_invalid' };
  const pd = publication.descriptor;
  //    The descriptor must be MY OWN publication, still ACTIVE (an unpublished/killed
  //    publication cannot approve joins -- verifyPublication gave that for free before,
  //    so preserve it explicitly), and name the request's publication + community.
  if (pd.ownerDeviceId !== owner.publicKey) return { ok: false, reason: 'publication_invalid' };
  if (pd.status !== 'active') return { ok: false, reason: 'publication_invalid' };
  if (pd.publicationId !== payload.publicationId) return { ok: false, reason: 'publication_invalid' };
  if (pd.communityId !== communityId) return { ok: false, reason: 'community_mismatch' };
  //    Its CURRENT grantId must equal the request's grantId. Against the CURRENT
  //    (possibly revised) descriptor this genuinely enforces revocation: rotating the
  //    grant via revisePublication moves grantId, so a request bearing the OLD grantId
  //    is rejected fail-closed and can never be approved.
  const grant = pd.publicJoin;
  if (!grant || grant.grantId !== payload.grantId) return { ok: false, reason: 'grant_stale' };

  // c. Re-verify the joiner's signed identity bundle and bind its DH key to the
  //    request sender (defense-in-depth: the app persisted this request, so re-verify
  //    before minting a key). The DH key used for the wrap comes ONLY from the
  //    verified bundle. grantMembershipAndParkKey re-runs the same TOFU/verify, but a
  //    precise reason is surfaced here for the app.
  const bundle = payload.bundle;
  if (!verifySignedIdentityBundle(bundle)) return { ok: false, reason: 'bundle_invalid' };
  if (bundle.bundle.deviceId !== senderDeviceId) return { ok: false, reason: 'bundle_invalid' };

  // d. Add the member + park the epoch-key JOIN_GRANT through the SHARED invite-path
  //    rail (commitMemberAdd -> wrap to the joiner DH key -> park). No key is
  //    serialized anywhere else; nothing is written unless the grant really parks.
  const membershipDeps: ProcessJoinRequestDeps = {
    db,
    owner,
    parkEnvelope: deps.parkEnvelope,
    recordChange: deps.recordChange,
    now: deps.now,
  };
  const parked = await grantMembershipAndParkKey(
    membershipDeps,
    prevSigned,
    communityId,
    senderDeviceId,
    bundle,
    nowFn,
  );
  return parked ? { ok: true, communityId } : { ok: false, reason: 'not_parked' };
}
