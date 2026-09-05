/**
 * effectiveRelayUrl(db) -- the single relay-dial choke point (Plan 20, Phase 0).
 *
 * Web mirror of apps/meerkat data/effective-relay.ts. Every networked dial in
 * the web client reads the relay URL through THIS helper, never
 * `getSetting(db, RELAY_URL_SETTING_KEY) || DEFAULT_RELAY_URL` directly: the raw
 * read cannot honor the per-device opt-out (a DB row, not the build-time
 * constant) nor the health gate. Reads relay_url, default_relay_optout, and the
 * cached mk_relay_probe row, then delegates to the pure, tested decision in
 * @mylife/sync.
 *
 *  - a user-set relay_url is always returned (the user chose it);
 *  - the free default is returned ONLY when its last real /healthz probe passed
 *    and the user has not opted out;
 *  - '' when nothing is dialable -- so the caller's `.startsWith('ws')` guard
 *    short-circuits exactly as today.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  effectiveRelayUrl as pickEffectiveRelayUrl,
  probeRelays,
  type RelayHealth,
} from '@mylife/sync';
import {
  DEFAULT_RELAY_OPTOUT_KEY,
  getRelayProbe,
  getSetting,
  RELAY_URL_SETTING_KEY,
  writeRelayProbe,
} from './meerkat-data';
import { DEFAULT_RELAY_URL } from './relay';

export function effectiveRelayUrl(db: DatabaseAdapter): string {
  const configuredUrl = getSetting(db, RELAY_URL_SETTING_KEY)?.trim() ?? '';
  const optedOut = getSetting(db, DEFAULT_RELAY_OPTOUT_KEY) === '1';
  const candidate = configuredUrl || DEFAULT_RELAY_URL;
  const lastProbe = candidate ? getRelayProbe(db, candidate) : null;
  return pickEffectiveRelayUrl({
    configuredUrl,
    defaultUrl: DEFAULT_RELAY_URL,
    optedOut,
    lastProbe,
  });
}

/**
 * True when SOME relay could be dialed after a fresh probe: a user URL is set,
 * or the free default is configured and not opted out. A scheduling/UI gate
 * only -- it never claims reachability; the dial itself still goes through
 * ensureEffectiveRelayUrl / effectiveRelayUrl.
 */
export function relayDialCandidateConfigured(db: DatabaseAdapter): boolean {
  const configuredUrl = getSetting(db, RELAY_URL_SETTING_KEY)?.trim() ?? '';
  if (configuredUrl) return true;
  const optedOut = getSetting(db, DEFAULT_RELAY_OPTOUT_KEY) === '1';
  return Boolean(DEFAULT_RELAY_URL) && !optedOut;
}

async function defaultProbe(url: string): Promise<RelayHealth | undefined> {
  const [health] = await probeRelays({ candidates: [url] });
  return health;
}

// One probe in flight per db: concurrent dial paths share the same re-probe
// instead of stampeding /healthz.
const inFlight = new WeakMap<DatabaseAdapter, Promise<string>>();

/**
 * The ASYNC dial choke point (rc13 defect 2): resolve the effective relay URL,
 * re-probing the free default ON DEMAND when its cached /healthz probe is stale
 * or missing, instead of concluding "no relay" off a cache that only mount
 * effects ever wrote. Semantics preserved exactly:
 *  - a user-set relay_url still returns immediately, never probed here;
 *  - opt-out and unconfigured builds still return '' without any network call;
 *  - a FRESH failed probe (within RELAY_PROBE_TTL_MS) is honored as '' -- the
 *    server genuinely did not answer moments ago; honesty over retry-spam;
 *  - only the stale/missing case runs one real probe, writes mk_relay_probe
 *    (so the status card and this dial read the same row), and re-resolves.
 * Every networked dial path awaits THIS; the sync effectiveRelayUrl remains for
 * display gates that must not block.
 */
export async function ensureEffectiveRelayUrl(
  db: DatabaseAdapter,
  probe: (url: string) => Promise<RelayHealth | undefined> = defaultProbe,
): Promise<string> {
  const url = effectiveRelayUrl(db);
  if (url) return url;
  // '' with a user URL set cannot happen (a user URL always wins), so '' means
  // the free default is the only possible candidate.
  const optedOut = getSetting(db, DEFAULT_RELAY_OPTOUT_KEY) === '1';
  if (optedOut || !DEFAULT_RELAY_URL) return '';
  if (getRelayProbe(db, DEFAULT_RELAY_URL)) return ''; // fresh probe already said unhealthy
  const pending = inFlight.get(db);
  if (pending) return pending;
  const run = (async (): Promise<string> => {
    try {
      const health = await probe(DEFAULT_RELAY_URL);
      if (health) writeRelayProbe(db, health);
    } catch {
      // probeRelays never throws; defensive only. No probe row = stays 'unknown'.
    }
    return effectiveRelayUrl(db);
  })();
  inFlight.set(db, run);
  try {
    return await run;
  } finally {
    inFlight.delete(db);
  }
}
