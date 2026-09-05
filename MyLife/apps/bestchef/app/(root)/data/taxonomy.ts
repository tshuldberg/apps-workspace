/**
 * BestChef Unified Taxonomy
 *
 * Structured identifiers for deep cross-domain filtering.
 * Every recipe, dish, and ingredient carries these tags,
 * enabling compound filters like "vegan + Thai + under 30 min + low sodium".
 *
 * Identifier format: domain:value (e.g., "diet:vegan", "method:grill", "allergen:nuts")
 * This makes filtering composable: a search query is an array of identifier strings.
 */

// ── Dietary Identifiers ────────────────────────────────────────────────

export const DIETARY_IDS = [
  'diet:vegan',
  'diet:vegetarian',
  'diet:pescatarian',
  'diet:gluten-free',
  'diet:dairy-free',
  'diet:nut-free',
  'diet:egg-free',
  'diet:soy-free',
  'diet:shellfish-free',
  'diet:keto',
  'diet:paleo',
  'diet:low-carb',
  'diet:low-sodium',
  'diet:low-fat',
  'diet:high-protein',
  'diet:whole30',
  'diet:fodmap',
  'diet:kosher',
  'diet:halal',
  'diet:raw',
  'diet:sugar-free',
] as const;

export type DietaryId = (typeof DIETARY_IDS)[number];

export const DIETARY_LABELS: Record<DietaryId, string> = {
  'diet:vegan': 'Vegan',
  'diet:vegetarian': 'Vegetarian',
  'diet:pescatarian': 'Pescatarian',
  'diet:gluten-free': 'Gluten Free',
  'diet:dairy-free': 'Dairy Free',
  'diet:nut-free': 'Nut Free',
  'diet:egg-free': 'Egg Free',
  'diet:soy-free': 'Soy Free',
  'diet:shellfish-free': 'Shellfish Free',
  'diet:keto': 'Keto',
  'diet:paleo': 'Paleo',
  'diet:low-carb': 'Low Carb',
  'diet:low-sodium': 'Low Sodium',
  'diet:low-fat': 'Low Fat',
  'diet:high-protein': 'High Protein',
  'diet:whole30': 'Whole30',
  'diet:fodmap': 'Low FODMAP',
  'diet:kosher': 'Kosher',
  'diet:halal': 'Halal',
  'diet:raw': 'Raw',
  'diet:sugar-free': 'Sugar Free',
};

// ── Allergen Identifiers ───────────────────────────────────────────────

export const ALLERGEN_IDS = [
  'allergen:milk',
  'allergen:eggs',
  'allergen:fish',
  'allergen:shellfish',
  'allergen:tree-nuts',
  'allergen:peanuts',
  'allergen:wheat',
  'allergen:soy',
  'allergen:sesame',
  'allergen:mustard',
  'allergen:celery',
  'allergen:lupin',
  'allergen:molluscs',
  'allergen:sulfites',
] as const;

export type AllergenId = (typeof ALLERGEN_IDS)[number];

export const ALLERGEN_LABELS: Record<AllergenId, string> = {
  'allergen:milk': 'Milk',
  'allergen:eggs': 'Eggs',
  'allergen:fish': 'Fish',
  'allergen:shellfish': 'Shellfish',
  'allergen:tree-nuts': 'Tree Nuts',
  'allergen:peanuts': 'Peanuts',
  'allergen:wheat': 'Wheat',
  'allergen:soy': 'Soy',
  'allergen:sesame': 'Sesame',
  'allergen:mustard': 'Mustard',
  'allergen:celery': 'Celery',
  'allergen:lupin': 'Lupin',
  'allergen:molluscs': 'Molluscs',
  'allergen:sulfites': 'Sulfites',
};

// ── Cooking Method Identifiers ─────────────────────────────────────────

export const METHOD_IDS = [
  'method:bake',
  'method:roast',
  'method:grill',
  'method:fry',
  'method:deep-fry',
  'method:air-fry',
  'method:saute',
  'method:stir-fry',
  'method:steam',
  'method:boil',
  'method:simmer',
  'method:poach',
  'method:braise',
  'method:slow-cook',
  'method:pressure-cook',
  'method:smoke',
  'method:sous-vide',
  'method:broil',
  'method:blanch',
  'method:ferment',
  'method:pickle',
  'method:cure',
  'method:no-cook',
  'method:raw',
  'method:blend',
  'method:dehydrate',
] as const;

export type MethodId = (typeof METHOD_IDS)[number];

export const METHOD_LABELS: Record<MethodId, string> = {
  'method:bake': 'Bake',
  'method:roast': 'Roast',
  'method:grill': 'Grill',
  'method:fry': 'Pan Fry',
  'method:deep-fry': 'Deep Fry',
  'method:air-fry': 'Air Fry',
  'method:saute': 'Saut\u00E9',
  'method:stir-fry': 'Stir Fry',
  'method:steam': 'Steam',
  'method:boil': 'Boil',
  'method:simmer': 'Simmer',
  'method:poach': 'Poach',
  'method:braise': 'Braise',
  'method:slow-cook': 'Slow Cook',
  'method:pressure-cook': 'Pressure Cook',
  'method:smoke': 'Smoke',
  'method:sous-vide': 'Sous Vide',
  'method:broil': 'Broil',
  'method:blanch': 'Blanch',
  'method:ferment': 'Ferment',
  'method:pickle': 'Pickle',
  'method:cure': 'Cure',
  'method:no-cook': 'No Cook',
  'method:raw': 'Raw',
  'method:blend': 'Blend',
  'method:dehydrate': 'Dehydrate',
};

// ── Equipment Identifiers ──────────────────────────────────────────────

export const EQUIPMENT_IDS = [
  'equip:oven',
  'equip:stovetop',
  'equip:grill',
  'equip:air-fryer',
  'equip:instant-pot',
  'equip:slow-cooker',
  'equip:blender',
  'equip:food-processor',
  'equip:mixer',
  'equip:wok',
  'equip:cast-iron',
  'equip:dutch-oven',
  'equip:smoker',
  'equip:sous-vide',
  'equip:deep-fryer',
  'equip:microwave',
  'equip:toaster-oven',
  'equip:pizza-stone',
  'equip:mortar-pestle',
  'equip:mandoline',
  'equip:none',
] as const;

export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  'equip:oven': 'Oven',
  'equip:stovetop': 'Stovetop',
  'equip:grill': 'Grill',
  'equip:air-fryer': 'Air Fryer',
  'equip:instant-pot': 'Instant Pot',
  'equip:slow-cooker': 'Slow Cooker',
  'equip:blender': 'Blender',
  'equip:food-processor': 'Food Processor',
  'equip:mixer': 'Stand Mixer',
  'equip:wok': 'Wok',
  'equip:cast-iron': 'Cast Iron',
  'equip:dutch-oven': 'Dutch Oven',
  'equip:smoker': 'Smoker',
  'equip:sous-vide': 'Sous Vide',
  'equip:deep-fryer': 'Deep Fryer',
  'equip:microwave': 'Microwave',
  'equip:toaster-oven': 'Toaster Oven',
  'equip:pizza-stone': 'Pizza Stone',
  'equip:mortar-pestle': 'Mortar & Pestle',
  'equip:mandoline': 'Mandoline',
  'equip:none': 'No Equipment',
};

// ── Cuisine Identifiers (structured, not free-form) ────────────────────

export const CUISINE_IDS = [
  'cuisine:african',
  'cuisine:american',
  'cuisine:argentine',
  'cuisine:brazilian',
  'cuisine:british',
  'cuisine:cajun',
  'cuisine:caribbean',
  'cuisine:chinese',
  'cuisine:colombian',
  'cuisine:cuban',
  'cuisine:ethiopian',
  'cuisine:filipino',
  'cuisine:french',
  'cuisine:german',
  'cuisine:greek',
  'cuisine:hawaiian',
  'cuisine:indian',
  'cuisine:indonesian',
  'cuisine:irish',
  'cuisine:israeli',
  'cuisine:italian',
  'cuisine:jamaican',
  'cuisine:japanese',
  'cuisine:korean',
  'cuisine:lebanese',
  'cuisine:malaysian',
  'cuisine:mediterranean',
  'cuisine:mexican',
  'cuisine:middle-eastern',
  'cuisine:moroccan',
  'cuisine:nigerian',
  'cuisine:peruvian',
  'cuisine:polish',
  'cuisine:portuguese',
  'cuisine:russian',
  'cuisine:scandinavian',
  'cuisine:senegalese',
  'cuisine:soul-food',
  'cuisine:southern',
  'cuisine:spanish',
  'cuisine:sri-lankan',
  'cuisine:taiwanese',
  'cuisine:tex-mex',
  'cuisine:thai',
  'cuisine:turkish',
  'cuisine:vietnamese',
  'cuisine:west-african',
  'cuisine:fusion',
] as const;

export type CuisineId = (typeof CUISINE_IDS)[number];

// ── Meal Context Identifiers ───────────────────────────────────────────

export const MEAL_CONTEXT_IDS = [
  'meal:breakfast',
  'meal:brunch',
  'meal:lunch',
  'meal:dinner',
  'meal:snack',
  'meal:dessert',
  'meal:appetizer',
  'meal:side',
  'meal:drink',
  'meal:meal-prep',
  'meal:batch-cook',
  'meal:one-pot',
  'meal:sheet-pan',
  'meal:weeknight',
  'meal:entertaining',
  'meal:party-food',
  'meal:lunchbox',
  'meal:picnic',
  'meal:holiday',
  'meal:comfort-food',
  'meal:date-night',
] as const;

export type MealContextId = (typeof MEAL_CONTEXT_IDS)[number];

export const MEAL_CONTEXT_LABELS: Record<MealContextId, string> = {
  'meal:breakfast': 'Breakfast',
  'meal:brunch': 'Brunch',
  'meal:lunch': 'Lunch',
  'meal:dinner': 'Dinner',
  'meal:snack': 'Snack',
  'meal:dessert': 'Dessert',
  'meal:appetizer': 'Appetizer',
  'meal:side': 'Side Dish',
  'meal:drink': 'Drink',
  'meal:meal-prep': 'Meal Prep',
  'meal:batch-cook': 'Batch Cook',
  'meal:one-pot': 'One Pot',
  'meal:sheet-pan': 'Sheet Pan',
  'meal:weeknight': 'Weeknight',
  'meal:entertaining': 'Entertaining',
  'meal:party-food': 'Party Food',
  'meal:lunchbox': 'Lunchbox',
  'meal:picnic': 'Picnic',
  'meal:holiday': 'Holiday',
  'meal:comfort-food': 'Comfort Food',
  'meal:date-night': 'Date Night',
};

// ── Time Identifiers ───────────────────────────────────────────────────

export const TIME_IDS = [
  'time:under-15',
  'time:under-30',
  'time:under-45',
  'time:under-60',
  'time:1-2-hours',
  'time:over-2-hours',
  'time:overnight',
] as const;

export type TimeId = (typeof TIME_IDS)[number];

export const TIME_LABELS: Record<TimeId, string> = {
  'time:under-15': 'Under 15 min',
  'time:under-30': 'Under 30 min',
  'time:under-45': 'Under 45 min',
  'time:under-60': 'Under 1 hour',
  'time:1-2-hours': '1-2 hours',
  'time:over-2-hours': '2+ hours',
  'time:overnight': 'Overnight',
};

// ── Spice / Heat Level ─────────────────────────────────────────────────

export const SPICE_IDS = [
  'spice:mild',
  'spice:medium',
  'spice:hot',
  'spice:extra-hot',
  'spice:no-spice',
] as const;

export type SpiceId = (typeof SPICE_IDS)[number];

export const SPICE_LABELS: Record<SpiceId, string> = {
  'spice:mild': 'Mild',
  'spice:medium': 'Medium',
  'spice:hot': 'Hot',
  'spice:extra-hot': 'Extra Hot',
  'spice:no-spice': 'No Spice',
};

// ── Season / Freshness ─────────────────────────────────────────────────

export const SEASON_IDS = [
  'season:spring',
  'season:summer',
  'season:fall',
  'season:winter',
  'season:year-round',
] as const;

export type SeasonId = (typeof SEASON_IDS)[number];

export const SEASON_LABELS: Record<SeasonId, string> = {
  'season:spring': 'Spring',
  'season:summer': 'Summer',
  'season:fall': 'Fall',
  'season:winter': 'Winter',
  'season:year-round': 'Year Round',
};

// ── Cost / Budget ──────────────────────────────────────────────────────

export const COST_IDS = [
  'cost:budget',
  'cost:moderate',
  'cost:premium',
  'cost:splurge',
] as const;

export type CostId = (typeof COST_IDS)[number];

export const COST_LABELS: Record<CostId, string> = {
  'cost:budget': 'Budget ($)',
  'cost:moderate': 'Moderate ($$)',
  'cost:premium': 'Premium ($$$)',
  'cost:splurge': 'Splurge ($$$$)',
};

// ── Protein Source Identifiers ─────────────────────────────────────────

export const PROTEIN_IDS = [
  'protein:chicken',
  'protein:beef',
  'protein:pork',
  'protein:lamb',
  'protein:turkey',
  'protein:duck',
  'protein:fish',
  'protein:shrimp',
  'protein:crab',
  'protein:lobster',
  'protein:scallop',
  'protein:tofu',
  'protein:tempeh',
  'protein:seitan',
  'protein:beans',
  'protein:lentils',
  'protein:chickpeas',
  'protein:eggs',
  'protein:cheese',
  'protein:none',
] as const;

export type ProteinId = (typeof PROTEIN_IDS)[number];

// ── Grocery Section Identifiers (maps to pantry + shopping) ────────────

export const GROCERY_IDS = [
  'grocery:produce',
  'grocery:dairy',
  'grocery:meat',
  'grocery:seafood',
  'grocery:pantry',
  'grocery:frozen',
  'grocery:bakery',
  'grocery:beverages',
  'grocery:snacks',
  'grocery:condiments',
  'grocery:spices',
  'grocery:grains',
  'grocery:canned',
  'grocery:deli',
  'grocery:international',
  'grocery:organic',
  'grocery:bulk',
] as const;

export type GroceryId = (typeof GROCERY_IDS)[number];

export const GROCERY_LABELS: Record<GroceryId, string> = {
  'grocery:produce': 'Produce',
  'grocery:dairy': 'Dairy & Eggs',
  'grocery:meat': 'Meat & Poultry',
  'grocery:seafood': 'Seafood',
  'grocery:pantry': 'Pantry',
  'grocery:frozen': 'Frozen',
  'grocery:bakery': 'Bakery',
  'grocery:beverages': 'Beverages',
  'grocery:snacks': 'Snacks',
  'grocery:condiments': 'Condiments',
  'grocery:spices': 'Spices & Seasonings',
  'grocery:grains': 'Grains & Pasta',
  'grocery:canned': 'Canned & Jarred',
  'grocery:deli': 'Deli',
  'grocery:international': 'International',
  'grocery:organic': 'Organic',
  'grocery:bulk': 'Bulk',
};

// ── Media Identifiers ──────────────────────────────────────────────────

export const MEDIA_IDS = [
  'media:has-photo',
  'media:has-video',
  'media:has-prep-video',
  'media:has-technique-video',
  'media:has-plating-video',
  'media:photo-verified',
  'media:step-photos',
] as const;

export type MediaId = (typeof MEDIA_IDS)[number];

export const MEDIA_LABELS: Record<MediaId, string> = {
  'media:has-photo': 'Has Photo',
  'media:has-video': 'Has Video',
  'media:has-prep-video': 'Prep Video',
  'media:has-technique-video': 'Technique Video',
  'media:has-plating-video': 'Plating Video',
  'media:photo-verified': 'Photo Verified',
  'media:step-photos': 'Step-by-Step Photos',
};

// ── Unified Tag Type ───────────────────────────────────────────────────

export type TagId =
  | DietaryId
  | AllergenId
  | MethodId
  | EquipmentId
  | CuisineId
  | MealContextId
  | TimeId
  | SpiceId
  | SeasonId
  | CostId
  | ProteinId
  | GroceryId
  | MediaId;

export function getTagDomain(tag: TagId): string {
  return tag.split(':')[0];
}

export function getTagValue(tag: TagId): string {
  return tag.split(':')[1];
}

export function getTagLabel(tag: TagId): string {
  const allLabels: Record<string, string> = {
    ...DIETARY_LABELS,
    ...ALLERGEN_LABELS,
    ...METHOD_LABELS,
    ...EQUIPMENT_LABELS,
    ...MEAL_CONTEXT_LABELS,
    ...TIME_LABELS,
    ...SPICE_LABELS,
    ...SEASON_LABELS,
    ...COST_LABELS,
    ...GROCERY_LABELS,
    ...MEDIA_LABELS,
  };
  return allLabels[tag] ?? getTagValue(tag);
}

// ── Filter Domains for UI ──────────────────────────────────────────────

export interface FilterDomain {
  id: string;
  label: string;
  icon: string;
  tags: readonly TagId[];
  multiSelect: boolean;
}

export const FILTER_DOMAINS: FilterDomain[] = [
  { id: 'diet', label: 'Dietary', icon: '\u{1F331}', tags: DIETARY_IDS, multiSelect: true },
  { id: 'allergen', label: 'Allergens', icon: '\u26A0\uFE0F', tags: ALLERGEN_IDS, multiSelect: true },
  { id: 'method', label: 'Cooking Method', icon: '\u{1F525}', tags: METHOD_IDS, multiSelect: true },
  { id: 'equip', label: 'Equipment', icon: '\u{1F373}', tags: EQUIPMENT_IDS, multiSelect: true },
  { id: 'cuisine', label: 'Cuisine', icon: '\u{1F30D}', tags: CUISINE_IDS, multiSelect: true },
  { id: 'meal', label: 'Meal Type', icon: '\u{1F37D}\uFE0F', tags: MEAL_CONTEXT_IDS, multiSelect: true },
  { id: 'time', label: 'Time', icon: '\u23F1\uFE0F', tags: TIME_IDS, multiSelect: false },
  { id: 'spice', label: 'Heat Level', icon: '\u{1F336}\uFE0F', tags: SPICE_IDS, multiSelect: false },
  { id: 'season', label: 'Season', icon: '\u{1F33B}', tags: SEASON_IDS, multiSelect: true },
  { id: 'cost', label: 'Budget', icon: '\u{1F4B0}', tags: COST_IDS, multiSelect: false },
  { id: 'protein', label: 'Protein', icon: '\u{1F356}', tags: PROTEIN_IDS, multiSelect: true },
  { id: 'grocery', label: 'Grocery Aisle', icon: '\u{1F6D2}', tags: GROCERY_IDS, multiSelect: true },
  { id: 'media', label: 'Media', icon: '\u{1F4F7}', tags: MEDIA_IDS, multiSelect: true },
];

// ── Ingredient-to-Allergen Auto-Detection ──────────────────────────────

const ALLERGEN_KEYWORDS: Record<AllergenId, string[]> = {
  'allergen:milk': ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'whey', 'casein', 'ghee', 'mascarpone', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'gouda', 'gruyere', 'brie', 'camembert', 'half and half', 'sour cream'],
  'allergen:eggs': ['egg', 'eggs', 'yolk', 'mayo', 'mayonnaise', 'meringue', 'aioli'],
  'allergen:fish': ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'trout', 'sardine', 'anchovy', 'mackerel', 'halibut', 'swordfish', 'mahi', 'snapper', 'bass', 'catfish', 'fish sauce'],
  'allergen:shellfish': ['shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'crawfish', 'prawn', 'langoustine'],
  'allergen:tree-nuts': ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia', 'hazelnut', 'brazil nut', 'pine nut', 'chestnut'],
  'allergen:peanuts': ['peanut', 'peanut butter'],
  'allergen:wheat': ['flour', 'bread', 'pasta', 'noodle', 'tortilla', 'breadcrumb', 'couscous', 'spaghetti', 'fettuccine', 'penne', 'crouton', 'panko', 'seitan', 'wheat'],
  'allergen:soy': ['soy', 'soy sauce', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari'],
  'allergen:sesame': ['sesame', 'tahini', 'sesame oil', 'sesame seed'],
  'allergen:mustard': ['mustard', 'dijon'],
  'allergen:celery': ['celery'],
  'allergen:lupin': ['lupin'],
  'allergen:molluscs': ['squid', 'octopus', 'snail', 'escargot', 'calamari'],
  'allergen:sulfites': ['wine', 'dried fruit', 'vinegar'],
};

export function detectAllergens(ingredients: string[]): AllergenId[] {
  const found = new Set<AllergenId>();
  for (const ing of ingredients) {
    const lower = ing.toLowerCase();
    for (const [allergenId, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          found.add(allergenId as AllergenId);
          break;
        }
      }
    }
  }
  return [...found];
}

// ── Ingredient-to-Dietary Auto-Detection ───────────────────────────────

const MEAT_KEYWORDS = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'veal', 'venison', 'bacon', 'ham', 'sausage', 'salami', 'prosciutto', 'pepperoni', 'chorizo', 'guanciale', 'pancetta', 'meatball', 'hot dog', 'ribs', 'brisket', 'steak', 'ground beef', 'ground turkey'];
const FISH_KEYWORDS = ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'trout', 'sardine', 'anchovy', 'shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'fish sauce'];
const DAIRY_KEYWORDS = ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'whey', 'casein', 'ghee', 'mascarpone', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'sour cream', 'half and half', 'heavy cream', 'whipped cream'];
const EGG_KEYWORDS = ['egg', 'eggs', 'yolk'];

export function inferDietaryTags(ingredients: string[]): DietaryId[] {
  const lowers = ingredients.map((i) => i.toLowerCase());
  const hasMeat = lowers.some((l) => MEAT_KEYWORDS.some((kw) => l.includes(kw)));
  const hasFish = lowers.some((l) => FISH_KEYWORDS.some((kw) => l.includes(kw)));
  const hasDairy = lowers.some((l) => DAIRY_KEYWORDS.some((kw) => l.includes(kw)));
  const hasEggs = lowers.some((l) => EGG_KEYWORDS.some((kw) => l.includes(kw)));

  const tags: DietaryId[] = [];
  if (!hasMeat && !hasFish && !hasDairy && !hasEggs) tags.push('diet:vegan');
  else if (!hasMeat && !hasFish) tags.push('diet:vegetarian');
  else if (!hasMeat && hasFish) tags.push('diet:pescatarian');
  if (!hasDairy) tags.push('diet:dairy-free');
  if (!hasEggs) tags.push('diet:egg-free');
  return tags;
}

// ── Time Range from Minutes ────────────────────────────────────────────

export function inferTimeTag(totalMinutes: number | null | undefined): TimeId | null {
  if (totalMinutes == null) return null;
  if (totalMinutes <= 15) return 'time:under-15';
  if (totalMinutes <= 30) return 'time:under-30';
  if (totalMinutes <= 45) return 'time:under-45';
  if (totalMinutes <= 60) return 'time:under-60';
  if (totalMinutes <= 120) return 'time:1-2-hours';
  return 'time:over-2-hours';
}

// ── Compound Filter Engine ─────────────────────────────────────────────

export interface TaggedItem {
  id: string;
  tags: TagId[];
}

export function matchesFilter(item: TaggedItem, activeTags: TagId[]): boolean {
  if (activeTags.length === 0) return true;

  const byDomain = new Map<string, TagId[]>();
  for (const tag of activeTags) {
    const domain = getTagDomain(tag);
    const list = byDomain.get(domain) ?? [];
    list.push(tag);
    byDomain.set(domain, list);
  }

  // Within a domain: OR (any match). Across domains: AND (all domains must match).
  for (const [, domainTags] of byDomain) {
    const domainMatch = domainTags.some((t) => item.tags.includes(t));
    if (!domainMatch) return false;
  }
  return true;
}
