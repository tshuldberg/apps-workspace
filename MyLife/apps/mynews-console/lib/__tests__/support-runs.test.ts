import { describe, expect, it } from 'vitest';
import { supportRunLabel } from '../support-runs';

const NOW = Date.parse('2026-07-30T12:00:00.000Z');

function run(overrides: Partial<Parameters<typeof supportRunLabel>[0]> = {}) {
  return {
    ok: true,
    finishedAt: '2026-07-30T12:00:00.000Z',
    mismatchCount: 0,
    findings: [] as string[],
    ...overrides,
  };
}

describe('supportRunLabel', () => {
  it('never labels a failing run as reconciled', () => {
    expect(supportRunLabel(run({ ok: true }), NOW).outcome).toBe('reconciled');
    expect(supportRunLabel(run({ ok: false, mismatchCount: 2 }), NOW).outcome).toBe('MISMATCH');
  });

  it('counts mismatches with correct grammar', () => {
    expect(supportRunLabel(run({ mismatchCount: 0 }), NOW).mismatches).toBe(
      '0 invariant violations',
    );
    expect(supportRunLabel(run({ mismatchCount: 1 }), NOW).mismatches).toBe(
      '1 invariant violation',
    );
    expect(supportRunLabel(run({ mismatchCount: 7 }), NOW).mismatches).toBe(
      '7 invariant violations',
    );
  });

  it('renders ages in minutes, hours, and days', () => {
    expect(supportRunLabel(run({ finishedAt: '2026-07-30T11:30:00.000Z' }), NOW).age).toBe(
      '30m ago',
    );
    expect(supportRunLabel(run({ finishedAt: '2026-07-30T09:00:00.000Z' }), NOW).age).toBe(
      '3h ago',
    );
    expect(supportRunLabel(run({ finishedAt: '2026-07-25T12:00:00.000Z' }), NOW).age).toBe(
      '5d ago',
    );
  });

  it('handles an unparseable or future timestamp without inventing an age', () => {
    expect(supportRunLabel(run({ finishedAt: 'not-a-date' }), NOW).age).toBe('unknown time');
    expect(supportRunLabel(run({ finishedAt: '2026-07-30T13:00:00.000Z' }), NOW).age).toBe(
      'just now',
    );
  });
});
