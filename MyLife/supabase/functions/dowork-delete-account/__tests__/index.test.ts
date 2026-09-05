import { describe, expect, it } from 'vitest';
import {
  DOWORK_BUCKETS,
  PURCHASE_EVENT_SCRUB,
  handleDoWorkDeleteAccountRequest,
  type DoWorkDeleteStore,
} from '../index.ts';

const FAKE_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1' }));
  return `${header}.${payload}.sig`;
})();

function makeRequest(opts: { auth?: string | null; method?: string } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? `Bearer ${FAKE_JWT}` : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/dowork-delete-account', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : '{}',
  });
}

class FakeDeleteStore implements DoWorkDeleteStore {
  trainerId: string | null = 'trainer-1';
  formCheckLinkIds: string[] = [];
  deletes: Array<{ table: string; column: string; value: string }> = [];
  updates: Array<{
    table: string;
    column: string;
    value: string;
    patch: Record<string, unknown>;
  }> = [];
  objects = new Map<string, string[]>();
  removed: Array<{ bucket: string; keys: string[] }> = [];
  deletedAuthUsers: string[] = [];

  async getTrainerIdForUser(): Promise<string | null> {
    return this.trainerId;
  }

  async getFormCheckLinkIds(): Promise<string[]> {
    return this.formCheckLinkIds;
  }

  async deleteRows(table: string, filterColumn: string, value: string): Promise<void> {
    this.deletes.push({ table, column: filterColumn, value });
  }

  async updateRows(
    table: string,
    filterColumn: string,
    value: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    this.updates.push({ table, column: filterColumn, value, patch });
  }

  async listObjects(bucket: string, prefix: string): Promise<string[]> {
    const keys = this.objects.get(bucket) ?? [];
    return keys.filter((key) => key.startsWith(prefix));
  }

  async removeObjects(bucket: string, keys: string[]): Promise<void> {
    this.removed.push({ bucket, keys });
    const remaining = (this.objects.get(bucket) ?? []).filter((key) => !keys.includes(key));
    this.objects.set(bucket, remaining);
  }

  async deleteAuthUser(userId: string): Promise<void> {
    this.deletedAuthUsers.push(userId);
  }
}

describe('dowork-delete-account', () => {
  it('rejects missing auth', async () => {
    const res = await handleDoWorkDeleteAccountRequest(
      makeRequest({ auth: null }),
      new FakeDeleteStore(),
    );
    expect(res.status).toBe(401);
  });

  it('rejects non-POST', async () => {
    const res = await handleDoWorkDeleteAccountRequest(
      makeRequest({ method: 'GET' }),
      new FakeDeleteStore(),
    );
    expect(res.status).toBe(405);
  });

  it('deletes rows in FK-safe order, including trainer children', async () => {
    const store = new FakeDeleteStore();
    const res = await handleDoWorkDeleteAccountRequest(makeRequest(), store);
    expect(res.status).toBe(200);

    const tables = store.deletes.map((d) => `${d.table}:${d.column}`);
    expect(tables).toEqual([
      'dw_likes:user_id',
      'dw_comments:user_id',
      'dw_workout_shares:user_id',
      'dw_reports:reporter_user_id',
      'dw_client_links:client_user_id',
      'dw_trainer_subscriptions:user_id',
      'dw_video_view_marks:user_id',
      'dw_push_tokens:user_id',
      'dw_trainer_videos:trainer_id',
      'dw_trainers:user_id',
      'dw_user_blocks:user_id',
      'dw_user_blocks:blocked_user_id',
      'dw_user_profiles:user_id',
    ]);
    expect(store.deletes.find((d) => d.table === 'dw_trainer_videos')?.value).toBe('trainer-1');
  });

  it('skips trainer-video deletion when the user has no trainer row', async () => {
    const store = new FakeDeleteStore();
    store.trainerId = null;
    await handleDoWorkDeleteAccountRequest(makeRequest(), store);
    expect(store.deletes.some((d) => d.table === 'dw_trainer_videos')).toBe(false);
    expect(store.deletes.some((d) => d.table === 'dw_trainers')).toBe(false);
  });

  it('removes all storage objects under the user folder, then the auth user', async () => {
    const store = new FakeDeleteStore();
    store.objects.set('dowork-trainer-videos', [
      'user-1/videos/a.mp4',
      'user-1/videos/b.mp4',
      'user-2/videos/keep.mp4',
    ]);
    store.objects.set('dowork-avatars', ['user-1/avatars/me.jpg']);

    const res = await handleDoWorkDeleteAccountRequest(makeRequest(), store);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.objectsRemoved).toBe(3);
    expect(store.objects.get('dowork-trainer-videos')).toEqual(['user-2/videos/keep.mp4']);
    expect(store.deletedAuthUsers).toEqual(['user-1']);
    expect(DOWORK_BUCKETS).toHaveLength(3);
  });

  it('returns 500 with ok:false when a step fails', async () => {
    const store = new FakeDeleteStore();
    store.deleteRows = async () => {
      throw new Error('boom');
    };
    const res = await handleDoWorkDeleteAccountRequest(makeRequest(), store);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('removes form-check storage for every participating client link', async () => {
    const store = new FakeDeleteStore();
    store.formCheckLinkIds = ['link-a', 'link-b'];
    store.objects.set('dowork-form-checks', [
      'link-a/one.mp4',
      'link-a/two.mp4',
      'link-b/three.mp4',
      'link-c/other.mp4',
    ]);

    const res = await handleDoWorkDeleteAccountRequest(makeRequest(), store);
    const body = await res.json();

    expect(body.ok).toBe(true);
    // link-a (2) + link-b (1) removed; link-c untouched.
    expect(body.objectsRemoved).toBe(3);
    expect(store.objects.get('dowork-form-checks')).toEqual(['link-c/other.mp4']);
  });

  it('deletes the new trainer-platform tables', async () => {
    const store = new FakeDeleteStore();
    await handleDoWorkDeleteAccountRequest(makeRequest(), store);
    const tables = store.deletes.map((d) => `${d.table}:${d.column}`);
    expect(tables).toContain('dw_trainer_subscriptions:user_id');
    expect(tables).toContain('dw_client_links:client_user_id');
    expect(tables).toContain('dw_push_tokens:user_id');
    expect(tables).toContain('dw_video_view_marks:user_id');
  });

  it('anonymizes the purchase-event ledger instead of deleting it', async () => {
    const store = new FakeDeleteStore();
    await handleDoWorkDeleteAccountRequest(makeRequest(), store);

    // The ledger row survives for trainer earnings math...
    expect(store.deletes.some((d) => d.table === 'dw_purchase_events')).toBe(false);
    // ...but loses the user id and the raw RevenueCat payload.
    expect(store.updates).toEqual([
      {
        table: 'dw_purchase_events',
        column: 'user_id',
        value: 'user-1',
        patch: PURCHASE_EVENT_SCRUB,
      },
    ]);
    expect(PURCHASE_EVENT_SCRUB.user_id).toBeNull();
    expect(PURCHASE_EVENT_SCRUB.raw).toEqual({ scrubbed: true, reason: 'account_deleted' });
  });

  it('includes the RevenueCat revocation note in the response', async () => {
    const store = new FakeDeleteStore();
    const res = await handleDoWorkDeleteAccountRequest(makeRequest(), store);
    const body = await res.json();
    expect(body.revenuecat).toContain('RevenueCat');
    expect(body.revenuecat).toContain('user-1');
  });
});
