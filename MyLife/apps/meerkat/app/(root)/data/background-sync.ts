// Background sync entry (Task 3, the honest software slice).
//
// `runBackgroundSyncCore` is the pure, dependency-injected heart: it configures
// crypto FIRST (MK-001 boot order), reconstructs identity, reads relay
// settings, and runs the mailbox drain (always) plus an optional bounded
// opportunistic listen. It calls the REAL @mylife/sync jobs, so every recorded
// artifact (sync_ rows, applied cm_ events) is real. It records NOTHING when no
// relay is configured.
//
// `runBackgroundSyncOnce` is the thin expo wiring around the core: it lazy-loads
// the shared db boot, reconstructs identity from SQLite, builds the real
// WebSocketRelayBackend + the engine, and resolves peer secrets from the secret
// store. It is the function the debug button and the (deferred) scheduler/push
// handlers call. The native modules it needs are loaded lazily so Expo Go and
// the test path never crash on a missing module.
//
// Honesty: a data-only push only ENQUEUES this run; a "message received"
// notification is emitted by the caller ONLY when applied > 0, with the real
// count. This module never claims a peer is connected or that a session moved
// bytes; it returns whatever the engine and the drain actually did.

import { isMeerkatOwnSyncDevice } from './sync-peer-authorization';
import type { DatabaseAdapter } from '@mylife/db';
import {
  encodeMailboxEnvelope,
  getPairedDevice,
  getPairedDevices,
  getSharedSecretHex,
  isDeviceRevoked,
  recordPresenceBeacon,
  prunePresenceBeacons,
  runMailboxDrainJob,
  runSyncSessionJob,
  type ApplyChannelEvents,
  type AutoConnectRoundResult,
  type DeviceIdentity,
  type MailboxDrainJobResult,
  type MailboxDrainPeer,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type PairedDevice,
  type RelayBackend,
  type SyncSessionEngine,
  type SyncSessionJobResult,
} from '@mylife/sync';
import { getSetting } from './db';
import { ensureEffectiveRelayUrl } from './effective-relay';
import { RELAY_PHRASE_SETTING_KEY, buildRendezvousToken } from './sync-core';
import {
  buildCommunityNotifications,
  type CommunityNotificationContent,
} from './notification-identity-core';

export const BACKGROUND_SYNC_TASK = 'meerkat-background-sync';
export const BACKGROUND_SYNC_ENABLED_SETTING_KEY = 'background_sync_enabled';
export const LAST_BACKGROUND_RUN_SETTING_KEY = 'last_background_run_at';

export interface BackgroundSyncResult {
  /** True when a relay was configured and the run actually executed. */
  ran: boolean;
  /** The drain outcome, when a drain ran. */
  drain?: MailboxDrainJobResult;
  /** The opportunistic listen outcome, when one was attempted. */
  listen?: SyncSessionJobResult;
  /**
   * The composed auto-connect session round outcome (Plan 29 P4 graduation),
   * when a `runComposedSessions` runner was injected. Same seam as the foreground
   * auto-connect round: drain first (above), then a gossip:true session sync.
   * Every count is real; omitted on the drain-only path.
   */
  composedSessions?: AutoConnectRoundResult;
  /** Verified channel events applied into local storage this run. */
  applied: number;
  /** Incoming file-request envelopes applied this run (Files Phase 3). */
  fileRequests: number;
  /** Incoming file-grant envelopes applied (restore or recorded decline). */
  fileGrants: number;
  /** PUBLIC-join request envelopes recorded into the local review queue this run (no key handed off). */
  publicJoinRequests: number;
  /**
   * Per-community count of REAL channel events applied this run (Plan 38 C.10).
   * Populated only by the expo wiring (runBackgroundSyncOnce), which wraps the
   * channelMessage handler to tally inserts. Sums to `applied`. The pure core
   * leaves it undefined.
   */
  appliedByCommunity?: { communityId: string; applied: number }[];
  /**
   * Ready-to-emit per-community notification content (Plan 38 C.10). Populated
   * only by the expo wiring, from the real appliedByCommunity tally + each
   * community's verified identity, device-local sound pref, and mute state.
   * applied > 0 and non-muted only; the pure core leaves it undefined.
   */
  notifications?: CommunityNotificationContent[];
  /** Why the run was a no-op, when ran is false. */
  reason?: string;
  /** Storage maintenance executed by the same coalesced best-effort task. */
  storageSchedule?: import('./storage-destinations/storage-scheduler-run').StorageScheduleRunReport;
}

/**
 * Wrap a channelMessage apply handler to tally REAL inserted rows per community
 * (Plan 38 C.10). Each mailbox delta is single-community, but the events are
 * grouped defensively so a mixed batch still attributes inserts to the right
 * community. The tally counts only rows the inner handler actually inserted, so
 * a downstream notification can never claim more than really landed.
 */
export function tallyChannelMessages(
  inner: ApplyChannelEvents,
  tally: Map<string, number>,
): ApplyChannelEvents {
  return (events) => {
    const groups = new Map<string, typeof events[number][]>();
    for (const event of events) {
      const group = groups.get(event.communityId) ?? [];
      group.push(event);
      groups.set(event.communityId, group);
    }
    let inserted = 0;
    let skipped = 0;
    let invalid = 0;
    for (const [communityId, group] of groups) {
      const result = inner(group);
      inserted += result.inserted;
      skipped += result.skipped;
      invalid += result.invalid;
      if (result.inserted > 0) {
        tally.set(communityId, (tally.get(communityId) ?? 0) + result.inserted);
      }
    }
    return { inserted, skipped, invalid };
  };
}

export interface RunBackgroundSyncCoreDeps {
  db: DatabaseAdapter;
  /**
   * Configure crypto plumbing (PRNG + secret store). Called FIRST, before any
   * identity/seal call, mirroring the DatabaseProvider invariant (MK-001).
   */
  configureCrypto: () => void;
  /** Reconstruct this device's identity (after crypto is configured). */
  getIdentity: () => DeviceIdentity | null;
  /** Relay backend (real WebSocket in app, simulated in tests). */
  backend: RelayBackend;
  /**
   * Build the per-kind drain handlers (channel-message + file-request +
   * file-grant). Given the identity so the handlers can re-verify against this
   * device's own state. The SAME handler shape the foreground drain uses, so the
   * background and foreground paths cannot drift (guardrail: one dispatcher).
   */
  buildHandlers: (identity: DeviceIdentity) => MailboxEnvelopeHandlers;
  /**
   * Build the community-derived extra drain tokens (P7): an owner's join-request
   * tokens + a pending joiner's join-grant tokens, both addressed to this device.
   * Same per-recipient token shape as the foreground drain, so the two paths
   * cannot drift. Optional; omitted in unit tests that only exercise peer drains.
   */
  buildExtraTokens?: (identity: DeviceIdentity) => { token: string; label: string }[];
  /** Build the engine to drive for the opportunistic listen (lazy: only when listening). */
  buildEngine?: (identity: DeviceIdentity) => Promise<SyncSessionEngine>;
  /**
   * Run a bounded opportunistic relay listen after draining. Off by default;
   * the drain is the honest background win that works with no peer online.
   */
  opportunisticListen?: boolean;
  /**
   * Plan 29 P4 graduation: the composed auto-connect session round to run AFTER
   * the drain (same seam as the foreground round). Injected by the expo wiring
   * with a gossip:true engine + `runAutoConnectJob`; a bounded no-op when no peer
   * is reachable. Omitted on the unit-test / drain-only path. NEVER flips
   * background_sync_enabled (NC-4): this only executes real sessions.
   */
  runComposedSessions?: (identity: DeviceIdentity) => Promise<AutoConnectRoundResult>;
  /** Injectable clock (ISO) for the recorded run timestamp. */
  now?: () => string;
}

/**
 * Resolve drain peers from the real paired-device rows: active, non-revoked,
 * not self, with a recoverable shared secret. Revoked / secret-missing peers
 * resolve to a null secret so the drain job skips them without deriving a token.
 */
export function resolveDrainPeers(db: DatabaseAdapter, selfDeviceId: string): MailboxDrainPeer[] {
  return getPairedDevices(db)
    .filter((peer: PairedDevice) => peer.deviceId !== selfDeviceId)
    .map((peer: PairedDevice) => {
      const revoked = isDeviceRevoked(db, peer.deviceId);
      const sharedSecretHex = !revoked && peer.sharedSecretRef
        ? getSharedSecretHex(peer.sharedSecretRef)
        : null;
      return {
        deviceId: peer.deviceId,
        pairSharedSecretHex: sharedSecretHex,
        revoked,
        isActive: peer.isActive,
      };
    });
}

/**
 * The pure background-sync core. Configures crypto first, reconstructs
 * identity, reads relay config, drains mailboxes, optionally runs a bounded
 * listen. Returns honest counts; records nothing when no relay is configured.
 */
export async function runBackgroundSyncCore(
  deps: RunBackgroundSyncCoreDeps,
): Promise<BackgroundSyncResult> {
  // MK-001: crypto plumbing BEFORE any identity/seal call.
  deps.configureCrypto();

  const identity = deps.getIdentity();
  if (!identity) {
    return { ran: false, applied: 0, fileRequests: 0, fileGrants: 0, publicJoinRequests: 0, reason: 'No device identity.' };
  }

  const relayUrl = await ensureEffectiveRelayUrl(deps.db);
  if (!relayUrl.startsWith('ws')) {
    // No relay configured: nothing to drain, nothing recorded.
    return { ran: false, applied: 0, fileRequests: 0, fileGrants: 0, publicJoinRequests: 0, reason: 'No connection server URL configured.' };
  }

  const peers = resolveDrainPeers(deps.db, identity.publicKey);
  const drain = await runMailboxDrainJob({
    identity,
    backend: deps.backend,
    relayUrl,
    peers,
    handlers: deps.buildHandlers(identity),
    extraTokens: deps.buildExtraTokens?.(identity),
  });

  // Plan 29 P4 graduation: run the composed auto-connect session round (the SAME
  // seam as the foreground round) after the drain. Bounded + honest: runAutoConnectJob
  // is a no-op without a reachable peer, and the gossip phase rides inside the
  // gossip:true engine sessions the wiring builds. Never flips any flag (NC-4).
  let composedSessions: AutoConnectRoundResult | undefined;
  if (deps.runComposedSessions) {
    composedSessions = await deps.runComposedSessions(identity);
  }

  let listen: SyncSessionJobResult | undefined;
  if (deps.opportunisticListen && deps.buildEngine) {
    const phrase = getSetting(deps.db, RELAY_PHRASE_SETTING_KEY)?.trim() ?? '';
    const firstPeer = peers.find((p) => !p.revoked && p.isActive && p.pairSharedSecretHex);
    if (phrase && firstPeer) {
      const engine = await deps.buildEngine(identity);
      listen = await runSyncSessionJob({
        backend: deps.backend,
        relayUrl,
        token: buildRendezvousToken(phrase),
        peerDeviceId: firstPeer.deviceId,
        role: 'listen',
        engine,
      });
    }
  }

  const now = deps.now ?? (() => new Date().toISOString());
  // A real run happened (a drain was attempted against a configured relay);
  // record only this real timestamp, never a fabricated "synced" claim.
  setSettingSafe(deps.db, LAST_BACKGROUND_RUN_SETTING_KEY, now());

  return {
    ran: true,
    drain,
    listen,
    composedSessions,
    applied: drain.applied,
    fileRequests: drain.fileRequests,
    fileGrants: drain.fileGrants,
    publicJoinRequests: drain.publicJoinRequests,
  };
}

function setSettingSafe(db: DatabaseAdapter, key: string, value: string): void {
  db.execute('INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)', [key, value]);
}

/** Whether the user has opted into background sync (dev-build flag, default off). */
export function isBackgroundSyncEnabled(db: DatabaseAdapter): boolean {
  return getSetting(db, BACKGROUND_SYNC_ENABLED_SETTING_KEY) === 'true';
}

export function setBackgroundSyncEnabled(db: DatabaseAdapter, enabled: boolean): void {
  setSettingSafe(db, BACKGROUND_SYNC_ENABLED_SETTING_KEY, enabled ? 'true' : 'false');
}

export function getLastBackgroundRunAt(db: DatabaseAdapter): string | null {
  return getSetting(db, LAST_BACKGROUND_RUN_SETTING_KEY);
}

/**
 * Thin expo wiring around the core. Lazy-loads the shared db boot + the native
 * relay backend so Node/Vitest never imports expo. The debug button and the
 * (deferred) scheduler/push handlers call this. Returns the honest result so
 * the caller can decide whether to surface a "message received" notification
 * (ONLY when applied > 0).
 */
export async function runBackgroundSyncOnce(): Promise<BackgroundSyncResult> {
  // Lazy imports: this whole function is never reached from the test path.
  const [{ getMeerkatDatabase, ensureNativeSyncPrng, ensureNativeSyncSecretStore }, sync] =
    await Promise.all([
      import('./meerkat-db'),
      import('@mylife/sync'),
    ]);
  const {
    NativeSyncEngine,
    runAutoConnectJob,
    connectRelayPeer,
    getSharedSecretHex: getSharedSecretHexFn,
    isDeviceRevoked: isDeviceRevokedFn,
    processJoinRequest,
    applyJoinGrant,
    applyMemberRemoval,
    listCommunities,
    communityRole,
    deriveCommunityJoinToken,
    deriveCommunityRemovalToken,
    deriveDmGroupCommitToken,
    derivePublicJoinToken,
    transportAllowedForCommunity,
  } = sync;
  const { getIdentityRow } = await import('./db');
  const { createMeerkatRelayBackend } = await import('./hosted-relay');
  const { ExpoBlobStore } = await import('./expo-blob-store');
  const { buildFileMailboxHandlers, isActiveCommunityMember } = await import('./file-request-core');
  const { buildHistoryBackfillHandlers } = await import('./history-backfill-core');
  const { recordPublicJoinRequests } = await import('./community-core');
  const { buildHumanityRedeemClient, humanityServiceConfig } = await import('./humanity-core');
  const { listOwnedPublications, getCurrentPublicationDescriptor } = await import('./public-publish');
  const { buildDmMailboxHandlers, buildDmGroupMailboxHandlers, buildDmShredHandler } = await import('./dm-provider-core');
  const { listDmConversations } = await import('./dm-core');
  const { isCommunityMuted } = await import('./community-safety');
  const { getCommunityNotificationSoundId, resolveVerifiedCommunityIdentity } = await import('./notification-prefs');
  const { MEERKAT_SYNC_PREFIXES, MEERKAT_SYNC_MODULE_ID, MEERKAT_SYNC_POLICIES, MEERKAT_KEYS_MODULE_ID } = await import('./sync-core');
  const { COMMUNITY_MODULE_ID } = await import('./community-core');

  const db = getMeerkatDatabase();
  const storedIdentity = getIdentityRow(db);
  const relayIdentity = storedIdentity ? {
    publicKey: storedIdentity.public_key, privateKeyRef: storedIdentity.private_key_ref,
    dhPublicKey: storedIdentity.dh_public_key, displayName: storedIdentity.display_name,
    createdAt: storedIdentity.created_at,
  } : null;
  if (!relayIdentity) return { ran: false, reason: 'No device identity.', applied: 0, fileRequests: 0, fileGrants: 0, publicJoinRequests: 0 };
  const relayBackend = (): RelayBackend => {
    if (!relayIdentity) throw new Error('Meerkat identity is not ready.');
    return createMeerkatRelayBackend(relayIdentity);
  };
  const blobStore = new ExpoBlobStore(db);
  const relayUrl = await ensureEffectiveRelayUrl(db);

  // Plan 38 C.10: tally REAL per-community channel inserts so the notification
  // step can attribute applied messages to the right community. The channelMessage
  // handler comes from buildFileMailboxHandlers; wrap it here (identity-independent).
  const appliedTally = new Map<string, number>();
  const fileHandlers = buildFileMailboxHandlers({
    db,
    blobStore,
    isActiveMember: (communityId, deviceId) => isActiveCommunityMember(db, communityId, deviceId),
  });
  const tallyingFileHandlers: typeof fileHandlers = {
    ...fileHandlers,
    channelMessage: fileHandlers.channelMessage
      ? tallyChannelMessages(fileHandlers.channelMessage, appliedTally)
      : undefined,
  };

  // Resolve a peer's DH key + shared secret for the history SERVE side. Null when
  // the peer is revoked / not paired / has no secret, so the serve side cannot
  // address it and drops fail-closed.
  const resolvePeer = (deviceId: string): { dhPublicKey: string; sharedSecretHex: string } | null => {
    if (isDeviceRevokedFn(db, deviceId)) return null;
    const peer = getPairedDevice(db, deviceId);
    if (!peer || !peer.isActive || !peer.dhPublicKey || !peer.sharedSecretRef) return null;
    const sharedSecretHex = getSharedSecretHexFn(peer.sharedSecretRef);
    if (!sharedSecretHex) return null;
    return { dhPublicKey: peer.dhPublicKey, sharedSecretHex };
  };

  // Park a sealed backfill grant on the requester's mailbox token. A fresh
  // backend per park (mirrors the foreground parkEnvelopeOnRelay). Returns true
  // only on a real park, so the serve counter is honest.
  const parkEnvelope = async (token: string, envelope: MailboxEnvelope): Promise<boolean> => {
    if (!relayUrl.startsWith('ws')) return false;
    const backend = relayBackend();
    try {
      const session = await backend.connect(relayUrl, token);
      try {
        await session.send(encodeMailboxEnvelope(envelope));
        return true;
      } finally {
        await session.close();
      }
    } catch {
      return false;
    } finally {
      backend.destroy();
    }
  };

  const result = await runBackgroundSyncCore({
    db,
    configureCrypto: () => {
      // getMeerkatDatabase already configured these in the MK-001 order; this is
      // an idempotent safety net so the boot-order invariant holds even if a
      // future caller reaches the core before opening the db.
      ensureNativeSyncPrng();
      ensureNativeSyncSecretStore();
    },
    getIdentity: () => {
      const row = getIdentityRow(db);
      if (!row) return null;
      return {
        publicKey: row.public_key,
        privateKeyRef: row.private_key_ref,
        dhPublicKey: row.dh_public_key,
        displayName: row.display_name,
        createdAt: row.created_at,
      };
    },
    backend: relayBackend(),
    // Plan 29 P4 graduation: the composed auto-connect session round. Builds a
    // gossip:true engine (so each session runs the signed-revocation/descriptor
    // gossip phase, AM11) and runs the SAME runAutoConnectJob the foreground round
    // uses, relay-only (no LAN discovery in a headless run). Bounded + honest:
    // runAutoConnectJob is a no-op without a reachable peer, and the engine is
    // built + destroyed per round so a headless run holds no engine open.
    runComposedSessions: async (bgIdentity) => {
      const engine = new NativeSyncEngine({
        db,
        identity: bgIdentity,
        modulePrefixes: MEERKAT_SYNC_PREFIXES,
        enabledModules: [MEERKAT_SYNC_MODULE_ID, COMMUNITY_MODULE_ID, MEERKAT_KEYS_MODULE_ID],
        modulePolicies: MEERKAT_SYNC_POLICIES,
        isOwnDevice: (peerId) => isMeerkatOwnSyncDevice(db, bgIdentity.publicKey, peerId),
        blobProvider: blobStore,
        gossip: true,
      });
      await engine.initialize();
      try {
        return await runAutoConnectJob({
          db,
          selfDeviceId: bgIdentity.publicKey,
          engine,
          relayUrl,
          relayBackendFactory: () => relayBackend(),
          resolvePeerSecret: (deviceId) => resolvePeer(deviceId)?.sharedSecretHex ?? null,
          discoveredPeers: new Set<string>(),
          connectRelay: (opts) => connectRelayPeer(opts),
        });
      } finally {
        await engine.destroy();
      }
    },
    // The SAME handler set the foreground drain uses (channel-message +
    // file-request + file-grant + history backfill serve/apply + P7 join
    // request/grant + Plan 21 Phase 4 DM message/receipt), so the two paths
    // cannot drift. The background owner-serve omits recordChange (no engine
    // session here): the grant carries B's wraps directly, and other
    // already-paired members pick up the new epoch over a later engine session.
    buildHandlers: (identity) => ({
      ...tallyingFileHandlers,
      ...buildHistoryBackfillHandlers({ db, identity, resolvePeer, parkEnvelope }),
      ...processJoinRequest({ db, owner: identity, parkEnvelope }),
      ...applyJoinGrant({ db, self: identity }),
      // Plan 28 P2: APPLY side (survivor) of a community member removal (same
      // handler the foreground drain composes, so the two paths cannot drift).
      ...applyMemberRemoval({ db, self: identity }),
      // Plan 19 FF3: SERVE side (owner) records a verified public-join request
      // into the local review queue. NEVER auto-approves. AM1/AM2: the humanity
      // redeem gate runs here too, so a token replayed while the app is
      // backgrounded is caught (single-use) exactly as in the foreground drain.
      ...recordPublicJoinRequests({
        db,
        owner: identity,
        redeem: buildHumanityRedeemClient(humanityServiceConfig()) ?? undefined,
        servicePublicKeyHex: humanityServiceConfig().servicePublicKeyHex,
      }),
      // Plan 21 Phase 4: apply an inbound 1:1 DM message/receipt. The SAME
      // resolvePeer the history-backfill serve side uses supplies both the
      // DH key (bootstrapping a new participant row) and the pairing secret
      // (re-sealing a receipt onward to this user's own other devices).
      ...buildDmMailboxHandlers({
        db,
        identity,
        resolvePeerDhKey: (deviceId) => resolvePeer(deviceId)?.dhPublicKey ?? null,
        resolvePairSecret: (deviceId) => resolvePeer(deviceId)?.sharedSecretHex ?? null,
        parkEnvelope,
        // Plan 21 Phase 8: verify-then-pin inbound attachment blobs (mirrors the foreground drain).
        pinAttachments: async (hash, bytes, mimeType) => { await blobStore.put(hash, bytes, { moduleId: 'dm', mimeType }); },
      }),
      // Plan 21 Phase 7: apply an inbound group-DM epoch commit handoff (same
      // handler the foreground drain uses, so the two paths cannot drift).
      ...buildDmGroupMailboxHandlers({ db, identity }),
      // Plan 21 Phase 8: apply a verified author-signed DM shred (delete local
      // rows + cached blobs), mirroring the foreground drain.
      ...buildDmShredHandler({ db, identity, deleteBlob: async (hash) => { await blobStore.removeLocal(hash); } }),
      // Plan 29 P6: APPLY a verified, FRESH presence beacon (dispatch already
      // verified envelope + beacon signature + freshness + roster binding). Records
      // device-local only; never replicated. Mirrors the foreground drain.
      presenceBeacon: (_senderDeviceId, beacon) => {
        recordPresenceBeacon(db, beacon);
        return true;
      },
    }),
    // Drain my own community join tokens (owner: incoming requests; pending
    // joiner: the owner's grant back to me). Same per-recipient token shape.
    //
    // Plan 19 FF3 delivery fix (parity with the foreground resolveJoinExtraTokens
    // + web, commit 947642f6): ALSO drain the public-join token of every owned,
    // ACTIVE, advertised publication, the DISTINCT mailbox the joiner parks its
    // request on (derivePublicJoinToken), so the headless owner drain records
    // requests too. Byte-parallel with the foreground derivation.
    buildExtraTokens: (identity) => {
      const tokens: { token: string; label: string }[] = [];
      for (const community of listCommunities(db)) {
        const d = community.descriptor;
        // Plan 27 P2 (AC-2): a local_only community's mailboxes never touch the
        // relay -- not even its opaque rendezvous tokens (parity with the
        // foreground resolveJoinExtraTokens).
        if (!transportAllowedForCommunity(db, d.communityId, 'wan_relay')) continue;
        const role = communityRole(d, identity.publicKey);
        if (role === 'owner') {
          tokens.push({
            token: deriveCommunityJoinToken(d.genesisNonce, d.communityId, identity.publicKey),
            label: `join-request:${d.communityId}`,
          });
        } else if (role === null) {
          tokens.push({
            token: deriveCommunityJoinToken(d.genesisNonce, d.communityId, identity.publicKey),
            label: `join-grant:${d.communityId}`,
          });
        }
        // Plan 28 P2: every LISTED member drains its own member-removal token,
        // re-derived from persisted community state (parity with the foreground
        // resolveJoinExtraTokens; a token nobody polls never delivers).
        if (role !== null) {
          tokens.push({
            token: deriveCommunityRemovalToken(d.genesisNonce, d.communityId, identity.publicKey),
            label: `member-removal:${d.communityId}`,
          });
        }
      }
      // Public-join request mailboxes for this device's owned advertised
      // publications (the token the joiner actually parks its request on).
      for (const pub of listOwnedPublications(db, identity.publicKey)) {
        if (pub.status !== 'active') continue;
        const signed = getCurrentPublicationDescriptor(db, pub.publicationId);
        const grantId = signed?.descriptor.publicJoin?.grantId;
        if (!grantId) continue;
        tokens.push({
          token: derivePublicJoinToken(pub.publicationId, grantId, identity.publicKey),
          label: `public-join:${pub.publicationId}`,
        });
      }
      // Plan 21 Phase 7: drain each group DM's commit token so a member learns a
      // new epoch even from a headless background run (parity with the foreground
      // resolveJoinExtraTokens; a token nobody polls never delivers).
      for (const conv of listDmConversations(db, { includeArchived: true })) {
        if (conv.kind !== 'group') continue;
        tokens.push({
          token: deriveDmGroupCommitToken(conv.id, identity.publicKey),
          label: `dm-group-commit:${conv.id}`,
        });
      }
      return tokens;
    },
  });

  // Plan 29 P6: drop presence beacons whose TTL elapsed (honest freshness).
  prunePresenceBeacons(db);

  // Plan 38 C.10: attach the real per-community tally + ready-to-emit notification
  // content. buildCommunityNotifications enforces applied > 0 and skips muted
  // communities; the identity is verified-only. The OS emission (task/push wake)
  // reads result.notifications so it never touches the db.
  const appliedByCommunity = [...appliedTally].map(([communityId, applied]) => ({ communityId, applied }));
  result.appliedByCommunity = appliedByCommunity;
  result.notifications = buildCommunityNotifications(
    appliedByCommunity.map(({ communityId, applied }) => ({
      communityId,
      applied,
      identity: resolveVerifiedCommunityIdentity(db, communityId),
      prefs: { soundPresetId: getCommunityNotificationSoundId(db, communityId) },
      muted: isCommunityMuted(db, communityId),
    })),
  );
  return result;
}
