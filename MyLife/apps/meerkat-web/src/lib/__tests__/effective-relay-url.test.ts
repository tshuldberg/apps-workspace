/**
 * effectiveRelayUrl(db) wiring + probe cache (Plan 20, Phase 0, Tier B) -- web.
 *
 * Web mirror of apps/meerkat effective-relay-url.test.ts. Proves the web wrapper
 * threads relay_url + default_relay_optout + the cached mk_relay_probe row into
 * the pure resolver so the opt-out and health gate govern the actual dialed url
 * (AC-4). DEFAULT_RELAY_URL is '' under node (import.meta.env unset), so we mock
 * the app's own relay module to give it a value and exercise the health-gated
 * free-default branch through the real wrapper.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { DEFAULT_URL } = vi.hoisted(() => ({ DEFAULT_URL: 'wss://default.test' }));

vi.mock('../relay', () => ({ DEFAULT_RELAY_URL: DEFAULT_URL }));

import { createBrowserDatabaseAdapter } from '../storage/browser-database-adapter';
import { nodeLocateFile, resetDurableLayer } from '../storage/__tests__/helpers';
import { ensureMeerkatTables } from '../schema';
import {
  DEFAULT_RELAY_OPTOUT_KEY,
  RELAY_PROBE_TTL_MS,
  RELAY_URL_SETTING_KEY,
  getRelayProbe,
  setSetting,
  writeRelayProbe,
} from '../meerkat-data';
import {
  effectiveRelayUrl,
  ensureEffectiveRelayUrl,
  relayDialCandidateConfigured,
} from '../effective-relay';

const locateFile = nodeLocateFile();
const USER_URL = 'wss://mine.example/relay';

let db: Awaited<ReturnType<typeof createBrowserDatabaseAdapter>>;

beforeEach(async () => {
  await resetDurableLayer();
  db = await createBrowserDatabaseAdapter({ locateFile });
  ensureMeerkatTables(db);
});

afterEach(() => {
  db.close();
});

describe('effectiveRelayUrl(db) wiring (web)', () => {
  it('returns a user-set relay_url (and the user URL wins over the free default)', () => {
    setSetting(db, RELAY_URL_SETTING_KEY, USER_URL);
    expect(effectiveRelayUrl(db)).toBe(USER_URL);
  });

  it('returns the user URL even when opted out of the free default', () => {
    setSetting(db, RELAY_URL_SETTING_KEY, USER_URL);
    setSetting(db, DEFAULT_RELAY_OPTOUT_KEY, '1');
    expect(effectiveRelayUrl(db)).toBe(USER_URL);
  });

  it('does NOT dial the free default before any probe (unknown != reachable)', () => {
    expect(effectiveRelayUrl(db)).toBe('');
  });

  it('dials the free default once a real probe for it is cached (wiring proof)', () => {
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 8 });
    expect(effectiveRelayUrl(db)).toBe(DEFAULT_URL);
  });

  it('does NOT dial the free default when its cached probe failed (health gate)', () => {
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: false, latencyMs: Number.POSITIVE_INFINITY });
    expect(effectiveRelayUrl(db)).toBe('');
  });

  it('AC-4: opting out makes the dialed url "" even with a reachable default probe', () => {
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 8 });
    setSetting(db, DEFAULT_RELAY_OPTOUT_KEY, '1');
    expect(effectiveRelayUrl(db)).toBe('');
  });
});

describe('mk_relay_probe cache parity (TC-3)', () => {
  it('round-trips a probe as RelayHealth', () => {
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 8, connections: 3 });
    expect(getRelayProbe(db, DEFAULT_URL)).toEqual({
      url: DEFAULT_URL,
      healthy: true,
      latencyMs: 8,
      connections: 3,
    });
  });

  it('ignores rows older than RELAY_PROBE_TTL_MS, so a stale success is not dialed', () => {
    const old = new Date(Date.now() - RELAY_PROBE_TTL_MS - 5_000).toISOString();
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 8 }, old);
    expect(getRelayProbe(db, DEFAULT_URL)).toBeNull();
    expect(effectiveRelayUrl(db)).toBe('');
  });

  it('a stale probe never overwrites a newer recorded result (probe-race guard)', () => {
    const newer = new Date(Date.now()).toISOString();
    const older = new Date(Date.now() - 10_000).toISOString();
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 8 }, newer);
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: false, latencyMs: 99 }, older);
    expect(getRelayProbe(db, DEFAULT_URL)?.healthy).toBe(true);
  });
});

// rc13 defect 2: the sync choke point concluded "no relay" off a probe cache
// that only mount effects ever wrote, so any dial > RELAY_PROBE_TTL_MS after
// the last mount failed with "No relay URL configured" while the status card
// still said "Free server reachable". The ensured variant re-probes on demand.
describe('ensureEffectiveRelayUrl(db) on-demand re-probe (rc13 defect 2)', () => {
  it('re-probes a never-probed default and returns it when healthy (probe row written)', async () => {
    const probe = vi.fn(async (url: string) => ({ url, healthy: true, latencyMs: 12 }));
    await expect(ensureEffectiveRelayUrl(db, probe)).resolves.toBe(DEFAULT_URL);
    expect(probe).toHaveBeenCalledExactlyOnceWith(DEFAULT_URL);
    // The probe row is shared state: the sync read and the status card now agree.
    expect(getRelayProbe(db, DEFAULT_URL)?.healthy).toBe(true);
    expect(effectiveRelayUrl(db)).toBe(DEFAULT_URL);
  });

  it('recovers after the TTL expires (the launch-review repro: sync > 60s after mount)', async () => {
    const stale = new Date(Date.now() - RELAY_PROBE_TTL_MS - 1_000).toISOString();
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: true, latencyMs: 5 }, stale);
    expect(effectiveRelayUrl(db)).toBe(''); // the pre-fix failure mode
    const probe = vi.fn(async (url: string) => ({ url, healthy: true, latencyMs: 5 }));
    await expect(ensureEffectiveRelayUrl(db, probe)).resolves.toBe(DEFAULT_URL);
  });

  it('returns a user-set relay_url immediately, never probing (bypass semantics unchanged)', async () => {
    setSetting(db, RELAY_URL_SETTING_KEY, USER_URL);
    const probe = vi.fn();
    await expect(ensureEffectiveRelayUrl(db, probe)).resolves.toBe(USER_URL);
    expect(probe).not.toHaveBeenCalled();
  });

  it('honors a FRESH failed probe without re-probing (no retry spam, honest failure)', async () => {
    writeRelayProbe(db, { url: DEFAULT_URL, healthy: false, latencyMs: Number.POSITIVE_INFINITY });
    const probe = vi.fn();
    await expect(ensureEffectiveRelayUrl(db, probe)).resolves.toBe('');
    expect(probe).not.toHaveBeenCalled();
  });

  it('never probes when opted out of the free default (AC-4 preserved)', async () => {
    setSetting(db, DEFAULT_RELAY_OPTOUT_KEY, '1');
    const probe = vi.fn();
    await expect(ensureEffectiveRelayUrl(db, probe)).resolves.toBe('');
    expect(probe).not.toHaveBeenCalled();
  });

  it('a failed re-probe returns "" and records the failure for the card to show', async () => {
    const probe = vi.fn(async (url: string) => ({ url, healthy: false, latencyMs: Number.POSITIVE_INFINITY }));
    await expect(ensureEffectiveRelayUrl(db, probe)).resolves.toBe('');
    expect(getRelayProbe(db, DEFAULT_URL)?.healthy).toBe(false);
  });

  it('concurrent dial paths share ONE in-flight probe (no /healthz stampede)', async () => {
    let calls = 0;
    const probe = async (url: string) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { url, healthy: true, latencyMs: 1 };
    };
    const [a, b] = await Promise.all([
      ensureEffectiveRelayUrl(db, probe),
      ensureEffectiveRelayUrl(db, probe),
    ]);
    expect(a).toBe(DEFAULT_URL);
    expect(b).toBe(DEFAULT_URL);
    expect(calls).toBe(1);
  });
});

describe('relayDialCandidateConfigured(db) scheduling gate', () => {
  it('true with a user URL, true with an un-probed default, false when opted out', () => {
    expect(relayDialCandidateConfigured(db)).toBe(true); // default configured (mocked)
    setSetting(db, DEFAULT_RELAY_OPTOUT_KEY, '1');
    expect(relayDialCandidateConfigured(db)).toBe(false);
    setSetting(db, RELAY_URL_SETTING_KEY, USER_URL);
    expect(relayDialCandidateConfigured(db)).toBe(true); // user URL wins over opt-out
  });
});
