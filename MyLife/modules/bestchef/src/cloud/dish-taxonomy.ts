/**
 * Dish taxonomy engine.
 *
 * All functions operate against the Supabase `bc_dishes` and `bc_dish_aliases`
 * tables via the shared BestChef client.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import type { Dish, DishAlias, DishCategory, CuisineOrigin } from './types';

/** Shorthand for `getBestChefClient().from(table)`. */
function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Helpers ────────────────────────────────────────────────────────────

function mapDish(row: Record<string, unknown>): Dish {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    nativeName: (row.native_name as string) ?? null,
    category: row.category as Dish['category'],
    cuisine: row.cuisine as string,
    region: (row.region as string) ?? null,
    description: (row.description as string) ?? null,
    photoUrl: (row.photo_url as string) ?? null,
    gradientFrom: (row.gradient_from as string) ?? null,
    gradientTo: (row.gradient_to as string) ?? null,
    emoji: (row.emoji as string) ?? null,
    aliasCount: (row.alias_count as number) ?? 0,
    submissionCount: (row.submission_count as number) ?? 0,
    status: (row.status as Dish['status']) ?? 'active',
    proposedBy: (row.proposed_by as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapAlias(row: Record<string, unknown>): DishAlias {
  return {
    id: row.id as string,
    dishId: row.dish_id as string,
    alias: row.alias as string,
    locale: (row.locale as string) ?? null,
  };
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function slugify(name: string): string {
  const lowered = name.toLowerCase();
  const ascii = lowered
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  // Non-Latin scripts (CJK, Hangul, Arabic, Hebrew, Thai, Devanagari, ...)
  // reduce to '' under the ASCII pass; with bc_dishes_slug_unique the second
  // such dish is a unique violation. Keep Unicode letters, digits, AND
  // combining marks (Thai tone marks and Devanagari matras are \p{M}, not
  // \p{L}) so native-language slugs stay meaningful and distinct.
  const unicode = lowered
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  if (unicode) return unicode;
  // Nothing usable at all (emoji-only, punctuation-only, empty): a slug must
  // never be empty, so derive a deterministic fallback from the raw name.
  return `dish-${fnv1aHex(name)}`;
}

// ── Dish CRUD ──────────────────────────────────────────────────────────

export interface CreateDishInput {
  name: string;
  nativeName?: string | null;
  category: DishCategory;
  cuisine: string;
  region?: string | null;
  description?: string | null;
  photoUrl?: string | null;
}

export async function createDish(
  input: CreateDishInput,
): Promise<BestChefResult<Dish>> {
  const slug = slugify(input.name);

  const { data, error: dbErr } = await from('bc_dishes')
    .insert({
      name: input.name,
      slug,
      native_name: input.nativeName ?? null,
      category: input.category,
      cuisine: input.cuisine,
      region: input.region ?? null,
      description: input.description ?? null,
      photo_url: input.photoUrl ?? null,
      status: 'active',
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapDish(data));
}

export async function getDishById(
  id: string,
): Promise<BestChefResult<{ dish: Dish; aliases: DishAlias[] }>> {
  const { data: dishRow, error: dishErr } = await from('bc_dishes')
    .select('*')
    .eq('id', id)
    .single();

  if (dishErr) return err(dishErr.message);

  const { data: aliasRows, error: aliasErr } = await from('bc_dish_aliases')
    .select('*')
    .eq('dish_id', id);

  if (aliasErr) return err(aliasErr.message);

  return ok({
    dish: mapDish(dishRow),
    aliases: (aliasRows ?? []).map(mapAlias),
  });
}

export async function getDishBySlug(
  slug: string,
): Promise<BestChefResult<{ dish: Dish; aliases: DishAlias[] }>> {
  const { data: dishRow, error: dishErr } = await from('bc_dishes')
    .select('*')
    .eq('slug', slug)
    .single();

  if (dishErr) return err(dishErr.message);

  const { data: aliasRows, error: aliasErr } = await from('bc_dish_aliases')
    .select('*')
    .eq('dish_id', dishRow.id);

  if (aliasErr) return err(aliasErr.message);

  return ok({
    dish: mapDish(dishRow),
    aliases: (aliasRows ?? []).map(mapAlias),
  });
}

// ── Search ─────────────────────────────────────────────────────────────

export interface DishSearchFilters {
  category?: DishCategory;
  cuisine?: CuisineOrigin;
  /** Pass null explicitly for an unfiltered status; defaults to 'active'. */
  status?: Dish['status'] | null;
  limit?: number;
  offset?: number;
  /**
   * App language (e.g. 'de', 'pt-BR'). Enables approved bc_dish_translations
   * matching + localized display fields, and scopes locale-tagged aliases
   * (untagged aliases always match). Plan 33 Phase 2.3.
   */
  locale?: string | null;
}

interface SearchDishesRpcRow {
  dish: Record<string, unknown>;
  localized_name: string | null;
  localized_description: string | null;
}

/**
 * Locale-aware dish search via the bc_search_dishes RPC. Fully parameterized:
 * the previous implementation interpolated the raw query into a PostgREST
 * `.or(ilike)` filter string, which broke on commas/parens and could not
 * match translations or locale-tagged aliases.
 */
export async function searchDishes(
  query: string,
  filters?: DishSearchFilters,
): Promise<BestChefResult<Dish[]>> {
  const { data, error: dbErr } = await getBestChefClient().rpc('bc_search_dishes', {
    p_query: query ?? '',
    p_locale: filters?.locale ?? null,
    p_category: filters?.category ?? null,
    p_cuisine: filters?.cuisine ?? null,
    p_status: filters?.status === null ? null : (filters?.status ?? 'active'),
    p_limit: filters?.limit ?? 50,
    p_offset: filters?.offset ?? 0,
  });
  if (dbErr) return err(dbErr.message);

  const rows = (data ?? []) as unknown as SearchDishesRpcRow[];
  return ok(
    rows.map((row) => ({
      ...mapDish(row.dish),
      localizedName: row.localized_name ?? null,
      localizedDescription: row.localized_description ?? null,
    })),
  );
}

/** Localized display name with canonical fallback (plan 33 Phase 2.3). */
export function dishDisplayName(dish: Pick<Dish, 'name' | 'localizedName'>): string {
  return dish.localizedName ?? dish.name;
}

export function dishDisplayDescription(
  dish: Pick<Dish, 'description' | 'localizedDescription'>,
): string | null {
  return dish.localizedDescription ?? dish.description;
}

/**
 * Fetch the best approved translation for a dish (exact locale tag first,
 * then base language) and merge it into the dish's localized fields.
 */
export async function localizeDish(dish: Dish, locale: string | null | undefined): Promise<Dish> {
  const normalized = (locale ?? '').trim().toLowerCase();
  if (!normalized) return dish;
  const base = normalized.split('-')[0];
  const candidates = normalized === base ? [normalized] : [normalized, base];

  const { data, error: dbErr } = await from('bc_dish_translations')
    .select('locale,name,description')
    .eq('dish_id', dish.id)
    .eq('status', 'approved')
    .in('locale', candidates);
  if (dbErr || !data || data.length === 0) return dish;

  const rows = data as Array<{ locale: string; name: string; description: string | null }>;
  const best =
    rows.find((row) => row.locale.toLowerCase() === normalized) ??
    rows.find((row) => row.locale.toLowerCase() === base) ??
    null;
  if (!best) return dish;
  return { ...dish, localizedName: best.name, localizedDescription: best.description ?? null };
}

export async function getDishesForCuisine(
  cuisine: CuisineOrigin,
  opts: { limit?: number; offset?: number } = {},
): Promise<BestChefResult<Dish[]>> {
  const { limit = 100, offset = 0 } = opts;

  const { data, error: dbErr } = await from('bc_dishes')
    .select('*')
    .eq('cuisine', cuisine)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (dbErr) return err(dbErr.message);
  return ok((data ?? []).map(mapDish));
}

// ── Category / Cuisine lists ───────────────────────────────────────────

export async function getDishCategories(): Promise<BestChefResult<string[]>> {
  const { data, error: dbErr } = await from('bc_dishes')
    .select('category')
    .eq('status', 'active');

  if (dbErr) return err(dbErr.message);

  const categories = [...new Set((data ?? []).map((r: Record<string, unknown>) => r.category as string))].sort();
  return ok<string[]>(categories);
}

export interface DishListItem {
  id: string;
  name: string;
  emoji: string | null;
}

/**
 * All active dishes, ordered by submission_count desc then name.
 * Returns a lightweight shape for sub-picker rendering.
 */
export async function getAllDishes(
  opts: { limit?: number } = {},
): Promise<BestChefResult<DishListItem[]>> {
  const { limit = 200 } = opts;

  const { data, error: dbErr } = await from('bc_dishes')
    .select('id, name, emoji')
    .eq('status', 'active')
    .order('submission_count', { ascending: false })
    .order('name', { ascending: true })
    .limit(limit);

  if (dbErr) return err(dbErr.message);
  return ok(
    (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      emoji: (r.emoji as string) ?? null,
    })),
  );
}

export async function getCuisines(): Promise<BestChefResult<string[]>> {
  const { data, error: dbErr } = await from('bc_dishes')
    .select('cuisine')
    .eq('status', 'active');

  if (dbErr) return err(dbErr.message);

  const cuisines = [...new Set((data ?? []).map((r: Record<string, unknown>) => r.cuisine as string))].sort();
  return ok<string[]>(cuisines);
}

// ── Aliases ────────────────────────────────────────────────────────────

export async function addDishAlias(
  dishId: string,
  alias: string,
  locale?: string,
): Promise<BestChefResult<DishAlias>> {
  const { data, error: dbErr } = await from('bc_dish_aliases')
    .insert({
      dish_id: dishId,
      alias,
      locale: locale ?? null,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapAlias(data));
}

export async function resolveDishAlias(
  text: string,
): Promise<BestChefResult<Dish | null>> {
  const normalizedText = text.trim().toLowerCase();

  // First check aliases
  const { data: aliasRows, error: aliasErr } = await from('bc_dish_aliases')
    .select('dish_id')
    .ilike('alias', normalizedText)
    .limit(1);

  if (aliasErr) return err(aliasErr.message);

  if (aliasRows && aliasRows.length > 0) {
    const { data: dishRow, error: dishErr } = await from('bc_dishes')
      .select('*')
      .eq('id', aliasRows[0].dish_id)
      .single();

    if (dishErr) return err(dishErr.message);
    return ok(mapDish(dishRow));
  }

  // Fallback: check dish name directly
  const { data: directRow, error: directErr } = await from('bc_dishes')
    .select('*')
    .ilike('name', normalizedText)
    .limit(1)
    .maybeSingle();

  if (directErr) return err(directErr.message);
  return ok(directRow ? mapDish(directRow) : null);
}

// ── Community Proposals ────────────────────────────────────────────────

export interface ProposeDishInput {
  name: string;
  nativeName?: string | null;
  category: DishCategory;
  cuisine: string;
  region?: string | null;
  description?: string | null;
}

export async function proposeDish(
  input: ProposeDishInput,
  profileId: string,
): Promise<BestChefResult<Dish>> {
  const slug = slugify(input.name);

  const { data, error: dbErr } = await from('bc_dishes')
    .insert({
      name: input.name,
      slug,
      native_name: input.nativeName ?? null,
      category: input.category,
      cuisine: input.cuisine,
      region: input.region ?? null,
      description: input.description ?? null,
      status: 'pending',
      proposed_by: profileId,
    })
    .select()
    .single();

  if (dbErr) return err(dbErr.message);
  return ok(mapDish(data));
}

// ── Cloud-mediated proposal flow (F-024) ───────────────────────────────

export interface ProposeDishCloudInput {
  name: string;
  cuisine: string;
  category: DishCategory;
}

export interface ProposeDishCloudResult {
  dishId: string;
  status: 'existing' | 'pending';
}

interface ProposeDishCloudClient {
  from(
    table: string,
  ): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          eq(column: string, value: unknown): {
            limit(n: number): {
              maybeSingle(): Promise<{
                data: { id?: unknown; status?: unknown } | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };
    };
    insert(values: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{
          data: { id?: unknown } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message?: string } | null;
    }>;
  };
}

/**
 * Cloud-mediated proposed dish persistence.
 *
 * Does a fuzzy lookup against `bc_dishes` keyed by lowered/trimmed name +
 * cuisine. On hit, returns the existing dish id. On miss, inserts a new
 * row with `moderation_status = 'pending'`, `proposed_by` set to the
 * authenticated profile, and returns the new id.
 *
 * If the caller is unauthenticated, the proposal is rejected so we
 * never leak orphaned anonymous proposals into the public catalog.
 */
export async function proposeDishCloud(
  supabase: ProposeDishCloudClient | null | undefined,
  input: ProposeDishCloudInput,
): Promise<BestChefResult<ProposeDishCloudResult>> {
  const name = input.name.trim();
  const cuisine = input.cuisine.trim();
  if (!name) return err('Dish name is required.');
  if (!cuisine) return err('Cuisine is required.');

  const client = (supabase ?? (getBestChefClient() as unknown as ProposeDishCloudClient));

  // Resolve current user so we can populate `proposed_by`.
  const userResult = await client.auth.getUser();
  if (userResult.error?.message) return err(userResult.error.message);
  const userId = userResult.data?.user?.id ?? null;
  if (!userId) return err('Sign in required to propose a dish.');

  const lookupName = name.toLowerCase();
  const lookupCuisine = cuisine.toLowerCase();
  const slug = slugify(name);

  // Fuzzy match by lowered name+cuisine. Active first.
  const activeMatch = await client
    .from('bc_dishes')
    .select('id, status')
    .eq('name', name)
    .eq('cuisine', cuisine)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!activeMatch.error && activeMatch.data?.id) {
    return ok({ dishId: String(activeMatch.data.id), status: 'existing' });
  }

  const pendingMatch = await client
    .from('bc_dishes')
    .select('id, status')
    .eq('name', name)
    .eq('cuisine', cuisine)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  if (!pendingMatch.error && pendingMatch.data?.id) {
    return ok({ dishId: String(pendingMatch.data.id), status: 'pending' });
  }

  // Fall through: lowered case insensitive lookup via slug.
  const slugMatch = await client
    .from('bc_dishes')
    .select('id, status')
    .eq('slug', slug)
    .eq('cuisine', cuisine)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!slugMatch.error && slugMatch.data?.id) {
    return ok({ dishId: String(slugMatch.data.id), status: 'existing' });
  }

  // Suppress unused vars in noUnused builds.
  void lookupName;
  void lookupCuisine;

  const insertResult = await client
    .from('bc_dishes')
    .insert({
      name,
      slug,
      cuisine,
      category: input.category,
      moderation_status: 'pending',
      status: 'pending',
      proposed_by: userId,
      proposed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insertResult.error?.message) return err(insertResult.error.message);
  if (!insertResult.data?.id) return err('Failed to create proposed dish.');

  return ok({ dishId: String(insertResult.data.id), status: 'pending' });
}

// ── Category Tree ──────────────────────────────────────────────────────

export interface CategoryTreeNode {
  cuisine: string;
  categories: {
    category: string;
    dishes: Dish[];
  }[];
}

export async function getCategoryTree(): Promise<BestChefResult<CategoryTreeNode[]>> {
  const { data, error: dbErr } = await from('bc_dishes')
    .select('*')
    .eq('status', 'active')
    .order('cuisine', { ascending: true })
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (dbErr) return err(dbErr.message);

  const dishes = (data ?? []).map(mapDish);

  const byCuisine = new Map<string, Map<string, Dish[]>>();

  for (const dish of dishes) {
    if (!byCuisine.has(dish.cuisine)) {
      byCuisine.set(dish.cuisine, new Map());
    }
    const categoryMap = byCuisine.get(dish.cuisine)!;
    if (!categoryMap.has(dish.category)) {
      categoryMap.set(dish.category, []);
    }
    categoryMap.get(dish.category)!.push(dish);
  }

  const tree: CategoryTreeNode[] = [];
  for (const [cuisine, categoryMap] of byCuisine) {
    const categories: CategoryTreeNode['categories'] = [];
    for (const [category, categoryDishes] of categoryMap) {
      categories.push({ category, dishes: categoryDishes });
    }
    tree.push({ cuisine, categories });
  }

  return ok(tree);
}
