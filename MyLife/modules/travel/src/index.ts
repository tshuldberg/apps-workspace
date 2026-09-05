export { TRAVEL_MODULE } from './definition';

export {
  ALL_TABLES,
  CREATE_ACTIVITIES,
  CREATE_BOOKINGS,
  CREATE_CHECKLIST_ITEMS,
  CREATE_CURRENCIES,
  CREATE_DESTINATIONS,
  CREATE_DOCUMENTS,
  CREATE_EMERGENCY_CONTACTS,
  CREATE_INDEXES,
  CREATE_ITINERARY_DAYS,
  CREATE_JOURNAL_ENTRIES,
  CREATE_JOURNAL_MEMORIES,
  CREATE_LOYALTY_PROGRAMS,
  CREATE_PACKING_ITEMS,
  CREATE_PACKING_LISTS,
  CREATE_SETTINGS,
  CREATE_TRIPS,
  TRAVEL_MIGRATION_V1,
  TRAVEL_MIGRATION_V2,
  TRAVEL_MIGRATION_V3,
  TRAVEL_MIGRATION_V4,
  TRAVEL_MIGRATION_V5,
  TRAVEL_MIGRATION_V6,
  TRAVEL_MIGRATION_V7,
  TRAVEL_MIGRATIONS,
  V2_INDEXES,
  V2_TABLES,
  V3_INDEXES,
  V3_TABLES,
  V4_INDEXES,
  V4_TABLES,
  V5_INDEXES,
  V5_TABLES,
  V6_INDEXES,
  V6_TABLES,
  V7_INDEXES,
  V7_TABLES,
  getTravelMigrations,
} from './db';

export {
  DestinationSchema,
  TravelSettingSchema,
  TripSchema,
  TripStatusSchema,
  TripTypeSchema,
} from './types';

export type {
  Destination,
  TravelSetting,
  Trip,
  TripStatus,
  TripType,
} from './types';

// V2 itinerary exports (from models/schemas.ts)
export {
  ActivityInsertSchema,
  ActivityRowSchema,
  ActivityTypeSchema,
  ActivityUpdateSchema,
  ItineraryDayInsertSchema,
  ItineraryDayRowSchema,
  ItineraryDayUpdateSchema,
  TripInsertSchema,
  TripListFilterSchema,
  TripRowSchema,
  TripUpdateSchema,
} from './models/schemas';

export type {
  ActivityInsert,
  ActivityRow,
  ActivityType,
  ActivityUpdate,
  ItineraryDayInsert,
  ItineraryDayRow,
  ItineraryDayUpdate,
  TripInsert,
  TripListFilter,
  TripRow,
  TripUpdate,
} from './models/schemas';

// V3 logistics schema exports
export {
  DocumentInputSchema,
  DocumentTypeSchema,
  DocumentUpdateSchema,
  LoyaltyProgramInputSchema,
  LoyaltyProgramUpdateSchema,
  LoyaltyTypeSchema,
} from './models/schemas';

export type {
  DocumentInput,
  DocumentRow,
  DocumentType,
  DocumentUpdate,
  LoyaltyProgramInput,
  LoyaltyProgramRow,
  LoyaltyProgramUpdate,
  LoyaltyType,
} from './models/schemas';

// CRUD operations
export {
  countTrips,
  createTrip,
  deleteTrip,
  duplicateTrip,
  getTripById,
  listTrips,
  updateTrip,
  updateTripStatus,
} from './db/crud/trips';

export type { DuplicateTripOptions } from './db/crud/trips';

export {
  countActivitiesByTrip,
  countDaysByTrip,
  createActivity,
  createDay,
  deleteActivity,
  deleteDay,
  getActivityById,
  getDayById,
  listActivitiesByDay,
  listActivitiesByTrip,
  listDaysByTrip,
  reorderActivities,
  reorderDays,
  updateActivity,
  updateDay,
} from './db/crud/itinerary';

// Destination CRUD (P2-A) + exported for P2-B UI.
export {
  createDestination,
  deleteDestination,
  getBucketList,
  getCountryStats,
  getDecadeView,
  getDestination,
  getRegionProgress,
  listDestinations,
  markVisited,
  searchDestinations,
  updateDestination,
} from './db/crud/destinations';

export type {
  CountryStats,
  DecadeBucket,
  RegionProgress,
} from './db/crud/destinations';

export {
  DestinationFilterSchema,
  DestinationInputSchema,
  DestinationUpdateSchema,
} from './models/schemas';

export type {
  DestinationFilter,
  DestinationInput,
  DestinationRecord,
  DestinationRow,
  DestinationUpdate,
} from './models/schemas';

// Static geo reference data (countries, US states, region groups).
export {
  COUNTRIES,
  REGION_DEFINITIONS,
  US_STATES,
} from './engine/geo-data';

export type {
  ContinentCode,
  Country,
  UsState,
} from './engine/geo-data';

// V3 logistics CRUD
export {
  createDocument,
  deleteDocument,
  getDocument,
  getExpiring,
  getPassports,
  getVisas,
  listDocuments,
  listDocumentsByType,
  updateDocument,
} from './db/crud/documents';

export type { ListDocumentsOptions } from './db/crud/documents';

export {
  createLoyaltyProgram,
  deleteLoyaltyProgram,
  getLoyaltyProgram,
  getTotalMiles,
  getTotalPoints,
  listLoyaltyByType,
  listLoyaltyPrograms,
  updateBalance,
  updateLoyaltyProgram,
} from './db/crud/loyalty';

export type { BalanceUpdate, ListLoyaltyOptions } from './db/crud/loyalty';

// V3 logistics engine
export { checkExpiry, getUrgencyLevel } from './engine/expiry-checker';

export type {
  CheckExpiryOptions,
  ExpiryItem,
  ExpiryReport,
  ExpiryUrgency,
} from './engine/expiry-checker';

// V4 bookings schema + CRUD
export {
  BookingInputSchema,
  BookingTypeSchema,
  BookingUpdateSchema,
} from './models/schemas';

export type {
  BookingInput,
  BookingRow,
  BookingType,
  BookingUpdate,
} from './models/schemas';

export {
  createBooking,
  deleteBooking,
  getBooking,
  listBookings,
  listUpcomingBookings,
  updateBooking,
} from './db/crud/bookings';

export type {
  ListBookingsOptions,
  ListUpcomingBookingsOptions,
} from './db/crud/bookings';

// V5 extended logistics schemas
export {
  ChecklistItemInputSchema,
  ChecklistItemUpdateSchema,
  CurrencyRateInputSchema,
  EmergencyContactInputSchema,
  EmergencyContactUpdateSchema,
} from './models/schemas';

export type {
  ChecklistItemInput,
  ChecklistItemRow,
  ChecklistItemUpdate,
  CurrencyRateInput,
  CurrencyRateRow,
  EmergencyContactInput,
  EmergencyContactRow,
  EmergencyContactUpdate,
} from './models/schemas';

// V5 emergency contacts CRUD
export {
  createEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContact,
  listEmergencyContacts,
  updateEmergencyContact,
} from './db/crud/emergency-contacts';

export type { ListEmergencyContactsOptions } from './db/crud/emergency-contacts';

// V5 currencies CRUD
export {
  deleteRate,
  getRate,
  listRates,
  upsertRate,
} from './db/crud/currencies';

// V5 checklist CRUD
export {
  createChecklistItem,
  deleteChecklistItem,
  getChecklistItem,
  listChecklistItems,
  reorderChecklistItems,
  toggleDone,
  updateChecklistItem,
} from './db/crud/checklists';

export type { ListChecklistItemsOptions } from './db/crud/checklists';

// P6-A stats engine
export * from './engine/stats';

// V6 packing schemas
export {
  PackingItemInputSchema,
  PackingItemUpdateSchema,
  PackingListInputSchema,
  PackingListUpdateSchema,
  PackingTemplateKeySchema,
} from './models/schemas';

export type {
  PackingItemInput,
  PackingItemRow,
  PackingItemUpdate,
  PackingListInput,
  PackingListRow,
  PackingListUpdate,
  PackingTemplateKey,
} from './models/schemas';

// V6 packing CRUD
export {
  bulkAddPackingItems,
  createListFromTemplate,
  createPackingItem,
  createPackingList,
  deletePackingItem,
  deletePackingList,
  duplicatePackingList,
  getPackingItem,
  getPackingList,
  listPackingItems,
  listPackingListsByTrip,
  listPackingTemplates,
  reorderPackingItems,
  togglePackingItem,
  updatePackingItem,
  updatePackingList,
} from './db/crud/packing';

export type {
  DuplicatePackingListOptions,
  ListPackingItemsOptions,
} from './db/crud/packing';

// V6 packing templates engine
export * from './engine/packing-templates';

// P7-A planning + recommendations engine
export * from './engine/planning';

// P8-C export engine (JSON + CSV + iCal)
export * from './engine/export';

// V7 journal schemas
export {
  JournalEntryInputSchema,
  JournalEntryUpdateSchema,
  JournalMemoryInputSchema,
  JournalMemoryKindSchema,
  JournalMemoryUpdateSchema,
  JournalMoodSchema,
} from './models/schemas';

export type {
  JournalEntryInput,
  JournalEntryRow,
  JournalEntryUpdate,
  JournalMemoryInput,
  JournalMemoryKind,
  JournalMemoryRow,
  JournalMemoryUpdate,
  JournalMood,
} from './models/schemas';

// V7 journal CRUD
export {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  getJournalStreak,
  listJournalEntries,
  listJournalEntriesByMonth,
  updateJournalEntry,
} from './db/crud/journal-entries';

export type { ListJournalEntriesOptions } from './db/crud/journal-entries';

export {
  createJournalMemory,
  deleteJournalMemory,
  listJournalMemories,
  reorderJournalMemories,
  updateJournalMemory,
} from './db/crud/journal-memories';

// P8-A email / booking confirmation parser
export * from './engine/email-parser';

// P8-B calendar (iCal) import engine
export {
  importIcs,
  eventsToActivitySuggestions,
} from './engine/calendar-import';

export type {
  ImportedEvent,
  ActivitySuggestion,
} from './engine/calendar-import';

// P8-B photo EXIF import engine
export {
  parsePhotoExifJson,
  clusterPhotosByDay,
  suggestDestinationsFromPhotos,
} from './engine/photo-import';

export type {
  PhotoLocation,
  PhotoDayCluster,
} from './engine/photo-import';

// P9-A cross-module integrations (read-only)
export * from './integrations/dining-link';
export * from './integrations/budget-link';

// P9-B cross-module integrations (read-only)
export * from './integrations/friends-link';
export * from './integrations/closet-link';
export * from './integrations/voice-link';

// P9-C cross-module integrations (read-only)
export * from './integrations/health-link';
export * from './integrations/meds-link';
export * from './integrations/trails-link';
export * from './integrations/books-link';
