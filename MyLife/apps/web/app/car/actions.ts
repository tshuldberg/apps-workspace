'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  countVehicles,
  createMaintenance,
  getMaintenanceByVehicle,
  deleteMaintenance,
  createFuelLog,
  getFuelLogsByVehicle,
  deleteFuelLog,
  createSchedule,
  getActiveSchedules,
  updateSchedule,
  deactivateSchedule,
  getDefaultSchedules,
  createTrip,
  getTripsByVehicle,
  deleteTrip,
  createPolicy,
  getPoliciesByVehicle,
  updatePolicy,
  deletePolicy,
  createInsuranceDocument,
  getDocumentsByPolicy,
  deleteInsuranceDocument,
  createRegistration,
  getRegistrationByVehicle,
  updateRegistration,
  deleteRegistration,
  createGpsTrip,
  getGpsTripsByVehicle,
  deleteGpsTrip,
  createTireSet,
  getTireSetsByVehicle,
  getCurrentTireSet,
  deleteTireSet,
  createMeasurement,
  getMeasurementsByTireSet,
  createRotation,
  getRotationsByTireSet,
  saveParking,
  getActiveParking,
  clearParking,
  getParkingHistory,
  createRecall,
  getRecallsByVehicle,
  getUnacknowledgedRecalls,
  acknowledgeRecall,
  recallExists,
  createSnapshot,
  getSnapshotsByVehicle,
  getCodesBySnapshot,
  getRecentLiveData,
  type CreateScheduleRawInput,
  type ScheduleServiceType,
} from '@mylife/car';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('car');
  return adapter;
}

/* ── Vehicles ── */

export async function fetchVehicles() {
  return getVehicles(db());
}

export async function fetchVehicleById(id: string) {
  return getVehicleById(db(), id);
}

export async function doCreateVehicle(
  id: string,
  input: {
    name: string;
    make: string;
    model: string;
    year: number;
    fuelType?: string;
    odometer?: number;
  },
) {
  createVehicle(db(), id, input);
}

export async function doUpdateVehicle(
  id: string,
  updates: Partial<{
    name: string;
    make: string;
    model: string;
    year: number;
    odometer: number;
    fuelType: string;
    isPrimary: boolean;
  }>,
) {
  updateVehicle(db(), id, updates);
}

export async function doDeleteVehicle(id: string) {
  deleteVehicle(db(), id);
}

export async function fetchVehicleCount() {
  return countVehicles(db());
}

/* ── Maintenance ── */

export async function fetchMaintenance(vehicleId: string) {
  return getMaintenanceByVehicle(db(), vehicleId);
}

export async function doCreateMaintenance(
  id: string,
  vehicleId: string,
  input: {
    type: string;
    performedAt: string;
    description?: string;
    costCents?: number;
    odometerAt?: number;
  },
) {
  createMaintenance(db(), id, vehicleId, input);
}

export async function doDeleteMaintenance(id: string) {
  deleteMaintenance(db(), id);
}

/* ── Fuel Logs ── */

export async function fetchFuelLogs(vehicleId: string) {
  return getFuelLogsByVehicle(db(), vehicleId);
}

export async function doCreateFuelLog(
  id: string,
  vehicleId: string,
  input: {
    gallons: number;
    costCents: number;
    odometerAt: number;
    loggedAt: string;
    station?: string;
    isFullTank?: boolean;
  },
) {
  createFuelLog(db(), id, vehicleId, input);
}

export async function doDeleteFuelLog(id: string) {
  deleteFuelLog(db(), id);
}

/* ── Maintenance Schedules ── */

export async function fetchActiveSchedules(vehicleId?: string) {
  return getActiveSchedules(db(), vehicleId);
}

export async function doCreateSchedule(input: CreateScheduleRawInput) {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return createSchedule(db(), id, input);
}

export async function doUpdateSchedule(
  id: string,
  updates: Partial<{
    serviceType: ScheduleServiceType;
    serviceTypeCustom: string | null;
    intervalMiles: number | null;
    intervalMonths: number | null;
    lastServiceDate: string | null;
    lastServiceOdometer: number | null;
    snoozeMiles: number;
    snoozeDateOffsetDays: number;
    snoozeCount: number;
    isActive: boolean;
  }>,
) {
  updateSchedule(db(), id, updates);
}

export async function doDeactivateSchedule(id: string) {
  deactivateSchedule(db(), id);
}

export async function doSetupDefaultSchedules(vehicleId: string) {
  const adapter = db();
  const vehicle = getVehicleById(adapter, vehicleId);
  if (!vehicle) return;
  const today = new Date().toISOString().slice(0, 10);
  const presets = getDefaultSchedules();
  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36) + i.toString(36);
    createSchedule(adapter, id, {
      vehicleId,
      serviceType: preset.serviceType,
      intervalMiles: preset.intervalMiles ?? undefined,
      intervalMonths: preset.intervalMonths ?? undefined,
      lastServiceOdometer: vehicle.odometer,
      lastServiceDate: today,
    });
  }
}

/* ── Trips ── */

export async function fetchTrips(vehicleId: string) {
  return getTripsByVehicle(db(), vehicleId);
}

export async function doCreateTrip(
  id: string,
  input: { vehicleId: string; purpose: string; routeName?: string; startOdometer: number; endOdometer: number; startedAt: string; endedAt?: string; notes?: string },
) {
  createTrip(db(), id, input);
}

export async function doDeleteTrip(id: string) {
  deleteTrip(db(), id);
}

/* ── Insurance ── */

export async function fetchInsurancePolicies(vehicleId: string) {
  return getPoliciesByVehicle(db(), vehicleId);
}

export async function doCreatePolicy(
  id: string,
  input: { vehicleId: string; provider: string; policyNumber?: string; coverageType?: string; premiumCents?: number; premiumFrequency?: string; deductibleCents?: number; startDate?: string; endDate?: string; agentName?: string; agentPhone?: string; agentEmail?: string; notes?: string },
) {
  createPolicy(db(), id, input);
}

export async function doUpdatePolicy(
  id: string,
  updates: Partial<{ provider: string; policyNumber: string | null; coverageType: string; premiumCents: number | null; premiumFrequency: string | null; deductibleCents: number | null; startDate: string | null; endDate: string | null; agentName: string | null; agentPhone: string | null; agentEmail: string | null; notes: string | null }>,
) {
  updatePolicy(db(), id, updates);
}

export async function doDeletePolicy(id: string) {
  deletePolicy(db(), id);
}

export async function fetchInsuranceDocuments(policyId: string) {
  return getDocumentsByPolicy(db(), policyId);
}

export async function doCreateInsuranceDocument(id: string, input: { policyId: string; documentType?: string; imageUri: string; label?: string }) {
  createInsuranceDocument(db(), id, input);
}

export async function doDeleteInsuranceDocument(id: string) {
  deleteInsuranceDocument(db(), id);
}

/* ── Registration ── */

export async function fetchRegistration(vehicleId: string) {
  return getRegistrationByVehicle(db(), vehicleId);
}

export async function doCreateRegistration(
  id: string,
  input: { vehicleId: string; regState?: string; regNumber?: string; regExpirationDate?: string; inspectionType?: string; inspectionExpirationDate?: string; inspectionStation?: string; notes?: string },
) {
  createRegistration(db(), id, input);
}

export async function doUpdateRegistration(
  id: string,
  updates: Partial<{ regState: string | null; regNumber: string | null; regExpirationDate: string | null; inspectionType: string; inspectionExpirationDate: string | null; inspectionStation: string | null; notes: string | null }>,
) {
  updateRegistration(db(), id, updates);
}

export async function doDeleteRegistration(id: string) {
  deleteRegistration(db(), id);
}

/* ── GPS Trips ── */

export async function fetchGpsTrips(vehicleId: string) {
  return getGpsTripsByVehicle(db(), vehicleId);
}

export async function doCreateGpsTrip(
  id: string,
  input: { vehicleId: string; purpose?: string; routeName?: string; startLat?: number; startLng?: number; endLat?: number; endLng?: number; distanceMeters: number; durationSeconds: number; polylineEncoded?: string; startedAt: string; endedAt?: string; notes?: string },
) {
  createGpsTrip(db(), id, input);
}

export async function doDeleteGpsTrip(id: string) {
  deleteGpsTrip(db(), id);
}

/* ── Tires ── */

export async function fetchTireSets(vehicleId: string) {
  return getTireSetsByVehicle(db(), vehicleId);
}

export async function fetchCurrentTireSet(vehicleId: string) {
  return getCurrentTireSet(db(), vehicleId);
}

export async function doCreateTireSet(
  id: string,
  input: { vehicleId: string; brand?: string; modelName?: string; size?: string; purchasedAt?: string; purchasePriceCents?: number; purchaseOdometer?: number; notes?: string },
) {
  createTireSet(db(), id, input);
}

export async function doDeleteTireSet(id: string) {
  deleteTireSet(db(), id);
}

export async function fetchMeasurements(tireSetId: string) {
  return getMeasurementsByTireSet(db(), tireSetId);
}

export async function doCreateMeasurement(
  id: string,
  input: { tireSetId: string; position: string; treadDepth32nds: number; measuredAt: string; odometerAt?: number; notes?: string },
) {
  createMeasurement(db(), id, input);
}

export async function fetchRotations(tireSetId: string) {
  return getRotationsByTireSet(db(), tireSetId);
}

export async function doCreateRotation(
  id: string,
  input: { tireSetId: string; rotatedAt: string; odometerAt?: number; pattern?: string; notes?: string },
) {
  createRotation(db(), id, input);
}

/* ── Parking ── */

export async function fetchActiveParking(vehicleId: string) {
  return getActiveParking(db(), vehicleId);
}

export async function doSaveParking(
  id: string,
  input: { vehicleId: string; latitude: number; longitude: number; altitude?: number; accuracy?: number; level?: string; spot?: string; photoUri?: string; meterExpiresAt?: string; notes?: string },
) {
  saveParking(db(), id, input);
}

export async function doClearParking(id: string) {
  clearParking(db(), id);
}

export async function fetchParkingHistory(vehicleId: string, limit?: number) {
  return getParkingHistory(db(), vehicleId, limit);
}

/* ── Recalls ── */

export async function fetchRecalls(vehicleId: string) {
  return getRecallsByVehicle(db(), vehicleId);
}

export async function fetchUnacknowledgedRecalls(vehicleId: string) {
  return getUnacknowledgedRecalls(db(), vehicleId);
}

export async function doCreateRecall(
  id: string,
  input: { vehicleId: string; nhtsaCampaignNumber: string; component?: string; summary?: string; consequence?: string; remedy?: string; fetchedAt: string },
) {
  if (recallExists(db(), input.vehicleId, input.nhtsaCampaignNumber)) return;
  createRecall(db(), id, input);
}

export async function doAcknowledgeRecall(id: string) {
  acknowledgeRecall(db(), id);
}

/* ── Diagnostics ── */

export async function fetchDiagnosticSnapshots(vehicleId: string) {
  return getSnapshotsByVehicle(db(), vehicleId);
}

export async function doCreateSnapshot(
  id: string,
  input: { vehicleId: string; adapterName?: string; protocol?: string; snapshotAt: string; dtcCount: number; milStatus: boolean; notes?: string },
) {
  createSnapshot(db(), id, input);
}

export async function fetchDiagnosticCodes(snapshotId: string) {
  return getCodesBySnapshot(db(), snapshotId);
}

export async function fetchRecentLiveData(vehicleId: string) {
  return getRecentLiveData(db(), vehicleId);
}
