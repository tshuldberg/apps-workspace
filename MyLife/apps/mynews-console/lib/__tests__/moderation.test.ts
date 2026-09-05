import { describe, expect, it } from 'vitest';
import {
  isCurrentlySuspended,
  isSuspensionPreset,
  mapRpcResult,
  mapStrikeResult,
  nciiDeadlineLabel,
  nciiStatusLabel,
  reasonLabel,
  suspensionUntil,
} from '../moderation';

describe('mapRpcResult', () => {
  it('maps ok to a clearing result', () => {
    expect(mapRpcResult('ok')).toEqual({ ok: true, code: 'done' });
  });
  it('maps a named failure to an underscored machine code', () => {
    expect(mapRpcResult('not-found')).toEqual({ ok: false, code: 'not_found' });
    expect(mapRpcResult('bad-moderator')).toEqual({ ok: false, code: 'bad_moderator' });
    expect(mapRpcResult('not-open')).toEqual({ ok: false, code: 'not_open' });
  });
  it('never treats a null/empty/unknown value as success', () => {
    expect(mapRpcResult(null)).toEqual({ ok: false, code: 'rpc_failed' });
    expect(mapRpcResult('')).toEqual({ ok: false, code: 'rpc_failed' });
    expect(mapRpcResult(undefined)).toEqual({ ok: false, code: 'rpc_failed' });
  });
});

describe('mapStrikeResult', () => {
  it('treats both suspended and struck as successful strikes', () => {
    expect(mapStrikeResult('suspended')).toEqual({ ok: true, code: 'suspended' });
    expect(mapStrikeResult('struck')).toEqual({ ok: true, code: 'struck' });
  });
  it('maps named failures and never treats empty/unknown as success', () => {
    expect(mapStrikeResult('not-found')).toEqual({ ok: false, code: 'not_found' });
    expect(mapStrikeResult('bad-moderator')).toEqual({ ok: false, code: 'bad_moderator' });
    expect(mapStrikeResult(null)).toEqual({ ok: false, code: 'rpc_failed' });
    expect(mapStrikeResult('')).toEqual({ ok: false, code: 'rpc_failed' });
  });
});

describe('suspensionUntil', () => {
  const now = Date.parse('2026-07-05T00:00:00.000Z');
  it('resolves finite presets forward from now', () => {
    expect(suspensionUntil('7d', now)).toBe('2026-07-12T00:00:00.000Z');
    expect(suspensionUntil('30d', now)).toBe('2026-08-04T00:00:00.000Z');
    expect(suspensionUntil('90d', now)).toBe('2026-10-03T00:00:00.000Z');
  });
  it('resolves permanent to a far-future sentinel', () => {
    expect(suspensionUntil('permanent', now)).toBe('2999-12-31T23:59:59.000Z');
  });
});

describe('isSuspensionPreset', () => {
  it('accepts only the four presets', () => {
    for (const p of ['7d', '30d', '90d', 'permanent']) expect(isSuspensionPreset(p)).toBe(true);
    expect(isSuspensionPreset('1d')).toBe(false);
    expect(isSuspensionPreset('')).toBe(false);
  });
});

describe('isCurrentlySuspended', () => {
  const now = Date.parse('2026-07-05T00:00:00.000Z');
  it('is false for null or a past until', () => {
    expect(isCurrentlySuspended(null, now)).toBe(false);
    expect(isCurrentlySuspended('2026-07-01T00:00:00.000Z', now)).toBe(false);
  });
  it('is true for a future until', () => {
    expect(isCurrentlySuspended('2026-08-01T00:00:00.000Z', now)).toBe(true);
  });
  it('is false for an unparseable value', () => {
    expect(isCurrentlySuspended('not-a-date', now)).toBe(false);
  });
});

describe('reasonLabel', () => {
  it('flags NCII with its SLA and passes through unknown reasons', () => {
    expect(reasonLabel('ncii')).toBe('NCII (48h SLA)');
    expect(reasonLabel('harassment')).toBe('Harassment');
    expect(reasonLabel('mystery')).toBe('mystery');
  });
});

describe('nciiDeadlineLabel', () => {
  const now = Date.parse('2026-07-05T00:00:00.000Z');
  it('reports time left before the deadline (not overdue)', () => {
    const r = nciiDeadlineLabel('2026-07-05T05:30:00.000Z', now);
    expect(r.overdue).toBe(false);
    expect(r.label).toBe('5h 30m left');
  });
  it('flags an overdue deadline (SLA breach)', () => {
    const r = nciiDeadlineLabel('2026-07-04T00:00:00.000Z', now);
    expect(r.overdue).toBe(true);
    expect(r.label).toContain('overdue');
  });
  it('handles an unparseable deadline safely', () => {
    expect(nciiDeadlineLabel('nope', now)).toEqual({ label: 'unknown', overdue: false });
  });
});

describe('nciiStatusLabel', () => {
  it('labels each case status and passes through unknowns', () => {
    expect(nciiStatusLabel('queued')).toContain('Queued');
    expect(nciiStatusLabel('removed')).toContain('Removed');
    expect(nciiStatusLabel('escalated')).toContain('Escalated');
    expect(nciiStatusLabel('cleared')).toBe('Cleared');
    expect(nciiStatusLabel('weird')).toBe('weird');
  });
});
