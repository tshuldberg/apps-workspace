import 'server-only';

// Deep subpath, NOT the package barrel. The barrel re-exports the signing
// module, which reaches @mylife/sync, whose entry re-exports React client hooks;
// pulling that into a Server Component fails `next build`. data/health.ts has no
// runtime imports at all, so the ./health subpath is safe here. Type-only
// imports from the barrel remain fine anywhere because they are erased.
import {
  classifyHealthSnapshot,
  type HealthReport,
  type HealthSnapshot,
} from '@mylife/mynews/health';

import { createAdminClient } from './supabase-admin';

/**
 * Service-health read for the console (plan 48 WP11).
 *
 * The console reads `nw_health_snapshot()` directly with its own service-role
 * client rather than calling the mynews-health edge function. Going through the
 * endpoint would mean the console holding a second credential
 * (MYNEWS_HEALTH_SECRET) and an extra network hop to reach a database it is
 * already connected to. Both surfaces classify with the SAME
 * `classifyHealthSnapshot` from `@mylife/mynews`, so they cannot disagree about
 * what is in alarm.
 *
 * Fail-closed: a read failure returns `status: 'down'` with no components. It
 * never returns an empty component list as if everything were healthy, and it
 * never throws into the page, because a health page that 500s tells the operator
 * nothing about the thing they came to check.
 */
export type HealthReadResult =
  | { state: 'ok'; report: HealthReport }
  | { state: 'unavailable'; reason: string };

export async function readHealthReport(): Promise<HealthReadResult> {
  let client: ReturnType<typeof createAdminClient>;
  try {
    client = createAdminClient();
  } catch (error) {
    // A missing env var is a configuration fact worth naming, and `env.ts`
    // already throws with the variable name in the message.
    return { state: 'unavailable', reason: describe(error) };
  }

  const { data, error } = await client.rpc('nw_health_snapshot');
  if (error) {
    return { state: 'unavailable', reason: error.message };
  }
  if (!data || typeof data !== 'object') {
    return {
      state: 'unavailable',
      reason: 'nw_health_snapshot returned no snapshot',
    };
  }

  return { state: 'ok', report: classifyHealthSnapshot(data as HealthSnapshot) };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'the health snapshot could not be read';
}
