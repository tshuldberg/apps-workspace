// ---------------------------------------------------------------------------
// OBD-II Protocol Engine
// Handles ELM327 AT command sequences and OBD PID parsing.
// Does NOT include BLE communication (platform-specific).
// Works with string commands and responses.
// ---------------------------------------------------------------------------

export interface OBDPid {
  pid: string;       // e.g., "010C"
  name: string;      // e.g., "Engine RPM"
  unit: string;      // e.g., "rpm"
  min: number;
  max: number;
  formula: (bytes: number[]) => number; // decode raw bytes to value
}

export interface ParsedDTC {
  code: string;      // e.g., "P0301"
  system: string;    // powertrain, chassis, body, network
  isPending: boolean;
}

// ---------------------------------------------------------------------------
// ELM327 initialization
// ---------------------------------------------------------------------------

/**
 * Return the ELM327 initialization command sequence.
 * ATZ   = reset
 * ATE0  = disable echo
 * ATL0  = disable linefeeds
 * ATS0  = disable spaces
 * ATH0  = disable headers
 * ATSP0 = auto-detect protocol
 */
export function getInitCommands(): string[] {
  return ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
}

// ---------------------------------------------------------------------------
// DTC commands
// ---------------------------------------------------------------------------

/** Mode 03: read stored DTCs */
export function getReadDtcCommand(): string {
  return '03';
}

/** Mode 07: read pending DTCs */
export function getPendingDtcCommand(): string {
  return '07';
}

/** Mode 04: clear DTCs and MIL */
export function getClearDtcCommand(): string {
  return '04';
}

// ---------------------------------------------------------------------------
// DTC code builder
// ---------------------------------------------------------------------------

const SYSTEM_PREFIXES: Record<number, string> = {
  0: 'P0', 1: 'P1', 2: 'P2', 3: 'P3',
  4: 'C0', 5: 'C1', 6: 'C2', 7: 'C3',
  8: 'B0', 9: 'B1', 10: 'B2', 11: 'B3',
  12: 'U0', 13: 'U1', 14: 'U2', 15: 'U3',
};

const SYSTEM_MAP: Record<string, string> = {
  P: 'powertrain',
  C: 'chassis',
  B: 'body',
  U: 'network',
};

/**
 * Convert 2 raw bytes to a standard DTC string.
 * First nibble of byte1 determines system prefix via SYSTEM_PREFIXES.
 * Remaining nibble of byte1 + byte2 form the numeric code portion.
 */
export function buildDtcCode(byte1: number, byte2: number): string {
  const firstNibble = (byte1 >> 4) & 0x0F;
  const secondNibble = byte1 & 0x0F;
  const prefix = SYSTEM_PREFIXES[firstNibble] ?? 'P0';
  const suffix = secondNibble.toString(16).toUpperCase() + byte2.toString(16).toUpperCase().padStart(2, '0');
  return prefix + suffix;
}

// ---------------------------------------------------------------------------
// DTC response parser
// ---------------------------------------------------------------------------

/**
 * Parse an OBD mode 03/07 response into DTCs.
 *
 * Response format: "43 01 03 01 04 00 00"
 *   - 43 = response to mode 03 (47 for mode 07)
 *   - Remaining bytes are DTC pairs (2 bytes per DTC)
 *   - 00 00 = padding / no more DTCs
 */
export function parseDtcResponse(response: string, isPending = false): ParsedDTC[] {
  const cleaned = response.replace(/\s+/g, '');
  // Must start with 43 (mode 03 response) or 47 (mode 07 response)
  if (cleaned.length < 2) return [];
  const header = cleaned.substring(0, 2);
  if (header !== '43' && header !== '47') return [];

  const dataHex = cleaned.substring(2);
  const dtcs: ParsedDTC[] = [];

  // Process pairs of bytes (4 hex chars per DTC)
  for (let i = 0; i + 3 < dataHex.length; i += 4) {
    const byte1 = parseInt(dataHex.substring(i, i + 2), 16);
    const byte2 = parseInt(dataHex.substring(i + 2, i + 4), 16);

    // Skip 00 00 padding
    if (byte1 === 0 && byte2 === 0) continue;

    const code = buildDtcCode(byte1, byte2);
    const systemChar = code.charAt(0);

    dtcs.push({
      code,
      system: SYSTEM_MAP[systemChar] ?? 'powertrain',
      isPending,
    });
  }

  return dtcs;
}

// ---------------------------------------------------------------------------
// Standard PIDs
// ---------------------------------------------------------------------------

/**
 * Return an array of common OBD-II Mode 01 PIDs with decode formulas.
 */
export function getStandardPids(): OBDPid[] {
  return [
    {
      pid: '010C',
      name: 'Engine RPM',
      unit: 'rpm',
      min: 0,
      max: 16383.75,
      formula: (bytes: number[]) => (bytes[0] * 256 + bytes[1]) / 4,
    },
    {
      pid: '010D',
      name: 'Vehicle Speed',
      unit: 'km/h',
      min: 0,
      max: 255,
      formula: (bytes: number[]) => bytes[0],
    },
    {
      pid: '0105',
      name: 'Coolant Temperature',
      unit: 'C',
      min: -40,
      max: 215,
      formula: (bytes: number[]) => bytes[0] - 40,
    },
    {
      pid: '010F',
      name: 'Intake Air Temperature',
      unit: 'C',
      min: -40,
      max: 215,
      formula: (bytes: number[]) => bytes[0] - 40,
    },
    {
      pid: '0104',
      name: 'Engine Load',
      unit: '%',
      min: 0,
      max: 100,
      formula: (bytes: number[]) => (bytes[0] * 100) / 255,
    },
    {
      pid: '0111',
      name: 'Throttle Position',
      unit: '%',
      min: 0,
      max: 100,
      formula: (bytes: number[]) => (bytes[0] * 100) / 255,
    },
    {
      pid: '012F',
      name: 'Fuel Level',
      unit: '%',
      min: 0,
      max: 100,
      formula: (bytes: number[]) => (bytes[0] * 100) / 255,
    },
    {
      pid: '0146',
      name: 'Ambient Air Temperature',
      unit: 'C',
      min: -40,
      max: 215,
      formula: (bytes: number[]) => bytes[0] - 40,
    },
  ];
}

// ---------------------------------------------------------------------------
// PID response parser
// ---------------------------------------------------------------------------

/**
 * Parse a Mode 01 PID response.
 *
 * Response format: "41 0C 1A F8"
 *   - 41 = response to mode 01
 *   - 0C = PID echoed back
 *   - Remaining bytes = data
 *
 * Looks up the PID in the standard list and applies its formula.
 * Returns null on parse failure or unknown PID.
 */
export function parsePidResponse(pid: string, response: string): number | null {
  const parts = response.trim().split(/\s+/);
  if (parts.length < 3) return null;

  // Confirm mode 01 response
  if (parts[0] !== '41') return null;

  // Confirm PID matches (last 2 chars of PID)
  const expectedPidByte = pid.substring(2).toUpperCase();
  if (parts[1].toUpperCase() !== expectedPidByte) return null;

  // Extract data bytes
  const dataBytes = parts.slice(2).map((h) => parseInt(h, 16));
  if (dataBytes.some((b) => isNaN(b))) return null;

  // Find matching standard PID
  const standardPids = getStandardPids();
  const matchingPid = standardPids.find((p) => p.pid === pid.toUpperCase());
  if (!matchingPid) return null;

  return matchingPid.formula(dataBytes);
}

// ---------------------------------------------------------------------------
// MIL status
// ---------------------------------------------------------------------------

/**
 * Parse Mode 01 PID 01 response to get MIL (check engine light) status.
 * Bit 7 of byte A indicates MIL on (1) or off (0).
 *
 * Response format: "41 01 XX YY ZZ WW"
 *   - XX = byte A: bit 7 = MIL, bits 6-0 = DTC count
 */
export function getMilStatus(response: string): boolean {
  const parts = response.trim().split(/\s+/);
  if (parts.length < 3) return false;
  if (parts[0] !== '41' || parts[1] !== '01') return false;

  const byteA = parseInt(parts[2], 16);
  if (isNaN(byteA)) return false;

  // Bit 7 = MIL status
  return (byteA & 0x80) !== 0;
}
