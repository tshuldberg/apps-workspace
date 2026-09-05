/**
 * Cloud dish catalog (F-045 / F-047).
 *
 * Public surfaces read the dish catalog from `bc_dishes` and only fall back
 * to DEMO_DISHES when the demo render policy allows it (internal builds).
 * Cloud results are cached briefly so dishes, discover, and the submit
 * picker share one fetch.
 */

import {
  dishDisplayName,
  getDishById,
  getDishVisuals,
  localizeDish,
  searchDishes,
  type CloudDish,
} from '@mylife/bestchef';
import { DEMO_DISHES, type DemoDish } from './demo';
import { shouldShowDemoContent } from './public-render-policy';

export type CatalogSource = 'cloud' | 'demo' | 'none';

export interface CatalogDish extends DemoDish {
  /** Present for cloud dishes; used for "newest" sorting. */
  createdAtMs?: number;
}

export interface DishCatalogResult {
  dishes: CatalogDish[];
  source: CatalogSource;
  /** True when the cloud fetch failed (network/config), as opposed to a
   * genuinely empty catalog. Screens must show an error+retry state, not an
   * empty state (N9). */
  error?: boolean;
}

const CATALOG_TTL_MS = 5 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let catalogCache: {
  dishes: CatalogDish[];
  loadedAt: number;
  /** Locale the entry was fetched under; reads require an exact match so a
   * language change can never serve wrong-language names (review finding). */
  locale: string | null;
} | null = null;

/**
 * App language for dish localization (plan 33 Phase 2.3). Set by the
 * I18nProvider; 'en' maps to null because bc_dishes canonical rows ARE the
 * English surface. Changing language busts the catalog cache so localized
 * names refresh everywhere.
 */
let catalogLocale: string | null = null;

export function setDishCatalogLocale(language: string | null): void {
  const next = language && language !== 'en' ? language.toLowerCase() : null;
  if (next !== catalogLocale) {
    catalogLocale = next;
    catalogCache = null;
  }
}

export function getDishCatalogLocale(): string | null {
  return catalogLocale;
}

export function mapCloudDish(dish: CloudDish): CatalogDish {
  // Native + localized names extend emoji keyword matching beyond English
  // (plan 33 Phase 2.6).
  const visuals = getDishVisuals(dish.name, dish.cuisine, [
    dish.nativeName,
    dish.localizedName,
  ]);
  return {
    id: dish.id,
    name: dishDisplayName(dish),
    cuisine: dish.cuisine,
    category: dish.category,
    nativeName: dish.nativeName ?? undefined,
    photoUrl: dish.photoUrl ?? undefined,
    gradientFrom: dish.gradientFrom ?? visuals.from,
    gradientTo: dish.gradientTo ?? visuals.to,
    emoji: dish.emoji ?? visuals.emoji,
    submissionCount: dish.submissionCount,
    slug: dish.slug,
    tags: [],
    createdAtMs: dish.createdAt.getTime(),
  };
}

function demoFallback(): DishCatalogResult {
  if (shouldShowDemoContent()) {
    return { dishes: DEMO_DISHES, source: 'demo' };
  }
  return { dishes: [], source: 'none' };
}

export function resetDishCatalogCache(): void {
  catalogCache = null;
}

/** Active cloud dish catalog ordered by submission count, demo-gated fallback. */
export async function loadDishCatalog(
  opts: { limit?: number; force?: boolean } = {},
): Promise<DishCatalogResult> {
  const limit = opts.limit ?? 200;
  if (
    !opts.force &&
    catalogCache &&
    catalogCache.locale === catalogLocale &&
    Date.now() - catalogCache.loadedAt < CATALOG_TTL_MS
  ) {
    return { dishes: catalogCache.dishes, source: 'cloud' };
  }
  // Capture the locale BEFORE awaiting: if the language changes mid-flight,
  // this response must not be cached (it would pin wrong-language names for
  // the full TTL).
  const requestLocale = catalogLocale;
  try {
    const result = await searchDishes('', { status: 'active', limit, locale: requestLocale });
    if (result.ok && result.data.length > 0) {
      const dishes = result.data.map(mapCloudDish);
      if (requestLocale === catalogLocale) {
        catalogCache = { dishes, loadedAt: Date.now(), locale: requestLocale };
      }
      return { dishes, source: 'cloud' };
    }
    if (result.ok) {
      // Cloud answered with a genuinely empty catalog: an empty state is honest.
      return demoFallback();
    }
    return { ...demoFallback(), error: true };
  } catch {
    // Cloud not configured or unreachable: this is an ERROR, not emptiness (N9).
    return { ...demoFallback(), error: true };
  }
}

/** Top dishes for trending rows; cloud order is already submission_count desc. */
export async function loadTrendingDishes(limit = 8): Promise<DishCatalogResult> {
  const result = await loadDishCatalog();
  return { ...result, dishes: result.dishes.slice(0, limit) };
}

/** Resolve one dish by id or slug: catalog cache, then cloud, then demo policy. */
export async function loadDishRecord(
  idOrSlug: string,
): Promise<{ dish: CatalogDish | null; source: CatalogSource }> {
  const catalog = await loadDishCatalog();
  const fromCatalog =
    catalog.dishes.find((d) => d.id === idOrSlug || d.slug === idOrSlug) ?? null;
  if (fromCatalog) return { dish: fromCatalog, source: catalog.source };

  if (UUID_PATTERN.test(idOrSlug)) {
    try {
      const result = await getDishById(idOrSlug);
      if (result.ok && result.data?.dish) {
        const localized = await localizeDish(result.data.dish, catalogLocale);
        return { dish: mapCloudDish(localized), source: 'cloud' };
      }
    } catch {
      // fall through
    }
  }

  if (shouldShowDemoContent()) {
    const demo = DEMO_DISHES.find((d) => d.id === idOrSlug || d.slug === idOrSlug) ?? null;
    return { dish: demo, source: demo ? 'demo' : 'none' };
  }
  return { dish: null, source: 'none' };
}
