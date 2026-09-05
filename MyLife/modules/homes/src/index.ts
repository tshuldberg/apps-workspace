export { HOMES_MODULE } from './definition';

// Models and Zod schemas
export type {
  HomeListing, HomeTour, HomeListingStatus, HomeMarketMetrics,
  Property, PropertyType, OwnershipType,
  MaintenanceSchedule, TaskType, Season, ScheduleStatus,
  CostEntry, CostCategory,
  HomeDocument, DocCategory, FileType,
  Contractor, Specialty, ContractorService,
  InsurancePolicy, PolicyType,
  Room, RoomType, InventoryItem, ItemCategory, Condition,
  Appliance, ApplianceCategory, ApplianceCondition,
  Project, ProjectStatus, ProjectPhase, PhaseStatus,
  ProjectPriority, ProjectCategory, ProjectPhoto, PhotoType,
} from './types';
export {
  HomeListingSchema, HomeTourSchema, HomeListingStatusSchema,
  PropertySchema, PropertyTypeSchema, OwnershipTypeSchema,
  MaintenanceScheduleSchema, TaskTypeSchema, SeasonSchema, ScheduleStatusSchema,
  CostEntrySchema, CostCategorySchema,
  HomeDocumentSchema, DocCategorySchema, FileTypeSchema,
  ContractorSchema, SpecialtySchema, ContractorServiceSchema,
  InsurancePolicySchema, PolicyTypeSchema,
  RoomSchema, RoomTypeSchema, InventoryItemSchema, ItemCategorySchema, ConditionSchema,
  ApplianceSchema, ApplianceCategorySchema, ApplianceConditionSchema,
  ProjectSchema, ProjectStatusSchema, ProjectPhaseSchema, PhaseStatusSchema,
  ProjectPrioritySchema, ProjectCategorySchema, ProjectPhotoSchema, PhotoTypeSchema,
} from './types';

// Database CRUD
export {
  createListing, getListings, toggleListingSaved, updateListingStatus,
  deleteListing, countSavedListings, getHomeMarketMetrics,
  createTour, getToursByListing, deleteTour,
  createProperty, getProperty, getProperties, updateProperty,
  deleteProperty, promoteListingToProperty,
  createSchedule, getSchedule, getSchedulesForProperty,
  getAllActiveSchedules, updateSchedule, deactivateSchedule,
  deleteSchedulesByProperty,
  getSetting, setSetting,
  createCostEntry, getCostEntry, getCostEntriesForProperty,
  getCostEntriesForSchedule, updateCostEntry, deleteCostEntry,
  createDocument, getDocument, getDocumentsForProperty,
  updateDocument, deleteDocument,
  createContractor, getContractor, getContractorsForProperty,
  getAllContractors, updateContractor, toggleFavorite, deleteContractor,
  createService, getServicesForContractor, getServicesForSchedule,
  deleteService,
  createPolicy, getPolicy, getPoliciesForProperty,
  updatePolicy, deletePolicy,
  createRoom, getRoom, getRoomsForProperty, updateRoom, deleteRoom,
  createInventoryItem, getInventoryItem, getItemsForRoom,
  getItemsForProperty, updateInventoryItem, deleteInventoryItem,
  createAppliance, getAppliance, getAppliancesForProperty,
  updateAppliance, deleteAppliance,
  createProject, getProject, getProjectsForProperty,
  getActiveProjects, updateProject, deleteProject,
  createPhase, getPhase, getPhasesForProject,
  updatePhase, deletePhase,
  createProjectPhoto, getPhotosForProject, getPhotosForPhase,
  deleteProjectPhoto,
} from './db';

// Engines
export {
  getDefaultSchedules, calculateNextDueDate, calculateScheduleStatus,
  sortByUrgency, markComplete, getTaskTypeLabel,
  getCostSummary, getMonthlyCostTrend, getLifetimeCosts, getCostsBySchedule,
  getExpiringDocuments, searchDocuments, getDocumentStats,
  getContractorsBySpecialty, getFavoriteContractors,
  getContractorForTaskType, getContractorStats,
  getActivePolicies, getExpiringPolicies,
  getPolicyCostSummary, checkCoverageGaps,
  getPropertyInventoryValue, getRoomSummary, getItemsByCategory,
  getHighValueItems, exportInventoryCSV,
  getWarrantyStatus, getAppliancesNeedingAttention,
  searchAppliances, getAppliancesByCategory,
  getProjectSummary, getBudgetVsActual, getPhaseProgress,
  getActiveProjectCount,
} from './engines';
export type { SchedulePreset, ScheduleWithStatus, MarkCompleteResult } from './engines';
