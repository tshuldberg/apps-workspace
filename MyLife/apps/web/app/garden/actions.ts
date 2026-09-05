'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // V1 CRUD
  createPlant, getPlantById, getPlants, updatePlant, deletePlant, getPlantCount, waterPlant,
  createEntry, getEntriesForPlant, getEntriesByDate, deleteEntry,
  createZone, getZones, deleteZone,
  createSeed, getSeeds, updateSeedQuantity, deleteSeed,
  getSetting, setSetting,
  getGardenStats, getWateringSchedule,
  // V2 CRUD
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
  // V1 Engine
  getSeason,
  // V2 Engines
  checkCompatibility, getCompanions, getAntagonists, searchCompanionPlants, getAllCompanionPlants,
  matchSymptoms, getAllSymptoms,
  classifyLight,
  getNextStages, calculateSuccessRate,
  getSeasonalTasksForCategory, getPlantCategories, inferCategory,
  lookupZone, calculateCountdown, getCurrentFrostPhase, getPlantingCalendar,
  // Types
  type CreatePlantInput, type UpdatePlantInput, type CreateEntryInput, type CareAction,
  type CreateZoneInput, type UpdateZoneInput, type CreateSeedInput,
  type PlantFilter,
  type CreateHarvestInput, type CreateDiagnosisInput, type CreateWishListInput,
  type CreatePropagationInput, type CreateLightReadingInput,
  type CreateLayoutInput, type CreateLayoutItemInput,
  type TreatmentStatus, type PropagationStage,
} from '@mylife/garden';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('garden');
  return adapter;
}

// ── V1 Plant CRUD ──

export async function fetchPlants(filter?: PlantFilter) {
  return getPlants(db(), filter);
}

export async function fetchPlantById(id: string) {
  return getPlantById(db(), id);
}

export async function doCreatePlant(input: CreatePlantInput) {
  const id = crypto.randomUUID();
  return createPlant(db(), id, input);
}

export async function doUpdatePlant(id: string, input: UpdatePlantInput) {
  return updatePlant(db(), id, input);
}

export async function doDeletePlant(id: string) {
  return deletePlant(db(), id);
}

export async function fetchPlantCount() {
  return getPlantCount(db());
}

export async function doWaterPlant(plantId: string) {
  waterPlant(db(), plantId);
  return { ok: true };
}

// ── V1 Journal Entries ──

export async function doCreateEntry(input: CreateEntryInput) {
  const id = crypto.randomUUID();
  return createEntry(db(), id, input);
}

export async function fetchEntriesForPlant(plantId: string, limit?: number) {
  return getEntriesForPlant(db(), plantId, limit);
}

export async function fetchEntriesByDate(startDate: string, endDate: string) {
  return getEntriesByDate(db(), startDate, endDate);
}

export async function doDeleteEntry(id: string) {
  return deleteEntry(db(), id);
}

export async function doUpdateEntry(id: string, input: {
  plantId?: string | null;
  date?: string;
  action?: CareAction;
  notes?: string | null;
  imageUri?: string | null;
  quantityGrams?: number | null;
}) {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.plantId !== undefined) {
    updates.push('plant_id = ?');
    params.push(input.plantId);
  }
  if (input.date !== undefined) {
    updates.push('date = ?');
    params.push(input.date);
  }
  if (input.action !== undefined) {
    updates.push('action = ?');
    params.push(input.action);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    params.push(input.notes);
  }
  if (input.imageUri !== undefined) {
    updates.push('image_uri = ?');
    params.push(input.imageUri);
  }
  if (input.quantityGrams !== undefined) {
    updates.push('quantity_grams = ?');
    params.push(input.quantityGrams);
  }

  if (!updates.length) {
    return { ok: true };
  }

  db().execute(`UPDATE gd_entries SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
  return { ok: true };
}

// ── V1 Zone CRUD ──

export async function doCreateZone(input: CreateZoneInput) {
  const id = crypto.randomUUID();
  return createZone(db(), id, input);
}

export async function fetchZones() {
  return getZones(db());
}

export async function doDeleteZone(id: string) {
  return deleteZone(db(), id);
}

// ── V2 Zone Operations ──

export async function doUpdateZone(id: string, input: UpdateZoneInput) {
  return updateZone(db(), id, input);
}

export async function fetchZoneStats(zoneId: string) {
  return getZoneStats(db(), zoneId);
}

// ── V1 Seed CRUD ──

export async function doCreateSeed(input: CreateSeedInput) {
  const id = crypto.randomUUID();
  return createSeed(db(), id, input);
}

export async function fetchSeeds() {
  return getSeeds(db());
}

export async function doUpdateSeedQuantity(id: string, quantity: number) {
  updateSeedQuantity(db(), id, quantity);
  return { ok: true };
}

export async function doDeleteSeed(id: string) {
  return deleteSeed(db(), id);
}

// ── V1 Settings ──

export async function fetchSetting(key: string) {
  return getSetting(db(), key);
}

export async function doSetSetting(key: string, value: string) {
  setSetting(db(), key, value);
  return { ok: true };
}

// ── V1 Analytics ──

export async function fetchGardenStats() {
  return getGardenStats(db());
}

export async function fetchWateringSchedule() {
  return getWateringSchedule(db());
}

export async function fetchGardenPhotos() {
  const adapter = db();
  const plants = getPlants(adapter);
  const entries = getEntriesByDate(adapter, '2000-01-01', new Date().toISOString().slice(0, 10));
  const harvests = getHarvests(adapter, {});

  const plantLookup = new Map(plants.map((plant) => [plant.id, plant]));

  const photos = [
    ...plants
      .filter((plant) => Boolean(plant.imageUri))
      .map((plant) => ({
        id: `plant-${plant.id}`,
        title: plant.name,
        subtitle: plant.species ?? 'Plant portrait',
        imageUri: plant.imageUri as string,
        date: plant.updatedAt,
        zone: plant.zone ?? 'Unassigned',
        plantId: plant.id,
        source: 'plant' as const,
      })),
    ...entries
      .filter((entry) => Boolean(entry.imageUri))
      .map((entry) => ({
        id: `entry-${entry.id}`,
        title: plantLookup.get(entry.plantId ?? '')?.name ?? 'Garden entry',
        subtitle: entry.notes ?? 'Archive media',
        imageUri: entry.imageUri as string,
        date: entry.date,
        zone: plantLookup.get(entry.plantId ?? '')?.zone ?? 'Archive',
        plantId: entry.plantId,
        source: 'entry' as const,
      })),
    ...harvests
      .filter((harvest) => Boolean(harvest.imageUri))
      .map((harvest) => ({
        id: `harvest-${harvest.id}`,
        title: plantLookup.get(harvest.plantId)?.name ?? harvest.cropType ?? 'Harvest capture',
        subtitle: harvest.notes ?? harvest.cropType ?? 'Harvest archive',
        imageUri: harvest.imageUri as string,
        date: harvest.date,
        zone: plantLookup.get(harvest.plantId)?.zone ?? 'Harvest log',
        plantId: harvest.plantId,
        source: 'harvest' as const,
      })),
  ];

  return photos.sort((left, right) => right.date.localeCompare(left.date));
}

// ── V2 Identification ──

export async function doCreateIdentification(data: {
  plantId?: string | null; imageUri: string; topSpecies?: string | null;
  topCommonName?: string | null; topConfidence?: number | null;
  allResultsJson?: string | null; source?: string;
}) {
  const id = crypto.randomUUID();
  return createIdentification(db(), id, data);
}

export async function fetchIdentificationsForPlant(plantId: string) {
  return getIdentificationsForPlant(db(), plantId);
}

// ── V2 Seasonal Tasks ──

export async function doCreateSeasonalTask(data: {
  plantId?: string | null; season: string; taskType: string;
  description?: string | null; dueMonth?: number | null;
}) {
  const id = crypto.randomUUID();
  return createSeasonalTask(db(), id, data);
}

export async function doCompleteSeasonalTask(id: string) {
  completeSeasonalTask(db(), id);
  return { ok: true };
}

export async function doSnoozeSeasonalTask(id: string, until: string) {
  snoozeSeasonalTask(db(), id, until);
  return { ok: true };
}

export async function fetchPendingSeasonalTasks(season?: string) {
  return getPendingSeasonalTasks(db(), season);
}

// ── V2 Harvests ──

export async function doCreateHarvest(input: CreateHarvestInput) {
  const id = crypto.randomUUID();
  return createHarvest(db(), id, input);
}

export async function fetchHarvests(filters?: { plantId?: string; cropType?: string; startDate?: string; endDate?: string }) {
  return getHarvests(db(), filters);
}

export async function fetchHarvestStats(year?: number) {
  return getHarvestStats(db(), year);
}

export async function fetchCropTypes() {
  return getCropTypes(db());
}

// ── V2 Diagnoses ──

export async function doCreateDiagnosis(input: CreateDiagnosisInput) {
  const id = crypto.randomUUID();
  return createDiagnosis(db(), id, input);
}

export async function doUpdateDiagnosisStatus(id: string, status: TreatmentStatus) {
  updateDiagnosisStatus(db(), id, status);
  return { ok: true };
}

export async function fetchActiveDiagnoses(plantId?: string) {
  return getActiveDiagnoses(db(), plantId);
}

export async function fetchDiagnosisHistory(plantId: string) {
  return getDiagnosisHistory(db(), plantId);
}

// ── V2 Wishlist ──

export async function doCreateWishListItem(input: CreateWishListInput) {
  const id = crypto.randomUUID();
  return createWishListItem(db(), id, input);
}

export async function fetchWishList(includeAcquired?: boolean) {
  return getWishList(db(), includeAcquired);
}

export async function doMarkWishListAcquired(id: string, plantId?: string | null) {
  markWishListAcquired(db(), id, plantId);
  return { ok: true };
}

export async function doDeleteWishListItem(id: string) {
  deleteWishListItem(db(), id);
  return { ok: true };
}

// ── V2 Propagations ──

export async function doCreatePropagation(input: CreatePropagationInput) {
  const id = crypto.randomUUID();
  return createPropagation(db(), id, input);
}

export async function doAdvancePropagationStage(id: string, stage: PropagationStage) {
  advancePropagationStage(db(), id, stage);
  return { ok: true };
}

export async function doLinkPropagationChild(propagationId: string, childPlantId: string) {
  linkPropagationChild(db(), propagationId, childPlantId);
  return { ok: true };
}

export async function fetchActivePropagations() {
  return getActivePropagations(db());
}

export async function fetchPropagationStats() {
  return getPropagationStats(db());
}

// ── V2 Light Readings ──

export async function doCreateLightReading(input: CreateLightReadingInput) {
  const id = crypto.randomUUID();
  return createLightReading(db(), id, input);
}

export async function fetchLightReadingsForZone(zoneId: string) {
  return getLightReadingsForZone(db(), zoneId);
}

export async function fetchZoneAverageLux(zoneId: string) {
  return getZoneAverageLux(db(), zoneId);
}

// ── V2 Layouts ──

export async function doCreateLayout(input: CreateLayoutInput) {
  const id = crypto.randomUUID();
  return createLayout(db(), id, input);
}

export async function fetchLayouts(zoneId?: string) {
  return getLayouts(db(), zoneId);
}

export async function doDeleteLayout(id: string) {
  deleteLayout(db(), id);
  return { ok: true };
}

export async function doCreateLayoutItem(input: CreateLayoutItemInput) {
  const id = crypto.randomUUID();
  return createLayoutItem(db(), id, input);
}

export async function fetchLayoutItems(layoutId: string) {
  return getLayoutItems(db(), layoutId);
}

export async function doDeleteLayoutItem(id: string) {
  deleteLayoutItem(db(), id);
  return { ok: true };
}

// ── V2 Frost Config ──

export async function fetchFrostConfig() {
  return getFrostConfig(db());
}

export async function doSetFrostConfig(data: {
  zipCode?: string | null; usdaZone?: string | null;
  avgLastFrost?: string | null; avgFirstFrost?: string | null;
  notificationDaysBefore?: number; customLastFrost?: string | null;
  customFirstFrost?: string | null;
}) {
  setFrostConfig(db(), data);
  return { ok: true };
}

// ── Engine Wrappers ──

export async function engineGetSeason(month: number) {
  return getSeason(month);
}

export async function engineCheckCompatibility(plantA: string, plantB: string) {
  return checkCompatibility(plantA, plantB);
}

export async function engineGetCompanions(plantName: string) {
  return getCompanions(plantName);
}

export async function engineGetAntagonists(plantName: string) {
  return getAntagonists(plantName);
}

export async function engineSearchCompanionPlants(query: string) {
  return searchCompanionPlants(query);
}

export async function engineGetAllCompanionPlants() {
  return getAllCompanionPlants();
}

export async function engineMatchSymptoms(symptoms: string[]) {
  return matchSymptoms(symptoms);
}

export async function engineGetAllSymptoms() {
  return getAllSymptoms();
}

export async function engineClassifyLight(lux: number) {
  return classifyLight(lux);
}

export async function engineGetNextStages(currentStage: 'started' | 'callusing' | 'rooting' | 'growing' | 'ready' | 'potted' | 'failed') {
  return getNextStages(currentStage);
}

export async function engineCalculateSuccessRate(totalCount: number, pottedCount: number) {
  return calculateSuccessRate(totalCount, pottedCount);
}

export async function engineGetSeasonalTasks(category: string, season: 'spring' | 'summer' | 'fall' | 'winter') {
  return getSeasonalTasksForCategory(category, season);
}

export async function engineGetPlantCategories() {
  return getPlantCategories();
}

export async function engineInferCategory(species: string) {
  return inferCategory(species);
}

export async function engineLookupZone(usdaZone: string) {
  return lookupZone(usdaZone);
}

export async function engineCalculateCountdown(targetMmDd: string, today: string) {
  return calculateCountdown(targetMmDd, today);
}

export async function engineGetCurrentFrostPhase(lastFrost: string, firstFrost: string) {
  const today = new Date().toISOString().slice(0, 10);
  return getCurrentFrostPhase(lastFrost, firstFrost, today);
}

export async function engineGetPlantingCalendar() {
  return getPlantingCalendar();
}
