// Schema SQL
export {
  CREATE_LISTINGS, CREATE_TOURS, CREATE_INDEXES, ALL_TABLES,
  CREATE_PROPERTIES, CREATE_MAINTENANCE_SCHEDULES, CREATE_SETTINGS,
  CREATE_V2_INDEXES, SEED_SETTINGS, V2_TABLES,
  CREATE_COST_ENTRIES, CREATE_DOCUMENTS, CREATE_CONTRACTORS,
  CREATE_CONTRACTOR_SERVICES, CREATE_INSURANCE_POLICIES,
  CREATE_ROOMS, CREATE_INVENTORY_ITEMS, CREATE_APPLIANCES,
  CREATE_PROJECTS, CREATE_PROJECT_PHASES, CREATE_PROJECT_PHOTOS,
  CREATE_V3_INDEXES, V3_TABLES,
} from './schema';

// Listing CRUD
export {
  createListing, getListings, toggleListingSaved, updateListingStatus,
  deleteListing, countSavedListings, getHomeMarketMetrics,
  createTour, getToursByListing, deleteTour,
} from './crud';

// Property CRUD
export {
  createProperty, getProperty, getProperties, updateProperty,
  deleteProperty, promoteListingToProperty,
} from './properties';

// Schedule CRUD
export {
  createSchedule, getSchedule, getSchedulesForProperty,
  getAllActiveSchedules, updateSchedule, deactivateSchedule,
  deleteSchedulesByProperty,
} from './schedules';

// Settings CRUD
export { getSetting, setSetting } from './settings';

// Cost entry CRUD
export {
  createCostEntry, getCostEntry, getCostEntriesForProperty,
  getCostEntriesForSchedule, updateCostEntry, deleteCostEntry,
} from './cost-entries';

// Document CRUD
export {
  createDocument, getDocument, getDocumentsForProperty,
  updateDocument, deleteDocument,
} from './documents';

// Contractor CRUD
export {
  createContractor, getContractor, getContractorsForProperty,
  getAllContractors, updateContractor, toggleFavorite, deleteContractor,
} from './contractors';

// Contractor service CRUD
export {
  createService, getServicesForContractor, getServicesForSchedule,
  deleteService,
} from './contractor-services';

// Insurance CRUD
export {
  createPolicy, getPolicy, getPoliciesForProperty,
  updatePolicy, deletePolicy,
} from './insurance';

// Room CRUD
export {
  createRoom, getRoom, getRoomsForProperty, updateRoom, deleteRoom,
} from './rooms';

// Inventory CRUD
export {
  createInventoryItem, getInventoryItem, getItemsForRoom,
  getItemsForProperty, updateInventoryItem, deleteInventoryItem,
} from './inventory';

// Appliance CRUD
export {
  createAppliance, getAppliance, getAppliancesForProperty,
  updateAppliance, deleteAppliance,
} from './appliances';

// Project CRUD
export {
  createProject, getProject, getProjectsForProperty,
  getActiveProjects, updateProject, deleteProject,
} from './projects';

// Phase CRUD
export {
  createPhase, getPhase, getPhasesForProject,
  updatePhase, deletePhase,
} from './project-phases';

// Photo CRUD
export {
  createProjectPhoto, getPhotosForProject, getPhotosForPhase,
  deleteProjectPhoto,
} from './project-photos';
