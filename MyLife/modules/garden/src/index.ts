// Definition
export { GARDEN_MODULE } from './definition';

// UI barrel. `./ui/index.ts` exports only web-safe design tokens; the full
// RN component surface lives in `./ui/index.native.ts` which Metro picks on
// iOS/Android. Web bundlers ignore `.native.ts` and see tokens only.
export * from './ui';

// Types and schemas
export type {
  PlantLocation, PlantStatus, CareAction, Season,
  Plant, GardenEntry, GardenZone, Seed, GardenSetting,
  CreatePlantInput, UpdatePlantInput, CreateEntryInput, CreateZoneInput, CreateSeedInput,
  PlantFilter, GardenStats, WateringScheduleItem,
  // V2 types
  ZoneType, LightLevel, HumidityLevel, HarvestUnit, DiagnosisType, Severity,
  TreatmentStatus, WishListPriority, PropagationMethod, PropagationMedium, PropagationStage,
  SeasonalTaskType, LayoutItemType, CompanionRelationship,
  Identification, SeasonalTask, HarvestRecord, Diagnosis, WishListItem,
  Propagation, LightReading, Layout, LayoutItem, FrostConfig, CompanionEntry,
  CreateHarvestInput, CreateDiagnosisInput, CreateWishListInput, CreatePropagationInput,
  CreateLightReadingInput, CreateLayoutInput, CreateLayoutItemInput, UpdateZoneInput,
  HarvestStats, ZoneStats, PropagationStats, FrostPhase,
} from './types';

export {
  PlantLocationSchema, PlantStatusSchema, CareActionSchema, SeasonSchema,
  PlantSchema, GardenEntrySchema, GardenZoneSchema, SeedSchema, GardenSettingSchema,
  CreatePlantInputSchema, UpdatePlantInputSchema, CreateEntryInputSchema,
  CreateZoneInputSchema, CreateSeedInputSchema, PlantFilterSchema,
  // V2 schemas
  ZoneTypeSchema, LightLevelSchema, HumidityLevelSchema, HarvestUnitSchema,
  DiagnosisTypeSchema, SeveritySchema, TreatmentStatusSchema, WishListPrioritySchema,
  PropagationMethodSchema, PropagationMediumSchema, PropagationStageSchema,
  SeasonalTaskTypeSchema, LayoutItemTypeSchema, CompanionRelationshipSchema,
  CreateHarvestInputSchema, CreateDiagnosisInputSchema, CreateWishListInputSchema,
  CreatePropagationInputSchema, CreateLightReadingInputSchema,
  CreateLayoutInputSchema, CreateLayoutItemInputSchema, UpdateZoneInputSchema,
} from './types';

// V1 CRUD
export {
  createPlant, getPlantById, getPlants, updatePlant, deletePlant, getPlantCount, waterPlant,
  createEntry, getEntriesForPlant, getEntriesByDate, deleteEntry,
  createZone, getZones, deleteZone,
  createSeed, getSeeds, updateSeedQuantity, deleteSeed,
  getSetting, setSetting,
  getGardenStats, getWateringSchedule,
} from './db/crud';

// V2 CRUD
export {
  updateZone, getZoneStats,
  createIdentification, getIdentificationsForPlant,
  createSeasonalTask, completeSeasonalTask, snoozeSeasonalTask, getPendingSeasonalTasks,
  createHarvest, getHarvests, getHarvestStats, getCropTypes,
  createDiagnosis, updateDiagnosisStatus, getActiveDiagnoses, getDiagnosisHistory,
  createWishListItem, getWishList, markWishListAcquired, deleteWishListItem,
  createPropagation, advancePropagationStage, linkPropagationChild, getActivePropagations, getPropagationStats,
  createLightReading, getLightReadingsForZone, getZoneAverageLux,
  createLayout, getLayouts, deleteLayout, createLayoutItem, getLayoutItems, deleteLayoutItem,
  getFrostConfig, setFrostConfig,
} from './db/crud-v2';

// V1 Engine
export {
  calculateNextWaterDate, isDaysOverdue, getSeason,
  adjustFrequencyForSeason, calculateSurvivalRate, calculateGDD,
} from './engine/watering';

// V2 Engines
export { checkCompatibility, getCompanions, getAntagonists, searchCompanionPlants, getAllCompanionPlants } from './engine/companion';
export { COMPANION_DATA } from './engine/companion-data';
export { matchSymptoms, getAllSymptoms } from './engine/diagnosis-db';
export { classifyLight, lightLevelDescription, averageLux } from './engine/light';
export { isValidStageTransition, getNextStages, calculateSuccessRate } from './engine/propagation';
export { getSeasonalTasksForCategory, getPlantCategories, inferCategory } from './engine/seasonal-data';
export { lookupZone, calculateCountdown, getCurrentFrostPhase, getPlantingCalendar } from './engine/frost';
export { ZONE_FROST_DATES, PLANTING_CALENDAR } from './engine/frost-data';
