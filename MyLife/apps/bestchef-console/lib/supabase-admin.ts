import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseServiceRoleKey, supabaseUrl } from './env';

/**
 * Service-role client. This file is `server-only`: importing it from any
 * client component is a build error, which is the whole reason the console
 * is its own app (the key must never meet a consumer bundle).
 */
export function createAdminClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
