/**
 * Room admission protocol (Plan 25 WP-25C) unit tests. Proves:
 *  - real device signatures bind every admission field;
 *  - roles grant only their allowed room permissions;
 *  - shape, time, replay, and privacy checks fail closed;
 *  - malformed and fuzzed requests never escape verification.
 */

import { describe, it, expect } from 'vitest';
import {
  ROOM_ADMISSION_FUTURE_SKEW_MS,
  ROOM_ADMISSION_MAX_TTL_MS,
  ROOM_ADMISSION_REQUEST_FIELDS,
  createRoomAdmissionRequest,
  generateEphemeralParticipantId,
  isPermissionSubset,
  permissionsAllowedForRole,
  verifyRoomAdmissionRequest,
  type CreateRoomAdmissionRequestInput,
  type RoomAdmissionRequest,
  type RoomPermission,
  type VerifyRoomAdmissionRequestOptions,
} from '../room-membership';
import { generateDeviceIdentity } from '../../identity/device-identity';
import type { DeviceIdentity, WorkspaceMemberRole } from '../../types';

const NOW_MS = Date.parse('2026-07-12T12:00:05.000Z');
const ISSUED_AT = '2026-07-12T12:00:00.000Z';
const EXPIRES_AT = '2026-07-12T12:00:50.000Z';
const OVERLONG_ID = 'x'.repeat(257);
const MEMBER_PERMISSIONS: RoomPermission[] = [
  'subscribe',
  'publish_audio',
  'publish_video',
  'publish_data',
];
const ADMIN_PERMISSIONS: RoomPermission[] = [...MEMBER_PERMISSIONS, 'publish_screen'];

function makeCreateInput(
  member: DeviceIdentity,
  overrides: Partial<Omit<CreateRoomAdmissionRequestInput, 'member'>> = {},
): CreateRoomAdmissionRequestInput {
  return {
    member,
    communityId: 'community-25c',
    roomId: 'room-25c',
    descriptorRevision: 7,
    epoch: 3,
    requestedPermissions: ['publish_data', 'subscribe', 'publish_audio'],
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    ...overrides,
  };
}

function createValidAdmission(
  overrides: Partial<Omit<CreateRoomAdmissionRequestInput, 'member'>> = {},
  member = generateDeviceIdentity('Room member'),
): { member: DeviceIdentity; request: RoomAdmissionRequest } {
  const result = createRoomAdmissionRequest(makeCreateInput(member, overrides));
  if (!result.ok) throw new Error(`Expected valid admission, received ${result.reason}`);
  return { member, request: result.request };
}

function makeVerifyOptions(member: DeviceIdentity): VerifyRoomAdmissionRequestOptions {
  return {
    memberPublicKey: member.publicKey,
    nowMs: NOW_MS,
    hasSeenNonce: () => false,
  };
}

interface TamperCase {
  field: string;
  mutate: (
    request: RoomAdmissionRequest,
    replacementDeviceId: string,
  ) => RoomAdmissionRequest;
}

const TAMPER_CASES: TamperCase[] = [
  {
    field: 'communityId',
    mutate: (request) => ({ ...request, communityId: `${request.communityId}-tampered` }),
  },
  {
    field: 'roomId',
    mutate: (request) => ({ ...request, roomId: `${request.roomId}-tampered` }),
  },
  {
    field: 'descriptorRevision',
    mutate: (request) => ({
      ...request,
      descriptorRevision: request.descriptorRevision + 1,
    }),
  },
  {
    field: 'epoch',
    mutate: (request) => ({ ...request, epoch: request.epoch + 1 }),
  },
  {
    field: 'memberDeviceId',
    mutate: (request, replacementDeviceId) => ({ ...request, memberDeviceId: replacementDeviceId }),
  },
  {
    field: 'ephemeralParticipantId',
    mutate: (request) => ({
      ...request,
      ephemeralParticipantId: `${request.ephemeralParticipantId[0] === 'a' ? 'b' : 'a'}${request.ephemeralParticipantId.slice(1)}`,
    }),
  },
  {
    field: 'requestedPermissions',
    mutate: (request) => ({ ...request, requestedPermissions: ['subscribe'] }),
  },
  {
    field: 'issuedAt',
    mutate: (request) => ({
      ...request,
      issuedAt: new Date(Date.parse(request.issuedAt) + 1_000).toISOString(),
    }),
  },
  {
    field: 'expiresAt',
    mutate: (request) => ({
      ...request,
      expiresAt: new Date(Date.parse(request.expiresAt) - 1_000).toISOString(),
    }),
  },
  {
    field: 'nonce',
    mutate: (request) => ({ ...request, nonce: `${request.nonce}00` }),
  },
];

const ROLE_CASES: Array<{
  role: WorkspaceMemberRole;
  expected: RoomPermission[];
}> = [
  { role: 'owner', expected: ADMIN_PERMISSIONS },
  { role: 'admin', expected: ADMIN_PERMISSIONS },
  { role: 'member', expected: MEMBER_PERMISSIONS },
  { role: 'viewer', expected: ['subscribe'] },
];

const INVALID_PERMISSION_CASES: Array<{
  label: string;
  permissions: unknown[];
}> = [
  { label: 'empty', permissions: [] },
  { label: 'duplicate', permissions: ['subscribe', 'subscribe'] },
  { label: 'unknown', permissions: ['subscribe', 'publish_unknown'] },
];

describe('room admission creation and verification', () => {
  it('round-trips a request signed by a real device identity', () => {
    const { member, request } = createValidAdmission();

    expect(request.memberDeviceId).toBe(member.publicKey);
    expect(verifyRoomAdmissionRequest(request, makeVerifyOptions(member))).toEqual({
      ok: true,
      request,
    });
  });
});

describe('room permissions', () => {
  it.each(ROLE_CASES)('grants the exact permission set for $role', ({ role, expected }) => {
    expect(permissionsAllowedForRole(role)).toEqual(expected);
  });

  it('grants no permissions for null, undefined, or an unknown role', () => {
    const invalidRoles = [null, undefined, 'moderator'] as const;

    for (const role of invalidRoles) {
      expect(
        permissionsAllowedForRole(role as WorkspaceMemberRole | null | undefined),
      ).toEqual([]);
    }
  });

  it('recognizes both permission subsets and non-subsets', () => {
    expect(isPermissionSubset(['subscribe', 'publish_audio'], MEMBER_PERMISSIONS)).toBe(true);
    expect(isPermissionSubset(['publish_screen'], MEMBER_PERMISSIONS)).toBe(false);
  });
});

describe('signed field integrity', () => {
  it.each(TAMPER_CASES)(
    'rejects tampering with signed $field as invalid_signature',
    ({ mutate }) => {
      const { member, request } = createValidAdmission();
      const replacement = generateDeviceIdentity('Replacement signer');
      const tampered = mutate(request, replacement.publicKey);

      expect(verifyRoomAdmissionRequest(tampered, makeVerifyOptions(member))).toEqual({
        ok: false,
        reason: 'invalid_signature',
      });
    },
  );

  it('rejects verification with a different signer public key', () => {
    const { request } = createValidAdmission();
    const wrongSigner = generateDeviceIdentity('Wrong signer');

    expect(verifyRoomAdmissionRequest(request, makeVerifyOptions(wrongSigner))).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });
});

describe('time and replay enforcement', () => {
  it('rejects a request at its exact expiry time', () => {
    const { member, request } = createValidAdmission({
      issuedAt: new Date(NOW_MS - ROOM_ADMISSION_MAX_TTL_MS).toISOString(),
      expiresAt: new Date(NOW_MS).toISOString(),
    });

    expect(verifyRoomAdmissionRequest(request, makeVerifyOptions(member))).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects a request issued beyond the future clock-skew allowance', () => {
    const futureIssuedAtMs = NOW_MS + ROOM_ADMISSION_FUTURE_SKEW_MS + 1;
    const { member, request } = createValidAdmission({
      issuedAt: new Date(futureIssuedAtMs).toISOString(),
      expiresAt: new Date(futureIssuedAtMs + 10_000).toISOString(),
    });

    expect(verifyRoomAdmissionRequest(request, makeVerifyOptions(member))).toEqual({
      ok: false,
      reason: 'issued_in_future',
    });
  });

  it('rejects a TTL above the cap during creation', () => {
    const member = generateDeviceIdentity('Room member');
    const issuedAtMs = Date.parse(ISSUED_AT);
    const result = createRoomAdmissionRequest(makeCreateInput(member, {
      expiresAt: new Date(issuedAtMs + ROOM_ADMISSION_MAX_TTL_MS + 1).toISOString(),
    }));

    expect(result).toEqual({ ok: false, reason: 'ttl_exceeded' });
  });

  it('rejects a hand-crafted TTL above the cap during verification', () => {
    const { member, request } = createValidAdmission();
    const oversizedTtlRequest = {
      ...request,
      expiresAt: new Date(
        Date.parse(request.issuedAt) + ROOM_ADMISSION_MAX_TTL_MS + 1,
      ).toISOString(),
    };

    expect(
      verifyRoomAdmissionRequest(oversizedTtlRequest, makeVerifyOptions(member)),
    ).toEqual({ ok: false, reason: 'ttl_exceeded' });
  });

  it('rejects a nonce already observed by the verifier', () => {
    const { member, request } = createValidAdmission();
    const options = {
      ...makeVerifyOptions(member),
      hasSeenNonce: () => true,
    };

    expect(verifyRoomAdmissionRequest(request, options)).toEqual({
      ok: false,
      reason: 'replayed_nonce',
    });
  });
});

describe('permission validation', () => {
  it.each(INVALID_PERMISSION_CASES)(
    'rejects $label permissions during creation',
    ({ permissions }) => {
      const member = generateDeviceIdentity('Room member');
      const result = createRoomAdmissionRequest(makeCreateInput(member, {
        requestedPermissions: permissions as RoomPermission[],
      }));

      expect(result).toEqual({ ok: false, reason: 'invalid_permissions' });
    },
  );

  it.each(INVALID_PERMISSION_CASES)(
    'rejects hand-crafted $label permissions during verification',
    ({ permissions }) => {
      const { member, request } = createValidAdmission();
      const handCrafted = { ...request, requestedPermissions: permissions };

      expect(verifyRoomAdmissionRequest(handCrafted, makeVerifyOptions(member))).toEqual({
        ok: false,
        reason: 'invalid_permissions',
      });
    },
  );
});

describe('shape and privacy boundaries', () => {
  it('rejects an extra displayName key through the strict field allowlist', () => {
    const { member, request } = createValidAdmission();
    const smuggled = { ...request, displayName: 'Leaked persona' };

    expect(verifyRoomAdmissionRequest(smuggled, makeVerifyOptions(member))).toEqual({
      ok: false,
      reason: 'invalid_shape',
    });
  });

  it.each([
    { field: 'communityId' as const },
    { field: 'roomId' as const },
  ])('rejects an overlong $field as field_out_of_bounds', ({ field }) => {
    const { member, request } = createValidAdmission();
    const overlong = { ...request, [field]: OVERLONG_ID };

    expect(verifyRoomAdmissionRequest(overlong, makeVerifyOptions(member))).toEqual({
      ok: false,
      reason: 'field_out_of_bounds',
    });
  });

  it('generates distinct participant ids with at least 128 bits of hex', () => {
    const first = generateEphemeralParticipantId();
    const second = generateEphemeralParticipantId();

    expect(first).toMatch(/^[0-9a-f]{32,}$/);
    expect(second).toMatch(/^[0-9a-f]{32,}$/);
    expect(second).not.toBe(first);
  });

  it('keeps display names, personas, and titles outside the request allowlist', () => {
    for (const field of ROOM_ADMISSION_REQUEST_FIELDS) {
      expect(field).not.toMatch(/display.?name|persona|title/iu);
    }
  });

  it('fails closed without throwing for 50 garbage request values', () => {
    const { member, request } = createValidAdmission();
    const options = makeVerifyOptions(member);
    const garbageInputs = Array.from({ length: 50 }, (_, index): unknown => {
      switch (index % 10) {
        case 0:
          return null;
        case 1:
          return undefined;
        case 2:
          return Math.random();
        case 3:
          return `garbage-${Math.random()}`;
        case 4:
          return [];
        case 5:
          return [index, { nested: true }];
        case 6:
          return {};
        case 7:
          return { communityId: `missing-fields-${index}` };
        case 8:
          return { ...request, version: '1' };
        default:
          return { nested: { junk: [index, Math.random()] } };
      }
    });

    expect(garbageInputs).toHaveLength(50);
    for (const input of garbageInputs) {
      let result: ReturnType<typeof verifyRoomAdmissionRequest> | undefined;
      expect(() => {
        result = verifyRoomAdmissionRequest(input, options);
      }).not.toThrow();
      expect(result?.ok).toBe(false);
    }
  });
});
