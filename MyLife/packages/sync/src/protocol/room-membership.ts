import nacl from 'tweetnacl';
import type { DeviceIdentity, WorkspaceMemberRole } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';

const encoder = new TextEncoder();

export const ROOM_ADMISSION_DOMAIN = 'meerkat-room-admission-v1';
export const ROOM_ADMISSION_MAX_TTL_MS = 60_000;
export const ROOM_ADMISSION_FUTURE_SKEW_MS = 30_000;

const MAX_ID_CHARS = 256;
const MAX_NONCE_CHARS = 256;
const MAX_TIMESTAMP_CHARS = 40;
const ED25519_PUBLIC_KEY_RE = /^[0-9a-f]{64}$/iu;
const ED25519_SIGNATURE_RE = /^[0-9a-f]{128}$/iu;
const PARTICIPANT_ID_RE = /^[0-9a-f]{32,128}$/iu;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

export type RoomPermission =
  | 'subscribe'
  | 'publish_audio'
  | 'publish_video'
  | 'publish_screen'
  | 'publish_data';

const ROOM_PERMISSIONS: readonly RoomPermission[] = [
  'subscribe',
  'publish_audio',
  'publish_video',
  'publish_screen',
  'publish_data',
];

export interface RoomAdmissionRequest {
  version: 1;
  communityId: string;
  roomId: string;
  descriptorRevision: number;
  epoch: number;
  memberDeviceId: string;
  ephemeralParticipantId: string;
  requestedPermissions: RoomPermission[];
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  signature: string;
}

export const ROOM_ADMISSION_REQUEST_FIELDS = [
  'version',
  'communityId',
  'roomId',
  'descriptorRevision',
  'epoch',
  'memberDeviceId',
  'ephemeralParticipantId',
  'requestedPermissions',
  'issuedAt',
  'expiresAt',
  'nonce',
  'signature',
] as const satisfies readonly (keyof RoomAdmissionRequest)[];

export type UnsignedRoomAdmissionRequest = Omit<RoomAdmissionRequest, 'signature'>;

export interface CreateRoomAdmissionRequestInput {
  member: DeviceIdentity;
  communityId: string;
  roomId: string;
  descriptorRevision: number;
  epoch: number;
  ephemeralParticipantId?: string;
  requestedPermissions: readonly RoomPermission[];
  issuedAt: string;
  expiresAt: string;
  nonce?: string;
}

export type RoomAdmissionCreateRejectReason =
  | 'invalid_input'
  | 'invalid_id'
  | 'invalid_revision'
  | 'invalid_epoch'
  | 'invalid_participant_id'
  | 'invalid_permissions'
  | 'invalid_timestamps'
  | 'ttl_exceeded'
  | 'invalid_nonce'
  | 'randomness_unavailable'
  | 'signing_failed';

export type CreateRoomAdmissionRequestResult =
  | { ok: true; request: RoomAdmissionRequest }
  | { ok: false; reason: RoomAdmissionCreateRejectReason };

export type RoomAdmissionRejectReason =
  | 'invalid_shape'
  | 'field_out_of_bounds'
  | 'invalid_version'
  | 'invalid_permissions'
  | 'invalid_timestamps'
  | 'issued_in_future'
  | 'expired'
  | 'ttl_exceeded'
  | 'invalid_signature'
  | 'replayed_nonce'
  | 'nonce_check_failed'
  | 'invalid_options';

export type VerifyRoomAdmissionRequestResult =
  | { ok: true; request: RoomAdmissionRequest }
  | { ok: false; reason: RoomAdmissionRejectReason };

export interface VerifyRoomAdmissionRequestOptions {
  memberPublicKey: string;
  nowMs: number;
  hasSeenNonce: (nonce: string) => boolean;
}

function sortedPermissions(permissions: readonly RoomPermission[]): RoomPermission[] {
  return [...permissions].sort();
}

/** The positional tuple is the only signed room-admission representation. */
export function canonicalRoomAdmissionRequestBytes(
  request: Readonly<UnsignedRoomAdmissionRequest>,
): Uint8Array {
  return encoder.encode(JSON.stringify([
    ROOM_ADMISSION_DOMAIN,
    request.version,
    request.communityId,
    request.roomId,
    request.descriptorRevision,
    request.epoch,
    request.memberDeviceId,
    request.ephemeralParticipantId,
    sortedPermissions(request.requestedPermissions),
    request.issuedAt,
    request.expiresAt,
    request.nonce,
  ]));
}

export function generateEphemeralParticipantId(): string {
  return bytesToHex(nacl.randomBytes(16));
}

function generateRequestNonce(): string {
  return bytesToHex(nacl.randomBytes(16));
}

function isNonEmptyBounded(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && value.trim().length > 0;
}

function isValidPermissions(value: unknown): value is RoomPermission[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > ROOM_PERMISSIONS.length) {
    return false;
  }
  const seen = new Set<RoomPermission>();
  for (const permission of value) {
    if (
      typeof permission !== 'string'
      || !ROOM_PERMISSIONS.includes(permission as RoomPermission)
      || seen.has(permission as RoomPermission)
    ) {
      return false;
    }
    seen.add(permission as RoomPermission);
  }
  return true;
}

function parseTimestamp(value: string): number | null {
  if (value.length === 0 || value.length > MAX_TIMESTAMP_CHARS || !ISO_TIMESTAMP_RE.test(value)) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function validateTimestampPair(
  issuedAt: string,
  expiresAt: string,
): 'ok' | 'invalid_timestamps' | 'ttl_exceeded' {
  const issuedAtMs = parseTimestamp(issuedAt);
  const expiresAtMs = parseTimestamp(expiresAt);
  if (issuedAtMs === null || expiresAtMs === null || issuedAtMs >= expiresAtMs) {
    return 'invalid_timestamps';
  }
  if (expiresAtMs - issuedAtMs > ROOM_ADMISSION_MAX_TTL_MS) return 'ttl_exceeded';
  return 'ok';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactRequestFields(value: Record<string, unknown>): boolean {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== ROOM_ADMISSION_REQUEST_FIELDS.length) return false;
  return ownKeys.every(
    (key) => typeof key === 'string'
      && (ROOM_ADMISSION_REQUEST_FIELDS as readonly string[]).includes(key),
  );
}

function hasRequestPrimitiveShape(value: Record<string, unknown>): boolean {
  return (
    typeof value.version === 'number'
    && typeof value.communityId === 'string'
    && typeof value.roomId === 'string'
    && typeof value.descriptorRevision === 'number'
    && typeof value.epoch === 'number'
    && typeof value.memberDeviceId === 'string'
    && typeof value.ephemeralParticipantId === 'string'
    && Array.isArray(value.requestedPermissions)
    && typeof value.issuedAt === 'string'
    && typeof value.expiresAt === 'string'
    && typeof value.nonce === 'string'
    && typeof value.signature === 'string'
  );
}

function fieldsWithinBounds(request: RoomAdmissionRequest): boolean {
  return (
    isNonEmptyBounded(request.communityId, MAX_ID_CHARS)
    && isNonEmptyBounded(request.roomId, MAX_ID_CHARS)
    && ED25519_PUBLIC_KEY_RE.test(request.memberDeviceId)
    && PARTICIPANT_ID_RE.test(request.ephemeralParticipantId)
    && isNonEmptyBounded(request.nonce, MAX_NONCE_CHARS)
    && request.issuedAt.length <= MAX_TIMESTAMP_CHARS
    && request.expiresAt.length <= MAX_TIMESTAMP_CHARS
    && ED25519_SIGNATURE_RE.test(request.signature)
    && Number.isSafeInteger(request.descriptorRevision)
    && request.descriptorRevision >= 1
    && Number.isSafeInteger(request.epoch)
    && request.epoch >= 0
  );
}

export function createRoomAdmissionRequest(
  input: CreateRoomAdmissionRequestInput,
): CreateRoomAdmissionRequestResult {
  try {
    if (!isRecord(input) || !isRecord(input.member)) {
      return { ok: false, reason: 'invalid_input' };
    }
    if (
      typeof input.member.publicKey !== 'string'
      || !ED25519_PUBLIC_KEY_RE.test(input.member.publicKey)
      || typeof input.member.privateKeyRef !== 'string'
      || !isNonEmptyBounded(input.communityId, MAX_ID_CHARS)
      || !isNonEmptyBounded(input.roomId, MAX_ID_CHARS)
    ) {
      return { ok: false, reason: 'invalid_id' };
    }
    if (!Number.isSafeInteger(input.descriptorRevision) || input.descriptorRevision < 1) {
      return { ok: false, reason: 'invalid_revision' };
    }
    if (!Number.isSafeInteger(input.epoch) || input.epoch < 0) {
      return { ok: false, reason: 'invalid_epoch' };
    }
    if (!isValidPermissions(input.requestedPermissions)) {
      return { ok: false, reason: 'invalid_permissions' };
    }

    const timestampVerdict = validateTimestampPair(input.issuedAt, input.expiresAt);
    if (timestampVerdict !== 'ok') return { ok: false, reason: timestampVerdict };

    let ephemeralParticipantId: string;
    let nonce: string;
    try {
      ephemeralParticipantId = input.ephemeralParticipantId ?? generateEphemeralParticipantId();
      nonce = input.nonce ?? generateRequestNonce();
    } catch {
      return { ok: false, reason: 'randomness_unavailable' };
    }
    if (!PARTICIPANT_ID_RE.test(ephemeralParticipantId)) {
      return { ok: false, reason: 'invalid_participant_id' };
    }
    if (!isNonEmptyBounded(nonce, MAX_NONCE_CHARS)) {
      return { ok: false, reason: 'invalid_nonce' };
    }

    const unsigned: UnsignedRoomAdmissionRequest = {
      version: 1,
      communityId: input.communityId,
      roomId: input.roomId,
      descriptorRevision: input.descriptorRevision,
      epoch: input.epoch,
      memberDeviceId: input.member.publicKey,
      ephemeralParticipantId,
      requestedPermissions: sortedPermissions(input.requestedPermissions),
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      nonce,
    };

    try {
      const canonical = canonicalRoomAdmissionRequestBytes(unsigned);
      const signatureBytes = signMessage(
        extractSigningPrivateKeyHex(input.member.privateKeyRef),
        canonical,
      );
      if (!verifySignature(input.member.publicKey, canonical, signatureBytes)) {
        return { ok: false, reason: 'signing_failed' };
      }
      return { ok: true, request: { ...unsigned, signature: bytesToHex(signatureBytes) } };
    } catch {
      return { ok: false, reason: 'signing_failed' };
    }
  } catch {
    return { ok: false, reason: 'invalid_input' };
  }
}

export function verifyRoomAdmissionRequest(
  value: unknown,
  options: VerifyRoomAdmissionRequestOptions,
): VerifyRoomAdmissionRequestResult {
  try {
    if (!isRecord(value) || !hasExactRequestFields(value) || !hasRequestPrimitiveShape(value)) {
      return { ok: false, reason: 'invalid_shape' };
    }

    const request = value as unknown as RoomAdmissionRequest;
    if (!fieldsWithinBounds(request)) return { ok: false, reason: 'field_out_of_bounds' };
    if (request.version !== 1) return { ok: false, reason: 'invalid_version' };
    if (!isValidPermissions(request.requestedPermissions)) {
      return { ok: false, reason: 'invalid_permissions' };
    }
    if (
      !options
      || typeof options.memberPublicKey !== 'string'
      || !Number.isFinite(options.nowMs)
      || typeof options.hasSeenNonce !== 'function'
    ) {
      return { ok: false, reason: 'invalid_options' };
    }

    const issuedAtMs = parseTimestamp(request.issuedAt);
    const expiresAtMs = parseTimestamp(request.expiresAt);
    if (issuedAtMs === null || expiresAtMs === null || issuedAtMs >= expiresAtMs) {
      return { ok: false, reason: 'invalid_timestamps' };
    }
    if (expiresAtMs - issuedAtMs > ROOM_ADMISSION_MAX_TTL_MS) {
      return { ok: false, reason: 'ttl_exceeded' };
    }
    if (issuedAtMs - options.nowMs > ROOM_ADMISSION_FUTURE_SKEW_MS) {
      return { ok: false, reason: 'issued_in_future' };
    }
    if (options.nowMs >= expiresAtMs) return { ok: false, reason: 'expired' };

    if (
      request.memberDeviceId !== options.memberPublicKey
      || !ED25519_PUBLIC_KEY_RE.test(options.memberPublicKey)
    ) {
      return { ok: false, reason: 'invalid_signature' };
    }

    const { signature, ...unsigned } = request;
    let signatureValid = false;
    try {
      signatureValid = verifySignature(
        options.memberPublicKey,
        canonicalRoomAdmissionRequestBytes(unsigned),
        hexToBytes(signature),
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) return { ok: false, reason: 'invalid_signature' };

    try {
      if (options.hasSeenNonce(request.nonce)) {
        return { ok: false, reason: 'replayed_nonce' };
      }
    } catch {
      return { ok: false, reason: 'nonce_check_failed' };
    }

    return { ok: true, request };
  } catch {
    return { ok: false, reason: 'invalid_shape' };
  }
}

const MEMBER_PERMISSIONS: readonly RoomPermission[] = [
  'subscribe',
  'publish_audio',
  'publish_video',
  'publish_data',
];

export function permissionsAllowedForRole(
  role: WorkspaceMemberRole | null | undefined,
): RoomPermission[] {
  switch (role) {
    case 'owner':
    case 'admin':
      return [...MEMBER_PERMISSIONS, 'publish_screen'];
    case 'member':
      return [...MEMBER_PERMISSIONS];
    case 'viewer':
      return ['subscribe'];
    default:
      return [];
  }
}

export function isPermissionSubset(
  requested: readonly RoomPermission[],
  allowed: readonly RoomPermission[],
): boolean {
  const allowedSet = new Set(allowed);
  return requested.every((permission) => allowedSet.has(permission));
}
