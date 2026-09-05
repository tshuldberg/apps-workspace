import { describe, expect, it } from 'vitest';
import {
  checkHumanityGate,
  type HumanityGatePolicy,
  type HumanityRedeemOutcome,
} from '../humanity-gate';
import {
  humanityServiceKeypairFromSeed,
  serializeHumanityToken,
  signHumanityToken,
  type HumanityToken,
} from '../humanity-credential';

const service = humanityServiceKeypairFromSeed('a'.repeat(64));
const NOW = Date.parse('2026-07-04T00:00:00.000Z');

function freshToken(overrides: Partial<HumanityToken> = {}): HumanityToken {
  return signHumanityToken(service.privateKeyHex, {
    version: 1,
    tokenId: overrides.tokenId ?? 'b'.repeat(64),
    issuedAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 10_000).toISOString(),
  });
}

function policy(overrides: Partial<HumanityGatePolicy> = {}): HumanityGatePolicy {
  return {
    required: true,
    servicePublicKeyHex: service.publicKeyHex,
    nowMs: () => NOW,
    redeem: async () => ({ ok: true }),
    ...overrides,
  };
}

describe('humanity gate (Plan 24 P3 enforcement seam)', () => {
  it('passes a not-required gate without a token (private/local paths, NC-4)', async () => {
    const result = await checkHumanityGate(null, { required: false });
    expect(result).toEqual({ ok: true, reason: 'not_required' });
  });

  it('accepts a fresh token that redeems ok', async () => {
    const wire = serializeHumanityToken(freshToken());
    const result = await checkHumanityGate(wire, policy());
    expect(result.ok).toBe(true);
  });

  it('rejects a missing token when required (AC-3 fail-closed)', async () => {
    const result = await checkHumanityGate(null, policy());
    expect(result).toMatchObject({ ok: false, reason: 'missing', status: 401 });
  });

  it('rejects a malformed token', async () => {
    const result = await checkHumanityGate('!!!not-a-token!!!', policy());
    expect(result).toMatchObject({ ok: false, reason: 'malformed', status: 401 });
  });

  it('rejects a token signed by the wrong key as invalid', async () => {
    const evil = humanityServiceKeypairFromSeed('c'.repeat(64));
    const wire = serializeHumanityToken(
      signHumanityToken(evil.privateKeyHex, {
        version: 1,
        tokenId: 'd'.repeat(64),
        issuedAt: new Date(NOW).toISOString(),
        expiresAt: new Date(NOW + 10_000).toISOString(),
      }),
    );
    const result = await checkHumanityGate(wire, policy());
    expect(result).toMatchObject({ ok: false, reason: 'invalid', status: 401 });
  });

  it('rejects an expired token', async () => {
    const wire = serializeHumanityToken(
      signHumanityToken(service.privateKeyHex, {
        version: 1,
        tokenId: 'e'.repeat(64),
        issuedAt: new Date(NOW - 20_000).toISOString(),
        expiresAt: new Date(NOW - 10_000).toISOString(),
      }),
    );
    const result = await checkHumanityGate(wire, policy());
    expect(result).toMatchObject({ ok: false, reason: 'expired', status: 401 });
  });

  it('rejects a replayed/spent token (AC-2)', async () => {
    const wire = serializeHumanityToken(freshToken());
    const redeem = async (): Promise<HumanityRedeemOutcome> => ({ ok: false, reason: 'already_spent' });
    const result = await checkHumanityGate(wire, policy({ redeem }));
    expect(result).toMatchObject({ ok: false, reason: 'already_spent', status: 401 });
  });

  it('fails closed when the redeem service is unreachable (AC-3)', async () => {
    const wire = serializeHumanityToken(freshToken());
    const redeem = async (): Promise<HumanityRedeemOutcome> => {
      throw new Error('ECONNREFUSED');
    };
    const result = await checkHumanityGate(wire, policy({ redeem }));
    expect(result).toMatchObject({ ok: false, reason: 'service_unreachable', status: 503 });
  });

  it('reports not_configured when required but no service key is pinned', async () => {
    const wire = serializeHumanityToken(freshToken());
    const result = await checkHumanityGate(wire, policy({ servicePublicKeyHex: undefined }));
    expect(result).toMatchObject({ ok: false, reason: 'not_configured', status: 500 });
  });

  it('reports not_configured when required but no redeem client is wired (double-spend cannot be checked)', async () => {
    const wire = serializeHumanityToken(freshToken());
    const result = await checkHumanityGate(wire, policy({ redeem: undefined }));
    expect(result).toMatchObject({ ok: false, reason: 'not_configured', status: 500 });
  });

  it('verifies BEFORE it redeems (a bad token never touches the spent store)', async () => {
    let redeemCalls = 0;
    const redeem = async (): Promise<HumanityRedeemOutcome> => {
      redeemCalls += 1;
      return { ok: true };
    };
    await checkHumanityGate('garbage', policy({ redeem }));
    expect(redeemCalls).toBe(0);
  });
});
