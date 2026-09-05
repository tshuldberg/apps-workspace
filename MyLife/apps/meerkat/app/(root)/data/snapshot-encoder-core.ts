import {
  createBackupEncoder,
  type BackupEncoder,
  type BackupEncoderFinalizeResult,
  type BackupEncoderInput,
  type EncryptedBackupChunk,
} from '@mylife/sync/src/storage/backup-format';

export const DEFAULT_SNAPSHOT_CHUNK_BYTES = 4 * 1024 * 1024;
export const MAXIMUM_SNAPSHOT_CHUNK_BYTES = 16 * 1024 * 1024;
const BACKUP_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/u;

export interface SnapshotByteSource {
  size(): Promise<number>;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface EncodeSnapshotSourceInput {
  source: SnapshotByteSource;
  encoderInput: BackupEncoderInput;
  writeEncryptedChunk(chunk: EncryptedBackupChunk): Promise<void>;
  writeAdditionalObjects?: (encoder: BackupEncoder) => Promise<void>;
  chunkBytes?: number;
}

export interface EncodedSnapshotSource extends BackupEncoderFinalizeResult {
  plaintextBytes: number;
  databaseChunkCount: number;
  maximumPlaintextChunkBytes: number;
}

export class SnapshotSourceError extends Error {
  readonly code: 'invalid_size' | 'short_read' | 'oversized_read';

  constructor(code: SnapshotSourceError['code'], message: string) {
    super(message);
    this.name = 'SnapshotSourceError';
    this.code = code;
  }
}

function checkedChunkBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAXIMUM_SNAPSHOT_CHUNK_BYTES) {
    throw new SnapshotSourceError(
      'invalid_size',
      `Snapshot chunk size must be between 1 and ${MAXIMUM_SNAPSHOT_CHUNK_BYTES} bytes.`,
    );
  }
  return value;
}

export function assertSafeSnapshotBackupId(backupId: string): void {
  if (!BACKUP_ID_PATTERN.test(backupId) || backupId === '.' || backupId === '..') {
    throw new SnapshotSourceError('invalid_size', 'The snapshot backup id is not path safe.');
  }
}

export async function encodeSnapshotSource(
  input: EncodeSnapshotSourceInput,
): Promise<EncodedSnapshotSource> {
  assertSafeSnapshotBackupId(input.encoderInput.backupId);
  const chunkBytes = checkedChunkBytes(input.chunkBytes ?? DEFAULT_SNAPSHOT_CHUNK_BYTES);
  const sourceBytes = await input.source.size();
  if (!Number.isSafeInteger(sourceBytes) || sourceBytes <= 0) {
    throw new SnapshotSourceError('invalid_size', 'The SQLite snapshot has no readable bytes.');
  }

  const encoder = createBackupEncoder(input.encoderInput);
  let offset = 0;
  let databaseChunkCount = 0;
  let maximumPlaintextChunkBytes = 0;
  while (offset < sourceBytes) {
    const requestedBytes = Math.min(chunkBytes, sourceBytes - offset);
    const plaintext = await input.source.read(offset, requestedBytes);
    if (plaintext.length < requestedBytes) {
      plaintext.fill(0);
      throw new SnapshotSourceError('short_read', 'The SQLite snapshot ended during a bounded read.');
    }
    if (plaintext.length > requestedBytes || plaintext.length > chunkBytes) {
      plaintext.fill(0);
      throw new SnapshotSourceError('oversized_read', 'The snapshot source exceeded the requested read bound.');
    }
    maximumPlaintextChunkBytes = Math.max(maximumPlaintextChunkBytes, plaintext.length);
    try {
      await input.writeEncryptedChunk(encoder.addDatabaseChunk(plaintext));
    } finally {
      plaintext.fill(0);
    }
    offset += requestedBytes;
    databaseChunkCount += 1;
  }

  await input.writeAdditionalObjects?.(encoder);

  const finalized = encoder.finalize();
  return {
    ...finalized,
    plaintextBytes: sourceBytes,
    databaseChunkCount,
    maximumPlaintextChunkBytes,
  };
}
