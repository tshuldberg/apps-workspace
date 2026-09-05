// DoWork cloud-trainer-videos contract tests.

import { describe, expect, it } from 'vitest';
import {
  deleteTrainerVideo,
  listExerciseTrainerRail,
  listPublicTrainerVideos,
  listTrainerVideos,
  listTrainerVideosForExercise,
  setPrimaryTrainerVideo,
  setTrainerVideoHidden,
  updateTrainerVideoMeta,
  uploadTrainerVideo,
} from '../cloud-trainer-videos';
import { makeSupabase } from './_supabase-mock';

const SAMPLE_RAW = {
  id: 'v1',
  trainer_id: 't1',
  exercise_slug: 'barbell-bench-press',
  storage_path: 'videos/v1.mp4',
  thumbnail_url: null,
  duration_seconds: 30,
  angle: 'front',
  is_primary: false,
  is_hidden: false,
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('cloud-trainer-videos', () => {
  describe('uploadTrainerVideo', () => {
    it('rejects an empty exerciseSlug', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await uploadTrainerVideo(supabase, '   ', {
        trainerId: 't1',
        storagePath: 'videos/x.mp4',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects missing trainerId or storagePath', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await uploadTrainerVideo(supabase, 'bench', {
        trainerId: '',
        storagePath: '',
      });
      expect(result.ok).toBe(false);
    });

    it('inserts on happy path', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:insert': { data: SAMPLE_RAW, error: null },
        },
      });
      const result = await uploadTrainerVideo(supabase, 'barbell-bench-press', {
        trainerId: 't1',
        storagePath: 'videos/v1.mp4',
        durationSeconds: 30,
        angle: 'front',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.video.id).toBe('v1');
        expect(result.video.exerciseSlug).toBe('barbell-bench-press');
        expect(result.video.angle).toBe('front');
      }
    });

    it('returns the error when supabase insert fails', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:insert': { data: null, error: { message: 'rls denied' } },
        },
      });
      const result = await uploadTrainerVideo(supabase, 'bench', {
        trainerId: 't1',
        storagePath: 'videos/v.mp4',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('rls denied');
    });
  });

  describe('listTrainerVideosForExercise', () => {
    it('returns hydrated rows on happy path', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:select': { data: [SAMPLE_RAW], error: null },
        },
      });
      const result = await listTrainerVideosForExercise(supabase, 'barbell-bench-press');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.videos).toHaveLength(1);
        expect(result.videos[0]?.exerciseSlug).toBe('barbell-bench-press');
      }
    });

    it('propagates the supabase error', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:select': { data: null, error: { message: 'broke' } },
        },
      });
      const result = await listTrainerVideosForExercise(supabase, 'bench');
      expect(result.ok).toBe(false);
    });
  });

  describe('deleteTrainerVideo', () => {
    it('returns ok on happy path', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:delete': { data: null, error: null },
        },
      });
      const result = await deleteTrainerVideo(supabase, 'v1');
      expect(result.ok).toBe(true);
    });
  });

  describe('setPrimaryTrainerVideo', () => {
    it('demotes existing primary then promotes the new one', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:update': { data: null, error: null },
        },
      });
      const result = await setPrimaryTrainerVideo(supabase, 'bench', 'v1');
      expect(result.ok).toBe(true);
    });

    it('returns the error when demote fails', async () => {
      let calls = 0;
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:update': () => {
            calls += 1;
            return calls === 1
              ? { data: null, error: { message: 'denied' } }
              : { data: null, error: null };
          },
        },
      });
      const result = await setPrimaryTrainerVideo(supabase, 'bench', 'v1');
      expect(result.ok).toBe(false);
    });
  });

  describe('listTrainerVideos (manage grid)', () => {
    it('requires a trainer id', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await listTrainerVideos(supabase, '');
      expect(result.ok).toBe(false);
    });

    it('maps every row including the new metadata columns', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:select': {
            data: [{ ...SAMPLE_RAW, title: 'Bench setup', is_premium: true, view_count: 12, published_at: '2026-02-01T00:00:00Z' }],
            error: null,
          },
        },
      });
      const result = await listTrainerVideos(supabase, 't1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.videos[0]?.title).toBe('Bench setup');
        expect(result.videos[0]?.isPremium).toBe(true);
        expect(result.videos[0]?.viewCount).toBe(12);
      }
    });

    it('propagates the supabase error', async () => {
      const supabase = makeSupabase({
        responses: { 'dw_trainer_videos:select': { data: null, error: { message: 'broke' } } },
      });
      const result = await listTrainerVideos(supabase, 't1');
      expect(result.ok).toBe(false);
    });
  });

  describe('listPublicTrainerVideos', () => {
    it('maps visible rows', async () => {
      const supabase = makeSupabase({
        responses: { 'dw_trainer_videos:select': { data: [SAMPLE_RAW], error: null } },
      });
      const result = await listPublicTrainerVideos(supabase, 't1');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.videos).toHaveLength(1);
    });
  });

  describe('listExerciseTrainerRail', () => {
    it('keeps verified active trainers and attaches attribution', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:select': {
            data: [
              { ...SAMPLE_RAW, id: 'v1', trainer: { display_name: 'Marcus', handle: 'marcus', is_active: true, is_verified: true } },
              { ...SAMPLE_RAW, id: 'v2', trainer: { display_name: 'Ghost', handle: 'ghost', is_active: false, is_verified: true } },
              { ...SAMPLE_RAW, id: 'v3', trainer: null },
            ],
            error: null,
          },
        },
      });
      const result = await listExerciseTrainerRail(supabase, 'barbell-bench-press');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.videos).toHaveLength(1);
        expect(result.videos[0]?.id).toBe('v1');
        expect(result.videos[0]?.trainerName).toBe('Marcus');
        expect(result.videos[0]?.trainerHandle).toBe('marcus');
      }
    });

    it('propagates the supabase error', async () => {
      const supabase = makeSupabase({
        responses: { 'dw_trainer_videos:select': { data: null, error: { message: 'broke' } } },
      });
      const result = await listExerciseTrainerRail(supabase, 'bench');
      expect(result.ok).toBe(false);
    });
  });

  describe('updateTrainerVideoMeta', () => {
    it('requires a video id', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await updateTrainerVideoMeta(supabase, '', { title: 'x' });
      expect(result.ok).toBe(false);
    });

    it('rejects an empty exercise slug', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await updateTrainerVideoMeta(supabase, 'v1', { exerciseSlug: '  ' });
      expect(result.ok).toBe(false);
    });

    it('writes the metadata patch', async () => {
      const supabase = makeSupabase({
        responses: {
          'dw_trainer_videos:update': {
            data: { ...SAMPLE_RAW, title: 'Cue: brace', is_premium: true },
            error: null,
          },
        },
      });
      const result = await updateTrainerVideoMeta(supabase, 'v1', {
        title: 'Cue: brace',
        description: 'Set the lats first',
        isPremium: true,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.video.title).toBe('Cue: brace');
        expect(result.video.isPremium).toBe(true);
      }
    });

    it('propagates the supabase error', async () => {
      const supabase = makeSupabase({
        responses: { 'dw_trainer_videos:update': { data: null, error: { message: 'denied' } } },
      });
      const result = await updateTrainerVideoMeta(supabase, 'v1', { title: 'x' });
      expect(result.ok).toBe(false);
    });
  });

  describe('setTrainerVideoHidden', () => {
    it('requires a video id', async () => {
      const supabase = makeSupabase({ responses: {} });
      const result = await setTrainerVideoHidden(supabase, '', true);
      expect(result.ok).toBe(false);
    });

    it('toggles the hidden flag', async () => {
      const supabase = makeSupabase({
        responses: { 'dw_trainer_videos:update': { data: null, error: null } },
      });
      const result = await setTrainerVideoHidden(supabase, 'v1', true);
      expect(result.ok).toBe(true);
    });

    it('propagates the supabase error', async () => {
      const supabase = makeSupabase({
        responses: { 'dw_trainer_videos:update': { data: null, error: { message: 'denied' } } },
      });
      const result = await setTrainerVideoHidden(supabase, 'v1', false);
      expect(result.ok).toBe(false);
    });
  });
});
