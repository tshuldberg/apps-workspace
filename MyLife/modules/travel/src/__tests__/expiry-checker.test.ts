import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createDocument } from '../db/crud/documents';
import { createLoyaltyProgram } from '../db/crud/loyalty';
import {
  checkExpiry,
  getUrgencyLevel,
} from '../engine/expiry-checker';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('getUrgencyLevel', () => {
  it('classifies negative days as expired', () => {
    expect(getUrgencyLevel(-1)).toBe('expired');
    expect(getUrgencyLevel(-100)).toBe('expired');
  });

  it('classifies 0..30 as critical', () => {
    expect(getUrgencyLevel(0)).toBe('critical');
    expect(getUrgencyLevel(15)).toBe('critical');
    expect(getUrgencyLevel(30)).toBe('critical');
  });

  it('classifies 31..windowDays as warning', () => {
    expect(getUrgencyLevel(31)).toBe('warning');
    expect(getUrgencyLevel(60)).toBe('warning');
    expect(getUrgencyLevel(90)).toBe('warning');
  });

  it('classifies beyond windowDays as ok', () => {
    expect(getUrgencyLevel(91)).toBe('ok');
    expect(getUrgencyLevel(365)).toBe('ok');
  });

  it('respects custom windowDays', () => {
    expect(getUrgencyLevel(100, 180)).toBe('warning');
    expect(getUrgencyLevel(181, 180)).toBe('ok');
  });
});

describe('checkExpiry', () => {
  it('returns empty buckets when no items exist', () => {
    const report = checkExpiry(adapter);
    expect(report.expired).toEqual([]);
    expect(report.critical).toEqual([]);
    expect(report.warning).toEqual([]);
    expect(report.ok).toEqual([]);
  });

  it('ignores items without expiry_date', () => {
    createDocument(adapter, { type: 'passport', name: 'No expiry' });
    createLoyaltyProgram(adapter, { type: 'airline', provider: 'No expiry airline' });
    const report = checkExpiry(adapter);
    expect(report.expired).toHaveLength(0);
    expect(report.critical).toHaveLength(0);
    expect(report.warning).toHaveLength(0);
    expect(report.ok).toHaveLength(0);
  });

  it('classifies documents into expired/critical/warning/ok', () => {
    createDocument(adapter, {
      type: 'passport',
      name: 'expired doc',
      expiry_date: daysFromNowIso(-5),
    });
    createDocument(adapter, {
      type: 'visa',
      name: 'critical doc',
      expiry_date: daysFromNowIso(10),
    });
    createDocument(adapter, {
      type: 'insurance',
      name: 'warning doc',
      expiry_date: daysFromNowIso(60),
    });
    createDocument(adapter, {
      type: 'membership',
      name: 'ok doc',
      expiry_date: daysFromNowIso(200),
    });

    const report = checkExpiry(adapter);
    expect(report.expired.map((i) => i.name_or_provider)).toEqual(['expired doc']);
    expect(report.critical.map((i) => i.name_or_provider)).toEqual(['critical doc']);
    expect(report.warning.map((i) => i.name_or_provider)).toEqual(['warning doc']);
    expect(report.ok.map((i) => i.name_or_provider)).toEqual(['ok doc']);
  });

  it('classifies loyalty programs alongside documents', () => {
    createDocument(adapter, {
      type: 'passport',
      name: 'doc critical',
      expiry_date: daysFromNowIso(20),
    });
    createLoyaltyProgram(adapter, {
      type: 'airline',
      provider: 'loyalty critical',
      expiry_date: daysFromNowIso(15),
    });
    createLoyaltyProgram(adapter, {
      type: 'hotel',
      provider: 'loyalty warning',
      expiry_date: daysFromNowIso(75),
    });

    const report = checkExpiry(adapter);
    expect(report.critical).toHaveLength(2);
    const sources = report.critical.map((i) => i.source).sort();
    expect(sources).toEqual(['document', 'loyalty']);
    expect(report.warning).toHaveLength(1);
    expect(report.warning[0].source).toBe('loyalty');
  });

  it('orders each bucket by expiry_date ASC', () => {
    createDocument(adapter, { type: 'passport', name: 'a', expiry_date: daysFromNowIso(25) });
    createDocument(adapter, { type: 'passport', name: 'b', expiry_date: daysFromNowIso(5) });
    createDocument(adapter, { type: 'passport', name: 'c', expiry_date: daysFromNowIso(15) });

    const report = checkExpiry(adapter);
    expect(report.critical.map((i) => i.name_or_provider)).toEqual(['b', 'c', 'a']);
  });

  it('each item includes correct metadata', () => {
    createDocument(adapter, {
      type: 'passport',
      name: 'My Passport',
      expiry_date: daysFromNowIso(10),
    });
    const report = checkExpiry(adapter);
    const item = report.critical[0];
    expect(item.source).toBe('document');
    expect(item.type).toBe('passport');
    expect(item.name_or_provider).toBe('My Passport');
    expect(item.days_until_expiry).toBe(10);
    expect(item.urgency).toBe('critical');
    expect(item.expiry_date).toBeTruthy();
    expect(item.id).toBeTruthy();
  });

  it('respects custom windowDays to expand warning bucket', () => {
    createDocument(adapter, {
      type: 'passport',
      name: 'far',
      expiry_date: daysFromNowIso(150),
    });
    const narrow = checkExpiry(adapter, { windowDays: 90 });
    expect(narrow.warning).toHaveLength(0);
    expect(narrow.ok).toHaveLength(1);

    const wide = checkExpiry(adapter, { windowDays: 180 });
    expect(wide.warning).toHaveLength(1);
    expect(wide.ok).toHaveLength(0);
  });

  it('uses negative days_until_expiry for expired items', () => {
    createLoyaltyProgram(adapter, {
      type: 'airline',
      provider: 'expired loyalty',
      expiry_date: daysFromNowIso(-30),
    });
    const report = checkExpiry(adapter);
    expect(report.expired).toHaveLength(1);
    expect(report.expired[0].days_until_expiry).toBe(-30);
    expect(report.expired[0].urgency).toBe('expired');
  });
});
