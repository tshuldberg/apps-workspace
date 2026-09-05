import { REPORT_SLA_HOURS as MODULE_SLA_HOURS, REPORT_URGENT_REASONS } from '@mylife/mynews/engines';
import { describe, expect, it } from 'vitest';

import {
  REPORT_SLA_HOURS,
  URGENT_REPORT_REASONS,
  caseClassLabel,
  reasonLabel,
  reportSlaLabel,
} from '../moderation';

/**
 * The console's SLA table is a third copy of the same numbers (module, edge, SQL
 * seed, console). Three of the four can be pinned in-process; the SQL seed is
 * pinned by modules/mynews/src/data/screening-taxonomy-migration.test.ts. If
 * these ever disagree, a moderator's aging badge stops matching the deadline the
 * worker enforces, which is the failure mode this pin exists to prevent.
 */
describe('console SLA routing', () => {
  it('matches the module SLA table exactly', () => {
    expect(REPORT_SLA_HOURS).toEqual(MODULE_SLA_HOURS);
  });

  it('matches the module urgent lane exactly', () => {
    expect([...URGENT_REPORT_REASONS].sort()).toEqual([...REPORT_URGENT_REASONS].sort());
  });

  it('labels every routed reason', () => {
    for (const reason of Object.keys(REPORT_SLA_HOURS)) {
      const label = reasonLabel(reason);
      expect(label).not.toBe(reason);
      expect(label.length).toBeGreaterThan(3);
    }
  });
});

describe('reportSlaLabel', () => {
  const created = '2026-07-30T00:00:00.000Z';
  const createdMs = Date.parse(created);

  it('reports time left inside the window', () => {
    const result = reportSlaLabel('child-safety', created, createdMs + 60 * 60 * 1000);
    expect(result.overdue).toBe(false);
    expect(result.hours).toBe(24);
    expect(result.label).toContain('of 24h');
  });

  it('reports overdue past the deadline', () => {
    const result = reportSlaLabel('child-safety', created, createdMs + 30 * 60 * 60 * 1000);
    expect(result.overdue).toBe(true);
    expect(result.label).toContain('overdue');
  });

  it('is exactly at the boundary, not before it', () => {
    const at = reportSlaLabel('ncii', created, createdMs + 48 * 60 * 60 * 1000);
    const justBefore = reportSlaLabel('ncii', created, createdMs + 48 * 60 * 60 * 1000 - 1000);
    expect(at.overdue).toBe(true);
    expect(justBefore.overdue).toBe(false);
  });

  it('falls back to the tightest deadline for an unrouted reason', () => {
    const result = reportSlaLabel('not-a-reason', created, createdMs);
    expect(result.hours).toBe(Math.min(...Object.values(REPORT_SLA_HOURS)));
  });

  it('does not throw on an unparseable timestamp', () => {
    const result = reportSlaLabel('spam', 'not-a-date', createdMs);
    expect(result.overdue).toBe(false);
    expect(result.hours).toBe(168);
  });
});

describe('caseClassLabel', () => {
  it('names both urgent lanes with their deadlines', () => {
    expect(caseClassLabel('ncii')).toContain('48h');
    expect(caseClassLabel('child-safety')).toContain('24h');
  });

  it('falls back to the raw value rather than inventing a lane', () => {
    expect(caseClassLabel('something-else')).toBe('something-else');
  });
});
