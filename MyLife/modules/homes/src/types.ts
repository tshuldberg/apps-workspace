import { z } from 'zod';

export const HomeListingStatusSchema = z.enum([
  'new',
  'touring',
  'offer',
  'under_contract',
  'closed',
]);
export type HomeListingStatus = z.infer<typeof HomeListingStatusSchema>;

export const HomeListingSchema = z.object({
  id: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  priceCents: z.number().int().nonnegative(),
  bedrooms: z.number().nonnegative(),
  bathrooms: z.number().nonnegative(),
  sqft: z.number().int().positive(),
  status: HomeListingStatusSchema,
  isSaved: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HomeListing = z.infer<typeof HomeListingSchema>;

export const HomeTourSchema = z.object({
  id: z.string().min(1),
  listingId: z.string().min(1),
  tourAt: z.string().datetime(),
  agentName: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type HomeTour = z.infer<typeof HomeTourSchema>;

export interface HomeMarketMetrics {
  listings: number;
  savedListings: number;
  averagePriceCents: number;
  averagePricePerSqft: number;
}

// ── Property & Maintenance Schemas ──

export const PropertyTypeSchema = z.enum([
  'house',
  'condo',
  'apartment',
  'townhouse',
  'other',
]);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const OwnershipTypeSchema = z.enum(['own', 'rent']);
export type OwnershipType = z.infer<typeof OwnershipTypeSchema>;

export const PropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  yearBuilt: z.number().int().nullable(),
  sqft: z.number().int().nullable(),
  propertyType: PropertyTypeSchema,
  ownershipType: OwnershipTypeSchema,
  listingId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Property = z.infer<typeof PropertySchema>;

export const TaskTypeSchema = z.enum([
  'hvac_filter',
  'hvac_service',
  'gutter_cleaning',
  'roof_inspection',
  'smoke_detector',
  'water_heater_flush',
  'dryer_vent',
  'pest_control',
  'exterior_paint',
  'lawn_mower_service',
  'window_cleaning',
  'plumbing_inspection',
  'appliance_service',
  'chimney_sweep',
  'custom',
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const SeasonSchema = z.enum(['spring', 'summer', 'fall', 'winter']);
export type Season = z.infer<typeof SeasonSchema>;

export const ScheduleStatusSchema = z.enum([
  'overdue',
  'due_soon',
  'ok',
  'unknown',
]);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const MaintenanceScheduleSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  taskType: TaskTypeSchema,
  taskTypeCustom: z.string().nullable(),
  intervalMonths: z.number().int().min(1).max(120),
  seasonPreference: SeasonSchema.nullable(),
  lastCompletedDate: z.string().nullable(),
  nextDueDate: z.string().nullable(),
  isActive: z.boolean(),
  snoozeDays: z.number().int().nonnegative(),
  snoozeCount: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MaintenanceSchedule = z.infer<typeof MaintenanceScheduleSchema>;

// ── Cost Tracking ──

export const CostCategorySchema = z.enum([
  'maintenance', 'repair', 'improvement', 'utility', 'other',
]);
export type CostCategory = z.infer<typeof CostCategorySchema>;

export const CostEntrySchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  scheduleId: z.string().nullable(),
  category: CostCategorySchema,
  description: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  vendor: z.string().nullable(),
  receiptPhotoUri: z.string().nullable(),
  costDate: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CostEntry = z.infer<typeof CostEntrySchema>;

// ── Document Storage ──

export const DocCategorySchema = z.enum([
  'deed', 'warranty', 'insurance', 'permit', 'receipt', 'manual', 'contract', 'other',
]);
export type DocCategory = z.infer<typeof DocCategorySchema>;

export const FileTypeSchema = z.enum(['pdf', 'image', 'other']);
export type FileType = z.infer<typeof FileTypeSchema>;

export const HomeDocumentSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  title: z.string().min(1),
  category: DocCategorySchema,
  fileUri: z.string().min(1),
  fileType: FileTypeSchema,
  fileSizeBytes: z.number().int().nonnegative(),
  expiryDate: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HomeDocument = z.infer<typeof HomeDocumentSchema>;

// ── Contractor Contacts ──

export const SpecialtySchema = z.enum([
  'plumbing', 'electrical', 'hvac', 'roofing', 'painting',
  'landscaping', 'cleaning', 'pest_control', 'general', 'other',
]);
export type Specialty = z.infer<typeof SpecialtySchema>;

export const ContractorSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().nullable(),
  name: z.string().min(1),
  company: z.string().nullable(),
  specialty: SpecialtySchema,
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  isFavorite: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Contractor = z.infer<typeof ContractorSchema>;

export const ContractorServiceSchema = z.object({
  id: z.string().min(1),
  contractorId: z.string().min(1),
  scheduleId: z.string().nullable(),
  description: z.string().min(1),
  serviceDate: z.string(),
  costCents: z.number().int().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ContractorService = z.infer<typeof ContractorServiceSchema>;

// ── Insurance Tracking ──

export const PolicyTypeSchema = z.enum([
  'homeowners', 'renters', 'flood', 'earthquake', 'umbrella', 'other',
]);
export type PolicyType = z.infer<typeof PolicyTypeSchema>;

export const InsurancePolicySchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  provider: z.string().min(1),
  policyNumber: z.string().min(1),
  policyType: PolicyTypeSchema,
  coverageAmountCents: z.number().int().nonnegative(),
  deductibleCents: z.number().int().nonnegative(),
  annualPremiumCents: z.number().int().nonnegative(),
  startDate: z.string(),
  endDate: z.string(),
  autoRenew: z.boolean(),
  documentId: z.string().nullable(),
  agentName: z.string().nullable(),
  agentPhone: z.string().nullable(),
  agentEmail: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InsurancePolicy = z.infer<typeof InsurancePolicySchema>;

// ── Home Inventory ──

export const RoomTypeSchema = z.enum([
  'bedroom', 'bathroom', 'kitchen', 'living', 'dining',
  'garage', 'basement', 'attic', 'office', 'outdoor', 'other',
]);
export type RoomType = z.infer<typeof RoomTypeSchema>;

export const ItemCategorySchema = z.enum([
  'furniture', 'electronics', 'appliance', 'clothing',
  'jewelry', 'art', 'tool', 'sporting', 'other',
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

export const ConditionSchema = z.enum(['new', 'good', 'fair', 'poor']);
export type Condition = z.infer<typeof ConditionSchema>;

export const RoomSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  name: z.string().min(1),
  roomType: RoomTypeSchema,
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type Room = z.infer<typeof RoomSchema>;

export const InventoryItemSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  propertyId: z.string().min(1),
  name: z.string().min(1),
  category: ItemCategorySchema,
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  purchaseDate: z.string().nullable(),
  purchasePriceCents: z.number().int().nullable(),
  estimatedValueCents: z.number().int().nullable(),
  condition: ConditionSchema,
  photoUri: z.string().nullable(),
  warrantyExpiry: z.string().nullable(),
  documentId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

// ── Appliance Manuals ──

export const ApplianceCategorySchema = z.enum([
  'hvac', 'kitchen', 'laundry', 'plumbing', 'electrical', 'outdoor', 'other',
]);
export type ApplianceCategory = z.infer<typeof ApplianceCategorySchema>;

export const ApplianceConditionSchema = z.enum([
  'new', 'good', 'fair', 'poor', 'replaced',
]);
export type ApplianceCondition = z.infer<typeof ApplianceConditionSchema>;

export const ApplianceSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  roomId: z.string().nullable(),
  inventoryItemId: z.string().nullable(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  modelNumber: z.string().nullable(),
  serialNumber: z.string().nullable(),
  purchaseDate: z.string().nullable(),
  purchasePriceCents: z.number().int().nullable(),
  warrantyExpiry: z.string().nullable(),
  manualUri: z.string().nullable(),
  photoUri: z.string().nullable(),
  category: ApplianceCategorySchema,
  condition: ApplianceConditionSchema,
  scheduleId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Appliance = z.infer<typeof ApplianceSchema>;

// ── Renovation Projects ──

export const ProjectStatusSchema = z.enum([
  'planning', 'in_progress', 'on_hold', 'completed', 'cancelled',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const PhaseStatusSchema = z.enum([
  'pending', 'in_progress', 'completed', 'skipped',
]);
export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

export const ProjectPrioritySchema = z.enum(['low', 'medium', 'high']);
export type ProjectPriority = z.infer<typeof ProjectPrioritySchema>;

export const ProjectCategorySchema = z.enum([
  'kitchen', 'bathroom', 'bedroom', 'exterior',
  'landscaping', 'structural', 'electrical', 'plumbing', 'other',
]);
export type ProjectCategory = z.infer<typeof ProjectCategorySchema>;

export const PhotoTypeSchema = z.enum(['before', 'during', 'after', 'inspiration']);
export type PhotoType = z.infer<typeof PhotoTypeSchema>;

export const ProjectSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  budgetCents: z.number().int().nonnegative(),
  actualCostCents: z.number().int().nonnegative(),
  startDate: z.string().nullable(),
  targetEndDate: z.string().nullable(),
  actualEndDate: z.string().nullable(),
  priority: ProjectPrioritySchema,
  category: ProjectCategorySchema,
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectPhaseSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
  status: PhaseStatusSchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  budgetCents: z.number().int().nullable(),
  contractorId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectPhase = z.infer<typeof ProjectPhaseSchema>;

export const ProjectPhotoSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  phaseId: z.string().nullable(),
  photoUri: z.string().min(1),
  caption: z.string().nullable(),
  photoType: PhotoTypeSchema,
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type ProjectPhoto = z.infer<typeof ProjectPhotoSchema>;
