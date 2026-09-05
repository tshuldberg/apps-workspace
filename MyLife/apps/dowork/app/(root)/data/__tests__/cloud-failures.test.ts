import { describe, expect, it } from 'vitest';
import { classifyCloudWriteFailure, isTransientCloudWriteFailure } from '../cloud-failures';

describe('cloud write failure classifier', () => {
  it('classifies retryable transport and session failures as transient', () => {
    for (const failure of [
      'no_session',
      'Network request failed',
      'TypeError: Failed to fetch',
      'request timed out',
      'The operation was aborted',
      'socket hang up',
      'DNS lookup failed',
      { message: 'service unavailable', status: 503 },
      { message: 'gateway timeout', status: 504 },
      { message: 'HTTP 500 from PostgREST' },
    ]) {
      expect(classifyCloudWriteFailure(failure)).toBe('transient');
      expect(isTransientCloudWriteFailure(failure)).toBe(true);
    }
  });

  it('classifies RLS, auth, constraint, validation, and 4xx failures as permanent', () => {
    for (const failure of [
      'new row violates row-level security policy',
      'permission denied for table dw_workout_shares',
      'duplicate key value violates unique constraint',
      'new row violates check constraint',
      'invalid input syntax for type uuid',
      'JWT expired',
      { message: 'forbidden', status: 403 },
      { message: 'validation failed', status: 422 },
      { message: 'duplicate', code: '23505' },
      { message: 'invalid uuid', code: '22P02' },
      { message: 'insufficient privilege', code: '42501' },
      { message: 'unknown server verdict' },
    ]) {
      expect(classifyCloudWriteFailure(failure)).toBe('permanent');
      expect(isTransientCloudWriteFailure(failure)).toBe(false);
    }
  });
});
