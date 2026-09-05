import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { WORKOUTS_MODULE } from '../../definition';
import {
  seedWorkoutExerciseLibrary,
  createTrainer,
  getActiveTrainer,
  getTrainerById,
  deactivateTrainer,
  createExerciseVideo,
  getExerciseVideos,
  getExerciseVideoById,
  getPrimaryVideo,
  setPrimaryVideo,
  updateVideoOrder,
  deleteExerciseVideo,
  getExerciseVideoCount,
} from '../crud';

describe('@mylife/workouts - exercise videos', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;
  let trainerId: string;
  let exerciseId: string;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('workouts', WORKOUTS_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;

    seedWorkoutExerciseLibrary(db);
    exerciseId = 'push-up';

    const trainer = createTrainer(db, 'trainer-1', 'Coach Mike');
    trainerId = trainer.id;
  });

  afterEach(() => {
    closeDb();
  });

  // ── Trainer CRUD ──

  describe('trainers', () => {
    it('createTrainer inserts a trainer record', () => {
      const t = getTrainerById(db, trainerId);
      expect(t).not.toBeNull();
      expect(t!.displayName).toBe('Coach Mike');
      expect(t!.isActive).toBe(true);
    });

    it('getActiveTrainer returns the active trainer', () => {
      const t = getActiveTrainer(db);
      expect(t).not.toBeNull();
      expect(t!.id).toBe(trainerId);
    });

    it('getActiveTrainer returns null when no active trainer', () => {
      deactivateTrainer(db, trainerId);
      const t = getActiveTrainer(db);
      expect(t).toBeNull();
    });

    it('deactivateTrainer sets is_active to false', () => {
      deactivateTrainer(db, trainerId);
      const t = getTrainerById(db, trainerId);
      expect(t!.isActive).toBe(false);
    });
  });

  // ── Exercise Video CRUD ──

  describe('exercise videos', () => {
    it('createExerciseVideo inserts with correct defaults', () => {
      const v = createExerciseVideo(db, 'vid-1', {
        exerciseId,
        trainerId,
        videoUri: 'file:///test/video.mp4',
        angle: 'front',
        notes: 'Keep elbows tucked',
      });
      expect(v.id).toBe('vid-1');
      expect(v.exerciseId).toBe(exerciseId);
      expect(v.trainerId).toBe(trainerId);
      expect(v.angle).toBe('front');
      expect(v.notes).toBe('Keep elbows tucked');
      expect(v.storageType).toBe('local');
    });

    it('first video for exercise is auto-set as primary', () => {
      const v = createExerciseVideo(db, 'vid-1', {
        exerciseId,
        trainerId,
        videoUri: 'file:///test/video.mp4',
      });
      expect(v.isPrimary).toBe(true);
    });

    it('second video for exercise is NOT auto-set as primary', () => {
      createExerciseVideo(db, 'vid-1', {
        exerciseId,
        trainerId,
        videoUri: 'file:///test/video1.mp4',
      });
      const v2 = createExerciseVideo(db, 'vid-2', {
        exerciseId,
        trainerId,
        videoUri: 'file:///test/video2.mp4',
        angle: 'side',
      });
      expect(v2.isPrimary).toBe(false);
    });

    it('getExerciseVideos returns videos sorted by sort_order', () => {
      createExerciseVideo(db, 'vid-1', { exerciseId, trainerId, videoUri: 'file:///1.mp4', angle: 'front' });
      createExerciseVideo(db, 'vid-2', { exerciseId, trainerId, videoUri: 'file:///2.mp4', angle: 'side' });
      createExerciseVideo(db, 'vid-3', { exerciseId, trainerId, videoUri: 'file:///3.mp4', angle: 'back' });

      const videos = getExerciseVideos(db, exerciseId);
      expect(videos).toHaveLength(3);
      expect(videos[0].id).toBe('vid-1');
      expect(videos[1].id).toBe('vid-2');
      expect(videos[2].id).toBe('vid-3');
    });

    it('getExerciseVideos returns empty array for exercise with no videos', () => {
      const videos = getExerciseVideos(db, 'nonexistent');
      expect(videos).toEqual([]);
    });

    it('getPrimaryVideo returns the primary video', () => {
      createExerciseVideo(db, 'vid-1', { exerciseId, trainerId, videoUri: 'file:///1.mp4' });
      createExerciseVideo(db, 'vid-2', { exerciseId, trainerId, videoUri: 'file:///2.mp4', angle: 'side' });

      const primary = getPrimaryVideo(db, exerciseId);
      expect(primary).not.toBeNull();
      expect(primary!.id).toBe('vid-1');
    });

    it('getPrimaryVideo returns null when no videos exist', () => {
      const primary = getPrimaryVideo(db, exerciseId);
      expect(primary).toBeNull();
    });

    it('setPrimaryVideo changes which video is primary', () => {
      createExerciseVideo(db, 'vid-1', { exerciseId, trainerId, videoUri: 'file:///1.mp4' });
      createExerciseVideo(db, 'vid-2', { exerciseId, trainerId, videoUri: 'file:///2.mp4', angle: 'side' });

      setPrimaryVideo(db, exerciseId, 'vid-2');

      const v1 = getExerciseVideoById(db, 'vid-1');
      const v2 = getExerciseVideoById(db, 'vid-2');
      expect(v1!.isPrimary).toBe(false);
      expect(v2!.isPrimary).toBe(true);
    });

    it('updateVideoOrder reorders videos', () => {
      createExerciseVideo(db, 'vid-1', { exerciseId, trainerId, videoUri: 'file:///1.mp4' });
      createExerciseVideo(db, 'vid-2', { exerciseId, trainerId, videoUri: 'file:///2.mp4', angle: 'side' });
      createExerciseVideo(db, 'vid-3', { exerciseId, trainerId, videoUri: 'file:///3.mp4', angle: 'back' });

      updateVideoOrder(db, ['vid-3', 'vid-1', 'vid-2']);

      const videos = getExerciseVideos(db, exerciseId);
      expect(videos[0].id).toBe('vid-3');
      expect(videos[1].id).toBe('vid-1');
      expect(videos[2].id).toBe('vid-2');
    });

    it('deleteExerciseVideo removes record and returns URI', () => {
      createExerciseVideo(db, 'vid-1', { exerciseId, trainerId, videoUri: 'file:///1.mp4' });

      const deletedUri = deleteExerciseVideo(db, 'vid-1');
      expect(deletedUri).toBe('file:///1.mp4');
      expect(getExerciseVideoById(db, 'vid-1')).toBeNull();
    });

    it('deleteExerciseVideo returns null for nonexistent video', () => {
      const result = deleteExerciseVideo(db, 'nonexistent');
      expect(result).toBeNull();
    });

    it('deleting primary video promotes next video', () => {
      createExerciseVideo(db, 'vid-1', { exerciseId, trainerId, videoUri: 'file:///1.mp4' });
      createExerciseVideo(db, 'vid-2', { exerciseId, trainerId, videoUri: 'file:///2.mp4', angle: 'side' });

      deleteExerciseVideo(db, 'vid-1');

      const v2 = getExerciseVideoById(db, 'vid-2');
      expect(v2!.isPrimary).toBe(true);
    });

    it('getExerciseVideoCount returns correct count', () => {
      expect(getExerciseVideoCount(db, exerciseId)).toBe(0);

      createExerciseVideo(db, 'vid-1', { exerciseId, trainerId, videoUri: 'file:///1.mp4' });
      expect(getExerciseVideoCount(db, exerciseId)).toBe(1);

      createExerciseVideo(db, 'vid-2', { exerciseId, trainerId, videoUri: 'file:///2.mp4', angle: 'side' });
      expect(getExerciseVideoCount(db, exerciseId)).toBe(2);
    });

    it('videos for different exercises are independent', () => {
      createExerciseVideo(db, 'vid-1', { exerciseId: 'push-up', trainerId, videoUri: 'file:///1.mp4' });
      createExerciseVideo(db, 'vid-2', { exerciseId: 'pull-up', trainerId, videoUri: 'file:///2.mp4' });

      expect(getExerciseVideoCount(db, 'push-up')).toBe(1);
      expect(getExerciseVideoCount(db, 'pull-up')).toBe(1);
      expect(getExerciseVideos(db, 'push-up')[0].id).toBe('vid-1');
      expect(getExerciseVideos(db, 'pull-up')[0].id).toBe('vid-2');
    });
  });
});
