import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError, isTimeoutError, withTimeout } from '../async-timeout';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when the operation completes before the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ready'), 100, 'too slow')).resolves.toBe('ready');
  });

  it('rejects with TimeoutError when the operation exceeds the deadline', async () => {
    vi.useFakeTimers();

    const result = withTimeout(new Promise<string>(() => {}), 100, 'too slow').catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(100);
    const error = await result;

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toMatchObject({ name: 'TimeoutError', message: 'too slow' });
  });

  it('preserves the original rejection when it happens first', async () => {
    const error = new Error('backend rejected');
    await expect(withTimeout(Promise.reject(error), 100, 'too slow')).rejects.toBe(error);
  });
});

describe('isTimeoutError', () => {
  it('recognizes TimeoutError instances and compatible errors', () => {
    expect(isTimeoutError(new TimeoutError('slow'))).toBe(true);
    const compatible = new Error('slow');
    compatible.name = 'TimeoutError';
    expect(isTimeoutError(compatible)).toBe(true);
    expect(isTimeoutError(new Error('other'))).toBe(false);
  });
});
