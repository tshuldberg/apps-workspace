export interface OAuthPendingConnect {
  stateHash: string;
  codeChallenge: string;
  subjectId: string;
  provider: string;
  destinationLabel: string;
  redirectUri: string;
  createdAt: string;
  expiresAt: string;
}

export interface OAuthVaultRecord {
  vaultId: string;
  provider: string;
  subjectId: string;
  encryptedRefreshToken: Uint8Array;
  wrappedDataKey: Uint8Array;
  nonce: Uint8Array;
  accountHint: string | null;
  scopes: readonly string[];
  createdAt: string;
}

export interface OAuthBrokerSessionRecord {
  sessionId: string;
  vaultId: string;
  provider: string;
  subjectId: string;
  destinationId: string;
  operations: readonly string[];
  createdAt: string;
  expiresAt: string;
}

export type OAuthBrokerAuditAction =
  | 'connect_start'
  | 'connect_complete'
  | 'session_issue'
  | 'revoke'
  | 'account_delete'
  | 'credential_put'
  | 'credential_session'
  | 'credential_revoke';

export interface OAuthBrokerAuditEvent {
  auditId: string;
  subjectId: string;
  action: OAuthBrokerAuditAction;
  outcome: 'success' | 'failure';
  provider: string | null;
  vaultId: string | null;
  destinationId: string | null;
  operation: string | null;
  detailCode: string | null;
  createdAt: string;
}

export interface OAuthBrokerStore {
  readonly available: boolean;
  putPendingConnect(record: OAuthPendingConnect): Promise<void>;
  consumePendingConnect(stateHash: string): Promise<OAuthPendingConnect | null>;
  putVault(record: OAuthVaultRecord): Promise<void>;
  replaceVault(record: OAuthVaultRecord): Promise<boolean>;
  getVault(vaultId: string, subjectId: string): Promise<OAuthVaultRecord | null>;
  takeVault(vaultId: string, subjectId: string): Promise<OAuthVaultRecord | null>;
  takeVaultsForSubject(subjectId: string): Promise<OAuthVaultRecord[]>;
  recordSession(record: OAuthBrokerSessionRecord): Promise<void>;
  appendAudit(event: OAuthBrokerAuditEvent): Promise<void>;
}

export class OAuthBrokerStoreUnavailableError extends Error {
  readonly code = 'oauth_broker_store_unavailable';

  constructor() {
    super('OAuth broker state authority is unavailable');
    this.name = 'OAuthBrokerStoreUnavailableError';
  }
}

function cloneBytes(value: Uint8Array): Uint8Array {
  return value.slice();
}

function clonePending(record: OAuthPendingConnect): OAuthPendingConnect {
  return { ...record };
}

function cloneVault(record: OAuthVaultRecord): OAuthVaultRecord {
  return {
    ...record,
    encryptedRefreshToken: cloneBytes(record.encryptedRefreshToken),
    wrappedDataKey: cloneBytes(record.wrappedDataKey),
    nonce: cloneBytes(record.nonce),
    scopes: [...record.scopes],
  };
}

/** In-memory authority for tests. Production uses the PostgreSQL store. */
export class InMemoryOAuthBrokerStore implements OAuthBrokerStore {
  readonly available = true;
  private readonly pending = new Map<string, OAuthPendingConnect>();
  private readonly vaults = new Map<string, OAuthVaultRecord>();
  private readonly sessions: OAuthBrokerSessionRecord[] = [];
  private readonly audits: OAuthBrokerAuditEvent[] = [];

  async putPendingConnect(record: OAuthPendingConnect): Promise<void> {
    if (this.pending.has(record.stateHash)) throw new Error('OAuth state already exists');
    this.pending.set(record.stateHash, clonePending(record));
  }

  async consumePendingConnect(stateHash: string): Promise<OAuthPendingConnect | null> {
    const record = this.pending.get(stateHash);
    if (!record) return null;
    this.pending.delete(stateHash);
    return clonePending(record);
  }

  async putVault(record: OAuthVaultRecord): Promise<void> {
    if (this.vaults.has(record.vaultId)) throw new Error('OAuth vault already exists');
    this.vaults.set(record.vaultId, cloneVault(record));
  }

  async replaceVault(record: OAuthVaultRecord): Promise<boolean> {
    const current = this.vaults.get(record.vaultId);
    if (!current || current.subjectId !== record.subjectId || current.provider !== record.provider) return false;
    this.vaults.set(record.vaultId, cloneVault(record));
    return true;
  }

  async getVault(vaultId: string, subjectId: string): Promise<OAuthVaultRecord | null> {
    const record = this.vaults.get(vaultId);
    return record?.subjectId === subjectId ? cloneVault(record) : null;
  }

  async takeVault(vaultId: string, subjectId: string): Promise<OAuthVaultRecord | null> {
    const record = this.vaults.get(vaultId);
    if (!record || record.subjectId !== subjectId) return null;
    this.vaults.delete(vaultId);
    this.removeSessionsForVaults(new Set([vaultId]));
    return cloneVault(record);
  }

  async takeVaultsForSubject(subjectId: string): Promise<OAuthVaultRecord[]> {
    const records: OAuthVaultRecord[] = [];
    const removed = new Set<string>();
    for (const [vaultId, record] of this.vaults) {
      if (record.subjectId !== subjectId) continue;
      this.vaults.delete(vaultId);
      removed.add(vaultId);
      records.push(cloneVault(record));
    }
    this.removeSessionsForVaults(removed);
    return records;
  }

  async recordSession(record: OAuthBrokerSessionRecord): Promise<void> {
    this.sessions.push({ ...record, operations: [...record.operations] });
  }

  async appendAudit(event: OAuthBrokerAuditEvent): Promise<void> {
    this.audits.push({ ...event });
  }

  snapshotVaults(): OAuthVaultRecord[] {
    return [...this.vaults.values()].map(cloneVault);
  }

  snapshotSessions(): OAuthBrokerSessionRecord[] {
    return this.sessions.map((record) => ({ ...record, operations: [...record.operations] }));
  }

  snapshotAudits(): OAuthBrokerAuditEvent[] {
    return this.audits.map((event) => ({ ...event }));
  }

  private removeSessionsForVaults(vaultIds: ReadonlySet<string>): void {
    if (vaultIds.size === 0) return;
    for (let index = this.sessions.length - 1; index >= 0; index -= 1) {
      if (vaultIds.has(this.sessions[index]!.vaultId)) this.sessions.splice(index, 1);
    }
  }
}
