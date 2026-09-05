import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeSupabase, type MockConfig, type MockResult } from './_supabase-mock';

// Mutable controls for the mocked file-upload task (hoisted so the vi.mock
// factory can reference them).
const uploadControls = vi.hoisted(() => ({
  result: { status: 200 } as { status: number } | null,
  throws: false,
}));

vi.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 'binary' },
  createUploadTask: () => ({
    uploadAsync: async () => {
      if (uploadControls.throws) throw new Error('upload boom');
      return uploadControls.result;
    },
  }),
}));

import {
  clearPendingFeedbackQueue,
  createClientLink,
  endClientLink,
  finalizeFormCheckUpload,
  flushPendingFeedback,
  generateInviteCode,
  getClientLink,
  getFormCheck,
  getPendingFeedbackQueue,
  listClientLinks,
  listFormChecks,
  listFormFeedback,
  listMyClientLinks,
  listTrainerLibrary,
  markFormCheckReviewed,
  isTransientCoachingError,
  postFormFeedback,
  reactivateClientLink,
  redeemClientInvite,
  restorePendingFeedbackQueue,
  signFormCheckUpload,
  uploadFeedbackReply,
  uploadFormCheck,
} from '../cloud-coaching';

type InvokeReturn = { data: unknown; error: unknown };

interface CoachingMockConfig {
  responses?: MockConfig['responses'];
  rpc?: (name: string, params: unknown) => MockResult;
  invoke?: (name: string, opts: { body: Record<string, unknown> }) => InvokeReturn;
  userId?: string | null;
}

function makeCoachingSupabase(cfg: CoachingMockConfig = {}): {
  supabase: SupabaseClient;
  invoke: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
} {
  const base = makeSupabase({ responses: cfg.responses ?? {} }, { userId: cfg.userId ?? null });
  const rpc = vi.fn(async (name: string, params: unknown) =>
    cfg.rpc ? cfg.rpc(name, params) : { data: null, error: { message: `no rpc mock for ${name}` } },
  );
  const invoke = vi.fn(async (name: string, opts: { body: Record<string, unknown> }) =>
    cfg.invoke
      ? cfg.invoke(name, opts)
      : { data: null, error: { message: `no invoke mock for ${name}` } },
  );
  const supabase = {
    ...(base as unknown as Record<string, unknown>),
    rpc,
    functions: { invoke },
  } as unknown as SupabaseClient;
  return { supabase, invoke, rpc };
}

const RAW_LINK = {
  id: 'link-1',
  trainer_id: 'trainer-1',
  client_user_id: 'client-1',
  invite_code: 'ABCDEFGH2345',
  status: 'active',
  created_at: '2026-07-01T00:00:00Z',
  activated_at: '2026-07-02T00:00:00Z',
  ended_at: null,
};

afterEach(() => {
  clearPendingFeedbackQueue();
  uploadControls.result = { status: 200 };
  uploadControls.throws = false;
});

describe('generateInviteCode', () => {
  it('produces a 12-char code from the A-Z2-9 alphabet', () => {
    const code = generateInviteCode((bytes) => {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
      return bytes;
    });
    expect(code).toHaveLength(12);
    expect(code).toMatch(/^[A-Z2-9]{12}$/);
  });

  it('never emits 0, 1, O-collision digits', () => {
    const code = generateInviteCode((bytes) => {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = 200 + i;
      return bytes;
    });
    expect(code).not.toMatch(/[01]/);
  });

  it('uses global crypto by default and returns a valid code', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z2-9]{12}$/);
  });
});

describe('listClientLinks', () => {
  it('maps rows and attaches claimed client profiles', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_client_links:select': {
          data: [
            RAW_LINK,
            { ...RAW_LINK, id: 'link-2', client_user_id: null, status: 'invited' },
          ],
          error: null,
        },
        'dw_public_profiles:select': {
          data: [{ user_id: 'client-1', handle: 'ironmike', display_name: 'Mike' }],
          error: null,
        },
      },
    });
    const result = await listClientLinks(supabase, 'trainer-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.links).toHaveLength(2);
      expect(result.links[0].clientHandle).toBe('ironmike');
      expect(result.links[0].clientDisplayName).toBe('Mike');
      expect(result.links[1].clientHandle).toBeNull();
      expect(result.links[1].status).toBe('invited');
    }
  });

  it('skips the profile lookup when no invite is claimed', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_client_links:select': {
          data: [{ ...RAW_LINK, client_user_id: null, status: 'invited' }],
          error: null,
        },
      },
    });
    const result = await listClientLinks(supabase, 'trainer-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.links[0].clientHandle).toBeNull();
  });

  it('degrades gracefully when the profile lookup fails', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_client_links:select': { data: [RAW_LINK], error: null },
        'dw_public_profiles:select': { data: null, error: { message: 'boom' } },
      },
    });
    const result = await listClientLinks(supabase, 'trainer-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.links[0].clientHandle).toBeNull();
  });

  it('requires a trainer id', async () => {
    const { supabase } = makeCoachingSupabase();
    const result = await listClientLinks(supabase, '');
    expect(result.ok).toBe(false);
  });

  it('surfaces a select error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:select': { data: null, error: { message: 'denied' } } },
    });
    const result = await listClientLinks(supabase, 'trainer-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('denied');
  });
});

describe('createClientLink', () => {
  it('inserts a new invited link with a generated code', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_client_links:insert': {
          data: { ...RAW_LINK, id: 'link-new', client_user_id: null, status: 'invited' },
          error: null,
        },
      },
    });
    const result = await createClientLink(supabase, 'trainer-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.link.status).toBe('invited');
  });

  it('requires a trainer id', async () => {
    const { supabase } = makeCoachingSupabase();
    const result = await createClientLink(supabase, '');
    expect(result.ok).toBe(false);
  });

  it('surfaces an insert error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:insert': { data: null, error: { message: 'dupe code' } } },
    });
    const result = await createClientLink(supabase, 'trainer-1');
    expect(result.ok).toBe(false);
  });
});

describe('endClientLink / reactivateClientLink', () => {
  it('ends a link', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:update': { data: null, error: null } },
    });
    const result = await endClientLink(supabase, 'link-1');
    expect(result.ok).toBe(true);
  });

  it('reactivates a claimed link to active', async () => {
    let captured: unknown = null;
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_client_links:update': () => {
          captured = 'called';
          return { data: null, error: null };
        },
      },
    });
    const result = await reactivateClientLink(supabase, { id: 'link-1', clientUserId: 'client-1' });
    expect(result.ok).toBe(true);
    expect(captured).toBe('called');
  });

  it('reactivates an unclaimed link back to invited', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:update': { data: null, error: null } },
    });
    const result = await reactivateClientLink(supabase, { id: 'link-1', clientUserId: null });
    expect(result.ok).toBe(true);
  });

  it('surfaces an update error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:update': { data: null, error: { message: 'nope' } } },
    });
    const result = await endClientLink(supabase, 'link-1');
    expect(result.ok).toBe(false);
  });
});

describe('listMyClientLinks', () => {
  it('returns an empty list for an empty user id', async () => {
    const { supabase } = makeCoachingSupabase();
    const result = await listMyClientLinks(supabase, '');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.links).toEqual([]);
  });

  it('maps links with an embedded trainer object', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_client_links:select': {
          data: [
            {
              ...RAW_LINK,
              trainer: {
                id: 'trainer-1',
                display_name: 'Coach K',
                handle: 'coachk',
                headline: 'Strength',
                specialties: ['powerlifting'],
                hero_image_path: null,
                subscriber_count: 5,
                is_verified: true,
              },
            },
          ],
          error: null,
        },
      },
    });
    const result = await listMyClientLinks(supabase, 'client-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.links[0].trainer?.displayName).toBe('Coach K');
      expect(result.links[0].trainer?.specialties).toEqual(['powerlifting']);
    }
  });

  it('maps an embedded trainer delivered as an array', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_client_links:select': {
          data: [
            {
              ...RAW_LINK,
              trainer: [
                {
                  id: 'trainer-1',
                  display_name: 'Coach K',
                  handle: null,
                  headline: null,
                  specialties: null,
                  hero_image_path: null,
                  subscriber_count: null,
                  is_verified: null,
                },
              ],
            },
          ],
          error: null,
        },
      },
    });
    const result = await listMyClientLinks(supabase, 'client-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.links[0].trainer?.displayName).toBe('Coach K');
      expect(result.links[0].trainer?.specialties).toEqual([]);
      expect(result.links[0].trainer?.subscriberCount).toBe(0);
    }
  });

  it('surfaces a select error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:select': { data: null, error: { message: 'rls' } } },
    });
    const result = await listMyClientLinks(supabase, 'client-1');
    expect(result.ok).toBe(false);
  });
});

describe('redeemClientInvite', () => {
  it('redeems a valid code and returns the link id', async () => {
    const { supabase, rpc } = makeCoachingSupabase({
      rpc: () => ({ data: 'link-9', error: null }),
    });
    const result = await redeemClientInvite(supabase, ' abcd efgh '.replace(/\s/g, ''));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.linkId).toBe('link-9');
    expect(rpc).toHaveBeenCalledWith('dw_redeem_client_invite', { p_code: 'ABCDEFGH' });
  });

  it('uppercases and trims the code before calling the rpc', async () => {
    const { supabase, rpc } = makeCoachingSupabase({ rpc: () => ({ data: 'link-9', error: null }) });
    await redeemClientInvite(supabase, '  abcdefgh2345  ');
    expect(rpc).toHaveBeenCalledWith('dw_redeem_client_invite', { p_code: 'ABCDEFGH2345' });
  });

  it('rejects an empty code without calling the rpc', async () => {
    const { supabase, rpc } = makeCoachingSupabase();
    const result = await redeemClientInvite(supabase, '   ');
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces an rpc error honestly', async () => {
    const { supabase } = makeCoachingSupabase({
      rpc: () => ({ data: null, error: { message: 'invite is not redeemable' } }),
    });
    const result = await redeemClientInvite(supabase, 'ABCDEFGH2345');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invite is not redeemable');
  });

  it('rejects a non-string rpc payload', async () => {
    const { supabase } = makeCoachingSupabase({ rpc: () => ({ data: null, error: null }) });
    const result = await redeemClientInvite(supabase, 'ABCDEFGH2345');
    expect(result.ok).toBe(false);
  });
});

describe('listFormChecks', () => {
  const RAW_CHECK = {
    id: 'fc-1',
    client_link_id: 'link-1',
    author_user_id: 'client-1',
    exercise_slug: 'back-squat',
    storage_path: 'link-1/abc.mp4',
    thumbnail_path: null,
    duration_seconds: 30,
    note: 'check depth',
    status: 'pending',
    created_at: '2026-07-03T00:00:00Z',
    reviewed_at: null,
  };

  it('maps checks with a feedback count from the embed', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_checks:select': {
          data: [{ ...RAW_CHECK, dw_form_feedback: [{ count: 3 }] }],
          error: null,
        },
      },
    });
    const result = await listFormChecks(supabase, 'link-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.formChecks[0].feedbackCount).toBe(3);
      expect(result.formChecks[0].status).toBe('pending');
    }
  });

  it('defaults the feedback count to 0 when the embed is missing', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_checks:select': { data: [RAW_CHECK], error: null } },
    });
    const result = await listFormChecks(supabase, 'link-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.formChecks[0].feedbackCount).toBe(0);
  });

  it('surfaces a select error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_checks:select': { data: null, error: { message: 'rls' } } },
    });
    const result = await listFormChecks(supabase, 'link-1');
    expect(result.ok).toBe(false);
  });
});

describe('getFormCheck / getClientLink', () => {
  it('returns a form check', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_checks:select': {
          data: {
            id: 'fc-1',
            client_link_id: 'link-1',
            author_user_id: 'client-1',
            exercise_slug: null,
            storage_path: 'link-1/abc.mp4',
            thumbnail_path: null,
            duration_seconds: null,
            note: null,
            status: 'reviewed',
            created_at: '2026-07-03T00:00:00Z',
            reviewed_at: '2026-07-03T01:00:00Z',
          },
          error: null,
        },
      },
    });
    const result = await getFormCheck(supabase, 'fc-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.formCheck.status).toBe('reviewed');
  });

  it('reports a missing form check', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_checks:select': { data: null, error: null } },
    });
    const result = await getFormCheck(supabase, 'fc-x');
    expect(result.ok).toBe(false);
  });

  it('returns a client link', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:select': { data: RAW_LINK, error: null } },
    });
    const result = await getClientLink(supabase, 'link-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.link.trainerId).toBe('trainer-1');
  });

  it('reports a missing client link', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_client_links:select': { data: null, error: null } },
    });
    const result = await getClientLink(supabase, 'link-x');
    expect(result.ok).toBe(false);
  });
});

describe('listFormFeedback', () => {
  it('maps feedback rows', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_feedback:select': {
          data: [
            {
              id: 'fb-1',
              form_check_id: 'fc-1',
              author_user_id: 'trainer-1',
              body: 'knees out',
              video_timestamp_seconds: 12.5,
              reply_storage_path: null,
              created_at: '2026-07-03T02:00:00Z',
            },
          ],
          error: null,
        },
      },
    });
    const result = await listFormFeedback(supabase, 'fc-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.feedback[0].videoTimestampSeconds).toBe(12.5);
      expect(result.feedback[0].body).toBe('knees out');
    }
  });

  it('surfaces a select error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_feedback:select': { data: null, error: { message: 'rls' } } },
    });
    const result = await listFormFeedback(supabase, 'fc-1');
    expect(result.ok).toBe(false);
  });
});

describe('postFormFeedback', () => {
  const RAW_FB = {
    id: 'fb-1',
    form_check_id: 'fc-1',
    author_user_id: 'trainer-1',
    body: 'nice depth',
    video_timestamp_seconds: 8,
    reply_storage_path: null,
    created_at: '2026-07-03T02:00:00Z',
  };

  it('posts text feedback', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_feedback:insert': { data: RAW_FB, error: null } },
    });
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      body: 'nice depth',
      videoTimestampSeconds: 8,
    });
    expect(result.ok).toBe(true);
    expect(getPendingFeedbackQueue()).toHaveLength(0);
  });

  it('rejects empty feedback (no body, no reply)', async () => {
    const { supabase } = makeCoachingSupabase();
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects feedback over the length cap', async () => {
    const { supabase } = makeCoachingSupabase();
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      body: 'x'.repeat(1001),
    });
    expect(result.ok).toBe(false);
  });

  it('marks the form check reviewed when asked', async () => {
    let reviewedUpdate = false;
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_feedback:insert': { data: RAW_FB, error: null },
        'dw_form_checks:update': () => {
          reviewedUpdate = true;
          return { data: null, error: null };
        },
      },
    });
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      body: 'reviewed',
      markReviewed: true,
    });
    expect(result.ok).toBe(true);
    expect(reviewedUpdate).toBe(true);
  });

  it('queues failed text feedback for offline retry and flags it queued', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_feedback:insert': { data: null, error: { message: 'offline' } } },
    });
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'client-1',
      body: 'saved offline',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.queued).toBe(true);
    expect(getPendingFeedbackQueue()).toHaveLength(1);
    expect(getPendingFeedbackQueue()[0].body).toBe('saved offline');
  });

  it('does NOT queue a permanent server reject and says so honestly', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_feedback:insert': {
          data: null,
          error: { message: 'new row violates row-level security policy' },
        },
      },
    });
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-ended',
      authorUserId: 'client-1',
      body: 'link ended',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.queued).toBe(false);
    expect(getPendingFeedbackQueue()).toHaveLength(0);
  });

  it('classifies transport failures as transient and server verdicts as permanent', () => {
    for (const transient of [
      'Network request failed',
      'Failed to fetch',
      'request timed out',
      'The operation was aborted',
      'socket hang up',
    ]) {
      expect(isTransientCoachingError(transient)).toBe(true);
    }
    for (const permanent of [
      'new row violates row-level security policy',
      'duplicate key value violates unique constraint',
      'invalid input syntax for type uuid',
      'JWT expired',
    ]) {
      expect(isTransientCoachingError(permanent)).toBe(false);
    }
  });

  it('does NOT queue a failed video reply (online-only)', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_feedback:insert': { data: null, error: { message: 'offline' } } },
    });
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      replyStoragePath: 'link-1/reply.mp4',
    });
    expect(result.ok).toBe(false);
    expect(getPendingFeedbackQueue()).toHaveLength(0);
  });
});

describe('markFormCheckReviewed', () => {
  it('updates status', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_checks:update': { data: null, error: null } },
    });
    const result = await markFormCheckReviewed(supabase, 'fc-1');
    expect(result.ok).toBe(true);
  });

  it('surfaces an update error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_checks:update': { data: null, error: { message: 'nope' } } },
    });
    const result = await markFormCheckReviewed(supabase, 'fc-1');
    expect(result.ok).toBe(false);
  });
});

describe('listTrainerLibrary', () => {
  it('returns an empty list for an empty trainer id', async () => {
    const { supabase } = makeCoachingSupabase();
    const result = await listTrainerLibrary(supabase, '');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.videos).toEqual([]);
  });

  it('maps free and premium videos with view counts', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_trainer_videos:select': {
          data: [
            {
              id: 'v1',
              trainer_id: 'trainer-1',
              exercise_slug: 'bench',
              title: 'Bench',
              description: null,
              thumbnail_url: null,
              duration_seconds: 40,
              is_premium: true,
              view_count: 12,
              published_at: '2026-07-01T00:00:00Z',
              created_at: '2026-07-01T00:00:00Z',
            },
          ],
          error: null,
        },
      },
    });
    const result = await listTrainerLibrary(supabase, 'trainer-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.videos[0].isPremium).toBe(true);
      expect(result.videos[0].viewCount).toBe(12);
    }
  });

  it('surfaces a select error', async () => {
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_trainer_videos:select': { data: null, error: { message: 'rls' } } },
    });
    const result = await listTrainerLibrary(supabase, 'trainer-1');
    expect(result.ok).toBe(false);
  });
});

describe('signFormCheckUpload / finalizeFormCheckUpload', () => {
  const SIGN_OK = {
    ok: true,
    bucket: 'dowork-form-checks',
    key: 'link-1/abc.mp4',
    uploadUrl: 'https://upload.example.com/abc',
    token: 'tok',
    maxBytes: 500_000_000,
  };

  it('signs a form-check upload', async () => {
    const { supabase, invoke } = makeCoachingSupabase({ invoke: () => ({ data: SIGN_OK, error: null }) });
    const result = await signFormCheckUpload(supabase, {
      clientLinkId: 'link-1',
      contentType: 'video/mp4',
      contentLength: 1000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signed.key).toBe('link-1/abc.mp4');
    expect(invoke).toHaveBeenCalledWith('dowork-upload-finalize', {
      body: { action: 'sign', kind: 'form_check', clientLinkId: 'link-1', contentType: 'video/mp4', contentLength: 1000 },
    });
  });

  it('surfaces a transport error from sign', async () => {
    const { supabase } = makeCoachingSupabase({ invoke: () => ({ data: null, error: { message: 'down' } }) });
    const result = await signFormCheckUpload(supabase, {
      clientLinkId: 'link-1',
      contentType: 'video/mp4',
      contentLength: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it('surfaces an ok:false sign payload', async () => {
    const { supabase } = makeCoachingSupabase({
      invoke: () => ({ data: { ok: false, error: { kind: 'auth', message: 'no active link' } }, error: null }),
    });
    const result = await signFormCheckUpload(supabase, {
      clientLinkId: 'link-1',
      contentType: 'video/mp4',
      contentLength: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('no active link');
  });

  it('rejects an invalid sign response', async () => {
    const { supabase } = makeCoachingSupabase({ invoke: () => ({ data: { ok: true }, error: null }) });
    const result = await signFormCheckUpload(supabase, {
      clientLinkId: 'link-1',
      contentType: 'video/mp4',
      contentLength: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it('finalizes a form check', async () => {
    const { supabase } = makeCoachingSupabase({
      invoke: () => ({
        data: {
          ok: true,
          formCheck: {
            id: 'fc-1',
            client_link_id: 'link-1',
            author_user_id: 'client-1',
            exercise_slug: null,
            storage_path: 'link-1/abc.mp4',
            thumbnail_path: null,
            duration_seconds: null,
            note: null,
            status: 'pending',
            created_at: '2026-07-03T00:00:00Z',
          },
        },
        error: null,
      }),
    });
    const result = await finalizeFormCheckUpload(supabase, { clientLinkId: 'link-1', key: 'link-1/abc.mp4' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.formCheck.id).toBe('fc-1');
  });

  it('rejects an invalid finalize response', async () => {
    const { supabase } = makeCoachingSupabase({ invoke: () => ({ data: { ok: true }, error: null }) });
    const result = await finalizeFormCheckUpload(supabase, { clientLinkId: 'link-1', key: 'link-1/abc.mp4' });
    expect(result.ok).toBe(false);
  });
});

describe('uploadFormCheck', () => {
  const SIGN_OK = {
    ok: true,
    bucket: 'dowork-form-checks',
    key: 'link-1/abc.mp4',
    uploadUrl: 'https://upload.example.com/abc',
    token: null,
    maxBytes: 500_000_000,
  };
  const FINALIZE_OK = {
    ok: true,
    formCheck: {
      id: 'fc-1',
      client_link_id: 'link-1',
      author_user_id: 'client-1',
      exercise_slug: 'squat',
      storage_path: 'link-1/abc.mp4',
      thumbnail_path: null,
      duration_seconds: 30,
      note: null,
      status: 'pending',
      created_at: '2026-07-03T00:00:00Z',
    },
  };

  it('signs, uploads, and finalizes end to end', async () => {
    const { supabase, invoke } = makeCoachingSupabase({
      invoke: (_name, opts) => ({
        data: opts.body.action === 'sign' ? SIGN_OK : FINALIZE_OK,
        error: null,
      }),
    });
    const result = await uploadFormCheck(supabase, {
      clientLinkId: 'link-1',
      fileUri: 'file:///tmp/clip.mp4',
      contentType: 'video/mp4',
      contentLength: 2000,
      exerciseSlug: 'squat',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.formCheck.id).toBe('fc-1');
    // finalize invoked with the server-chosen key
    expect(invoke).toHaveBeenLastCalledWith('dowork-upload-finalize', {
      body: expect.objectContaining({ action: 'finalize', kind: 'form_check', key: 'link-1/abc.mp4' }),
    });
  });

  it('stops when signing fails', async () => {
    const { supabase } = makeCoachingSupabase({ invoke: () => ({ data: null, error: { message: 'down' } }) });
    const result = await uploadFormCheck(supabase, {
      clientLinkId: 'link-1',
      fileUri: 'file:///tmp/clip.mp4',
      contentType: 'video/mp4',
      contentLength: 2000,
    });
    expect(result.ok).toBe(false);
  });

  it('stops when the file upload fails', async () => {
    uploadControls.result = { status: 500 };
    const { supabase } = makeCoachingSupabase({ invoke: () => ({ data: SIGN_OK, error: null }) });
    const result = await uploadFormCheck(supabase, {
      clientLinkId: 'link-1',
      fileUri: 'file:///tmp/clip.mp4',
      contentType: 'video/mp4',
      contentLength: 2000,
    });
    expect(result.ok).toBe(false);
  });
});

describe('uploadFeedbackReply', () => {
  const SIGN_OK = {
    ok: true,
    bucket: 'dowork-form-checks',
    key: 'link-1/reply.mp4',
    uploadUrl: 'https://upload.example.com/reply',
    token: null,
    maxBytes: 500_000_000,
  };
  const RAW_FB = {
    id: 'fb-9',
    form_check_id: 'fc-1',
    author_user_id: 'trainer-1',
    body: null,
    video_timestamp_seconds: null,
    reply_storage_path: 'link-1/reply.mp4',
    created_at: '2026-07-03T03:00:00Z',
  };

  it('signs, uploads, and inserts a feedback row with the reply path', async () => {
    const { supabase } = makeCoachingSupabase({
      invoke: () => ({ data: SIGN_OK, error: null }),
      responses: { 'dw_form_feedback:insert': { data: RAW_FB, error: null } },
    });
    const result = await uploadFeedbackReply(supabase, {
      clientLinkId: 'link-1',
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      fileUri: 'file:///tmp/reply.mp4',
      contentType: 'video/mp4',
      contentLength: 2000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.feedback.replyStoragePath).toBe('link-1/reply.mp4');
  });

  it('stops when signing fails', async () => {
    const { supabase } = makeCoachingSupabase({ invoke: () => ({ data: null, error: { message: 'down' } }) });
    const result = await uploadFeedbackReply(supabase, {
      clientLinkId: 'link-1',
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      fileUri: 'file:///tmp/reply.mp4',
      contentType: 'video/mp4',
      contentLength: 2000,
    });
    expect(result.ok).toBe(false);
  });

  it('stops when the file upload fails', async () => {
    uploadControls.throws = true;
    const { supabase } = makeCoachingSupabase({ invoke: () => ({ data: SIGN_OK, error: null }) });
    const result = await uploadFeedbackReply(supabase, {
      clientLinkId: 'link-1',
      formCheckId: 'fc-1',
      authorUserId: 'trainer-1',
      fileUri: 'file:///tmp/reply.mp4',
      contentType: 'video/mp4',
      contentLength: 2000,
    });
    expect(result.ok).toBe(false);
  });
});

describe('offline feedback queue', () => {
  // Queue retention has a 14-day age backstop; a hardcoded createdAt rots the
  // suite once real time passes it (it did on 2026-07-17). Keep fixtures fresh.
  const RECENT_ISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  it('restore dedupes by id', () => {
    restorePendingFeedbackQueue([
      {
        id: 'p1',
        formCheckId: 'fc-1',
        authorUserId: 'client-1',
        body: 'a',
        videoTimestampSeconds: null,
        markReviewed: false,
        createdAt: RECENT_ISO,
        attempts: 0,
        lastError: null,
      },
      {
        id: 'p1',
        formCheckId: 'fc-1',
        authorUserId: 'client-1',
        body: 'dupe',
        videoTimestampSeconds: null,
        markReviewed: false,
        createdAt: RECENT_ISO,
        attempts: 0,
        lastError: null,
      },
    ]);
    expect(getPendingFeedbackQueue()).toHaveLength(1);
  });

  it('flushes queued feedback on reconnect', async () => {
    restorePendingFeedbackQueue([
      {
        id: 'p1',
        formCheckId: 'fc-1',
        authorUserId: 'client-1',
        body: 'flush me',
        videoTimestampSeconds: null,
        markReviewed: false,
        createdAt: RECENT_ISO,
        attempts: 1,
        lastError: 'offline',
      },
    ]);
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_feedback:insert': {
          data: {
            id: 'fb-1',
            form_check_id: 'fc-1',
            author_user_id: 'client-1',
            body: 'flush me',
            video_timestamp_seconds: null,
            reply_storage_path: null,
            created_at: '2026-07-03T02:00:00Z',
          },
          error: null,
        },
      },
    });
    const result = await flushPendingFeedback(supabase);
    expect(result.flushed).toBe(1);
    expect(getPendingFeedbackQueue()).toHaveLength(0);
  });

  it('re-enqueues once when a flush fails (no double enqueue)', async () => {
    // Error is RLS-shaped (permanent), not offline-shaped, so it counts
    // against the attempts cap (DL-4 distinguishes the two).
    restorePendingFeedbackQueue([
      {
        id: 'p1',
        formCheckId: 'fc-1',
        authorUserId: 'client-1',
        body: 'still rejected',
        videoTimestampSeconds: null,
        markReviewed: false,
        createdAt: RECENT_ISO,
        attempts: 1,
        lastError: 'rejected',
      },
    ]);
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_feedback:insert': {
          data: null,
          error: { message: 'new row violates row-level security policy' },
        },
      },
    });
    const result = await flushPendingFeedback(supabase);
    expect(result.failed).toBe(1);
    expect(getPendingFeedbackQueue()).toHaveLength(1);
    expect(getPendingFeedbackQueue()[0].attempts).toBe(2);
  });

  it('does not burn down attempts on a transient/offline failure (DL-4)', async () => {
    restorePendingFeedbackQueue([
      {
        id: 'p1',
        formCheckId: 'fc-1',
        authorUserId: 'client-1',
        body: 'still offline',
        videoTimestampSeconds: null,
        markReviewed: false,
        createdAt: RECENT_ISO,
        attempts: 0,
        lastError: null,
      },
    ]);
    const { supabase } = makeCoachingSupabase({
      responses: {
        'dw_form_feedback:insert': { data: null, error: { message: 'network request failed' } },
      },
    });
    for (let i = 0; i < 10; i += 1) {
      await flushPendingFeedback(supabase);
    }
    expect(getPendingFeedbackQueue()).toHaveLength(1);
    expect(getPendingFeedbackQueue()[0].attempts).toBe(0);
  });

  it('drops a poison entry once it reaches the attempts cap', async () => {
    restorePendingFeedbackQueue([
      {
        id: 'p-poison',
        formCheckId: 'fc-ended',
        authorUserId: 'client-1',
        body: 'rejected forever',
        videoTimestampSeconds: null,
        markReviewed: false,
        createdAt: RECENT_ISO,
        attempts: 4,
        lastError: 'row-level security',
      },
    ]);
    const { supabase } = makeCoachingSupabase({
      responses: { 'dw_form_feedback:insert': { data: null, error: { message: 'row-level security' } } },
    });
    const result = await flushPendingFeedback(supabase);
    expect(result.failed).toBe(1);
    expect(getPendingFeedbackQueue()).toHaveLength(0);
  });

  it('returns zero counts for an empty queue', async () => {
    const { supabase } = makeCoachingSupabase();
    const result = await flushPendingFeedback(supabase);
    expect(result).toEqual({ flushed: 0, failed: 0 });
  });
});

describe('validation and randomness guards', () => {
  it('does not queue text feedback that fails local validation', async () => {
    clearPendingFeedbackQueue();
    const { supabase } = makeCoachingSupabase();
    const result = await postFormFeedback(supabase, {
      formCheckId: 'fc-1',
      authorUserId: 'client-1',
      body: 'x'.repeat(1001),
    });
    expect(result.ok).toBe(false);
    expect(getPendingFeedbackQueue()).toHaveLength(0);
  });

  it('refuses to generate an invite code without secure randomness', () => {
    vi.stubGlobal('crypto', undefined);
    try {
      expect(() => generateInviteCode()).toThrow(/secure random/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
