import { describe, expect, it } from 'vitest';
import {
  createMemoryTimeTrackerStorage,
  getActiveTimer,
  getTimerElapsedMs,
  pauseTimer,
  startTimer,
  stopTimer,
} from '../engine/time-tracker';

describe('time tracker engine', () => {
  it('starts and reports an active running timer', async () => {
    const storage = createMemoryTimeTrackerStorage();
    await startTimer(storage, 'asg-1', 1_000);

    const active = await getActiveTimer(storage, 61_000);
    expect(active).not.toBeNull();
    expect(active?.assignment_id).toBe('asg-1');
    expect(active?.is_running).toBe(true);
    expect(active?.elapsed_minutes).toBe(1);
  });

  it('pauses a timer and preserves elapsed time while paused', async () => {
    const storage = createMemoryTimeTrackerStorage();
    await startTimer(storage, 'asg-1', 0);

    const paused = await pauseTimer(storage, 95_000);
    expect(paused?.is_running).toBe(false);
    expect(paused?.elapsed_ms).toBe(95_000);

    const active = await getActiveTimer(storage, 180_000);
    expect(active?.elapsed_ms).toBe(95_000);
    expect(active?.elapsed_minutes).toBe(2);
  });

  it('resumes the same assignment from accumulated time', async () => {
    const storage = createMemoryTimeTrackerStorage();
    await startTimer(storage, 'asg-1', 0);
    await pauseTimer(storage, 60_000);

    const resumed = await startTimer(storage, 'asg-1', 120_000);
    expect(resumed.replaced).toBeNull();

    const active = await getActiveTimer(storage, 180_000);
    expect(active?.elapsed_ms).toBe(120_000);
    expect(active?.elapsed_minutes).toBe(2);
  });

  it('replaces a different active assignment when starting a new timer', async () => {
    const storage = createMemoryTimeTrackerStorage();
    await startTimer(storage, 'asg-1', 0);

    const next = await startTimer(storage, 'asg-2', 30_000);
    expect(next.replaced?.assignment_id).toBe('asg-1');
    expect(next.replaced?.elapsed_ms).toBe(30_000);
    expect(next.active.assignment_id).toBe('asg-2');
    expect(next.active.elapsed_ms).toBe(0);
  });

  it('stops and clears the active timer', async () => {
    const storage = createMemoryTimeTrackerStorage();
    await startTimer(storage, 'asg-1', 0);

    const stopped = await stopTimer(storage, 121_000);
    expect(stopped?.assignment_id).toBe('asg-1');
    expect(stopped?.elapsed_minutes).toBe(2);

    const active = await getActiveTimer(storage, 122_000);
    expect(active).toBeNull();
  });

  it('computes elapsed milliseconds from raw timer state', () => {
    expect(
      getTimerElapsedMs({
        accumulated_ms: 30_000,
        is_running: true,
        started_at_ms: 100_000,
      }, 160_000),
    ).toBe(90_000);
  });
});
