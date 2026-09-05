import type { ReconciliationResult, ReconciliationMismatch } from './types';

interface LocalRecord {
  externalId: string;
  status: string;
  updatedAt: string;
}

interface RemoteRecord {
  externalId: string;
  status: string;
  updatedAt: string;
}

export function diffRecords(local: LocalRecord[], remote: RemoteRecord[]): ReconciliationMismatch[] {
  const mismatches: ReconciliationMismatch[] = [];
  const localMap = new Map(local.map((r) => [r.externalId, r]));

  const remoteMap = new Map(remote.map((r) => [r.externalId, r]));
  for (const [id, remoteRec] of Array.from(remoteMap)) {
    const localRec = localMap.get(id);
    if (!localRec) {
      mismatches.push({ externalId: id, localStatus: null, remoteStatus: remoteRec.status, action: 'create_local' });
    } else if (localRec.status !== remoteRec.status) {
      const localTime = new Date(localRec.updatedAt).getTime();
      const remoteTime = new Date(remoteRec.updatedAt).getTime();
      mismatches.push({
        externalId: id,
        localStatus: localRec.status,
        remoteStatus: remoteRec.status,
        action: remoteTime > localTime ? 'update_local' : 'update_remote',
      });
    }
  }

  return mismatches;
}

export function buildReconciliationResult(
  connectionId: string,
  local: LocalRecord[],
  remote: RemoteRecord[],
  repaired: number = 0,
): ReconciliationResult {
  return {
    connectionId,
    checkedAt: new Date().toISOString(),
    localCount: local.length,
    remoteCount: remote.length,
    mismatches: diffRecords(local, remote),
    repaired,
  };
}
