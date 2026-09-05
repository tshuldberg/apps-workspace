import { describe, expect, it } from 'vitest';
import {
  DMCA_ATTESTATION_VERSION,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
} from '@mylife/mynews';
import {
  buildCounterNoticePayload,
  submitDmcaCounterNotice,
  type DmcaCounterFormFields,
} from '../(root)/data/dmca-client';
import type { MyNewsCloudConfig } from '../(root)/data/launch-environment';

const CONFIG: MyNewsCloudConfig = {
  baseUrl: 'https://project.supabase.co',
  anonKey: 'anon-key',
};

const FIELDS: DmcaCounterFormFields = {
  counterNotifierName: 'Jordan Author',
  counterNotifierAddress: '2 Oak St, Sacramento CA',
  counterNotifierPhone: '+1 555 0100',
  counterNotifierEmail: 'jordan@example.com',
  removedMaterial: 'My article about the Owens Valley aqueduct',
  materialLocationBeforeRemoval: 'https://mynews.app/a/owens-valley',
  originalNoticeReference: '',
  goodFaithMistakeOrMisidentification: true,
  statementUnderPenaltyOfPerjury: true,
  consentToFederalJurisdiction: true,
  acceptanceOfServiceOfProcess: true,
  signature: 'Jordan Author',
};

function okEnvelope() {
  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        status: 'queued',
        referenceId: 'ref-1',
        resolutionStatus: 'resolved',
        originalNoticeMatched: true,
      },
    }),
    { status: 200 },
  );
}

describe('buildCounterNoticePayload', () => {
  it('pins the exact statutory attestation texts and version', () => {
    const built = buildCounterNoticePayload(FIELDS);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.mistakeAttestationText).toBe(DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT);
    expect(built.payload.mistakeAttestationVersion).toBe(DMCA_ATTESTATION_VERSION);
    expect(built.payload.kind).toBe('counter');
  });

  it('returns a typed validation failure when a 512(g)(3) element is missing', () => {
    expect(buildCounterNoticePayload({ ...FIELDS, counterNotifierPhone: ' ' }).ok).toBe(false);
    expect(
      buildCounterNoticePayload({ ...FIELDS, acceptanceOfServiceOfProcess: false }).ok,
    ).toBe(false);
    expect(
      buildCounterNoticePayload({
        ...FIELDS,
        materialLocationBeforeRemoval: 'http://insecure.example',
      }).ok,
    ).toBe(false);
  });
});

describe('submitDmcaCounterNotice', () => {
  it('posts to the derived functions URL with bearer token and anon apikey', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    const result = await submitDmcaCounterNotice(CONFIG, 'session-token', FIELDS, (async (
      url: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      seenUrl = String(url);
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return okEnvelope();
    }) as typeof fetch);
    expect(result).toEqual({
      ok: true,
      referenceId: 'ref-1',
      resolutionStatus: 'resolved',
      originalNoticeMatched: true,
    });
    expect(seenUrl).toBe('https://project.supabase.co/functions/v1/mynews-dmca');
    expect(seenHeaders.Authorization).toBe('Bearer session-token');
    expect(seenHeaders.apikey).toBe('anon-key');
  });

  it('respects an explicit functions URL', async () => {
    let seenUrl = '';
    await submitDmcaCounterNotice(
      { ...CONFIG, functionsUrl: 'https://fns.example.com' },
      'token',
      FIELDS,
      (async (url: RequestInfo | URL) => {
        seenUrl = String(url);
        return okEnvelope();
      }) as typeof fetch,
    );
    expect(seenUrl).toBe('https://fns.example.com/mynews-dmca');
  });

  it('maps server statuses to typed codes', async () => {
    const codeFor = async (status: number) => {
      const result = await submitDmcaCounterNotice(CONFIG, 'token', FIELDS, (async () =>
        new Response(JSON.stringify({ error: 'x' }), { status })) as typeof fetch);
      return result.ok ? 'ok' : result.code;
    };
    expect(await codeFor(400)).toBe('validation');
    expect(await codeFor(429)).toBe('rate-limited');
    expect(await codeFor(503)).toBe('temporarily-unavailable');
    expect(await codeFor(500)).toBe('unknown');
  });

  it('treats a network failure as a typed network error', async () => {
    const result = await submitDmcaCounterNotice(CONFIG, 'token', FIELDS, (async () => {
      throw new Error('offline');
    }) as typeof fetch);
    expect(result).toEqual({ ok: false, code: 'network' });
  });

  it('never reports success from a 200 that cannot prove queueing', async () => {
    const result = await submitDmcaCounterNotice(CONFIG, 'token', FIELDS, (async () =>
      new Response(JSON.stringify({ ok: true, data: { status: 'queued' } }), {
        status: 200,
      })) as typeof fetch);
    expect(result).toEqual({ ok: false, code: 'unknown' });
  });

  it('rejects locally invalid fields without any network call', async () => {
    let called = false;
    const result = await submitDmcaCounterNotice(
      CONFIG,
      'token',
      { ...FIELDS, signature: '' },
      (async () => {
        called = true;
        return okEnvelope();
      }) as typeof fetch,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('validation');
    expect(called).toBe(false);
  });
});
