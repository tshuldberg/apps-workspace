export { CAR_MODULE } from './definition';

// ── V1 types ─────────────────────────────────────────────────────────────
export type { Vehicle, FuelType, Maintenance, MaintenanceType, FuelLog } from './types';
export { VehicleSchema, FuelTypeSchema, MaintenanceSchema, MaintenanceTypeSchema, FuelLogSchema } from './types';

// ── V2 types (schedules) ────────────────────────────────────────────────
export type { MaintenanceSchedule, ScheduleServiceType, ScheduleStatus, CreateScheduleInput, CreateScheduleRawInput } from './types';
export { MaintenanceScheduleSchema, ScheduleServiceTypeSchema, ScheduleStatusSchema, CreateScheduleInputSchema } from './types';

// ── V3 types (trips) ────────────────────────────────────────────────────
export type { Trip, TripPurpose } from './types';
export { TripSchema, TripPurposeSchema } from './types';

// ── V4 types (insurance) ────────────────────────────────────────────────
export type { InsurancePolicy, InsuranceDocument, CoverageType, PremiumFrequency, InsuranceDocType } from './types';
export { InsurancePolicySchema, InsuranceDocumentSchema, CoverageTypeSchema, PremiumFrequencySchema, InsuranceDocTypeSchema } from './types';

// ── V5 types (registration) ─────────────────────────────────────────────
export type { Registration, RegistrationDocument, InspectionType, RegDocType } from './types';
export { RegistrationSchema, RegistrationDocumentSchema, InspectionTypeSchema, RegDocTypeSchema } from './types';

// ── V6 types (GPS trips) ────────────────────────────────────────────────
export type { GpsTrip } from './types';
export { GpsTripSchema } from './types';

// ── V7 types (tires) ────────────────────────────────────────────────────
export type { TireSet, TireMeasurement, TireRotation, TirePosition } from './types';
export { TireSetSchema, TireMeasurementSchema, TireRotationSchema, TirePositionSchema } from './types';

// ── V8 types (parking) ──────────────────────────────────────────────────
export type { ParkingLocation } from './types';
export { ParkingLocationSchema } from './types';

// ── V9 types (recalls) ──────────────────────────────────────────────────
export type { Recall } from './types';
export { RecallSchema } from './types';

// ── V10 types (diagnostics) ─────────────────────────────────────────────
export type { DiagnosticSnapshot, DiagnosticCode, LiveDataLog, DTCSeverity, DTCSystem } from './types';
export { DiagnosticSnapshotSchema, DiagnosticCodeSchema, LiveDataLogSchema, DTCSeveritySchema, DTCSystemSchema } from './types';

// ── V1 CRUD ──────────────────────────────────────────────────────────────
export {
  createVehicle, getVehicles, getVehicleById, updateVehicle, deleteVehicle, countVehicles,
  createMaintenance, getMaintenanceByVehicle, deleteMaintenance,
  createFuelLog, getFuelLogsByVehicle, deleteFuelLog,
  getSetting, setSetting,
} from './db';

// ── V2 CRUD (schedules) ─────────────────────────────────────────────────
export {
  createSchedule, getSchedulesByVehicle, getActiveSchedules, getScheduleById,
  updateSchedule, deactivateSchedule, deleteSchedule, autoLinkMaintenanceToSchedule,
} from './db';

// ── V3 CRUD (trips) ─────────────────────────────────────────────────────
export { createTrip, getTripsByVehicle, getTripsByPurpose, deleteTrip } from './db';

// ── V4 CRUD (insurance) ─────────────────────────────────────────────────
export {
  createPolicy, getPoliciesByVehicle, getPolicyById, updatePolicy, deletePolicy,
  createInsuranceDocument, getDocumentsByPolicy, deleteInsuranceDocument,
} from './db';

// ── V5 CRUD (registration) ──────────────────────────────────────────────
export {
  createRegistration, getRegistrationByVehicle, getRegistrationById,
  updateRegistration, deleteRegistration,
  createRegDocument, getRegDocumentsByRegistration, deleteRegDocument,
} from './db';

// ── V6 CRUD (GPS trips) ─────────────────────────────────────────────────
export { createGpsTrip, getGpsTripsByVehicle, getGpsTripById, deleteGpsTrip } from './db';

// ── V7 CRUD (tires) ─────────────────────────────────────────────────────
export {
  createTireSet, getTireSetsByVehicle, getCurrentTireSet, updateTireSet, deleteTireSet,
  createMeasurement, getMeasurementsByTireSet, deleteMeasurement,
  createRotation, getRotationsByTireSet, deleteRotation,
} from './db';

// ── V8 CRUD (parking) ───────────────────────────────────────────────────
export { saveParking, getActiveParking, clearParking, getParkingHistory } from './db';

// ── V9 CRUD (recalls) ───────────────────────────────────────────────────
export { createRecall, getRecallsByVehicle, getUnacknowledgedRecalls, acknowledgeRecall, deleteRecall, recallExists } from './db';

// ── V10 CRUD (diagnostics) ──────────────────────────────────────────────
export {
  createSnapshot, getSnapshotsByVehicle, getSnapshotById, deleteSnapshot,
  createDiagnosticCode, getCodesBySnapshot,
  createLiveDataLog, getRecentLiveData, clearLiveDataLogs,
} from './db';

// ── Engines ──────────────────────────────────────────────────────────────
export {
  calculateNextDue, calculateScheduleStatus, getDefaultSchedules, sortByUrgency, serviceTypeLabel,
} from './engines/reminder-engine';
export type { SchedulePreset, NextDueResult } from './engines/reminder-engine';

export {
  calculateTripDistance, getTripSummaryByPurpose, estimateIrsDeduction, getTripsByDateRange,
} from './engines/trip-engine';

export {
  calculateCostPerMile, getCostBreakdown, getMonthlyCostTrend,
} from './engines/cost-engine';
export type { CostBreakdown, MonthlyCostTrend } from './engines/cost-engine';

export {
  getAveragePricePerGallon, getPriceTrend, getStationAnalysis, getCheapestStation, getFuelCostProjection,
} from './engines/fuel-price-engine';
export type { StationStats, PriceTrendPoint } from './engines/fuel-price-engine';

export {
  getExpirationStatus, annualizePremium, getTotalAnnualPremium, maskPolicyNumber,
} from './engines/insurance-engine';
export type { ExpirationStatus } from './engines/insurance-engine';

export {
  getRegExpirationStatus, getInspectionExpirationStatus, getDaysUntilExpiration,
} from './engines/registration-engine';
export type { RegExpirationStatus } from './engines/registration-engine';

export {
  haversineDistance, calculateRouteDistance, metersToMiles, milesToMeters,
  encodePolyline, decodePolyline, simplifyRoute, filterDriftPoints,
} from './engines/gps-engine';
export type { GpsPoint } from './engines/gps-engine';

export {
  getTireHealth, getPositionHealth, calculateWearRate,
  predictReplacementMiles, getRecommendedRotationOdometer, getTireCostPerMile,
} from './engines/tire-engine';
export type { TireHealth, TirePositionHealth, WearRateResult } from './engines/tire-engine';

export {
  getMeterStatus, getMinutesRemaining, formatDuration,
  isStaleParking, calculateWalkingTime, validateCoordinates,
} from './engines/parking-engine';
export type { MeterStatus } from './engines/parking-engine';

export {
  validateVin, calculateCheckDigit, isValidCheckDigit,
  getModelYear, parseNhtsaResponse, mapNhtsaFuelType,
} from './engines/vin-engine';
export type { VinDecodeResult } from './engines/vin-engine';

export {
  getInitCommands, getReadDtcCommand, getPendingDtcCommand, getClearDtcCommand,
  parseDtcResponse, buildDtcCode, getStandardPids, parsePidResponse, getMilStatus,
} from './engines/obd-engine';
export type { OBDPid, ParsedDTC } from './engines/obd-engine';

export { lookupDtc, getDtcSystem, getDtcSeverity } from './engines/dtc-database';
export type { DTCEntry } from './engines/dtc-database';

// ── Cross-Module Integrations ──────────────────────────────────────────
export {
  importMaintenanceFromPurchase,
  getPendingCarImports,
  type MaintenanceLogEntry,
} from './integrations/shop-import';
