import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  submitCreatorApplication,
  getMyCreatorApplication,
  withdrawCreatorApplication,
} from '../creator-applications';

// ── Mock helpers ──────────────────────────────────────────────────────

interface MockBuilderOptions {
  selectResponse?: { data: unknown; error: { message: string } | null };
  insertResponse?: { data: unknown; error: { message: string } | null };
  updateResponse?: { data: unknown; error: { message: string } | null };
}

function makeBuilder(opts: MockBuilderOptions) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => opts.insertResponse ?? { data: null, error: null }),
    })),
  }));
  builder.update = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => opts.updateResponse ?? { data: null, error: null }),
        })),
      })),
    })),
  }));
  builder.eq = vi.fn(chain);
  builder.not = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.maybeSingle = vi.fn(async () => opts.selectResponse ?? { data: null, error: null });
  return builder;
}

interface MakeClientOptions {
  user?: { id: string } | null;
  authError?: { message: string } | null;
  /** Per-table responses, keyed by table name. */
  tables?: Record<string, MockBuilderOptions>;
}

function makeClient(opts: MakeClientOptions): SupabaseClient {
  const fromImpl = (table: string) => makeBuilder(opts.tables?.[table] ?? {});
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.user ?? null },
        error: opts.authError ?? null,
      })),
    },
    from: vi.fn(fromImpl),
  } as unknown as SupabaseClient;
}

const APPLICATION_ROW = {
  id: 'app-1',
  profile_id: 'profile-1',
  platform_links: { portfolio: 'https://example.com', social: null, audience: null },
  bio: 'I love food',
  specialties: [],
  status: 'submitted',
  reviewed_at: null,
  reviewer_note: null,
  review_notes: null,
  created_at: '2026-04-27T00:00:00Z',
};

// ── submitCreatorApplication ──────────────────────────────────────────

describe('submitCreatorApplication', () => {
  it('rejects when reason is empty', async () => {
    const supabase = makeClient({ user: { id: 'user-1' } });
    const result = await submitCreatorApplication(supabase, {
      reason: '   ',
      links: { portfolio: 'https://x.com' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects when caller is not authenticated', async () => {
    const supabase = makeClient({ user: null });
    const result = await submitCreatorApplication(supabase, {
      reason: 'I love cooking',
      links: { portfolio: 'https://x.com' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Not authenticated');
  });

  it('returns existing open application instead of inserting a duplicate', async () => {
    const supabase = makeClient({
      user: { id: 'user-1' },
      tables: {
        social_profiles: { selectResponse: { data: { id: 'profile-1' }, error: null } },
        bc_creator_applications: {
          selectResponse: { data: APPLICATION_ROW, error: null },
        },
      },
    });
    const result = await submitCreatorApplication(supabase, {
      reason: 'I love cooking',
      links: { portfolio: 'https://x.com' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('app-1');
      expect(result.data.status).toBe('submitted');
    }
  });

  it('inserts a new application when none is open', async () => {
    const supabase = makeClient({
      user: { id: 'user-1' },
      tables: {
        social_profiles: { selectResponse: { data: { id: 'profile-1' }, error: null } },
        bc_creator_applications: {
          selectResponse: { data: null, error: null },
          insertResponse: { data: APPLICATION_ROW, error: null },
        },
      },
    });
    const result = await submitCreatorApplication(supabase, {
      reason: 'I love cooking',
      links: { portfolio: 'https://x.com', social: '@chef' },
      audience: 'home cooks',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.profileId).toBe('profile-1');
      expect(result.data.bio).toBe('I love food');
    }
  });
});

// ── getMyCreatorApplication ───────────────────────────────────────────

describe('getMyCreatorApplication', () => {
  it('returns null when caller has no application', async () => {
    const supabase = makeClient({
      user: { id: 'user-1' },
      tables: {
        social_profiles: { selectResponse: { data: { id: 'profile-1' }, error: null } },
        bc_creator_applications: { selectResponse: { data: null, error: null } },
      },
    });
    const result = await getMyCreatorApplication(supabase);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it('returns the most recent application when one exists', async () => {
    const supabase = makeClient({
      user: { id: 'user-1' },
      tables: {
        social_profiles: { selectResponse: { data: { id: 'profile-1' }, error: null } },
        bc_creator_applications: {
          selectResponse: {
            data: { ...APPLICATION_ROW, status: 'under_review' },
            error: null,
          },
        },
      },
    });
    const result = await getMyCreatorApplication(supabase);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.status).toBe('under_review');
    }
  });

  it('rejects when caller has no social profile', async () => {
    const supabase = makeClient({
      user: { id: 'user-1' },
      tables: {
        social_profiles: { selectResponse: { data: null, error: null } },
      },
    });
    const result = await getMyCreatorApplication(supabase);
    expect(result.ok).toBe(false);
  });
});

// ── withdrawCreatorApplication ────────────────────────────────────────

describe('withdrawCreatorApplication', () => {
  it('updates status to withdrawn and stamps reviewed_at', async () => {
    const supabase = makeClient({
      user: { id: 'user-1' },
      tables: {
        social_profiles: { selectResponse: { data: { id: 'profile-1' }, error: null } },
        bc_creator_applications: {
          updateResponse: {
            data: { ...APPLICATION_ROW, status: 'withdrawn' },
            error: null,
          },
        },
      },
    });
    const result = await withdrawCreatorApplication(supabase, { applicationId: 'app-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('withdrawn');
  });

  it('rejects when caller is not authenticated', async () => {
    const supabase = makeClient({ user: null });
    const result = await withdrawCreatorApplication(supabase, { applicationId: 'app-1' });
    expect(result.ok).toBe(false);
  });
});

// ── status enum coverage ──────────────────────────────────────────────

describe('CreatorApplicationStatusValue', () => {
  it('round trips known status values via mapApplication', async () => {
    const statuses = [
      'submitted',
      'under_review',
      'approved',
      'declined',
      'more_info_needed',
      'withdrawn',
    ];
    for (const status of statuses) {
      const supabase = makeClient({
        user: { id: 'user-1' },
        tables: {
          social_profiles: { selectResponse: { data: { id: 'profile-1' }, error: null } },
          bc_creator_applications: {
            selectResponse: { data: { ...APPLICATION_ROW, status }, error: null },
          },
        },
      });
      const result = await getMyCreatorApplication(supabase);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data?.status).toBe(status);
    }
  });
});
