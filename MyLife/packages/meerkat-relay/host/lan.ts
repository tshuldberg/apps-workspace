/**
 * Host LAN rung (Plan 20, Phase 5.2). Same-network dial URL + mDNS advertise payload.
 *
 * The desktop host companion can expose its relay/community node on the LOCAL
 * network (a same-Wi-Fi rung) instead of the internet. This module is the pure,
 * injectable core for that path:
 *
 *  - `resolveLanPort` picks a bind port, walking to the next free port when the
 *    desired one is taken. The check is injected (`isPortInUse`) so nothing here
 *    opens a real socket; the SUPERVISOR still reports the REAL bound port from
 *    the bin's `{event:'listening',port}` stdout line, and `lanDialUrl` is built
 *    from THAT real port -- so a shifted port is always reflected honestly.
 *  - `buildLanAdvertisePayload` produces a well-formed DNS-SD/Bonjour advertise
 *    record (serviceType + port + TXT), matching @mylife/sync's `DiscoveryBackend`
 *    `advertise(serviceType, port, txtRecord)` signature. It is DATA ONLY: no
 *    native mDNS library is imported here, so it stays pure and testable, and the
 *    real bonjour-service/react-native-zeroconf backend consumes the payload.
 *
 * Honesty boundary: a LAN address is a SAME-NETWORK rung, never internet-
 * reachable. The dial URL is plain `ws://<lan-host>:<port>` (the payload crypto
 * is end-to-end regardless of transport), and neither the dial URL nor the
 * advertise payload ever carries a `wss://`/public URL or claims reachability
 * beyond the local network. Off-host/public exposure goes through the separate
 * tunnel + `gateReachability` path, never this module.
 */

import { MDNS_SERVICE_TYPE } from '@mylife/sync';

/** Marks every value this module emits as local-network-only (never public). */
export const LAN_SCOPE = 'same-network' as const;
export type LanScope = typeof LAN_SCOPE;

/** Default LAN bind port (matches the relay's plain-ws default of 8787). */
export const LAN_DEFAULT_PORT = 8787;

/** DNS-SD TXT schema version advertised in the `v` key. */
export const LAN_TXT_VERSION = '1';

const MIN_PORT = 1;
const MAX_PORT = 65535;
/** Per RFC 6763, a single TXT `key=value` entry must fit in 255 bytes. */
const MAX_TXT_ENTRY_BYTES = 255;

function assertPort(port: number, label: string): void {
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`${label} must be an integer in [${MIN_PORT}, ${MAX_PORT}], got ${String(port)}`);
  }
}

/**
 * Format a bare LAN host for a URL authority. Wraps a bare IPv6 literal in
 * brackets and rejects anything that is already a URL (a host is a host, not a
 * dial string). Returns the host portion only -- the scheme/port are added by
 * the caller.
 */
function formatHost(address: string): string {
  const a = (address ?? '').trim();
  if (!a) throw new Error('address must be a non-empty LAN host');
  if (/^wss?:\/\//i.test(a)) throw new Error('address must be a bare host, not a ws(s):// URL');
  if (a.startsWith('[') && a.endsWith(']')) return a; // already-bracketed IPv6
  if (a.includes(':')) return `[${a}]`; // bare IPv6 literal
  return a;
}

export type PortInUseProbe = (port: number) => boolean;

export interface ResolveLanPortInput {
  /** Preferred bind port; defaults to {@link LAN_DEFAULT_PORT}. */
  desiredPort?: number;
  /** Injected probe: true when a port is already taken. No real socket is opened here. */
  isPortInUse: PortInUseProbe;
  /** How many consecutive ports to try before giving up. Defaults to 64. */
  maxProbes?: number;
}

export interface ResolvedLanPort {
  /** The first free port at or after the desired port. */
  port: number;
  /** True when the desired port was taken and we walked forward (reflected honestly). */
  shifted: boolean;
  /** How many ports were probed (>= 1). */
  probed: number;
}

/**
 * Pick a free LAN bind port, walking forward from the desired port when it is in
 * use. `isPortInUse` is injected so this stays pure/deterministic; the caller
 * passes the returned port to the bin, then builds the dial URL from the REAL
 * bound port the supervisor reports (which may differ if the OS re-homed it).
 */
export function resolveLanPort(input: ResolveLanPortInput): ResolvedLanPort {
  const desired = input.desiredPort ?? LAN_DEFAULT_PORT;
  assertPort(desired, 'desiredPort');
  const maxProbes = input.maxProbes ?? 64;
  for (let i = 0; i < maxProbes; i += 1) {
    const candidate = desired + i;
    if (candidate > MAX_PORT) break;
    if (!input.isPortInUse(candidate)) {
      return { port: candidate, shifted: i > 0, probed: i + 1 };
    }
  }
  const last = Math.min(desired + maxProbes - 1, MAX_PORT);
  throw new Error(`no free LAN port found in [${desired}, ${last}]`);
}

export interface LanDialInput {
  /** The REAL port the LAN listener bound, from the supervisor's `{event:'listening',port}`. */
  boundPort: number;
  /** This device's LAN address: IPv4 dotted-quad, IPv6 literal, or a `.local` hostname. */
  address: string;
}

/**
 * Build the same-network dial URL a peer on the SAME Wi-Fi/LAN uses to reach this
 * host. Always `ws://` (plaintext transport; the payload is E2E encrypted) and
 * never `wss://` -- a LAN address is not a public, TLS-terminated endpoint.
 */
export function lanDialUrl(input: LanDialInput): string {
  assertPort(input.boundPort, 'boundPort');
  return `ws://${formatHost(input.address)}:${input.boundPort}`;
}

export interface LanAdvertiseInput {
  /** The REAL bound port to advertise (same value used to build the dial URL). */
  boundPort: number;
  /** Display/instance name shown in Bonjour browsers. */
  instanceName?: string;
  /** Which local service is being advertised (a TXT hint only, never a URL). */
  role?: 'relay' | 'communityNode';
}

export interface LanAdvertisePayload {
  /** DNS-SD service type, shared with @mylife/sync's mobile discovery (`_mylife-sync._tcp`). */
  serviceType: string;
  /** REAL bound port. */
  port: number;
  /** Instance name shown to browsers. */
  name: string;
  /** Flat DNS-SD TXT record (string -> string). Never contains a URL. */
  txt: Record<string, string>;
  /** Local-network-only marker; this record never implies internet reachability. */
  scope: LanScope;
}

/**
 * Produce a well-formed DNS-SD/Bonjour advertise payload for the LAN listener.
 * Data only -- no native mDNS library is touched, so it stays pure and directly
 * feeds `DiscoveryBackend.advertise(serviceType, port, txtRecord)`. The TXT
 * record carries only a version, a role hint, and the ws path; it deliberately
 * omits any address/URL so a browsed peer resolves the reachable host itself and
 * nothing here can be mistaken for a public endpoint.
 */
export function buildLanAdvertisePayload(input: LanAdvertiseInput): LanAdvertisePayload {
  assertPort(input.boundPort, 'boundPort');
  const name = (input.instanceName ?? 'Meerkat host').trim() || 'Meerkat host';
  const role = input.role === 'communityNode' ? 'community' : 'relay';
  const txt: Record<string, string> = { v: LAN_TXT_VERSION, role, path: '/' };
  for (const [k, val] of Object.entries(txt)) {
    if (Buffer.byteLength(`${k}=${val}`) > MAX_TXT_ENTRY_BYTES) {
      throw new Error(`mDNS TXT entry ${k} exceeds ${MAX_TXT_ENTRY_BYTES} bytes`);
    }
  }
  return { serviceType: MDNS_SERVICE_TYPE, port: input.boundPort, name, txt, scope: LAN_SCOPE };
}
