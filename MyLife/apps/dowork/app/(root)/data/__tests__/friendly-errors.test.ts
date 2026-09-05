// friendly-errors contract tests: raw backend strings never reach users.

import { describe, expect, it } from 'vitest';
import { friendlyError, GENERIC_ERROR, isTransientQueueError, OFFLINE_ERROR } from '../friendly-errors';

describe('friendlyError', () => {
  it('maps network failures to offline copy', () => {
    expect(friendlyError('Network request failed')).toBe(OFFLINE_ERROR);
    expect(friendlyError('TypeError: Failed to fetch')).toBe(OFFLINE_ERROR);
    expect(friendlyError('request timed out')).toBe(OFFLINE_ERROR);
  });

  it('maps auth/session failures without leaking JWT jargon', () => {
    const out = friendlyError('JWT expired');
    expect(out).not.toMatch(/jwt/i);
    expect(out).toMatch(/session/i);
    expect(friendlyError('401 Unauthorized')).toMatch(/session/i);
  });

  it('maps RLS denials without leaking policy jargon', () => {
    const out = friendlyError('new row violates row-level security policy for table "dw_comments"');
    expect(out).toBe("You don't have access to do that.");
  });

  it('maps machine error codes from our edge functions', () => {
    expect(friendlyError('not_entitled')).toMatch(/subscribers/);
    expect(friendlyError('not_found')).toMatch(/no longer available/);
  });

  it('passes through short user-facing copy untouched', () => {
    expect(friendlyError('Enter a valid email address.')).toBe('Enter a valid email address.');
    expect(friendlyError('Enter your invite code to continue.')).toBe(
      'Enter your invite code to continue.',
    );
  });

  it('falls back on long or technical strings', () => {
    expect(friendlyError('PGRST301: something about a relation and a column')).toBe(GENERIC_ERROR);
    expect(friendlyError('x'.repeat(200) + '.')).toBe(GENERIC_ERROR);
  });

  it('handles null/undefined/empty with the fallback', () => {
    expect(friendlyError(null)).toBe(GENERIC_ERROR);
    expect(friendlyError(undefined, 'Custom.')).toBe('Custom.');
    expect(friendlyError('   ')).toBe(GENERIC_ERROR);
  });
});

describe('isTransientQueueError', () => {
  it('treats network-shaped failures as transient', () => {
    expect(isTransientQueueError('Network request failed')).toBe(true);
    expect(isTransientQueueError('TypeError: Failed to fetch')).toBe(true);
    expect(isTransientQueueError('request timed out')).toBe(true);
    expect(isTransientQueueError('ECONNRESET')).toBe(true);
  });

  it('treats rate limiting as transient', () => {
    expect(isTransientQueueError('429 Too Many Requests')).toBe(true);
    expect(isTransientQueueError('rate limit exceeded')).toBe(true);
  });

  it('treats RLS/validation/conflict failures as permanent', () => {
    expect(isTransientQueueError('new row violates row-level security policy')).toBe(false);
    expect(isTransientQueueError('duplicate key value violates unique constraint')).toBe(false);
    expect(isTransientQueueError('Comment exceeds 500 characters.')).toBe(false);
  });

  it('handles null/undefined/empty as non-transient', () => {
    expect(isTransientQueueError(null)).toBe(false);
    expect(isTransientQueueError(undefined)).toBe(false);
    expect(isTransientQueueError('')).toBe(false);
    expect(isTransientQueueError('   ')).toBe(false);
  });
});
