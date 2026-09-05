import { describe, it, expect } from 'vitest';
import {
  getInitCommands,
  getReadDtcCommand,
  getPendingDtcCommand,
  getClearDtcCommand,
  parseDtcResponse,
  buildDtcCode,
  getStandardPids,
  parsePidResponse,
  getMilStatus,
} from '../engines/obd-engine';
import { lookupDtc, getDtcSystem, getDtcSeverity } from '../engines/dtc-database';

// ---------------------------------------------------------------------------
// ELM327 initialization
// ---------------------------------------------------------------------------

describe('obd-engine', () => {
  describe('getInitCommands', () => {
    it('returns the correct 6-command ELM327 init sequence', () => {
      const cmds = getInitCommands();
      expect(cmds).toEqual(['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']);
      expect(cmds).toHaveLength(6);
    });
  });

  describe('DTC commands', () => {
    it('getReadDtcCommand returns mode 03', () => {
      expect(getReadDtcCommand()).toBe('03');
    });

    it('getPendingDtcCommand returns mode 07', () => {
      expect(getPendingDtcCommand()).toBe('07');
    });

    it('getClearDtcCommand returns mode 04', () => {
      expect(getClearDtcCommand()).toBe('04');
    });
  });

  // ---------------------------------------------------------------------------
  // DTC code builder
  // ---------------------------------------------------------------------------

  describe('buildDtcCode', () => {
    it('builds a P-code (powertrain) from bytes', () => {
      // 0x01 0x03 -> first nibble 0 = P0, second nibble 1 = "1", byte2 03 = "03"
      expect(buildDtcCode(0x01, 0x03)).toBe('P0103');
    });

    it('builds a C-code (chassis) from bytes', () => {
      // 0x40 0x35 -> first nibble 4 = C0, second nibble 0 = "0", byte2 35 = "35"
      expect(buildDtcCode(0x40, 0x35)).toBe('C0035');
    });

    it('builds a B-code (body) from bytes', () => {
      // 0x80 0x01 -> first nibble 8 = B0, second nibble 0 = "0", byte2 01 = "01"
      expect(buildDtcCode(0x80, 0x01)).toBe('B0001');
    });

    it('builds a U-code (network) from bytes', () => {
      // 0xC1 0x00 -> first nibble C(12) = U0, second nibble 1 = "1", byte2 00 = "00"
      expect(buildDtcCode(0xC1, 0x00)).toBe('U0100');
    });

    it('builds P0301 correctly', () => {
      // P0301 -> first nibble 0 = P0, second nibble 3, byte2 01
      expect(buildDtcCode(0x03, 0x01)).toBe('P0301');
    });
  });

  // ---------------------------------------------------------------------------
  // DTC response parsing
  // ---------------------------------------------------------------------------

  describe('parseDtcResponse', () => {
    it('parses a single DTC from mode 03 response', () => {
      const result = parseDtcResponse('43 01 03 00 00 00 00');
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('P0103');
      expect(result[0].system).toBe('powertrain');
      expect(result[0].isPending).toBe(false);
    });

    it('parses multiple DTCs from response', () => {
      const result = parseDtcResponse('43 01 03 03 01 00 00');
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('P0103');
      expect(result[1].code).toBe('P0301');
    });

    it('returns empty array for empty/invalid response', () => {
      expect(parseDtcResponse('')).toEqual([]);
      expect(parseDtcResponse('NODATA')).toEqual([]);
    });

    it('returns empty array for "no DTCs" response (all zeros)', () => {
      const result = parseDtcResponse('43 00 00 00 00 00 00');
      expect(result).toHaveLength(0);
    });

    it('marks DTCs as pending when isPending is true', () => {
      const result = parseDtcResponse('47 01 03 00 00 00 00', true);
      expect(result).toHaveLength(1);
      expect(result[0].isPending).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Standard PIDs
  // ---------------------------------------------------------------------------

  describe('getStandardPids', () => {
    it('returns 8 standard PIDs', () => {
      const pids = getStandardPids();
      expect(pids).toHaveLength(8);

      const pidCodes = pids.map((p) => p.pid);
      expect(pidCodes).toContain('010C');
      expect(pidCodes).toContain('010D');
      expect(pidCodes).toContain('0105');
      expect(pidCodes).toContain('010F');
      expect(pidCodes).toContain('0104');
      expect(pidCodes).toContain('0111');
      expect(pidCodes).toContain('012F');
      expect(pidCodes).toContain('0146');
    });
  });

  // ---------------------------------------------------------------------------
  // PID response parsing
  // ---------------------------------------------------------------------------

  describe('parsePidResponse', () => {
    it('calculates RPM from response: "41 0C 1A F8" = 1726 RPM', () => {
      // (0x1A * 256 + 0xF8) / 4 = (26 * 256 + 248) / 4 = 6904 / 4 = 1726
      const rpm = parsePidResponse('010C', '41 0C 1A F8');
      expect(rpm).toBe(1726);
    });

    it('calculates vehicle speed from response', () => {
      // 0x3C = 60 km/h
      const speed = parsePidResponse('010D', '41 0D 3C');
      expect(speed).toBe(60);
    });

    it('calculates coolant temperature from response', () => {
      // 0x7B = 123 -> 123 - 40 = 83 C
      const temp = parsePidResponse('0105', '41 05 7B');
      expect(temp).toBe(83);
    });

    it('returns null for invalid response (wrong mode)', () => {
      expect(parsePidResponse('010C', '42 0C 1A F8')).toBeNull();
    });

    it('returns null for mismatched PID', () => {
      expect(parsePidResponse('010C', '41 0D 1A F8')).toBeNull();
    });

    it('returns null for too-short response', () => {
      expect(parsePidResponse('010C', '41')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // MIL status
  // ---------------------------------------------------------------------------

  describe('getMilStatus', () => {
    it('returns true when MIL bit (bit 7) is set', () => {
      // 0x82 = 1000 0010 -> bit 7 is set
      expect(getMilStatus('41 01 82 07 65 04')).toBe(true);
    });

    it('returns false when MIL bit is not set', () => {
      // 0x02 = 0000 0010 -> bit 7 is not set
      expect(getMilStatus('41 01 02 07 65 04')).toBe(false);
    });

    it('returns false for invalid response', () => {
      expect(getMilStatus('')).toBe(false);
      expect(getMilStatus('41')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // DTC database lookups (from dtc-database.ts)
  // ---------------------------------------------------------------------------

  describe('lookupDtc', () => {
    it('returns entry for known code P0300', () => {
      const entry = lookupDtc('P0300');
      expect(entry).not.toBeNull();
      expect(entry!.description).toBe('Random/Multiple Cylinder Misfire Detected');
      expect(entry!.severity).toBe('critical');
      expect(entry!.system).toBe('powertrain');
    });

    it('returns null for unknown code', () => {
      expect(lookupDtc('P9999')).toBeNull();
    });
  });

  describe('getDtcSystem', () => {
    it('maps all 4 system prefixes correctly', () => {
      expect(getDtcSystem('P0301')).toBe('powertrain');
      expect(getDtcSystem('C0035')).toBe('chassis');
      expect(getDtcSystem('B0001')).toBe('body');
      expect(getDtcSystem('U0100')).toBe('network');
    });
  });

  describe('getDtcSeverity', () => {
    it('returns critical for misfire codes', () => {
      expect(getDtcSeverity('P0300')).toBe('critical');
      expect(getDtcSeverity('P0301')).toBe('critical');
    });

    it('returns warning for sensor codes', () => {
      expect(getDtcSeverity('P0171')).toBe('warning');
    });

    it('returns info for unknown codes', () => {
      expect(getDtcSeverity('P9999')).toBe('info');
    });
  });
});
