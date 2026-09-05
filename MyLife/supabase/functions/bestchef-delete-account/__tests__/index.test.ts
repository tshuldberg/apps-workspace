import { describe, expect, it } from 'vitest';
import {
  handleAccountDeletionWorkerRequest,
  processAccountDeletionRequest,
  type AccountDeletionRequestRow,
  type AccountDeletionStore,
  type StorageObjectRef,
} from '../index.ts';

const NOW = '2026-04-26T12:00:00.000Z';
const SECRET = 'worker-secret';

function makeRequest(
  body: unknown = {},
  opts: { secret?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.secret !== null) {
    headers.set('X-BestChef-Worker-Secret', opts.secret ?? SECRET);
  }
  return new Request('http://localhost/functions/bestchef-delete-account', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function deletionRow(overrides: Partial<AccountDeletionRequestRow> = {}): AccountDeletionRequestRow {
  return {
    id: 'request-1',
    user_id: 'user-1',
    profile_id: 'profile-1',
    status: 'requested',
    reason: 'user_requested_delete_account',
    metadata: {},
    requested_at: NOW,
    completed_at: null,
    ...overrides,
  };
}

class FakeDeletionStore implements AccountDeletionStore {
  requests = [deletionRow()];
  storageObjects: StorageObjectRef[] = [
    { bucket: 'bestchef-submission-images', key: 'profile-1/photo.jpg' },
    { bucket: 'bestchef-submission-images', key: '/profile-1/photo.jpg' },
    { bucket: 'bestchef-thumbnails', key: 'profile-1/thumb.jpg' },
  ];
  deletedStorageObjects: StorageObjectRef[] = [];
  deletedAuthUsers: string[] = [];
  processing: string[] = [];
  completed: string[] = [];
  failed: Array<{ requestId: string; message: string }> = [];
  mediaDeletedFor: string[] = [];
  failStorageDelete = false;

  async listOpenRequests(limit: number): Promise<AccountDeletionRequestRow[]> {
    return this.requests
      .filter((request) => request.status === 'requested' || request.status === 'failed')
      .slice(0, limit);
  }

  async getRequest(requestId: string): Promise<AccountDeletionRequestRow | null> {
    return this.requests.find((request) => request.id === requestId) ?? null;
  }

  async markProcessing(
    request: AccountDeletionRequestRow,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow> {
    this.processing.push(request.id);
    return { ...request, status: 'processing', metadata };
  }

  async markCompleted(
    request: AccountDeletionRequestRow,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow> {
    this.completed.push(request.id);
    return { ...request, status: 'completed', metadata, completed_at: NOW };
  }

  async markFailed(
    request: AccountDeletionRequestRow,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<AccountDeletionRequestRow> {
    this.failed.push({ requestId: request.id, message });
    return { ...request, status: 'failed', metadata };
  }

  async listStorageObjects(_profileId: string): Promise<StorageObjectRef[]> {
    return this.storageObjects;
  }

  async markProfileMediaDeleted(profileId: string): Promise<number> {
    this.mediaDeletedFor.push(profileId);
    return 2;
  }

  async deleteStorageObject(ref: StorageObjectRef): Promise<void> {
    if (this.failStorageDelete) throw new Error('storage delete failed');
    this.deletedStorageObjects.push(ref);
  }

  async deleteAuthUser(userId: string): Promise<void> {
    this.deletedAuthUsers.push(userId);
  }
}

function makeDeps(store = new FakeDeletionStore(), env: Record<string, string | undefined> = {}) {
  return {
    env: (key: string) => ({ BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET: SECRET, ...env })[key],
    now: () => NOW,
    store,
  };
}

describe('bestchef-delete-account worker', () => {
  it('rejects requests when the worker secret is not configured', async () => {
    const store = new FakeDeletionStore();
    const res = await handleAccountDeletionWorkerRequest(
      makeRequest({}, { secret: SECRET }),
      {
        env: () => undefined,
        now: () => NOW,
        store,
      },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { kind: 'config' } });
  });

  it('rejects calls without the private worker secret', async () => {
    const res = await handleAccountDeletionWorkerRequest(
      makeRequest({}, { secret: null }),
      makeDeps(),
    );

    expect(res.status).toBe(401);
  });

  it('processes a targeted deletion request with storage cleanup before auth deletion', async () => {
    const store = new FakeDeletionStore();
    const res = await handleAccountDeletionWorkerRequest(
      makeRequest({ requestId: 'request-1' }),
      makeDeps(store),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, processed: 1, completed: 1, failed: 0 });
    expect(store.processing).toEqual(['request-1']);
    expect(store.deletedStorageObjects).toEqual([
      { bucket: 'bestchef-submission-images', key: 'profile-1/photo.jpg' },
      { bucket: 'bestchef-thumbnails', key: 'profile-1/thumb.jpg' },
    ]);
    expect(store.mediaDeletedFor).toEqual(['profile-1']);
    expect(store.deletedAuthUsers).toEqual(['user-1']);
    expect(store.completed).toEqual(['request-1']);
  });

  it('marks the request failed when storage cleanup fails', async () => {
    const store = new FakeDeletionStore();
    store.failStorageDelete = true;

    const result = await processAccountDeletionRequest(deletionRow(), makeDeps(store));

    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      error: 'storage delete failed',
    });
    expect(store.deletedAuthUsers).toEqual([]);
    expect(store.failed).toEqual([{ requestId: 'request-1', message: 'storage delete failed' }]);
  });

  it('processes open requests in list mode and skips completed rows', async () => {
    const store = new FakeDeletionStore();
    store.requests = [
      deletionRow({ id: 'request-1', status: 'requested' }),
      deletionRow({ id: 'request-2', status: 'completed' }),
      deletionRow({ id: 'request-3', status: 'failed' }),
    ];

    const res = await handleAccountDeletionWorkerRequest(
      makeRequest({ limit: 10 }),
      makeDeps(store),
    );
    const json = await res.json();

    expect(json).toMatchObject({ ok: true, processed: 2, completed: 2, failed: 0 });
    expect(store.completed).toEqual(['request-1', 'request-3']);
  });

  it('returns not_found for an unknown targeted request', async () => {
    const res = await handleAccountDeletionWorkerRequest(
      makeRequest({ requestId: 'missing-request' }),
      makeDeps(new FakeDeletionStore()),
    );

    expect(res.status).toBe(404);
  });

  it('rejects unsupported methods and invalid JSON', async () => {
    const getRes = await handleAccountDeletionWorkerRequest(
      makeRequest({}, { method: 'GET' }),
      makeDeps(),
    );
    expect(getRes.status).toBe(405);

    const invalid = new Request('http://localhost/functions/bestchef-delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BestChef-Worker-Secret': SECRET,
      },
      body: '{',
    });
    const jsonRes = await handleAccountDeletionWorkerRequest(invalid, makeDeps());
    expect(jsonRes.status).toBe(400);
  });
});
