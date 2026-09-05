/**
 * Pure community-room token service (Plan 25 WP-25E).
 *
 * Membership, replay state, admission generations, the LiveKit signer, and time
 * are injected. The service never infers membership and never places a Meerkat
 * identity in LiveKit participant fields.
 */

import { createHmac } from 'node:crypto';
import {
  ROOM_ADMISSION_MAX_TTL_MS,
  isPermissionSubset,
  permissionsAllowedForRole,
  verifyRoomAdmissionRequest,
  type RoomAdmissionRejectReason,
  type RoomAdmissionRequest,
  type RoomPermission,
  type WorkspaceMemberRole,
} from '@mylife/sync';
import type { AdmissionGenerationStore } from './room-admission-store';

const SERVER_SECRET_HEX = /^[0-9a-f]{64}$/iu;
const MEMBER_DEVICE_ID = /^[0-9a-f]{64}$/iu;
const MAX_ROOM_SCOPE_CHARS = 256;
const DEFAULT_NONCE_CAPACITY = 50_000;

export const ROOM_TOKEN_MAX_TTL_SECONDS = ROOM_ADMISSION_MAX_TTL_MS / 1000;

export type LiveKitPublishSource =
  | 'microphone'
  | 'camera'
  | 'screen_share'
  | 'screen_share_audio';

export interface LiveKitRoomGrant {
  roomJoin: true;
  canSubscribe: boolean;
  canPublish: boolean;
  canPublishData: boolean;
  canPublishSources: readonly LiveKitPublishSource[];
}

export interface LiveKitTokenMintInput {
  /** The protocol-generated ephemeral id, never a Meerkat identity. */
  identity: string;
  /** HMAC-derived opaque room name. */
  room: string;
  ttlSeconds: number;
  grants: LiveKitRoomGrant;
}

export interface LiveKitTokenMinter {
  mint(input: LiveKitTokenMintInput): string | Promise<string>;
}

export type RoomMembershipVerification =
  | {
    ok: true;
    role: WorkspaceMemberRole;
    epoch: number;
    descriptorRevision: number;
  }
  | { ok: false; reason: 'not_member' | 'removed' | 'unavailable' };

export type RoomMembershipVerifier = (
  communityId: string,
  memberDeviceId: string,
) => RoomMembershipVerification | Promise<RoomMembershipVerification>;

export interface RoomAdmissionNonceStore {
  hasSeenNonce(nonce: string): boolean;
  /** Returns false when the nonce was already live in the store. */
  recordNonce(nonce: string, expiresAtMs: number): boolean | void;
}

export type RoomTokenRejectReason =
  | RoomAdmissionRejectReason
  | 'not_member'
  | 'removed'
  | 'unavailable'
  | 'stale_epoch'
  | 'stale_descriptor_revision'
  | 'permissions_exceed_role'
  | 'admission_store_unavailable'
  | 'token_mint_unavailable';

export interface RoomTokenSuccess {
  ok: true;
  token: string;
  roomName: string;
  expiresAt: string;
  permissions: RoomPermission[];
  generation: number;
}

export type RoomTokenResult = RoomTokenSuccess | { ok: false; reason: RoomTokenRejectReason };

export interface RevokeRoomAdmissionsResult {
  previousGeneration: number;
  generation: number;
  roomName: string;
  previousRoomName: string;
}

export interface RoomTokenServiceDependencies {
  admissionStore: AdmissionGenerationStore;
  membershipVerifier: RoomMembershipVerifier;
  hasSeenNonce: (nonce: string) => boolean;
  recordNonce: (nonce: string, expiresAtMs: number) => boolean | void;
  livekitTokenMinter: LiveKitTokenMinter;
  serverSecretHex: string;
  nowMs: () => number;
}

function assertRoomScopeId(name: string, value: string): void {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_ROOM_SCOPE_CHARS
    || value.trim().length === 0
  ) {
    throw new TypeError(`${name} must contain between 1 and ${MAX_ROOM_SCOPE_CHARS} characters`);
  }
}

function assertServerSecret(serverSecretHex: string): void {
  if (!SERVER_SECRET_HEX.test(serverSecretHex)) {
    throw new TypeError('Room-name server secret must be exactly 32 bytes of hexadecimal');
  }
}

function assertGeneration(generation: number): void {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error('Room admission generation is invalid');
  }
}

function minimalMembershipLookup(
  value: unknown,
): { communityId: string; memberDeviceId: string } | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const request = value as Record<string, unknown>;
    if (
      typeof request.communityId !== 'string'
      || request.communityId.length === 0
      || request.communityId.length > MAX_ROOM_SCOPE_CHARS
      || request.communityId.trim().length === 0
      || typeof request.memberDeviceId !== 'string'
      || !MEMBER_DEVICE_ID.test(request.memberDeviceId)
    ) {
      return null;
    }
    return {
      communityId: request.communityId,
      memberDeviceId: request.memberDeviceId,
    };
  } catch {
    return null;
  }
}

function validMembership(
  membership: RoomMembershipVerification,
): membership is Extract<RoomMembershipVerification, { ok: true }> {
  if (!membership.ok) return false;
  return permissionsAllowedForRole(membership.role).length > 0
    && Number.isSafeInteger(membership.epoch)
    && membership.epoch >= 0
    && Number.isSafeInteger(membership.descriptorRevision)
    && membership.descriptorRevision >= 1;
}

function grantsForPermissions(permissions: readonly RoomPermission[]): LiveKitRoomGrant {
  const permissionSet = new Set(permissions);
  const canPublishSources: LiveKitPublishSource[] = [];
  if (permissionSet.has('publish_audio')) canPublishSources.push('microphone');
  if (permissionSet.has('publish_video')) canPublishSources.push('camera');
  if (permissionSet.has('publish_screen')) {
    canPublishSources.push('screen_share', 'screen_share_audio');
  }
  return {
    roomJoin: true,
    canSubscribe: permissionSet.has('subscribe'),
    canPublish: canPublishSources.length > 0,
    canPublishData: permissionSet.has('publish_data'),
    canPublishSources,
  };
}

/** Stable opaque LiveKit room name for one admission generation. */
export function deriveRoomName(
  serverSecretHex: string,
  communityId: string,
  roomId: string,
  generation: number,
): string {
  assertServerSecret(serverSecretHex);
  assertRoomScopeId('communityId', communityId);
  assertRoomScopeId('roomId', roomId);
  assertGeneration(generation);
  return createHmac('sha256', Buffer.from(serverSecretHex, 'hex'))
    .update(`meerkat-room-name-v1:${communityId}:${roomId}:${generation}`, 'utf8')
    .digest('hex');
}

/**
 * Bounded replay cache. It never evicts an unexpired nonce: reaching the cap
 * fails closed so memory pressure cannot reopen a valid request's replay window.
 */
export class InMemoryRoomAdmissionNonceStore implements RoomAdmissionNonceStore {
  private readonly expiresByNonce = new Map<string, number>();

  constructor(
    private readonly nowMs: () => number = () => Date.now(),
    private readonly capacity: number = DEFAULT_NONCE_CAPACITY,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1_000_000) {
      throw new TypeError('Room admission nonce capacity is invalid');
    }
  }

  hasSeenNonce(nonce: string): boolean {
    const now = this.nowMs();
    const expiresAt = this.expiresByNonce.get(nonce);
    if (expiresAt === undefined) return false;
    if (expiresAt <= now) {
      this.expiresByNonce.delete(nonce);
      return false;
    }
    return true;
  }

  recordNonce(nonce: string, expiresAtMs: number): boolean {
    const now = this.nowMs();
    if (
      typeof nonce !== 'string'
      || nonce.length === 0
      || nonce.length > 256
      || !Number.isFinite(expiresAtMs)
      || expiresAtMs <= now
    ) {
      throw new TypeError('Room admission nonce record is invalid');
    }
    if (this.hasSeenNonce(nonce)) return false;
    for (const [candidate, expiry] of this.expiresByNonce) {
      if (expiry <= now) this.expiresByNonce.delete(candidate);
    }
    if (this.expiresByNonce.size >= this.capacity) {
      throw new Error('Room admission nonce capacity is exhausted');
    }
    this.expiresByNonce.set(nonce, expiresAtMs);
    return true;
  }

  trackedNonceCount(): number {
    return this.expiresByNonce.size;
  }
}

export class RoomTokenService {
  constructor(private readonly dependencies: RoomTokenServiceDependencies) {
    assertServerSecret(dependencies.serverSecretHex);
  }

  async requestRoomToken(rawRequest: unknown): Promise<RoomTokenResult> {
    const lookup = minimalMembershipLookup(rawRequest);
    if (!lookup) return { ok: false, reason: 'invalid_shape' };

    let membership: RoomMembershipVerification;
    try {
      membership = await this.dependencies.membershipVerifier(
        lookup.communityId,
        lookup.memberDeviceId,
      );
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    if (!membership.ok) return { ok: false, reason: membership.reason };
    if (!validMembership(membership)) return { ok: false, reason: 'unavailable' };

    const nowMs = this.dependencies.nowMs();
    const verified = verifyRoomAdmissionRequest(rawRequest, {
      memberPublicKey: lookup.memberDeviceId,
      nowMs,
      hasSeenNonce: this.dependencies.hasSeenNonce,
    });
    if (!verified.ok) return verified;

    const request = verified.request;
    const requestExpiresAtMs = Date.parse(request.expiresAt);
    try {
      if (this.dependencies.recordNonce(request.nonce, requestExpiresAtMs) === false) {
        return { ok: false, reason: 'replayed_nonce' };
      }
    } catch {
      return { ok: false, reason: 'nonce_check_failed' };
    }

    if (request.epoch < membership.epoch) return { ok: false, reason: 'stale_epoch' };
    if (request.descriptorRevision < membership.descriptorRevision) {
      return { ok: false, reason: 'stale_descriptor_revision' };
    }

    const allowed = permissionsAllowedForRole(membership.role);
    if (!isPermissionSubset(request.requestedPermissions, allowed)) {
      return { ok: false, reason: 'permissions_exceed_role' };
    }

    let generation: number;
    try {
      generation = await this.dependencies.admissionStore.getGeneration(
        request.communityId,
        request.roomId,
      );
      assertGeneration(generation);
    } catch {
      return { ok: false, reason: 'admission_store_unavailable' };
    }

    const roomName = deriveRoomName(
      this.dependencies.serverSecretHex,
      request.communityId,
      request.roomId,
      generation,
    );
    const remainingMs = requestExpiresAtMs - nowMs;
    const ttlSeconds = Math.min(
      ROOM_TOKEN_MAX_TTL_SECONDS,
      Math.max(1, Math.ceil(remainingMs / 1000)),
    );
    const permissions = [...request.requestedPermissions];
    let token: string;
    try {
      token = await this.dependencies.livekitTokenMinter.mint({
        identity: request.ephemeralParticipantId,
        room: roomName,
        ttlSeconds,
        grants: grantsForPermissions(permissions),
      });
      if (typeof token !== 'string' || token.length === 0) {
        return { ok: false, reason: 'token_mint_unavailable' };
      }
    } catch {
      return { ok: false, reason: 'token_mint_unavailable' };
    }

    return {
      ok: true,
      token,
      roomName,
      expiresAt: new Date(nowMs + ttlSeconds * 1000).toISOString(),
      permissions,
      generation,
    };
  }

  async revokeRoomAdmissions(
    communityId: string,
    roomId: string,
  ): Promise<RevokeRoomAdmissionsResult> {
    assertRoomScopeId('communityId', communityId);
    assertRoomScopeId('roomId', roomId);
    const bump = await this.dependencies.admissionStore.bumpGeneration(communityId, roomId);
    assertGeneration(bump.previousGeneration);
    assertGeneration(bump.generation);
    if (bump.generation !== bump.previousGeneration + 1) {
      throw new Error('Room admission generation bump is not contiguous');
    }
    return {
      previousGeneration: bump.previousGeneration,
      generation: bump.generation,
      previousRoomName: deriveRoomName(
        this.dependencies.serverSecretHex,
        communityId,
        roomId,
        bump.previousGeneration,
      ),
      roomName: deriveRoomName(
        this.dependencies.serverSecretHex,
        communityId,
        roomId,
        bump.generation,
      ),
    };
  }
}

export type { RoomAdmissionRequest };
