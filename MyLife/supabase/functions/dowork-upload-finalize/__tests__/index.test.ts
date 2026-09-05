import { describe, expect, it } from 'vitest';
import {
  DOWORK_UPLOAD_RULES,
  handleDoWorkUploadRequest,
  type DoWorkFormCheckRow,
  type DoWorkTrainerVideoRow,
  type DoWorkUploadStore,
  type TrainerUploadStatus,
} from '../index.ts';

const FAKE_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1' }));
  return `${header}.${payload}.sig`;
})();

function makeRequest(body: unknown, opts: { auth?: string | null; method?: string } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? `Bearer ${FAKE_JWT}` : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/dowork-upload-finalize', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

class FakeUploadStore implements DoWorkUploadStore {
  trainer: TrainerUploadStatus | null = { id: 'trainer-1', is_active: true, is_verified: true };
  existingObjects = new Set<string>();
  signed: Array<{ bucket: string; key: string }> = [];
  insertedVideos: Array<Record<string, unknown>> = [];
  insertedFormChecks: Array<Record<string, unknown>> = [];
  avatarUpdates: Array<{ userId: string; url: string }> = [];
  participation: { isParticipant: boolean; isActive: boolean } | null = {
    isParticipant: true,
    isActive: true,
  };

  async getTrainerForUser(): Promise<TrainerUploadStatus | null> {
    return this.trainer;
  }

  async createSignedUploadUrl(bucket: string, key: string) {
    this.signed.push({ bucket, key });
    return { signedUrl: `https://storage.example/upload/${bucket}/${key}`, token: 'tok' };
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    return this.existingObjects.has(`${bucket}/${key}`);
  }

  async insertTrainerVideo(
    input: Parameters<DoWorkUploadStore['insertTrainerVideo']>[0],
  ): Promise<DoWorkTrainerVideoRow> {
    this.insertedVideos.push({ ...input });
    return {
      id: 'video-1',
      trainer_id: input.trainerId,
      exercise_slug: input.exerciseSlug,
      storage_path: input.storagePath,
      thumbnail_url: input.thumbnailUrl,
      duration_seconds: input.durationSeconds,
      angle: input.angle,
      is_primary: input.isPrimary,
      is_hidden: false,
      sort_order: input.sortOrder,
      title: input.title,
      description: input.description,
      is_premium: input.isPremium,
    };
  }

  async setProfileAvatar(userId: string, publicUrl: string): Promise<void> {
    this.avatarUpdates.push({ userId, url: publicUrl });
  }

  publicUrl(bucket: string, key: string): string {
    return `https://cdn.example/${bucket}/${key}`;
  }

  async getClientLinkParticipation(): Promise<{ isParticipant: boolean; isActive: boolean } | null> {
    return this.participation;
  }

  async insertFormCheck(
    input: Parameters<DoWorkUploadStore['insertFormCheck']>[0],
  ): Promise<DoWorkFormCheckRow> {
    this.insertedFormChecks.push({ ...input });
    return {
      id: 'form-check-1',
      client_link_id: input.clientLinkId,
      author_user_id: input.authorUserId,
      exercise_slug: input.exerciseSlug,
      storage_path: input.storagePath,
      thumbnail_path: input.thumbnailPath,
      duration_seconds: input.durationSeconds,
      note: input.note,
      status: 'pending',
      created_at: '2026-07-03T00:00:00.000Z',
    };
  }
}

function deps(
  store: FakeUploadStore,
  notify?: (type: 'new_video' | 'form_check', record: Record<string, unknown>) => Promise<void>,
) {
  let n = 0;
  return { randomId: () => `upload-${(n += 1)}`, store, notify };
}

describe('dowork-upload-finalize sign', () => {
  it('rejects missing auth', async () => {
    const res = await handleDoWorkUploadRequest(
      makeRequest({ action: 'sign' }, { auth: null }),
      deps(new FakeUploadStore()),
    );
    expect(res.status).toBe(401);
  });

  it('signs a trainer video upload into the caller folder', async () => {
    const store = new FakeUploadStore();
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'trainer_video',
        contentType: 'video/mp4',
        contentLength: 1_000_000,
      }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.bucket).toBe('dowork-trainer-videos');
    expect(body.key).toBe('user-1/videos/upload-1.mp4');
    expect(body.uploadUrl).toContain('storage.example');
  });

  it('rejects trainer uploads without a trainer profile', async () => {
    const store = new FakeUploadStore();
    store.trainer = null;
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'trainer_video',
        contentType: 'video/mp4',
        contentLength: 1_000,
      }),
      deps(store),
    );
    expect(res.status).toBe(403);
  });

  it('rejects trainer uploads for a deactivated or unverified trainer', async () => {
    for (const trainer of [
      { id: 'trainer-1', is_active: false, is_verified: true },
      { id: 'trainer-1', is_active: true, is_verified: false },
    ]) {
      const store = new FakeUploadStore();
      store.trainer = trainer;
      const res = await handleDoWorkUploadRequest(
        makeRequest({
          action: 'sign',
          kind: 'trainer_video',
          contentType: 'video/mp4',
          contentLength: 1_000,
        }),
        deps(store),
      );
      expect(res.status).toBe(403);
    }
  });

  it('enforces per-kind size caps and mime allow lists', async () => {
    const store = new FakeUploadStore();
    const tooBig = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'avatar',
        contentType: 'image/jpeg',
        contentLength: DOWORK_UPLOAD_RULES.avatar.maxBytes + 1,
      }),
      deps(store),
    );
    expect(tooBig.status).toBe(413);

    const badMime = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'avatar',
        contentType: 'video/mp4',
        contentLength: 1_000,
      }),
      deps(store),
    );
    expect(badMime.status).toBe(415);
  });
});

describe('dowork-upload-finalize finalize', () => {
  it('writes the trainer video row server-side with the bucket key', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-trainer-videos/user-1/videos/upload-1.mp4');
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'trainer_video',
        key: 'user-1/videos/upload-1.mp4',
        exerciseSlug: 'barbell-row',
        angle: 'side',
        durationSeconds: 42,
      }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.video.storage_path).toBe('user-1/videos/upload-1.mp4');
    expect(store.insertedVideos[0]?.exerciseSlug).toBe('barbell-row');
  });

  it('refuses to finalize an object that was never uploaded', async () => {
    const store = new FakeUploadStore();
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'trainer_video',
        key: 'user-1/videos/missing.mp4',
        exerciseSlug: 'barbell-row',
      }),
      deps(store),
    );
    expect(res.status).toBe(409);
  });

  it("refuses keys outside the caller's folder", async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-trainer-videos/user-2/videos/theirs.mp4');
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'trainer_video',
        key: 'user-2/videos/theirs.mp4',
        exerciseSlug: 'barbell-row',
      }),
      deps(store),
    );
    expect(res.status).toBe(403);
  });

  it('rejects invalid angles', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-trainer-videos/user-1/videos/upload-1.mp4');
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'trainer_video',
        key: 'user-1/videos/upload-1.mp4',
        exerciseSlug: 'barbell-row',
        angle: 'diagonal',
      }),
      deps(store),
    );
    expect(res.status).toBe(400);
  });

  it('updates the profile avatar URL on avatar finalize', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-avatars/user-1/avatars/upload-1.jpg');
    const res = await handleDoWorkUploadRequest(
      makeRequest({ action: 'finalize', kind: 'avatar', key: 'user-1/avatars/upload-1.jpg' }),
      deps(store),
    );
    expect(res.status).toBe(200);
    expect(store.avatarUpdates[0]?.url).toContain('dowork-avatars');
  });

  it('rejects unknown actions', async () => {
    const res = await handleDoWorkUploadRequest(
      makeRequest({ action: 'noop' }),
      deps(new FakeUploadStore()),
    );
    expect(res.status).toBe(400);
  });

  it('writes trainer-video metadata (title, description, premium flag)', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-trainer-videos/user-1/videos/upload-1.mp4');
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'trainer_video',
        key: 'user-1/videos/upload-1.mp4',
        exerciseSlug: 'barbell-row',
        title: 'Perfect Row Form',
        description: 'Keep your back flat.',
        isPremium: true,
      }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.video.title).toBe('Perfect Row Form');
    expect(body.video.is_premium).toBe(true);
    expect(store.insertedVideos[0]?.description).toBe('Keep your back flat.');
  });

  it('fires new_video notify after a published trainer video finalize', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-trainer-videos/user-1/videos/upload-1.mp4');
    const notified: Array<{ type: string; record: Record<string, unknown> }> = [];
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'trainer_video',
        key: 'user-1/videos/upload-1.mp4',
        exerciseSlug: 'barbell-row',
      }),
      deps(store, async (type, record) => {
        notified.push({ type, record });
      }),
    );
    expect(res.status).toBe(200);
    expect(notified).toHaveLength(1);
    expect(notified[0]?.type).toBe('new_video');
  });

  it('does not fail finalize when notify throws', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-trainer-videos/user-1/videos/upload-1.mp4');
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'trainer_video',
        key: 'user-1/videos/upload-1.mp4',
        exerciseSlug: 'barbell-row',
      }),
      deps(store, async () => {
        throw new Error('notify down');
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe('dowork-upload-finalize form_check', () => {
  it('signs a form-check upload into the client-link folder', async () => {
    const store = new FakeUploadStore();
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'form_check',
        clientLinkId: 'link-1',
        contentType: 'video/mp4',
        contentLength: 5_000_000,
      }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bucket).toBe('dowork-form-checks');
    expect(body.key).toBe('link-1/upload-1.mp4');
  });

  it('rejects a form-check sign without clientLinkId', async () => {
    const store = new FakeUploadStore();
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'form_check',
        contentType: 'video/mp4',
        contentLength: 5_000_000,
      }),
      deps(store),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a form-check sign for a non-participant', async () => {
    const store = new FakeUploadStore();
    store.participation = { isParticipant: false, isActive: true };
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'form_check',
        clientLinkId: 'link-1',
        contentType: 'video/mp4',
        contentLength: 5_000_000,
      }),
      deps(store),
    );
    expect(res.status).toBe(403);
  });

  it('rejects a form-check sign when the link is inactive', async () => {
    const store = new FakeUploadStore();
    store.participation = { isParticipant: true, isActive: false };
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'sign',
        kind: 'form_check',
        clientLinkId: 'link-1',
        contentType: 'video/mp4',
        contentLength: 5_000_000,
      }),
      deps(store),
    );
    expect(res.status).toBe(403);
  });

  it('finalizes a form check with a server-written row and fires notify', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-form-checks/link-1/upload-1.mp4');
    const notified: Array<{ type: string }> = [];
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'form_check',
        clientLinkId: 'link-1',
        key: 'link-1/upload-1.mp4',
        exerciseSlug: 'squat',
        note: 'Check my depth please',
        durationSeconds: 20,
      }),
      deps(store, async (type) => {
        notified.push({ type });
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.formCheck.storage_path).toBe('link-1/upload-1.mp4');
    expect(store.insertedFormChecks[0]?.note).toBe('Check my depth please');
    expect(store.insertedFormChecks[0]?.authorUserId).toBe('user-1');
    expect(notified[0]?.type).toBe('form_check');
  });

  it("refuses a form-check key outside the client-link folder", async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-form-checks/link-2/theirs.mp4');
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'form_check',
        clientLinkId: 'link-1',
        key: 'link-2/theirs.mp4',
      }),
      deps(store),
    );
    expect(res.status).toBe(403);
  });

  it('refuses to finalize a form check that was never uploaded', async () => {
    const store = new FakeUploadStore();
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'form_check',
        clientLinkId: 'link-1',
        key: 'link-1/missing.mp4',
      }),
      deps(store),
    );
    expect(res.status).toBe(409);
  });

  it('rejects a form-check finalize for a non-participant', async () => {
    const store = new FakeUploadStore();
    store.existingObjects.add('dowork-form-checks/link-1/upload-1.mp4');
    store.participation = { isParticipant: false, isActive: true };
    const res = await handleDoWorkUploadRequest(
      makeRequest({
        action: 'finalize',
        kind: 'form_check',
        clientLinkId: 'link-1',
        key: 'link-1/upload-1.mp4',
      }),
      deps(store),
    );
    expect(res.status).toBe(403);
  });
});
