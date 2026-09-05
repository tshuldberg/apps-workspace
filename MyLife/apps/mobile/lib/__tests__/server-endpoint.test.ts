import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeServerUrl,
  resolveApiBaseUrl,
  testSelfHostConnection,
} from '../server-endpoint';

const ORIGINAL_ENV = { ...process.env };

describe('mobile server endpoint helpers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.EXPO_PUBLIC_MYLIFE_HOSTED_API_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('normalizes URLs and strips trailing slashes', () => {
    expect(normalizeServerUrl(null)).toBeNull();
    expect(normalizeServerUrl('   ')).toBeNull();
    expect(normalizeServerUrl('ftp://example.com')).toBeNull();
    expect(normalizeServerUrl('https://example.com///')).toBe(
      'https://example.com',
    );
    expect(normalizeServerUrl('http://localhost:8787/')).toBe(
      'http://localhost:8787',
    );
  });

  it('resolves hosted/self-host/local-only API base URL modes', () => {
    expect(resolveApiBaseUrl('local_only', null)).toEqual({
      ok: false,
      url: null,
      reason: 'local_only_mode',
    });

    expect(resolveApiBaseUrl('hosted', null)).toEqual({
      ok: false,
      url: null,
      reason: 'missing_hosted_url',
    });

    process.env.EXPO_PUBLIC_MYLIFE_HOSTED_API_URL = 'not-a-url';
    expect(resolveApiBaseUrl('hosted', null)).toEqual({
      ok: false,
      url: null,
      reason: 'invalid_hosted_url',
    });

    process.env.EXPO_PUBLIC_MYLIFE_HOSTED_API_URL = 'https://api.mylife.test/';
    expect(resolveApiBaseUrl('hosted', null)).toEqual({
      ok: true,
      url: 'https://api.mylife.test',
    });

    expect(resolveApiBaseUrl('self_host', null)).toEqual({
      ok: false,
      url: null,
      reason: 'missing_self_host_url',
    });

    expect(resolveApiBaseUrl('self_host', 'not-a-url')).toEqual({
      ok: false,
      url: null,
      reason: 'invalid_self_host_url',
    });

    expect(resolveApiBaseUrl('self_host', 'https://home.example.com/')).toEqual({
      ok: true,
      url: 'https://home.example.com',
    });
  });

  it('runs self-host connection checks and reports per-step status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))
        .mockResolvedValueOnce(new Response('unauthorized', { status: 401 })),
    );

    const result = await testSelfHostConnection('https://home.example.com/');

    expect(result.ok).toBe(true);
    expect(result.baseUrl).toBe('https://home.example.com');
    expect(result.checks.map((check) => check.id)).toEqual([
      'url',
      'tls',
      'health',
      'sync',
    ]);
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  it('flags invalid URLs and failing endpoints', async () => {
    const invalid = await testSelfHostConnection('not-a-url');
    expect(invalid.ok).toBe(false);
    expect(invalid.baseUrl).toBeNull();
    expect(invalid.checks[0].id).toBe('url');
    expect(invalid.checks[0].ok).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(new Response('bad health', { status: 503 }))
        .mockRejectedValueOnce(new Error('network down')),
    );

    const failed = await testSelfHostConnection('http://home.example.com');
    expect(failed.ok).toBe(false);
    expect(failed.checks.find((check) => check.id === 'tls')?.ok).toBe(false);
    expect(failed.checks.find((check) => check.id === 'health')?.ok).toBe(false);
    expect(failed.checks.find((check) => check.id === 'sync')?.ok).toBe(false);
  });
});
