import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  digestPostgresBackupProofStores,
  POSTGRES_BACKUP_PROOF_STORE_IDS,
} from '../backup-proof-inventory';
import type { PostgresStoreContext } from '../store-context';

interface FakeProofRow {
  proof_identity: string[];
  proof_payload: string;
}

type Payloads = Record<(typeof POSTGRES_BACKUP_PROOF_STORE_IDS)[number], FakeProofRow[]>;

function storeIdForSql(sql: string): (typeof POSTGRES_BACKUP_PROOF_STORE_IDS)[number] {
  if (sql.includes('FROM hosted.storage_api_objects')) return 'hosted.storage-api-objects';
  if (sql.includes('FROM hosted.storage_backup_locators')) return 'hosted.storage-backup-locators';
  if (sql.includes('FROM hosted.oauth_vaults')) return 'hosted.oauth-vaults';
  throw new Error(`Unexpected proof inventory query: ${sql}`);
}

function fakeDatabase(payloads: Payloads): { database: PostgresStoreContext; queries: string[] } {
  const queries: string[] = [];
  const database = {
    async query<Row extends QueryResultRow>(sql: string, values: readonly unknown[] = []) {
      queries.push(sql);
      const storeId = storeIdForSql(sql);
      const rows = payloads[storeId];
      const cursorWidth = storeId === 'hosted.oauth-vaults' ? 1 : 2;
      const cursor = values.slice(0, cursorWidth);
      const after = cursor[0] === null
        ? 0
        : rows.findIndex((row) => row.proof_identity.every((part, index) => part === cursor[index])) + 1;
      const limit = Number(values[cursorWidth]);
      return {
        rows: rows.slice(after, after + limit) as unknown as Row[],
        rowCount: Math.min(limit, Math.max(0, rows.length - after)),
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as QueryResult<Row>;
    },
  } as unknown as PostgresStoreContext;
  return { database, queries };
}

function fixture(): Payloads {
  return {
    'hosted.storage-api-objects': [{
      proof_identity: ['subject-a', 'object-a'],
      proof_payload: '{"ciphertextHash":"aaa","encryptedBytes":"42"}',
    }],
    'hosted.storage-backup-locators': [{
      proof_identity: ['subject-a', 'backup-a'],
      proof_payload: '{"encryptedManifestHash":"bbb","formatVersion":1}',
    }],
    'hosted.oauth-vaults': [{
      proof_identity: ['vault-a'],
      proof_payload: '{"encryptedRefreshToken":"cccc","wrappedDataKey":"dddd"}',
    }],
  };
}

describe('PostgreSQL backup proof inventory', () => {
  it('covers every PostgreSQL-only durable proof table and every durable column', async () => {
    const input = fakeDatabase(fixture());
    const digests = await digestPostgresBackupProofStores(input.database);

    expect(Object.keys(digests)).toEqual(POSTGRES_BACKUP_PROOF_STORE_IDS);
    for (const storeId of POSTGRES_BACKUP_PROOF_STORE_IDS) {
      expect(digests[storeId]?.count).toBe(1);
      expect(digests[storeId]?.rollupHex).toMatch(/^[a-f0-9]{64}$/);
    }

    const sql = input.queries.join('\n');
    for (const column of [
      'encrypted_bytes', 'ciphertext_hash', 'data_class', 'total_blocks', 'version',
      'format_version', 'encrypted_manifest_hash', 'manifest_object_id', 'recorded_at',
      'provider', 'subject_id', 'encrypted_refresh_token', 'wrapped_data_key', 'nonce',
      'account_hint', 'scopes', 'created_at',
    ]) {
      expect(sql).toContain(column);
    }
  });

  it('changes only the mutated store digest', async () => {
    const baseline = await digestPostgresBackupProofStores(fakeDatabase(fixture()).database);
    const changedFixture = fixture();
    changedFixture['hosted.oauth-vaults'][0] = {
      ...changedFixture['hosted.oauth-vaults'][0]!,
      proof_payload: '{"encryptedRefreshToken":"changed","wrappedDataKey":"dddd"}',
    };
    const changed = await digestPostgresBackupProofStores(fakeDatabase(changedFixture).database);

    expect(changed['hosted.oauth-vaults']?.rollupHex)
      .not.toBe(baseline['hosted.oauth-vaults']?.rollupHex);
    expect(changed['hosted.storage-api-objects'])
      .toEqual(baseline['hosted.storage-api-objects']);
    expect(changed['hosted.storage-backup-locators'])
      .toEqual(baseline['hosted.storage-backup-locators']);
  });

  it('keyset-pages a large table without dropping the boundary record', async () => {
    const payloads = fixture();
    payloads['hosted.storage-api-objects'] = Array.from({ length: 1_001 }, (_, index) => ({
      proof_identity: ['subject-a', `object-${String(index).padStart(4, '0')}`],
      proof_payload: `{"version":${index}}`,
    }));
    const input = fakeDatabase(payloads);
    const digests = await digestPostgresBackupProofStores(input.database);

    expect(digests['hosted.storage-api-objects']?.count).toBe(1_001);
    expect(input.queries.filter((sql) => sql.includes('FROM hosted.storage_api_objects')))
      .toHaveLength(2);
  });
});
