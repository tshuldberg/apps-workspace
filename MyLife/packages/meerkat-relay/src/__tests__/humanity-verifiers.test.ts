import { describe, expect, it } from 'vitest';
import {
  AppAttestVerifier,
  PlayIntegrityVerifier,
  StubHumanityVerifier,
  TurnstileVerifier,
  failClosedAppAttestVerifier,
} from '../humanity-verifiers';
import type { HumanityChallengeContext } from '../humanity-service';

const challenge: HumanityChallengeContext = {
  challengeId: 'chal-1',
  kind: 'turnstile',
  nonce: 'nonce-1',
  issuedAt: '2026-07-05T00:00:00.000Z',
};

describe('TurnstileVerifier', () => {
  it('accepts only a successful siteverify response bound to the challenge nonce', async () => {
    const calls: string[] = [];
    const verifier = new TurnstileVerifier({
      secret: 'secret',
      fetchImpl: async (_url, init) => {
        calls.push(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, cdata: challenge.nonce }),
          text: async () => '',
        };
      },
    });

    const result = await verifier.verify({ challenge, attestation: { token: 'turnstile-token' } });
    expect(result.ok).toBe(true);
    expect(calls[0]).toContain(`cdata=${challenge.nonce}`);
  });

  it('fails closed when siteverify rejects or echoes the wrong challenge data', async () => {
    const rejected = new TurnstileVerifier({
      secret: 'secret',
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ success: false }), text: async () => '' }),
    });
    await expect(rejected.verify({ challenge, attestation: { token: 'bad' } })).resolves.toEqual({
      ok: false,
      reason: 'turnstile_rejected',
    });

    const wrongNonce = new TurnstileVerifier({
      secret: 'secret',
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ success: true, cdata: 'other' }), text: async () => '' }),
    });
    await expect(wrongNonce.verify({ challenge, attestation: { token: 'ok' } })).resolves.toEqual({
      ok: false,
      reason: 'nonce_mismatch',
    });
  });
});

describe('PlayIntegrityVerifier', () => {
  it('accepts a recognized package and device integrity verdict bound to the nonce', async () => {
    const verifier = new PlayIntegrityVerifier({
      packageName: 'com.mylife.meerkat',
      accessToken: async () => 'google-token',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tokenPayloadExternal: {
            requestDetails: {
              nonce: challenge.nonce,
              requestPackageName: 'com.mylife.meerkat',
            },
            appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
            deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] },
          },
        }),
        text: async () => '',
      }),
    });

    const result = await verifier.verify({ challenge, attestation: { integrityToken: 'android-token' } });
    expect(result.ok).toBe(true);
  });

  it('fails closed on nonce, package, app, or device mismatch', async () => {
    const verifier = new PlayIntegrityVerifier({
      packageName: 'com.mylife.meerkat',
      accessToken: async () => 'google-token',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tokenPayloadExternal: {
            requestDetails: { nonce: 'wrong', requestPackageName: 'com.mylife.meerkat' },
            appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
            deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] },
          },
        }),
        text: async () => '',
      }),
    });
    await expect(verifier.verify({ challenge, attestation: { integrityToken: 'android-token' } })).resolves.toEqual({
      ok: false,
      reason: 'nonce_mismatch',
    });
  });
});

describe('AppAttestVerifier', () => {
  it('delegates attestation verification to the injected vetted verifier', async () => {
    let sawExpectedNonce = false;
    const verifier = new AppAttestVerifier({
      appId: 'TEAMID.com.mylife.meerkat',
      attestationVerifier: async (input) => {
        sawExpectedNonce = input.expectedNonce === challenge.nonce;
        return { ok: true };
      },
    });

    const result = await verifier.verify({
      challenge,
      attestation: { keyId: 'apple-key', attestationObject: 'cbor' },
    });
    expect(result.ok).toBe(true);
    expect(sawExpectedNonce).toBe(true);
    expect(verifier.isProductionSafe).toBe(true);
  });

  it('is fail-closed and not production-safe without a vetted verifier', async () => {
    const verifier = new AppAttestVerifier({ appId: 'TEAMID.com.mylife.meerkat' });
    expect(verifier.isProductionSafe).toBe(false);
    await expect(verifier.verify({ challenge, attestation: { keyId: 'apple-key', attestationObject: 'cbor' } })).resolves.toEqual({
      ok: false,
      reason: 'attestation_rejected',
    });
    await expect(failClosedAppAttestVerifier({
      keyId: 'apple-key',
      attestationObject: 'cbor',
      expectedNonce: challenge.nonce,
      appId: 'TEAMID.com.mylife.meerkat',
    })).resolves.toEqual({ ok: false });
  });
});

describe('StubHumanityVerifier', () => {
  it('is dev/test-only and accepts only the configured stub secret', async () => {
    const verifier = new StubHumanityVerifier('turnstile', 'ok-secret');
    expect(verifier.isProductionSafe).toBe(false);
    await expect(verifier.verify({ challenge, attestation: { stubSecret: 'ok-secret', stubKeyId: 'local' } })).resolves.toMatchObject({
      ok: true,
      attestationKeyId: 'stub:local',
    });
    await expect(verifier.verify({ challenge, attestation: { stubSecret: 'wrong' } })).resolves.toEqual({
      ok: false,
      reason: 'stub_rejected',
    });
  });
});
