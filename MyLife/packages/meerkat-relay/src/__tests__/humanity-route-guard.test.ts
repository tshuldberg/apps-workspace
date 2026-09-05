/**
 * Plan 39 P7 (Plan 24 P3 completion): the reusable humanity route guard the
 * persona-session issuance endpoint (Track A) consumes. Fail-closed on every
 * branch; a session (or any gated shared-network action) can never be minted
 * without a verified, single-use redeem.
 */

import { describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  serializeHumanityToken,
  type HumanityRedeemOutcome,
} from '@mylife/sync';
import { createHumanityRouteGuard } from '../humanity-route-guard';

const service = humanityServiceKeypairFromSeed('cc'.repeat(32));
const otherService = humanityServiceKeypairFromSeed('dd'.repeat(32));

function mintToken(keys = service): string {
  const [token] = issueHumanityTokenBatch({
    servicePrivateKeyHex: keys.privateKeyHex,
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
    count: 1,
  });
  return serializeHumanityToken(token!);
}

function fakeRedeem(): { redeem: (t: string) => Promise<HumanityRedeemOutcome>; spent: Set<string> } {
  const spent = new Set<string>();
  return {
    spent,
    redeem: async (bearer: string) => {
      if (spent.has(bearer)) return { ok: false, reason: 'already_spent' };
      spent.add(bearer);
      return { ok: true };
    },
  };
}

interface Captured { status: number; body: Record<string, unknown> }

function fakeRes(): { res: http.ServerResponse; captured: () => Captured | null } {
  let captured: Captured | null = null;
  const res = {
    writeHead(status: number) { captured = { status, body: {} }; return res; },
    end(payload?: string) {
      if (captured && payload) {
        try { captured.body = JSON.parse(payload) as Record<string, unknown>; } catch { /* raw */ }
      }
    },
  } as unknown as http.ServerResponse;
  return { res, captured: () => captured };
}

function fakeReq(token?: string, header = 'x-mk-humanity'): http.IncomingMessage {
  return { headers: token === undefined ? {} : { [header]: token } } as unknown as http.IncomingMessage;
}

describe('humanity route guard (Plan 39 P7)', () => {
  it('admits a valid token exactly once; the replay is 409', async () => {
    const { redeem, spent } = fakeRedeem();
    const guard = createHumanityRouteGuard({
      policy: { required: true, servicePublicKeyHex: service.publicKeyHex, redeem },
    });
    const token = mintToken();
    const first = fakeRes();
    expect(await guard(fakeReq(token), first.res, 'session_issue')).toBe(true);
    expect(spent.size).toBe(1);
    const second = fakeRes();
    expect(await guard(fakeReq(token), second.res, 'session_issue')).toBe(false);
    expect(second.captured()?.status).toBe(409);
    expect(second.captured()?.body.reason).toBe('humanity_already_spent');
  });

  it('fails closed 500 when the pinned key or redeem client is missing', async () => {
    const { redeem } = fakeRedeem();
    for (const policy of [
      { required: true, redeem },
      { required: true, servicePublicKeyHex: service.publicKeyHex },
    ]) {
      const guard = createHumanityRouteGuard({ policy });
      const r = fakeRes();
      expect(await guard(fakeReq(mintToken()), r.res, 'session_issue')).toBe(false);
      expect(r.captured()?.status).toBe(500);
      expect(r.captured()?.body.reason).toBe('humanity_not_configured');
    }
  });

  it('rejects missing, malformed, forged-key, and expired tokens 401 WITHOUT touching the redeem', async () => {
    const { redeem, spent } = fakeRedeem();
    const guard = createHumanityRouteGuard({
      policy: { required: true, servicePublicKeyHex: service.publicKeyHex, redeem },
    });
    for (const [token, reason] of [
      [undefined, 'humanity_missing'],
      ['!!not-a-token!!', 'humanity_malformed'],
      [mintToken(otherService), 'humanity_invalid'],
    ] as const) {
      const r = fakeRes();
      expect(await guard(fakeReq(token as string | undefined), r.res, 'session_issue')).toBe(false);
      expect(r.captured()?.status).toBe(401);
      expect(r.captured()?.body.reason).toBe(reason);
    }
    expect(spent.size).toBe(0);
  });

  it('fails closed 503 when the humanity service is unreachable', async () => {
    const guard = createHumanityRouteGuard({
      policy: {
        required: true,
        servicePublicKeyHex: service.publicKeyHex,
        redeem: async () => { throw new Error('down'); },
      },
    });
    const r = fakeRes();
    expect(await guard(fakeReq(mintToken()), r.res, 'session_issue')).toBe(false);
    expect(r.captured()?.status).toBe(503);
    expect(r.captured()?.body.reason).toBe('humanity_service_unreachable');
  });

  it('reads a custom header when configured', async () => {
    const { redeem } = fakeRedeem();
    const guard = createHumanityRouteGuard({
      policy: { required: true, servicePublicKeyHex: service.publicKeyHex, redeem },
      header: 'x-custom-humanity',
    });
    const r = fakeRes();
    expect(await guard(fakeReq(mintToken(), 'x-custom-humanity'), r.res, 'session_issue')).toBe(true);
  });
});
