import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { identityKey } from '../state-import/digest';
import type { CutoverDigestMap } from './stores/cutover-store';
import type { PostgresStoreContext } from './store-context';
import { toPostgresStoreUnavailableError } from './store-context';

/** PostgreSQL-only durable state that cannot be enumerated by the file cutover engine. */
export const POSTGRES_BACKUP_PROOF_STORE_IDS = [
  'hosted.storage-api-objects',
  'hosted.storage-backup-locators',
  'hosted.oauth-vaults',
] as const;

interface ProofRow extends QueryResultRow {
  proof_identity: string[];
  proof_payload: string;
}

interface ProofStoreSpec {
  storeId: (typeof POSTGRES_BACKUP_PROOF_STORE_IDS)[number];
  cursorWidth: number;
  sql: string;
}

const PAGE_SIZE = 1_000;

const PROOF_STORE_SPECS: readonly ProofStoreSpec[] = [
  {
    storeId: 'hosted.storage-api-objects',
    cursorWidth: 2,
    sql: `
      SELECT ARRAY[subject_id, object_id]::text[] AS proof_identity,
        jsonb_build_object(
          'subjectId', subject_id,
          'objectId', object_id,
          'encryptedBytes', encrypted_bytes::text,
          'ciphertextHash', ciphertext_hash,
          'dataClass', data_class,
          'totalBlocks', total_blocks,
          'version', version,
          'createdAt', to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        )::text AS proof_payload
      FROM hosted.storage_api_objects
      WHERE $1::text IS NULL OR (subject_id, object_id) > ($1::text, $2::text)
      ORDER BY subject_id, object_id
      LIMIT $3
    `,
  },
  {
    storeId: 'hosted.storage-backup-locators',
    cursorWidth: 2,
    sql: `
      SELECT ARRAY[subject_id, backup_id]::text[] AS proof_identity,
        jsonb_build_object(
          'subjectId', subject_id,
          'backupId', backup_id,
          'formatVersion', format_version,
          'encryptedManifestHash', encrypted_manifest_hash,
          'createdAt', to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ),
          'manifestObjectId', manifest_object_id,
          'recordedAt', to_char(
            recorded_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        )::text AS proof_payload
      FROM hosted.storage_backup_locators
      WHERE $1::text IS NULL OR (subject_id, backup_id) > ($1::text, $2::text)
      ORDER BY subject_id, backup_id
      LIMIT $3
    `,
  },
  {
    storeId: 'hosted.oauth-vaults',
    cursorWidth: 1,
    sql: `
      SELECT ARRAY[vault_id]::text[] AS proof_identity,
        jsonb_build_object(
          'vaultId', vault_id,
          'provider', provider,
          'subjectId', subject_id,
          'encryptedRefreshToken', encode(encrypted_refresh_token, 'hex'),
          'wrappedDataKey', encode(wrapped_data_key, 'hex'),
          'nonce', encode(nonce, 'hex'),
          'accountHint', account_hint,
          'scopes', to_jsonb(scopes),
          'createdAt', to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        )::text AS proof_payload
      FROM hosted.oauth_vaults
      WHERE $1::text IS NULL OR vault_id > $1::text
      ORDER BY vault_id
      LIMIT $2
    `,
  },
] as const;

function assertProofRow(row: ProofRow, spec: ProofStoreSpec): void {
  if (!Array.isArray(row.proof_identity)
    || row.proof_identity.length !== spec.cursorWidth
    || row.proof_identity.some((part) => typeof part !== 'string' || part.length === 0)) {
    throw new Error(`PostgreSQL backup proof inventory returned an invalid identity for ${spec.storeId}`);
  }
  if (typeof row.proof_payload !== 'string' || row.proof_payload.length === 0) {
    throw new Error(`PostgreSQL backup proof inventory returned an invalid payload for ${spec.storeId}`);
  }
}

async function digestProofStore(
  database: PostgresStoreContext,
  spec: ProofStoreSpec,
): Promise<{ count: number; rollupHex: string }> {
  const rollup = createHash('sha256');
  let count = 0;
  let cursor = Array<string | null>(spec.cursorWidth).fill(null);

  for (;;) {
    const result = await database.query<ProofRow>(spec.sql, [...cursor, PAGE_SIZE]);
    if (result.rows.length > PAGE_SIZE) {
      throw new Error(`PostgreSQL backup proof inventory exceeded its page bound for ${spec.storeId}`);
    }

    for (const row of result.rows) {
      assertProofRow(row, spec);
      const recordHash = createHash('sha256')
        .update(identityKey(row.proof_identity), 'utf8')
        .update('\0', 'utf8')
        .update(row.proof_payload, 'utf8')
        .digest('hex');
      rollup.update(recordHash, 'utf8');
      count += 1;
      if (!Number.isSafeInteger(count)) {
        throw new Error(`PostgreSQL backup proof inventory count is unsafe for ${spec.storeId}`);
      }
    }

    if (result.rows.length < PAGE_SIZE) break;
    const nextCursor = result.rows.at(-1)!.proof_identity;
    if (nextCursor.every((part, index) => part === cursor[index])) {
      throw new Error(`PostgreSQL backup proof inventory cursor did not advance for ${spec.storeId}`);
    }
    cursor = [...nextCursor];
  }

  return { count, rollupHex: rollup.digest('hex') };
}

/** Digest every PostgreSQL-only durable table required by backup restore proof. */
export async function digestPostgresBackupProofStores(
  database: PostgresStoreContext,
): Promise<CutoverDigestMap> {
  try {
    const digests: CutoverDigestMap = {};
    for (const spec of PROOF_STORE_SPECS) {
      digests[spec.storeId] = await digestProofStore(database, spec);
    }
    return digests;
  } catch (error) {
    throw toPostgresStoreUnavailableError('digest backup proof inventory', error);
  }
}
