/**
 * Top-level sync coordinator.
 *
 * Orchestrates device discovery, connection, handshake, CRDT sync,
 * and blob transfer across all enabled modules. This is the main
 * entry point for the sync system.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type {
  DeviceIdentity,
  DiscoveredPeer,
  PairedDevice,
  ShareRequest,
  SyncScope,
  SyncSecurityPreference,
  SyncTier,
  SyncTransport,
  TransportConnection,
} from '../types';
import { isScopeWithinMaxScope } from '../types';
import { DocumentManager } from '../crdt/document-manager';
import { ChangeTracker } from '../crdt/change-tracker';
import { TransportManager } from '../transport/transport-manager';
import { SyncScheduler } from './sync-scheduler';
import { SyncStatusStore } from './sync-status';
import {
  rankMutualTransportPreferences,
  runInitiatorSession,
  runResponderSession,
} from '../protocol/sync-session';
import type { SessionBlobProvider } from '../protocol/blob-transfer';
import { runShareSession } from '../protocol/share-session';
import {
  createSessionPayloadSecurity,
  resolvePayloadEncryptionKey,
} from '../protocol/payload-security';
import * as dbQueries from '../db/queries';
import { pruneExpiredEntities } from '../expiry/disappearing-messages';

export interface SyncEngineOptions {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  /** Module ID to table prefix mapping. */
  modulePrefixes: Map<string, string>;
  /** List of enabled module IDs. */
  enabledModules: string[];
  /** Per-module sync policies from ModuleDefinition.syncPolicy. */
  modulePolicies?: Map<string, ModuleSyncPolicy>;
  /** App-provided storage for blob bytes referenced by synced rows. */
  blobProvider?: SessionBlobProvider;
  /** User sync tier for transport access control. */
  syncTier?: SyncTier;
  /**
   * Enable the session gossip phase (Plan 27/28 P4, AM6): every session
   * exchanges signed revocations + community descriptors before BYE so
   * removals/revocations converge. Default false (session timing unchanged).
   */
  gossip?: boolean;
  /** Optional custom scheduler options. */
  schedulerOptions?: {
    minIntervalMs?: number;
    maxIntervalMs?: number;
    activeIntervalMs?: number;
  };
}

interface SessionSecurityContext {
  securityPreference?: SyncSecurityPreference;
  workspaceId?: string;
}

function encryptionRank(mode: SyncSecurityPreference['encryptionMode']): number {
  switch (mode) {
    case 'required':
      return 2;
    case 'opportunistic':
      return 1;
    case 'off':
      return 0;
  }
}

function strictestEncryptionMode(
  a: SyncSecurityPreference['encryptionMode'],
  b: SyncSecurityPreference['encryptionMode'],
): SyncSecurityPreference['encryptionMode'] {
  return encryptionRank(a) >= encryptionRank(b) ? a : b;
}

function selectDisappearAfterSeconds(
  direct: SyncSecurityPreference,
  workspace: SyncSecurityPreference,
): number | null {
  const values = [direct, workspace]
    .filter((pref) => pref.disappearingMessagesEnabled)
    .map((pref) => pref.disappearAfterSeconds)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function mergeSessionSecurityPreference(
  direct: SyncSecurityPreference | undefined,
  workspace: SyncSecurityPreference | undefined,
): SyncSecurityPreference | undefined {
  if (!direct) return workspace;
  if (!workspace) return direct;

  const workspaceContributes =
    encryptionRank(workspace.encryptionMode) > encryptionRank(direct.encryptionMode)
    || (workspace.disappearingMessagesEnabled && !direct.disappearingMessagesEnabled)
    || (
      workspace.disappearingMessagesEnabled
      && direct.disappearingMessagesEnabled
      && workspace.disappearAfterSeconds !== null
      && (
        direct.disappearAfterSeconds === null
        || workspace.disappearAfterSeconds < direct.disappearAfterSeconds
      )
    );
  const base = workspaceContributes ? workspace : direct;
  const disappearingMessagesEnabled =
    direct.disappearingMessagesEnabled || workspace.disappearingMessagesEnabled;

  return {
    subjectType: base.subjectType,
    subjectId: base.subjectId,
    encryptionMode: strictestEncryptionMode(direct.encryptionMode, workspace.encryptionMode),
    disappearingMessagesEnabled,
    disappearAfterSeconds: disappearingMessagesEnabled
      ? selectDisappearAfterSeconds(direct, workspace)
      : null,
    updatedAt: direct.updatedAt > workspace.updatedAt ? direct.updatedAt : workspace.updatedAt,
  };
}

function securityPreferenceScore(pref: SyncSecurityPreference): number {
  return encryptionRank(pref.encryptionMode) * 10
    + (pref.disappearingMessagesEnabled ? 5 : 0)
    - (pref.disappearAfterSeconds ? Math.min(pref.disappearAfterSeconds, 86_400) / 86_400 : 0);
}

/**
 * Main sync engine coordinating all subsystems.
 */
export class SyncEngine {
  private readonly _db: DatabaseAdapter;
  private readonly _identity: DeviceIdentity;
  private readonly _enabledModules: string[];
  private readonly _modulePolicies: Map<string, ModuleSyncPolicy>;
  private readonly _blobProvider?: SessionBlobProvider;
  private readonly _gossip: boolean;
  private readonly _documentManager: DocumentManager;
  private readonly _changeTracker: ChangeTracker;
  private readonly _transportManager: TransportManager;
  private readonly _scheduler: SyncScheduler;
  private readonly _statusStore: SyncStatusStore;
  private _initialized: boolean = false;
  private _destroyed: boolean = false;

  constructor(options: SyncEngineOptions) {
    this._db = options.db;
    this._identity = options.identity;
    this._enabledModules = [...options.enabledModules];
    this._modulePolicies = options.modulePolicies ?? new Map();
    this._blobProvider = options.blobProvider;
    this._gossip = options.gossip ?? false;

    this._documentManager = new DocumentManager();

    this._changeTracker = new ChangeTracker({
      db: options.db,
      deviceId: options.identity.publicKey,
      modulePrefixes: options.modulePrefixes,
      modulePolicies: this._modulePolicies,
      onChangeRecorded: () => {
        const count = this._changeTracker.getPendingCount();
        this._statusStore.setPendingChanges(count);
        this._scheduler.notifyChanges(count);
      },
    });

    this._transportManager = new TransportManager({
      deviceId: options.identity.publicKey,
      displayName: options.identity.displayName,
      onPeerDiscovered: (peer) => this._handlePeerDiscovered(peer),
      onPeerLost: (deviceId) => this._handlePeerLost(deviceId),
      onConnection: (conn) => this._handleIncomingConnection(conn),
      syncTier: options.syncTier,
    });

    this._scheduler = new SyncScheduler(options.schedulerOptions);
    this._statusStore = new SyncStatusStore();
  }

  /** Initialize the sync engine. Must be called before any sync operations. */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._assertNotDestroyed();

    this._statusStore.setState('discovering');

    // Initialize transport
    await this._transportManager.initialize();

    // Auto-create personal workspace on first launch
    const workspaces = dbQueries.getWorkspaces(this._db);
    const hasPersonal = workspaces.some((w) => w.workspaceType === 'personal');
    if (!hasPersonal) {
      const now = new Date().toISOString();
      const wsId = `ws_personal_${this._identity.publicKey.slice(0, 8)}`;
      dbQueries.createWorkspace(this._db, {
        id: wsId,
        displayName: 'Personal',
        workspaceType: 'personal',
        createdByDeviceId: this._identity.publicKey,
        createdAt: now,
        rotatedAt: null,
        currentKeyVersion: 1,
        archivedAt: null,
      });
      dbQueries.addWorkspaceMember(this._db, {
        workspaceId: wsId,
        deviceId: this._identity.publicKey,
        role: 'owner',
        invitedByDeviceId: this._identity.publicKey,
        invitedAt: now,
        removedAt: null,
      });
    }

    // Load paired devices count
    const paired = dbQueries.getPairedDevices(this._db);
    this._statusStore.setPairedDeviceCount(paired.length);

    // Load pending changes
    const pendingCount = this._changeTracker.getPendingCount();
    this._statusStore.setPendingChanges(pendingCount);

    // Start the sync scheduler
    this._scheduler.start(() => this._runSyncCycle());

    this._initialized = true;
    this._statusStore.setState('idle');
  }

  /** Trigger an immediate sync with all connected peers. */
  async syncNow(): Promise<void> {
    this._assertInitialized();
    await this._scheduler.syncNow();
  }

  /** Record a change from a module's SQLite write. */
  recordChange(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    rowId: string,
    data: Record<string, unknown> | null,
  ): void {
    this._assertInitialized();
    this._changeTracker.recordChange(table, operation, rowId, data);

    // Update the CRDT document through the SAME outbound scope + column filter
    // as the change log, so device_local rows and stripped columns never reach
    // the document (and therefore never the wire).
    const { moduleId, include, data: filteredData } = this._changeTracker.filterForSync(table, operation, data);
    if (moduleId && include) {
      this._documentManager.applyChange(moduleId, {
        table,
        rowId,
        operation,
        data: filteredData,
      });
    }
  }

  /** Pause syncing (e.g., app backgrounded). */
  pause(): void {
    this._scheduler.pause();
    this._statusStore.setState('idle');
  }

  /** Resume syncing. */
  resume(): void {
    this._scheduler.resume();
  }

  /** Get the current sync status. */
  getStatus(): ReturnType<SyncStatusStore['getStatus']> {
    return this._statusStore.getStatus();
  }

  /** Get the status store for React hook binding. */
  getStatusStore(): SyncStatusStore {
    return this._statusStore;
  }

  /** Get a copy of the registered module sync policies. */
  getModulePolicies(): Map<string, ModuleSyncPolicy> {
    return new Map(this._modulePolicies);
  }

  /** Get the change tracker. */
  getChangeTracker(): ChangeTracker {
    return this._changeTracker;
  }

  /** Get the document manager. */
  getDocumentManager(): DocumentManager {
    return this._documentManager;
  }

  /** Get discovered peers. */
  getDiscoveredPeers(): DiscoveredPeer[] {
    return this._transportManager.getDiscoveredPeers();
  }

  /** Get paired devices from the database. */
  getPairedDevices(): PairedDevice[] {
    return dbQueries.getPairedDevices(this._db);
  }

  /**
   * Share a single entity directly with a specific peer.
   *
   * Uses the transport manager's ranked-choice preference negotiation to
   * find the best mutual transport, then runs a lightweight one-shot
   * share session to deliver the entity.
   */
  async shareEntity(opts: {
    toDeviceId: string;
    moduleId: string;
    tableName: string;
    rowId: string;
    data: Record<string, unknown>;
    workspaceId?: string;
  }): Promise<{ shareId: string; delivered: boolean; transport: SyncTransport | null }> {
    this._assertInitialized();

    const shareId = `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const pairedDevice = dbQueries.getPairedDevice(this._db, opts.toDeviceId);
    if (!pairedDevice?.isActive || dbQueries.isDeviceRevoked(this._db, opts.toDeviceId)) {
      throw new Error('Direct share target must be an active paired device.');
    }

    const filteredData = this._prepareShareData(opts);
    const subjectType = opts.workspaceId ? 'workspace' : 'direct';
    const subjectId = opts.workspaceId ?? opts.toDeviceId;
    const shareKey = resolvePayloadEncryptionKey({
      pairedDevices: [pairedDevice],
      localDeviceId: this._identity.publicKey,
      remoteDeviceId: opts.toDeviceId,
      subjectType,
      subjectId,
    });
    const payloadSecurity = createSessionPayloadSecurity(shareKey, shareKey !== null);
    if (!payloadSecurity.enabled) {
      throw new Error('Direct share requires an encrypted paired-device channel.');
    }

    const share: ShareRequest = {
      id: shareId,
      fromDeviceId: this._identity.publicKey,
      toDeviceId: opts.toDeviceId,
      moduleId: opts.moduleId,
      tableName: opts.tableName,
      rowId: opts.rowId,
      dataJson: JSON.stringify(filteredData),
      workspaceId: opts.workspaceId ?? null,
      status: 'pending',
      transport: null,
      createdAt: now,
      deliveredAt: null,
    };

    // Log the share request
    dbQueries.insertShareRequest(this._db, share);

    // Find the peer and connect via best transport
    try {
      const connection = await this._transportManager.connectToPeer(opts.toDeviceId, {
        preferredLayerIds: this._getPreferredTransportLayerIds(opts.toDeviceId),
      });

      // Update status to sent
      dbQueries.updateShareStatus(this._db, shareId, 'sent', connection.transport);

      // Run the share session
      const result = await runShareSession({
        connection,
        identity: this._identity,
        share,
        payloadSecurity,
      });

      if (result.delivered) {
        dbQueries.markShareDelivered(this._db, shareId);
      } else {
        dbQueries.updateShareStatus(this._db, shareId, 'failed');
      }

      await connection.close();

      return { shareId, delivered: result.delivered, transport: connection.transport };
    } catch {
      dbQueries.updateShareStatus(this._db, shareId, 'failed');
      return { shareId, delivered: false, transport: null };
    }
  }

  /** Get share history from the local database. */
  getShareHistory(limit?: number): ShareRequest[] {
    return dbQueries.getShareHistory(this._db, limit);
  }

  /** Shut down the sync engine and release all resources. */
  async destroy(): Promise<void> {
    if (this._destroyed) return;
    this._destroyed = true;
    this._scheduler.stop();
    await this._transportManager.destroy();
    this._statusStore.setState('idle');
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async _runSyncCycle(): Promise<void> {
    try {
      pruneExpiredEntities(this._db);
    } catch {
      // Expiry cleanup should not block peer sync if an older DB has not
      // created the disappearing-message table yet.
    }

    const connections = this._transportManager.getActiveConnections();
    if (connections.length === 0) {
      // Try to connect to any discovered peers that are paired
      const peers = this._transportManager.getDiscoveredPeers();
      const paired = dbQueries.getPairedDevices(this._db);
      const pairedIds = new Set(paired.filter((p) => p.isActive).map((p) => p.deviceId));

      for (const peer of peers) {
        if (pairedIds.has(peer.deviceId) && !this._transportManager.isConnected(peer.deviceId)) {
          try {
            const conn = await this._transportManager.connectToPeer(peer.deviceId, {
              preferredLayerIds: this._getPreferredTransportLayerIds(peer.deviceId),
            });
            await this._syncWithPeer(conn, paired);
          } catch {
            // Connection failed, will retry next cycle
          }
        }
      }
    } else {
      // Sync with all connected peers
      const paired = dbQueries.getPairedDevices(this._db);
      for (const conn of connections) {
        await this._syncWithPeer(conn, paired);
      }
    }
  }

  private async _syncWithPeer(connection: TransportConnection, pairedDevices: PairedDevice[]): Promise<void> {
    this._statusStore.setState('syncing');
    this._statusStore.setCurrentSession(`sync_${Date.now()}`);

    try {
      const securityContext = this._getSessionSecurityContext(connection.remoteDeviceId);
      const result = await runInitiatorSession(connection, {
        db: this._db,
        identity: this._identity,
        pairedDevices,
        documentManager: this._documentManager,
        changeTracker: this._changeTracker,
        enabledModules: this._enabledModules,
        modulePolicies: this._modulePolicies,
        transport: connection.transport,
        workspaceId: securityContext.workspaceId,
        transportPreferences: dbQueries.getTransportPreferences(this._db, this._identity.publicKey),
        securityPreference: securityContext.securityPreference,
        blobProvider: this._blobProvider,
        gossip: this._gossip,
      });
      this._statusStore.recordSync(result.session.id);
    } catch {
      this._statusStore.setState('error');
    }
  }

  private _handlePeerDiscovered(_peer: DiscoveredPeer): void {
    const onlineCount = this._transportManager.getDiscoveredPeers().length;
    this._statusStore.setOnlineDeviceCount(onlineCount);
  }

  private _handlePeerLost(_deviceId: string): void {
    const onlineCount = this._transportManager.getDiscoveredPeers().length;
    this._statusStore.setOnlineDeviceCount(onlineCount);
  }

  private _handleIncomingConnection(connection: TransportConnection): void {
    void this._respondToIncomingConnection(connection);
  }

  private async _respondToIncomingConnection(connection: TransportConnection): Promise<void> {
    if (this._destroyed) return;

    this._statusStore.setState('syncing');
    this._statusStore.setCurrentSession(`sync_${Date.now()}`);

    try {
      const pairedDevices = dbQueries.getPairedDevices(this._db);
      const securityContext = this._getSessionSecurityContext(connection.remoteDeviceId);
      const result = await runResponderSession(connection, {
        db: this._db,
        identity: this._identity,
        pairedDevices,
        documentManager: this._documentManager,
        changeTracker: this._changeTracker,
        enabledModules: this._enabledModules,
        modulePolicies: this._modulePolicies,
        transport: connection.transport,
        workspaceId: securityContext.workspaceId,
        transportPreferences: dbQueries.getTransportPreferences(this._db, this._identity.publicKey),
        securityPreference: securityContext.securityPreference,
        blobProvider: this._blobProvider,
        gossip: this._gossip,
      });
      this._statusStore.recordSync(result.session.id);
    } catch {
      this._statusStore.setState('error');
    }
  }

  private _getPreferredTransportLayerIds(peerDeviceId: string): number[] {
    const localPrefs = dbQueries.getTransportPreferences(this._db, this._identity.publicKey);
    const peerPrefs = dbQueries.getTransportPreferences(this._db, peerDeviceId);

    if (localPrefs.length > 0 && peerPrefs.length > 0) {
      const mutual = rankMutualTransportPreferences(localPrefs, peerPrefs);
      if (mutual.length > 0) return mutual;
    }

    if (localPrefs.length > 0) {
      return [...localPrefs]
        .filter((pref) => pref.enabled)
        .sort((a, b) => a.rank - b.rank)
        .map((pref) => pref.layerId);
    }

    return [];
  }

  private _prepareShareData(opts: {
    toDeviceId: string;
    moduleId: string;
    tableName: string;
    rowId: string;
    data: Record<string, unknown>;
    workspaceId?: string;
  }): Record<string, unknown> {
    if (!this._enabledModules.includes(opts.moduleId)) {
      throw new Error(`Module ${opts.moduleId} is not enabled for sync.`);
    }

    const policy = this._modulePolicies.get(opts.moduleId);
    if (!policy?.shareable) {
      throw new Error(`Module ${opts.moduleId} does not allow direct sharing.`);
    }

    const entityRule = this._changeTracker.resolveEntityRule(
      opts.moduleId,
      opts.tableName,
      policy,
    );
    const scope = entityRule?.defaultScope ?? policy.defaultScope;
    if (scope === 'device_local' || entityRule?.maxScope === 'device_local') {
      throw new Error(`Table ${opts.tableName} is device-local and cannot be shared.`);
    }

    const requestedShareScope: SyncScope = 'shared_workspace';
    if (entityRule?.maxScope && !isScopeWithinMaxScope(requestedShareScope, entityRule.maxScope)) {
      throw new Error(
        `Table ${opts.tableName} is capped at ${entityRule.maxScope} and cannot be shared directly.`,
      );
    }

    if (opts.workspaceId) {
      const members = dbQueries.getWorkspaceMembers(this._db, opts.workspaceId);
      const hasLocal = members.some((member) => (
        member.deviceId === this._identity.publicKey && member.removedAt === null
      ));
      const hasPeer = members.some((member) => (
        member.deviceId === opts.toDeviceId && member.removedAt === null
      ));
      if (!hasLocal || !hasPeer) {
        throw new Error('Workspace share target must be an active workspace member.');
      }
    }

    if (!entityRule?.stripColumns || entityRule.stripColumns.length === 0) {
      return opts.data;
    }

    const filtered = { ...opts.data };
    for (const col of entityRule.stripColumns) {
      delete filtered[col];
    }
    return filtered;
  }

  private _getSessionSecurityContext(peerDeviceId: string): SessionSecurityContext {
    const directPreference =
      dbQueries.getSecurityPreferenceWithDefault(this._db, 'direct', peerDeviceId)
      ?? undefined;
    const workspacePreference = this._getStrictestSharedWorkspaceSecurityPreference(peerDeviceId);
    const securityPreference = mergeSessionSecurityPreference(directPreference, workspacePreference);

    return {
      securityPreference,
      workspaceId: securityPreference?.subjectType === 'workspace'
        ? securityPreference.subjectId
        : undefined,
    };
  }

  private _getStrictestSharedWorkspaceSecurityPreference(
    peerDeviceId: string,
  ): SyncSecurityPreference | undefined {
    const candidates: SyncSecurityPreference[] = [];
    for (const workspace of dbQueries.getWorkspaces(this._db)) {
      const members = dbQueries.getWorkspaceMembers(this._db, workspace.id);
      const hasLocal = members.some((member) => (
        member.deviceId === this._identity.publicKey && member.removedAt === null
      ));
      const hasPeer = members.some((member) => (
        member.deviceId === peerDeviceId && member.removedAt === null
      ));
      if (!hasLocal || !hasPeer) continue;

      const preference = dbQueries.getSecurityPreference(this._db, 'workspace', workspace.id);
      if (preference) candidates.push(preference);
    }

    return candidates.sort((a, b) => securityPreferenceScore(b) - securityPreferenceScore(a))[0];
  }

  private _assertInitialized(): void {
    if (!this._initialized) throw new Error('SyncEngine not initialized. Call initialize() first.');
    this._assertNotDestroyed();
  }

  private _assertNotDestroyed(): void {
    if (this._destroyed) throw new Error('SyncEngine has been destroyed.');
  }
}
