import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  initManhattanClient,
  getManhattanClient,
  resetManhattanClient,
  hasManhattanClient,
} from '../client';

const fakeClient = {} as SupabaseClient;

describe('manhattan cloud client singleton', () => {
  beforeEach(() => {
    resetManhattanClient();
  });

  it('throws before initialization with a clear message', () => {
    expect(() => getManhattanClient()).toThrow(
      'Manhattan client not initialized. Call initManhattanClient() first.',
    );
  });

  it('returns the same instance after initialization', () => {
    initManhattanClient(fakeClient);
    expect(getManhattanClient()).toBe(fakeClient);
    expect(getManhattanClient()).toBe(fakeClient);
  });

  it('reflects state via hasManhattanClient', () => {
    expect(hasManhattanClient()).toBe(false);
    initManhattanClient(fakeClient);
    expect(hasManhattanClient()).toBe(true);
  });

  it('clears the client with resetManhattanClient', () => {
    initManhattanClient(fakeClient);
    expect(hasManhattanClient()).toBe(true);
    resetManhattanClient();
    expect(hasManhattanClient()).toBe(false);
    expect(() => getManhattanClient()).toThrow(
      'Manhattan client not initialized. Call initManhattanClient() first.',
    );
  });
});
