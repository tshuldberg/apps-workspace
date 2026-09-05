// DoWork content-report contract tests.

import { describe, expect, it } from 'vitest';
import { REPORT_REASONS, submitReport } from '../cloud-reports';
import { makeSupabase } from './_supabase-mock';

describe('submitReport', () => {
  it('submits a report', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_reports:insert': { data: null, error: null },
      },
    });
    const result = await submitReport(supabase, {
      reporterUserId: 'user-1',
      targetKind: 'share',
      targetId: 'share-1',
      reason: REPORT_REASONS[0],
    });
    expect(result).toEqual({ ok: true });
  });

  it('requires a reporter id without calling the network', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await submitReport(supabase, {
      reporterUserId: '',
      targetKind: 'share',
      targetId: 'share-1',
      reason: 'Spam or scam',
    });
    expect(result).toEqual({ ok: false, error: 'Sign in to report content.' });
  });

  it('requires a target id without calling the network', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await submitReport(supabase, {
      reporterUserId: 'user-1',
      targetKind: 'share',
      targetId: '',
      reason: 'Spam or scam',
    });
    expect(result).toEqual({ ok: false, error: 'Report target is required.' });
  });

  it('requires a non-empty reason without calling the network', async () => {
    const supabase = makeSupabase({ responses: {} });
    const result = await submitReport(supabase, {
      reporterUserId: 'user-1',
      targetKind: 'share',
      targetId: 'share-1',
      reason: '   ',
    });
    expect(result).toEqual({ ok: false, error: 'Pick a report reason.' });
  });

  it('trims notes and drops an empty notes field to null', async () => {
    let insertedNotes: unknown;
    const supabase = makeSupabase({
      responses: {
        'dw_reports:insert': () => {
          insertedNotes = 'captured';
          return { data: null, error: null };
        },
      },
    });
    const result = await submitReport(supabase, {
      reporterUserId: 'user-1',
      targetKind: 'comment',
      targetId: 'comment-1',
      reason: 'Harassment',
      notes: '   ',
    });
    expect(result).toEqual({ ok: true });
    expect(insertedNotes).toBe('captured');
  });

  it('supports every target kind', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_reports:insert': { data: null, error: null },
      },
    });
    for (const targetKind of ['share', 'comment', 'trainer_video', 'profile'] as const) {
      const result = await submitReport(supabase, {
        reporterUserId: 'user-1',
        targetKind,
        targetId: 'target-1',
        reason: 'Other',
      });
      expect(result).toEqual({ ok: true });
    }
  });

  it('surfaces an insert error', async () => {
    const supabase = makeSupabase({
      responses: {
        'dw_reports:insert': { data: null, error: { message: 'network request failed' } },
      },
    });
    const result = await submitReport(supabase, {
      reporterUserId: 'user-1',
      targetKind: 'share',
      targetId: 'share-1',
      reason: 'Dangerous form advice',
    });
    expect(result).toEqual({ ok: false, error: 'network request failed' });
  });
});
