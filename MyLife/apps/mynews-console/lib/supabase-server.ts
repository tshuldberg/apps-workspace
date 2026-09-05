import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Cookie-session Supabase client (anon key) used ONLY for moderator auth:
 * magic-link send, OTP verify, session read, sign-out. All data access goes
 * through the service-role client in supabase-admin.ts.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; middleware refreshes the
          // session so swallowing here is the documented @supabase/ssr pattern.
        }
      },
    },
  });
}
