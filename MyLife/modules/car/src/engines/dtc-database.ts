// ---------------------------------------------------------------------------
// Embedded DTC Lookup Database
// Common OBD-II Diagnostic Trouble Codes with descriptions and severity.
// ---------------------------------------------------------------------------

export interface DTCEntry {
  code: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  system: 'powertrain' | 'chassis' | 'body' | 'network';
}

// ---------------------------------------------------------------------------
// DTC Database (50+ common codes)
// ---------------------------------------------------------------------------

const DTC_DATABASE: DTCEntry[] = [
  // P0100-P0199: Fuel and air metering
  { code: 'P0100', description: 'Mass or Volume Air Flow Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0101', description: 'Mass or Volume Air Flow Circuit Range/Performance', severity: 'warning', system: 'powertrain' },
  { code: 'P0102', description: 'Mass or Volume Air Flow Circuit Low Input', severity: 'warning', system: 'powertrain' },
  { code: 'P0103', description: 'Mass or Volume Air Flow Circuit High Input', severity: 'warning', system: 'powertrain' },
  { code: 'P0110', description: 'Intake Air Temperature Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0115', description: 'Engine Coolant Temperature Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0120', description: 'Throttle Position Sensor/Switch A Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0121', description: 'Throttle Position Sensor/Switch A Range/Performance', severity: 'warning', system: 'powertrain' },
  { code: 'P0125', description: 'Insufficient Coolant Temperature for Closed Loop Fuel Control', severity: 'info', system: 'powertrain' },
  { code: 'P0128', description: 'Coolant Thermostat Below Thermostat Regulating Temperature', severity: 'info', system: 'powertrain' },
  { code: 'P0130', description: 'O2 Sensor Circuit Malfunction (Bank 1, Sensor 1)', severity: 'warning', system: 'powertrain' },
  { code: 'P0131', description: 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1)', severity: 'warning', system: 'powertrain' },
  { code: 'P0133', description: 'O2 Sensor Circuit Slow Response (Bank 1, Sensor 1)', severity: 'warning', system: 'powertrain' },
  { code: 'P0135', description: 'O2 Sensor Heater Circuit Malfunction (Bank 1, Sensor 1)', severity: 'warning', system: 'powertrain' },
  { code: 'P0171', description: 'System Too Lean (Bank 1)', severity: 'warning', system: 'powertrain' },
  { code: 'P0172', description: 'System Too Rich (Bank 1)', severity: 'warning', system: 'powertrain' },
  { code: 'P0174', description: 'System Too Lean (Bank 2)', severity: 'warning', system: 'powertrain' },
  { code: 'P0175', description: 'System Too Rich (Bank 2)', severity: 'warning', system: 'powertrain' },

  // P0200-P0299: Fuel and air metering (injector circuit)
  { code: 'P0200', description: 'Injector Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0201', description: 'Injector Circuit Malfunction - Cylinder 1', severity: 'warning', system: 'powertrain' },
  { code: 'P0202', description: 'Injector Circuit Malfunction - Cylinder 2', severity: 'warning', system: 'powertrain' },
  { code: 'P0203', description: 'Injector Circuit Malfunction - Cylinder 3', severity: 'warning', system: 'powertrain' },
  { code: 'P0204', description: 'Injector Circuit Malfunction - Cylinder 4', severity: 'warning', system: 'powertrain' },
  { code: 'P0218', description: 'Transmission Over Temperature Condition', severity: 'critical', system: 'powertrain' },

  // P0300-P0399: Ignition system (misfires are critical)
  { code: 'P0300', description: 'Random/Multiple Cylinder Misfire Detected', severity: 'critical', system: 'powertrain' },
  { code: 'P0301', description: 'Cylinder 1 Misfire Detected', severity: 'critical', system: 'powertrain' },
  { code: 'P0302', description: 'Cylinder 2 Misfire Detected', severity: 'critical', system: 'powertrain' },
  { code: 'P0303', description: 'Cylinder 3 Misfire Detected', severity: 'critical', system: 'powertrain' },
  { code: 'P0304', description: 'Cylinder 4 Misfire Detected', severity: 'critical', system: 'powertrain' },
  { code: 'P0305', description: 'Cylinder 5 Misfire Detected', severity: 'critical', system: 'powertrain' },
  { code: 'P0306', description: 'Cylinder 6 Misfire Detected', severity: 'critical', system: 'powertrain' },
  { code: 'P0335', description: 'Crankshaft Position Sensor A Circuit Malfunction', severity: 'critical', system: 'powertrain' },
  { code: 'P0340', description: 'Camshaft Position Sensor Circuit Malfunction', severity: 'critical', system: 'powertrain' },

  // P0400-P0499: Emission controls
  { code: 'P0400', description: 'Exhaust Gas Recirculation Flow Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0401', description: 'Exhaust Gas Recirculation Flow Insufficient Detected', severity: 'warning', system: 'powertrain' },
  { code: 'P0420', description: 'Catalyst System Efficiency Below Threshold (Bank 1)', severity: 'warning', system: 'powertrain' },
  { code: 'P0430', description: 'Catalyst System Efficiency Below Threshold (Bank 2)', severity: 'warning', system: 'powertrain' },
  { code: 'P0440', description: 'Evaporative Emission Control System Malfunction', severity: 'info', system: 'powertrain' },
  { code: 'P0441', description: 'Evaporative Emission Control System Incorrect Purge Flow', severity: 'info', system: 'powertrain' },
  { code: 'P0442', description: 'Evaporative Emission Control System Leak Detected (Small Leak)', severity: 'info', system: 'powertrain' },
  { code: 'P0446', description: 'Evaporative Emission Control System Vent Control Circuit Malfunction', severity: 'info', system: 'powertrain' },
  { code: 'P0455', description: 'Evaporative Emission Control System Leak Detected (Gross Leak)', severity: 'warning', system: 'powertrain' },

  // P0500-P0599: Vehicle speed, idle control
  { code: 'P0500', description: 'Vehicle Speed Sensor Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0505', description: 'Idle Control System Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0507', description: 'Idle Control System RPM Higher Than Expected', severity: 'info', system: 'powertrain' },

  // P0600-P0699: Computer output circuit
  { code: 'P0600', description: 'Serial Communication Link Malfunction', severity: 'critical', system: 'powertrain' },
  { code: 'P0601', description: 'Internal Control Module Memory Check Sum Error', severity: 'critical', system: 'powertrain' },

  // P0700-P0799: Transmission
  { code: 'P0700', description: 'Transmission Control System Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0715', description: 'Input/Turbine Speed Sensor Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0720', description: 'Output Speed Sensor Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0730', description: 'Incorrect Gear Ratio', severity: 'warning', system: 'powertrain' },
  { code: 'P0740', description: 'Torque Converter Clutch Circuit Malfunction', severity: 'warning', system: 'powertrain' },
  { code: 'P0750', description: 'Shift Solenoid A Malfunction', severity: 'warning', system: 'powertrain' },

  // C codes: Chassis
  { code: 'C0035', description: 'Left Front Wheel Speed Circuit Malfunction', severity: 'warning', system: 'chassis' },
  { code: 'C0040', description: 'Right Front Wheel Speed Circuit Malfunction', severity: 'warning', system: 'chassis' },
  { code: 'C0045', description: 'Left Rear Wheel Speed Circuit Malfunction', severity: 'warning', system: 'chassis' },
  { code: 'C0050', description: 'Right Rear Wheel Speed Circuit Malfunction', severity: 'warning', system: 'chassis' },
  { code: 'C0060', description: 'Left Front ABS Solenoid #1 Circuit Malfunction', severity: 'warning', system: 'chassis' },

  // B codes: Body
  { code: 'B0001', description: 'Driver Frontal Stage 1 Deployment Control', severity: 'critical', system: 'body' },
  { code: 'B0010', description: 'Driver Frontal Stage 2 Deployment Control', severity: 'critical', system: 'body' },
  { code: 'B0015', description: 'Passenger Frontal Stage 1 Deployment Control', severity: 'critical', system: 'body' },
  { code: 'B0020', description: 'Passenger Frontal Stage 2 Deployment Control', severity: 'critical', system: 'body' },
  { code: 'B0051', description: 'Deployment Commanded (Crash Event Stored)', severity: 'critical', system: 'body' },

  // U codes: Network
  { code: 'U0100', description: 'Lost Communication With ECM/PCM A', severity: 'critical', system: 'network' },
  { code: 'U0101', description: 'Lost Communication With TCM', severity: 'critical', system: 'network' },
  { code: 'U0121', description: 'Lost Communication With Anti-Lock Brake System Module', severity: 'warning', system: 'network' },
  { code: 'U0131', description: 'Lost Communication With Power Steering Control Module', severity: 'warning', system: 'network' },
  { code: 'U0140', description: 'Lost Communication With Body Control Module', severity: 'warning', system: 'network' },
  { code: 'U0155', description: 'Lost Communication With Instrument Panel Cluster Module', severity: 'info', system: 'network' },
];

/** Indexed map for O(1) lookup */
const DTC_MAP = new Map<string, DTCEntry>(
  DTC_DATABASE.map((entry) => [entry.code, entry]),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a DTC code in the embedded database.
 * Returns the entry if found, null otherwise.
 */
export function lookupDtc(code: string): DTCEntry | null {
  return DTC_MAP.get(code.toUpperCase()) ?? null;
}

/**
 * Determine the system category from a DTC code's first character.
 * P = powertrain, C = chassis, B = body, U = network.
 */
export function getDtcSystem(code: string): string {
  const prefix = code.charAt(0).toUpperCase();
  const systems: Record<string, string> = {
    P: 'powertrain',
    C: 'chassis',
    B: 'body',
    U: 'network',
  };
  return systems[prefix] ?? 'powertrain';
}

/**
 * Heuristic severity assignment based on DTC code patterns.
 * - Misfire codes (P030x) = critical
 * - Sensor codes (P01xx, P02xx) = warning
 * - EVAP codes (P044x) = info
 * - Default = info
 */
export function getDtcSeverity(code: string): string {
  const upper = code.toUpperCase();

  // Check database first
  const entry = DTC_MAP.get(upper);
  if (entry) return entry.severity;

  // Heuristic fallback
  if (/^P030[0-9]$/.test(upper)) return 'critical';
  if (/^P033[0-9]$/.test(upper)) return 'critical';
  if (/^P034[0-9]$/.test(upper)) return 'critical';
  if (/^P060[0-9]$/.test(upper)) return 'critical';
  if (/^U01[0-9]{2}$/.test(upper)) return 'critical';
  if (/^B00[0-9]{2}$/.test(upper)) return 'critical';
  if (/^P01[0-9]{2}$/.test(upper)) return 'warning';
  if (/^P02[0-9]{2}$/.test(upper)) return 'warning';
  if (/^P07[0-9]{2}$/.test(upper)) return 'warning';
  if (/^C0[0-9]{3}$/.test(upper)) return 'warning';

  return 'info';
}

/** Get the total number of entries in the database */
export function getDatabaseSize(): number {
  return DTC_DATABASE.length;
}
