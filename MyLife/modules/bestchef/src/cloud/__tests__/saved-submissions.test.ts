import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSavedSubmissionIds,
  listSavedSubmissions,
  saveSubmission,
  unsaveSubmission,
} from '../saved-submissions';

interface TableStub {
  rows?: unknown[];
  insertError?: { code?: string; message?: string } | null;
  deleteError?: { message?: string } | null;
  selectError?: { message?: string } | null;
}

function fakeClient(tables: Record<string, TableStub>) {
  const inserts: Record<string, unknown[]> = {};
  const deletes: Record<string, Record<string, unknown>[]> = {};
  const client = {
    from: (table: string) => {
      const stub = tables[table] ?? {};
      const builder: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      for (const method of ['select', 'order', 'limit']) {
        builder[method] = () => builder;
      }
      builder.eq = (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      };
      builder.in = (column: string, values: unknown) => {
        filters[column] = values;
        return builder;
      };
      builder.insert = (row: unknown) => {
        (inserts[table] ??= []).push(row);
        return Promise.resolve({ error: stub.insertError ?? null });
      };
      builder.delete = () => {
        const del: Record<string, unknown> = {};
        const chain = {
          eq: (column: string, value: unknown) => {
            del[column] = value;
            return chain;
          },
          then: (resolve: (v: unknown) => void) => {
            (deletes[table] ??= []).push(del);
            resolve({ error: stub.deleteError ?? null });
          },
        };
        return chain;
      };
      (builder as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) =>
        resolve({ data: stub.selectError ? null : stub.rows ?? [], error: stub.selectError ?? null });
      return builder;
    },
    storage: {
      from: (_bucket: string) => ({
        createSignedUrls: (paths: string[], _ttl: number) =>
          Promise.resolve({
            data: paths.map((path) => ({
              path,
              signedUrl: `https://signed.example.com/${path}?token=t`,
              error: null,
            })),
            error: null,
          }),
      }),
    },
  } as unknown as SupabaseClient;
  return { client, inserts, deletes };
}

const PROFILE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUBMISSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('saved submissions cloud helpers (F-010)', () => {
  it('saves a submission for the profile', async () => {
    const { client, inserts } = fakeClient({ bc_saved_submissions: {} });
    await expect(saveSubmission({ submissionId: SUBMISSION, profileId: PROFILE }, client))
      .resolves.toEqual({ ok: true, data: true });
    expect(inserts.bc_saved_submissions).toEqual([
      { submission_id: SUBMISSION, profile_id: PROFILE },
    ]);
  });

  it('treats a duplicate save as success', async () => {
    const { client } = fakeClient({
      bc_saved_submissions: { insertError: { code: '23505', message: 'duplicate key value' } },
    });
    await expect(saveSubmission({ submissionId: SUBMISSION, profileId: PROFILE }, client))
      .resolves.toEqual({ ok: true, data: true });
  });

  it('maps the durable quota rejection to rate_limited', async () => {
    const { client } = fakeClient({
      bc_saved_submissions: { insertError: { code: 'P0001', message: 'rate_limited' } },
    });
    await expect(saveSubmission({ submissionId: SUBMISSION, profileId: PROFILE }, client))
      .resolves.toEqual({ ok: false, error: 'rate_limited' });
  });

  it('unsaves with both id filters', async () => {
    const { client, deletes } = fakeClient({ bc_saved_submissions: {} });
    await expect(unsaveSubmission({ submissionId: SUBMISSION, profileId: PROFILE }, client))
      .resolves.toEqual({ ok: true, data: true });
    expect(deletes.bc_saved_submissions).toEqual([
      { submission_id: SUBMISSION, profile_id: PROFILE },
    ]);
  });

  it('returns membership for feed button state', async () => {
    const { client } = fakeClient({
      bc_saved_submissions: { rows: [{ submission_id: SUBMISSION }] },
    });
    await expect(
      getSavedSubmissionIds({ profileId: PROFILE, submissionIds: [SUBMISSION, 'other'] }, client),
    ).resolves.toEqual({ ok: true, data: [SUBMISSION] });
  });

  it('short-circuits membership for an empty id list without a network call', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    await expect(getSavedSubmissionIds({ profileId: PROFILE, submissionIds: [] }, client))
      .resolves.toEqual({ ok: true, data: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it('lists saved submissions with display data and skips vanished submissions', async () => {
    const gone = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const { client } = fakeClient({
      bc_saved_submissions: {
        rows: [
          { submission_id: SUBMISSION, created_at: '2026-07-01T00:00:00Z' },
          { submission_id: gone, created_at: '2026-06-30T00:00:00Z' },
        ],
      },
      bc_submissions: {
        rows: [{
          id: SUBMISSION,
          dish_id: 'dish-1',
          recipe_snapshot_id: 'snap-1',
          profile_id: 'chef-1',
          // Stored public URL in the now-private submission-images bucket; the
          // helper parses the key out and re-signs it (audit C1).
          photo_url:
            'https://ref.supabase.co/storage/v1/object/public/bestchef-submission-images/chef-1/p.jpg',
        }],
      },
      bc_recipe_snapshots: { rows: [{ id: 'snap-1', title: 'Nonna Carbonara' }] },
      bc_dishes: { rows: [{ id: 'dish-1', name: 'Carbonara' }] },
      bc_public_profiles_v: { rows: [{ id: 'chef-1', handle: 'nonna', display_name: 'Nonna' }] },
    });

    await expect(listSavedSubmissions({ profileId: PROFILE }, client)).resolves.toEqual({
      ok: true,
      data: [{
        submissionId: SUBMISSION,
        savedAt: '2026-07-01T00:00:00Z',
        dishId: 'dish-1',
        dishName: 'Carbonara',
        title: 'Nonna Carbonara',
        // Re-signed from the parsed storage key.
        photoUrl: 'https://signed.example.com/chef-1/p.jpg?token=t',
        chefHandle: 'nonna',
        chefName: 'Nonna',
      }],
    });
  });

  it('returns an empty list when nothing is saved', async () => {
    const { client } = fakeClient({ bc_saved_submissions: { rows: [] } });
    await expect(listSavedSubmissions({ profileId: PROFILE }, client))
      .resolves.toEqual({ ok: true, data: [] });
  });

  it('requires ids', async () => {
    const { client } = fakeClient({});
    await expect(saveSubmission({ submissionId: '', profileId: PROFILE }, client))
      .resolves.toMatchObject({ ok: false });
    await expect(listSavedSubmissions({ profileId: '' }, client))
      .resolves.toMatchObject({ ok: false });
  });
});
