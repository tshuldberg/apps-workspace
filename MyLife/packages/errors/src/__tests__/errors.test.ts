import { describe, it, expect, vi } from 'vitest';
import {
  MyLifeError,
  classifyError,
  isRetryableCategory,
  retryWithBackoff,
  toMyLifeError,
} from '../index';

describe('MyLifeError', () => {
  it('exposes category, code, and context', () => {
    const err = new MyLifeError({
      category: 'network',
      message: 'boom',
      code: 'E_FETCH',
      context: { url: 'https://example.com' },
    });
    expect(err.category).toBe('network');
    expect(err.code).toBe('E_FETCH');
    expect(err.context).toEqual({ url: 'https://example.com' });
    expect(err.isRetryable).toBe(true);
  });

  it('preserves original cause', () => {
    const root = new Error('root');
    const err = new MyLifeError({ category: 'server', message: 'wrap', cause: root });
    expect((err as Error & { cause?: unknown }).cause).toBe(root);
  });
});

describe('classifyError', () => {
  it('passes through MyLifeError category', () => {
    const err = new MyLifeError({ category: 'auth', message: 'nope' });
    expect(classifyError(err)).toBe('auth');
  });

  it('maps HTTP codes from messages', () => {
    expect(classifyError(new Error('request returned 401 unauthorized'))).toBe('auth');
    expect(classifyError(new Error('403 forbidden'))).toBe('permission');
    expect(classifyError(new Error('not found 404'))).toBe('not_found');
    expect(classifyError(new Error('server 500'))).toBe('server');
    expect(classifyError(new Error('rate limit exceeded 429'))).toBe('rate_limited');
  });

  it('detects network-style errors', () => {
    expect(classifyError(new Error('fetch failed'))).toBe('network');
    expect(classifyError(new Error('ECONNREFUSED'))).toBe('network');
  });

  it('returns unknown when no pattern matches', () => {
    expect(classifyError(new Error('something mysterious'))).toBe('unknown');
    expect(classifyError('string error')).toBe('unknown');
  });
});

describe('isRetryableCategory', () => {
  it('marks transient categories as retryable', () => {
    expect(isRetryableCategory('network')).toBe(true);
    expect(isRetryableCategory('timeout')).toBe(true);
    expect(isRetryableCategory('rate_limited')).toBe(true);
    expect(isRetryableCategory('server')).toBe(true);
  });

  it('marks intervention-requiring categories as non-retryable', () => {
    expect(isRetryableCategory('auth')).toBe(false);
    expect(isRetryableCategory('permission')).toBe(false);
    expect(isRetryableCategory('not_found')).toBe(false);
    expect(isRetryableCategory('validation')).toBe(false);
    expect(isRetryableCategory('billing')).toBe(false);
  });
});

describe('retryWithBackoff', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors up to maxAttempts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce('recovered');
    const result = await retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new MyLifeError({ category: 'auth', message: 'no' }));
    await expect(retryWithBackoff(fn, { initialDelayMs: 1 })).rejects.toMatchObject({ category: 'auth' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('honors custom shouldRetry predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    await expect(
      retryWithBackoff(fn, { maxAttempts: 5, shouldRetry: () => false, initialDelayMs: 1 }),
    ).rejects.toBeInstanceOf(MyLifeError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('toMyLifeError', () => {
  it('returns MyLifeError unchanged', () => {
    const err = new MyLifeError({ category: 'conflict', message: 'hi' });
    expect(toMyLifeError(err)).toBe(err);
  });

  it('wraps plain errors with inferred category', () => {
    const wrapped = toMyLifeError(new Error('fetch failed'));
    expect(wrapped).toBeInstanceOf(MyLifeError);
    expect(wrapped.category).toBe('network');
  });

  it('uses fallback message for non-Error values', () => {
    const wrapped = toMyLifeError({ weird: true }, 'fallback');
    expect(wrapped.message).toBe('fallback');
  });
});
