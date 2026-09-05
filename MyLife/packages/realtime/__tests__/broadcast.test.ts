import { describe, it, expect } from 'vitest';
import { createBroadcastMessage, isBroadcastStale, filterOwnMessages } from '../src/broadcast';
import type { BroadcastMessage } from '../src/types';

describe('createBroadcastMessage', () => {
  it('creates proper structure', () => {
    const msg = createBroadcastMessage('table_move', { x: 10, y: 20 }, 'user-1');
    expect(msg.type).toBe('table_move');
    expect(msg.payload).toEqual({ x: 10, y: 20 });
    expect(msg.senderId).toBe('user-1');
    expect(typeof msg.timestamp).toBe('number');
    expect(msg.timestamp).toBeGreaterThan(0);
  });
});

describe('isBroadcastStale', () => {
  it('detects old messages', () => {
    const oldMsg: BroadcastMessage = {
      type: 'test',
      payload: {},
      senderId: 'user-1',
      timestamp: Date.now() - 10000,
    };
    expect(isBroadcastStale(oldMsg, 5000)).toBe(true);
  });

  it('passes fresh messages', () => {
    const freshMsg: BroadcastMessage = {
      type: 'test',
      payload: {},
      senderId: 'user-1',
      timestamp: Date.now(),
    };
    expect(isBroadcastStale(freshMsg, 5000)).toBe(false);
  });
});

describe('filterOwnMessages', () => {
  it('removes sender messages', () => {
    const messages: BroadcastMessage[] = [
      { type: 'a', payload: {}, senderId: 'user-1', timestamp: Date.now() },
      { type: 'b', payload: {}, senderId: 'user-2', timestamp: Date.now() },
      { type: 'c', payload: {}, senderId: 'user-1', timestamp: Date.now() },
    ];
    const filtered = filterOwnMessages(messages, 'user-1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].senderId).toBe('user-2');
  });
});
