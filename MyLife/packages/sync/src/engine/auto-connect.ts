/**
 * Auto-connect scheduler (Plan 29 Phase 1, seamless auto-connect).
 *
 * `planAutoConnectRound` is the PURE decision: given the eligible peers, their
 * backoff rows, their last real completed session, and whether each was seen on
 * the local network, it returns the ordered dial list (with role + transport)
 * plus the earliest time a backed-off peer may retry. It fabricates nothing.
 *
 * `runAutoConnectJob` is the dependency-injected executor: it runs ONE round by
 * driving the SAME `runSyncSessionJob` the manual and background paths use, so
 * every session it produces is a real recorded `sync_sessions` row (a success is
 * a real completed row; a failure is a real failed row plus a backoff advance).
 * It never invents a status, a peer count, or a connection claim.
 *
 * Honesty invariants held here:
 *   - the live-session token is the per-day session token (NC-2: never the
 *     mailbox or friend-code token);
 *   - a relay dial happens only when a health-gated relay URL was supplied by
 *     the caller (the `effectiveRelayUrl` gate lives app-side, Plan 20);
 *   - a peer with auto_connect = 0 is already excluded by `getAutoConnectPeers`,
 *     so it is never dialed (AC-4, engine-enforced not UI-only);
 *   - the Plan 27 transport-policy seam is consulted for every dial; until Plan
 *     27 wires a real implementation the default is allow-all.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { TransportConnection } from '../types';
import type { RelayBackend } from '../transport/relay-transport';
import {
  getAutoConnectPeers,
  getLastCompletedSessionAt,
  readAutoConnectState,
  writeAutoConnectState,
  type AutoConnectState,
} from '../db/queries';
import { runSyncSessionJob, type RunSyncSessionJobOptions, type SyncSessionEngine } from './session-job';
import { sessionTokenCandidates } from '../protocol/session-token';

/** LAN Wi-Fi transport layer id (transport-manager L1). */
export const LAN_LAYER_ID = 1;
/** Nearby peer transport layer id (transport-manager L2). */
export const NEARBY_LAYER_ID = 2;
/** Direct WebRTC transport layer id (transport-manager L4). */
export const WEBRTC_LAYER_ID = 4;
/** Encrypted relay transport layer id (transport-manager L5). */
export const RELAY_LAYER_ID = 5;

export interface AutoConnectPolicy {
  /** Skip a peer whose last completed session is younger than this and has no pending changes. */
  minSessionIntervalMs: number;
  /** Backoff ladder (ms) indexed by the post-failure count; beyond it the cap applies. */
  backoffLadderMs: number[];
  /** Backoff ceiling (ms). */
  backoffCapMs: number;
}

export const DEFAULT_AUTO_CONNECT_POLICY: AutoConnectPolicy = {
  minSessionIntervalMs: 5 * 60_000,
  backoffLadderMs: [30_000, 120_000, 600_000, 1_800_000],
  backoffCapMs: 2 * 60 * 60_000,
};

export type AutoConnectTransport = 'lan' | 'native' | 'wan_relay';
export type AutoConnectRole = 'initiate' | 'listen';

export interface AutoConnectPeerInput {
  deviceId: string;
  /** This peer was seen on the local network this session (mDNS). */
  discoveredOnLan: boolean;
  /** The peer's backoff row, or null if it has never been attempted. */
  state: AutoConnectState | null;
  /** Epoch ms of this peer's most recent COMPLETED session, or null. */
  lastCompletedSessionAt: number | null;
  /** Unsynced local changes waiting for this peer (0 if none / unknown). */
  pendingChanges: number;
}

export interface PlanAutoConnectRoundInput {
  selfDeviceId: string;
  peers: AutoConnectPeerInput[];
  /** Whether a health-gated relay URL is available to dial. */
  relayAvailable: boolean;
  /**
   * Whether a REAL native data transport (WebRTC / Nearby) is present on this
   * build to dial peer-to-peer. When true and policy permits at least one native
   * layer, a peer NOT reachable over LAN is dialed directly over native before
   * falling back to relay. Defaults false (prior behavior unchanged).
   */
  nativeDataAvailable?: boolean;
  policy: AutoConnectPolicy;
  now: number;
  /** Plan 27 seam: may this layer carry a dial for this (optional) community? Defaults to allow-all. */
  transportPolicyAllows?: (layerId: number, communityId?: string) => boolean;
}

export interface AutoConnectDial {
  peerDeviceId: string;
  role: AutoConnectRole;
  transport: AutoConnectTransport;
}

export type AutoConnectSkipReason = 'backoff' | 'min_interval' | 'no_transport';

export interface AutoConnectSkip {
  peerDeviceId: string;
  reason: AutoConnectSkipReason;
}

export interface AutoConnectRoundPlan {
  dials: AutoConnectDial[];
  skipped: AutoConnectSkip[];
  /** Earliest epoch ms a backed-off peer may retry, or null when none are backed off. */
  nextEarliestRetryAt: number | null;
}

/**
 * The backoff delay (ms) after `failureCount` consecutive failures. The ladder
 * is 1-indexed by failureCount; past its length the cap applies. Every value is
 * clamped to the cap.
 */
export function nextBackoffMs(failureCount: number, policy: AutoConnectPolicy = DEFAULT_AUTO_CONNECT_POLICY): number {
  if (failureCount <= 0) return 0;
  const ladder = policy.backoffLadderMs;
  const raw = failureCount <= ladder.length ? ladder[failureCount - 1]! : policy.backoffCapMs;
  return Math.min(raw, policy.backoffCapMs);
}

/**
 * Decide, per peer, whether and how to dial this round. Pure and deterministic.
 * Skip rules, in order: an open backoff window; then no available transport;
 * then a fresh completed session with nothing pending (min-interval) for
 * initiators. Responders still open a listen window because the peer may have
 * pending changes this device cannot observe. Role is assigned with no
 * coordination: the lexicographically LOWER deviceId initiates, the other
 * listens, so two simultaneous triggers cannot double-initiate.
 */
export function planAutoConnectRound(input: PlanAutoConnectRoundInput): AutoConnectRoundPlan {
  const allow = input.transportPolicyAllows ?? (() => true);
  const dials: AutoConnectDial[] = [];
  const skipped: AutoConnectSkip[] = [];
  let nextEarliestRetryAt: number | null = null;

  for (const peer of input.peers) {
    const nextAttemptAt = peer.state?.nextAttemptAt ?? null;
    if (nextAttemptAt !== null && nextAttemptAt > input.now) {
      skipped.push({ peerDeviceId: peer.deviceId, reason: 'backoff' });
      nextEarliestRetryAt = nextEarliestRetryAt === null
        ? nextAttemptAt
        : Math.min(nextEarliestRetryAt, nextAttemptAt);
      continue;
    }

    // LAN-first when the peer was discovered locally and LAN is allowed; else a
    // direct native P2P transport (WebRTC / Nearby) when one is available and
    // policy permits at least one native layer; else relay when a health-gated
    // relay is available and relay is allowed.
    let transport: AutoConnectTransport | null = null;
    if (peer.discoveredOnLan && allow(LAN_LAYER_ID)) {
      transport = 'lan';
    } else if (input.nativeDataAvailable && (allow(NEARBY_LAYER_ID) || allow(WEBRTC_LAYER_ID))) {
      transport = 'native';
    } else if (input.relayAvailable && allow(RELAY_LAYER_ID)) {
      transport = 'wan_relay';
    }
    if (transport === null) {
      skipped.push({ peerDeviceId: peer.deviceId, reason: 'no_transport' });
      continue;
    }

    const role: AutoConnectRole = input.selfDeviceId < peer.deviceId ? 'initiate' : 'listen';

    if (
      role === 'initiate'
      && peer.lastCompletedSessionAt !== null
      && input.now - peer.lastCompletedSessionAt < input.policy.minSessionIntervalMs
      && peer.pendingChanges === 0
    ) {
      skipped.push({ peerDeviceId: peer.deviceId, reason: 'min_interval' });
      continue;
    }

    dials.push({ peerDeviceId: peer.deviceId, role, transport });
  }

  return { dials, skipped, nextEarliestRetryAt };
}

export interface AutoConnectDialOutcome {
  peerDeviceId: string;
  role: AutoConnectRole;
  transport: AutoConnectTransport;
  /** 'completed' | 'failed' | 'listened' | 'no_peer' -- the real outcome, never fabricated. */
  result: 'completed' | 'failed' | 'listened' | 'no_peer';
  error?: string;
}

export interface AutoConnectRoundResult {
  attempted: number;
  completed: number;
  failed: number;
  skipped: number;
  dials: AutoConnectDialOutcome[];
  nextEarliestRetryAt: number | null;
}

export interface RunAutoConnectJobDeps {
  db: DatabaseAdapter;
  /** This device's Ed25519 public key (deviceId), for the role decision. */
  selfDeviceId: string;
  /** The initialized engine to drive (already pointed at this device's db). */
  engine: SyncSessionEngine;
  /** Health-gated relay URL; '' or non-ws when no relay is available. */
  relayUrl: string;
  /** A FRESH relay backend per dial (runSyncSessionJob destroys it). */
  relayBackendFactory: () => RelayBackend;
  /** Resolve a peer's pairing shared secret hex; null when unrecoverable. */
  resolvePeerSecret: (deviceId: string) => string | null;
  /** deviceIds seen on the local network this session (mDNS). Absent => none. */
  discoveredPeers?: Set<string>;
  /** Unsynced changes waiting for a peer (0 when unknown). */
  pendingChangesForPeer?: (deviceId: string) => number;
  /**
   * Execute a LAN dial for a discovered peer (dev build only). When absent, a
   * peer planned for LAN is skipped (the app only marks a peer discoveredOnLan
   * when the LAN backend is present, so this guard is defensive).
   */
  connectLan?: (input: { peerDeviceId: string; role: AutoConnectRole; token: string }) => Promise<TransportConnection>;
  /**
   * Dial a peer over a real native data transport (WebRTC / Nearby), typically a
   * thin wrapper over NativeSyncEngine.dialPeerViaNativeDataTransport that throws
   * when no native transport is reachable (so a failed dial records an honest
   * failed row + backoff). When absent, a peer planned for native is skipped.
   *
   * `forbiddenLayerIds` carries the native layers (2 Nearby, 4 WebRTC) that this
   * round's own `transportPolicyAllows` denies, computed HERE so per-layer Plan
   * 27 enforcement does not depend on the app re-deriving policy: the wrapper
   * MUST forward it to dialPeerViaNativeDataTransport so a policy that permits
   * Nearby but forbids WebRTC can never result in a WebRTC session (NC-3).
   */
  connectNativeDataTransport?: (input: {
    peerDeviceId: string;
    role: AutoConnectRole;
    token: string;
    forbiddenLayerIds: number[];
  }) => Promise<TransportConnection>;
  /** Whether a real native data transport is present on this build (planner gate). */
  nativeDataAvailable?: boolean;
  /** Injected relay connect (tests wire a loopback pair). Defaults to the real relay dial. */
  connectRelay?: RunSyncSessionJobOptions['connect'];
  policy?: Partial<AutoConnectPolicy>;
  transportPolicyAllows?: (layerId: number, communityId?: string) => boolean;
  /** Injectable clock (epoch ms). Defaults to Date.now. */
  now?: () => number;
}

const activeRounds = new WeakMap<SyncSessionEngine, Promise<AutoConnectRoundResult>>();

/**
 * Run one auto-connect round. Reads the eligible peers (auto_connect = 1 AND
 * active), plans the round, executes each dial through the real session job, and
 * records honest per-peer backoff state. Returns real counts only.
 * Overlapping triggers for the same engine share the in-flight round.
 */
export function runAutoConnectJob(deps: RunAutoConnectJobDeps): Promise<AutoConnectRoundResult> {
  const active = activeRounds.get(deps.engine);
  if (active) return active;
  const round = executeAutoConnectRound(deps);
  activeRounds.set(deps.engine, round);
  const clear = (): void => { activeRounds.delete(deps.engine); };
  void round.then(clear, clear);
  return round;
}

async function executeAutoConnectRound(deps: RunAutoConnectJobDeps): Promise<AutoConnectRoundResult> {
  const now = deps.now ?? (() => Date.now());
  const policy: AutoConnectPolicy = { ...DEFAULT_AUTO_CONNECT_POLICY, ...deps.policy };
  const relayAvailable = deps.relayUrl.trim().startsWith('ws');
  const discovered = deps.discoveredPeers ?? new Set<string>();

  const peers = getAutoConnectPeers(deps.db);
  const nowMs = now();

  const peerInputs: AutoConnectPeerInput[] = peers.map((peer) => ({
    deviceId: peer.deviceId,
    discoveredOnLan: discovered.has(peer.deviceId),
    state: readAutoConnectState(deps.db, peer.deviceId),
    lastCompletedSessionAt: getLastCompletedSessionAt(deps.db, peer.deviceId),
    pendingChanges: deps.pendingChangesForPeer?.(peer.deviceId) ?? 0,
  }));

  const plan = planAutoConnectRound({
    selfDeviceId: deps.selfDeviceId,
    peers: peerInputs,
    relayAvailable,
    nativeDataAvailable: deps.nativeDataAvailable ?? false,
    policy,
    now: nowMs,
    transportPolicyAllows: deps.transportPolicyAllows,
  });

  const outcomes: AutoConnectDialOutcome[] = [];
  let attempted = 0;
  let completed = 0;
  let failed = 0;
  let skipped = plan.skipped.length;

  for (const dial of plan.dials) {
    const secret = deps.resolvePeerSecret(dial.peerDeviceId);
    if (!secret) {
      // Cannot derive the session token: not a real attempt, count as skipped.
      skipped += 1;
      continue;
    }
    const candidates = sessionTokenCandidates(secret, nowMs);
    const outcome = await executeDial(deps, dial, candidates);
    outcomes.push(outcome);

    // A missing transport callback is skipped. A real connection or handshake
    // failure advances backoff for either role, starting when the attempt ends.
    persistDialState(deps.db, dial.peerDeviceId, outcome, now(), policy);

    if (outcome.result === 'no_peer') {
      skipped += 1;
    } else {
      attempted += 1;
      if (outcome.result === 'failed') failed += 1;
      else completed += 1; // 'completed' (initiate) or 'listened' (responder handled a session)
    }
  }

  // Read after executing: this round may have advanced or cleared backoff.
  const finishedAt = now();
  const retries = peers.map((peer) => readAutoConnectState(deps.db, peer.deviceId)?.nextAttemptAt)
    .filter((at): at is number => typeof at === 'number' && at > finishedAt);
  return {
    attempted,
    completed,
    failed,
    skipped,
    dials: outcomes,
    nextEarliestRetryAt: retries.length > 0 ? Math.min(...retries) : null,
  };
}

async function executeDial(
  deps: RunAutoConnectJobDeps,
  dial: AutoConnectDial,
  tokenCandidates: string[],
): Promise<AutoConnectDialOutcome> {
  if (dial.transport === 'lan') {
    if (!deps.connectLan) {
      return { peerDeviceId: dial.peerDeviceId, role: dial.role, transport: dial.transport, result: 'no_peer' };
    }
    const token = tokenCandidates[0]!;
    const connectLan = deps.connectLan;
    const result = await runSyncSessionJob({
      backend: deps.relayBackendFactory(),
      relayUrl: 'lan',
      token,
      peerDeviceId: dial.peerDeviceId,
      role: dial.role,
      engine: deps.engine,
      connect: () => connectLan({ peerDeviceId: dial.peerDeviceId, role: dial.role, token }),
    });
    return toOutcome(dial, result);
  }

  if (dial.transport === 'native') {
    if (!deps.connectNativeDataTransport) {
      return { peerDeviceId: dial.peerDeviceId, role: dial.role, transport: dial.transport, result: 'no_peer' };
    }
    const token = tokenCandidates[0]!;
    const connectNative = deps.connectNativeDataTransport;
    // Compute the per-layer forbidden set from THIS round's policy function so the
    // callback enforces it regardless of what the app re-derives (NC-3).
    const allow = deps.transportPolicyAllows ?? (() => true);
    const forbiddenLayerIds = [NEARBY_LAYER_ID, WEBRTC_LAYER_ID].filter((layerId) => !allow(layerId));
    const result = await runSyncSessionJob({
      backend: deps.relayBackendFactory(),
      relayUrl: 'native',
      token,
      peerDeviceId: dial.peerDeviceId,
      role: dial.role,
      engine: deps.engine,
      connect: () => connectNative({ peerDeviceId: dial.peerDeviceId, role: dial.role, token, forbiddenLayerIds }),
    });
    return toOutcome(dial, result);
  }

  // Relay: the dialer tries today's token then yesterday's (clock-skew window);
  // the listener listens on today's token only.
  if (dial.role === 'listen') {
    const result = await runSyncSessionJob({
      backend: deps.relayBackendFactory(),
      relayUrl: deps.relayUrl,
      token: tokenCandidates[0]!,
      peerDeviceId: dial.peerDeviceId,
      role: 'listen',
      engine: deps.engine,
      connect: deps.connectRelay,
    });
    return toOutcome(dial, result);
  }

  let lastResult = await runSyncSessionJob({
    backend: deps.relayBackendFactory(),
    relayUrl: deps.relayUrl,
    token: tokenCandidates[0]!,
    peerDeviceId: dial.peerDeviceId,
    role: 'initiate',
    engine: deps.engine,
    connect: deps.connectRelay,
  });
  if (lastResult.session?.status !== 'completed' && tokenCandidates.length > 1) {
    lastResult = await runSyncSessionJob({
      backend: deps.relayBackendFactory(),
      relayUrl: deps.relayUrl,
      token: tokenCandidates[1]!,
      peerDeviceId: dial.peerDeviceId,
      role: 'initiate',
      engine: deps.engine,
      connect: deps.connectRelay,
    });
  }
  return toOutcome(dial, lastResult);
}

function toOutcome(
  dial: AutoConnectDial,
  result: { ran: boolean; session?: { status: string }; error?: string },
): AutoConnectDialOutcome {
  const ok = result.session?.status === 'completed';
  return {
    peerDeviceId: dial.peerDeviceId,
    role: dial.role,
    transport: dial.transport,
    result: ok ? (dial.role === 'listen' ? 'listened' : 'completed') : 'failed',
    error: ok ? undefined : (result.error ?? result.session?.status),
  };
}

function persistDialState(
  db: DatabaseAdapter,
  peerDeviceId: string,
  outcome: AutoConnectDialOutcome,
  nowMs: number,
  policy: AutoConnectPolicy,
): void {
  // A missing transport callback leaves state untouched (no attempt).
  if (outcome.result === 'no_peer') return;

  const prev = readAutoConnectState(db, peerDeviceId);
  if (outcome.result === 'completed' || outcome.result === 'listened') {
    writeAutoConnectState(db, {
      peerDeviceId,
      failureCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: nowMs,
      lastResult: outcome.result,
    });
    return;
  }
  // failed: advance the backoff ladder.
  const failureCount = (prev?.failureCount ?? 0) + 1;
  writeAutoConnectState(db, {
    peerDeviceId,
    failureCount,
    nextAttemptAt: nowMs + nextBackoffMs(failureCount, policy),
    lastAttemptAt: nowMs,
    lastResult: 'failed',
  });
}
