import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listCloudCustomThemes,
  createCloudCustomTheme,
  updateCloudCustomTheme,
  deleteCloudCustomTheme,
} from '../custom-themes';

// ── Mock helpers ──────────────────────────────────────────────────────

interface MockBuilderOptions {
  selectListResponse?: { data: unknown; error: { message: string } | null };
  insertResponse?: { data: unknown; error: { message: string } | null };
  updateResponse?: { data: unknown; error: { message: string } | null };
  deleteResponse?: { error: { message: string } | null };
}

function makeBuilder(opts: MockBuilderOptions) {
  const builder: Record<string, unknown> = {};
  // Select chain: .from().select().eq().order() resolves to list result.
  builder.select = vi.fn(() => ({
    eq: vi.fn(() => ({
      order: vi.fn(async () => opts.selectListResponse ?? { data: [], error: null }),
    })),
  }));
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
  builder.delete = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => opts.deleteResponse ?? { error: null }),
    })),
  }));
  return builder;
}

interface MakeClientOptions {
  user?: { id: string } | null;
  authError?: { message: string } | null;
  tableOptions?: MockBuilderOptions;
}

function makeClient(opts: MakeClientOptions): SupabaseClient {
  const fromImpl = (_table: string) => makeBuilder(opts.tableOptions ?? {});
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

const THEME_ROW = {
  id: 'theme-1',
  user_id: 'user-1',
  name: 'Sunset Mode',
  token_overrides: { colors: { background: '#FF5500' } },
  created_at: '2026-04-27T00:00:00Z',
  updated_at: '2026-04-27T00:00:00Z',
};

// ── listCloudCustomThemes ─────────────────────────────────────────────

describe('listCloudCustomThemes', () => {
  it('returns empty array when no themes exist', async () => {
    const client = makeClient({
      user: { id: 'user-1' },
      tableOptions: { selectListResponse: { data: [], error: null } },
    });
    const result = await listCloudCustomThemes(client);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('returns themes for the current user', async () => {
    const client = makeClient({
      user: { id: 'user-1' },
      tableOptions: { selectListResponse: { data: [THEME_ROW], error: null } },
    });
    const result = await listCloudCustomThemes(client);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe('Sunset Mode');
      expect(result.data[0]?.userId).toBe('user-1');
    }
  });

  it('returns error when not authenticated', async () => {
    const client = makeClient({ user: null });
    const result = await listCloudCustomThemes(client);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/authenticated/i);
  });
});

// ── createCloudCustomTheme ────────────────────────────────────────────

describe('createCloudCustomTheme', () => {
  it('rejects empty names', async () => {
    const client = makeClient({ user: { id: 'user-1' } });
    const result = await createCloudCustomTheme(
      { name: '   ', tokenOverrides: {} },
      client,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/required/i);
  });

  it('inserts and returns the new theme', async () => {
    const client = makeClient({
      user: { id: 'user-1' },
      tableOptions: { insertResponse: { data: THEME_ROW, error: null } },
    });
    const result = await createCloudCustomTheme(
      { name: 'Sunset Mode', tokenOverrides: { colors: { background: '#FF5500' } } },
      client,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('theme-1');
      expect(result.data.name).toBe('Sunset Mode');
    }
  });

  it('surfaces supabase errors', async () => {
    const client = makeClient({
      user: { id: 'user-1' },
      tableOptions: {
        insertResponse: { data: null, error: { message: 'unique violation' } },
      },
    });
    const result = await createCloudCustomTheme(
      { name: 'Sunset Mode', tokenOverrides: {} },
      client,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unique violation');
  });
});

// ── updateCloudCustomTheme ────────────────────────────────────────────

describe('updateCloudCustomTheme', () => {
  it('renames a theme', async () => {
    const renamed = { ...THEME_ROW, name: 'Sunrise Mode' };
    const client = makeClient({
      user: { id: 'user-1' },
      tableOptions: { updateResponse: { data: renamed, error: null } },
    });
    const result = await updateCloudCustomTheme(
      { id: 'theme-1', name: 'Sunrise Mode' },
      client,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe('Sunrise Mode');
  });

  it('rejects empty rename', async () => {
    const client = makeClient({ user: { id: 'user-1' } });
    const result = await updateCloudCustomTheme(
      { id: 'theme-1', name: '' },
      client,
    );
    expect(result.ok).toBe(false);
  });

  it('requires an id', async () => {
    const client = makeClient({ user: { id: 'user-1' } });
    const result = await updateCloudCustomTheme(
      { id: '' },
      client,
    );
    expect(result.ok).toBe(false);
  });
});

// ── deleteCloudCustomTheme ────────────────────────────────────────────

describe('deleteCloudCustomTheme', () => {
  it('deletes a theme', async () => {
    const client = makeClient({
      user: { id: 'user-1' },
      tableOptions: { deleteResponse: { error: null } },
    });
    const result = await deleteCloudCustomTheme('theme-1', client);
    expect(result.ok).toBe(true);
  });

  it('requires an id', async () => {
    const client = makeClient({ user: { id: 'user-1' } });
    const result = await deleteCloudCustomTheme('', client);
    expect(result.ok).toBe(false);
  });

  it('surfaces supabase errors', async () => {
    const client = makeClient({
      user: { id: 'user-1' },
      tableOptions: { deleteResponse: { error: { message: 'forbidden' } } },
    });
    const result = await deleteCloudCustomTheme('theme-1', client);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('forbidden');
  });
});
