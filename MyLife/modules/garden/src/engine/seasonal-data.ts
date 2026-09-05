import type { Season, SeasonalTaskType } from '../types';

interface SeasonalCareEntry {
  category: string;
  season: Season;
  taskType: SeasonalTaskType;
  description: string;
  dueMonth: number; // 0-11
}

/**
 * Bundled seasonal care knowledge base.
 * Maps plant categories to seasonal tasks.
 */
export const SEASONAL_CARE_DATA: SeasonalCareEntry[] = [
  // Tropical houseplants
  { category: 'tropical', season: 'spring', taskType: 'increase_watering', description: 'Increase watering as growth resumes', dueMonth: 2 },
  { category: 'tropical', season: 'spring', taskType: 'start_fertilizing', description: 'Begin monthly fertilizing', dueMonth: 3 },
  { category: 'tropical', season: 'spring', taskType: 'repot', description: 'Repot root-bound plants into larger containers', dueMonth: 3 },
  { category: 'tropical', season: 'spring', taskType: 'check_pests', description: 'Inspect for overwintering pests', dueMonth: 2 },
  { category: 'tropical', season: 'summer', taskType: 'increase_watering', description: 'Water more frequently in heat', dueMonth: 5 },
  { category: 'tropical', season: 'fall', taskType: 'decrease_watering', description: 'Reduce watering as growth slows', dueMonth: 8 },
  { category: 'tropical', season: 'fall', taskType: 'stop_fertilizing', description: 'Stop fertilizing before dormancy', dueMonth: 9 },
  { category: 'tropical', season: 'fall', taskType: 'move_indoors', description: 'Move outdoor tropical plants inside before frost', dueMonth: 9 },
  { category: 'tropical', season: 'winter', taskType: 'decrease_watering', description: 'Water sparingly during dormancy', dueMonth: 11 },

  // Succulents / Cacti
  { category: 'succulent', season: 'spring', taskType: 'increase_watering', description: 'Resume regular watering schedule', dueMonth: 2 },
  { category: 'succulent', season: 'spring', taskType: 'start_fertilizing', description: 'Light fertilizing once a month', dueMonth: 3 },
  { category: 'succulent', season: 'summer', taskType: 'check_pests', description: 'Check for mealybugs and scale', dueMonth: 5 },
  { category: 'succulent', season: 'fall', taskType: 'stop_fertilizing', description: 'Stop fertilizing for winter rest', dueMonth: 9 },
  { category: 'succulent', season: 'winter', taskType: 'decrease_watering', description: 'Water very sparingly (once a month or less)', dueMonth: 11 },

  // Vegetables
  { category: 'vegetable', season: 'spring', taskType: 'repot', description: 'Start seeds indoors 6-8 weeks before last frost', dueMonth: 1 },
  { category: 'vegetable', season: 'spring', taskType: 'move_outdoors', description: 'Transplant seedlings after last frost', dueMonth: 3 },
  { category: 'vegetable', season: 'spring', taskType: 'start_fertilizing', description: 'Apply compost or balanced fertilizer', dueMonth: 3 },
  { category: 'vegetable', season: 'summer', taskType: 'increase_watering', description: 'Water deeply and consistently', dueMonth: 5 },
  { category: 'vegetable', season: 'summer', taskType: 'mulch', description: 'Mulch around plants to retain moisture', dueMonth: 5 },
  { category: 'vegetable', season: 'summer', taskType: 'check_pests', description: 'Regular pest and disease inspections', dueMonth: 6 },
  { category: 'vegetable', season: 'fall', taskType: 'prune', description: 'Remove spent plants and add to compost', dueMonth: 9 },
  { category: 'vegetable', season: 'fall', taskType: 'mulch', description: 'Mulch beds for winter protection', dueMonth: 10 },

  // Herbs
  { category: 'herb', season: 'spring', taskType: 'repot', description: 'Start herb seeds or transplant starts', dueMonth: 3 },
  { category: 'herb', season: 'spring', taskType: 'prune', description: 'Prune woody herbs (rosemary, thyme) to encourage growth', dueMonth: 3 },
  { category: 'herb', season: 'summer', taskType: 'prune', description: 'Regular harvest pruning to prevent bolting', dueMonth: 5 },
  { category: 'herb', season: 'fall', taskType: 'move_indoors', description: 'Bring tender herbs indoors before frost', dueMonth: 9 },
  { category: 'herb', season: 'winter', taskType: 'decrease_watering', description: 'Indoor herbs need less water in winter', dueMonth: 11 },

  // Flowers
  { category: 'flower', season: 'spring', taskType: 'start_fertilizing', description: 'Apply slow-release fertilizer', dueMonth: 2 },
  { category: 'flower', season: 'spring', taskType: 'divide', description: 'Divide overgrown perennials', dueMonth: 3 },
  { category: 'flower', season: 'summer', taskType: 'prune', description: 'Deadhead spent blooms for continued flowering', dueMonth: 5 },
  { category: 'flower', season: 'fall', taskType: 'mulch', description: 'Mulch perennials for winter protection', dueMonth: 10 },
  { category: 'flower', season: 'winter', taskType: 'prune', description: 'Cut back dead perennial stems', dueMonth: 0 },

  // Trees / Shrubs
  { category: 'tree', season: 'spring', taskType: 'start_fertilizing', description: 'Apply slow-release fertilizer at drip line', dueMonth: 2 },
  { category: 'tree', season: 'spring', taskType: 'prune', description: 'Prune dead/damaged branches before new growth', dueMonth: 1 },
  { category: 'tree', season: 'summer', taskType: 'increase_watering', description: 'Deep water during dry spells', dueMonth: 6 },
  { category: 'tree', season: 'fall', taskType: 'mulch', description: 'Apply mulch around base before winter', dueMonth: 10 },
];

/**
 * Get seasonal tasks for a plant category and season.
 */
export function getSeasonalTasksForCategory(category: string, season: Season): SeasonalCareEntry[] {
  const cat = category.toLowerCase().trim();
  return SEASONAL_CARE_DATA.filter((e) => e.category === cat && e.season === season);
}

/**
 * Get all known plant categories.
 */
export function getPlantCategories(): string[] {
  return [...new Set(SEASONAL_CARE_DATA.map((e) => e.category))];
}

/**
 * Infer plant category from species name (simple heuristic).
 */
export function inferCategory(species: string | null): string {
  if (!species) return 'tropical'; // default for unknown houseplants
  const s = species.toLowerCase();
  if (s.includes('succulent') || s.includes('cactus') || s.includes('echeveria') || s.includes('aloe')) return 'succulent';
  if (s.includes('tomato') || s.includes('pepper') || s.includes('lettuce') || s.includes('carrot') || s.includes('bean') || s.includes('squash') || s.includes('cucumber')) return 'vegetable';
  if (s.includes('basil') || s.includes('mint') || s.includes('rosemary') || s.includes('thyme') || s.includes('oregano') || s.includes('cilantro') || s.includes('parsley')) return 'herb';
  if (s.includes('rose') || s.includes('daisy') || s.includes('lily') || s.includes('tulip') || s.includes('marigold') || s.includes('lavender')) return 'flower';
  if (s.includes('oak') || s.includes('maple') || s.includes('pine') || s.includes('cedar') || s.includes('shrub')) return 'tree';
  return 'tropical';
}
