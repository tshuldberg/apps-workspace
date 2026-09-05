import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initBestChefClient as initClientStatic,
  resetBestChefClient as resetClientStatic,
} from '../client';
import {
  dishDisplayDescription,
  dishDisplayName,
  localizeDish,
  proposeDishCloud,
  searchDishes,
  slugify,
} from '../dish-taxonomy';
import type { Dish, DishCategory } from '../types';
import { DishCategory as DishCategoryEnum } from '../types';

// ── slugify ────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('produces URL-friendly slugs', () => {
    expect(slugify('Pad Thai')).toBe('pad-thai');
    expect(slugify('Tom Yum Goong')).toBe('tom-yum-goong');
    expect(slugify('Cacio e Pepe')).toBe('cacio-e-pepe');
  });

  it('strips diacritics', () => {
    expect(slugify('Creme Brulee')).toBe('creme-brulee');
    expect(slugify('Pho Bo')).toBe('pho-bo');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('Mac   and   Cheese')).toBe('mac-and-cheese');
  });

  it('handles parenthesized content', () => {
    expect(slugify('Sushi (Nigiri)')).toBe('sushi-nigiri');
  });

  // Non-Latin scripts: the ASCII pass reduces these to '', and with
  // bc_dishes_slug_unique the SECOND such dish was a unique violation, so
  // native-language dish creation failed (adversarial review 2026-07-03, N2).
  // The slug must stay meaningful and distinct per script.
  it('keeps CJK names as slugs', () => {
    expect(slugify('寿司')).toBe('寿司');
    expect(slugify('麻婆豆腐')).toBe('麻婆豆腐');
    expect(slugify('ラーメン 味噌')).toBe('ラーメン-味噌');
    expect(slugify('寿司')).not.toBe(slugify('ラーメン'));
  });

  it('keeps Hangul names NFC-composed', () => {
    expect(slugify('김치')).toBe('김치');
    expect(slugify('김치'.normalize('NFD'))).toBe('김치');
  });

  it('keeps Arabic and Hebrew names', () => {
    expect(slugify('كبسة')).toBe('كبسة');
    expect(slugify('שקשוקה')).toBe('שקשוקה');
  });

  it('keeps Thai and Devanagari combining marks intact', () => {
    expect(slugify('ต้มยำกุ้ง')).toBe('ต้มยำกุ้ง');
    expect(slugify('दाल मखनी')).toBe('दाल-मखनी');
  });

  it('prefers the ASCII slug for mixed-script names', () => {
    expect(slugify('寿司 (Sushi)')).toBe('sushi');
  });

  it('keeps the Turkish dotted capital I on the Latin path', () => {
    expect(slugify('İskender Kebap')).toBe('iskender-kebap');
  });

  it('never returns an empty slug (deterministic hash fallback)', () => {
    const emojiSlug = slugify('🍜');
    expect(emojiSlug).toMatch(/^dish-[0-9a-f]{8}$/);
    expect(slugify('🍜')).toBe(emojiSlug);
    expect(slugify('')).toMatch(/^dish-[0-9a-f]{8}$/);
    expect(slugify('🍜')).not.toBe(slugify('🥟'));
  });
});

// ── DishCategory enum ──────────────────────────────────────────────────

describe('DishCategory', () => {
  it('has exactly 11 valid values', () => {
    const values = DishCategoryEnum.options;
    expect(values).toHaveLength(11);
    expect(values).toContain('appetizer');
    expect(values).toContain('soup');
    expect(values).toContain('salad');
    expect(values).toContain('main');
    expect(values).toContain('side');
    expect(values).toContain('dessert');
    expect(values).toContain('bread');
    expect(values).toContain('beverage');
    expect(values).toContain('condiment');
    expect(values).toContain('snack');
    expect(values).toContain('breakfast');
  });

  it('validates correct values', () => {
    expect(DishCategoryEnum.safeParse('main').success).toBe(true);
    expect(DishCategoryEnum.safeParse('dessert').success).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(DishCategoryEnum.safeParse('rice').success).toBe(false);
    expect(DishCategoryEnum.safeParse('noodles').success).toBe(false);
    expect(DishCategoryEnum.safeParse('').success).toBe(false);
  });
});

// ── Supabase-dependent functions (mocked) ──────────────────────────────

describe('dish taxonomy Supabase operations', () => {
  // These tests verify the function signatures and error handling.
  // Supabase calls are mocked since we don't have a live database.

  const mockSupabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it('throws when client is not initialized', async () => {
    // Import fresh to avoid cached module state
    const { getBestChefClient, resetBestChefClient } = await import('../client');
    resetBestChefClient();

    expect(() => getBestChefClient()).toThrow(
      'BestChef client not initialized',
    );
  });

  it('initializes and returns client', async () => {
    const { initBestChefClient, getBestChefClient, resetBestChefClient } =
      await import('../client');

    resetBestChefClient();
    initBestChefClient(mockSupabase as never);

    const client = getBestChefClient();
    expect(client).toBe(mockSupabase);
  });

  it('resets client to null', async () => {
    const { initBestChefClient, getBestChefClient, resetBestChefClient } =
      await import('../client');

    initBestChefClient(mockSupabase as never);
    resetBestChefClient();

    expect(() => getBestChefClient()).toThrow();
  });
});

// ── searchDishes / localization (plan 33 Phase 2.3) ────────────────────

const RPC_DISH_ROW = {
  id: '70000000-0000-0000-0000-000000000401',
  name: 'Carbonara',
  slug: 'carbonara',
  native_name: null,
  category: 'main',
  cuisine: 'italian',
  region: null,
  description: 'Roman pasta',
  photo_url: null,
  gradient_from: null,
  gradient_to: null,
  emoji: null,
  alias_count: 0,
  submission_count: 10,
  status: 'active',
  proposed_by: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

describe('searchDishes (bc_search_dishes RPC)', () => {
  beforeEach(() => {
    resetClientStatic();
  });

  it('calls the parameterized RPC and maps localized fields', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { dish: RPC_DISH_ROW, localized_name: 'Nudeln Carbonara', localized_description: null },
      ],
      error: null,
    });
    initClientStatic({ rpc } as never);

    const result = await searchDishes('nudeln, (weird%query_', { locale: 'de', limit: 10 });

    expect(rpc).toHaveBeenCalledWith('bc_search_dishes', {
      p_query: 'nudeln, (weird%query_',
      p_locale: 'de',
      p_category: null,
      p_cuisine: null,
      p_status: 'active',
      p_limit: 10,
      p_offset: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0].name).toBe('Carbonara');
      expect(result.data[0].localizedName).toBe('Nudeln Carbonara');
      expect(dishDisplayName(result.data[0])).toBe('Nudeln Carbonara');
    }
  });

  it('passes an explicit null status through as unfiltered', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    initClientStatic({ rpc } as never);

    await searchDishes('', { status: null });
    expect(rpc).toHaveBeenCalledWith(
      'bc_search_dishes',
      expect.objectContaining({ p_status: null }),
    );
  });

  it('surfaces RPC errors as err results', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    initClientStatic({ rpc } as never);

    const result = await searchDishes('x');
    expect(result.ok).toBe(false);
  });
});

describe('dishDisplayName / dishDisplayDescription', () => {
  it('prefers the localized fields and falls back to canonical', () => {
    expect(dishDisplayName({ name: 'Carbonara', localizedName: 'Nudeln' })).toBe('Nudeln');
    expect(dishDisplayName({ name: 'Carbonara', localizedName: null })).toBe('Carbonara');
    expect(dishDisplayName({ name: 'Carbonara' })).toBe('Carbonara');
    expect(
      dishDisplayDescription({ description: 'Roman', localizedDescription: 'Roemisch' }),
    ).toBe('Roemisch');
    expect(dishDisplayDescription({ description: 'Roman', localizedDescription: null })).toBe(
      'Roman',
    );
  });
});

describe('localizeDish', () => {
  const baseDish = {
    id: '70000000-0000-0000-0000-000000000401',
    name: 'Carbonara',
    slug: 'carbonara',
    nativeName: null,
    category: 'main',
    cuisine: 'italian',
    region: null,
    description: null,
    photoUrl: null,
    gradientFrom: null,
    gradientTo: null,
    emoji: null,
    aliasCount: 0,
    submissionCount: 10,
    status: 'active',
    proposedBy: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  } as unknown as Dish;

  function clientWithTranslations(rows: Array<Record<string, unknown>>) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    return { from: vi.fn().mockReturnValue(chain) };
  }

  beforeEach(() => {
    resetClientStatic();
  });

  it('prefers the exact locale tag over the base language', async () => {
    initClientStatic(
      clientWithTranslations([
        { locale: 'pt', name: 'Carbonara Base', description: null },
        { locale: 'pt-br', name: 'Carbonara Brasileira', description: null },
      ]) as never,
    );

    const localized = await localizeDish(baseDish, 'pt-BR');
    expect(localized.localizedName).toBe('Carbonara Brasileira');
  });

  it('falls back to the base language for sibling regions', async () => {
    initClientStatic(
      clientWithTranslations([{ locale: 'pt', name: 'Carbonara Base', description: null }]) as never,
    );

    const localized = await localizeDish(baseDish, 'pt-PT');
    expect(localized.localizedName).toBe('Carbonara Base');
  });

  it('returns the dish unchanged without a locale or translations', async () => {
    initClientStatic(clientWithTranslations([]) as never);

    expect((await localizeDish(baseDish, null)).localizedName).toBeUndefined();
    expect((await localizeDish(baseDish, 'de')).localizedName).toBeUndefined();
  });
});

// ── proposeDishCloud (F-024) ───────────────────────────────────────────

interface MockChain {
  data: { id?: string; status?: string } | null;
  error: { message?: string } | null;
}

function buildSelectMock(matches: { name?: string; status?: string; data?: MockChain }[]) {
  // Flexible mock: each call returns the next queued match in order.
  const queue = [...matches];
  return {
    select: vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(() => ({
              maybeSingle: vi.fn().mockImplementation(async () => {
                const next = queue.shift();
                return next?.data ?? { data: null, error: null };
              }),
            })),
          })),
        })),
      })),
    })),
  };
}

function buildInsertMock(insertResult: MockChain) {
  return {
    insert: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        single: vi.fn().mockResolvedValue(insertResult),
      })),
    })),
  };
}

describe('proposeDishCloud', () => {
  it('rejects when name is empty', async () => {
    const result = await proposeDishCloud(null as never, {
      name: '   ',
      cuisine: 'Thai',
      category: 'main' as DishCategory,
    });
    expect(result.ok).toBe(false);
  });

  it('returns the existing dish id on active match', async () => {
    const fromMock = vi.fn().mockReturnValue({
      ...buildSelectMock([
        { data: { data: { id: 'existing-uuid', status: 'active' }, error: null } },
      ]),
    });
    const supabase = {
      from: fromMock,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'profile-1' } },
          error: null,
        }),
      },
    };

    const result = await proposeDishCloud(supabase as never, {
      name: 'Pad Thai',
      cuisine: 'Thai',
      category: 'main' as DishCategory,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dishId).toBe('existing-uuid');
      expect(result.data.status).toBe('existing');
    }
  });

  it('inserts a new pending dish on miss and returns the new id', async () => {
    const noMatch: MockChain = { data: null, error: null };
    let callCount = 0;
    const fromMock = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount <= 3) {
        return buildSelectMock([{ data: noMatch }]);
      }
      return buildInsertMock({ data: { id: 'new-uuid' }, error: null });
    });
    const supabase = {
      from: fromMock,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'profile-2' } },
          error: null,
        }),
      },
    };

    const result = await proposeDishCloud(supabase as never, {
      name: 'Khachapuri',
      cuisine: 'Georgian',
      category: 'main' as DishCategory,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dishId).toBe('new-uuid');
      expect(result.data.status).toBe('pending');
    }
  });

  it('refuses unauthenticated proposals', async () => {
    const supabase = {
      from: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    const result = await proposeDishCloud(supabase as never, {
      name: 'Pupusas',
      cuisine: 'Salvadoran',
      category: 'main' as DishCategory,
    });
    expect(result.ok).toBe(false);
  });
});

// ── VoteTier / VOTE_TIER_WEIGHTS ───────────────────────────────────────

describe('VoteTier and weights', () => {
  it('has correct tier values', async () => {
    const { VoteTier } = await import('../types');

    expect(VoteTier.NOT_FOR_ME).toBe('like');
    expect(VoteTier.ID_EAT_THAT).toBe('bronze');
    expect(VoteTier.AS_GOOD_AS_MOMMAS).toBe('silver');
    expect(VoteTier.BEST_CHEF).toBe('gold');
    expect(VoteTier.TAP_UP).toBe('tap_up');
    expect(VoteTier.TAP_DOWN).toBe('tap_down');
  });

  it('maps tier values to expected weights', async () => {
    const { VoteTier, VOTE_TIER_WEIGHTS } = await import('../types');

    expect(VOTE_TIER_WEIGHTS[VoteTier.NOT_FOR_ME]).toBe(0);
    expect(VOTE_TIER_WEIGHTS[VoteTier.ID_EAT_THAT]).toBe(1);
    expect(VOTE_TIER_WEIGHTS[VoteTier.AS_GOOD_AS_MOMMAS]).toBe(3);
    expect(VOTE_TIER_WEIGHTS[VoteTier.BEST_CHEF]).toBe(5);
    expect(VOTE_TIER_WEIGHTS[VoteTier.TAP_UP]).toBe(1);
    expect(VOTE_TIER_WEIGHTS[VoteTier.TAP_DOWN]).toBe(-1);
  });
});
