// Plan 38 Phase 6 (MOBILE): device-local music queue reducer tests.

import { describe, it, expect } from 'vitest';
import {
  EMPTY_QUEUE,
  musicQueueReducer,
  currentTrack,
  hasNext,
  hasPrevious,
  type QueueTrack,
} from './music-queue-core';

function track(id: string): QueueTrack {
  return { itemId: id, channelId: 'ch', communityId: 'ws', title: `T ${id}`, artist: null, durationMs: 1000 };
}

const A = track('a');
const B = track('b');
const C = track('c');

describe('musicQueueReducer', () => {
  it('set replaces the queue and clamps the start index', () => {
    expect(musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [A, B, C] })).toEqual({ tracks: [A, B, C], index: 0 });
    expect(musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [A, B], startIndex: 1 }).index).toBe(1);
    expect(musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [A, B], startIndex: 9 }).index).toBe(1);
    expect(musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [], startIndex: 0 })).toEqual(EMPTY_QUEUE);
  });

  it('enqueue appends and starts an empty queue', () => {
    const started = musicQueueReducer(EMPTY_QUEUE, { type: 'enqueue', track: A });
    expect(started).toEqual({ tracks: [A], index: 0 });
    const appended = musicQueueReducer(started, { type: 'enqueue', track: B });
    expect(appended).toEqual({ tracks: [A, B], index: 0 });
  });

  it('next / previous move without wrapping and stop honestly at the ends', () => {
    let s = musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [A, B, C] });
    expect(musicQueueReducer(s, { type: 'previous' }).index).toBe(0); // already at start
    s = musicQueueReducer(s, { type: 'next' });
    expect(s.index).toBe(1);
    s = musicQueueReducer(s, { type: 'next' });
    expect(s.index).toBe(2);
    expect(musicQueueReducer(s, { type: 'next' }).index).toBe(2); // no wrap at end
    expect(musicQueueReducer(s, { type: 'previous' }).index).toBe(1);
  });

  it('jump clamps and clear empties', () => {
    const s = musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [A, B, C] });
    expect(musicQueueReducer(s, { type: 'jump', index: 2 }).index).toBe(2);
    expect(musicQueueReducer(s, { type: 'jump', index: -5 }).index).toBe(0);
    expect(musicQueueReducer(s, { type: 'clear' })).toEqual(EMPTY_QUEUE);
  });

  it('never mutates the input state', () => {
    const s = musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [A, B] });
    const before = JSON.stringify(s);
    musicQueueReducer(s, { type: 'next' });
    musicQueueReducer(s, { type: 'enqueue', track: C });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('selectors', () => {
  it('currentTrack / hasNext / hasPrevious', () => {
    expect(currentTrack(EMPTY_QUEUE)).toBeNull();
    expect(hasNext(EMPTY_QUEUE)).toBe(false);
    expect(hasPrevious(EMPTY_QUEUE)).toBe(false);

    const s = musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: [A, B, C], startIndex: 1 });
    expect(currentTrack(s)).toEqual(B);
    expect(hasNext(s)).toBe(true);
    expect(hasPrevious(s)).toBe(true);

    const last = musicQueueReducer(s, { type: 'jump', index: 2 });
    expect(hasNext(last)).toBe(false);
    expect(hasPrevious(last)).toBe(true);
  });
});
