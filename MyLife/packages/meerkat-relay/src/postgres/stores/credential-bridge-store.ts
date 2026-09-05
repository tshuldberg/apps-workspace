/**
 * Plan 51 P1: PostgreSQL-backed CredentialBridgeStore over migration 18's credential.*
 * schema. Holds ONLY credential.epoch_keys (public) + credential.revocations (serial).
 * No account identifier ever enters this schema (AC-2). Revocation is idempotent via
 * INSERT ... ON CONFLICT DO NOTHING keyed on the serial primary key.
 */

import type { QueryResult, QueryResultRow } from 'pg';
import {
  isCredentialSerial,
  type CredentialBridgeStore,
  type CredentialBridgeStoreStats,
  type RevokeSerialOutcome,
} from '../../credential-bridge-store';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

interface EpochKeyRow extends QueryResultRow {
  public_key_spki_der_base64: string;
}

interface RevocationRow extends QueryResultRow {
  serial: string;
}

interface CountRow extends QueryResultRow {
  count: string;
}

export class PostgresCredentialBridgeStore implements CredentialBridgeStore {
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

  async publishEpochKey(
    epoch: number,
    publicKeySpkiDerBase64: string,
    notBeforeMs: number,
    notAfterMs: number,
  ): Promise<void> {
    await this.query(
      'publish epoch key',
      `INSERT INTO credential.epoch_keys (epoch, public_key_spki_der_base64, not_before, not_after)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (epoch) DO NOTHING`,
      [epoch, publicKeySpkiDerBase64, new Date(notBeforeMs).toISOString(), new Date(notAfterMs).toISOString()],
    );
  }

  async getEpochPublicKey(epoch: number): Promise<string | null> {
    const result = await this.query<EpochKeyRow>(
      'get epoch public key',
      'SELECT public_key_spki_der_base64 FROM credential.epoch_keys WHERE epoch = $1',
      [epoch],
    );
    return result.rows[0]?.public_key_spki_der_base64 ?? null;
  }

  async revokeSerial(serial: string, epoch: number, reasonCode: string): Promise<RevokeSerialOutcome> {
    if (!isCredentialSerial(serial)) throw new Error('Serial must be 64 lowercase hex');
    const result = await this.query(
      'revoke serial',
      `INSERT INTO credential.revocations (serial, epoch, reason_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (serial) DO NOTHING`,
      [serial, epoch, reasonCode],
    );
    return (result.rowCount ?? 0) > 0 ? 'revoked' : 'already_revoked';
  }

  async isSerialRevoked(serial: string): Promise<boolean> {
    const result = await this.query<RevocationRow>(
      'is serial revoked',
      'SELECT serial FROM credential.revocations WHERE serial = $1',
      [serial],
    );
    return result.rows.length > 0;
  }

  async stats(): Promise<CredentialBridgeStoreStats> {
    const [epochKeys, revocations] = await Promise.all([
      this.query<CountRow>('count epoch keys', 'SELECT count(*)::text AS count FROM credential.epoch_keys'),
      this.query<CountRow>('count revocations', 'SELECT count(*)::text AS count FROM credential.revocations'),
    ]);
    return {
      epochKeys: Number(epochKeys.rows[0]?.count ?? 0),
      revocations: Number(revocations.rows[0]?.count ?? 0),
    };
  }
}
