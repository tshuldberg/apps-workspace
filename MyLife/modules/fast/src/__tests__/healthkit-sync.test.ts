import { describe, it, expect } from 'vitest';
import {
  convertWeight,
  shouldImportWeight,
  mergeWeightEntries,
  calculateSyncWindow,
  formatFastForHealthKit,
  isHealthKitAvailable,
} from '../engines/healthkit-sync';
import type { Fast, HealthKitWeightSample } from '../types';

describe('HealthKit Sync Engine', () => {
  // ── convertWeight ──

  describe('convertWeight', () => {
    it('converts 175 lbs to kg (79.4)', () => {
      expect(convertWeight(175, 'lbs', 'kg')).toBe(79.4);
    });

    it('converts 80 kg to lbs (176.4)', () => {
      expect(convertWeight(80, 'kg', 'lbs')).toBe(176.4);
    });

    it('returns same value when units match', () => {
      expect(convertWeight(150, 'lbs', 'lbs')).toBe(150);
      expect(convertWeight(70, 'kg', 'kg')).toBe(70);
    });

    it('handles zero weight', () => {
      expect(convertWeight(0, 'lbs', 'kg')).toBe(0);
    });

    it('round trips with acceptable precision', () => {
      const original = 160;
      const toKg = convertWeight(original, 'lbs', 'kg');
      const backToLbs = convertWeight(toKg, 'kg', 'lbs');
      expect(Math.abs(backToLbs - original)).toBeLessThan(0.5);
    });
  });

  // ── shouldImportWeight ──

  describe('shouldImportWeight', () => {
    it('returns insert when no existing entry', () => {
      expect(shouldImportWeight(null)).toBe('insert');
    });

    it('returns skip when manual entry exists', () => {
      expect(shouldImportWeight('manual')).toBe('skip');
    });

    it('returns update when healthkit entry exists', () => {
      expect(shouldImportWeight('healthkit')).toBe('update');
    });
  });

  // ── mergeWeightEntries ──

  describe('mergeWeightEntries', () => {
    it('picks the latest sample per date', () => {
      const samples: HealthKitWeightSample[] = [
        { value: 160, unit: 'lbs', date: '2026-03-15', timestamp: '2026-03-15T08:00:00Z' },
        { value: 162, unit: 'lbs', date: '2026-03-15', timestamp: '2026-03-15T20:00:00Z' },
        { value: 161, unit: 'lbs', date: '2026-03-16', timestamp: '2026-03-16T09:00:00Z' },
      ];

      const merged = mergeWeightEntries(samples);
      expect(merged.size).toBe(2);
      expect(merged.get('2026-03-15')?.value).toBe(162); // later timestamp wins
      expect(merged.get('2026-03-16')?.value).toBe(161);
    });

    it('returns empty map for empty input', () => {
      expect(mergeWeightEntries([]).size).toBe(0);
    });

    it('handles single sample per date', () => {
      const samples: HealthKitWeightSample[] = [
        { value: 155, unit: 'lbs', date: '2026-03-10', timestamp: '2026-03-10T12:00:00Z' },
      ];
      const merged = mergeWeightEntries(samples);
      expect(merged.size).toBe(1);
      expect(merged.get('2026-03-10')?.value).toBe(155);
    });
  });

  // ── calculateSyncWindow ──

  describe('calculateSyncWindow', () => {
    it('returns 30-day window on first sync (no timestamp)', () => {
      const now = new Date('2026-03-22T12:00:00Z');
      const { from, to } = calculateSyncWindow(null, now);

      expect(to.getTime()).toBe(now.getTime());
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(30);
    });

    it('returns window from last timestamp on subsequent syncs', () => {
      const now = new Date('2026-03-22T12:00:00Z');
      const lastSync = '2026-03-20T08:00:00Z';
      const { from, to } = calculateSyncWindow(lastSync, now);

      expect(from.toISOString()).toBe('2026-03-20T08:00:00.000Z');
      expect(to.getTime()).toBe(now.getTime());
    });
  });

  // ── formatFastForHealthKit ──

  describe('formatFastForHealthKit', () => {
    it('formats a completed fast with correct metadata', () => {
      const fast: Fast = {
        id: 'f1',
        protocol: '16:8',
        targetHours: 16,
        startedAt: '2026-03-21T20:00:00Z',
        endedAt: '2026-03-22T12:00:00Z',
        durationSeconds: 57600,
        hitTarget: true,
        notes: 'Felt great',
        createdAt: '2026-03-21T20:00:00Z',
      };

      const result = formatFastForHealthKit(fast);
      expect(result).not.toBeNull();
      expect(result!.startDate).toBe('2026-03-21T20:00:00Z');
      expect(result!.endDate).toBe('2026-03-22T12:00:00Z');
      expect(result!.metadata.protocol).toBe('16:8');
      expect(result!.metadata.targetHours).toBe(16);
      expect(result!.metadata.hitTarget).toBe(true);
      expect(result!.metadata.app).toBe('MyFast');
    });

    it('returns null for an incomplete fast (no endedAt)', () => {
      const fast: Fast = {
        id: 'f2',
        protocol: '18:6',
        targetHours: 18,
        startedAt: '2026-03-22T08:00:00Z',
        endedAt: null,
        durationSeconds: null,
        hitTarget: null,
        notes: null,
        createdAt: '2026-03-22T08:00:00Z',
      };

      expect(formatFastForHealthKit(fast)).toBeNull();
    });

    it('handles null notes gracefully', () => {
      const fast: Fast = {
        id: 'f3',
        protocol: '20:4',
        targetHours: 20,
        startedAt: '2026-03-21T18:00:00Z',
        endedAt: '2026-03-22T14:00:00Z',
        durationSeconds: 72000,
        hitTarget: true,
        notes: null,
        createdAt: '2026-03-21T18:00:00Z',
      };

      const result = formatFastForHealthKit(fast);
      expect(result).not.toBeNull();
      expect(result!.metadata.protocol).toBe('20:4');
    });

    it('handles hitTarget=false', () => {
      const fast: Fast = {
        id: 'f4',
        protocol: '16:8',
        targetHours: 16,
        startedAt: '2026-03-21T20:00:00Z',
        endedAt: '2026-03-22T06:00:00Z',
        durationSeconds: 36000,
        hitTarget: false,
        notes: null,
        createdAt: '2026-03-21T20:00:00Z',
      };

      const result = formatFastForHealthKit(fast);
      expect(result!.metadata.hitTarget).toBe(false);
    });
  });

  // ── isHealthKitAvailable ──

  describe('isHealthKitAvailable', () => {
    it('returns false on Android', () => {
      expect(isHealthKitAvailable('android', true)).toBe(false);
    });

    it('returns false on web', () => {
      expect(isHealthKitAvailable('web', true)).toBe(false);
    });

    it('returns false on iOS without native module', () => {
      expect(isHealthKitAvailable('ios', false)).toBe(false);
    });

    it('returns true on iOS with native module', () => {
      expect(isHealthKitAvailable('ios', true)).toBe(true);
    });
  });
});
