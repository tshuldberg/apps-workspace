'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // Listings (V1)
  createListing, getListings, toggleListingSaved, updateListingStatus,
  deleteListing, getHomeMarketMetrics, createTour, getToursByListing, deleteTour,
  // Properties
  createProperty, getProperty, getProperties, updateProperty, deleteProperty,
  // Schedules
  createSchedule, getSchedulesForProperty, getAllActiveSchedules,
  updateSchedule, deactivateSchedule,
  // Costs
  createCostEntry, getCostEntriesForProperty, updateCostEntry, deleteCostEntry,
  // Contractors
  createContractor, getContractorsForProperty, getAllContractors,
  updateContractor, toggleFavorite, deleteContractor,
  // Services
  createService, getServicesForContractor, deleteService,
  // Insurance
  createPolicy, getPoliciesForProperty, updatePolicy, deletePolicy,
  // Documents
  createDocument, getDocumentsForProperty, updateDocument, deleteDocument,
  // Rooms
  createRoom, getRoomsForProperty, updateRoom, deleteRoom,
  // Inventory
  createInventoryItem, getItemsForRoom, getItemsForProperty,
  updateInventoryItem, deleteInventoryItem,
  // Appliances
  createAppliance, getAppliancesForProperty, updateAppliance, deleteAppliance,
  // Projects
  createProject, getProjectsForProperty, getActiveProjects,
  updateProject, deleteProject,
  // Phases
  createPhase, getPhasesForProject, updatePhase, deletePhase,
  // Photos
  createProjectPhoto, getPhotosForProject, deleteProjectPhoto,
  // Settings
  getSetting, setSetting,
} from '@mylife/homes';
import type {
  HomeListing, HomeListingStatus, HomeMarketMetrics, HomeTour,
  PropertyType, OwnershipType, TaskType, Season, CostCategory,
  DocCategory, FileType, Specialty, PolicyType,
  RoomType, ItemCategory, Condition,
  ApplianceCategory, ApplianceCondition,
  ProjectStatus, ProjectPriority, ProjectCategory, PhaseStatus, PhotoType,
} from '@mylife/homes';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('homes');
  return adapter;
}

// ── Listings (V1) ──

export async function fetchHomesOverview(): Promise<HomeMarketMetrics> {
  return getHomeMarketMetrics(db());
}

export async function fetchHomeListings(input?: {
  search?: string; savedOnly?: boolean; status?: HomeListingStatus;
}): Promise<HomeListing[]> {
  return getListings(db(), input);
}

export async function fetchListingTours(listingId: string): Promise<HomeTour[]> {
  return getToursByListing(db(), listingId);
}

export async function doCreateHomeListing(id: string, input: {
  address: string; city: string; state: string; priceCents: number;
  bedrooms: number; bathrooms: number; sqft: number;
  status?: HomeListingStatus; isSaved?: boolean; notes?: string;
}): Promise<void> {
  createListing(db(), id, input);
}

export async function doToggleHomeListingSaved(id: string): Promise<void> {
  toggleListingSaved(db(), id);
}

export async function doUpdateHomeListingStatus(id: string, status: HomeListingStatus): Promise<void> {
  updateListingStatus(db(), id, status);
}

export async function doDeleteHomeListing(id: string): Promise<void> {
  deleteListing(db(), id);
}

export async function doCreateHomeTour(id: string, input: {
  listingId: string; tourAt: string; agentName?: string; notes?: string;
}): Promise<void> {
  createTour(db(), id, input);
}

export async function doDeleteHomeTour(id: string): Promise<void> {
  deleteTour(db(), id);
}

// ── Properties ──

export async function fetchProperties() {
  return getProperties(db());
}

export async function fetchProperty(id: string) {
  return getProperty(db(), id);
}

export async function doCreateProperty(id: string, input: {
  name: string; address?: string; city?: string; state?: string;
  yearBuilt?: number; sqft?: number;
  propertyType?: PropertyType; ownershipType?: OwnershipType; notes?: string;
}) {
  return createProperty(db(), id, input);
}

export async function doUpdateProperty(id: string, input: Partial<{
  name: string; address: string | null; city: string | null; state: string | null;
  yearBuilt: number | null; sqft: number | null;
  propertyType: PropertyType; ownershipType: OwnershipType; notes: string | null;
}>) {
  updateProperty(db(), id, input);
}

export async function doDeleteProperty(id: string) {
  deleteProperty(db(), id);
}

// ── Maintenance Schedules ──

export async function fetchAllActiveSchedules() {
  return getAllActiveSchedules(db());
}

export async function fetchSchedulesForProperty(propertyId: string) {
  return getSchedulesForProperty(db(), propertyId);
}

export async function doCreateSchedule(id: string, input: {
  propertyId: string; taskType: TaskType; taskTypeCustom?: string;
  intervalMonths: number; seasonPreference?: Season | null;
  lastCompletedDate?: string; nextDueDate?: string; notes?: string;
}) {
  return createSchedule(db(), id, input);
}

export async function doUpdateSchedule(id: string, input: Partial<{
  taskType: TaskType; taskTypeCustom: string | null; intervalMonths: number;
  seasonPreference: Season | null; lastCompletedDate: string | null;
  nextDueDate: string | null; snoozeDays: number; snoozeCount: number; notes: string | null;
}>) {
  updateSchedule(db(), id, input);
}

export async function doDeactivateSchedule(id: string) {
  deactivateSchedule(db(), id);
}

// ── Cost Entries ──

export async function fetchCostEntriesForProperty(propertyId: string) {
  return getCostEntriesForProperty(db(), propertyId);
}

export async function doCreateCostEntry(id: string, input: {
  propertyId: string; scheduleId?: string; category: CostCategory;
  description: string; amountCents: number; vendor?: string; costDate: string;
}) {
  return createCostEntry(db(), id, input);
}

export async function doUpdateCostEntry(id: string, input: Partial<{
  category: CostCategory; description: string; amountCents: number;
  vendor: string | null; costDate: string; scheduleId: string | null;
}>) {
  updateCostEntry(db(), id, input);
}

export async function doDeleteCostEntry(id: string) {
  deleteCostEntry(db(), id);
}

// ── Contractors ──

export async function fetchAllContractors() {
  return getAllContractors(db());
}

export async function fetchContractorsForProperty(propertyId: string) {
  return getContractorsForProperty(db(), propertyId);
}

export async function doCreateContractor(id: string, input: {
  propertyId?: string; name: string; company?: string; specialty: Specialty;
  phone?: string; email?: string; website?: string; address?: string;
  rating?: number; notes?: string;
}) {
  return createContractor(db(), id, input);
}

export async function doUpdateContractor(id: string, input: Partial<{
  name: string; company: string | null; specialty: Specialty;
  phone: string | null; email: string | null; website: string | null;
  address: string | null; rating: number | null; notes: string | null;
}>) {
  updateContractor(db(), id, input);
}

export async function doToggleFavorite(id: string) {
  toggleFavorite(db(), id);
}

export async function doDeleteContractor(id: string) {
  deleteContractor(db(), id);
}

// ── Contractor Services ──

export async function fetchServicesForContractor(contractorId: string) {
  return getServicesForContractor(db(), contractorId);
}

export async function doCreateService(id: string, input: {
  contractorId: string; scheduleId?: string; description: string;
  serviceDate: string; costCents?: number; rating?: number; notes?: string;
}) {
  return createService(db(), id, input);
}

export async function doDeleteService(id: string) {
  deleteService(db(), id);
}

// ── Insurance Policies ──

export async function fetchPoliciesForProperty(propertyId: string) {
  return getPoliciesForProperty(db(), propertyId);
}

export async function doCreatePolicy(id: string, input: {
  propertyId: string; provider: string; policyNumber: string;
  policyType: PolicyType; coverageAmountCents: number; deductibleCents: number;
  annualPremiumCents: number; startDate: string; endDate: string;
  autoRenew?: boolean; agentName?: string; agentPhone?: string;
  agentEmail?: string; notes?: string;
}) {
  return createPolicy(db(), id, input);
}

export async function doUpdatePolicy(id: string, input: Partial<{
  provider: string; policyNumber: string; policyType: PolicyType;
  coverageAmountCents: number; deductibleCents: number; annualPremiumCents: number;
  startDate: string; endDate: string; autoRenew: boolean;
  agentName: string | null; agentPhone: string | null; agentEmail: string | null;
  notes: string | null;
}>) {
  updatePolicy(db(), id, input);
}

export async function doDeletePolicy(id: string) {
  deletePolicy(db(), id);
}

// ── Documents ──

export async function fetchDocumentsForProperty(propertyId: string) {
  return getDocumentsForProperty(db(), propertyId);
}

export async function doCreateDocument(id: string, input: {
  propertyId: string; title: string; category: DocCategory;
  fileUri: string; fileType: FileType; fileSizeBytes: number;
  expiryDate?: string; notes?: string; tags?: string;
}) {
  return createDocument(db(), id, input);
}

export async function doUpdateDocument(id: string, input: Partial<{
  title: string; category: DocCategory; expiryDate: string | null;
  notes: string | null; tags: string | null;
}>) {
  updateDocument(db(), id, input);
}

export async function doDeleteDocument(id: string) {
  deleteDocument(db(), id);
}

// ── Rooms & Inventory ──

export async function fetchRoomsForProperty(propertyId: string) {
  return getRoomsForProperty(db(), propertyId);
}

export async function doCreateRoom(id: string, input: {
  propertyId: string; name: string; roomType?: RoomType; sortOrder?: number;
}) {
  return createRoom(db(), id, input);
}

export async function doUpdateRoom(id: string, input: Partial<{
  name: string; roomType: RoomType; sortOrder: number;
}>) {
  updateRoom(db(), id, input);
}

export async function doDeleteRoom(id: string) {
  deleteRoom(db(), id);
}

export async function fetchItemsForRoom(roomId: string) {
  return getItemsForRoom(db(), roomId);
}

export async function fetchItemsForProperty(propertyId: string) {
  return getItemsForProperty(db(), propertyId);
}

export async function doCreateInventoryItem(id: string, input: {
  roomId: string; propertyId: string; name: string; category?: ItemCategory;
  brand?: string; model?: string; serialNumber?: string;
  purchaseDate?: string; purchasePriceCents?: number; estimatedValueCents?: number;
  condition?: Condition; warrantyExpiry?: string; notes?: string;
}) {
  return createInventoryItem(db(), id, input);
}

export async function doUpdateInventoryItem(id: string, input: Partial<{
  name: string; category: ItemCategory; brand: string | null; model: string | null;
  serialNumber: string | null; purchaseDate: string | null;
  purchasePriceCents: number | null; estimatedValueCents: number | null;
  condition: Condition; warrantyExpiry: string | null; notes: string | null;
}>) {
  updateInventoryItem(db(), id, input);
}

export async function doDeleteInventoryItem(id: string) {
  deleteInventoryItem(db(), id);
}

// ── Appliances ──

export async function fetchAppliancesForProperty(propertyId: string) {
  return getAppliancesForProperty(db(), propertyId);
}

export async function doCreateAppliance(id: string, input: {
  propertyId: string; name: string; brand?: string; modelNumber?: string;
  serialNumber?: string; purchaseDate?: string; purchasePriceCents?: number;
  warrantyExpiry?: string; category?: ApplianceCategory;
  condition?: ApplianceCondition; notes?: string;
}) {
  return createAppliance(db(), id, input);
}

export async function doUpdateAppliance(id: string, input: Partial<{
  name: string; brand: string | null; modelNumber: string | null;
  serialNumber: string | null; purchaseDate: string | null;
  purchasePriceCents: number | null; warrantyExpiry: string | null;
  category: ApplianceCategory; condition: ApplianceCondition; notes: string | null;
}>) {
  updateAppliance(db(), id, input);
}

export async function doDeleteAppliance(id: string) {
  deleteAppliance(db(), id);
}

// ── Projects ──

export async function fetchActiveProjects() {
  return getActiveProjects(db());
}

export async function fetchProjectsForProperty(propertyId: string) {
  return getProjectsForProperty(db(), propertyId);
}

export async function doCreateProject(id: string, input: {
  propertyId: string; name: string; description?: string;
  status?: ProjectStatus; budgetCents?: number;
  startDate?: string; targetEndDate?: string;
  priority?: ProjectPriority; category?: ProjectCategory; notes?: string;
}) {
  return createProject(db(), id, input);
}

export async function doUpdateProject(id: string, input: Partial<{
  name: string; description: string | null; status: ProjectStatus;
  budgetCents: number; actualCostCents: number;
  startDate: string | null; targetEndDate: string | null; actualEndDate: string | null;
  priority: ProjectPriority; category: ProjectCategory; notes: string | null;
}>) {
  updateProject(db(), id, input);
}

export async function doDeleteProject(id: string) {
  deleteProject(db(), id);
}

// ── Project Phases ──

export async function fetchPhasesForProject(projectId: string) {
  return getPhasesForProject(db(), projectId);
}

export async function doCreatePhase(id: string, input: {
  projectId: string; name: string; description?: string;
  sortOrder?: number; status?: PhaseStatus;
  startDate?: string; endDate?: string;
  budgetCents?: number; contractorId?: string; notes?: string;
}) {
  return createPhase(db(), id, input);
}

export async function doUpdatePhase(id: string, input: Partial<{
  name: string; description: string | null; sortOrder: number;
  status: PhaseStatus; startDate: string | null; endDate: string | null;
  budgetCents: number | null; contractorId: string | null; notes: string | null;
}>) {
  updatePhase(db(), id, input);
}

export async function doDeletePhase(id: string) {
  deletePhase(db(), id);
}

// ── Project Photos ──

export async function fetchPhotosForProject(projectId: string) {
  return getPhotosForProject(db(), projectId);
}

export async function doCreateProjectPhoto(id: string, input: {
  projectId: string; phaseId?: string; photoUri: string;
  caption?: string; photoType?: PhotoType; sortOrder?: number;
}) {
  return createProjectPhoto(db(), id, input);
}

export async function doDeleteProjectPhoto(id: string) {
  deleteProjectPhoto(db(), id);
}

// ── Settings ──

export async function fetchSetting(key: string) {
  return getSetting(db(), key);
}

export async function doSetSetting(key: string, value: string) {
  setSetting(db(), key, value);
}
