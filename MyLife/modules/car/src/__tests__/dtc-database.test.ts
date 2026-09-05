import { describe, it, expect } from 'vitest';
import {
  lookupDtc,
  getDtcSystem,
  getDtcSeverity,
  getDatabaseSize,
} from '../engines/dtc-database';

describe('dtc-database', () => {
  describe('lookupDtc', () => {
    it('returns entry for P0300 (random/multiple cylinder misfire)', () => {
      const entry = lookupDtc('P0300');
      expect(entry).not.toBeNull();
      expect(entry!.code).toBe('P0300');
      expect(entry!.description).toBe('Random/Multiple Cylinder Misfire Detected');
      expect(entry!.severity).toBe('critical');
      expect(entry!.system).toBe('powertrain');
    });

    it('returns null for unknown code', () => {
      expect(lookupDtc('P9999')).toBeNull();
      expect(lookupDtc('ZZZZZ')).toBeNull();
    });

    it('handles case-insensitive lookup', () => {
      const entry = lookupDtc('p0300');
      expect(entry).not.toBeNull();
      expect(entry!.code).toBe('P0300');
    });
  });

  describe('getDtcSystem', () => {
    it('maps P = powertrain', () => {
      expect(getDtcSystem('P0301')).toBe('powertrain');
    });

    it('maps C = chassis', () => {
      expect(getDtcSystem('C0035')).toBe('chassis');
    });

    it('maps B = body', () => {
      expect(getDtcSystem('B0001')).toBe('body');
    });

    it('maps U = network', () => {
      expect(getDtcSystem('U0100')).toBe('network');
    });
  });

  describe('database completeness', () => {
    it('has at least 50 entries', () => {
      expect(getDatabaseSize()).toBeGreaterThanOrEqual(50);
    });

    it('all entries have required fields', () => {
      // Spot-check several entries across different systems
      const codes = ['P0100', 'P0301', 'P0420', 'P0700', 'C0035', 'B0001', 'U0100'];
      for (const code of codes) {
        const entry = lookupDtc(code);
        expect(entry, `${code} should exist in database`).not.toBeNull();
        expect(entry!.code).toBe(code);
        expect(entry!.description.length).toBeGreaterThan(0);
        expect(['info', 'warning', 'critical']).toContain(entry!.severity);
        expect(['powertrain', 'chassis', 'body', 'network']).toContain(entry!.system);
      }
    });
  });

  describe('getDtcSeverity', () => {
    it('returns critical for misfire codes (P030x)', () => {
      expect(getDtcSeverity('P0300')).toBe('critical');
      expect(getDtcSeverity('P0306')).toBe('critical');
    });

    it('returns warning for sensor codes (P01xx)', () => {
      expect(getDtcSeverity('P0100')).toBe('warning');
      expect(getDtcSeverity('P0171')).toBe('warning');
    });

    it('returns info for unknown codes that do not match any heuristic', () => {
      expect(getDtcSeverity('P9999')).toBe('info');
    });
  });
});
