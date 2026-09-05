import { NextRequest } from 'next/server';
import {
  getConfiguredOpsReadKey,
  getProvidedOpsReadKeyFromRequest,
  isOpsReadAuthorized,
} from '../ops-read-key';

const ORIGINAL_ENV = { ...process.env };

describe('ops read key helpers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MYLIFE_OPS_READ_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('allows requests when no key is configured', () => {
    expect(getConfiguredOpsReadKey()).toBeNull();
    expect(isOpsReadAuthorized(null)).toBe(true);
  });

  it('validates provided key when configured', () => {
    process.env.MYLIFE_OPS_READ_KEY = 'secret-key';

    expect(getConfiguredOpsReadKey()).toBe('secret-key');
    expect(isOpsReadAuthorized('secret-key')).toBe(true);
    expect(isOpsReadAuthorized('wrong-key')).toBe(false);
  });

  it('reads key from header first, then query string', () => {
    const withHeader = new NextRequest('http://localhost:3000/api/ops/counters?key=query-key', {
      headers: {
        'x-ops-read-key': 'header-key',
      },
    });

    const withQuery = new NextRequest('http://localhost:3000/api/ops/counters?key=query-key');

    expect(getProvidedOpsReadKeyFromRequest(withHeader)).toBe('header-key');
    expect(getProvidedOpsReadKeyFromRequest(withQuery)).toBe('query-key');
  });
});
