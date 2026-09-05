'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { canRun, requireModerator } from '@/lib/auth';
import { assignQueueItem, enforceDmca, escalateQueueItem } from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { fetchDmcaItemById } from '@/lib/dmca';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * DMCA workflow actions (WP2 behaviour, WP9 integrity).
 *
 * nw_console_enforce_dmca wraps nw_dmca_apply_action with the version check, the
 * replay token, the per-action role floor, and the hash-chained audit row. Two
 * behaviours are new:
 *
 *   - Every action needs a reason now, not just the four that had one. A DMCA
 *     file is a legal record; an unexplained step in it is a liability.
 *   - restore_content no longer restores anything directly. It records a pending
 *     action for a second moderator, because putting contested material back in
 *     public is the one step in this workflow that cannot be walked back quietly.
 */

const REASON_MAX_CHARS = 2000;

const ACTIONS = new Set([
  'assign',
  'add_note',
  'acknowledge',
  'forward',
  'resolve_url',
  'link_strike',
  'close',
  'link_original',
  'unlink_original',
  'forward_to_claimant',
  'start_waiting_period',
  'restore_content',
  'litigation_hold',
]);

function detailPath(kind: string, id: string): string {
  return `/dmca/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

function fail(code: string, kind?: string, id?: string): never {
  const base = kind && id ? detailPath(kind, id) : '/dmca';
  redirect(`${base}?error=${encodeURIComponent(code)}`);
}

function done(code: string, kind: string, id: string): never {
  revalidatePath('/dmca');
  revalidatePath(detailPath(kind, id));
  redirect(`${detailPath(kind, id)}?ok=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult, kind: string, id: string): never {
  if (result.ok) done(resultCode(result), kind, id);
  fail(resultCode(result), kind, id);
}

export async function runDmcaAction(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const noticeId = String(formData.get('noticeId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const value = String(formData.get('value') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const version = Number(String(formData.get('version') ?? ''));
  const confirm = String(formData.get('confirm') ?? '') === 'on';
  if (!noticeId || !ACTIONS.has(action) || token.length < 8) fail('invalid_input');
  if (!Number.isInteger(version) || version < 1) fail('invalid_input');

  const admin = createAdminClient();
  const item = await fetchDmcaItemById(admin, noticeId);
  if (!item) fail('not_found');
  if (reason === '' || reason.length > REASON_MAX_CHARS) fail('bad_reason', item.kind, item.id);
  if (!canRun(moderator, `dmca_${action}`)) fail('insufficient_role', item.kind, item.id);
  if (action === 'restore_content' && !confirm) fail('confirm_required', item.kind, item.id);

  settle(
    await enforceDmca(admin, {
      noticeId: item.id,
      noticeKind: item.workflowKind,
      expectedVersion: version,
      actorRef: moderator.email,
      action,
      reason,
      actionToken: token,
      value: value || null,
      confirm,
    }),
    item.kind,
    item.id,
  );
}

/* --------------------------- assignment + escalation ---------------------- */

export async function claimNotice(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const noticeId = String(formData.get('noticeId') ?? '').trim();
  const kind = String(formData.get('kind') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const release = String(formData.get('release') ?? '') === 'on';
  if (!noticeId || token.length < 8 || !kind) fail('invalid_input');

  const admin = createAdminClient();
  settle(
    await assignQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'dmca',
      itemId: noticeId,
      assigneeRef: release ? null : moderator.email,
      actionToken: token,
    }),
    kind,
    noticeId,
  );
}

export async function escalateNotice(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const noticeId = String(formData.get('noticeId') ?? '').trim();
  const kind = String(formData.get('kind') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const level = String(formData.get('level') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!noticeId || token.length < 8 || !kind) fail('invalid_input');
  if (level !== 'none' && level !== 'senior' && level !== 'admin') fail('bad_level', kind, noticeId);
  if (level !== 'none' && (reason === '' || reason.length > REASON_MAX_CHARS)) {
    fail('bad_reason', kind, noticeId);
  }
  if (level === 'none' && moderator.level < 2) fail('insufficient_role', kind, noticeId);

  const admin = createAdminClient();
  settle(
    await escalateQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'dmca',
      itemId: noticeId,
      level,
      reason,
      actionToken: token,
    }),
    kind,
    noticeId,
  );
}
