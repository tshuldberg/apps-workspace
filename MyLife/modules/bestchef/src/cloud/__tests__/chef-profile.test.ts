import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aggregateCuisineBreakdown,
  findTopCuisine,
  computeAvgScore,
  checkHandleAvailability,
  searchChefs,
  HANDLE_COOLDOWN_DAYS,
} from '../chef-profile';
import {
  initBestChefClient as initClientStatic,
  resetBestChefClient as resetClientStatic,
} from '../client';

// ── aggregateCuisineBreakdown ────────────────────────────────────────

describe('aggregateCuisineBreakdown', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateCuisineBreakdown([])).toEqual([]);
  });

  it('counts submissions per cuisine', () => {
    const result = aggregateCuisineBreakdown([
      { cuisine: 'italian', voteScore: 0.5 },
      { cuisine: 'italian', voteScore: 0.8 },
      { cuisine: 'thai', voteScore: 0.6 },
    ]);

    expect(result).toHaveLength(2);
    const italian = result.find((r) => r.cuisine === 'italian');
    const thai = result.find((r) => r.cuisine === 'thai');
    expect(italian?.count).toBe(2);
    expect(thai?.count).toBe(1);
  });

  it('computes average score per cuisine', () => {
    const result = aggregateCuisineBreakdown([
      { cuisine: 'italian', voteScore: 0.4 },
      { cuisine: 'italian', voteScore: 0.8 },
    ]);

    const italian = result.find((r) => r.cuisine === 'italian');
    expect(italian?.avgScore).toBeCloseTo(0.6, 5);
  });

  it('sorts by count descending', () => {
    const result = aggregateCuisineBreakdown([
      { cuisine: 'thai', voteScore: 0.5 },
      { cuisine: 'italian', voteScore: 0.5 },
      { cuisine: 'italian', voteScore: 0.5 },
      { cuisine: 'italian', voteScore: 0.5 },
      { cuisine: 'thai', voteScore: 0.5 },
      { cuisine: 'mexican', voteScore: 0.5 },
    ]);

    expect(result[0].cuisine).toBe('italian');
    expect(result[0].count).toBe(3);
    expect(result[1].cuisine).toBe('thai');
    expect(result[1].count).toBe(2);
    expect(result[2].cuisine).toBe('mexican');
    expect(result[2].count).toBe(1);
  });

  it('handles single entry', () => {
    const result = aggregateCuisineBreakdown([
      { cuisine: 'japanese', voteScore: 0.9 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      cuisine: 'japanese',
      count: 1,
      avgScore: 0.9,
    });
  });

  it('handles zero vote scores', () => {
    const result = aggregateCuisineBreakdown([
      { cuisine: 'french', voteScore: 0 },
      { cuisine: 'french', voteScore: 0 },
    ]);

    expect(result[0].avgScore).toBe(0);
    expect(result[0].count).toBe(2);
  });
});

// ── findTopCuisine ───────────────────────────────────────────────────

describe('findTopCuisine', () => {
  it('returns null for empty breakdown', () => {
    expect(findTopCuisine([])).toBeNull();
  });

  it('returns the cuisine with the highest count', () => {
    expect(
      findTopCuisine([
        { cuisine: 'italian', count: 5, avgScore: 0.6 },
        { cuisine: 'thai', count: 3, avgScore: 0.8 },
      ]),
    ).toBe('italian');
  });

  it('returns the first cuisine when counts are equal', () => {
    const result = findTopCuisine([
      { cuisine: 'italian', count: 3, avgScore: 0.6 },
      { cuisine: 'thai', count: 3, avgScore: 0.8 },
    ]);
    // First in the array wins
    expect(result).toBe('italian');
  });
});

// ── computeAvgScore ──────────────────────────────────────────────────

describe('computeAvgScore', () => {
  it('returns 0 for empty array', () => {
    expect(computeAvgScore([])).toBe(0);
  });

  it('computes average of a single score', () => {
    expect(computeAvgScore([0.75])).toBe(0.75);
  });

  it('computes average of multiple scores', () => {
    expect(computeAvgScore([0.2, 0.4, 0.6])).toBeCloseTo(0.4, 5);
  });

  it('handles all zeros', () => {
    expect(computeAvgScore([0, 0, 0])).toBe(0);
  });

  it('handles all ones', () => {
    expect(computeAvgScore([1, 1, 1])).toBe(1);
  });

  it('handles large arrays', () => {
    const scores = Array(1000).fill(0.5);
    expect(computeAvgScore(scores)).toBeCloseTo(0.5, 5);
  });
});

// ── checkHandleAvailability ──────────────────────────────────────────

interface FakeRows {
  social: Array<{ id: string; handle: string }>;
  history: Array<{ handle: string; released_at: string }>;
}

function fakeSupabase(rows: FakeRows): SupabaseClient {
  return {
    from(table: string) {
      if (table === 'social_profiles') {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn((_col: string, pattern: string) => ({
              limit: vi.fn(async () => ({
                data: rows.social.filter(
                  (r) => r.handle.toLowerCase() === pattern.toLowerCase(),
                ),
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === 'bc_handle_history') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, handle: string) => ({
              gte: vi.fn((_col2: string, cutoff: string) => ({
                limit: vi.fn(async () => ({
                  data: rows.history.filter(
                    (h) =>
                      h.handle.toLowerCase() === handle.toLowerCase() &&
                      h.released_at >= cutoff,
                  ),
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe('checkHandleAvailability', () => {
  it('returns invalid for handles that fail the regex', async () => {
    const sb = fakeSupabase({ social: [], history: [] });
    expect((await checkHandleAvailability(sb, { handle: 'a' })).ok).toBe(true);
    const tooShort = await checkHandleAvailability(sb, { handle: 'a' });
    expect(tooShort).toEqual({ ok: true, data: 'invalid' });

    const tooLong = await checkHandleAvailability(sb, { handle: 'x'.repeat(31) });
    expect(tooLong).toEqual({ ok: true, data: 'invalid' });

    const badChars = await checkHandleAvailability(sb, { handle: 'no spaces' });
    expect(badChars).toEqual({ ok: true, data: 'invalid' });

    const dash = await checkHandleAvailability(sb, { handle: 'has-dash' });
    expect(dash).toEqual({ ok: true, data: 'invalid' });
  });

  it('returns available when no conflict and no cooldown row', async () => {
    const sb = fakeSupabase({ social: [], history: [] });
    const result = await checkHandleAvailability(sb, { handle: 'fresh_chef' });
    expect(result).toEqual({ ok: true, data: 'available' });
  });

  it('returns taken when another profile owns the handle', async () => {
    const sb = fakeSupabase({
      social: [{ id: 'other', handle: 'taken_one' }],
      history: [],
    });
    const result = await checkHandleAvailability(sb, { handle: 'TAKEN_ONE' });
    expect(result).toEqual({ ok: true, data: 'taken' });
  });

  it('treats the same handle on the current profile as available (no self-conflict)', async () => {
    const sb = fakeSupabase({
      social: [{ id: 'me', handle: 'my_handle' }],
      history: [],
    });
    const result = await checkHandleAvailability(sb, {
      handle: 'my_handle',
      currentProfileId: 'me',
    });
    expect(result).toEqual({ ok: true, data: 'available' });
  });

  it('returns cooldown when handle was released within the cooldown window', async () => {
    const recent = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const sb = fakeSupabase({
      social: [],
      history: [{ handle: 'just_left', released_at: recent }],
    });
    const result = await checkHandleAvailability(sb, { handle: 'just_left' });
    expect(result).toEqual({ ok: true, data: 'cooldown' });
  });

  it('does not flag handles released before the cooldown window', async () => {
    const old = new Date(
      Date.now() - (HANDLE_COOLDOWN_DAYS + 5) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const sb = fakeSupabase({
      social: [],
      history: [{ handle: 'long_gone', released_at: old }],
    });
    const result = await checkHandleAvailability(sb, { handle: 'long_gone' });
    expect(result).toEqual({ ok: true, data: 'available' });
  });
});

// ── searchChefs (bc_search_chefs RPC) ───────────────────────────────────

describe('searchChefs (bc_search_chefs RPC)', () => {
  beforeEach(() => {
    resetClientStatic();
  });

  it('calls the parameterized RPC instead of building a raw .or(ilike) filter', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    initClientStatic({ rpc } as never);

    await searchChefs('some chef', { cuisine: 'thai', limit: 5 });

    expect(rpc).toHaveBeenCalledWith('bc_search_chefs', {
      p_query: 'some chef',
      p_cuisine: 'thai',
      p_limit: 5,
    });
  });

  it('passes filter-injection-shaped input through as a plain parameter, not string-interpolated', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    initClientStatic({ rpc } as never);

    // A raw `.or()` filter built from this input would have broken out of
    // the ilike clause or added attacker-controlled filter terms. The RPC
    // must receive it untouched as a bind parameter.
    const maliciousInput = 'x),display_name.ilike.%,handle.ilike.%(';
    const result = await searchChefs(maliciousInput);

    expect(rpc).toHaveBeenCalledWith('bc_search_chefs', {
      p_query: maliciousInput,
      p_cuisine: null,
      p_limit: 20,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('returns an empty array without fetching profiles when the RPC finds no matches', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn();
    initClientStatic({ rpc, from } as never);

    const result = await searchChefs('nobody');
    expect(result).toEqual({ ok: true, data: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors as err results', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    initClientStatic({ rpc } as never);

    const result = await searchChefs('x');
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});
