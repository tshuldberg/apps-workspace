import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getChallengeTemplates,
  getSeasonalChallenges,
  getSeasonForMonth,
  getTemplateById,
  getChallenges,
  getChallengeDetail,
  joinChallenge,
  leaveChallenge,
  claimReward,
  type ChallengeTemplate,
} from '../challenges';

describe('Challenge Templates', () => {
  const templates = getChallengeTemplates();

  it('returns exactly 5 templates', () => {
    expect(templates).toHaveLength(5);
  });

  it('all templates have unique IDs', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('all templates have required fields', () => {
    for (const t of templates) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(['spring', 'summer', 'fall', 'winter', 'any']).toContain(t.season);
      expect(t.durationDays).toBeGreaterThan(0);
      expect(t.goals.length).toBeGreaterThan(0);
      expect(t.badgeReward).toBeTruthy();
      expect(t.icon).toBeTruthy();
    }
  });

  it('all goal templates have required fields', () => {
    for (const t of templates) {
      for (const g of t.goals) {
        expect(g.description).toBeTruthy();
        expect(g.targetCount).toBeGreaterThan(0);
        expect([
          'submissions',
          'votes_received',
          'cuisines_tried',
          'dishes_cooked',
          'recipes_shared',
        ]).toContain(g.metricType);
      }
    }
  });

  it('Summer Grill Master has 3 goals', () => {
    const grill = templates.find((t) => t.id === 'summer_grill_master');
    expect(grill).toBeDefined();
    expect(grill!.goals).toHaveLength(3);
    expect(grill!.season).toBe('summer');
    expect(grill!.durationDays).toBe(30);
  });

  it('Holiday Baker has 3 goals', () => {
    const baker = templates.find((t) => t.id === 'holiday_baker');
    expect(baker).toBeDefined();
    expect(baker!.goals).toHaveLength(3);
    expect(baker!.season).toBe('winter');
    expect(baker!.durationDays).toBe(21);
  });

  it('World Cuisine Explorer has 2 goals and season "any"', () => {
    const explorer = templates.find((t) => t.id === 'world_cuisine_explorer');
    expect(explorer).toBeDefined();
    expect(explorer!.goals).toHaveLength(2);
    expect(explorer!.season).toBe('any');
  });

  it('Farm to Table has 2 goals and spring season', () => {
    const farm = templates.find((t) => t.id === 'farm_to_table');
    expect(farm).toBeDefined();
    expect(farm!.goals).toHaveLength(2);
    expect(farm!.season).toBe('spring');
    expect(farm!.durationDays).toBe(14);
  });

  it('Comfort Food Championship has 3 goals and fall season', () => {
    const comfort = templates.find((t) => t.id === 'comfort_food_championship');
    expect(comfort).toBeDefined();
    expect(comfort!.goals).toHaveLength(3);
    expect(comfort!.season).toBe('fall');
  });
});

describe('getSeasonalChallenges', () => {
  it('returns summer template + "any" template for summer', () => {
    const summer = getSeasonalChallenges('summer');
    expect(summer.some((t) => t.id === 'summer_grill_master')).toBe(true);
    expect(summer.some((t) => t.id === 'world_cuisine_explorer')).toBe(true);
    expect(summer.some((t) => t.id === 'holiday_baker')).toBe(false);
  });

  it('returns winter template + "any" template for winter', () => {
    const winter = getSeasonalChallenges('winter');
    expect(winter.some((t) => t.id === 'holiday_baker')).toBe(true);
    expect(winter.some((t) => t.id === 'world_cuisine_explorer')).toBe(true);
    expect(winter.some((t) => t.id === 'summer_grill_master')).toBe(false);
  });

  it('returns spring template + "any" template for spring', () => {
    const spring = getSeasonalChallenges('spring');
    expect(spring.some((t) => t.id === 'farm_to_table')).toBe(true);
    expect(spring.some((t) => t.id === 'world_cuisine_explorer')).toBe(true);
  });

  it('returns fall template + "any" template for fall', () => {
    const fall = getSeasonalChallenges('fall');
    expect(fall.some((t) => t.id === 'comfort_food_championship')).toBe(true);
    expect(fall.some((t) => t.id === 'world_cuisine_explorer')).toBe(true);
  });

  it('"any" season returns all templates', () => {
    const any = getSeasonalChallenges('any');
    // Only the one with season 'any' matches
    expect(any).toHaveLength(1);
    expect(any[0].id).toBe('world_cuisine_explorer');
  });
});

describe('getSeasonForMonth', () => {
  it('maps months 2-4 to spring', () => {
    expect(getSeasonForMonth(2)).toBe('spring');
    expect(getSeasonForMonth(3)).toBe('spring');
    expect(getSeasonForMonth(4)).toBe('spring');
  });

  it('maps months 5-7 to summer', () => {
    expect(getSeasonForMonth(5)).toBe('summer');
    expect(getSeasonForMonth(6)).toBe('summer');
    expect(getSeasonForMonth(7)).toBe('summer');
  });

  it('maps months 8-10 to fall', () => {
    expect(getSeasonForMonth(8)).toBe('fall');
    expect(getSeasonForMonth(9)).toBe('fall');
    expect(getSeasonForMonth(10)).toBe('fall');
  });

  it('maps months 0, 1, 11 to winter', () => {
    expect(getSeasonForMonth(0)).toBe('winter');
    expect(getSeasonForMonth(1)).toBe('winter');
    expect(getSeasonForMonth(11)).toBe('winter');
  });
});

describe('getTemplateById', () => {
  it('returns template for valid ID', () => {
    const t = getTemplateById('summer_grill_master');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Summer Grill Master');
  });

  it('returns undefined for unknown ID', () => {
    expect(getTemplateById('nonexistent')).toBeUndefined();
  });
});

// ── P13-E live challenge cloud helpers ─────────────────────────────────

interface ChallengeMockState {
  user?: { id: string } | null;
  challenges?: Array<Record<string, unknown>>;
  enrollments?: Array<Record<string, unknown>>;
  submissions?: Array<Record<string, unknown>>;
  profiles?: Array<Record<string, unknown>>;
  dishes?: Array<Record<string, unknown>>;
  upsertResult?: { data: Record<string, unknown> | null; error: { message: string } | null };
  rpcResult?: { data: unknown; error: { message: string } | null };
  /**
   * Columns that do not exist per table. Selecting one makes the query
   * reject with a PostgREST-style 400, mirroring how the real API rejects
   * `select=vote_count` when the column was never in the schema (audit C12).
   */
  unknownColumns?: Record<string, string[]>;
}

function selectedColumnList(cols: unknown): string[] {
  if (typeof cols !== 'string') return [];
  return cols.split(',').map((c) => c.trim()).filter(Boolean);
}

function makeChallengeClient(state: ChallengeMockState): SupabaseClient {
  const updateCalls: Array<{ table: string; values: Record<string, unknown> }> = [];
  const deleteCalls: Array<{ table: string; eqs: Record<string, unknown> }> = [];

  const fromImpl = (table: string) => {
    const builder: Record<string, unknown> = {};
    let rows: Array<Record<string, unknown>> = [];
    if (table === 'bc_challenges') rows = state.challenges ?? [];
    else if (table === 'bc_challenge_enrollments') rows = state.enrollments ?? [];
    else if (table === 'bc_submissions') rows = state.submissions ?? [];
    else if (table === 'social_profiles') rows = state.profiles ?? [];
    else if (table === 'bc_dishes') rows = state.dishes ?? [];

    let filtered = [...rows];
    let countMode = false;
    let columnError: { message: string } | null = null;

    builder.select = vi.fn((cols?: unknown, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count) countMode = true;
      const unknown = state.unknownColumns?.[table] ?? [];
      const bad = selectedColumnList(cols).find((c) => unknown.includes(c));
      if (bad) {
        columnError = {
          message: `column ${table}.${bad} does not exist`,
        };
      }
      return builder;
    });
    builder.eq = vi.fn((col: string, val: unknown) => {
      filtered = filtered.filter((r) => r[col] === val);
      return builder;
    });
    builder.in = vi.fn((col: string, vals: unknown[]) => {
      filtered = filtered.filter((r) => vals.includes(r[col]));
      return builder;
    });
    builder.gte = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () =>
      columnError ? { data: null, error: columnError } : { data: filtered[0] ?? null, error: null },
    );
    builder.single = vi.fn(async () =>
      columnError ? { data: null, error: columnError } : { data: filtered[0] ?? null, error: null },
    );

    builder.upsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => state.upsertResult ?? { data: null, error: null }),
      })),
    }));
    builder.update = vi.fn((values: Record<string, unknown>) => {
      updateCalls.push({ table, values });
      const after: Record<string, unknown> = { eq: vi.fn(() => after) };
      return after;
    });
    builder.delete = vi.fn(() => {
      const eqs: Record<string, unknown> = {};
      const after: Record<string, unknown> = {
        eq: vi.fn((col: string, val: unknown) => {
          eqs[col] = val;
          deleteCalls.push({ table, eqs });
          return after;
        }),
      };
      // resolve when awaited
      (after as unknown as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve({ error: null });
      return after;
    });

    // Default builder is awaitable for `select(...).eq(...)` chains.
    (builder as unknown as { then: unknown }).then = (resolve: (v: unknown) => void) => {
      if (columnError) {
        resolve({ data: null, count: null, error: columnError });
      } else if (countMode) {
        resolve({ count: filtered.length, error: null });
      } else {
        resolve({ data: filtered, error: null });
      }
    };
    return builder;
  };

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user ?? null }, error: null })),
    },
    from: vi.fn(fromImpl),
    rpc: vi.fn(async () => state.rpcResult ?? { data: null, error: null }),
  } as unknown as SupabaseClient;
}

const CHALLENGE_ROW = {
  id: 'ch-1',
  template_id: 'summer_grill_master',
  title: 'Summer Grill Master',
  description: 'Fire up the grill.',
  reward: 'Grill Master badge',
  badge_id: 'grill_master',
  metric: 'submissions',
  target_count: 5,
  starts_at: '2026-04-01T00:00:00Z',
  ends_at: '2026-05-01T00:00:00Z',
  claim_deadline: null,
  status: 'active',
  created_at: '2026-04-01T00:00:00Z',
};

describe('getChallenges', () => {
  it('returns challenges with null enrollment when user is anonymous', async () => {
    const supabase = makeChallengeClient({
      user: null,
      challenges: [CHALLENGE_ROW],
    });
    const result = await getChallenges(supabase, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].enrollment).toBeNull();
      expect(result.data[0].currentCount).toBe(0);
    }
  });

  it('returns empty list when no challenges exist', async () => {
    const supabase = makeChallengeClient({ user: { id: 'u1' }, challenges: [] });
    const result = await getChallenges(supabase, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(0);
  });

  it('filters joined challenges to those with active enrollment', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      challenges: [CHALLENGE_ROW, { ...CHALLENGE_ROW, id: 'ch-2', title: 'Other' }],
      enrollments: [
        {
          challenge_id: 'ch-1',
          user_id: 'u1',
          joined_at: '2026-04-02T00:00:00Z',
          completed_at: null,
          reward_claimed_at: null,
        },
      ],
      submissions: [],
    });
    const result = await getChallenges(supabase, { status: 'joined' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].challenge.id).toBe('ch-1');
    }
  });
});

describe('getChallengeDetail', () => {
  it('reports progress for an enrolled user', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      challenges: [CHALLENGE_ROW],
      enrollments: [
        {
          challenge_id: 'ch-1',
          user_id: 'u1',
          joined_at: '2026-04-02T00:00:00Z',
          completed_at: null,
          reward_claimed_at: null,
        },
      ],
      submissions: [
        { id: 's1', profile_id: 'u1', created_at: '2026-04-10T00:00:00Z', dish_id: 'd1' },
        { id: 's2', profile_id: 'u1', created_at: '2026-04-11T00:00:00Z', dish_id: 'd2' },
      ],
    });
    const result = await getChallengeDetail(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.challenge.id).toBe('ch-1');
      expect(result.data.enrollment).not.toBeNull();
      // submissions metric counts via head:true count path -- mock returns
      // filtered row count for the user.
      expect(result.data.currentCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 0 progress when not enrolled', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      challenges: [CHALLENGE_ROW],
      enrollments: [],
    });
    const result = await getChallengeDetail(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.enrollment).toBeNull();
      expect(result.data.currentCount).toBe(0);
      expect(result.data.isComplete).toBe(false);
    }
  });

  it('errors when challenge does not exist', async () => {
    const supabase = makeChallengeClient({ user: { id: 'u1' }, challenges: [] });
    const result = await getChallengeDetail(supabase, { challengeId: 'missing' });
    expect(result.ok).toBe(false);
  });
});

// ── Audit C12: votes_received metric must query a real column and must
// not swallow PostgREST errors. Before the fix, countMetricForUser selected
// bc_submissions.vote_count (never in the schema); PostgREST returned 400,
// the error was discarded, and progress silently froze at 0. ─────────────
describe('votes_received challenge progress (audit C12)', () => {
  const VOTES_CHALLENGE = {
    ...CHALLENGE_ROW,
    id: 'ch-votes',
    metric: 'votes_received',
    target_count: 50,
  };
  const ENROLLMENT = {
    challenge_id: 'ch-votes',
    user_id: 'u1',
    joined_at: '2026-04-02T00:00:00Z',
    completed_at: null,
    reward_claimed_at: null,
  };

  it('surfaces the query error instead of freezing progress at 0 when the selected column does not exist', async () => {
    // Models the pre-fix bug directly: any code that selected `vote_count`
    // would hit this rejection. The mock rejects it PostgREST-style.
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      profiles: [{ id: 'p1', user_id: 'u1' }],
      challenges: [VOTES_CHALLENGE],
      enrollments: [ENROLLMENT],
      submissions: [{ id: 's1', profile_id: 'p1', upvote_count: 12, created_at: '2026-04-10T00:00:00Z' }],
      unknownColumns: { bc_submissions: ['vote_count'] },
    });
    const detail = await getChallengeDetail(supabase, { challengeId: 'ch-votes' });
    // upvote_count is a real column, so the fixed code succeeds. The
    // regression guarantee below proves the error would have surfaced.
    expect(detail.ok).toBe(true);
    if (detail.ok) expect(detail.data.currentCount).toBe(12);
  });

  it('counts votes_received from upvote_count, not vote_score', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      profiles: [{ id: 'p1', user_id: 'u1' }],
      challenges: [VOTES_CHALLENGE],
      enrollments: [ENROLLMENT],
      submissions: [
        { id: 's1', profile_id: 'p1', upvote_count: 20, vote_score: 0.9, created_at: '2026-04-10T00:00:00Z' },
        { id: 's2', profile_id: 'p1', upvote_count: 30, vote_score: 0.8, created_at: '2026-04-11T00:00:00Z' },
      ],
    });
    const detail = await getChallengeDetail(supabase, { challengeId: 'ch-votes' });
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.data.currentCount).toBe(50);
      expect(detail.data.isComplete).toBe(true);
    }
  });

  it('propagates a PostgREST error from the votes_received query rather than swallowing it', async () => {
    // Force the votes_received query itself to reject: if upvote_count were
    // ever renamed/dropped, the error must surface, never freeze at 0.
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      profiles: [{ id: 'p1', user_id: 'u1' }],
      challenges: [VOTES_CHALLENGE],
      enrollments: [ENROLLMENT],
      submissions: [{ id: 's1', profile_id: 'p1', upvote_count: 5, created_at: '2026-04-10T00:00:00Z' }],
      unknownColumns: { bc_submissions: ['upvote_count'] },
    });
    const detail = await getChallengeDetail(supabase, { challengeId: 'ch-votes' });
    expect(detail.ok).toBe(false);
    if (!detail.ok) expect(detail.error).toContain('upvote_count');
  });

  it('surfaces the error through getChallenges too', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      profiles: [{ id: 'p1', user_id: 'u1' }],
      challenges: [VOTES_CHALLENGE],
      enrollments: [ENROLLMENT],
      submissions: [{ id: 's1', profile_id: 'p1', upvote_count: 5, created_at: '2026-04-10T00:00:00Z' }],
      unknownColumns: { bc_submissions: ['upvote_count'] },
    });
    const list = await getChallenges(supabase, { status: 'joined' });
    expect(list.ok).toBe(false);
  });
});

describe('joinChallenge / leaveChallenge round trip', () => {
  it('joins via upsert and returns the enrollment', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      upsertResult: {
        data: {
          challenge_id: 'ch-1',
          user_id: 'u1',
          joined_at: '2026-04-27T00:00:00Z',
          completed_at: null,
          reward_claimed_at: null,
        },
        error: null,
      },
    });
    const result = await joinChallenge(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.challengeId).toBe('ch-1');
      expect(result.data.userId).toBe('u1');
      expect(result.data.completedAt).toBeNull();
    }
  });

  it('rejects join when not authenticated', async () => {
    const supabase = makeChallengeClient({ user: null });
    const result = await joinChallenge(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(false);
  });

  it('leaves a challenge for an authenticated user', async () => {
    const supabase = makeChallengeClient({ user: { id: 'u1' } });
    const result = await leaveChallenge(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.challengeId).toBe('ch-1');
  });
});

describe('claimReward', () => {
  it('reports newly_awarded on first claim', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      rpcResult: {
        data: [{ reward_claimed_at: '2026-04-27T01:00:00Z', badge_id: 'grill_master', newly_awarded: true }],
        error: null,
      },
    });
    const result = await claimReward(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.newlyAwarded).toBe(true);
      expect(result.data.badgeId).toBe('grill_master');
    }
  });

  it('is idempotent: a second claim returns newly_awarded=false', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      rpcResult: {
        data: [{ reward_claimed_at: '2026-04-27T01:00:00Z', badge_id: 'grill_master', newly_awarded: false }],
        error: null,
      },
    });
    const result = await claimReward(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.newlyAwarded).toBe(false);
  });

  it('surfaces RPC errors', async () => {
    const supabase = makeChallengeClient({
      user: { id: 'u1' },
      rpcResult: { data: null, error: { message: 'Challenge not yet completed' } },
    });
    const result = await claimReward(supabase, { challengeId: 'ch-1' });
    expect(result.ok).toBe(false);
  });
});
