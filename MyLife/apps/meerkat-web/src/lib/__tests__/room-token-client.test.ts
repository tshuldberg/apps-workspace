import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '@mylife/sync';
import { requestRoomToken } from '../room-token-client';

const member = generateDeviceIdentity('Room member');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const base = {
  member,
  communityId: 'cm_test',
  roomId: 'channel_1',
  descriptorRevision: 3,
  epoch: 2,
  requestedPermissions: ['subscribe', 'publish_audio'] as const,
  baseUrl: 'https://community.example/',
  nowMs: 1_000_000,
};

describe('room token client', () => {
  it('posts a signed admission request and returns the minted grant', async () => {
    let sentUrl = '';
    let sentBody: any = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sentUrl = url;
      sentBody = JSON.parse(String(init.body));
      return jsonResponse(200, {
        token: 'jwt.abc.def',
        roomName: 'a'.repeat(64),
        expiresAt: new Date(base.nowMs + 60_000).toISOString(),
        permissions: ['subscribe', 'publish_audio'],
      });
    }) as unknown as typeof fetch;

    const result = await requestRoomToken({ ...base, requestedPermissions: [...base.requestedPermissions], fetchImpl });
    expect(result.ok).toBe(true);
    // The single slash is normalized (no double slash), route is the token mount.
    expect(sentUrl).toBe('https://community.example/api/rooms/token');
    // The body is a real signed admission request carrying the ephemeral id, not a device id.
    expect(sentBody.signature).toBeTruthy();
    expect(sentBody.memberDeviceId).toBe(member.publicKey);
    expect(sentBody.ephemeralParticipantId).not.toBe(member.publicKey);
    if (result.ok) {
      expect(result.grant.token).toBe('jwt.abc.def');
      expect(result.grant.ephemeralParticipantId).toBe(sentBody.ephemeralParticipantId);
    }
  });

  it('maps server rejection reasons to typed client errors', async () => {
    const cases: Array<[string, string]> = [
      ['not_member', 'not_member'],
      ['removed', 'removed'],
      ['permissions_exceed_role', 'permissions_exceed_role'],
      ['stale_epoch', 'stale_view'],
      ['stale_descriptor_revision', 'stale_view'],
      ['token_mint_unavailable', 'unavailable'],
      ['not_configured', 'not_configured'],
      ['something_new', 'rejected'],
    ];
    for (const [reason, expected] of cases) {
      const fetchImpl = (async () => jsonResponse(reason === 'not_configured' ? 503 : 403, { reason })) as unknown as typeof fetch;
      const r = await requestRoomToken({ ...base, requestedPermissions: [...base.requestedPermissions], fetchImpl });
      expect(r).toEqual({ ok: false, error: expected });
    }
  });

  it('never returns a token on a malformed 200 body', async () => {
    const fetchImpl = (async () => jsonResponse(200, { token: '', roomName: 'x' })) as unknown as typeof fetch;
    const r = await requestRoomToken({ ...base, requestedPermissions: [...base.requestedPermissions], fetchImpl });
    expect(r).toEqual({ ok: false, error: 'malformed_response' });
  });

  it('reports a network error when the fetch throws', async () => {
    const fetchImpl = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const r = await requestRoomToken({ ...base, requestedPermissions: [...base.requestedPermissions], fetchImpl });
    expect(r).toEqual({ ok: false, error: 'network_error' });
  });
});
