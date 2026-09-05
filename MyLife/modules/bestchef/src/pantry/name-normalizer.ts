const SYNONYMS: Record<string, string> = {
  scallion: 'green onion',
  'spring onion': 'green onion',
  capsicum: 'bell pepper',
  aubergine: 'eggplant',
  courgette: 'zucchini',
  coriander: 'cilantro',
  'bicarbonate of soda': 'baking soda',
  cornflour: 'cornstarch',
  'icing sugar': 'powdered sugar',
  'confectioners sugar': 'powdered sugar',
  'plain flour': 'all-purpose flour',
  'self raising flour': 'self-rising flour',
  'double cream': 'heavy cream',
  'single cream': 'light cream',
  rocket: 'arugula',
  'cos lettuce': 'romaine lettuce',
  'broad bean': 'fava bean',
  chickpea: 'garbanzo bean',
  garbanzo: 'garbanzo bean',
  prawn: 'shrimp',
  'caster sugar': 'superfine sugar',
  'rapeseed oil': 'canola oil',
  'groundnut oil': 'peanut oil',
  mangetout: 'snow pea',
  swede: 'rutabaga',
  beetroot: 'beet',
  'spring greens': 'collard greens',
  treacle: 'molasses',
  sultana: 'golden raisin',
  mince: 'ground beef',
  'stock cube': 'bouillon cube',
};

const PREP_WORDS = new Set([
  'chopped', 'diced', 'minced', 'sliced', 'crushed', 'grated',
  'shredded', 'peeled', 'seeded', 'julienned', 'cubed', 'halved',
  'quartered', 'torn', 'mashed', 'melted', 'softened', 'sifted',
  'packed', 'drained', 'rinsed', 'thawed', 'frozen', 'fresh',
  'dried', 'whole', 'crumbled', 'toasted', 'roasted',
]);

const SIZE_MODIFIERS = new Set([
  'large', 'small', 'medium', 'extra-large', 'extra', 'big', 'tiny',
]);

const ARTICLES = new Set(['a', 'an', 'the']);
const SIBILANT_ENDINGS = ['sh', 'ch', 'ss', 'zz', 'x'];
const NO_DEPLURALIZE = new Set([
  'molasses', 'hummus', 'couscous', 'asparagus', 'citrus', 'hibiscus',
]);
const RECEIPT_LINE_ABBREVIATIONS: Record<string, string> = {
  appl: 'apple',
  ban: 'banana',
  bnls: 'boneless',
  brst: 'breast',
  chkn: 'chicken',
  grk: 'greek',
  mlk: 'milk',
  org: 'organic',
  parm: 'parmesan',
  rnch: 'ranch',
  spnch: 'spinach',
  tom: 'tomato',
  wht: 'wheat',
  whl: 'whole',
  yog: 'yogurt',
};
const RECEIPT_LINE_NOISE_WORDS = new Set([
  'ea',
  'fs',
  'fsa',
  'lb',
  'lbs',
  'pkg',
  'sale',
  'tax',
  'taxable',
  'tx',
  'void',
  'wgt',
]);
const BARCODE_PATTERN = /\b\d{8,14}\b/g;

export function normalizeItemName(item: string): string {
  let normalized = item.toLowerCase().trim();
  normalized = normalized.replace(/\s+/g, ' ');
  let words = normalized.split(' ');

  while (words.length > 1 && ARTICLES.has(words[0])) {
    words.shift();
  }

  if (words.length > 1) {
    const filtered = words.filter(
      (word) => !PREP_WORDS.has(word) && !SIZE_MODIFIERS.has(word),
    );
    if (filtered.length > 0) {
      words = filtered;
    }
  }

  normalized = words.join(' ');
  return depluralize(normalized);
}

function depluralize(text: string): string {
  const words = text.split(' ');
  const last = words[words.length - 1];
  words[words.length - 1] = depluralizeWord(last);
  return words.join(' ');
}

function depluralizeWord(word: string): string {
  if (word.length <= 3) return word;
  if (NO_DEPLURALIZE.has(word)) return word;
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith('ves') && word.length > 4) {
    return `${word.slice(0, -3)}f`;
  }
  if (word.endsWith('es') && word.length > 4) {
    const stem = word.slice(0, -2);
    if (SIBILANT_ENDINGS.some((ending) => stem.endsWith(ending))) {
      return stem;
    }
    if (word.endsWith('oes')) {
      return word.slice(0, -2);
    }
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

const NORMALIZED_SYNONYMS = new Map<string, string>();
for (const [key, value] of Object.entries(SYNONYMS)) {
  NORMALIZED_SYNONYMS.set(normalizeItemName(key), value);
}

export function resolveItemName(item: string): string {
  const normalized = normalizeItemName(item);
  const canonical = NORMALIZED_SYNONYMS.get(normalized);
  if (canonical !== undefined) {
    return normalizeItemName(canonical);
  }
  return normalized;
}

export function extractBarcodeFromReceiptLine(description: string): string | null {
  const matches = description.match(BARCODE_PATTERN) ?? [];
  return matches.find((match) => match.length >= 8 && match.length <= 14) ?? null;
}

export function normalizeReceiptLineDescription(description: string): string {
  const barcode = extractBarcodeFromReceiptLine(description);
  let normalized = description.toLowerCase();

  if (barcode) {
    normalized = normalized.replace(barcode, ' ');
  }

  normalized = normalized
    .replace(/\b\d+\s*[x@]\s*\$?\d+(?:\.\d{2})?\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:oz|fl oz|lb|lbs|g|kg|ct|pk|pack|pkg|ea)\b/g, ' ')
    .replace(/\$?\d{1,5}\.\d{2}\s*$/g, ' ')
    .replace(/[^\w%&-]+/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const expanded = normalized
    .split(' ')
    .map((word) => RECEIPT_LINE_ABBREVIATIONS[word] ?? word)
    .filter((word) => !RECEIPT_LINE_NOISE_WORDS.has(word) && !/^\d+$/.test(word))
    .join(' ');

  return resolveItemName(expanded);
}

export function itemsMatch(left: string, right: string): boolean {
  return resolveItemName(left) === resolveItemName(right);
}

/**
 * Look up a brand name in bc_brand_mappings and return the generic equivalent.
 * Falls through to existing normalizeItemName if no mapping is found.
 * Requires the BestChef Supabase client to be initialized.
 */
export async function resolveGenericName(brandName: string): Promise<string> {
  try {
    const { getBestChefClient } = await import('../cloud/client');
    const supabase = getBestChefClient();

    const normalized = normalizeItemName(brandName);
    const { data } = await supabase
      .from('bc_brand_mappings')
      .select('generic_name')
      .ilike('brand_name', normalized)
      .limit(1)
      .single();

    if (data?.generic_name) {
      return normalizeItemName(data.generic_name as string);
    }
  } catch {
    // Client not initialized or query failed; fall through
  }
  return normalizeItemName(brandName);
}

/**
 * Insert a brand-to-generic mapping into bc_brand_mappings.
 */
export async function addBrandMapping(
  barcode: string,
  brandName: string,
  genericName: string,
  category?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { getBestChefClient } = await import('../cloud/client');
    const supabase = getBestChefClient();
    const { randomUUID } = await import('crypto');

    const { error } = await supabase.from('bc_brand_mappings').insert({
      id: randomUUID(),
      barcode,
      brand_name: brandName,
      generic_name: genericName,
      category: category ?? null,
      verified: false,
      created_at: new Date().toISOString(),
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface BrandMappingRow {
  id: string;
  barcode: string;
  brandName: string;
  genericName: string | null;
  category: string | null;
  verified: boolean;
}

export interface GetBrandMappingsOptions {
  limit?: number;
  offset?: number;
  verifiedOnly?: boolean;
}

/**
 * List brand-to-generic mappings from bc_brand_mappings.
 */
export async function getBrandMappings(
  options?: GetBrandMappingsOptions,
): Promise<BrandMappingRow[]> {
  try {
    const { getBestChefClient } = await import('../cloud/client');
    const supabase = getBestChefClient();

    let query = supabase
      .from('bc_brand_mappings')
      .select('id, barcode, brand_name, generic_name, category, verified')
      .order('created_at', { ascending: false });

    if (options?.verifiedOnly) {
      query = query.eq('verified', true);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data } = await query;
    if (!data) return [];

    return data.map((row) => ({
      id: row.id as string,
      barcode: row.barcode as string,
      brandName: row.brand_name as string,
      genericName: (row.generic_name as string) ?? null,
      category: (row.category as string) ?? null,
      verified: row.verified as boolean,
    }));
  } catch {
    return [];
  }
}

export function fuzzyItemMatch(ingredient: string, pantryItem: string): number {
  const left = resolveItemName(ingredient);
  const right = resolveItemName(pantryItem);
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.8;

  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  const totalUnique = new Set([...leftWords, ...rightWords]).size;
  if (totalUnique > 0 && shared / totalUnique > 0.5) {
    return 0.6;
  }
  return 0;
}
