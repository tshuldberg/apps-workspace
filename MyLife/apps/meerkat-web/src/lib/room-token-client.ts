// Plan 25 WP-25I: the client half of room admission. Pure over an injected fetch seam.
//
// Builds a signed RoomAdmissionRequest (WP-25C, @mylife/sync) and POSTs it to the
// community node's /api/rooms/token mount (WP-25E). It never fabricates a token: a
// non-2xx or malformed response is an honest typed failure, and the caller only connects
// to LiveKit with a token the server actually minted.

import {
  createRoomAdmissionRequest,
  generateEphemeralParticipantId,
  type DeviceIdentity,
  type RoomPermission,
} from '@mylife/sync';

export interface RoomTokenGrant {
  token: string;
  roomName: string;
  expiresAt: string;
  permissions: RoomPermission[];
  ephemeralParticipantId: string;
}

export type RoomTokenError =
  | 'invalid_request'
  | 'not_configured'
  | 'not_member'
  | 'removed'
  | 'permissions_exceed_role'
  | 'stale_view'
  | 'unavailable'
  | 'rejected'
  | 'malformed_response'
  | 'network_error';

export type RoomTokenResult =
  | { ok: true; grant: RoomTokenGrant }
  | { ok: false; error: RoomTokenError };

export interface RequestRoomTokenInput {
  member: DeviceIdentity;
  communityId: string;
  roomId: string;
  descriptorRevision: number;
  epoch: number;
  requestedPermissions: RoomPermission[];
  /** The community node base URL, e.g. https://community.example. No trailing slash needed. */
  baseUrl: string;
  /** Injected so tests never touch the network; production passes global fetch. */
  fetchImpl: typeof fetch;
  nowMs?: number;
  ttlMs?: number;
}

/** Map the server's typed reason to a client error; default to a safe 'rejected'. */
function mapServerReason(reason: unknown): RoomTokenError {
  switch (reason) {
    case 'not_configured':
      return 'not_configured';
    case 'not_member':
      return 'not_member';
    case 'removed':
      return 'removed';
    case 'permissions_exceed_role':
      return 'permissions_exceed_role';
    case 'stale_epoch':
    case 'stale_descriptor_revision':
      return 'stale_view';
    case 'unavailable':
    case 'admission_store_unavailable':
    case 'token_mint_unavailable':
      return 'unavailable';
    default:
      return 'rejected';
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export async function requestRoomToken(input: RequestRoomTokenInput): Promise<RoomTokenResult> {
  const nowMs = input.nowMs ?? Date.now();
  const ttlMs = Math.min(input.ttlMs ?? 60_000, 60_000);
  const ephemeralParticipantId = generateEphemeralParticipantId();

  const built = createRoomAdmissionRequest({
    member: input.member,
    communityId: input.communityId,
    roomId: input.roomId,
    descriptorRevision: input.descriptorRevision,
    epoch: input.epoch,
    ephemeralParticipantId,
    requestedPermissions: input.requestedPermissions,
    issuedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + ttlMs).toISOString(),
  });
  if (!built.ok) return { ok: false, error: 'invalid_request' };

  const url = `${input.baseUrl.replace(/\/+$/, '')}/api/rooms/token`;
  let res: Response;
  try {
    res = await input.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(built.request),
    });
  } catch {
    return { ok: false, error: 'network_error' };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const reason = body && typeof body === 'object' ? (body as { reason?: unknown }).reason : undefined;
    return { ok: false, error: mapServerReason(reason) };
  }

  if (
    !body
    || typeof body !== 'object'
    || !isNonEmptyString((body as { token?: unknown }).token)
    || !isNonEmptyString((body as { roomName?: unknown }).roomName)
    || !isNonEmptyString((body as { expiresAt?: unknown }).expiresAt)
    || !Array.isArray((body as { permissions?: unknown }).permissions)
  ) {
    return { ok: false, error: 'malformed_response' };
  }

  const ok = body as { token: string; roomName: string; expiresAt: string; permissions: RoomPermission[] };
  return {
    ok: true,
    grant: {
      token: ok.token,
      roomName: ok.roomName,
      expiresAt: ok.expiresAt,
      permissions: ok.permissions,
      ephemeralParticipantId,
    },
  };
}
