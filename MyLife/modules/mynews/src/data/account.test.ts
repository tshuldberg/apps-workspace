import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REMOVED,
  ACCOUNT_DELETION_RETAINED,
  DELETION_CONFIRMATION_PHRASE,
  accountDeletionStepLabel,
  accountErrorMessage,
} from './account';
import { InMemoryCloudAdapter } from './cloud';
import { createMyNewsCloudAdapter } from './cloud-fetch';

const EDGE_FUNCTION_PATH = join(
  import.meta.dirname,
  '../../../../supabase/functions/mynews-account/index.ts',
);
const BASE = 'https://proj.supabase.co';

function fakeJwt(sub: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'none' })}.${enc({ sub, role: 'authenticated' })}.sig`;
}

function recordingAdapter(envelope: unknown, status = 200) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const port = createMyNewsCloudAdapter({
    baseUrl: BASE,
    anonKey: 'anon-key',
    getAccessToken: async () => fakeJwt('auth-user-1'),
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(envelope), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });
  return { port, calls };
}

describe('account rights disclosure copy', () => {
  it('states the grace window and both sides of the retention split', () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(7);
    expect(ACCOUNT_DELETION_RETAINED.length).toBeGreaterThan(0);
    expect(ACCOUNT_DELETION_REMOVED.length).toBeGreaterThan(0);

    const retained = ACCOUNT_DELETION_RETAINED.join(' ').toLowerCase();
    expect(retained).toContain('anonymized');
    expect(retained).toContain('legal retention');
    expect(retained).toContain('tax');

    const removed = ACCOUNT_DELETION_REMOVED.join(' ').toLowerCase();
    expect(removed).toContain('signing key');
    expect(removed).toContain('drafts');
    expect(removed).toContain('follows');
  });

  it('has honest copy for every typed error the edge function can return', () => {
    const source = readFileSync(EDGE_FUNCTION_PATH, 'utf8');
    const codes = new Set(
      [...source.matchAll(/jsonError\(\s*'([a-z-]+)'/g)].map((match) => match[1]!),
    );
    expect(codes.size).toBeGreaterThan(5);
    const fallback = accountErrorMessage('definitely-not-a-real-code');
    for (const code of codes) {
      expect(accountErrorMessage(code), code).not.toBe(fallback);
    }
  });

  it('never labels an unconfigured step as done', () => {
    expect(accountDeletionStepLabel('skipped-unconfigured')).toBe(
      'Not configured on this server',
    );
    expect(accountDeletionStepLabel('done')).toBe('Done');
    expect(accountDeletionStepLabel('failed')).toContain('retry');
  });
});

describe('InMemoryCloudAdapter account rights', () => {
  function signedIn() {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'auth-user-1';
    port.profiles = [
      {
        id: 'p1',
        userId: 'auth-user-1',
        handle: 'rosamarin',
        displayName: 'Rosa Marín',
        pubkeyEd25519: 'pub-rosa',
        kind: 'journalist',
      },
    ];
    port.termsAcceptances = [{ userId: 'auth-user-1', version: '2026-07-01' }];
    return port;
  }

  it('requires a session for every action', async () => {
    const port = new InMemoryCloudAdapter();
    expect(await port.initiateAccountDeletion(DELETION_CONFIRMATION_PHRASE)).toEqual({
      ok: false,
      error: 'not-signed-in',
    });
    expect(await port.cancelAccountDeletion()).toEqual({ ok: false, error: 'not-signed-in' });
    expect(await port.getAccountDeletionStatus()).toEqual({ ok: false, error: 'not-signed-in' });
    expect(await port.exportAccountData()).toEqual({ ok: false, error: 'not-signed-in' });
  });

  it('requires the typed phrase and creates no request without it', async () => {
    const port = signedIn();
    expect(await port.initiateAccountDeletion('delete my account')).toEqual({
      ok: false,
      error: 'confirmation-mismatch',
    });
    expect(port.deletionRequests).toHaveLength(0);
  });

  it('opens one cancellable request with the disclosed grace window', async () => {
    const port = signedIn();
    const result = await port.initiateAccountDeletion(DELETION_CONFIRMATION_PHRASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.request.status).toBe('grace');
    expect(result.request.cancellable).toBe(true);
    expect(result.request.graceDays).toBe(ACCOUNT_DELETION_GRACE_DAYS);
    expect(
      Date.parse(result.request.graceEndsAt) - Date.parse(result.request.requestedAt),
    ).toBe(ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    expect(result.request.authUserDeletionState).toBe('pending');

    const again = await port.initiateAccountDeletion(DELETION_CONFIRMATION_PHRASE);
    expect(again.ok && again.created).toBe(false);
    expect(port.deletionRequests).toHaveLength(1);
  });

  it('cancels from grace and refuses once processing has started', async () => {
    const port = signedIn();
    await port.initiateAccountDeletion(DELETION_CONFIRMATION_PHRASE);
    expect(await port.cancelAccountDeletion()).toEqual({ ok: true });
    const status = await port.getAccountDeletionStatus();
    expect(status.ok && status.request?.status).toBe('cancelled');
    expect(await port.cancelAccountDeletion()).toEqual({
      ok: false,
      error: 'no-deletion-request',
    });

    await port.initiateAccountDeletion(DELETION_CONFIRMATION_PHRASE);
    port.deletionRequests.at(-1)!.request.status = 'processing';
    expect(await port.cancelAccountDeletion()).toEqual({ ok: false, error: 'not-cancellable' });
  });

  it('exports the rows it models and records the audit row, not the data', async () => {
    const port = signedIn();
    const result = await port.exportAccountData();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.userId).toBe('auth-user-1');
    expect(result.bundle.termsAcceptances).toEqual([
      { userId: 'auth-user-1', version: '2026-07-01' },
    ]);
    expect(result.byteCount).toBeGreaterThan(0);
    expect(port.exportJobs).toEqual([
      expect.objectContaining({ userId: 'auth-user-1', status: 'completed' }),
    ]);
    // The audit row carries a size, never the exported payload.
    expect(Object.keys(port.exportJobs[0]!)).not.toContain('bundle');
  });
});

describe('createMyNewsCloudAdapter account rights', () => {
  it('sends each action to the mynews-account function with the typed phrase', async () => {
    const { port, calls } = recordingAdapter({
      ok: true,
      data: { created: true, request: { requestId: 'r1', status: 'grace' } },
    });
    await port.initiateAccountDeletion(DELETION_CONFIRMATION_PHRASE);
    expect(calls[0]!.url).toBe(`${BASE}/functions/v1/mynews-account`);
    expect(calls[0]!.body).toEqual({
      action: 'initiate_deletion',
      confirmation: DELETION_CONFIRMATION_PHRASE,
    });
  });

  it('passes a typed server error straight through', async () => {
    const { port } = recordingAdapter({ ok: false, error: 'reauth-required' }, 401);
    const result = await port.initiateAccountDeletion(DELETION_CONFIRMATION_PHRASE);
    expect(result).toEqual({ ok: false, error: 'reauth-required' });
    expect(accountErrorMessage('reauth-required')).toContain('fresh sign-in');
  });

  it('needs a session before it will call the function at all', async () => {
    const calls: string[] = [];
    const port = createMyNewsCloudAdapter({
      baseUrl: BASE,
      anonKey: 'anon-key',
      getAccessToken: async () => null,
      fetchImpl: (async (url: RequestInfo | URL) => {
        calls.push(String(url));
        return new Response('{}', { status: 200 });
      }) as typeof fetch,
    });
    expect(await port.exportAccountData()).toEqual({ ok: false, error: 'not-signed-in' });
    expect(await port.cancelAccountDeletion()).toEqual({ ok: false, error: 'not-signed-in' });
    expect(calls).toEqual([]);
  });

  it('returns the export bundle and byte count from the envelope', async () => {
    const { port, calls } = recordingAdapter({
      ok: true,
      data: { byteCount: 42, bundle: { schemaVersion: 1 } },
    });
    const result = await port.exportAccountData();
    expect(result).toEqual({ ok: true, byteCount: 42, bundle: { schemaVersion: 1 } });
    expect(calls[0]!.body).toEqual({ action: 'export_data' });
  });

  it('reads the durable status', async () => {
    const { port, calls } = recordingAdapter({
      ok: true,
      data: { request: { requestId: 'r1', status: 'processing' } },
    });
    const result = await port.getAccountDeletionStatus();
    expect(result.ok && result.request?.status).toBe('processing');
    expect(calls[0]!.body).toEqual({ action: 'deletion_status' });
  });
});
