import type { Contractor, ContractorService, Specialty } from '../types';

/**
 * Filter contractors by specialty.
 */
export function getContractorsBySpecialty(
  contractors: Contractor[],
  specialty: Specialty,
): Contractor[] {
  return contractors.filter((c) => c.specialty === specialty);
}

/**
 * Return only contractors marked as favorites.
 */
export function getFavoriteContractors(
  contractors: Contractor[],
): Contractor[] {
  return contractors.filter((c) => c.isFavorite);
}

// Maps maintenance task types to relevant contractor specialties
const TASK_TYPE_TO_SPECIALTIES: Record<string, Specialty[]> = {
  hvac: ['hvac'],
  roofing: ['roofing'],
  pest_control: ['pest_control'],
  cleaning: ['cleaning'],
  plumbing: ['plumbing'],
  painting: ['painting'],
  landscaping: ['landscaping'],
  general: [], // special case: matches all
};

// Maps specific task types (from TaskType enum) to specialties
const SPECIFIC_TASK_MAPPING: Record<string, Specialty[]> = {
  hvac_filter: ['hvac'],
  hvac_service: ['hvac'],
  roof_inspection: ['roofing'],
  pest_control: ['pest_control'],
  gutter_cleaning: ['cleaning'],
  window_cleaning: ['cleaning'],
  dryer_vent: ['cleaning'],
  water_heater_flush: ['plumbing'],
  plumbing_inspection: ['plumbing'],
  exterior_paint: ['painting'],
  lawn_mower_service: ['landscaping'],
};

/**
 * Find contractors whose specialty matches a given task type.
 *
 * Supports both broad categories (e.g. "hvac", "plumbing") and specific
 * task types from the TaskType enum (e.g. "hvac_filter", "water_heater_flush").
 *
 * The "general" task type returns all contractors.
 */
export function getContractorForTaskType(
  contractors: Contractor[],
  taskType: string,
): Contractor[] {
  // "general" matches all contractors
  if (taskType === 'general') {
    return contractors;
  }

  // Check specific task type mapping first
  const specificSpecialties = SPECIFIC_TASK_MAPPING[taskType];
  if (specificSpecialties) {
    return contractors.filter(
      (c) => specificSpecialties.includes(c.specialty) || c.specialty === 'general',
    );
  }

  // Check broad category mapping
  const broadSpecialties = TASK_TYPE_TO_SPECIALTIES[taskType];
  if (broadSpecialties && broadSpecialties.length > 0) {
    return contractors.filter(
      (c) => broadSpecialties.includes(c.specialty) || c.specialty === 'general',
    );
  }

  // Unknown task type: return general contractors only
  return contractors.filter((c) => c.specialty === 'general');
}

/**
 * Compute aggregate stats from a list of contractor services.
 */
export function getContractorStats(services: ContractorService[]): {
  totalServices: number;
  totalSpentCents: number;
  averageRating: number;
} {
  const totalServices = services.length;

  const totalSpentCents = services.reduce(
    (sum, s) => sum + (s.costCents ?? 0),
    0,
  );

  const rated = services.filter((s) => s.rating !== null);
  const averageRating =
    rated.length > 0
      ? rated.reduce((sum, s) => sum + s.rating!, 0) / rated.length
      : 0;

  return { totalServices, totalSpentCents, averageRating };
}
