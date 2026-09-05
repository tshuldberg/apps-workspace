import type { QueryResult, QueryResultRow } from 'pg';
import type {
  OAuthBrokerAuditEvent,
  OAuthBrokerSessionRecord,
  OAuthBrokerStore,
  OAuthPendingConnect,
  OAuthVaultRecord,
} from '../../oauth-broker-store';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

interface PendingRow extends QueryResultRow {
  state_hash: string;
  code_challenge: string;
  subject_id: string;
  provider: string;
  destination_label: string;
  redirect_uri: string;
  created_at: Date | string;
  expires_at: Date | string;
}

interface VaultRow extends QueryResultRow {
  vault_id: string;
  provider: string;
  subject_id: string;
  encrypted_refresh_token: Buffer;
  wrapped_data_key: Buffer;
  nonce: Buffer;
  account_hint: string | null;
  scopes: string[];
  created_at: Date | string;
}

interface VaultIdentityRow extends QueryResultRow {
  vault_id: string;
}

function iso(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('PostgreSQL OAuth timestamp is invalid');
  return parsed.toISOString();
}

function pending(row: PendingRow): OAuthPendingConnect {
  return {
    stateHash: row.state_hash,
    codeChallenge: row.code_challenge,
    subjectId: row.subject_id,
    provider: row.provider,
    destinationLabel: row.destination_label,
    redirectUri: row.redirect_uri,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
  };
}

function vault(row: VaultRow): OAuthVaultRecord {
  if (!(row.encrypted_refresh_token instanceof Uint8Array)
    || !(row.wrapped_data_key instanceof Uint8Array)
    || !(row.nonce instanceof Uint8Array)
    || !Array.isArray(row.scopes)
    || row.scopes.some((scope) => typeof scope !== 'string')) {
    throw new Error('PostgreSQL OAuth vault row is invalid');
  }
  return {
    vaultId: row.vault_id,
    provider: row.provider,
    subjectId: row.subject_id,
    encryptedRefreshToken: new Uint8Array(row.encrypted_refresh_token),
    wrappedDataKey: new Uint8Array(row.wrapped_data_key),
    nonce: new Uint8Array(row.nonce),
    accountHint: row.account_hint,
    scopes: [...row.scopes],
    createdAt: iso(row.created_at),
  };
}

const PENDING_COLUMNS = `state_hash, code_challenge, subject_id, provider,
  destination_label, redirect_uri, created_at, expires_at`;
const VAULT_COLUMNS = `vault_id, provider, subject_id, encrypted_refresh_token,
  wrapped_data_key, nonce, account_hint, scopes, created_at`;

export class PostgresOAuthBrokerStore implements OAuthBrokerStore {
  readonly available = true;

  constructor(private readonly context: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    operation: string,
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.context.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  async putPendingConnect(record: OAuthPendingConnect): Promise<void> {
    await this.query(
      'put OAuth pending connect',
      `INSERT INTO hosted.oauth_pending_connects (${PENDING_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)`,
      [
        record.stateHash,
        record.codeChallenge,
        record.subjectId,
        record.provider,
        record.destinationLabel,
        record.redirectUri,
        record.createdAt,
        record.expiresAt,
      ],
    );
  }

  async consumePendingConnect(stateHash: string): Promise<OAuthPendingConnect | null> {
    const result = await this.query<PendingRow>(
      'consume OAuth pending connect',
      `DELETE FROM hosted.oauth_pending_connects
       WHERE state_hash = $1
       RETURNING ${PENDING_COLUMNS}`,
      [stateHash],
    );
    return result.rows[0] ? pending(result.rows[0]) : null;
  }

  async putVault(record: OAuthVaultRecord): Promise<void> {
    await this.query(
      'put OAuth vault',
      `INSERT INTO hosted.oauth_vaults (${VAULT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::timestamptz)`,
      [
        record.vaultId,
        record.provider,
        record.subjectId,
        Buffer.from(record.encryptedRefreshToken),
        Buffer.from(record.wrappedDataKey),
        Buffer.from(record.nonce),
        record.accountHint,
        [...record.scopes],
        record.createdAt,
      ],
    );
  }

  async replaceVault(record: OAuthVaultRecord): Promise<boolean> {
    const result = await this.query<VaultIdentityRow>(
      'replace OAuth vault credentials',
      `UPDATE hosted.oauth_vaults
       SET encrypted_refresh_token = $4,
           wrapped_data_key = $5,
           nonce = $6,
           account_hint = $7,
           scopes = $8::text[]
       WHERE vault_id = $1 AND subject_id = $2 AND provider = $3
       RETURNING vault_id`,
      [
        record.vaultId,
        record.subjectId,
        record.provider,
        Buffer.from(record.encryptedRefreshToken),
        Buffer.from(record.wrappedDataKey),
        Buffer.from(record.nonce),
        record.accountHint,
        [...record.scopes],
      ],
    );
    return result.rows[0]?.vault_id === record.vaultId;
  }

  async getVault(vaultId: string, subjectId: string): Promise<OAuthVaultRecord | null> {
    const result = await this.query<VaultRow>(
      'get OAuth vault',
      `SELECT ${VAULT_COLUMNS} FROM hosted.oauth_vaults
       WHERE vault_id = $1 AND subject_id = $2`,
      [vaultId, subjectId],
    );
    return result.rows[0] ? vault(result.rows[0]) : null;
  }

  async takeVault(vaultId: string, subjectId: string): Promise<OAuthVaultRecord | null> {
    const result = await this.query<VaultRow>(
      'take OAuth vault',
      `DELETE FROM hosted.oauth_vaults
       WHERE vault_id = $1 AND subject_id = $2
       RETURNING ${VAULT_COLUMNS}`,
      [vaultId, subjectId],
    );
    return result.rows[0] ? vault(result.rows[0]) : null;
  }

  async takeVaultsForSubject(subjectId: string): Promise<OAuthVaultRecord[]> {
    const result = await this.query<VaultRow>(
      'take OAuth account vaults',
      `DELETE FROM hosted.oauth_vaults
       WHERE subject_id = $1
       RETURNING ${VAULT_COLUMNS}`,
      [subjectId],
    );
    return result.rows.map(vault);
  }

  async recordSession(record: OAuthBrokerSessionRecord): Promise<void> {
    await this.query(
      'record OAuth session binding',
      `INSERT INTO hosted.oauth_sessions (
         session_id, vault_id, provider, subject_id, destination_id,
         operations, created_at, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7::timestamptz, $8::timestamptz)`,
      [
        record.sessionId,
        record.vaultId,
        record.provider,
        record.subjectId,
        record.destinationId,
        [...record.operations],
        record.createdAt,
        record.expiresAt,
      ],
    );
  }

  async appendAudit(event: OAuthBrokerAuditEvent): Promise<void> {
    await this.query(
      'append OAuth audit event',
      `INSERT INTO hosted.oauth_audit_events (
         audit_id, subject_id, action, outcome, provider, vault_id,
         destination_id, operation, detail_code, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)`,
      [
        event.auditId,
        event.subjectId,
        event.action,
        event.outcome,
        event.provider,
        event.vaultId,
        event.destinationId,
        event.operation,
        event.detailCode,
        event.createdAt,
      ],
    );
  }
}
