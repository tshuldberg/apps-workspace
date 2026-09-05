import { describe, expect, it } from 'vitest';
import {
  handleDoWorkPlaybackUrlRequest,
  SIGN_TTL_SECONDS,
  type ClientLinkRow,
  type FormCheckRow,
  type FormFeedbackRow,
  type PlaybackStore,
  type TrainerStatusRow,
  type TrainerVideoRow,
} from '../index.ts';

const NOW = Date.parse('2026-07-03T12:30:00.000Z');

function jwtFor(sub: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub }));
  return `${header}.${payload}.sig`;
}

function makeRequest(
  body: unknown,
  opts: { sub?: string; auth?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const auth = opts.auth === undefined ? `Bearer ${jwtFor(opts.sub ?? 'user-1')}` : opts.auth;
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/functions/dowork-playback-url', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function video(overrides: Partial<TrainerVideoRow> = {}): TrainerVideoRow {
  return {
    id: 'video-1',
    trainer_id: 'trainer-1',
    storage_path: 'user-t/videos/v.mp4',
    is_premium: true,
    is_hidden: false,
    title: 'Bench Press',
    duration_seconds: 120,
    ...overrides,
  };
}

class FakePlaybackStore implements PlaybackStore {
  videoRow: TrainerVideoRow | null = video();
  trainerStatus: TrainerStatusRow | null = {
    user_id: 'trainer-user',
    is_active: true,
    is_verified: true,
  };
  paidSubscription = false;
  activeClientLink = false;
  formCheckRow: FormCheckRow | null = null;
  clientLinkRow: ClientLinkRow | null = null;
  feedbackRow: FormFeedbackRow | null = null;
  signed: Array<{ bucket: string; key: string }> = [];
  viewMarks = new Set<string>();
  viewCountBumps: string[] = [];

  async getTrainerVideo(): Promise<TrainerVideoRow | null> {
    return this.videoRow;
  }

  async getTrainerStatus(): Promise<TrainerStatusRow | null> {
    return this.trainerStatus;
  }

  async hasPaidSubscription(): Promise<boolean> {
    return this.paidSubscription;
  }

  async hasActiveClientLink(): Promise<boolean> {
    return this.activeClientLink;
  }

  async getFormCheck(): Promise<FormCheckRow | null> {
    return this.formCheckRow;
  }

  async getClientLink(): Promise<ClientLinkRow | null> {
    return this.clientLinkRow;
  }

  async getFormFeedback(): Promise<FormFeedbackRow | null> {
    return this.feedbackRow;
  }

  async createSignedUrl(bucket: string, key: string): Promise<string> {
    this.signed.push({ bucket, key });
    return `https://storage.example/sign/${bucket}/${key}`;
  }

  async markView(userId: string, videoId: string, hourBucketIso: string): Promise<boolean> {
    const marker = `${userId}:${videoId}:${hourBucketIso}`;
    if (this.viewMarks.has(marker)) return false;
    this.viewMarks.add(marker);
    return true;
  }

  async incrementViewCount(videoId: string): Promise<void> {
    this.viewCountBumps.push(videoId);
  }
}

function deps(store: FakePlaybackStore, now: number = NOW) {
  return { store, now: () => now };
}

describe('dowork-playback-url auth + input', () => {
  it('rejects missing auth', async () => {
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { auth: null }),
      deps(new FakePlaybackStore()),
    );
    expect(res.status).toBe(401);
  });

  it('rejects non-POST', async () => {
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({}, { method: 'GET' }),
      deps(new FakePlaybackStore()),
    );
    expect(res.status).toBe(405);
  });

  it('rejects when neither videoId nor formCheckId is provided', async () => {
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({}),
      deps(new FakePlaybackStore()),
    );
    expect(res.status).toBe(400);
  });

  it('rejects when both videoId and formCheckId are provided', async () => {
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1', formCheckId: 'fc-1' }),
      deps(new FakePlaybackStore()),
    );
    expect(res.status).toBe(400);
  });
});

describe('dowork-playback-url trainer video entitlement', () => {
  it('grants a free video to anyone', async () => {
    const store = new FakePlaybackStore();
    store.videoRow = video({ is_premium: false });
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'random-user' }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('trainer_video');
    expect(body.title).toBe('Bench Press');
    expect(body.durationSeconds).toBe(120);
    expect(body.expiresAt).toBe(new Date(NOW + SIGN_TTL_SECONDS * 1000).toISOString());
    expect(store.signed[0]?.bucket).toBe('dowork-trainer-videos');
  });

  it('grants a premium video to the owning trainer', async () => {
    const store = new FakePlaybackStore();
    store.trainerStatus = { user_id: 'owner-1', is_active: true, is_verified: true };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'owner-1' }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });

  it('grants a premium video to an active subscriber', async () => {
    const store = new FakePlaybackStore();
    store.paidSubscription = true;
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'subscriber-1' }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });

  it('grants a premium video to an active client link', async () => {
    const store = new FakePlaybackStore();
    store.activeClientLink = true;
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'client-1' }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });

  it('denies a premium video to an unentitled user', async () => {
    const store = new FakePlaybackStore();
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'nobody' }),
      deps(store),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('not_entitled');
  });

  it('denies free, subscriber, and client-link paths when the trainer is deactivated', async () => {
    for (const setup of ['free', 'subscription', 'client-link'] as const) {
      const store = new FakePlaybackStore();
      store.trainerStatus = { user_id: 'trainer-user', is_active: false, is_verified: true };
      if (setup === 'free') store.videoRow = video({ is_premium: false });
      if (setup === 'subscription') store.paidSubscription = true;
      if (setup === 'client-link') store.activeClientLink = true;
      const res = await handleDoWorkPlaybackUrlRequest(
        makeRequest({ videoId: 'video-1' }, { sub: 'viewer-1' }),
        deps(store),
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('not_entitled');
    }
  });

  it('denies serving paths when the trainer is unverified', async () => {
    const store = new FakePlaybackStore();
    store.trainerStatus = { user_id: 'trainer-user', is_active: true, is_verified: false };
    store.paidSubscription = true;
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'subscriber-1' }),
      deps(store),
    );
    expect(res.status).toBe(403);
  });

  it('still grants owner preview to a deactivated trainer', async () => {
    const store = new FakePlaybackStore();
    store.trainerStatus = { user_id: 'owner-1', is_active: false, is_verified: false };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'owner-1' }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });

  it('404s when the trainer row is missing entirely', async () => {
    const store = new FakePlaybackStore();
    store.trainerStatus = null;
    store.videoRow = video({ is_premium: false });
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'viewer-1' }),
      deps(store),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for a missing video', async () => {
    const store = new FakePlaybackStore();
    store.videoRow = null;
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }),
      deps(store),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for a hidden video', async () => {
    const store = new FakePlaybackStore();
    store.videoRow = video({ is_premium: false, is_hidden: true });
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }),
      deps(store),
    );
    expect(res.status).toBe(404);
  });
});

describe('dowork-playback-url view dedup', () => {
  it('bumps the view count once, then not again within the same hour', async () => {
    const store = new FakePlaybackStore();
    store.videoRow = video({ is_premium: false });

    await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'viewer-1' }),
      deps(store, NOW),
    );
    expect(store.viewCountBumps).toEqual(['video-1']);

    // Same hour -> no second bump.
    await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'viewer-1' }),
      deps(store, NOW + 60_000),
    );
    expect(store.viewCountBumps).toEqual(['video-1']);

    // Next hour -> bumps again.
    await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'viewer-1' }),
      deps(store, NOW + 3_600_000),
    );
    expect(store.viewCountBumps).toEqual(['video-1', 'video-1']);
  });

  it('never fails playback when view accounting throws', async () => {
    const store = new FakePlaybackStore();
    store.videoRow = video({ is_premium: false });
    store.markView = async () => {
      throw new Error('view mark down');
    };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ videoId: 'video-1' }, { sub: 'viewer-1' }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });
});

describe('dowork-playback-url form checks', () => {
  const formCheck: FormCheckRow = {
    id: 'fc-1',
    client_link_id: 'link-1',
    storage_path: 'link-1/fc.mp4',
    duration_seconds: 30,
    note: 'Depth check',
  };
  const link: ClientLinkRow = {
    id: 'link-1',
    trainer_id: 'trainer-1',
    client_user_id: 'client-1',
    status: 'active',
  };

  it('grants the client access to a form check', async () => {
    const store = new FakePlaybackStore();
    store.formCheckRow = formCheck;
    store.clientLinkRow = link;
    store.trainerStatus = { user_id: 'trainer-user', is_active: true, is_verified: true };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ formCheckId: 'fc-1' }, { sub: 'client-1' }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('form_check');
    expect(body.title).toBe('Depth check');
    expect(store.signed[0]?.bucket).toBe('dowork-form-checks');
  });

  it('grants the trainer access to a form check', async () => {
    const store = new FakePlaybackStore();
    store.formCheckRow = formCheck;
    store.clientLinkRow = link;
    store.trainerStatus = { user_id: 'trainer-user', is_active: true, is_verified: true };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ formCheckId: 'fc-1' }, { sub: 'trainer-user' }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });

  it('keeps form-check access for a deactivated trainer (participation, not serving)', async () => {
    const store = new FakePlaybackStore();
    store.formCheckRow = formCheck;
    store.clientLinkRow = link;
    store.trainerStatus = { user_id: 'trainer-user', is_active: false, is_verified: false };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ formCheckId: 'fc-1' }, { sub: 'trainer-user' }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });

  it('denies a non-participant', async () => {
    const store = new FakePlaybackStore();
    store.formCheckRow = formCheck;
    store.clientLinkRow = link;
    store.trainerStatus = { user_id: 'trainer-user', is_active: true, is_verified: true };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ formCheckId: 'fc-1' }, { sub: 'intruder' }),
      deps(store),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('not_entitled');
  });

  it('signs a feedback reply video for a participant', async () => {
    const store = new FakePlaybackStore();
    store.formCheckRow = formCheck;
    store.clientLinkRow = link;
    store.trainerStatus = { user_id: 'trainer-user', is_active: true, is_verified: true };
    store.feedbackRow = {
      id: 'fb-1',
      form_check_id: 'fc-1',
      reply_storage_path: 'link-1/reply.mp4',
    };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ formCheckId: 'fc-1', feedbackId: 'fb-1', part: 'reply' }, { sub: 'client-1' }),
      deps(store),
    );
    expect(res.status).toBe(200);
    expect(store.signed[0]?.key).toBe('link-1/reply.mp4');
    const body = await res.json();
    expect(body.title).toBeNull();
  });

  it('404s when a feedback reply belongs to a different form check', async () => {
    const store = new FakePlaybackStore();
    store.formCheckRow = formCheck;
    store.clientLinkRow = link;
    store.trainerStatus = { user_id: 'trainer-user', is_active: true, is_verified: true };
    store.feedbackRow = {
      id: 'fb-1',
      form_check_id: 'other-fc',
      reply_storage_path: 'link-1/reply.mp4',
    };
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ formCheckId: 'fc-1', feedbackId: 'fb-1' }, { sub: 'client-1' }),
      deps(store),
    );
    expect(res.status).toBe(404);
  });

  it('404s when the form check is missing', async () => {
    const store = new FakePlaybackStore();
    store.formCheckRow = null;
    const res = await handleDoWorkPlaybackUrlRequest(
      makeRequest({ formCheckId: 'fc-1' }, { sub: 'client-1' }),
      deps(store),
    );
    expect(res.status).toBe(404);
  });
});
