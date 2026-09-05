import { describe, expect, it } from 'vitest';
import type { PostgresStoreContext } from '../../store-context';
import { PostgresStoreUnavailableError } from '../../store-context';
import { PostgresOAuthBrokerStore } from '../oauth-broker-store';

interface ScriptedResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

class ScriptedDatabase {
  readonly calls: Array<{ sql: string; values: readonly unknown[] }> = [];

  constructor(
    private readonly results: ScriptedResult[] = [],
    private readonly failure: Error | null = null,
  ) {}

  async query(sql: string, values: readonly unknown[] = []): Promise<ScriptedResult> {
    this.calls.push({ sql, values });
    if (this.failure) throw this.failure;
    const result = this.results.shift();
    if (!result) throw new Error('unexpected OAuth broker query');
    return result;
  }
}

describe('PostgresOAuthBrokerStore', () => {
  it('consumes pending callback state atomically with DELETE RETURNING', async () => {
    const database = new ScriptedDatabase([{
      rows: [{
        state_hash: 'a'.repeat(64),
        code_challenge: 'b'.repeat(43),
        subject_id: 'subject-1',
        provider: 'google',
        destination_label: 'My Drive',
        redirect_uri: 'https://app.example.test/oauth/google',
        created_at: new Date('2026-07-14T12:00:00.000Z'),
        expires_at: new Date('2026-07-14T12:10:00.000Z'),
      }],
      rowCount: 1,
    }]);
    const store = new PostgresOAuthBrokerStore(database as unknown as PostgresStoreContext);

    await expect(store.consumePendingConnect('a'.repeat(64))).resolves.toMatchObject({
      stateHash: 'a'.repeat(64),
      subjectId: 'subject-1',
      provider: 'google',
    });
    expect(database.calls[0]?.sql).toContain('DELETE FROM hosted.oauth_pending_connects');
    expect(database.calls[0]?.sql).toContain('RETURNING');
    expect(database.calls[0]?.values).toEqual(['a'.repeat(64)]);
  });

  it('binds vault ciphertext as bytea values without serializing token plaintext', async () => {
    const database = new ScriptedDatabase([{ rows: [], rowCount: 1 }]);
    const store = new PostgresOAuthBrokerStore(database as unknown as PostgresStoreContext);
    const refreshCanary = 'refresh-token-must-not-enter-sql';

    await store.putVault({
      vaultId: 'vault-1',
      provider: 'google',
      subjectId: 'subject-1',
      encryptedRefreshToken: new Uint8Array(48).fill(7),
      wrappedDataKey: new Uint8Array(60).fill(8),
      nonce: new Uint8Array(12).fill(9),
      accountHint: 'a***@example.test',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      createdAt: '2026-07-14T12:00:00.000Z',
    });

    const call = database.calls[0];
    expect(call?.sql).toContain('INSERT INTO hosted.oauth_vaults');
    expect(call?.values[3]).toBeInstanceOf(Buffer);
    expect(call?.values[4]).toBeInstanceOf(Buffer);
    expect(call?.values[5]).toBeInstanceOf(Buffer);
    expect(JSON.stringify(call)).not.toContain(refreshCanary);
  });

  it('replaces rotated vault credentials only through the subject and provider binding', async () => {
    const database = new ScriptedDatabase([{
      rows: [{ vault_id: 'vault-1' }],
      rowCount: 1,
    }]);
    const store = new PostgresOAuthBrokerStore(database as unknown as PostgresStoreContext);

    await expect(store.replaceVault({
      vaultId: 'vault-1',
      provider: 'google',
      subjectId: 'subject-1',
      encryptedRefreshToken: new Uint8Array(48).fill(10),
      wrappedDataKey: new Uint8Array(60).fill(11),
      nonce: new Uint8Array(12).fill(12),
      accountHint: 'a***@example.test',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      createdAt: '2026-07-14T12:00:00.000Z',
    })).resolves.toBe(true);

    expect(database.calls[0]?.sql).toContain('UPDATE hosted.oauth_vaults');
    expect(database.calls[0]?.sql).toContain('vault_id = $1 AND subject_id = $2 AND provider = $3');
    expect(database.calls[0]?.values.slice(0, 3)).toEqual(['vault-1', 'subject-1', 'google']);
    expect(database.calls[0]?.values[3]).toBeInstanceOf(Buffer);
  });

  it('maps PostgreSQL failures to an explicit unavailable authority error', async () => {
    const database = new ScriptedDatabase([], new Error('database offline'));
    const store = new PostgresOAuthBrokerStore(database as unknown as PostgresStoreContext);

    await expect(store.getVault('vault-1', 'subject-1')).rejects.toBeInstanceOf(PostgresStoreUnavailableError);
    await expect(store.getVault('vault-1', 'subject-1')).rejects.toMatchObject({
      code: 'postgres_store_unavailable',
      operation: 'get OAuth vault',
    });
  });
});
