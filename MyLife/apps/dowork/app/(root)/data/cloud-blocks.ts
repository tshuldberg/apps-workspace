// DoWork user blocking (App Review Guideline 1.2).
//
// Blocking is one-directional and client-enforced at read time: feed and
// comment queries filter out authors in the caller's block list. Rows live
// in dw_user_blocks (owner-only RLS) so the list follows the account.

import type { SupabaseClient } from '@supabase/supabase-js';

const BLOCKS_TABLE = 'dw_user_blocks';

export type CloudBlocksResult<T> = ({ ok: true } & T) | { ok: false; error: string };

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

export async function blockUser(
  supabase: SupabaseClient,
  userId: string,
  blockedUserId: string,
): Promise<CloudBlocksResult<object>> {
  if (!userId || !blockedUserId) return { ok: false, error: 'Both user ids are required.' };
  if (userId === blockedUserId) return { ok: false, error: 'You cannot block yourself.' };
  try {
    const result = await supabase
      .from(BLOCKS_TABLE)
      .insert({ user_id: userId, blocked_user_id: blockedUserId });
    if (result.error) {
      const message = errMessage(result.error);
      // Already blocked is a success from the user's perspective.
      if (message.includes('duplicate key') || message.includes('23505')) {
        return { ok: true };
      }
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function unblockUser(
  supabase: SupabaseClient,
  userId: string,
  blockedUserId: string,
): Promise<CloudBlocksResult<object>> {
  try {
    const result = await supabase
      .from(BLOCKS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('blocked_user_id', blockedUserId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}

export async function listBlockedUserIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<CloudBlocksResult<{ blockedUserIds: Set<string> }>> {
  if (!userId) return { ok: true, blockedUserIds: new Set() };
  try {
    const result = await supabase
      .from(BLOCKS_TABLE)
      .select('blocked_user_id')
      .eq('user_id', userId);
    if (result.error) return { ok: false, error: errMessage(result.error) };
    const rows = (result.data ?? []) as Array<{ blocked_user_id: string }>;
    return { ok: true, blockedUserIds: new Set(rows.map((row) => row.blocked_user_id)) };
  } catch (error) {
    return { ok: false, error: errMessage(error) };
  }
}
