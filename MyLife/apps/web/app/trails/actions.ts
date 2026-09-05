'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getTrails,
  getTrail,
  createTrail,
  updateTrail,
  deleteTrail,
  getRecordings,
  getRecording,
  getRecordingsByTrail,
  deleteRecording,
  getWaypointsByRecording,
  getTrailStats,
  getPhotos,
  getPackingTemplates,
  getPackingTemplate,
  createPackingTemplate,
  createPackingItem,
  getPackingItems,
  updatePackingItem,
  checkItem,
  uncheckItem,
  uncheckAll,
  deletePackingTemplate,
  deletePackingItem,
  getPackingProgress,
  getTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  createTripDay,
  getTripDays,
  updateTripDay,
  deleteTripDay,
  createTripActivity,
  getTripActivities,
  updateTripActivity,
  deleteTripActivity,
  reorderActivities,
  getDatabaseEntries,
  searchDatabaseTrails,
  saveDatabaseTrailToMyTrails,
  createReview,
  getReviewsByTrail,
  updateReview,
  deleteReview,
  getAverageRating,
  getReviewCount,
  getRecentConditions,
  getRatingDistribution,
  getSegmentsByTrail,
  getEffortsBySegment,
  getPersonalBest,
  getOfflineRegions,
  createOfflineRegion,
  deleteOfflineRegion,
  getAlertSettings,
  updateAlertSettings,
  getDeviationEvents,
  getPlannedRoutes,
  getPlannedRoute,
  createPlannedRoute,
  deletePlannedRoute,
  createRouteWaypoint,
  getRouteWaypoints,
  deleteRouteWaypoint,
  formatDuration,
  estimateCalories,
  getSetting,
  setSetting,
  REGION_CATALOG,
  type CreateTrailInput,
  type UpdateTrailInput,
  type CreatePackingItemInput,
  type UpdatePackingItemInput,
  type CreateTripInput,
  type CreateTripDayInput,
  type CreateTripActivityInput,
  type CreateReviewInput,
  type CreateOfflineRegionInput,
  type UpdateAlertSettingsInput,
  type CreatePlannedRouteInput,
  type CreateRouteWaypointInput,
} from '@mylife/trails';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('trails');
  return adapter;
}

// ── Trails ────────────────────────────────────────────────────────────

export async function fetchTrails(filters?: { difficulty?: string; savedOnly?: boolean; limit?: number; offset?: number }) {
  return getTrails(db(), filters);
}

export async function fetchTrail(id: string) {
  return getTrail(db(), id);
}

export async function addTrail(input: CreateTrailInput) {
  try {
    return createTrail(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add trail: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function editTrail(id: string, input: UpdateTrailInput) {
  try {
    return updateTrail(db(), id, input);
  } catch (e) {
    throw new Error(`Failed to update trail: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removeTrail(id: string) {
  try {
    return deleteTrail(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete trail: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Recordings ────────────────────────────────────────────────────────

export async function fetchRecordings(options?: { activityType?: string; limit?: number; offset?: number }) {
  return getRecordings(db(), options);
}

export async function fetchRecording(id: string) {
  return getRecording(db(), id);
}

export async function fetchRecordingsByTrail(trailId: string) {
  return getRecordingsByTrail(db(), trailId);
}

export async function fetchWaypoints(recordingId: string) {
  return getWaypointsByRecording(db(), recordingId);
}

export async function removeRecording(id: string) {
  try {
    return deleteRecording(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete recording: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────

export async function fetchStats() {
  return getTrailStats(db());
}

export async function fetchFormattedDuration(seconds: number) {
  return formatDuration(seconds);
}

export async function fetchEstimatedCalories(distanceMeters: number, elevationGainMeters: number, weightKg?: number) {
  return estimateCalories(distanceMeters, elevationGainMeters, weightKg ?? 70);
}

// ── Photos ────────────────────────────────────────────────────────────

export async function fetchPhotos(options?: { trailId?: string; recordingId?: string; limit?: number }) {
  return getPhotos(db(), options);
}

// ── Packing ───────────────────────────────────────────────────────────

export async function fetchPackingTemplates() {
  return getPackingTemplates(db());
}

export async function fetchPackingTemplate(id: string) {
  return getPackingTemplate(db(), id);
}

export async function addPackingTemplate(name: string, type: string) {
  try {
    return createPackingTemplate(db(), crypto.randomUUID(), name, type);
  } catch (e) {
    throw new Error(`Failed to add packing template: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removePackingTemplate(id: string) {
  try {
    return deletePackingTemplate(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete packing template: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchPackingItems(templateId: string) {
  return getPackingItems(db(), templateId);
}

export async function addPackingItem(input: CreatePackingItemInput) {
  try {
    return createPackingItem(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add packing item: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function togglePackingItem(id: string, checked: boolean) {
  try {
    if (checked) {
      checkItem(db(), id);
    } else {
      uncheckItem(db(), id);
    }
    return { ok: true };
  } catch (e) {
    throw new Error(`Failed to toggle packing item: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function uncheckAllItems(templateId: string) {
  try {
    uncheckAll(db(), templateId);
    return { ok: true };
  } catch (e) {
    throw new Error(`Failed to uncheck items: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removePackingItem(id: string) {
  try {
    return deletePackingItem(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete packing item: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchPackingProgress(templateId: string) {
  return getPackingProgress(db(), templateId);
}

export async function editPackingItem(id: string, updates: UpdatePackingItemInput) {
  try {
    return updatePackingItem(db(), id, updates);
  } catch (e) {
    throw new Error(`Failed to update packing item: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Trips ─────────────────────────────────────────────────────────────

export async function fetchTrips() {
  return getTrips(db());
}

export async function fetchTrip(id: string) {
  return getTrip(db(), id);
}

export async function addTrip(input: CreateTripInput) {
  try {
    return createTrip(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add trip: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function editTrip(id: string, updates: { name?: string; startDate?: string | null; endDate?: string | null; notes?: string | null; packingTemplateId?: string | null }) {
  try {
    return updateTrip(db(), id, updates);
  } catch (e) {
    throw new Error(`Failed to update trip: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removeTrip(id: string) {
  try {
    return deleteTrip(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete trip: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchTripDays(tripId: string) {
  return getTripDays(db(), tripId);
}

export async function addTripDay(input: CreateTripDayInput) {
  try {
    return createTripDay(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add trip day: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function editTripDay(id: string, updates: { dayNumber?: number; date?: string | null; title?: string | null; notes?: string | null }) {
  try {
    return updateTripDay(db(), id, updates);
  } catch (e) {
    throw new Error(`Failed to update trip day: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removeTripDay(id: string) {
  try {
    return deleteTripDay(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete trip day: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchTripActivities(dayId: string) {
  return getTripActivities(db(), dayId);
}

export async function addTripActivity(input: CreateTripActivityInput) {
  try {
    return createTripActivity(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add trip activity: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function editTripActivity(id: string, updates: { name?: string; description?: string | null; type?: string; trailId?: string | null; sortOrder?: number }) {
  try {
    return updateTripActivity(db(), id, updates);
  } catch (e) {
    throw new Error(`Failed to update trip activity: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removeTripActivity(id: string) {
  try {
    return deleteTripActivity(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete trip activity: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function reorderTripActivities(dayId: string, orderedIds: string[]) {
  try {
    reorderActivities(db(), dayId, orderedIds);
    return { ok: true };
  } catch (e) {
    throw new Error(`Failed to reorder activities: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Discover ──────────────────────────────────────────────────────────

export async function fetchDatabaseEntries(options?: { trailType?: string; difficulty?: string; region?: string; limit?: number; offset?: number }) {
  return getDatabaseEntries(db(), options);
}

export async function searchTrailDatabase(query: string) {
  return searchDatabaseTrails(db(), query);
}

export async function saveDiscoveredTrail(entry: Parameters<typeof saveDatabaseTrailToMyTrails>[1]) {
  try {
    return saveDatabaseTrailToMyTrails(db(), entry, crypto.randomUUID());
  } catch (e) {
    throw new Error(`Failed to save trail: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Reviews ───────────────────────────────────────────────────────────

export async function fetchReviewsByTrail(trailId: string) {
  return getReviewsByTrail(db(), trailId);
}

export async function addReview(input: CreateReviewInput) {
  try {
    return createReview(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add review: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function editReview(id: string, updates: { rating?: number; title?: string | null; body?: string | null; conditions?: string | null; visitedAt?: string | null }) {
  try {
    return updateReview(db(), id, updates);
  } catch (e) {
    throw new Error(`Failed to update review: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removeReview(id: string) {
  try {
    return deleteReview(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete review: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchAverageRating(trailId: string) {
  return getAverageRating(db(), trailId);
}

export async function fetchReviewCount(trailId: string) {
  return getReviewCount(db(), trailId);
}

export async function fetchRecentConditions(trailId: string) {
  return getRecentConditions(db(), trailId);
}

export async function fetchRatingDistribution(trailId: string) {
  return getRatingDistribution(db(), trailId);
}

// ── Segments ──────────────────────────────────────────────────────────

export async function fetchSegmentsByTrail(trailId: string) {
  return getSegmentsByTrail(db(), trailId);
}

export async function fetchEffortsBySegment(segmentId: string) {
  return getEffortsBySegment(db(), segmentId);
}

export async function fetchPersonalBest(segmentId: string) {
  return getPersonalBest(db(), segmentId);
}

// ── Offline Maps ──────────────────────────────────────────────────────

export async function fetchOfflineRegions() {
  return getOfflineRegions(db());
}

export async function fetchOfflineCatalog() {
  return REGION_CATALOG;
}

export async function addOfflineRegion(input: CreateOfflineRegionInput) {
  try {
    return createOfflineRegion(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add offline region: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removeOfflineRegion(id: string) {
  try {
    return deleteOfflineRegion(db(), id);
  } catch (e) {
    throw new Error(`Failed to remove offline region: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Alerts ────────────────────────────────────────────────────────────

export async function fetchAlertSettings() {
  return getAlertSettings(db());
}

export async function editAlertSettings(updates: UpdateAlertSettingsInput) {
  try {
    return updateAlertSettings(db(), updates);
  } catch (e) {
    throw new Error(`Failed to update alert settings: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchDeviationEvents(limit?: number) {
  return getDeviationEvents(db(), limit);
}

// ── Planned Routes ────────────────────────────────────────────────────

export async function fetchPlannedRoutes() {
  return getPlannedRoutes(db());
}

export async function fetchPlannedRoute(id: string) {
  return getPlannedRoute(db(), id);
}

export async function addPlannedRoute(input: CreatePlannedRouteInput) {
  try {
    return createPlannedRoute(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to create planned route: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removePlannedRoute(id: string) {
  try {
    return deletePlannedRoute(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete planned route: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchRouteWaypoints(routeId: string) {
  return getRouteWaypoints(db(), routeId);
}

export async function addRouteWaypoint(input: CreateRouteWaypointInput) {
  try {
    return createRouteWaypoint(db(), crypto.randomUUID(), input);
  } catch (e) {
    throw new Error(`Failed to add route waypoint: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function removeRouteWaypoint(id: string) {
  try {
    return deleteRouteWaypoint(db(), id);
  } catch (e) {
    throw new Error(`Failed to delete route waypoint: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── Module Settings ───────────────────────────────────────────────────

export async function fetchTrailSetting(key: string) {
  return getSetting(db(), key);
}

export async function saveTrailSetting(key: string, value: string) {
  try {
    setSetting(db(), key, value);
    return { ok: true };
  } catch (e) {
    throw new Error(`Failed to save setting: ${e instanceof Error ? e.message : String(e)}`);
  }
}
