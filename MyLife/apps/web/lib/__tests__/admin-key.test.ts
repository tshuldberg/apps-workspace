import { describe, it, expect } from 'vitest';
import { assertAdminKey } from '../admin-key';

describe('assertAdminKey', () => {
  it('accepts a correct key with constant-time comparison', () => {
    const result = assertAdminKey({
      provided: 'secret123',
      expected: 'secret123',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a wrong key of equal length with 401', async () => {
    const result = assertAdminKey({
      provided: 'wrong1234',
      expected: 'secret123',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = (await result.response.json()) as { error: string };
      expect(body.error).toMatch(/Invalid/);
    }
  });

  it('rejects a wrong-length key with 401 (not 400) to avoid length oracle', async () => {
    const result = assertAdminKey({
      provided: 'x',
      expected: 'secret123',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('rejects a missing header with 401', async () => {
    const result = assertAdminKey({
      provided: null,
      expected: 'secret123',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('rejects non-string provided values as empty', async () => {
    const result = assertAdminKey({
      provided: undefined,
      expected: 'secret123',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('fails closed with 503 when the server secret is not configured', async () => {
    const result = assertAdminKey({
      provided: 'anything',
      expected: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
    }
  });

  it('fails closed with 503 when the server secret is empty', async () => {
    const result = assertAdminKey({ provided: 'anything', expected: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
    }
  });

  it('includes the custom label in the error message', async () => {
    const result = assertAdminKey({
      provided: 'nope',
      expected: 'secret123',
      label: 'entitlement issuer key',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = (await result.response.json()) as { error: string };
      expect(body.error).toContain('entitlement issuer key');
    }
  });
});
