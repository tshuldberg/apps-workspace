import { z } from 'zod';

// ── Fuel type enum ──────────────────────────────────────────────────────────
export const FuelTypeSchema = z.enum(['gas', 'diesel', 'electric', 'hybrid']);
export type FuelType = z.infer<typeof FuelTypeSchema>;

// ── Maintenance type enum ───────────────────────────────────────────────────
export const MaintenanceTypeSchema = z.enum([
  'oil_change',
  'tire_rotation',
  'brakes',
  'battery',
  'inspection',
  'wash',
  'other',
]);
export type MaintenanceType = z.infer<typeof MaintenanceTypeSchema>;

// ── Vehicle ─────────────────────────────────────────────────────────────────
export const VehicleSchema = z.object({
  id: z.string(),
  name: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  color: z.string().nullable(),
  vin: z.string().nullable(),
  licensePlate: z.string().nullable(),
  odometer: z.number().int(),
  fuelType: FuelTypeSchema,
  isPrimary: z.boolean(),
  imageUri: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

// ── Maintenance record ──────────────────────────────────────────────────────
export const MaintenanceSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  type: MaintenanceTypeSchema,
  description: z.string().nullable(),
  costCents: z.number().int().nullable(),
  odometerAt: z.number().int().nullable(),
  performedAt: z.string(),
  nextDueDate: z.string().nullable(),
  nextDueOdometer: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type Maintenance = z.infer<typeof MaintenanceSchema>;

// ── Fuel log entry ──────────────────────────────────────────────────────────
export const FuelLogSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  gallons: z.number(),
  costCents: z.number().int(),
  odometerAt: z.number().int(),
  station: z.string().nullable(),
  isFullTank: z.boolean(),
  loggedAt: z.string(),
  createdAt: z.string(),
});
export type FuelLog = z.infer<typeof FuelLogSchema>;

// ── Schedule service type enum ───────────────────────────────────────────
export const ScheduleServiceTypeSchema = z.enum([
  'oil_change',
  'tire_rotation',
  'brake_inspection',
  'air_filter',
  'transmission_fluid',
  'coolant',
  'spark_plugs',
  'battery',
  'inspection',
  'registration',
  'custom',
]);
export type ScheduleServiceType = z.infer<typeof ScheduleServiceTypeSchema>;

// ── Schedule status ──────────────────────────────────────────────────────
export const ScheduleStatusSchema = z.enum(['ok', 'due_soon', 'overdue', 'unknown']);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

// ── Maintenance schedule ─────────────────────────────────────────────────
export const MaintenanceScheduleSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  serviceType: ScheduleServiceTypeSchema,
  serviceTypeCustom: z.string().nullable(),
  intervalMiles: z.number().int().nullable(),
  intervalMonths: z.number().int().nullable(),
  lastServiceDate: z.string().nullable(),
  lastServiceOdometer: z.number().int().nullable(),
  nextDueOdometer: z.number().int().nullable(),
  nextDueDate: z.string().nullable(),
  isActive: z.boolean(),
  snoozeMiles: z.number().int(),
  snoozeDateOffsetDays: z.number().int(),
  snoozeCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MaintenanceSchedule = z.infer<typeof MaintenanceScheduleSchema>;

// ── Create schedule input ────────────────────────────────────────────────
export const CreateScheduleInputSchema = z.object({
  vehicleId: z.string(),
  serviceType: ScheduleServiceTypeSchema.default('custom'),
  serviceTypeCustom: z.string().optional(),
  intervalMiles: z.number().int().min(500).optional(),
  intervalMonths: z.number().int().min(1).optional(),
  lastServiceDate: z.string().optional(),
  lastServiceOdometer: z.number().int().optional(),
}).refine(
  (data) => data.intervalMiles !== undefined || data.intervalMonths !== undefined,
  { message: 'At least one of intervalMiles or intervalMonths must be provided' },
).refine(
  (data) => data.serviceType !== 'custom' || (data.serviceTypeCustom !== undefined && data.serviceTypeCustom.trim().length > 0),
  { message: 'serviceTypeCustom is required when serviceType is "custom"' },
);
export type CreateScheduleInput = z.output<typeof CreateScheduleInputSchema>;
export type CreateScheduleRawInput = z.input<typeof CreateScheduleInputSchema>;

// ── Trip purpose enum ────────────────────────────────────────────────────
export const TripPurposeSchema = z.enum([
  'personal', 'business', 'medical', 'charity', 'moving', 'commute',
]);
export type TripPurpose = z.infer<typeof TripPurposeSchema>;

// ── Trip ─────────────────────────────────────────────────────────────────
export const TripSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  purpose: TripPurposeSchema,
  routeName: z.string().nullable(),
  startOdometer: z.number().int(),
  endOdometer: z.number().int(),
  distance: z.number().int(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type Trip = z.infer<typeof TripSchema>;

// ── Coverage type enum ───────────────────────────────────────────────────
export const CoverageTypeSchema = z.enum([
  'liability', 'comprehensive', 'collision', 'uninsured', 'umbrella',
]);
export type CoverageType = z.infer<typeof CoverageTypeSchema>;

// ── Premium frequency enum ───────────────────────────────────────────────
export const PremiumFrequencySchema = z.enum([
  'monthly', 'quarterly', 'semi_annual', 'annual',
]);
export type PremiumFrequency = z.infer<typeof PremiumFrequencySchema>;

// ── Insurance document type enum ─────────────────────────────────────────
export const InsuranceDocTypeSchema = z.enum([
  'card_front', 'card_back', 'policy_doc', 'declaration_page', 'other',
]);
export type InsuranceDocType = z.infer<typeof InsuranceDocTypeSchema>;

// ── Insurance policy ─────────────────────────────────────────────────────
export const InsurancePolicySchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  provider: z.string(),
  policyNumber: z.string().nullable(),
  coverageType: CoverageTypeSchema,
  premiumCents: z.number().int().nullable(),
  premiumFrequency: PremiumFrequencySchema.nullable(),
  deductibleCents: z.number().int().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  agentName: z.string().nullable(),
  agentPhone: z.string().nullable(),
  agentEmail: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type InsurancePolicy = z.infer<typeof InsurancePolicySchema>;

// ── Insurance document ───────────────────────────────────────────────────
export const InsuranceDocumentSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  documentType: InsuranceDocTypeSchema,
  imageUri: z.string(),
  label: z.string().nullable(),
  createdAt: z.string(),
});
export type InsuranceDocument = z.infer<typeof InsuranceDocumentSchema>;

// ── Inspection type enum ─────────────────────────────────────────────────
export const InspectionTypeSchema = z.enum(['safety', 'emissions', 'both', 'none']);
export type InspectionType = z.infer<typeof InspectionTypeSchema>;

// ── Registration document type enum ──────────────────────────────────────
export const RegDocTypeSchema = z.enum([
  'reg_card_front', 'reg_card_back', 'inspection_cert', 'emissions_report', 'other',
]);
export type RegDocType = z.infer<typeof RegDocTypeSchema>;

// ── Registration ─────────────────────────────────────────────────────────
export const RegistrationSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  regState: z.string().nullable(),
  regNumber: z.string().nullable(),
  regExpirationDate: z.string().nullable(),
  inspectionType: InspectionTypeSchema,
  inspectionExpirationDate: z.string().nullable(),
  inspectionStation: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Registration = z.infer<typeof RegistrationSchema>;

// ── Registration document ────────────────────────────────────────────────
export const RegistrationDocumentSchema = z.object({
  id: z.string(),
  registrationId: z.string(),
  documentType: RegDocTypeSchema,
  imageUri: z.string(),
  label: z.string().nullable(),
  createdAt: z.string(),
});
export type RegistrationDocument = z.infer<typeof RegistrationDocumentSchema>;

// ── GPS trip ─────────────────────────────────────────────────────────────
export const GpsTripSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  purpose: TripPurposeSchema,
  routeName: z.string().nullable(),
  startLat: z.number().nullable(),
  startLng: z.number().nullable(),
  endLat: z.number().nullable(),
  endLng: z.number().nullable(),
  distanceMeters: z.number(),
  durationSeconds: z.number().int(),
  polylineEncoded: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type GpsTrip = z.infer<typeof GpsTripSchema>;

// ── Tire position enum ───────────────────────────────────────────────────
export const TirePositionSchema = z.enum(['FL', 'FR', 'RL', 'RR', 'spare']);
export type TirePosition = z.infer<typeof TirePositionSchema>;

// ── Tire set ─────────────────────────────────────────────────────────────
export const TireSetSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  brand: z.string().nullable(),
  modelName: z.string().nullable(),
  size: z.string().nullable(),
  purchasedAt: z.string().nullable(),
  purchasePriceCents: z.number().int().nullable(),
  purchaseOdometer: z.number().int().nullable(),
  isCurrent: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TireSet = z.infer<typeof TireSetSchema>;

// ── Tire measurement ─────────────────────────────────────────────────────
export const TireMeasurementSchema = z.object({
  id: z.string(),
  tireSetId: z.string(),
  position: TirePositionSchema,
  treadDepth32nds: z.number().int(),
  measuredAt: z.string(),
  odometerAt: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type TireMeasurement = z.infer<typeof TireMeasurementSchema>;

// ── Tire rotation ────────────────────────────────────────────────────────
export const TireRotationSchema = z.object({
  id: z.string(),
  tireSetId: z.string(),
  rotatedAt: z.string(),
  odometerAt: z.number().int().nullable(),
  pattern: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type TireRotation = z.infer<typeof TireRotationSchema>;

// ── Parking location ─────────────────────────────────────────────────────
export const ParkingLocationSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable(),
  accuracy: z.number().nullable(),
  level: z.string().nullable(),
  spot: z.string().nullable(),
  photoUri: z.string().nullable(),
  meterExpiresAt: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  savedAt: z.string(),
  clearedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ParkingLocation = z.infer<typeof ParkingLocationSchema>;

// ── Recall ───────────────────────────────────────────────────────────────
export const RecallSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  nhtsaCampaignNumber: z.string(),
  component: z.string().nullable(),
  summary: z.string().nullable(),
  consequence: z.string().nullable(),
  remedy: z.string().nullable(),
  isAcknowledged: z.boolean(),
  fetchedAt: z.string(),
  createdAt: z.string(),
});
export type Recall = z.infer<typeof RecallSchema>;

// ── DTC severity enum ────────────────────────────────────────────────────
export const DTCSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type DTCSeverity = z.infer<typeof DTCSeveritySchema>;

// ── DTC system enum ──────────────────────────────────────────────────────
export const DTCSystemSchema = z.enum(['powertrain', 'chassis', 'body', 'network']);
export type DTCSystem = z.infer<typeof DTCSystemSchema>;

// ── Diagnostic snapshot ──────────────────────────────────────────────────
export const DiagnosticSnapshotSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  adapterName: z.string().nullable(),
  protocol: z.string().nullable(),
  snapshotAt: z.string(),
  dtcCount: z.number().int(),
  milStatus: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type DiagnosticSnapshot = z.infer<typeof DiagnosticSnapshotSchema>;

// ── Diagnostic code ──────────────────────────────────────────────────────
export const DiagnosticCodeSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  code: z.string(),
  system: DTCSystemSchema,
  description: z.string().nullable(),
  severity: DTCSeveritySchema,
  isPending: z.boolean(),
  createdAt: z.string(),
});
export type DiagnosticCode = z.infer<typeof DiagnosticCodeSchema>;

// ── Live data log ────────────────────────────────────────────────────────
export const LiveDataLogSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  pid: z.string(),
  pidName: z.string().nullable(),
  value: z.number(),
  unit: z.string().nullable(),
  loggedAt: z.string(),
});
export type LiveDataLog = z.infer<typeof LiveDataLogSchema>;
