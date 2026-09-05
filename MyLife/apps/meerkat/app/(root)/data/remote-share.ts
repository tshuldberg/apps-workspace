import {
  fetchAndPinFromHosts,
  httpNodeSource,
  lookupContentHosts,
  type NodeStore,
  type OpenResult,
  type RemotePinnedFetchResult,
  type ShareLinkParts,
} from '@mylife/sync';

export interface OpenRemoteShareInput {
  store: NodeStore;
  parts: ShareLinkParts;
  hostText: string;
  fetchFn?: typeof fetch;
  /**
   * Hosts ALREADY discovered for this content by a single prior
   * `discoverShareHosts` call (the caller looks up the relay once, uses the
   * count to decide whether to attempt an open, then threads the same list in
   * here). They are unioned with the pasted hosts. Omitted/empty means the
   * caller had no relay configured or the relay returned nothing -- behavior is
   * then identical to before: pasted hosts only, no network touched here.
   *
   * Discovery is intentionally NOT re-run inside this function: that would do a
   * second WebSocket round-trip per open. There is exactly one lookup per open,
   * owned by the caller.
   */
  discoveredHosts?: string[];
}

export type OpenRemoteShareResult = RemotePinnedFetchResult;

/** A minimal WebSocket constructor, injectable so discovery is unit-testable. */
type WebSocketCtor = Parameters<typeof lookupContentHosts>[0]['webSocketImpl'];

export interface DiscoverShareHostsInput {
  relayUrl: string;
  contentId: string;
  /** Inject a WebSocket constructor for tests (defaults to the global one). */
  webSocketImpl?: WebSocketCtor;
}

function normalizeHostUrl(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, '');
  if (!value) return null;
  if (!value.startsWith('https://') && !value.startsWith('http://')) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function parseRemoteShareHosts(input: string): string[] {
  const seen = new Set<string>();
  const hosts: string[] = [];
  for (const token of input.split(/[\s,]+/)) {
    const host = normalizeHostUrl(token);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    hosts.push(host);
  }
  return hosts;
}

/**
 * Ask the user's relay which web-seed hosts have ANNOUNCED that they serve this
 * share's contentId. The relay never learns the contentId (the lookup id is
 * HKDF-derived) and the announce records are sealed under a key only share-link
 * holders can derive. Each returned url is a CANDIDATE host, not a live peer:
 * trust is established later, only when fetchAndPinFromHosts actually opens and
 * pins verified bytes from it. A relay outage or an empty registry yields [].
 */
export async function discoverShareHosts(
  input: DiscoverShareHostsInput,
): Promise<string[]> {
  const relayUrl = input.relayUrl.trim();
  if (!relayUrl) return [];
  try {
    const hosts = await lookupContentHosts({
      url: relayUrl,
      contentId: input.contentId,
      webSocketImpl: input.webSocketImpl,
    });
    // Re-run through the app's own normalizer/dedup so a discovered url is held
    // to the exact same http(s) rules as a pasted one.
    return parseRemoteShareHosts(hosts.join(' '));
  } catch {
    // Discovery is best-effort: a relay that is down must never break the
    // pasted-host path. Fall through to whatever the user pasted.
    return [];
  }
}

export async function openRemoteShare(
  input: OpenRemoteShareInput,
): Promise<OpenRemoteShareResult> {
  const pasted = parseRemoteShareHosts(input.hostText);
  // Discovery already happened once in the caller; we just union its result with
  // the pasted hosts. No WebSocket is touched here. When discoveredHosts is
  // empty/omitted, this is byte-for-byte the old pasted-only path.
  const discovered = input.discoveredHosts ?? [];
  // Dedup the union via the same normalizer (discovered first, then pasted).
  const hosts = parseRemoteShareHosts([...discovered, ...pasted].join(' '));
  if (hosts.length === 0) return { ok: false, reason: 'no-hosts' };
  return fetchAndPinFromHosts(
    hosts.map((host) => httpNodeSource(host, input.fetchFn)),
    input.store,
    input.parts.contentId,
    input.parts.linkKey,
    { expectedAuthor: input.parts.authorPublicKey },
  );
}

export interface OpenLinkFlowDeps {
  parts: ShareLinkParts;
  /** Raw pasted host text (may be empty; parsed by the remote open path). */
  pastedHostText: string;
  /** Whether a relay is configured; gates the single discovery lookup. */
  relayConfigured: boolean;
  openLocal: (contentId: string, linkKey: Uint8Array) => Promise<OpenResult>;
  discover: (contentId: string) => Promise<string[]>;
  openRemote: (
    parts: ShareLinkParts,
    hostText: string,
    discoveredHosts: string[],
  ) => Promise<OpenRemoteShareResult>;
}

export type OpenLinkFlowResult =
  | {
    kind: 'ok';
    content: Uint8Array;
    source: 'local' | 'remote';
    pinned: boolean;
    name?: string;
    pinError?: string;
    /** How many candidate hosts discovery returned, when it ran. */
    discovered?: number;
  }
  | { kind: 'not-pinned' }
  | { kind: 'error'; reason: string; discovered?: number };

/**
 * The one open-a-link decision flow behind the Share screen's "Open link"
 * button: local store first, then ONE discovery lookup (relay-configured only;
 * `discovered` is a candidate count, never a seeder claim), then the
 * verify-then-pin remote open over discovered + pasted hosts. Every thrown step
 * (a store read that fails mid-file, an aborted fetch) surfaces as an honest
 * error result instead of an unhandled rejection that reads as a dead tap.
 */
export async function runOpenLinkFlow(deps: OpenLinkFlowDeps): Promise<OpenLinkFlowResult> {
  const { parts } = deps;
  try {
    const local = await deps.openLocal(parts.contentId, parts.linkKey);
    if (local.ok) {
      return { kind: 'ok', content: local.content, source: 'local', pinned: true, name: parts.name };
    }
    if (local.reason !== 'content-not-pinned') {
      return { kind: 'error', reason: local.reason };
    }

    const discovered = deps.relayConfigured ? await deps.discover(parts.contentId) : [];
    const hasCandidates = discovered.length > 0 || deps.pastedHostText.trim().length > 0;
    if (!hasCandidates) return { kind: 'not-pinned' };

    const remote = await deps.openRemote(parts, deps.pastedHostText, discovered);
    if (remote.ok) {
      return {
        kind: 'ok',
        content: remote.content,
        source: 'remote',
        pinned: remote.pinned,
        name: remote.name,
        pinError: remote.pinError,
        discovered: discovered.length,
      };
    }
    return { kind: 'error', reason: remote.reason, discovered: discovered.length };
  } catch (err) {
    return {
      kind: 'error',
      reason: err instanceof Error ? err.message : 'Could not open this link.',
    };
  }
}
