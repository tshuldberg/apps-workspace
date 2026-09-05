import { describe, expect, it } from 'vitest';
import { handleAccountWorkerRequest, runAccountWorker } from '../index.ts';
import {
  ENV_PROCESSOR_CLEANUP_SECRET,
  ENV_PROCESSOR_CLEANUP_URL,
  cleanUpProcessorAccount,
} from '../seams.ts';
import {
  createInMemoryMyNewsStore,
  createPostgrestMyNewsStore,
  type MyNewsStore,
} from '../../_shared/mynews-store.ts';

const USER_ID = 'auth-user-1';
const PROFILE_ID = 'profile-1';
const WORKER_SECRET = 'worker-secret-1';
const NOW = '2026-07-30T12:00:00.000Z';
const AFTER_GRACE = '2026-08-07T12:00:00.000Z';

function env(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    MYNEWS_ACCOUNT_WORKER_SECRET: WORKER_SECRET,
    ...overrides,
  };
  return (key: string) => values[key];
}

/** A store with one grace request that is already due. */
async function dueStore() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      { id: PROFILE_ID, userId: USER_ID, pubkey: 'ab'.repeat(32), handle: 'reporter_one' },
    ],
    termsAcceptances: [{ userId: USER_ID, version: '2026-07-01' }],
  });
  const opened = await built.store.initiateAccountDeletion(USER_ID, PROFILE_ID);
  if (opened.outcome !== 'created') throw new Error('seed failed');
  // Pull the grace window back so the request is due at AFTER_GRACE.
  built.state.deletionRequests[0]!.requestedAt = NOW;
  built.state.deletionRequests[0]!.graceEndsAt = AFTER_GRACE;
  return built;
}

function deps(store: MyNewsStore, options: { env?: (key: string) => string | undefined; now?: string } = {}) {
  return {
    env: options.env ?? env(),
    now: () => options.now ?? AFTER_GRACE,
    store,
  };
}

function workerRequest(secret: string | null, headerName = 'X-MyNews-Worker-Secret'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== null) headers[headerName] = secret;
  return new Request('http://local/mynews-account-worker', {
    method: 'POST',
    headers,
    body: '{}',
  });
}

describe('mynews-account-worker transport', () => {
  it('rejects non-POST', async () => {
    const { store } = await dueStore();
    const res = await handleAccountWorkerRequest(
      new Request('http://local/mynews-account-worker', { method: 'GET' }),
      deps(store),
    );
    expect(res.status).toBe(405);
  });

  it('requires the worker secret to be configured server-side', async () => {
    const { store } = await dueStore();
    const res = await handleAccountWorkerRequest(
      workerRequest(WORKER_SECRET),
      deps(store, { env: () => undefined }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: 'config' });
  });

  it('rejects a missing or wrong worker secret without touching any request', async () => {
    const built = await dueStore();
    for (const supplied of [null, 'wrong-secret']) {
      const res = await handleAccountWorkerRequest(workerRequest(supplied), deps(built.store));
      expect(res.status, String(supplied)).toBe(401);
    }
    expect(built.state.deletionRequests[0]!.status).toBe('grace');
  });

  it('accepts the secret in the header or as a bearer token', async () => {
    const viaHeader = await dueStore();
    const headerRes = await handleAccountWorkerRequest(
      workerRequest(WORKER_SECRET),
      deps(viaHeader.store),
    );
    expect(headerRes.status).toBe(200);

    const viaBearer = await dueStore();
    const bearerRes = await handleAccountWorkerRequest(
      workerRequest(`Bearer ${WORKER_SECRET}`, 'Authorization'),
      deps(viaBearer.store),
    );
    expect(bearerRes.status).toBe(200);
  });

  it('rejects a non-JSON body', async () => {
    const { store } = await dueStore();
    const res = await handleAccountWorkerRequest(
      new Request('http://local/mynews-account-worker', {
        method: 'POST',
        headers: { 'X-MyNews-Worker-Secret': WORKER_SECRET },
        body: 'not json',
      }),
      deps(store),
    );
    expect(res.status).toBe(400);
  });
});

describe('mynews-account-worker pass', () => {
  it('claims only due requests', async () => {
    const built = await dueStore();
    const early = await runAccountWorker(deps(built.store, { now: NOW }));
    expect(early.claimed).toBe(0);
    expect(built.state.deletionRequests[0]!.status).toBe('grace');

    const due = await runAccountWorker(deps(built.store));
    expect(due.claimed).toBe(1);
  });

  it('disposes, deletes the auth user, and completes with an honest processor skip', async () => {
    const built = await dueStore();
    const result = await runAccountWorker(deps(built.store));

    expect(result.ok).toBe(true);
    expect(result.disposed).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.authDeletionsDone).toBe(1);
    expect(result.processorCleanupsSkipped).toBe(1);

    const row = built.state.deletionRequests[0]!;
    expect(row.status).toBe('completed');
    expect(row.contentDisposedAt).not.toBeNull();
    expect(row.authUserDeletionState).toBe('done');
    // No processor rail is configured, so this stays visible as a skip.
    expect(row.processorCleanupState).toBe('skipped-unconfigured');
    expect(built.state.authDeletion.deletedUserIds).toEqual([USER_ID]);
    // The retained public record was detached before the auth user went away.
    expect(built.state.profiles.get(PROFILE_ID)!.userId).toBeUndefined();
  });

  it('records an unconfigured auth deletion as skipped-unconfigured, never done', async () => {
    const built = await dueStore();
    built.state.authDeletion.behavior = 'skipped-unconfigured';

    const result = await runAccountWorker(deps(built.store));
    expect(result.ok).toBe(true);
    expect(result.authDeletionsDone).toBe(0);
    expect(result.authDeletionsSkipped).toBe(1);

    const row = built.state.deletionRequests[0]!;
    expect(row.authUserDeletionState).toBe('skipped-unconfigured');
    expect(row.authUserDeletionState).not.toBe('done');
    expect(built.state.authDeletion.deletedUserIds).toEqual([]);
    // The content disposition still happened and the request still completes,
    // with the unconfigured side effect visible in the status.
    expect(row.status).toBe('completed');
    expect(built.state.profiles.get(PROFILE_ID)!.deletedAt).not.toBeNull();
  });

  it('marks a failed auth deletion as failed and retries it on a later pass', async () => {
    const built = await dueStore();
    built.state.authDeletion.behavior = 'failed';

    const first = await runAccountWorker(deps(built.store));
    expect(first.ok).toBe(false);
    expect(first.completed).toBe(0);
    const row = built.state.deletionRequests[0]!;
    expect(row.status).toBe('failed');
    expect(row.authUserDeletionState).toBe('failed');
    expect(row.failureDetail).toContain('auth user deletion failed');

    // Inside the backoff the failed row is left alone.
    const tooSoon = await runAccountWorker(deps(built.store, { now: AFTER_GRACE }));
    expect(tooSoon.claimed).toBe(0);

    // Past the backoff it is retried, and a now-working admin API completes it.
    built.state.authDeletion.behavior = 'done';
    const retry = await runAccountWorker(
      deps(built.store, { now: '2026-08-07T14:00:00.000Z' }),
    );
    expect(retry.completed).toBe(1);
    expect(built.state.deletionRequests[0]!.status).toBe('completed');
    expect(built.state.deletionRequests[0]!.authUserDeletionState).toBe('done');
  });

  it('fails the request when the processor cleanup errors', async () => {
    const built = await dueStore();
    const result = await runAccountWorker({
      ...deps(built.store),
      cleanUpProcessor: async () => ({ kind: 'error', detail: 'processor cleanup responded 500' }),
    });

    expect(result.ok).toBe(false);
    expect(result.completed).toBe(0);
    const row = built.state.deletionRequests[0]!;
    expect(row.status).toBe('failed');
    expect(row.processorCleanupState).toBe('failed');
    expect(row.failureDetail).toContain('500');
  });

  it('records a configured processor cleanup as done', async () => {
    const built = await dueStore();
    const result = await runAccountWorker({
      ...deps(built.store),
      cleanUpProcessor: async () => ({ kind: 'done' }),
    });
    expect(result.processorCleanupsDone).toBe(1);
    expect(built.state.deletionRequests[0]!.processorCleanupState).toBe('done');
  });

  it('never completes a request whose side effects are still pending', async () => {
    const built = await dueStore();
    const [claim] = await built.store.claimDueAccountDeletions(AFTER_GRACE, 10);
    await built.store.disposeAccountDeletion(claim!.id);
    expect(await built.store.completeAccountDeletion(claim!.id)).toBe('states-pending');
    expect(built.state.deletionRequests[0]!.status).toBe('processing');
  });

  it('never completes a request that was not disposed', async () => {
    const built = await dueStore();
    const [claim] = await built.store.claimDueAccountDeletions(AFTER_GRACE, 10);
    await built.store.recordAccountDeletionState({
      requestId: claim!.id,
      field: 'auth_user_deletion_state',
      state: 'done',
    });
    await built.store.recordAccountDeletionState({
      requestId: claim!.id,
      field: 'processor_cleanup_state',
      state: 'done',
    });
    expect(await built.store.completeAccountDeletion(claim!.id)).toBe('not-disposed');
  });

  it('one bad request does not stop the batch', async () => {
    const built = await dueStore();
    // Add a second due request for another user in the same store.
    await built.store.initiateAccountDeletion('auth-user-2', null);
    built.state.deletionRequests[1]!.graceEndsAt = AFTER_GRACE;

    let calls = 0;
    const flaky: MyNewsStore = {
      ...built.store,
      disposeAccountDeletion: async (requestId) => {
        calls += 1;
        if (calls === 1) throw new Error('transient disposition failure');
        return built.store.disposeAccountDeletion(requestId);
      },
    };

    const result = await runAccountWorker({ ...deps(flaky), store: flaky });
    expect(result.claimed).toBe(2);
    expect(result.disposed).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.ok).toBe(false);
  });
});

describe('mynews-account-worker seams', () => {
  it('reports an unconfigured processor rail rather than a fake success', async () => {
    const result = await cleanUpProcessorAccount(
      { requestId: 'r1', userId: USER_ID, profileId: PROFILE_ID },
      () => undefined,
      async () => {
        throw new Error('must not be called');
      },
    );
    expect(result.kind).toBe('unconfigured');
  });

  it('posts to a configured https endpoint with the shared secret', async () => {
    const calls: Array<{ url: string; secret: string | null; body: unknown }> = [];
    const result = await cleanUpProcessorAccount(
      { requestId: 'r1', userId: USER_ID, profileId: PROFILE_ID },
      env({
        [ENV_PROCESSOR_CLEANUP_URL]: 'https://ops.example/cleanup',
        [ENV_PROCESSOR_CLEANUP_SECRET]: 'processor-secret',
      }),
      async (url, init) => {
        calls.push({
          url: String(url),
          secret: new Headers(init?.headers).get('X-MyNews-Processor-Secret'),
          body: JSON.parse(String(init?.body)),
        });
        return new Response('{}', { status: 200 });
      },
    );
    expect(result.kind).toBe('done');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://ops.example/cleanup');
    expect(calls[0]!.secret).toBe('processor-secret');
    expect(calls[0]!.body).toMatchObject({ userId: USER_ID, reason: 'account_deleted' });
  });

  it('treats a non-2xx, a thrown request, and a non-https endpoint as errors', async () => {
    const configured = env({
      [ENV_PROCESSOR_CLEANUP_URL]: 'https://ops.example/cleanup',
      [ENV_PROCESSOR_CLEANUP_SECRET]: 'processor-secret',
    });
    const rejected = await cleanUpProcessorAccount(
      { requestId: 'r1', userId: USER_ID, profileId: null },
      configured,
      async () => new Response('nope', { status: 500 }),
    );
    expect(rejected).toMatchObject({ kind: 'error' });

    const threw = await cleanUpProcessorAccount(
      { requestId: 'r1', userId: USER_ID, profileId: null },
      configured,
      async () => {
        throw new Error('network down');
      },
    );
    expect(threw).toMatchObject({ kind: 'error' });

    const insecure = await cleanUpProcessorAccount(
      { requestId: 'r1', userId: USER_ID, profileId: null },
      env({
        [ENV_PROCESSOR_CLEANUP_URL]: 'http://ops.example/cleanup',
        [ENV_PROCESSOR_CLEANUP_SECRET]: 'processor-secret',
      }),
      async () => new Response('{}', { status: 200 }),
    );
    expect(insecure).toMatchObject({ kind: 'error' });
  });

  it('the postgrest admin seam is skipped-unconfigured without a service role key', async () => {
    const unconfigured = createPostgrestMyNewsStore(
      (key) => (key === 'SUPABASE_URL' ? 'https://project.supabase.co' : undefined),
      async () => {
        throw new Error('must not be called');
      },
    );
    expect(await unconfigured.deleteAuthUser(USER_ID)).toBe('skipped-unconfigured');
  });

  it('the postgrest admin seam calls the admin API and treats a GoTrue 404 as already gone', async () => {
    const seen: string[] = [];
    const configured = createPostgrestMyNewsStore(
      (key) =>
        key === 'SUPABASE_URL'
          ? 'https://project.supabase.co'
          : key === 'SUPABASE_SERVICE_ROLE_KEY'
            ? 'service-key'
            : undefined,
      async (url, init) => {
        seen.push(`${init?.method} ${String(url)}`);
        if (seen.length === 1) return new Response(null, { status: 204 });
        // GoTrue's own "user not found" is JSON with its error fields.
        return new Response(JSON.stringify({ code: 404, msg: 'User not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      },
    );
    expect(await configured.deleteAuthUser(USER_ID)).toBe('done');
    expect(await configured.deleteAuthUser(USER_ID)).toBe('done');
    expect(seen[0]).toBe(`DELETE https://project.supabase.co/auth/v1/admin/users/${USER_ID}`);
  });

  it('the admin seam treats a mis-routed 404 (no GoTrue error shape) as failed, not done', async () => {
    // A wrong base URL or path also returns 404. Reporting that as done would
    // mark every deletion successful while no auth user is removed (WP12 #6).
    const htmlNotFound = createPostgrestMyNewsStore(
      (key) =>
        key === 'SUPABASE_URL'
          ? 'https://wrong-host.example'
          : key === 'SUPABASE_SERVICE_ROLE_KEY'
            ? 'service-key'
            : undefined,
      async () =>
        new Response('<html>404 Not Found</html>', {
          status: 404,
          headers: { 'content-type': 'text/html' },
        }),
    );
    expect(await htmlNotFound.deleteAuthUser(USER_ID)).toBe('failed');

    const proxyJson404 = createPostgrestMyNewsStore(
      (key) =>
        key === 'SUPABASE_URL'
          ? 'https://project.supabase.co'
          : key === 'SUPABASE_SERVICE_ROLE_KEY'
            ? 'service-key'
            : undefined,
      async () =>
        new Response(JSON.stringify({ message: 'no Route matched', request_id: 'abc' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    );
    expect(await proxyJson404.deleteAuthUser(USER_ID)).toBe('failed');
  });

  it('the postgrest admin seam reports a real failure as failed', async () => {
    const failing = createPostgrestMyNewsStore(
      (key) =>
        key === 'SUPABASE_URL'
          ? 'https://project.supabase.co'
          : key === 'SUPABASE_SERVICE_ROLE_KEY'
            ? 'service-key'
            : undefined,
      async () => new Response('boom', { status: 500 }),
    );
    expect(await failing.deleteAuthUser(USER_ID)).toBe('failed');
  });
});
