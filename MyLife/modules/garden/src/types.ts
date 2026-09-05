import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────

export const PlantLocationSchema = z.enum([
  'indoor',
  'outdoor',
  'greenhouse',
  'balcony',
]);
export type PlantLocation = z.infer<typeof PlantLocationSchema>;

export const PlantStatusSchema = z.enum([
  'healthy',
  'needs_attention',
  'dormant',
  'dead',
]);
export type PlantStatus = z.infer<typeof PlantStatusSchema>;

export const CareActionSchema = z.enum([
  'water',
  'fertilize',
  'prune',
  'repot',
  'harvest',
  'pest_treatment',
  'photo',
  'note',
]);
export type CareAction = z.infer<typeof CareActionSchema>;

export const SeasonSchema = z.enum(['spring', 'summer', 'fall', 'winter']);
export type Season = z.infer<typeof SeasonSchema>;

// ── Core Entities ──────────────────────────────────────────────────────

export const PlantSchema = z.object({
  id: z.string(),
  name: z.string(),
  species: z.string().nullable(),
  location: PlantLocationSchema,
  zone: z.string().nullable(),
  imageUri: z.string().nullable(),
  waterFrequencyDays: z.number().int().nullable(),
  lastWatered: z.string().nullable(),
  status: PlantStatusSchema,
  acquiredDate: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Plant = z.infer<typeof PlantSchema>;

export const GardenEntrySchema = z.object({
  id: z.string(),
  plantId: z.string().nullable(),
  date: z.string(),
  action: CareActionSchema,
  notes: z.string().nullable(),
  imageUri: z.string().nullable(),
  quantityGrams: z.number().nullable(),
  createdAt: z.string(),
});
export type GardenEntry = z.infer<typeof GardenEntrySchema>;

export const GardenZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: PlantLocationSchema,
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type GardenZone = z.infer<typeof GardenZoneSchema>;

export const SeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  species: z.string().nullable(),
  quantity: z.number().int(),
  source: z.string().nullable(),
  purchasedDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type Seed = z.infer<typeof SeedSchema>;

export const GardenSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type GardenSetting = z.infer<typeof GardenSettingSchema>;

// ── Input Schemas ──────────────────────────────────────────────────────

export const CreatePlantInputSchema = z.object({
  name: z.string().min(1).max(100),
  species: z.string().nullable().default(null),
  location: PlantLocationSchema.default('indoor'),
  zone: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
  waterFrequencyDays: z.number().int().min(1).nullable().default(null),
  status: PlantStatusSchema.default('healthy'),
  acquiredDate: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type CreatePlantInput = z.input<typeof CreatePlantInputSchema>;

export const UpdatePlantInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  species: z.string().nullable().optional(),
  location: PlantLocationSchema.optional(),
  zone: z.string().nullable().optional(),
  imageUri: z.string().nullable().optional(),
  waterFrequencyDays: z.number().int().min(1).nullable().optional(),
  lastWatered: z.string().nullable().optional(),
  status: PlantStatusSchema.optional(),
  acquiredDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type UpdatePlantInput = z.input<typeof UpdatePlantInputSchema>;

export const CreateEntryInputSchema = z.object({
  plantId: z.string().nullable().default(null),
  date: z.string().optional(),
  action: CareActionSchema,
  notes: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
  quantityGrams: z.number().nullable().default(null),
});
export type CreateEntryInput = z.input<typeof CreateEntryInputSchema>;

export const CreateZoneInputSchema = z.object({
  name: z.string().min(1).max(100),
  location: PlantLocationSchema.default('indoor'),
  description: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});
export type CreateZoneInput = z.input<typeof CreateZoneInputSchema>;

export const CreateSeedInputSchema = z.object({
  name: z.string().min(1).max(100),
  species: z.string().nullable().default(null),
  quantity: z.number().int().min(0).default(0),
  source: z.string().nullable().default(null),
  purchasedDate: z.string().nullable().default(null),
  expiryDate: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type CreateSeedInput = z.input<typeof CreateSeedInputSchema>;

export const PlantFilterSchema = z.object({
  location: PlantLocationSchema.optional(),
  status: PlantStatusSchema.optional(),
  zone: z.string().nullable().optional(),
  needsWater: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
});
export type PlantFilter = z.input<typeof PlantFilterSchema>;

// ── V2 Enums ──────────────────────────────────────────────────────────

export const ZoneTypeSchema = z.enum([
  'room', 'greenhouse', 'balcony', 'yard_section', 'raised_bed', 'windowsill', 'shelf', 'custom',
]);
export type ZoneType = z.infer<typeof ZoneTypeSchema>;

export const LightLevelSchema = z.enum(['low', 'medium', 'bright_indirect', 'direct']);
export type LightLevel = z.infer<typeof LightLevelSchema>;

export const HumidityLevelSchema = z.enum(['low', 'medium', 'high']);
export type HumidityLevel = z.infer<typeof HumidityLevelSchema>;

export const HarvestUnitSchema = z.enum(['grams', 'kg', 'oz', 'lbs', 'count', 'bunches', 'cups']);
export type HarvestUnit = z.infer<typeof HarvestUnitSchema>;

export const DiagnosisTypeSchema = z.enum(['disease', 'pest', 'nutrient_deficiency', 'environmental', 'unknown']);
export type DiagnosisType = z.infer<typeof DiagnosisTypeSchema>;

export const SeveritySchema = z.enum(['mild', 'moderate', 'severe', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const TreatmentStatusSchema = z.enum(['pending', 'in_treatment', 'resolved', 'unresolvable']);
export type TreatmentStatus = z.infer<typeof TreatmentStatusSchema>;

export const WishListPrioritySchema = z.enum(['high', 'medium', 'low']);
export type WishListPriority = z.infer<typeof WishListPrioritySchema>;

export const PropagationMethodSchema = z.enum([
  'stem_cutting', 'leaf_cutting', 'division', 'seed', 'air_layering', 'water_propagation', 'grafting', 'offsets',
]);
export type PropagationMethod = z.infer<typeof PropagationMethodSchema>;

export const PropagationMediumSchema = z.enum([
  'water', 'soil', 'perlite', 'sphagnum_moss', 'leca', 'vermiculite', 'none',
]);
export type PropagationMedium = z.infer<typeof PropagationMediumSchema>;

export const PropagationStageSchema = z.enum([
  'started', 'callusing', 'rooting', 'growing', 'ready', 'potted', 'failed',
]);
export type PropagationStage = z.infer<typeof PropagationStageSchema>;

export const SeasonalTaskTypeSchema = z.enum([
  'increase_watering', 'decrease_watering', 'start_fertilizing', 'stop_fertilizing',
  'prune', 'repot', 'move_indoors', 'move_outdoors', 'check_pests', 'mulch', 'divide', 'custom',
]);
export type SeasonalTaskType = z.infer<typeof SeasonalTaskTypeSchema>;

export const LayoutItemTypeSchema = z.enum(['plant', 'path', 'structure', 'water', 'decoration', 'empty']);
export type LayoutItemType = z.infer<typeof LayoutItemTypeSchema>;

export const CompanionRelationshipSchema = z.enum(['companion', 'antagonist', 'neutral']);
export type CompanionRelationship = z.infer<typeof CompanionRelationshipSchema>;

// ── V2 Entities ───────────────────────────────────────────────────────

export interface Identification {
  id: string;
  plantId: string | null;
  imageUri: string;
  topSpecies: string | null;
  topCommonName: string | null;
  topConfidence: number | null;
  allResultsJson: string | null;
  source: string;
  createdAt: string;
}

export interface SeasonalTask {
  id: string;
  plantId: string | null;
  season: Season;
  taskType: SeasonalTaskType;
  description: string | null;
  dueMonth: number | null;
  completedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
}

export interface HarvestRecord {
  id: string;
  plantId: string;
  date: string;
  quantity: number;
  unit: HarvestUnit;
  cropType: string | null;
  qualityRating: number | null;
  imageUri: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Diagnosis {
  id: string;
  plantId: string | null;
  diagnosedDate: string;
  type: DiagnosisType;
  symptomsJson: string;
  diagnosisName: string | null;
  diagnosisConfidence: number | null;
  severity: Severity;
  treatmentNotes: string | null;
  treatmentStatus: TreatmentStatus;
  imageUri: string | null;
  resolvedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WishListItem {
  id: string;
  name: string;
  species: string | null;
  source: string | null;
  estimatedPrice: number | null;
  priority: WishListPriority;
  notes: string | null;
  imageUri: string | null;
  addedDate: string;
  acquired: boolean;
  acquiredDate: string | null;
  acquiredPlantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Propagation {
  id: string;
  parentPlantId: string | null;
  method: PropagationMethod;
  medium: PropagationMedium | null;
  startDate: string;
  currentStage: PropagationStage;
  stageUpdatedAt: string;
  notes: string | null;
  imageUri: string | null;
  childPlantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LightReading {
  id: string;
  zoneId: string | null;
  readingLux: number;
  lightLevel: LightLevel;
  readingDate: string;
  readingTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: string;
}

export interface Layout {
  id: string;
  name: string;
  zoneId: string | null;
  widthCells: number;
  heightCells: number;
  cellSizeInches: number;
  season: string | null;
  year: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutItem {
  id: string;
  layoutId: string;
  plantId: string | null;
  itemType: LayoutItemType;
  label: string;
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  color: string | null;
  icon: string | null;
  spacingInches: number | null;
  createdAt: string;
}

export interface FrostConfig {
  id: string;
  zipCode: string | null;
  usdaZone: string | null;
  avgLastFrost: string | null;
  avgFirstFrost: string | null;
  notificationDaysBefore: number;
  customLastFrost: string | null;
  customFirstFrost: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanionEntry {
  plantA: string;
  plantB: string;
  relationship: CompanionRelationship;
  benefit: string;
  category: string;
}

// ── V2 Input Schemas ──────────────────────────────────────────────────

export const CreateIdentificationInputSchema = z.object({
  plantId: z.string().nullable().default(null),
  imageUri: z.string(),
  topSpecies: z.string().nullable().default(null),
  topCommonName: z.string().nullable().default(null),
  topConfidence: z.number().min(0).max(1).nullable().default(null),
  allResultsJson: z.string().nullable().default('[]'),
  source: z.string().default('on_device'),
});
export type CreateIdentificationInput = z.input<typeof CreateIdentificationInputSchema>;

export const CreateSeasonalTaskInputSchema = z.object({
  plantId: z.string().nullable().default(null),
  season: SeasonSchema,
  taskType: SeasonalTaskTypeSchema,
  description: z.string().nullable().default(null),
  dueMonth: z.number().int().min(1).max(12).nullable().default(null),
});
export type CreateSeasonalTaskInput = z.input<typeof CreateSeasonalTaskInputSchema>;

export const SaveFrostConfigInputSchema = z.object({
  zipCode: z.string().nullable().default(null),
  usdaZone: z.string().nullable().default(null),
  avgLastFrost: z.string().nullable().default(null),
  avgFirstFrost: z.string().nullable().default(null),
  notificationDaysBefore: z.number().int().default(7),
  customLastFrost: z.string().nullable().default(null),
  customFirstFrost: z.string().nullable().default(null),
});
export type SaveFrostConfigInput = z.input<typeof SaveFrostConfigInputSchema>;

export const CreateHarvestInputSchema = z.object({
  plantId: z.string(),
  date: z.string().optional(),
  quantity: z.number().positive(),
  unit: HarvestUnitSchema.default('grams'),
  cropType: z.string().nullable().default(null),
  qualityRating: z.number().int().min(1).max(5).nullable().default(null),
  imageUri: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type CreateHarvestInput = z.input<typeof CreateHarvestInputSchema>;

export const CreateDiagnosisInputSchema = z.object({
  plantId: z.string().nullable().default(null),
  diagnosedDate: z.string().optional(),
  type: DiagnosisTypeSchema,
  symptoms: z.array(z.string()).min(1).max(10),
  diagnosisName: z.string().nullable().default(null),
  diagnosisConfidence: z.number().min(0).max(1).nullable().default(null),
  severity: SeveritySchema.default('moderate'),
  treatmentNotes: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
});
export type CreateDiagnosisInput = z.input<typeof CreateDiagnosisInputSchema>;

export const CreateWishListInputSchema = z.object({
  name: z.string().min(1).max(200),
  species: z.string().nullable().default(null),
  source: z.string().nullable().default(null),
  estimatedPrice: z.number().nullable().default(null),
  priority: WishListPrioritySchema.default('medium'),
  notes: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
});
export type CreateWishListInput = z.input<typeof CreateWishListInputSchema>;

export const CreatePropagationInputSchema = z.object({
  parentPlantId: z.string().nullable().default(null),
  method: PropagationMethodSchema,
  medium: PropagationMediumSchema.nullable().default(null),
  startDate: z.string().optional(),
  notes: z.string().nullable().default(null),
  imageUri: z.string().nullable().default(null),
});
export type CreatePropagationInput = z.input<typeof CreatePropagationInputSchema>;

export const CreateLightReadingInputSchema = z.object({
  zoneId: z.string().nullable().default(null),
  readingLux: z.number().int().min(0).max(100000),
  readingDate: z.string().optional(),
  readingTime: z.string().nullable().default(null),
  durationMinutes: z.number().int().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type CreateLightReadingInput = z.input<typeof CreateLightReadingInputSchema>;

export const CreateLayoutInputSchema = z.object({
  name: z.string().min(1).max(200),
  zoneId: z.string().nullable().default(null),
  widthCells: z.number().int().min(1).max(50).default(8),
  heightCells: z.number().int().min(1).max(50).default(8),
  cellSizeInches: z.number().int().default(12),
  season: z.string().nullable().default(null),
  year: z.number().int().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type CreateLayoutInput = z.input<typeof CreateLayoutInputSchema>;

export const CreateLayoutItemInputSchema = z.object({
  layoutId: z.string(),
  plantId: z.string().nullable().default(null),
  itemType: LayoutItemTypeSchema.default('plant'),
  label: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  widthCells: z.number().int().min(1).default(1),
  heightCells: z.number().int().min(1).default(1),
  color: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  spacingInches: z.number().int().nullable().default(null),
});
export type CreateLayoutItemInput = z.input<typeof CreateLayoutItemInputSchema>;

export const UpdateZoneInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: PlantLocationSchema.optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  zoneType: ZoneTypeSchema.optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  photoUri: z.string().nullable().optional(),
  lightLevel: LightLevelSchema.nullable().optional(),
  humidity: HumidityLevelSchema.nullable().optional(),
  temperatureNotes: z.string().nullable().optional(),
});
export type UpdateZoneInput = z.input<typeof UpdateZoneInputSchema>;

// ── V2 Analytics Types ────────────────────────────────────────────────

export interface HarvestStats {
  totalQuantity: number;
  totalHarvests: number;
  topProducer: { plantId: string; plantName: string; total: number } | null;
}

export interface ZoneStats {
  zoneId: string;
  zoneName: string;
  plantCount: number;
  healthyCount: number;
  needsAttentionCount: number;
  overdueCount: number;
}

export interface PropagationStats {
  total: number;
  successCount: number;
  failedCount: number;
  activeCount: number;
  successRate: number;
}

export interface FrostPhase {
  phase: 'pre_season' | 'growing' | 'pre_frost' | 'off_season';
  daysUntilEvent: number;
  eventDate: string;
  eventName: string;
}

// ── Analytics Types ────────────────────────────────────────────────────

export interface GardenStats {
  totalPlants: number;
  healthyCount: number;
  needsAttentionCount: number;
  dormantCount: number;
  deadCount: number;
  totalHarvestGrams: number;
  totalEntries: number;
  overdueWateringCount: number;
}

export interface WateringScheduleItem {
  plantId: string;
  plantName: string;
  lastWatered: string | null;
  frequencyDays: number;
  nextWaterDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
}
