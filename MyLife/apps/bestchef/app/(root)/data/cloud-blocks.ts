import type { SupabaseClient } from '@supabase/supabase-js';

// Server-backed block list (Guideline 1.2). Persisting blocks in bc_blocks means a
// block survives reinstall and can be enforced when loading public feeds/content.

const BLOCKS_TABLE = 'bc_blocks';

export interface CloudBlockResult {
  ok: boolean;
  error?: string;
}

export async function blockProfileCloud(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<CloudBlockResult> {
  if (!blockerId || !blockedId || blockerId === blockedId) {
    return { ok: false, error: 'invalid_block_target' };
  }
  const { error } = await supabase
    .from(BLOCKS_TABLE)
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function unblockProfileCloud(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<CloudBlockResult> {
  if (!blockerId || !blockedId) {
    return { ok: false, error: 'invalid_block_target' };
  }
  const { error } = await supabase
    .from(BLOCKS_TABLE)
    .delete()
    .match({ blocker_id: blockerId, blocked_id: blockedId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Whether this viewer has a cloud block against the given profile. The cloud
 * row is authoritative (plan 33 Phase 1.5): it survives reinstall and is what
 * the server-side RLS actually enforces. Returns null when the state could
 * not be read (offline), so callers can keep the local answer instead of
 * wrongly flipping to unblocked.
 */
export async function isProfileBlockedCloud(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<boolean | null> {
  if (!blockerId || !blockedId) return null;
  const { data, error } = await supabase
    .from(BLOCKS_TABLE)
    .select('blocked_id')
    .match({ blocker_id: blockerId, blocked_id: blockedId })
    .maybeSingle();
  if (error) return null;
  return data !== null;
}

/** Profile ids this viewer has blocked. Used to hide their content from feeds. */
export async function listBlockedProfileIdsCloud(
  supabase: SupabaseClient,
  blockerId: string,
): Promise<string[]> {
  if (!blockerId) return [];
  const { data, error } = await supabase
    .from(BLOCKS_TABLE)
    .select('blocked_id')
    .eq('blocker_id', blockerId);
  if (error || !data) return [];
  return data
    .map((row) => (row as { blocked_id?: string }).blocked_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}
