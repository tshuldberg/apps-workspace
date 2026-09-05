import type { SupabaseClient } from '@supabase/supabase-js';

// Bump this when the published Terms / Community Guidelines change so users re-accept.
export const CURRENT_TERMS_VERSION = '2026-05-29';

/**
 * Best-effort server record of EULA / Terms acceptance (Guideline 1.2 + consent audit).
 * The local rc_settings record is the actual entry gate; this is the durable, auditable
 * server copy that survives reinstall.
 */
export async function recordTermsAcceptanceCloud(
  supabase: SupabaseClient,
  profileId: string,
  version: string,
): Promise<void> {
  if (!profileId) return;
  try {
    await supabase.from('bc_terms_acceptance').upsert(
      { profile_id: profileId, terms_version: version, source: 'mobile' },
      { onConflict: 'profile_id,terms_version', ignoreDuplicates: true },
    );
  } catch {
    // Best-effort: never block app entry on a network write.
  }
}
