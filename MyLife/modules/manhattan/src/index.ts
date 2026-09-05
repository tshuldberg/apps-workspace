// @mylife/manhattan -- NYC events, calendar, and discovery module

export { MANHATTAN_MODULE } from './definition';

export {
  EventInputSchema,
  FacetAxis,
  PinInputSchema,
  PlanInputSchema,
  PlanMemberInputSchema,
  FacetInputSchema,
  SourceInputSchema,
} from './types';
export type {
  EventInput,
  EventRow,
  PinInput,
  PinRow,
  PlanInput,
  PlanRow,
  PlanMemberInput,
  PlanMemberRow,
  FacetInput,
  FacetRow,
  SourceInput,
  SourceRow,
} from './types';

export {
  createEvent,
  getEvents,
  getEventById,
  setEventSaved,
  softDeleteEvent,
  upsertExternalEvent,
} from './db/crud/events';

export {
  createPin,
  getPins,
  getPinById,
  setPinShareable,
  updatePin,
  softDeletePin,
} from './db/crud/pins';

export {
  createPlan,
  getPlans,
  getPlanById,
  getPlansOnDay,
  updatePlan,
  softDeletePlan,
  updatePlanCalendarEventId,
  getPlanByCalendarEventId,
} from './db/crud/plans';

export {
  addPlanMember,
  getPlanMembers,
  removePlanMember,
} from './db/crud/plan-members';

export {
  addFacet,
  getFacets,
  getEventIdsByFacet,
  removeFacet,
  removeFacetsForEvent,
} from './db/crud/facets';

export {
  upsertSource,
  ensureSource,
  getSources,
  isSourceEnabled,
  setSourceEnabled,
  setSourceLastSynced,
} from './db/crud/sources';

export {
  replaceSourceCache,
  getSourceCacheRows,
  clearSourceCache,
} from './db/crud/source-cache';
export type { SourceCacheRow, ReplaceSourceCacheOptions } from './db/crud/source-cache';

export {
  getSetting,
  setSetting,
} from './db/crud/settings';
export {
  DEFAULT_PURGE_AFTER_DAYS,
  purgeSoftDeleted,
} from './db/crud/maintenance';
export type { PurgeResult } from './db/crud/maintenance';

// Source adapter layer + engines (Phase 2)
export { buildSourceRegistry } from './sources/registry';
export { nycOpenDataAdapter, mapNycRow } from './sources/nyc-open-data';
export { seatGeekAdapter, mapSeatGeekEvent, getSeatGeekClientId } from './sources/seatgeek';
export { icsImportAdapter, icsToNormalized } from './sources/ics-import';
export { gapAdapters } from './sources/gaps';
export { SourceGapError } from './sources/types';
export type {
  EventSourceAdapter,
  NormalizedEvent,
  SourceQuery,
  SourceCoverage,
  SourceTier,
  GapReason,
  IngestKind,
  FetchImpl,
  FetchResponse,
} from './sources/types';

export { dedupe, dedupKey } from './engines/dedup';
export { classify, priceBucket, timeBucket } from './engines/taxonomy';
export type { Facet } from './engines/taxonomy';
export { ingestFromSources } from './engines/ingest';
export type { IngestResult } from './engines/ingest';
export { refreshDiscoveryCache, getCachedDiscoveryEvents } from './engines/discovery-cache';
export type { DiscoveryCacheResult, CachedDiscoveryEvent } from './engines/discovery-cache';

// Share + parsing layer (Phase 3)
export { parseEventFromShared } from './parser/url-parser';
export type { ShareEventCandidate } from './parser/url-parser';
export { parseShareIntent, shareIntentAdapter } from './sources/share-intent';
export { tiktokOembedAdapter, mapTikTokOembed, fetchTikTokEvent } from './sources/tiktok-oembed';

// Calendar payload layer (Phase 3)
export {
  MANHATTAN_TIMEZONE,
  planToCalendarPayload,
  eventToCalendarPayload,
  generateManhattanICS,
  buildManhattanEventNotes,
  extractManhattanId,
  reconcileInboundDeviceEvents,
} from './engines/calendar-payload';
export type {
  ManhattanCalendarPayload,
  DeviceCalendarEvent,
} from './engines/calendar-payload';

// Opt-in AI event extraction (Phase 3)
export { extractEventFromShare, buildEventExtractionPrompt } from './ai/event-extraction';

// Hub composition layer (Phase 4)
export {
  manhattanCrossModule,
  getTodayCards,
  getSearchableContent,
  getDataSummary,
} from './cross-module';

export {
  buildPinNoteContext,
  buildPlanNoteContext,
  entityTagLabel,
  setEntityTags,
  getEntityTags,
  removeEntityTag,
} from './integrations/notes-bridge';
export type { ManhattanEntityNoteContext } from './integrations/notes-bridge';

export {
  mapEventToHangoutInput,
  eventTypeToActivityTag,
} from './integrations/friends-bridge';

export { mapClassToManhattanEvents } from './integrations/classes-bridge';

export { planReminderTrigger, reminderId } from './engines/reminders';
export type { PlanReminder } from './engines/reminders';

// Cloud client (Phase 5)
export {
  initManhattanClient,
  getManhattanClient,
  resetManhattanClient,
  hasManhattanClient,
} from './cloud/client';

// Social bridge (Phase 5)
export { buildPlanShareInput } from './integrations/social-bridge';
export type { ManhattanPlanShareInput } from './integrations/social-bridge';
