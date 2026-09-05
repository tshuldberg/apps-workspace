// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseBody, EntitlementRevokeSchema, ActorIssueSchema, BundleIssueSchema } from '../api-validation';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeInvalidRequest(): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json {{{',
  });
}

describe('parseBody', () => {
  const TestSchema = z.object({ name: z.string().min(1), age: z.number().optional() });

  it('parses valid body', async () => {
    const result = await parseBody(makeRequest({ name: 'test', age: 25 }), TestSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('test');
      expect(result.data.age).toBe(25);
    }
  });

  it('rejects invalid JSON', async () => {
    const result = await parseBody(makeInvalidRequest(), TestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('rejects schema violations', async () => {
    const result = await parseBody(makeRequest({ name: '', age: 'not a number' }), TestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.issues).toBeDefined();
      expect(body.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('EntitlementRevokeSchema', () => {
  it('accepts valid revoke request', () => {
    const result = EntitlementRevokeSchema.safeParse({
      signature: 'abc123',
      reason: 'refund',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty signature', () => {
    const result = EntitlementRevokeSchema.safeParse({ signature: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing signature', () => {
    const result = EntitlementRevokeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('ActorIssueSchema', () => {
  it('accepts valid userId', () => {
    const result = ActorIssueSchema.safeParse({ userId: 'user-123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty userId', () => {
    const result = ActorIssueSchema.safeParse({ userId: '  ' });
    expect(result.success).toBe(false);
  });
});

describe('BundleIssueSchema', () => {
  it('accepts valid bundle request', () => {
    const result = BundleIssueSchema.safeParse({
      bundleId: 'bundle-1',
      eventId: 'evt-1',
      expiresInSeconds: 3600,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = BundleIssueSchema.safeParse({ bundleId: 'bundle-1' });
    expect(result.success).toBe(false);
  });

  it('rejects negative expiresInSeconds', () => {
    const result = BundleIssueSchema.safeParse({
      bundleId: 'b',
      eventId: 'e',
      expiresInSeconds: -1,
    });
    expect(result.success).toBe(false);
  });
});
